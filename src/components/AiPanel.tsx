import { useEffect, useState } from 'react';
import type { Candidate } from '../../api/_lib/types';
import type { Job, Picked } from '../ai/applyCandidates';
import { AI_OFF, aiAvailable, callAi } from '../ai/client';
import { filterCandidates } from '../ai/filterOutput';
import type { Project, Semester, Subject } from '../model/types';

const KIND: Record<Candidate['kind'], string> = { merge: '합치기', remove: '빼기', split: '나누기', add: '더하기' };

interface Props {
  project: Project;
  subject: Subject; // 지금 보는 교과
  needs: Record<string, Record<number, number>>; // 교과·학기별 필요량(+ 감축, − 증배)
  onApply: (picks: Picked[]) => { applied: number; skipped: number };
}

/** S6 [AI 후보]: 범위·학기·개수를 고르고 후보를 받아 하나씩 또는 한꺼번에 적용한다. 꺼져 있으면 아무것도 안 보인다. */
export function AiPanel({ project: p, subject, needs, onApply }: Props) {
  const [avail, setAvail] = useState<boolean | null>(null);
  const [scope, setScope] = useState<'one' | 'all'>('one');
  const [sem, setSem] = useState<'1' | '2' | 'both'>('both');
  const [cap, setCap] = useState(''); // 비면 필요량 전부
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState('');
  const [cands, setCands] = useState<Picked[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [usage, setUsage] = useState({ inputTokens: 0, outputTokens: 0 });

  useEffect(() => {
    if (p.settings.aiEnabled) void aiAvailable().then(setAvail);
  }, [p.settings.aiEnabled]);
  if (!p.settings.aiEnabled) return null;

  const subjects = scope === 'one' ? [subject] : p.subjects.filter((s) => (p.lessonPlans[s.id] ?? []).length > 0);
  const sems: Semester[] = sem === 'both' ? [1, 2] : [Number(sem) as Semester];
  const limit = Number(cap) > 0 ? Number(cap) : Infinity;
  const jobs: Job[] = subjects.flatMap((s) => sems.map((n) => ({ subjectId: s.id, semester: n, need: needs[s.id]?.[n] ?? 0 })))
    .filter((j) => j.need !== 0).map((j) => ({ ...j, need: Math.sign(j.need) * Math.min(Math.abs(j.need), limit) }));
  const total = jobs.reduce((n, j) => n + Math.abs(j.need), 0);
  const name = (id: string) => p.subjects.find((s) => s.id === id)?.name ?? id;
  const topic = (c: Picked) => (p.lessonPlans[c.subjectId] ?? []).find((r) => r.id === c.c.rowId)?.topic ?? c.c.rowId;
  const standards = [...new Set([...Object.values(p.lessonPlans).flat().flatMap((r) => r.standards), ...p.adjustments.flatMap((a) => a.standards)])];

  function apply(picks: Picked[]) {
    const r = onApply(picks);
    setNotes([`${r.applied}개 적용${r.skipped ? `, ${r.skipped}개는 앞 후보와 겹치거나 필요량을 넘어 건너뜀` : ''}`]);
  }

  async function ask() {
    if (jobs.length > 3 && !window.confirm(`AI를 ${jobs.length}번 부릅니다(총 ${total}시간). 계속할까요?`)) return;
    const got: Picked[] = [];
    const msgs: string[] = [];
    for (const [i, j] of jobs.entries()) {
      setBusy(`${i + 1}/${jobs.length} ${name(j.subjectId)} ${j.semester}학기`);
      const mine = (p.lessonPlans[j.subjectId] ?? []).filter((r) => r.semester === j.semester && r.kind !== 'memo');
      const input = { subject: { id: j.subjectId, name: name(j.subjectId) }, semester: j.semester, need: j.need, standards, rows: mine.map((r) => ({ id: r.id, unit: r.unit, topic: r.topic, n: r.n, total: r.total, standards: r.standards })) };
      const res = await callAi('adjustCandidates', input);
      if (!res.ok) { msgs.push(`${name(j.subjectId)} ${j.semester}학기: ${res.error}`); break; }
      setUsage((u) => ({ inputTokens: u.inputTokens + res.usage.inputTokens, outputTokens: u.outputTokens + res.usage.outputTokens }));
      const f = filterCandidates(res.output, { rowIds: mine.map((r) => r.id), standards, need: j.need });
      got.push(...f.candidates.map((c) => ({ subjectId: j.subjectId, semester: j.semester, c, limit: Math.abs(j.need) })));
      msgs.push(...f.warnings.map((w) => `${name(j.subjectId)} ${j.semester}학기 ${w}`));
    }
    setBusy('');
    setNotes(msgs);
    if (auto && got.length > 0) { apply(got); setCands([]); } else setCands(got);
  }

  const drop = (c: Picked) => setCands((x) => x.filter((y) => y !== c));
  return (
    <div className="file-card">
      <b>AI 후보</b>{' '}
      {avail === false ? <span className="yellow">{AI_OFF}</span> : (
        <>
          <div className="row">
            <label>범위 <select value={scope} onChange={(e) => setScope(e.target.value as 'one' | 'all')}><option value="one">이 교과만</option><option value="all">필요한 교과 전부</option></select></label>
            <label>학기 <select value={sem} onChange={(e) => setSem(e.target.value as '1' | '2' | 'both')}><option value="both">1·2학기</option><option value="1">1학기</option><option value="2">2학기</option></select></label>
            <label>교과·학기마다 최대 <input value={cap} size={3} placeholder="전부" onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))} />시간</label>
            <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> 받자마자 모두 적용</label>
          </div>
          <p className="muted">{jobs.length === 0 ? '필요량이 0이라 받을 후보가 없습니다.' : `AI ${jobs.length}번 호출 · ${total}시간 ${jobs.map((j) => `${name(j.subjectId)}${j.semester}${j.need > 0 ? '−' : '+'}${Math.abs(j.need)}`).slice(0, 8).join(' ')}${jobs.length > 8 ? ' …' : ''}`}</p>
          <button disabled={!!busy || jobs.length === 0} onClick={ask}>{busy ? `묻는 중… ${busy}` : 'AI 후보 받기'}</button>
        </>
      )}
      <span className="muted"> 사용량: 입력 {usage.inputTokens} · 출력 {usage.outputTokens} 토큰</span>
      {notes.map((n) => <p key={n} className="yellow-cell">{n}</p>)}
      {cands.length > 0 && <p><button onClick={() => { apply(cands); setCands([]); }}>후보 {cands.length}개 모두 적용(필요량까지만)</button></p>}
      <ul className="cards-list">
        {cands.map((c, i) => (
          <li key={i} className="file-card">
            <b>{KIND[c.c.kind]}</b> — {scope === 'all' ? `${name(c.subjectId)} ${c.semester}학기 · ` : ''}{topic(c)}{c.c.topic ? ` → ${c.c.topic}` : ''}
            <div className="muted">{c.c.reason} {c.c.standards.join(', ')}</div>
            <button onClick={() => { apply([{ ...c, limit: 1 }]); drop(c); }}>적용</button>{' '}
            <button className="link" onClick={() => drop(c)}>버리기</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
