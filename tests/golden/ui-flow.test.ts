import { describe, expect, it } from 'vitest';
import { autoBalance, defaultDonors } from '../../src/engine/autoBalance';
import { runChecks } from '../../src/engine/checks';
import { effectiveSchool, estimatedSubjects, fillEstimated, planGaps } from '../../src/engine/plan';
import { applyOverrides, generateSlots } from '../../src/engine/slots';
import { standardsOf } from '../../src/lib/standards';
import type { Project } from '../../src/model/types';
import { need2026, project2026 } from './project2026';

/** 화면 순서 그대로: 파일 → S4 [칸 비율로 채우기](정답지 학기 값 주입 없음) → S5 [자동 맞추기] → S7 검사 */
async function uiProject(): Promise<Project> {
  const g = await project2026();
  const p0: Project = { ...g, slotOverrides: {}, curriculumPlan: { ...g.curriculumPlan, school: {} } };
  const slots = applyOverrides(generateSlots(p0.calendar, p0.baseTimetable, p0.settings), p0.slotOverrides);
  // S4 [칸 비율로 채우기] 누름 = 추정값을 확정
  const p: Project = { ...p0, curriculumPlan: { ...p0.curriculumPlan, school: fillEstimated(p0.curriculumPlan, slots, [], false) } };
  const r = autoBalance(slots, effectiveSchool(p, slots), p.subjects.map((s) => s.id), { ...defaultDonors(p.subjects), ...p.curriculumPlan.donors });
  return { ...p, slotOverrides: r.overrides };
}

describe.skipIf(!need2026)('화면 순서 리허설(2026)', () => {
  it('자동 맞추기 뒤에는 칸 수 = 편제(R9 통과, S6 경고 없음)', async () => {
    const p = await uiProject();
    const slots = applyOverrides(generateSlots(p.calendar, p.baseTimetable, p.settings), p.slotOverrides);
    expect(planGaps(p, slots)).toEqual([]);
    expect(estimatedSubjects(p)).toEqual([]);
    const rs = runChecks(p, standardsOf('busan-2027'));
    expect(rs.filter((r) => r.ruleId === 'R9').map((r) => r.level)).toEqual(['pass']);
  });
});

describe.skipIf(!need2026)('학기 값을 안 정하면', () => {
  it('R9에 추정값 경고가 나온다', async () => {
    const g = await project2026();
    const p = { ...g, curriculumPlan: { ...g.curriculumPlan, school: {} } };
    expect(runChecks(p, standardsOf('busan-2027')).some((r) => r.ruleId === 'R9' && r.level === 'warn' && r.message.includes('추정값'))).toBe(true);
  });
});
