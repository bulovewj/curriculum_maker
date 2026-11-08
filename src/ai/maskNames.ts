// AI로 보내는 글에서 사람 이름을 역할명으로 바꾼다 (CLAUDE.md: AI로 보내는 데이터는 maskNames()를 거칠 것).
// 1차 모델에는 이름이 없지만, 파일 글자에 섞여 들어올 때를 막는 안전장치다.

const ROLE: Record<string, string> = { 선생님: '담당 교사', 교사: '담당 교사', 강사: '강사', 교장: '교장', 교감: '교감', 담임: '담임' };
// 직함 앞에 와도 사람 이름이 아닌 흔한 낱말
const NOT_NAME = new Set(['전담', '보건', '영양', '상담', '교과', '학급', '영어', '체육', '과학', '음악', '미술', '실과', '원어민', '특수', '사서', '방과후', '담당', '학년', '협력', '수석']);

/** 글 하나에서 이름을 바꾼다. names = 이미 알고 있는 이름 목록(있으면 어디에 있든 바꾼다). */
export function maskText(text: string, names: string[] = []): string {
  let out = text;
  for (const n of names.filter((x) => x.length >= 2)) out = out.split(n).join('담당 교사');
  // '홍길동 선생님' 꼴: 이름 3글자 + 직함
  out = out.replace(/([가-힣]{3})(\s*)(선생님|교사|강사|교장|교감|담임)/g, (m, name: string, _sp: string, title: string) =>
    NOT_NAME.has(name) || NOT_NAME.has(name.slice(0, 2)) ? m : ROLE[title]);
  // '교사: 홍길동' 꼴
  out = out.replace(/(교사|강사|담당|작성자|제안자)(\s*[:：]\s*)([가-힣]{2,4})/g, (_m, label: string, sep: string) => `${label}${sep}${ROLE[label] ?? '담당자'}`);
  return out;
}

/** 값 안의 모든 글자를 바꾼다(객체·배열 깊이 따라감). 입력을 바꾸지 않고 새 값을 돌려준다. */
export function maskNames<T>(value: T, names: string[] = []): T {
  if (typeof value === 'string') return maskText(value, names) as T;
  if (Array.isArray(value)) return value.map((v) => maskNames(v, names)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskNames(v, names)])) as T;
  return value;
}
