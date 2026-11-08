import { res, type Rule } from './common';

/** R1 수업일수 기준 이상 */
export const r1: Rule = (c) => {
  const src = c.std.schoolDays.source;
  if (c.p.calendar.length === 0) return [res('R1', 'warn', '학사력이 없어 수업일수를 검사할 수 없습니다.', src)];
  const days = [1, 2].map((n) => c.p.calendar.filter((d) => d.semester === n && d.schoolDay).length);
  const total = days[0] + days[1];
  const ok = total >= c.std.schoolDays.min;
  return [res('R1', ok ? 'pass' : 'fail', `수업일수 ${total}일(기준 ${c.std.schoolDays.min}일 이상)`, src, [
    { semester: 1, hours: days[0] }, { semester: 2, hours: days[1] },
  ])];
};
