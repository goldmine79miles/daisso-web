import crypto from 'crypto';

const DOMAIN = 'https://api-gateway.coupang.com';
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || '';
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || '';

/**
 * HMAC 서명 생성 (쿠팡 파트너스 API 인증)
 */
function generateHmac(method: string, uri: string): string {
  const parts = uri.split('?');
  const path = parts[0];
  const query = parts.length === 2 ? parts[1] : '';

  const now = new Date();
  const datetime = now.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .slice(2); // yyMMddTHHmmssZ 형식

  const message = datetime + method + path + query;

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
}

/**
 * 쿠팡 파트너스 API 호출
 */
async function callCoupangApi(method: string, uri: string, body?: object) {
  const authorization = generateHmac(method, uri);

  const res = await fetch(`${DOMAIN}${uri}`, {
    method,
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coupang API error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Goldbox — 실시간 인기 할인 상품 조회
 */
export async function getGoldboxProducts(categoryId?: number, subCategoryId?: number) {
  let uri = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox';
  const params: string[] = [];
  if (categoryId) params.push(`categoryId=${categoryId}`);
  if (subCategoryId) params.push(`subCategoryId=${subCategoryId}`);
  if (params.length > 0) uri += '?' + params.join('&');

  return callCoupangApi('GET', uri);
}

/**
 * 딥링크 생성 — 쿠팡 URL을 제휴 링크로 변환
 */
export async function createDeeplinks(coupangUrls: string[]) {
  const uri = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
  return callCoupangApi('POST', uri, { coupangUrls });
}

/**
 * 상품 검색
 */
export async function searchProducts(keyword: string, limit = 20) {
  const uri = `/v2/providers/affiliate_open_api/apis/openapi/v1/products/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  return callCoupangApi('GET', uri);
}

/**
 * 카테고리 목록 (쿠팡 공식)
 */
export const COUPANG_CATEGORIES = [
  { id: 1001, name: '여성패션' },
  { id: 1002, name: '남성패션' },
  { id: 1010, name: '뷰티' },
  { id: 1011, name: '출산/유아동' },
  { id: 1012, name: '식품' },
  { id: 1013, name: '주방용품' },
  { id: 1014, name: '생활용품' },
  { id: 1015, name: '홈인테리어' },
  { id: 1016, name: '가전디지털' },
  { id: 1017, name: '스포츠/레저' },
  { id: 1018, name: '자동차용품' },
  { id: 1019, name: '도서/음반/DVD' },
  { id: 1020, name: '완구/취미' },
  { id: 1021, name: '문구/오피스' },
  { id: 1024, name: '반려동물용품' },
  { id: 1025, name: '헬스/건강식품' },
];
