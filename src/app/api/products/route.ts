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

    if (section) filtered = filtered.filter(r => r.section === section);
    if (category && category !== 'all') filtered = filtered.filter(r => r.category === category);
    if (platform) filtered = filtered.filter(r => r.platform === platform);

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
    } = body;

    if (!title || !affiliate_url) {
      return NextResponse.json({ error: '제목과 링크는 필수예요' }, { status: 400 });
    }

    // review_highlights: string[] → JSON 문자열로 저장
    const reviewJson = review_highlights && Array.isArray(review_highlights) && review_highlights.length > 0
      ? JSON.stringify(review_highlights)
      : null;

    const sql = getDb();

    // review_highlights 컬럼 없으면 추가
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_highlights TEXT`;
    } catch { /* 이미 있으면 무시 */ }

    try {
      const rows = await sql`
        INSERT INTO products (title, image_url, affiliate_url, platform, category, section, sale_price, original_price, discount_rate, sort_order, review_highlights)
        VALUES (${title}, ${image_url || null}, ${affiliate_url}, ${platform || 'coupang'}, ${category || 'all'}, ${section || 'recommend'}, ${sale_price || 0}, ${original_price || 0}, ${discount_rate || 0}, ${sort_order || 0}, ${reviewJson})
        RETURNING *
      `;
      return NextResponse.json({ data: rows[0] });
    } catch (e: unknown) {
      if (String(e).includes('does not exist')) {
        await initTables();
        try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_highlights TEXT`; } catch { /* */ }
        const rows = await sql`
          INSERT INTO products (title, image_url, affiliate_url, platform, category, section, sale_price, original_price, discount_rate, sort_order, review_highlights)
          VALUES (${title}, ${image_url || null}, ${affiliate_url}, ${platform || 'coupang'}, ${category || 'all'}, ${section || 'recommend'}, ${sale_price || 0}, ${original_price || 0}, ${discount_rate || 0}, ${sort_order || 0}, ${reviewJson})
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
