import { NextRequest, NextResponse } from 'next/server';

/**
 * 어드민 mutation API용 Bearer 토큰 검증
 * Authorization: Bearer <ADMIN_TOKEN>
 *
 * 사용: POST/PUT/DELETE 핸들러 최상단에서
 *   const auth = requireAdmin(req);
 *   if (auth) return auth;
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    // 프로덕션에서 토큰 미설정이면 안전하게 거부
    if (process.env.NODE_ENV === 'production') {
      console.error('[adminAuth] ADMIN_TOKEN not set in production');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    // dev 환경에선 통과
    return null;
  }
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
