// 쿠팡파트너스 범용 제휴 링크 (fallback only)
const COUPANG_HOME_LINK = 'https://link.coupang.com/a/eod2lj';

export function buildAffiliateLink(productUrl: string): string {
  return productUrl || COUPANG_HOME_LINK;
}

export const COUPANG_DISCLAIMER = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
