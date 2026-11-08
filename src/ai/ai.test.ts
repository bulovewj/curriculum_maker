import { describe, expect, it } from 'vitest';
import { AI_OFF, aiAvailable, callAi } from './client';
import { filterCandidates } from './filterOutput';
import { maskNames, maskText } from './maskNames';
import type { Adjustment } from '../model/types';
import { adjustTextInput, applyAdjustTexts, filterTexts } from './textTasks';

describe('maskNames', () => {
  it('이름+직함을 역할명으로, 이름 목록은 어디서든', () => {
    expect(maskText('홍길동 선생님이 수업')).toBe('담당 교사이 수업');
    expect(maskText('김영희 강사')).toBe('강사');
    expect(maskText('교사: 박철수')).toBe('교사: 담당 교사');
    expect(maskText('이순신이 가르침', ['이순신'])).toBe('담당 교사이 가르침');
  });
  it('이름이 아닌 낱말은 그대로', () => {
    expect(maskText('전담 교사와 보건 선생님')).toBe('전담 교사와 보건 선생님');
    expect(maskText('체육 선생님')).toBe('체육 선생님');
  });
  it('객체·배열 안 글자도 바꾸고 입력은 그대로', () => {
    const input = { rows: [{ topic: '홍길동 선생님 소개', n: 1 }], note: '교사: 김하나' };
    const copy = JSON.stringify(input);
    const out = maskNames(input);
    expect(out.rows[0]).toEqual({ topic: '담당 교사 소개', n: 1 });
    expect(out.note).toBe('교사: 담당 교사');
    expect(JSON.stringify(input)).toBe(copy);
  });
});

describe('filterCandidates', () => {
  const allowed = { rowIds: ['a', 'b'], standards: ['6국01-01'] };
  it('목록 밖 id·종류·성취기준을 버린다', () => {
    const r = filterCandidates([
      { kind: 'merge', rowId: 'a', reason: '겹침', standards: ['6국01-01', '9가99-99'] },
      { kind: 'remove', rowId: 'zzz', reason: '없는 행', standards: [] },
      { kind: 'explode', rowId: 'a', reason: '', standards: [] },
      { kind: 'add', rowId: 'b', reason: '주제 없음', standards: [] },
      { kind: 'add', rowId: 'b', topic: '새 활동', reason: '필요', standards: [] },
    ], allowed);
    expect(r.candidates.map((c) => [c.kind, c.rowId])).toEqual([['merge', 'a'], ['add', 'b']]);
    expect(r.candidates[0].standards).toEqual(['6국01-01']);
    expect(r.warnings).toHaveLength(4);
  });
  it('목록 모양이 아니면 전부 버린다', () => {
    expect(filterCandidates({ kind: 'merge' }, allowed).candidates).toEqual([]);
  });
});

describe('client', () => {
  const json = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  it('서버가 없으면 AI 꺼짐', async () => {
    const down = (async () => { throw new Error('x'); }) as unknown as typeof fetch;
    expect(await aiAvailable(down)).toBe(false);
    expect(await callAi('adjustCandidates', {}, [], down)).toEqual({ ok: false, error: AI_OFF });
    const html = (async () => ({ ok: true, json: async () => { throw new Error('not json'); } })) as unknown as typeof fetch;
    expect(await aiAvailable(html)).toBe(false);
  });
  it('서버가 JSON으로 답하면 연결됨', async () => {
    expect(await aiAvailable(json({ ok: true }))).toBe(true);
  });
  it('보내는 글은 이름이 가려진다', async () => {
    let sent = '';
    const spy = (async (_u: string, init: { body: string }) => { sent = init.body; return { ok: true, json: async () => ({ ok: true, output: [], usage: { inputTokens: 1, outputTokens: 1 } }) }; }) as unknown as typeof fetch;
    await callAi('adjustCandidates', { rows: [{ topic: '홍길동 선생님과 함께' }] }, [], spy);
    expect(sent).not.toContain('홍길동');
  });
});

describe('후보 방향', () => {
  const rows = { rowIds: ['a'], standards: [] as string[] };
  const out = [{ kind: 'remove', rowId: 'a', reason: '', standards: [] }, { kind: 'add', rowId: 'a', topic: '새 주제', reason: '', standards: [] }];
  it('늘려야 하면(need<0) 빼기는 버린다', () => {
    const f = filterCandidates(out, { ...rows, need: -3 });
    expect(f.candidates.map((c) => c.kind)).toEqual(['add']);
    expect(f.warnings.join()).toContain('반대');
  });
  it('줄여야 하면(need>0) 더하기는 버린다', () => {
    expect(filterCandidates(out, { ...rows, need: 3 }).candidates.map((c) => c.kind)).toEqual(['remove']);
  });
});

describe('문장·활동명', () => {
  const adj: Adjustment = { id: 'a1', semester: 1, subjectId: 'kor', area: '', standards: [], unit: 'U', content: '홍길동 선생님 소개, 읽기', hours: -1, planRowIds: [] };
  it('입력은 시수 부호로 줄이기·늘리기를 나누고, 보내기 전 이름이 가려진다', async () => {
    const input = adjustTextInput([{ ...adj }, { ...adj, id: 'a2', hours: 1 }], [{ id: 'kor', name: '국어' } as never]);
    expect(input.items.map((i) => i.kind)).toEqual(['reduce', 'increase']);
    let sent = '';
    await callAi('adjustText', input, [], (async (_u: string, o?: RequestInit) => { sent = String(o?.body); return Response.json({ ok: true, output: [], usage: { inputTokens: 0, outputTokens: 0 } }); }) as typeof fetch);
    expect(sent).not.toContain('홍길동');
    expect(sent).toContain('담당 교사');
  });
  it('목록 밖 id·빈 글은 버리고, 적용하면 AI 초안 표시, 입력은 그대로', () => {
    const f = filterTexts([{ id: 'a1', text: ' 유사 내용을 통합함 ' }, { id: 'zz', text: 'x' }, { id: 'a2', text: '' }], ['a1', 'a2']);
    expect(f.items).toEqual([{ id: 'a1', text: '유사 내용을 통합함' }]);
    expect(f.warnings).toHaveLength(2);
    const before = [{ ...adj }];
    const after = applyAdjustTexts(before, f.items);
    expect(after[0]).toMatchObject({ content: '유사 내용을 통합함', aiDraft: true });
    expect(before[0].aiDraft).toBeUndefined();
  });
});
