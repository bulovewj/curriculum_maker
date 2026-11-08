import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { buildStandardRows, findHeaderRow, guessColumns, mappingFromAi } from './columnMap';
import { readNeisLessons } from './lessons/neisLessons';
import { readWorkbook } from './xlsx/readWorkbook';
import { writeXlsx } from '../export/xlsxWrite';
import { defaultSubjects } from '../model/subjects';

describe('열 맞추기', () => {
  it('머리글 낱말로 짐작한다(같은 목표는 한 번만)', () => {
    const m = guessColumns(['과목', '대단원(대주제)', '단원명(소주제)', '차시', '학습주제', '교과서쪽', '준비물', '(핵심) 성취기준', '메모']);
    expect(Object.values(m).map((x) => x.target)).toEqual(['편제', '단원', '소단원', '해당차시', '학습내용', '쪽수', '준비물', '성취기준', '']);
  });
  it('AI 답에서 목록 밖 열·이름은 버리고 겹치면 자신감 큰 쪽만', () => {
    const r = mappingFromAi([{ column: 0, target: '편제', confidence: 0.9 }, { column: 1, target: '편제', confidence: 0.5 }, { column: 9, target: '단원', confidence: 1 }, { column: 2, target: '이상한', confidence: 1 }], 3);
    expect(r.mapping[0].target).toBe('편제');
    expect(r.mapping[1].target).toBe('');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

const dir = 'reference';
const file = (() => { try { return readdirSync(dir).find((f) => f.normalize('NFC').includes('실과(송)')); } catch { return undefined; } })();
describe.skipIf(!file)('실과 진도표(모르는 양식) → 열 맞추기 → 진도 행', () => {
  it('차시 1~2/20이 펼쳐져 실과 진도 행으로 들어간다', async () => {
    const b = readFileSync(`${dir}/${file}`);
    const sheets = await readWorkbook(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    const sheet = sheets[0];
    const at = findHeaderRow(sheet);
    const mapping = guessColumns(sheet.rows[at]);
    const std = await writeXlsx({ 진도: buildStandardRows(sheet, at, mapping) });
    const r = readNeisLessons([{ fileName: 'x.xlsx', sheets: await readWorkbook(std) }], defaultSubjects);
    const prac = r.rows.filter((x) => x.subjectId === 'prac');
    expect(prac.length).toBeGreaterThan(40);
    expect(prac[0].topic).toBe('생활 자원의 올바른 사용 -1-');
    expect(prac[1].topic).toBe('생활 자원의 올바른 사용 -2-');
    expect(prac[0].total).toBe(20);
    expect(prac[0].standards).toEqual(['6실02-03']);
  });
});
