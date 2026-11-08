import { describe, expect, it } from 'vitest';
import { ORIGINAL, REF, findFile, readBuffer } from '../../../tests/files';
import { readHwpx, readSection, tablesOf } from './readHwpx';
import { cellText, isMerged, type HwpxTable } from './table';

const rowText = (t: HwpxTable, r: number) => Array.from({ length: t.cols }, (_, c) => cellText(t, r, c));
const load = async (dir: string, key: string) => tablesOf(await readHwpx(readBuffer(findFile(dir, key)!)));

const NS = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"';
const cell = (r: number, c: number, body: string, span = '1', extra = '') =>
  `<hp:tc${extra}><hp:subList><hp:p><hp:run>${body}</hp:run></hp:p></hp:subList><hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="${span}" rowSpan="1"/></hp:tc>`;

describe('조각 XML', () => {
  it('fwSpace 뒤 글자·계산식 제외·병합·제목 줄·표 속 표', () => {
    const formula = '<hp:ctrl><hp:fieldBegin type="FORMULA"><hp:parameters><hp:stringParam name="Formula">=SUM(B?:M?)</hp:stringParam></hp:parameters></hp:fieldBegin></hp:ctrl><hp:t>1,088</hp:t>';
    const inner = `<hp:tbl>${'<hp:tr>' + cell(0, 0, '<hp:t>안</hp:t>') + '</hp:tr>'}</hp:tbl>`;
    const xml = `<hs:sec ${NS}><hp:p><hp:run><hp:t>∙<hp:fwSpace/>3.20.(금) 총회</hp:t></hp:run></hp:p>
      <hp:p><hp:run><hp:tbl><hp:tr>${cell(0, 0, '<hp:t>합</hp:t>', '2', ' header="1"')}</hp:tr><hp:tr>${cell(1, 0, formula)}${cell(1, 1, `<hp:t>밖</hp:t>${inner}`)}</hp:tr></hp:tbl></hp:run></hp:p></hs:sec>`;
    const b = readSection(xml);
    expect(b[0]).toEqual({ kind: 'para', text: '∙ 3.20.(금) 총회' });
    const [outer, sub] = tablesOf(b);
    expect(rowText(outer, 0)).toEqual(['합', '합']);
    expect(isMerged(outer.grid[0][1])).toBe(true);
    expect(outer.cells[0].header).toBe(true);
    expect(rowText(outer, 1)).toEqual(['1,088', '밖']);
    expect(rowText(sub, 0)).toEqual(['안']);
  });
});

const plan = findFile(REF, '시수 증가');
describe.skipIf(!plan)('PLAN hwpx', () => {
  it('표1 교육부 기준 시수(국어 2칸 병합), 계산식 글자 없음', async () => {
    const [t1, ...rest] = await load(REF, '시수 증가');
    const r = rowText(t1, 2);
    expect(r[0].replace(/\s/g, '')).toBe('교육부기준시수'); // 칸 안 줄바꿈 있음
    expect(isMerged(t1.grid[2][2])).toBe(true);
    expect(r.slice(2, 13)).toEqual(['204', '102', '34', '136', '102', '68', '102', '68', '68', '102', '102']);
    expect([t1, ...rest].flatMap((t) => t.cells).some((c) => /SUM\(|=/.test(c.text))).toBe(false);
  });
});

const aut = findFile(ORIGINAL, '학교자율시간');
describe.skipIf(!aut)('학교자율시간 hwpx(판별 시험용)', () => {
  it('표 20개, 6학년 차시 표 머리글', async () => {
    const t = await load(ORIGINAL, '학교자율시간');
    expect(t).toHaveLength(20);
    const g6 = t.find((x) => cellText(x, 1, 0).startsWith('[6국똑디'))!;
    expect(rowText(g6, 0)).toEqual(['성취기준', '학습주제', '학습내용', '시기', '시수']);
  });
});

const cur = findFile(REF, '학사일정 및 교육과정편제');
describe.skipIf(!cur)('CUR hwpx', () => {
  it('5~6학년군 표 2개, 두 번째 표 1행에 5학년(2025년)·6학년(2026년), 공개수업 글자 그대로', async () => {
    const t = await load(REF, '학사일정 및 교육과정편제');
    const g56 = t.filter((x) => rowText(x, 0).includes('5-6학년군'));
    expect(g56).toHaveLength(2);
    expect(rowText(g56[1], 1)).toEqual(expect.arrayContaining(['5학년(2025년)', '6학년(2026년)']));
    expect(t.flatMap((x) => x.cells).some((c) => c.text.includes('3.20.(금) 학부모 공개수업 및 총회'))).toBe(true);
  });
});

describe('형이 변환한 (c)(d)(e) hwpx', () => {
  const cases: [string, number][] = [['시간 운영계획', 2], ['1학기 교과진도', 15], ['2학기 교과진도', 15]];
  for (const [key, n] of cases) {
    it.skipIf(!findFile(ORIGINAL, key))(`${key}: 표 ${n}개 (파일 없으면 건너뜀)`, async () => {
      expect(await load(ORIGINAL, key)).toHaveLength(n);
    });
  }
});
