import { describe, expect, it } from 'vitest';
import { ORIGINAL, findFile, readBuffer } from '../../../tests/files';
import type { CalendarDay } from '../../model/types';
import { readWorkbook } from '../xlsx/readWorkbook';
import { circledNumber, readScheduleP04 } from './scheduleP04';

describe('원문자', () => {
  it('① ⑳ ㉑ ㉟ ㊱ ㊿ → 숫자', () => {
    expect(['①', '⑳', '㉑', '㉟', '㊱', '㊿', '7'].map(circledNumber)).toEqual([1, 20, 21, 35, 36, 50, 0]);
  });
});

const file = findFile(ORIGINAL, '행사 및 일정');
describe.skipIf(!file)('P04 학사일정 2026 6학년', () => {
  it('학기 합계·휴일·교시', async () => {
    const r = readScheduleP04(await readWorkbook(readBuffer(file!)), 2026, 6);
    const by = new Map(r.calendar.map((d) => [d.date, d]));
    const sum = (sem: 1 | 2, f: (d: CalendarDay) => number) =>
      r.calendar.filter((d) => d.semester === sem && d.schoolDay).reduce((a, d) => a + f(d), 0);
    // 행사 13은 날짜가 '2026.09.'(월만)이라 경고가 정상. 달력 쪽 경고는 없어야 한다.
    expect(r.warnings.filter((w) => !w.startsWith('행사'))).toEqual([]);
    expect(r.warnings.filter((w) => w.startsWith('행사'))).toHaveLength(1);
    expect([sum(1, () => 1), sum(1, (d) => d.periods)]).toEqual([96, 555]);
    expect([sum(2, () => 1), sum(2, (d) => d.periods)]).toEqual([94, 537]);
    expect(by.get('2026-03-02')?.holiday).toContain('대체공휴일');
    expect(by.get('2026-05-01')).toMatchObject({ schoolDay: false });
    expect(by.get('2026-05-01')?.holiday).toBeTruthy();
    expect(by.get('2027-02-12')).toMatchObject({ periods: 3, schoolDay: true });
    expect(r.calendar[0].date).toBe('2026-03-01');
    expect(r.calendar.at(-1)?.date).toBe('2027-02-28');
  });

  it('달 읽기: A열 4, 30 31 → 3.30·3.31', async () => {
    const { calendar } = readScheduleP04(await readWorkbook(readBuffer(file!)), 2026, 6);
    const by = new Map(calendar.map((d) => [d.date, d]));
    expect(by.get('2026-03-30')?.schoolDay).toBe(true);
    expect(by.get('2026-03-31')?.schoolDay).toBe(true);
    expect(by.get('2026-04-03')?.schoolDay).toBe(true);
  });

  it('교시 변동 메모가 그 날짜 notes에 들어간다', async () => {
    const { calendar } = readScheduleP04(await readWorkbook(readBuffer(file!)), 2026, 6);
    const d = calendar.find((x) => x.date === '2026-04-23')!;
    expect(d.notes.some((n) => n.includes('수학여행(6학년)'))).toBe(true);
  });

  it('행사: 6학년·전학년만, 예시·취소 제외', async () => {
    const { events } = readScheduleP04(await readWorkbook(readBuffer(file!)), 2026, 6);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.name.includes('취소'))).toBe(false);
    expect(events.every((e) => e.start <= e.end)).toBe(true);
    console.log('행사', events.length, events.slice(0, 3).map((e) => `${e.start}~${e.end} ${e.name}`));
  });
});
