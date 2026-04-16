import { NextRequest, NextResponse } from 'next/server';
import { getBestCategoryProducts } from '@/lib/coupang-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/coupang/best?categoryId=1013&limit=10
 * 카테고리별 베스트 상품 (goldbox보다 카테고리 필터링 정확함)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = Number(searchParams.get('categoryId'));
  const limit = Number(searchParams.get('limit')) || 10;
  if (!categoryId) {
    return NextResponse.json({ error: 'categoryId 필요' }, { status: 400 });
  }
  try {
    const data = await getBestCategoryProducts(categoryId, limit);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
