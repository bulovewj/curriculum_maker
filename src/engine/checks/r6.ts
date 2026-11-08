import { bandKey, res, type Rule } from './common';

/** R6 학교자율시간 운영: 시수(판본 값), 한 학기 이상 */
export const r6: Rule = (c) => {
  const key = bandKey(c.std, c.p.grade);
  const need = key ? c.std.autonomy[key] : undefined;
  if (typeof need !== 'number') return [];
  const ids = c.p.subjects.filter((s) => s.kind === 'autonomy').map((s) => s.id);
  const hours = ids.reduce((a, id) => a + (c.p.curriculumPlan.schoolAnnual[id] ?? 0), 0);
  const semesters = [1, 2].filter((n) => ids.some((id) => ((n === 1 ? c.school[id]?.s1 : c.school[id]?.s2) ?? 0) > 0)).length;
  const ok = hours >= need && semesters >= c.std.autonomy.minSemesters;
  return [res('R6', ok ? 'pass' : 'warn', `학교자율시간 ${hours}시간·${semesters}학기(기준 ${need}시간 이상, ${c.std.autonomy.minSemesters}학기 이상)`, c.std.autonomy.source, [{ hours }])];
};
