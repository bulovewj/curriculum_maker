import { describe, expect, it } from 'vitest';
import type { PlanRow, Slot } from '../model/types';
import { needOf, placeLessons } from './placeLessons';

const slot = (date: string, period: number, semester: 1 | 2, week: number, subjectId = 'kor'): Slot =>
  ({ date, period, semester, week, subjectId, specialist: false, origin: 'base', locked: false });
const row = (id: string, extra: Partial<PlanRow> = {}): PlanRow =>
  ({ id, subjectId: 'kor', kind: 'lesson', unit: 'u', topic: id, standards: [], tags: [], source: { file: 'f', row: 1 }, ...extra });

const slots: Slot[] = [
  slot('2026-03-03', 1, 1, 1), slot('2026-03-04', 1, 1, 1), slot('2026-03-10', 1, 1, 2),
  slot('2026-09-01', 1, 2, 1), slot('2026-09-08', 1, 2, 2),
  slot('2026-03-03', 2, 1, 1, 'math'),
];

describe('placeLessons', () => {
  it('앞에서부터 날짜·교시 순으로 놓는다(다른 교과 칸은 안 쓴다)', () => {
    const r = placeLessons(slots, [row('a'), row('b'), row('c')], 'kor');
    expect(r.placed.map((p) => [p.row.id, p.slot.date])).toEqual([['a', '2026-03-03'], ['b', '2026-03-04'], ['c', '2026-03-10']]);
  });

  it('주 고정 행을 먼저 그 주의 가장 이른 빈 칸에 놓는다', () => {
    const r = placeLessons(slots, [row('a'), row('b'), row('fix', { fixedWeek: { semester: 1, week: 1 } })], 'kor');
    const at = Object.fromEntries(r.placed.map((p) => [p.row.id, p.slot.date]));
    expect(at.fix).toBe('2026-03-03'); // 고정 행이 먼저 1주 첫 칸
    expect(at.a).toBe('2026-03-04');
    expect(at.b).toBe('2026-03-10');
  });

  it('학기가 정해진 행은 그 학기 칸에만', () => {
    const r = placeLessons(slots, [row('a', { semester: 2 }), row('b', { semester: 1 }), row('c', { semester: 2 })], 'kor');
    expect(r.placed.map((p) => [p.row.id, p.slot.semester, p.slot.week])).toEqual([['a', 2, 1], ['b', 1, 1], ['c', 2, 2]]);
  });

  it('연간 교과서(학기 없음)는 1년 칸을 이어서 쓴다', () => {
    const r = placeLessons(slots, Array.from({ length: 5 }, (_, i) => row(`r${i}`)), 'kor');
    expect(r.placed.map((p) => p.slot.semester)).toEqual([1, 1, 1, 2, 2]);
    expect(needOf(r)).toBe(0);
  });

  it('남는 행(감축 필요)·남는 칸(증배 필요), 메모 행은 센다 않는다', () => {
    const more = placeLessons(slots, [row('a'), row('b'), row('c'), row('d'), row('e'), row('f'), row('memo', { kind: 'memo' })], 'kor');
    expect(more.surplusRows.map((x) => x.id)).toEqual(['f']);
    expect(needOf(more)).toBe(1);
    const fewer = placeLessons(slots, [row('a'), row('b')], 'kor');
    expect(fewer.freeSlots).toHaveLength(3);
    expect(needOf(fewer)).toBe(-3);
  });

  it('입력을 바꾸지 않고 같은 결과', () => {
    const copy = JSON.stringify(slots);
    const rows = [row('a'), row('b')];
    expect(placeLessons(slots, rows, 'kor')).toEqual(placeLessons(slots, rows, 'kor'));
    expect(JSON.stringify(slots)).toBe(copy);
  });
});
