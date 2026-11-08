import { computeGrid } from '../engine/grid';
import { lessonOrder } from '../engine/placeLessons';
import type { PlanRow, Project, Semester, Slot, Subject } from '../model/types';
import { fillTemplate } from './hwpx/package';
import { tableXml, type CellSpec } from './hwpx/xml';
import { assembleRemark } from './remark';

/** 진도표 한 줄(칸 글자) */
export interface ProgressLine {
  week: string;
  period: string;
  unit: string;
  topic: string;
  nn: string; // '1/6'
  extra: string; // 쪽수(창체 종합은 영역)
  note: string;
}

// 열 너비(2026 진도표 (d) 모양): 주, 기간, 단원명, 학습 주제(2칸), 차시, 쪽수, 비고
const W = { week: 1880, period: 5259, unit: 11838, topic: 18121, nn: 3150, extra: 3999, note: 6868, all: 51115 };
const H = { title: 2166, sem: 1183, head: 2275, row: 1766, foot: 1366 };
const MARGIN: CellSpec['margin'] = [283, 283, 283, 283];

const cell = (c: Omit<CellSpec, 'borderFill' | 'paraPr' | 'charPr' | 'margin'> & Partial<CellSpec>, base: Partial<CellSpec>): CellSpec =>
  ({ borderFill: 3, paraPr: 7, charPr: 3, margin: MARGIN, hasMargin: true, ...base, ...c } as CellSpec);

/** 진도표 표 한 개: 제목 / 학기·학급 / 머리 / 행들 / 맨 아래 줄 */
export function progressTable(id: number, o: { title: string; semester: string; klass: string; extraLabel: string; lines: ProgressLine[]; footer: string }): string {
  const rows: CellSpec[][] = [];
  rows.push([cell({ row: 0, col: 0, colSpan: 8, width: W.all, height: H.title, text: o.title, header: true }, { borderFill: 4, paraPr: 3, charPr: 6, wrap: 'SQUEEZE', margin: [0, 0, 0, 0] })]);
  rows.push([
    cell({ row: 1, col: 0, colSpan: 4, width: 25557, height: H.sem, text: o.semester, header: true }, { borderFill: 5, paraPr: 5, charPr: 7, wrap: 'SQUEEZE', margin: [0, 0, 0, 0] }),
    cell({ row: 1, col: 4, colSpan: 4, width: 25558, height: H.sem, text: o.klass, header: true }, { borderFill: 5, paraPr: 4, charPr: 7, wrap: 'SQUEEZE', margin: [0, 0, 0, 0] }),
  ]);
  const head = { borderFill: 6, paraPr: 2, charPr: 2, header: true, hasMargin: false, margin: [510, 510, 141, 141] as CellSpec['margin'] };
  const heads: [number, number, number, string][] = [[0, 1, W.week, '주'], [1, 1, W.period, '기간'], [2, 1, W.unit, '단원명'], [3, 2, W.topic, '학습 주제'], [5, 1, W.nn, '차시'], [6, 1, W.extra, o.extraLabel], [7, 1, W.note, '비고']];
  rows.push(heads.map(([col, colSpan, width, text]) => cell({ row: 2, col, colSpan, width, height: H.head, text }, head)));

  const same = (i: number, j: number, key: (l: ProgressLine) => string) => key(o.lines[i]) === key(o.lines[j]);
  const span = (i: number, key: (l: ProgressLine) => string) => { let n = 1; while (i + n < o.lines.length && same(i, i + n, key)) n++; return n; };
  const weekKey = (l: ProgressLine) => `${l.week}|${l.period}`;
  const unitKey = (l: ProgressLine) => l.unit;
  o.lines.forEach((l, i) => {
    const row = 3 + i;
    const r: CellSpec[] = [];
    if (i === 0 || !same(i - 1, i, weekKey)) {
      const rowSpan = span(i, weekKey);
      r.push(cell({ row, col: 0, rowSpan, width: W.week, height: H.row, text: l.week }, { wrap: 'SQUEEZE' }));
      r.push(cell({ row, col: 1, rowSpan, width: W.period, height: H.row, text: l.period }, { charPr: 8, wrap: 'SQUEEZE' }));
    }
    if (i === 0 || !same(i - 1, i, unitKey)) r.push(cell({ row, col: 2, rowSpan: span(i, unitKey), width: W.unit, height: H.row, text: l.unit }, {}));
    r.push(cell({ row, col: 3, colSpan: 2, width: W.topic, height: H.row, text: l.topic }, { paraPr: 8 }));
    r.push(cell({ row, col: 5, width: W.nn, height: H.row, text: l.nn }, { charPr: 8, wrap: 'SQUEEZE' }));
    r.push(cell({ row, col: 6, width: W.extra, height: H.row, text: l.extra }, { charPr: 8 }));
    r.push(cell({ row, col: 7, width: W.note, height: H.row, text: l.note }, {}));
    rows.push(r);
  });
  rows.push([cell({ row: 3 + o.lines.length, col: 0, colSpan: 8, width: W.all, height: H.foot, text: o.footer }, { paraPr: 3, charPr: 5, margin: [0, 0, 283, 283] })]);
  const height = H.title + H.sem + H.head + o.lines.length * H.row + H.foot;
  return tableXml({ id, rows, colCnt: 8, width: W.all, height, repeatHeader: true });
}

