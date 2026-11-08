import type { CalendarDay, SchoolWeekday, SpecialistCell, Subject, SubjectId, TimetableCell } from '../model/types';

export interface TimetableInput {
  shape: number[]; // 월~금 교시 수(틀)
  specialistCells: SpecialistCell[];
  schoolAnnual: Record<SubjectId, number>; // 연간 본교 시수(비율의 기준)
  subjects: Subject[];
  partialSpecialist: SubjectId[]; // 일부 전담 교과
  exclude: SubjectId[]; // 시간표에 안 넣는 교과
  blockSubjects: SubjectId[]; // 2칸 연속으로 놓는 교과
}

export interface TimetableResult {
  cells: TimetableCell[];
  perWeek: Record<SubjectId, number>; // 교과별 주당 칸 수(전담 포함)
  warnings: string[];
  doubled: { weekday: SchoolWeekday; period: number; subjectId: SubjectId }[]; // 하루 두 번 든 칸(노란색)
}

/** 기본 틀: 학사력 수업일의 요일별 가장 흔한 교시 수(같으면 큰 쪽) */
export function defaultShape(calendar: CalendarDay[]): number[] {
  return [1, 2, 3, 4, 5].map((w) => {
    const count = new Map<number, number>();
    for (const d of calendar) if (d.weekday === w && d.schoolDay && d.periods > 0) count.set(d.periods, (count.get(d.periods) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
  });
}

/** 비율대로 정수 나누기(작업지시서 2.8-2·3). 정수 부분 → 소수 부분 큰 순(같으면 교과 순서) → 0.5 이상인데 0이면 1로 올리고 가장 작은 소수 부분에서 뺀다. */
function share(total: number, weights: [SubjectId, number][]): Record<SubjectId, number> {
  const sum = weights.reduce((a, [, w]) => a + w, 0);
  const raw = weights.map(([id, w]) => ({ id, x: sum > 0 ? (total * w) / sum : 0 }));
  const out: Record<SubjectId, number> = Object.fromEntries(raw.map((r) => [r.id, Math.floor(r.x)]));
  const fr = Object.fromEntries(raw.map((r) => [r.id, r.x - Math.floor(r.x)])); // 소수 부분(처음 값으로 고정)
  let left = total - Object.values(out).reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => fr[b.id] - fr[a.id])) { // sort는 안정 정렬이라 같으면 교과 순서
    if (left <= 0) break;
    out[r.id]++;
    left--;
  }
  for (const r of raw) {
    if (r.x >= 0.5 && out[r.id] === 0) {
      const from = [...raw].filter((x) => out[x.id] >= 1).sort((a, b) => fr[a.id] - fr[b.id])[0];
      if (from) { out[from.id]--; out[r.id] = 1; }
    }
  }
  return out;
}

/** 대표 학급 기초 시간표 자동 생성(작업지시서 2.8). 같은 입력 → 같은 결과. */
export function generateTimetable(inp: TimetableInput): TimetableResult {
  const warnings: string[] = [];
  const order = new Map(inp.subjects.map((s) => [s.id, s.order]));
  const byOrder = (a: SubjectId, b: SubjectId) => (order.get(a) ?? 99) - (order.get(b) ?? 99);
  const total = inp.shape.reduce((a, b) => a + b, 0);
  const specCount: Record<SubjectId, number> = {};
  for (const c of inp.specialistCells) specCount[c.subjectId] = (specCount[c.subjectId] ?? 0) + 1;
  const full = Object.keys(specCount).filter((id) => !inp.partialSpecialist.includes(id));

  // 1) 전부 전담은 전담 칸 수, 2) 남은 칸은 나머지에 연간 시수 비율로
  const rest = total - full.reduce((a, id) => a + specCount[id], 0);
  const eligible = inp.subjects.filter((s) => !full.includes(s.id) && !inp.exclude.includes(s.id) && (inp.schoolAnnual[s.id] ?? 0) > 0).sort((a, b) => a.order - b.order);
  const quota = share(rest, eligible.map((s) => [s.id, inp.schoolAnnual[s.id]]));
  const perWeek: Record<SubjectId, number> = { ...quota, ...Object.fromEntries(full.map((id) => [id, specCount[id]])) };

  // 4) 일부 전담은 받은 칸에서 전담 칸을 뺀 만큼 담임 칸
  const homeroom: Record<SubjectId, number> = {};
  for (const [id, n] of Object.entries(quota)) {
    const sp = specCount[id] ?? 0;
    if (n < sp) warnings.push(`${inp.subjects.find((s) => s.id === id)?.name ?? id}: 받은 칸(${n})이 전담 칸(${sp})보다 적습니다.`);
    homeroom[id] = Math.max(0, n - sp);
  }

  const grid = new Map<string, SubjectId>();
  const cells: TimetableCell[] = [];
  const key = (w: number, k: number) => `${w}#${k}`;
  const put = (w: number, k: number, subjectId: SubjectId, specialist: boolean) => {
    grid.set(key(w, k), subjectId);
    cells.push({ weekday: w as SchoolWeekday, period: k, subjectId, specialist });
  };
  for (const c of inp.specialistCells) {
    if (c.period > (inp.shape[c.weekday - 1] ?? 0)) warnings.push(`전담 칸(${c.weekday}요일 ${c.period}교시)이 시간표 틀 밖입니다.`);
    put(c.weekday, c.period, c.subjectId, true);
  }
  const days = [1, 2, 3, 4, 5];
  const empty = (w: number) => Array.from({ length: inp.shape[w - 1] ?? 0 }, (_, i) => i + 1).filter((k) => !grid.has(key(w, k)));
  const inDay = (w: number, id: SubjectId) => [...grid].filter(([k, v]) => k.startsWith(`${w}#`) && v === id).length;
  const bestDay = (id: SubjectId, ok: (w: number) => boolean) => // 가장 적게 든 요일 → 빈 칸이 가장 많은 요일 → 요일 순
    days.filter(ok).sort((a, b) => inDay(a, id) - inDay(b, id) || empty(b).length - empty(a).length || a - b)[0];

  // 2) 블록 교과: 같은 요일 이어진 두 교시
  for (const id of inp.blockSubjects.filter((x) => homeroom[x]).sort(byOrder)) {
    while (homeroom[id] >= 2) {
      const w = bestDay(id, (d) => empty(d).some((k) => empty(d).includes(k + 1)));
      if (w === undefined) break;
      const k = empty(w).find((x) => empty(w).includes(x + 1))!;
      put(w, k, id, false);
      put(w, k + 1, id, false);
      homeroom[id] -= 2;
    }
  }
  // 3) 나머지: 담임 칸 많은 순
  const doubled: TimetableResult['doubled'] = [];
  const rows = Object.keys(homeroom).sort((a, b) => homeroom[b] - homeroom[a] || byOrder(a, b));
  for (const id of rows) {
    for (; homeroom[id] > 0; homeroom[id]--) {
      const w = bestDay(id, (d) => empty(d).length > 0);
      if (w === undefined) { warnings.push('시간표 틀의 칸이 모자라 다 놓지 못했습니다.'); break; }
      const k = empty(w)[0];
      if (inDay(w, id) > 0) doubled.push({ weekday: w as SchoolWeekday, period: k, subjectId: id });
      put(w, k, id, false);
    }
  }
  return { cells: cells.sort((a, b) => a.weekday - b.weekday || a.period - b.period), perWeek, warnings, doubled };
}
