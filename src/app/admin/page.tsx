'use client';

import { useState, useEffect, useCallback } from 'react';

const ADMIN_PASSWORD = 'star888!!!';

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
  { id: 'food', name: '식품' },
  { id: 'electronics', name: '전자기기' },
  { id: 'fashion', name: '패션' },
  { id: 'beauty', name: '뷰티' },
  { id: 'baby', name: '육아' },
  { id: 'health', name: '건강' },
  { id: 'pet', name: '반려동물' },
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

type TabId = 'products' | 'influencers' | 'sns' | 'goldbox' | 'search' | 'guide';

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

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('admin_auth') === 'true';
    return false;
  });
  const [pw, setPw] = useState('');
  const [tab, setTab] = useState<TabId>('products');
  const [showAddForm, setShowAddForm] = useState(false);

  // 상품 관리
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [filterSection, setFilterSection] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<{ checked: number; issues: number; healthy: number; results: { id: number; title: string; issue: string; action: string; severity: string }[]; checkedAt: string } | null>(null);

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
  });
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
  const [scrapeRegForm, setScrapeRegForm] = useState({ sale_price: '', original_price: '', discount_rate: '', section: 'recommend', category: 'all' });

  // 대체 추천
  const [suggestProductId, setSuggestProductId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

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
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && pw === ADMIN_PASSWORD) { sessionStorage.setItem('admin_auth', 'true'); setAuthed(true); } }}
            placeholder="비밀번호"
            style={{ width: '100%', padding: '14px 16px', fontSize: 15, borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <button onClick={() => { if (pw === ADMIN_PASSWORD) { sessionStorage.setItem('admin_auth', 'true'); setAuthed(true); } }}
            style={{ width: '100%', marginTop: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, borderRadius: 12, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            로그인
          </button>
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
        }),
      });
      const json = await res.json();
      if (json.data) {
        setForm({ title: '', image_url: '', affiliate_url: '', platform: 'coupang', category: 'all', section: 'recommend', sale_price: '', original_price: '', discount_rate: '' });
        setShowAddForm(false);
        loadProducts();
      }
    } catch (e) {
      alert('등록 실패: ' + e);
    }
    setSaving(false);
  }

  async function updateProduct(p: Product) {
    try {
      await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      loadProducts();
      setEditProduct(null);
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

    const orders = sameSection.map((item, i) => {
      if (i === idx) return { id: item.id, sort_order: swapIdx };
      if (i === swapIdx) return { id: item.id, sort_order: idx };
      return { id: item.id, sort_order: i };
    });

    await fetch('/api/products/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    });
    loadProducts();
  }

  // 골드박스에서 바로 등록
  async function addFromGoldbox(item: GoldboxItem) {
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
          section: 'ranking',
          sale_price: item.productPrice,
          original_price: item.originalPrice,
          discount_rate: item.discountRate,
        }),
      });
      loadProducts();
      alert(`"${item.productName.slice(0, 20)}..." 랭킹에 등록했어요!`);
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
    // 생활 (가장 넓은 범위 — 디폴트 전에)
    if (/청소|세탁|수납|정리|욕실|주방|냄비|프라이팬|그릇|컵|행거|빨래|걸레|휴지|물티슈|방향제|제습|선풍기|에어컨|가습기|조명|커튼|매트|쿠션/.test(t)) return 'living';
    return 'all';
  }

  function openScrapeReg(title: string, url: string, image: string, platform: string) {
    if (!url.includes('coupang.com')) {
      alert(`⚠️ 쿠팡 외 링크(${platform})는 자동 등록 불가해요.\n쿠팡에서 같은 상품을 검색해서 등록하세요.`);
      return;
    }
    const autoCategory = autoDetectCategory(title);
    setScrapeRegItem({ title, url, image, platform });
    setScrapeRegForm({ sale_price: '', original_price: '', discount_rate: '', section: 'recommend', category: autoCategory });
  }

  // 스크래핑 등록 — 가격 자동 조회
  async function lookupPrice() {
    if (!scrapeRegItem) return;
    setSaving(true);
    try {
      // 상품명에서 숫자/특수문자 제거하고 핵심 키워드로 검색
      const kw = scrapeRegItem.title
        .replace(/^\d+[\.\-\s]*/, '') // 앞 번호 제거
        .replace(/[★✨🔥⭐\[\]()（）]/g, '')
        .trim()
        .slice(0, 30);
      const res = await fetch(`/api/coupang/search?keyword=${encodeURIComponent(kw)}&limit=3`);
      const json = await res.json();
      const items = json?.data?.productData || json?.data || [];
      if (items.length > 0) {
        const best = items[0];
        setScrapeRegForm(f => ({
          ...f,
          sale_price: String(best.productPrice || ''),
          original_price: String(best.originalPrice || best.productPrice || ''),
          discount_rate: String(best.discountRate || ''),
        }));
      } else {
        alert('검색 결과가 없어요. 직접 입력해주세요.');
      }
    } catch {
      alert('가격 조회 실패. 직접 입력해주세요.');
    }
    setSaving(false);
  }

  // 스크래핑 등록 — 2단계: 확정
  async function confirmScrapeReg() {
    if (!scrapeRegItem) return;
    setSaving(true);
    try {
      const dlRes = await fetch('/api/coupang/deeplink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [scrapeRegItem.url] }),
      });
      const dlJson = await dlRes.json();
      const myLink = dlJson?.data?.[0]?.shortenUrl;
      if (!myLink) {
        alert('딥링크 변환 실패. 쿠팡 검색 탭에서 직접 등록해주세요.');
        setSaving(false);
        return;
      }
      const sp = Number(scrapeRegForm.sale_price) || 0;
      const op = Number(scrapeRegForm.original_price) || sp;
      const dr = Number(scrapeRegForm.discount_rate) || (op > sp && sp > 0 ? Math.round((1 - sp / op) * 100) : 0);
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scrapeRegItem.title,
          image_url: scrapeRegItem.image || null,
          affiliate_url: myLink,
          platform: 'coupang',
          category: scrapeRegForm.category,
          section: scrapeRegForm.section,
          sale_price: sp,
          original_price: op,
          discount_rate: dr,
        }),
      });
      loadProducts();
      alert(`✅ "${scrapeRegItem.title.slice(0, 20)}..." 등록 완료!`);
      setScrapeRegItem(null);
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
      const res = await fetch(`/api/coupang/search?keyword=${encodeURIComponent(keyword)}`);
      const json = await res.json();
      setSearchData(json.data || []);
    } catch (e) {
      alert('검색 실패: ' + e);
    }
    setSearchLoading(false);
  }

  /* ─── 인플루언서 로드 ─────────────────────────── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (authed && tab === 'influencers') loadInfluencers(); }, [authed, tab]);

  const loadInfluencers = useCallback(async () => {
    setInfLoading(true);
    try {
      const res = await fetch('/api/influencers');
      const json = await res.json();
      setInfluencers(json.data || []);
    } catch { setInfluencers([]); }
    setInfLoading(false);
  }, []);

  async function saveInfluencer() {
    if (!infForm.name.trim() || !infForm.inpock_url.trim()) { alert('이름과 링크는 필수!'); return; }
    setInfSaving(true);
    try {
      await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(infForm),
      });
      setInfForm({ name: '', inpock_url: '', profile_url: '', memo: '' });
      loadInfluencers();
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
    { id: 'influencers', label: '인플루언서', count: influencers.length },
    { id: 'sns', label: 'SNS 발굴' },
    { id: 'goldbox', label: '골드박스', count: goldboxData.length },
    { id: 'search', label: '검색', count: searchData.length },
    { id: 'guide', label: '가이드' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard Variable", system-ui, sans-serif', paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            다있어 <span style={{ color: C.primary }}>Admin</span>
          </h1>
          <div style={{ display: 'flex', gap: 6 }}>
            {PLATFORMS.map(p => (
              <span key={p.id} style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: p.color, padding: '2px 6px', borderRadius: 4 }}>{p.name}</span>
            ))}
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

        {/* ━━━ 상품 관리 탭 ━━━ */}
        {tab === 'products' && (
          <div>
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
              <button onClick={() => { setShowAddForm(v => !v); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: 'none', background: showAddForm ? C.red : C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', position: 'relative', zIndex: 10 }}>
                {showAddForm ? '✕ 닫기' : '+ 상품 등록'}
              </button>
            </div>

            {/* ━━━ 인라인 등록 폼 (상단) ━━━ */}
            {showAddForm && (
              <div style={{ padding: '20px', margin: '0 16px 16px', background: C.card, borderRadius: 16, border: `2px solid ${C.primary}`, boxShadow: '0 4px 20px rgba(49,130,246,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: C.text }}>✏️ 새 상품 등록</h2>
                  <button onClick={() => setShowAddForm(false)} style={{ border: 'none', background: C.bg, padding: '4px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: C.sub, fontFamily: 'inherit' }}>닫기</button>
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

            {/* 이미지 URL */}
            <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>이미지 URL</label>
            <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://... (없으면 비워두세요)"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 14 }}
            />

            {/* 가격 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>판매가</label>
                <input type="number" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })}
                  placeholder="11900"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>원가</label>
                <input type="number" value={form.original_price} onChange={e => setForm({ ...form, original_price: e.target.value })}
                  placeholder="16800"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ width: 80 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>할인%</label>
                <input type="number" value={form.discount_rate} onChange={e => setForm({ ...form, discount_rate: e.target.value })}
                  placeholder="29"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
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

            {/* 상품 리스트 */}
            {productsLoading ? (
              <p style={{ textAlign: 'center', color: C.muted, padding: 40 }}>불러오는 중...</p>
            ) : filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ fontSize: 40, margin: 0 }}>📦</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 12 }}>등록된 상품이 없어요</p>
                <p style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>상품을 등록하면 앱과 웹에 바로 반영돼요</p>
                <button onClick={() => { setShowAddForm(true); }}
                  style={{ marginTop: 16, padding: '12px 24px', borderRadius: 10, border: 'none', background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', position: 'relative', zIndex: 10 }}>
                  첫 상품 등록하기
                </button>
              </div>
            ) : (
              <div style={{ background: C.card, borderRadius: 16, margin: '0 16px 24px', overflow: 'hidden', border: `1px solid ${C.border}` }}>
                {filteredProducts.map((p, i) => (
                  <div key={p.id} style={{
                    display: 'flex', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'center',
                    opacity: p.is_active ? 1 : 0.4,
                  }}>
                    {/* 순서 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => moveOrder(p, 'up')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: C.muted, padding: 2 }}>▲</button>
                      <span style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? C.primary : C.muted, textAlign: 'center' }}>{i + 1}</span>
                      <button onClick={() => moveOrder(p, 'down')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: C.muted, padding: 2 }}>▼</button>
                    </div>

                    {/* 이미지 */}
                    {p.image_url ? (
                      <img src={p.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', background: C.bg, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 10, background: C.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
                    )}

                    {/* 정보 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{p.title}</p>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        <PlatformBadge platform={p.platform} />
                        <SectionBadge section={p.section} />
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
                      <button onClick={() => setEditProduct({ ...p })}
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
                ))}
              </div>
            )}
          </div>
        )}

        {/* ━━━ SNS 발굴 탭 ━━━ */}
        {tab === 'sns' && (
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

        {/* ━━━ 골드박스 탭 ━━━ */}
        {tab === 'goldbox' && (
          <div>
            <div style={{ padding: '20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <PlatformBadge platform="coupang" />
                <span style={{ fontSize: 13, color: C.sub }}>쿠팡 실시간 인기 상품 → 바로 등록</span>
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
                    <button onClick={() => addFromGoldbox(item)} disabled={saving}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      랭킹 등록
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ━━━ 검색 탭 ━━━ */}
        {tab === 'search' && (
          <div>
            <div style={{ padding: '20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <PlatformBadge platform="coupang" />
                <span style={{ fontSize: 13, color: C.sub }}>쿠팡 검색 → 바로 등록</span>
              </div>
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
                {searchData.map((item, i) => (
                  <div key={item.productId || i} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
                    <img src={item.productImage} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', background: C.bg, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{item.productName}</p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                        {item.discountRate > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: C.deal }}>{item.discountRate}%</span>}
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{item.productPrice?.toLocaleString()}원</span>
                      </div>
                    </div>
                    <button onClick={() => addFromSearch(item)} disabled={saving}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      추천 등록
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ━━━ 인플루언서 탭 ━━━ */}
        {tab === 'influencers' && (
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

        {/* ━━━ 가이드 탭 ━━━ */}
        {tab === 'guide' && (
          <div style={{ padding: '20px 16px' }}>
            <div style={{ padding: '20px 24px', background: `linear-gradient(135deg, ${C.primary}, #1B6CF2)`, borderRadius: 16, color: '#fff', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>상품 등록 → 앱/웹 반영</h2>
              <p style={{ fontSize: 13, margin: '8px 0 0', opacity: 0.85, lineHeight: 1.55 }}>
                어드민에서 상품을 등록하면 앱과 웹에 바로 반영돼요.<br />
                섹션별로 배치하고, 순서도 자유롭게 변경할 수 있어요.
              </p>
            </div>

            {[
              { title: '섹션 설명', items: [
                { label: '랭킹', desc: '앱 홈 "다들 이거 사고 있어요" 캐러셀 + 웹 상단', color: C.deal },
                { label: '추천', desc: '앱 홈 하단 리스트 + 웹 메인 그리드', color: C.primary },
                { label: '득템', desc: '앱 "득템" 탭 + 웹 할인 페이지', color: C.green },
              ]},
              { title: '플랫폼별 링크', items: [
                { label: '쿠팡', desc: '골드박스/검색에서 바로 등록 또는 수동 입력. API가 내 제휴 링크 자동 생성', color: C.coupang },
                { label: '토스쇼핑', desc: '제휴 사이트에서 복사한 내 링크를 그대로 등록', color: C.toss },
                { label: '컬리', desc: '컬리 제휴 페이지에서 복사한 내 링크를 그대로 등록', color: C.kurly },
                { label: '테무', desc: '테무 제휴 프로그램에서 복사한 내 링크를 그대로 등록', color: C.temu },
              ]},
              { title: '사용 팁', items: [
                { label: '순서 변경', desc: '상품 관리에서 ▲▼ 버튼으로 순서를 바꿀 수 있어요', color: C.sub },
                { label: 'ON/OFF', desc: '상품을 숨기거나 보이게 할 수 있어요 (삭제하지 않고)', color: C.sub },
                { label: '자동 수집', desc: '골드박스 탭에서 쿠팡 인기 상품을 클릭 한번으로 등록', color: C.sub },
              ]},
            ].map(group => (
              <div key={group.title} style={{ background: C.card, borderRadius: 16, marginBottom: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: C.text }}>{group.title}</h3>
                </div>
                {group.items.map(item => (
                  <div key={item.label} style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 4, height: 16, borderRadius: 2, background: item.color, flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: C.text }}>{item.label}</p>
                      <p style={{ fontSize: 12, color: C.sub, margin: '2px 0 0', lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ━━━ 스크래핑 등록 모달 ━━━ */}
      {scrapeRegItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setScrapeRegItem(null)}>
          <div style={{ background: C.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 440 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>상품 등록</h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px', lineHeight: 1.4 }}>{scrapeRegItem.title.slice(0, 60)}{scrapeRegItem.title.length > 60 ? '...' : ''}</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {scrapeRegItem.image && <img src={proxyImg(scrapeRegItem.image)} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 10 }} />}
              <button onClick={lookupPrice} disabled={saving}
                style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: C.green, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                {saving ? '조회중...' : '쿠팡 가격 조회'}
              </button>
            </div>

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

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>할인율 (자동계산)</label>
              <input type="number" placeholder="자동" value={scrapeRegForm.discount_rate}
                onChange={e => setScrapeRegForm(f => ({ ...f, discount_rate: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, marginTop: 4 }} />
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

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setScrapeRegItem(null)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1px solid ${C.border}`, background: '#fff', fontSize: 14, fontWeight: 600, color: C.sub, cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={confirmScrapeReg} disabled={saving}
                style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: C.primary, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? '등록 중...' : '내 제휴링크로 등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ 수정 모달 ━━━ */}
      {editProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setEditProduct(null)}>
          <div style={{ background: C.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 20px' }}>상품 수정</h3>

            <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>상품명</label>
            <input value={editProduct.title} onChange={e => setEditProduct({ ...editProduct, title: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12, marginTop: 4 }}
            />

            <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>제휴 링크</label>
            <input value={editProduct.affiliate_url} onChange={e => setEditProduct({ ...editProduct, affiliate_url: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12, marginTop: 4 }}
            />

            <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>이미지 URL</label>
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
                <input type="number" value={editProduct.sale_price} onChange={e => setEditProduct({ ...editProduct, sale_price: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>원가</label>
                <input type="number" value={editProduct.original_price} onChange={e => setEditProduct({ ...editProduct, original_price: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4 }}
                />
              </div>
              <div style={{ width: 80 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>할인%</label>
                <input type="number" value={editProduct.discount_rate} onChange={e => setEditProduct({ ...editProduct, discount_rate: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4 }}
                />
              </div>
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
