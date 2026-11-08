import { useMemo } from 'react';
import { schoolDaysByMonth } from '../../engine/calendar';
import { computeGrid } from '../../engine/grid';
import { semesterTotals } from '../../engine/weekGrid';
import { useProject } from '../../state/ProjectContext';

/** S5 주별 시수표(읽기 전용): 시간 운영계획(c)과 같은 열 순서 + 학기 계·편제·차이 */
export function WeekGrid() {
  const { project: p } = useProject();
  const grid = useMemo(() => (p ? computeGrid(p) : null), [p]);
  if (!p || !grid) return null;
  if (grid.rows.length === 0) return <p className="muted">S3을 먼저 채우세요(학사력과 기초 시간표).</p>;

  const subj = p.subjects.filter((s) => s.kind !== 'creative');
  const crea = p.subjects.filter((s) => s.kind === 'creative');
  const sum = (h: Record<string, number>, list: typeof subj) => list.reduce((a, s) => a + (h[s.id] ?? 0), 0);
  const total = [1, 2].map((n) => semesterTotals(grid.rows, n as 1 | 2));
  const year = Object.fromEntries(p.subjects.map((s) => [s.id, (total[0][s.id] ?? 0) + (total[1][s.id] ?? 0)]));
  const plan = p.curriculumPlan.schoolAnnual;
  const hasPlan = Object.keys(plan).length > 0;
  const heads = [...subj, ...crea];
  const cols = (h: Record<string, number>, bold = false) => (
    <>
      {subj.map((s) => <td key={s.id}>{bold ? <b>{h[s.id] ?? 0}</b> : h[s.id] ?? 0}</td>)}
      <td>{sum(h, subj)}</td>
      {crea.map((s) => <td key={s.id}>{h[s.id] ?? 0}</td>)}
      <td>{sum(h, crea)}</td>
      <td>{sum(h, subj) + sum(h, crea)}</td>
    </>
  );

  return (
    <section>
      <h2>주별 시수표</h2>
      <table className="dev-table">
        <thead>
          <tr>
            <th>월[수업일]</th><th>주</th><th>기간</th><th>수업일</th>{['월', '화', '수', '목', '금', '토'].map((d) => <th key={d}>{d}</th>)}
            {subj.map((s) => <th key={s.id}>{s.name}</th>)}<th>소계</th>{crea.map((s) => <th key={s.id}>{s.name}</th>)}<th>소계</th><th>총계</th><th>비고</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2].flatMap((n) => {
            const rows = grid.rows.filter((r) => r.semester === n);
            const days = schoolDaysByMonth(p.calendar, n as 1 | 2);
            return [
              <tr key={`h${n}`}><th colSpan={heads.length + 14}>{n}학기</th></tr>,
              ...rows.map((r, i) => (
                <tr key={`${n}-${r.week}`}>
                  <td>{i === 0 || rows[i - 1].month !== r.month ? `${r.month}[${days[r.month] ?? 0}]` : ''}</td>
                  <td>{r.week}</td><td>{r.period}</td><td>{r.schoolDays}</td>
                  {r.dayPeriods.map((v, k) => <td key={k}>{v}</td>)}
                  {cols(r.hours)}
                  <td style={{ whiteSpace: 'pre-line' }}>{r.note}</td>
                </tr>
              )),
              <tr key={`t${n}`}><td colSpan={4}><b>{n}학기 계</b></td><td colSpan={6} />{cols(total[n - 1], true)}<td /></tr>,
            ];
          })}
          <tr><td colSpan={4}><b>연간 계</b></td><td colSpan={6} />{cols(year, true)}<td /></tr>
          {hasPlan && <tr><td colSpan={4}>본교 편제 시수</td><td colSpan={6} />{cols(plan)}<td /></tr>}
          {hasPlan && (
            <tr><td colSpan={4}>차이(편제−칸)</td><td colSpan={6} />{cols(Object.fromEntries(heads.map((s) => [s.id, (plan[s.id] ?? 0) - (year[s.id] ?? 0)])))}<td /></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
