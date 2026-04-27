import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { searchProducts } from '@/lib/coupang-api';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * image_url 이 NULL 인 쿠팡 상품들을 다시 쿠팡 검색해서 이미지 복구.
 * 헬스체크가 잘못 NULL 처리했던 케이스 일괄 복원용.
 */
async function recoverImages() {
  const sql = getDb();
  const broken = await sql`
    SELECT id, title, platform, affiliate_url
    FROM products
    WHERE is_active = true AND image_url IS NULL AND platform = 'coupang'
  `;

  const recovered: Array<{ id: number; title: string; new_image: string }> = [];
  const failed: Array<{ id: number; title: string; reason: string }> = [];

  for (const p of broken) {
    try {
      // 제목에서 핵심 키워드 추출 (괄호/수량 제거 + 앞 4-5단어)
      const cleanedTitle = String(p.title)
        .replace(/\([^)]*\)/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const keyword = cleanedTitle.split(' ').slice(0, 5).join(' ');

      const result = await searchProducts(keyword, 10);
      const items = result?.data?.productData || [];
      if (items.length === 0) {
        failed.push({ id: p.id, title: p.title, reason: '검색 결과 없음' });
        continue;
      }

      // 가장 매칭도 높은 상품 (제목 유사성 기준)
      const lowerTitle = String(p.title).toLowerCase();
      const sorted = [...items].sort((a: { productName?: string }, b: { productName?: string }) => {
        const aMatch = matchScore(String(a.productName || '').toLowerCase(), lowerTitle);
        const bMatch = matchScore(String(b.productName || '').toLowerCase(), lowerTitle);
        return bMatch - aMatch;
      });
      const best = sorted[0];
      const newImage = String(best?.productImage || '');
      if (!newImage) {
        failed.push({ id: p.id, title: p.title, reason: '검색 결과에 이미지 없음' });
        continue;
      }

      await sql`UPDATE products SET image_url = ${newImage}, updated_at = NOW() WHERE id = ${p.id}`;
      recovered.push({ id: p.id, title: p.title, new_image: newImage });
      await new Promise(r => setTimeout(r, 500)); // 쿠팡 rate limit
    } catch (e) {
      failed.push({ id: p.id, title: p.title, reason: String(e).slice(0, 100) });
    }
  }

  return { broken_count: broken.length, recovered, failed };
}

/** 제목 유사도 점수 (공통 단어 개수) */
function matchScore(a: string, b: string): number {
  const wordsA = new Set(a.match(/[가-힣A-Za-z0-9]+/g) || []);
  const wordsB = b.match(/[가-힣A-Za-z0-9]+/g) || [];
  let score = 0;
  for (const w of wordsB) if (wordsA.has(w)) score++;
  return score;
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const report = await recoverImages();
    return NextResponse.json({ data: report });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
