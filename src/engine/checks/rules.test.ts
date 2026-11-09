import { describe, expect, it } from 'vitest';
import type { Standards } from '../../model/standards';
import { newProject } from '../../model/newProject';
import type { PlanRow, Slot } from '../../model/types';
import { placeAll } from '../placeLessons';
import { tagCount, type CheckCtx } from './common';
import { r8 } from './r8';

const slot = (subjectId: string, week: number): Slot => ({ date: `2027-03-0${week}`, period: 1, semester: 1, week, subjectId, specialist: false, origin: 'base', locked: false });
const row = (id: string, extra: Partial<PlanRow> = {}): PlanRow => ({ id, subjectId: 'kor', semester: 1, kind: 'lesson', unit: 'U', topic: id, standards: [], tags: [], source: { file: 'f', row: 1 }, ...extra });

describe('규정 검사 단위', () => {
  it('R8: 남는 행과 빈 칸이 함께 있으면 차이가 0이어도 빨강', () => {
    const p0 = newProject('x', 2027);
    const p = { ...p0, subjects: p0.subjects.filter((s) => s.id === 'kor'), lessonPlans: { kor: [row('a'), row('b', { fixedWeek: { semester: 1, week: 9 } })] } };
    const slots = [slot('kor', 1), slot('kor', 2)];
    const ctx = { p, std: {} as Standards, slots, rows: [], placed: placeAll(slots, p.lessonPlans, p.subjects), school: {} } as CheckCtx;
    const out = r8(ctx);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ level: 'fail' });
    expect(out[0].message).toContain('못 놓은 행 1·빈 칸 1');
  });

  it('태그 세기: 메모 행은 빼고, 교과를 정하면 그 교과만', () => {
    const plans = { kor: [row('a', { tags: ['정보교육'] }), row('m', { kind: 'memo', tags: ['정보교육'] })], prac: [row('p', { subjectId: 'prac', tags: ['정보교육'] })] };
    expect(tagCount(plans, ['정보교육'])).toBe(2);
    expect(tagCount(plans, ['정보교육'], ['prac'])).toBe(1);
  });
});
