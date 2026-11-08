import { useMemo } from 'react';
import { defaultDonors } from '../../engine/autoBalance';
import { computeGrid } from '../../engine/grid';
import { effectiveSchool, splitSemesters } from '../../engine/plan';
import type { Project, SubjectId } from '../../model/types';
import { useProject } from '../../state/ProjectContext';

/** S4 편제: 교과 × (기준, 본교 학기별·연간, 증감, 작년, 2년 계), 학기 나누기, 가져올 교과 순서 */
export function Plan() {
  const { project: p, update } = useProject();
  const slots = useMemo(() => (p ? computeGrid(p).slots : []), [p]);
  if (!p) return null;
  const annual = p.curriculumPlan.schoolAnnual;
  if (Object.keys(annual).length === 0) return <p className="muted">편제가 없습니다. S2에서 학년군 편제(hwpx) 또는 시수증감 운영계획을 넣으세요.</p>;

  const school = effectiveSchool(p, slots);
  const std = p.curriculumPlan.standard;
  const donors = { ...defaultDonors(p.subjects), ...p.curriculumPlan.donors };
  const name = (id: SubjectId) => p.subjects.find((s) => s.id === id)?.name ?? id;
  const setPlan = (change: (c: Project['curriculumPlan']) => Project['curriculumPlan']) => update((q) => ({ ...q, curriculumPlan: change(q.curriculumPlan) }));
  const setSem = (id: SubjectId, s1: number, s2: number) =>
    setPlan((c) => ({ ...c, school: { ...c.school, [id]: { s1, s2 } }, schoolAnnual: { ...c.schoolAnnual, [id]: s1 + s2 } }));
  const fill = (inFirst: boolean) => {
    const auto = p.subjects.filter((s) => s.kind === 'autonomy').map((s) => s.id);
    setPlan((c) => {
      const sp = splitSemesters(c.schoolAnnual, slots, auto, inFirst);
      return { ...c, school: sp };
    });
  };
  const move = (id: SubjectId, i: number, d: -1 | 1) => {
    const list = [...(donors[id] ?? [])];
    [list[i], list[i + d]] = [list[i + d], list[i]];
    setPlan((c) => ({ ...c, donors: { ...donors, [id]: list } }));
  };

  const ids = p.subjects.map((s) => s.id).filter((id) => annual[id] !== undefined);
  const sum = (f: (id: SubjectId) => number) => ids.reduce((a, id) => a + f(id), 0);
  const prior = p.priorYear?.school ?? {};
  const pct = (a: number, b: number | undefined) => (b ? `${(((a - b) / b) * 100).toFixed(1)}%` : '–');

  return (
    <section>
      <h2>편제</h2>
      <div className="row">
        <button onClick={() => fill(false)}>학기 나누기 기본값(칸 수 비율)</button>
        <button onClick={() => fill(true)}>학교자율시간 1학기로 몰기</button>
      </div>
      <table className="dev-table">
        <thead><tr><th>교과·영역</th><th>교육부 기준</th><th>1학기</th><th>2학기</th><th>연간</th><th>증감</th><th>±%</th><th>작년</th><th>2년 계</th></tr></thead>
        <tbody>
          {ids.map((id) => {
            const s = school[id] ?? { s1: 0, s2: annual[id] };
            const a = s.s1 + s.s2;
            return (
              <tr key={id}>
                <td>{name(id)}</td><td>{std[id] ?? '–'}</td>
                <td><input type="number" min={0} style={{ width: 56 }} value={s.s1} onChange={(e) => setSem(id, Math.max(0, Number(e.target.value) || 0), s.s2)} /></td>
                <td><input type="number" min={0} style={{ width: 56 }} value={s.s2} onChange={(e) => setSem(id, s.s1, Math.max(0, Number(e.target.value) || 0))} /></td>
                <td>{a}</td><td>{std[id] !== undefined ? a - std[id] : id === ids.find((x) => p.subjects.find((y) => y.id === x)?.kind === 'autonomy') ? `+${a}` : '–'}</td>
                <td>{pct(a, std[id])}</td><td>{prior[id] ?? '–'}</td><td>{prior[id] !== undefined ? prior[id] + a : '–'}</td>
              </tr>
            );
          })}
          <tr><td><b>합계</b></td><td>{p.curriculumPlan.creative.standard + Object.values(std).reduce((a, b) => a + b, 0)}</td>
            <td>{sum((id) => school[id]?.s1 ?? 0)}</td><td>{sum((id) => school[id]?.s2 ?? 0)}</td><td>{sum((id) => annual[id])}</td><td colSpan={2} /><td>{p.priorYear?.total ?? '–'}</td><td /></tr>
        </tbody>
      </table>
      <h3>가져올 교과 순서</h3>
      {Object.entries(donors).filter(([id]) => annual[id] !== undefined).map(([id, list]) => (
        <p key={id}>{name(id)} ← {list.map((d, i) => (
          <span key={d}> {name(d)}
            <button className="link" disabled={i === 0} onClick={() => move(id, i, -1)}>↑</button>
            <button className="link" disabled={i === list.length - 1} onClick={() => move(id, i, 1)}>↓</button></span>
        ))}</p>
      ))}
    </section>
  );
}
