import { TimetableMaker } from '../../components/TimetableMaker';
import { TimetableGrid } from '../../components/TimetableGrid';
import { schoolDaysByMonth } from '../../engine/calendar';
import { weekMonday } from '../../lib/dates';
import type { CalendarDay } from '../../model/types';
import { useProject } from '../../state/ProjectContext';

/** S3 학사력·기초 시간표: 달력(교시 수 고치기)과 시간표(교과 바꾸기·전담 켜고 끄기) */
export function Calendar() {
  const { project, update } = useProject();
  if (!project) return null;
  const p = project;
  if (p.calendar.length === 0) return <p className="empty">아직 학사력이 없습니다. S2 [파일 넣기]에서 학사일정 xlsx를 넣으세요.</p>;

  const setPeriods = (date: string, periods: number) =>
    update((q) => ({ ...q, calendar: q.calendar.map((d) => (d.date === date ? { ...d, periods, schoolDay: periods > 0 && !d.holiday } : d)) }));

  const months = [...new Set(p.calendar.map((d) => d.date.slice(0, 7)))];
  const sem = (n: 1 | 2) => p.calendar.filter((d) => d.semester === n && d.schoolDay);
  const cell = (d: CalendarDay | undefined) => {
    if (!d) return <td />;
    return (
      <td key={d.date} className={d.schoolDay ? undefined : 'is-off'} title={d.notes.join('\n')}>
        <small>{Number(d.date.slice(8))}</small>{' '}
        {d.holiday ? <small className="muted">{d.holiday}</small> : (
          <input type="number" min={0} max={9} value={d.periods} style={{ width: 40 }} onChange={(e) => setPeriods(d.date, Math.max(0, Number(e.target.value) || 0))} />
        )}
        {d.notes.length > 0 && ' ✎'}
      </td>
    );
  };

  return (
    <section>
      <h2>학사력·시간표</h2>
      <p>
        {[1, 2].map((n) => `${n}학기 수업일 ${sem(n as 1 | 2).length}일 · 교시 ${sem(n as 1 | 2).reduce((a, d) => a + d.periods, 0)}`).join(' / ')}
      </p>
      <p className="muted">달별 수업일: {[1, 2].map((n) => JSON.stringify(schoolDaysByMonth(p.calendar, n as 1 | 2))).join(' ')}</p>
      {months.map((m) => {
        const days = p.calendar.filter((d) => d.date.startsWith(m) && d.weekday <= 5);
        const mondays = [...new Set(days.map((d) => weekMonday(d.date)))];
        return (
          <details key={m} open={m === months[0]}>
            <summary>{Number(m.slice(5))}월</summary>
            <table className="dev-table">
              <thead><tr>{['월', '화', '수', '목', '금'].map((d) => <th key={d}>{d}</th>)}</tr></thead>
              <tbody>
                {mondays.map((mon) => (
                  <tr key={mon}>{[1, 2, 3, 4, 5].map((w) => cell(days.find((d) => weekMonday(d.date) === mon && d.weekday === w)))}</tr>
                ))}
              </tbody>
            </table>
          </details>
        );
      })}
      {p.events.length > 0 && (
        <details className="file-card">
          <summary>학년 행사 {p.events.length}개 — 시간 운영계획 비고에 넣을 행사 고르기({p.events.filter((e) => e.showInPlanNote).length}개 고름)</summary>
          <ul className="plain">
            {p.events.map((e) => (
              <li key={e.id}>
                <label>
                  <input type="checkbox" checked={e.showInPlanNote} onChange={(x) => update((q) => ({ ...q, events: q.events.map((y) => (y.id === e.id ? { ...y, showInPlanNote: x.target.checked } : y)) }))} />{' '}
                  {e.start}{e.end !== e.start ? `~${e.end}` : ''} {e.name}
                </label>
              </li>
            ))}
          </ul>
        </details>
      )}
      <h3>기초 시간표</h3>
      <TimetableMaker project={p} update={update} />
      <TimetableGrid project={p} onChange={(cells) => update((q) => ({ ...q, baseTimetable: cells }))} />
    </section>
  );
}
