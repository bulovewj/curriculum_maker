import ExcelJS from 'exceljs';

/** 시트 이름 → 줄들. 값은 모두 글자로 쓴다(병합·서식 없음). */
export async function writeXlsx(sheets: Record<string, (string | number)[][]>): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    for (const r of rows) ws.addRow(r.map((v) => String(v)));
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer).buffer.slice(0) as ArrayBuffer;
}
