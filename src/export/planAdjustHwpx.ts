import type { Adjustment, Project, SubjectId } from '../model/types';
import { fillTemplate } from './hwpx/package';
import { tableXml, type CellSpec } from './hwpx/xml';

// 칸 모양: 진도표 양식(templates/progress.hwpx)의 머리·본문 칸 스타일을 쓴다
const HEAD = { borderFill: 6, paraPr: 2, charPr: 2, header: true, hasMargin: false, margin: [510, 510, 141, 141] as CellSpec['margin'] };
const BODY = { borderFill: 3, paraPr: 7, charPr: 3, hasMargin: true, margin: [283, 283, 283, 283] as CellSpec['margin'], wrap: 'SQUEEZE' as const };
const TEXT = { ...BODY, paraPr: 8, wrap: 'BREAK' as const };
const WIDTH = 51115;

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const comma = (n: number) => n.toLocaleString('en-US');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** 표1: 교과 구분 / 교육부 기준 시수 / 본교 운영 시수 / 증감 시수 (편제에서) */
export function table1(p: Project, id: number): string {
  const cp = p.curriculumPlan;
  const subj = p.subjects.filter((s) => s.kind !== 'creative');
  const crea = p.subjects.filter((s) => s.kind === 'creative');
  const std = (x: SubjectId) => cp.standard[x];
  const ann = (x: SubjectId) => cp.schoolAnnual[x] ?? 0;
  const creativeSchool = crea.some((s) => cp.schoolAnnual[s.id] !== undefined) ? sum(crea.map((s) => ann(s.id))) : cp.creative.school;
  const stdTotal = sum(subj.map((s) => std(s.id) ?? 0)) + cp.creative.standard;
  const schoolTotal = sum(subj.map((s) => ann(s.id))) + creativeSchool;
  const others = subj.filter((s) => s.kind === 'subject' && s.id !== 'kor');
  // 열 순서: 0 라벨 | 1·2 국어(국어, 학교자율시간) | 3.. 나머지 교과 | 창체 | 계. 교과 수가 달라도 열 수가 맞게 센다.
  const creativeCol = 3 + others.length;
  const totalCol = creativeCol + 1;
  const first = 4000;
  const w = Math.floor((WIDTH - first - 6000) / (others.length + 2));
  const colW = [first, 3000, 3000, ...Array(others.length + 2).fill(w)];
  colW[totalCol] = WIDTH - sum(colW.slice(0, totalCol));
  const width = (c: number, span = 1) => sum(colW.slice(c, c + span));
  const cell = (row: number, col: number, text: string, o: Partial<CellSpec> = {}, span = 1): CellSpec =>
    ({ row, col, colSpan: span, rowSpan: 1, width: width(col, span), height: 3400, text, ...BODY, ...o } as CellSpec);
  const head = (row: number, col: number, text: string, span = 1, rowSpan = 1): CellSpec => ({ ...cell(row, col, text, HEAD, span), rowSpan });
  const autonomy = subj.find((s) => s.kind === 'autonomy');
  const rows: CellSpec[][] = [
    [head(0, 0, '교과 구분', 1, 2), head(0, 1, '국어', 2), ...others.map((s, i) => head(0, 3 + i, s.name, 1, 2)), head(0, creativeCol, '창체', 1, 2), head(0, totalCol, '계', 1, 2)],
    [head(1, 1, '국어'), head(1, 2, autonomy?.name ?? '학교자율시간')],
  ];
  const line = (row: number, label: string, kind: 'std' | 'ann' | 'diff') => {
    const v = (x: SubjectId) => (kind === 'std' ? std(x) : kind === 'ann' ? ann(x) : ann(x) - (std(x) ?? 0));
    const t = (n: number | undefined) => (n === undefined ? '' : kind === 'diff' ? signed(n) : String(n));
    const cs: CellSpec[] = [cell(row, 0, label, HEAD)];
    if (kind === 'std') cs.push(cell(row, 1, t(std('kor')), {}, 2)); // 국어 기준은 두 칸에 걸쳐 한 번
    else {
      cs.push(cell(row, 1, t(v('kor'))));
      cs.push(cell(row, 2, autonomy ? t(kind === 'ann' ? ann(autonomy.id) : ann(autonomy.id)) : ''));
    }
    others.forEach((s, i) => cs.push(cell(row, 3 + i, t(v(s.id)))));
    const c = kind === 'std' ? cp.creative.standard : kind === 'ann' ? creativeSchool : creativeSchool - cp.creative.standard;
    const total = kind === 'std' ? stdTotal : kind === 'ann' ? schoolTotal : schoolTotal - stdTotal;
    cs.push(cell(row, creativeCol, t(c)), cell(row, totalCol, kind === 'diff' ? signed(total) : comma(total)));
    return cs;
  };
  rows.push(line(2, '교육부\n기준 시수', 'std'), line(3, '본교\n운영 시수', 'ann'), line(4, '증감 시수\n(교과+학교자율시간)', 'diff'));
  return tableXml({ id, rows, colCnt: totalCol + 1, width: WIDTH, height: 5 * 3400 });
}

