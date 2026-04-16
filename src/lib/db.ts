import { neon } from '@neondatabase/serverless';

export function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return sql;
}

/* ─── 테이블 생성 ─────────────────────────── */
export async function initTables() {
  const sql = getDb();

  // 상품 테이블
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      image_url TEXT,
      affiliate_url TEXT NOT NULL,
      platform VARCHAR(20) NOT NULL DEFAULT 'coupang',
      category VARCHAR(50) NOT NULL DEFAULT 'all',
      section VARCHAR(50) NOT NULL DEFAULT 'recommend',
      sale_price INTEGER DEFAULT 0,
      original_price INTEGER DEFAULT 0,
      discount_rate INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // 인덱스
  await sql`CREATE INDEX IF NOT EXISTS idx_products_section ON products(section, sort_order)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_platform ON products(platform)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`;

  // 인플루언서 링크 테이블
  await sql`
    CREATE TABLE IF NOT EXISTS influencer_links (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      platform VARCHAR(30) NOT NULL DEFAULT 'instagram',
      profile_url TEXT,
      inpock_url TEXT NOT NULL,
      memo TEXT,
      is_active BOOLEAN DEFAULT true,
      last_scraped_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_influencer_active ON influencer_links(is_active)`;

  return { success: true };
}

/* ─── 타입 ─────────────────────────── */
export interface DbProduct {
  id: number;
  title: string;
  image_url: string | null;
  affiliate_url: string;
  platform: string;
  category: string;
  section: string;
  sale_price: number;
  original_price: number;
  discount_rate: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/* ─── 플랫폼/카테고리/섹션 상수 ─────────────────────────── */
export const PLATFORMS = [
  { id: 'coupang', name: '쿠팡', color: '#E4002B' },
  { id: 'toss', name: '토스쇼핑', color: '#3182F6' },
  { id: 'kurly', name: '컬리', color: '#5F0080' },
  { id: 'temu', name: '테무', color: '#FB7701' },
] as const;

export const CATEGORIES = [
  { id: 'all', name: '전체' },
  { id: 'living', name: '생활' },
  { id: 'food', name: '식품' },
  { id: 'electronics', name: '전자기기' },
  { id: 'fashion', name: '패션' },
  { id: 'beauty', name: '뷰티' },
  { id: 'baby', name: '육아' },
  { id: 'health', name: '건강' },
  { id: 'pet', name: '반려동물' },
] as const;

export const SECTIONS = [
  { id: 'ranking', name: '다들 이거 사고 있어요 (랭킹)', description: '홈 상단 캐러셀' },
  { id: 'recommend', name: '추천 상품', description: '홈 리스트' },
  { id: 'deal', name: '득템 (할인)', description: '득템 탭' },
] as const;
