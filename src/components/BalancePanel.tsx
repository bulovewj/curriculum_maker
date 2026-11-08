import { useState } from 'react';
import { autoBalance, defaultDonors, type BalanceResult } from '../engine/autoBalance';
import { effectiveSchool } from '../engine/plan';
import { applyOverrides, generateSlots } from '../engine/slots';
import type { Project, SlotOverride } from '../model/types';

/** [자동 맞추기]: 바뀔 칸을 미리 보여 주고 [적용]/[취소] */
export function BalancePanel({ project: p, update }: { project: Project; update: (f: (q: Project) => Project) => void }) {
  const [res, setRes] = useState<{ result: BalanceResult; keep: Record<string, SlotOverride> } | null>(null);
  const name = (id: string) => p.subjects.find((s) => s.id === id)?.name ?? id;
  // 경고 문장 속 교과 id를 교과 이름으로 바꿔 보여 준다
  const named = (w: string) => [...p.subjects].sort((a, b) => b.id.length - a.id.length).reduce((t, s) => t.replace(new RegExp(`(?<![\\w-])${s.id}(?![\\w-])`, 'g'), s.name), w);

  function preview() {
    // 이전 자동 맞추기 결과는 빼고 다시 계산한다
    const keep = Object.fromEntries(Object.entries(p.slotOverrides).filter(([, o]) => o.kind !== 'auto' || o.locked));
    const slots = applyOverrides(generateSlots(p.calendar, p.baseTimetable, p.settings), keep);
    const school = effectiveSchool(p, slots);
    setRes({ result: autoBalance(slots, school, p.subjects.map((s) => s.id), { ...defaultDonors(p.subjects), ...p.curriculumPlan.donors }), keep });
  }

  const per: Record<string, number> = {};
  for (const c of res?.result.changes ?? []) per[`${name(c.from)}→${name(c.to)}`] = (per[`${name(c.from)}→${name(c.to)}`] ?? 0) + 1;

  return (
    <div>
      <button onClick={preview} disabled={Object.keys(p.curriculumPlan.schoolAnnual).length === 0}>자동 맞추기</button>
      {Object.keys(p.curriculumPlan.schoolAnnual).length === 0 && <span className="muted"> 편제가 필요합니다(S2에서 편제 파일을 넣으세요).</span>}
      {res && (
        <div className="file-card">
          <p>바뀔 칸 {res.result.changes.length}개: {Object.entries(per).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}</p>
          {res.result.specialistWarnings.length > 0 && (
            <details open><summary className="yellow">전담 칸 변경 {res.result.specialistWarnings.length}개 — 전담 선생님과 확인</summary>
              <ul>{res.result.specialistWarnings.map((w) => <li key={w}>{w}</li>)}</ul></details>
          )}
          {res.result.warnings.map((w) => <p key={w} className="error">{named(w)}</p>)}
          <button onClick={() => { update((q) => ({ ...q, slotOverrides: { ...res.keep, ...res.result.overrides } })); setRes(null); }}>적용</button>{' '}
          <button onClick={() => setRes(null)}>취소</button>
        </div>
      )}
    </div>
  );
}
