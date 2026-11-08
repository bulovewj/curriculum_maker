import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Project } from '../model/types';
import { indexedDbStore } from '../storage/indexedDbStore';
import type { ProjectStore } from '../storage/ProjectStore';

interface ProjectState {
  store: ProjectStore;
  project: Project | null;
  open: (p: Project | null) => void;
  update: (change: (p: Project) => Project) => void;
  undo: () => void;
  canUndo: boolean;
  saveError: boolean;
}

const Ctx = createContext<ProjectState | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [saveError, setSaveError] = useState(false);
  const first = useRef(true);
  const pending = useRef<Project | null>(null); // 아직 저장 안 된 최신 프로젝트
  // 되돌리기: 고치기 직전 프로젝트를 최대 30개 쌓는다. 0.8초 안에 이어진 고침(글자 입력 등)은 한 번으로 친다.
  const history = useRef<Project[]>([]);
  const last = useRef<Project | null>(null);
  const lastPush = useRef(0);
  const undoing = useRef(false);
  const [undoCount, setUndoCount] = useState(0);

  useEffect(() => {
    const prev = last.current;
    if (prev && project && prev !== project && prev.id === project.id && !undoing.current) {
      const now = Date.now();
      if (now - lastPush.current > 800) history.current = [...history.current, prev].slice(-30);
      lastPush.current = now;
    }
    undoing.current = false;
    last.current = project;
    setUndoCount(history.current.length);
  }, [project]);

  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    indexedDbStore.save(p, new Date().toISOString()).then(
      () => setSaveError(false),
      () => setSaveError(true),
    );
  }, []);

  // 고칠 때마다 0.5초 몰아서 저장(작업지시서 F1). 목록으로 나가거나 탭을 닫으면 바로 저장
  useEffect(() => {
    if (first.current || !project) {
      first.current = false;
      return;
    }
    pending.current = project;
    const t = setTimeout(flush, 500);
    return () => clearTimeout(t);
  }, [project, flush]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [flush]);

  const value: ProjectState = {
    store: indexedDbStore,
    project,
    open: (p) => {
      flush();
      first.current = true; // 연 직후에는 저장하지 않는다
      history.current = [];
      last.current = null;
      setProject(p);
    },
    update: (change) => setProject((p) => (p ? change(p) : p)),
    undo: () => {
      const prev = history.current[history.current.length - 1];
      if (!prev) return;
      history.current = history.current.slice(0, -1);
      undoing.current = true;
      setProject(prev);
    },
    canUndo: undoCount > 0,
    saveError,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectState {
  const v = useContext(Ctx);
  if (!v) throw new Error('ProjectProvider 밖에서 useProject를 불렀습니다.');
  return v;
}
