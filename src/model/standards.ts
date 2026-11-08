// 기준 데이터(data/standards/*.json)의 모양. 기준 숫자는 코드에 두지 않고 이 파일 형식의 JSON에서 읽는다.
export interface GradeBand {
  grades: number[];
  years: number;
  hours: Record<string, number>; // 교과(군) 이름 → 학년군 시수. 이름은 Subject.group과 같다
  total: number;
  source: string;
  note?: string;
}

export interface TagRule {
  id: string;
  name: string;
  aliases: string[]; // 진도표 【】 표기
  grades: number[];
  min: number;
  unit: string;
  period: string;
  gradeShare: boolean; // 학년 몫이 정해진 항목인가(아니면 R10은 횟수만 표시)
  source: string;
  note?: string;
}

export interface Standards {
  version: string;
  schoolDays: { min: number; source: string };
  minutesPerHour: { value: number; source: string };
  adjustRange: { percent: number; source: string };
  noReduce: { groups: string[]; source: string };
  gradeBands: Record<string, GradeBand>;
  informatics: Record<string, { min: number; tag: string; subjects: string[]; source: string }>;
  autonomy: Record<string, number | string> & { minSemesters: number; source: string };
  tags: TagRule[];
}

export type Level = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  ruleId: string;
  level: Level;
  message: string;
  where: { semester?: 1 | 2; week?: number; subjectId?: string; hours: number }[];
  source: string;
}
