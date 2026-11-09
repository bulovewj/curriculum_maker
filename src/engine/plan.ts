import type { Project, Slot, SubjectId } from '../model/types';

type Split = Record<SubjectId, { s1: number; s2: number }>;

/**
 * 학기 나누기 기본값: 학기별 칸 수 비율로 나눠 정수로 반올림하고 연간 합을 유지한다 (작업지시서 F4).
 * autonomyInFirst가 true면 학교자율시간은 1학기에 몰아 둔다.
 */
export function splitSemesters(annual: Record<SubjectId, number>, slots: Slot[], autonomyIds: SubjectId[] = [], autonomyInFirst = false): Split {
  const n1 = slots.filter((s) => s.semester === 1).length;
  const n2 = slots.filter((s) => s.semester === 2).length;
  const r1 = n1 + n2 === 0 ? 0.5 : n1 / (n1 + n2);
  return Object.fromEntries(
    Object.entries(annual).map(([id, a]) => {
      const s1 = autonomyInFirst && autonomyIds.includes(id) ? a : Math.round(a * r1);
      return [id, { s1, s2: a - s1 }];
    }),
  );
}

/** 저장된 학기 값이 없는 교과는 기본 나누기로 채운 편제 */
export function effectiveSchool(p: Project, slots: Slot[]): Split {
  const defaults = splitSemesters(p.curriculumPlan.schoolAnnual, slots);
  return { ...defaults, ...p.curriculumPlan.school };
}

export interface PlanGap {
  subjectId: SubjectId;
  semester: 1 | 2;
  slots: number; // 주별 시수표 칸 수
  plan: number; // 편제 학기 시수
}

/** 학기마다 칸 수 ≠ 편제인 교과(편제가 있는 교과만). S5 [자동 맞추기]를 안 했거나 덜 맞춘 것. */
export function planGaps(p: Project, slots: Slot[]): PlanGap[] {
  const school = effectiveSchool(p, slots);
  return p.subjects.flatMap((s) => {
    const h = school[s.id];
    if (!h) return [];
    return ([1, 2] as const).flatMap((sem) => {
      const n = slots.filter((x) => x.semester === sem && x.subjectId === s.id).length;
      const want = sem === 1 ? h.s1 : h.s2;
      return n === want ? [] : [{ subjectId: s.id, semester: sem, slots: n, plan: want }];
    });
  });
}
