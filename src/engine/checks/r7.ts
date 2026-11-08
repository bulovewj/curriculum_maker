import { res, type Rule } from './common';

/** R7 창체 영역 합 = 창체 편제 */
export const r7: Rule = (c) => {
  const areas = c.p.subjects.filter((s) => s.kind === 'creative').map((s) => c.p.curriculumPlan.schoolAnnual[s.id]);
  const total = c.p.curriculumPlan.creative.school;
  if (areas.every((a) => a === undefined)) return [res('R7', 'warn', `창체 영역별 시수가 없습니다(창체 계 ${total}). S4에서 입력하세요.`, '작업지시서 F7')];
  const sum = areas.reduce<number>((a, x) => a + (x ?? 0), 0);
  return [res('R7', sum === total ? 'pass' : 'fail', `창체 영역 합 ${sum} / 창체 편제 ${total}`, '작업지시서 F7', [{ hours: sum - total }])];
};
