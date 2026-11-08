import { useState } from 'react';
import { schoolDaysByMonth, semesterWeeks } from '../engine/calendar';
import { readScheduleP04, type ScheduleResult } from '../import/mappers/scheduleP04';
import { readSpecialistCells } from '../import/mappers/specialistP02';
import { readClassTimetable, readSpecialistHours } from '../import/mappers/timetableP02';
import { readWorkbook, type Sheet } from '../import/xlsx/readWorkbook';
import { defaultSubjects } from '../model/subjects';
import type { SchoolWeekday, TimetableCell } from '../model/types';

const read = async (f: File): Promise<Sheet[]> => readWorkbook(await f.arrayBuffer());
const nameOf = (id: string) => defaultSubjects.find((s) => s.id === id)?.name ?? id;

/** ?dev 전용: 학사일정(P04)·전담/학급 시간표(P02)를 넣어 달력 합계와 시간표를 본다. */
export function ScheduleView() {
  const [year, setYear] = useState(2026);
  const [grade, setGrade] = useState(6);
  const [classNo, setClassNo] = useState(7);
  const [sched, setSched] = useState<ScheduleResult | null>(null);
  const [table, setTable] = useState<{ cells: TimetableCell[]; text: string[] } | null>(null);
  const [error, setError] = useState('');

  const run = (f: () => Promise<void>) => f().catch((e) => setError(e instanceof Error ? e.message : String(e)));

  async function onP04(file: File | undefined) {
    if (file) await run(async () => { setError(''); setSched(readScheduleP04(await read(file), year, grade)); });
  }
  async function onP02(file: File | undefined) {
    if (!file) return;
    await run(async () => {
      setError('');
      const sheets = await read(file);
      const sp = readSpecialistCells(sheets, grade, classNo, defaultSubjects);
      const tt = readClassTimetable(sheets, grade, classNo, defaultSubjects, sp.cells);
      const { hours } = readSpecialistHours(sheets, grade, defaultSubjects);
      const count = (id: string) => tt.cells.filter((c) => c.subjectId === id).length;
      setTable({
        cells: tt.cells,
        text: [
          ...Object.entries(hours).map(([id, h]) => `${nameOf(id)} 전담 ${h}시간 / 시간표 ${count(id)}칸 / 전담 칸 ${sp.cells.filter((x) => x.subjectId === id).length}칸`),
          ...sp.warnings, ...tt.warnings,
        ],
      });
    });
  }

  const cal = sched?.calendar ?? [];
  const sem = (n: 1 | 2) => cal.filter((d) => d.semester === n && d.schoolDay);
  const periods = Math.max(0, ...(table?.cells.map((c) => c.period) ?? [0]));

  return (
    <section>
      <h2>학사일정·시간표 보기</h2>
      <div className="form">
        <label>학년도<input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label>학년<input type="number" value={grade} onChange={(e) => setGrade(Number(e.target.value))} /></label>
        <label>반<input type="number" value={classNo} onChange={(e) => setClassNo(Number(e.target.value))} /></label>
        <label>학사일정 xlsx(P04)<input type="file" accept=".xlsx" data-kind="p04" onChange={(e) => onP04(e.target.files?.[0])} /></label>
        <label>전담·학급 시간표 xlsx(P02)<input type="file" accept=".xlsx" data-kind="p02" onChange={(e) => onP02(e.target.files?.[0])} /></label>
      </div>
      {error && <p className="error">{error}</p>}
      {sched && (
        <>
          <p>
            1학기 수업일 {sem(1).length}·교시 {sem(1).reduce((a, d) => a + d.periods, 0)} / 2학기 수업일 {sem(2).length}·교시{' '}
            {sem(2).reduce((a, d) => a + d.periods, 0)} / 주 {semesterWeeks(cal, 1, `${year}-03-01`).length}+{semesterWeeks(cal, 2, `${year}-09-01`).length}
          </p>
          <p>달별 수업일: {JSON.stringify(schoolDaysByMonth(cal, 1))} {JSON.stringify(schoolDaysByMonth(cal, 2))} · 행사 {sched.events.length}개</p>
          {sched.warnings.map((w) => <p key={w} className="error">{w}</p>)}
        </>
      )}
      {table && (
        <>
          {table.text.map((t) => <p key={t}>{t}</p>)}
          <table className="dev-table">
            <thead><tr><th>교시</th>{['월', '화', '수', '목', '금'].map((d) => <th key={d}>{d}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: periods }, (_, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  {([1, 2, 3, 4, 5] as SchoolWeekday[]).map((w) => {
                    const c = table.cells.find((x) => x.weekday === w && x.period === i + 1);
                    return <td key={w} style={c?.specialist ? { background: '#ffe9a8' } : undefined}>{c ? nameOf(c.subjectId) : ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
