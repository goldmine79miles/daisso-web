import { NextRequest, NextResponse } from 'next/server';
import { getGoldboxProducts } from '@/lib/coupang-api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const subCategoryId = searchParams.get('subCategoryId');

    const data = await getGoldboxProducts(
      categoryId ? Number(categoryId) : undefined,
      subCategoryId ? Number(subCategoryId) : undefined,
    );

    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
