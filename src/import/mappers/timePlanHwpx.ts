import type { Semester, Subject, SubjectId, WeekGridRow } from '../../model/types';
import { norm, num, own } from '../hwpx/cells';
import { tablesOf, type HwpxBlock } from '../hwpx/readHwpx';
import { cellText, type HwpxTable } from '../hwpx/table';
import { subjectByName } from '../lessons/neisLessons';

export interface GridSummary {
  schoolDays: number;
  dayPeriods: number[]; // 월~토
  hours: Record<SubjectId, number>;
  total: number;
}

export interface TimePlanTable {
  semester: Semester;
  rows: WeekGridRow[];
  /** 학기 계 */
  semesterTotal?: GridSummary;
  /** 2학기 표 아래 줄: 연간계·본교 편제 시수·증감 현황 */
  annual?: GridSummary;
  plan?: GridSummary;
  diff?: GridSummary;
}

export interface TimePlanResult {
  tables: TimePlanTable[];
  warnings: string[];
}

const CREATIVE: [string, SubjectId][] = [['자율', 'ca-self'], ['동아리', 'ca-club'], ['진로', 'ca-career']];

/** 머리 줄(월·화·수…·교과 이름이 있는 줄)에서 열 → 교과 id. 국어 다음 열은 학교자율시간. */
function columnSubjects(t: HwpxTable, subjects: Subject[], warnings: string[]): Map<number, SubjectId> {
  const head = Array.from({ length: Math.min(t.rows, 5) }, (_, r) => r).find((r) => norm(cellText(t, r, 10)) === '국어');
  const out = new Map<number, SubjectId>();
  if (head === undefined) { warnings.push('시간 운영계획 표에서 교과 머리 줄을 찾지 못했습니다.'); return out; }
  let prev: SubjectId | undefined;
  let totalAt = -1;
  for (let c = 10; c < t.cols; c++) {
    const label = norm(cellText(t, head, c));
    if (label === '총계') { totalAt = c; break; }
    if (label === '소계') continue; // 교과 소계·창체 소계 열은 건너뜀
    const id = CREATIVE.find(([k]) => label.includes(k))?.[1] ?? subjectByName(subjects, label)
      ?? (prev === 'kor' ? subjects.find((s) => s.kind === 'autonomy')?.id : undefined);
    if (id && !out.has(c) && ![...out.values()].includes(id)) { out.set(c, id); prev = id; }
  }
  // 총계 열은 오른쪽에서 두 번째(비고 앞)라고 보고 읽는다. 다르면 양식이 다른 것이므로 알린다.
  if (totalAt !== t.cols - 2) warnings.push(`시간 운영계획 표의 '총계' 열 위치가 예상과 다릅니다(${totalAt < 0 ? '없음' : `${totalAt + 1}열`}, 전체 ${t.cols}열). 양식이 다르면 값이 어긋날 수 있습니다.`);
  return out;
}

const numAt = (t: HwpxTable, r: number, c: number, own_: boolean) => {
  const v = num(own_ ? own(t, r, c) : cellText(t, r, c));
  return Number.isNaN(v) ? 0 : v;
};

/** 칸 값 읽기. 병합으로 가려진 칸은 0 */
function summary(t: HwpxTable, r: number, cols: Map<number, SubjectId>): GridSummary {
  const hours: Record<SubjectId, number> = {};
  for (const [c, id] of cols) hours[id] = numAt(t, r, c, true);
  // 총계 열 = '총계' 머리글 열(교과 끝 + 소계 + 창체 4 + 소계) — 표 오른쪽에서 두 번째 열
  return {
    schoolDays: numAt(t, r, 3, true),
    dayPeriods: Array.from({ length: 6 }, (_, k) => numAt(t, r, 4 + k, true)),
    hours,
    total: numAt(t, r, t.cols - 2, true),
  };
}

/** (사) 시간 운영계획 hwpx(학기마다 표 하나) → 주별 값·학기 계·연간 줄 */
export function readTimePlan(blocks: HwpxBlock[], subjects: Subject[]): TimePlanResult {
  const warnings: string[] = [];
  const tables: TimePlanTable[] = [];
  for (const t of tablesOf(blocks).filter((x) => norm(cellText(x, 0, 0)).startsWith('교과및창의적체험활동'))) {
    const semester = Number(cellText(t, 1, 0).match(/(\d)학기/)?.[1]) as Semester;
    if (semester !== 1 && semester !== 2) { warnings.push('시간 운영계획 표에서 학기를 읽지 못해 건너뜀'); continue; }
    const cols = columnSubjects(t, subjects, warnings);
    const out: TimePlanTable = { semester, rows: [] };
    for (let r = 4; r < t.rows; r++) {
      const label = norm(cellText(t, r, 0));
      if (label.endsWith('계') || label.startsWith('본교편제') || label.startsWith('증감현황')) {
        const s = summary(t, r, cols);
        if (label === `${semester}학기계` || label === '학기계') out.semesterTotal = s;
        else if (label === '연간계') out.annual = s;
        else if (label.startsWith('본교편제')) out.plan = s;
        else if (label.startsWith('증감')) out.diff = s;
        else if (!/^[12]학기계$/.test(label)) warnings.push(`시간 운영계획 ${semester}학기 표 ${r + 1}행 '${label}'은(는) 계 줄로 읽지 못해 건너뜀`);
        continue; // 다른 학기 계 줄은 쓰지 않음
      }
      const week = num(cellText(t, r, 1));
      if (Number.isNaN(week) || cellText(t, r, 2) === '') continue;
      const { schoolDays, dayPeriods, hours } = summary(t, r, cols);
      out.rows.push({
        semester, week, period: cellText(t, r, 2).trim(), month: parseInt(cellText(t, r, 0), 10) || 0,
        schoolDays, dayPeriods, hours, note: cellText(t, r, t.cols - 1).trim(),
      });
    }
    tables.push(out);
  }
  return { tables, warnings };
}
