import type { Project, ProjectSettings } from '../model/types';

/** 설정(작업지시서 화면 표 '설정'): 계산·출력 방식을 바꾸는 값. S1 아래 접어 둔다 */
export function SettingsPanel({ project: p, update }: { project: Project; update: (f: (q: Project) => Project) => void }) {
  const st = p.settings;
  const set = (change: Partial<ProjectSettings>) => update((q) => ({ ...q, settings: { ...q.settings, ...change } }));
  return (
    <details className="file-card">
      <summary>설정(월 묶음·늘어난 교시·증감표·글자 크기)</summary>
      <p>
        <label>월 묶음(시간 운영계획 '월' 칸){' '}
          <select value={st.monthRule} onChange={(e) => set({ monthRule: e.target.value as ProjectSettings['monthRule'] })}>
            <option value="weekStart">그 주 기간 시작일의 달(기본)</option>
            <option value="majority">수업일이 많은 달</option>
          </select>
        </label>
      </p>
      <p>
        <label>시간표보다 교시가 늘어난 날의 칸{' '}
          <select value={st.extraPeriodSubject} onChange={(e) => set({ extraPeriodSubject: e.target.value })}>
            {p.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </p>
      <p>
        <label>시수증감 운영계획 표2{' '}
          <select value={st.adjustRows} onChange={(e) => set({ adjustRows: e.target.value as ProjectSettings['adjustRows'] })}>
            <option value="perHour">한 시간에 한 행(기본)</option>
            <option value="merged">같은 단원·내용끼리 합치기</option>
          </select>
        </label>
      </p>
      <p>
        <label>시간 운영계획 글자 크기{' '}
          <input type="number" min={50} max={150} step={5} style={{ width: 64 }} value={st.planFontSize ?? 100} onChange={(e) => set({ planFontSize: Math.min(150, Math.max(50, Number(e.target.value) || 100)) })} />%
        </label>
        <span className="muted"> 한 학기가 한 쪽에 안 들어가면 줄이세요.</span>
      </p>
      <p>
        <label><input type="checkbox" checked={st.includeOptionalLessons} onChange={(e) => set({ includeOptionalLessons: e.target.checked })} /> 출판사 진도의 '자율' 차시도 진도 행으로 읽기(다음에 넣는 파일부터)</label>
      </p>
    </details>
  );
}
