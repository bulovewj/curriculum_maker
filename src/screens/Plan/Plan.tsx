import { useMemo } from 'react';
import { defaultDonors } from '../../engine/autoBalance';
import { computeGrid } from '../../engine/grid';
import { effectiveSchool, fillEstimated } from '../../engine/plan';
import type { Project, SubjectId } from '../../model/types';
import { PlanChecks } from '../../components/PlanChecks';
import { EstimatedNotice } from '../../components/PlanGapNotice';
import { useProject } from '../../state/ProjectContext';

/** S4 편제: 교과 × (기준, 본교 학기별·연간, 증감, 작년, 2년 계), 학기 나누기, 가져올 교과 순서 */
export function Plan() {
  const { project: p, update } = useProject();
  const slots = useMemo(() => (p ? computeGrid(p).slots : []), [p]);
  if (!p) return null;
  const annual = p.curriculumPlan.schoolAnnual;
  if (Object.keys(annual).length === 0) return <p className="empty">아직 편제가 없습니다. S2 [파일 넣기]에서 학년군 편제(hwpx) 또는 시수증감 운영계획을 넣으세요.</p>;

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
      return { ...c, school: fillEstimated(c, slots, auto, inFirst) };
    });
  };
  const move = (id: SubjectId, i: number, d: -1 | 1) => {
    const list = [...(donors[id] ?? [])];
    [list[i], list[i + d]] = [list[i + d], list[i]];
    setPlan((c) => ({ ...c, donors: { ...donors, [id]: list } }));
  };

  // 창체 영역은 파일에 없어도 직접 채울 수 있게 늘 보인다
  const ids = p.subjects.filter((s) => annual[s.id] !== undefined || s.kind === 'creative').map((s) => s.id);
  /** 작년 시수 직접 입력(편제표에 없거나 틀렸을 때). 합계는 다시 센다 */
  const setPrior = (id: SubjectId | 'informatics', v: number) => update((q) => {
    const py = q.priorYear ?? { year: q.year - 1, grade: q.grade - 1, school: {}, creativeTotal: 0, total: 0 };
    if (id === 'informatics') return { ...q, priorYear: { ...py, informatics: v } };
    const school = { ...py.school, [id]: v };
    const crea = q.subjects.filter((s) => s.kind === 'creative').map((s) => s.id);
    const creativeTotal = crea.some((c) => school[c] !== undefined) ? crea.reduce((a, c) => a + (school[c] ?? 0), 0) : py.creativeTotal;
    const total = Object.entries(school).filter(([k]) => !crea.includes(k)).reduce((a, [, n]) => a + n, 0) + creativeTotal;
    return { ...q, priorYear: { ...py, school, creativeTotal, total } };
  });
  const n1 = slots.filter((x) => x.semester === 1).length;
  const n2 = slots.filter((x) => x.semester === 2).length;
  const sum = (f: (id: SubjectId) => number) => ids.reduce((a, id) => a + f(id), 0);
  const prior = p.priorYear?.school ?? {};
  const pct = (a: number, b: number | undefined) => (b ? `${(((a - b) / b) * 100).toFixed(1)}%` : '–');

  return (
    <section>
      <h2>편제</h2>
      <div className="row">
        <button onClick={() => fill(false)}>칸 비율로 채우기(확정)</button>
        <button onClick={() => fill(true)}>칸 비율로 채우기 + 학교자율시간 1학기로 몰기</button>
      </div>
      <EstimatedNotice project={p} />
      <table className="dev-table">
        <thead><tr><th>교과·영역</th><th>교육부 기준</th><th>1학기</th><th>2학기</th><th>연간</th><th>증감</th><th>±%</th><th>작년</th><th>2년 계</th></tr></thead>
        <tbody>
          {ids.map((id) => {
            const s = school[id] ?? { s1: 0, s2: annual[id] ?? 0 };
            const a = s.s1 + s.s2;
            return (
              <tr key={id}>
                <td>{name(id)}</td><td>{std[id] ?? '–'}</td>
                <td><input type="number" min={0} style={{ width: 56 }} value={s.s1} onChange={(e) => setSem(id, Math.max(0, Number(e.target.value) || 0), s.s2)} /></td>
                <td><input type="number" min={0} style={{ width: 56 }} value={s.s2} onChange={(e) => setSem(id, s.s1, Math.max(0, Number(e.target.value) || 0))} /></td>
                <td>{a}</td><td>{std[id] !== undefined ? a - std[id] : id === ids.find((x) => p.subjects.find((y) => y.id === x)?.kind === 'autonomy') ? `+${a}` : '–'}</td>
                <td>{pct(a, std[id])}</td>
                <td><input type="number" min={0} style={{ width: 56 }} value={prior[id] ?? ''} placeholder="–" onChange={(e) => setPrior(id, Math.max(0, Number(e.target.value) || 0))} /></td><td>{prior[id] !== undefined ? prior[id] + a : '–'}</td>
              </tr>
            );
          })}
          <tr><td><b>합계</b></td><td>{p.curriculumPlan.creative.standard + Object.values(std).reduce((a, b) => a + b, 0)}</td>
            <td>{sum((id) => school[id]?.s1 ?? 0)}</td><td>{sum((id) => school[id]?.s2 ?? 0)}</td><td>{sum((id) => annual[id] ?? 0)}</td><td colSpan={2} /><td>{p.priorYear?.total ?? '–'}</td><td /></tr>
        </tbody>
      </table>
      {(sum((id) => school[id]?.s1 ?? 0) !== n1 || sum((id) => school[id]?.s2 ?? 0) !== n2) && (
        <p className="yellow">1학기 칸 {n1}개 · 편제 1학기 합 {sum((id) => school[id]?.s1 ?? 0)}, 2학기 칸 {n2}개 · 편제 2학기 합 {sum((id) => school[id]?.s2 ?? 0)} — S5 [자동 맞추기]로는 학기 합이 같아야 맞출 수 있습니다.</p>
      )}
      <p>
        <label>작년 정보교육 시수(규정 검사 R5){' '}
          <input type="number" min={0} style={{ width: 56 }} value={p.priorYear?.informatics ?? ''} placeholder="–" onChange={(e) => setPrior('informatics', Math.max(0, Number(e.target.value) || 0))} />
        </label>
      </p>
      <PlanChecks project={p} />
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
