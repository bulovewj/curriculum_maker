import { describe, expect, it } from 'vitest';
import { addDays, isValidDate, lastDayOfFebruary, weekday, weekMonday, weekSaturday } from './dates';

describe('dates', () => {
  it('요일: 2026-03-02는 월요일, 2026-03-08은 일요일', () => {
    expect(weekday('2026-03-02')).toBe(1);
    expect(weekday('2026-03-08')).toBe(7);
  });

  it('2026-12-28 주의 토요일은 2027-01-02', () => {
    expect(weekSaturday('2026-12-28')).toBe('2027-01-02');
    expect(weekMonday('2027-01-02')).toBe('2026-12-28');
  });

  it('윤년: 2028-02-29는 있고 2027-02-29는 없다', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2027-02-29')).toBe(false);
    expect(lastDayOfFebruary(2028)).toBe('2028-02-29');
    expect(lastDayOfFebruary(2027)).toBe('2027-02-28');
  });

  it('날짜 더하기는 달·해를 넘어간다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
