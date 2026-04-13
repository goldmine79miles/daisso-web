import Navbar from '@/components/Navbar';
import CategoryBar from '@/components/CategoryBar';
import ProductCard from '@/components/ProductCard';
import Footer from '@/components/Footer';
import { getHotDeals, products } from '@/data/products';

export default function HomePage() {
  const hotDeals = getHotDeals();

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto">
        <CategoryBar selected="all" />

        {/* 히어로 배너 */}
        <section className="mx-4 mt-2 rounded-2xl p-8 text-white" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF4444)' }}>
          <h1 className="text-2xl md:text-3xl font-extrabold">가성비 꿀템만 모아놨어요 🛒</h1>
          <p className="mt-2 text-sm md:text-base opacity-90">카테고리별 최저가 상품을 한눈에 확인하세요</p>
        </section>

        {/* 오늘의 꿀딜 */}
        <section className="mt-8 px-4">
          <h2 className="text-xl font-bold mb-4">🔥 오늘의 꿀딜</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {hotDeals.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* 전체 상품 */}
        <section className="mt-10 px-4">
          <h2 className="text-xl font-bold mb-4">💰 가성비 추천</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {products.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
