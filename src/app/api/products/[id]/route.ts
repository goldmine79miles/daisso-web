import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

type Props = { params: Promise<{ id: string }> };

// PUT /api/products/[id] — 상품 수정
export async function PUT(req: NextRequest, { params }: Props) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      title, image_url, affiliate_url, platform,
      category, section, sale_price, original_price,
      discount_rate, sort_order, is_active, review_highlights,
      pinned, rating, review_count,
    } = body;

    const reviewJson = review_highlights !== undefined
      ? (Array.isArray(review_highlights) && review_highlights.length > 0 ? JSON.stringify(review_highlights) : null)
      : undefined;

    const sql = getDb();
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_highlights TEXT`; } catch { /* */ }
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS ranked_at TIMESTAMP`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 0`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0`;
    } catch { /* */ }

    // 현재 section 확인 — 랭킹으로 새로 올라가면 ranked_at 갱신
    const current = await sql`SELECT section FROM products WHERE id = ${Number(id)}`;
    const prevSection = current[0]?.section;
    const willPromote = typeof section === 'string' && section === 'ranking' && prevSection !== 'ranking';
    const willDemote = typeof section === 'string' && section !== 'ranking' && prevSection === 'ranking';
    // 타임스탬프: 새로 랭킹이면 NOW(), 랭킹 떠나면 null, 아니면 기존 유지
    const rankedAtExpr = willPromote ? new Date().toISOString() : willDemote ? null : undefined;

    const rows = await sql`
      UPDATE products SET
        title = COALESCE(${title ?? null}, title),
        image_url = COALESCE(${image_url ?? null}, image_url),
        affiliate_url = COALESCE(${affiliate_url ?? null}, affiliate_url),
        platform = COALESCE(${platform ?? null}, platform),
        category = COALESCE(${category ?? null}, category),
        section = COALESCE(${section ?? null}, section),
        sale_price = COALESCE(${sale_price ?? null}, sale_price),
        original_price = COALESCE(${original_price ?? null}, original_price),
        discount_rate = COALESCE(${discount_rate ?? null}, discount_rate),
        sort_order = COALESCE(${sort_order ?? null}, sort_order),
        is_active = COALESCE(${is_active ?? null}, is_active),
        review_highlights = COALESCE(${reviewJson ?? null}, review_highlights),
        rating = COALESCE(${typeof rating === 'number' ? rating : null}, rating),
        review_count = COALESCE(${typeof review_count === 'number' ? review_count : null}, review_count),
        pinned = COALESCE(${typeof pinned === 'boolean' ? pinned : null}, pinned),
        ranked_at = CASE
          WHEN ${willDemote} THEN NULL
          WHEN ${willPromote} THEN ${rankedAtExpr}::timestamp
          ELSE ranked_at
        END,
        updated_at = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: '상품을 찾을 수 없어요' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/products/[id] — 상품 삭제
export async function DELETE(req: NextRequest, { params }: Props) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { id } = await params;
    const sql = getDb();
    await sql`DELETE FROM products WHERE id = ${Number(id)}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
