import { toUtc, weekMonday, weekSaturday } from '../lib/dates';
import type { CalendarDay, DateStr, Semester } from '../model/types';

export interface WeekInfo {
  semester: Semester;
  no: number; // 주차(그 학기 첫 수업일이 든 주 = 1주, 방학 주도 센다)
  monday: DateStr;
  start: DateStr; // 기간 시작 = max(월요일, 학기 시작일)
  end: DateStr; // 토요일
  text: string; // '3.2~3.7'
  month: number; // 시간 운영계획 '월' 칸
  days: CalendarDay[]; // 그 주의 수업일
}

const md = (d: DateStr) => `${Number(d.slice(5, 7))}.${Number(d.slice(8))}`;
const WEEK = 7 * 86_400_000;

/** 그 학기 첫 수업일 */
export function firstSchoolDay(calendar: CalendarDay[], semester: Semester): DateStr | undefined {
  return calendar.find((d) => d.semester === semester && d.schoolDay)?.date;
}

/** 주차. 그 학기 첫 수업일이 든 주가 1주. 학기에 수업일이 없으면 undefined. */
export function weekNo(calendar: CalendarDay[], semester: Semester, date: DateStr): number | undefined {
  const first = firstSchoolDay(calendar, semester);
  if (!first) return undefined;
  return Math.round((toUtc(weekMonday(date)) - toUtc(weekMonday(first))) / WEEK) + 1;
}

/** 기간 글자: 시작 = max(월요일, 학기 시작일), 끝 = 토요일. 예 '3.2~3.7', '12.28~1.2' */
export function weekPeriod(monday: DateStr, semesterStart: DateStr): { start: DateStr; end: DateStr; text: string } {
  const start = monday < semesterStart ? semesterStart : monday;
  const end = weekSaturday(monday);
  return { start, end, text: `${md(start)}~${md(end)}` };
}

/** '월' 칸에 쓸 달. weekStart = 기간 시작일의 달, majority = 수업일이 많은 달(같으면 기간 시작일의 달) */
export function monthOfWeek(start: DateStr, days: CalendarDay[], rule: 'weekStart' | 'majority'): number {
  const first = Number(start.slice(5, 7));
  if (rule === 'weekStart' || days.length === 0) return first;
  const count = new Map<number, number>();
  for (const d of days) count.set(Number(d.date.slice(5, 7)), (count.get(Number(d.date.slice(5, 7))) ?? 0) + 1);
  const best = Math.max(...count.values());
  return (count.get(first) ?? 0) === best ? first : [...count].find(([, n]) => n === best)![0];
}

/** 달별 수업일 수(주 묶음과 무관한 달력 기준). 키 = 달(1~12) */
export function schoolDaysByMonth(calendar: CalendarDay[], semester: Semester): Record<number, number> {
  const out: Record<number, number> = {};
  for (const d of calendar) {
    if (d.semester !== semester || !d.schoolDay) continue;
    const m = Number(d.date.slice(5, 7));
    out[m] = (out[m] ?? 0) + 1;
  }
  return out;
}

/** 학기의 주 목록(수업일이 하루라도 있는 주만). 방학 주는 번호만 건너뛴다. */
export function semesterWeeks(
  calendar: CalendarDay[], semester: Semester, semesterStart: DateStr, rule: 'weekStart' | 'majority' = 'weekStart',
): WeekInfo[] {
  const school = calendar.filter((d) => d.semester === semester && d.schoolDay);
  const weeks = new Map<DateStr, CalendarDay[]>();
  for (const d of school) weeks.set(weekMonday(d.date), [...(weeks.get(weekMonday(d.date)) ?? []), d]);
  return [...weeks].sort(([a], [b]) => (a < b ? -1 : 1)).map(([monday, days]) => {
    const p = weekPeriod(monday, semesterStart);
    return { semester, no: weekNo(calendar, semester, monday)!, monday, ...p, month: monthOfWeek(p.start, days, rule), days };
  });
}

/** 요일별 가장 흔한 교시 수(S3 시간표 틀 기본값). 키 = 1(월)~5(금) */
export function commonPeriods(calendar: CalendarDay[]): number[] {
  return [1, 2, 3, 4, 5].map((wd) => {
    const count = new Map<number, number>();
    for (const d of calendar) if (d.schoolDay && d.weekday === wd) count.set(d.periods, (count.get(d.periods) ?? 0) + 1);
    // 같은 횟수면 교시가 많은 쪽
    return [...count].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
  });
}
