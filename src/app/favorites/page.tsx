'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { HeartIcon } from '@/components/Icons';
import ProductCard from '@/components/ProductCard';
import { products } from '@/data/products';
import type { Product } from '@/data/types';

const FAVORITES_KEY = 'daisso_favorites';

function getFavoriteIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function FavoritesPage() {
  const [favProducts, setFavProducts] = useState<Product[]>([]);

  useEffect(() => {
    const ids = getFavoriteIds();
    setFavProducts(products.filter(p => ids.includes(p.id)));
  }, []);

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pb-12">
        <h1 className="mt-6 text-2xl font-bold">찜 목록</h1>

        {favProducts.length > 0 ? (
          <>
            <p className="mt-2 text-sm text-gray-500">{favProducts.length}개의 찜한 상품</p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {favProducts.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-20 text-gray-300">
            <HeartIcon size={48} />
            <p className="text-base mt-3">아직 찜한 상품이 없어요</p>
            <p className="text-sm mt-1 text-gray-400">마음에 드는 꿀템을 찜해보세요!</p>
          </div>
        )}
      </main>
    </>
  );
}
