import type { Project, Slot, WeekGridRow } from '../model/types';
import { applyOverrides, generateSlots } from './slots';
import { weekGrid } from './weekGrid';

/** 프로젝트 → 1년치 칸(덮어쓰기 적용)과 주별 시수표. 저장하지 않고 매번 계산한다. */
export function computeGrid(p: Project): { slots: Slot[]; rows: WeekGridRow[] } {
  const slots = applyOverrides(generateSlots(p.calendar, p.baseTimetable, p.settings), p.slotOverrides);
  return { slots, rows: weekGrid(p.calendar, slots, p.semesters, p.settings.monthRule, p.subjects.map((s) => s.id)) };
}
