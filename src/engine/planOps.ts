import type { Adjustment, PlanRow, Project, Semester, SubjectId } from '../model/types';

/** 진도 작업이 바꾸는 부분 */
export type OpState = Pick<Project, 'lessonPlans' | 'adjustments'>;

const nextNo = (ids: string[], re: RegExp) => Math.max(0, ...ids.map((i) => Number(i.match(re)?.[1] ?? 0))) + 1;

/** beforeIds 행을 빼고 그 자리(첫 행 위치)에 afterRows를 넣는다 */
function replaceRows(list: PlanRow[], beforeIds: string[], afterRows: PlanRow[], insertAt?: number): PlanRow[] {
  const ids = new Set(beforeIds);
  const at = list.findIndex((r) => ids.has(r.id));
  const kept = list.filter((r) => !ids.has(r.id));
  kept.splice(at < 0 ? (insertAt ?? kept.length) : at, 0, ...afterRows);
  return kept;
}

/** 바뀐 단원의 차시 n/N을 다시 센다: 학기·단원 안의 순서/개수(행사는 학기·행사명 안) */
function renumber(rows: PlanRow[], touched: Set<string>): PlanRow[] {
  const key = (r: PlanRow) => (r.kind === 'event' ? `e|${r.semester}|${r.eventName}` : `u|${r.semester}|${r.unit}`);
  const groups = new Map<string, PlanRow[]>();
  for (const r of rows) if (r.kind !== 'memo') groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  return rows.map((r) => {
    if (r.kind === 'memo' || !touched.has(key(r))) return r;
    const g = groups.get(key(r))!;
    return { ...r, n: g.indexOf(r) + 1, total: g.length };
  });
}
const unitKey = (r: PlanRow) => (r.kind === 'event' ? `e|${r.semester}|${r.eventName}` : `u|${r.semester}|${r.unit}`);

/** 한 작업을 적용: 행을 바꾸고, 증감 기록(±1)을 쌓는다. hours가 0이면 기록 없음(행사 등). */
function apply(s: OpState, subjectId: SubjectId, beforeIds: string[], after: PlanRow[], hours: number, content: string, insertAt?: number): OpState {
  const list = s.lessonPlans[subjectId] ?? [];
  const before = list.filter((r) => beforeIds.includes(r.id));
  const touched = new Set([...before, ...after].map(unitKey));
  const rows = renumber(replaceRows(list, beforeIds, after, insertAt), touched);
  const afterRows = after.map((a) => rows.find((r) => r.id === a.id) ?? a);
  // 다시 센 바람에 번호가 바뀐 다른 행의 옛 번호(취소할 때 되돌림)
  const numbers: Record<string, { n?: number; total?: number }> = {};
  for (const r of list) {
    const now = rows.find((x) => x.id === r.id);
    if (now && (now.n !== r.n || now.total !== r.total)) numbers[r.id] = { n: r.n, total: r.total };
  }
  const first = before[0] ?? after[0];
  const adj: Adjustment[] = hours === 0 ? [] : [{
    id: `op-adj-${nextNo(s.adjustments.map((a) => a.id), /^op-adj-(\d+)$/)}`,
    semester: (first.semester ?? 1) as Semester, subjectId, area: first.area ?? '', standards: first.standards, unit: first.unit,
    content, hours, planRowIds: afterRows.map((r) => r.id),
    undo: { subjectId, beforeRows: before, afterIds: after.map((r) => r.id), numbers, prevId: (() => { const k = list.findIndex((r) => beforeIds.includes(r.id)); const i = k < 0 ? (insertAt ?? list.length) : k; return i > 0 ? list[i - 1].id : null; })(), at: Math.max(0, list.findIndex((r) => beforeIds.includes(r.id)) < 0 ? (insertAt ?? list.length) : list.findIndex((r) => beforeIds.includes(r.id))) },
  }];
  return { lessonPlans: { ...s.lessonPlans, [subjectId]: rows }, adjustments: [...s.adjustments, ...adj] };
}

