/** 한글 hwpx 표 XML 조각 (한글이 저장한 2026 진도표·시간 운영계획 모양을 따른다) */
export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface CellSpec {
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  width: number;
  height: number;
  text: string; // 줄바꿈은 문단 나눔
  header?: boolean; // 제목 줄 칸(header="1")
  borderFill: number;
  paraPr: number;
  charPr: number;
  wrap?: 'SQUEEZE' | 'BREAK';
  margin: [number, number, number, number]; // 왼·오·위·아래
  hasMargin?: boolean;
}

export function cellXml(c: CellSpec): string {
  const run = (t: string) => (t === '' ? `<hp:run charPrIDRef="${c.charPr}"/>` : `<hp:run charPrIDRef="${c.charPr}"><hp:t>${esc(t)}</hp:t></hp:run>`);
  const paras = c.text.split('\n').map((t) => `<hp:p id="0" paraPrIDRef="${c.paraPr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${run(t)}</hp:p>`).join('');
  const [l, r, t, b] = c.margin;
  return `<hp:tc name="" header="${c.header ? 1 : 0}" hasMargin="${c.hasMargin ? 1 : 0}" protect="0" editable="0" dirty="0" borderFillIDRef="${c.borderFill}">`
    + `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="${c.wrap ?? 'BREAK'}" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${paras}</hp:subList>`
    + `<hp:cellAddr colAddr="${c.col}" rowAddr="${c.row}"/><hp:cellSpan colSpan="${c.colSpan ?? 1}" rowSpan="${c.rowSpan ?? 1}"/>`
    + `<hp:cellSz width="${c.width}" height="${c.height}"/><hp:cellMargin left="${l}" right="${r}" top="${t}" bottom="${b}"/></hp:tc>`;
}

export interface TableSpec {
  id: number;
  rows: CellSpec[][];
  colCnt: number;
  width: number;
  height: number;
  repeatHeader?: boolean;
}

/** 표 한 개. 긴 표는 쪽 경계에서 셀 단위로 나누고(pageBreak=CELL) 제목 줄을 반복한다(repeatHeader). */
export function tableXml(t: TableSpec): string {
  const trs = t.rows.map((cells) => `<hp:tr>${cells.map(cellXml).join('')}</hp:tr>`).join('');
  return `<hp:tbl id="${t.id}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="${t.repeatHeader ? 1 : 0}" rowCnt="${t.rows.length}" colCnt="${t.colCnt}" cellSpacing="0" borderFillIDRef="3" noAdjust="0">`
    + `<hp:sz width="${t.width}" widthRelTo="ABSOLUTE" height="${t.height}" heightRelTo="ABSOLUTE" protect="0"/>`
    + '<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="CENTER" vertOffset="0" horzOffset="328"/>'
    + '<hp:outMargin left="283" right="283" top="283" bottom="283"/><hp:inMargin left="0" right="0" top="0" bottom="0"/>'
    + `${trs}</hp:tbl>`;
}
