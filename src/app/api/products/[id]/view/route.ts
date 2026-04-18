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
    // 컬럼 없으면 생성 (idempotent) — 기존 DB 마이그레이션 안 된 환경 대응
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0`;
    } catch { /* 권한 이슈 등 — 아래 UPDATE가 여전히 실패하면 에러 반환 */ }
    await sql`UPDATE products SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
