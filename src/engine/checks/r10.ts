import { res, tagCount, type Rule } from './common';

/** R10 범교과·법정 태그 충족. 학년 몫이 정해진 항목만 판정하고, 나머지는 횟수만 보여 준다. */
export const r10: Rule = (c) =>
  c.std.tags.filter((t) => t.grades.includes(c.p.grade)).map((t) => {
    const n = tagCount(c.p.lessonPlans, t.aliases);
    const text = `${t.name}: ${n}${t.unit}(기준 ${t.min}${t.unit} 이상, ${t.period})`;
    if (!t.gradeShare) return res('R10', 'pass', `${text} — 학교 전체 기준이라 횟수만 표시`, t.source, [{ hours: n }]);
    return res('R10', n >= t.min ? 'pass' : 'warn', text, t.source, [{ hours: n - t.min }]);
  });
