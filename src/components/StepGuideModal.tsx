import { useEffect, useRef } from 'react';
import { STEP_GUIDES } from './stepGuides';

const KEY = 'guide-seen';

/** 이 브라우저에서 이미 본 단계 번호(0~6). 저장이 막혀 있으면 빈 목록 */
export function seenSteps(): number[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as number[]; } catch { return []; }
}
export function markSeen(step: number): void {
  try { localStorage.setItem(KEY, JSON.stringify([...new Set([...seenSteps(), step])])); } catch { /* 저장 안 돼도 동작 */ }
}

/** 단계 안내 창: 처음 들어온 단계에서 한 번 뜨고, 위쪽 [도움말]로 다시 볼 수 있다. */
export function StepGuideModal({ step, onClose }: { step: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const g = STEP_GUIDES[step];
  useEffect(() => { ref.current?.showModal(); }, []);
  if (!g) return null;
  return (
    <dialog ref={ref} className="guide" onClose={onClose} aria-labelledby="guide-title">
      <h2 id="guide-title">{g.title}</h2>
      <p>{g.intro}</p>
      <dl>
        {g.items.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {g.tip && <p className="guide-tip">{g.tip}</p>}
      <div className="row guide-actions">
        <button className="primary" autoFocus onClick={() => ref.current?.close()}>읽었어요</button>
      </div>
    </dialog>
  );
}
