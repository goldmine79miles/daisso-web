import { NextRequest, NextResponse } from 'next/server';
import { createDeeplinks } from '@/lib/coupang-api';

/**
 * 리다이렉트 URL을 따라가서 최종 coupang.com 상품 URL을 얻기
 * influencers.coupang.com/s/... 나 link.coupang.com/a/... 형태 처리
 */
async function resolveRedirect(url: string): Promise<string> {
  // 이미 coupang.com 상품 URL이면 그대로
  if (url.includes('coupang.com/vp/') || url.includes('coupang.com/np/')) {
    return url.split('?')[0]; // 트래킹 파라미터 제거
  }

  // link.coupang.com/a/... 축약 링크 → HTML 파싱으로 productId 추출
  if (url.includes('link.coupang.com/a/')) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
      });
      const html = await res.text();

      // HTML 안의 암호화된 JS에서 productId, itemId, vendorItemId 추출
      // \x26 = &, \x3D = =, \x25 = %
      // productId\x253D{ID} 또는 productId=3D{ID} 패턴
      const productIdMatch = html.match(/productId(?:\\x25|%)?(?:3D|=)(\d+)/i);
      const itemIdMatch = html.match(/itemId(?:\\x25|%)?(?:3D|=)(\d+)/i);
      const vendorItemIdMatch = html.match(/vendorItemId(?:\\x25|%)?(?:3D|=)(\d+)/i);

      if (productIdMatch) {
        const productId = productIdMatch[1];
        let productUrl = `https://www.coupang.com/vp/products/${productId}`;
        const params: string[] = [];
        if (itemIdMatch) params.push(`itemId=${itemIdMatch[1]}`);
        if (vendorItemIdMatch) params.push(`vendorItemId=${vendorItemIdMatch[1]}`);
        if (params.length > 0) productUrl += '?' + params.join('&');
        console.log('[resolveRedirect] link.coupang.com resolved to:', productUrl);
        return productUrl;
      }
    } catch (e) {
      console.error('[resolveRedirect] link.coupang.com parse failed:', e);
    }
  }

  // 기타 리다이렉트 URL 처리 (influencers.coupang.com 등)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
    });
    const finalUrl = res.url;
    if (finalUrl.includes('coupang.com/vp/') || finalUrl.includes('coupang.com/np/')) {
      return finalUrl.split('?')[0];
    }
    return finalUrl;
  } catch {
    return url;
  }
}

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

    // 리다이렉트 URL 해석 (influencers.coupang.com → www.coupang.com)
    const resolvedUrls = await Promise.all(urls.map(resolveRedirect));

    const data = await createDeeplinks(resolvedUrls);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