/** 표2에 쓸 행: 기본은 기록 그대로(한 시간에 한 행), 설정 'merged'면 학기·교과·영역·단원·내용이 같은 것끼리 시수를 더한다 */
export function adjustRowsOf(p: Project): Adjustment[] {
  if (p.settings.adjustRows !== 'merged') return p.adjustments;
  const groups = new Map<string, Adjustment>();
  for (const a of p.adjustments) {
    const key = [a.semester, a.subjectId, a.area, a.unit, a.content, Math.sign(a.hours)].join('|');
    const g = groups.get(key);
    groups.set(key, g ? { ...g, hours: g.hours + a.hours, standards: [...new Set([...g.standards, ...a.standards])] } : a);
  }
  return [...groups.values()];
}

/** 표2: 증감 기록(한 시간에 한 행). 창체는 3칸 병합 칸 하나가 주요 내용. 쪽이 넘어가면 머리 줄이 반복된다. */
export function table2(p: Project, id: number): string {
  const colW = [1600, 2200, 5200, 9500, 9500, 20115, 3000];
  const w = (c: number, n = 1) => sum(colW.slice(c, c + n));
  const heads = ['학기', '교과', '영역', '관련 성취기준', '관련 단원', '주요 내용', '시수'];
  const rows: CellSpec[][] = [heads.map((t, c) => ({ row: 0, col: c, width: w(c), height: 2275, text: t, ...HEAD }))];
  const list = adjustRowsOf(p);
  list.forEach((a, i) => {
    const row = i + 1;
    const s = p.subjects.find((x) => x.id === a.subjectId);
    const creative = s?.kind === 'creative';
    const c = (col: number, text: string, o: Partial<CellSpec> = {}, span = 1): CellSpec =>
      ({ row, col, colSpan: span, width: w(col, span), height: 1766, text, ...TEXT, ...o } as CellSpec);
    rows.push([
      c(0, String(a.semester), BODY), c(1, creative ? '창체' : s?.name ?? a.subjectId, BODY), c(2, a.area),
      ...(creative ? [c(3, a.content, {}, 3)] : [c(3, a.standards.map((x) => `[${x}]`).join('\n')), c(4, a.unit), c(5, a.content)]),
      c(6, signed(a.hours), BODY),
    ]);
  });
  return tableXml({ id, rows, colCnt: 7, width: WIDTH, height: 2275 + list.length * 1766, repeatHeader: true });
}

/** 시수증감 운영계획 hwpx: 표1(편제) + 표2(증감 기록). template = templates/progress.hwpx */
export async function planAdjustHwpx(p: Project, template: ArrayBuffer): Promise<ArrayBuffer> {
  return fillTemplate(template, [table1(p, 1_825_309_700), table2(p, 1_825_309_701)]);
}

export const planAdjustFileName = (p: Project) => `${p.year}학년도 학년별 시수 증가 및 특성화 계획(${p.grade}학년).hwpx`;
