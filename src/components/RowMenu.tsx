import { useEffect } from 'react';
import type { PlanRow } from '../model/types';

interface Props {
  x: number;
  y: number;
  row: PlanRow;
  onAction: (action: 'merge' | 'remove' | 'split' | 'up' | 'down' | 'fix' | 'add' | 'manage') => void;
  onClose: () => void;
}

/** 행을 누르면 그 자리에 뜨는 메뉴: 합치기·빼기·나누기·순서·주 고정·행 추가. 바깥을 누르거나 Esc로 닫는다. */
export function RowMenu({ x, y, row, onAction, onClose }: Props) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const out = (e: MouseEvent) => !(e.target as HTMLElement).closest('.row-menu') && onClose();
    window.addEventListener('keydown', key);
    window.addEventListener('mousedown', out);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('mousedown', out); };
  }, [onClose]);
  const item = (action: Parameters<Props['onAction']>[0], label: string) => (
    <button key={action} role="menuitem" onClick={() => { onAction(action); onClose(); }}>{label}</button>
  );
  return (
    <div className="row-menu" role="menu" style={{ left: Math.min(x, window.innerWidth - 230), top: Math.min(y, window.innerHeight - 330) }}>
      <div className="muted row-menu-title">{row.topic.slice(0, 24)}</div>
      {item('merge', '합치기(+다음 행)')}
      {item('remove', '삭제(빼기)')}
      {item('split', '나누기')}
      {item('up', '↑ 위로')}
      {item('down', '↓ 아래로')}
      {item('fix', row.fixedWeek ? '주 고정 풀기' : '이 주에 고정')}
      {item('add', '이 행 뒤에 행 추가…')}
      {item('manage', '행 관리 창 열기…')}
    </div>
  );
}
