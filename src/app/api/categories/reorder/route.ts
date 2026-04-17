import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/categories/reorder — { orders: [{id, sort_order}, ...] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orders: { id: number; sort_order: number }[] = body.orders || [];
    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: 'orders 배열 필요' }, { status: 400 });
    }
    const sql = getDb();
    for (const o of orders) {
      await sql`UPDATE categories SET sort_order = ${o.sort_order}, updated_at = NOW() WHERE id = ${o.id}`;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
