import type { Candidate, CandidateKind } from '../../api/_lib/types';

const KINDS: CandidateKind[] = ['merge', 'remove', 'split', 'add'];

/**
 * AI 후보에서 목록 밖의 것을 버린다(작업지시서 F9): 입력에 준 행 id, 성취기준 코드만 남긴다.
 * 못 쓰는 후보는 버리고 이유를 경고로 돌려준다.
 */
export function filterCandidates(output: unknown, allowed: { rowIds: string[]; standards: string[] }): { candidates: Candidate[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!Array.isArray(output)) return { candidates: [], warnings: ['AI 답이 목록 모양이 아니어서 버렸습니다.'] };
  const candidates: Candidate[] = [];
  output.forEach((raw, i) => {
    const c = raw as Partial<Candidate>;
    if (!c || !KINDS.includes(c.kind as CandidateKind)) return void warnings.push(`후보 ${i + 1}: 알 수 없는 종류라 버렸습니다.`);
    if (typeof c.rowId !== 'string' || !allowed.rowIds.includes(c.rowId)) return void warnings.push(`후보 ${i + 1}: 목록에 없는 행이라 버렸습니다.`);
    if (c.kind === 'add' && (typeof c.topic !== 'string' || c.topic.trim() === '')) return void warnings.push(`후보 ${i + 1}: 새 행의 주제가 없어 버렸습니다.`);
    const standards = (Array.isArray(c.standards) ? c.standards : []).filter((s): s is string => typeof s === 'string');
    const ok = standards.filter((s) => allowed.standards.includes(s));
    if (ok.length < standards.length) warnings.push(`후보 ${i + 1}: 목록에 없는 성취기준 ${standards.length - ok.length}개를 뺐습니다.`);
    candidates.push({ kind: c.kind as CandidateKind, rowId: c.rowId, topic: typeof c.topic === 'string' ? c.topic : undefined, reason: typeof c.reason === 'string' ? c.reason : '', standards: ok });
  });
  return { candidates, warnings };
}
