import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

// POST /api/products/reorder — 순서 일괄 변경
// body: { orders: [{ id: 1, sort_order: 0 }, { id: 2, sort_order: 1 }, ...] }
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { orders } = await req.json();
    if (!Array.isArray(orders)) {
      return NextResponse.json({ error: 'orders 배열이 필요해요' }, { status: 400 });
    }

    const sql = getDb();
    for (const { id, sort_order } of orders) {
      await sql`UPDATE products SET sort_order = ${sort_order}, updated_at = NOW() WHERE id = ${id}`;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
