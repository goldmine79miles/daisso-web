'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 드래그앤드롭 가능한 상품 행 래퍼 — 모바일 터치 + 데스크탑 마우스 + 키보드 지원
function SortableProductRow({
  id,
  children,
}: {
  id: number;
  children: (handle: { attributes: React.HTMLAttributes<HTMLElement>; listeners: React.DOMAttributes<HTMLElement>; isDragging: boolean }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
    background: isDragging ? '#f0f7ff' : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes: attributes as React.HTMLAttributes<HTMLElement>, listeners: (listeners || {}) as React.DOMAttributes<HTMLElement>, isDragging })}
    </div>
  );
}

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';

// CDN 이미지 프록시 (CloudFront 차단 우회)
function proxyImg(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.includes('d13k46lqgoj3d6.cloudfront.net') || url.includes('image.inpock.co.kr')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
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
  red: '#E53935',
  coupang: '#E4002B',
  toss: '#3182F6',
  kurly: '#5F0080',
  temu: '#FB7701',
};

const PLATFORMS = [
  { id: 'coupang', name: '쿠팡', color: C.coupang },
  { id: 'toss', name: '토스쇼핑', color: C.toss },
  { id: 'kurly', name: '컬리', color: C.kurly },
  { id: 'temu', name: '테무', color: C.temu },
];

const CATEGORIES = [
  { id: 'all', name: '전체' },
  { id: 'living', name: '생활' },
  { id: 'kitchen', name: '주방' },
  { id: 'furniture', name: '가구' },
  { id: 'interior', name: '인테리어' },
  { id: 'food', name: '식품' },
  { id: 'electronics', name: '전자기기' },
  { id: 'fashion', name: '패션' },
  { id: 'beauty', name: '뷰티' },
  { id: 'baby', name: '육아' },
  { id: 'sports', name: '스포츠' },
  { id: 'pet', name: '반려동물' },
  { id: 'car', name: '차량용품' },
  { id: 'hobby', name: '취미' },
];

const SECTIONS = [
  { id: 'ranking', name: '랭킹', desc: '다들 이거 사고 있어요' },
  { id: 'recommend', name: '추천', desc: '추천 상품' },
  { id: 'deal', name: '득템', desc: '할인 탭' },
];

interface Product {
  id: number;
  title: string;
  image_url: string | null;
  affiliate_url: string;
  platform: string;
  category: string;
  section: string;
  sale_price: number;
  original_price: number;
  discount_rate: number;
  sort_order: number;
  is_active: boolean;
  pinned?: boolean;
  ranked_at?: string | null;
  view_count?: number;
  rating?: number;
  review_count?: number;
  review_highlights?: string[] | string | null;
}

interface GoldboxItem {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  isRocket?: boolean;
  categoryName: string;
  originalPrice: number;
  discountRate: number;
}

type TabId = 'products' | 'register' | 'sns' | 'goldbox' | 'search' | 'categories';
type SnsSubTab = 'discover' | 'influencer';
type SearchSource = 'coupang' | 'naver';
type SectionId = 'ranking' | 'recommend' | 'deal';

interface Influencer {
  id: number;
  name: string;
  platform: string;
  profile_url: string;
  inpock_url: string;
  memo: string;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
}

interface ScrapedItem {
  title: string;
  url: string;
  image?: string;
  platform?: string;
}

interface Suggestion {
  source: 'coupang' | 'influencer';
  title: string;
  url: string;
  image?: string;
  price?: number;
  discount?: number;
  influencerName?: string;
}

interface SnsResult {
  platform: string;
  url: string;
  title: string;
  description: string;
  image: string;
  keywords: string[];
}

interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  sort_order: number;
  is_active: boolean;
}

