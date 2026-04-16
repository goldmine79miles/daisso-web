import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/proxy-image?url=...
 * 외부 이미지를 서버에서 대신 가져와서 반환 (CDN CORS/referrer 차단 우회)
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('url 필요', { status: 400 });

  try {
    const decoded = decodeURIComponent(url);
    // 허용 도메인 체크 (보안)
    const allowed = [
      'd13k46lqgoj3d6.cloudfront.net',
      'image.inpock.co.kr',
      'inpock.co.kr',
      'thumbnail-a.akamaihd.net',
      'img.danawa.com',
    ];
    const hostname = new URL(decoded).hostname;
    if (!allowed.some(d => hostname.includes(d))) {
      return new NextResponse('허용되지 않은 도메인', { status: 403 });
    }

    const res = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://inpock.co.kr/',
      },
    });

    if (!res.ok) return new NextResponse('이미지 로드 실패', { status: 502 });

    const contentType = res.headers.get('content-type') || 'image/webp';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('프록시 실패', { status: 500 });
  }
}
