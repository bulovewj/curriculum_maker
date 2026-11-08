import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyOverrides, generateSlots } from '../../src/engine/slots';
import { semesterTotals, weekGrid } from '../../src/engine/weekGrid';
import { readScheduleP04 } from '../../src/import/mappers/scheduleP04';
import { readSpecialistCells } from '../../src/import/mappers/specialistP02';
import { readClassTimetable } from '../../src/import/mappers/timetableP02';
import type { TimePlanTable } from '../../src/import/mappers/timePlanHwpx';
import { readWorkbook } from '../../src/import/xlsx/readWorkbook';
import { newProject } from '../../src/model/newProject';
import { defaultSubjects } from '../../src/model/subjects';
import type { CalendarDay } from '../../src/model/types';
import { ORIGINAL, findFile, readBuffer } from '../files';

const EXPECTED = 'fixtures/2026-g6/expected';
const read = (name: string) => JSON.parse(new TextDecoder().decode(readFileSync(`${EXPECTED}/${name}`)));
const p04 = findFile(ORIGINAL, '행사 및 일정');
const p02 = findFile(ORIGINAL, '전담 및 학급');

/** 정답지 A: P04 + 보정 2건(작업지시서 7.2, 학기 중 변경으로 (c)와 다른 교시), P02 7반 */
async function setup() {
  const sched = readScheduleP04(await readWorkbook(readBuffer(p04!)), 2026, 6);
  const fix: Record<string, number> = { '2026-09-29': 6, '2027-02-02': 6 };
  const calendar: CalendarDay[] = sched.calendar.map((d) => (fix[d.date] ? { ...d, periods: fix[d.date] } : d));
  const sheets = await readWorkbook(readBuffer(p02!));
  const sp = readSpecialistCells(sheets, 6, 7, defaultSubjects);
  const base = readClassTimetable(sheets, 6, 7, defaultSubjects, sp.cells).cells;
  const project = newProject('g', 2026);
  const slots = applyOverrides(generateSlots(calendar, base, project.settings), {});
  const ids = defaultSubjects.map((s) => s.id);
  return { calendar, slots, ids, project, rows: weekGrid(calendar, slots, project.semesters, 'weekStart', ids) };
}

describe.skipIf(!p04 || !p02)('정답지 A: 학사력 × 시간표 = (c)의 주별 수업일·교시·총계', () => {
  it('모든 주의 주차·기간·월·수업일·요일별 교시·총계가 (c)와 같다', async () => {
    const { rows } = await setup();
    const c: TimePlanTable[] = read('week-grid.json');
    const sum = (h: Record<string, number>) => Object.values(h).reduce((a, b) => a + b, 0);
    for (const t of c) {
      const mine = rows.filter((r) => r.semester === t.semester);
      expect(mine.map((r) => r.week)).toEqual(t.rows.map((r) => r.week));
      for (const want of t.rows) {
        const got = mine.find((r) => r.week === want.week)!;
        expect([want.semester, want.week, got.period, got.month, got.schoolDays, got.dayPeriods, sum(got.hours)]).toEqual(
          [want.semester, want.week, want.period, want.month, want.schoolDays, want.dayPeriods, sum(want.hours)],
        );
      }
    }
  });

  it('학기별 요일 합: 1학기 월113 화119 수95 목120 금108', async () => {
    const { rows } = await setup();
    const col = (sem: number, k: number) => rows.filter((r) => r.semester === sem).reduce((a, r) => a + r.dayPeriods[k], 0);
    expect([0, 1, 2, 3, 4].map((k) => col(1, k))).toEqual([113, 119, 95, 120, 108]);
    expect([0, 1, 2, 3, 4].map((k) => col(2, k))).toEqual([108, 121, 105, 111, 92]);
  });

  it('늘어난 교시(4.23.·4.24. 7교시)는 자율·자치로 들어간다', async () => {
    const { slots } = await setup();
    for (const d of ['2026-04-23', '2026-04-24']) {
      expect(slots.find((s) => s.date === d && s.period === 7)).toMatchObject({ subjectId: 'ca-self', origin: 'extra' });
    }
  });

  it('기본 시수표와 편제 차이 = 작업지시서 F5의 숫자(1학기)', async () => {
    const { rows } = await setup();
    const total = semesterTotals(rows, 1);
    const plan = read('totals.json').subjects;
    const diff = Object.fromEntries(Object.keys(total).filter((id) => plan[id]).map((id) => [id, plan[id].s1 - total[id]]));
    expect(diff).toMatchObject({
      autonomy: 32, 'ca-self': 16, pe: 14, 'ca-career': 3, kor: -13, soc: -10, 'ca-club': -10,
      sci: -9, prac: -7, eng: -6, mor: -3, math: -3, music: -2, art: -2,
    });
    expect(Object.values(diff).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('같은 입력이면 같은 결과', async () => {
    const a = await setup();
    const b = await setup();
    expect(b.rows).toEqual(a.rows);
    expect(b.slots).toEqual(a.slots);
  });
});
