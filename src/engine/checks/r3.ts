import { annualOf, bandOf, res, type Rule } from './common';

/** R3 교과(군)별 증감 ±기준% 이내 */
export const r3: Rule = (c) => {
  const b = bandOf(c);
  if (!b) return [];
  const limit = c.std.adjustRange.percent / 100;
  const out = Object.entries(b.band.hours).flatMap(([group, twoYears]) => {
    const share = twoYears / b.band.years;
    const school = annualOf(c, group);
    const pct = (school - share) / share;
    return Math.abs(pct) > limit + 1e-9 ? [{ group, share, school, pct }] : [];
  });
  if (out.length === 0) return [res('R3', 'pass', `교과(군) 증감이 모두 ±${c.std.adjustRange.percent}% 이내`, c.std.adjustRange.source)];
  return out.map((o) => res('R3', 'fail', `${o.group} 증감 ${(o.pct * 100).toFixed(1)}%(본교 ${o.school}, 기준 ${o.share}, 범위 ±${c.std.adjustRange.percent}%)`, c.std.adjustRange.source, [{ hours: o.school - o.share }]));
};
