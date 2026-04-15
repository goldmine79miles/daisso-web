import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/coupang-api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get('keyword');
    const limit = searchParams.get('limit');

    if (!keyword) {
      return NextResponse.json({ error: 'keyword가 필요해요' }, { status: 400 });
    }

    const data = await searchProducts(keyword, limit ? Number(limit) : 20);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
