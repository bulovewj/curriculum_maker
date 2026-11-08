import { describe, expect, it } from 'vitest';
import { ORIGINAL, REF, findFile, readBuffer } from '../../tests/files';
import { newProject } from '../model/newProject';
import { renameAutonomy } from '../model/subjects';
import type { ImportKind, Project } from '../model/types';
import { parseProjectFile, toProjectFile } from '../storage/projectFile';
import { detectFile } from './detect';
import { interpret, mapUnknown, mergeLessons } from './interpret';
import type { PlanRow } from '../model/types';

const base = (): Project => {
  const p = newProject('t', 2026);
  return {
    ...p, representativeClass: 7,
    subjects: renameAutonomy(p.subjects, '신명똑디').map((s) => (s.kind === 'autonomy' ? { ...s, aliases: ['신명똑띠'] } : s)),
  };
};
const AT = '2026-11-08T00:00:00.000Z';

/** 파일 → 판별 → 해석 → 확정(프로젝트에 반영) */
async function feed(p: Project, path: string): Promise<Project> {
  const name = path.split('/').pop()!.normalize('NFC');
  const data = readBuffer(path);
  const kind: ImportKind = (await detectFile(name, data)).kind;
  return (await interpret(kind, name, data, p)).apply(p, AT);
}

describe.skipIf(!findFile(ORIGINAL, '행사 및 일정') || !findFile(REF, '시수 증가'))('확정하면 프로젝트에 값이 들어간다 (2026)', () => {
  it('학사일정·전담 시간표·편제·진도', async () => {
    let p = base();
    for (const [dir, key] of [[ORIGINAL, '행사 및 일정'], [ORIGINAL, '전담 및 학급'], [REF, '학사일정 및 교육과정편제'], [ORIGINAL, '1학기 교과진도']] as const) {
      p = await feed(p, findFile(dir, key)!);
    }
    expect(p.calendar).toHaveLength(365);
    expect(p.specialistCells).toHaveLength(7);
    expect(p.baseTimetable).toHaveLength(29);
    expect(p.timetableSource).toBe('file');
    expect(p.settings.partialSpecialist).toEqual(['sci']);
    expect(p.priorYear).toMatchObject({ year: 2025, grade: 5, total: 1092 });
    expect(p.curriculumPlan.schoolAnnual.math).toBe(139); // 안(최종 140은 증감계획에서)
    expect(p.lessonPlans.kor).toHaveLength(83);
    expect(p.lessonPlans.autonomy).toHaveLength(32);
    expect(p.imports.map((r) => r.kind)).toEqual(['scheduleP04', 'timetableP02', 'curriculumHwpx', 'progressHwpx']);
    expect(p.imports.every((r) => r.confirmed)).toBe(true);
  });

  it('같은 파일을 다시 넣어도 같다(교과·학기 단위로 바꿈), 저장 파일 왕복', async () => {
    const f = findFile(ORIGINAL, '1학기 교과진도')!;
    const once = await feed(base(), f);
    const twice = await feed(once, f);
    expect(twice.lessonPlans).toEqual(once.lessonPlans);
    expect(twice.imports).toHaveLength(1);
    expect(parseProjectFile(toProjectFile(twice, AT))).toEqual(twice);
  });

  it('1학기에 2학기를 더하면 학기 순으로 이어 붙는다', async () => {
    let p = await feed(base(), findFile(ORIGINAL, '1학기 교과진도')!);
    p = await feed(p, findFile(ORIGINAL, '2학기 교과진도')!);
    expect(p.lessonPlans.kor).toHaveLength(83 + 109);
    expect(p.lessonPlans.kor.map((r) => r.semester).filter((s) => s === 1)).toHaveLength(83);
    expect(p.lessonPlans.kor[0].semester).toBe(1);
  });

  it('증감계획: 편제·증감 기록 36행', async () => {
    const p = await feed(base(), findFile(REF, '시수 증가')!);
    expect(p.adjustments).toHaveLength(36);
    expect(p.curriculumPlan.schoolAnnual).toMatchObject({ kor: 192, autonomy: 32, math: 140 });
    expect(p.curriculumPlan.creative).toEqual({ standard: 102, school: 98 });
  });
});

describe('노란 칸 고치기', () => {
  it('모르는 편제 이름을 교과에 연결하면 별칭에 들어간다', () => {
    const subjects = mapUnknown(base().subjects, { type: 'name', value: '국어(개정)' }, 'kor');
    expect(subjects.find((s) => s.id === 'kor')?.aliases).toEqual(['국어(개정)']);
  });
  it('모르는 시간표 약자를 교과에 연결하면 약자에 들어간다', () => {
    const subjects = mapUnknown(base().subjects, { type: 'code', value: '정' }, 'prac');
    expect(subjects.find((s) => s.id === 'prac')?.timetableCodes).toEqual(['실', '정']);
  });
  it('고친 뒤 다시 읽으면 경고가 사라진다', async () => {
    const dir = findFile(REF, '6학년 1학기 진도표');
    if (!dir) return;
    const f = findFile(dir, '국어')!;
    const p = base();
    const renamed = { ...p, subjects: p.subjects.map((s) => (s.id === 'kor' ? { ...s, name: '국어2', neisName: '국어2' } : s)) };
    const before = await interpret('neisLessons', 'a.xlsx', readBuffer(f), renamed);
    expect(before.unknown.map((u) => u.value)).toContain('국어');
    const fixed = { ...renamed, subjects: mapUnknown(renamed.subjects, before.unknown[0], 'kor') };
    const after = await interpret('neisLessons', 'a.xlsx', readBuffer(f), fixed);
    expect(after.unknown).toEqual([]);
    expect(after.apply(fixed, AT).lessonPlans.kor).toHaveLength(83 + 1); // 메모 1 포함
  });
});

describe('mergeLessons', () => {
  const row = (id: string, semester?: 1 | 2): PlanRow =>
    ({ id, subjectId: 'kor', semester, kind: 'lesson', unit: '', topic: id, standards: [], tags: [], source: { file: 'f', row: 1 } });
  it('연간 진도가 들어오면 학기별 옛 진도는 통째로 바뀐다(두 벌 방지)', () => {
    const out = mergeLessons({ kor: [row('a', 1), row('b', 2)] }, [row('c')]);
    expect(out.kor.map((r) => r.id)).toEqual(['c']);
  });
  it('학기별 진도가 들어오면 연간 옛 진도는 빠진다', () => {
    const out = mergeLessons({ kor: [row('a')] }, [row('b', 1)]);
    expect(out.kor.map((r) => r.id)).toEqual(['b']);
  });
  it('같은 학기만 바꾼다', () => {
    const out = mergeLessons({ kor: [row('a', 1), row('b', 2)] }, [row('c', 1)]);
    expect(out.kor.map((r) => r.id)).toEqual(['c', 'b']);
  });
});
