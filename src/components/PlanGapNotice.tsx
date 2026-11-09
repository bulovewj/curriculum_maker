import { estimatedSubjects, planGaps } from '../engine/plan';
import type { Project, Slot } from '../model/types';
import { BalancePanel } from './BalancePanel';

/** S6 위 경고: 주별 시수표 칸 수가 편제와 다르면 필요량이 틀리므로 먼저 [자동 맞추기]를 하게 한다. */
export function PlanGapNotice({ project: p, slots, update }: { project: Project; slots: Slot[]; update: (f: (q: Project) => Project) => void }) {
  const gaps = planGaps(p, slots);
  if (gaps.length === 0) return null;
  const name = (id: string) => p.subjects.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="file-card">
      <p className="yellow">
        칸 수가 편제와 다른 교과가 있습니다. 진도 필요량은 칸 수 기준이라, 먼저 [자동 맞추기]로 칸을 편제에 맞추세요(S5 주별 시수표와 같은 기능).
      </p>
      <p className="muted">{gaps.map((g) => `${name(g.subjectId)} ${g.semester}학기 칸 ${g.slots}·편제 ${g.plan}`).join(' · ')}</p>
      <BalancePanel project={p} update={update} />
    </div>
  );
}

/** 학기 값이 칸 비율 추정값인 교과가 있으면 알린다(S4·S5). 문서에 추정값이 나가지 않게 */
export function EstimatedNotice({ project: p }: { project: Project }) {
  const est = estimatedSubjects(p);
  if (est.length === 0) return null;
  const name = (id: string) => p.subjects.find((s) => s.id === id)?.name ?? id;
  return (
    <p className="yellow">
      학기 값이 아직 추정값입니다(칸 비율로 자동 계산): {est.map(name).join(', ')}. S4 편제에서 학교가 정한 1·2학기 값을 넣거나, 추정값이 맞으면 [칸 비율로 채우기]를 눌러 확정하세요.
    </p>
  );
}
