import { useState } from 'react';
import type { Subject, SubjectId } from '../model/types';

export interface MoveTarget {
  semester: 1 | 2;
  week: number;
  from: SubjectId;
}

interface Props {
  target: MoveTarget;
  subjects: Subject[];
  onMove: (to: SubjectId, n: number) => void;
  onCancel: () => void;
}

/** 'A → B로 n시간' 옮기기 창 */
export function MoveForm({ target, subjects, onMove, onCancel }: Props) {
  const [to, setTo] = useState('');
  const [n, setN] = useState(1);
  const name = (id: SubjectId) => subjects.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="move-form">
      <b>{target.semester}학기 {target.week}주: {name(target.from)} →</b>{' '}
      <select value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">받을 교과</option>
        {subjects.filter((s) => s.id !== target.from).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>{' '}
      <input type="number" min={1} max={9} value={n} style={{ width: 48 }} onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))} />시간{' '}
      <button disabled={!to} onClick={() => onMove(to, n)}>옮기기</button> <button onClick={onCancel}>닫기</button>
    </div>
  );
}
