import { runChecks } from '../engine/checks';
import { computeGrid } from '../engine/grid';
import { effectiveSchool } from '../engine/plan';
import { semesterTotals } from '../engine/weekGrid';
import type { Standards } from '../model/standards';
import type { Project } from '../model/types';
import { tagCount } from '../engine/checks/common';
import { writeXlsx } from './xlsxWrite';

type Sheets = Record<string, (string | number)[][]>;

const LEVEL = { pass: '통과', warn: '경고', fail: '실패' } as const;

/** 시수 점검표(시트 4개): 교과별·창체·태그·규정 검사 */
export function checkTables(p: Project, std: Standards): Sheets {
  const grid = computeGrid(p);
  const school = effectiveSchool(p, grid.slots);
  const t1 = semesterTotals(grid.rows, 1);
  const t2 = semesterTotals(grid.rows, 2);
  const line = (id: string) => {
    const a = t1[id] ?? 0;
    const b = t2[id] ?? 0;
    const plan = (school[id]?.s1 ?? 0) + (school[id]?.s2 ?? 0);
    return [a, b, a + b, plan, a + b - plan];
  };
  const subs = p.subjects.filter((s) => s.kind !== 'creative');
  const crea = p.subjects.filter((s) => s.kind === 'creative');
  const sum = (ids: string[]) => ids.reduce((acc, id) => acc.map((v, i) => v + line(id)[i]), [0, 0, 0, 0, 0]);
  return {
    교과별: [['교과', '1학기', '2학기', '연간', '편제', '차이'], ...subs.map((s) => [s.name, ...line(s.id)]), ['창체 계', ...sum(crea.map((s) => s.id))], ['합계', ...sum(p.subjects.map((s) => s.id))]],
    창체: [['영역', '1학기', '2학기', '연간', '편제', '차이'], ...crea.map((s) => [s.name, ...line(s.id)])],
    태그: [['태그', '횟수', '기준', '단위', '기간'], ...std.tags.filter((t) => t.grades.includes(p.grade)).map((t) => [t.name, tagCount(p.lessonPlans, t.aliases), t.min, t.unit, t.period])],
    '규정 검사': [['id', '수준', '내용', '위치', '근거'], ...runChecks(p, std).map((r) => [
      r.ruleId, LEVEL[r.level], r.message, r.where.map((w) => [w.semester ? `${w.semester}학기` : '', w.week ? `${w.week}주` : '', w.subjectId ?? ''].filter(Boolean).join(' ')).filter(Boolean).join(', '), r.source,
    ])],
  };
}

export const checkXlsx = async (p: Project, std: Standards): Promise<ArrayBuffer> => writeXlsx(checkTables(p, std));
