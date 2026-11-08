import * as adjust from '../_prompts/adjustCandidates';
import * as texts from '../_prompts/texts';
import type { AdjustInput, AiResponse, AiTask, CallModel, MapColumnsInput } from './types';

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

/** 보낸 진도 정보를 검사한다. 문제가 있으면 어느 한도인지 알려 주는 문장, 괜찮으면 null. */
function adjustInputError(x: unknown): string | null {
  const i = x as AdjustInput;
  if (!i || typeof i.need !== 'number' || !Array.isArray(i.rows) || !Array.isArray(i.standards) || typeof i.subject?.id !== 'string') return '보낸 진도 정보의 모양이 올바르지 않습니다.';
  if (i.rows.length > MAX_ROWS) return `진도 행이 ${MAX_ROWS}개를 넘습니다(${i.rows.length}개).`;
  if (i.standards.length > MAX_STANDARDS) return `성취기준이 ${MAX_STANDARDS}개를 넘습니다(${i.standards.length}개).`;
  if (!i.standards.every((s) => typeof s === 'string' && s.length <= MAX_TEXT)) return `성취기준 글이 너무 깁니다(${MAX_TEXT}자 이하).`;
  if (!i.rows.every((r) => typeof r.id === 'string' && typeof r.topic === 'string' && r.id.length <= MAX_TEXT && r.topic.length <= MAX_TEXT)) return `행 하나의 주제·번호가 너무 깁니다(${MAX_TEXT}자 이하).`;
  return null;
}

interface TaskDef { check: (x: unknown) => string | null; system: string; user: (x: never) => string }

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object';
const shortStr = (x: unknown) => typeof x === 'string' && x.length <= MAX_TEXT;
/** items 배열 검사: 개수 한도와 글자 한도 */
function itemsError(x: unknown, fields: string[]): string | null {
  const items = isObj(x) ? x.items : undefined;
  if (!Array.isArray(items)) return '보낸 정보의 모양이 올바르지 않습니다.';
  if (items.length > MAX_ROWS) return `항목이 ${MAX_ROWS}개를 넘습니다(${items.length}개).`;
  return items.every((it) => isObj(it) && fields.every((f) => shortStr(it[f]))) ? null : `항목 글이 너무 길거나 모양이 올바르지 않습니다(${MAX_TEXT}자 이하).`;
}

const TASKS: Partial<Record<AiTask, TaskDef>> = {
  adjustCandidates: { check: adjustInputError, system: adjust.system, user: adjust.user as TaskDef['user'] },
  adjustText: { check: (x) => itemsError(x, ['id', 'content']), system: texts.adjustTextSystem, user: texts.adjustTextUser as TaskDef['user'] },
  activityNames: { check: (x) => (shortStr(isObj(x) ? x.subject : 0) ? itemsError(x, ['id', 'topic']) : '보낸 정보의 모양이 올바르지 않습니다.'), system: texts.activityNamesSystem, user: texts.activityNamesUser as TaskDef['user'] },
  mapColumns: {
    check: (x) => {
      const i = x as MapColumnsInput;
      if (!isObj(x) || !Array.isArray(i.headers) || !Array.isArray(i.sample) || !Array.isArray(i.targets)) return '보낸 정보의 모양이 올바르지 않습니다.';
      if (i.headers.length > 60 || i.sample.length > 10 || i.sample.some((r) => !Array.isArray(r) || r.length > 60)) return '열이 너무 많거나 보낸 줄이 너무 많습니다.';
      return [...i.headers, ...i.targets, ...i.sample.flat()].every(shortStr) ? null : `글이 너무 깁니다(${MAX_TEXT}자 이하).`;
    },
    system: texts.mapColumnsSystem, user: texts.mapColumnsUser as TaskDef['user'],
  },
};

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
  const def = TASKS[task]!;
  if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) return fail('서버에 AI 키가 설정되지 않았습니다(.env.local의 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY).', 503);
  const bad = def.check(body.input);
  if (bad) return fail(bad);
  const model = (SMART_TASKS.includes(task) ? env.AI_MODEL_SMART : env.AI_MODEL_FAST) || (providerOf(env) === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-5-5');
  try {
    const { text, usage } = await callModel({ model, system: def.system, user: def.user(body.input as never) });
    return Response.json({ ok: true, output: parseJson(text), usage } satisfies AiResponse);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'AI를 부르지 못했습니다.', 502);
  }
}

/** 모델 답에서 JSON을 꺼낸다(코드 블록이 붙어도 읽는다). 못 읽으면 Error. */
export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const v: unknown = JSON.parse(t);
    // {"candidates":[...]} 처럼 감싸서 답해도 목록을 꺼낸다
    return !Array.isArray(v) && v && typeof v === 'object' ? ((v as { candidates?: unknown }).candidates ?? Object.values(v).find((x) => Array.isArray(x) && x.every((y) => y && typeof y === 'object')) ?? v) : v;
  } catch {
    const m = t.match(/\[[\s\S]*\]/); // 앞뒤에 설명이 붙어도 첫 목록을 찾는다
    if (m) try { return JSON.parse(m[0]); } catch { /* 아래에서 오류 */ }
    throw new Error('AI 답을 읽지 못했습니다. 다시 시도해 주세요.');
  }
}