const periodOf = (rows: { semester: number; week: number; period: string }[], s?: Slot) => (s ? rows.find((r) => r.semester === s.semester && r.week === s.week)?.period ?? '' : '');

/** 진도 행 → 칸 글자 */
function lineOf(r: PlanRow, slot: Slot | undefined, period: string, extra: string): ProgressLine {
  return { week: slot ? String(slot.week) : '', period, unit: r.unit, topic: r.topic, nn: r.n ? `${r.n}/${r.total ?? ''}` : '', extra, note: assembleRemark(r) };
}

/** 학기 하나의 진도표 표들(작업지시서 2.1 순서: 교과 → 학교자율시간 → 창체 영역 → 창체 종합) */
export function progressTables(p: Project, semester: Semester): string[] {
  const grid = computeGrid(p);
  const bySubject = (s: Subject, sem: Semester) => lessonOrder(grid.slots, p.lessonPlans[s.id] ?? [], s.id, sem);
  const counts = (s: Subject, sem: Semester) => bySubject(s, sem).filter((x) => x.row.kind !== 'memo').length;
  const order = [...p.subjects.filter((s) => s.kind === 'subject'), ...p.subjects.filter((s) => s.kind === 'autonomy'), ...p.subjects.filter((s) => s.kind === 'creative')];
  const base = { semester: `${p.year}학년도 ${semester}학기`, klass: `${p.grade}학년 ${p.representativeClass}반` };
  const hours = (sem: Semester, n: number) => `▶ ${sem}학기 총 시수: ${n}시간`;
  const tag = (n: number, total: number) => (semester === 1 ? hours(1, n) : `${hours(2, n)} ◆ 연간 총 시수: ${total}시간`);
  const out: string[] = [];
  let id = 1_825_309_614;
  for (const s of order) {
    const lines = bySubject(s, semester).map((x) => lineOf(x.row, x.slot, periodOf(grid.rows, x.slot), x.row.pages ?? ''));
    const n = counts(s, semester);
    out.push(progressTable(id++, { ...base, title: `${s.progressTitle} 교육과정 연간지도계획`, extraLabel: '쪽수', lines, footer: tag(n, counts(s, 1) + counts(s, 2)) }));
  }
  const crea = p.subjects.filter((s) => s.kind === 'creative');
  const merged = crea.flatMap((s) => bySubject(s, semester).map((x) => ({ s, ...x })))
    .sort((a, b) => (a.slot && b.slot ? (a.slot.week - b.slot.week) || (a.slot.date < b.slot.date ? -1 : a.slot.date > b.slot.date ? 1 : a.slot.period - b.slot.period) : a.slot ? -1 : b.slot ? 1 : 0));
  const area = (s: Subject) => s.name.replace('·', '⋅');
  const part = (sem: Semester) => crea.map((s) => `${area(s)[0]}:${counts(s, sem)}`).join(', ');
  const sum = (sem: Semester) => crea.reduce((a, s) => a + counts(s, sem), 0);
  const compositeFooter = `${hours(semester, sum(semester))} [ ${part(semester)} ]${semester === 2 ? ` ◆ 연간 총 시수: ${sum(1) + sum(2)}시간` : ''}`;
  out.push(progressTable(id++, {
    ...base, title: '창의적 체험활동 교육과정 연간지도계획', extraLabel: '영역', footer: compositeFooter,
    lines: merged.map((x) => lineOf(x.row, x.slot, periodOf(grid.rows, x.slot), area(x.s))),
  }));
  return out;
}

/** 학기 하나의 진도표 hwpx. template = templates/progress.hwpx */
export async function progressHwpx(p: Project, semester: Semester, template: ArrayBuffer): Promise<ArrayBuffer> {
  return fillTemplate(template, progressTables(p, semester));
}

export const progressFileName = (p: Project, semester: Semester) => `${p.year}학년도 ${p.grade}학년 ${semester}학기 교과진도 운영 계획.hwpx`;
