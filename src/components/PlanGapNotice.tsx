import { planGaps } from '../engine/plan';
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
