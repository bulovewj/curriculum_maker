import type { SchoolWeekday, SpecialistCell, Subject } from '../../model/types';
import type { Sheet } from '../xlsx/readWorkbook';

export interface SpecialistResult {
  cells: SpecialistCell[];
  warnings: string[];
}

const DAYS = ['월', '화', '수', '목', '금'];

/** 글 안에서 가장 먼저 나오는 교과 이름 → 교과 id (교사 이름 등 나머지 글자는 쓰지 않는다) */
function subjectIn(subjects: Subject[], text: string): Subject | undefined {
  const hits = subjects
    .filter((s) => s.kind === 'subject' && text.includes(s.name))
    .map((s) => ({ s, at: text.indexOf(s.name) }));
  return hits.sort((a, b) => a.at - b.at)[0]?.s;
}

/** 교시 칸 글자 → 교시. '4\n1부 점심' → 4, '(4/5)\n2부 점심' → 5(점심 사이 칸은 뒤 교시. 반별 시간표와 맞는 것을 확인함), 아니면 NaN */
export function periodOf(label: string): number {
  const first = label.split('\n')[0].trim();
  const between = first.match(/^\((\d+)\/(\d+)\)$/);
  return between ? Number(between[2]) : Number(first);
}

/** 엑셀이 날짜로 바꿔 저장한 학급 코드('6-7' → 2026-06-07)를 '6-7'로 되돌린다. 코드가 아니면 undefined. */
export function classCode(text: string): string | undefined {
  const d = text.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (d) return `${Number(d[1])}-${Number(d[2])}`;
  return /^\d{1,2}-\d{1,2}$/.test(text) ? text : undefined;
}

/**
 * (나) 전담시간표 시트 → 대표 학급의 전담 칸.
 * 블록: `요일/교시 | 월 화 수 목 금` 머리 줄. 교과는 머리 줄 2줄 위 글의 교과 낱말만 읽는다.
 */
export function readSpecialistCells(sheets: Sheet[], grade: number, classNo: number, subjects: Subject[]): SpecialistResult {
  const sheet = sheets.find((s) => s.name.startsWith('전담시간표'));
  if (!sheet) throw new Error("전담시간표 시트('전담시간표…')를 찾지 못했습니다.");
  const { rows } = sheet;
  const target = `${grade}-${classNo}`;
  const cells: SpecialistCell[] = [];
  const warnings: string[] = [];

  rows.forEach((row, h) => {
    row.forEach((text, c) => {
      if (!text.includes('요일') || DAYS.some((d, k) => (row[c + 1 + k] ?? '') !== d)) return;
      const head = rows[h - 2]?.[c] ?? rows[h - 3]?.[c] ?? '';
      const subject = subjectIn(subjects, head);
      let lost = false; // 교과를 몰라 버린 대표 학급 칸이 있는지
      // 다음 머리 줄 앞까지, 교시 번호가 있는 줄만. 글자 칸(놀이영어 등)은 코드 모양이 아니라 걸러진다.
      for (let r = h + 1; r < rows.length && !(rows[r][c] ?? '').includes('요일'); r++) {
        const period = periodOf(rows[r][c] ?? '');
        if (!Number.isInteger(period) || period < 1) continue;
        DAYS.forEach((_, k) => {
          if (classCode(rows[r][c + 1 + k] ?? '') !== target) return;
          if (subject) cells.push({ weekday: (k + 1) as SchoolWeekday, period, subjectId: subject.id });
          else lost = true;
        });
        if (r - h > 20) { warnings.push(`전담시간표 ${h + 1}행 블록이 20줄을 넘어 뒤를 읽지 않았습니다.`); break; }
      }
      if (lost) warnings.push(`전담시간표 ${h + 1}행 블록: 교과를 알 수 없어 대표 학급 칸을 건너뜀`);
    });
  });

  // 같은 칸에 같은 교과가 두 블록에 있으면(원어민 영어는 '영어시간에 포함') 하나로. 교과가 다르면 경고.
  const bySlot = new Map<string, SpecialistCell>();
  for (const x of cells) {
    const key = `${x.weekday}#${x.period}`;
    const old = bySlot.get(key);
    if (old && old.subjectId !== x.subjectId) warnings.push(`전담 칸이 겹침: ${x.weekday}요일 ${x.period}교시 (${old.subjectId}·${x.subjectId})`);
    else bySlot.set(key, x);
  }
  const out = [...bySlot.values()].sort((a, b) => a.weekday - b.weekday || a.period - b.period);
  return { cells: out, warnings };
}
