import { describe, expect, it } from 'vitest';
import { handleAi, parseJson } from './handler';
import type { CallModel, ModelCall } from './types';

const input = { subject: { id: 'kor', name: '국어' }, semester: 1, need: 2, rows: [{ id: 'a', unit: 'U', topic: 'T', standards: [] }], standards: [] };
const post = (body: unknown) => new Request('http://x/api/ai', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const env = { ANTHROPIC_API_KEY: 'test-key', AI_MODEL_FAST: 'fast-model', AI_MODEL_SMART: 'smart-model' };
const usage = { inputTokens: 10, outputTokens: 5 };

/** 실제 Claude를 부르지 않는 가짜 */
function fake(text: string): { call: CallModel; seen: ModelCall[] } {
  const seen: ModelCall[] = [];
  return { seen, call: async (c) => { seen.push(c); return { text, usage }; } };
}

describe('서버 함수(가짜 모델)', () => {
  it('재구성 후보: 모델을 SMART로 부르고 JSON을 돌려준다(코드 블록 허용)', async () => {
    const f = fake('```json\n[{"kind":"merge","rowId":"a","reason":"겹침","standards":[]}]\n```');
    const res = await handleAi(post({ task: 'adjustCandidates', input }), env, f.call);
    expect(await res.json()).toEqual({ ok: true, output: [{ kind: 'merge', rowId: 'a', reason: '겹침', standards: [] }], usage });
    expect(f.seen).toHaveLength(1);
    expect(f.seen[0].model).toBe('smart-model');
    expect(f.seen[0].system).toContain('JSON 배열만');
    expect(JSON.parse(f.seen[0].user).rows[0].id).toBe('a');
  });

  it('GPT 키: 기본은 gpt-4o, model 로 gpt-6-luna를 고르면 그 모델, 다른 이름은 무시', async () => {
    const gpt = { OPENAI_API_KEY: 'k' };
    const f = fake('[]');
    await handleAi(post({ task: 'adjustCandidates', input }), gpt, f.call);
    await handleAi(post({ task: 'adjustCandidates', input, model: 'gpt-6-luna' }), gpt, f.call);
    await handleAi(post({ task: 'adjustCandidates', input, model: 'evil-model' }), gpt, f.call);
    expect(f.seen.map((c) => c.model)).toEqual(['gpt-4o', 'gpt-6-luna', 'gpt-4o']);
  });

  it('JSON null·rows:[null] 같은 이상한 모양도 400 JSON으로 답한다', async () => {
    const f = fake('[]');
    const r1 = await handleAi(post('null'), env, f.call);
    expect(r1.status).toBe(400);
    const r2 = await handleAi(post({ task: 'adjustCandidates', input: { ...input, rows: [null] } }), env, f.call);
    expect(r2.status).toBe(400);
    expect(f.seen).toHaveLength(0);
  });

  it('오류 문장은 한국어: 알 수 없는 작업·키 없음·깨진 입력·깨진 답·모델 오류', async () => {
    const f = fake('[]');
    const msg = async (body: unknown, e = env, c: CallModel = f.call) => ((await (await handleAi(post(body), e, c)).json()) as { error: string }).error;
    expect(await msg({ task: 'hack', input })).toContain('알 수 없는');
    expect(await msg({ task: 'mapColumns', input })).toContain('올바르지');
    expect(await msg({ task: 'adjustCandidates', input }, { ...env, ANTHROPIC_API_KEY: '' })).toContain('AI 키');
    expect(await msg({ task: 'adjustCandidates', input: { rows: 3 } })).toContain('올바르지');
    expect(await msg('not json')).toContain('요청 형식');
    expect(await msg({ task: 'adjustCandidates', input }, env, fake('설명만').call)).toContain('읽지 못했습니다');
    expect(await msg({ task: 'adjustCandidates', input }, env, async () => { throw new Error('AI 사용 한도를 넘었습니다.'); })).toContain('한도');
    expect(f.seen).toHaveLength(0); // 검사에서 걸린 요청은 모델을 부르지 않는다
  });

  it('행이 너무 많으면 거절', async () => {
    const big = { ...input, rows: Array.from({ length: 401 }, (_, i) => ({ id: `r${i}`, unit: '', topic: '', standards: [] })) };
    const f = fake('[]');
    const res = await handleAi(post({ task: 'adjustCandidates', input: big }), env, f.call);
    expect(res.status).toBe(400);
    expect(f.seen).toHaveLength(0);
  });

  it('parseJson', () => {
    expect(parseJson('[1]')).toEqual([1]);
    expect(() => parseJson('x')).toThrow('읽지 못했습니다');
  });
});

describe('parseJson 너그럽게 읽기', () => {
  it('객체로 감싼 목록·설명이 붙은 목록도 읽는다', () => {
    expect(parseJson('{"candidates":[{"kind":"add"}]}')).toEqual([{ kind: 'add' }]);
    expect(parseJson('다음과 같습니다:\n[{"kind":"add"}]\n끝')).toEqual([{ kind: 'add' }]);
  });
});

describe('리뷰 보완', () => {
  it('candidates 키가 있으면 다른 목록보다 그걸 쓴다', () => {
    expect(parseJson('{"warnings":["x"],"candidates":[{"kind":"add"}]}')).toEqual([{ kind: 'add' }]);
  });
  it('한도를 넘으면 어느 한도인지 말해 준다', async () => {
    const big = { ...input, standards: Array.from({ length: 401 }, (_, k) => `c${k}`) };
    const res = await handleAi(new Request('http://x/api/ai', { method: 'POST', body: JSON.stringify({ task: 'adjustCandidates', input: big }) }), env, async () => ({ text: '[]', usage: { inputTokens: 0, outputTokens: 0 } }));
    expect(((await res.json()) as { error: string }).error).toContain('성취기준');
  });
});

describe('새 작업(문장·활동명·열 맞추기) 검사', () => {
  const f = () => fake('[{"id":"a","text":"x"}]');
  const run = async (task: string, i: unknown) => { const m = f(); const r = await handleAi(post({ task, input: i }), env, m.call); return { status: r.status, seen: m.seen.length }; };
  it('올바른 입력은 모델까지 가고, 이상한 입력은 거절', async () => {
    expect(await run('adjustText', { items: [{ id: 'a', content: '합침', subject: '국어', semester: 1, kind: 'reduce', area: '', unit: '' }] })).toEqual({ status: 200, seen: 1 });
    expect(await run('adjustText', { items: 3 })).toEqual({ status: 400, seen: 0 });
    expect(await run('activityNames', { subject: '자율·자치', items: [{ id: 'a', unit: 'u', topic: 't' }] })).toEqual({ status: 200, seen: 1 });
    expect(await run('mapColumns', { headers: ['a'], sample: [['1']], targets: ['단원'] })).toEqual({ status: 200, seen: 1 });
    expect(await run('mapColumns', { headers: 'a', sample: [], targets: [] })).toEqual({ status: 400, seen: 0 });
  });
});
