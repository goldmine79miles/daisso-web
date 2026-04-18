import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { getShuffleConfig, getAllSettings, setSetting } from '@/lib/settings';

/** 결정적 셔플 — bucket을 시드로 사용 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 자동 셔플 lazy 트리거 — "마지막 셔플 시각 + interval시간 >= 지금" 일 때만 실행.
 * bucket 경계 대신 실제 경과 시간 기반이라, 수동 셔플 직후에도 풀 interval 보장됨.
 * 수동 "지금 섞기"는 shuffle_at을 현재 시각으로 기록하므로 다음 auto는 N시간 후에만 트리거.
 */
async function maybeAutoShuffle() {
  const cfg = await getShuffleConfig();
  if (!cfg.enabled) return;

  const settings = await getAllSettings();
  const lastShuffleAt = Number(settings.shuffle_at) || 0;
  const intervalMs = cfg.intervalHours * 60 * 60 * 1000;
  const now = Date.now();

  // 마지막 셔플 이후 interval 시간 안 지났으면 건너뜀 (로그인/재방문 영향 없음)
  if (lastShuffleAt > 0 && now - lastShuffleAt < intervalMs) return;

  // 셔플 대상: 활성 + non-ranking + 고정 핀 아닌 것
  const sql = getDb();
  const rows = await sql`SELECT id FROM products WHERE is_active = true AND section != 'ranking' AND (pinned IS NULL OR pinned = false) ORDER BY sort_order ASC, created_at DESC`;
  const list = rows as Array<{ id: number }>;
  if (list.length < 2) {
    await setSetting('shuffle_at', String(now));
    return;
  }

  // 시드: 현재 interval bucket (같은 시간대 병렬 요청은 같은 결과 → 멱등)
  const bucket = Math.floor(now / intervalMs);
  const shuffled = seededShuffle(list, bucket);
  try {
    for (let i = 0; i < shuffled.length; i++) {
      await sql`UPDATE products SET sort_order = ${i}, updated_at = NOW() WHERE id = ${shuffled[i].id}`;
    }
    await setSetting('shuffle_at', String(now));
  } catch (e) {
    console.error('[auto-shuffle]', e);
  }
}

