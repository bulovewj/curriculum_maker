import { schoolDaysByMonth } from '../engine/calendar';
import { computeGrid } from '../engine/grid';
import { effectiveSchool } from '../engine/plan';
import { semesterTotals } from '../engine/weekGrid';
import type { Project, Semester, SubjectId, WeekGridRow } from '../model/types';
import { fillTemplate } from './hwpx/package';
import styles from './hwpx/timePlanStyles.json';
import { tableXml, type CellSpec } from './hwpx/xml';

/** 한글이 저장한 (c)에서 뽑은 칸 모양(스타일 번호·너비·병합) */
type Style = Omit<CellSpec, 'row' | 'rowSpan'> & { rowSpan: number };
interface TableStyle { width: number; head: Style[][]; first: Style[]; mid: Style[]; footers: Style[][] }
const STYLES = styles as unknown as TableStyle[];

const HEAD_ROWS = 4;
const SUBJECT_COL = 10; // 교과 열 시작(11개: 국어·학교자율시간·…·영어)
const SUBTOTAL_COL = 22;
const CREATIVE_COL = 23; // 자율·자치, 동아리, 진로
const CREATIVE_SUB = 26;
const TOTAL_COL = 27;
const NOTE_COL = 28;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mk = (s: Style, row: number, text: string, rowSpan = s.rowSpan): CellSpec => ({ ...s, row, rowSpan, text });

