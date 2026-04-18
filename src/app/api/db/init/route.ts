import { NextRequest, NextResponse } from 'next/server';
import { initTables } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

// POST /api/db/init — 테이블 생성
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    await initTables();
    return NextResponse.json({ success: true, message: '테이블 생성 완료' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
