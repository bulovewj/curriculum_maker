import type { CalendarDay, Project, SchoolEvent, Semester, Slot, SubjectId, WeekGridRow } from '../model/types';
import { semesterWeeks } from './calendar';

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

/** 비고: 그 주 휴일. 예 '5.5(화) 어린이날' */
function noteOf(days: CalendarDay[]): string {
  return days
    .filter((d) => d.holiday)
    .map((d) => `${Number(d.date.slice(5, 7))}.${Number(d.date.slice(8))}(${DOW[d.weekday - 1]}) ${d.holiday}`)
    .join('\n');
}

/** 비고에 넣기로 한 행사(showInPlanNote) 중 그 주에 걸친 것. 예 '4.23.~4.24. 수학여행' */
function eventNotes(events: SchoolEvent[], from: string, to: string): string[] {
  const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8))}.`;
  return events.filter((e) => e.showInPlanNote && e.start <= to && e.end >= from)
    .map((e) => `${md(e.start)}${e.end !== e.start ? `~${md(e.end)}` : ''} ${e.name}`);
}

/**
 * 칸을 (주, 교과)로 센 주별 시수표. 시간 운영계획(c)과 같은 모양의 한 줄씩.
 * 수업일이 하루라도 있는 주만 나온다(방학 주는 번호만 건너뜀).
 */
export function weekGrid(
  calendar: CalendarDay[], slots: Slot[], semesters: Project['semesters'], monthRule: 'weekStart' | 'majority', subjectIds: SubjectId[],
  events: SchoolEvent[] = [],
): WeekGridRow[] {
  const rows: WeekGridRow[] = [];
  for (const sem of semesters) {
    for (const w of semesterWeeks(calendar, sem.no, sem.start, monthRule)) {
      const hours: Record<SubjectId, number> = Object.fromEntries(subjectIds.map((id) => [id, 0]));
      for (const s of slots) if (s.semester === sem.no && s.week === w.no) hours[s.subjectId] = (hours[s.subjectId] ?? 0) + 1;
      const inWeek = calendar.filter((d) => d.date >= w.monday && d.date <= w.end && d.weekday <= 6);
      rows.push({
        semester: sem.no, week: w.no, period: w.text, month: w.month, schoolDays: w.days.length,
        dayPeriods: [1, 2, 3, 4, 5, 6].map((wd) => w.days.find((d) => d.weekday === wd)?.periods ?? 0),
        hours, note: [noteOf(inWeek), ...eventNotes(events, w.monday, w.end)].filter(Boolean).join('\n'),
      });
    }
  }
  return rows;
}

/** 학기별 교과 계 */
export function semesterTotals(rows: WeekGridRow[], semester: Semester): Record<SubjectId, number> {
  const out: Record<SubjectId, number> = {};
  for (const r of rows.filter((x) => x.semester === semester)) for (const [id, h] of Object.entries(r.hours)) out[id] = (out[id] ?? 0) + h;
  return out;
}
