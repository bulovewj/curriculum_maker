import { useMemo, useState } from 'react';
import { computeGrid } from '../../engine/grid';
import { needOf, placeAll } from '../../engine/placeLessons';
import { AdjustmentList } from '../../components/AdjustmentList';
import { PlanOpsBar } from '../../components/PlanOpsBar';
import { undoAdjustment, type OpState } from '../../engine/planOps';
import type { Semester } from '../../model/types';
import { useProject } from '../../state/ProjectContext';

/** S6 진도(읽기 전용): 교과 탭, 배치된 주·기간, 칸·행·필요량 */
export function Progress() {
  const { project: p, update } = useProject();
  const [tab, setTab] = useState('kor');
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState('');
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
  const run = (f: (s: OpState) => OpState) => {
    try {
      setErr('');
      update((q) => ({ ...q, ...f({ lessonPlans: q.lessonPlans, adjustments: q.adjustments }) }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : '작업을 하지 못했습니다.');
    }
  };
  const row = rows.find((r) => r.id === sel);
  const slotKey = (r: (typeof rows)[number]) => { const s = at.get(r); return s ? `${s.date}#${s.period}` : '~'; };
  const ordered = [...rows].sort((a, b) => (slotKey(a) < slotKey(b) ? -1 : slotKey(a) > slotKey(b) ? 1 : 0)); // 칸 순서(주 고정 행도 제 주에)
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
          {err && <p className="error">{err}</p>}
          <PlanOpsBar subjectId={subject.id} row={row} semester={(row?.semester ?? 1) as Semester} onOp={run} />
          <table className="dev-table">
            <thead><tr><th>주</th><th>기간</th><th>단원명</th><th>학습 주제</th><th>차시</th><th>쪽수</th><th>비고</th></tr></thead>
            <tbody>
              {ordered.map((r) => {
                const s = at.get(r);
                return (
                  <tr key={r.id} onClick={() => setSel(r.id)} style={r.id === sel ? { background: '#cfe3ff' } : r.kind === 'memo' || !s ? { background: '#fff3b0' } : undefined}>
                    <td>{s ? s.week : '—'}</td>
                    <td>{s ? calc.period.get(`${s.semester}#${s.week}`) : r.kind === 'memo' ? '메모' : '칸 없음'}</td>
                    <td>{r.unit}</td><td>{r.topic}</td><td>{r.n ? `${r.n}/${r.total ?? ''}` : ''}</td><td>{r.pages ?? ''}</td><td>{r.rawNote ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <AdjustmentList subjectId={subject.id} adjustments={p.adjustments} onUndo={(id) => run((s) => undoAdjustment(s, id))}
            onEdit={(id, change) => update((q) => ({ ...q, adjustments: q.adjustments.map((a) => (a.id === id ? { ...a, ...change } : a)) }))} />
        </>
      )}
    </section>
  );
}
