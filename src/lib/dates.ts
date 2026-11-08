// 날짜 계산은 여기서만, UTC 기준으로 한다(시간대에 따라 하루 밀리는 일을 막음).
import type { DateStr, Weekday } from '../model/types';

const DAY = 86_400_000;

export function toUtc(d: DateStr): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

export function fromUtc(t: number): DateStr {
  return new Date(t).toISOString().slice(0, 10);
}

/** 있는 날짜인지(2027-02-29 같은 것은 false). */
export function isValidDate(d: DateStr): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && fromUtc(toUtc(d)) === d;
}

export const addDays = (d: DateStr, n: number): DateStr => fromUtc(toUtc(d) + n * DAY);

export function weekday(d: DateStr): Weekday {
  return (((new Date(toUtc(d)).getUTCDay() + 6) % 7) + 1) as Weekday;
}

/** 그 날이 든 주(월~토)의 월요일·토요일. */
export const weekMonday = (d: DateStr): DateStr => addDays(d, 1 - weekday(d));
export const weekSaturday = (d: DateStr): DateStr => addDays(weekMonday(d), 5);

export const lastDayOfFebruary = (year: number): DateStr => addDays(`${year}-03-01`, -1);
