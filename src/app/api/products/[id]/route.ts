import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Props = { params: Promise<{ id: string }> };

// PUT /api/products/[id] — 상품 수정
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      title, image_url, affiliate_url, platform,
      category, section, sale_price, original_price,
      discount_rate, sort_order, is_active,
    } = body;

    const sql = getDb();
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
export async function DELETE(_req: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const sql = getDb();
    await sql`DELETE FROM products WHERE id = ${Number(id)}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
