import { describe, expect, it } from 'vitest';
import type { Slot, WeekGridRow } from '../model/types';
import { applyOverrides } from './slots';
import { importWeekGrid } from './importWeekGrid';

const slot = (date: string, period: number, subjectId: string): Slot =>
  ({ date, period, semester: 1, week: 1, subjectId, specialist: false, origin: 'base', locked: false });
const want = (hours: Record<string, number>): WeekGridRow =>
  ({ semester: 1, week: 1, period: '3.2~3.7', month: 3, schoolDays: 2, dayPeriods: [0, 3, 3, 0, 0, 0], hours, note: '' });

describe('importWeekGrid', () => {
  const slots = [slot('2026-03-03', 1, 'kor'), slot('2026-03-03', 2, 'kor'), slot('2026-03-03', 3, 'math'),
    slot('2026-03-04', 1, 'kor'), slot('2026-03-04', 2, 'math'), slot('2026-03-04', 3, 'math')];

  it('넘치는 교과의 늦은 칸을 모자란 교과로 바꾼다', () => {
    const r = importWeekGrid(slots, [want({ kor: 2, math: 3, soc: 1 })], ['kor', 'math', 'soc']);
    expect(r.warnings).toEqual([]);
    const out = applyOverrides(slots, r.overrides);
    const count = (id: string) => out.filter((s) => s.subjectId === id).length;
    expect([count('kor'), count('math'), count('soc')]).toEqual([2, 3, 1]);
    expect(out.find((s) => s.subjectId === 'soc')).toMatchObject({ date: '2026-03-04', period: 1, origin: 'imported' }); // 국어의 가장 늦은 칸
    expect(slots.every((s) => s.origin === 'base')).toBe(true); // 입력은 그대로
  });

  it('여러 교과가 모자라면 교과 순서대로 가져간다', () => {
    const r = importWeekGrid(slots, [want({ kor: 1, math: 3, soc: 1, pe: 1 })], ['kor', 'math', 'soc', 'pe']);
    const out = applyOverrides(slots, r.overrides);
    expect(out.find((s) => s.subjectId === 'soc')?.date + '').toBe('2026-03-04'); // 사회가 먼저 늦은 칸
    expect(out.filter((s) => s.subjectId === 'pe')).toHaveLength(1);
  });

  it('잠긴 칸은 넘기지 않는다', () => {
    const locked = slots.map((x) => (x.date === '2026-03-04' && x.period === 1 ? { ...x, locked: true } : x));
    const r = importWeekGrid(locked, [want({ kor: 2, math: 3, soc: 1 })], ['kor', 'math', 'soc']);
    expect(r.overrides['2026-03-04#1']).toBeUndefined();
    expect(r.overrides['2026-03-03#2']).toMatchObject({ subjectId: 'soc' });
  });

  it('채울 칸이 없으면 경고', () => {
    const r = importWeekGrid(slots, [want({ kor: 4, math: 3 })], ['kor', 'math']);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
