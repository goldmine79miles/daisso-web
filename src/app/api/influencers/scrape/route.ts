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

/** 인포크 스크래핑 */
function scrapeInpock(html: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];

  // 인포크 상품 카드: <a href="..."> 안에 제품명/이미지
  // 패턴 1: data-link 또는 href에 외부 링크
  const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const inner = match[2];

    // 내부 링크 스킵
    if (href.startsWith('#') || href.startsWith('/') || href.includes('inpock.co.kr/profile')) continue;

    // 제목 추출
    const titleMatch = inner.match(/<(?:p|span|div|h[1-6])[^>]*>([^<]{2,80})<\/(?:p|span|div|h[1-6])>/i);
    const imgMatch = inner.match(/<img[^>]*src=["']([^"']+)["']/i);

    const title = titleMatch
      ? decodeEntities(titleMatch[1].trim())
      : inner.replace(/<[^>]+>/g, '').trim().slice(0, 80);

    if (title.length >= 2) {
      items.push({
        title,
        url: href,
        image: imgMatch?.[1] || undefined,
      });
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
    'coupang.com', 'link.coupang.com',
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
