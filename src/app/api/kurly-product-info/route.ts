import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/kurly-product-info
 * 컬리 공유 링크(https://lounge.kurly.com/link/xxx 또는 kurly.com/goods/xxx)
 * → OG 메타 파싱해서 title/image 추출
 * 가격은 OG에 없음 — 어드민에서 수동 입력
 */
export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`kurly-product-info:${ip}`, { limit: 30, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    );
  }
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url이 필요해요' }, { status: 400 });
    }

    const isKurlyUrl = /kurly\.com/.test(url);
    if (!isKurlyUrl) {
      return NextResponse.json({ error: '컬리 URL이 아니에요' }, { status: 400 });
    }

    const html = await fetchHtml(url);
    if (!html) {
      return NextResponse.json({ error: '페이지를 불러올 수 없어요' }, { status: 502 });
    }

    const og = parseOg(html);
    // 컬리 description은 "지금 컬리에서 만나보세요!" 같은 고정 문구라 제품명으로 안 씀
    const title = og.title || '';

    if (!title && !og.image) {
      return NextResponse.json({ error: '상품 정보를 찾을 수 없어요' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        title,
        image_url: og.image || '',
        description: og.description || '',
        platform: 'kurly',
      },
    });
  } catch (e) {
    console.error('[kurly-product-info]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseOg(html: string): { title?: string; image?: string; description?: string } {
  const pick = (prop: string): string | undefined => {
    const re = new RegExp(
      `<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["']([^"']+)["']`,
      'i'
    );
    const re2 = new RegExp(
      `<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["']${prop}["']`,
      'i'
    );
    return (html.match(re)?.[1] || html.match(re2)?.[1])?.trim();
  };

  return {
    title: pick('og:title'),
    image: pick('og:image'),
    description: pick('og:description'),
  };
}
