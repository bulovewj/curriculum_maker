// 내보내기 파일 = { app, schemaVersion, savedAt, project } JSON (작업지시서 F1).
import { SCHEMA_VERSION, newProject } from '../model/newProject';
import type { Project } from '../model/types';

const APP = 'naesonan';

export function toProjectFile(project: Project, savedAt: string): string {
  return JSON.stringify({ app: APP, schemaVersion: SCHEMA_VERSION, savedAt, project });
}

/** savedAt = ISO 시각. 이름: 내손안_2027_6학년_20261108.json */
export function projectFileName(project: Project, savedAt: string): string {
  return `내손안_${project.year}_${project.grade}학년_${savedAt.slice(0, 10).replaceAll('-', '')}.json`;
}

/** 읽을 수 없는 파일이면 화면에 그대로 보여 줄 한국어 문장으로 Error를 던진다. */
export function parseProjectFile(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('파일을 읽을 수 없습니다.');
  }
  if (!isRecord(data) || data.app !== APP || !isRecord(data.project) || typeof data.schemaVersion !== 'number') {
    throw new Error('파일을 읽을 수 없습니다(내 손 안의 교육과정 파일이 아님).');
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('새 판 프로그램에서 만든 파일입니다. 프로그램을 새 판으로 바꾼 뒤 열어 주세요.');
  }
  // 나중에 생긴 설정 칸이 옛 파일에 없으면 기본값으로 채운다(설정이 아예 깨진 것은 아래에서 거름)
  if (isRecord(data.project.settings)) data.project.settings = { ...newProject('x', 2000).settings, ...data.project.settings };
  const bad = missingFields(data.project);
  if (bad) throw new Error(`파일이 깨졌거나 일부가 빠졌습니다(${bad} 없음).`);
  // ponytail: 판 올림(마이그레이션)은 schemaVersion 2가 생길 때 여기에 넣는다.
  return data.project as unknown as Project;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const ARRAYS = ['semesters', 'subjects', 'calendar', 'baseTimetable', 'specialistCells', 'events', 'adjustments', 'imports'];
const RECORDS = ['curriculumPlan', 'slotOverrides', 'lessonPlans', 'settings'];

/** 앱이 바로 열 때 꼭 필요한 칸만 검사. 없는 칸 이름을 돌려준다. */
function missingFields(p: Record<string, unknown>): string | undefined {
  if (typeof p.id !== 'string' || !p.id) return 'id';
  if (!isRecord(p.school) || typeof p.school.name !== 'string') return 'school';
  for (const k of ['year', 'grade', 'classCount', 'representativeClass']) if (typeof p[k] !== 'number') return k;
  for (const k of ARRAYS) if (!Array.isArray(p[k])) return k;
  for (const k of RECORDS) if (!isRecord(p[k])) return k;
  // 안쪽 칸: 비어 있으면 검사·계산이 멈추는 것들
  const plan = p.curriculumPlan as Record<string, unknown>;
  for (const k of ['standard', 'schoolAnnual', 'school', 'donors', 'creative']) if (!isRecord(plan[k])) return `curriculumPlan.${k}`;
  const st = p.settings as Record<string, unknown>;
  if (typeof st.extraPeriodSubject !== 'string' || !isRecord(st.timetableCodes)) return 'settings';
  for (const k of ['timetableShape', 'timetableExclude', 'blockSubjects', 'partialSpecialist']) if (!Array.isArray(st[k])) return `settings.${k}`;
  if (!(p.subjects as unknown[]).every((x) => isRecord(x) && typeof x.id === 'string' && typeof x.name === 'string')) return 'subjects';
  if (!(p.semesters as unknown[]).every((x) => isRecord(x) && typeof x.start === 'string' && typeof x.end === 'string')) return 'semesters';
  if (!Object.values(p.lessonPlans as Record<string, unknown>).every(Array.isArray)) return 'lessonPlans';
  return undefined;
}
