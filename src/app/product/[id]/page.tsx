import { notFound } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { getProductById, getProductsByCategory, products } from '@/data/products';
import { categories } from '@/data/categories';
import { buildAffiliateLink, COUPANG_DISCLAIMER } from '@/lib/coupang';
import type { Metadata } from 'next';

type Props = { params: Promise<{ id: string }> };

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

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) notFound();

  const category = categories.find(c => c.slug === product.category);
  const related = getProductsByCategory(product.category).filter(p => p.id !== product.id).slice(0, 4);
  const affiliateLink = buildAffiliateLink(product.coupangUrl);

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto pb-24">
        {/* 상품 이미지 */}
        <img src={product.imageUrl} alt={product.title} className="w-full aspect-square object-cover" />

        {/* 상품 정보 */}
        <div className="px-4 py-5">
          {category && (
            <Link href={`/category/${category.slug}`} className="text-sm font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
              {category.emoji} {category.name}
            </Link>
          )}
          <h1 className="mt-2 text-xl font-bold leading-snug">{product.title}</h1>

          <div className="mt-4 flex items-center gap-2">
            <span className="text-2xl font-extrabold" style={{ color: 'var(--accent-red)' }}>{product.discountPercent}%</span>
            <span className="text-2xl font-extrabold">{product.salePrice.toLocaleString()}원</span>
          </div>
          <p className="text-sm text-gray-400 line-through">{product.originalPrice.toLocaleString()}원</p>

          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <span>⭐ {product.rating}</span>
            <span>·</span>
            <span>리뷰 {product.reviewCount.toLocaleString()}개</span>
          </div>

          <p className="mt-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-5">
            {product.description}
          </p>

          <p className="mt-5 text-xs text-gray-400 leading-relaxed">
            {COUPANG_DISCLAIMER}
          </p>
        </div>

        {/* 관련 상품 */}
        {related.length > 0 && (
          <section className="px-4 mt-4 border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold mb-3">이런 상품도 있어요</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* 구매 버튼 (하단 고정) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50">
          <div className="max-w-3xl mx-auto">
            <a
              href={affiliateLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 rounded-xl text-white text-center text-base font-bold hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              쿠팡에서 구매하기
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
