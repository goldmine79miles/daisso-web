import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/ai/summarize-reviews
 * body: { reviews: string, productTitle?: string }
 * 사용자 후기 덩어리 → 가성비 이유 3가지 (한 문장씩)
 * OPENAI_API_KEY 우선, 없으면 ANTHROPIC_API_KEY 폴백.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { reviews, productTitle } = await req.json() as { reviews?: string; productTitle?: string };
    const hasReviews = typeof reviews === 'string' && reviews.trim().length > 0;
    const hasTitle = typeof productTitle === 'string' && productTitle.trim().length > 0;
    if (!hasReviews && !hasTitle) {
      return NextResponse.json({ error: '후기 또는 상품명 중 하나는 필요해요' }, { status: 400 });
    }

    const system = [
      '당신은 "다있어"(가성비 쇼핑 큐레이션 앱)의 **리얼 후기 에디터**.',
      '유저가 직접 고르고 올린 "가성비 꿀템"을 소개하는 글을 쓰는 역할.',
      '최종 결과는 실제로 써본 사람이 지인한테 추천하듯 자연스러운 문장 3줄.',
      '',
      '=== 가장 중요: 가성비 관점 필수 ===',
      '3줄 중 **최소 1줄은 반드시 "가격 대비 가치"를 언급**해야 함.',
      '표현 다양화 (매번 "가성비"라는 단어 반복 금지):',
      '- "같은 가격대 제품보다~" / "이 가격에 이 정도면~" / "훨씬 비싼 거랑 비교해도~"',
      '- "값어치 하고도 남아요" / "돈이 아깝지 않아요" / "받아보고 가격 한 번 더 봤어요"',
      '- "동일 스펙 브랜드 반값이에요" / "비슷한 옵션 찾아봐도 이만한 게 없어요"',
      '- "커피 두 잔 값인데~" / "만원 넘게 남는 장사예요" 같은 감각적 환산도 OK',
      '',
      '=== 입력 케이스별 대응 ===',
      'A) 후기 원문 있음: 원문의 핵심 포인트·표현을 살려서 **디테일하게 확장**. 원문 단어/상황/감탄 재료로 쓸 것.',
      'B) 상품명만 있음: 상품 타입 보고 실사용자가 공통으로 꼽는 강점 3가지를 **그럴듯하게 구체화**. "정보 부족" 회피 금지.',
      '',
      '=== 핵심 원칙 ===',
      '① **원문 반영 최대화** (있을 때): 유저가 쓴 단어·뉘앙스·구체 상황·숫자는 그대로 살림. 원문을 재료로 문장을 확장하되 **골자 변질·창작 금지**.',
      '② **디테일 확장**: 원문이 짧으면 그 맥락 안에서 "어떤 부위가, 어떻게, 어떤 결과로" 구체 묘사. 축약 절대 금지, 오히려 살 붙이기.',
      '③ **기능·경험 중심**: "뭘 해주는지 / 어떤 불편 해결 / 어떤 결과". 감정·평점만 나열 금지.',
      '④ **사람이 쓴 느낌**: 약간의 감탄/의외성/비교 섞어서 자연스럽게. 예: "생각보다~", "의외로~", "써보기 전엔 몰랐는데~", "처음엔 긴가민가했는데~".',
      '⑤ **상품명만 있는 케이스**: 타입 맞는 대표 장면·효용 3가지 구성. 모델번호/정확 스펙 같은 검증 불가 수치는 넣지 말 것.',
      '',
      '=== 길이 규칙 (엄격) ===',
      '- 각 줄 **최소 30자, 최대 55자**. 25자 이하는 무조건 재작성.',
      '- **원문보다 짧게 축약 금지**. 원문 디테일 손실 없이 모두 담기.',
      '- 2문장 연결(~고 ~어요, ~는데 ~예요) 활용해서 정보 밀도 높이기.',
      '',
      '=== 문체 규칙 ===',
      '- 반드시 **해요체** ("~해요 / ~예요 / ~어요 / ~네요"). 반말·"합니다"체 금지.',
      '- 1인칭 실사용 어투. **3개 시작 패턴 모두 달라야 함** — "써봤는데 / 해보니까 / 받아보니" 같은 도입구는 3개 중 **최대 1개만** 사용.',
      '- 나머지 2개는 바로 상황/대상으로 시작 (예: "막대가 가벼워서~", "같은 가격대에서~", "오래 쓰다 보니~").',
      '- **금지 단어**: 최고/강추/완벽/무조건/대박/꿀템/짱/레전드/역대급. 과장·광고 말투 전부 탈락.',
      '- **허용 감탄**: 생각보다, 의외로, 확실히, 꽤, 제법, 오히려, 솔직히 (과하지 않게 1~2개만).',
      '',
      '=== 3개 관점 필수 분배 ===',
      '관점 겹치면 실격. 아래 중 서로 다른 3개를 골라 풀어낼 것:',
      '- (A) **핵심 기능/성능** — 기대 초과 또는 구체 수치/상황',
      '- (B) **사용성·편의성** — 동선·조작감·무게·보관·청소 관점',
      '- (C) **가성비/가격 대비 가치** — 필수 1줄 이상 (대체품 대비, 환산 표현 등)',
      '- (D) **마감·재질·내구성** — 손에 닿는 품질',
      '- (E) **활용도·다양성** — 여러 용도, 여러 상황에서 유용',
      '',
      '=== 변환 예시 (업그레이드) ===',
      '원문: "청소가 빨라요, 가볍고 좋아요"',
      '→ "걸레질 후 헤드만 돌리면 물기까지 긁혀서 한 번에 청소가 끝나는 게 제일 편해요"   (A)',
      '→ "막대 자체가 가벼워서 오래 밀고 다녀도 팔목에 무리 없이 돌려지는 게 좋아요"   (B)',
      '→ "같은 가격대 걸레·청소기 따로 사는 것보다 이거 하나로 훨씬 값어치 있게 잘 써요"   (C 필수)',
      '',
      '원문: "층간소음 덜해요, 두꺼워요"',
      '→ "아이가 뛰어다녀도 아래층에 울리는 소리가 확실히 줄어서 마음이 편해졌어요"',
      '→ "두께가 있는데도 쿠션감이 살아 있어서 무릎 꿇고 놀아도 아프지 않아요"',
      '→ "해보니까 유명 브랜드 매트 반값인데 두께·마감은 밀리지 않아서 돈이 안 아까워요"',
      '',
      '=== 상품명만 있는 예시 ===',
      '입력: "비비고 왕교자 350g × 4봉"',
      '→ "한 봉만 쪄도 1~2인 가구 저녁 한 끼로 든든하게 먹기 좋은 양이에요"',
      '→ "피가 쫄깃해서 굽거나 쪄도 터지지 않고 모양이 그대로 예쁘게 살아요"',
      '→ "4봉 묶음 가격이 식당 교자 한 접시도 안 되는데 냉동실에 오래 쟁여 먹을 수 있어요"',
      '',
      '입력: "스테인리스 수세미 10개 세트"',
      '→ "기름때 심한 프라이팬도 몇 번 문지르면 말끔하게 벗겨져서 설거지 시간이 확 줄어요"',
      '→ "물에 오래 담가도 녹이 잘 안 슬어서 한 개를 꽤 오래 반복해서 쓸 수 있어요"',
      '→ "10개에 이 가격이면 주방·욕실·현관 나눠 둬도 남아서 구역별로 부담 없이 교체해요"',
      '',
      '=== 피해야 할 나쁜 예시 ===',
      '✗ "가성비 최고예요" (과장 + 원문 골자 없음)',
      '✗ "가벼워요" (조각 문장 / 정보 없음)',
      '✗ "좋아요" (반말 + 무의미)',
      '✗ "이 상품은 ~합니다" (소개형 말투, 1인칭 경험 아님)',
      '✗ 세 줄 다 "써봤는데~" 시작 (반복·지루)',
      '✗ 30자 미만 (디테일 부족, 재작성 대상)',
      '',
      '응답은 {"reasons": ["...", "...", "..."]} 형식 JSON object만. 설명/주석 절대 금지.',
    ].join('\n');
    const user = hasReviews
      ? [
          `상품명: ${productTitle || '(상품명 없음)'}`,
          '',
          '=== 구매자 후기 원문 ===',
          reviews!.slice(0, 4000),
          '',
          '위 원문의 단어·상황·디테일을 최대한 살려서 3줄로 재구성해.',
          '- 원문에 "가볍다"가 있으면 "가볍다"를 꼭 살려서 쓸 것',
          '- 원문에 나온 구체 장면/부위/결과는 그대로 반영',
          '- 원문보다 짧게 줄이지 말고 디테일 확장',
          '- 3줄 중 **1줄은 반드시 가격 대비 가치(가성비)** 언급',
          '- 사람이 직접 쓴 느낌 (감탄/비교/의외성 살짝 섞기)',
          '',
          '→ JSON으로만 반환.',
        ].join('\n')
      : [
          `상품명: ${productTitle}`,
          '',
          '※ 후기 원문 없음. 상품명만 보고 실사용자 공통 강점 3가지를 그럴듯하게 구성.',
          '- 각 줄 30~55자, 실사용 장면이 눈에 그려지게',
          '- 3줄 중 1줄은 반드시 가성비/가격 대비 가치 언급',
          '- 모델번호·정확 스펙 같은 검증 불가 수치는 넣지 말 것',
          '- "정보가 부족합니다" 같은 회피 금지',
          '',
          '→ JSON으로만 반환.',
        ].join('\n');

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    let text = '';

    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system + ' 응답은 {"reasons": [...]} 형태의 JSON object.' },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) {
        const errTxt = await res.text();
        return NextResponse.json({ error: `OpenAI ${res.status}: ${errTxt.slice(0, 200)}` }, { status: 500 });
      }
      const json = await res.json();
      text = json.choices?.[0]?.message?.content || '';
    } else if (anthropicKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          temperature: 0.4,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) {
        const errTxt = await res.text();
        return NextResponse.json({ error: `Anthropic ${res.status}: ${errTxt.slice(0, 200)}` }, { status: 500 });
      }
      const json = await res.json();
      text = json.content?.[0]?.text || '';
    } else {
      return NextResponse.json({ error: 'OPENAI_API_KEY 또는 ANTHROPIC_API_KEY 환경변수 필요' }, { status: 500 });
    }

    // JSON 배열 추출 — response_format이 object면 {reasons:[...]}, Claude는 배열/object 섞여 올 수 있음
    let highlights: string[] = [];
    try {
      const parsed = JSON.parse(text);
      highlights = Array.isArray(parsed) ? parsed : (parsed.reasons || parsed.highlights || []);
    } catch {
      // 배열 패턴만 뽑아서 재시도
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        try { highlights = JSON.parse(match[0]); } catch { /* */ }
      }
    }

    highlights = (highlights || [])
      .map(s => String(s).trim().replace(/^[-•*]\s*/, ''))
      .filter(Boolean)
      .slice(0, 3);

    if (highlights.length === 0) {
      return NextResponse.json({ error: 'AI 응답 파싱 실패', raw: text.slice(0, 200) }, { status: 500 });
    }

    return NextResponse.json({ highlights });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
