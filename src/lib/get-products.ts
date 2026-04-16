import { getDb } from './db';

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
  review_highlights: string | null; // JSON string: string[]
}

/**
 * DB에서 활성 상품을 섹션별로 가져오기
 * 실패 시 빈 배열 반환 (하드코딩 폴백은 페이지에서 처리)
 */
export async function getDbProducts(section?: string): Promise<DbProduct[]> {
  try {
    const sql = getDb();
    if (section) {
      const rows = await sql`
        SELECT * FROM products
        WHERE is_active = true AND section = ${section}
        ORDER BY sort_order ASC, created_at DESC
      `;
      return rows as DbProduct[];
    }
    const rows = await sql`
      SELECT * FROM products
      WHERE is_active = true
      ORDER BY sort_order ASC, created_at DESC
    `;
    return rows as DbProduct[];
  } catch {
    return [];
  }
}

/**
 * DB에서 단일 상품 조회 (id: 숫자)
 */
export async function getDbProductById(id: number): Promise<DbProduct | null> {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM products WHERE id = ${id} AND is_active = true LIMIT 1`;
    return (rows[0] as DbProduct) || null;
  } catch {
    return null;
  }
}
