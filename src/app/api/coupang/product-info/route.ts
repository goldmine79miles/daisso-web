import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/coupang-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/coupang/product-info
 * 쿠팡 링크(딥링크/인플루언서/직접) → 실제 상품 페이지의 가격/이미지/제목 추출
 * - title이 주어지면: 파트너스 검색 API로 찾아서 productId 매칭 (권장)
 * - title이 없으면: HTML 스크래핑 시도 (쿠팡이 차단할 수 있음)
 */
export async function POST(req: NextRequest) {
  try {
    const { url, title } = await req.json();
    if (!url || !url.includes('coupang.com')) {
      return NextResponse.json({ error: '쿠팡 URL이 필요해요' }, { status: 400 });
    }

    // URL에서 productId 추출 (축약 링크면 HTML 파싱)
    let productId = extractProductId(url);
    if (!productId && url.includes('link.coupang.com/a/')) {
      productId = await extractProductIdFromShortlink(url);
    }

    // ─── title 제공 시: 파트너스 검색 API 경로 (신뢰도 높음) ───
    console.log('[product-info] url=', url, 'title=', title, 'productId=', productId);
    if (title && typeof title === 'string' && title.trim().length > 0) {
      try {
        const match = await findByPartnersSearch(title.trim(), productId);
        console.log('[product-info] partners search match:', match ? 'FOUND' : 'NULL', match);
        if (match) {
          return NextResponse.json({ data: match, via: 'partners-search' });
        }
      } catch (e) {
        console.error('[product-info] partners search threw:', e);
      }
    }

    // ─── HTML 스크래핑 경로 (쿠팡이 차단하면 빈값 반환) ───
    const productUrl = await resolveToProductUrl(url);

    if (!productUrl) {
      return NextResponse.json({ error: '상품 URL을 찾을 수 없어요' }, { status: 400 });
    }

    // 상품 페이지 HTML 가져오기
    const pageRes = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });
    const html = await pageRes.text();

    // 3) 메타 태그 + HTML에서 정보 추출
    const scrapedTitle = extractMeta(html, 'og:title') || extractTag(html, /<title>([^<]+)<\/title>/) || '';
    const image = extractMeta(html, 'og:image') || '';
    const description = extractMeta(html, 'og:description') || '';

    // 가격 추출 — 여러 패턴 시도
    let salePrice = 0;
    let originalPrice = 0;
    let discountRate = 0;

    // 패턴1: JSON-LD structured data
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    for (const m of jsonLdMatches) {
      try {
        const ld = JSON.parse(m[1]);
        if (ld['@type'] === 'Product' && ld.offers) {
          const offers = ld.offers;
          if (offers.price) salePrice = salePrice || Number(offers.price);
          if (offers.lowPrice) salePrice = salePrice || Number(offers.lowPrice);
          if (offers.highPrice) originalPrice = originalPrice || Number(offers.highPrice);
        }
      } catch { /* */ }
    }

    // 패턴2: meta product:price
    const metaPrice = extractMeta(html, 'product:price:amount');
    if (metaPrice) salePrice = salePrice || Number(metaPrice);

    // 패턴3: HTML 가격 패턴들 — 쿠팡 PC/모바일 다양한 패턴
    if (!salePrice) {
      // total-price 영역
      const totalPriceMatch = html.match(/class="total-price[^"]*"[^>]*>[\s]*<strong>([0-9,]+)<\/strong>/);
      if (totalPriceMatch) salePrice = Number(totalPriceMatch[1].replace(/,/g, ''));
    }
    if (!salePrice) {
      const priceMatch = html.match(/class="sale[^"]*price[^"]*"[^>]*>([0-9,]+)/i);
      if (priceMatch) salePrice = Number(priceMatch[1].replace(/,/g, ''));
    }
    if (!salePrice) {
      // prod-sale-price 패턴
      const prodMatch = html.match(/class="prod-sale-price[^"]*"[^>]*>[\s\S]*?([0-9,]{3,})/);
      if (prodMatch) salePrice = Number(prodMatch[1].replace(/,/g, ''));
    }
    if (!salePrice) {
      // 가격 숫자 + 원 패턴 (최후 수단)
      const wonMatch = html.match(/(\d{1,3}(?:,\d{3})+)원\s*<\/span>/);
      if (wonMatch) salePrice = Number(wonMatch[1].replace(/,/g, ''));
    }

    // 원가
    if (!originalPrice) {
      const origMatch = html.match(/class="origin-price[^"]*"[^>]*>[\s\S]*?([0-9,]{3,})/);
      if (origMatch) originalPrice = Number(origMatch[1].replace(/,/g, ''));
    }
    if (!originalPrice) {
      const baseMatch = html.match(/class="base-price[^"]*"[^>]*>([0-9,]+)/i);
      if (baseMatch) originalPrice = Number(baseMatch[1].replace(/,/g, ''));
    }
    if (!originalPrice) {
      // 할인 전 가격 패턴
      const listMatch = html.match(/class="list-price[^"]*"[^>]*>[\s\S]*?([0-9,]{3,})/);
      if (listMatch) originalPrice = Number(listMatch[1].replace(/,/g, ''));
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
        title: cleanTitle(scrapedTitle),
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

/**
 * 다양한 쿠팡 링크를 실제 상품 URL로 변환
 * - link.coupang.com/... (딥링크) → URL 파라미터에서 상품 URL 추출 또는 리다이렉트 따라감
 * - influencers.coupang.com/... → 리다이렉트 따라감
 * - www.coupang.com/vp/products/... → 그대로 사용
 */
async function resolveToProductUrl(url: string): Promise<string | null> {
  // 이미 상품 URL이면 바로 리턴
  if (url.includes('/vp/products/') || url.includes('/np/')) {
    return url;
  }

  // 딥링크에서 URL 파라미터로 상품 URL 추출 시도
  try {
    const parsed = new URL(url);
    // link.coupang.com은 query param에 target URL이 있을 수 있음
    const targetUrl = parsed.searchParams.get('url') || parsed.searchParams.get('landingUrl') || parsed.searchParams.get('targetUrl');
    if (targetUrl && targetUrl.includes('/vp/products/')) {
      return targetUrl;
    }
  } catch { /* */ }

  // 리다이렉트 따라가기 (최대 5번)
  let currentUrl = url;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // 수동으로 리다이렉트 처리
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      // 리다이렉트 응답이면 Location 헤더 따라감
      const location = res.headers.get('location');
      if (location && (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308)) {
        // 상대 URL 처리
        const nextUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;

        // 상품 URL 찾았으면 리턴
        if (nextUrl.includes('/vp/products/') || nextUrl.includes('/np/')) {
          return nextUrl;
        }
        currentUrl = nextUrl;
        continue;
      }

      // 200 응답이면 HTML에서 meta refresh나 JS redirect 찾기
      const html = await res.text();

      // meta refresh
      const metaRefresh = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["']\d+;\s*url=([^"']+)["']/i);
      if (metaRefresh) {
        const nextUrl = metaRefresh[1].startsWith('http') ? metaRefresh[1] : new URL(metaRefresh[1], currentUrl).href;
        if (nextUrl.includes('/vp/products/') || nextUrl.includes('/np/')) return nextUrl;
        currentUrl = nextUrl;
        continue;
      }

      // JS redirect: location.href = '...' 또는 location.replace('...')
      const jsRedirect = html.match(/location\.(?:href|replace)\s*[=(]\s*["']([^"']+coupang\.com[^"']*)/i);
      if (jsRedirect) {
        const nextUrl = jsRedirect[1];
        if (nextUrl.includes('/vp/products/') || nextUrl.includes('/np/')) return nextUrl;
        currentUrl = nextUrl;
        continue;
      }

      // HTML 내 링크에서 상품 URL 추출
      const productLink = html.match(/https?:\/\/(?:www\.)?coupang\.com\/vp\/products\/\d+[^"'\s]*/);
      if (productLink) {
        return productLink[0];
      }

      // 현재 URL이 상품 URL이면 리턴 (redirect: follow 케이스)
      if (currentUrl.includes('/vp/products/') || currentUrl.includes('/np/')) {
        return currentUrl;
      }

      // 더 이상 따라갈 곳 없으면 현재 URL 리턴
      return currentUrl;
    } catch {
      break;
    }
  }

  // 최후의 수단: redirect: follow로 한번 시도
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html',
      },
    });
    return res.url;
  } catch {
    return null;
  }
}

