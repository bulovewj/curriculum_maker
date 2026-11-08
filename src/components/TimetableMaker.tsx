import { useState } from 'react';
import { defaultShape, generateTimetable, type TimetableResult } from '../engine/generateTimetable';
import type { Project, TimetableCell } from '../model/types';

const DAYS = ['월', '화', '수', '목', '금'];
const same = (a: TimetableCell, b: TimetableCell) => a.weekday === b.weekday && a.period === b.period && a.subjectId === b.subjectId && a.specialist === b.specialist;

/** S3 [기초 시간표 자동 만들기]: 시간표 틀(요일별 교시 수), 전담 요약(전부/일부 전담), 만들기 */
export function TimetableMaker({ project: p, update }: { project: Project; update: (f: (q: Project) => Project) => void }) {
  const [res, setRes] = useState<TimetableResult | null>(null);
  const shape = p.settings.timetableShape.length === 5 ? p.settings.timetableShape : defaultShape(p.calendar);
  const spec = p.subjects.filter((s) => p.specialistCells.some((c) => c.subjectId === s.id));
  const hasPlan = Object.keys(p.curriculumPlan.schoolAnnual).length > 0;
  const setSettings = (change: Partial<Project['settings']>) => update((q) => ({ ...q, settings: { ...q.settings, ...change } }));
  const make = () => generateTimetable({ shape, specialistCells: p.specialistCells, schoolAnnual: p.curriculumPlan.schoolAnnual, subjects: p.subjects, partialSpecialist: p.settings.partialSpecialist, exclude: p.settings.timetableExclude, blockSubjects: p.settings.blockSubjects });

  function run() {
    const r = make();
    const lost = p.baseTimetable.filter((c) => !r.cells.some((x) => same(x, c))).length;
    if (p.baseTimetable.length > 0 && !window.confirm(p.timetableSource === 'generated' ? `고친 칸 ${lost}개가 사라집니다. 다시 만들까요?` : `파일에서 읽은 시간표(${p.baseTimetable.length}칸)를 새로 만든 시간표로 바꿉니다. 계속할까요?`)) return;
    update((q) => ({ ...q, baseTimetable: r.cells, timetableSource: 'generated' }));
    setRes(r);
  }

  return (
    <div className="file-card">
      <b>기초 시간표 자동 만들기</b>
      <div className="row">
        시간표 틀(교시 수):{' '}
        {DAYS.map((d, i) => (
          <label key={d}>{d} <input type="number" min={0} max={9} value={shape[i]} style={{ width: 40 }}
            onChange={(e) => setSettings({ timetableShape: shape.map((x, k) => (k === i ? Math.max(0, Number(e.target.value) || 0) : x)) })} /></label>
        ))}
      </div>
      {spec.length > 0 && (
        <div className="row">
          전담:{' '}
          {spec.map((s) => (
            <label key={s.id}>{s.name} {p.specialistCells.filter((c) => c.subjectId === s.id).length}칸{' '}
              <select value={p.settings.partialSpecialist.includes(s.id) ? 'partial' : 'full'}
                onChange={(e) => setSettings({ partialSpecialist: e.target.value === 'partial' ? [...p.settings.partialSpecialist, s.id] : p.settings.partialSpecialist.filter((x) => x !== s.id) })}>
                <option value="full">전부 전담</option><option value="partial">일부 전담</option>
              </select></label>
          ))}
        </div>
      )}
      <button onClick={run} disabled={!hasPlan}>기초 시간표 자동 만들기</button>
      {!hasPlan && <span className="muted"> 편제가 필요합니다(S2에서 편제 파일을 넣으세요).</span>}
      {res && (
        <>
          <p className="muted">주당 칸 수: {Object.entries(res.perWeek).map(([id, n]) => `${p.subjects.find((s) => s.id === id)?.name ?? id} ${n}`).join(' · ')}</p>
          {res.warnings.map((w) => <p key={w} className="error">{w}</p>)}
          {res.doubled.length > 0 && <p className="yellow-cell">같은 교과가 하루 두 번 든 칸: {res.doubled.map((d) => `${DAYS[d.weekday - 1]} ${d.period}교시 ${p.subjects.find((s) => s.id === d.subjectId)?.name}`).join(', ')}</p>}
        </>
      )}
    </div>
  );
}
