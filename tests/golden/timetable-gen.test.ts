import { describe, expect, it } from 'vitest';
import { defaultShape, generateTimetable, type TimetableInput } from '../../src/engine/generateTimetable';
import { autoBalance, defaultDonors } from '../../src/engine/autoBalance';
import { applyOverrides, generateSlots } from '../../src/engine/slots';
import { semesterTotals, weekGrid } from '../../src/engine/weekGrid';
import { need2026, project2026 } from './project2026';

const input = async (): Promise<TimetableInput> => {
  const p = await project2026();
  return { shape: defaultShape(p.calendar), specialistCells: p.specialistCells, schoolAnnual: p.curriculumPlan.schoolAnnual, subjects: p.subjects, partialSpecialist: p.settings.partialSpecialist, exclude: p.settings.timetableExclude, blockSubjects: p.settings.blockSubjects };
};
const count = (cells: { subjectId: string }[]) => cells.reduce<Record<string, number>>((m, c) => ({ ...m, [c.subjectId]: (m[c.subjectId] ?? 0) + 1 }), {});

describe.skipIf(!need2026)('정답지 D: 기초 시간표 자동 생성 = P02 7반', () => {
  it('틀은 월6 화6 수5 목6 금6', async () => {
    expect((await input()).shape).toEqual([6, 6, 5, 6, 6]);
  });
  it('교과별 주당 칸 수와 전담 칸 위치가 P02 7반과 같다', async () => {
    const p = await project2026();
    const r = generateTimetable(await input());
    expect(r.warnings).toEqual([]);
    expect(count(r.cells)).toEqual(count(p.baseTimetable));
    const spec = (cells: { weekday: number; period: number; subjectId: string; specialist: boolean }[]) =>
      cells.filter((c) => c.specialist).map((c) => `${c.weekday}#${c.period}#${c.subjectId}`).sort();
    expect(spec(r.cells)).toEqual(p.specialistCells.map((c) => `${c.weekday}#${c.period}#${c.subjectId}`).sort());
  });
  it('미술은 2칸 연속, 블록 아닌 교과는 하루에 한 번만', async () => {
    const r = generateTimetable(await input());
    const art = r.cells.filter((c) => c.subjectId === 'art');
    expect(art).toHaveLength(2);
    expect(art[0].weekday).toBe(art[1].weekday);
    expect(Math.abs(art[0].period - art[1].period)).toBe(1);
    expect(r.doubled.filter((d) => d.subjectId !== 'art')).toEqual([]);
  });
  it('같은 입력 두 번 → 같은 결과', async () => {
    const i = await input();
    expect(generateTimetable(i)).toEqual(generateTimetable(i));
  });
  it('만든 시간표 + 학사력 + 자동 맞추기 → 학기·교과 계가 편제와 같다(정답지 C와 같은 판정)', async () => {
    const p = await project2026();
    const r = generateTimetable(await input());
    const ids = p.subjects.map((s) => s.id);
    const slots = generateSlots(p.calendar, r.cells, p.settings);
    const school = p.curriculumPlan.school;
    const b = autoBalance(slots, school, ids, defaultDonors(p.subjects));
    expect(b.warnings).toEqual([]);
    const rows = weekGrid(p.calendar, applyOverrides(slots, b.overrides), p.semesters, 'weekStart', ids);
    for (const sem of [1, 2] as const) {
      const t = semesterTotals(rows, sem);
      for (const id of ids) expect([sem, id, t[id] ?? 0]).toEqual([sem, id, sem === 1 ? school[id].s1 : school[id].s2]);
    }
  });
});
