import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/ai/summarize-reviews
 * body: { reviews: string, productTitle?: string }
 * 사용자 후기 덩어리 → 가성비 이유 3가지 (한 문장씩)
 * OPENAI_API_KEY 우선, 없으면 ANTHROPIC_API_KEY 폴백.
 */
export async function POST(req: NextRequest) {
  try {
    const { reviews, productTitle } = await req.json() as { reviews: string; productTitle?: string };
    if (!reviews || !reviews.trim()) {
      return NextResponse.json({ error: '후기 텍스트 필요' }, { status: 400 });
    }

    const system = [
      '당신은 "다있어"(가성비 쇼핑 큐레이션 앱)의 에디터.',
      '사용자가 붙여넣은 쿠팡 후기 원문을 바탕으로 "이 상품이 왜 가성비인지" 이유 3가지를 작성.',
      '',
      '=== 핵심 원칙 ===',
      '① 원문 골자 유지: 사용자가 직접 쓴 표현·포인트·구체 상황을 최대한 살릴 것. 의미 왜곡 금지, 원문에 없는 기능/수치 창작 금지.',
      '② 디테일 확장: 원문이 짧거나 추상적이면 그 맥락 안에서 구체 부위·동작·결과로 풀어쓰기. 줄이지 말 것 — **원문보다 짧게 축약하지 말 것**.',
      '③ 기능 중심: 상품이 "뭘 해주는지 / 어떤 불편을 해결하는지 / 어떤 결과가 나오는지"를 앞세울 것. 감정·평점 위주 금지.',
      '',
      '=== 길이 규칙 (중요) ===',
      '- 각 줄 25~45자. 원문이 길면 살려서 35~50자로 OK.',
      '- **원문 문장보다 짧게 만들지 말 것**. 원문의 디테일을 요약 손실 없이 담아낼 것.',
      '- 너무 짧은 출력(15자 이하)은 재작성 필요 신호.',
      '',
      '=== 문체 규칙 ===',
      '- 반드시 "~해요 / ~예요 / ~어요"로 끝나는 정중한 해요체. 반말 금지.',
      '- 1인칭 실사용 어투이되 **3개 모두 똑같은 시작 패턴 금지**.',
      '  · "써봤는데 / 해보니까 / 받아보니 / 사용해보니" 같은 도입구는 **3개 중 최대 1개**.',
      '  · 나머지 2개는 상황 설명으로 바로 시작 (예: "막대가 가벼워서~", "스펀지로 닦고 헤드만 돌리면~", "같은 가격대에서~").',
      '- 광고·과장 단어 금지: 최고/강추/완벽/무조건/대박/꿀템 등.',
      '',
      '=== 3개 관점 분배 ===',
      '3개는 서로 겹치지 않게 관점을 달리할 것. 예:',
      '- (1) 핵심 기능·성능이 기대보다 좋았던 지점',
      '- (2) 사용성·동선·편의성 관련 구체 경험',
      '- (3) 가격/대안 대비 가치, 혹은 디테일한 마감/재질',
      '',
      '=== 변환 예시 ===',
      '원문: "청소가 빨라요, 가볍고 좋아요"',
      '→ "걸레질 후 헤드만 돌리면 물기까지 긁혀서 청소가 한 번에 끝나요"',
      '→ "막대 자체가 가벼워서 오래 청소해도 팔목에 무리 없이 돌려져요"',
      '→ "써보니 같은 가격대 제품보다 끝마무리도 깔끔하고 조립도 단단해요"',
      '',
      '원문: "층간소음 덜해요, 두꺼워요"',
      '→ "아이가 뛰어다녀도 아래층에 울리는 소리가 눈에 띄게 줄었어요"',
      '→ "매트가 두꺼운데도 쿠션감이 있어서 무릎 꿇어도 아프지 않아요"',
      '→ "해보니까 이 두께에 이 가격이면 유명 브랜드보다 훨씬 합리적이에요"',
      '',
      '(변환 예시에서 "써보니/해보니까"류 시작 문구가 각 세트에서 딱 1개만 쓰인 점 주의!)',
      '',
      '=== 나쁜 예시 (피할 것) ===',
      '- "가성비 최고예요" (원문 골자 없음 + 과장)',
      '- "가벼워요" (단어 조각 / 원문보다 축약)',
      '- "좋아요" (반말 + 정보 없음)',
      '- "이 상품은 ~합니다" (상품 소개형 말투, 1인칭 경험 아님)',
      '- 세 줄 모두 "써봤는데~" 같은 도입구로 시작 (반복·지루)',
      '',
      '응답은 {"reasons": ["...", "...", "..."]} 형식 JSON object만. 설명/주석 금지.',
    ].join('\n');
    const user = [
      `상품명: ${productTitle || '(상품명 없음)'}`,
      '',
      '구매자 후기 원문 (이 안의 표현·포인트를 살려서 디테일만 확장):',
      reviews.slice(0, 4000),
      '',
      '→ 위 규칙대로 가성비 이유 3가지 JSON으로 반환.',
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
