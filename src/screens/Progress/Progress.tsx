import { useMemo, useState, type ReactNode } from 'react';
import { computeGrid } from '../../engine/grid';
import { needOf, placeAll } from '../../engine/placeLessons';
import { AdjustmentList } from '../../components/AdjustmentList';
import { applyPicked, type Picked } from '../../ai/applyCandidates';
import { AiPanel } from '../../components/AiPanel';
import { AiTextPanel } from '../../components/AiTextPanel';
import { PlanGapNotice } from '../../components/PlanGapNotice';
import { ModelSwitch } from '../../components/ModelSwitch';
import { RowManager } from '../../components/RowManager';
import { RowMenu } from '../../components/RowMenu';
import { mergeRows, removeRow, setFixedWeek, splitRow, swapRows, undoAdjustment, type OpState } from '../../engine/planOps';
import type { Semester } from '../../model/types';
import { useProject } from '../../state/ProjectContext';

/** AI 창 묶음: 위에 그대로 두고, 길어지면 안에서만 스크롤. 접어 둘 수 있다. */
function AiBox({ children }: { children: ReactNode }) {
  return <details open className="ai-box"><summary>AI 도우미 <ModelSwitch /></summary><div className="ai-box-body">{children}</div></details>;
}

/** S6 진도(읽기 전용): 교과 탭, 배치된 주·기간, 칸·행·필요량 */
export function Progress() {
  const { project: p, update } = useProject();
  const [tab, setTab] = useState('kor');
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null); // 행을 누르면 뜨는 메뉴 자리
  const [manager, setManager] = useState<{ after: string | null } | null>(null); // 행 관리 창
  const [view, setView] = useState<'all' | 1 | 2>('all'); // 표에 보일 학기
  const calc = useMemo(() => {
    if (!p) return null;
    const grid = computeGrid(p);
    const period = new Map(grid.rows.map((r) => [`${r.semester}#${r.week}`, r.period]));
    return { period, slots: grid.slots, placed: placeAll(grid.slots, p.lessonPlans, p.subjects) };
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
      const next = f({ lessonPlans: p.lessonPlans, adjustments: p.adjustments }); // 오류는 여기서 잡는다(저장 갱신 함수 안에서 던지면 화면이 꺼진다)
      update((q) => ({ ...q, ...next }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : '작업을 하지 못했습니다.');
    }
  };
  // 교과·학기별 필요량(+ 감축, − 증배): AI 패널이 쓴다
  const needs = Object.fromEntries(p.subjects.map((s) => [s.id, Object.fromEntries([1, 2].map((n) => [n, calc.placed[s.id].surplusRows.filter((x) => x.semester === n).length - calc.placed[s.id].freeSlots.filter((x) => x.semester === n).length]))]));
  const applyMany = (picks: Picked[]) => {
    const r = applyPicked({ lessonPlans: p.lessonPlans, adjustments: p.adjustments }, picks);
    update((q) => ({ ...q, ...r.state }));
    return { applied: r.applied, skipped: r.skipped };
  };
  const row = rows.find((r) => r.id === sel);
  const slotKey = (r: (typeof rows)[number]) => { const s = at.get(r); return s ? `${s.date}#${s.period}` : '~'; };
  const ordered = [...rows].sort((a, b) => (slotKey(a) < slotKey(b) ? -1 : slotKey(a) > slotKey(b) ? 1 : 0)); // 칸 순서(주 고정 행도 제 주에)
  const semOf = (r: (typeof rows)[number]) => at.get(r)?.semester ?? r.semester;
  const shown = view === 'all' ? ordered : ordered.filter((r) => semOf(r) === view);
  const slotCount = res.placed.length + res.freeSlots.length;

  return (
    <section>
      <h2>진도</h2>
      <PlanGapNotice project={p} slots={calc.slots} update={update} />
      <div className="row tabs">
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
        <p className="empty">이 교과는 아직 진도가 없습니다(칸 {slotCount}개가 비어 있음). S2 [파일 넣기]에서 진도 파일을 넣으세요.</p>
      ) : (
        <>
          <p>
            칸 {slotCount} · 행 {res.placed.length + res.surplusRows.length} ·{' '}
            <b className={need === 0 ? 'ok' : 'need'}>{need === 0 ? '필요량 0' : need > 0 ? `감축 필요 ${need}` : `증배 필요 ${-need}`}</b>
          </p>
          {err && <p className="error">{err}</p>}
          {p.settings.aiEnabled && <AiBox>
            <AiPanel key={subject.id} project={p} subject={subject} needs={needs} onApply={applyMany} />
            <AiTextPanel key={subject.id} project={p} subject={subject} update={update} />
          </AiBox>}
          <div className="row">
            <button onClick={() => setManager({ after: sel })}>행 관리(추가·삭제·글 쓰기)</button>
            보기:{' '}
            {([['all', '전체'], [1, '1학기'], [2, '2학기']] as const).map(([v, label]) => (
              <button key={v} className={v === view ? 'step on' : 'step'} onClick={() => setView(v)}>
                {label} {(v === 'all' ? ordered : ordered.filter((r) => semOf(r) === v)).length}행
              </button>
            ))}
          </div>
          <div className="table-wrap">
          <table className="dev-table">
            <thead><tr><th>주</th><th>기간</th><th>단원명</th><th>학습 주제</th><th>차시</th><th>쪽수</th><th>비고</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const s = at.get(r);
                return (
                  <tr key={r.id} className={`clickable ${r.id === sel ? 'is-selected' : r.kind === 'memo' || !s ? 'is-warn' : ''}`} onClick={(e) => { setSel(r.id); setMenu({ x: e.clientX, y: e.clientY }); }}>
                    <td>{s ? s.week : '—'}</td>
                    <td>{s ? calc.period.get(`${s.semester}#${s.week}`) : r.kind === 'memo' ? '메모' : '칸 없음'}</td>
                    <td>{r.unit}</td><td className={r.aiDraft ? 'is-warn' : undefined}>{r.topic}</td><td>{r.n ? `${r.n}/${r.total ?? ''}` : ''}</td><td>{r.pages ?? ''}</td><td>{r.rawNote ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <AdjustmentList subjectId={subject.id} adjustments={p.adjustments} onUndo={(id) => run((s) => undoAdjustment(s, id))}
            onEdit={(id, change) => update((q) => ({ ...q, adjustments: q.adjustments.map((a) => (a.id === id ? { ...a, ...change } : a)) }))} />
        </>
      )}
      {menu && row && (
        <RowMenu x={menu.x} y={menu.y} row={row} onClose={() => setMenu(null)} onAction={(a) => {
          const i = shown.findIndex((r) => r.id === row.id);
          const slot = at.get(row);
          if (a === 'merge') run((s) => mergeRows(s, subject.id, row.id));
          else if (a === 'remove') run((s) => removeRow(s, subject.id, row.id));
          else if (a === 'split') run((s) => splitRow(s, subject.id, row.id));
          else if (a === 'up' || a === 'down') { const mate = shown[i + (a === 'up' ? -1 : 1)]; if (mate) run((s) => swapRows(s, subject.id, row.id, mate.id)); }
          else if (a === 'fix') run((s) => setFixedWeek(s, subject.id, row.id, row.fixedWeek ? null : slot ? { semester: slot.semester as Semester, week: slot.week } : null));
          else setManager({ after: a === 'add' ? row.id : null });
        }} />
      )}
      <RowManager open={manager !== null} subjectId={subject.id} rows={shown} afterId={manager?.after ?? null} onOp={run} onClose={() => setManager(null)} />
    </section>
  );
}
