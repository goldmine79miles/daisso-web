import Navbar from '@/components/Navbar';
import CategoryBar from '@/components/CategoryBar';
import Footer from '@/components/Footer';
import { getDbProducts, type DbProduct } from '@/lib/get-products';

// DB 상품용 카드 (외부 링크로 이동)
function DbProductCard({ item, rank }: { item: DbProduct; rank?: number }) {
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
        {rank && rank <= 3 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded">
            TOP {rank}
          </span>
        )}
        {item.discount_rate > 0 && (
          <span className="absolute top-2 right-2 bg-orange-500 text-white text-[11px] font-bold px-2 py-0.5 rounded">
            {item.discount_rate}%
          </span>
        )}
        {/* 플랫폼 뱃지 */}
        <span className={`absolute bottom-2 left-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded ${
          item.platform === 'coupang' ? 'bg-red-600' :
          item.platform === 'toss' ? 'bg-blue-500' :
          item.platform === 'kurly' ? 'bg-purple-700' :
          'bg-orange-500'
        }`}>
          {item.platform === 'coupang' ? '쿠팡' :
           item.platform === 'toss' ? '토스' :
           item.platform === 'kurly' ? '컬리' : '테무'}
        </span>
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

export const revalidate = 60; // 60초마다 재생성

export default async function HomePage() {
  // DB에서 상품 가져오기
  const [rankingItems, recommendItems, dealItems] = await Promise.all([
    getDbProducts('ranking'),
    getDbProducts('recommend'),
    getDbProducts('deal'),
  ]);

  const hasDbRanking = rankingItems.length > 0;
  const hasDbRecommend = recommendItems.length > 0;
  const hasDbDeal = dealItems.length > 0;

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto">
        <CategoryBar selected="all" />

        {/* 히어로 배너 */}
        <section className="mx-4 mt-2 rounded-2xl p-8 text-white" style={{ background: 'linear-gradient(135deg, #E53935, #C62828)' }}>
          <h1 className="text-2xl md:text-3xl font-extrabold">검증된 가성비 제품<br />다있어요.</h1>
          <p className="mt-2 text-sm md:text-base opacity-90">카테고리별 최저가 상품도 한눈에 확인하세요</p>
        </section>

        {/* 다들 이거 사고 있어요 TOP 7 */}
        {hasDbRanking && (
          <section className="mt-8 px-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">다들 이거 사고 있어요 <span className="text-red-500">TOP 7</span></h2>
              <span className="text-xs font-semibold text-red-500 flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> LIVE
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {rankingItems.map((item, i) => <DbProductCard key={item.id} item={item} rank={i + 1} />)}
            </div>
          </section>
        )}

        {/* 다있어 가성비 추천 */}
        {hasDbRecommend && (
          <section className="mt-10 px-4">
            <h2 className="text-xl font-bold mb-4">다있어 <span className="text-red-500">가성비</span> 추천</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {recommendItems.map((item) => <DbProductCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        {/* 득템 — 맨 밑 */}
        {hasDbDeal && (
          <section className="mt-10 px-4">
            <h2 className="text-xl font-bold mb-4">오늘의 <span className="text-red-500">득템</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {dealItems.map((item) => <DbProductCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        {/* 빈 상태 — 모든 섹션 비어있을 때 */}
        {!hasDbRanking && !hasDbRecommend && !hasDbDeal && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-sm">상품을 준비 중이에요</p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
