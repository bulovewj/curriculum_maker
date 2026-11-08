import { describe, expect, it } from 'vitest';
import { ORIGINAL, findFile, readBuffer } from '../../../tests/files';
import { defaultSubjects, renameAutonomy } from '../../model/subjects';
import { readHwpx } from '../hwpx/readHwpx';
import { readTimePlan } from './timePlanHwpx';

const subjects = renameAutonomy(defaultSubjects, '신명똑디');
const file = findFile(ORIGINAL, '시간 운영계획');

describe.skipIf(!file)('(c) 시간 운영계획 hwpx', () => {
  const load = async () => readTimePlan(await readHwpx(readBuffer(file!)), subjects);
  const sum = (h: Record<string, number>) => Object.values(h).reduce((a, b) => a + b, 0);

  it('학기마다 21주 행, 학기 계 555·537', async () => {
    const r = await load();
    expect(r.warnings).toEqual([]);
    expect(r.tables.map((t) => [t.semester, t.rows.length])).toEqual([[1, 21], [2, 21]]);
    expect(r.tables.map((t) => t.semesterTotal?.total)).toEqual([555, 537]);
    expect(r.tables.map((t) => t.semesterTotal?.schoolDays)).toEqual([96, 94]);
    expect(r.tables[0].semesterTotal?.dayPeriods).toEqual([113, 119, 95, 120, 108, 0]);
    expect(r.tables[1].semesterTotal?.dayPeriods).toEqual([108, 121, 105, 111, 92, 0]);
  });

  it('1학기 8주 행 = 작업지시서 7.3 예시', async () => {
    const w8 = (await load()).tables[0].rows.find((x) => x.week === 8)!;
    expect(w8).toMatchObject({ semester: 1, period: '4.20~4.25', month: 4, schoolDays: 5, dayPeriods: [6, 6, 5, 7, 7, 0] });
    expect(w8.hours).toEqual({
      kor: 6, autonomy: 0, soc: 1, mor: 1, math: 4, sci: 1, prac: 1, pe: 7, music: 1, art: 0, eng: 1,
      'ca-self': 6, 'ca-club': 0, 'ca-career': 2,
    });
    expect(sum(w8.hours)).toBe(31);
    expect(w8.note).toContain('4.22');
  });

  it('주별 값의 합 = 학기 계, 연간·편제 줄', async () => {
    const r = await load();
    for (const t of r.tables) {
      const total = sum(t.semesterTotal!.hours);
      expect(total).toBe(t.semesterTotal!.total);
      const rows = t.rows.reduce((a, x) => a + sum(x.hours), 0);
      expect(rows).toBe(t.semesterTotal!.total);
    }
    const y = r.tables[1];
    expect(y.annual?.total).toBe(1092);
    expect(y.annual?.hours).toMatchObject({ kor: 192, autonomy: 32, soc: 96, 'ca-self': 72, 'ca-club': 18, 'ca-career': 8 });
    expect(y.plan?.hours).toMatchObject({ kor: 192, autonomy: 32, eng: 102 });
    expect(y.diff?.total).toBe(0);
  });

  it('2학기: 마지막 주 토요일 빈칸은 0, 월 묶음 9월', async () => {
    const t2 = (await load()).tables[1];
    expect(t2.rows[0]).toMatchObject({ week: 1, period: '9.1~9.5', month: 9 });
    expect(t2.rows[0].dayPeriods[0]).toBe(0); // 8.31 빈칸 = 0 (예외 12)
    expect(t2.rows.at(-1)).toMatchObject({ week: 24, period: '2.8~2.13' });
  });
});
