import { describe, expect, it } from 'vitest';
import { newProject } from '../model/newProject';
import type { Slot } from '../model/types';
import { planGaps } from './plan';

const slot = (subjectId: string, semester: 1 | 2, i: number): Slot => ({
  date: `2027-0${semester === 1 ? 3 : 9}-${String(i + 1).padStart(2, '0')}`, period: 1, semester, week: 1, subjectId, specialist: false, origin: 'base', locked: false,
});
const many = (id: string, sem: 1 | 2, n: number) => Array.from({ length: n }, (_, i) => slot(id, sem, i));

describe('planGaps: 칸 수 ≠ 편제', () => {
  it('학기마다 다른 교과만, 편제 없는 교과는 빼고', () => {
    const p0 = newProject('x', 2027);
    const [a, b, c] = p0.subjects.map((s) => s.id);
    const p = { ...p0, curriculumPlan: { ...p0.curriculumPlan, schoolAnnual: { [a]: 4, [b]: 4 }, school: { [a]: { s1: 2, s2: 2 }, [b]: { s1: 2, s2: 2 } } } };
    const slots = [...many(a, 1, 2), ...many(a, 2, 2), ...many(b, 1, 3), ...many(b, 2, 1), ...many(c, 1, 5)];
    expect(planGaps(p, slots)).toEqual([
      { subjectId: b, semester: 1, slots: 3, plan: 2 },
      { subjectId: b, semester: 2, slots: 1, plan: 2 },
    ]);
  });
});
