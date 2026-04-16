import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/coupang/product-info
 * 인플루언서 쿠팡 링크 → 리다이렉트 따라가서 실제 상품 페이지의 가격/이미지/제목 추출
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || !url.includes('coupang.com')) {
      return NextResponse.json({ error: '쿠팡 URL이 필요해요' }, { status: 400 });
    }

    // 1) 리다이렉트 따라가서 실제 상품 URL 획득
    let productUrl = url;
    if (!url.includes('/vp/products/') && !url.includes('/np/')) {
      try {
        const redirectRes = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'text/html',
          },
        });
        productUrl = redirectRes.url;
      } catch {
        return NextResponse.json({ error: '링크 해석 실패' }, { status: 502 });
      }
    }

    // 2) 상품 페이지 HTML 가져오기
    const pageRes = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    });
    const html = await pageRes.text();

    // 3) 메타 태그 + HTML에서 정보 추출
    const title = extractMeta(html, 'og:title') || extractTag(html, /<title>([^<]+)<\/title>/) || '';
    const image = extractMeta(html, 'og:image') || '';
    const description = extractMeta(html, 'og:description') || '';

    // 가격 추출 — 여러 패턴 시도
    let salePrice = 0;
    let originalPrice = 0;
    let discountRate = 0;

    // 패턴1: JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1]);
        if (ld.offers?.price) salePrice = Number(ld.offers.price);
        if (ld.offers?.highPrice) originalPrice = Number(ld.offers.highPrice);
      } catch { /* */ }
    }

    // 패턴2: meta product:price
    const metaPrice = extractMeta(html, 'product:price:amount');
    if (metaPrice) salePrice = salePrice || Number(metaPrice);

    // 패턴3: HTML 가격 패턴
    if (!salePrice) {
      // total-price 영역
      const totalPriceMatch = html.match(/class="total-price[^"]*"[^>]*>[\s]*<strong>([0-9,]+)<\/strong>/);
      if (totalPriceMatch) salePrice = Number(totalPriceMatch[1].replace(/,/g, ''));
    }
    if (!salePrice) {
      const priceMatch = html.match(/class="sale[^"]*price[^"]*"[^>]*>([0-9,]+)/i);
      if (priceMatch) salePrice = Number(priceMatch[1].replace(/,/g, ''));
    }

    // 원가
    if (!originalPrice) {
      const origMatch = html.match(/class="origin-price[^"]*"[^>]*>[\s\S]*?([0-9,]{3,})/);
      if (origMatch) originalPrice = Number(origMatch[1].replace(/,/g, ''));
      // base-price 패턴
      if (!originalPrice) {
        const baseMatch = html.match(/class="base-price[^"]*"[^>]*>([0-9,]+)/i);
        if (baseMatch) originalPrice = Number(baseMatch[1].replace(/,/g, ''));
      }
    }

    // 할인율
    const discountMatch = html.match(/class="discount[^"]*rate[^"]*"[^>]*>[\s]*(\d+)/);
    if (discountMatch) {
      discountRate = Number(discountMatch[1]);
    } else if (originalPrice > salePrice && salePrice > 0) {
      discountRate = Math.round((1 - salePrice / originalPrice) * 100);
    }

    if (!originalPrice && salePrice) originalPrice = salePrice;

    return NextResponse.json({
      data: {
        productUrl,
        title: cleanTitle(title),
        image,
        salePrice,
        originalPrice,
        discountRate,
        description: description.slice(0, 200),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: '상품 정보 조회 실패: ' + String(e) }, { status: 500 });
  }
}

function extractMeta(html: string, property: string): string {
  const re = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  const match = html.match(re);
  if (match) return match[1];
  // content가 앞에 올 수도
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`, 'i');
  const match2 = html.match(re2);
  return match2 ? match2[1] : '';
}

function extractTag(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*쿠팡.*$/i, '')
    .replace(/\s*\|\s*Coupang.*$/i, '')
    .trim();
}
