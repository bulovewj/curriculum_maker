import { lastDayOfFebruary } from '../lib/dates';
import { defaultSubjects } from './subjects';
import type { Project } from './types';

export const SCHEMA_VERSION = 1;

/** 빈 프로젝트. id는 부르는 쪽이 만든다(이 함수는 같은 입력 → 같은 결과). */
export function newProject(id: string, year: number): Project {
  const timetableCodes = Object.fromEntries(
    defaultSubjects.flatMap((s) => s.timetableCodes.map((c) => [c, s.id])),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    school: { name: '', office: '부산' },
    year,
    grade: 6,
    classCount: 1,
    representativeClass: 1,
    standardsVersion: 'busan-2027',
    semesters: [
      { no: 1, start: `${year}-03-01`, end: `${year}-08-31` },
      { no: 2, start: `${year}-09-01`, end: lastDayOfFebruary(year + 1) },
    ],
    subjects: defaultSubjects,
    calendar: [],
    baseTimetable: [],
    timetableSource: 'generated',
    specialistCells: [],
    events: [],
    curriculumPlan: { standard: {}, creative: { standard: 0, school: 0 }, schoolAnnual: {}, school: {}, donors: {} },
    slotOverrides: {},
    lessonPlans: {},
    adjustments: [],
    imports: [],
    settings: {
      aiEnabled: false,
      monthRule: 'weekStart',
      extraPeriodSubject: 'ca-self',
      adjustRows: 'perHour',
      includeOptionalLessons: false,
      timetableCodes,
      timetableShape: [],
      timetableExclude: ['autonomy', 'ca-career'],
      blockSubjects: ['art'],
      partialSpecialist: [],
    },
  };
}

export const projectTitle = (p: Project) => `${p.year} ${p.grade}학년`;
