import { NextRequest, NextResponse } from 'next/server';
import { getDb, DbCategory } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PUT /api/categories/:id — 수정 (name/emoji/slug/is_active)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!id) return NextResponse.json({ error: '잘못된 id' }, { status: 400 });
    const body = await req.json();
    const sql = getDb();

    const current = await sql`SELECT * FROM categories WHERE id = ${id}` as DbCategory[];
    if (current.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const c = current[0];

    const name = typeof body.name === 'string' ? body.name : c.name;
    const slug = typeof body.slug === 'string' ? body.slug : c.slug;
    const emoji = typeof body.emoji === 'string' ? body.emoji : c.emoji;
    const is_active = typeof body.is_active === 'boolean' ? body.is_active : c.is_active;

    const rows = await sql`
      UPDATE categories
      SET name = ${name}, slug = ${slug}, emoji = ${emoji}, is_active = ${is_active}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    ` as DbCategory[];
    return NextResponse.json({ data: rows[0] });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('duplicate key')) {
      return NextResponse.json({ error: '이미 존재하는 slug예요' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/categories/:id
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!id) return NextResponse.json({ error: '잘못된 id' }, { status: 400 });
    const sql = getDb();
    await sql`DELETE FROM categories WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
