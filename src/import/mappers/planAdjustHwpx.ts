import type { Adjustment, Semester, Subject, SubjectId } from '../../model/types';
import { norm, num, own, rowTexts } from '../hwpx/cells';
import { tablesOf, type HwpxBlock } from '../hwpx/readHwpx';
import { cellText, isMerged, type HwpxTable } from '../hwpx/table';
import { subjectByName } from '../lessons/neisLessons';

export interface PlanAdjustResult {
  standard: Record<SubjectId, number>; // 교육부 기준 시수
  annual: Record<SubjectId, number>; // 본교 운영 시수(연간)
  diff: Record<SubjectId, number>; // 증감 시수(표1 값 그대로)
  creative: { standard: number; school: number; diff: number };
  total: { standard: number; school: number; diff: number };
  adjustments: Adjustment[];
  warnings: string[];
}

const CREATIVE_BY_AREA: [string, SubjectId][] = [['자율', 'ca-self'], ['동아리', 'ca-club'], ['진로', 'ca-career']];
const creativeId = (area: string) => CREATIVE_BY_AREA.find(([k]) => area.includes(k))?.[1];

/** 표1 열 → 교과 id | 'creative' | 'total'. 머리 2줄: 윗줄 교과, 아랫줄 국어 아래만 '국어'/'신명 똑디'. */
function columnKinds(t: HwpxTable, subjects: Subject[], warnings: string[]): Map<number, SubjectId | 'creative' | 'total'> {
  const out = new Map<number, SubjectId | 'creative' | 'total'>();
  for (let c = 1; c < t.cols; c++) {
    const top = norm(cellText(t, 0, c));
    const sub = norm(cellText(t, 1, c));
    if (top === '계') out.set(c, 'total');
    else if (top === '창체') out.set(c, 'creative');
    else if (subjectByName(subjects, sub)) out.set(c, subjectByName(subjects, sub)!);
    else if (sub && sub !== top) out.set(c, subjects.find((s) => s.kind === 'autonomy')!.id); // 국어 아래 다른 이름 = 학교자율시간
    else if (subjectByName(subjects, top)) out.set(c, subjectByName(subjects, top)!);
    else warnings.push(`표1 ${c + 1}열 '${top}'을(를) 알 수 없어 건너뜀`);
  }
  return out;
}

const SEM_OF = (s: string): Semester | undefined => (s.trim() === '1' ? 1 : s.trim() === '2' ? 2 : undefined);

/** 표2 한 줄 → 증감 기록. 창체는 3칸 병합 칸 하나가 주요내용. */
function toAdjustment(t: HwpxTable, r: number, subjects: Subject[], n: number): Adjustment | string {
  const semester = SEM_OF(cellText(t, r, 0));
  const subjectName = cellText(t, r, 1);
  const area = cellText(t, r, 2).replace(/\s+/g, ' ').trim();
  const hours = num(cellText(t, r, 6));
  const subjectId = subjectByName(subjects, subjectName) ?? (norm(subjectName) === '창체' ? creativeId(area) : undefined);
  if (!semester || !subjectId || Number.isNaN(hours)) return `표2 ${n}번째 줄을 읽지 못함('${subjectName}')`;
  const wide = !isMerged(t.grid[r][3]) && 'colSpan' in (t.grid[r][3] ?? {}) && (t.grid[r][3] as { colSpan: number }).colSpan === 3;
  const standards = wide ? [] : [...cellText(t, r, 3).matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  return {
    id: `adjust-${n}`, semester, subjectId, area, standards,
    unit: wide ? '' : cellText(t, r, 4).trim(),
    content: (wide ? cellText(t, r, 3) : cellText(t, r, 5)).trim(),
    hours, planRowIds: [],
  };
}

/** (다) 시수증감 운영계획 hwpx → 표1(편제 숫자)·표2(증감 기록). 쪽 나눔으로 나뉜 표2는 머리 줄이 같으면 이어 붙인다. */
export function readPlanAdjust(blocks: HwpxBlock[], subjects: Subject[]): PlanAdjustResult {
  const tables = tablesOf(blocks);
  const warnings: string[] = [];
  const t1 = tables.find((t) => rowTexts(t, 2).some((x) => norm(x) === '교육부기준시수'));
  if (!t1) throw new Error('표1(교육부 기준 시수)을 찾지 못했습니다.');
  const kinds = columnKinds(t1, subjects, warnings);
  const rowIndex = (key: string) => Array.from({ length: t1.rows }, (_, r) => r).find((r) => norm(cellText(t1, r, 0)).startsWith(key));
  const read = (key: string) => {
    const r = rowIndex(key);
    const per: Record<SubjectId, number> = {};
    let creative = NaN;
    let total = NaN;
    for (const [c, kind] of kinds) {
      const text = r === undefined ? '' : own(t1, r, c).trim();
      if (text === '') continue; // 병합으로 가려진 칸(국어 204의 둘째 칸)·빈칸은 값 없음
      const v = num(text);
      if (kind === 'creative') creative = v;
      else if (kind === 'total') total = v;
      else per[kind] = v;
    }
    return { per, creative, total };
  };
  const std = read('교육부기준시수');
  const school = read('본교운영시수');
  const diff = read('증감시수');

  const adjustments: Adjustment[] = [];
  for (const t of tables.filter((x) => rowTexts(x, 0).some((c) => norm(c) === '관련성취기준'))) {
    for (let r = 1; r < t.rows; r++) {
      const a = toAdjustment(t, r, subjects, adjustments.length + 1);
      if (typeof a === 'string') warnings.push(a);
      else adjustments.push(a);
    }
  }
  return {
    standard: std.per, annual: school.per, diff: diff.per,
    creative: { standard: std.creative, school: school.creative, diff: diff.creative },
    total: { standard: std.total, school: school.total, diff: diff.total },
    adjustments, warnings,
  };
}
