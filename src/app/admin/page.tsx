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
  categoryName: string;
  originalPrice: number;
  discountRate: number;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [tab, setTab] = useState<'goldbox' | 'search' | 'deeplink'>('goldbox');

  // Goldbox
  const [goldboxData, setGoldboxData] = useState<GoldboxItem[]>([]);
  const [goldboxLoading, setGoldboxLoading] = useState(false);

  // Search
  const [keyword, setKeyword] = useState('');
  const [searchData, setSearchData] = useState<GoldboxItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Deeplink
  const [urls, setUrls] = useState('');
  const [deeplinkResult, setDeeplinkResult] = useState('');

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', padding: 20, fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>다있어 어드민</h1>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="비밀번호"
          onKeyDown={e => e.key === 'Enter' && pw === ADMIN_PASSWORD && setAuthed(true)}
          style={{ width: '100%', padding: 12, fontSize: 16, borderRadius: 8, border: '1px solid #ddd' }}
        />
        <button
          onClick={() => pw === ADMIN_PASSWORD && setAuthed(true)}
          style={{ width: '100%', marginTop: 10, padding: 12, fontSize: 16, borderRadius: 8, border: 'none', background: '#3182F6', color: '#fff', cursor: 'pointer' }}
        >
          로그인
        </button>
      </div>
    );
  }

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
    try {
      const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
      const res = await fetch('/api/coupang/deeplink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList }),
      });
      const json = await res.json();
      setDeeplinkResult(JSON.stringify(json, null, 2));
    } catch (e) {
      alert('딥링크 생성 실패: ' + e);
    }
  }

  function ProductCard({ item }: { item: GoldboxItem }) {
    return (
      <div style={{
        display: 'flex', gap: 14, padding: 16, borderBottom: '1px solid #eee', alignItems: 'center',
      }}>
        <img
          src={item.productImage}
          alt={item.productName}
          style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', background: '#f5f5f5' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
            {item.productName}
          </p>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
            {item.categoryName} {item.isRocket ? '🚀 로켓배송' : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 6 }}>
            {item.discountRate > 0 && (
              <span style={{ fontSize: 15, fontWeight: 800, color: '#FF6B35' }}>
                {item.discountRate}%
              </span>
            )}
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {item.productPrice?.toLocaleString()}원
            </span>
            {item.originalPrice > item.productPrice && (
              <span style={{ fontSize: 12, color: '#aaa', textDecoration: 'line-through' }}>
                {item.originalPrice?.toLocaleString()}원
              </span>
            )}
          </div>
        </div>
        <a
          href={item.productUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: '#3182F6', textDecoration: 'none', flexShrink: 0 }}
        >
          링크 →
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', fontFamily: 'system-ui' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>다있어 어드민</h1>
        <span style={{ fontSize: 12, color: '#888' }}>daitsso.shop</span>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
        {(['goldbox', 'search', 'deeplink'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'none', fontSize: 14,
              fontWeight: tab === t ? 700 : 400,
              color: tab === t ? '#3182F6' : '#888',
              borderBottom: tab === t ? '2px solid #3182F6' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {t === 'goldbox' ? 'Goldbox 인기' : t === 'search' ? '상품 검색' : '딥링크 변환'}
          </button>
        ))}
      </div>

      {/* Goldbox 탭 */}
      {tab === 'goldbox' && (
        <div>
          <div style={{ padding: 16 }}>
            <button
              onClick={fetchGoldbox}
              disabled={goldboxLoading}
              style={{
                width: '100%', padding: 12, borderRadius: 10, border: 'none',
                background: '#3182F6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {goldboxLoading ? '불러오는 중...' : '인기 상품 불러오기'}
            </button>
          </div>
          <p style={{ padding: '0 16px', fontSize: 13, color: '#888' }}>
            {goldboxData.length > 0 ? `${goldboxData.length}개 상품` : '버튼을 눌러 쿠팡 Goldbox 인기 상품을 확인하세요'}
          </p>
          {goldboxData.map((item, i) => (
            <ProductCard key={item.productId || i} item={item} />
          ))}
        </div>
      )}

      {/* 검색 탭 */}
      {tab === 'search' && (
        <div>
          <div style={{ padding: 16, display: 'flex', gap: 8 }}>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="검색어 입력"
              onKeyDown={e => e.key === 'Enter' && fetchSearch()}
              style={{ flex: 1, padding: 12, fontSize: 14, borderRadius: 10, border: '1px solid #ddd' }}
            />
            <button
              onClick={fetchSearch}
              disabled={searchLoading}
              style={{
                padding: '12px 20px', borderRadius: 10, border: 'none',
                background: '#3182F6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}
            >
              {searchLoading ? '...' : '검색'}
            </button>
          </div>
          {searchData.map((item, i) => (
            <ProductCard key={item.productId || i} item={item} />
          ))}
        </div>
      )}

      {/* 딥링크 탭 */}
      {tab === 'deeplink' && (
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
            쿠팡 URL을 한 줄에 하나씩 입력하세요 (최대 20개)
          </p>
          <textarea
            value={urls}
            onChange={e => setUrls(e.target.value)}
            placeholder="https://www.coupang.com/np/search?q=에어팟"
            rows={5}
            style={{ width: '100%', padding: 12, fontSize: 13, borderRadius: 10, border: '1px solid #ddd', resize: 'vertical' }}
          />
          <button
            onClick={createDeeplink}
            style={{
              width: '100%', marginTop: 10, padding: 12, borderRadius: 10, border: 'none',
              background: '#3182F6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            제휴 링크 생성
          </button>
          {deeplinkResult && (
            <pre style={{
              marginTop: 16, padding: 12, borderRadius: 10, background: '#f5f5f5',
              fontSize: 12, overflow: 'auto', maxHeight: 300, whiteSpace: 'pre-wrap',
            }}>
              {deeplinkResult}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
