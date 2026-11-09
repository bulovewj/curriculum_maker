import { describe, expect, it } from 'vitest';
import { ORIGINAL, findFile, readBuffer } from '../../tests/files';
import { readScheduleP04 } from '../import/mappers/scheduleP04';
import { readWorkbook } from '../import/xlsx/readWorkbook';
import type { CalendarDay } from '../model/types';
import { defaultShape } from './generateTimetable';
import { monthOfWeek, schoolDaysByMonth, semesterWeeks, weekNo, weekPeriod } from './calendar';

describe('기간 글자·월 묶음 (달력 없이)', () => {
  it('기간 글자', () => {
    expect(weekPeriod('2026-03-02', '2026-03-01').text).toBe('3.2~3.7');
    expect(weekPeriod('2026-08-31', '2026-09-01').text).toBe('9.1~9.5');
    expect(weekPeriod('2026-12-28', '2026-09-01').text).toBe('12.28~1.2');
    expect(weekPeriod('2027-02-08', '2026-09-01').text).toBe('2.8~2.13');
  });
  it('월 묶음: 3.30. 주 → 3월, 2학기 1주(월요일 8.31) → 9월', () => {
    expect(monthOfWeek(weekPeriod('2026-03-30', '2026-03-01').start, [], 'weekStart')).toBe(3);
    expect(monthOfWeek(weekPeriod('2026-08-31', '2026-09-01').start, [], 'weekStart')).toBe(9);
  });
  it('수업일이 많은 달 규칙: 3.30 주는 4월 수업일이 3일이라 4월', () => {
    const day = (date: string): CalendarDay => ({ date, weekday: 1, semester: 1, schoolDay: true, periods: 6, notes: [] });
    const days = ['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03'].map(day);
    expect(monthOfWeek('2026-03-30', days, 'majority')).toBe(4);
    expect(monthOfWeek('2026-03-30', days, 'weekStart')).toBe(3);
  });
  it('입력을 바꾸지 않는다', () => {
    const cal: CalendarDay[] = [{ date: '2026-09-01', weekday: 2, semester: 2, schoolDay: true, periods: 6, notes: [] }];
    const copy = JSON.stringify(cal);
    semesterWeeks(cal, 2, '2026-09-01');
    expect(JSON.stringify(cal)).toBe(copy);
  });
});

const file = findFile(ORIGINAL, '행사 및 일정');
describe.skipIf(!file)('2026 학사력으로', () => {
  const load = async () => readScheduleP04(await readWorkbook(readBuffer(file!)), 2026, 6).calendar;

  it('주차: 9.1 → 2학기 1주, 12.28 → 18주, 1.25 → 22주, 2.8 → 24주', async () => {
    const cal = await load();
    expect(['2026-09-01', '2026-12-28', '2027-01-25', '2027-02-08'].map((d) => weekNo(cal, 2, d))).toEqual([1, 18, 22, 24]);
    expect(weekNo(cal, 1, '2026-03-03')).toBe(1);
  });

  it('달별 수업일 수', async () => {
    const cal = await load();
    expect(schoolDaysByMonth(cal, 1)).toEqual({ 3: 21, 4: 22, 5: 18, 6: 21, 7: 14 });
    expect(schoolDaysByMonth(cal, 2)).toEqual({ 9: 20, 10: 19, 11: 21, 12: 21, 1: 5, 2: 8 });
  });

  it('주 목록: 학기마다 21주, 1학기 8주 = 4.20~4.25·교시 6 6 5 7 7', async () => {
    const cal = await load();
    const w1 = semesterWeeks(cal, 1, '2026-03-01');
    const w2 = semesterWeeks(cal, 2, '2026-09-01');
    expect([w1.length, w2.length]).toEqual([21, 21]);
    expect(w1[7].text).toBe('4.20~4.25');
    expect(w1[7].days.map((d) => d.periods)).toEqual([6, 6, 5, 7, 7]);
    expect(w2.map((w) => w.no).slice(-4)).toEqual([18, 22, 23, 24]); // 19~21주는 겨울방학
  });

  it('요일별 가장 흔한 교시 수 = 월6 화6 수5 목6 금6', async () => {
    expect(defaultShape(await load())).toEqual([6, 6, 5, 6, 6]);
  });
});

describe('reassignSemesters', () => {
  it('학기 범위가 바뀌면 그 날짜의 학기도 바뀌고, 범위 밖은 null', async () => {
    const { reassignSemesters } = await import('./calendar');
    const day = (date: string, semester: 1 | 2 | null) => ({ date, weekday: 2 as const, semester, schoolDay: true, periods: 6, notes: [] });
    const out = reassignSemesters([day('2027-03-03', 1), day('2027-07-30', 1)], [{ no: 1, start: '2027-03-04', end: '2027-07-20' }, { no: 2, start: '2027-08-20', end: '2028-02-28' }]);
    expect(out.map((d) => d.semester)).toEqual([null, null]);
  });
});
