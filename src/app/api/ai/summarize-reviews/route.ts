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
      '당신은 "다있어" (가성비 쇼핑 큐레이션 앱)의 에디터야.',
      '사용자 후기를 바탕으로 이 상품이 왜 가성비 제품인지 구체적 이유 3가지를 뽑아줘.',
      '',
      '필수 규칙:',
      '1. 각 이유는 반드시 "~해요 / ~예요 / ~어요"로 끝나는 정중한 해요체. 반말 절대 금지.',
      '2. 길이 20~35자 (너무 짧아도 너무 길어도 안 됨).',
      '3. 구매자 입장에서 쓴 것처럼 1인칭 실사용 경험으로.',
      '4. 추상적이면 안 됨 — "가벼워요 / 편해요" 보다는 "막대가 가벼워서 팔목이 안 아파요" 처럼 구체적 부위·상황·결과.',
      '5. 광고·과장 표현 금지 ("최고/강추/완벽/무조건" 같은 단어 X).',
      '6. 서로 다른 각도로 3개 (예: 품질, 가격, 사용성).',
      '',
      '좋은 예시:',
      '- "막대가 생각보다 가벼워서 청소할 때 팔목이 편안해요"',
      '- "스펀지로 닦고 헤드만 돌려서 물기까지 긁어내니까 청소 빨리 끝나요"',
      '- "위험하게 밖으로 몸 안 빼고 바깥 창문 구석까지 시원하게 닦았어요"',
      '',
      '나쁜 예시 (피할 것):',
      '- "가성비 최고" (추상적/과장)',
      '- "가벼움" (단어 조각)',
      '- "좋아요" (반말+정보 없음)',
      '',
      '응답은 {"reasons": ["이유1", "이유2", "이유3"]} 형식의 JSON object만. 다른 말 붙이지 마.',
    ].join('\n');
    const user = `상품명: ${productTitle || '(상품명 없음)'}\n\n구매자 후기 원문:\n${reviews.slice(0, 4000)}\n\n→ 위 규칙대로 가성비 이유 3가지 JSON으로.`;

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
