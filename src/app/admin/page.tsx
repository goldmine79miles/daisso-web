'use client';

import { useState } from 'react';

const ADMIN_PASSWORD = 'daisso2026';

interface GoldboxItem {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  isRocket: boolean;
  isFreeShipping: boolean;
  categoryName: string;
  originalPrice: number;
  discountRate: number;
}

/* ─── 스타일 상수 ─────────────────────────── */
const colors = {
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
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [tab, setTab] = useState<'goldbox' | 'search' | 'deeplink'>('goldbox');

  const [goldboxData, setGoldboxData] = useState<GoldboxItem[]>([]);
  const [goldboxLoading, setGoldboxLoading] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [searchData, setSearchData] = useState<GoldboxItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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
        background: colors.bg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard Variable", system-ui, sans-serif',
      }}>
        <div style={{
          width: 360,
          padding: 32,
          borderRadius: 20,
          background: colors.card,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
              다있어 <span style={{ color: colors.primary }}>Admin</span>
            </h1>
            <p style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>관리자 비밀번호를 입력해주세요</p>
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
              border: `1px solid ${colors.border}`,
              background: colors.bg,
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
              background: colors.primary,
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
      const res = await fetch('/api/coupang/deeplink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList }),
      });
      const json = await res.json();
      setDeeplinkResult(json.data || []);
    } catch (e) {
      alert('딥링크 생성 실패: ' + e);
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

  /* ─── 상품 카드 ─────────────────────────── */
  function ItemCard({ item, index }: { item: GoldboxItem; index: number }) {
    return (
      <div style={{
        display: 'flex',
        gap: 16,
        padding: '18px 20px',
        borderBottom: `1px solid ${colors.border}`,
        alignItems: 'center',
        transition: 'background 0.1s',
      }}>
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: index < 3 ? colors.primary : colors.muted,
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
            background: colors.bg,
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
            color: colors.text,
          }}>
            {item.productName}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: colors.sub }}>{item.categoryName}</span>
            {item.isRocket && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: colors.primary,
                background: colors.primaryLight,
                padding: '1px 6px',
                borderRadius: 4,
              }}>
                로켓
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            {item.discountRate > 0 && (
              <span style={{ fontSize: 14, fontWeight: 800, color: colors.deal }}>
                {item.discountRate}%
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>
              {item.productPrice?.toLocaleString()}원
            </span>
            {item.originalPrice > item.productPrice && (
              <span style={{ fontSize: 11, color: colors.muted, textDecoration: 'line-through' }}>
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
            color: colors.primary,
            textDecoration: 'none',
            flexShrink: 0,
            padding: '6px 12px',
            borderRadius: 8,
            background: colors.primaryLight,
          }}
        >
          보기
        </a>
      </div>
    );
  }

  /* ─── 탭 구성 ─────────────────────────── */
  const tabs = [
    { id: 'goldbox' as const, label: 'Goldbox 인기', count: goldboxData.length },
    { id: 'search' as const, label: '상품 검색', count: searchData.length },
    { id: 'deeplink' as const, label: '딥링크 변환', count: deeplinkResult.length },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard Variable", system-ui, sans-serif',
    }}>
      {/* 헤더 */}
      <div style={{
        background: colors.card,
        borderBottom: `1px solid ${colors.border}`,
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
            다있어 <span style={{ color: colors.primary }}>Admin</span>
          </h1>
          <span style={{ fontSize: 12, color: colors.muted }}>daitsso.shop</span>
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
                color: tab === t.id ? colors.primary : colors.muted,
                borderBottom: tab === t.id ? `2px solid ${colors.primary}` : '2px solid transparent',
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
              {t.count > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: tab === t.id ? colors.primary : colors.border,
                  color: tab === t.id ? '#fff' : colors.sub,
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

        {/* Goldbox */}
        {tab === 'goldbox' && (
          <div>
            <div style={{ padding: '20px 24px' }}>
              <button
                onClick={fetchGoldbox}
                disabled={goldboxLoading}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: goldboxLoading ? colors.muted : colors.primary,
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
                <p style={{ fontSize: 12, color: colors.sub, marginTop: 10, textAlign: 'center' }}>
                  {goldboxData.length}개 상품
                </p>
              )}
            </div>
            <div style={{ background: colors.card, borderRadius: 16, margin: '0 16px 24px', overflow: 'hidden' }}>
              {goldboxData.map((item, i) => (
                <ItemCard key={item.productId || i} item={item} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* 검색 */}
        {tab === 'search' && (
          <div>
            <div style={{ padding: '20px 24px', display: 'flex', gap: 8 }}>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchSearch()}
                placeholder="검색어를 입력하세요"
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  fontSize: 14,
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
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
                  background: colors.primary,
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
            {searchData.length > 0 && (
              <div style={{ background: colors.card, borderRadius: 16, margin: '0 16px 24px', overflow: 'hidden' }}>
                {searchData.map((item, i) => (
                  <ItemCard key={item.productId || i} item={item} index={i} />
                ))}
              </div>
            )}
            {searchData.length === 0 && keyword && !searchLoading && (
              <p style={{ textAlign: 'center', color: colors.muted, fontSize: 14, padding: 40 }}>
                검색 결과가 없어요
              </p>
            )}
          </div>
        )}

        {/* 딥링크 */}
        {tab === 'deeplink' && (
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: 13, color: colors.sub, marginBottom: 10 }}>
              쿠팡 URL을 한 줄에 하나씩 입력하세요 (최대 20개)
            </p>
            <textarea
              value={urls}
              onChange={e => setUrls(e.target.value)}
              placeholder={'https://www.coupang.com/vp/products/...\nhttps://www.coupang.com/vp/products/...'}
              rows={4}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 13,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                background: colors.card,
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
                background: colors.primary,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {deeplinkLoading ? '생성 중...' : '제휴 링크 생성'}
            </button>

            {deeplinkResult.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 10 }}>
                  생성된 제휴 링크
                </p>
                {deeplinkResult.map((item, i) => (
                  <div key={i} style={{
                    padding: '14px 16px',
                    background: colors.card,
                    borderRadius: 12,
                    marginBottom: 8,
                    border: `1px solid ${colors.border}`,
                  }}>
                    <p style={{ fontSize: 11, color: colors.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.originalUrl}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: colors.primary, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.shortenUrl}
                      </p>
                      <button
                        onClick={() => copyText(item.shortenUrl)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: colors.primaryLight,
                          color: colors.primary,
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
