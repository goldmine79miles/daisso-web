import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/products/:id/view — 조회수 +1
// 실패해도 ProductPage 경험에 영향 없도록 best-effort
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!id) return NextResponse.json({ error: '잘못된 id' }, { status: 400 });
    const sql = getDb();
    await sql`UPDATE products SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
