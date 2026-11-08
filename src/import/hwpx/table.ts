export interface TableCell {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  header: boolean; // hp:tc header="1" (제목 줄)
  text: string;
}

/** 병합으로 가려진 칸. 값은 왼쪽 위 칸(from)에 있다. */
export interface MergedCell {
  merged: { row: number; col: number };
}

export type GridCell = TableCell | MergedCell;

export interface HwpxTable {
  rows: number;
  cols: number;
  cells: TableCell[];
  grid: (GridCell | null)[][]; // null = 칸 정보 없음(깨진 표)
}

export const isMerged = (c: GridCell | null): c is MergedCell => !!c && 'merged' in c;

/** 칸의 글자. 병합으로 가려진 칸이면 왼쪽 위 칸 글자. */
export function cellText(t: HwpxTable, row: number, col: number): string {
  const c = t.grid[row]?.[col] ?? null;
  if (!c) return '';
  return isMerged(c) ? cellText(t, c.merged.row, c.merged.col) : c.text;
}

/** cellAddr·cellSpan으로 격자를 만든다. */
export function buildGrid(cells: TableCell[]): HwpxTable {
  const rows = Math.max(0, ...cells.map((c) => c.row + c.rowSpan));
  const cols = Math.max(0, ...cells.map((c) => c.col + c.colSpan));
  const grid: (GridCell | null)[][] = Array.from({ length: rows }, () => Array<GridCell | null>(cols).fill(null));
  for (const c of cells) {
    for (let r = c.row; r < c.row + c.rowSpan; r++) {
      for (let k = c.col; k < c.col + c.colSpan; k++) {
        grid[r][k] = r === c.row && k === c.col ? c : { merged: { row: c.row, col: c.col } };
      }
    }
  }
  return { rows, cols, cells, grid };
}
