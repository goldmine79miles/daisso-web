import { NextRequest, NextResponse } from 'next/server';

const DISCONNECT_SECRET = process.env.TOSS_DISCONNECT_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Basic ${DISCONNECT_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userKey } = body;

    if (!userKey) {
      return NextResponse.json({ error: 'Missing userKey' }, { status: 400 });
    }

    // TODO: 사용자 데이터 삭제 로직 (DB 연동 후 구현)
    console.log(`[toss-disconnect] User disconnected: ${userKey}`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
