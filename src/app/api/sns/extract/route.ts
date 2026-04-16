import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/sns/extract
 * SNS URL에서 OG 메타데이터 추출 → 키워드 반환
 * 인스타, 틱톡, 유튜브 등 대부분 플랫폼 지원
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL이 필요해요' }, { status: 400 });
    }

    // 플랫폼 감지
    const platform = detectPlatform(url);

    // OG 메타데이터 가져오기
    const meta = await fetchMeta(url);

    // 키워드 추출
    const keywords = extractKeywords(meta.title, meta.description);

    return NextResponse.json({
      data: {
        platform,
        url,
        title: meta.title,
        description: meta.description,
        image: meta.image,
        keywords,
      }
    });
  } catch (e) {
    return NextResponse.json({ error: '링크를 분석할 수 없어요: ' + String(e) }, { status: 500 });
  }
}

function detectPlatform(url: string): string {
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('threads.net')) return 'threads';
  if (url.includes('blog.naver.com') || url.includes('m.blog.naver.com')) return 'naver';
  return 'other';
}

async function fetchMeta(url: string): Promise<{ title: string; description: string; image: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      redirect: 'follow',
    });

    const html = await res.text();

    const getOg = (prop: string) => {
      const match = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']og:${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`content=["']([^"']*)["'][^>]*(?:property|name)=["']og:${prop}["']`, 'i'));
      return match ? decodeHTMLEntities(match[1]) : '';
    };

    const getTitle = () => {
      const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return match ? decodeHTMLEntities(match[1]) : '';
    };

    const getDesc = () => {
      const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
        || html.match(/content=["']([^"']*)["'][^>]*name=["']description["']/i);
      return match ? decodeHTMLEntities(match[1]) : '';
    };

    return {
      title: getOg('title') || getTitle(),
      description: getOg('description') || getDesc(),
      image: getOg('image'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractKeywords(title: string, description: string): string[] {
  const text = `${title} ${description}`;

  // 불필요한 문자 제거
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/#\S+/g, ' ')  // 해시태그는 별도 처리
    .replace(/@\S+/g, '')
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 해시태그 추출 (유용한 키워드)
  const hashtags = (text.match(/#([^\s#]+)/g) || [])
    .map(h => h.replace('#', '').trim())
    .filter(h => h.length >= 2 && h.length <= 20);

  // 한국어 명사/제품명 패턴 추출 (2글자 이상)
  const koreanWords = (cleaned.match(/[가-힣]{2,15}/g) || [])
    .filter(w => !STOP_WORDS.has(w));

  // 영어 단어 (브랜드명 등)
  const englishWords = (cleaned.match(/[A-Za-z]{2,20}/g) || [])
    .filter(w => !ENGLISH_STOP.has(w.toLowerCase()));

  // 제품명 패턴 (숫자+단위)
  const productPatterns = cleaned.match(/[\w가-힣]+\s*\d+\s*(?:ml|g|kg|매|개|팩|세트|인치|cm|mm)/gi) || [];

  // 합치고 중복 제거
  const all = [...hashtags, ...productPatterns, ...koreanWords, ...englishWords];
  const unique = [...new Set(all)].slice(0, 10);

  // 검색에 쓸 만한 조합 키워드 만들기
  const searchTerms: string[] = [];

  // 해시태그 기반 검색어
  if (hashtags.length > 0) {
    searchTerms.push(hashtags.slice(0, 3).join(' '));
  }

  // 브랜드 + 제품 조합
  if (englishWords.length > 0 && koreanWords.length > 0) {
    searchTerms.push(`${englishWords[0]} ${koreanWords[0]}`);
  }

  // 단독 키워드
  unique.forEach(kw => {
    if (kw.length >= 2 && !searchTerms.includes(kw)) {
      searchTerms.push(kw);
    }
  });

  return searchTerms.slice(0, 8);
}

const STOP_WORDS = new Set([
  '이거', '진짜', '완전', '너무', '정말', '같은', '되는', '하는', '있는', '없는',
  '좋은', '나는', '우리', '그냥', '아주', '매우', '엄청', '대박', '최고', '추천',
  '리뷰', '후기', '언박싱', '개봉', '소개', '공유', '구독', '좋아요', '댓글',
  '이번', '오늘', '요즘', '최근', '드디어', '역시', '확실', '먼저', '나중',
  '여러분', '여러분들', '구매', '사용', '사용기', '사용법', '방법',
  '인스타', '인스타그램', '틱톡', '유튜브', '채널', '영상', '게시물',
]);

const ENGLISH_STOP = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'from', 'this', 'that',
  'with', 'they', 'been', 'said', 'will', 'each', 'which', 'their', 'what',
  'instagram', 'tiktok', 'youtube', 'reels', 'shorts', 'video', 'photo',
  'like', 'follow', 'share', 'comment', 'subscribe', 'link', 'bio',
  'https', 'http', 'www', 'com',
]);
