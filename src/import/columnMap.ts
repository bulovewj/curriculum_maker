import type { ColumnOut } from '../../api/_lib/types';
import type { Sheet } from './xlsx/readWorkbook';

/** 진도로 읽을 때 쓰는 목표 열(NEIS형 진도 xlsx의 머리글과 같은 이름) */
export const TARGETS = ['편제', '학기', '단원', '소단원', '학습내용', '쪽수', '보조쪽수', '해당차시', '전체차시', '준비물', '성취기준'] as const;
export type Target = (typeof TARGETS)[number];
/** 열 번호 → 목표 열(없으면 ''), 자신감 0~1 */
export type Mapping = Record<number, { target: Target | ''; confidence: number }>;

const compact = (s: string) => s.normalize('NFC').replace(/[\s*()（）]/g, '');

/** AI 없이 머리글 낱말로 짐작한다(자신감 0.6). 같은 목표를 두 열에 주지 않는다. */
export function guessColumns(headers: string[]): Mapping {
  const rules: [Target, RegExp][] = [
    ['편제', /^(과목|교과|편제)/], ['학기', /^학기/], ['소단원', /소단원|^단원명|소주제/], ['단원', /단원|대주제/],
    ['학습내용', /학습주제|학습내용|차시명|주제/], ['보조쪽수', /보조쪽/], ['쪽수', /쪽/], ['전체차시', /전체차시|총차시/],
    ['해당차시', /차시/], ['준비물', /준비물/], ['성취기준', /성취기준/],
  ];
  const used = new Set<Target>();
  const out: Mapping = {};
  headers.forEach((h, i) => {
    const t = rules.find(([target, re]) => !used.has(target) && re.test(compact(h)))?.[0];
    if (t) used.add(t);
    out[i] = { target: t ?? '', confidence: t ? 0.6 : 0 };
  });
  return out;
}

/** AI 답 → 열 맞추기. 목록 밖 열 번호·목표 이름은 버리고, 같은 목표가 겹치면 자신감 큰 쪽만 남긴다. */
export function mappingFromAi(output: unknown, columnCount: number): { mapping: Mapping; warnings: string[] } {
  const warnings: string[] = [];
  const mapping: Mapping = Object.fromEntries(Array.from({ length: columnCount }, (_, i) => [i, { target: '' as const, confidence: 0 }]));
  if (!Array.isArray(output)) return { mapping, warnings: ['AI 답이 목록 모양이 아니어서 버렸습니다.'] };
  const list = (output as Partial<ColumnOut>[]).filter((o): o is ColumnOut => {
    const ok = !!o && Number.isInteger(o.column) && o.column! >= 0 && o.column! < columnCount && (o.target === '' || TARGETS.includes(o.target as Target));
    if (!ok) warnings.push('목록 밖의 열이나 이름이 섞여 있어 그 부분은 버렸습니다.');
    return ok;
  }).sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0));
  const used = new Set<string>();
  for (const o of list) {
    if (!o.target || used.has(o.target)) continue;
    used.add(o.target);
    mapping[o.column] = { target: o.target as Target, confidence: Math.min(1, Math.max(0, Number(o.confidence) || 0)) };
  }
  return { mapping, warnings };
}

/** 머리글 줄: 앞쪽에서 글자가 있는 칸이 3개 이상인 첫 줄 */
export const findHeaderRow = (sheet: Sheet): number => Math.max(0, sheet.rows.findIndex((r) => r.filter((c) => c.trim() !== '').length >= 3));

/**
 * 고른 열 맞추기대로 NEIS형 진도 표(머리글 + 줄)를 만든다.
 * '1~2/20'처럼 해당차시와 전체차시가 한 칸에 있으면 둘로 나눈다. 편제 열이 없으면 fixedSubject로 채운다.
 */
export function buildStandardRows(sheet: Sheet, headerAt: number, mapping: Mapping, fixedSubject?: string): string[][] {
  const col = (t: Target) => Number(Object.keys(mapping).find((k) => mapping[Number(k)].target === t) ?? -1);
  const idx = Object.fromEntries(TARGETS.map((t) => [t, col(t)])) as Record<Target, number>;
  const head: string[] = [...TARGETS];
  const rows = sheet.rows.slice(headerAt + 1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const get = (t: Target) => (idx[t] < 0 ? '' : (r[idx[t]] ?? '').trim());
    let no = get('해당차시');
    let total = get('전체차시');
    const m = no.replace(/\s/g, '').match(/^(.+)\/(\d+)$/);
    if (m) { no = m[1]; total = total || m[2]; }
    return TARGETS.map((t) => (t === '해당차시' ? no : t === '전체차시' ? total : t === '편제' ? get('편제') || fixedSubject || '' : get(t)));
  });
  return [head, ...rows];
}
