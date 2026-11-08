import type { Candidate } from '../../api/_lib/types';
import { addRow, mergeRows, removeRow, splitRow, type OpState } from '../engine/planOps';
import type { Semester, SubjectId } from '../model/types';

/** AI에게 한 번 물을 일: 교과·학기·필요량(+ 줄이기, − 늘리기) */
export interface Job { subjectId: SubjectId; semester: Semester; need: number }
/** 받은 후보 하나. limit = 이 교과·학기에서 적용할 수 있는 최대 개수 */
export interface Picked { subjectId: SubjectId; semester: Semester; c: Candidate; limit: number }

/** 후보 하나를 진도 작업(M12)으로 실행. 행이 없으면 Error. */
export function applyCandidate(s: OpState, subjectId: SubjectId, c: Candidate, sem: Semester): OpState {
  if (c.kind === 'merge') return mergeRows(s, subjectId, c.rowId);
  if (c.kind === 'remove') return removeRow(s, subjectId, c.rowId);
  if (c.kind === 'split') return splitRow(s, subjectId, c.rowId);
  return addRow(s, subjectId, c.rowId, c.topic ?? '', sem);
}

/**
 * 후보를 차례로 적용한다. 교과·학기마다 limit개까지만 적용하고(필요량을 넘겨 적용하지 않게),
 * 앞 후보와 행이 겹쳐 실패한 것은 건너뛴다.
 */
export function applyPicked(s: OpState, picks: Picked[]): { state: OpState; applied: number; skipped: number } {
  const done = new Map<string, number>();
  let state = s;
  let applied = 0;
  let skipped = 0;
  for (const p of picks) {
    const key = `${p.subjectId}#${p.semester}`;
    if ((done.get(key) ?? 0) >= p.limit) { skipped++; continue; }
    try {
      state = applyCandidate(state, p.subjectId, p.c, p.semester);
      done.set(key, (done.get(key) ?? 0) + 1);
      applied++;
    } catch {
      skipped++;
    }
  }
  return { state, applied, skipped };
}
