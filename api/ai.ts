import { handleAi, type Env } from './_lib/handler';
import type { CallModel } from './_lib/types';

declare const process: { env: Env };

/** 실제 Claude 호출(Anthropic Messages API). 키는 서버 환경변수에만 있다. */
const callClaude: CallModel = async ({ model, system, user }) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'AI 키가 올바르지 않습니다.' : res.status === 429 ? 'AI 사용 한도를 넘었습니다. 잠시 뒤 다시 시도하세요.' : `AI 서버 오류(${res.status})`);
  const data = (await res.json()) as { content: { type: string; text?: string }[]; usage: { input_tokens: number; output_tokens: number } };
  return { text: data.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join(''), usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens } };
};

export async function POST(request: Request): Promise<Response> {
  return handleAi(request, process.env, callClaude);
}

/** 연결 확인용: 브라우저가 서버가 살아 있는지 본다(키 값은 알려 주지 않는다). */
export function GET(): Response {
  return Response.json({ ok: true, keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
}
