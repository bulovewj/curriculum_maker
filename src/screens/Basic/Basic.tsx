import { reassignSemesters } from '../../engine/calendar';
import { NumField } from '../../components/NumField';
import { SettingsPanel } from '../../components/SettingsPanel';
import { shiftSemesters } from '../../model/newProject';
import { renameAutonomy } from '../../model/subjects';
import type { Project } from '../../model/types';
import { useProject } from '../../state/ProjectContext';

/** S1 기본 정보 */
export function Basic() {
  const { project, update } = useProject();
  if (!project) return null;
  const p = project;
  const set = (change: Partial<Project>) => update((old) => ({ ...old, ...change }));
  const autonomyName = p.subjects.find((s) => s.kind === 'autonomy')?.name ?? '';

  return (
    <section>
      <h2>기본 정보</h2>
      <div className="form">
        <label>학교명<input value={p.school.name} onChange={(e) => set({ school: { ...p.school, name: e.target.value } })} /></label>
        <NumField label="학년도" value={p.year} min={2000} max={2100} onChange={(year) => set({ year, semesters: shiftSemesters(p.semesters, year) })} />
        <NumField label="학년" value={p.grade} min={1} max={6} onChange={(grade) => set({ grade })} />
        <NumField label="학급 수" value={p.classCount} min={1} max={60} onChange={(classCount) => set({ classCount })} />
        <NumField label="대표 학급" value={p.representativeClass} min={1} max={60} onChange={(representativeClass) => set({ representativeClass })} />
        {p.specialistCells.length > 0 && <p className="muted">대표 학급을 바꾸면 S2에서 전담·학급 시간표 파일을 다시 넣어야 새 반의 시간표가 읽힙니다.</p>}
        {p.calendar.length > 0 && Number(p.calendar[0].date.slice(0, 4)) !== p.year && (
          <p className="error">학사력이 {p.calendar[0].date.slice(0, 4)}학년도 것입니다. S2에서 학사일정을 다시 넣으세요.</p>
        )}
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
        <label>
          <input type="checkbox" checked={p.settings.aiEnabled} onChange={(e) => set({ settings: { ...p.settings, aiEnabled: e.target.checked } })} />
          {' '}AI 도우미 사용(서버가 연결돼 있을 때만 동작. 꺼도 계산·출력은 모두 됩니다)
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
                  onChange={(e) => {
                    const semesters = p.semesters.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x));
                    set({ semesters, calendar: reassignSemesters(p.calendar, semesters) }); // 학사력 날짜의 학기도 함께 바꾼다
                  }}
                />
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <SettingsPanel project={p} update={update} />
    </section>
  );
}
