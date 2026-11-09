import { res, type Rule } from './common';

/** R8 칸 수 = 진도 행 수(교과·학기마다). 빈 칸·남는 행 0. 학기 없는 연간 진도는 1년 합으로 본다. */
export const r8: Rule = (c) => {
  const src = '작업지시서 F7';
  // 진도 파일이 없는 교과는 학기마다 빨강을 내지 않고 한 줄만 알린다
  const none = c.p.subjects.filter((s) => (c.p.lessonPlans[s.id] ?? []).length === 0 && c.placed[s.id].freeSlots.length > 0);
  const noneLines = none.map((s) => res('R8', 'warn', `${s.name}: 진도 파일 없음(칸 ${c.placed[s.id].freeSlots.length}개)`, src, [{ subjectId: s.id, hours: -c.placed[s.id].freeSlots.length }]));
  const text = (need: number) => (need > 0 ? `감축 필요 ${need}` : `증배 필요 ${-need}`);
  // 남는 행과 빈 칸이 함께 있으면 차이가 0이어도 맞지 않다(주 고정 행이 칸 없는 주에 묶인 경우 등)
  const judge = (label: string, sur: number, free: number, where: { semester?: 1 | 2; subjectId: string }) => {
    if (sur === 0 && free === 0) return [];
    const need = sur - free;
    const msg = need !== 0 ? text(need) : `못 놓은 행 ${sur}·빈 칸 ${free}(주 고정 확인)`;
    return [res('R8', 'fail', `${label}: ${msg}`, src, [{ ...where, hours: need }])];
  };
  const bad = c.p.subjects.filter((s) => !none.includes(s)).flatMap((s) => {
    const r = c.placed[s.id];
    if ((c.p.lessonPlans[s.id] ?? []).some((x) => x.semester === undefined)) {
      return judge(`${s.name}(연간)`, r.surplusRows.length, r.freeSlots.length, { subjectId: s.id });
    }
    return [1, 2].flatMap((n) =>
      judge(`${n}학기 ${s.name}`, r.surplusRows.filter((x) => x.semester === n).length, r.freeSlots.filter((x) => x.semester === n).length, { semester: n as 1 | 2, subjectId: s.id }));
  });
  if (bad.length === 0 && noneLines.length === 0) return [res('R8', 'pass', '교과·학기마다 칸 수와 진도 행 수가 같음', src)];
  return [...noneLines, ...bad];
};
