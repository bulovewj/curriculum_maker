import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { autoBalance, defaultDonors } from '../../src/engine/autoBalance';
import { applyOverrides, generateSlots } from '../../src/engine/slots';
import { semesterTotals, weekGrid } from '../../src/engine/weekGrid';
import { readScheduleP04 } from '../../src/import/mappers/scheduleP04';
import { readSpecialistCells } from '../../src/import/mappers/specialistP02';
import type { TimePlanTable } from '../../src/import/mappers/timePlanHwpx';
import { readClassTimetable } from '../../src/import/mappers/timetableP02';
import { readWorkbook } from '../../src/import/xlsx/readWorkbook';
import { newProject } from '../../src/model/newProject';
import { defaultSubjects } from '../../src/model/subjects';
import type { Slot, SlotOverride } from '../../src/model/types';
import { ORIGINAL, findFile, readBuffer } from '../files';

const read = (name: string) => JSON.parse(new TextDecoder().decode(readFileSync(`fixtures/2026-g6/expected/${name}`)));
const p04 = findFile(ORIGINAL, '행사 및 일정');
const p02 = findFile(ORIGINAL, '전담 및 학급');
const ids = defaultSubjects.map((s) => s.id);

/** 정답지 C: A(보정 2건 포함) + 편제 학기 값((c) 학기 계 = totals.json) + 자동 맞추기 */
async function setup() {
  const sched = readScheduleP04(await readWorkbook(readBuffer(p04!)), 2026, 6);
  const fix: Record<string, number> = { '2026-09-29': 6, '2027-02-02': 6 };
  const calendar = sched.calendar.map((d) => (fix[d.date] ? { ...d, periods: fix[d.date] } : d));
  const sheets = await readWorkbook(readBuffer(p02!));
  const sp = readSpecialistCells(sheets, 6, 7, defaultSubjects);
  const base = readClassTimetable(sheets, 6, 7, defaultSubjects, sp.cells).cells;
  const project = newProject('g', 2026);
  const slots = generateSlots(calendar, base, project.settings);
  const totals = read('totals.json').subjects;
  const school = Object.fromEntries(ids.map((id) => [id, { s1: totals[id].s1, s2: totals[id].s2 }]));
  return { calendar, slots, school, project };
}
const donors = defaultDonors(defaultSubjects);
const effective = (slots: Slot[], o: Record<string, SlotOverride>) => applyOverrides(slots, o);

describe.skipIf(!p04 || !p02)('정답지 C: 자동 맞추기 후 학기·교과 계 = 편제', () => {
  it('학기·교과 계가 편제와 같다', async () => {
    const { calendar, slots, school, project } = await setup();
    const r = autoBalance(slots, school, ids, donors);
    expect(r.warnings).toEqual([]);
    const rows = weekGrid(calendar, effective(slots, r.overrides), project.semesters, 'weekStart', ids);
    for (const sem of [1, 2] as const) {
      const t = semesterTotals(rows, sem);
      for (const id of ids) expect([sem, id, t[id] ?? 0]).toEqual([sem, id, sem === 1 ? school[id].s1 : school[id].s2]);
    }
    expect(r.changes.length).toBeGreaterThan(0);
  });

  it('바꾼 전담 칸이 모두 경고 목록에 나온다', async () => {
    const { slots, school } = await setup();
    const r = autoBalance(slots, school, ids, donors);
    const changedSpecialist = r.changes.filter((c) => c.specialist);
    expect(r.specialistWarnings).toHaveLength(changedSpecialist.length);
    for (const c of changedSpecialist) expect(r.specialistWarnings.some((w) => w.includes(`${c.date} ${c.period}교시`))).toBe(true);
    console.log(`전담 칸 변경 ${changedSpecialist.length}개 / 전체 변경 ${r.changes.length}칸`);
  });

  it('잠긴 칸은 건드리지 않는다', async () => {
    const { slots, school } = await setup();
    const first = autoBalance(slots, school, ids, donors);
    // 첫 결과에서 바뀐 칸을 모두 잠그고 다시 돌리면, 그 칸들은 그대로여야 한다
    const locked: Record<string, SlotOverride> = Object.fromEntries(
      first.changes.map((c) => [`${c.date}#${c.period}`, { subjectId: c.from, kind: 'edited' as const, locked: true }]),
    );
    const again = autoBalance(effective(slots, locked), school, ids, donors);
    for (const key of Object.keys(locked)) expect(again.overrides[key]).toBeUndefined();
    expect(again.warnings.length + again.changes.length).toBeGreaterThanOrEqual(0);
  });

  it('같은 입력이면 같은 결과', async () => {
    const { slots, school } = await setup();
    expect(autoBalance(slots, school, ids, donors)).toEqual(autoBalance(slots, school, ids, donors));
  });

  it('(c)와의 주별 차이를 요약한다(판정 없음)', async () => {
    const { calendar, slots, school, project } = await setup();
    const r = autoBalance(slots, school, ids, donors);
    const rows = weekGrid(calendar, effective(slots, r.overrides), project.semesters, 'weekStart', ids);
    const c: TimePlanTable[] = read('week-grid.json');
    let cells = 0;
    let diffCells = 0;
    const bySubject: Record<string, number> = {};
    for (const t of c) for (const want of t.rows) {
      const got = rows.find((x) => x.semester === t.semester && x.week === want.week)!;
      for (const id of ids) {
        cells++;
        const d = Math.abs((got.hours[id] ?? 0) - (want.hours[id] ?? 0));
        if (d) { diffCells++; bySubject[id] = (bySubject[id] ?? 0) + d; }
      }
    }
    console.log(`(c)와 주별 값이 다른 칸 ${diffCells}/${cells}`, bySubject);
    expect(cells).toBeGreaterThan(500);
  });
});
