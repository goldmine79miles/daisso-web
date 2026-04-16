import { notFound } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { StarIcon } from '@/components/Icons';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { getProductById, getProductsByCategory, products } from '@/data/products';
import { getDbProductById } from '@/lib/get-products';
import { categories } from '@/data/categories';
import { buildAffiliateLink } from '@/lib/coupang';
import type { Product, CategorySlug } from '@/data/types';
import type { Metadata } from 'next';

type Props = { params: Promise<{ id: string }> };

/* ─── 플랫폼별 설정 ─────────────────────────── */
const PLATFORM_CONFIG: Record<string, { name: string; color: string; shadow: string }> = {
  coupang:  { name: '쿠팡',     color: '#E4002B', shadow: 'rgba(228,0,43,0.3)' },
  naver:    { name: '네이버',   color: '#03C75A', shadow: 'rgba(3,199,90,0.3)' },
  toss:     { name: '토스',     color: '#3182F6', shadow: 'rgba(49,130,246,0.3)' },
  temu:     { name: '테무',     color: '#FB7701', shadow: 'rgba(251,119,1,0.3)' },
  kurly:    { name: '컬리',     color: '#5F0080', shadow: 'rgba(95,0,128,0.3)' },
};

function detectPlatform(url: string): string {
  if (url.includes('coupang.com')) return 'coupang';
  if (url.includes('naver.com')) return 'naver';
  if (url.includes('tossshopping') || url.includes('toss.im')) return 'toss';
  if (url.includes('temu.com')) return 'temu';
  if (url.includes('kurly.com') || url.includes('marketkurly')) return 'kurly';
  return 'coupang'; // 기본값
}

/* ─── 가성비 포인트 자동 생성 ─────────────────── */
function getValuePoints(product: { discountPercent: number; salePrice: number; category: string; description: string }): string[] {
  const points: string[] = [];

  // 할인율 기반
  if (product.discountPercent >= 40) {
    points.push(`정가 대비 ${product.discountPercent}% 할인된 가격으로 만나볼 수 있어요`);
  } else if (product.discountPercent >= 20) {
    points.push(`${product.discountPercent}% 할인 중이라 지금이 구매 적기예요`);
  }

  // 가격대 기반
  if (product.salePrice <= 10000) {
    points.push('만원 이하 가격으로 부담 없이 사볼 수 있어요');
  } else if (product.salePrice <= 30000) {
    points.push('합리적인 가격대의 가성비 좋은 제품이에요');
  }

  // 카테고리별 멘트
  const categoryPoints: Record<string, string> = {
    living: '생활에서 자주 쓰는 실용적인 아이템이에요',
    food: '맛도 좋고 가격도 착한 식품이에요',
    electronics: '성능 대비 가격이 훌륭한 전자기기예요',
    fashion: '트렌디하면서도 가격이 합리적이에요',
    beauty: '가성비 좋은 뷰티템으로 입소문 난 제품이에요',
    baby: '아이에게 안심하고 사용할 수 있는 제품이에요',
    health: '건강 관리에 도움이 되는 알찬 제품이에요',
    pet: '반려동물이 좋아하는 인기 제품이에요',
    sports: '운동할 때 확실히 차이나는 제품이에요',
  };
  if (categoryPoints[product.category]) {
    points.push(categoryPoints[product.category]);
  }

  // 기본 멘트 (최소 2개 보장)
  if (points.length < 2) {
    points.push('다있어에서 직접 비교하고 엄선한 제품이에요');
  }
  if (points.length < 2) {
    points.push('같은 카테고리 내에서 가격 경쟁력이 있는 제품이에요');
  }

  return points.slice(0, 3);
}

/* ─── 안내 문구 ─────────────────────────────── */
const DISCLAIMER_LINES = [
  '이 버튼을 통해 구매 시 다있어는 일정액의 수수료를 제공받아요',
  '수수료는 서비스 무료 운영을 위해 사용돼요',
  '상품 및 가격 정보는 실제와 다를 수 있어요. 구매 전 쇼핑몰에서 꼭 확인해 주세요',
  '다있어는 상품 판매자가 아닌, 좋은 상품을 추천하는 서비스예요',
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) return {};
  return {
    title: `${product.title} - 다있어`,
    description: product.description,
    openGraph: {
      title: `${product.title} | ${product.discountPercent}% 할인`,
      description: `${product.salePrice.toLocaleString()}원 (${product.discountPercent}% OFF) - ${product.description}`,
      images: [product.imageUrl],
    },
  };
}

