import JSZip from 'jszip';
import { computeGrid } from '../engine/grid';
import { placeLessons } from '../engine/placeLessons';
import { bySlot } from '../engine/slots';
import type { PlanRow, Project, Semester, Subject } from '../model/types';
import { writeXlsx } from './xlsxWrite';

/** NEIS 교과진도 업로드 양식 머리글(작업지시서 6.3). `*`는 필수 열 */
export const NEIS_HEADERS = ['순번', '*학년', '*학기', '*편제', '단원', '학습내용', '쪽수', '보조쪽수', '해당차시', '전체차시', '준비물'];

/** 학습내용 = 학습 주제 + (태그가 있으면) ` 【태그, 태그】`. 행사 행은 행사명 */
const contentOf = (r: PlanRow) => {
  const base = r.kind === 'event' ? r.eventName ?? r.topic : r.topic;
  return r.tags.length ? `${base} 【${r.tags.join(', ')}】` : base;
};

/** 순서대로 놓인 행들 → NEIS 줄들(머리글 포함). 값은 모두 글자. */
export function neisRows(ordered: PlanRow[], subject: Subject, grade: number, semester: Semester): string[][] {
  const eis = subject.neisName ?? subject.name;
  return [
    NEIS_HEADERS,
    ...ordered.map((r, i) => [
      String(i + 1), String(grade), String(semester), eis, r.unit, contentOf(r), r.pages ?? '', r.subPages ?? '',
      r.n === undefined ? '' : String(r.n), r.total === undefined ? '' : String(r.total), r.materials ?? '',
    ]),
  ];
}

/** 대표 학급 배치 순서의 행들: 배치된 행(칸 순서) → 못 놓은 행 → 메모 행. */
export function orderedLessons(p: Project, subjectId: string, semester: Semester): PlanRow[] {
  const rows = (p.lessonPlans[subjectId] ?? []).filter((r) => r.semester === semester || r.semester === undefined);
  const res = placeLessons(computeGrid(p).slots, rows, subjectId);
  const placed = res.placed.filter((x) => x.row.semester === semester || x.row.semester === undefined).sort((a, b) => bySlot(a.slot, b.slot));
  return [...placed.map((x) => x.row), ...res.surplusRows, ...rows.filter((r) => r.kind === 'memo')];
}

export const neisFileName = (p: Project, s: Subject, semester: Semester) => `${p.grade}학년_${semester}학기_${s.neisName ?? s.name}_진도표.xlsx`;

/** 교과·학교자율시간마다·학기마다 xlsx 한 개, 전부 zip으로 묶는다. 창체 양식은 1차에 없다. */
export async function neisZip(p: Project): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const s of p.subjects.filter((x) => x.kind !== 'creative')) {
    for (const sem of [1, 2] as const) {
      const ordered = orderedLessons(p, s.id, sem);
      if (ordered.length === 0) continue;
      zip.file(neisFileName(p, s, sem), await writeXlsx({ empty0: neisRows(ordered, s, p.grade, sem) }));
    }
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}
