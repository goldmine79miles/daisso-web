import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { PackageIcon } from '@/components/Icons';
import CategoryBar from '@/components/CategoryBar';
import Footer from '@/components/Footer';
import { categories } from '@/data/categories';
import { getDbProductsByCategory, type DbProduct } from '@/lib/get-products';
import type { CategorySlug } from '@/data/types';
import type { Metadata } from 'next';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60; // 60초마다 재생성 (어드민 변경 빠르게 반영)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = categories.find(c => c.slug === slug);
  if (!cat) return {};
  return {
    title: `${cat.name} 추천 - 다있어`,
    description: `${cat.name} 카테고리의 검증된 가성비 제품을 모아봤어요. 최저가 할인 상품을 확인하세요.`,
  };
}

export function generateStaticParams() {
  return categories.filter(c => c.slug !== 'all').map(c => ({ slug: c.slug }));
}

/* DB 상품 카드 (외부 링크로 이동) */
function DbProductCard({ item }: { item: DbProduct }) {
  return (
    <a
      href={item.affiliate_url}
      target="_blank"
      rel="noreferrer"
      className="block bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative">
        <img
          src={item.image_url || '/logo-light.png'}
          alt={item.title}
          loading="lazy"
          className="w-full aspect-square object-cover"
        />
        {item.discount_rate > 0 && (
          <span className="absolute top-2 right-2 bg-orange-500 text-white text-[11px] font-bold px-2 py-0.5 rounded">
            {item.discount_rate}%
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</p>
        <div className="mt-2 flex items-center gap-1.5">
          {item.discount_rate > 0 && (
            <span className="text-sm font-extrabold text-orange-500">{item.discount_rate}%</span>
          )}
          <span className="text-sm font-extrabold text-gray-900">{item.sale_price.toLocaleString()}원</span>
        </div>
        {item.original_price > item.sale_price && (
          <p className="text-xs text-gray-400 line-through">{item.original_price.toLocaleString()}원</p>
        )}
      </div>
    </a>
  );
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = categories.find(c => c.slug === slug);
  if (!category) notFound();

  const items = await getDbProductsByCategory(slug);

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto">
        <CategoryBar selected={slug as CategorySlug} />

        <section className="px-4 mt-2">
          <h1 className="text-2xl font-bold">{category.name}</h1>
          <p className="text-sm text-gray-500 mt-1">총 {items.length}개의 추천 제품</p>
        </section>

        {items.length > 0 ? (
          <section className="px-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {items.map(item => <DbProductCard key={item.id} item={item} />)}
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center py-20 text-gray-300">
            <PackageIcon size={48} />
            <p className="mt-3 text-gray-400">아직 등록된 상품이 없어요</p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
