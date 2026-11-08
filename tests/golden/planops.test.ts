import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mergeRows, removeRow, splitRow, undoAdjustment, type OpState } from '../../src/engine/planOps';
import type { PlanRow } from '../../src/model/types';

const read = (name: string) => JSON.parse(new TextDecoder().decode(readFileSync(`fixtures/2026-g6/expected/${name}`)));

/** 2026 (d) 국어 1학기 행을 PlanRow로 */
function start(): OpState {
  const t = read('progress-s1.json').find((x: { subjectId: string }) => x.subjectId === 'kor');
  const rows: PlanRow[] = t.rows.map((r: PlanRow, i: number) => ({ ...r, id: `kor-1-${i}`, semester: 1, standards: [], source: { file: 'x', row: i } }));
  return { lessonPlans: { kor: rows }, adjustments: [] };
}

describe('2026 (d) 국어에서 작업 후 취소하면 원래대로', () => {
  it('아무 작업도 안 하면 그대로(정답지 B 유지), 작업 뒤 기록을 지우면 원래 행·번호로', () => {
    const s0 = start();
    expect(s0.lessonPlans.kor).toHaveLength(83);
    let s = mergeRows(s0, 'kor', 'kor-1-10');
    s = removeRow(s, 'kor', 'kor-1-30');
    s = splitRow(s, 'kor', 'kor-1-50');
    expect(s.lessonPlans.kor).toHaveLength(83 - 1 - 1 + 1);
    expect(s.adjustments.map((a) => a.hours)).toEqual([-1, -1, 1]);
    for (const a of [...s.adjustments].reverse()) s = undoAdjustment(s, a.id);
    expect(s).toEqual(s0);
  });

  it('순서와 상관없이 하나씩 취소해도 마지막엔 원래대로', () => {
    const s0 = start();
    let s = splitRow(removeRow(s0, 'kor', 'kor-1-5'), 'kor', 'kor-1-20');
    for (const a of [...s.adjustments]) s = undoAdjustment(s, a.id);
    expect(s).toEqual(s0);
  });
});
