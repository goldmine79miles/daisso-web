import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { getShuffleConfig, setSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/products/shuffle-now
 * 어드민 전용 — 지금 즉시 셔플 + 현재 bucket 기록.
 * 다음 자동 셔플은 bucket 경계가 지난 뒤에만 실행됨.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const sql = getDb();

    // 셔플 대상: 활성 + 고정 핀 아닌 것 (TOP5 포함, pinned만 고정 순서 유지)
    const rows = await sql`
      SELECT id FROM products
      WHERE is_active = true
        AND (pinned IS NULL OR pinned = false)
      ORDER BY sort_order ASC, created_at DESC
    `;
    const list = rows as Array<{ id: number }>;
    if (list.length < 2) {
      return NextResponse.json({ data: { shuffled: 0 } });
    }

    // 순수 랜덤 (시드 없음, 수동이라 한 번만 쓰임)
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      await sql`UPDATE products SET sort_order = ${i}, updated_at = NOW() WHERE id = ${shuffled[i].id}`;
    }

    // 마지막 셔플 시각 기록 → auto-shuffle이 interval 지나기 전엔 건들지 않음
    await setSetting('shuffle_at', String(Date.now()));

    return NextResponse.json({ data: { shuffled: shuffled.length } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
