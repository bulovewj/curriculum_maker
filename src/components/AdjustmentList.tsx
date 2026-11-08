import type { Adjustment, SubjectId } from '../model/types';

interface Props {
  subjectId: SubjectId;
  adjustments: Adjustment[];
  onUndo: (id: string) => void;
  onEdit: (id: string, change: Partial<Adjustment>) => void;
}

/** 증감 기록 목록: 작업마다 한 줄. 삭제 = 작업 취소. 영역·성취기준·주요 내용 고치기 */
export function AdjustmentList({ subjectId, adjustments, onUndo, onEdit }: Props) {
  const mine = adjustments.filter((a) => a.subjectId === subjectId);
  return (
    <div>
      <h3>증감 기록 {mine.length}건 (합 {mine.reduce((a, x) => a + x.hours, 0)})</h3>
      {mine.length === 0 && <p className="muted">작업을 하면 기록이 쌓입니다.</p>}
      <ul className="cards-list">
        {mine.map((a) => (
          <li key={a.id} className="file-card">
            <b>{a.semester}학기 {a.hours > 0 ? `+${a.hours}` : a.hours}</b>{' '}
            <button className="link" onClick={() => onUndo(a.id)}>{a.undo ? '취소(삭제)' : '삭제'}</button>
            <div>
              <input value={a.area} placeholder="영역" onChange={(e) => onEdit(a.id, { area: e.target.value })} />{' '}
              <input key={a.id + a.standards.join()} defaultValue={a.standards.join(', ')} placeholder="성취기준(쉼표로 구분)" onBlur={(e) => onEdit(a.id, { standards: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </div>
            <input style={{ width: '100%' }} value={a.content} placeholder="주요 내용" onChange={(e) => onEdit(a.id, { content: e.target.value })} />
          </li>
        ))}
      </ul>
    </div>
  );
}

