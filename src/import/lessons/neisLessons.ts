import type { PlanRow, Semester, Subject, SubjectId } from '../../model/types';
import type { Sheet } from '../xlsx/readWorkbook';

export interface LessonFile {
  fileName: string;
  sheets: Sheet[];
}

export interface LessonResult {
  rows: PlanRow[];
  warnings: string[];
  unknownNames: string[]; // 모르는 편제 이름(화면에서 노란 칸)
}

const COLS = ['학기', '편제', '단원', '소단원', '학습내용', '쪽수', '보조쪽수', '해당차시', '전체차시', '준비물', '성취기준'] as const;
type Col = (typeof COLS)[number];

const norm = (s: string) => s.normalize('NFC').replace(/\s/g, '');

/** 편제 이름 → 교과 id. name·neisName·aliases 중 하나와 같으면. */
export function subjectByName(subjects: Subject[], name: string): SubjectId | undefined {
  const key = norm(name);
  return subjects.find((s) => [s.name, s.neisName ?? '', ...s.aliases].some((n) => n && norm(n) === key))?.id;
}

/** 학습내용 끝 【태그, 태그】 떼기 */
export function splitTags(text: string): { topic: string; tags: string[] } {
  const m = text.match(/^(.*?)\s*【([^】]*)】\s*$/);
  if (!m) return { topic: text.trim(), tags: [] };
  return { topic: m[1].trim(), tags: m[2].split(',').map((t) => t.trim()).filter(Boolean) };
}

/** 해당차시 → [차시, 펼친 번호(-k-), 펼친 수]. '3' / '3~4' / '5~6(1)'. 못 읽으면 빈 배열. */
export function expandLessonNo(raw: string): { n: number; part?: number }[] {
  const s = raw.replace(/\s/g, '');
  if (/^\d+$/.test(s)) return [{ n: Number(s) }];
  const m = s.match(/^(\d+)~(\d+)(?:\((\d+)\))?$/);
  if (!m) return [];
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (m[3]) return [{ n: a + Number(m[3]) - 1, part: Number(m[3]) }];
  return Array.from({ length: b - a + 1 }, (_, i) => ({ n: a + i, part: i + 1 }));
}

function headerIndex(rows: string[][]): { at: number; col: Partial<Record<Col, number>> } | undefined {
  const at = rows.findIndex((r) => {
    const h = r.map((c) => c.replace('*', ''));
    return h.includes('편제') && h.includes('학습내용') && h.includes('해당차시');
  });
  if (at < 0) return undefined;
  const col: Partial<Record<Col, number>> = {};
  rows[at].forEach((c, i) => {
    const k = c.replace('*', '') as Col;
    if (COLS.includes(k)) col[k] = i;
  });
  return { at, col };
}

/** NEIS형(학교)·출판사 나이스 업로드용 진도 xlsx 여러 개 → PlanRow[] (작업지시서 6.2 라) */
export function readNeisLessons(files: LessonFile[], subjects: Subject[], includeOptional = false): LessonResult {
  const rows: PlanRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const unknown = new Set<string>();

  for (const { fileName, sheets } of files) {
    const sheet = sheets.find((s) => headerIndex(s.rows));
    const h = sheet && headerIndex(sheet.rows);
    if (!sheet || !h) {
      warnings.push(`${fileName}: 진도표 머리글(편제·학습내용·해당차시)을 찾지 못했습니다.`);
      continue;
    }
    const get = (r: string[], k: Col) => (h.col[k] === undefined ? '' : (r[h.col[k]] ?? ''));

    sheet.rows.slice(h.at + 1).forEach((r, i) => {
      const line = h.at + i + 2; // 엑셀 행 번호
      const subjectName = get(r, '편제');
      const rawTopic = get(r, '학습내용');
      if (!subjectName && !rawTopic) return; // 빈 줄
      const subjectId = subjectByName(subjects, subjectName);
      if (!subjectId) {
        if (!unknown.has(subjectName)) warnings.push(`${fileName}: 모르는 편제 '${subjectName}'(${line}행부터) — 건너뜀`);
        unknown.add(subjectName);
        return;
      }
      const lessonNo = get(r, '해당차시');
      if (lessonNo === '자율' && !includeOptional) return;
      const unit = get(r, '단원');
      const { topic, tags } = splitTags(rawTopic);
      const sem = Number(get(r, '학기'));
      const isEvent = unit.startsWith('◈');
      const parts = lessonNo === '자율' ? [{ n: 0 }] : expandLessonNo(lessonNo);
      if (lessonNo && lessonNo !== '자율' && parts.length === 0) {
        warnings.push(`${fileName} ${line}행: 해당차시 '${lessonNo}'를 읽지 못해 메모로 둡니다.`);
      }
      const base = {
        subjectId,
        semester: sem === 1 || sem === 2 ? (sem as Semester) : undefined,
        unit,
        total: Number(get(r, '전체차시')) || undefined,
        pages: get(r, '쪽수') || undefined,
        subPages: get(r, '보조쪽수') || undefined,
        materials: get(r, '준비물') || undefined,
        rawNote: get(r, '소단원') ? `소단원: ${get(r, '소단원')}` : undefined,
        standards: [...get(r, '성취기준').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]),
        tags,
        source: { file: fileName, row: line },
      };
      const list = parts.length ? parts : [{ n: 0 }];
      list.forEach((p, k) => {
        const row: PlanRow = {
          ...base,
          id: `${fileName}#${line}#${k}`,
          kind: parts.length === 0 ? 'memo' : isEvent ? 'event' : 'lesson',
          topic: p.part ? `${topic} -${p.part}-` : topic,
          n: p.n || undefined,
          eventName: isEvent ? unit.slice(1).trim() : undefined,
        };
        const key = [subjectId, row.semester, unit, row.topic, row.n].join('|');
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(row);
      });
    });
  }
  return { rows, warnings, unknownNames: [...unknown] };
}
