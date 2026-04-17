import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables, DbCategory } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/categories?active=all → 전체(비활성 포함). 기본은 활성만
export async function GET(req: NextRequest) {
  try {
    const sql = getDb();
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('active') === 'all';
    try {
      const rows = all
        ? await sql`SELECT * FROM categories ORDER BY sort_order ASC, id ASC`
        : await sql`SELECT * FROM categories WHERE is_active = true ORDER BY sort_order ASC, id ASC`;
      return NextResponse.json({ data: rows as DbCategory[] });
    } catch {
      // 테이블 없으면 초기화 + 재시도
      await initTables();
      const rows = all
        ? await sql`SELECT * FROM categories ORDER BY sort_order ASC, id ASC`
        : await sql`SELECT * FROM categories WHERE is_active = true ORDER BY sort_order ASC, id ASC`;
      return NextResponse.json({ data: rows as DbCategory[] });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/categories → 새 카테고리 추가
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, name, emoji } = body;
    if (!slug || !name) {
      return NextResponse.json({ error: 'slug와 name은 필수예요' }, { status: 400 });
    }
    const sql = getDb();
    // 맨 뒤로 sort_order 설정
    const maxRows = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories` as { next: number }[];
    const next = maxRows[0]?.next ?? 0;
    const rows = await sql`
      INSERT INTO categories (slug, name, emoji, sort_order, is_active)
      VALUES (${slug}, ${name}, ${emoji || ''}, ${next}, true)
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
