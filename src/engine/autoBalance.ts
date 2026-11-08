import type { Slot, SlotOverride, Subject, SubjectId } from '../model/types';
import { bySlot } from './slots';

export interface BalanceChange {
  date: string;
  period: number;
  semester: 1 | 2;
  week: number;
  from: SubjectId;
  to: SubjectId;
  specialist: boolean;
}

export interface BalanceResult {
  overrides: Record<string, SlotOverride>; // 'auto' 덮어쓰기(잠기지 않음)
  changes: BalanceChange[];
  specialistWarnings: string[]; // 바꾼 전담 칸 — 전담 선생님과 확인
  warnings: string[]; // 못 채운 시간과 이유
}

/** 기본 가져올 교과: 학교자율시간 ← 관련 교과, 창체 영역 ← 다른 창체 영역(순서대로) */
export function defaultDonors(subjects: Subject[]): Record<SubjectId, SubjectId[]> {
  const out: Record<SubjectId, SubjectId[]> = {};
  for (const s of subjects) {
    if (s.kind === 'autonomy') out[s.id] = subjects.filter((x) => x.kind === 'subject' && x.group === s.group).map((x) => x.id);
    if (s.kind === 'creative') out[s.id] = subjects.filter((x) => x.kind === 'creative' && x.id !== s.id).map((x) => x.id);
  }
  return out;
}

/**
 * 자동 맞추기 (작업지시서 F5). 학기마다 교과별 차이(편제 − 칸 수)를 없앤다.
 * 받을 교과를 교과 순서대로, 필요한 시간을 앞 주부터 한 시간씩 돌아가며 주에 나누고,
 * 그 주에서 줄 교과(donors → 남는 시간이 큰 순 → 교과 순서)의 가장 늦은 칸을 받을 교과로 바꾼다.
 * 잠긴 칸은 건드리지 않고, 전담 칸은 다른 줄 칸이 없을 때만 쓰며 쓴 칸은 경고 목록에 올린다.
 * slots = 덮어쓰기가 적용된 칸(이전 자동 맞추기 결과는 빼고 넘길 것). 같은 입력이면 같은 결과.
 */
export function autoBalance(
  slots: Slot[], school: Record<SubjectId, { s1: number; s2: number }>, order: SubjectId[], donors: Record<SubjectId, SubjectId[]>,
): BalanceResult {
  const subject = new Map(slots.map((s) => [`${s.date}#${s.period}`, s.subjectId]));
  const changes: BalanceChange[] = [];
  const warnings: string[] = [];
  const idx = (id: SubjectId) => (order.includes(id) ? order.indexOf(id) : order.length);

  for (const sem of [1, 2] as const) {
    const mine = slots.filter((s) => s.semester === sem);
    const weeks = [...new Set(mine.map((s) => s.week))].sort((a, b) => a - b);
    const count = (id: SubjectId) => mine.filter((s) => subject.get(`${s.date}#${s.period}`) === id).length;
    const diff: Record<SubjectId, number> = {};
    for (const id of order) if (school[id]) diff[id] = (sem === 1 ? school[id].s1 : school[id].s2) - count(id);

    const pick = (week: number, receiver: SubjectId): Slot | undefined => {
      const surplus = order.filter((id) => (diff[id] ?? 0) < 0 && id !== receiver);
      const pref = (donors[receiver] ?? []).filter((id) => surplus.includes(id));
      const rest = surplus.filter((id) => !pref.includes(id)).sort((a, b) => diff[a] - diff[b] || idx(a) - idx(b));
      for (const specialist of [false, true]) {
        for (const id of [...pref, ...rest]) {
          const cand = mine
            .filter((s) => s.week === week && !s.locked && s.specialist === specialist && subject.get(`${s.date}#${s.period}`) === id)
            .sort(bySlot);
          if (cand.length) return cand[cand.length - 1];
        }
      }
      return undefined;
    };

    for (const r of order.filter((id) => (diff[id] ?? 0) > 0)) {
      let ptr = 0;
      while (diff[r] > 0) {
        let done = false;
        for (let t = 0; t < weeks.length && !done; t++) {
          const s = pick(weeks[(ptr + t) % weeks.length], r);
          if (!s) continue;
          const key = `${s.date}#${s.period}`;
          const from = subject.get(key)!;
          subject.set(key, r);
          diff[r]--;
          diff[from]++;
          changes.push({ date: s.date, period: s.period, semester: sem, week: s.week, from, to: r, specialist: s.specialist });
          ptr = (ptr + t + 1) % weeks.length;
          done = true;
        }
        if (!done) {
          warnings.push(`${sem}학기 ${r} ${diff[r]}시간을 채울 칸이 없습니다(잠긴 칸 때문이거나 줄 교과가 모자람).`);
          break;
        }
      }
    }
  }

  const overrides: Record<string, SlotOverride> = {};
  for (const s of slots) {
    const key = `${s.date}#${s.period}`;
    if (subject.get(key) !== s.subjectId) overrides[key] = { subjectId: subject.get(key)!, kind: 'auto', locked: false };
  }
  const specialistWarnings = changes.filter((c) => c.specialist).map((c) => `${c.date} ${c.period}교시 전담 칸 변경(${c.from} → ${c.to}) — 전담 선생님과 확인`);
  return { overrides, changes, specialistWarnings, warnings };
}
