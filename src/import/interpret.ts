import type { PlanRow, Project, ImportKind, Subject, SubjectId } from '../model/types';
import { rowTexts } from './hwpx/cells';
import { readHwpx, type HwpxBlock } from './hwpx/readHwpx';
import { readNeisLessons } from './lessons/neisLessons';
import { readCurriculum } from './mappers/curriculumHwpx';
import { readPlanAdjust } from './mappers/planAdjustHwpx';
import { readProgressHwpx } from './mappers/progressHwpx';
import { readScheduleP04 } from './mappers/scheduleP04';
import { readSpecialistCells } from './mappers/specialistP02';
import { readClassTimetable, readSpecialistHours, specialistStatus, type TimetableResult } from './mappers/timetableP02';
import { readWorkbook, type Sheet } from './xlsx/readWorkbook';

/** 노란 칸: 모르는 편제 이름('name') 또는 시간표 약자('code') */
export interface Unknown {
  type: 'name' | 'code';
  value: string;
}

/** 파일 하나를 읽은 해석 결과. apply = 확정할 때 프로젝트에 반영하는 순수 함수 */
export interface Interpretation {
  raw: string[]; // 원문 미리보기(앞쪽 몇 줄)
  summary: string[];
  warnings: string[];
  unknown: Unknown[];
  apply: (p: Project, importedAt: string) => Project;
}

/** 원문 미리보기: 시트 앞 12줄 / hwpx 앞 12블록 */
function previewOf(sheets: Sheet[], blocks: HwpxBlock[]): string[] {
  const fromSheets = sheets.flatMap((s) => [`[${s.name}]`, ...s.rows.slice(0, 12).map((r) => (r ?? []).join(' | '))]);
  const fromBlocks = blocks.slice(0, 12).map((b) => (b.kind === 'para' ? b.text : `[표 ${b.rows}×${b.cols}] ${rowTexts(b, 0).join(' | ')}`));
  return [...fromSheets, ...fromBlocks].map((l) => l.replace(/\s+/g, ' ').slice(0, 200));
}

const nameOf = (subjects: Subject[], id: SubjectId) => subjects.find((s) => s.id === id)?.name ?? id;
const countBy = (ids: SubjectId[]) => ids.reduce<Record<string, number>>((o, id) => ({ ...o, [id]: (o[id] ?? 0) + 1 }), {});

/** 같은 교과·학기의 옛 행은 새 행으로 바꾸고, 나머지는 둔다(학기 순 유지). */
export function mergeLessons(old: Project['lessonPlans'], rows: PlanRow[]): Project['lessonPlans'] {
  const out = { ...old };
  for (const id of new Set(rows.map((r) => r.subjectId))) {
    const mine = rows.filter((r) => r.subjectId === id);
    const sems = new Set(mine.map((r) => r.semester ?? 0));
    // 연간(학기 없음) 진도와 학기별 진도가 섞이면 행이 두 벌이 되므로, 종류가 바뀌면 그 교과는 통째로 바꾼다
    const annual = sems.has(0);
    const kept = (old[id] ?? []).filter((r) => !annual && r.semester !== undefined && !sems.has(r.semester));
    out[id] = [...kept, ...mine].sort((a, b) => (a.semester ?? 0) - (b.semester ?? 0));
  }
  return out;
}

/** 노란 칸을 고른 교과로 풀어 준다: 이름은 별칭에, 약자는 시간표 약자에 추가 */
export function mapUnknown(subjects: Subject[], u: Unknown, id: SubjectId): Subject[] {
  return subjects.map((s) => {
    if (s.id !== id) return s;
    if (u.type === 'name') return s.aliases.includes(u.value) ? s : { ...s, aliases: [...s.aliases, u.value] };
    return s.timetableCodes.includes(u.value) ? s : { ...s, timetableCodes: [...s.timetableCodes, u.value] };
  });
}

const record = (p: Project, kind: ImportKind, fileName: string, warnings: string[], importedAt: string): Project['imports'] => [
  ...p.imports.filter((r) => !(r.kind === kind && r.fileName === fileName)),
  { id: `${kind}:${fileName}`, fileName, kind, importedAt, confirmed: true, warnings },
];

