import type { PlanRow, Slot, Subject, SubjectId } from '../model/types';
import { bySlot } from './slots';

export interface Placed {
  row: PlanRow;
  slot: Slot;
}

export interface PlaceResult {
  placed: Placed[];
  surplusRows: PlanRow[]; // 칸이 모자라 못 놓은 행 = '감축 필요'
  freeSlots: Slot[]; // 행이 모자라 남은 칸 = '증배 필요'
}

const key = (s: Slot) => `${s.date}#${s.period}`;

/**
 * 진도 배치 (작업지시서 2.5): 한 교과의 진도 행을 그 교과 칸에 날짜·교시 순으로 하나씩 놓는다.
 * 1) 주 고정 행을 먼저 그 주의 가장 이른 빈 칸에 놓는다. 2) 나머지 행을 앞에서부터 남은 칸에 놓는다.
 * 학기가 정해진 행은 그 학기 칸에만, 학기가 없는 행(연간 교과서)은 1년 칸을 이어서 쓴다. 메모 행은 뺀다.
 */
export function placeLessons(slots: Slot[], rows: PlanRow[], subjectId: SubjectId): PlaceResult {
  const mine = slots.filter((s) => s.subjectId === subjectId).sort(bySlot);
  const lessons = rows.filter((r) => r.subjectId === subjectId && r.kind !== 'memo');
  const used = new Set<string>();
  const at = new Map<PlanRow, Slot>();
  const firstFree = (pool: Slot[]) => pool.find((s) => !used.has(key(s)));
  const take = (row: PlanRow, slot: Slot | undefined) => {
    if (!slot) return;
    used.add(key(slot));
    at.set(row, slot);
  };

  for (const r of lessons.filter((x) => x.fixedWeek)) {
    const f = r.fixedWeek!;
    take(r, firstFree(mine.filter((s) => s.semester === f.semester && s.week === f.week)));
  }
  for (const r of lessons.filter((x) => !x.fixedWeek)) {
    take(r, firstFree(r.semester ? mine.filter((s) => s.semester === r.semester) : mine));
  }
  return {
    placed: lessons.flatMap((row) => (at.has(row) ? [{ row, slot: at.get(row)! }] : [])),
    surplusRows: lessons.filter((r) => !at.has(r)),
    freeSlots: mine.filter((s) => !used.has(key(s))),
  };
}

/** 모든 교과 한꺼번에 */
export function placeAll(slots: Slot[], lessonPlans: Record<SubjectId, PlanRow[]>, subjects: Subject[]): Record<SubjectId, PlaceResult> {
  return Object.fromEntries(subjects.map((s) => [s.id, placeLessons(slots, lessonPlans[s.id] ?? [], s.id)]));
}

/** 교과 필요량: 행 − 칸. 양수 = 감축 필요, 음수 = 증배 필요, 0 = 맞음 */
export const needOf = (r: PlaceResult): number => r.surplusRows.length - r.freeSlots.length;

/**
 * 한 교과·학기의 표 순서: 배치된 행(칸 순서) → 못 놓은 행 → 메모 행. 칸이 있으면 함께 돌려준다.
 * 학기가 없는 행(연간 교과서)은 1년 칸에 한 번만 놓아서 두 학기에 겹치지 않는다.
 * 못 놓은 연간 행은 2학기 표 끝에, 학기 없는 메모 행은 1학기 표 끝에 한 번만 나온다.
 */
export function lessonOrder(slots: Slot[], rows: PlanRow[], subjectId: SubjectId, semester: 1 | 2): { row: PlanRow; slot?: Slot }[] {
  const all = rows.filter((r) => r.subjectId === subjectId);
  const res = placeLessons(slots, all, subjectId);
  const placed = res.placed.filter((x) => x.slot.semester === semester).sort((a, b) => bySlot(a.slot, b.slot));
  const unplaced = res.surplusRows.filter((r) => r.semester === semester || (r.semester === undefined && semester === 2));
  const memos = all.filter((r) => r.kind === 'memo' && (r.semester === semester || (r.semester === undefined && semester === 1)));
  return [...placed, ...unplaced.map((row) => ({ row })), ...memos.map((row) => ({ row }))];
}
