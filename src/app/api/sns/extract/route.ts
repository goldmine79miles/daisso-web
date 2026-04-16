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
  if (url.includes('inpock.co.kr') || url.includes('inpk.kr')) return 'inpock';
  if (url.includes('linktr.ee')) return 'linktree';
  if (url.includes('litt.ly')) return 'littly';
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

  // 해시태그 추출 → 가장 유용한 키워드 소스
  const hashtags = (text.match(/#([^\s#]+)/g) || [])
    .map(h => h.replace('#', '').replace(/["""''.,:;!?()]/g, '').trim())
    .filter(h => h.length >= 2 && h.length <= 20)
    .filter(h => !STOP_WORDS.has(h) && !SNS_STOP.has(h.toLowerCase()));

  // 본문에서 제품 관련 키워드 추출
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/#\S+/g, ' ')
    .replace(/@\S+/g, '')
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 제품명 패턴 (숫자+단위) — 최우선
  const productPatterns = (cleaned.match(/[가-힣A-Za-z]+\s*\d+\s*(?:ml|g|kg|매|개|팩|세트|인치|cm|mm|L|리터)/gi) || [])
    .map(p => p.trim());

  // 한국어 2~8글자 (제품명 범위)
  const koreanWords = (cleaned.match(/[가-힣]{2,8}/g) || [])
    .filter(w => !STOP_WORDS.has(w) && !SNS_STOP.has(w));

  // 영어 브랜드명
  const englishWords = (cleaned.match(/[A-Za-z]{2,20}/g) || [])
    .filter(w => !ENGLISH_STOP.has(w.toLowerCase()) && !SNS_STOP.has(w.toLowerCase()));

  // 우선순위: 해시태그(제품명) > 제품패턴 > 한국어 > 영어
  const searchTerms: string[] = [];
  const seen = new Set<string>();

  function add(kw: string) {
    const k = kw.toLowerCase().trim();
    if (k.length < 2 || seen.has(k)) return;
    seen.add(k);
    searchTerms.push(kw.trim());
  }

  // 1. 해시태그 각각 (제일 유용)
  hashtags.forEach(h => add(h));

  // 2. 제품 패턴
  productPatterns.forEach(p => add(p));

  // 3. 한국어 키워드 (제품성 높은 것만)
  koreanWords.forEach(w => add(w));

  // 4. 영어 브랜드
  englishWords.slice(0, 3).forEach(w => add(w));

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

// SNS 인플루언서/채널/플랫폼 관련 불용어
const SNS_STOP = new Set([
  '살림남', '살림녀', '살림꿀템', '꿀템남', '꿀템녀', '리뷰어', '크리에이터',
  '쿠팡', '쿠팡파트너스', '토스', '토스쇼핑', '컬리', '마켓컬리', '테무',
  '네이버', '다이소', '올리브영', '무신사', '지그재그', '에이블리',
  '구매', '구매방법', '링크', '프로필', '하단', '클릭', '검색', '댓글',
  'official', 'life', 'the', 'nam', 'review', 'unboxing',
  '인스타', '인스타그램', '틱톡', '유튜브', '릴스', '쇼츠',
  'instagram', 'tiktok', 'youtube', 'reels', 'shorts',
]);

const ENGLISH_STOP = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'from', 'this', 'that',
  'with', 'they', 'been', 'said', 'will', 'each', 'which', 'their', 'what',
  'instagram', 'tiktok', 'youtube', 'reels', 'shorts', 'video', 'photo',
  'like', 'follow', 'share', 'comment', 'subscribe', 'link', 'bio',
  'https', 'http', 'www', 'com',
]);
