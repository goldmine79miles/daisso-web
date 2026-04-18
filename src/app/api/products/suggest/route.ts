import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * POST /api/products/suggest
 * OFF된 상품의 대체 추천 찾기
 * 1. 쿠팡 검색으로 후보 3개
 * 2. 등록된 인플루언서 링크에서 관련 상품 찾기
 */

interface Suggestion {
  source: 'coupang' | 'influencer';
  title: string;
  url: string;
  image?: string;
  price?: number;
  discount?: number;
  influencerName?: string;
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: 'productId 필요' }, { status: 400 });
    }

    const sql = getDb();

    // OFF된 상품 정보 가져오기
    const products = await sql`SELECT * FROM products WHERE id = ${productId}`;
    if (products.length === 0) {
      return NextResponse.json({ error: '상품 없음' }, { status: 404 });
    }
    const product = products[0];

    // 키워드 추출 (상품명에서)
    const keywords = extractProductKeywords(product.title);
    const suggestions: Suggestion[] = [];

    // 1. 쿠팡 검색 후보
    if (keywords.length > 0) {
      try {
        const searchUrl = `${getBaseUrl(req)}/api/coupang/search?keyword=${encodeURIComponent(keywords[0])}&limit=3`;
        const searchRes = await fetch(searchUrl);
        const searchJson = await searchRes.json();
        const items = searchJson.data?.productData || searchJson.data || [];

        for (const item of items.slice(0, 3)) {
          suggestions.push({
            source: 'coupang',
            title: item.productName,
            url: item.productUrl,
            image: item.productImage,
            price: item.productPrice,
            discount: item.discountRate,
          });
        }
      } catch {
        // 쿠팡 검색 실패해도 계속
      }
    }

    // 2. 인플루언서 링크에서 찾기
    const influencers = await sql`SELECT * FROM influencer_links WHERE is_active = true`;

    for (const inf of influencers.slice(0, 5)) {
      try {
        const scrapeUrl = `${getBaseUrl(req)}/api/influencers/scrape`;
        const scrapeRes = await fetch(scrapeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inf.inpock_url }),
        });
        const scrapeJson = await scrapeRes.json();
        const shoppingItems = scrapeJson.data?.shoppingItems || [];

        // 키워드 매칭으로 관련 상품 찾기
        for (const item of shoppingItems) {
          const titleLower = item.title.toLowerCase();
          const hasMatch = keywords.some((kw: string) => titleLower.includes(kw.toLowerCase()));
          if (hasMatch || product.category !== 'all') {
            suggestions.push({
              source: 'influencer',
              title: item.title,
              url: item.url,
              image: item.image,
              influencerName: inf.name,
            });
          }
        }
      } catch {
        // 스크래핑 실패해도 계속
      }
    }

    return NextResponse.json({
      data: {
        product: { id: product.id, title: product.title, category: product.category },
        keywords,
        suggestions: suggestions.slice(0, 10),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: '추천 실패: ' + String(e) }, { status: 500 });
  }
}

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

/** 상품명에서 핵심 키워드 추출 */
function extractProductKeywords(title: string): string[] {
  const cleaned = title
    .replace(/\([^)]*\)/g, '') // 괄호 내용 제거
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[0-9]+[개팩세트매장입봉]+/g, '') // 수량 제거
    .replace(/[0-9]+[gkml리터LG]+/g, '') // 단위 제거
    .replace(/\s+/g, ' ')
    .trim();

  // 한국어 2~6글자 추출
  const korWords = (cleaned.match(/[가-힣]{2,6}/g) || [])
    .filter(w => !STOP.has(w));

  // 영어 브랜드명
  const engWords = (cleaned.match(/[A-Za-z]{2,15}/g) || [])
    .filter(w => !ENG_STOP.has(w.toLowerCase()));

  // 첫 번째는 가장 긴 키워드 조합 (검색 정확도 높이기)
  const combined = korWords.slice(0, 2).join(' ');
  const result = combined ? [combined, ...korWords.slice(0, 3), ...engWords.slice(0, 2)] : [...korWords, ...engWords];

  return [...new Set(result)].slice(0, 5);
}

const STOP = new Set(['무료', '배송', '할인', '특가', '세일', '한정', '인기', '추천', '최저가', '국내', '정품', '신상', '당일']);
const ENG_STOP = new Set(['the', 'and', 'for', 'with', 'free', 'new', 'hot', 'best', 'sale', 'set', 'pack', 'box']);
