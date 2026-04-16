import { NextResponse } from 'next/server';
import crypto from 'crypto';

const DOMAIN = 'https://api-gateway.coupang.com';
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || '';
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || '';

/**
 * GET /api/coupang/report — 어제 매출 리포트 + Slack 알림
 * Vercel Cron으로 매일 아침 실행
 */
export async function GET(req: Request) {
  // Cron 인증
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 어제 날짜 (KST 기준)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const yesterday = new Date(kst.getTime() - 24 * 60 * 60 * 1000);
    const dateStr = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
    // yyyyMMdd 형식

    // 쿠팡 주문 리포트 API
    const uri = `/v2/providers/affiliate_open_api/apis/openapi/v1/reports/orders?orderDateFrom=${dateStr}&orderDateTo=${dateStr}`;
    const authorization = generateHmac('GET', uri);

    const res = await fetch(`${DOMAIN}${uri}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    });

    let orders: OrderItem[] = [];
    let apiError = '';

    if (res.ok) {
      const json = await res.json();
      orders = json.data || [];
    } else {
      const text = await res.text();
      apiError = `API 오류 ${res.status}: ${text.slice(0, 200)}`;
    }

    // 매출 요약
    const totalOrders = orders.length;
    const totalCommission = orders.reduce((sum, o) => sum + (o.commission || 0), 0);
    const totalSales = orders.reduce((sum, o) => sum + (o.orderPrice || 0), 0);
    const cancelledOrders = orders.filter(o => o.cancelYn === 'Y').length;
    const confirmedOrders = totalOrders - cancelledOrders;

    const report = {
      date: `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`,
      totalOrders,
      confirmedOrders,
      cancelledOrders,
      totalSales,
      totalCommission,
      orders: orders.slice(0, 20), // 최대 20개
      apiError,
    };

    // Slack 알림
    await sendSalesSlack(report);

    return NextResponse.json({ data: report });
  } catch (e) {
    return NextResponse.json({ error: '리포트 실패: ' + String(e) }, { status: 500 });
  }
}

// POST — 수동 호출 (어드민에서)
export async function POST() {
  // GET과 동일하게 실행 (인증 없이)
  try {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const yesterday = new Date(kst.getTime() - 24 * 60 * 60 * 1000);
    const dateStr = yesterday.toISOString().slice(0, 10).replace(/-/g, '');

    const uri = `/v2/providers/affiliate_open_api/apis/openapi/v1/reports/orders?orderDateFrom=${dateStr}&orderDateTo=${dateStr}`;
    const authorization = generateHmac('GET', uri);

    const res = await fetch(`${DOMAIN}${uri}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    });

    let orders: OrderItem[] = [];
    let apiError = '';

    if (res.ok) {
      const json = await res.json();
      orders = json.data || [];
    } else {
      const text = await res.text();
      apiError = `API 오류 ${res.status}: ${text.slice(0, 200)}`;
    }

    const totalOrders = orders.length;
    const totalCommission = orders.reduce((sum, o) => sum + (o.commission || 0), 0);
    const totalSales = orders.reduce((sum, o) => sum + (o.orderPrice || 0), 0);
    const cancelledOrders = orders.filter(o => o.cancelYn === 'Y').length;
    const confirmedOrders = totalOrders - cancelledOrders;

    const report = {
      date: `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`,
      totalOrders,
      confirmedOrders,
      cancelledOrders,
      totalSales,
      totalCommission,
      orders: orders.slice(0, 20),
      apiError,
    };

    return NextResponse.json({ data: report });
  } catch (e) {
    return NextResponse.json({ error: '리포트 실패: ' + String(e) }, { status: 500 });
  }
}

interface OrderItem {
  orderId?: string;
  orderPrice?: number;
  commission?: number;
  cancelYn?: string;
  productName?: string;
  quantity?: number;
  orderDate?: string;
}

function generateHmac(method: string, uri: string): string {
  const parts = uri.split('?');
  const path = parts[0];
  const query = parts.length === 2 ? parts[1] : '';

  const now = new Date();
  const datetime = now.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .slice(2);

  const message = datetime + method + path + query;

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
}

async function sendSalesSlack(report: {
  date: string;
  totalOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  totalSales: number;
  totalCommission: number;
  orders: OrderItem[];
  apiError: string;
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const emoji = report.totalOrders > 0 ? '💰' : '📊';
  const commissionText = report.totalCommission > 0
    ? `${report.totalCommission.toLocaleString()}원`
    : '0원';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} 다있어 매출 리포트 (${report.date})`, emoji: true },
    },
  ];

  if (report.apiError) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `⚠️ API 오류: ${report.apiError}` },
    });
  } else if (report.totalOrders === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '어제 주문이 없었어요. 상품 큐레이션을 더 해볼까요? 💪' },
    });
  } else {
    blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*주문:* ${report.totalOrders}건` },
        { type: 'mrkdwn', text: `*확정:* ${report.confirmedOrders}건` },
        { type: 'mrkdwn', text: `*매출:* ${report.totalSales.toLocaleString()}원` },
        { type: 'mrkdwn', text: `*예상 수익:* ${commissionText}` },
      ],
    });

    if (report.cancelledOrders > 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `❌ 취소: ${report.cancelledOrders}건` },
      });
    }

    // 상위 5개 주문 상품
    const topOrders = report.orders.filter(o => o.productName).slice(0, 5);
    if (topOrders.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*주문 상품:*\n${topOrders.map(o =>
            `• ${(o.productName || '').slice(0, 30)} × ${o.quantity || 1} — ${(o.orderPrice || 0).toLocaleString()}원`
          ).join('\n')}`,
        },
      });
    }
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
  } catch {
    console.error('Slack 매출 알림 전송 실패');
  }
}
