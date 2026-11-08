import type { PlanRow } from '../../model/types';
import { res, type Rule } from './common';

/** 창체 영역은 한 묶음('창체')으로 본다 */
const keyOf = (c: Parameters<Rule>[0], id: string) => (c.p.subjects.find((s) => s.id === id)?.kind === 'creative' ? '창체' : id);

/**
 * R11 재구성 일관성
 * (가) 교과별 연간 증감 기록 합 = 편제 증감(본교 − 교육부 기준, 학교자율시간 제외)
 * (나) 진도에 ◆ 표시가 있는데 그 교과·학기 증감 기록이 없거나, 기록은 있는데 ◆ 표시가 없음
 */
export const r11: Rule = (c) => {
  const out = [];
  const plan = c.p.curriculumPlan;
  const adj = (key: string) => c.p.adjustments.filter((a) => keyOf(c, a.subjectId) === key).reduce((s, a) => s + a.hours, 0);
  const bad = c.p.subjects.filter((s) => s.kind === 'subject' && plan.standard[s.id] !== undefined).flatMap((s) => {
    const want = (plan.schoolAnnual[s.id] ?? 0) - plan.standard[s.id];
    return adj(s.id) === want ? [] : [{ name: s.name, id: s.id, got: adj(s.id), want }];
  });
  const cw = plan.creative.school - plan.creative.standard;
  if (c.p.adjustments.length > 0 && adj('창체') !== cw) bad.push({ name: '창체', id: '창체', got: adj('창체'), want: cw });
  if (bad.length === 0) out.push(res('R11', 'pass', '(가) 교과별 증감 기록 합이 편제 증감과 같음', '작업지시서 2.6'));
  for (const b of bad) out.push(res('R11', 'warn', `(가) ${b.name}: 증감 기록 합 ${b.got} / 편제 증감 ${b.want}`, '작업지시서 2.6', [{ subjectId: b.id, hours: b.got - b.want }]));

  // (나) ◆ 표시와 증감 기록(교과·학기)
  const marked = new Set<string>();
  const rows: PlanRow[] = Object.values(c.p.lessonPlans).flat();
  for (const r of rows) if (r.mark && r.semester) marked.add(`${r.semester}|${keyOf(c, r.subjectId)}`);
  const recorded = new Set(c.p.adjustments.map((a) => `${a.semester}|${keyOf(c, a.subjectId)}`));
  const name = (k: string) => c.p.subjects.find((s) => s.id === k)?.name ?? k;
  const line = (k: string) => ({ semester: Number(k.split('|')[0]) as 1 | 2, subjectId: k.split('|')[1], hours: 0 });
  for (const k of [...marked].filter((x) => !recorded.has(x)).sort()) {
    out.push(res('R11', 'warn', `(나) ${k.split('|')[0]}학기 ${name(k.split('|')[1])}: ◆ 표시는 있는데 증감 기록이 없음`, '작업지시서 7.5의 4번', [line(k)]));
  }
  for (const k of [...recorded].filter((x) => !marked.has(x)).sort()) {
    out.push(res('R11', 'warn', `(나) ${k.split('|')[0]}학기 ${name(k.split('|')[1])}: 증감 기록은 있는데 ◆ 표시가 없음`, '작업지시서 7.5의 4번', [line(k)]));
  }
  return out;
};
