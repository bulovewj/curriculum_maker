import * as adjust from '../_prompts/adjustCandidates';
import type { AdjustInput, AiResponse, AiTask, CallModel } from './types';

export interface Env {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  AI_MODEL_FAST?: string;
  AI_MODEL_SMART?: string;
}

/** 키가 있는 쪽을 쓴다(둘 다 있으면 Claude). */
export const providerOf = (env: Env): 'anthropic' | 'openai' => (env.ANTHROPIC_API_KEY || !env.OPENAI_API_KEY ? 'anthropic' : 'openai');

const MAX_ROWS = 400;
const MAX_TEXT = 300; // 글 한 칸 최대 글자
const MAX_STANDARDS = 400;
const MAX_BODY = 200_000; // 요청 전체 최대 글자
const SMART_TASKS: AiTask[] = ['adjustCandidates', 'adjustText', 'activityNames'];

const fail = (error: string, status = 400): Response => Response.json({ ok: false, error } satisfies AiResponse, { status });

function checkAdjustInput(x: unknown): x is AdjustInput {
  const i = x as AdjustInput;
  return !!i && typeof i.need === 'number' && Array.isArray(i.rows) && i.rows.length <= MAX_ROWS && Array.isArray(i.standards) && i.standards.length <= MAX_STANDARDS && i.standards.every((x) => typeof x === 'string' && x.length <= MAX_TEXT)
    && i.rows.every((r) => typeof r.id === 'string' && typeof r.topic === 'string' && r.topic.length <= MAX_TEXT && r.id.length <= MAX_TEXT) && typeof i.subject?.id === 'string';
}

/** POST /api/ai 의 몸통. callModel을 받아서 테스트에서 가짜로 바꿀 수 있다. */
export async function handleAi(request: Request, env: Env, callModel: CallModel): Promise<Response> {
  let body: { task?: string; input?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return fail('보낸 내용이 너무 큽니다.', 413);
    body = JSON.parse(raw);
  } catch {
    return fail('요청 형식이 올바르지 않습니다.');
  }
  const task = body.task as AiTask;
  if (!['adjustCandidates', 'adjustText', 'activityNames', 'mapColumns'].includes(task)) return fail('알 수 없는 AI 작업입니다.');
  if (task !== 'adjustCandidates') return fail('이 AI 작업은 아직 지원하지 않습니다.', 501);
  if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) return fail('서버에 AI 키가 설정되지 않았습니다(.env.local의 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY).', 503);
  if (!checkAdjustInput(body.input)) return fail('보낸 진도 정보가 올바르지 않거나 너무 큽니다.');
  const model = (SMART_TASKS.includes(task) ? env.AI_MODEL_SMART : env.AI_MODEL_FAST) || (providerOf(env) === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-5-5');
  try {
    const { text, usage } = await callModel({ model, system: adjust.system, user: adjust.user(body.input) });
    return Response.json({ ok: true, output: parseJson(text), usage } satisfies AiResponse);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'AI를 부르지 못했습니다.', 502);
  }
}

/** 모델 답에서 JSON을 꺼낸다(코드 블록이 붙어도 읽는다). 못 읽으면 Error. */
export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    throw new Error('AI 답을 읽지 못했습니다. 다시 시도해 주세요.');
  }
}
