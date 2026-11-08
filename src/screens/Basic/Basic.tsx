import { renameAutonomy } from '../../model/subjects';
import type { Project } from '../../model/types';
import { useProject } from '../../state/ProjectContext';

/** S1 기본 정보 */
export function Basic() {
  const { project, update } = useProject();
  if (!project) return null;
  const p = project;
  const set = (change: Partial<Project>) => update((old) => ({ ...old, ...change }));
  const num = (v: string) => Math.max(1, Number(v) || 1);
  const autonomyName = p.subjects.find((s) => s.kind === 'autonomy')?.name ?? '';

  return (
    <section>
      <h2>기본 정보</h2>
      <div className="form">
        <label>학교명<input value={p.school.name} onChange={(e) => set({ school: { ...p.school, name: e.target.value } })} /></label>
        <label>학년도<input type="number" value={p.year} onChange={(e) => set({ year: num(e.target.value) })} /></label>
        <label>학년<input type="number" min={1} max={6} value={p.grade} onChange={(e) => set({ grade: num(e.target.value) })} /></label>
        <label>학급 수<input type="number" min={1} value={p.classCount} onChange={(e) => set({ classCount: num(e.target.value) })} /></label>
        <label>
          대표 학급
          <input type="number" min={1} value={p.representativeClass} onChange={(e) => set({ representativeClass: num(e.target.value) })} />
        </label>
        {p.representativeClass > p.classCount && <p className="error">대표 학급이 학급 수보다 큽니다.</p>}
        <label>
          기준 데이터 판본
          <select value={p.standardsVersion} onChange={(e) => set({ standardsVersion: e.target.value })}>
            <option value="busan-2027">busan-2027</option>
          </select>
        </label>
        <label>
          학교자율시간 이름
          <input value={autonomyName} onChange={(e) => set({ subjects: renameAutonomy(p.subjects, e.target.value) })} />
        </label>
        {p.semesters.map((s, i) => (
          <fieldset key={s.no}>
            <legend>{s.no}학기</legend>
            {(['start', 'end'] as const).map((k) => (
              <label key={k}>
                {k === 'start' ? '시작일' : '끝일'}
                <input
                  type="date"
                  value={s[k]}
                  onChange={(e) => set({ semesters: p.semesters.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })}
                />
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </section>
  );
}
