import { describe, expect, it } from 'vitest';
import { defaultShape, generateTimetable } from './generateTimetable';
import { defaultSubjects } from '../model/subjects';
import type { CalendarDay, SpecialistCell } from '../model/types';

const base = { subjects: defaultSubjects, partialSpecialist: [], exclude: [], blockSubjects: ['art'], schoolAnnual: { kor: 100, math: 100 } };

describe('기초 시간표 생성 보완', () => {
  it('전부 전담 칸이 틀보다 많으면 틀이 모자란다고 알린다(음수 칸 없음)', () => {
    const cells: SpecialistCell[] = Array.from({ length: 25 }, (_, i) => ({ weekday: ((i % 5) + 1) as 1, period: Math.floor(i / 5) + 1, subjectId: 'eng' }));
    const r = generateTimetable({ ...base, shape: [4, 4, 4, 4, 4], specialistCells: cells });
    expect(r.warnings.join()).toContain('틀의 칸(20)보다 전부 전담 칸(25)');
    expect(Object.values(r.perWeek).every((n) => n >= 0)).toBe(true);
  });
  it('기본 틀은 요일별 가장 흔한 교시 수', () => {
    const day = (date: string, weekday: number, periods: number): CalendarDay => ({ date, weekday: weekday as 1, semester: 1, schoolDay: true, periods, notes: [] });
    expect(defaultShape([day('a', 1, 6), day('b', 1, 6), day('c', 1, 4), day('d', 3, 5)])).toEqual([6, 0, 5, 0, 0]);
  });
});
