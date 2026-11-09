import { estimatedSubjects } from '../plan';
import { semesterTotals } from '../weekGrid';
import { res, type Rule } from './common';

/** R9 편제 학기 계 = 주별 시수표 학기 계 */
export const r9: Rule = (c) => {
  const total = [semesterTotals(c.rows, 1), semesterTotals(c.rows, 2)];
  const bad = c.p.subjects.flatMap((s) => [1, 2].flatMap((n) => {
    const plan = (n === 1 ? c.school[s.id]?.s1 : c.school[s.id]?.s2) ?? 0;
    const got = total[n - 1][s.id] ?? 0;
    return plan === got ? [] : [{ s, n, plan, got }];
  }));
  // 교사가 학기 값을 정하지 않은 교과는 칸 비율 추정값이라 문서에 그대로 나가면 안 된다
  const est = estimatedSubjects(c.p).map((id) => c.p.subjects.find((s) => s.id === id)?.name ?? id);
  const estLine = est.length ? [res('R9', 'warn', `학기 값이 추정값인 교과 ${est.length}개(${est.join(', ')}). S4에서 학교가 정한 학기 값을 넣거나 [칸 비율로 채우기]로 확정하세요.`, '작업지시서 F4')] : [];
  if (bad.length === 0) return [...estLine, res('R9', 'pass', '편제 학기 계와 주별 시수표 학기 계가 같음', '작업지시서 F7')];
  return [...estLine, ...bad.map(({ s, n, plan, got }) => res('R9', 'fail', `${n}학기 ${s.name}: 편제 ${plan} / 주별 시수표 ${got}`, '작업지시서 F7', [{ semester: n as 1 | 2, subjectId: s.id, hours: got - plan }]))];
};
