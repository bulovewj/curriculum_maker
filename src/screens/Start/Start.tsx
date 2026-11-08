import { useEffect, useState } from 'react';
import { newProject } from '../../model/newProject';
import { useProject } from '../../state/ProjectContext';
import { parseProjectFile } from '../../storage/projectFile';
import type { ProjectSummary } from '../../storage/ProjectStore';

/** S0 시작: 프로젝트 카드, 새로 만들기, 파일에서 불러오기 */
export function Start() {
  const { store, open } = useProject();
  const [list, setList] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    store.list().then(setList, () => setError('저장이 안 됩니다. 내보내기로 파일을 보관하세요.'));
  }, [store]);

  async function create() {
    const p = newProject(crypto.randomUUID(), new Date().getFullYear() + 1);
    await store.save(p, new Date().toISOString()).catch(() => setError('저장이 안 됩니다. 내보내기로 파일을 보관하세요.'));
    open(p);
  }

  async function openSaved(id: string) {
    const p = await store.load(id);
    if (p) open(p);
  }

  async function importFile(file: File) {
    try {
      const p = parseProjectFile(await file.text());
      const same = list.find((x) => x.id === p.id);
      if (same && !window.confirm(`이미 같은 프로젝트가 있습니다(마지막 저장 ${new Date(same.savedAt).toLocaleString('ko-KR')}). 파일 내용으로 덮어쓸까요?`)) return;
      await store.save(p, new Date().toISOString());
      open(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일을 읽을 수 없습니다.');
    }
  }

  return (
    <main className="start">
      <h1>내 손 안의 교육과정</h1>
      {error && <p className="error-bar">{error}</p>}
      <div className="row">
        <button className="primary" onClick={create}>새로 만들기</button>
        <label className="button">
          파일에서 불러오기
          <input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
      </div>
      {list.length === 0 ? (
        <p className="empty">아직 프로젝트가 없습니다. [새로 만들기]를 눌러 시작하세요.</p>
      ) : (
        <ul className="cards">
          {list.map((s) => (
            <li key={s.id}>
              <button className="card" onClick={() => openSaved(s.id)}>
                <strong>{s.title}</strong>
                <span className="muted">마지막 저장 {new Date(s.savedAt).toLocaleString('ko-KR')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
