import { bySlot } from './slots';
import type { Slot, SlotOverride, SubjectId, WeekGridRow } from '../model/types';

export interface ImportGridResult {
  overrides: Record<string, SlotOverride>;
  warnings: string[];
}

/**
 * (c) 주별 값 가져오기: 주마다 교과별 시수가 (c)와 같아지도록 칸을 'imported' 덮어쓰기로 바꾼다.
 * 넘치는 교과(칸 > (c))의 늦은 칸을, 모자란 교과((c) > 칸)에 교과 순서대로 준다. 주 총계는 바뀌지 않는다.
 * slots = 덮어쓰기 전 기본 칸.
 */
export function importWeekGrid(slots: Slot[], want: WeekGridRow[], subjectOrder: SubjectId[]): ImportGridResult {
  const overrides: Record<string, SlotOverride> = {};
  const warnings: string[] = [];
  for (const w of want) {
    const inWeek = slots.filter((s) => s.semester === w.semester && s.week === w.week);
    const count = (id: SubjectId) => inWeek.filter((s) => s.subjectId === id).length;
    const ids = [...new Set([...subjectOrder, ...Object.keys(w.hours)])];
    // 넘치는 칸 목록: 교과마다 늦은 칸부터 넘치는 수만큼
    const spare: Slot[] = ids.flatMap((id) => {
      const extra = count(id) - (w.hours[id] ?? 0);
      // 잠긴 칸(직접 고친 칸)은 넘기지 않는다
      return extra > 0 ? inWeek.filter((s) => s.subjectId === id && !s.locked).sort(bySlot).reverse().slice(0, extra) : [];
    }).sort(bySlot).reverse(); // 가장 늦은 칸부터 쓴다
    for (const id of ids) {
      for (let need = (w.hours[id] ?? 0) - count(id); need > 0; need--) {
        const s = spare.shift();
        if (!s) {
          warnings.push(`${w.semester}학기 ${w.week}주: ${id} ${need}시간을 채울 칸이 없습니다(칸 수가 (c)와 다름).`);
          break;
        }
        overrides[`${s.date}#${s.period}`] = { subjectId: id, kind: 'imported', locked: false };
      }
    }
  }
  const weeks = new Set(slots.map((s) => `${s.semester}#${s.week}`));
  for (const w of want) if (!weeks.has(`${w.semester}#${w.week}`)) warnings.push(`${w.semester}학기 ${w.week}주는 학사력에 수업일이 없습니다.`);
  return { overrides, warnings };
}
