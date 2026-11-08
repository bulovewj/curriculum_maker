import { del, entries, get, set } from 'idb-keyval';
import { projectTitle } from '../model/newProject';
import type { Project } from '../model/types';
import type { ProjectStore, ProjectSummary } from './ProjectStore';

interface Saved {
  savedAt: string;
  project: Project;
}

const key = (id: string) => `project:${id}`;

export const indexedDbStore: ProjectStore = {
  async list() {
    const all = await entries<string, Saved>();
    return all
      .filter(([k]) => String(k).startsWith('project:'))
      .map(([, v]): ProjectSummary => ({ id: v.project.id, title: projectTitle(v.project), savedAt: v.savedAt }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  },
  async load(id) {
    return (await get<Saved>(key(id)))?.project;
  },
  async save(project, savedAt) {
    await set(key(project.id), { savedAt, project } satisfies Saved);
  },
  async remove(id) {
    await del(key(id));
  },
};
