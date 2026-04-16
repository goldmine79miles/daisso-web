import { NextRequest, NextResponse } from 'next/server';
import { createDeeplinks } from '@/lib/coupang-api';

/**
 * 리다이렉트 URL을 따라가서 최종 coupang.com 상품 URL을 얻기
 * influencers.coupang.com/s/... 나 link.coupang.com/a/... 형태 처리
 */
async function resolveRedirect(url: string): Promise<string> {
  // 이미 coupang.com 상품 URL이면 그대로
  if (url.includes('coupang.com/vp/') || url.includes('coupang.com/np/')) {
    return url;
  }

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      },
    });
    const finalUrl = res.url;
    // 쿠팡 URL이면 쿼리스트링 정리해서 반환
    if (finalUrl.includes('coupang.com')) {
      return finalUrl.split('?')[0]; // 트래킹 파라미터 제거
    }
    return finalUrl;
  } catch {
    // HEAD 실패 시 GET으로 재시도
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
      });
      const finalUrl = res.url;
      if (finalUrl.includes('coupang.com')) {
        return finalUrl.split('?')[0];
      }
      return finalUrl;
    } catch {
      return url; // 폴백: 원본 URL 그대로
    }
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
