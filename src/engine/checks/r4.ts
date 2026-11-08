import { annualOf, bandOf, res, type Rule } from './common';

/** R4 체육·예술(음악/미술) 감축 없음 */
export const r4: Rule = (c) => {
  const b = bandOf(c);
  if (!b) return [];
  const bad = c.std.noReduce.groups.flatMap((g) => {
    const share = (b.band.hours[g] ?? 0) / b.band.years;
    const school = annualOf(c, g);
    return school < share ? [{ g, share, school }] : [];
  });
  if (bad.length === 0) return [res('R4', 'pass', `${c.std.noReduce.groups.join('·')} 감축 없음`, c.std.noReduce.source)];
  return bad.map((x) => res('R4', 'fail', `${x.g}은(는) 줄일 수 없습니다(본교 ${x.school} < 기준 ${x.share})`, c.std.noReduce.source, [{ hours: x.school - x.share }]));
};
