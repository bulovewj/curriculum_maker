import type { PlanRow, Semester, Subject, SubjectId } from '../../model/types';
import { norm } from '../hwpx/cells';
import { tablesOf, type HwpxBlock } from '../hwpx/readHwpx';
import { cellText, type HwpxTable } from '../hwpx/table';

export interface ProgressEntry {
  plan: PlanRow;
  week: number;
  period: string; // '3.2~3.7'
}

export interface ProgressFooter {
  total: number; // 이 학기 총 시수
  annual?: number; // 연간 총 시수
  parts?: Record<string, number>; // 창체 종합: { 자: 36, 동: 9, 진: 5 }
}

export interface ProgressTable {
  subjectId?: SubjectId; // 창체 종합 표는 없음(composite)
  composite: boolean;
  semester: Semester;
  entries: ProgressEntry[];
  footer?: ProgressFooter;
}

export interface ProgressResult {
  tables: ProgressTable[];
  warnings: string[];
}

/** 비고 조각 (작업지시서 2.3): 재구성 → 행사 → 어울림 → 메모 → 【태그】 */
export interface Remark {
  mark?: PlanRow['mark'];
  eventName?: string;
  program?: string;
  note?: string;
  tags: string[];
}

export function splitRemark(raw: string): Remark {
  const tags = [...raw.matchAll(/【([^】]*)】/g)].flatMap((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean));
  let s = raw.replace(/【[^】]*】/g, '').trim();
  const out: Remark = { tags };
  const mark = s.match(/^◆재구성\((감축|증배)\)\s*(?:,\s*)?/);
  if (mark) {
    s = s.slice(mark[0].length).trim();
    out.mark = { type: mark[1] === '감축' ? 'reduce' : 'increase', ...(s ? { reason: s } : {}) };
    return out; // ◆ 뒤의 글은 사유
  }
  const ev = s.match(/^◈(.+)$/);
  if (ev) return { ...out, eventName: ev[1].trim() };
  const prog = s.match(/^어울림프로그램\([^)]*\)/);
  if (prog) {
    out.program = prog[0];
    s = s.slice(prog[0].length).trim();
  }
  if (s) out.note = s;
  return out;
}

const CREATIVE = ['ca-self', 'ca-club', 'ca-career'];
const TITLE_TO_ID = (subjects: Subject[], title: string): SubjectId | undefined =>
  subjects.find((s) => norm(title).startsWith(norm(s.progressTitle)))?.id;

function footerOf(text: string): ProgressFooter | undefined {
  const total = text.match(/총 시수:\s*(\d+)시간/);
  if (!total) return undefined;
  const annual = text.match(/연간 총 시수:\s*(\d+)시간/);
  const part = text.match(/\[([^\]]*)\]/);
  const parts = part ? Object.fromEntries([...part[1].matchAll(/(\S+?):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])])) : undefined;
  return { total: Number(total[1]), ...(annual ? { annual: Number(annual[1]) } : {}), ...(parts ? { parts } : {}) };
}

function readTable(t: HwpxTable, subjects: Subject[], fileName: string, tableNo: number, warnings: string[]): ProgressTable | undefined {
  const title = cellText(t, 0, 0);
  const semester = Number(cellText(t, 1, 0).match(/(\d)학기/)?.[1]) as Semester;
  const composite = norm(title).startsWith('창의적체험활동');
  const subjectId = composite ? undefined : TITLE_TO_ID(subjects, title);
  if (!composite && !subjectId) { warnings.push(`진도표 ${tableNo}번째 표 제목 '${title}'의 교과를 알 수 없어 건너뜀`); return undefined; }
  if (semester !== 1 && semester !== 2) { warnings.push(`진도표 ${tableNo}번째 표에서 학기를 읽지 못해 건너뜀`); return undefined; }
  const entries: ProgressEntry[] = [];
  let footer: ProgressFooter | undefined;
  for (let r = 3; r < t.rows; r++) {
    const first = cellText(t, r, 0);
    if (first.startsWith('▶')) { footer = footerOf(first); break; }
    const topic = cellText(t, r, 3).trim();
    if (!topic) continue;
    const area = cellText(t, r, 6).trim();
    const id = composite ? subjects.find((s) => CREATIVE.includes(s.id) && norm(area).startsWith(norm(s.name)))?.id : subjectId;
    if (!id) { warnings.push(`진도표 ${tableNo}번째 표 ${r + 1}행 영역 '${area}'을(를) 알 수 없어 건너뜀`); continue; }
    const unit = cellText(t, r, 2).trim();
    const raw = cellText(t, r, 7).trim();
    const rem = splitRemark(raw);
    const nn = cellText(t, r, 5).match(/^(\d+)\s*\/\s*(\d+)/);
    const isEvent = unit.startsWith('◈') || rem.eventName !== undefined;
    entries.push({
      week: Number(first) || 0,
      period: cellText(t, r, 1).trim(),
      plan: {
        id: `${fileName}#${tableNo}#${r + 1}`, subjectId: id, semester,
        kind: isEvent ? 'event' : 'lesson', unit, topic,
        ...(nn ? { n: Number(nn[1]), total: Number(nn[2]) } : {}),
        ...(composite ? { area } : cellText(t, r, 6).trim() ? { pages: cellText(t, r, 6).trim() } : {}),
        standards: [], tags: rem.tags,
        ...(rem.mark ? { mark: rem.mark } : {}),
        ...(isEvent ? { eventName: rem.eventName ?? unit.replace(/^◈/, '') } : {}),
        ...(rem.program ? { program: rem.program } : {}),
        ...(rem.note ? { note: rem.note } : {}),
        ...(raw ? { rawNote: raw } : {}),
        source: { file: fileName, row: r + 1 },
      },
    });
  }
  return { subjectId, composite, semester, entries, footer };
}

/** (마) 학교 진도표 hwpx(표 15개) → 표마다 PlanRow + 주·기간. 맨 아래 줄 숫자도 읽는다. */
export function readProgressHwpx(blocks: HwpxBlock[], subjects: Subject[], fileName: string): ProgressResult {
  const warnings: string[] = [];
  const tables = tablesOf(blocks)
    .map((t, i) => readTable(t, subjects, fileName, i + 1, warnings))
    .filter((x): x is ProgressTable => x !== undefined);
  return { tables, warnings };
}
