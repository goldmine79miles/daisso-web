export type CategorySlug =
  | 'all'
  | 'living'
  | 'food'
  | 'electronics'
  | 'fashion'
  | 'beauty'
  | 'baby'
  | 'sports'
  | 'pet';

export interface Category {
  slug: CategorySlug;
  name: string;
  emoji: string;
  color: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  imageUrl: string;
  category: CategorySlug;
  coupangUrl: string;
  rating: number;
  reviewCount: number;
  tags: ('hot' | 'best' | 'new' | 'limited')[];
}
