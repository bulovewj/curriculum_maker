import { useState, type DragEvent } from 'react';
import { FileCard, type Item } from '../../components/FileCard';
import { detectFile } from '../../import/detect';
import { interpret, mapUnknown, type Unknown } from '../../import/interpret';
import { shiftSemesters } from '../../model/newProject';
import { renameAutonomy } from '../../model/subjects';
import type { ImportKind, Project } from '../../model/types';
import { useProject } from '../../state/ProjectContext';

const NO_READ: ImportKind[] = ['unknown', 'autonomyHwpx', 'timePlanHwpx'];
const KIND_NOTICE: Partial<Record<ImportKind, string>> = {
  timePlanHwpx: '시간 운영계획은 S5 [작년 시수표 가져오기]에서 넣어 주세요.',
};

/** S2 파일 넣기·해석 확인 */
export function Files() {
  const { project, update } = useProject();
  const [items, setItems] = useState<Item[]>([]);
  const [data] = useState(() => new Map<string, ArrayBuffer>()); // 원본은 저장하지 않고 이 화면에만 둔다
  if (!project) return null;
  const p = project;

  const patch = (id: string, change: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...change } : x)));

  async function read(id: string, name: string, kind: ImportKind, proj: Project) {
    const buf = data.get(id);
    if (!buf || NO_READ.includes(kind)) return patch(id, { interp: undefined, error: undefined, ...(KIND_NOTICE[kind] ? { notice: KIND_NOTICE[kind] } : {}) });
    try {
      patch(id, { interp: await interpret(kind, name, buf, proj), error: undefined });
    } catch (e) {
      patch(id, { interp: undefined, error: e instanceof Error ? e.message : '파일을 읽지 못했습니다.' });
    }
  }

  async function add(files: FileList | File[], proj: Project = p) {
    for (const f of Array.from(files)) {
      const buf = await f.arrayBuffer();
      const id = `${f.name}#${data.size}`;
      data.set(id, buf);
      const det = await detectFile(f.name, buf);
      setItems((xs) => [...xs, { id, name: f.name.normalize('NFC'), kind: det.kind, notice: det.notice, confirmed: false }]);
      await read(id, f.name.normalize('NFC'), det.kind, proj);
    }
  }

  async function fix(item: Item, u: Unknown, subjectId: string) {
    const next = { ...p, subjects: mapUnknown(p.subjects, u, subjectId) };
    update((q) => ({ ...q, subjects: next.subjects }));
    await read(item.id, item.name, item.kind, next);
  }

  function confirm(item: Item) {
    if (!item.interp) return;
    const apply = item.interp.apply;
    update((q) => apply(q, new Date().toISOString()));
    patch(item.id, { confirmed: true });
  }

  /** 개발용: 내 컴퓨터의 2026 정답지 파일을 한 번에 넣고 학년도·자율시간 이름을 맞춘다 */
  async function loadSample() {
    if (!window.confirm('학년도를 2026, 학교자율시간 이름을 신명똑디로 바꾸고 샘플 파일을 넣습니다. 계속할까요?')) return;
    const names = (await (await fetch('/dev-sample')).json()) as string[];
    const files = await Promise.all(names.map(async (n) => new File([await (await fetch(`/dev-sample/${encodeURIComponent(n)}`)).arrayBuffer()], n)));
    const next = { ...p, year: 2026, semesters: shiftSemesters(p.semesters, 2026), subjects: renameAutonomy(p.subjects, '신명똑디') };
    update((q) => ({ ...q, year: next.year, semesters: next.semesters, subjects: next.subjects }));
    await add(files, next);
  }
  const pending = items.filter((x) => x.interp && !x.confirmed);

  const onDrop = (e: DragEvent) => { e.preventDefault(); void add(e.dataTransfer.files); };
  const got = (...kinds: ImportKind[]) => p.imports.some((r) => kinds.includes(r.kind));
  const lessons = p.subjects.filter((s) => (p.lessonPlans[s.id] ?? []).length > 0);

  return (
    <section>
      <h2>파일 넣기</h2>
      <ul className="checklist">
        <li>{got('scheduleP04') ? '☑' : '☐'} 학사일정 (필수)</li>
        <li>{got('timetableP02') ? '☑' : '☐'} 전담 시간표 (필수)</li>
        <li>{got('curriculumHwpx', 'planAdjustHwpx') ? '☑' : '☐'} 작년·올해 편제 (필수)</li>
        <li>{lessons.length ? '☑' : '☐'} 진도: {lessons.length ? lessons.map((s) => `${s.name} ${p.lessonPlans[s.id].length}`).join(' · ') : '교과마다 진도 파일'}</li>
      </ul>
      <label className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        파일을 여기로 끌어다 놓거나 눌러서 고르세요 (xlsx, hwpx)
        <input type="file" multiple accept=".xlsx,.hwpx,.hwp,.pdf" hidden onChange={(e) => e.target.files && add(e.target.files)} />
      </label>
      {import.meta.env.DEV && <div className="row"><button onClick={() => void loadSample()}>2026 샘플 넣기(개발용)</button></div>}
      {pending.length > 1 && <div className="row"><button onClick={() => pending.forEach(confirm)}>읽은 파일 모두 확정({pending.length})</button></div>}
      <ul className="cards-list">
        {items.map((item) => (
          <FileCard key={item.id} item={item} subjects={p.subjects}
            onKind={(k) => { patch(item.id, { kind: k }); void read(item.id, item.name, k, p); }}
            onFix={(u, id) => fix(item, u, id)} onConfirm={() => confirm(item)} />
        ))}
      </ul>
    </section>
  );
}
