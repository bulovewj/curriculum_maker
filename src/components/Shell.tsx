import { useState } from 'react';
import { projectTitle } from '../model/newProject';
import { Basic } from '../screens/Basic/Basic';
import { Calendar } from '../screens/Calendar/Calendar';
import { Files } from '../screens/Files/Files';
import { Plan } from '../screens/Plan/Plan';
import { Progress } from '../screens/Progress/Progress';
import { Review } from '../screens/Review/Review';
import { WeekGrid } from '../screens/WeekGrid/WeekGrid';
import { useProject } from '../state/ProjectContext';
import { projectFileName, toProjectFile } from '../storage/projectFile';

const steps = ['기본 정보', '파일 넣기', '학사력·시간표', '편제', '주별 시수표', '진도', '점검·출력'];

/** 공통 틀: 위쪽 막대 + 왼쪽 단계 목록 + 본문 */
export function Shell() {
  const { project, open, saveError, undo, canUndo } = useProject();
  const [step, setStep] = useState(0);
  if (!project) return null;

  function exportFile() {
    if (!project) return;
    const savedAt = new Date().toISOString();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toProjectFile(project, savedAt)], { type: 'application/json' }));
    a.download = projectFileName(project, savedAt);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // 단계 목록의 상태 점: 초록 = 할 일을 마침, 노랑 = 아직
  const has = (kind: string) => project.imports.some((r) => r.confirmed && r.kind === kind);
  const done = [
    Boolean(project.school.name),
    has('scheduleP04') && has('timetableP02') && (has('curriculumHwpx') || has('planAdjustHwpx')),
    project.calendar.length > 0 && project.baseTimetable.length > 0,
    Object.keys(project.curriculumPlan.schoolAnnual).length > 0,
    Object.keys(project.slotOverrides).length > 0,
    Object.values(project.lessonPlans).some((rows) => rows.length > 0),
    false,
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <button className="link" onClick={() => open(null)}>← 목록</button>
        <strong>{project.school.name || '학교명 없음'} · {projectTitle(project)}</strong>
        <span className="spacer" />
        <button onClick={undo} disabled={!canUndo} title="방금 한 작업을 취소합니다(최근 30개까지)">↶ 되돌리기</button>
        <button onClick={exportFile}>내보내기</button>
      </header>
      {saveError && <p className="error-bar">저장이 안 됩니다. 내보내기로 파일을 보관하세요.</p>}
      <nav className="steps">
        {steps.map((name, i) => (
          <button key={name} className={i === step ? 'step on' : 'step'} onClick={() => setStep(i)}>
            <span className={`dot ${done[i] ? 'done' : i === 6 ? '' : 'todo'}`} /> S{i + 1} {name}
          </button>
        ))}
      </nav>
      <div className="content">
        {/* ponytail: S2~S7은 해당 마일스톤에서 화면 폴더를 만든다 */}
        {/* S2는 화면을 옮겨도 넣은 파일 카드가 남도록 계속 켜 둔다(숨기기만) */}
        <div hidden={step !== 1}><Files key={project.id} /></div>
        {step === 0 ? <Basic /> : step === 1 ? null : step === 2 ? <Calendar /> : step === 3 ? <Plan /> : step === 4 ? <WeekGrid /> : step === 5 ? <Progress /> : step === 6 ? <Review onGo={setStep} /> : <div className="placeholder">S{step + 1} {steps[step]} — 준비 중</div>}
      </div>
    </div>
  );
}
