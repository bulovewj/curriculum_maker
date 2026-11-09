import { useEffect, useRef, useState } from 'react';
import { addRow, insertEvent, removeRow, setRowText, setTags, type OpState } from '../engine/planOps';
import type { PlanRow, Semester, SubjectId } from '../model/types';

interface Props {
  open: boolean;
  subjectId: SubjectId;
  rows: PlanRow[]; // 지금 보는 행 목록(표 순서)
  afterId: string | null; // 새 행을 넣을 자리(이 행 뒤). 없으면 학기 맨 끝
  onOp: (f: (s: OpState) => OpState) => void;
  onClose: () => void;
}

/** 행 관리 창: 행을 따로 추가·삭제하고 글을 적는다. 더하기·빼기는 증감 기록이 쌓이고, 글 고치기는 기록 없이 글만 바뀐다. */
export function RowManager(props: Props) {
  return props.open ? <ManagerDialog {...props} /> : null; // 닫혀 있을 땐 그리지 않는다(행이 많아서)
}

function ManagerDialog({ subjectId, rows, afterId, onOp, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [topic, setTopic] = useState('');
  const [unit, setUnit] = useState('');
  const [sem, setSem] = useState<Semester>(1);
  const [week, setWeek] = useState(1);
  const [tags, setTagText] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);

  const anchor = rows.find((r) => r.id === afterId);
  const lastOfSem = [...rows].reverse().find((r) => r.semester === sem && r.kind !== 'memo');
  const after = anchor ?? lastOfSem;
  const add = () => {
    onOp((s) => {
      const next = addRow(s, subjectId, after?.id ?? null, topic.trim(), after?.semester ?? sem);
      const added = next.lessonPlans[subjectId].find((r) => !s.lessonPlans[subjectId].some((x) => x.id === r.id));
      return unit.trim() && added ? setRowText(next, subjectId, added.id, { unit: unit.trim() }) : next;
    });
    setTopic('');
  };

  return (
    <dialog ref={ref} className="row-manager" onClose={onClose}>
      <h3>행 관리</h3>
      <p className="muted">행을 추가하면 증감 기록 +1, 삭제하면 −1이 쌓입니다. 글만 고치면 기록이 없습니다.</p>
      <fieldset>
        <legend>행 추가</legend>
        <div className="row">
          <label>학기 <select value={anchor?.semester ?? sem} disabled={!!anchor} onChange={(e) => setSem(Number(e.target.value) as Semester)}><option value={1}>1학기</option><option value={2}>2학기</option></select></label>
          <label>단원 <input value={unit} placeholder="비우면 앞 행과 같음" onChange={(e) => setUnit(e.target.value)} /></label>
          <label>학습 주제 <input value={topic} style={{ width: 280 }} placeholder="새 행에 들어갈 글" onChange={(e) => setTopic(e.target.value)} /></label>
          <button className="primary" disabled={!topic.trim()} onClick={add}>추가</button>
        </div>
        <p className="muted">{anchor ? `위치: 「${anchor.topic.slice(0, 20)}」 뒤` : '위치: 그 학기 맨 끝(표에서 행을 누르고 [이 행 뒤에 행 추가]를 고르면 그 뒤)'}</p>
      </fieldset>
      <fieldset>
        <legend>행사 넣기</legend>
        <div className="row">
          <label>행사명 <input value={tags} onChange={(e) => setTagText(e.target.value)} /></label>
          <label>주 <input type="number" min={1} value={week} style={{ width: 56 }} onChange={(e) => setWeek(Math.max(1, Number(e.target.value) || 1))} /></label>
          <button disabled={!tags.trim()} onClick={() => onOp((s) => insertEvent(s, subjectId, { name: tags.trim(), semester: sem, week, hours: 1 }))}>{sem}학기 {week}주에 1시간 넣기</button>
        </div>
      </fieldset>
      <h4>행 목록 {rows.length}행</h4>
      <div className="table-wrap" style={{ maxHeight: '38vh' }}>
        <table className="dev-table">
          <thead><tr><th>학기</th><th>단원</th><th>학습 주제(고쳐 쓰기)</th><th>태그</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.semester ?? ''}</td>
                <td><input key={r.id + r.unit} defaultValue={r.unit} style={{ width: 200 }} onBlur={(e) => e.target.value !== r.unit && onOp((s) => setRowText(s, subjectId, r.id, { unit: e.target.value }))} /></td>
                <td><input key={r.id + r.topic} defaultValue={r.topic} style={{ width: 320 }} onBlur={(e) => e.target.value !== r.topic && onOp((s) => setRowText(s, subjectId, r.id, { topic: e.target.value }))} /></td>
                <td><input key={r.id + r.tags.join()} defaultValue={r.tags.join(', ')} style={{ width: 140 }} placeholder="쉼표로" onBlur={(e) => e.target.value !== r.tags.join(', ') && onOp((s) => setTags(s, subjectId, r.id, e.target.value.split(',').map((t) => t.trim()).filter(Boolean)))} /></td>
                <td><button onClick={() => onOp((s) => removeRow(s, subjectId, r.id))}>삭제(−1)</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row"><span className="spacer" /><button className="primary" onClick={onClose}>닫기</button></div>
    </dialog>
  );
}
