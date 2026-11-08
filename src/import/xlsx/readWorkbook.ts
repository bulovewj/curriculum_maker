import ExcelJS from 'exceljs';

export interface Sheet {
  name: string;
  rows: string[][];
  merges: string[]; // 'A1:C2' 꼴
}

/** 칸 값을 글자로. 숫자·날짜·수식 결과·서식 글자 모두. */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('text' in v) return String(v.text);
    if ('error' in v) return '';
  }
  return String(v);
}

/** xlsx → 시트별 글자 2차원 배열 + 병합 목록. 글자는 NFC 정규화. */
export async function readWorkbook(data: ArrayBuffer): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  return wb.worksheets.map((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      const out: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        out[c - 1] = cellText(cell.value).normalize('NFC').trim();
      });
      rows[r - 1] = Array.from(out, (x) => x ?? '');
    });
    const merges = (ws.model as { merges?: string[] }).merges ?? [];
    return { name: ws.name.normalize('NFC'), rows: Array.from(rows, (x) => x ?? []), merges };
  });
}
