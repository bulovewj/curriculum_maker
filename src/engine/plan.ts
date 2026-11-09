import type { Project, Slot, SubjectId } from '../model/types';

type Split = Record<SubjectId, { s1: number; s2: number }>;

/**
 * 학기 나누기 기본값: 학기별 칸 수 비율로 나누고 연간 합을 유지한다 (작업지시서 F4).
 * 교과마다 따로 반올림하면 1학기 합이 1학기 칸 수와 어긋나 [자동 맞추기]로도 못 맞춘다.
 * 그래서 내림한 뒤 1학기 목표 합(= 1학기 칸 비율 × 연간 합)까지 소수점이 큰 교과부터 1씩 더한다(같으면 교과 순서).
 * target1을 주면 1학기 합을 그 값으로 맞춘다(이미 정한 교과를 뺀 나머지만 나눌 때).
 * autonomyInFirst가 true면 학교자율시간은 1학기에 몰아 두고 나머지로 목표를 맞춘다.
 */
export function splitSemesters(annual: Record<SubjectId, number>, slots: Slot[], autonomyIds: SubjectId[] = [], autonomyInFirst = false, target1?: number): Split {
  const n1 = slots.filter((s) => s.semester === 1).length;
  const n2 = slots.filter((s) => s.semester === 2).length;
  const r1 = n1 + n2 === 0 ? 0.5 : n1 / (n1 + n2);
  const ids = Object.keys(annual);
  const fixed = (id: SubjectId) => autonomyInFirst && autonomyIds.includes(id);
  const total = ids.reduce((a, id) => a + annual[id], 0);
  // target1 = 1학기 합 목표(일부 교과만 나눌 때 나머지 교과 몫을 뺀 값)
  const target = (target1 ?? (total === n1 + n2 ? n1 : Math.round(total * r1))) - ids.filter(fixed).reduce((a, id) => a + annual[id], 0);
  const free = ids.filter((id) => !fixed(id));
  const s1 = Object.fromEntries(free.map((id) => [id, Math.floor(annual[id] * r1)]));
  let left = target - free.reduce((a, id) => a + s1[id], 0);
  const frac = (id: SubjectId) => annual[id] * r1 - Math.floor(annual[id] * r1);
  for (const id of [...free].sort((a, b) => frac(b) - frac(a) || free.indexOf(a) - free.indexOf(b))) {
    if (left <= 0) break;
    if (s1[id] < annual[id]) { s1[id]++; left--; }
  }
  // 목표가 내림 합보다 작으면(이미 정한 교과가 1학기에 많이 가져감) 소수점이 작은 교과부터 1씩 뺀다
  for (const id of [...free].sort((a, b) => frac(a) - frac(b) || free.indexOf(b) - free.indexOf(a))) {
    while (left < 0 && s1[id] > 0) { s1[id]--; left++; }
    if (left >= 0) break;
  }
  return Object.fromEntries(ids.map((id) => {
    const a = fixed(id) ? annual[id] : s1[id];
    return [id, { s1: a, s2: annual[id] - a }];
  }));
}

/**
 * 저장된 학기 값이 없거나 연간과 맞지 않는(편제를 다시 넣어 연간만 바뀐) 교과는 기본 나누기로 채운 편제.
 * 연간이 없는 교과의 학기 값은 그대로 둔다.
 */
export function effectiveSchool(p: Project, slots: Slot[]): Split {
  const annual = p.curriculumPlan.schoolAnnual;
  const defaults = splitSemesters(annual, slots);
  const valid = Object.entries(p.curriculumPlan.school).filter(([id, h]) => annual[id] === undefined || h.s1 + h.s2 === annual[id]);
  return { ...defaults, ...Object.fromEntries(valid) };
}

export interface PlanGap {
  subjectId: SubjectId;
  semester: 1 | 2;
  slots: number; // 주별 시수표 칸 수
  plan: number; // 편제 학기 시수
}

/** 학기마다 칸 수 ≠ 편제인 교과(편제가 있는 교과만). S5 [자동 맞추기]를 안 했거나 덜 맞춘 것. */
export function planGaps(p: Project, slots: Slot[]): PlanGap[] {
  const school = effectiveSchool(p, slots);
  return p.subjects.flatMap((s) => {
    const h = school[s.id];
    if (!h) return [];
    return ([1, 2] as const).flatMap((sem) => {
      const n = slots.filter((x) => x.semester === sem && x.subjectId === s.id).length;
      const want = sem === 1 ? h.s1 : h.s2;
      return n === want ? [] : [{ subjectId: s.id, semester: sem, slots: n, plan: want }];
    });
  });
}

/** 학기 값을 교사가 정하지 않아 칸 비율로 추정 중인 교과(저장된 학기 값이 없거나 연간과 안 맞음) */
export function estimatedSubjects(p: Project): SubjectId[] {
  const annual = p.curriculumPlan.schoolAnnual;
  return Object.keys(annual).filter((id) => {
    const h = p.curriculumPlan.school[id];
    return !h || h.s1 + h.s2 !== annual[id];
  });
}

/**
 * S4 [칸 비율로 채우기]: 교사가 이미 정한 학기 값(연간과 맞는 것)은 두고, 추정 중인 교과만 나눠 저장한다.
 * inFirst면 학교자율시간도 1학기로 다시 정한다. 편제 합 = 칸 수이면 1학기 합이 1학기 칸 수와 같게 맞춘다.
 */
export function fillEstimated(c: Project['curriculumPlan'], slots: Slot[], autonomyIds: SubjectId[], inFirst: boolean): Split {
  const annual = c.schoolAnnual;
  const keep = Object.fromEntries(Object.entries(c.school).filter(([id, h]) =>
    annual[id] !== undefined && h.s1 + h.s2 === annual[id] && !(inFirst && autonomyIds.includes(id))));
  const rest = Object.fromEntries(Object.entries(annual).filter(([id]) => !(id in keep)));
  const n1 = slots.filter((x) => x.semester === 1).length;
  const fits = Object.values(annual).reduce((a, b) => a + b, 0) === slots.length;
  const target1 = fits ? n1 - Object.values(keep).reduce((a, h) => a + h.s1, 0) : undefined;
  return { ...splitSemesters(rest, slots, autonomyIds, inFirst, target1), ...keep };
}
