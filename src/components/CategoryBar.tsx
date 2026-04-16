'use client';

import Link from 'next/link';
import { categories } from '@/data/categories';
import type { CategorySlug } from '@/data/types';

export default function CategoryBar({ selected }: { selected: CategorySlug }) {
  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto items-center" style={{ scrollbarWidth: 'none' }}>
      {categories.map(cat => {
        const isActive = cat.slug === selected;
        return (
          <Link
            key={cat.slug}
            href={cat.slug === 'all' ? '/' : `/category/${cat.slug}`}
            className={`shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-2xl text-xs font-medium transition-all ${
              isActive
                ? 'bg-red-500 text-white shadow-md shadow-red-200 scale-105'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:scale-105'
            }`}
            style={{ minWidth: 60 }}
          >
            <span className="text-lg leading-none">{cat.emoji}</span>
            <span className="font-semibold whitespace-nowrap" style={{ fontSize: 11 }}>{cat.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
