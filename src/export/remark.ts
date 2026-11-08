import type { PlanRow } from '../model/types';

/** 비고 조립 (작업지시서 2.3): 재구성 표시 → 행사 → 어울림 → 메모 → 【태그】 */
export function assembleRemark(r: PlanRow): string {
  const mark = r.mark ? `◆재구성(${r.mark.type === 'reduce' ? '감축' : '증배'})${r.mark.reason ? `, ${r.mark.reason}` : ''}` : '';
  const event = r.eventName ? `◈${r.eventName}` : '';
  const head = [mark, event, r.program ?? '', r.note ?? ''].filter(Boolean).join(' ');
  return `${head}${r.tags.length ? `【${r.tags.join(', ')}】` : ''}`;
}
