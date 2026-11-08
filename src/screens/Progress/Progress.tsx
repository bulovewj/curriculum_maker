import { useMemo, useState } from 'react';
import { computeGrid } from '../../engine/grid';
import { needOf, placeAll } from '../../engine/placeLessons';
import { useProject } from '../../state/ProjectContext';

/** S6 진도(읽기 전용): 교과 탭, 배치된 주·기간, 칸·행·필요량 */
export function Progress() {
  const { project: p } = useProject();
  const [tab, setTab] = useState('kor');
  const calc = useMemo(() => {
    if (!p) return null;
    const grid = computeGrid(p);
    const period = new Map(grid.rows.map((r) => [`${r.semester}#${r.week}`, r.period]));
    return { period, placed: placeAll(grid.slots, p.lessonPlans, p.subjects) };
  }, [p]);
  if (!p || !calc) return null;

  const subject = p.subjects.find((s) => s.id === tab) ?? p.subjects[0];
  const res = calc.placed[subject.id];
  const rows = p.lessonPlans[subject.id] ?? [];
  const at = new Map(res.placed.map((x) => [x.row, x.slot]));
  const need = needOf(res);
  const slotCount = res.placed.length + res.freeSlots.length;

  return (
    <section>
      <h2>진도</h2>
      <div className="row">
        {p.subjects.map((s) => {
          const n = needOf(calc.placed[s.id]);
          const has = (p.lessonPlans[s.id] ?? []).length > 0;
          return (
            <button key={s.id} className={s.id === subject.id ? 'step on' : 'step'} onClick={() => setTab(s.id)}>
              {s.name} {has ? (n === 0 ? '✓' : n > 0 ? `감${n}` : `증${-n}`) : '–'}
            </button>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <p className="muted">진도 파일 없음, 칸 {slotCount}개 빈칸</p>
      ) : (
        <>
          <p>
            칸 {slotCount} · 행 {res.placed.length + res.surplusRows.length} ·{' '}
            <b style={{ color: need === 0 ? 'green' : '#b60' }}>{need === 0 ? '필요량 0' : need > 0 ? `감축 필요 ${need}` : `증배 필요 ${-need}`}</b>
          </p>
          <table className="dev-table">
            <thead><tr><th>주</th><th>기간</th><th>단원명</th><th>학습 주제</th><th>차시</th><th>쪽수</th><th>비고</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const s = at.get(r);
                return (
                  <tr key={r.id} style={r.kind === 'memo' || !s ? { background: '#fff3b0' } : undefined}>
                    <td>{s ? s.week : '—'}</td>
                    <td>{s ? calc.period.get(`${s.semester}#${s.week}`) : r.kind === 'memo' ? '메모' : '칸 없음'}</td>
                    <td>{r.unit}</td><td>{r.topic}</td><td>{r.n ? `${r.n}/${r.total ?? ''}` : ''}</td><td>{r.pages ?? ''}</td><td>{r.rawNote ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
