import { useEffect, useState } from 'react';
import type { Candidate } from '../../api/_lib/types';
import { AI_OFF, aiAvailable, callAi } from '../ai/client';
import { filterCandidates } from '../ai/filterOutput';
import type { PlanRow, Project, Subject } from '../model/types';

const KIND: Record<Candidate['kind'], string> = { merge: '합치기', remove: '빼기', split: '나누기', add: '더하기' };

interface Props {
  project: Project;
  subject: Subject;
  rows: PlanRow[];
  needBySem: Record<number, number>; // 학기별 필요량(+ 감축, − 증배)
  onApply: (c: Candidate, semester: 1 | 2) => void;
}

/** S6 [AI 후보]: 감축·증배 후보를 받아 고른다. 적용은 M12 작업을 실행한다. 꺼져 있으면 아무것도 안 보인다. */
export function AiPanel({ project: p, subject, rows, needBySem, onApply }: Props) {
  const [avail, setAvail] = useState<boolean | null>(null);
  const [sem, setSem] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [usage, setUsage] = useState({ inputTokens: 0, outputTokens: 0 });

  useEffect(() => {
    if (p.settings.aiEnabled) void aiAvailable().then(setAvail);
  }, [p.settings.aiEnabled]);
  if (!p.settings.aiEnabled) return null;

  const need = needBySem[sem] ?? 0;
  const mine = rows.filter((r) => r.semester === sem && r.kind !== 'memo');
  const standards = [...new Set([...Object.values(p.lessonPlans).flat().flatMap((r) => r.standards), ...p.adjustments.flatMap((a) => a.standards)])];
  const name = (id: string) => rows.find((r) => r.id === id)?.topic ?? id;

  async function ask() {
    setBusy(true);
    setNotes([]);
    const input = { subject: { id: subject.id, name: subject.name }, semester: sem, need, standards, rows: mine.map((r) => ({ id: r.id, unit: r.unit, topic: r.topic, n: r.n, total: r.total, standards: r.standards })) };
    const res = await callAi('adjustCandidates', input);
    setBusy(false);
    if (!res.ok) return setNotes([res.error]);
    setUsage((u) => ({ inputTokens: u.inputTokens + res.usage.inputTokens, outputTokens: u.outputTokens + res.usage.outputTokens }));
    const f = filterCandidates(res.output, { rowIds: mine.map((r) => r.id), standards, need });
    setCands(f.candidates);
    setNotes(f.warnings);
  }

  return (
    <div className="file-card">
      <b>AI 후보</b>{' '}
      {avail === false ? <span className="yellow">{AI_OFF}</span> : (
        <>
          <select value={sem} onChange={(e) => setSem(Number(e.target.value) as 1 | 2)}>
            <option value={1}>1학기</option><option value={2}>2학기</option>
          </select>{' '}
          필요량 {need === 0 ? '0' : need > 0 ? `감축 ${need}` : `증배 ${-need}`}{' '}
          <button disabled={busy || need === 0 || mine.length === 0} onClick={ask}>{busy ? '묻는 중…' : 'AI 후보 받기'}</button>
        </>
      )}
      <span className="muted"> 사용량: 입력 {usage.inputTokens} · 출력 {usage.outputTokens} 토큰</span>
      {notes.map((n) => <p key={n} className="yellow-cell">{n}</p>)}
      <ul className="cards-list">
        {cands.map((c, i) => (
          <li key={i} className="file-card">
            <b>{KIND[c.kind]}</b> — {name(c.rowId)}{c.topic ? ` → ${c.topic}` : ''}
            <div className="muted">{c.reason} {c.standards.join(', ')}</div>
            <button onClick={() => { onApply(c, sem); setCands((x) => x.filter((_, k) => k !== i)); }}>적용</button>{' '}
            <button className="link" onClick={() => setCands((x) => x.filter((_, k) => k !== i))}>버리기</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
