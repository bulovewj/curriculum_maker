import type { ImportKind } from '../model/types';
import { norm } from './hwpx/cells';
import { readHwpx, tablesOf } from './hwpx/readHwpx';
import { readWorkbook } from './xlsx/readWorkbook';

/** 판별 결과. 안내할 일이 있으면 notice에 화면에 그대로 보여 줄 문장. */
export interface Detected {
  kind: ImportKind;
  notice?: string;
}

export const NOTICES = {
  hwp: "한글에서 [다른 이름으로 저장] → 'HWPX'로 저장해서 다시 올려 주세요.",
  pdf: '1차에서는 PDF를 읽지 않습니다.',
  broken: '파일을 열 수 없습니다(암호가 걸려 있거나 손상).',
  autonomy: '학교자율시간 운영(안)은 넣지 않아도 됩니다. 차시는 진도 파일에서 읽습니다.',
  other: '지원하지 않는 파일 형식입니다(xlsx, hwpx만 읽습니다).',
} as const;

const has = (cells: string[], word: string) => cells.some((c) => c === word);

/** xlsx: 시트 이름과 첫 줄(머리글)로 판별 (작업지시서 6.1) */
async function detectXlsx(data: ArrayBuffer): Promise<Detected> {
  const sheets = await readWorkbook(data);
  const names = sheets.map((s) => norm(s.name));
  if (names.some((n) => n.includes('학년별수업시수변동'))) return { kind: 'scheduleP04' };
  if (names.some((n) => n.includes('전담시간표') || n.includes('반별시간표'))) return { kind: 'timetableP02' };
  for (const s of sheets) {
    for (const row of s.rows.slice(0, 5)) {
      const cells = row.map(norm);
      const plain = cells.map((c) => c.replace('*', ''));
      if (has(plain, '편제') && has(plain, '학습내용') && has(plain, '해당차시')) {
        return { kind: has(cells, '*편제') ? 'neisLessons' : 'publisherLessons' };
      }
    }
  }
  return { kind: 'unknown' };
}

/** hwpx: 표 안 글자로 판별 */
async function detectHwpx(data: ArrayBuffer): Promise<Detected> {
  const tables = tablesOf(await readHwpx(data));
  const cells = tables.map((t) => t.cells.map((c) => norm(c.text)));
  const any = (pred: (c: string[]) => boolean) => cells.some(pred);
  if (any((c) => c.some((x) => x.includes('교육과정연간지도')))) return { kind: 'progressHwpx' };
  if (any((c) => c.some((x) => x.includes('시수책정표') || x.startsWith('교과및창의적체험활동'))) ) return { kind: 'timePlanHwpx' };
  if (any((c) => has(c, '학년군') && has(c, '본교기준') && has(c, '본교시수'))) return { kind: 'curriculumHwpx' };
  if (any((c) => c.some((x) => x.includes('교육부기준시수')) && c.some((x) => x.includes('본교운영시수')))) return { kind: 'planAdjustHwpx' };
  if (any((c) => c.some((x) => x.includes('대상및시수')) && has(c, '주제명'))) return { kind: 'autonomyHwpx', notice: NOTICES.autonomy };
  return { kind: 'unknown' };
}

/** 파일 이름·내용으로 종류 알아보기. 열 수 없으면 broken 안내. */
export async function detectFile(fileName: string, data: ArrayBuffer): Promise<Detected> {
  const ext = fileName.normalize('NFC').toLowerCase().split('.').pop() ?? '';
  if (ext === 'hwp') return { kind: 'unknown', notice: NOTICES.hwp };
  if (ext === 'pdf') return { kind: 'unknown', notice: NOTICES.pdf };
  if (ext !== 'xlsx' && ext !== 'hwpx') return { kind: 'unknown', notice: NOTICES.other };
  try {
    return await (ext === 'xlsx' ? detectXlsx(data) : detectHwpx(data));
  } catch {
    return { kind: 'unknown', notice: NOTICES.broken };
  }
}
