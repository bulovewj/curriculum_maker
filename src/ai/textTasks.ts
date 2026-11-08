import type { ActivityNamesInput, AdjustTextInput, TextOut } from '../../api/_lib/types';
import type { Adjustment, PlanRow, Subject } from '../model/types';

/** 증감 기록 → 문장 쓰기 입력. 합치기·빼기(시수 감소)는 reduce, 나누기·더하기는 increase. */
export function adjustTextInput(adjustments: Adjustment[], subjects: Subject[]): AdjustTextInput {
  return {
    items: adjustments.map((a) => ({
      id: a.id, subject: subjects.find((s) => s.id === a.subjectId)?.name ?? a.subjectId, semester: a.semester,
      kind: a.hours < 0 ? 'reduce' : 'increase', area: a.area, unit: a.unit, content: a.content,
    })),
  };
}

/** 창체 행 → 활동 이름 짓기 입력 */
export function activityNamesInput(subject: Subject, rows: PlanRow[]): ActivityNamesInput {
  return { subject: subject.name, items: rows.filter((r) => r.kind !== 'memo').map((r) => ({ id: r.id, unit: r.unit, topic: r.topic })) };
}

const MAX_LEN = 200;

/** AI 답에서 id가 목록에 있고 글이 있는 것만 남긴다. 이상한 것은 경고로 */
export function filterTexts(output: unknown, ids: string[]): { items: TextOut[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!Array.isArray(output)) return { items: [], warnings: ['AI 답이 목록 모양이 아니어서 버렸습니다.'] };
  const seen = new Set<string>();
  const items: TextOut[] = [];
  output.forEach((raw, i) => {
    const o = raw as Partial<TextOut>;
    if (!o || typeof o.id !== 'string' || !ids.includes(o.id)) return void warnings.push(`항목 ${i + 1}: 목록에 없는 id라 버렸습니다.`);
    if (typeof o.text !== 'string' || o.text.trim() === '') return void warnings.push(`항목 ${i + 1}: 글이 없어 버렸습니다.`);
    if (seen.has(o.id)) return;
    seen.add(o.id);
    items.push({ id: o.id, text: o.text.trim().slice(0, MAX_LEN) });
  });
  return { items, warnings };
}

/** 문장을 증감 기록의 주요 내용에 넣는다(AI 초안 표시). 입력은 그대로 두고 새 목록을 돌려준다. */
export const applyAdjustTexts = (adjustments: Adjustment[], items: TextOut[]): Adjustment[] =>
  adjustments.map((a) => { const t = items.find((x) => x.id === a.id); return t ? { ...a, content: t.text, aiDraft: true } : a; });

/** 활동 이름을 진도 행의 주제에 넣는다(AI 초안 표시). 이름이 같으면 바꾸지 않는다. */
export const applyActivityNames = (rows: PlanRow[], items: TextOut[]): PlanRow[] =>
  rows.map((r) => { const t = items.find((x) => x.id === r.id); return t && t.text !== r.topic ? { ...r, topic: t.text, aiDraft: true } : r; });
