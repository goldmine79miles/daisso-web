import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/db';

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

    // 자동 TOP5 승급 + 어드민 강제 고정:
    // - section='ranking'인 상품은 PINNED (강제 고정) — 항상 TOP5에 포함
    // - 남은 자리는 section='recommend' 중 view_count 상위로 채움
    // - section=recommend 요청 시: 위 TOP5에 들어간 상품은 제외
    const pinned = filtered.filter(r => r.section === 'ranking')
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    const remainingSlots = Math.max(0, 5 - pinned.length);
    const autoPicks = filtered
      .filter(r => r.section === 'recommend')
      .sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0))
      .slice(0, remainingSlots);
    const top5 = [...pinned, ...autoPicks].slice(0, 5);
    const top5Ids = new Set(top5.map(r => r.id));

    if (section === 'ranking') {
      filtered = top5;
    } else if (section === 'recommend') {
      filtered = filtered.filter(r => r.section === 'recommend' && !top5Ids.has(r.id));
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
