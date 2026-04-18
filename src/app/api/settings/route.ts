import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings, setSetting } from '@/lib/settings';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/settings — 현재 셔플 설정 반환 (공개, 어드민 UI용)
export async function GET() {
  try {
    const all = await getAllSettings();
    return NextResponse.json({
      data: {
        shuffle_enabled: all.shuffle_enabled !== 'false',
        shuffle_interval_hours: Number(all.shuffle_interval_hours) || 2,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/settings — 어드민만, 셔플 on/off + 시간 변경
export async function PUT(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const { shuffle_enabled, shuffle_interval_hours } = body;

    if (typeof shuffle_enabled === 'boolean') {
      await setSetting('shuffle_enabled', shuffle_enabled ? 'true' : 'false');
    }
    if (typeof shuffle_interval_hours === 'number' && shuffle_interval_hours >= 1 && shuffle_interval_hours <= 168) {
      await setSetting('shuffle_interval_hours', String(Math.floor(shuffle_interval_hours)));
    }

    const all = await getAllSettings();
    return NextResponse.json({
      data: {
        shuffle_enabled: all.shuffle_enabled !== 'false',
        shuffle_interval_hours: Number(all.shuffle_interval_hours) || 2,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
