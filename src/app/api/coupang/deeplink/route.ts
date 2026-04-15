import { NextRequest, NextResponse } from 'next/server';
import { createDeeplinks } from '@/lib/coupang-api';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls 배열이 필요해요' }, { status: 400 });
    }

    if (urls.length > 20) {
      return NextResponse.json({ error: '한 번에 최대 20개까지 가능해요' }, { status: 400 });
    }

    const data = await createDeeplinks(urls);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