export default function AdminPage() {
  // SSR 하이드레이션 안정 — 초기엔 false, 마운트 후 스토리지 읽음
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persisted = localStorage.getItem('admin_auth') === 'true' || sessionStorage.getItem('admin_auth') === 'true';
    // 자동로그인 상태여도 sessionStorage 토큰이 없으면 mutation API 전부 401 뜸 → 재로그인 강제
    const hasToken = !!sessionStorage.getItem('admin_token');
    if (persisted && !hasToken) {
      localStorage.removeItem('admin_auth');
      sessionStorage.removeItem('admin_auth');
      setAuthed(false);
    } else {
      setAuthed(persisted);
    }
    setAuthChecked(true);
  }, []);

  // 어드민 fetch 래퍼 — /api/ 호출에 sessionStorage 토큰을 Bearer로 자동 첨부
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const original = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith('/api/') && !url.startsWith('/api/proxy-image') && !url.startsWith('/api/toss-auth') && !url.startsWith('/api/toss-disconnect')) {
        const token = sessionStorage.getItem('admin_token') || '';
        if (token) {
          init.headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
        }
      }
      return original(input as any, init);
    }) as typeof window.fetch;
    return () => { window.fetch = original; };
  }, []);
  const [pw, setPw] = useState('');
  const [tab, setTab] = useState<TabId>('products');
  const [snsSubTab, setSnsSubTab] = useState<SnsSubTab>('discover');
  const [searchSource, setSearchSource] = useState<SearchSource>('coupang');
  const [goldboxSection, setGoldboxSection] = useState<SectionId>('ranking');

  // 상품 관리
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [filterSection, setFilterSection] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<{ checked: number; issues: number; healthy: number; results: { id: number; title: string; issue: string; action: string; severity: string }[]; checkedAt: string } | null>(null);

  // @dnd-kit 센서 — 마우스 8px 이동으로 드래그 시작 (버튼 클릭과 구분), 터치 250ms 홀드
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // 자동 셔플 설정
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [shuffleHours, setShuffleHours] = useState(2);
  const [shuffleSaving, setShuffleSaving] = useState(false);

  // 설정 로드
  useEffect(() => {
    if (!authed) return;
    fetch('/api/settings').then(r => r.json()).then(j => {
      if (j?.data) {
        setShuffleEnabled(j.data.shuffle_enabled);
        setShuffleHours(j.data.shuffle_interval_hours);
      }
    }).catch(() => {});
  }, [authed]);

  async function saveShuffleSettings(enabled: boolean, hours: number) {
    setShuffleSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shuffle_enabled: enabled, shuffle_interval_hours: hours }),
      });
      // 설정 바뀌면 상품 리스트도 새로 받아야 순서 반영
      loadProducts();
    } finally {
      setShuffleSaving(false);
    }
  }

  async function handleDndDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = filteredProducts.findIndex(p => p.id === active.id);
    const newIdx = filteredProducts.findIndex(p => p.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const newList = arrayMove(filteredProducts, oldIdx, newIdx);
    // 낙관적 UI 즉시 반영 (서버 재조회 안 함 — 깜빡임 방지)
    applyOptimisticOrder(newList);
    // 서버는 fire-and-forget 동기화
    const orders = newList.map((item, i) => ({ id: item.id, sort_order: i }));
    fetch('/api/products/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    }).catch(() => loadProducts()); // 실패 시에만 재조회
  }

  /** 필터링된 목록 순서를 products 배열에 즉시 반영 */
  function applyOptimisticOrder(newList: Product[]) {
    const sectionIds = new Set(newList.map(x => x.id));
    let cursor = 0;
    setProducts(prev => prev.map(p => {
      if (!sectionIds.has(p.id)) return p;
      return newList[cursor++];
    }));
  }

  /**
   * 셔플 — 서버에서 원자적으로 실행 (DB 순서 변경 + shuffle_bucket 기록).
   * 다음 자동 셔플 bucket 경계까지 이 순서 유지됨.
   */
  async function shuffleFilteredProducts() {
    const nonRanking = filteredProducts.filter(p => p.section !== 'ranking');
    if (nonRanking.length < 2) return;
    if (!confirm(`TOP5(랭킹) 제외한 ${nonRanking.length}개 상품을 무작위로 섞을까요?\n프론트에도 즉시 반영됩니다.`)) return;
    try {
      const res = await fetch('/api/products/shuffle-now', { method: 'POST' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      // 서버 셔플 완료 → 최신 순서 재조회
      loadProducts();
    } catch (e) {
      alert('셔플 실패: ' + String(e));
    }
  }

  // 상품 등록
  const [form, setForm] = useState({
    title: '',
    image_url: '',
    affiliate_url: '',
    platform: 'coupang',
    category: 'all',
    section: 'recommend',
    sale_price: '',
    original_price: '',
    discount_rate: '',
    rating: '',
    review_count: '',
    reviews_raw: '',
    review1: '',
    review2: '',
    review3: '',
  });
  const [aiSummarizing, setAiSummarizing] = useState(false);
  const [editReviewsRaw, setEditReviewsRaw] = useState('');
  const [editAiSummarizing, setEditAiSummarizing] = useState(false);
  const [scrapeReviewsRaw, setScrapeReviewsRaw] = useState('');
  const [saving, setSaving] = useState(false);

  // 수정 모달
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Goldbox
  const [goldboxData, setGoldboxData] = useState<GoldboxItem[]>([]);
  const [goldboxLoading, setGoldboxLoading] = useState(false);

  // Search
  const [keyword, setKeyword] = useState('');
  const [searchData, setSearchData] = useState<GoldboxItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // 인플루언서
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [infLoading, setInfLoading] = useState(false);
  const [infForm, setInfForm] = useState({ name: '', inpock_url: '', profile_url: '', memo: '' });
  const [infSaving, setInfSaving] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ linkType: string; shoppingItems: ScrapedItem[]; allItems: ScrapedItem[] } | null>(null);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [expandedInfId, setExpandedInfId] = useState<number | null>(null);
  const [editingInfId, setEditingInfId] = useState<number | null>(null);
  const [editInfForm, setEditInfForm] = useState({ name: '', inpock_url: '', profile_url: '', memo: '' });

  // 스크래핑 등록 폼
  const [scrapeRegItem, setScrapeRegItem] = useState<{ title: string; url: string; image: string; platform: string } | null>(null);
  const [quickSection, setQuickSection] = useState<'ranking' | 'recommend' | 'deal'>('deal');
  const [scrapeRegForm, setScrapeRegForm] = useState<{ sale_price: string; original_price: string; discount_rate: string; section: string; category: string; review1: string; review2: string; review3: string; rating: string; review_count: string }>({ sale_price: '', original_price: '', discount_rate: '', section: 'recommend', category: 'all', review1: '', review2: '', review3: '', rating: '', review_count: '' });
  // SSR 하이드레이션 안정 — 마운트 후 draft 로드
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem('scrapeRegForm_draft');
      if (saved) setScrapeRegForm(f => ({ ...f, ...JSON.parse(saved) }));
    } catch {}
  }, []);
  // 폼 변경 시 sessionStorage 자동저장 (창 전환 시 유지)
  useEffect(() => {
    if (scrapeRegItem) {
      try { sessionStorage.setItem('scrapeRegForm_draft', JSON.stringify(scrapeRegForm)); } catch {}
    }
  }, [scrapeRegForm, scrapeRegItem]);
  const [matchedProduct, setMatchedProduct] = useState<{ name: string; image: string; url: string; price: number; originalPrice: number; discount: number } | null>(null);
  const [resolvedCoupangUrl, setResolvedCoupangUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // 대체 추천
  const [suggestProductId, setSuggestProductId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // 상품 등록 탭 — Partners API로 검색해서 등록
  const [regSearchKw, setRegSearchKw] = useState('');
  const [regSearchResults, setRegSearchResults] = useState<GoldboxItem[]>([]);
  const [regSearching, setRegSearching] = useState(false);

  // 카테고리 관리
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatForm, setEditCatForm] = useState({ slug: '', name: '', emoji: '' });

  // SNS
  const [snsUrl, setSnsUrl] = useState('');
  const [snsResult, setSnsResult] = useState<SnsResult | null>(null);
  const [snsLoading, setSnsLoading] = useState(false);
  const [snsSearchResults, setSnsSearchResults] = useState<GoldboxItem[]>([]);
  const [snsSearchLoading, setSnsSearchLoading] = useState(false);
  const [snsSelectedKeyword, setSnsSelectedKeyword] = useState('');

  /* ─── 데이터 로딩 ─────────────────────────── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!authed) return;
    (async () => {
      setProductsLoading(true);
      try {
        const res = await fetch('/api/products?active=all');
        const json = await res.json();
        setProducts(json.data || []);
      } catch {
        await fetch('/api/db/init', { method: 'POST' });
        setProducts([]);
      }
      setProductsLoading(false);
    })();
  }, [authed]);

  /* ─── 조기 리턴 전에 선언 필수 훅들 (hook order 안정) ─────────────────────────── */
  const [regSearchMessage, setRegSearchMessage] = useState('');

  const loadInfluencers = useCallback(async () => {
    setInfLoading(true);
    try {
      const res = await fetch('/api/influencers');
      const json = await res.json();
      setInfluencers(json.data || []);
    } catch { setInfluencers([]); }
    setInfLoading(false);
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await fetch('/api/categories?active=all');
      const json = await res.json();
      setCategoryRows(json.data || []);
    } catch {
      setCategoryRows([]);
    }
    setCategoriesLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (authed && tab === 'sns' && snsSubTab === 'influencer') loadInfluencers(); }, [authed, tab, snsSubTab]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (authed && tab === 'categories') loadCategories(); }, [authed, tab]);

  /* ─── 로그인 ─────────────────────────── */
  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard Variable", system-ui, sans-serif',
      }}>
        <div style={{ width: 360, padding: 32, borderRadius: 20, background: C.card, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              다있어 <span style={{ color: C.primary }}>Admin</span>
            </h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>관리자 비밀번호를 입력해주세요</p>
          </div>
          <form onSubmit={e => {
            e.preventDefault();
            if (pw === ADMIN_PASSWORD) {
              localStorage.setItem('admin_auth', 'true');
              sessionStorage.setItem('admin_token', pw); // 서버 mutation API Bearer 토큰
              setAuthed(true);
            } else {
              alert('비밀번호가 일치하지 않아요');
            }
          }}>
            {/* 브라우저 자동채움 힌트용 숨김 아이디 — Face ID/iCloud 키체인 트리거 */}
            <input type="text" name="username" autoComplete="username" defaultValue="daisso-admin" readOnly tabIndex={-1} aria-hidden="true"
              style={{ position: 'absolute', opacity: 0, height: 0, width: 0, border: 0 }} />
            <input type="password" name="password" autoComplete="current-password"
              value={pw} onChange={e => setPw(e.target.value)}
              placeholder="비밀번호" autoFocus
              style={{ width: '100%', padding: '14px 16px', fontSize: 15, borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <button type="submit"
              style={{ width: '100%', marginTop: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, borderRadius: 12, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              로그인
            </button>
          </form>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 14, textAlign: 'center', lineHeight: 1.5 }}>
            브라우저 비번 저장하면 다음부터 Face ID / Touch ID로 자동 입력돼요
          </p>
        </div>
      </div>
    );
  }

  async function loadProducts() {
    setProductsLoading(true);
    try {
      const res = await fetch('/api/products?active=all');
      const json = await res.json();
      setProducts(json.data || []);
    } catch {
      await fetch('/api/db/init', { method: 'POST' });
      setProducts([]);
    }
    setProductsLoading(false);
  }

  /* ─── 상품 CRUD ─────────────────────────── */
  async function saveProduct() {
    if (!form.title.trim() || !form.affiliate_url.trim()) {
      alert('제목과 링크는 필수예요!');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sale_price: Number(form.sale_price) || 0,
          original_price: Number(form.original_price) || 0,
          discount_rate: Number(form.discount_rate) || 0,
          rating: Number(form.rating) || 0,
          review_count: Number(form.review_count) || 0,
          review_highlights: [form.review1, form.review2, form.review3].map(r => r.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (json.data) {
        setForm({ title: '', image_url: '', affiliate_url: '', platform: 'coupang', category: 'all', section: 'recommend', sale_price: '', original_price: '', discount_rate: '', rating: '', review_count: '', reviews_raw: '', review1: '', review2: '', review3: '' });
        await loadProducts();
        alert(`✅ "${(json.data.title || '').slice(0, 30)}" 등록 완료!\n앱/웹에 바로 반영됐어요.`);
        setTab('products');
      } else {
        alert('등록 실패: ' + (json.error || '알 수 없는 오류'));
      }
    } catch (e) {
      alert('등록 실패: ' + e);
    }
    setSaving(false);
  }

  async function updateProduct(p: Product) {
    try {
      // review_highlights 배열을 그대로 JSON으로 전송 (API가 배열 받음)
      const highlights = Array.isArray(p.review_highlights)
        ? p.review_highlights.map(h => String(h || '').trim()).filter(Boolean)
        : [];
      await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, review_highlights: highlights, rating: p.rating ?? 0, review_count: p.review_count ?? 0 }),
      });
      loadProducts();
      setEditProduct(null);
      setEditReviewsRaw('');
      alert(`✅ "${p.title.slice(0, 30)}" 수정 완료!`);
    } catch (e) {
      alert('수정 실패: ' + e);
    }
  }

  async function deleteProduct(id: number) {
    if (!confirm('정말 삭제할까요?')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      loadProducts();
    } catch (e) {
      alert('삭제 실패: ' + e);
    }
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/products/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    loadProducts();
  }

  async function moveOrder(p: Product, direction: 'up' | 'down') {
    const sameSection = filteredProducts;
    const idx = sameSection.findIndex(x => x.id === p.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameSection.length) return;

    // 낙관적 UI: 두 아이템 위치 스왑 후 즉시 반영
    const swapped = [...sameSection];
    [swapped[idx], swapped[swapIdx]] = [swapped[swapIdx], swapped[idx]];
    applyOptimisticOrder(swapped);

    // 서버 동기화 — fire-and-forget
    const orders = swapped.map((item, i) => ({ id: item.id, sort_order: i }));
    fetch('/api/products/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    }).catch(() => loadProducts());
  }


  // 골드박스에서 바로 등록
  async function addFromGoldbox(item: GoldboxItem, section: SectionId = 'ranking') {
    setSaving(true);
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.productName,
          image_url: item.productImage,
          affiliate_url: item.productUrl,
          platform: 'coupang',
          category: 'all',
          section,
          sale_price: item.productPrice,
          original_price: item.originalPrice,
          discount_rate: item.discountRate,
        }),
      });
      loadProducts();
      const sectionLabel = SECTIONS.find(s => s.id === section)?.name || section;
      alert(`"${item.productName.slice(0, 20)}..." ${sectionLabel}에 등록했어요!`);
    } catch (e) {
      alert('등록 실패: ' + e);
    }
    setSaving(false);
  }

  // 인플루언서 스크래핑에서 등록 — 쿠팡이면 내 딥링크로 변환
  // 스크래핑 등록 — 1단계: 폼 열기
  // 상품명 키워드 기반 자동 카테고리 감지
  function autoDetectCategory(title: string): string {
    const t = title.toLowerCase();
    // 전자기기
    if (/이어폰|블루투스|충전|케이블|보조배터리|스피커|키보드|마우스|태블릿|모니터|노트북|usb|led|스마트워치|헤드셋|리모컨|어댑터/.test(t)) return 'electronics';
    // 식품
    if (/과자|라면|음료|커피|차|닭가슴살|견과|간식|초콜릿|젤리|비타민|프로틴|영양|홍삼|유산균|오메가|밀키트|소스|양념/.test(t)) return 'food';
    // 뷰티
    if (/화장|립|파운데이션|스킨|로션|세럼|선크림|마스크팩|샴푸|린스|바디워시|클렌징|향수|네일|아이크림|톤업|미스트/.test(t)) return 'beauty';
    // 패션
    if (/티셔츠|바지|원피스|자켓|코트|양말|속옷|모자|가방|신발|슬리퍼|벨트|지갑|운동화|맨투맨|후드/.test(t)) return 'fashion';
    // 육아
    if (/기저귀|젖병|유모차|아기|유아|이유식|장난감|놀이|키즈/.test(t)) return 'baby';
    // 건강
    if (/마사지|안마|체중계|혈압|온열|찜질|스트레칭|요가|필라테스|건강/.test(t)) return 'health';
    // 반려동물
    if (/강아지|고양이|사료|간식|펫|반려|배변|목줄|하네스/.test(t)) return 'pet';
    // 스포츠
    if (/운동|헬스|덤벨|런닝|등산|캠핑|자전거|수영|골프|텐트/.test(t)) return 'sports';
    // 주방
    if (/냄비|프라이팬|후라이팬|도마|식기|그릇|컵|텀블러|밥솥|믹서|주걱|수저|접시|칼|국자|주방|행주|수세미|밀폐용기|보관용기|조리도구|오븐|전자레인지|인덕션|가스레인지|토스터/.test(t)) return 'kitchen';
    // 가구
    if (/소파|침대|매트리스|책상|의자|식탁|옷장|서랍|수납장|책장|선반|스툴|화장대|거실장|콘솔|협탁|행거/.test(t)) return 'furniture';
    // 인테리어
    if (/액자|조명|커튼|블라인드|러그|카펫|쿠션|화분|포스터|벽지|인테리어|무드등|디퓨저|캔들|오브제|장식|플랜트/.test(t)) return 'interior';
    // 생활 (가장 넓은 범위 — 디폴트 전에)
    if (/청소|세탁|수납|정리|욕실|빨래|걸레|휴지|물티슈|방향제|제습|선풍기|에어컨|가습기|매트/.test(t)) return 'living';
    return 'all';
  }

  function openScrapeReg(
    title: string, url: string, image: string, platform: string,
    defaultSection: string = 'recommend',
    prices?: { sale_price?: number; original_price?: number; discount_rate?: number }
  ) {
    if (!url.includes('coupang.com') && !url.includes('coupa.ng')) {
      alert(`⚠️ 쿠팡 외 링크(${platform})는 자동 등록 불가해요.\n쿠팡에서 같은 상품을 검색해서 등록하세요.`);
      return;
    }
    const autoCategory = autoDetectCategory(title);
    const sp = Number(prices?.sale_price) || 0;
    const op = Number(prices?.original_price) || 0;
    let dr = Number(prices?.discount_rate) || 0;
    if (!dr && op > sp && sp > 0) dr = Math.round((1 - sp / op) * 100);
    setScrapeRegItem({ title, url, image, platform });
    setScrapeRegForm({
      sale_price: sp ? String(sp) : '',
      original_price: op ? String(op) : (sp ? String(sp) : ''),
      discount_rate: dr ? String(dr) : '',
      section: defaultSection,
      category: autoCategory,
      review1: '', review2: '', review3: '',
      rating: '', review_count: '',
    });
    setMatchedProduct(null);
    setScrapeReviewsRaw('');
  }

  // 스크래핑 등록 — 실제 쿠팡 상품 정보 조회 (리다이렉트 따라가서 정확한 상품)
  async function lookupProduct() {
    if (!scrapeRegItem) return;
    setResolving(true);
    try {
      const res = await fetch('/api/coupang/product-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: scrapeRegItem.url,
          // 유저가 입력한 제목 제공 → 파트너스 검색 API로 productId 매칭
          title: scrapeRegItem.title !== '로딩중...' ? scrapeRegItem.title : '',
        }),
      });
      const json = await res.json();
      const d = json?.data;
      if (d) {
        // 가격 자동 채움
        setScrapeRegForm(f => ({
          ...f,
          sale_price: String(d.salePrice || ''),
          original_price: String(d.originalPrice || d.salePrice || ''),
          discount_rate: String(d.discountRate || ''),
        }));
        // 매칭 정보 표시
        setMatchedProduct({
          name: d.title || '',
          image: d.image || '',
          url: d.productUrl || '',
          price: d.salePrice || 0,
          originalPrice: d.originalPrice || 0,
          discount: d.discountRate || 0,
        });
        setResolvedCoupangUrl(d.productUrl || null);
        // 이미지도 쿠팡 실제 이미지로 교체
        if (d.image) {
          setScrapeRegItem(prev => prev ? { ...prev, image: d.image, title: d.title || prev.title } : prev);
        }
      } else {
        alert(json?.error || '상품 정보를 가져올 수 없어요.');
      }
    } catch {
      alert('상품 조회 실패');
    }
    setResolving(false);
  }

  // 스크래핑 등록 — 2단계: 확정
  async function confirmScrapeReg() {
    if (!scrapeRegItem) return;
    setSaving(true);
    try {
      // 이미 파트너스 링크면 그대로 사용
      // - coupa.ng 축약, link.coupang.com/a/ 축약
      // - link.coupang.com/re/...?lptag=AF6507576 (Partners Search API 리턴 형태)
      // - 기타 내 lptag 포함된 URL
      const MY_PARTNER_TAG_EARLY = 'AF6507576';
      const isAlreadyPartners = scrapeRegItem.url.includes('coupa.ng') ||
                                scrapeRegItem.url.startsWith('https://link.coupang.com/a/') ||
                                scrapeRegItem.url.includes(`lptag=${MY_PARTNER_TAG_EARLY}`);
      let myLink = '';
      let landingUrl = '';
      if (isAlreadyPartners) {
        myLink = scrapeRegItem.url;
        // 검증을 위해 landingUrl 추출 (best-effort) — 실패해도 진행
        landingUrl = scrapeRegItem.url;
      } else {
        // 딥링크 변환 — 리다이렉트 해석 후 내 파트너스 링크로 변환
        const dlRes = await fetch('/api/coupang/deeplink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: [scrapeRegItem.url] }),
        });
        const dlJson = await dlRes.json();
        myLink = dlJson?.data?.[0]?.shortenUrl || '';
        landingUrl = dlJson?.data?.[0]?.landingUrl || '';
        if (!myLink) {
          const errMsg = dlJson?.rMessage || dlJson?.error || JSON.stringify(dlJson).slice(0, 200);
          alert(`딥링크 변환 실패\n\n응답: ${errMsg}\n\nURL: ${scrapeRegItem.url.slice(0, 100)}`);
          setSaving(false);
          return;
        }
      }

      // ── 내 어필리에이트 링크 검증 ──
      const MY_PARTNER_TAG = 'AF6507576'; // 다있어 파트너스 태그
      // 1) 쿠팡 링크 형태인지 확인
      if (!myLink.includes('coupang.com')) {
        alert('⛔ 변환된 링크가 쿠팡 링크가 아닙니다. 등록을 중단합니다.');
        setSaving(false);
        return;
      }
      // 2) 변환이 기대되던 상황(isAlreadyPartners=false)에서 동일 URL 반환되면 변환 실패
      if (!isAlreadyPartners && myLink === scrapeRegItem.url) {
        alert('⛔ 링크가 변환되지 않았어요. 인플루언서 원본 링크 그대로입니다.');
        setSaving(false);
        return;
      }
      // 3) 내 파트너스 태그(lptag) 포함 검증 — 파트너스 축약링크(coupa.ng)는 스킵 (내가 직접 생성)
      if (!isAlreadyPartners && !landingUrl.includes(`lptag=${MY_PARTNER_TAG}`)) {
        const tagMatch = landingUrl.match(/lptag=([A-Z0-9]+)/);
        const foundTag = tagMatch ? tagMatch[1] : '없음';
        alert(`⛔ 내 파트너스 태그 불일치!\n\n예상: ${MY_PARTNER_TAG}\n실제: ${foundTag}\n\n등록을 중단합니다 — 커미션이 다른 사람에게 갈 수 있어요.`);
        setSaving(false);
        return;
      }
      // 4) 확인 프롬프트 — 검증된 링크 보여주고 승인
      const ok = confirm(`✅ 내 제휴 링크로 변환 완료!\n내 태그 ${MY_PARTNER_TAG} 확인 완료 ✓\n\n원본: ${scrapeRegItem.url.slice(0, 60)}...\n변환: ${myLink}\n\n이 링크로 등록할까요?`);
      if (!ok) {
        setSaving(false);
        return;
      }

      // 이미지가 없으면 파트너스 검색 API로 자동 조회
      let imageUrl = scrapeRegItem.image || '';
      if (!imageUrl && scrapeRegItem.title) {
        try {
          const searchRes = await fetch(`/api/coupang/search?keyword=${encodeURIComponent(scrapeRegItem.title)}&limit=5`);
          const searchJson = await searchRes.json();
          const items = searchJson?.data?.productData || [];
          // URL에서 productId 추출 후 매칭
          const m = scrapeRegItem.url.match(/\/vp\/products\/(\d+)|pageKey=(\d+)/);
          const productId = m ? (m[1] || m[2]) : null;
          const matched = productId
            ? items.find((p: { productId: number | string }) => String(p.productId) === productId)
            : items[0];
          if (matched?.productImage) imageUrl = matched.productImage;
        } catch { /* 이미지 없어도 등록 진행 */ }
      }

      let sp = Number(scrapeRegForm.sale_price) || 0;
      let op = Number(scrapeRegForm.original_price) || sp;
      // 실수 방지: 원가가 판매가보다 작으면 자동으로 swap
      if (op > 0 && sp > 0 && op < sp) {
        [sp, op] = [op, sp];
      }
      const dr = Number(scrapeRegForm.discount_rate) || (op > sp && sp > 0 ? Math.round((1 - sp / op) * 100) : 0);
      const reviews = [scrapeRegForm.review1, scrapeRegForm.review2, scrapeRegForm.review3].filter(r => r.trim());
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scrapeRegItem.title,
          image_url: imageUrl || null,
          affiliate_url: myLink,
          platform: 'coupang',
          category: scrapeRegForm.category,
          section: scrapeRegForm.section,
          sale_price: sp,
          original_price: op,
          discount_rate: dr,
          rating: Number(scrapeRegForm.rating) || 0,
          review_count: Number(scrapeRegForm.review_count) || 0,
          review_highlights: reviews.length > 0 ? reviews : undefined,
        }),
      });
      loadProducts();
      alert(`✅ "${scrapeRegItem.title.slice(0, 20)}..." 등록 완료!`);
      setScrapeRegItem(null);
      try { sessionStorage.removeItem('scrapeRegForm_draft'); } catch {}
    } catch (e) {
      alert('등록 실패: ' + e);
    }
    setSaving(false);
  }

  async function addFromSearch(item: GoldboxItem) {
    setSaving(true);
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.productName,
          image_url: item.productImage,
          affiliate_url: item.productUrl,
          platform: 'coupang',
          category: 'all',
          section: 'recommend',
          sale_price: item.productPrice,
          original_price: item.originalPrice,
          discount_rate: item.discountRate,
        }),
      });
      loadProducts();
      alert(`"${item.productName.slice(0, 20)}..." 추천에 등록했어요!`);
    } catch (e) {
      alert('등록 실패: ' + e);
    }
    setSaving(false);
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
      if (searchSource === 'coupang') {
        const res = await fetch(`/api/coupang/search?keyword=${encodeURIComponent(keyword)}`);
        const json = await res.json();
        setSearchData(json.data || []);
      } else {
        // 네이버 쇼핑 검색 — 응답 필드를 GoldboxItem 형태로 매핑
        const res = await fetch(`/api/naver/search?keyword=${encodeURIComponent(keyword)}&display=30`);
        const json = await res.json();
        type NaverItem = { title: string; link: string; image: string; salePrice: number; originalPrice: number; platform: string; productId?: string | number; canConvertToMyLink?: boolean };
        const mapped: GoldboxItem[] = (json.items || []).map((it: NaverItem) => {
          const sp = Number(it.salePrice) || 0;
          const op = Number(it.originalPrice) || sp;
          const dr = op > sp && sp > 0 ? Math.round((1 - sp / op) * 100) : 0;
          return {
            productId: String(it.productId || it.link),
            productName: it.title,
            productPrice: sp,
            productImage: it.image,
            productUrl: it.link,
            categoryName: '',
            originalPrice: op,
            discountRate: dr,
            isRocket: false,
            _platform: it.platform,
            _canConvertToMyLink: !!it.canConvertToMyLink,
          } as GoldboxItem & { _platform?: string; _canConvertToMyLink?: boolean };
        });
        setSearchData(mapped);
      }
    } catch (e) {
      alert('검색 실패: ' + e);
    }
    setSearchLoading(false);
  }

  /* ─── 인플루언서 로드 — loadInfluencers / useEffect는 위로 이동됨 ─────────────────────────── */

  async function saveInfluencer() {
    if (!infForm.name.trim() || !infForm.inpock_url.trim()) { alert('이름과 링크는 필수!'); return; }
    setInfSaving(true);
    try {
      await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(infForm),
      });
      const name = infForm.name;
      setInfForm({ name: '', inpock_url: '', profile_url: '', memo: '' });
      loadInfluencers();
      alert(`✅ 인플루언서 "${name}" 등록 완료!`);
    } catch (e) { alert('등록 실패: ' + e); }
    setInfSaving(false);
  }

  async function deleteInfluencer(id: number) {
    if (!confirm('삭제할까요?')) return;
    await fetch(`/api/influencers?id=${id}`, { method: 'DELETE' });
    loadInfluencers();
  }

  async function updateInfluencer(id: number) {
    setInfSaving(true);
    try {
      await fetch('/api/influencers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editInfForm }),
      });
      setEditingInfId(null);
      loadInfluencers();
    } catch { /* ignore */ }
    setInfSaving(false);
  }

  async function scrapeInfluencer(url: string) {
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    setScrapeUrl(url);
    setScrapeLoading(true);
    setScrapeResult(null);
    try {
      const res = await fetch('/api/influencers/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl }),
      });
      const json = await res.json();
      setScrapeResult(json.data || null);
    } catch { setScrapeResult(null); }
    setScrapeLoading(false);
  }

  async function fetchSuggestions(productId: number) {
    setSuggestProductId(productId);
    setSuggestLoading(true);
    setSuggestions([]);
    try {
      const res = await fetch('/api/products/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const json = await res.json();
      setSuggestions(json.data?.suggestions || []);
    } catch { setSuggestions([]); }
    setSuggestLoading(false);
  }

  /* ─── 상품 등록 탭 Partners 검색 — regSearchMessage는 위로 이동됨 ─────────────────────────── */
  async function regSearch() {
    if (!regSearchKw.trim()) return;
    setRegSearching(true);
    setRegSearchMessage('');
    setRegSearchResults([]);
    try {
      // 쿠팡 API limit max=10
      const res = await fetch(`/api/coupang/search?keyword=${encodeURIComponent(regSearchKw)}&limit=10`);
      const json = await res.json();
      // Partners 응답: { rCode, rMessage, data: { productData: [...] } } — search 라우트가 그대로 전달
      const items = json?.data?.productData || (Array.isArray(json?.data) ? json.data : []);
      if (json?.error) {
        setRegSearchMessage(`⚠️ 검색 실패: ${json.error}`);
      } else if (items.length === 0) {
        setRegSearchMessage('😅 Partners API에 이 키워드로 상품이 없어요. 더 짧은 핵심 키워드로 다시 시도하거나, 수동 등록으로 넘어가세요.');
      } else {
        setRegSearchResults(items);
        setRegSearchMessage(`✅ ${items.length}개 찾음`);
      }
    } catch (e) {
      setRegSearchMessage('❌ 검색 중 오류: ' + String(e));
    }
    setRegSearching(false);
  }

  /* ─── 카테고리 — loadCategories / useEffect는 위로 이동됨 ─────────────────────────── */

  async function addCategory() {
    const slug = newCatSlug.trim().toLowerCase();
    const name = newCatName.trim();
    const emoji = newCatEmoji.trim();
    if (!slug || !name) { alert('slug와 이름은 필수예요'); return; }
    if (!/^[a-z0-9_-]+$/.test(slug)) { alert('slug는 영문 소문자/숫자/_-만 가능해요'); return; }
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, emoji }),
      });
      const json = await res.json();
      if (json.error) { alert(json.error); return; }
      const addedName = newCatName;
      setNewCatSlug(''); setNewCatName(''); setNewCatEmoji('');
      loadCategories();
      alert(`✅ 카테고리 "${addedName}" 추가 완료!`);
    } catch (e) { alert('추가 실패: ' + e); }
  }

  async function updateCategory(id: number, patch: Partial<Pick<CategoryRow, 'slug' | 'name' | 'emoji' | 'is_active'>>) {
    // 낙관적 업데이트
    setCategoryRows(rows => rows.map(c => c.id === id ? { ...c, ...patch } : c));
    setEditingCatId(null);
    // 백그라운드 저장
    fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => loadCategories());
  }

  async function deleteCategory(id: number) {
    if (!confirm('정말 삭제할까요?')) return;
    // 낙관적 제거
    setCategoryRows(rows => rows.filter(c => c.id !== id));
    fetch(`/api/categories/${id}`, { method: 'DELETE' }).catch(() => loadCategories());
  }

  async function moveCategoryOrder(id: number, direction: 'up' | 'down') {
    const sorted = [...categoryRows].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(c => c.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    // 낙관적 업데이트 — 화면 즉시 반영
    const swapped = [...sorted];
    [swapped[idx], swapped[swapIdx]] = [swapped[swapIdx], swapped[idx]];
    const reordered = swapped.map((c, i) => ({ ...c, sort_order: i }));
    setCategoryRows(reordered);
    // 백그라운드 저장 — 실패 시 재조회로 롤백
    const orders = reordered.map(c => ({ id: c.id, sort_order: c.sort_order }));
    fetch('/api/categories/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    }).catch(() => loadCategories());
  }

  /* ─── SNS ─────────────────────────── */
  async function analyzeSns() {
    if (!snsUrl.trim()) return;
    setSnsLoading(true);
    setSnsResult(null);
    setSnsSearchResults([]);
    setSnsSelectedKeyword('');
    try {
      const res = await fetch('/api/sns/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: snsUrl }),
      });
      const json = await res.json();
      if (json.data) {
        setSnsResult(json.data);
        // 첫 번째 키워드로 자동 검색
        if (json.data.keywords.length > 0) {
          searchSnsKeyword(json.data.keywords[0]);
        }
      } else {
        alert(json.error || '분석 실패');
      }
    } catch (e) {
      alert('분석 실패: ' + e);
    }
    setSnsLoading(false);
  }

  async function searchSnsKeyword(kw: string) {
    setSnsSelectedKeyword(kw);
    setSnsSearchLoading(true);
    try {
      const res = await fetch(`/api/coupang/search?keyword=${encodeURIComponent(kw)}&limit=5`);
      const json = await res.json();
      setSnsSearchResults(json.data?.productData || []);
    } catch {
      setSnsSearchResults([]);
    }
    setSnsSearchLoading(false);
  }

  /* ─── 필터 ─────────────────────────── */
  const filteredProducts = products
    .filter(p => filterSection === 'all' || p.section === filterSection)
    .filter(p => filterPlatform === 'all' || p.platform === filterPlatform)
    .sort((a, b) => a.sort_order - b.sort_order);

  /* ─── 헬퍼 ─────────────────────────── */
  function PlatformBadge({ platform }: { platform: string }) {
    const p = PLATFORMS.find(x => x.id === platform);
    if (!p) return null;
    return (
      <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: p.color, padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3 }}>
        {p.name}
      </span>
    );
  }

  // 반쪽 별점 선택기 (0.5 스텝, 최대 5)
  function StarRating({ value, onChange, size = 28 }: { value: number; onChange: (v: number) => void; size?: number }) {
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map(i => {
          const fillWidth = value >= i ? '100%' : value >= i - 0.5 ? '50%' : '0%';
          return (
            <div key={i} style={{ position: 'relative', width: size, height: size }}>
              {/* 빈 별 (배경) */}
              <div style={{ position: 'absolute', inset: 0, fontSize: size, lineHeight: 1, color: '#E0E0E0', userSelect: 'none' }}>★</div>
              {/* 채워진 별 (전경, width 클리핑) */}
              <div style={{ position: 'absolute', inset: 0, fontSize: size, lineHeight: 1, color: '#FFB800', width: fillWidth, overflow: 'hidden', userSelect: 'none' }}>★</div>
              {/* 왼쪽 히트존 → 0.5 */}
              <button type="button" onClick={() => onChange(i - 0.5)} aria-label={`${i - 0.5}점`}
                style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
              {/* 오른쪽 히트존 → 풀스타 */}
              <button type="button" onClick={() => onChange(i)} aria-label={`${i}점`}
                style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
            </div>
          );
        })}
        <span style={{ marginLeft: 6, fontSize: 13, fontWeight: 700, color: C.text, minWidth: 28 }}>{value ? value.toFixed(1) : '—'}</span>
        {value > 0 && (
          <button type="button" onClick={() => onChange(0)}
            style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, fontSize: 10, cursor: 'pointer', color: C.sub, fontFamily: 'inherit' }}>
            지우기
          </button>
        )}
      </div>
    );
  }

  function SectionBadge({ section }: { section: string }) {
    const s = SECTIONS.find(x => x.id === section);
    const colors: Record<string, string> = { ranking: C.deal, recommend: C.primary, deal: C.green };
    return (
      <span style={{ fontSize: 9, fontWeight: 600, color: colors[section] || C.sub, background: `${colors[section] || C.sub}15`, padding: '2px 6px', borderRadius: 4 }}>
        {s?.name || section}
      </span>
    );
  }

  /* ─── 탭 ─────────────────────────── */
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'products', label: '상품 관리', count: products.length },
    { id: 'register', label: '상품 등록' },
    { id: 'categories', label: '카테고리', count: categoryRows.filter(c => c.is_active).length },
    { id: 'sns', label: 'SNS 탐색' },
    { id: 'goldbox', label: '골드박스', count: goldboxData.length },
    { id: 'search', label: '검색', count: searchData.length },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard Variable", system-ui, sans-serif', paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            다있어 <span style={{ color: C.primary }}>Admin</span>
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {PLATFORMS.map(p => (
                <span key={p.id} style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: p.color, padding: '2px 6px', borderRadius: 4 }}>{p.name}</span>
              ))}
            </div>
            <button onClick={() => {
              if (!confirm('로그아웃 할까요?')) return;
              localStorage.removeItem('admin_auth');
              sessionStorage.removeItem('admin_auth');
              sessionStorage.removeItem('admin_token');
              setAuthed(false);
              setPw('');
            }}
              title="로그아웃"
              style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: C.sub }}>
              로그아웃
            </button>
          </div>
        </div>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', padding: '0 16px', overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '12px 16px', border: 'none', background: 'none', fontSize: 13, whiteSpace: 'nowrap',
                fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.primary : C.muted,
                borderBottom: tab === t.id ? `2px solid ${C.primary}` : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
              }}>
              {t.label}
              {(t.count ?? 0) > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: tab === t.id ? C.primary : C.border, color: tab === t.id ? '#fff' : C.sub, padding: '1px 6px', borderRadius: 10 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* ━━━ 상품 관리 / 상품 등록 탭 ━━━ */}
        {(tab === 'products' || tab === 'register') && (
          <div>
            {tab === 'register' && (<>
            <div style={{ margin: '16px 20px 0', padding: 16, background: '#E0F2FE', borderRadius: 16, border: `1px solid #7DD3FC` }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0C4A6E', margin: '0 0 8px' }}>🔗 링크 변환기</p>
              <p style={{ fontSize: 11, color: '#075985', margin: '0 0 10px' }}>쿠팡 링크만 입력 → 내 제휴링크로 즉시 변환 (복사만 하고 등록 안 함)</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="linkConvertInput"
                  type="text"
                  placeholder="쿠팡 URL 붙여넣기"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid #7DD3FC`, fontSize: 13, background: '#fff' }}
                />
                <button
                  onClick={async () => {
                    const input = document.getElementById('linkConvertInput') as HTMLInputElement;
                    const result = document.getElementById('linkConvertResult') as HTMLDivElement;
                    const url = input?.value?.trim();
                    if (!url || !url.includes('coupang.com')) { alert('쿠팡 링크를 입력해주세요'); return; }
                    result.textContent = '변환중...';
                    try {
                      const res = await fetch('/api/coupang/deeplink', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ urls: [url] }),
                      });
                      const json = await res.json();
                      const myLink = json?.data?.[0]?.shortenUrl || '';
                      const landing = json?.data?.[0]?.landingUrl || '';
                      if (!myLink) { result.textContent = `❌ 변환 실패: ${json?.rMessage || 'unknown'}`; return; }
                      if (!landing.includes('lptag=AF6507576')) {
                        result.textContent = '⛔ 내 태그 불일치';
                        return;
                      }
                      result.innerHTML = `✅ <span style="font-family:monospace;background:#fff;padding:2px 6px;border-radius:4px;">${myLink}</span> <button id="linkCopyBtn" style="padding:3px 8px;border-radius:4px;border:none;background:#0C4A6E;color:#fff;font-size:11px;cursor:pointer;">복사</button>`;
                      setTimeout(() => {
                        const btn = document.getElementById('linkCopyBtn');
                        btn?.addEventListener('click', async () => {
                          try { await navigator.clipboard.writeText(myLink); alert('📋 복사 완료'); } catch { /* */ }
                        });
                      }, 10);
                    } catch (e) {
                      result.textContent = `❌ 오류: ${e}`;
                    }
                  }}
                  style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#0C4A6E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  변환
                </button>
              </div>
              <div id="linkConvertResult" style={{ marginTop: 8, fontSize: 12, color: '#0C4A6E', minHeight: 20, display: 'flex', alignItems: 'center', gap: 6 }}></div>
            </div>

            {/* ⚠️ 아래 두 블록(쿠팡 빠른등록 + 자동채우기)은 일단 숨김 — 필요시 display 제거 */}
            <div style={{ display: 'none' }}>

            {/* 핫딜 링크 빠른 등록 */}
            <div style={{ margin: '16px 20px', padding: 16, background: `linear-gradient(135deg, ${C.deal}11, ${C.coupang}08)`, borderRadius: 16, border: `1px solid ${C.deal}22` }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>쿠팡 링크 빠른 등록</p>
              <p style={{ fontSize: 11, color: C.sub, margin: '0 0 10px' }}>핫딜방/인플루언서 링크 붙여넣기 → 내 파트너스 링크로 자동 변환</p>
              {/* 섹션 선택 */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['ranking', 'recommend', 'deal'] as const).map(s => {
                  const label = s === 'ranking' ? '랭킹' : s === 'recommend' ? '추천' : '득템';
                  const color = s === 'ranking' ? C.primary : s === 'recommend' ? '#10B981' : C.deal;
                  const active = quickSection === s;
                  return (
                    <button key={s} onClick={() => setQuickSection(s)}
                      style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: active ? 'none' : `1px solid ${C.border}`, background: active ? color : C.card, color: active ? '#fff' : C.sub, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  placeholder="상품명 (핫딜 미리보기에서 복붙)"
                  id="quickTitleInput"
                  style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="쿠팡 링크 붙여넣기 (link.coupang.com/...)"
                    id="quickLinkInput"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13 }}
                    onKeyDown={e => { if (e.key === 'Enter') { (document.getElementById('quickLinkBtn') as HTMLButtonElement)?.click(); }}}
                  />
                  <button id="quickLinkBtn" onClick={async () => {
                    const linkInput = document.getElementById('quickLinkInput') as HTMLInputElement;
                    const titleInput = document.getElementById('quickTitleInput') as HTMLInputElement;
                    const linkUrl = linkInput?.value?.trim();
                    const productTitle = titleInput?.value?.trim() || '';
                    const isCoupangLink = linkUrl && (linkUrl.includes('coupang.com') || linkUrl.includes('coupa.ng'));
                    if (!linkUrl || !isCoupangLink) { alert('쿠팡 링크를 입력해주세요 (coupang.com 또는 coupa.ng)'); return; }
                    openScrapeReg(productTitle || '로딩중...', linkUrl, '', 'coupang', quickSection);
                    // 바로 상품 정보 조회 트리거 (title 포함)
                    setTimeout(() => {
                      (document.querySelector('[data-lookup-btn]') as HTMLButtonElement)?.click();
                    }, 100);
                    linkInput.value = '';
                    titleInput.value = '';
                  }}
                    style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: C.deal, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    등록
                  </button>
                </div>
              </div>
            </div>

            {/* 골드박스 자동 채우기 */}
            <div style={{ margin: '0 20px 16px', padding: 16, background: `linear-gradient(135deg, ${C.primary}11, ${C.coupang}08)`, borderRadius: 16, border: `1px solid ${C.primary}22` }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>🎁 쿠팡 베스트 자동 채우기</p>
              <p style={{ fontSize: 11, color: C.sub, margin: '0 0 10px' }}>카테고리 + 개수 + 섹션 선택 → 쿠팡 베스트 상품 자동 등록</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>카테고리</label>
                  <select id="autoFillCategory" defaultValue="1014"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, marginTop: 3 }}>
                    <option value="1014">생활</option>
                    <option value="1013">주방</option>
                    <option value="1015">인테리어/가구</option>
                    <option value="1012">식품</option>
                    <option value="1016">전자기기</option>
                    <option value="1001">여성패션</option>
                    <option value="1002">남성패션</option>
                    <option value="1010">뷰티</option>
                    <option value="1011">육아</option>
                    <option value="1017">스포츠</option>
                    <option value="1024">반려동물</option>
                    <option value="1025">헬스/건강</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>개수</label>
                  <input id="autoFillCount" type="number" defaultValue={5} min={1} max={20}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, marginTop: 3 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>섹션</label>
                  <select id="autoFillSection" defaultValue="recommend"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, marginTop: 3 }}>
                    <option value="ranking">랭킹</option>
                    <option value="recommend">추천</option>
                    <option value="deal">득템</option>
                  </select>
                </div>
                <button
                  onClick={async () => {
                    const catEl = document.getElementById('autoFillCategory') as HTMLSelectElement;
                    const cntEl = document.getElementById('autoFillCount') as HTMLInputElement;
                    const secEl = document.getElementById('autoFillSection') as HTMLSelectElement;
                    const goldId = Number(catEl.value);
                    const count = Math.max(1, Math.min(20, Number(cntEl.value) || 5));
                    const section = secEl.value;
                    const catMap: Record<number, string> = {
                      1014: 'living', 1013: 'kitchen', 1015: 'interior', 1012: 'food',
                      1016: 'electronics', 1001: 'fashion', 1002: 'fashion', 1010: 'beauty',
                      1011: 'baby', 1017: 'sports', 1024: 'pet', 1025: 'health',
                    };
                    const siteCat = catMap[goldId] || 'all';
                    if (!confirm(`${catEl.options[catEl.selectedIndex].text} 카테고리에서 ${count}개를 ${secEl.options[secEl.selectedIndex].text} 섹션에 등록합니다. 진행할까요?`)) return;
                    try {
                      const gbRes = await fetch(`/api/coupang/best?categoryId=${goldId}&limit=${count + 5}`);
                      const gbJson = await gbRes.json();
                      const list = Array.isArray(gbJson?.data) ? gbJson.data : (gbJson?.data?.productData || []);
                      let success = 0, failed = 0;
                      for (const picked of list) {
                        if (success >= count) break;
                        if (!picked?.productUrl || !picked.productUrl.includes('lptag=AF6507576')) { failed++; continue; }
                        try {
                          const sp = Number(picked.productPrice) || 0;
                          await fetch('/api/products', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: picked.productName,
                              image_url: picked.productImage || null,
                              affiliate_url: picked.productUrl,
                              platform: 'coupang',
                              category: siteCat,
                              section,
                              sale_price: sp,
                              original_price: sp,
                              discount_rate: 0,
                            }),
                          });
                          success++;
                        } catch { failed++; }
                      }
                      loadProducts();
                      alert(`✅ 완료 — 성공 ${success}개 / 실패 ${failed}개`);
                    } catch (e) {
                      alert(`조회 실패: ${e}`);
                    }
                  }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  자동등록
                </button>
              </div>
            </div>
            </div>
            </>)}

            {tab === 'products' && (<>
            {/* 필터 */}
            <div style={{ padding: '16px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', background: C.card }}>
                <option value="all">전체 섹션</option>
                {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.name} — {s.desc}</option>)}
              </select>
              <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', background: C.card }}>
                <option value="all">전체 플랫폼</option>
                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={async () => {
                  setHealthChecking(true); setHealthResult(null);
                  try {
                    const res = await fetch('/api/products/health-check', { method: 'POST' });
                    const json = await res.json();
                    setHealthResult(json.data);
                    if (json.data?.issues > 0) {
                      // 상품 목록 새로고침
                      const r = await fetch('/api/products?active=all');
                      const j = await r.json();
                      setProducts(j.data || []);
                    }
                  } catch { setHealthResult(null); }
                  setHealthChecking(false);
                }}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: healthChecking ? C.bg : C.card, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: C.sub }}>
                {healthChecking ? '⏳ 체크 중...' : '🔍 상태 체크'}
              </button>
              <button onClick={() => setTab('register')}
                style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', position: 'relative', zIndex: 10 }}>
                + 새 상품 등록
              </button>
            </div>

            </>)}

            {/* ━━━ 쿠팡 Partners 검색해서 등록 (register 탭 전용) ━━━ */}
            {tab === 'register' && (
              <div style={{ padding: '20px', margin: '16px', background: C.coupang, borderRadius: 18, boxShadow: `0 6px 20px ${C.coupang}55` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 14, background: '#fff', color: C.coupang, fontSize: 14, fontWeight: 800 }}>1</span>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#fff', letterSpacing: -0.3 }}>🔍 쿠팡에서 상품 찾기</h3>
                </div>
                <p style={{ fontSize: 12, color: '#fff', margin: '0 0 14px', lineHeight: 1.55, opacity: 0.95 }}>
                  인플루언서가 추천한 상품을 <b>상품명/키워드로 조회</b> → 결과 클릭 → 썸네일/가격/내 링크 자동 채워진 상세 모달로 이동
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    value={regSearchKw}
                    onChange={e => setRegSearchKw(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !(e.nativeEvent as KeyboardEvent).isComposing && regSearchKw.trim()) {
                        e.preventDefault();
                        regSearch();
                      }
                    }}
                    inputMode="search"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="예: 스테인리스 수세미 10개"
                    style={{
                      flex: 1,
                      padding: '15px 18px',
                      borderRadius: 12,
                      border: `3px solid #FFE0E0`,
                      fontSize: 16,
                      fontFamily: 'inherit',
                      fontWeight: 600,
                      color: '#1B1D1F',
                      background: '#fff',
                      outline: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#FFF'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.4)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#FFE0E0'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
                  />
                  <button onClick={regSearch} disabled={regSearching || !regSearchKw.trim()}
                    style={{ padding: '14px 22px', borderRadius: 12, border: 'none', background: regSearching || !regSearchKw.trim() ? '#B91C1C99' : '#7F1D1D', color: '#fff', fontSize: 14, fontWeight: 800, cursor: regSearchKw.trim() && !regSearching ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {regSearching ? '조회중...' : '조회'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#fff', margin: '0 0 12px', opacity: 0.85 }}>
                  💡 한글 입력 후 <b>Enter</b> 또는 <b>조회</b> 버튼. 결과 0건이면 키워드 줄여서 재시도.
                </p>
                {regSearchMessage && (
                  <p style={{ fontSize: 12, color: regSearchMessage.startsWith('✅') ? C.green : C.sub, margin: '0 0 10px', padding: '8px 12px', background: C.card, borderRadius: 8, lineHeight: 1.5 }}>
                    {regSearchMessage}
                  </p>
                )}
                {regSearchResults.length > 0 && (
                  <>
                    <p style={{ fontSize: 11, color: C.sub, margin: '0 0 6px', fontWeight: 600 }}>👇 맞는 상품을 클릭하세요 (다른 상품도 같이 걸릴 수 있어요)</p>
                    <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                      {regSearchResults.map((item, i) => (
                        <div key={item.productId || i}
                          onClick={() => openScrapeReg(item.productName, item.productUrl, item.productImage || '', 'coupang', 'recommend', {
                            sale_price: item.productPrice,
                            original_price: item.originalPrice,
                            discount_rate: item.discountRate,
                          })}
                          style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: i < regSearchResults.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.12s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.primaryLight; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, width: 18, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                          <img src={item.productImage} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', background: C.bg, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: C.text, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{item.productName}</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                              {item.discountRate > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: C.deal }}>{item.discountRate}%</span>}
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{item.productPrice?.toLocaleString()}원</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: C.primary, fontWeight: 700, flexShrink: 0, padding: '6px 10px', background: C.primaryLight, borderRadius: 6 }}>
                            선택 →
                          </span>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 10, color: C.muted, margin: '6px 0 0', textAlign: 'center' }}>원하는 상품이 없으면 키워드를 줄여 다시 조회</p>
                  </>
                )}
              </div>
            )}

            {/* ━━━ 수동 등록 폼 (register 탭에서 항상 표시) ━━━ */}
            {tab === 'register' && (
              <div style={{ padding: '20px', margin: '16px', background: C.card, borderRadius: 16, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 12, background: C.sub, color: '#fff', fontSize: 12, fontWeight: 800 }}>2</span>
                    <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: C.sub }}>✏️ 수동 등록 <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>— 위에서 검색 안 될 때만</span></h2>
                  </div>
                  <button onClick={() => setTab('products')} style={{ border: 'none', background: C.bg, padding: '4px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: C.sub, fontFamily: 'inherit' }}>관리로</button>
                </div>

                {/* 실시간 미리보기 — 앱에서 보일 모습 */}
                <div style={{ padding: 12, background: C.bg, borderRadius: 12, border: `1px dashed ${C.border}`, marginBottom: 18 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, margin: '0 0 8px', letterSpacing: 0.5 }}>🔍 앱 미리보기</p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {form.image_url ? (
                      <img src={proxyImg(form.image_url) || form.image_url} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', background: C.card, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: 12, background: C.card, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, lineHeight: 1.35 }}>
                        {form.title || '상품명이 여기 표시돼요'}
                      </p>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'baseline', marginTop: 6 }}>
                        {Number(form.discount_rate) > 0 && <span style={{ fontSize: 14, fontWeight: 800, color: C.deal }}>{form.discount_rate}%</span>}
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{Number(form.sale_price)?.toLocaleString() || '0'}원</span>
                        {Number(form.original_price) > Number(form.sale_price) && (
                          <span style={{ fontSize: 11, color: C.muted, textDecoration: 'line-through' }}>{Number(form.original_price).toLocaleString()}원</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        <PlatformBadge platform={form.platform} />
                        <SectionBadge section={form.section} />
                        {Number(form.rating) > 0 && (
                          <span style={{ fontSize: 9, color: '#FFB800', fontWeight: 700, background: '#FFF8E1', padding: '2px 6px', borderRadius: 4 }}>
                            ★ {Number(form.rating).toFixed(1)}{form.review_count && ` (${Number(form.review_count).toLocaleString()})`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

            {/* 플랫폼 */}
            <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 8 }}>플랫폼</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setForm({ ...form, platform: p.id })}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    border: form.platform === p.id ? `2px solid ${p.color}` : `1px solid ${C.border}`,
                    background: form.platform === p.id ? `${p.color}08` : C.card,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: form.platform === p.id ? 700 : 500,
                    color: form.platform === p.id ? p.color : C.sub,
                  }}>
                  {p.name}
                </button>
              ))}
            </div>

            {/* 섹션 */}
            <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 8 }}>배치 섹션</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setForm({ ...form, section: s.id })}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, textAlign: 'center',
                    border: form.section === s.id ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                    background: form.section === s.id ? C.primaryLight : C.card,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: form.section === s.id ? C.primary : C.text }}>{s.name}</p>
                  <p style={{ fontSize: 10, color: C.sub, margin: '2px 0 0' }}>{s.desc}</p>
                </button>
              ))}
            </div>

            {/* 카테고리 */}
            <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 8 }}>카테고리</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setForm({ ...form, category: c.id })}
                  style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: form.category === c.id ? `1px solid ${C.primary}` : `1px solid ${C.border}`,
                    background: form.category === c.id ? C.primary : C.card,
                    color: form.category === c.id ? '#fff' : C.sub,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                  }}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* 제휴 링크 */}
            <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>제휴 링크 *</label>
            <input value={form.affiliate_url} onChange={e => setForm({ ...form, affiliate_url: e.target.value })}
              placeholder={form.platform === 'coupang' ? 'https://link.coupang.com/...' : form.platform === 'toss' ? 'https://tossshopping.com/...' : 'https://...'}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 14 }}
            />

            {/* 상품명 */}
            <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>상품명 *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="예: 비비고 왕교자 350g x 4봉"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 14 }}
            />

            {/* 이미지 — 자동조회 + 드래그/붙여넣기 */}
            <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>썸네일 이미지</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {form.affiliate_url && (
                  <a href={form.affiliate_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.sub, fontWeight: 600, textDecoration: 'none' }}>
                    🌐 쿠팡 열기
                  </a>
                )}
                <button type="button" onClick={async () => {
                  if (!form.affiliate_url) { alert('제휴 링크를 먼저 입력해주세요'); return; }
                  const isToss = /toss\.im\/_m\/|shopping\.toss\.im/.test(form.affiliate_url);
                  const isKurly = /kurly\.com/.test(form.affiliate_url);
                  try {
                    if (isToss || isKurly) {
                      // 토스/컬리: OG 메타로 title + image만 (가격은 수동)
                      const endpoint = isToss ? '/api/toss-product-info' : '/api/kurly-product-info';
                      const platformLabel = isToss ? '토스쇼핑' : '컬리';
                      const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: form.affiliate_url }),
                      });
                      const json = await res.json();
                      const d = json?.data;
                      if (d?.image_url || d?.title) {
                        setForm(f => ({
                          ...f,
                          image_url: d.image_url || f.image_url,
                          title: f.title || d.title || '',
                          platform: isToss ? 'toss' : 'kurly',
                        }));
                        alert(`✅ ${platformLabel} 조회 완료\n(가격은 수동으로 입력해주세요)`);
                      } else {
                        alert(`⚠️ ${platformLabel} 조회 실패: ` + (json?.error || '알 수 없음'));
                      }
                      return;
                    }
                    // 쿠팡 기본 경로
                    const res = await fetch('/api/coupang/product-info', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: form.affiliate_url, title: form.title }),
                    });
                    const json = await res.json();
                    const d = json?.data;
                    if (d?.image) {
                      setForm(f => ({
                        ...f,
                        image_url: d.image,
                        title: f.title || d.title || '',
                        sale_price: f.sale_price || String(d.salePrice || ''),
                        original_price: f.original_price || String(d.originalPrice || d.salePrice || ''),
                        discount_rate: f.discount_rate || String(d.discountRate || ''),
                      }));
                      alert('✅ 자동 조회 완료');
                    } else {
                      alert('⚠️ 자동 조회 실패.\n→ 옆 "🌐 쿠팡 열기" 눌러 이미지를 드래그해서 아래 박스에 드롭하세요.');
                    }
                  } catch (e) { alert('조회 실패: ' + e); }
                }}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: C.coupang, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  🔍 자동 조회
                </button>
              </div>
            </label>

            {/* 드롭존 + URL 입력 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}
              onDrop={e => {
                e.preventDefault();
                const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                if (url) setForm(f => ({ ...f, image_url: url }));
              }}
              onDragOver={e => e.preventDefault()}
            >
              <div style={{ width: 72, height: 72, borderRadius: 10, border: `2px dashed ${C.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: C.bg }}>
                {form.image_url ? (
                  <img src={proxyImg(form.image_url) || form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 10, color: C.muted, textAlign: 'center', lineHeight: 1.3 }}>이미지<br/>드래그</span>
                )}
              </div>
              <input value={form.image_url}
                placeholder="URL 붙여넣기 or 왼쪽에 이미지 드래그"
                onChange={e => setForm({ ...form, image_url: e.target.value })}
                style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 14px' }}>
              자동 조회 안 되면 <b>🌐 쿠팡 열기</b> → 이미지 우클릭/꾹눌러서 드래그해 왼쪽 박스에 드롭
            </p>

            {/* 가격 — 판매가/원가 입력 시 할인율 자동 계산 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>판매가</label>
                <input type="number" value={form.sale_price}
                  onChange={e => {
                    const sp = Number(e.target.value) || 0;
                    const op = Number(form.original_price) || 0;
                    const dr = op > sp && sp > 0 ? Math.round((1 - sp / op) * 100) : 0;
                    // 항상 재계산 — 가격 같거나 판매가가 원가보다 크면 0으로 리셋 (이전 stale값 유지 금지)
                    setForm({ ...form, sale_price: e.target.value, discount_rate: dr > 0 ? String(dr) : '' });
                  }}
                  placeholder="11900"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>원가</label>
                <input type="number" value={form.original_price}
                  onChange={e => {
                    const op = Number(e.target.value) || 0;
                    const sp = Number(form.sale_price) || 0;
                    const dr = op > sp && sp > 0 ? Math.round((1 - sp / op) * 100) : 0;
                    setForm({ ...form, original_price: e.target.value, discount_rate: dr > 0 ? String(dr) : '' });
                  }}
                  placeholder="16800"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ width: 80 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>할인% <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>자동</span></label>
                <input type="number" value={form.discount_rate} onChange={e => setForm({ ...form, discount_rate: e.target.value })}
                  placeholder="0"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: C.bg }}
                />
              </div>
            </div>

            {/* 별점 + 후기수 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 8 }}>별점 (반개 단위)</label>
              <StarRating
                value={Number(form.rating) || 0}
                onChange={v => setForm({ ...form, rating: String(v) })}
              />
              <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>왼쪽 반쪽 = 0.5 · 오른쪽 반쪽 = 정수 (쿠팡에서 본 별점 그대로)</p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>후기 수</label>
              <input type="number" value={form.review_count} onChange={e => setForm({ ...form, review_count: e.target.value })}
                placeholder="예: 14956"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            {/* 가성비 이유 — GPT 정리 */}
            <div style={{ marginBottom: 14, padding: 14, background: `linear-gradient(135deg, #FFF4D6, #FFE8A8)`, borderRadius: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#7A5F00', display: 'block', marginBottom: 6 }}>✨ 가성비 이유 3가지 (상세 모달에 표시)</label>
              <p style={{ fontSize: 11, color: '#7A5F00', margin: '0 0 8px', lineHeight: 1.5 }}>
                쿠팡 후기 몇 개 붙여넣고 <b>GPT 정리</b> 누르면 3줄로 정리돼요. 안 누르면 아래 3칸에 직접 쓴 그대로 저장. 비워두고 싶으면 비워두셔도 됩니다.
              </p>
              <textarea value={form.reviews_raw} onChange={e => setForm({ ...form, reviews_raw: e.target.value })}
                placeholder="쿠팡 구매자 후기 여러 개 복붙 (선택 — 없으면 제품명으로 AI가 추측)"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }}
              />
              <button type="button" onClick={async () => {
                setAiSummarizing(true);
                try {
                  const res = await fetch('/api/ai/summarize-reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reviews: form.reviews_raw || '', productTitle: form.title }),
                  });
                  const json = await res.json();
                  if (json.error) { alert('AI 정리 실패: ' + json.error); return; }
                  const h = json.highlights || [];
                  setForm(f => ({ ...f, review1: h[0] || '', review2: h[1] || '', review3: h[2] || '' }));
                } catch (e) { alert('AI 호출 실패: ' + e); }
                setAiSummarizing(false);
              }} disabled={aiSummarizing}
                style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: aiSummarizing ? C.muted : '#7A5F00', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
                {aiSummarizing ? '✨ 정리 중...' : '✨ GPT로 3줄 정리'}
              </button>
              {(['review1', 'review2', 'review3'] as const).map((k, i) => (
                <input key={k} type="text" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                  placeholder={`이유 ${i + 1} (예: 세척력 대비 가격이 합리적이에요)`}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6, background: '#fff' }}
                />
              ))}
            </div>

            <button onClick={saveProduct} disabled={saving}
              style={{ width: '100%', padding: '16px 0', borderRadius: 12, border: 'none', background: saving ? C.muted : C.primary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
              {saving ? '등록 중...' : '상품 등록하기'}
            </button>
                <p style={{ fontSize: 11, color: C.sub, marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
                  등록하면 앱과 웹의 해당 섹션에 바로 반영돼요
                </p>
              </div>
            )}

            {tab === 'products' && (<>
            {/* 섹션별 카운트 */}
            <div style={{ padding: '0 20px 12px', display: 'flex', gap: 12 }}>
              {SECTIONS.map(s => {
                const count = products.filter(p => p.section === s.id).length;
                return (
                  <div key={s.id} style={{ padding: '10px 16px', background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: s.id === 'ranking' ? C.deal : s.id === 'deal' ? C.green : C.primary }}>{count}</p>
                    <p style={{ fontSize: 11, color: C.sub, margin: '2px 0 0' }}>{s.name}</p>
                  </div>
                );
              })}
            </div>

            {/* ━━━ 헬스체크 결과 ━━━ */}
            {healthResult && (
              <div style={{ margin: '0 16px 16px', background: C.card, borderRadius: 16, border: `1px solid ${healthResult.issues > 0 ? C.red : C.green}`, overflow: 'hidden' }}>
                {/* 요약 헤더 */}
                <div style={{ padding: '14px 20px', background: healthResult.issues > 0 ? `${C.red}08` : `${C.green}08`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: healthResult.issues > 0 ? C.red : C.green }}>
                      {healthResult.issues > 0 ? `⚠️ ${healthResult.issues}개 문제 발견` : '✅ 모든 상품 정상'}
                    </p>
                    <p style={{ fontSize: 11, color: C.sub, margin: '4px 0 0' }}>
                      {healthResult.checked}개 체크 · {healthResult.healthy}개 정상 · {new Date(healthResult.checkedAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <button onClick={() => setHealthResult(null)} style={{ border: 'none', background: 'none', fontSize: 16, cursor: 'pointer', color: C.muted, padding: 4 }}>✕</button>
                </div>
                {/* 문제 목록 */}
                {healthResult.results.length > 0 && (
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {healthResult.results.map((r, i) => (
                      <div key={i} style={{ padding: '10px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>
                          {r.severity === 'critical' ? '🔴' : r.severity === 'warning' ? '🟡' : '🔵'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            [{r.id}] {r.title}
                          </p>
                          <p style={{ fontSize: 11, color: C.sub, margin: '2px 0 0' }}>{r.issue}</p>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                          background: r.action === '자동 OFF' ? `${C.red}12` : r.action.includes('제거') ? `${C.deal}12` : `${C.primary}12`,
                          color: r.action === '자동 OFF' ? C.red : r.action.includes('제거') ? C.deal : C.primary,
                        }}>
                          {r.action}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {healthResult.issues === 0 && (
                  <div style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: C.sub, margin: 0 }}>등록된 모든 상품이 정상이에요 👍</p>
                  </div>
                )}
              </div>
            )}

            {/* 자동 셔플 설정 카드 */}
            {!productsLoading && (
              <div style={{
                margin: '0 16px 12px', padding: '14px 16px',
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: C.text }}>🔀 자동 셔플</p>
                  <p style={{ fontSize: 11, color: C.sub, margin: '2px 0 0' }}>
                    TOP5 제외 상품을 설정한 주기마다 자동으로 섞어 노출해요
                  </p>
                </div>
                {/* 토글 */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shuffleEnabled}
                    disabled={shuffleSaving}
                    onChange={e => {
                      const v = e.target.checked;
                      setShuffleEnabled(v);
                      saveShuffleSettings(v, shuffleHours);
                    }}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: shuffleEnabled ? C.primary : C.muted }}>
                    {shuffleEnabled ? 'ON' : 'OFF'}
                  </span>
                </label>
                {/* 시간 입력 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={shuffleHours}
                    disabled={!shuffleEnabled || shuffleSaving}
                    onChange={e => setShuffleHours(Math.max(1, Math.min(168, Number(e.target.value) || 2)))}
                    onBlur={() => saveShuffleSettings(shuffleEnabled, shuffleHours)}
                    style={{
                      width: 60, padding: '6px 8px', borderRadius: 6,
                      border: `1px solid ${C.border}`, fontSize: 13, textAlign: 'center',
                      fontFamily: 'inherit', outline: 'none',
                      background: shuffleEnabled ? C.card : C.bg,
                    }}
                  />
                  <span style={{ fontSize: 12, color: C.sub }}>시간마다</span>
                </div>
              </div>
            )}

            {/* 셔플 버튼 — 지금 바로 한 번 섞기 */}
            {!productsLoading && filteredProducts.filter(p => p.section !== 'ranking').length >= 2 && (
              <div style={{ margin: '0 16px 12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={shuffleFilteredProducts}
                  style={{
                    padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.border}`,
                    background: C.card, color: C.sub, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  title="TOP5 제외한 나머지 상품 순서 무작위 섞기 (수동)"
                >
                  🎲 지금 섞기
                </button>
              </div>
            )}

            {/* 상품 리스트 */}
            {productsLoading ? (
              <p style={{ textAlign: 'center', color: C.muted, padding: 40 }}>불러오는 중...</p>
            ) : filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ fontSize: 40, margin: 0 }}>📦</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 12 }}>등록된 상품이 없어요</p>
                <p style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>상품을 등록하면 앱과 웹에 바로 반영돼요</p>
                <button onClick={() => setTab('register')}
                  style={{ marginTop: 16, padding: '12px 24px', borderRadius: 10, border: 'none', background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', position: 'relative', zIndex: 10 }}>
                  첫 상품 등록하기
                </button>
              </div>
            ) : (
              <div style={{ background: C.card, borderRadius: 16, margin: '0 16px 24px', overflow: 'hidden', border: `1px solid ${C.border}` }}>
                <DndContext sensors={dndSensors} collisionDetection={closestCorners} onDragEnd={handleDndDragEnd}>
                  <SortableContext items={filteredProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {filteredProducts.map((p, i) => (
                      <SortableProductRow key={p.id} id={p.id}>
                        {({ attributes, listeners }) => (
                          <div
                            {...attributes}
                            {...listeners}
                            style={{
                              display: 'flex', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'center',
                              opacity: p.is_active ? 1 : 0.4,
                              background: '#fff',
                              cursor: 'grab',
                              touchAction: 'none',
                              userSelect: 'none',
                            }}
                          >
                            {/* 순서 번호 + 위아래 버튼 (핸들 시각 힌트) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, alignItems: 'center', minWidth: 32 }}>
                              <span style={{ fontSize: 13, color: C.muted, lineHeight: 1 }} title="행을 드래그해서 순서 변경">☰</span>
                              <button onClick={e => { e.stopPropagation(); moveOrder(p, 'up'); }} onPointerDown={e => e.stopPropagation()} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: C.muted, padding: 2 }}>▲</button>
                              <span style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? C.primary : C.muted, textAlign: 'center' }}>{i + 1}</span>
                              <button onClick={e => { e.stopPropagation(); moveOrder(p, 'down'); }} onPointerDown={e => e.stopPropagation()} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: C.muted, padding: 2 }}>▼</button>
                            </div>

                    {/* 이미지 + 내 링크로 바로가기 (상품 존재/가격 확인용) */}
                    <a href={p.affiliate_url} target="_blank" rel="noopener noreferrer"
                      title="내 제휴 링크로 상품 보기"
                      style={{ position: 'relative', flexShrink: 0, display: 'block', textDecoration: 'none' }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', background: C.bg, display: 'block' }} />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 10, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
                      )}
                      <span style={{ position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: C.primary, color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
                        ↗
                      </span>
                    </a>

                    {/* 정보 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{p.title}</p>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <PlatformBadge platform={p.platform} />
                        <SectionBadge section={p.section} />
                        {p.section === 'ranking' && (
                          p.pinned ? (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: C.primary, padding: '2px 6px', borderRadius: 4 }}>📌 PIN</span>
                          ) : (
                            <span style={{ fontSize: 9, fontWeight: 600, color: C.deal, background: `${C.deal}15`, padding: '2px 6px', borderRadius: 4 }}>⏰ 24h</span>
                          )
                        )}
                        {typeof p.view_count === 'number' && p.view_count > 0 && (
                          <span style={{ fontSize: 9, color: C.sub, background: C.bg, padding: '2px 6px', borderRadius: 4 }}>👁 {p.view_count}</span>
                        )}
                        {p.category !== 'all' && (
                          <span style={{ fontSize: 9, color: C.sub, background: C.bg, padding: '2px 6px', borderRadius: 4 }}>
                            {CATEGORIES.find(c => c.id === p.category)?.name}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                        {p.discount_rate > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: C.deal }}>{p.discount_rate}%</span>}
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.sale_price?.toLocaleString()}원</span>
                        {p.original_price > p.sale_price && (
                          <span style={{ fontSize: 10, color: C.muted, textDecoration: 'line-through' }}>{p.original_price?.toLocaleString()}원</span>
                        )}
                      </div>
                    </div>

                    {/* 액션 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => {
                        // review_highlights가 JSON string이면 파싱
                        let highlights: string[] = [];
                        if (Array.isArray(p.review_highlights)) highlights = p.review_highlights;
                        else if (typeof p.review_highlights === 'string') {
                          try { const parsed = JSON.parse(p.review_highlights); if (Array.isArray(parsed)) highlights = parsed; } catch {}
                        }
                        setEditProduct({ ...p, review_highlights: highlights });
                      }}
                        style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: C.sub }}>
                        수정
                      </button>
                      <button onClick={() => toggleActive(p)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: p.is_active ? C.primaryLight : `${C.deal}15`, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: p.is_active ? C.primary : C.deal, fontWeight: 600 }}>
                        {p.is_active ? 'ON' : 'OFF'}
                      </button>
                      <button onClick={() => deleteProduct(p.id)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: `${C.red}10`, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: C.red }}>
                        삭제
                      </button>
                      {!p.is_active && (
                        <button onClick={() => fetchSuggestions(p.id)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: `${C.green}15`, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', color: C.green, fontWeight: 600 }}>
                          🔄 대체
                        </button>
                      )}
                    </div>
                          </div>
                        )}
                      </SortableProductRow>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
            </>)}
          </div>
        )}

        {/* ━━━ SNS 탐색 탭 (발굴 + 인플루언서 서브탭) ━━━ */}
        {tab === 'sns' && (
          <div>
            {/* 서브탭 */}
            <div style={{ display: 'flex', gap: 6, padding: '16px 20px 0' }}>
              {([
                { id: 'discover' as const, label: 'SNS 발굴' },
                { id: 'influencer' as const, label: '인플루언서' },
              ]).map(s => {
                const active = snsSubTab === s.id;
                return (
                  <button key={s.id} onClick={() => setSnsSubTab(s.id)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: active ? 'none' : `1px solid ${C.border}`, background: active ? C.primary : C.card, color: active ? '#fff' : C.sub, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {s.label}
                  </button>
                );
              })}
            </div>

            {snsSubTab === 'discover' && (
            <div style={{ padding: '20px 20px' }}>
            {/* 설명 */}
            <div style={{
              padding: '16px 20px', background: `linear-gradient(135deg, #E1306C, #C13584)`,
              borderRadius: 14, color: '#fff', marginBottom: 20,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>SNS에서 제품 발굴하기</h3>
              <p style={{ fontSize: 12, margin: '6px 0 0', opacity: 0.85, lineHeight: 1.5 }}>
                인스타/틱톡/유튜브 링크를 넣으면 키워드를 자동 추출하고,<br />
                쿠팡에서 해당 제품을 바로 검색해요.
              </p>
            </div>

            {/* URL 입력 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={snsUrl}
                onChange={e => setSnsUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyzeSns()}
                placeholder="인스타/틱톡/유튜브 링크 붙여넣기"
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: 12,
                  border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={analyzeSns}
                disabled={snsLoading}
                style={{
                  padding: '14px 20px', borderRadius: 12, border: 'none',
                  background: snsLoading ? C.muted : '#E1306C', color: '#fff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                {snsLoading ? '분석 중...' : '분석'}
              </button>
            </div>

            {/* 분석 결과 */}
            {snsResult && (
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 20 }}>
                {/* 메타 정보 */}
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#fff', padding: '2px 8px', borderRadius: 4,
                      background: snsResult.platform === 'instagram' ? '#E1306C' :
                        snsResult.platform === 'tiktok' ? '#000' :
                        snsResult.platform === 'youtube' ? '#FF0000' :
                        snsResult.platform === 'naver' ? '#03C75A' : C.sub,
                    }}>
                      {snsResult.platform.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {snsResult.url}
                    </span>
                  </div>
                  {snsResult.title && (
                    <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: C.text, lineHeight: 1.4 }}>
                      {snsResult.title}
                    </p>
                  )}
                  {snsResult.description && (
                    <p style={{ fontSize: 12, color: C.sub, margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>
                      {snsResult.description}
                    </p>
                  )}
                </div>

                {/* 추출된 키워드 */}
                <div style={{ padding: '14px 20px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 10px' }}>
                    추출된 키워드 — 클릭하면 쿠팡 검색
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {snsResult.keywords.map(kw => (
                      <button
                        key={kw}
                        onClick={() => searchSnsKeyword(kw)}
                        style={{
                          padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 13, fontWeight: snsSelectedKeyword === kw ? 700 : 500,
                          border: snsSelectedKeyword === kw ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                          background: snsSelectedKeyword === kw ? C.primaryLight : C.card,
                          color: snsSelectedKeyword === kw ? C.primary : C.sub,
                        }}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                  {snsResult.keywords.length === 0 && (
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>키워드를 추출하지 못했어요. 직접 검색 탭에서 검색해보세요.</p>
                  )}
                </div>
              </div>
            )}

            {/* 검색 결과 */}
            {snsSearchLoading && (
              <p style={{ textAlign: 'center', color: C.muted, padding: 20, fontSize: 13 }}>
                "{snsSelectedKeyword}" 쿠팡 검색 중...
              </p>
            )}
            {snsSearchResults.length > 0 && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
                  "{snsSelectedKeyword}" 검색 결과 — 바로 등록
                </p>
                <div style={{ background: C.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                  {snsSearchResults.map((item, i) => (
                    <div key={item.productId || i} style={{
                      display: 'flex', gap: 12, padding: '14px 16px',
                      borderBottom: `1px solid ${C.border}`, alignItems: 'center',
                    }}>
                      <img src={item.productImage} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', background: C.bg, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{item.productName}</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                          {item.discountRate > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: C.deal }}>{item.discountRate}%</span>}
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{item.productPrice?.toLocaleString()}원</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => addFromSearch(item)} disabled={saving}
                          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          추천 등록
                        </button>
                        <button onClick={() => addFromGoldbox(item)} disabled={saving}
                          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: C.deal, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          랭킹 등록
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 사용 팁 */}
            {!snsResult && (
              <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 12px' }}>이렇게 사용해요</p>
                {[
                  { icon: '📱', text: '인스타/틱톡/유튜브에서 쇼핑 인플루언서 게시물 링크 복사' },
                  { icon: '🔍', text: '붙여넣기 → 분석 클릭 → 키워드 자동 추출' },
                  { icon: '🛒', text: '키워드 클릭 → 쿠팡 검색 → 바로 등록' },
                ].map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{tip.icon}</span>
                    <p style={{ fontSize: 13, color: C.sub, margin: 0, lineHeight: 1.5 }}>{tip.text}</p>
                  </div>
                ))}
                <div style={{ marginTop: 14, padding: '10px 14px', background: C.bg, borderRadius: 10 }}>
                  <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                    지원 플랫폼: Instagram, TikTok, YouTube, 네이버 블로그, X(Twitter), Threads
                  </p>
                </div>
              </div>
            )}
            </div>
            )}
          </div>
        )}

        {/* ━━━ 골드박스 탭 ━━━ */}
        {tab === 'goldbox' && (
          <div>
            <div style={{ padding: '20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <PlatformBadge platform="coupang" />
                <span style={{ fontSize: 13, color: C.sub }}>쿠팡 실시간 인기 상품 → 섹션 선택 후 등록</span>
              </div>
              {/* 섹션 선택 */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(['ranking', 'recommend', 'deal'] as const).map(s => {
                  const label = s === 'ranking' ? '랭킹' : s === 'recommend' ? '추천' : '득템';
                  const color = s === 'ranking' ? C.primary : s === 'recommend' ? '#10B981' : C.deal;
                  const active = goldboxSection === s;
                  return (
                    <button key={s} onClick={() => setGoldboxSection(s)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: active ? 'none' : `1px solid ${C.border}`, background: active ? color : C.card, color: active ? '#fff' : C.sub, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <button onClick={fetchGoldbox} disabled={goldboxLoading}
                style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: goldboxLoading ? C.muted : C.coupang, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {goldboxLoading ? '불러오는 중...' : '쿠팡 인기 상품 불러오기'}
              </button>
            </div>
            {goldboxData.length > 0 && (
              <div style={{ background: C.card, borderRadius: 16, margin: '0 16px 24px', overflow: 'hidden', border: `1px solid ${C.border}` }}>
                {goldboxData.map((item, i) => (
                  <div key={item.productId || i} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? C.primary : C.muted, width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                    <img src={item.productImage} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', background: C.bg, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{item.productName}</p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                        {item.discountRate > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: C.deal }}>{item.discountRate}%</span>}
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{item.productPrice?.toLocaleString()}원</span>
                      </div>
                    </div>
                    <button onClick={() => addFromGoldbox(item, goldboxSection)} disabled={saving}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: goldboxSection === 'ranking' ? C.primary : goldboxSection === 'recommend' ? '#10B981' : C.deal, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      {goldboxSection === 'ranking' ? '랭킹' : goldboxSection === 'recommend' ? '추천' : '득템'} 등록
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ━━━ 검색 탭 (쿠팡 + 네이버) ━━━ */}
        {tab === 'search' && (
          <div>
            <div style={{ padding: '20px 20px' }}>
              {/* 소스 선택 */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(['coupang', 'naver'] as const).map(src => {
                  const active = searchSource === src;
                  const label = src === 'coupang' ? '쿠팡' : '네이버';
                  const color = src === 'coupang' ? C.coupang : '#03C75A';
                  return (
                    <button key={src} onClick={() => { setSearchSource(src); setSearchData([]); }}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: active ? 'none' : `1px solid ${C.border}`, background: active ? color : C.card, color: active ? '#fff' : C.sub, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: C.sub, margin: '0 0 10px' }}>
                {searchSource === 'coupang' ? '쿠팡 파트너스 검색 — 바로 내 링크로 등록' : '네이버 쇼핑 검색 — 트렌드 파악용 (쿠팡 링크만 등록 가능)'}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchSearch()}
                  placeholder="검색어 (예: 에어팟, 물티슈)"
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                />
                <button onClick={fetchSearch} disabled={searchLoading}
                  style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: C.primary, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {searchLoading ? '...' : '검색'}
                </button>
              </div>
            </div>
            {searchData.length > 0 && (
              <div style={{ background: C.card, borderRadius: 16, margin: '0 16px 24px', overflow: 'hidden', border: `1px solid ${C.border}` }}>
                {searchData.map((item, i) => {
                  const meta = item as GoldboxItem & { _platform?: string; _canConvertToMyLink?: boolean };
                  const platform = meta._platform || 'coupang';
                  const canRegister = searchSource === 'coupang' || platform === 'coupang';
                  return (
                    <div key={item.productId || i} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
                      <img src={item.productImage} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', background: C.bg, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{item.productName}</p>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                          {searchSource === 'naver' && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: platform === 'coupang' ? C.coupang : platform === 'kurly' ? C.kurly : platform === 'naver' ? '#03C75A' : C.sub, padding: '2px 6px', borderRadius: 4 }}>
                              {platform === 'coupang' ? '쿠팡' : platform === 'kurly' ? '컬리' : platform === 'naver' ? '네이버' : platform === '11st' ? '11번가' : platform === 'gmarket' ? 'G마켓' : platform}
                            </span>
                          )}
                          {item.discountRate > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: C.deal }}>{item.discountRate}%</span>}
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{item.productPrice?.toLocaleString()}원</span>
                        </div>
                      </div>
                      {canRegister ? (
                        <button onClick={() => addFromSearch(item)} disabled={saving}
                          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                          추천 등록
                        </button>
                      ) : (
                        <span style={{ padding: '8px 12px', borderRadius: 8, background: C.bg, color: C.muted, fontSize: 10, fontWeight: 600, flexShrink: 0, textAlign: 'center', lineHeight: 1.3 }}>
                          등록 불가<br />(쿠팡 외)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ━━━ 카테고리 관리 탭 ━━━ */}
        {tab === 'categories' && (
          <div style={{ padding: '20px 20px' }}>
            {/* 안내 */}
            <div style={{ padding: '16px 20px', background: `linear-gradient(135deg, ${C.primary}, #1B6CF2)`, borderRadius: 14, color: '#fff', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>홈 상단 카테고리 관리</h3>
              <p style={{ fontSize: 12, margin: '6px 0 0', opacity: 0.9, lineHeight: 1.5 }}>
                앱/웹 홈 상단에 보이는 카테고리예요. 추가/수정/순서/숨김을 여기서 관리해요.
              </p>
            </div>

            {/* 실제 앱 프리뷰 — 현재 활성 카테고리만 */}
            <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 14, marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: C.sub, margin: '0 0 8px', fontWeight: 600 }}>🔍 앱에서 보이는 모습</p>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin' }}>
                {categoryRows.filter(c => c.is_active).sort((a, b) => a.sort_order - b.sort_order).map(c => (
                  <div key={c.id} style={{ flexShrink: 0, width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 6, borderRadius: 10, background: C.bg }}>
                    <div style={{ fontSize: 22 }}>{c.emoji || '📁'}</div>
                    <p style={{ fontSize: 10, fontWeight: 600, margin: 0, color: C.text, whiteSpace: 'nowrap' }}>{c.name}</p>
                  </div>
                ))}
                {categoryRows.filter(c => c.is_active).length === 0 && (
                  <p style={{ fontSize: 12, color: C.muted, margin: 0, padding: '8px 0' }}>활성 카테고리가 없어요</p>
                )}
              </div>
            </div>

            {/* 새 카테고리 추가 */}
            <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: C.text }}>➕ 새 카테고리 추가</p>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                <input value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)}
                  placeholder="🎁" maxLength={4}
                  style={{ padding: '10px 8px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 18, textAlign: 'center', fontFamily: 'inherit' }} />
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  placeholder="이름 (예: 디지털)"
                  style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit' }} />
                <input value={newCatSlug} onChange={e => setNewCatSlug(e.target.value.toLowerCase())}
                  placeholder="slug (영문, 예: digital)"
                  style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit' }} />
                <button onClick={addCategory}
                  style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  추가
                </button>
              </div>
              <p style={{ fontSize: 10, color: C.muted, margin: '6px 0 0' }}>slug는 상품 카테고리 분류에 사용돼요 (영문 소문자, 숫자, _-만). 한번 만들면 수정은 조심히.</p>
            </div>

            {/* 카테고리 목록 */}
            {categoriesLoading ? (
              <p style={{ textAlign: 'center', color: C.muted, padding: 40, fontSize: 13 }}>불러오는 중...</p>
            ) : (
              <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                {[...categoryRows].sort((a, b) => a.sort_order - b.sort_order).map((c, i, arr) => {
                  const isEditing = editingCatId === c.id;
                  return (
                    <div key={c.id} style={{ padding: '12px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', gap: 10, alignItems: 'center', opacity: c.is_active ? 1 : 0.45 }}>
                      {/* 순서 조정 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                        <button onClick={() => moveCategoryOrder(c.id, 'up')} disabled={i === 0}
                          style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', fontSize: 11, color: i === 0 ? C.border : C.muted, padding: 2 }}>▲</button>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textAlign: 'center' }}>{i + 1}</span>
                        <button onClick={() => moveCategoryOrder(c.id, 'down')} disabled={i === arr.length - 1}
                          style={{ border: 'none', background: 'none', cursor: i === arr.length - 1 ? 'default' : 'pointer', fontSize: 11, color: i === arr.length - 1 ? C.border : C.muted, padding: 2 }}>▼</button>
                      </div>

                      {/* 이모지 + 이름 */}
                      {isEditing ? (
                        <>
                          <input value={editCatForm.emoji} onChange={e => setEditCatForm(f => ({ ...f, emoji: e.target.value }))}
                            maxLength={4}
                            style={{ width: 48, padding: '8px 6px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 18, textAlign: 'center', flexShrink: 0, fontFamily: 'inherit' }} />
                          <input value={editCatForm.name} onChange={e => setEditCatForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="이름" style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', minWidth: 0 }} />
                          <input value={editCatForm.slug} onChange={e => setEditCatForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))}
                            placeholder="slug" style={{ width: 100, padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit' }} />
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 22, width: 40, textAlign: 'center', flexShrink: 0 }}>{c.emoji || '📁'}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: C.text }}>{c.name}</p>
                            <p style={{ fontSize: 11, color: C.sub, margin: '2px 0 0', fontFamily: 'monospace' }}>{c.slug}</p>
                          </div>
                        </>
                      )}

                      {/* 액션 */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => updateCategory(c.id, { slug: editCatForm.slug, name: editCatForm.name, emoji: editCatForm.emoji })}
                              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: C.primary, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              저장
                            </button>
                            <button onClick={() => setEditingCatId(null)}
                              style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: C.sub }}>
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingCatId(c.id); setEditCatForm({ slug: c.slug, name: c.name, emoji: c.emoji }); }}
                              style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: C.sub }}>
                              수정
                            </button>
                            <button onClick={() => updateCategory(c.id, { is_active: !c.is_active })}
                              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: c.is_active ? C.primaryLight : `${C.deal}15`, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: c.is_active ? C.primary : C.deal, fontWeight: 600 }}>
                              {c.is_active ? 'ON' : 'OFF'}
                            </button>
                            <button onClick={() => deleteCategory(c.id)}
                              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: `${C.red}10`, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: C.red }}>
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {categoryRows.length === 0 && (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>등록된 카테고리가 없어요. 위에서 추가해주세요.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ━━━ SNS 탐색 → 인플루언서 서브탭 ━━━ */}
        {tab === 'sns' && snsSubTab === 'influencer' && (
          <div style={{ padding: '20px 20px' }}>
            {/* 설명 */}
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #FF6B35, #FF8C42)', borderRadius: 14, color: '#fff', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>인플루언서 링크 관리</h3>
              <p style={{ fontSize: 12, margin: '6px 0 0', opacity: 0.85, lineHeight: 1.5 }}>
                인포크/링크트리/리틀리 등 인플루언서 쇼핑 링크를 등록하면<br />
                상품 품절 시 여기서 대체 상품 후보를 자동으로 찾아줘요.
              </p>
            </div>

            {/* 등록 폼 */}
            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px', color: C.text }}>➕ 인플루언서 추가</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={infForm.name} onChange={e => setInfForm({ ...infForm, name: e.target.value })}
                  placeholder="인플루언서 이름 (예: 살림남)"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                />
                <input value={infForm.memo} onChange={e => setInfForm({ ...infForm, memo: e.target.value })}
                  placeholder="메모 (선택)"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={infForm.inpock_url} onChange={e => setInfForm({ ...infForm, inpock_url: e.target.value })}
                  placeholder="링크 URL (인포크/링크트리/리틀리/기타)"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                />
                <button onClick={() => infForm.inpock_url.trim() && scrapeInfluencer(infForm.inpock_url)} disabled={scrapeLoading || !infForm.inpock_url.trim()}
                  style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: scrapeLoading ? C.muted : C.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {scrapeLoading ? '감지 중...' : '🔍 감지'}
                </button>
              </div>
              <input value={infForm.profile_url} onChange={e => setInfForm({ ...infForm, profile_url: e.target.value })}
                placeholder="인스타/틱톡 프로필 URL (선택)"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }}
              />
              <button onClick={saveInfluencer} disabled={infSaving}
                style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: infSaving ? C.muted : C.deal, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {infSaving ? '등록 중...' : '등록하기'}
              </button>
              {/* 감지 미리보기 (등록 전) */}
              {scrapeResult && !expandedInfId && (
                <div style={{ marginTop: 12, padding: 12, background: C.bg, borderRadius: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>
                    미리보기: 쇼핑 링크 {scrapeResult.shoppingItems.length}개 / 전체 {scrapeResult.allItems.length}개
                  </p>
                  {scrapeResult.shoppingItems.slice(0, 10).map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: i < 9 ? `1px solid ${C.border}` : 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, background: C.card, overflow: 'hidden', flexShrink: 0 }}>
                        {item.image ? <img src={proxyImg(item.image)} alt="" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                      <p style={{ fontSize: 11, margin: 0, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                      {item.platform && <span style={{ fontSize: 8, color: '#fff', background: item.platform === 'coupang' ? C.coupang : C.sub, padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>{item.platform}</span>}
                    </div>
                  ))}
                  {scrapeResult.shoppingItems.length > 10 && <p style={{ fontSize: 10, color: C.muted, margin: '6px 0 0' }}>+{scrapeResult.shoppingItems.length - 10}개 더</p>}
                </div>
              )}
            </div>

            {/* 등록된 인플루언서 아코디언 */}
            {infLoading && <p style={{ textAlign: 'center', color: C.muted, padding: 20, fontSize: 13 }}>불러오는 중...</p>}
            {influencers.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: C.sub }}>등록된 인플루언서 ({influencers.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {influencers.map(inf => {
                    const isExpanded = expandedInfId === inf.id;
                    return (
                      <div key={inf.id} style={{ background: C.card, borderRadius: 12, border: `1px solid ${isExpanded ? C.primary + '60' : C.border}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                        {/* 인플루언서 헤더 (클릭 영역) */}
                        <div
                          onClick={() => {
                            if (isExpanded) { setExpandedInfId(null); setScrapeResult(null); }
                            else { setExpandedInfId(inf.id); setScrapeResult(null); scrapeInfluencer(inf.inpock_url); }
                          }}
                          style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 17, background: isExpanded ? C.primary + '15' : C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, transition: 'background 0.2s' }}>👤</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: C.text }}>{inf.name}</p>
                              <span style={{ fontSize: 9, fontWeight: 600, color: '#fff', background: inf.platform === 'inpock' ? '#FF6B35' : inf.platform === 'linktree' ? '#43E660' : inf.platform === 'littly' ? '#6C5CE7' : C.sub, padding: '1px 6px', borderRadius: 4 }}>{inf.platform}</span>
                              {inf.inpock_url && (
                                <a href={inf.inpock_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, background: '#FF6B35', color: '#fff', fontSize: 10, fontWeight: 800, textDecoration: 'none', lineHeight: 1 }}
                                  title={inf.inpock_url}>🔗</a>
                              )}
                              {inf.profile_url && (
                                <a href={inf.profile_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', color: '#fff', fontSize: 11, textDecoration: 'none', lineHeight: 1 }}
                                  title={inf.profile_url}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                                </a>
                              )}
                              {inf.memo && <span style={{ fontSize: 10, color: C.sub }}>{inf.memo}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingInfId(editingInfId === inf.id ? null : inf.id); setEditInfForm({ name: inf.name, inpock_url: inf.inpock_url, profile_url: inf.profile_url || '', memo: inf.memo || '' }); }}
                              style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.card, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', color: C.primary, fontWeight: 600 }}>
                              수정
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteInfluencer(inf.id); }}
                              style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: `${C.red}10`, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', color: C.red }}>
                              삭제
                            </button>
                            <span style={{ fontSize: 12, color: C.muted, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                          </div>
                        </div>

                        {/* 인라인 수정 폼 */}
                        {editingInfId === inf.id && (
                          <div onClick={(e) => e.stopPropagation()} style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, background: C.bg }}>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                              <input value={editInfForm.name} onChange={e => setEditInfForm({ ...editInfForm, name: e.target.value })}
                                placeholder="이름" style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                              <input value={editInfForm.memo} onChange={e => setEditInfForm({ ...editInfForm, memo: e.target.value })}
                                placeholder="메모" style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                            </div>
                            <input value={editInfForm.inpock_url} onChange={e => setEditInfForm({ ...editInfForm, inpock_url: e.target.value })}
                              placeholder="링크 URL" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }} />
                            <input value={editInfForm.profile_url} onChange={e => setEditInfForm({ ...editInfForm, profile_url: e.target.value })}
                              placeholder="프로필 URL (선택)" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => updateInfluencer(inf.id)} disabled={infSaving}
                                style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: infSaving ? C.muted : C.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {infSaving ? '저장 중...' : '저장'}
                              </button>
                              <button onClick={() => setEditingInfId(null)}
                                style={{ padding: '8px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: C.sub }}>
                                취소
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 펼쳐진 스크래핑 결과 */}
                        {isExpanded && (
                          <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.border}` }}>
                            {scrapeLoading ? (
                              <p style={{ textAlign: 'center', color: C.muted, padding: '20px 0', fontSize: 12 }}>스캔 중...</p>
                            ) : scrapeResult ? (
                              <div style={{ marginTop: 12 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>
                                  쇼핑 링크 {scrapeResult.shoppingItems.length}개 / 전체 {scrapeResult.allItems.length}개
                                  <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>({scrapeResult.linkType})</span>
                                </p>
                                {scrapeResult.shoppingItems.length > 0 ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                                    {scrapeResult.shoppingItems.map((item, i) => (
                                      <div key={i} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', position: 'relative' }}>
                                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                                          title={item.title}
                                          style={{ display: 'block', width: '100%', aspectRatio: '1', background: C.bg, overflow: 'hidden', cursor: 'pointer' }}>
                                          {item.image ? (
                                            <img src={proxyImg(item.image)} alt={item.title} referrerPolicy="no-referrer"
                                              onError={(e) => { (e.target as HTMLImageElement).src = '/logo-text-only.png'; }}
                                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: C.muted }}>📷</div>
                                          )}
                                        </a>
                                        <div style={{ padding: '6px 8px' }}>
                                          <p style={{ fontSize: 10, fontWeight: 600, margin: 0, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                            {item.platform && (
                                              <span style={{ fontSize: 8, fontWeight: 600, color: '#fff', background: item.platform === 'coupang' ? C.coupang : item.platform === 'naver' ? '#03C75A' : item.platform === 'toss' ? C.toss : C.sub, padding: '1px 5px', borderRadius: 3 }}>{item.platform}</span>
                                            )}
                                            <button onClick={() => openScrapeReg(item.title, item.url, item.image || '', item.platform || '')} disabled={saving}
                                              style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.primary, color: '#fff', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                              등록
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ padding: 16, textAlign: 'center', background: C.bg, borderRadius: 10 }}>
                                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>쇼핑 링크가 없어요.</p>
                                  </div>
                                )}
                                {scrapeResult.allItems.length > scrapeResult.shoppingItems.length && (
                                  <details style={{ marginTop: 10 }}>
                                    <summary style={{ fontSize: 11, color: C.sub, cursor: 'pointer' }}>전체 링크 {scrapeResult.allItems.length}개 보기</summary>
                                    <div style={{ marginTop: 8, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                                      {scrapeResult.allItems.map((item, i) => (
                                        <div key={i} style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                                          <p style={{ margin: 0, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                                          <p style={{ margin: '2px 0 0', fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.url}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* URL 직접 스크래핑 */}
            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px', color: C.text }}>🔍 URL 직접 스크래핑</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !expandedInfId && scrapeInfluencer(scrapeUrl)}
                  placeholder="인포크/링크트리 URL 붙여넣기"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                />
                <button onClick={() => { setExpandedInfId(null); scrapeInfluencer(scrapeUrl); }} disabled={scrapeLoading}
                  style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: scrapeLoading ? C.muted : C.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {scrapeLoading ? '분석 중...' : '분석'}
                </button>
              </div>

              {/* URL 직접 스크래핑 결과 (인플루언서 아코디언이 아닐 때만) */}
              {!expandedInfId && scrapeResult && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>
                    쇼핑 링크 {scrapeResult.shoppingItems.length}개 / 전체 {scrapeResult.allItems.length}개
                    <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>({scrapeResult.linkType})</span>
                  </p>
                  {scrapeResult.shoppingItems.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                      {scrapeResult.shoppingItems.map((item, i) => (
                        <div key={i} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: '100%', aspectRatio: '1', background: C.bg, overflow: 'hidden' }}>
                            {item.image ? (
                              <img src={proxyImg(item.image)} alt={item.title} referrerPolicy="no-referrer"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/logo-text-only.png'; }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: C.muted }}>📷</div>
                            )}
                          </div>
                          <div style={{ padding: '6px 8px' }}>
                            <p style={{ fontSize: 10, fontWeight: 600, margin: 0, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                              {item.platform && (
                                <span style={{ fontSize: 8, fontWeight: 600, color: '#fff', background: item.platform === 'coupang' ? C.coupang : item.platform === 'naver' ? '#03C75A' : item.platform === 'toss' ? C.toss : C.sub, padding: '1px 5px', borderRadius: 3 }}>{item.platform}</span>
                              )}
                              <button onClick={() => openScrapeReg(item.title, item.url, item.image || '', item.platform || '')} disabled={saving}
                                style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.primary, color: '#fff', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                등록
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: 16, textAlign: 'center', background: C.bg, borderRadius: 10 }}>
                      <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>쇼핑 링크가 없어요.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ━━━ 스크래핑 등록 모달 ━━━ */}
      {scrapeRegItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 440, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* 고정 헤더 — 닫기 버튼 항상 보임 */}
            <div style={{ padding: '18px 24px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0, background: C.card, borderRadius: '20px 20px 0 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>상품 등록</h3>
                <p style={{ fontSize: 12, color: C.sub, margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {scrapeRegItem.title}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {scrapeRegItem.url && (
                  <a href={scrapeRegItem.url} target="_blank" rel="noopener noreferrer"
                    title="쿠팡 상품 페이지 새 창으로 열기"
                    style={{ padding: '6px 12px', borderRadius: 8, background: C.coupang, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    🌐 쿠팡 열기
                  </a>
                )}
                <button onClick={() => setScrapeRegItem(null)}
                  aria-label="닫기"
                  style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: C.bg, color: C.sub, fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'inherit' }}>
                  ✕
                </button>
              </div>
            </div>
            {/* 스크롤 영역 */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>

            {/* 실시간 앱 미리보기 */}
            <div style={{ padding: 12, background: C.bg, borderRadius: 12, border: `1px dashed ${C.border}`, marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, margin: '0 0 8px', letterSpacing: 0.5 }}>🔍 앱 미리보기</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {scrapeRegItem.image ? (
                  <img src={proxyImg(scrapeRegItem.image) || scrapeRegItem.image} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', background: C.card, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 12, background: C.card, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📷</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, lineHeight: 1.35 }}>
                    {scrapeRegItem.title || '상품명이 여기 표시돼요'}
                  </p>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'baseline', marginTop: 4 }}>
                    {Number(scrapeRegForm.discount_rate) > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: C.deal }}>{scrapeRegForm.discount_rate}%</span>}
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{Number(scrapeRegForm.sale_price)?.toLocaleString() || '0'}원</span>
                    {Number(scrapeRegForm.original_price) > Number(scrapeRegForm.sale_price) && (
                      <span style={{ fontSize: 11, color: C.muted, textDecoration: 'line-through' }}>{Number(scrapeRegForm.original_price).toLocaleString()}원</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    <PlatformBadge platform={scrapeRegItem.platform || 'coupang'} />
                    <SectionBadge section={scrapeRegForm.section} />
                    {Number(scrapeRegForm.rating) > 0 && (
                      <span style={{ fontSize: 9, color: '#FFB800', fontWeight: 700, background: '#FFF8E1', padding: '2px 6px', borderRadius: 4 }}>
                        ★ {Number(scrapeRegForm.rating).toFixed(1)}{scrapeRegForm.review_count && ` (${Number(scrapeRegForm.review_count).toLocaleString()})`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ━━━ 섹션 1: 기본 정보 ━━━ */}
            <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>📸 기본 정보</div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>상품명</label>
            <input value={scrapeRegItem.title}
              onChange={e => setScrapeRegItem(prev => prev ? { ...prev, title: e.target.value } : prev)}
              placeholder="상품명 (쿠팡 제품명 그대로 또는 편집)"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }}
            />


            {/* 내 제휴 링크 + 검증 결과 실시간 표시 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>내 제휴 링크</label>
            <input
              value={scrapeRegItem.url}
              onChange={e => setScrapeRegItem(prev => prev ? { ...prev, url: e.target.value } : prev)}
              placeholder="Partners API URL 또는 내 간단링크 (link.coupang.com/a/... / coupa.ng/...)"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8, background: '#fff' }}
            />
            {(() => {
              const url = scrapeRegItem.url || '';
              const isCoupang = url.includes('coupang.com') || url.includes('coupa.ng');
              const hasMyTag = url.includes('lptag=AF6507576');
              const isShortLinkA = url.startsWith('https://link.coupang.com/a/');
              const isCoupaNg = url.includes('coupa.ng');
              const isReLink = url.includes('link.coupang.com/re/');
              const otherTag = url.match(/lptag=(AF\d+)/)?.[1];
              const hasOtherTag = !!otherTag && otherTag !== 'AF6507576';
              const isMyLink = isShortLinkA || isCoupaNg || hasMyTag;
              return (
                <div style={{ marginBottom: 12, padding: 10, background: isMyLink ? '#F0FDF4' : hasOtherTag ? '#FEF2F2' : C.bg, borderRadius: 8, border: `1px solid ${isMyLink ? '#86EFAC' : hasOtherTag ? '#FCA5A5' : C.border}` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.sub, margin: '0 0 6px', letterSpacing: 0.3 }}>🛡 링크 검증</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 11, color: isCoupang ? '#16A34A' : C.red, fontWeight: 600 }}>
                      {isCoupang ? '✓' : '✗'} 쿠팡 도메인
                    </span>
                    {isShortLinkA && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ 내 간단링크 (link.coupang.com/a/) — 변환 스킵</span>}
                    {isCoupaNg && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ 내 축약링크 (coupa.ng) — 변환 스킵</span>}
                    {isReLink && hasMyTag && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ Partners API 링크 (RE + 내 태그) — 변환 스킵</span>}
                    {hasMyTag && !isShortLinkA && !isCoupaNg && !isReLink && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ 내 태그 (AF6507576) 포함</span>}
                    {!isMyLink && isCoupang && !hasOtherTag && <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>ℹ️ 태그 없음 — 저장 시 내 링크로 자동 변환</span>}
                    {hasOtherTag && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⛔ 다른 사람 태그 ({otherTag}) — 저장 차단됨</span>}
                    {!isCoupang && url && <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>✗ 쿠팡 URL 아님 — 저장 불가</span>}
                  </div>
                  {isMyLink && (
                    <p style={{ fontSize: 10, color: '#16A34A', margin: '6px 0 0', fontWeight: 600 }}>
                      → 등록 버튼 누르면 바로 저장 (수수료 내게 들어옴)
                    </p>
                  )}
                </div>
              );
            })()}

            {/* 상품 조회 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {scrapeRegItem.image && <img src={proxyImg(scrapeRegItem.image) || scrapeRegItem.image} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 10 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button data-lookup-btn onClick={lookupProduct} disabled={resolving}
                  style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: C.coupang, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: resolving ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  {resolving ? '상품 찾는중...' : '쿠팡 상품 찾기'}
                </button>
                {resolvedCoupangUrl && (
                  <a href={resolvedCoupangUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: C.primary, textDecoration: 'underline' }}>
                    쿠팡에서 직접 확인 →
                  </a>
                )}
              </div>
            </div>

            {/* 썸네일 URL 붙여넣기 또는 드래그&드롭 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: C.sub, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                썸네일 — 쿠팡 이미지 드래그해서 드롭 or URL 붙여넣기
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}
                onDrop={e => {
                  e.preventDefault();
                  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                  if (url) setScrapeRegItem(prev => prev ? { ...prev, image: url } : prev);
                }}
                onDragOver={e => e.preventDefault()}
              >
                <div style={{ width: 56, height: 56, borderRadius: 8, border: `2px dashed ${C.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: C.bg }}>
                  {scrapeRegItem.image ? (
                    <img src={proxyImg(scrapeRegItem.image) || scrapeRegItem.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 9, color: C.muted, textAlign: 'center' }}>이미지<br/>드롭</span>
                  )}
                </div>
                <input
                  type="text"
                  value={scrapeRegItem.image}
                  placeholder="여기에 URL 붙여넣기 or 왼쪽으로 이미지 드래그"
                  onChange={e => setScrapeRegItem(prev => prev ? { ...prev, image: e.target.value } : prev)}
                  onPaste={async (e) => {
                    // 클립보드에 이미지 있으면 아무것도 안 함 (브라우저 기본)
                    // 텍스트라면 기본 동작 (URL 붙여넣기)
                    const items = e.clipboardData.items;
                    for (const item of Array.from(items)) {
                      if (item.type.startsWith('image/')) {
                        e.preventDefault();
                        alert('이미지 파일은 업로드 불가. 이미지 URL을 복사해서 붙여넣거나 드래그해주세요.');
                        return;
                      }
                    }
                  }}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }}
                />
              </div>
              <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>
                우클릭 막혀도 이미지 **드래그** 하거나 F12 → Elements → img src 복사하면 돼요
              </p>
            </div>

            {/* 매칭된 상품 정보 */}
            {matchedProduct && (
              <div style={{ background: '#F8F9FA', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13 }}>
                <p style={{ fontWeight: 700, color: C.text, margin: '0 0 4px', lineHeight: 1.4 }}>
                  {matchedProduct.name.slice(0, 60)}{matchedProduct.name.length > 60 ? '...' : ''}
                </p>
                <p style={{ color: C.sub, margin: 0, fontSize: 12 }}>
                  {matchedProduct.discount > 0 && <span style={{ color: C.deal, fontWeight: 700 }}>{matchedProduct.discount}% </span>}
                  {matchedProduct.price.toLocaleString()}원
                  {matchedProduct.originalPrice > matchedProduct.price && (
                    <span style={{ textDecoration: 'line-through', color: C.muted, marginLeft: 6 }}>{matchedProduct.originalPrice.toLocaleString()}원</span>
                  )}
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>판매가</label>
                <input type="number" placeholder="예: 15900" value={scrapeRegForm.sale_price}
                  onChange={e => setScrapeRegForm(f => ({ ...f, sale_price: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>원가 (선택)</label>
                <input type="number" placeholder="예: 29900" value={scrapeRegForm.original_price}
                  onChange={e => setScrapeRegForm(f => ({ ...f, original_price: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, marginTop: 4 }} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>할인율 (자동계산)</label>
              <input type="number" placeholder="자동" value={scrapeRegForm.discount_rate}
                onChange={e => setScrapeRegForm(f => ({ ...f, discount_rate: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, marginTop: 4 }} />
            </div>

            {/* 별점 + 리뷰수 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: C.sub, fontWeight: 600, display: 'block', marginBottom: 6 }}>⭐ 별점 (반개 단위)</label>
              <StarRating
                size={26}
                value={Number(scrapeRegForm.rating) || 0}
                onChange={v => setScrapeRegForm(f => ({ ...f, rating: String(v) }))}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: C.sub, fontWeight: 600, display: 'block', marginBottom: 4 }}>리뷰 수</label>
              <input type="number" placeholder="예: 14956" value={scrapeRegForm.review_count}
                onChange={e => setScrapeRegForm(f => ({ ...f, review_count: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 4, display: 'block' }}>섹션</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {SECTIONS.map(s => (
                    <button key={s.id} onClick={() => setScrapeRegForm(f => ({ ...f, section: s.id }))}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: scrapeRegForm.section === s.id ? C.primary : C.border,
                        color: scrapeRegForm.section === s.id ? '#fff' : C.sub }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 4, display: 'block' }}>카테고리</label>
                <select value={scrapeRegForm.category}
                  onChange={e => setScrapeRegForm(f => ({ ...f, category: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* 가성비 이유 3가지 — GPT 정리 + 수동 편집 */}
            <div style={{ marginBottom: 20, padding: 14, background: `linear-gradient(135deg, #FFF4D6, #FFE8A8)`, borderRadius: 12 }}>
              <label style={{ fontSize: 12, color: '#7A5F00', fontWeight: 700, display: 'block', marginBottom: 6 }}>✨ 가성비 이유 3가지 (상세 모달 노출)</label>
              <p style={{ fontSize: 10, color: '#7A5F00', margin: '0 0 6px', lineHeight: 1.5 }}>쿠팡 후기 여러 개 복붙 → <b>GPT 3줄 정리</b> 클릭. 비워두면 상품명만으로 GPT가 추측. 안 누르면 아래 3칸에 직접 쓴 게 저장돼요.</p>
              <textarea value={scrapeReviewsRaw} onChange={e => setScrapeReviewsRaw(e.target.value)}
                placeholder="쿠팡 상품페이지에서 후기 여러 개 드래그 → 복사 → 여기 붙여넣기"
                rows={4}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid #E6C366`, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8, background: '#fff' }}
              />
              <button type="button" onClick={async () => {
                setAiSummarizing(true);
                try {
                  const raw = scrapeReviewsRaw.trim() ||
                    [scrapeRegForm.review1, scrapeRegForm.review2, scrapeRegForm.review3].filter(Boolean).join('\n') ||
                    '';
                  const res = await fetch('/api/ai/summarize-reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reviews: raw, productTitle: scrapeRegItem?.title || '' }),
                  });
                  const json = await res.json();
                  if (json.error) { alert('AI 정리 실패: ' + json.error); return; }
                  const h = json.highlights || [];
                  setScrapeRegForm(f => ({ ...f, review1: h[0] || '', review2: h[1] || '', review3: h[2] || '' }));
                } catch (e) { alert('AI 호출 실패: ' + e); }
                setAiSummarizing(false);
              }} disabled={aiSummarizing}
                style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: aiSummarizing ? C.muted : '#7A5F00', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
                {aiSummarizing ? '✨ 정리 중...' : '✨ GPT로 3줄 정리'}
              </button>
              {[
                { key: 'review1' as const, placeholder: '이유 1 (예: 가격 대비 품질이 좋아서 재구매했어요)' },
                { key: 'review2' as const, placeholder: '이유 2 (예: 배송 빠르고 포장도 꼼꼼해요)' },
                { key: 'review3' as const, placeholder: '이유 3 (예: 이 가격에 이 퀄리티 찾기 힘들어요)' },
              ].map(({ key, placeholder }) => (
                <input key={key} type="text" placeholder={placeholder}
                  value={scrapeRegForm[key]}
                  onChange={e => setScrapeRegForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, marginBottom: 6, background: '#fff' }} />
              ))}
            </div>
            </div>
            {/* 고정 푸터 */}
            <div style={{ display: 'flex', gap: 10, padding: '14px 24px', borderTop: `1px solid ${C.border}`, background: C.card, borderRadius: '0 0 20px 20px', flexShrink: 0 }}>
              <button onClick={() => setScrapeRegItem(null)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1px solid ${C.border}`, background: '#fff', fontSize: 14, fontWeight: 600, color: C.sub, cursor: 'pointer', fontFamily: 'inherit' }}>
                취소
              </button>
              <button onClick={confirmScrapeReg} disabled={saving}
                style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: C.primary, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.5 : 1, fontFamily: 'inherit' }}>
                {saving ? '등록 중...' : '내 제휴링크로 등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ 수정 모달 ━━━ */}
      {editProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 20px' }}>상품 수정</h3>

            <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>상품명</label>
            <input value={editProduct.title} onChange={e => setEditProduct({ ...editProduct, title: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12, marginTop: 4 }}
            />

            <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'flex', alignItems: 'center', gap: 6 }}>
              제휴 링크
              {editProduct.affiliate_url.includes('lptag=AF6507576') || editProduct.affiliate_url.startsWith('https://link.coupang.com/a/') ? (
                <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 700 }}>✓ 내 파트너스 링크</span>
              ) : editProduct.affiliate_url.match(/lptag=AF\d+/) ? (
                <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 700 }}>⛔ 다른 사람 링크</span>
              ) : null}
            </label>
            <input value={editProduct.affiliate_url} onChange={e => setEditProduct({ ...editProduct, affiliate_url: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12, marginTop: 4 }}
            />

            <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>이미지 URL</span>
              <button type="button" onClick={async () => {
                if (!editProduct.affiliate_url) return;
                const isToss = /toss\.im\/_m\/|shopping\.toss\.im/.test(editProduct.affiliate_url);
                const isKurly = /kurly\.com/.test(editProduct.affiliate_url);
                try {
                  if (isToss || isKurly) {
                    const endpoint = isToss ? '/api/toss-product-info' : '/api/kurly-product-info';
                    const platformLabel = isToss ? '토스쇼핑' : '컬리';
                    const res = await fetch(endpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: editProduct.affiliate_url }),
                    });
                    const json = await res.json();
                    const d = json?.data;
                    if (d?.image_url) {
                      setEditProduct({
                        ...editProduct,
                        image_url: d.image_url,
                        title: editProduct.title || d.title || '',
                        platform: isToss ? 'toss' : 'kurly',
                      });
                      alert(`✅ ${platformLabel} 이미지 불러왔어요`);
                    } else {
                      alert(`⚠️ ${platformLabel} 조회 실패`);
                    }
                    return;
                  }
                  if (!editProduct.title) return;
                  // product-info API: 축약링크 풀어서 productId 추출 후 정확 매칭
                  const res = await fetch('/api/coupang/product-info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: editProduct.affiliate_url, title: editProduct.title }),
                  });
                  const json = await res.json();
                  const image = json?.data?.image;
                  if (image) {
                    setEditProduct({ ...editProduct, image_url: image });
                    alert('✅ 썸네일 자동 조회 완료');
                  } else {
                    alert('⚠️ 매칭되는 상품을 못 찾음. 수동으로 입력해주세요.');
                  }
                } catch {
                  alert('조회 실패');
                }
              }}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: C.coupang, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                🔍 썸네일 자동 조회
              </button>
            </label>
            {editProduct.image_url && (
              <div style={{ marginTop: 4 }}>
                <img src={proxyImg(editProduct.image_url) || editProduct.image_url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
              </div>
            )}
            <input value={editProduct.image_url || ''} onChange={e => setEditProduct({ ...editProduct, image_url: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12, marginTop: 4 }}
            />

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>섹션</label>
                <select value={editProduct.section} onChange={e => setEditProduct({ ...editProduct, section: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', marginTop: 4 }}>
                  {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {editProduct.section === 'ranking' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: C.text, cursor: 'pointer', padding: '6px 8px', background: editProduct.pinned ? `${C.primary}12` : C.bg, borderRadius: 6 }}>
                    <input type="checkbox" checked={!!editProduct.pinned}
                      onChange={e => setEditProduct({ ...editProduct, pinned: e.target.checked })}
                      style={{ cursor: 'pointer' }} />
                    <span style={{ fontWeight: 600 }}>📌 핀 고정 {editProduct.pinned ? '(영구)' : '(24h)'}</span>
                  </label>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>카테고리</label>
                <select value={editProduct.category} onChange={e => setEditProduct({ ...editProduct, category: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', marginTop: 4 }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>플랫폼</label>
                <select value={editProduct.platform} onChange={e => setEditProduct({ ...editProduct, platform: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', marginTop: 4 }}>
                  {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>판매가</label>
                <input type="number" value={editProduct.sale_price}
                  onChange={e => {
                    const sp = Number(e.target.value);
                    const op = editProduct.original_price;
                    const dr = op > sp && sp > 0 ? Math.round((1 - sp / op) * 100) : 0;
                    setEditProduct({ ...editProduct, sale_price: sp, discount_rate: dr });
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>원가</label>
                <input type="number" value={editProduct.original_price}
                  onChange={e => {
                    const op = Number(e.target.value);
                    const sp = editProduct.sale_price;
                    const dr = op > sp && sp > 0 ? Math.round((1 - sp / op) * 100) : 0;
                    setEditProduct({ ...editProduct, original_price: op, discount_rate: dr });
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4 }}
                />
              </div>
              <div style={{ width: 80 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>할인% (자동)</label>
                <input type="number" value={editProduct.discount_rate} readOnly
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4, background: C.bg, color: C.sub }}
                />
              </div>
            </div>

            {/* 별점 + 후기수 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 6 }}>별점</label>
              <StarRating
                size={24}
                value={Number(editProduct.rating) || 0}
                onChange={v => setEditProduct({ ...editProduct, rating: v })}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 6 }}>후기 수</label>
              <input type="number" value={editProduct.review_count ?? 0}
                onChange={e => setEditProduct({ ...editProduct, review_count: Number(e.target.value) || 0 })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            {/* 가성비 이유 3가지 — GPT 정리 + 수동 편집 */}
            <div style={{ marginBottom: 20, padding: 14, background: `linear-gradient(135deg, #FFF4D6, #FFE8A8)`, borderRadius: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#7A5F00', display: 'block', marginBottom: 6 }}>✨ 가성비 이유 3가지</label>
              <textarea value={editReviewsRaw} onChange={e => setEditReviewsRaw(e.target.value)}
                placeholder="쿠팡 후기 복붙 (선택)"
                rows={2}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 6 }}
              />
              <button type="button" onClick={async () => {
                setEditAiSummarizing(true);
                try {
                  const res = await fetch('/api/ai/summarize-reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reviews: editReviewsRaw || `상품명만 있음: ${editProduct.title}`, productTitle: editProduct.title }),
                  });
                  const json = await res.json();
                  if (json.error) { alert('AI 정리 실패: ' + json.error); return; }
                  const h = json.highlights || [];
                  setEditProduct(p => p ? { ...p, review_highlights: [h[0] || '', h[1] || '', h[2] || ''] } : p);
                } catch (e) { alert('AI 호출 실패: ' + e); }
                setEditAiSummarizing(false);
              }} disabled={editAiSummarizing}
                style={{ width: '100%', padding: '8px 0', borderRadius: 6, border: 'none', background: editAiSummarizing ? C.muted : '#7A5F00', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
                {editAiSummarizing ? '✨ 정리 중...' : '✨ GPT로 3줄 정리'}
              </button>
              {[0, 1, 2].map(i => {
                const highlights: string[] = Array.isArray(editProduct.review_highlights) ? editProduct.review_highlights as string[] : [];
                return (
                  <input key={i} type="text" value={highlights[i] || ''}
                    onChange={e => {
                      const next: string[] = [...(highlights.length >= 3 ? highlights : [...highlights, '', '', ''].slice(0, 3))];
                      next[i] = e.target.value;
                      setEditProduct({ ...editProduct, review_highlights: next });
                    }}
                    placeholder={`이유 ${i + 1}`}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 5, background: '#fff' }}
                  />
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditProduct(null)}
                style={{ flex: 1, padding: '14px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: C.sub }}>
                취소
              </button>
              <button onClick={() => updateProduct(editProduct)}
                style={{ flex: 2, padding: '14px 0', borderRadius: 10, border: 'none', background: C.primary, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ━━━ 대체 추천 모달 ━━━ */}
      {suggestProductId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { setSuggestProductId(null); setSuggestions([]); }}>
          <div style={{ background: C.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>🔄 대체 상품 추천</h3>
              <button onClick={() => { setSuggestProductId(null); setSuggestions([]); }}
                style={{ border: 'none', background: C.bg, padding: '4px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: C.sub, fontFamily: 'inherit' }}>닫기</button>
            </div>

            {suggestLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 14, color: C.muted }}>🔍 쿠팡 + 인플루언서에서 찾는 중...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 14, color: C.muted }}>추천 상품을 찾지 못했어요</p>
                <p style={{ fontSize: 12, color: C.sub }}>검색 탭에서 직접 검색해보세요</p>
              </div>
            ) : (
              <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
                    {s.image ? (
                      <img src={s.image} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: C.bg }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: C.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📷</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                      <div style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: '#fff', padding: '1px 6px', borderRadius: 4, background: s.source === 'coupang' ? C.coupang : C.deal }}>
                          {s.source === 'coupang' ? '쿠팡' : s.influencerName || '인플루언서'}
                        </span>
                        {s.price && s.price > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{s.price.toLocaleString()}원</span>}
                        {s.discount && s.discount > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: C.deal }}>{s.discount}%</span>}
                      </div>
                    </div>
                    <button onClick={() => {
                      addFromSearch({ productId: '', productName: s.title, productPrice: s.price || 0, productImage: s.image || '', productUrl: s.url, categoryName: '', originalPrice: 0, discountRate: s.discount || 0 });
                      setSuggestProductId(null); setSuggestions([]);
                    }} disabled={saving}
                      style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      등록
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
