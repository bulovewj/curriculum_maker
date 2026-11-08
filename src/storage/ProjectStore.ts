import type { Project } from '../model/types';

export interface ProjectSummary {
  id: string;
  title: string;
  savedAt: string; // ISO 시각
}

/** 저장소는 이 인터페이스로만 쓴다. 2차에 Supabase 구현으로 갈아 끼운다. */
export interface ProjectStore {
  list(): Promise<ProjectSummary[]>;
  load(id: string): Promise<Project | undefined>;
  save(project: Project, savedAt: string): Promise<void>;
  remove(id: string): Promise<void>;
}
