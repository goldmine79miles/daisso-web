import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * GET /api/influencers — 인플루언서 링크 목록
 * POST /api/influencers — 인플루언서 링크 등록
 * DELETE /api/influencers?id=123 — 삭제
 */

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM influencer_links ORDER BY created_at DESC`;
    return NextResponse.json({ data: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const { name, platform, profile_url, inpock_url, memo } = body;

    if (!name?.trim() || !inpock_url?.trim()) {
      return NextResponse.json({ error: '이름과 링크는 필수예요' }, { status: 400 });
    }

    // https:// 자동 붙이기
    let url = inpock_url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // 링크 타입 자동 감지
    const linkType = detectLinkType(url);

    const sql = getDb();
    const rows = await sql`
      INSERT INTO influencer_links (name, platform, profile_url, inpock_url, memo)
      VALUES (${name.trim()}, ${platform || linkType}, ${profile_url || ''}, ${url}, ${memo || ''})
      RETURNING *
    `;
    return NextResponse.json({ data: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: '등록 실패: ' + String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const { id, name, inpock_url, profile_url, memo } = body;
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    if (!name?.trim() || !inpock_url?.trim()) {
      return NextResponse.json({ error: '이름과 링크는 필수예요' }, { status: 400 });
    }

    let url = inpock_url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const linkType = detectLinkType(url);

    const sql = getDb();
    const rows = await sql`
      UPDATE influencer_links
      SET name = ${name.trim()}, inpock_url = ${url}, platform = ${linkType},
          profile_url = ${profile_url || ''}, memo = ${memo || ''}
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    return NextResponse.json({ data: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: '수정 실패: ' + String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    const sql = getDb();
    await sql`DELETE FROM influencer_links WHERE id = ${Number(id)}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function detectLinkType(url: string): string {
  if (url.includes('inpock.co.kr') || url.includes('inpk.kr') || url.includes('inpk.link')) return 'inpock';
  if (url.includes('linktr.ee')) return 'linktree';
  if (url.includes('litt.ly')) return 'littly';
  if (url.includes('linkin.bio')) return 'linkinbio';
  if (url.includes('beacons.ai')) return 'beacons';
  if (url.includes('bit.ly')) return 'bitly';
  if (url.includes('instagram.com')) return 'instagram';
  return 'other';
}
