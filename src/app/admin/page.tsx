'use client';

import { useState } from 'react';

const ADMIN_PASSWORD = 'star888!!!';

interface ProductItem {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  isRocket?: boolean;
  isFreeShipping?: boolean;
  categoryName: string;
  originalPrice: number;
  discountRate: number;
}

/* ─── 스타일 상수 ─────────────────────────── */
const C = {
  bg: '#FAFBFC',
  card: '#FFFFFF',
  primary: '#3182F6',
  primaryLight: 'rgba(49,130,246,0.06)',
  deal: '#FF6B35',
  text: '#1B1D1F',
  sub: '#6B7684',
  muted: '#ADB5BD',
  border: '#F1F3F5',
  green: '#00C471',
  coupang: '#E4002B',
  toss: '#3182F6',
  kurly: '#5F0080',
  temu: '#FB7701',
};

const platformInfo = {
  coupang: { name: '쿠팡', color: C.coupang, tag: 'COUPANG' },
  toss: { name: '토스쇼핑', color: C.toss, tag: 'TOSS' },
  kurly: { name: '컬리', color: C.kurly, tag: 'KURLY' },
  temu: { name: '테무', color: C.temu, tag: 'TEMU' },
};

type TabId = 'guide' | 'goldbox' | 'search' | 'links';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [tab, setTab] = useState<TabId>('guide');

  // Goldbox
  const [goldboxData, setGoldboxData] = useState<ProductItem[]>([]);
  const [goldboxLoading, setGoldboxLoading] = useState(false);

  // Search
  const [keyword, setKeyword] = useState('');
  const [searchData, setSearchData] = useState<ProductItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Links
  const [linkPlatform, setLinkPlatform] = useState<'coupang' | 'toss' | 'kurly' | 'temu'>('coupang');
  const [urls, setUrls] = useState('');
  const [deeplinkResult, setDeeplinkResult] = useState<Array<{ originalUrl: string; shortenUrl: string }>>([]);
  const [deeplinkLoading, setDeeplinkLoading] = useState(false);

  /* ─── 로그인 ─────────────────────────── */
  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.bg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard Variable", system-ui, sans-serif',
      }}>
        <div style={{
          width: 360,
          padding: 32,
          borderRadius: 20,
          background: C.card,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
              다있어 <span style={{ color: C.primary }}>Admin</span>
            </h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>관리자 비밀번호를 입력해주세요</p>
          </div>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pw === ADMIN_PASSWORD && setAuthed(true)}
            placeholder="비밀번호"
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 15,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: C.bg,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => pw === ADMIN_PASSWORD && setAuthed(true)}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '14px 0',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 12,
              border: 'none',
              background: C.primary,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: -0.3,
            }}
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  /* ─── API 호출 ─────────────────────────── */
  async function fetchGoldbox() {
    setGoldboxLoading(true);
    try {
      const res = await fetch('/api/coupang/goldbox');
      const json = await res.json();
      setGoldboxData(json.data || []);
    } catch (e) {
      alert('Goldbox 조회 실패: ' + e);
    }
    setGoldboxLoading(false);
  }

  async function fetchSearch() {
    if (!keyword.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/coupang/search?keyword=${encodeURIComponent(keyword)}`);
      const json = await res.json();
      setSearchData(json.data || []);
    } catch (e) {
      alert('검색 실패: ' + e);
    }
    setSearchLoading(false);
  }

  async function createDeeplink() {
    if (!urls.trim()) return;
    setDeeplinkLoading(true);
    try {
      const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
      if (linkPlatform === 'coupang') {
        const res = await fetch('/api/coupang/deeplink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: urlList }),
        });
        const json = await res.json();
        setDeeplinkResult(json.data || []);
      } else {
        // 쿠팡 외 플랫폼은 URL을 그대로 보여줌 (자체 제휴 링크)
        setDeeplinkResult(urlList.map(u => ({ originalUrl: u, shortenUrl: u })));
      }
    } catch (e) {
      alert('링크 변환 실패: ' + e);
    }
    setDeeplinkLoading(false);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
    }
  }

  /* ─── 플랫폼 뱃지 ─────────────────────────── */
  function PlatformBadge({ platform, size = 'sm' }: { platform: keyof typeof platformInfo; size?: 'sm' | 'md' }) {
    const p = platformInfo[platform];
    const isMd = size === 'md';
    return (
      <span style={{
        display: 'inline-block',
        fontSize: isMd ? 11 : 9,
        fontWeight: 700,
        color: '#fff',
        background: p.color,
        padding: isMd ? '3px 10px' : '2px 6px',
        borderRadius: isMd ? 6 : 4,
        letterSpacing: 0.5,
      }}>
        {p.tag}
      </span>
    );
  }

  /* ─── 상품 카드 ─────────────────────────── */
  function ItemCard({ item, index }: { item: ProductItem; index: number }) {
    return (
      <div style={{
        display: 'flex',
        gap: 16,
        padding: '18px 20px',
        borderBottom: `1px solid ${C.border}`,
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: index < 3 ? C.primary : C.muted,
          width: 20,
          textAlign: 'center',
          flexShrink: 0,
        }}>
          {index + 1}
        </span>
        <img
          src={item.productImage}
          alt=""
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            objectFit: 'cover',
            background: C.bg,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 14,
            fontWeight: 600,
            margin: 0,
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            letterSpacing: -0.2,
            color: C.text,
          }}>
            {item.productName}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: C.sub }}>{item.categoryName}</span>
            {item.isRocket && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: C.primary,
                background: C.primaryLight,
                padding: '1px 6px',
                borderRadius: 4,
              }}>
                로켓
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            {item.discountRate > 0 && (
              <span style={{ fontSize: 14, fontWeight: 800, color: C.deal }}>
                {item.discountRate}%
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              {item.productPrice?.toLocaleString()}원
            </span>
            {item.originalPrice > item.productPrice && (
              <span style={{ fontSize: 11, color: C.muted, textDecoration: 'line-through' }}>
                {item.originalPrice?.toLocaleString()}원
              </span>
            )}
          </div>
        </div>
        <a
          href={item.productUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.primary,
            textDecoration: 'none',
            flexShrink: 0,
            padding: '6px 12px',
            borderRadius: 8,
            background: C.primaryLight,
          }}
        >
          보기
        </a>
      </div>
    );
  }

  /* ─── 가이드 섹션 카드 ─────────────────────────── */
  function GuideSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
    return (
      <div style={{
        background: C.card,
        borderRadius: 16,
        margin: '0 16px 16px',
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
      }}>
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ width: 4, height: 18, borderRadius: 2, background: color }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: C.text, letterSpacing: -0.3 }}>{title}</h3>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {children}
        </div>
      </div>
    );
  }

  function Step({ n, text }: { n: number; text: string }) {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
        <span style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          background: C.primaryLight,
          color: C.primary,
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}>
          {n}
        </span>
        <p style={{ fontSize: 13, color: C.sub, margin: 0, lineHeight: 1.55 }}>{text}</p>
      </div>
    );
  }

  function StatusBadge({ status, text }: { status: 'active' | 'soon' | 'ready'; text: string }) {
    const styles = {
      active: { bg: 'rgba(0,196,113,0.08)', color: C.green },
      ready: { bg: C.primaryLight, color: C.primary },
      soon: { bg: 'rgba(255,107,53,0.08)', color: C.deal },
    };
    const s = styles[status];
    return (
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        padding: '3px 8px',
        borderRadius: 5,
      }}>
        {text}
      </span>
    );
  }

  /* ─── 탭 구성 ─────────────────────────── */
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'guide', label: '가이드' },
    { id: 'goldbox', label: '골드박스', count: goldboxData.length },
    { id: 'search', label: '검색', count: searchData.length },
    { id: 'links', label: '링크 등록', count: deeplinkResult.length },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard Variable", system-ui, sans-serif',
      paddingBottom: 40,
    }}>
      {/* 헤더 */}
      <div style={{
        background: C.card,
        borderBottom: `1px solid ${C.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            다있어 <span style={{ color: C.primary }}>Admin</span>
          </h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {(['coupang', 'toss', 'kurly', 'temu'] as const).map(p => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>
        </div>

        {/* 탭 */}
        <div style={{
          maxWidth: 640,
          margin: '0 auto',
          display: 'flex',
          padding: '0 24px',
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '12px 0',
                border: 'none',
                background: 'none',
                fontSize: 13,
                fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? C.primary : C.muted,
                borderBottom: tab === t.id ? `2px solid ${C.primary}` : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {t.label}
              {(t.count ?? 0) > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: tab === t.id ? C.primary : C.border,
                  color: tab === t.id ? '#fff' : C.sub,
                  padding: '1px 6px',
                  borderRadius: 10,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* ━━━ 가이드 탭 ━━━ */}
        {tab === 'guide' && (
          <div style={{ paddingTop: 20 }}>
            {/* 개요 */}
            <div style={{
              margin: '0 16px 20px',
              padding: '20px 24px',
              background: `linear-gradient(135deg, ${C.primary}, #1B6CF2)`,
              borderRadius: 16,
              color: '#fff',
            }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>
                다있어 상품 관리
              </h2>
              <p style={{ fontSize: 13, margin: '8px 0 0', opacity: 0.85, lineHeight: 1.55 }}>
                4개 플랫폼의 제휴 상품을 한 곳에서 관리해요.<br />
                쿠팡은 API로 자동 변환, 나머지는 내 제휴 링크를 바로 등록해요.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {(['coupang', 'toss', 'kurly', 'temu'] as const).map(p => (
                  <span key={p} style={{
                    fontSize: 11,
                    fontWeight: 600,
                    background: 'rgba(255,255,255,0.2)',
                    padding: '4px 10px',
                    borderRadius: 6,
                  }}>
                    {platformInfo[p].name}
                  </span>
                ))}
              </div>
            </div>

            {/* 플랫폼별 현황 */}
            <div style={{
              background: C.card,
              borderRadius: 16,
              margin: '0 16px 16px',
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ padding: '16px 20px 12px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: C.text, letterSpacing: -0.3 }}>
                  플랫폼 현황
                </h3>
              </div>
              {([
                { p: 'coupang' as const, desc: '파트너스 API 연동', status: 'active' as const, statusText: 'API 연동 완료' },
                { p: 'toss' as const, desc: '토스쇼핑 제휴 링크', status: 'ready' as const, statusText: '링크 등록 가능' },
                { p: 'kurly' as const, desc: '컬리 제휴 커머스', status: 'ready' as const, statusText: '링크 등록 가능' },
                { p: 'temu' as const, desc: '테무 제휴 프로그램', status: 'soon' as const, statusText: '준비 중' },
              ]).map(({ p, desc, status, statusText }) => (
                <div key={p} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  borderTop: `1px solid ${C.border}`,
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: platformInfo[p].color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    flexShrink: 0,
                    letterSpacing: -0.5,
                  }}>
                    {platformInfo[p].name.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: C.text }}>{platformInfo[p].name}</p>
                    <p style={{ fontSize: 12, color: C.sub, margin: '2px 0 0' }}>{desc}</p>
                  </div>
                  <StatusBadge status={status} text={statusText} />
                </div>
              ))}
            </div>

            {/* 쿠팡 사용법 */}
            <GuideSection title="쿠팡 파트너스" color={C.coupang}>
              <div style={{ marginBottom: 14 }}>
                <PlatformBadge platform="coupang" size="md" />
                <span style={{ fontSize: 12, color: C.sub, marginLeft: 8 }}>유일하게 API 지원 — URL만 넣으면 내 제휴 링크 자동 생성</span>
              </div>
              <div style={{
                background: C.bg,
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 14,
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>골드박스 (자동 수집)</p>
                <Step n={1} text="골드박스 탭에서 '쿠팡 인기 상품 불러오기' 클릭" />
                <Step n={2} text="쿠팡의 실시간 인기 할인 상품 + 내 제휴 링크가 자동 생성돼요" />
                <Step n={3} text="앱의 '다들 이거 사고 있어요'에 자동 연동" />
              </div>
              <div style={{
                background: C.bg,
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 14,
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>검색 (키워드로 찾기)</p>
                <Step n={1} text="검색 탭에서 키워드 입력 (예: '에어팟', '물티슈')" />
                <Step n={2} text="결과 상품에 내 제휴 링크가 자동으로 붙어 나와요" />
              </div>
              <div style={{
                background: C.bg,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>딥링크 변환 (일반 URL → 내 제휴 링크)</p>
                <Step n={1} text="쿠팡에서 마음에 드는 상품 URL을 복사해요" />
                <Step n={2} text="링크 탭 → 쿠팡 선택 → URL 붙여넣기" />
                <Step n={3} text="내 파트너스 계정의 제휴 링크가 자동 생성돼요" />
                <p style={{ fontSize: 11, color: C.deal, margin: '8px 0 0', fontWeight: 500 }}>
                  * 내 Access Key로 변환하기 때문에 수수료가 내 계정으로 들어와요
                </p>
              </div>
            </GuideSection>

            {/* 토스쇼핑 사용법 */}
            <GuideSection title="토스쇼핑" color={C.toss}>
              <div style={{ marginBottom: 14 }}>
                <PlatformBadge platform="toss" size="md" />
                <span style={{ fontSize: 12, color: C.sub, marginLeft: 8 }}>이미 내 제휴 링크 — 그대로 등록</span>
              </div>
              <div style={{
                background: C.bg,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>사용 방법</p>
                <Step n={1} text="토스쇼핑 제휴 페이지에서 상품 링크를 복사해요 (이미 내 제휴 코드 포함)" />
                <Step n={2} text="링크 탭 → 토스쇼핑 선택 → 그대로 붙여넣기" />
                <Step n={3} text="변환 없이 바로 등록! 토스 앱에서 바로 열려요" />
                <p style={{ fontSize: 11, color: C.green, margin: '8px 0 0', fontWeight: 500, lineHeight: 1.5 }}>
                  * 토스쇼핑 링크는 이미 내 제휴 코드가 포함되어 있어서 변환이 필요 없어요<br />
                  * 토스 앱 안에서 열리기 때문에 전환율이 가장 높아요
                </p>
              </div>
            </GuideSection>

            {/* 컬리 사용법 */}
            <GuideSection title="컬리" color={C.kurly}>
              <div style={{ marginBottom: 14 }}>
                <PlatformBadge platform="kurly" size="md" />
                <span style={{ fontSize: 12, color: C.sub, marginLeft: 8 }}>이미 내 제휴 링크 — 그대로 등록</span>
              </div>
              <div style={{
                background: C.bg,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>사용 방법</p>
                <Step n={1} text="컬리 제휴 페이지(partners.kurly.com)에서 제휴 링크 복사 (이미 내 코드 포함)" />
                <Step n={2} text="링크 탭 → 컬리 선택 → 그대로 붙여넣기" />
                <Step n={3} text="변환 없이 바로 등록! 컬리 앱/웹으로 연결돼요" />
                <p style={{ fontSize: 11, color: C.green, margin: '8px 0 0', fontWeight: 500, lineHeight: 1.5 }}>
                  * 컬리 제휴 링크는 이미 내 코드가 포함되어 있어서 변환이 필요 없어요<br />
                  * 식품/신선식품에 강해서 생활용품 큐레이션에 딱이에요
                </p>
              </div>
            </GuideSection>

            {/* 테무 사용법 */}
            <GuideSection title="테무" color={C.temu}>
              <div style={{ marginBottom: 14 }}>
                <PlatformBadge platform="temu" size="md" />
                <span style={{ fontSize: 12, color: C.sub, marginLeft: 8 }}>이미 내 제휴 링크 — 그대로 등록</span>
              </div>
              <div style={{
                background: C.bg,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>사용 방법</p>
                <Step n={1} text="테무 제휴 프로그램(affiliate.temu.com) 가입 후 승인받기" />
                <Step n={2} text="테무에서 상품 제휴 링크 복사 (이미 내 코드 포함)" />
                <Step n={3} text="링크 탭 → 테무 선택 → 그대로 붙여넣기" />
                <p style={{ fontSize: 11, color: C.green, margin: '8px 0 0', fontWeight: 500, lineHeight: 1.5 }}>
                  * 테무 제휴 링크도 이미 내 코드가 포함되어 있어서 변환 필요 없어요<br />
                  * 수수료율이 5~20%로 가장 높아요
                </p>
              </div>
            </GuideSection>

            {/* 수익 구조 요약 */}
            <div style={{
              margin: '0 16px 20px',
              padding: '20px 24px',
              background: C.card,
              borderRadius: 16,
              border: `1px solid ${C.border}`,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: C.text, letterSpacing: -0.3 }}>
                수익 구조
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([
                  { name: '쿠팡', rate: '3~7%', color: C.coupang },
                  { name: '토스쇼핑', rate: '1~5%', color: C.toss },
                  { name: '컬리', rate: '1~7%', color: C.kurly },
                  { name: '테무', rate: '5~20%', color: C.temu },
                ]).map(({ name, rate, color }) => (
                  <div key={name} style={{
                    padding: '12px 14px',
                    background: C.bg,
                    borderRadius: 10,
                    textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 12, color: C.sub, margin: 0 }}>{name}</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color, margin: '4px 0 0', letterSpacing: -0.5 }}>
                      {rate}
                    </p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: C.muted, margin: '12px 0 0', lineHeight: 1.5, textAlign: 'center' }}>
                사용자가 제휴 링크를 통해 구매하면 수수료가 발생해요
              </p>
            </div>
          </div>
        )}

        {/* ━━━ 골드박스 탭 ━━━ */}
        {tab === 'goldbox' && (
          <div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <PlatformBadge platform="coupang" size="md" />
                <span style={{ fontSize: 13, color: C.sub }}>실시간 인기 할인 상품</span>
              </div>
              <button
                onClick={fetchGoldbox}
                disabled={goldboxLoading}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: goldboxLoading ? C.muted : C.coupang,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: goldboxLoading ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: -0.3,
                }}
              >
                {goldboxLoading ? '불러오는 중...' : '쿠팡 인기 상품 불러오기'}
              </button>
              {goldboxData.length > 0 && (
                <p style={{ fontSize: 12, color: C.sub, marginTop: 10, textAlign: 'center' }}>
                  {goldboxData.length}개 상품 · 앱 '다들 이거 사고 있어요'에 자동 반영
                </p>
              )}
            </div>
            {goldboxData.length > 0 && (
              <div style={{ background: C.card, borderRadius: 16, margin: '0 16px 24px', overflow: 'hidden' }}>
                {goldboxData.map((item, i) => (
                  <ItemCard key={item.productId || i} item={item} index={i} />
                ))}
              </div>
            )}
            {goldboxData.length === 0 && !goldboxLoading && (
              <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '40px 0' }}>
                버튼을 눌러 쿠팡 인기 상품을 불러와 보세요
              </p>
            )}
          </div>
        )}

        {/* ━━━ 검색 탭 ━━━ */}
        {tab === 'search' && (
          <div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <PlatformBadge platform="coupang" size="md" />
                <span style={{ fontSize: 13, color: C.sub }}>쿠팡 상품 검색</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchSearch()}
                  placeholder="검색어를 입력하세요 (예: 에어팟, 물티슈)"
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    fontSize: 14,
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: C.card,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={fetchSearch}
                  disabled={searchLoading}
                  style={{
                    padding: '14px 24px',
                    borderRadius: 12,
                    border: 'none',
                    background: C.primary,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  {searchLoading ? '...' : '검색'}
                </button>
              </div>
            </div>
            {searchData.length > 0 && (
              <div style={{ background: C.card, borderRadius: 16, margin: '0 16px 24px', overflow: 'hidden' }}>
                {searchData.map((item, i) => (
                  <ItemCard key={item.productId || i} item={item} index={i} />
                ))}
              </div>
            )}
            {searchData.length === 0 && keyword && !searchLoading && (
              <p style={{ textAlign: 'center', color: C.muted, fontSize: 14, padding: 40 }}>
                검색 결과가 없어요
              </p>
            )}
          </div>
        )}

        {/* ━━━ 링크 변환 탭 ━━━ */}
        {tab === 'links' && (
          <div style={{ padding: '20px 24px' }}>
            {/* 플랫폼 선택 */}
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
              플랫폼 선택
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['coupang', 'toss', 'kurly', 'temu'] as const).map(p => {
                const active = linkPlatform === p;
                const info = platformInfo[p];
                return (
                  <button
                    key={p}
                    onClick={() => setLinkPlatform(p)}
                    style={{
                      flex: 1,
                      padding: '12px 0',
                      borderRadius: 12,
                      border: active ? `2px solid ${info.color}` : `1px solid ${C.border}`,
                      background: active ? `${info.color}08` : C.card,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: info.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                    }}>
                      {info.name.slice(0, 1)}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: active ? 700 : 500,
                      color: active ? info.color : C.sub,
                    }}>
                      {info.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* URL 입력 */}
            <p style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>
              {linkPlatform === 'coupang'
                ? '쿠팡 일반 URL을 넣으면 내 제휴 링크로 자동 변환돼요 (한 줄에 하나)'
                : `${platformInfo[linkPlatform].name}에서 복사한 내 제휴 링크를 그대로 넣으세요 (한 줄에 하나)`
              }
            </p>
            <textarea
              value={urls}
              onChange={e => setUrls(e.target.value)}
              placeholder={
                linkPlatform === 'coupang'
                  ? 'https://www.coupang.com/vp/products/...\nhttps://www.coupang.com/vp/products/...'
                  : linkPlatform === 'toss'
                  ? 'https://tossshopping.com/products/...'
                  : linkPlatform === 'kurly'
                  ? 'https://www.kurly.com/goods/...'
                  : 'https://www.temu.com/...'
              }
              rows={4}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 13,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: C.card,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={createDeeplink}
              disabled={deeplinkLoading}
              style={{
                width: '100%',
                marginTop: 12,
                padding: '14px 0',
                borderRadius: 12,
                border: 'none',
                background: platformInfo[linkPlatform].color,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {deeplinkLoading
                ? '처리 중...'
                : linkPlatform === 'coupang'
                ? '내 제휴 링크로 변환'
                : `내 ${platformInfo[linkPlatform].name} 링크 등록`
              }
            </button>

            {linkPlatform === 'coupang' ? (
              <p style={{ fontSize: 11, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
                * 쿠팡만 API로 자동 변환이 돼요 (내 파트너스 Access Key 사용)<br />
                * 위 골드박스/검색 탭에서도 자동으로 내 제휴 링크가 생성돼요
              </p>
            ) : (
              <p style={{ fontSize: 11, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
                * {platformInfo[linkPlatform].name} 링크는 이미 내 제휴 코드가 포함되어 있어요<br />
                * 변환 없이 그대로 등록하면 돼요 — 추가 변환하면 추적이 깨질 수 있어요
              </p>
            )}

            {deeplinkResult.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
                  {linkPlatform === 'coupang' ? '내 제휴 링크로 변환 완료' : '등록된 내 제휴 링크'}
                </p>
                {deeplinkResult.map((item, i) => (
                  <div key={i} style={{
                    padding: '14px 16px',
                    background: C.card,
                    borderRadius: 12,
                    marginBottom: 8,
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <PlatformBadge platform={linkPlatform} />
                      <p style={{ fontSize: 11, color: C.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {item.originalUrl}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: platformInfo[linkPlatform].color, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.shortenUrl}
                      </p>
                      <button
                        onClick={() => copyText(item.shortenUrl)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: `${platformInfo[linkPlatform].color}10`,
                          color: platformInfo[linkPlatform].color,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                          fontFamily: 'inherit',
                        }}
                      >
                        복사
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
