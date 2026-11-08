import { useState } from 'react';
import type { TextOut } from '../../api/_lib/types';
import { callAi } from '../ai/client';
import { activityNamesInput, adjustTextInput, applyActivityNames, applyAdjustTexts, filterTexts } from '../ai/textTasks';
import type { Project, Subject } from '../model/types';

interface Pending { task: 'adjustText' | 'activityNames'; items: TextOut[]; old: Record<string, string> }

/** S6 [AI 글쓰기]: 증감 기록 '주요 내용' 문장, 창체 활동 이름. 미리 보고 적용하면 노란 칸(AI 초안)이 된다. 실패하면 기존 값 그대로. */
export function AiTextPanel({ project: p, subject, update }: { project: Project; subject: Subject; update: (f: (q: Project) => Project) => void }) {
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  if (!p.settings.aiEnabled) return null;

  const adjs = p.adjustments.filter((a) => all || a.subjectId === subject.id);
  const rows = (p.lessonPlans[subject.id] ?? []).filter((r) => r.kind !== 'memo');
  const drafts = adjs.filter((a) => a.aiDraft).length + rows.filter((r) => r.aiDraft).length;

  async function ask(task: Pending['task']) {
    setBusy(true);
    setNotes([]);
    const input = task === 'adjustText' ? adjustTextInput(adjs, p.subjects) : activityNamesInput(subject, rows);
    const res = await callAi(task, input);
    setBusy(false);
    if (!res.ok) return setNotes([res.error]); // 실패하면 기존 값 그대로
    const ids = input.items.map((i) => i.id);
    const f = filterTexts(res.output, ids);
    setNotes(f.warnings);
    const old = Object.fromEntries(task === 'adjustText' ? adjs.map((a) => [a.id, a.content]) : rows.map((r) => [r.id, r.topic]));
    setPending(f.items.length ? { task, items: f.items, old } : null);
  }

  function apply() {
    if (!pending) return;
    const { task, items } = pending;
    update((q) => task === 'adjustText'
      ? { ...q, adjustments: applyAdjustTexts(q.adjustments, items) }
      : { ...q, lessonPlans: { ...q.lessonPlans, [subject.id]: applyActivityNames(q.lessonPlans[subject.id] ?? [], items) } });
    setPending(null);
  }

  const confirmAll = () => update((q) => ({
    ...q,
    adjustments: q.adjustments.map((a) => (a.aiDraft && (all || a.subjectId === subject.id) ? { ...a, aiDraft: false } : a)),
    lessonPlans: { ...q.lessonPlans, [subject.id]: (q.lessonPlans[subject.id] ?? []).map((r) => (r.aiDraft ? { ...r, aiDraft: false } : r)) },
  }));

  return (
    <div className="file-card">
      <b>AI 글쓰기</b>{' '}
      <label><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> 모든 교과의 증감 기록</label>{' '}
      <button disabled={busy || adjs.length === 0} onClick={() => void ask('adjustText')}>주요 내용 문장 쓰기({adjs.length}건)</button>{' '}
      {subject.kind === 'creative' && <button disabled={busy || rows.length === 0} onClick={() => void ask('activityNames')}>활동 이름 짓기({rows.length}행)</button>}{' '}
      {drafts > 0 && <button onClick={confirmAll}>AI 초안 {drafts}개 모두 확인</button>}
      {busy && <span className="muted"> 쓰는 중…</span>}
      {notes.map((n) => <p key={n} className="yellow-cell">{n}</p>)}
      {pending && (
        <>
          <ul className="cards-list">
            {pending.items.slice(0, 30).map((t) => <li key={t.id}><span className="muted">{pending.old[t.id]}</span> → <b>{t.text}</b></li>)}
          </ul>
          {pending.items.length > 30 && <p className="muted">… 외 {pending.items.length - 30}개</p>}
          <button onClick={apply}>{pending.items.length}개 적용(노란 칸으로 표시)</button>{' '}
          <button className="link" onClick={() => setPending(null)}>버리기</button>
        </>
      )}
    </div>
  );
}