/** 학기 하나의 시간 운영계획 표(한 쪽). 머리·칸 모양은 (c) 그대로, 값만 바꾼다. */
export function timePlanTable(p: Project, semester: Semester, id: number): string {
  const grid = computeGrid(p);
  const school = effectiveSchool(p, grid.slots);
  const sty = STYLES[semester === 1 ? 0 : 1];
  const weeks = grid.rows.filter((r) => r.semester === semester);
  const ids = p.subjects.filter((s) => s.kind !== 'creative').map((s) => s.id);
  const crea = p.subjects.filter((s) => s.kind === 'creative').map((s) => s.id);
  const days = schoolDaysByMonth(p.calendar, semester);
  const autonomy = p.subjects.find((s) => s.kind === 'autonomy');
  const rows: CellSpec[][] = [];

  // 머리 4줄: 이름표는 (c)의 것, 학기·학급·학교자율시간 이름만 우리 값
  sty.head.forEach((r, i) => rows.push(r.map((c) => {
    let text = c.text;
    if (i === 1) text = c.col === 0 ? `${p.year}학년도 ${semester}학기` : `${p.grade}학년 ${p.representativeClass}반`;
    if (autonomy && text === '신명똑디') text = autonomy.name;
    return mk(c, i, text);
  })));

  /** 0 시간 표시: 그 학기 편제가 0이면 ⋅, 아니면 0 */
  const hourText = (sid: SubjectId, h: number) => (h === 0 && ((semester === 1 ? school[sid]?.s1 : school[sid]?.s2) ?? 0) === 0 ? '⋅' : String(h));
  const valueOf = (col: number, w: WeekGridRow): string => {
    if (col === 1) return String(w.week);
    if (col === 2) return w.period;
    if (col === 3) return String(w.schoolDays);
    if (col >= 4 && col <= 9) return String(w.dayPeriods[col - 4]);
    if (col >= SUBJECT_COL && col < SUBJECT_COL + ids.length) return hourText(ids[col - SUBJECT_COL], w.hours[ids[col - SUBJECT_COL]] ?? 0);
    if (col === SUBTOTAL_COL) return String(sum(ids.map((x) => w.hours[x] ?? 0)));
    if (col >= CREATIVE_COL && col < CREATIVE_COL + crea.length) return String(w.hours[crea[col - CREATIVE_COL]] ?? 0);
    if (col === CREATIVE_SUB) return String(sum(crea.map((x) => w.hours[x] ?? 0)));
    if (col === TOTAL_COL) return String(sum([...ids, ...crea].map((x) => w.hours[x] ?? 0)));
    if (col === NOTE_COL) return w.note;
    return '';
  };

  // 월 묶음: 그 달의 첫 주 줄에만 '3[21]'을 쓰고 아래로 병합
  weeks.forEach((w, i) => {
    const row = HEAD_ROWS + i;
    const first = i === 0 || weeks[i - 1].month !== w.month;
    const group = first ? weeks.slice(i).findIndex((x) => x.month !== w.month) : 0;
    const span = first ? (group < 0 ? weeks.length - i : group) : 1;
    const cells = (first ? sty.first : sty.mid).map((c) => (c.col === 0 ? mk(c, row, `${w.month}[${days[w.month] ?? 0}]`, span) : mk(c, row, valueOf(c.col, w))));
    rows.push(cells);
  });

  // 꼬리 줄: 학기 계(2학기 표는 아래에 1학기 계·연간 계·본교 편제 시수·증감 현황)
  const tot = (sem: Semester) => semesterTotals(grid.rows, sem);
  const semRows = (sem: Semester) => grid.rows.filter((r) => r.semester === sem);
  const footValue = (kind: string, col: number): string => {
    const rs = kind === '연간 계' ? grid.rows : kind === '1학기 계' ? semRows(1) : kind === '2학기 계' ? semRows(2) : [];
    const t: Record<SubjectId, number> = kind === '연간 계' ? Object.fromEntries([...ids, ...crea].map((x) => [x, (tot(1)[x] ?? 0) + (tot(2)[x] ?? 0)])) : kind === '1학기 계' ? tot(1) : kind === '2학기 계' ? tot(2) : {};
    const plan = (x: SubjectId) => p.curriculumPlan.schoolAnnual[x] ?? 0;
    const planTotal = sum([...ids, ...crea].map(plan));
    const diff = (x: SubjectId) => (t0(x)) - plan(x);
    const t0 = (x: SubjectId) => (tot(1)[x] ?? 0) + (tot(2)[x] ?? 0);
    if (kind === '본교 편제 시수' || kind === '증감 현황') {
      const v = (x: SubjectId) => (kind === '본교 편제 시수' ? plan(x) : diff(x));
      if (col >= SUBJECT_COL && col < SUBJECT_COL + ids.length) return String(v(ids[col - SUBJECT_COL]));
      if (col === SUBTOTAL_COL) return String(sum(ids.map(v)));
      if (col === CREATIVE_COL) return String(sum(crea.map(v)));
      if (col === TOTAL_COL) return String(kind === '본교 편제 시수' ? planTotal : sum([...ids, ...crea].map(diff)));
      return '';
    }
    if (col === 3) return String(rs.reduce((a, r) => a + r.schoolDays, 0));
    if (col >= 4 && col <= 9) return String(sum(rs.map((r) => r.dayPeriods[col - 4])));
    if (col >= SUBJECT_COL && col < SUBJECT_COL + ids.length) return String(t[ids[col - SUBJECT_COL]] ?? 0);
    if (col === SUBTOTAL_COL) return String(sum(ids.map((x) => t[x] ?? 0)));
    if (col >= CREATIVE_COL && col < CREATIVE_COL + crea.length) return String(t[crea[col - CREATIVE_COL]] ?? 0);
    if (col === CREATIVE_SUB) return String(sum(crea.map((x) => t[x] ?? 0)));
    if (col === TOTAL_COL) return String(sum([...ids, ...crea].map((x) => t[x] ?? 0)));
    return '';
  };
  sty.footers.forEach((r, i) => {
    const row = HEAD_ROWS + weeks.length + i;
    const kind = r[0].text;
    rows.push(r.map((c) => mk(c, row, c.col === 0 ? kind : footValue(kind, c.col))));
  });

  const height = rows.reduce((a, r) => a + Math.max(...r.map((c) => ((c.rowSpan ?? 1) > 1 ? 0 : c.height))), 0);
  return tableXml({ id, rows, colCnt: 29, width: sty.width, height });
}

/** 학기 하나의 시간 운영계획 hwpx. template = templates/timeplan.hwpx */
export async function timePlanHwpx(p: Project, semester: Semester, template: ArrayBuffer): Promise<ArrayBuffer> {
  return fillTemplate(template, [timePlanTable(p, semester, 1_825_309_614)]);
}

export const timePlanFileName = (p: Project, semester: Semester) => `${p.year}학년도 ${p.grade}학년 ${semester}학기 교육과정 시간 운영계획.hwpx`;
