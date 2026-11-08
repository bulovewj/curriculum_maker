import type { Slot, SlotOverride, SubjectId } from '../model/types';
import { bySlot } from './slots';

export interface MoveResult {
  overrides: Record<string, SlotOverride>;
  moved: Slot[];
  warnings: string[];
}

/**
 * 주별 시수표에서 'A → B로 n시간' (작업지시서 2.4): 그 주의 A 칸 중 잠기지 않은 가장 늦은 칸부터 n개를 B로 바꾼다.
 * 바꾼 칸은 교사 수정(edited)으로 잠긴다. 주 총계는 바뀌지 않는다. slots = 덮어쓰기가 적용된 칸.
 */
export function moveHours(
  slots: Slot[], overrides: Record<string, SlotOverride>,
  arg: { semester: 1 | 2; week: number; from: SubjectId; to: SubjectId; n: number },
): MoveResult {
  const free = slots
    .filter((s) => s.semester === arg.semester && s.week === arg.week && s.subjectId === arg.from && !s.locked)
    .sort(bySlot).reverse();
  const moved = free.slice(0, arg.n);
  const next = { ...overrides };
  for (const s of moved) next[`${s.date}#${s.period}`] = { subjectId: arg.to, kind: 'edited', locked: true };
  const warnings = moved.length < arg.n ? [`${arg.n}시간 중 ${moved.length}시간만 옮겼습니다(옮길 수 있는 칸이 모자람. 잠긴 칸은 옮기지 않습니다).`] : [];
  return { overrides: next, moved, warnings };
}

/** 칸 잠금 켜고 끄기. 덮어쓰기가 없던 칸은 같은 교과로 'edited' 덮어쓰기를 만들어 잠근다. 끄면 직접 고친 칸은 풀리기만 한다. */
export function setLock(slots: Slot[], overrides: Record<string, SlotOverride>, date: string, period: number, locked: boolean): Record<string, SlotOverride> {
  const key = `${date}#${period}`;
  const slot = slots.find((s) => s.date === date && s.period === period);
  if (!slot) return overrides;
  const old = overrides[key];
  if (!locked && old && old.kind === 'edited' && old.subjectId === slot.subjectId && old.locked) {
    const rest = { ...overrides }; // 같은 교과로 잠가 둔 것뿐이면 덮어쓰기를 없앤다
    delete rest[key];
    return rest;
  }
  return { ...overrides, [key]: { subjectId: slot.subjectId, kind: old?.kind ?? 'edited', locked } };
}

/** 그 주의 잠금 풀기. 값은 그대로 두고 잠금만 푼다. */
export function unlockWeek(slots: Slot[], overrides: Record<string, SlotOverride>, semester: 1 | 2, week: number): Record<string, SlotOverride> {
  const next = { ...overrides };
  for (const s of slots) {
    const key = `${s.date}#${s.period}`;
    if (s.semester === semester && s.week === week && next[key]?.locked) next[key] = { ...next[key], locked: false };
  }
  return next;
}
