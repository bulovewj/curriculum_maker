import { useState } from 'react';
import type { OpState } from '../engine/planOps';
import { addRow, insertEvent, mergeRows, removeRow, setFixedWeek, setTags, splitRow } from '../engine/planOps';
import type { PlanRow, Semester, SubjectId } from '../model/types';

interface Props {
  subjectId: SubjectId;
  row: PlanRow | undefined; // 고른 행
  semester: Semester;
  onOp: (f: (s: OpState) => OpState) => void;
  onMove: (dir: -1 | 1) => void; // 화면에 보이는 위·아래 이웃과 자리 바꾸기
}

/** S6 작업 단추: 합치기·빼기·나누기·더하기·행사·태그·주 고정·순서 */
export function PlanOpsBar({ subjectId, row, semester, onOp, onMove }: Props) {
  const [text, setText] = useState('');
  const [week, setWeek] = useState(1);
  const [hours, setHours] = useState(1);
  const need = (f: (s: OpState, r: PlanRow) => OpState) => () => row && onOp((s) => f(s, row));
  return (
    <div className="ops-bar">
      <b>{row ? `고른 행: ${row.topic}` : '행을 눌러 고르세요'}</b>{' '}
      <button disabled={!row} onClick={need((s, r) => mergeRows(s, subjectId, r.id))}>합치기(+다음 행)</button>
      <button disabled={!row} onClick={need((s, r) => removeRow(s, subjectId, r.id))}>빼기</button>
      <button disabled={!row} onClick={need((s, r) => splitRow(s, subjectId, r.id))}>나누기</button>
      <button disabled={!row} onClick={() => onMove(-1)}>↑</button>
      <button disabled={!row} onClick={() => onMove(1)}>↓</button>
      <br />
      <input placeholder="학습 주제·행사명·태그(쉼표)" value={text} onChange={(e) => setText(e.target.value)} />{' '}
      <button disabled={!text} onClick={() => onOp((s) => addRow(s, subjectId, row?.id ?? null, text, semester))}>더하기</button>
      <input type="number" min={1} value={week} style={{ width: 52 }} onChange={(e) => setWeek(Math.max(1, Number(e.target.value) || 1))} />주{' '}
      <input type="number" min={1} max={9} value={hours} style={{ width: 44 }} onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 1))} />시간{' '}
      <button disabled={!text} onClick={() => onOp((s) => insertEvent(s, subjectId, { name: text, semester, week, hours }))}>행사 넣기</button>
      <button disabled={!row} onClick={need((s, r) => setFixedWeek(s, subjectId, r.id, r.fixedWeek ? null : { semester: (r.semester ?? semester) as Semester, week }))}>
        {row?.fixedWeek ? '주 고정 풀기' : '주 고정'}
      </button>
      <button disabled={!row} onClick={need((s, r) => setTags(s, subjectId, r.id, text.split(',').map((t) => t.trim()).filter(Boolean)))}>태그 붙이기</button>
    </div>
  );
}
