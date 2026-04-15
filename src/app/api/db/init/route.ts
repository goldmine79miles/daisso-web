import { NextResponse } from 'next/server';
import { initTables } from '@/lib/db';

// POST /api/db/init — 테이블 생성
export async function POST() {
  try {
    await initTables();
    return NextResponse.json({ success: true, message: '테이블 생성 완료' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
