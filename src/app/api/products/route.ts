import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

// GET /api/products?section=ranking&category=all&platform=coupang&active=all
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const section = searchParams.get('section');
  const category = searchParams.get('category');
  const platform = searchParams.get('platform');
  const active = searchParams.get('active'); // 'all' = 포함, 기본은 active만

  const sql = getDb();

  try {
    // neon은 tagged template만 지원 → 전체 조회 후 JS 필터
    const rows = await sql`SELECT * FROM products ORDER BY sort_order ASC, created_at DESC`;

    let filtered = rows as Array<Record<string, unknown>>;

    // 기본: active만 (어드민에서 active=all로 호출하면 전체)
    if (active !== 'all') {
      filtered = filtered.filter(r => r.is_active === true);
    }

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