const find = (s: OpState, subjectId: SubjectId, rowId: string) => {
  const list = s.lessonPlans[subjectId] ?? [];
  const i = list.findIndex((r) => r.id === rowId);
  if (i < 0) throw new Error('행을 찾지 못했습니다.');
  return { list, i, row: list[i] };
};
const reduceMark = (r: PlanRow): PlanRow => ({ ...r, mark: { type: 'reduce', ...(r.mark?.reason ? { reason: r.mark.reason } : {}) } });

/** 합치기: 이 행과 다음 행을 한 행으로(−1). 남는 행에 ◆재구성(감축) */
export function mergeRows(s: OpState, subjectId: SubjectId, rowId: string): OpState {
  const { list, i, row } = find(s, subjectId, rowId);
  const next = list[i + 1];
  if (!next || next.kind === 'memo') throw new Error('합칠 다음 행이 없습니다.');
  return apply(s, subjectId, [row.id, next.id], [reduceMark(row)], -1, `${row.topic}, ${next.topic}`);
}

/** 빼기: 행 삭제(−1). 같은 단원 앞 행(없으면 뒤 행)에 ◆재구성(감축) */
export function removeRow(s: OpState, subjectId: SubjectId, rowId: string): OpState {
  const { list, i, row } = find(s, subjectId, rowId);
  const sameUnit = (r?: PlanRow) => r !== undefined && r.kind !== 'memo' && r.unit === row.unit && r.semester === row.semester;
  const mate = sameUnit(list[i - 1]) ? list[i - 1] : sameUnit(list[i + 1]) ? list[i + 1] : undefined;
  return apply(s, subjectId, mate ? [row.id, mate.id] : [row.id], mate ? [reduceMark(mate)] : [], -1, row.topic);
}

/** 나누기: 한 행을 ' -1-', ' -2-' 두 행으로(+1). 두 행에 ◆재구성(증배) */
export function splitRow(s: OpState, subjectId: SubjectId, rowId: string): OpState {
  const { row } = find(s, subjectId, rowId);
  const mark = { type: 'increase' as const };
  const two = [1, 2].map((k) => ({ ...row, id: `${row.id}-${k}`, topic: `${row.topic} -${k}-`, mark, fixedWeek: k === 1 ? row.fixedWeek : undefined }));
  return apply(s, subjectId, [row.id], two, 1, row.topic);
}

/** 더하기: 새 행(+1)을 afterRowId 뒤에(없으면 맨 끝). ◆재구성(증배) */
export function addRow(s: OpState, subjectId: SubjectId, afterRowId: string | null, topic: string, semester: Semester | undefined): OpState {
  const list = s.lessonPlans[subjectId] ?? [];
  const ref = afterRowId ? list.find((r) => r.id === afterRowId) : list[list.length - 1];
  const id = `${subjectId}-op-${nextNo(list.map((r) => r.id), /-op-(\d+)$/)}`;
  const row: PlanRow = {
    id, subjectId, semester: semester ?? ref?.semester, kind: 'lesson', unit: ref?.unit ?? '', topic, standards: [], tags: [],
    mark: { type: 'increase' }, area: ref?.area, source: { file: '작업', row: 0 },
  };
  const at = ref ? list.findIndex((r) => r.id === ref.id) + 1 : list.length;
  return apply(s, subjectId, [], [row], 1, topic, at);
}

