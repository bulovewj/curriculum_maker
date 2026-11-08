import { useMemo } from 'react';
import { runChecks } from '../../engine/checks';
import { computeGrid } from '../../engine/grid';
import { effectiveSchool } from '../../engine/plan';
import { semesterTotals } from '../../engine/weekGrid';
import { standardsOf } from '../../lib/standards';
import type { Level } from '../../model/standards';
import { ExportButtons } from '../../components/ExportButtons';
import { useProject } from '../../state/ProjectContext';

// 규칙 → 고칠 화면(왼쪽 단계 번호 0부터: S3=2, S4=3, S5=4, S6=5)
const GO: Record<string, number> = { R1: 2, R2: 3, R3: 3, R4: 3, R5: 5, R6: 3, R7: 3, R8: 5, R9: 4, R10: 5, R11: 5 };
const MARK: Record<Level, string> = { fail: '🔴', warn: '🟡', pass: '🟢' };

/** S7 위쪽: 규정 검사 결과와 점검표 미리 보기 */
export function Review({ onGo }: { onGo: (step: number) => void }) {
  const { project: p } = useProject();
  const calc = useMemo(() => {
    if (!p) return null;
    const grid = computeGrid(p);
    return { results: runChecks(p, standardsOf(p.standardsVersion)), grid, school: effectiveSchool(p, grid.slots) };
  }, [p]);
  if (!p || !calc) return null;
  const { results, grid, school } = calc;
  const count = (l: Level) => results.filter((r) => r.level === l).length;
  const order: Level[] = ['fail', 'warn', 'pass'];
  const sorted = [...results].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  const t1 = semesterTotals(grid.rows, 1);
  const t2 = semesterTotals(grid.rows, 2);

  return (
    <section>
      <h2>점검·출력</h2>
      <p>{MARK.fail} 빨강 {count('fail')} · {MARK.warn} 노랑 {count('warn')} · {MARK.pass} 통과 {count('pass')} (기준 데이터 {p.standardsVersion})</p>
      <ExportButtons project={p} fails={count('fail')} />
      <ul className="cards-list">
        {sorted.map((r, i) => (
          <li key={i} className="file-card">
            {MARK[r.level]} <b>{r.ruleId}</b> {r.message}{' '}
            <button className="link" onClick={() => onGo(GO[r.ruleId] ?? 6)}>해당 화면으로</button>
            <div className="muted">근거: {r.source}</div>
          </li>
        ))}
      </ul>
      <h3>점검표 미리 보기 — 교과별 시수</h3>
      <table className="dev-table">
        <thead><tr><th>교과·영역</th><th>1학기</th><th>2학기</th><th>연간</th><th>편제</th><th>차이</th></tr></thead>
        <tbody>
          {p.subjects.map((s) => {
            const a = t1[s.id] ?? 0;
            const b = t2[s.id] ?? 0;
            const plan = (school[s.id]?.s1 ?? 0) + (school[s.id]?.s2 ?? 0);
            return <tr key={s.id}><td>{s.name}</td><td>{a}</td><td>{b}</td><td>{a + b}</td><td>{plan}</td><td className={a + b === plan ? undefined : 'is-bad'}>{a + b - plan}</td></tr>;
          })}
        </tbody>
      </table>
    </section>
  );
}
