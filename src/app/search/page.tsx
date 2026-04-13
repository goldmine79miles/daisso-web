'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import ProductCard from '@/components/ProductCard';
import { searchProducts } from '@/data/products';

const SUGGESTIONS = ['충전기', '닭가슴살', '청소포', '이어폰', '기저귀', '요가매트'];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const results = query.trim() ? searchProducts(query) : [];

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pb-12">
        {/* 검색바 */}
        <div className="mt-4 flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-3">
          <span className="text-gray-400">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="어떤 꿀템을 찾으세요?"
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>

        {query.trim() ? (
          results.length > 0 ? (
            <>
              <p className="mt-4 text-sm text-gray-500">"{query}" 검색 결과 {results.length}건</p>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                {results.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <span className="text-5xl mb-3">🔍</span>
              <p className="text-base">검색 결과가 없어요</p>
              <p className="text-sm mt-1">다른 키워드로 검색해보세요</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <span className="text-5xl mb-3">💡</span>
            <p className="text-base">어떤 꿀템을 찾으시나요?</p>
            <div className="flex flex-wrap gap-2 mt-5 justify-center">
              {SUGGESTIONS.map(kw => (
                <button
                  key={kw}
                  onClick={() => setQuery(kw)}
                  className="px-4 py-2 rounded-full border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
