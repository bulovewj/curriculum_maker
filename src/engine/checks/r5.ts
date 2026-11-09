import { bandKey, res, tagCount, type Rule } from './common';

/** R5 정보교육 학년군 최소 시수(【정보교육】 태그로 셈). 작년 값이 없으면 올해 몫 이상인지 경고 */
export const r5: Rule = (c) => {
  const key = bandKey(c.std, c.p.grade);
  const rule = key ? c.std.informatics[key] : undefined;
  const band = key ? c.std.gradeBands[key] : undefined;
  if (!rule || !band) return [];
  const now = tagCount(c.p.lessonPlans, [rule.tag], rule.subjects); // 기준 데이터가 정한 교과에서만 센다
  const prior = c.p.priorYear?.informatics;
  if (prior === undefined) {
    const share = rule.min / band.years;
    return [res('R5', 'warn', `정보교육 올해 ${now}시간(올해 몫 ${share} ${now >= share ? '이상' : '미달'}). 작년 값 입력 필요`, rule.source, [{ hours: now }])];
  }
  const ok = prior + now >= rule.min;
  return [res('R5', ok ? 'pass' : 'warn', `정보교육 ${band.years}년 합 ${prior + now}시간(기준 ${rule.min} 이상)`, rule.source, [{ hours: prior + now }])];
};
