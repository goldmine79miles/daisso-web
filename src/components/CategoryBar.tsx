'use client';

import Link from 'next/link';
import { categories } from '@/data/categories';
import type { CategorySlug } from '@/data/types';

export default function CategoryBar({ selected }: { selected: CategorySlug }) {
  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {categories.map(cat => {
        const isActive = cat.slug === selected;
        return (
          <Link
            key={cat.slug}
            href={cat.slug === 'all' ? '/' : `/category/${cat.slug}`}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              isActive
                ? 'border-orange-400 bg-orange-50 text-orange-600 font-bold'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
