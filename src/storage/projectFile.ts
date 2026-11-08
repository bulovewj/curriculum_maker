// 내보내기 파일 = { app, schemaVersion, savedAt, project } JSON (작업지시서 F1).
import { SCHEMA_VERSION } from '../model/newProject';
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
  // ponytail: 판 올림(마이그레이션)은 schemaVersion 2가 생길 때 여기에 넣는다.
  return data.project as unknown as Project;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
