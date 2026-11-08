import { describe, expect, it } from 'vitest';
import type { Candidate } from '../../api/_lib/types';
import type { OpState } from '../engine/planOps';
import type { PlanRow } from '../model/types';
import { applyPicked, describeCandidate, type Picked } from './applyCandidates';

const row = (id: string, topic: string): PlanRow => ({ id, subjectId: 'kor', semester: 1, kind: 'lesson', unit: 'U', topic, standards: [], tags: [], source: { file: 'f', row: 1 } });
const start = (): OpState => ({ adjustments: [], lessonPlans: { kor: ['a', 'b', 'c', 'd', 'e'].map((i) => row(i, i)) } });
const rm = (rowId: string): Candidate => ({ kind: 'remove', rowId, reason: '', standards: [] });
const pick = (c: Candidate, limit: number): Picked => ({ subjectId: 'kor', semester: 1, c, limit });

describe('후보 한꺼번에 적용', () => {
  it('필요량(limit)을 넘겨 적용하지 않는다', () => {
    const r = applyPicked(start(), [rm('a'), rm('c'), rm('e')].map((c) => pick(c, 2)));
    expect(r.applied).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.state.adjustments.length).toBe(2);
  });
  it('앞 후보 때문에 없어진 행은 건너뛴다(오류로 멈추지 않는다)', () => {
    const merge: Candidate = { kind: 'merge', rowId: 'a', reason: '', standards: [] }; // a+b → a
    const r = applyPicked(start(), [pick(merge, 5), pick(rm('b'), 5), pick(rm('d'), 5)]);
    expect(r.applied).toBe(2);
    expect(r.skipped).toBe(1);
  });
});

describe('후보 미리 보기 문장', () => {
  it('나누기는 원래 차시가 -1-, -2-로 나뉜다고 보여 준다', () => {
    const t = describeCandidate({ kind: 'split', rowId: 'a', reason: '', standards: [] }, start().lessonPlans.kor);
    expect(t).toContain('「a」 1차시 → 「a -1-」 + 「a -2-」');
  });
  it('합치기는 두 차시가 한 차시가 된다고 보여 준다', () => {
    expect(describeCandidate({ kind: 'merge', rowId: 'a', reason: '', standards: [] }, start().lessonPlans.kor)).toBe('「a」 + 「b」 2차시 → 「a」 1차시');
  });
  it('적용한 후보 목록을 돌려준다', () => {
    expect(applyPicked(start(), [pick(rm('a'), 1), pick(rm('c'), 1)]).appliedPicks.length).toBe(1);
  });
});
