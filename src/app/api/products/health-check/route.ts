import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface HealthIssue {
  id: number;
  title: string;
  issue: string;
  action: string;
  severity: 'critical' | 'warning' | 'info';
}

/**
 * POST /api/products/health-check — 수동 체크 (어드민 버튼)
 * GET  /api/products/health-check — 자동 체크 (Vercel Cron)
 *
 * 체크 항목:
 * 1. 상품 URL 404/410 → 상품 내려감 (자동 OFF)
 * 2. 품절 리다이렉트 → 품절 (자동 OFF)
 * 3. 이미지 URL 깨짐 → 이미지 제거
 * 4. Slack 웹훅 알림 (문제 발견 시)
 */

async function runHealthCheck() {
  const sql = getDb();
  const products = await sql`SELECT * FROM products WHERE is_active = true`;

  const results: HealthIssue[] = [];
  let checked = 0;
  let issues = 0;

  for (const p of products) {
    checked++;

    // 1. 상품 URL 체크
    if (p.affiliate_url) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(p.affiliate_url, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DaissoBot/1.0)' },
        });
        clearTimeout(timeout);

        // 404, 410 → 상품 내려감
        if (res.status === 404 || res.status === 410) {
          await sql`UPDATE products SET is_active = false, updated_at = NOW() WHERE id = ${p.id}`;
          results.push({ id: p.id, title: p.title, issue: `상품 삭제됨 (${res.status})`, action: '자동 OFF', severity: 'critical' });
          issues++;
          continue;
        }

        // 기타 4xx/5xx
        if (res.status >= 400) {
          await sql`UPDATE products SET is_active = false, updated_at = NOW() WHERE id = ${p.id}`;
          results.push({ id: p.id, title: p.title, issue: `URL 오류 (${res.status})`, action: '자동 OFF', severity: 'critical' });
          issues++;
          continue;
        }

        // 쿠팡 품절/삭제 리다이렉트
        const finalUrl = res.url || '';
        if (finalUrl.includes('ProductNotFound') || finalUrl.includes('soldout')) {
          await sql`UPDATE products SET is_active = false, updated_at = NOW() WHERE id = ${p.id}`;
          results.push({ id: p.id, title: p.title, issue: '품절/삭제 페이지로 이동', action: '자동 OFF', severity: 'critical' });
          issues++;
          continue;
        }

        // 에러 페이지 리다이렉트 (상품 내려간 경우)
        if (finalUrl.includes('/error') || finalUrl.includes('pagenotfound') || finalUrl.includes('not-found')) {
          await sql`UPDATE products SET is_active = false, updated_at = NOW() WHERE id = ${p.id}`;
          results.push({ id: p.id, title: p.title, issue: '상품 페이지 없음', action: '자동 OFF', severity: 'critical' });
          issues++;
          continue;
        }
      } catch {
        // 타임아웃/네트워크 에러 → 유지 (일시적일 수 있음)
        results.push({ id: p.id, title: p.title, issue: 'URL 접속 불가 (일시적일 수 있음)', action: '유지', severity: 'warning' });
      }
    }

    // 2. 이미지 URL 체크
    if (p.image_url) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const imgRes = await fetch(p.image_url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DaissoBot/1.0)' },
        });
        clearTimeout(timeout);

        if (imgRes.status >= 400) {
          await sql`UPDATE products SET image_url = NULL, updated_at = NOW() WHERE id = ${p.id}`;
          results.push({ id: p.id, title: p.title, issue: `이미지 깨짐 (${imgRes.status})`, action: '이미지 제거', severity: 'warning' });
          issues++;
        }
      } catch {
        await sql`UPDATE products SET image_url = NULL, updated_at = NOW() WHERE id = ${p.id}`;
        results.push({ id: p.id, title: p.title, issue: '이미지 접속 불가', action: '이미지 제거', severity: 'warning' });
        issues++;
      }
    }

    // rate limit 방지
    await new Promise(r => setTimeout(r, 200));
  }

  const report = {
    checked,
    issues,
    healthy: checked - issues,
    results,
    checkedAt: new Date().toISOString(),
  };

  // Slack 알림 (문제 있을 때만)
  if (issues > 0) {
    await sendSlackAlert(report);
  }

  return report;
}

/** Slack 웹훅으로 알림 전송 */
async function sendSlackAlert(report: {
  checked: number;
  issues: number;
  healthy: number;
  results: HealthIssue[];
  checkedAt: string;
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // 설정 안 되어있으면 스킵

  const critical = report.results.filter(r => r.severity === 'critical');
  const warnings = report.results.filter(r => r.severity === 'warning');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🚨 다있어 상품 상태 알림`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*체크:* ${report.checked}개` },
        { type: 'mrkdwn', text: `*문제:* ${report.issues}개` },
        { type: 'mrkdwn', text: `*정상:* ${report.healthy}개` },
        { type: 'mrkdwn', text: `*시간:* ${new Date(report.checkedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` },
      ],
    },
  ];

  if (critical.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🔴 자동 OFF된 상품 (${critical.length}개):*\n${critical.map(r => `• [${r.id}] ${r.title.slice(0, 30)} — ${r.issue}`).join('\n')}`,
      },
    });
  }

  if (warnings.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🟡 확인 필요 (${warnings.length}개):*\n${warnings.map(r => `• [${r.id}] ${r.title.slice(0, 30)} — ${r.issue} → ${r.action}`).join('\n')}`,
      },
    });
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
  } catch {
    // Slack 실패해도 헬스체크 자체는 성공으로
    console.error('Slack 알림 전송 실패');
  }
}

// POST — 수동 체크 (어드민 버튼)
export async function POST() {
  try {
    const report = await runHealthCheck();
    return NextResponse.json({ data: report });
  } catch (e) {
    return NextResponse.json({ error: '헬스체크 실패: ' + String(e) }, { status: 500 });
  }
}

// GET — 자동 체크 (Vercel Cron)
export async function GET(req: Request) {
  // Cron 인증 (Vercel이 자동 주입하는 헤더)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Cron 시크릿 설정되어있으면 검증
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const report = await runHealthCheck();
    return NextResponse.json({ data: report });
  } catch (e) {
    return NextResponse.json({ error: '자동 헬스체크 실패: ' + String(e) }, { status: 500 });
  }
}
