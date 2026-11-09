import type { GradeBand, Standards, CheckResult } from '../../model/standards';
import type { PlanRow, Project, Slot, Subject, SubjectId, WeekGridRow } from '../../model/types';
import type { PlaceResult } from '../placeLessons';

/** 규칙이 쓰는 계산 결과 모음 */
export interface CheckCtx {
  p: Project;
  std: Standards;
  slots: Slot[];
  rows: WeekGridRow[];
  placed: Record<SubjectId, PlaceResult>;
  school: Record<SubjectId, { s1: number; s2: number }>; // 학기별 편제(저장된 값 없으면 기본 나누기)
}

export type Rule = (c: CheckCtx) => CheckResult[];

export const bandKey = (std: Standards, grade: number): string | undefined =>
  Object.keys(std.gradeBands).find((k) => std.gradeBands[k].grades.includes(grade));

export const bandOf = (c: CheckCtx): { key: string; band: GradeBand } | undefined => {
  const key = bandKey(c.std, c.p.grade);
  return key ? { key, band: c.std.gradeBands[key] } : undefined;
};

/** 교과(군) 이름 → 거기에 드는 교과들. 창체 영역은 '창체'. */
export const groupOf = (s: Subject): string => (s.kind === 'creative' ? '창체' : s.group);
export const members = (p: Project, group: string): Subject[] => p.subjects.filter((s) => groupOf(s) === group);

/** 이 해 본교 연간 시수 */
export const annual = (c: CheckCtx, id: SubjectId): number => c.p.curriculumPlan.schoolAnnual[id] ?? 0;
export const annualOf = (c: CheckCtx, group: string): number => members(c.p, group).reduce((a, s) => a + annual(c, s.id), 0);

export const res = (ruleId: string, level: CheckResult['level'], message: string, source: string, where: CheckResult['where'] = []): CheckResult =>
  ({ ruleId, level, message, where, source });

/** 진도 행에서 태그 이름들에 걸린 행 수(메모 행은 수업이 아니라 뺀다). subjects를 주면 그 교과만 */
export const tagCount = (lessonPlans: Record<SubjectId, PlanRow[]>, names: string[], subjects?: SubjectId[]): number =>
  Object.entries(lessonPlans).filter(([id]) => !subjects || subjects.includes(id)).flatMap(([, rows]) => rows)
    .filter((r) => r.kind !== 'memo' && r.tags.some((t) => names.includes(t))).length;
