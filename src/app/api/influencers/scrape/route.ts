import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/influencers/scrape
 * 인포크/링크트리/리틀리 등 인플루언서 링크 페이지에서 상품 목록 추출
 *
 * 지원: inpock, linktree, littly, beacons, 기타 링크 모음 페이지
 */

interface ScrapedItem {
  title: string;
  url: string;
  image?: string;
  platform?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL이 필요해요' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const html = await res.text();
    const linkType = detectType(url);

    let items: ScrapedItem[] = [];

    switch (linkType) {
      case 'inpock':
        items = scrapeInpock(html);
        break;
      case 'linktree':
        items = scrapeLinktree(html);
        break;
      case 'littly':
        items = scrapeLittly(html);
        break;
      default:
        items = scrapeGeneric(html, url);
        break;
    }

    // 쇼핑 링크만 필터 (쿠팡/토스/컬리/네이버 등)
    const shoppingItems = items.filter(item => isShoppingLink(item.url));

    // 플랫폼 감지
    const withPlatform = shoppingItems.map(item => ({
      ...item,
      platform: detectPlatform(item.url),
    }));

    return NextResponse.json({
      data: {
        linkType,
        totalFound: items.length,
        shoppingItems: withPlatform,
        allItems: items.slice(0, 30), // 전체도 보여줌 (최대 30개)
      },
    });
  } catch (e) {
    return NextResponse.json({ error: '스크래핑 실패: ' + String(e) }, { status: 500 });
  }
}

function detectType(url: string): string {
  if (url.includes('inpock.co.kr') || url.includes('inpk.kr')) return 'inpock';
  if (url.includes('linktr.ee')) return 'linktree';
  if (url.includes('litt.ly')) return 'littly';
  if (url.includes('beacons.ai')) return 'beacons';
  return 'generic';
}

/** 인포크 스크래핑 — __NEXT_DATA__ JSON에서 블록/링크 데이터 직접 파싱 */
function scrapeInpock(html: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];
  const seen = new Set<string>();

  const INPOCK_CDN = 'https://d13k46lqgoj3d6.cloudfront.net/';

  // __NEXT_DATA__ JSON 추출
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      const blocks = json?.props?.pageProps?.blocks || [];

      for (const block of blocks) {
        // collection 블록 안의 링크들
        const links = block.links || [];
        for (const link of links) {
          if (!link.url || !link.title) continue;
          if (link.url.includes('inpock.co.kr') || link.url.includes('inpk.kr')) continue;
          if (seen.has(link.url)) continue;
          seen.add(link.url);

          // 이미지 URL 처리 (상대경로면 CDN 붙이기)
          let image: string | undefined;
          if (link.image) {
            image = link.image.startsWith('http') ? link.image : INPOCK_CDN + link.image;
          }

          items.push({
            title: link.title,
            url: link.url,
            image,
          });
        }

        // 단일 링크 블록
        if (block.block_type === 'link' && block.url && block.title) {
          if (block.url.includes('inpock.co.kr') || block.url.includes('inpk.kr')) continue;
          if (seen.has(block.url)) continue;
          seen.add(block.url);

          let image: string | undefined;
          if (block.image) {
            image = block.image.startsWith('http') ? block.image : INPOCK_CDN + block.image;
          }

          items.push({
            title: block.title,
            url: block.url,
            image,
          });
        }
      }
    } catch {
      // JSON 파싱 실패 시 HTML 폴백
    }
  }

  // JSON에서 못 찾으면 HTML 폴백
  if (items.length === 0) {
    const linkPattern = /<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const href = match[1];
      const inner = match[2];
      if (href.includes('inpock.co.kr') || href.includes('inpk.kr')) continue;
      if (seen.has(href)) continue;
      seen.add(href);

      const h3Match = inner.match(/<h3[^>]*>([^<]{2,80})<\/h3>/i);
      const altMatch = inner.match(/<img[^>]*alt=["']([^"']{2,80})["']/i);
      const title = h3Match ? decodeEntities(h3Match[1].trim()) : altMatch ? decodeEntities(altMatch[1].trim()) : inner.replace(/<[^>]+>/g, '').trim().slice(0, 80);

      if (title.length >= 2) {
        items.push({ title, url: href });
      }
    }
  }

  return items;
}

/** 링크트리 스크래핑 */
function scrapeLinktree(html: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];

  // 링크트리는 data-testid="LinkButton" 패턴
  // 또는 일반 <a> 태그 + 외부 링크
  const linkPattern = /<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const inner = match[2];

    if (href.includes('linktr.ee')) continue;

    const title = inner.replace(/<[^>]+>/g, '').trim().slice(0, 80);
    if (title.length >= 2) {
      items.push({ title, url: href });
    }
  }

  return items;
}

/** 리틀리 스크래핑 */
function scrapeLittly(html: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];

  const linkPattern = /<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const inner = match[2];

    if (href.includes('litt.ly')) continue;

    const imgMatch = inner.match(/<img[^>]*src=["']([^"']+)["']/i);
    const title = inner.replace(/<[^>]+>/g, '').trim().slice(0, 80);

    if (title.length >= 2) {
      items.push({ title, url: href, image: imgMatch?.[1] || undefined });
    }
  }

  return items;
}

/** 범용 스크래핑 */
function scrapeGeneric(html: string, baseUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];

  const linkPattern = /<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const inner = match[2];

    // 같은 도메인 스킵
    try {
      const linkHost = new URL(href).hostname;
      const baseHost = new URL(baseUrl).hostname;
      if (linkHost === baseHost) continue;
    } catch { continue; }

    const imgMatch = inner.match(/<img[^>]*src=["']([^"']+)["']/i);
    const title = inner.replace(/<[^>]+>/g, '').trim().slice(0, 80);

    if (title.length >= 2) {
      items.push({ title, url: href, image: imgMatch?.[1] || undefined });
    }
  }

  return items;
}

function isShoppingLink(url: string): boolean {
  const shoppingDomains = [
    'coupang.com', 'link.coupang.com', 'influencers.coupang.com',
    'tossshopping.com', 'toss.im',
    'kurly.com', 'marketkurly.com',
    'temu.com',
    'smartstore.naver.com', 'shopping.naver.com',
    'ohou.se', '11st.co.kr', 'gmarket.co.kr',
    'auction.co.kr', 'oliveyoung.co.kr',
    'musinsa.com', 'zigzag.kr', 'ably.com',
    'amazon.com', 'amazon.co.jp',
  ];
  return shoppingDomains.some(d => url.includes(d));
}

function detectPlatform(url: string): string {
  if (url.includes('coupang.com')) return 'coupang';
  if (url.includes('tossshopping') || url.includes('toss.im')) return 'toss';
  if (url.includes('kurly.com') || url.includes('marketkurly')) return 'kurly';
  if (url.includes('temu.com')) return 'temu';
  if (url.includes('naver.com')) return 'naver';
  if (url.includes('oliveyoung')) return 'oliveyoung';
  if (url.includes('musinsa')) return 'musinsa';
  return 'other';
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
