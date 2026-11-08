import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { checkTables, checkXlsx } from '../../src/export/checkXlsx';
import { NEIS_HEADERS, neisRows, neisZip } from '../../src/export/neisXlsx';
import { writeXlsx } from '../../src/export/xlsxWrite';
import { readNeisLessons } from '../../src/import/lessons/neisLessons';
import { readWorkbook } from '../../src/import/xlsx/readWorkbook';
import { standardsOf } from '../../src/lib/standards';
import { defaultSubjects, renameAutonomy } from '../../src/model/subjects';
import type { PlanRow } from '../../src/model/types';
import { need2026, project2026 } from './project2026';

const read = (name: string) => JSON.parse(new TextDecoder().decode(readFileSync(`fixtures/2026-g6/expected/${name}`)));
const subjects = renameAutonomy(defaultSubjects, '신명똑디');
const kor = subjects.find((s) => s.id === 'kor')!;

/** (d) 1학기 국어 기대값 → PlanRow 목록 */
function korRows(): PlanRow[] {
  const t = read('progress-s1.json').find((x: { subjectId: string }) => x.subjectId === 'kor');
  return t.rows.map((r: PlanRow, i: number) => ({ ...r, id: `k${i}`, semester: 1, standards: [], source: { file: 'x', row: i } }));
}

describe('NEIS 교과진도 업로드 xlsx (2026 (d) 국어 1학기)', () => {
  it('머리글 11열이 NEIS1과 글자까지 같고 83행', () => {
    const rows = neisRows(korRows(), kor, 6, 1);
    expect(rows[0]).toEqual(read('neis-format.json').headers);
    expect(NEIS_HEADERS).toHaveLength(11);
    expect(rows).toHaveLength(1 + 83);
    expect(rows.every((r) => r.length === 11 && r.every((c) => typeof c === 'string'))).toBe(true);
    expect(rows[1].slice(0, 6)).toEqual(['1', '6', '1', '국어', '교과서 살펴보기', '교과서 살펴보기']);
  });

  it('행사·태그 표기가 NEIS1 방식', () => {
    const rows = neisRows(korRows(), kor, 6, 1);
    const ev = rows.filter((r) => r[4].startsWith('◈'));
    expect(ev).toHaveLength(1);
    expect(ev[0]).toEqual(expect.arrayContaining(['◈기초학력진단평가', '기초학력진단평가', '1', '1']));
    const tagged = rows.find((r) => r[5].includes('【'))!;
    expect(tagged[5]).toBe('주제 중심 독서 하기 -3- 【폭력예방 및 신변보호-학교폭력】');
    const ex = read('neis-format.json').examples.tagged;
    expect(ex[5]).toBe(tagged[5]); // NEIS1의 같은 행과 표기가 같다
  });

  it('우리 읽기로 다시 읽으면 같은 행이 나온다(왕복)', async () => {
    const out = neisRows(korRows(), kor, 6, 1);
    const sheets = await readWorkbook(await writeXlsx({ empty0: out }));
    expect(sheets[0].name).toBe('empty0');
    const back = readNeisLessons([{ fileName: 'a.xlsx', sheets }], subjects).rows;
    const orig = korRows();
    expect(back).toHaveLength(orig.length);
    back.forEach((b, i) => {
      expect([b.unit, b.n, b.total, b.tags]).toEqual([orig[i].unit, orig[i].n, orig[i].total, orig[i].tags]);
      expect(b.kind === 'event' ? b.eventName : b.topic).toBe(orig[i].kind === 'event' ? orig[i].eventName : orig[i].topic);
    });
  });
});

describe.skipIf(!need2026)('2026 프로젝트로 내보내기', () => {
  it('NEIS zip: 교과·학기마다 한 파일, 이름 규칙, 국어 83행', async () => {
    const p = await project2026();
    const zip = await JSZip.loadAsync(await neisZip(p));
    const names = Object.keys(zip.files).map((n) => n.normalize('NFC')).sort();
    expect(names).toContain('6학년_1학기_국어_진도표.xlsx');
    expect(names).toContain('6학년_2학기_국어_진도표.xlsx');
    expect(names).toContain('6학년_1학기_신명똑디_진도표.xlsx');
    expect(names.some((n) => n.includes('자율') || n.includes('동아리'))).toBe(false); // 창체 양식은 1차에 없다
    const f = Object.keys(zip.files).find((n) => n.normalize('NFC') === '6학년_1학기_국어_진도표.xlsx')!;
    const sheets = await readWorkbook(await zip.files[f].async('arraybuffer'));
    expect(sheets[0].rows).toHaveLength(1 + 83);
  });

  it('점검표: 시트 4개, 교과별 숫자가 정답지와 같다', async () => {
    const p = await project2026();
    const tables = checkTables(p, standardsOf('busan-2027'));
    expect(Object.keys(tables)).toEqual(['교과별', '창체', '태그', '규정 검사']);
    const totals = read('totals.json').subjects;
    const kor1 = tables['교과별'].find((r) => r[0] === '국어')!;
    expect(kor1.slice(1)).toEqual([totals.kor.s1, totals.kor.s2, totals.kor.year, totals.kor.year, 0]);
    expect(tables['교과별'].at(-1)!.slice(1, 4)).toEqual([555, 537, 1092]);
    const sheets = await readWorkbook(await checkXlsx(p, standardsOf('busan-2027')));
    expect(sheets.map((s) => s.name)).toEqual(['교과별', '창체', '태그', '규정 검사']);
  });
});
