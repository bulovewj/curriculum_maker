import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { buildGrid, type HwpxTable, type TableCell } from './table';

export type HwpxBlock = { kind: 'para'; text: string } | ({ kind: 'table' } & HwpxTable);

// 본문 글자에서 뺄 요소: 표(따로 꺼냄)·각주·미주·머리말·꼬리말·메모
const SKIP = new Set(['tbl', 'footNote', 'endNote', 'header', 'footer', 'memo']);
const SPACE: Record<string, string> = { fwSpace: ' ', hwSpace: ' ', nbSpace: ' ', tab: '\t', lineBreak: '\n' };

type El = Element;
const kids = (n: Node): El[] =>
  Array.from({ length: n.childNodes.length }, (_, i) => n.childNodes[i]).filter((c): c is El => c.nodeType === 1);
const local = (n: El) => n.localName ?? n.nodeName.replace(/^.*:/, '');

/** hp:t 안 글자. fwSpace·tab 같은 자식 요소 뒤 글자도 모은다. */
function tText(t: El): string {
  let s = '';
  for (let i = 0; i < t.childNodes.length; i++) {
    const c = t.childNodes[i];
    if (c.nodeType === 3 || c.nodeType === 4) s += c.nodeValue ?? '';
    else if (c.nodeType === 1) s += SPACE[local(c as El)] ?? '';
  }
  return s;
}

/** 요소 아래 hp:t 글자만(표·메모 등 제외). 표는 tables에 순서대로 모은다. */
function collect(n: El, tables: El[]): string {
  let s = '';
  for (const c of kids(n)) {
    const name = local(c);
    if (name === 'tbl') tables.push(c);
    if (SKIP.has(name)) continue;
    s += name === 't' ? tText(c) : collect(c, tables);
  }
  return s;
}

/** hp:tbl → 표 블록들. 칸 속 표는 바깥 표 뒤에 따로 붙인다. */
function readTable(tbl: El): ({ kind: 'table' } & HwpxTable)[] {
  const inner: El[] = [];
  const cells: TableCell[] = [];
  for (const tr of kids(tbl).filter((e) => local(e) === 'tr')) {
    for (const tc of kids(tr).filter((e) => local(e) === 'tc')) {
      const part = (name: string) => kids(tc).find((e) => local(e) === name);
      const addr = part('cellAddr');
      const span = part('cellSpan');
      const sub = part('subList');
      const paras = sub ? kids(sub).filter((e) => local(e) === 'p') : [];
      cells.push({
        row: Number(addr?.getAttribute('rowAddr') ?? 0),
        col: Number(addr?.getAttribute('colAddr') ?? 0),
        rowSpan: Number(span?.getAttribute('rowSpan') ?? 1),
        colSpan: Number(span?.getAttribute('colSpan') ?? 1),
        header: tc.getAttribute('header') === '1',
        text: paras.map((p) => collect(p, inner)).join('\n').normalize('NFC').trim(),
      });
    }
  }
  return [{ kind: 'table', ...buildGrid(cells) }, ...inner.flatMap(readTable)];
}

/** section XML 한 개 → 블록(문단 글자 / 표) 순서대로 */
export function readSection(xml: string): HwpxBlock[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const blocks: HwpxBlock[] = [];
  for (const p of kids(doc.documentElement as unknown as El).filter((e) => local(e) === 'p')) {
    const tables: El[] = [];
    const text = collect(p, tables).normalize('NFC').trim();
    if (text) blocks.push({ kind: 'para', text });
    blocks.push(...tables.flatMap(readTable));
  }
  return blocks;
}

/** hwpx 파일 → 모든 section의 블록 */
export async function readHwpx(data: ArrayBuffer): Promise<HwpxBlock[]> {
  const zip = await JSZip.loadAsync(data);
  const names = Object.keys(zip.files)
    .filter((n) => /^Contents\/section\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (names.length === 0) throw new Error('hwpx 본문(Contents/section*.xml)이 없습니다. 한글 파일이 맞는지 확인하세요.');
  const out: HwpxBlock[] = [];
  for (const n of names) out.push(...readSection(await zip.file(n)!.async('string')));
  return out;
}

export const tablesOf = (blocks: HwpxBlock[]) =>
  blocks.filter((b): b is { kind: 'table' } & HwpxTable => b.kind === 'table');
