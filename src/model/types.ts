// 작업지시서 3장 데이터 모델. 날짜는 모두 'YYYY-MM-DD'.
export type DateStr = string;
export type SubjectId = string;
export type Semester = 1 | 2;
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = 월요일
export type SchoolWeekday = 1 | 2 | 3 | 4 | 5;

export interface Project {
  schemaVersion: number;
  id: string;
  school: { name: string; office: '부산' };
  year: number;
  grade: number;
  classCount: number;
  representativeClass: number;
  priorYear?: PriorYearHours;
  standardsVersion: string;
  semesters: { no: Semester; start: DateStr; end: DateStr }[];
  subjects: Subject[];
  calendar: CalendarDay[];
  baseTimetable: TimetableCell[];
  timetableSource: 'generated' | 'file';
  specialistCells: SpecialistCell[];
  events: SchoolEvent[];
  curriculumPlan: CurriculumPlan;
  slotOverrides: Record<string, SlotOverride>; // 키 '날짜#교시'
  lessonPlans: Record<SubjectId, PlanRow[]>;
  adjustments: Adjustment[];
  imports: ImportRecord[];
  settings: ProjectSettings;
}

export interface PriorYearHours {
  year: number;
  grade: number;
  school: Record<SubjectId, number>;
  creativeTotal: number;
  total: number;
  informatics?: number;
}

export interface SpecialistCell {
  weekday: SchoolWeekday;
  period: number;
  subjectId: SubjectId;
}

export interface Subject {
  id: SubjectId;
  name: string;
  kind: 'subject' | 'autonomy' | 'creative';
  group: string;
  timetableCodes: string[];
  progressTitle: string;
  neisName?: string;
  aliases: string[];
  order: number;
}

export interface ProjectSettings {
  aiEnabled: boolean;
  monthRule: 'weekStart' | 'majority';
  extraPeriodSubject: SubjectId;
  adjustRows: 'perHour' | 'merged';
  includeOptionalLessons: boolean;
  timetableCodes: Record<string, SubjectId>;
  planFontSize?: number;
  timetableShape: number[];
  timetableExclude: SubjectId[];
  blockSubjects: SubjectId[];
  partialSpecialist: SubjectId[];
}

export interface CalendarDay {
  date: DateStr;
  weekday: Weekday;
  semester: Semester | null;
  schoolDay: boolean;
  periods: number;
  holiday?: string;
  notes: string[];
}

export interface TimetableCell {
  weekday: SchoolWeekday;
  period: number;
  subjectId: SubjectId;
  specialist: boolean;
}

export interface SchoolEvent {
  id: string;
  name: string;
  start: DateStr;
  end: DateStr;
  periodsChange?: number;
  showInPlanNote: boolean;
  source: 'import' | 'user';
}

export interface CurriculumPlan {
  standard: Record<SubjectId, number>;
  creative: { standard: number; school: number };
  school: Record<SubjectId, { s1: number; s2: number }>;
  donors: Record<SubjectId, SubjectId[]>;
}

export interface SlotOverride {
  subjectId: SubjectId;
  kind: 'edited' | 'auto' | 'imported';
  locked: boolean;
}

export interface PlanRow {
  id: string;
  subjectId: SubjectId;
  semester?: Semester;
  kind: 'lesson' | 'event' | 'memo';
  unit: string;
  topic: string;
  n?: number;
  total?: number;
  pages?: string;
  subPages?: string;
  materials?: string;
  standards: string[];
  mark?: { type: 'reduce' | 'increase'; reason?: string };
  eventName?: string;
  program?: string;
  tags: string[];
  note?: string;
  rawNote?: string;
  area?: string;
  fixedWeek?: { semester: Semester; week: number };
  source: { file: string; row: number };
}

export interface Adjustment {
  id: string;
  semester: Semester;
  subjectId: SubjectId;
  area: string;
  standards: string[];
  unit: string;
  content: string;
  hours: number;
  planRowIds: string[];
}

export interface ImportRecord {
  id: string;
  fileName: string;
  kind: ImportKind;
  importedAt: string;
  confirmed: boolean;
  warnings: string[];
}

export type ImportKind =
  | 'scheduleP04' | 'timetableP02' | 'neisLessons' | 'publisherLessons'
  | 'progressHwpx' | 'timePlanHwpx' | 'planAdjustHwpx' | 'curriculumHwpx'
  | 'autonomyHwpx' // 받지 않음. 넣으면 안내만
  | 'unknown';
