import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { setSetting } from '@/lib/settings';

// POST /api/products/reorder — 순서 일괄 변경
// body: { orders: [{ id: 1, sort_order: 0 }, { id: 2, sort_order: 1 }, ...] }
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { orders } = await req.json();
    if (!Array.isArray(orders)) {
      return NextResponse.json({ error: 'orders 배열이 필요해요' }, { status: 400 });
    }

    const sql = getDb();
    for (const { id, sort_order } of orders) {
      // section=ranking 상품이면 ranked_at 도 NOW 로 갱신 — 24h 만료로 TOP5 에서 떨어지고
      // view_count 기반 autoPicks 로 대체되면서 admin 의 sort_order 가 무시되던 버그 방지
      await sql`
        UPDATE products
        SET sort_order = ${sort_order},
            updated_at = NOW(),
            ranked_at = CASE WHEN section = 'ranking' THEN NOW() ELSE ranked_at END
        WHERE id = ${id}
      `;
    }

    // 어드민이 수동으로 순서 바꾼 것도 "최근 셔플"로 간주 → 다음 auto-shuffle 지연
    await setSetting('shuffle_at', String(Date.now()));

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
