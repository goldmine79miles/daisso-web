import { NextRequest, NextResponse } from 'next/server';

const DISCONNECT_SECRET = process.env.TOSS_DISCONNECT_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    if (DISCONNECT_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || authHeader !== `Basic ${DISCONNECT_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const { userKey } = body as { userKey?: string };

    // TODO: 사용자 데이터 삭제 로직 (DB 연동 후 구현)
    console.log(`[toss-disconnect] User disconnected: ${userKey ?? 'unknown'}`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true });
}
