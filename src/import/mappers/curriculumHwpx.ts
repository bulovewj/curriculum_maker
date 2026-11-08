import type { PriorYearHours, Subject, SubjectId } from '../../model/types';
import { norm, num, own } from '../hwpx/cells';
import { tablesOf, type HwpxBlock } from '../hwpx/readHwpx';
import { cellText, isMerged, type HwpxTable, type TableCell } from '../hwpx/table';
import { subjectByName } from '../lessons/neisLessons';

export interface CurriculumResult {
  priorYear: PriorYearHours; // 작년 학년(5학년 2025) 본교 시수
  standard: Record<SubjectId, number>; // 올해 학년 본교 기준(학년 몫)
  school: Record<SubjectId, number>; // 올해 학년 본교 시수(연간)
  creative: { standard: number; school: number };
  total: { standard: number; school: number };
  creativeAreas: Record<string, number>; // 올해 창체 영역별 시수(예 '자율·자치활동': 72). '계' 포함
  warnings: string[];
}

/** 머리 줄에서 '{학년}학년({학년도}년)' 칸. 같은 표에 여러 번 나오면 첫 칸(교과 열). */
function headerCell(t: HwpxTable, row: number, label: string): TableCell | undefined {
  return t.cells.find((c) => c.row === row && norm(c.text) === label);
}

/** 병합 칸 안에서 머리글(예 '본교시수')이 있는 열 */
function colIn(t: HwpxTable, rows: number[], head: TableCell, label: string): number | undefined {
  for (let c = head.col; c < head.col + head.colSpan; c++) {
    if (rows.some((r) => norm(cellText(t, r, c)) === label)) return c;
  }
  return undefined;
}

/** (아) 학년군 편제 hwpx → 작년 열 = priorYear, 올해 열 = 편제 */
export function readCurriculum(blocks: HwpxBlock[], subjects: Subject[], year: number, grade: number): CurriculumResult {
  const prior = norm(`${grade - 1}학년(${year - 1}년)`);
  const now = norm(`${grade}학년(${year}년)`);
  const warnings: string[] = [];
  const found = tablesOf(blocks)
    .map((t) => ({ t, row: Array.from({ length: Math.min(t.rows, 4) }, (_, r) => r).find((r) => headerCell(t, r, prior) && headerCell(t, r, now)) }))
    .find((x) => x.row !== undefined);
  if (!found || found.row === undefined) throw new Error(`편제 표에서 ${grade - 1}학년(${year - 1}년)·${grade}학년(${year}년) 머리글을 찾지 못했습니다.`);
  const { t, row: head } = found;
  const subHeads = [head + 1, head + 2];
  const hp = headerCell(t, head, prior)!;
  const hn = headerCell(t, head, now)!;
  const [pSch, nStd, nSch] = [
    colIn(t, subHeads, hp, '본교시수'),
    colIn(t, subHeads, hn, '본교기준'), colIn(t, subHeads, hn, '본교시수'),
  ];
  if (pSch === undefined || nStd === undefined || nSch === undefined) throw new Error('편제 표에서 본교 기준·본교 시수 열을 찾지 못했습니다.');

  // 교과 행: 1열 = 교과군, 2열 = 교과. 국어 아래 다른 이름 = 학교자율시간
  const school: Record<SubjectId, number> = {};
  const standard: Record<SubjectId, number> = {};
  const priorSchool: Record<SubjectId, number> = {};
  const out = { creative: { standard: 0, school: 0 }, total: { standard: 0, school: 0 }, priorCreative: 0, priorTotal: 0 };
  let prevId: SubjectId | undefined;
  for (let r = head + 3; r < t.rows; r++) {
    const label = norm(cellText(t, r, 2));
    const group = norm(cellText(t, r, 0));
    const read = (c: number) => num(own(t, r, c));
    const has = (c: number) => own(t, r, c).trim() !== '';
    if (group === '창의적체험활동' || label === '창의적체험활동') {
      [out.creative.standard, out.creative.school, out.priorCreative] = [read(nStd), read(nSch), read(pSch)];
      continue;
    }
    if (group === '총수업시간수') {
      [out.total.standard, out.total.school, out.priorTotal] = [read(nStd), read(nSch), read(pSch)];
      break;
    }
    const id = subjectByName(subjects, label) ?? (prevId === 'kor' ? subjects.find((s) => s.kind === 'autonomy')?.id : undefined);
    if (!id) { warnings.push(`편제 표 ${r + 1}행 '${label}'을(를) 알 수 없어 건너뜀`); continue; }
    prevId = id;
    if (has(nSch)) school[id] = read(nSch);
    if (has(nStd)) standard[id] = read(nStd);
    if (has(pSch)) priorSchool[id] = read(pSch);
  }

  // 창체 영역 표(오른쪽): '영역 | 6학년(2026년)' 줄. 같은 영역이 병합돼 한 번만 읽는다.
  const creativeAreas: Record<string, number> = {};
  const areaHead = t.cells.filter((c) => c.row === head && norm(c.text) === now).pop();
  if (areaHead && areaHead.col > hn.col + hn.colSpan - 1) {
    for (let r = head + 3; r < t.rows; r++) {
      const name = own(t, r, areaHead.col - 1).trim();
      const v = num(own(t, r, areaHead.col));
      if (name && !Number.isNaN(v) && !isMerged(t.grid[r][areaHead.col])) creativeAreas[name.replace(/\s/g, '')] = v;
    }
  } else warnings.push('창체 영역 표를 찾지 못했습니다.');

  return {
    priorYear: { year: year - 1, grade: grade - 1, school: priorSchool, creativeTotal: out.priorCreative, total: out.priorTotal },
    standard, school, creative: out.creative, total: out.total, creativeAreas, warnings,
  };
}
