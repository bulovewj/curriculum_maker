import { addDays, lastDayOfFebruary, weekday } from '../../lib/dates';
import type { CalendarDay, DateStr, Semester, SchoolEvent, Weekday } from '../../model/types';
import type { Sheet } from '../xlsx/readWorkbook';

export interface ScheduleResult {
  calendar: CalendarDay[];
  events: SchoolEvent[];
  warnings: string[];
  /** 시트의 '1학기 합계'·'2학기 합계' 줄 교시 합(확인용) */
  sheetTotals: Record<Semester, number | undefined>;
}

const DAY_COLS = 5; // 월~금, 이어서 '계' 열

/** ①~⑳ ㉑~㉟ ㊱~㊿ → 1~50. 원문자가 아니면 0 */
export function circledNumber(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  if (c >= 0x2460 && c <= 0x2473) return c - 0x2460 + 1;
  if (c >= 0x3251 && c <= 0x325f) return c - 0x3251 + 21;
  if (c >= 0x32b1 && c <= 0x32bf) return c - 0x32b1 + 36;
  return 0;
}

const find = (sheets: Sheet[], name: string) => sheets.find((s) => s.name.includes(name));
const isMonth1or2 = (m: number) => m <= 2;
/** 학년도의 달 → 실제 날짜. 1~2월은 다음 해. */
const dateOf = (year: number, m: number, d: number): DateStr =>
  `${isMonth1or2(m) ? year + 1 : year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** 'M.D' 꼴 날짜 글자 → 학년도 날짜. 없으면 undefined. */
const mdToDate = (year: number, m: string, d: string) => dateOf(year, Number(m), Number(d));

/** 학기를 가르는 줄 번호와 교시 합 */
function findTotals(rows: string[][]) {
  const at = (key: string) => rows.findIndex((r) => r.slice(0, 2).some((c) => c.includes(key)));
  const num = (i: number, col: number) => (i < 0 ? undefined : Number(rows[i][col]) || undefined);
  return { s1: at('1학기 합계'), s2: at('2학기 합계'), num };
}

/** 일정 글(여러 줄)에서 날짜로 시작하는 줄의 날짜 → 줄 글. 같은 날짜에 여러 줄 가능 */
function textByDate(year: number, text: string): { date: DateStr; line: string }[] {
  const out: { date: DateStr; line: string }[] = [];
  for (const line of text.split('\n')) {
    const m = line.replace(/^[\s∙•·-]+/, '').match(/^(\d{1,2})\.\s*(\d{1,2})\./);
    if (m) out.push({ date: mdToDate(year, m[1], m[2]), line: line.replace(/^[\s∙•·-]+/, '').trim() });
  }
  return out;
}

/** (가) 학사일정 xlsx → 학사력(학년도 전체 날짜)·행사. 학년은 인자. */
export function readScheduleP04(sheets: Sheet[], year: number, grade: number): ScheduleResult {
  const warnings: string[] = [];
  const main = find(sheets, '수업시수 변동');
  if (!main) throw new Error("학사일정 시트('학년별 수업시수 변동')를 찾지 못했습니다.");
  const rows = main.rows;
  const gradeRow = rows.findIndex((r) => r.includes(`${grade}학년`));
  if (gradeRow < 0) throw new Error(`학사일정 시트에서 ${grade}학년 열을 찾지 못했습니다.`);
  const col0 = rows[gradeRow].indexOf(`${grade}학년`); // 월요일 열(이 학년 6칸의 처음)
  const noteCol = rows[0].findIndex((c) => c.includes('수업시수 변동일'));
  const { s1, s2, num } = findTotals(rows);

  // 휴일 이름: '1학기'·'2학기' 시트의 공휴일 및 학교 행사 칸
  const holidayNames = new Map<DateStr, string>();
  for (const name of ['1학기', '2학기']) {
    const sh = find(sheets, name);
    const head = sh?.rows.find((r) => r.some((c) => c.startsWith('공휴일 및 학교 행사')));
    const at = head?.findIndex((c) => c.startsWith('공휴일 및 학교 행사')) ?? -1;
    if (!sh || at < 0) continue;
    for (const r of sh.rows) {
      for (const { date, line } of textByDate(year, r[at] ?? '')) {
        if (!holidayNames.has(date)) holidayNames.set(date, line.replace(/^\d{1,2}\.\s*\d{1,2}\.\s*(\([^)]*\))?\s*[-,]?\s*/, ''));
      }
    }
  }

  const byDate = new Map<DateStr, CalendarDay>();
  let month = 0;
  let semester: Semester = 1;
  let sum1 = 0;
  let sum2 = 0;
  for (let i = gradeRow + 2; i < rows.length; i++) {
    const r = rows[i];
    const label = `${r[0] ?? ''}${r[1] ?? ''}`;
    if (label.includes('합계')) {
      if (label.includes('1학기')) semester = 2;
      else break; // 2학기 합계·총합계에서 끝
      continue;
    }
    if (!/^\d+$/.test(r[1] ?? '')) continue; // 주 번호가 있는 줄만
    if (/^\d+$/.test(r[0] ?? '')) month = Number(r[0]); // 달이 바뀌는 줄에만 적힌다. 그 줄의 끝쪽 달
    if (!month) continue;
    // 날짜 칸(C~G): 숫자 = 수업 후보, 원문자 = 휴일, 빈칸 = 방학
    const cells = Array.from({ length: DAY_COLS }, (_, k) => {
      const t = (r[2 + k] ?? '').trim();
      const circled = [...t].length === 1 ? circledNumber(t) : 0;
      return { day: circled || Number(t) || 0, holiday: circled > 0 };
    });
    // 뒤에서부터 보며 날짜가 커지면(작아졌다 돌아오면) 앞쪽은 전달
    let m = month;
    const months: number[] = [];
    let next = 99;
    for (let k = DAY_COLS - 1; k >= 0; k--) {
      if (!cells[k].day) { months[k] = m; continue; }
      if (cells[k].day > next) m = m === 1 ? 12 : m - 1;
      months[k] = m;
      next = cells[k].day;
    }
    for (let k = 0; k < DAY_COLS; k++) {
      if (!cells[k].day) continue;
      const date = dateOf(year, months[k], cells[k].day);
      const periods = Number(r[col0 + k] ?? '') || 0;
      const day: CalendarDay = {
        date, weekday: weekday(date), semester, periods, notes: [],
        schoolDay: !cells[k].holiday && periods > 0,
      };
      if (cells[k].holiday) day.holiday = holidayNames.get(date) ?? '휴일';
      else if (periods === 0) warnings.push(`${date}: 수업일인데 교시가 0입니다.`);
      byDate.set(date, day);
      if (day.schoolDay) (semester === 1 ? (sum1 += periods) : (sum2 += periods));
    }
    // 교시 변동 메모(예: 4.23.~4.24. 수학여행(6학년)-7교시)는 그 주 날짜의 notes로
    if (noteCol >= 0 && r[noteCol]) {
      const week = cells.map((_, k) => (cells[k].day ? dateOf(year, months[k], cells[k].day) : '')).filter(Boolean);
      for (const line of r[noteCol].split('\n')) {
        for (const m2 of line.matchAll(/(\d{1,2})\.\s*(\d{1,2})\./g)) {
          const d = mdToDate(year, m2[1], m2[2]);
          if (week.includes(d)) byDate.get(d)?.notes.push(line.trim());
        }
      }
    }
  }

  const calendar = fillYear(year, byDate);
  const totals: Record<Semester, number | undefined> = {
    1: num(s1, col0 + DAY_COLS), 2: num(s2, col0 + DAY_COLS),
  };
  if (totals[1] !== undefined && totals[1] !== sum1) warnings.push(`1학기 교시 합 ${sum1} ≠ 시트 합계 ${totals[1]}`);
  if (totals[2] !== undefined && totals[2] !== sum2) warnings.push(`2학기 교시 합 ${sum2} ≠ 시트 합계 ${totals[2]}`);
  return { calendar, events: readEvents(sheets, grade, warnings), warnings, sheetTotals: totals };
}

/** 학년도 전체 날짜(3.1~다음 해 2월 말). 시트에 없는 날은 수업 없음. 학기는 시트가 정한 것, 없으면 날짜 범위로. */
function fillYear(year: number, known: Map<DateStr, CalendarDay>): CalendarDay[] {
  const end = lastDayOfFebruary(year + 1);
  const out: CalendarDay[] = [];
  const sem2 = Array.from(known.values()).find((d) => d.semester === 2)?.date ?? `${year}-09-01`;
  for (let d: DateStr = `${year}-03-01`; d <= end; d = addDays(d, 1)) {
    out.push(known.get(d) ?? {
      date: d, weekday: weekday(d) as Weekday, semester: d < sem2 ? 1 : 2, schoolDay: false, periods: 0, notes: [],
    });
  }
  return out;
}

/** '2026행사목록': 대상에 해당 학년·전학년이 든 행. '예시'·'취소' 행은 뺀다. */
export function readEvents(sheets: Sheet[], grade: number, warnings: string[]): SchoolEvent[] {
  const sh = find(sheets, '행사목록');
  if (!sh) return [];
  const events: SchoolEvent[] = [];
  for (const r of sh.rows.slice(1)) {
    const [no, when, target = '', what = ''] = r;
    if (!no || no === '예시' || what.includes('취소')) continue;
    if (!target.includes(`${grade}학년`) && !target.includes('전학년')) continue;
    const s = when.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
    if (!s) { warnings.push(`행사 ${no}: 날짜를 읽지 못했습니다('${when}').`); continue; }
    const start = `${s[1]}-${s[2].padStart(2, '0')}-${s[3].padStart(2, '0')}`;
    const tail = when.slice(when.indexOf('~') + 1);
    const e = when.includes('~') ? tail.match(/^\s*(?:(\d{1,2})\.\s*)?(\d{1,2})/) : null;
    // 끝 달이 시작 달보다 작으면 해를 넘긴 행사(12.30~1.2)
    const endMonth = e ? Number(e[1] ?? s[2]) : 0;
    const endYear = endMonth && endMonth < Number(s[2]) ? Number(s[1]) + 1 : s[1];
    const end = e ? `${endYear}-${String(endMonth).padStart(2, '0')}-${e[2].padStart(2, '0')}` : start;
    events.push({ id: `event-${no}`, name: what.trim(), start, end, showInPlanNote: false, source: 'import' });
  }
  return events;
}
