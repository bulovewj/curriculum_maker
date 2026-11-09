import { useMemo } from 'react';
import { runChecks } from '../engine/checks';
import { standardsOf } from '../lib/standards';
import type { Project } from '../model/types';

const PLAN_RULES = ['R2', 'R3', 'R4', 'R6', 'R7']; // 편제와 관련된 규칙(작업지시서 F4·F7)
const LABEL = { fail: '빨강', warn: '노랑', pass: '통과' } as const;

/** S4 편제 옆 규정 검사 미리 보기: 편제를 고치면 바로 다시 계산 */
export function PlanChecks({ project: p }: { project: Project }) {
  const results = useMemo(() => runChecks(p, standardsOf(p.standardsVersion)).filter((r) => PLAN_RULES.includes(r.ruleId)), [p]);
  return (
    <div className="file-card">
      <h3>편제 규정 검사 미리 보기</h3>
      <ul className="plain">
        {results.map((r, i) => (
          <li key={i}><span className={`badge ${r.level}`}>{LABEL[r.level]}</span> <b>{r.ruleId}</b> {r.message}</li>
        ))}
      </ul>
    </div>
  );
}
