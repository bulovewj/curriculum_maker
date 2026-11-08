import type { CheckResult, Standards } from '../../model/standards';
import type { Project } from '../../model/types';
import { computeGrid } from '../grid';
import { placeAll } from '../placeLessons';
import { effectiveSchool } from '../plan';
import type { CheckCtx, Rule } from './common';
import { r1 } from './r1';
import { r10 } from './r10';
import { r11 } from './r11';
import { r2 } from './r2';
import { r3 } from './r3';
import { r4 } from './r4';
import { r5 } from './r5';
import { r6 } from './r6';
import { r7 } from './r7';
import { r8 } from './r8';
import { r9 } from './r9';

export const RULES: Rule[] = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11];

/** 규정 검사 R1~R11. 기준 숫자는 모두 std(data/standards/*.json)에서 읽는다. */
export function runChecks(p: Project, std: Standards): CheckResult[] {
  const { slots, rows } = computeGrid(p);
  const ctx: CheckCtx = { p, std, slots, rows, placed: placeAll(slots, p.lessonPlans, p.subjects), school: effectiveSchool(p, slots) };
  return RULES.flatMap((r) => r(ctx));
}