/** 행사 행 넣기: 행사명·주·시간 수. 그 주에 고정으로 놓인다. 증감 기록은 만들지 않는다. */
export function insertEvent(s: OpState, subjectId: SubjectId, ev: { name: string; semester: Semester; week: number; hours: number }): OpState {
  const list = s.lessonPlans[subjectId] ?? [];
  let n = nextNo(list.map((r) => r.id), /-op-(\d+)$/);
  const rows: PlanRow[] = Array.from({ length: ev.hours }, (_, k) => ({
    id: `${subjectId}-op-${n++}`, subjectId, semester: ev.semester, kind: 'event' as const, unit: `◈${ev.name}`, topic: `《 ${ev.name} 》`,
    n: k + 1, total: ev.hours, standards: [], tags: [], eventName: ev.name, rawNote: `◈${ev.name}`,
    fixedWeek: { semester: ev.semester, week: ev.week }, source: { file: '작업', row: 0 },
  }));
  return apply(s, subjectId, [], rows, 0, ev.name);
}

const patchRow = (s: OpState, subjectId: SubjectId, rowId: string, change: Partial<PlanRow>): OpState => ({
  ...s, lessonPlans: { ...s.lessonPlans, [subjectId]: (s.lessonPlans[subjectId] ?? []).map((r) => (r.id === rowId ? { ...r, ...change } : r)) },
});

/** 태그 붙이기(바꾸기) */
export const setTags = (s: OpState, subjectId: SubjectId, rowId: string, tags: string[]): OpState => patchRow(s, subjectId, rowId, { tags });

/** 주 고정(null이면 풀기) */
export const setFixedWeek = (s: OpState, subjectId: SubjectId, rowId: string, fixed: PlanRow['fixedWeek'] | null): OpState =>
  patchRow(s, subjectId, rowId, { fixedWeek: fixed ?? undefined });

/** 순서 옮기기(위/아래). 증감 기록 없음 */
export function moveRow(s: OpState, subjectId: SubjectId, rowId: string, dir: -1 | 1): OpState {
  const { list, i } = find(s, subjectId, rowId);
  const j = i + dir;
  if (j < 0 || j >= list.length) return s;
  const rows = [...list];
  [rows[i], rows[j]] = [rows[j], rows[i]];
  return { ...s, lessonPlans: { ...s.lessonPlans, [subjectId]: rows } };
}

/** 증감 기록 삭제 = 작업 취소. 작업 전 행으로 되돌린다(불러온 기록처럼 undo가 없으면 기록만 지운다). */
export function undoAdjustment(s: OpState, adjustmentId: string): OpState {
  const a = s.adjustments.find((x) => x.id === adjustmentId);
  const adjustments = s.adjustments.filter((x) => x.id !== adjustmentId);
  if (!a?.undo) return { ...s, adjustments };
  const { subjectId, beforeRows, afterIds, numbers, prevId } = a.undo;
  const list = s.lessonPlans[subjectId] ?? [];
  if (afterIds.some((id) => !list.some((r) => r.id === id))) {
    throw new Error('이 작업으로 바뀐 행을 그 뒤 작업이 다시 바꿨습니다. 나중에 한 작업부터 차례로 취소하세요.');
  }
  // 되돌릴 자리: 작업 전에 바로 앞에 있던 행 뒤(그 행이 없으면 맨 앞)
  const prevAt = prevId === null ? 0 : list.findIndex((r) => r.id === prevId) + 1;
  const rows = replaceRows(list, afterIds, beforeRows, prevAt > 0 || prevId === null ? prevAt : a.undo.at).map((r) => (numbers[r.id] ? { ...r, ...numbers[r.id] } : r));
  return { lessonPlans: { ...s.lessonPlans, [subjectId]: rows }, adjustments };
}

/** 두 행 자리 바꾸기(화면에 보이는 이웃과). 증감 기록 없음 */
export function swapRows(s: OpState, subjectId: SubjectId, idA: string, idB: string): OpState {
  const list = [...(s.lessonPlans[subjectId] ?? [])];
  const i = list.findIndex((r) => r.id === idA);
  const j = list.findIndex((r) => r.id === idB);
  if (i < 0 || j < 0) return s;
  [list[i], list[j]] = [list[j], list[i]];
  return { ...s, lessonPlans: { ...s.lessonPlans, [subjectId]: list } };
}
