import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { searchProducts } from '@/lib/coupang-api';
import { requireAdmin } from '@/lib/adminAuth';

interface HealthIssue {
  id: number;
  title: string;
  issue: string;
  action: string;
  severity: 'critical' | 'warning' | 'info';
}

/**
 * 헬스체크 방식:
 * - 쿠팡 상품 → 쿠팡 API로 상품명 재검색, 결과 없으면 내려간 것
 * - 이미지 → HEAD 요청으로 깨졌는지 확인 (이미지 CDN은 봇 차단 안 함)
 * - URL 직접 접속 X (봇 차단 + 제휴 계정 위험)
 */

async function runHealthCheck() {
  const sql = getDb();
  const products = await sql`SELECT * FROM products WHERE is_active = true`;

  const results: HealthIssue[] = [];
  let checked = 0;
  let issues = 0;

  for (const p of products) {
    checked++;

    // 0. 토스/컬리/테무 등 API 없는 플랫폼 → 등록 후 2주 경과 시 알림
    if (p.platform !== 'coupang') {
      const createdAt = new Date(p.updated_at || p.created_at);
      const daysSince = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 14) {
        results.push({
          id: p.id, title: p.title,
          issue: `${daysSince}일 경과 (${p.platform}) — 아직 판매 중인지 확인 필요`,
          action: '수동 확인', severity: 'warning',
        });
        issues++;
      }
      continue;
    }

    // 1. 쿠팡 상품 → API로 존재 여부 체크
    if (p.platform === 'coupang' && p.title) {
      try {
        // 상품명에서 핵심 키워드 2~3개 추출
        const keyword = extractSearchKeyword(p.title);
        if (keyword) {
          const searchResult = await searchProducts(keyword, 5);
          const items = searchResult?.data?.productData || [];

          if (items.length === 0) {
            // 검색 결과 0개 → 상품 내려갔을 가능성 높음
            // 바로 OFF 하지 않고 경고만 (키워드 매칭 실패일 수도 있으므로)
            results.push({
              id: p.id, title: p.title,
              issue: '쿠팡 검색 결과 없음 (내려갔을 수 있음)',
              action: '확인 필요', severity: 'warning',
            });
            issues++;
          }
          // 검색 결과 있으면 정상 → 패스
        }
      } catch {
        // API 에러 → 스킵 (일시적일 수 있음)
      }

      // rate limit 방지 (쿠팡 API)
      await new Promise(r => setTimeout(r, 500));
    }

    // 2. 이미지 URL 체크 — 2회 재시도 (HEAD → GET fallback). 그래도 실패하면 알림만,
    //    DB image_url 자동 NULL 처리는 하지 않음 (false positive 잦음 — 콜드스타트, CDN 일시 장애 등)
    if (p.image_url) {
      let imageOk = false;
      for (let attempt = 0; attempt < 2 && !imageOk; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const method = attempt === 0 ? 'HEAD' : 'GET';
          const imgRes = await fetch(p.image_url, {
            method,
            signal: controller.signal,
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
          });
          clearTimeout(timeout);
          if (imgRes.status < 400) imageOk = true;
        } catch {
          // 다음 attempt 시도
        }
      }
      if (!imageOk) {
        // ❗ image_url 자동 NULL 처리 X — 알림만 보내고 어드민이 직접 확인
        results.push({
          id: p.id, title: p.title,
          issue: '이미지 접속 실패 (2회 재시도 후) — 자동 처리 안 함',
          action: '어드민에서 직접 확인',
          severity: 'warning',
        });
        issues++;
      }
    }
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

/** 상품명에서 검색용 핵심 키워드 추출 */
function extractSearchKeyword(title: string): string {
  const cleaned = title
    .replace(/\([^)]*\)/g, '')       // 괄호 내용 제거
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[0-9]+[개팩세트매장입봉]+/g, '') // 수량
    .replace(/\s+/g, ' ')
    .trim();

  // 한국어 단어 추출
  const words = (cleaned.match(/[가-힣]{2,8}/g) || [])
    .filter(w => !STOP.has(w));

  // 영어 브랜드명
  const eng = (cleaned.match(/[A-Za-z]{2,15}/g) || [])
    .filter(w => !ENG_STOP.has(w.toLowerCase()));

  // 상위 2~3개 조합
  const parts = [...words.slice(0, 2), ...eng.slice(0, 1)];
  return parts.join(' ').trim();
}

const STOP = new Set(['무료', '배송', '할인', '특가', '세일', '한정', '인기', '추천', '최저가', '국내', '정품', '로켓프레시', '로켓배송']);
const ENG_STOP = new Set(['the', 'and', 'for', 'with', 'free', 'new', 'hot', 'best', 'sale', 'set', 'pack', 'box', 'USB', 'LED']);

/** Slack 웹훅으로 알림 전송 */
async function sendSlackAlert(report: {
  checked: number;
  issues: number;
  healthy: number;
  results: HealthIssue[];
  checkedAt: string;
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

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
    console.error('Slack 알림 전송 실패');
  }
}

// PATCH — 전체 복구 (잘못된 OFF 복구용)
export async function PATCH(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const sql = getDb();
    const result = await sql`UPDATE products SET is_active = true, updated_at = NOW() WHERE is_active = false`;
    return NextResponse.json({ data: { restored: result.length || 0, message: '전체 복구 완료' } });
  } catch (e) {
    return NextResponse.json({ error: '복구 실패: ' + String(e) }, { status: 500 });
  }
}

// POST — 수동 체크 (어드민 버튼)
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const report = await runHealthCheck();
    return NextResponse.json({ data: report });
  } catch (e) {
    return NextResponse.json({ error: '헬스체크 실패: ' + String(e) }, { status: 500 });
  }
}

// GET — 자동 체크 (Vercel Cron)
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
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
