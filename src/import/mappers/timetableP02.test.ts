import { describe, expect, it } from 'vitest';
import { ORIGINAL, findFile, readBuffer } from '../../../tests/files';
import { defaultSubjects } from '../../model/subjects';
import type { SubjectId } from '../../model/types';
import { readWorkbook } from '../xlsx/readWorkbook';
import { classCode, periodOf, readSpecialistCells } from './specialistP02';
import { readClassTimetable, readSpecialistHours, specialistStatus } from './timetableP02';

const count = (cells: { subjectId: SubjectId }[]) => {
  const out: Record<string, number> = {};
  for (const c of cells) out[c.subjectId] = (out[c.subjectId] ?? 0) + 1;
  return out;
};

describe('교시 칸 글자', () => {
  it('점심 표시와 (4/5) 칸', () => {
    expect(['3', '4\n1부 점심', '(4/5)\n2부 점심', '5\n3부 점심'].map(periodOf)).toEqual([3, 4, 5, 5]);
    expect(periodOf('놀이영어')).toBeNaN();
  });
});

describe('학급 코드', () => {
  it('날짜로 저장된 코드를 되돌린다', () => {
    expect(classCode('2026-06-07')).toBe('6-7');
    expect(classCode('6-7')).toBe('6-7');
    expect(classCode('놀이영어')).toBeUndefined();
    expect(classCode('5-4(영어2실)')).toBeUndefined();
  });
});

const file = findFile(ORIGINAL, '전담 및 학급');
describe.skipIf(!file)('P02 2026 6학년 7반', () => {
  const load = async () => readWorkbook(readBuffer(file!));

  it('전담시간표: 영어 3·체육 2·과학 2칸, 교사 이름 없음', async () => {
    const sheets = await load();
    const sp = readSpecialistCells(sheets, 6, 7, defaultSubjects);
    expect(sp.warnings).toEqual([]);
    expect(count(sp.cells)).toEqual({ eng: 3, pe: 2, sci: 2 });
    // 교사 이름: 시트에서 '이름: 교실' 꼴 칸의 앞부분. 결과에 하나도 없어야 한다(이름 목록은 저장하지 않는다).
    const names = sheets.flatMap((s) => s.rows.flat()).flatMap((t) => (t.includes(':') ? [t.split(':')[0].trim()] : []));
    expect(names.length).toBeGreaterThan(3);
    expect(names.filter((n) => JSON.stringify(sp).includes(n))).toEqual([]);
  });

  it('7반 시간표: 주당 29칸, 교과별 칸 수', async () => {
    const sheets = await load();
    const sp = readSpecialistCells(sheets, 6, 7, defaultSubjects);
    const tt = readClassTimetable(sheets, 6, 7, defaultSubjects, sp.cells);
    expect(tt.warnings).toEqual([]);
    expect(tt.cells).toHaveLength(29);
    expect(count(tt.cells)).toEqual({
      kor: 5, soc: 3, mor: 1, math: 4, sci: 3, prac: 2, pe: 2, music: 2, art: 2, eng: 3, 'ca-self': 1, 'ca-club': 1,
    });
    expect(tt.cells.filter((c) => c.specialist)).toHaveLength(7);
  });

  it('전담 칸 위치 = 반별 시간표 7반의 해당 교과 칸', async () => {
    const sheets = await load();
    const sp = readSpecialistCells(sheets, 6, 7, defaultSubjects);
    const tt = readClassTimetable(sheets, 6, 7, defaultSubjects);
    const at = (w: number, p: number) => tt.cells.find((c) => c.weekday === w && c.period === p)?.subjectId;
    expect(sp.cells.filter((x) => at(x.weekday, x.period) !== x.subjectId)).toEqual([]);
  });

  it('주간전담시수: 영어3 체육2 과학2 → 영어·체육 전부 전담, 과학 확인 필요', async () => {
    const sheets = await load();
    const { hours, warnings } = readSpecialistHours(sheets, 6, defaultSubjects);
    expect(warnings).toEqual([]);
    expect(hours).toEqual({ eng: 3, pe: 2, sci: 2 });
    const tt = readClassTimetable(sheets, 6, 7, defaultSubjects);
    expect(specialistStatus(tt.cells, hours)).toEqual({ eng: 'all', pe: 'all', sci: 'partial' });
  });
});