function extractMeta(html: string, property: string): string {
  const re = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  const match = html.match(re);
  if (match) return match[1];
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

/**
 * URL에서 productId 추출
 * /vp/products/107518?itemId=... → "107518"
 */
function extractProductId(url: string): string | null {
  const match = url.match(/\/vp\/products\/(\d+)|pageKey=(\d+)/);
  return match ? (match[1] || match[2]) : null;
}

/**
 * 축약 링크 (link.coupang.com/a/xxx) HTML에서 productId 추출
 * Deeplink Redirect 페이지의 JS 안에 \x25 이스케이프로 숨겨져 있음
 */
async function extractProductIdFromShortlink(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
    });
    const rawHtml = await res.text();
    const decoded = rawHtml
      .replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/%[0-9a-f]{2}/gi, m => { try { return decodeURIComponent(m); } catch { return m; } });
    const m = decoded.match(/productId[^\d]{0,3}(\d+)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * 파트너스 검색 API로 상품 찾기
 * - 키워드 검색 → 결과 중 productId 일치 항목 반환
 * - productId 매칭 실패 시: 첫 결과 사용 (근사값)
 */
async function findByPartnersSearch(
  keyword: string,
  productId: string | null
): Promise<{
  productUrl: string;
  title: string;
  image: string;
  salePrice: number;
  originalPrice: number;
  discountRate: number;
  description: string;
} | null> {
  try {
    console.log('[findByPartnersSearch] keyword=', keyword, 'productId=', productId);
    const result = await searchProducts(keyword, 30);
    const items: unknown[] = result?.data?.productData || [];
    console.log('[findByPartnersSearch] items.length=', items.length, 'first productId=', (items[0] as { productId?: number })?.productId);
    if (!items.length) return null;

    interface CoupangProduct {
      productId?: number | string;
      productName?: string;
      productImage?: string;
      productPrice?: number;
      productUrl?: string;
      categoryName?: string;
    }

    // productId 일치 항목만 사용 — 매칭 안 되면 null 리턴 (잘못된 매칭 방지)
    if (!productId) return null;
    const matched = (items as CoupangProduct[]).find(p => String(p.productId) === productId) || null;
    if (!matched) return null;

    const salePrice = Number(matched.productPrice) || 0;

    return {
      productUrl: matched.productUrl || '',
      title: matched.productName || '',
      image: matched.productImage || '',
      salePrice,
      originalPrice: salePrice, // 검색 API는 원가 미제공 — 유저가 수동 입력
      discountRate: 0,
      description: matched.categoryName || '',
    };
  } catch (e) {
    console.error('[product-info] partners search failed:', e);
    return null;
  }
}
