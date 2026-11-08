// 서버 함수와 브라우저가 같이 쓰는 요청·응답 모양 (작업지시서 F9)
export type AiTask = 'adjustCandidates' | 'adjustText' | 'activityNames' | 'mapColumns';

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export type AiResponse = { ok: true; output: unknown; usage: AiUsage } | { ok: false; error: string };

export interface ModelCall {
  model: string;
  system: string;
  user: string;
}

/** Claude를 부르는 함수. 테스트에서는 가짜로 바꿔 끼운다(실제 호출 없음). */
export type CallModel = (call: ModelCall) => Promise<{ text: string; usage: AiUsage }>;

export interface AdjustInput {
  subject: { id: string; name: string };
  semester: number;
  need: number; // 감축 필요(+) / 증배 필요(-)
  rows: { id: string; unit: string; topic: string; n?: number; total?: number; standards: string[] }[];
  standards: string[]; // 쓸 수 있는 성취기준 목록(들어온 파일에 있는 것만)
}

export type CandidateKind = 'merge' | 'remove' | 'split' | 'add';

export interface Candidate {
  kind: CandidateKind;
  rowId: string;
  topic?: string; // add·split에서 새 주제
  reason: string;
  standards: string[];
}

/** adjustText: 증감 기록마다 '주요 내용' 한 문장 */
export interface AdjustTextInput {
  items: { id: string; subject: string; semester: number; kind: 'reduce' | 'increase'; area: string; unit: string; content: string }[];
}
/** activityNames: 자율·자치·동아리 활동 이름 */
export interface ActivityNamesInput {
  subject: string;
  items: { id: string; unit: string; topic: string }[];
}
/** mapColumns: 모르는 양식의 열 → 목표 열 */
export interface MapColumnsInput {
  headers: string[];
  sample: string[][]; // 머리글 아래 몇 줄
  targets: string[]; // 목표 열 이름
}
export interface TextOut { id: string; text: string }
export interface ColumnOut { column: number; target: string; confidence: number }
