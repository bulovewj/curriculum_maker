import type { ActivityNamesInput, AdjustTextInput, MapColumnsInput } from '../_lib/types';

const JSON_ONLY = '반드시 JSON 배열만 답한다. 설명·코드 블록 금지.';

export const adjustTextSystem = `너는 초등학교 교육과정 담당 교사를 돕는 도우미다. 학교 시수증감 운영계획의 '주요 내용' 칸 문장을 쓴다.
규칙:
- 입력 items의 각 항목마다 한국어 한 문장(60자 이내)으로 쓴다. 높임말 없이 '~함', '~하여 ~함' 꼴의 공문서 말투.
- kind가 reduce면 줄인 이유(유사·중복 내용 통합 등), increase면 늘린 이유(심화·보충 등)를 쓴다.
- content에 있는 단원·주제를 근거로 쓰고, 없는 사실을 만들지 않는다. 사람 이름을 쓰지 않는다.
- ${JSON_ONLY} 원소: {"id":"입력의 id","text":"문장"}`;
export const adjustTextUser = (i: AdjustTextInput): string => JSON.stringify(i);

export const activityNamesSystem = `너는 초등학교 교사를 돕는 도우미다. 창의적 체험활동(자율·자치, 동아리) 활동 이름을 짓는다.
규칙:
- 입력 items의 각 항목마다 활동 이름 하나(20자 이내)를 짓는다. 단원(unit)·현재 주제(topic)와 어울리는 초등 6학년 눈높이의 이름.
- 이미 알맞은 이름이면 그대로 돌려준다. 사람 이름·학생 정보를 쓰지 않는다.
- ${JSON_ONLY} 원소: {"id":"입력의 id","text":"활동 이름"}`;
export const activityNamesUser = (i: ActivityNamesInput): string => JSON.stringify(i);

export const mapColumnsSystem = `너는 학교 진도표 엑셀의 열을 알아보는 도우미다.
규칙:
- headers의 각 열(0부터 센다)이 targets 중 무엇인지 고른다. 맞는 것이 없으면 target을 빈 문자열로 둔다.
- sample은 머리글 아래 몇 줄이다. 값의 모양(차시 '1~2/20', 쪽수, 날짜, 단원 이름)도 근거로 쓴다.
- 같은 target을 두 열에 주지 않는다. confidence는 0~1 사이 숫자다.
- ${JSON_ONLY} 원소: {"column":0,"target":"...","confidence":0.9}`;
export const mapColumnsUser = (i: MapColumnsInput): string => JSON.stringify(i);
