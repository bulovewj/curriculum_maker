import { readFileSync } from 'node:fs';
import { generateSlots } from '../../src/engine/slots';
import { importWeekGrid } from '../../src/engine/importWeekGrid';
import { detectFile } from '../../src/import/detect';
import { interpret } from '../../src/import/interpret';
import { readHwpx } from '../../src/import/hwpx/readHwpx';
import { readTimePlan } from '../../src/import/mappers/timePlanHwpx';
import { newProject } from '../../src/model/newProject';
import { renameAutonomy } from '../../src/model/subjects';
import type { Project } from '../../src/model/types';
import { ORIGINAL, REF, findFile, readBuffer } from '../files';

// 2026 신명초 6학년 프로젝트를 입력 파일에서 만든다(정답지 테스트 공용)
const AT = '2026-11-08T00:00:00.000Z';
export const need2026 = findFile(ORIGINAL, '행사 및 일정') && findFile(ORIGINAL, '전담 및 학급') && findFile(ORIGINAL, '시간 운영계획')
  && findFile(ORIGINAL, '1학기 교과진도') && findFile(REF, '시수 증가') && findFile(REF, '학사일정 및 교육과정편제');

async function feed(p: Project, path: string): Promise<Project> {
  const name = path.split('/').pop()!.normalize('NFC');
  const data = readBuffer(path);
  return (await interpret((await detectFile(name, data)).kind, name, data, p)).apply(p, AT);
}

/** 2026 신명초 6학년 프로젝트: 입력 파일 → 보정 2건 → (c) 가져오기 → 편제 학기 값 */
export async function project2026(): Promise<Project> {
  let p = newProject('g', 2026);
  p = { ...p, representativeClass: 7, subjects: renameAutonomy(p.subjects, '신명똑디') };
  const f = (d: string, k: string) => findFile(d, k)!;
  for (const [d, k] of [[ORIGINAL, '행사 및 일정'], [ORIGINAL, '전담 및 학급'], [REF, '학사일정 및 교육과정편제'], [REF, '시수 증가'],
    [ORIGINAL, '1학기 교과진도'], [ORIGINAL, '2학기 교과진도']] as const) p = await feed(p, f(d, k));
  const fix: Record<string, number> = { '2026-09-29': 6, '2027-02-02': 6 }; // 7.2 보정
  p = { ...p, calendar: p.calendar.map((d) => (fix[d.date] ? { ...d, periods: fix[d.date] } : d)) };
  const plan = readTimePlan(await readHwpx(readBuffer(f(ORIGINAL, '시간 운영계획'))), p.subjects);
  const ids = p.subjects.map((s) => s.id);
  const imp = importWeekGrid(generateSlots(p.calendar, p.baseTimetable, p.settings), plan.tables.flatMap((t) => t.rows), ids);
  const totals = JSON.parse(new TextDecoder().decode(readFileSync('fixtures/2026-g6/expected/totals.json'))).subjects;
  return {
    ...p, slotOverrides: imp.overrides,
    curriculumPlan: { ...p.curriculumPlan, school: Object.fromEntries(ids.map((id) => [id, { s1: totals[id].s1, s2: totals[id].s2 }])) },
  };
}

