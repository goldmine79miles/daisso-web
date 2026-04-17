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

    const system = '당신은 다있어(가성비 쇼핑 큐레이션)의 에디터예요. 사용자 후기들에서 이 상품이 왜 가성비인지 구체적 이유 3가지를 뽑아요. 각 이유는 한 문장, 친근한 반말 말투, 30자 이내로. 과장/광고투 금지. JSON 배열만 반환 — ["...", "...", "..."].';
    const user = `상품명: ${productTitle || '상품'}\n\n후기:\n${reviews.slice(0, 4000)}`;

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    let text = '';

    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          temperature: 0.4,
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
