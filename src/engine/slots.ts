import type { CalendarDay, ProjectSettings, Slot, SlotOverride, TimetableCell } from '../model/types';
import { weekNo } from './calendar';

/** 칸 정렬: 날짜, 같으면 교시(숫자) 순 */
export const bySlot = (a: { date: string; period: number }, b: { date: string; period: number }): number =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.period - b.period;

/** 요일(1~5)별 시간표 교시 수 = 그 요일의 가장 늦은 칸 */
function shapeOf(base: TimetableCell[]): number[] {
  return [1, 2, 3, 4, 5].map((w) => Math.max(0, ...base.filter((c) => c.weekday === w).map((c) => c.period)));
}

/**
 * 기본 칸 = 학사력의 그날 교시 수 × 기초 시간표 (작업지시서 2.4).
 * 그날 교시 수가 시간표보다 적으면 뒤 교시부터 빠지고, 많으면 늘어난 교시는 extraPeriodSubject 칸이 된다.
 */
export function generateSlots(calendar: CalendarDay[], base: TimetableCell[], settings: ProjectSettings): Slot[] {
  const shape = shapeOf(base);
  const slots: Slot[] = [];
  for (const day of calendar) {
    if (!day.schoolDay || day.semester === null || day.weekday > 5) continue;
    const week = weekNo(calendar, day.semester, day.date) ?? 0;
    for (let period = 1; period <= day.periods; period++) {
      const cell = base.find((c) => c.weekday === day.weekday && c.period === period);
      if (!cell && period <= shape[day.weekday - 1]) continue; // 시간표 안의 빈칸
      slots.push({
        date: day.date, period, semester: day.semester, week,
        subjectId: cell ? cell.subjectId : settings.extraPeriodSubject,
        specialist: cell?.specialist ?? false, origin: cell ? 'base' : 'extra', locked: false,
      });
    }
  }
  return slots;
}

/** 교사 수정·자동 맞추기·가져오기 덮어쓰기(키 '날짜#교시')를 얹는다. 없는 칸의 덮어쓰기는 무시. */
export function applyOverrides(slots: Slot[], overrides: Record<string, SlotOverride>): Slot[] {
  return slots.map((s) => {
    const o = overrides[`${s.date}#${s.period}`];
    return o ? { ...s, subjectId: o.subjectId, origin: o.kind, locked: o.locked } : s;
  });
}

