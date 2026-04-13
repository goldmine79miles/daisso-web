import Link from 'next/link';
import type { Product } from '@/data/types';

export default function ProductCard({ product }: { product: Product }) {
  const tagLabel = product.tags[0];
  const tagColor = tagLabel === 'hot' ? 'bg-red-500' : tagLabel === 'best' ? 'bg-blue-500' : tagLabel === 'new' ? 'bg-green-500' : 'bg-gray-400';

  return (
    <Link href={`/product/${product.id}`} className="block bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="relative">
        <img
          src={product.imageUrl}
          alt={product.title}
          loading="lazy"
          className="w-full aspect-square object-cover"
        />
        {tagLabel && (
          <span className={`absolute top-2 left-2 ${tagColor} text-white text-[11px] font-bold px-2 py-0.5 rounded`}>
            {tagLabel.toUpperCase()}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{product.title}</p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-sm font-extrabold" style={{ color: 'var(--accent-red)' }}>{product.discountPercent}%</span>
          <span className="text-sm font-extrabold text-gray-900">{product.salePrice.toLocaleString()}원</span>
        </div>
        <p className="text-xs text-gray-400 line-through">{product.originalPrice.toLocaleString()}원</p>
        <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
          <span>⭐ {product.rating}</span>
          <span>· 리뷰 {product.reviewCount.toLocaleString()}</span>
        </div>
      </div>
    </Link>
  );
}