export function generateStaticParams() {
  return products.map(p => ({ id: p.id }));
}

async function resolveProduct(id: string): Promise<Product | null> {
  // db-47 형식 → DB 조회
  if (id.startsWith('db-')) {
    const dbId = Number(id.slice(3));
    if (!Number.isFinite(dbId)) return null;
    const d = await getDbProductById(dbId);
    if (!d) return null;
    return {
      id: `db-${d.id}`,
      title: d.title,
      description: '',
      originalPrice: d.original_price || d.sale_price,
      salePrice: d.sale_price,
      discountPercent: d.discount_rate || 0,
      imageUrl: d.image_url || '/logo-light.png',
      category: (d.category || 'all') as CategorySlug,
      coupangUrl: d.affiliate_url,
      rating: 0,
      reviewCount: 0,
      tags: [],
    };
  }
  return getProductById(id) || null;
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await resolveProduct(id);
  if (!product) notFound();

  const category = categories.find(c => c.slug === product.category);
  const related = getProductsByCategory(product.category).filter(p => p.id !== product.id).slice(0, 4);
  const affiliateLink = buildAffiliateLink(product.coupangUrl);

  const platform = detectPlatform(product.coupangUrl);
  const pConfig = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.coupang;
  const valuePoints = getValuePoints(product);

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto pb-28">
        {/* 상품 이미지 */}
        <img src={product.imageUrl} alt={product.title} className="w-full aspect-square object-cover" />

        {/* 상품 정보 */}
        <div className="px-4 py-5">
          {category && (
            <Link href={`/category/${category.slug}`} className="text-sm font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
              {category.name}
            </Link>
          )}
          <h1 className="mt-2 text-xl font-bold leading-snug">{product.title}</h1>

          <div className="mt-4 flex items-center gap-2">
            <span className="text-2xl font-extrabold" style={{ color: 'var(--accent-red)' }}>{product.discountPercent}%</span>
            <span className="text-2xl font-extrabold">{product.salePrice.toLocaleString()}원</span>
          </div>
          {product.originalPrice > product.salePrice && (
            <p className="text-sm text-gray-400 line-through">{product.originalPrice.toLocaleString()}원</p>
          )}

          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <span className="flex items-center gap-0.5"><StarIcon size={12} /> {product.rating}</span>
            <span>·</span>
            <span>리뷰 {product.reviewCount.toLocaleString()}개</span>
          </div>

          <p className="mt-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-5">
            {product.description}
          </p>
        </div>

        {/* 다있어가 추천하는 이유 */}
        <div className="mx-4 mb-4">
          <div className="bg-gray-50 rounded-2xl p-5">
            <p className="text-[15px] font-bold text-gray-900 mb-3.5">다있어가 이 제품을 고른 이유</p>
            {valuePoints.map((point, i) => (
              <div key={i} className="flex gap-2.5 mb-2.5 last:mb-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C471" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <p className="text-sm text-gray-600 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 안내 문구 */}
        <div className="mx-4 mb-6 bg-gray-50 rounded-xl px-4 py-3.5">
          {DISCLAIMER_LINES.map((line, i) => (
            <p key={i} className="text-[11px] text-gray-400 leading-relaxed">
              · {line}
            </p>
          ))}
        </div>

        {/* 관련 상품 */}
        {related.length > 0 && (
          <section className="px-4 mt-2 border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold mb-3">이런 상품도 있어요</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* 구매 버튼 (하단 고정) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 p-3 z-50">
          <div className="max-w-3xl mx-auto">
            <a
              href={affiliateLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 rounded-xl text-white text-center text-base font-bold hover:opacity-90 transition-opacity"
              style={{
                background: pConfig.color,
                boxShadow: `0 4px 14px ${pConfig.shadow}`,
              }}
            >
              다있어 꿀템 {pConfig.name}에서 구매하기
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
