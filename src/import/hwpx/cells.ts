import { cellText, isMerged, type HwpxTable } from './table';

/** 비교용 이름: 공백 제거, ⋅ ∙ ・ ㆍ → ·, NFC */
export const norm = (s: string): string => s.normalize('NFC').replace(/\s/g, '').replace(/[⋅∙・ㆍ•]/g, '·');

/** 칸 글자 → 숫자. '1,088' '+32' '−12' '⋅'(0) 빈칸(0). 숫자가 아니면 NaN */
export function num(s: string): number {
  const t = s.replace(/[,\s]/g, '').replace(/[−–]/g, '-');
  if (t === '' || /^[⋅·∙]$/.test(t)) return 0;
  return /^[+-]?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** 병합으로 가려진 칸이면 빈 글자(값이 위·옆 칸에 한 번만 있을 때), 아니면 칸 글자 */
export function own(t: HwpxTable, row: number, col: number): string {
  return isMerged(t.grid[row]?.[col] ?? null) ? '' : cellText(t, row, col);
}

/** 표 한 줄의 글자(병합 칸은 왼쪽 위 칸 글자) */
export const rowTexts = (t: HwpxTable, row: number): string[] =>
  Array.from({ length: t.cols }, (_, c) => cellText(t, row, c));
