import { describe, expect, it } from 'vitest';
import type { PlanRow } from '../model/types';
import { addRow, insertEvent, mergeRows, removeRow, setFixedWeek, setRowText, setTags, splitRow, swapRows, undoAdjustment, type OpState } from './planOps';
import { needOf, placeLessons } from './placeLessons';
import type { Slot } from '../model/types';

const row = (id: string, unit: string, topic: string, n: number, total: number): PlanRow => ({
  id, subjectId: 'kor', semester: 1, kind: 'lesson', unit, topic, n, total, standards: ['6국01-01'], tags: [], source: { file: 'f', row: 1 },
});
const start = (): OpState => ({
  adjustments: [],
  lessonPlans: { kor: [row('a', 'U1', 'A', 1, 3), row('b', 'U1', 'B', 2, 3), row('c', 'U1', 'C', 3, 3), row('d', 'U2', 'D', 1, 1)] },
});
const ids = (s: OpState) => s.lessonPlans.kor.map((r) => r.id);

describe('작업마다 행 수·표시·증감 기록·취소', () => {
  it('합치기: −1, 남는 행에 ◆감축, 번호 다시 셈, 취소하면 그대로', () => {
    const s0 = start();
    const s1 = mergeRows(s0, 'kor', 'a');
    expect(ids(s1)).toEqual(['a', 'c', 'd']);
    expect(s1.lessonPlans.kor[0].mark).toEqual({ type: 'reduce' });
    expect(s1.lessonPlans.kor.map((r) => `${r.n}/${r.total}`)).toEqual(['1/2', '2/2', '1/1']);
    expect(s1.adjustments).toMatchObject([{ hours: -1, subjectId: 'kor', semester: 1, standards: ['6국01-01'] }]);
    expect(undoAdjustment(s1, s1.adjustments[0].id)).toEqual(s0);
  });

  it('빼기: −1, 같은 단원 앞 행에 ◆감축(앞 행이 없으면 뒤 행)', () => {
    const s1 = removeRow(start(), 'kor', 'c');
    expect(ids(s1)).toEqual(['a', 'b', 'd']);
    expect(s1.lessonPlans.kor[1].mark).toEqual({ type: 'reduce' });
    expect(s1.adjustments[0].hours).toBe(-1);
    const s2 = removeRow(start(), 'kor', 'a');
    expect(s2.lessonPlans.kor[0]).toMatchObject({ id: 'b', mark: { type: 'reduce' } });
    expect(undoAdjustment(s1, s1.adjustments[0].id)).toEqual(start());
    expect(undoAdjustment(s2, s2.adjustments[0].id)).toEqual(start());
  });

  it('나누기: +1, 두 행에 ◆증배와 -1- -2-', () => {
    const s0 = start();
    const s1 = splitRow(s0, 'kor', 'b');
    expect(s1.lessonPlans.kor.map((r) => r.topic)).toEqual(['A', 'B -1-', 'B -2-', 'C', 'D']);
    expect(s1.lessonPlans.kor.filter((r) => r.mark?.type === 'increase')).toHaveLength(2);
    expect(s1.lessonPlans.kor.filter((r) => r.unit === 'U1').map((r) => `${r.n}/${r.total}`)).toEqual(['1/4', '2/4', '3/4', '4/4']);
    expect(s1.adjustments[0].hours).toBe(1);
    expect(undoAdjustment(s1, s1.adjustments[0].id)).toEqual(s0);
  });

  it('더하기: +1, 새 행에 ◆증배', () => {
    const s0 = start();
    const s1 = addRow(s0, 'kor', 'b', '새 활동', 1);
    expect(s1.lessonPlans.kor.map((r) => r.topic)).toEqual(['A', 'B', '새 활동', 'C', 'D']);
    expect(s1.lessonPlans.kor[2]).toMatchObject({ mark: { type: 'increase' }, unit: 'U1' });
    expect(s1.adjustments[0].hours).toBe(1);
    expect(undoAdjustment(s1, s1.adjustments[0].id)).toEqual(s0);
  });

  it('작업을 겹쳐도 기록마다 취소할 수 있다', () => {
    const s0 = start();
    const s1 = splitRow(removeRow(s0, 'kor', 'd'), 'kor', 'a');
    expect(s1.adjustments.map((a) => a.hours)).toEqual([-1, 1]);
    const s2 = undoAdjustment(s1, s1.adjustments[0].id); // 먼저 한 '빼기'만 취소
    expect(ids(s2)).toContain('d');
    expect(s2.adjustments).toHaveLength(1);
    const s3 = undoAdjustment(s2, s2.adjustments[0].id);
    expect(s3).toEqual(s0);
  });

  it('행사 넣기: 주 고정 행 n개, 기록 없음', () => {
    const s1 = insertEvent(start(), 'kor', { name: '기초학력진단평가', semester: 1, week: 2, hours: 3 });
    const ev = s1.lessonPlans.kor.filter((r) => r.kind === 'event');
    expect(ev).toHaveLength(3);
    expect(ev.map((r) => `${r.n}/${r.total}`)).toEqual(['1/3', '2/3', '3/3']);
    expect(ev.every((r) => r.fixedWeek?.week === 2)).toBe(true);
    expect(s1.adjustments).toEqual([]);
  });

  it('태그·주 고정·순서 옮기기는 기록이 없다', () => {
    let s = setTags(start(), 'kor', 'a', ['통일교육']);
    expect(s.lessonPlans.kor[0].tags).toEqual(['통일교육']);
    s = setFixedWeek(s, 'kor', 'a', { semester: 1, week: 5 });
    expect(s.lessonPlans.kor[0].fixedWeek).toEqual({ semester: 1, week: 5 });
    expect(setFixedWeek(s, 'kor', 'a', null).lessonPlans.kor[0].fixedWeek).toBeUndefined();
    expect(s.adjustments).toEqual([]);
  });

  it('감축 3번 → 필요량이 3 줄고 증감 기록이 3줄', () => {
    const slot = (i: number): Slot => ({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, period: 1, semester: 1, week: 1, subjectId: 'kor', specialist: false, origin: 'base', locked: false });
    const slots = Array.from({ length: 2 }, (_, i) => slot(i));
    const s0 = start(); // 행 4, 칸 2 → 감축 필요 2
    expect(needOf(placeLessons(slots, s0.lessonPlans.kor, 'kor'))).toBe(2);
    let s = removeRow(s0, 'kor', 'c');
    s = mergeRows(s, 'kor', 'a');
    s = removeRow(s, 'kor', 'd');
    expect(s.adjustments).toHaveLength(3);
    expect(needOf(placeLessons(slots, s.lessonPlans.kor, 'kor'))).toBe(2 - 3);
  });

  it('행사 행(주 고정)을 넣으면 그 주에 놓인다', () => {
    const mk = (date: string, week: number, period = 1): Slot => ({ date, period, semester: 1, week, subjectId: 'kor', specialist: false, origin: 'base', locked: false });
    const slots = [mk('2026-03-03', 1), mk('2026-03-10', 2), mk('2026-03-17', 3), mk('2026-03-17', 3, 2), mk('2026-03-24', 4), mk('2026-03-31', 5), mk('2026-04-07', 6)];
    const s1 = insertEvent(start(), 'kor', { name: '평가', semester: 1, week: 3, hours: 2 });
    const r = placeLessons(slots, s1.lessonPlans.kor, 'kor');
    const ev = r.placed.filter((p) => p.row.kind === 'event').map((p) => p.slot.week);
    expect(ev).toEqual([3, 3]); // 그 주의 빈 칸에 먼저 놓인다
  });

  it('이웃 행이 없는 행을 뺀 뒤 취소하면 원래 자리로', () => {
    const s0 = start(); // d는 U2의 하나뿐인 행
    const s1 = removeRow(s0, 'kor', 'd');
    const s2 = removeRow(s1, 'kor', 'a');
    expect(() => undoAdjustment(s2, s1.adjustments[0].id)).not.toThrow();
    const back = undoAdjustment(s1, s1.adjustments[0].id);
    expect(back).toEqual(s0);
    const mid = removeRow(s0, 'kor', 'b'); // 가운데 행(앞 행이 이웃)
    expect(undoAdjustment(mid, mid.adjustments[0].id)).toEqual(s0);
  });

  it('뒤 작업이 바꾼 행을 먼저 한 작업은 취소할 수 없다(차례로 취소)', () => {
    const s1 = mergeRows(start(), 'kor', 'a');
    const s2 = splitRow(s1, 'kor', 'a'); // 합친 행을 다시 나눔
    expect(() => undoAdjustment(s2, s1.adjustments[0].id)).toThrow('차례로');
    expect(undoAdjustment(undoAdjustment(s2, s2.adjustments[1].id), s1.adjustments[0].id)).toEqual(start());
  });

  it('자리 바꾸기', () => {
    expect(ids(swapRows(start(), 'kor', 'a', 'c'))).toEqual(['c', 'b', 'a', 'd']);
    expect(ids(swapRows(start(), 'kor', 'a', '없음'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('입력을 바꾸지 않는다', () => {
    const s0 = start();
    const copy = JSON.stringify(s0);
    splitRow(mergeRows(s0, 'kor', 'a'), 'kor', 'd');
    expect(JSON.stringify(s0)).toBe(copy);
  });
});

describe('행 글 고치기', () => {
  it('글만 바뀌고 행 수·증감 기록은 그대로, 같은 글이면 같은 객체', () => {
    const s0 = start();
    const s1 = setRowText(s0, 'kor', 'b', { topic: '새 주제', unit: '새 단원' });
    expect(s1.lessonPlans.kor[1]).toMatchObject({ id: 'b', topic: '새 주제', unit: '새 단원' });
    expect(s1.lessonPlans.kor).toHaveLength(4);
    expect(s1.adjustments).toEqual([]);
    expect(s0.lessonPlans.kor[1].topic).toBe('B');
    expect(setRowText(s1, 'kor', 'b', { topic: '새 주제' })).toBe(s1);
    expect(() => setRowText(s0, 'kor', 'zz', { topic: 'x' })).toThrow('행을 찾지');
  });
});

describe('GPT 검토 반영: 취소 순서·학기 경계·메모·차시 다시 세기', () => {
  it('같은 행을 다시 합친 뒤 앞 작업부터 취소하면 막는다', () => {
    const s1 = mergeRows(start(), 'kor', 'a');
    const s2 = mergeRows(s1, 'kor', 'a');
    expect(() => undoAdjustment(s2, s2.adjustments[0].id)).toThrow('나중에 한 작업부터');
    const back = undoAdjustment(undoAdjustment(s2, s2.adjustments[1].id), s2.adjustments[0].id);
    expect(ids(back)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('다른 학기 행과는 합치지 않고, 화면의 다음 행(nextId)과 합친다', () => {
    const s0 = start();
    const s = { ...s0, lessonPlans: { kor: s0.lessonPlans.kor.map((r) => (r.id === 'd' ? { ...r, semester: 2 as const } : r)) } };
    expect(() => mergeRows(s, 'kor', 'c')).toThrow('다른 학기');
    expect(ids(mergeRows(s, 'kor', 'a', 'c'))).toEqual(['a', 'b', 'd']);
  });

  it('메모 빼기는 증감 기록 없음, 메모 나누기는 막음', () => {
    const s0 = start();
    const s = { ...s0, lessonPlans: { kor: [...s0.lessonPlans.kor, { ...row('m', 'U2', '메모', 0, 0), kind: 'memo' as const }] } };
    expect(removeRow(s, 'kor', 'm').adjustments).toEqual([]);
    expect(() => splitRow(s, 'kor', 'm')).toThrow('메모');
  });

  it('순서 바꾸기·단원 옮기기 뒤 차시를 다시 센다', () => {
    const sw = swapRows(start(), 'kor', 'a', 'b');
    expect(sw.lessonPlans.kor.map((r) => `${r.id}${r.n}/${r.total}`)).toEqual(['b1/3', 'a2/3', 'c3/3', 'd1/1']);
    const mv = setRowText(start(), 'kor', 'c', { unit: 'U2' });
    expect(mv.lessonPlans.kor.map((r) => `${r.id}${r.n}/${r.total}`)).toEqual(['a1/2', 'b2/2', 'c1/2', 'd2/2']);
  });
});

describe('취소가 뒤에 고친 글을 지우지 않게', () => {
  it('합친 행의 주제를 고친 뒤 그 합치기를 취소하면 막는다(고치기 전이면 취소됨)', () => {
    const s1 = mergeRows(start(), 'kor', 'a');
    expect(ids(undoAdjustment(s1, s1.adjustments[0].id))).toEqual(['a', 'b', 'c', 'd']);
    const s2 = setRowText(s1, 'kor', 'a', { topic: '새 주제' });
    expect(() => undoAdjustment(s2, s2.adjustments[0].id)).toThrow('고침이 사라지므로');
  });
});
