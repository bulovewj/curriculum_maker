import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Project } from '../model/types';
import { indexedDbStore } from '../storage/indexedDbStore';
import type { ProjectStore } from '../storage/ProjectStore';

interface ProjectState {
  store: ProjectStore;
  project: Project | null;
  open: (p: Project | null) => void;
  update: (change: (p: Project) => Project) => void;
  saveError: boolean;
}

const Ctx = createContext<ProjectState | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [saveError, setSaveError] = useState(false);
  const first = useRef(true);

  // 고칠 때마다 0.5초 몰아서 저장(작업지시서 F1)
  useEffect(() => {
    if (first.current || !project) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      indexedDbStore.save(project, new Date().toISOString()).then(
        () => setSaveError(false),
        () => setSaveError(true),
      );
    }, 500);
    return () => clearTimeout(t);
  }, [project]);

  const value: ProjectState = {
    store: indexedDbStore,
    project,
    open: (p) => {
      first.current = true; // 연 직후에는 저장하지 않는다
      setProject(p);
    },
    update: (change) => setProject((p) => (p ? change(p) : p)),
    saveError,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectState {
  const v = useContext(Ctx);
  if (!v) throw new Error('ProjectProvider 밖에서 useProject를 불렀습니다.');
  return v;
}
