import type { Project, SchoolWeekday, TimetableCell } from '../model/types';

const DAYS = ['월', '화', '수', '목', '금'];

interface Props {
  project: Project;
  onChange: (cells: TimetableCell[]) => void;
}

/** 기초 시간표(요일×교시): 칸마다 교과 고르기, 전담 표시 켜고 끄기 */
export function TimetableGrid({ project: p, onChange }: Props) {
  const periods = Math.max(0, ...p.baseTimetable.map((c) => c.period));
  const find = (w: number, k: number) => p.baseTimetable.find((c) => c.weekday === w && c.period === k);
  const put = (w: number, k: number, change: Partial<TimetableCell> | null) => {
    const rest = p.baseTimetable.filter((c) => !(c.weekday === w && c.period === k));
    const old = find(w, k);
    onChange(change === null ? rest : [...rest, { weekday: w as SchoolWeekday, period: k, subjectId: old?.subjectId ?? '', specialist: false, ...old, ...change }].filter((c) => c.subjectId));
  };
  if (periods === 0) return <p className="muted">기초 시간표가 없습니다. S2에서 전담·학급 시간표를 넣으세요.</p>;
  return (
    <table className="dev-table">
      <thead><tr><th>교시</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
      <tbody>
        {Array.from({ length: periods }, (_, i) => i + 1).map((k) => (
          <tr key={k}>
            <td>{k}</td>
            {[1, 2, 3, 4, 5].map((w) => {
              const c = find(w, k);
              return (
                <td key={w} style={c?.specialist ? { background: '#ffe9a8' } : undefined}>
                  <select value={c?.subjectId ?? ''} onChange={(e) => put(w, k, e.target.value ? { subjectId: e.target.value } : null)}>
                    <option value="">(비움)</option>
                    {p.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {c && <label><input type="checkbox" checked={c.specialist} onChange={(e) => put(w, k, { specialist: e.target.checked })} />전담</label>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
