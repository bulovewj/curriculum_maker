import type { SchoolWeekday, SpecialistCell, Subject, SubjectId, TimetableCell } from '../../model/types';
import { subjectByName } from '../lessons/neisLessons';
import type { Sheet } from '../xlsx/readWorkbook';

export interface TimetableResult {
  cells: TimetableCell[];
  warnings: string[];
}

const DAYS = ['월', '화', '수', '목', '금'];

/** 약자(예: '영', '영(교실)') → 교과 id. 모르면 undefined */
function byCode(subjects: Subject[], code: string): SubjectId | undefined {
  const c = code.replace(/\(.*\)/, '').trim();
  return subjects.find((s) => s.timetableCodes.includes(c))?.id;
}

/**
 * (나) '5~6학년 반별 시간표' 시트 → 학급 시간표.
 * 1행 학년(병합), 2행 '요일·교시·1반…', 3행부터 A열 요일(병합)·B열 교시. 아래쪽 요약 표(교시 칸이 글자)는 무시.
 * specialist에 같은 요일·교시·교과 칸이 있으면 전담 표시.
 */
export function readClassTimetable(
  sheets: Sheet[], grade: number, classNo: number, subjects: Subject[], specialist: SpecialistCell[] = [],
): TimetableResult {
  const sheet = sheets.find((s) => s.rows[0]?.includes(`${grade}학년`) && s.name.includes('반별'));
  if (!sheet) throw new Error(`반별 시간표 시트에서 ${grade}학년을 찾지 못했습니다.`);
  const [top, , ...body] = sheet.rows;
  const col0 = top.indexOf(`${grade}학년`);
  let end = col0;
  while (end + 1 < top.length && (!top[end + 1] || top[end + 1] === `${grade}학년`)) end++;
  const col = sheet.rows[1].findIndex((t, i) => i >= col0 && i <= end && t === `${classNo}반`);
  if (col < 0) throw new Error(`${grade}학년 ${classNo}반 열을 찾지 못했습니다.`);

  const cells: TimetableCell[] = [];
  const warnings: string[] = [];
  const unknown = new Set<string>();
  let day = 0;
  for (const r of body) {
    const period = Number(r[1] ?? '');
    if (!Number.isInteger(period) || period < 1) break; // 교시 칸이 글자인 줄부터는 요약 표
    if (DAYS.includes(r[0] ?? '')) day = DAYS.indexOf(r[0]) + 1;
    const code = r[col] ?? '';
    if (!code || !day) continue;
    const subjectId = byCode(subjects, code);
    if (!subjectId) {
      if (!unknown.has(code)) warnings.push(`모르는 시간표 약자 '${code}' — 건너뜀`);
      unknown.add(code);
      continue;
    }
    const weekday = day as SchoolWeekday;
    cells.push({
      weekday, period, subjectId,
      specialist: specialist.some((x) => x.weekday === weekday && x.period === period && x.subjectId === subjectId),
    });
  }
  return { cells, warnings };
}

/** '참고학년별 수업 시수 및 전담시간' 시트 `주간전담시수` 행 → 교과별 주당 전담 시수(예 영어3 체육2 과학2) */
export function readSpecialistHours(sheets: Sheet[], grade: number, subjects: Subject[]): { hours: Record<SubjectId, number>; warnings: string[] } {
  const sheet = sheets.find((s) => s.name.includes('참고'));
  const hours: Record<SubjectId, number> = {};
  const warnings: string[] = [];
  const row = sheet?.rows.find((r) => r.some((c) => c.replace(/\s/g, '') === '주간전담시수'));
  const header = sheet?.rows.find((r) => r.some((c) => c.replace(/\s/g, '') === '학년') && r.includes(String(grade)));
  if (!sheet || !row || !header) return { hours, warnings: ['주간전담시수 행을 찾지 못했습니다.'] };
  for (const line of (row[header.indexOf(String(grade))] ?? '').split('\n')) {
    const m = line.trim().match(/^(\D+?)\s*(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const id = subjectByName(subjects, m[1]);
    if (id) hours[id] = Number(m[2]);
    else warnings.push(`전담 시수의 '${m[1]}'은 편제에 없어 건너뜀`);
  }
  return { hours, warnings };
}

/** 교과마다 담임 시간표 칸 수 대비 전담 시수: 같거나 많으면 'all'(전부 전담), 적으면 'partial'(확인 필요) */
export function specialistStatus(cells: TimetableCell[], hours: Record<SubjectId, number>): Record<SubjectId, 'all' | 'partial'> {
  const out: Record<SubjectId, 'all' | 'partial'> = {};
  for (const [id, h] of Object.entries(hours)) {
    const total = cells.filter((c) => c.subjectId === id).length;
    out[id] = h >= total ? 'all' : 'partial';
  }
  return out;
}