// GET /api/products?section=ranking&category=all&platform=coupang&active=all
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const section = searchParams.get('section');
  const category = searchParams.get('category');
  const platform = searchParams.get('platform');
  const active = searchParams.get('active'); // 'all' = 포함, 기본은 active만

  const sql = getDb();

  try {
    // 자동 셔플 — bucket 바뀌었으면 DB에 새 순서 기록 (요청에 따라 lazy 실행)
    await maybeAutoShuffle();

    // neon은 tagged template만 지원 → 전체 조회 후 JS 필터
    const rows = await sql`SELECT * FROM products ORDER BY sort_order ASC, created_at DESC`;
    const all = rows as Array<Record<string, unknown>>;

    // 어드민이든 공개든 동일한 "활성 상품 순서"를 먼저 계산
    // 어드민은 끝에 비활성 상품을 붙임 → 유저가 보는 순서 + 비활성 하단 확인
    let filtered = all.filter(r => r.is_active === true);

    if (category && category !== 'all') filtered = filtered.filter(r => r.category === category);
    if (platform) filtered = filtered.filter(r => r.platform === platform);

    // 자동 TOP5 승급 + 강제 고정 + 24시간 만료:
    // - pinned=true → 무조건 TOP5 (영구)
    // - section='ranking' + pinned=false + ranked_at < 24h → TOP5 (임시)
    // - 나머지 자리 → section='recommend' 중 view_count 상위로 채움
    // - section='ranking' + pinned=false + ranked_at >= 24h → recommend 로 fallback (만료)
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const isPermaPinned = (r: Record<string, unknown>) => r.pinned === true;
    const isTempRanking = (r: Record<string, unknown>) => {
      if (r.section !== 'ranking' || r.pinned === true) return false;
      const t = r.ranked_at ? new Date(String(r.ranked_at)).getTime() : 0;
      return t > 0 && (now - t) < DAY_MS;
    };

    const permaPinned = filtered.filter(isPermaPinned)
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    const tempRanking = filtered.filter(isTempRanking)
      .sort((a, b) => new Date(String(b.ranked_at)).getTime() - new Date(String(a.ranked_at)).getTime());

    const fixedRanking = [...permaPinned, ...tempRanking].slice(0, 5);
    const fixedIds = new Set(fixedRanking.map(r => r.id));
    const remainingSlots = Math.max(0, 5 - fixedRanking.length);

    // 만료된 임시 랭킹도 recommend 풀에 포함
    const recommendPool = filtered.filter(r => {
      if (fixedIds.has(r.id)) return false;
      if (r.section === 'recommend') return true;
      if (r.section === 'ranking' && r.pinned !== true) return true; // 만료 랭킹
      return false;
    });

    const autoPicks = [...recommendPool]
      .sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0))
      .slice(0, remainingSlots);
    const top5 = [...fixedRanking, ...autoPicks].slice(0, 5);
    const top5Ids = new Set(top5.map(r => r.id));

    if (section === 'ranking') {
      filtered = top5;
    } else if (section === 'recommend') {
      // 추천 섹션은 section='recommend' 상품 전체 보여줌 (TOP5와 중복되어도 OK — 상단 핫픽, 아래 전체 리스트 구조)
      filtered = filtered.filter(r => r.section === 'recommend');
    } else if (section) {
      filtered = filtered.filter(r => r.section === section);
    }

    // 셔플은 이미 maybeAutoShuffle에서 DB sort_order로 반영됨 → 여기선 순서 조작 없음
    // TOP5는 top5 로직으로 이미 계산되어 있고, 나머지는 sort_order 그대로

    // 어드민 모드(active=all): 활성 상품 순서 + 비활성 상품을 뒤에 추가
    if (active === 'all') {
      let inactive = all.filter(r => r.is_active === false);
      if (category && category !== 'all') inactive = inactive.filter(r => r.category === category);
      if (platform) inactive = inactive.filter(r => r.platform === platform);
      if (section && section !== 'ranking') inactive = inactive.filter(r => r.section === section);
      // 비활성은 자연 순서 유지
      inactive.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
      filtered = [...filtered, ...inactive];
    }

    return NextResponse.json({ data: filtered });
  } catch (e: unknown) {
    if (String(e).includes('does not exist')) {
      await initTables();
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/products — 상품 등록
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const {
      title, image_url, affiliate_url, platform,
      category, section, sale_price, original_price,
      discount_rate, sort_order, review_highlights,
      rating, review_count,
    } = body;

    if (!title || !affiliate_url) {
      return NextResponse.json({ error: '제목과 링크는 필수예요' }, { status: 400 });
    }

    // review_highlights: string[] → JSON 문자열로 저장
    const reviewJson = review_highlights && Array.isArray(review_highlights) && review_highlights.length > 0
      ? JSON.stringify(review_highlights)
      : null;

    const sql = getDb();

    // 컬럼 없으면 추가 (rating / review_count / review_highlights)
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_highlights TEXT`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 0`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0`;
    } catch { /* 이미 있으면 무시 */ }

    try {
      const rows = await sql`
        INSERT INTO products (title, image_url, affiliate_url, platform, category, section, sale_price, original_price, discount_rate, sort_order, review_highlights, rating, review_count)
        VALUES (${title}, ${image_url || null}, ${affiliate_url}, ${platform || 'coupang'}, ${category || 'all'}, ${section || 'recommend'}, ${sale_price || 0}, ${original_price || 0}, ${discount_rate || 0}, ${sort_order || 0}, ${reviewJson}, ${rating || 0}, ${review_count || 0})
        RETURNING *
      `;
      return NextResponse.json({ data: rows[0] });
    } catch (e: unknown) {
      if (String(e).includes('does not exist')) {
        await initTables();
        try {
          await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_highlights TEXT`;
          await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 0`;
          await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0`;
        } catch { /* */ }
        const rows = await sql`
          INSERT INTO products (title, image_url, affiliate_url, platform, category, section, sale_price, original_price, discount_rate, sort_order, review_highlights, rating, review_count)
          VALUES (${title}, ${image_url || null}, ${affiliate_url}, ${platform || 'coupang'}, ${category || 'all'}, ${section || 'recommend'}, ${sale_price || 0}, ${original_price || 0}, ${discount_rate || 0}, ${sort_order || 0}, ${reviewJson}, ${rating || 0}, ${review_count || 0})
          RETURNING *
        `;
        return NextResponse.json({ data: rows[0] });
      }
      throw e;
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
