import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { PackageIcon } from '@/components/Icons';
import CategoryBar from '@/components/CategoryBar';
import ProductCard from '@/components/ProductCard';
import Footer from '@/components/Footer';
import { categories } from '@/data/categories';
import { getProductsByCategory } from '@/data/products';
import type { CategorySlug } from '@/data/types';
import type { Metadata } from 'next';

type Props = { params: Promise<{ slug: string }> };

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

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = categories.find(c => c.slug === slug);
  if (!category) notFound();

  const items = getProductsByCategory(slug as CategorySlug);

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
              {items.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
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
