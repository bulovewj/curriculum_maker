import { accessOf, corsHeaders, denied, type AuthEnv } from './_lib/auth.js';
import { handleAi, providerOf, type Env } from './_lib/handler.js';
import type { CallModel } from './_lib/types';

declare const process: { env: Env & AuthEnv };

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

/** 실제 GPT 호출(OpenAI Chat Completions). 키는 서버 환경변수에만 있다. */
const callGpt: CallModel = async ({ model, system, user }) => {
  // Vercel 함수 한도(60초) 안에서 끝나게 전체 55초 예산을 두고, 첫 시도에 길게(최대 45초) 준다.
  // 행이 많은 교과(국어 2학기 109행 등)는 고급 모델이 30초 넘게 걸려 예전 28초 끊기에 걸렸다.
  const deadline = Date.now() + 55_000;
  const send = (ms: number) => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}` },
    body: JSON.stringify({ model, max_completion_tokens: 4000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(ms),
  });
  // 권한을 막 바꾸면 OpenAI 서버마다 반영이 달라 403이 섞여 나오고, 가끔 답이 안 오고 멈춘다. 두 번까지 시도한다(남은 시간이 있을 때만).
  let res: Response | undefined;
  let last = '';
  for (let k = 0; k < 2 && !(res && res.status !== 403); k++) {
    if (k > 0) await new Promise((r) => setTimeout(r, 1000));
    const left = Math.min(45_000, deadline - Date.now());
    if (left < 5_000) break; // 다시 보낼 시간이 없다
    try {
      res = await send(left);
    } catch (e) {
      res = undefined; // 시간 초과·연결 끊김
      last = e instanceof Error && e.name !== 'TimeoutError' ? e.message : '';
    }
  }
  if (!res) throw new Error(last ? `AI에 연결하지 못했습니다(${last}).` : 'AI가 오래 답하지 않습니다. 잠시 뒤 다시 시도해 주세요.');
  if (!res.ok) {
    const detail = ((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message ?? '';
    throw new Error(res.status === 401 ? 'AI 키가 올바르지 않습니다.' : res.status === 429 ? 'AI 사용 한도를 넘었습니다. 잠시 뒤 다시 시도하세요.' : `AI 서버 오류(${res.status}) ${detail}`.trim());
  }
  const data = (await res.json()) as { choices: { message: { content: string | null } }[]; usage: { prompt_tokens: number; completion_tokens: number } };
  return { text: data.choices[0]?.message.content ?? '', usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens } };
};

export const maxDuration = 60; // Vercel 함수 최대 실행 시간(초)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 응답에 CORS 헤더를 덧붙인다 */
const withCors = (res: Response, headers: Record<string, string>): Response => {
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
};

export async function POST(request: Request): Promise<Response> {
  const cors = corsHeaders(request, process.env);
  const access = accessOf(request, process.env);
  if (access !== 'ok') {
    if (access === 'wrong') await sleep(800); // 비밀번호를 연달아 시도하는 것을 늦춘다
    return denied(access, cors);
  }
  return withCors(await handleAi(request, process.env, providerOf(process.env) === 'openai' ? callGpt : callClaude), cors);
}

/** 다른 주소(GitHub Pages)에서 부르기 전에 브라우저가 보내는 확인 요청 */
export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, process.env) });
}

/** 연결 확인·비밀번호 확인용: 서버가 살아 있는지, 비밀번호가 필요한지, 보낸 비밀번호가 맞는지(키 값은 알려 주지 않는다). */
export async function GET(request: Request): Promise<Response> {
  const access = accessOf(request, process.env);
  if (access === 'wrong' && request.headers.get('x-app-password')) await sleep(800);
  return Response.json(
    { ok: true, keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY), passwordRequired: Boolean(process.env.APP_PASSWORD) || Boolean(process.env.VERCEL), authed: access === 'ok' },
    { headers: corsHeaders(request, process.env) },
  );
}
