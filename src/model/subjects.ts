import type { Subject } from './types';

// 작업지시서 2.1 (6학년 기본값). 순서 = 시간 운영계획 열 순서.
type Row = [string, string, Subject['kind'], string, string, string, string?];
const rows: Row[] = [
  ['kor', '국어', 'subject', '국어', '국', '국어', '국어'],
  ['autonomy', '학교자율시간', 'autonomy', '국어', '', '학교자율시간', '학교자율시간'],
  ['soc', '사회', 'subject', '사회/도덕', '사', '사회', '사회'],
  ['mor', '도덕', 'subject', '사회/도덕', '도', '도덕', '도덕'],
  ['math', '수학', 'subject', '수학', '수', '수학', '수학'],
  ['sci', '과학', 'subject', '과학/실과', '과', '과학', '과학'],
  ['prac', '실과', 'subject', '과학/실과', '실', '실과', '실과'],
  ['pe', '체육', 'subject', '체육', '체', '체육', '체육'],
  ['music', '음악', 'subject', '예술(음악/미술)', '음', '음악', '음악'],
  ['art', '미술', 'subject', '예술(음악/미술)', '미', '미술', '미술'],
  ['eng', '영어', 'subject', '영어', '영', '영어', '영어'],
  ['ca-self', '자율·자치', 'creative', '창체', '창', '자율⋅자치활동'],
  ['ca-club', '동아리', 'creative', '창체', '동', '동아리 활동'],
  ['ca-career', '진로', 'creative', '창체', '', '진로 활동'],
];

export const defaultSubjects: Subject[] = rows.map(
  ([id, name, kind, group, code, progressTitle, neisName], order) => ({
    id, name, kind, group, progressTitle, neisName, order,
    timetableCodes: code ? [code] : [],
    aliases: [],
  }),
);

/** 학교자율시간 이름을 바꾸면 진도표 제목·NEIS 편제도 같이 바꾼다. */
export function renameAutonomy(subjects: Subject[], name: string): Subject[] {
  return subjects.map((s) =>
    s.kind === 'autonomy' ? { ...s, name, progressTitle: name, neisName: name } : s,
  );
}
