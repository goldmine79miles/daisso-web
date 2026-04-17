import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/naver/search?keyword=에어팟&display=20&sort=sim
 * 네이버 쇼핑 검색 API 프록시
 * - sort: sim(유사도) | date(날짜) | asc(저가) | dsc(고가)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword');
  const display = Math.min(Number(searchParams.get('display')) || 20, 100);
  const sort = searchParams.get('sort') || 'sim';

  if (!keyword) {
    return NextResponse.json({ error: 'keyword 필요' }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'NAVER_CLIENT_ID/SECRET 미설정' }, { status: 500 });
  }

  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=${display}&sort=${sort}`;
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Naver API ${res.status}: ${text}` }, { status: res.status });
    }
    const data = await res.json();

    // 각 아이템에 판매처(mallName) 기반 태그 추가
    const items = (data.items || []).map((item: Record<string, unknown>) => {
      const link = String(item.link || '');
      let platform = 'other';
      if (link.includes('coupang.com')) platform = 'coupang';
      else if (link.includes('kurly.com')) platform = 'kurly';
      else if (link.includes('smartstore.naver.com') || link.includes('shopping.naver.com')) platform = 'naver';
      else if (link.includes('11st.co.kr')) platform = '11st';
      else if (link.includes('gmarket.co.kr')) platform = 'gmarket';
      return {
        title: String(item.title || '').replace(/<[^>]+>/g, ''), // HTML 태그 제거
        link,
        image: item.image,
        salePrice: Number(item.lprice) || 0,
        originalPrice: Number(item.hprice) || 0,
        mallName: item.mallName,
        productId: item.productId,
        brand: item.brand,
        category1: item.category1,
        category2: item.category2,
        platform,
        // 쿠팡이면 내 파트너스 변환 가능
        canConvertToMyLink: platform === 'coupang',
      };
    });

    return NextResponse.json({
      total: data.total,
      start: data.start,
      display: data.display,
      items,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
