import { bandOf, res, type Rule } from './common';

/** R2 학년군 2년 최소 시수. 작년 시수가 없으면 올해 몫과 비교하고 '작년 시수 입력 필요' */
export const r2: Rule = (c) => {
  const b = bandOf(c);
  if (!b) return [res('R2', 'warn', `${c.p.grade}학년의 학년군 기준이 없습니다.`, c.std.version)];
  const now = Object.values(c.p.curriculumPlan.schoolAnnual).reduce((a, x) => a + x, 0);
  const prior = c.p.priorYear?.total;
  if (prior === undefined) {
    const share = b.band.total / b.band.years;
    return [res('R2', now >= share ? 'warn' : 'fail', `올해 ${now}시간(올해 몫 ${share} 이상). 작년 시수 입력 필요`, b.band.source, [{ hours: now }])];
  }
  const ok = prior + now >= b.band.total;
  return [res('R2', ok ? 'pass' : 'fail', `학년군 ${b.band.years}년 합 ${prior + now}시간(기준 ${b.band.total} 이상)`, b.band.source, [{ hours: prior + now }])];
};
