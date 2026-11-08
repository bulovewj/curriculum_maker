import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { importWeekGrid } from '../../src/engine/importWeekGrid';
import { needOf, placeAll } from '../../src/engine/placeLessons';
import { applyOverrides, generateSlots } from '../../src/engine/slots';
import { weekGrid } from '../../src/engine/weekGrid';
import { readScheduleP04 } from '../../src/import/mappers/scheduleP04';
import { readSpecialistCells } from '../../src/import/mappers/specialistP02';
import type { TimePlanTable } from '../../src/import/mappers/timePlanHwpx';
import { readClassTimetable } from '../../src/import/mappers/timetableP02';
import { readWorkbook } from '../../src/import/xlsx/readWorkbook';
import { newProject } from '../../src/model/newProject';
import { defaultSubjects } from '../../src/model/subjects';
import type { PlanRow, Semester } from '../../src/model/types';
import { ORIGINAL, findFile, readBuffer } from '../files';

const read = (name: string) => JSON.parse(new TextDecoder().decode(readFileSync(`fixtures/2026-g6/expected/${name}`)));
const p04 = findFile(ORIGINAL, '행사 및 일정');
const p02 = findFile(ORIGINAL, '전담 및 학급');

interface ExpectedTable { subjectId: string; semester: Semester; rows: { week: number; subjectId: string; kind: PlanRow['kind']; unit: string; topic: string }[] }

/** 정답지 B(주): A + (c) 주별 값 가져오기 + (d)(e) 진도 행(주 지움) */
async function setup() {
  const sched = readScheduleP04(await readWorkbook(readBuffer(p04!)), 2026, 6);
  const fix: Record<string, number> = { '2026-09-29': 6, '2027-02-02': 6 }; // 7.2 보정
  const calendar = sched.calendar.map((d) => (fix[d.date] ? { ...d, periods: fix[d.date] } : d));
  const sheets = await readWorkbook(readBuffer(p02!));
  const sp = readSpecialistCells(sheets, 6, 7, defaultSubjects);
  const base = readClassTimetable(sheets, 6, 7, defaultSubjects, sp.cells).cells;
  const project = newProject('g', 2026);
  const ids = defaultSubjects.map((s) => s.id);
  const baseSlots = generateSlots(calendar, base, project.settings);
  const c: TimePlanTable[] = read('week-grid.json');
  const imported = importWeekGrid(baseSlots, c.flatMap((t) => t.rows), ids);
  const slots = applyOverrides(baseSlots, imported.overrides);
  const tables: ExpectedTable[] = [...read('progress-s1.json'), ...read('progress-s2.json')].filter((t: ExpectedTable) => t.subjectId !== 'creative-total');
  const lessonPlans: Record<string, PlanRow[]> = {};
  for (const t of tables) {
    lessonPlans[t.subjectId] = [...(lessonPlans[t.subjectId] ?? []), ...t.rows.map((r, i) => ({
      id: `${t.subjectId}-${t.semester}-${i}`, subjectId: t.subjectId, semester: t.semester, kind: r.kind, unit: r.unit, topic: r.topic,
      standards: [], tags: [], source: { file: 'expected', row: i },
    }))];
  }
  return { calendar, slots, c, imported, project, ids, tables, lessonPlans, placed: placeAll(slots, lessonPlans, defaultSubjects) };
}

describe.skipIf(!p04 || !p02)('정답지 B(주): (c) 가져오기 + (d)(e) 진도 = 행마다 같은 주', () => {
  it('(c)를 가져오면 주별 시수표가 (c)와 칸 하나까지 같다', async () => {
    const { calendar, slots, c, imported, project, ids } = await setup();
    expect(imported.warnings).toEqual([]);
    const rows = weekGrid(calendar, slots, project.semesters, 'weekStart', ids);
    for (const t of c) {
      for (const want of t.rows) {
        const got = rows.find((r) => r.semester === t.semester && r.week === want.week)!;
        expect([t.semester, want.week, got.hours]).toEqual([t.semester, want.week, want.hours]);
      }
    }
  });

  it('모든 교과·모든 행의 주가 (d)(e)와 같다', async () => {
    const { tables, placed } = await setup();
    const miss: string[] = [];
    let n = 0;
    for (const t of tables) {
      const got = placed[t.subjectId].placed.filter((p) => p.row.semester === t.semester);
      t.rows.forEach((want, i) => {
        n++;
        const g = got[i];
        if (!g || g.slot.week !== want.week) miss.push(`${t.subjectId} ${t.semester}학기 ${i + 1}행: 기대 ${want.week}주 / 실제 ${g?.slot.week ?? '없음'}`);
      });
    }
    expect(n).toBeGreaterThan(900);
    expect(miss).toEqual([]);
  });

  it('교과마다 필요량 0 (행 수 = 칸 수)', async () => {
    const { placed } = await setup();
    const need = Object.fromEntries(Object.entries(placed).map(([id, r]) => [id, needOf(r)]));
    expect(need).toEqual(Object.fromEntries(Object.keys(need).map((id) => [id, 0])));
  });

  it('같은 입력이면 같은 결과', async () => {
    const a = await setup();
    const b = await setup();
    expect(b.imported.overrides).toEqual(a.imported.overrides);
    expect(b.placed).toEqual(a.placed);
  });
});