/** 파일 → 해석 결과. 종류마다 매퍼를 부르고, 화면에 보여 줄 요약과 확정 함수를 만든다. */
export async function interpret(kind: ImportKind, fileName: string, data: ArrayBuffer, p: Project): Promise<Interpretation> {
  const isHwpx = fileName.normalize('NFC').toLowerCase().endsWith('.hwpx');
  const sheets: Sheet[] = isHwpx ? [] : await readWorkbook(data);
  const blocks: HwpxBlock[] = isHwpx ? await readHwpx(data) : [];
  const raw = previewOf(sheets, blocks);
  const done = (summary: string[], warnings: string[], unknown: Unknown[], change: (q: Project) => Project): Interpretation => ({
    raw, summary, warnings, unknown,
    apply: (q, at) => ({ ...change(q), imports: record(q, kind, fileName, warnings, at) }),
  });
  const none = done([], [], [], (q) => q);

  switch (kind) {
    case 'scheduleP04': {
      const r = readScheduleP04(sheets, p.year, p.grade);
      const sem = (n: 1 | 2) => r.calendar.filter((d) => d.semester === n && d.schoolDay);
      return done(
        [1, 2].map((n) => `${n}학기 수업일 ${sem(n as 1 | 2).length}일 · 교시 ${sem(n as 1 | 2).reduce((a, d) => a + d.periods, 0)}`).concat(`행사 ${r.events.length}개`),
        r.warnings, [],
        (q) => ({ ...q, calendar: r.calendar, events: [...q.events.filter((e) => e.source === 'user'), ...r.events] }),
      );
    }
    case 'timetableP02': {
      const sp = readSpecialistCells(sheets, p.grade, p.representativeClass, p.subjects);
      let tt: TimetableResult | undefined;
      const extra: string[] = [];
      try {
        tt = readClassTimetable(sheets, p.grade, p.representativeClass, p.subjects, sp.cells);
      } catch (e) {
        extra.push(`학급 시간표를 읽지 못했습니다(${e instanceof Error ? e.message : '알 수 없음'}). 기존 시간표를 그대로 둡니다.`);
      }
      const { hours, warnings: hw } = readSpecialistHours(sheets, p.grade, p.subjects);
      const partial = tt ? Object.entries(specialistStatus(tt.cells, hours)).filter(([, v]) => v === 'partial').map(([id]) => id) : [];
      const spCount = countBy(sp.cells.map((c) => c.subjectId));
      const summary = Object.entries(spCount).map(([id, n]) => `${nameOf(p.subjects, id)} 전담 ${n}칸${partial.includes(id) ? ' (일부 전담: 확인 필요)' : ''}`);
      if (tt) summary.push(`학급 시간표 ${tt.cells.length}칸`);
      return done(summary, [...sp.warnings, ...hw, ...extra, ...(tt?.warnings ?? [])], (tt?.unknownCodes ?? []).map((value) => ({ type: 'code', value })), (q) => ({
        ...q, specialistCells: sp.cells,
        ...(tt ? { baseTimetable: tt.cells, timetableSource: 'file' as const } : {}),
        settings: { ...q.settings, partialSpecialist: partial},
      }));
    }
    case 'curriculumHwpx': {
      const r = readCurriculum(blocks, p.subjects, p.year, p.grade);
      const total = Object.values(r.school).reduce((a, b) => a + b, 0);
      return done([`작년 ${r.priorYear.grade}학년 합 ${r.priorYear.total}`, `올해 ${p.grade}학년 본교 합 ${r.total.school}`, `교과 합 ${total}`], r.warnings, [], (q) => ({
        ...q, priorYear: r.priorYear,
        curriculumPlan: { ...q.curriculumPlan, standard: r.standard, creative: r.creative, schoolAnnual: r.school },
      }));
    }
    case 'planAdjustHwpx': {
      const r = readPlanAdjust(blocks, p.subjects);
      return done([`본교 운영 합 ${r.total.school}(기준 ${r.total.standard})`, `증감 기록 ${r.adjustments.length}행`], r.warnings, [], (q) => ({
        ...q, adjustments: r.adjustments,
        curriculumPlan: { ...q.curriculumPlan, standard: r.standard, creative: { standard: r.creative.standard, school: r.creative.school }, schoolAnnual: r.annual },
      }));
    }
    case 'progressHwpx': {
      const r = readProgressHwpx(blocks, p.subjects, fileName);
      const rows = r.tables.filter((t) => !t.composite).flatMap((t) => t.entries.map((e) => e.plan));
      const c = countBy(rows.map((x) => x.subjectId));
      return done(Object.entries(c).map(([id, n]) => `${nameOf(p.subjects, id)} ${n}행`), r.warnings, [], (q) => ({ ...q, lessonPlans: mergeLessons(q.lessonPlans, rows) }));
    }
    case 'neisLessons':
    case 'publisherLessons': {
      const r = readNeisLessons([{ fileName, sheets }], p.subjects, p.settings.includeOptionalLessons);
      const c = countBy(r.rows.filter((x) => x.kind !== 'memo').map((x) => x.subjectId));
      return done(
        Object.entries(c).map(([id, n]) => `${nameOf(p.subjects, id)} ${n}차시`), r.warnings,
        r.unknownNames.map((value) => ({ type: 'name', value })), (q) => ({ ...q, lessonPlans: mergeLessons(q.lessonPlans, r.rows) }),
      );
    }
    default:
      return none;
  }
}
