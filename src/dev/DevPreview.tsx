import { useState } from 'react';
import { readNeisLessons, type LessonResult } from '../import/lessons/neisLessons';
import { readWorkbook } from '../import/xlsx/readWorkbook';
import { defaultSubjects, renameAutonomy } from '../model/subjects';
import { HwpxView } from './HwpxView';
import { ScheduleView } from './ScheduleView';

/** ?dev 전용: 파일을 넣어 읽기 결과를 표·JSON으로 본다. 개발 확인용. */
export function DevPreview() {
  const [names, setNames] = useState('신명똑디, 신명똑띠');
  const [result, setResult] = useState<LessonResult | null>(null);
  const [error, setError] = useState('');

  async function onFiles(list: FileList | null) {
    if (!list) return;
    setError('');
    try {
      const files = await Promise.all(
        [...list].map(async (f) => ({ fileName: f.name.normalize('NFC'), sheets: await readWorkbook(await f.arrayBuffer()) })),
      );
      const [name, ...aliases] = names.split(',').map((s) => s.trim()).filter(Boolean);
      const subjects = renameAutonomy(defaultSubjects, name ?? '학교자율시간').map((s) =>
        s.kind === 'autonomy' ? { ...s, aliases } : s,
      );
      setResult(readNeisLessons(files, subjects));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main>
      <h1>개발 미리보기 — 진도 xlsx</h1>
      <div className="form">
        <label>학교자율시간 이름(쉼표 뒤는 별칭)<input value={names} onChange={(e) => setNames(e.target.value)} /></label>
        <label>진도 xlsx<input type="file" accept=".xlsx" multiple onChange={(e) => onFiles(e.target.files)} /></label>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <>
          <p>행 {result.rows.length}개 · 경고 {result.warnings.length}개</p>
          <ul>{result.warnings.map((w) => <li key={w} className="error">{w}</li>)}</ul>
          <table className="dev-table">
            <thead><tr><th>교과</th><th>학기</th><th>종류</th><th>단원</th><th>학습내용</th><th>차시</th><th>태그</th><th>출처</th></tr></thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.subjectId}</td><td>{r.semester}</td><td>{r.kind}</td><td>{r.unit}</td><td>{r.topic}</td>
                  <td>{r.n ?? ''}{r.total ? `/${r.total}` : ''}</td><td>{r.tags.join(', ')}</td><td>{r.source.row}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details><summary>JSON</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
        </>
      )}
      <ScheduleView />
      <HwpxView />
    </main>
  );
}
