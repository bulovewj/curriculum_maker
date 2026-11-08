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
