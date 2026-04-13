import { NextRequest, NextResponse } from 'next/server';

const DISCONNECT_SECRET = process.env.TOSS_DISCONNECT_SECRET || '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function verifyBasicAuth(req: NextRequest): boolean {
  if (!DISCONNECT_SECRET) return true;
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  return decoded === DISCONNECT_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyBasicAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }
  const url = new URL(req.url);
  const userKey = url.searchParams.get('userKey');
  if (userKey) {
    console.log(`[toss-disconnect] User disconnected: ${userKey}`);
  } else {
    console.log('[toss-disconnect] Test ping received');
  }
  return NextResponse.json({ resultType: 'SUCCESS' }, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  if (!verifyBasicAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }
  try {
    let userKey: string | undefined;
    try {
      const body = await req.json();
      userKey = body.userKey;
    } catch {}
    if (userKey) {
      console.log(`[toss-disconnect] User disconnected: ${userKey}`);
    } else {
      console.log('[toss-disconnect] Test ping received');
    }
    return NextResponse.json({ resultType: 'SUCCESS' }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
