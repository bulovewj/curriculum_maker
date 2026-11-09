# 내 손 안의 교육과정 (가칭)

학교 파일(학사일정·전담 시간표·편제·진도)을 넣으면 **주별 시수표·진도표·시간 운영계획·시수증감 운영계획(hwpx)**과 **NEIS 업로드 엑셀**을 만드는 앱입니다. 내 컴퓨터에서 실행하고, 계산은 알고리즘(같은 입력 → 같은 결과), 글은 AI 초안, 확정은 교사가 합니다. AI를 꺼도 계산·출력은 전부 동작합니다.

## 설치와 실행
```
npm install
npm run dev        # http://127.0.0.1:5173 (이미 켜져 있으면 그 창을 쓰세요)
```
- 확인 명령: `npm test`(정답지 포함) · `npm run typecheck` · `npm run build`

## 쓰는 순서 (왼쪽 단계 목록)
1. **기본 정보** — 학교, 학년도, 학년, 대표 학급, 학교자율시간 이름(예: 신명똑디)
2. **파일 넣기** — 학사일정 xlsx, 전담 시간표 xlsx, 작년·올해 편제(hwpx), 교과별 진도(xlsx·hwpx)를 끌어다 놓고 카드마다 [확정]. 모르는 xlsx는 [열 맞추기]. 개발 중에는 [2026 샘플 넣기]로 2026 신명초 자료를 한 번에 넣을 수 있습니다.
3. **학사력·시간표** — 달력의 교시 수 고치기, [기초 시간표 자동 만들기]
4. **편제** — 학기 나누기, 시수 옮길 때 가져올 교과 순서
5. **주별 시수표** — 작년 시수표 가져오기, [자동 맞추기](미리 보기 후 적용), 교과 칸 눌러 옮기기
6. **진도** — 교과별 필요량 확인, 합치기·빼기·나누기·더하기·행사·태그·주 고정, AI 후보·AI 글쓰기
7. **점검·출력** — 규정 검사(빨강·노랑·통과), hwpx·엑셀 내려받기

위쪽 [↶ 되돌리기]로 최근 작업을 취소할 수 있고(30개까지), [내보내기]로 프로젝트 파일(JSON)을 보관합니다. 데이터는 이 브라우저(IndexedDB)에 저장됩니다.

## AI (선택)
`.env.example`을 `.env.local`로 복사하고 키를 **한 가지**만 넣으세요(`ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY`). 모델 이름은 같은 파일의 `AI_MODEL_*`. 서버를 껐다 켜면 적용됩니다. S1의 "AI 도우미 사용"을 체크하면 S2·S6에 AI 단추가 보입니다. 키는 `.env.local`에만 두세요(git에 올라가지 않습니다). 키를 `.env.example`에 넣으면 안 됩니다.

## 협업자와 같이 쓰는 배포(AI 포함, 접속 비밀번호)
앱 화면은 GitHub Pages(정적 파일)로도 올라가지만, AI는 키가 필요한 서버가 있어야 해서 **Vercel**에 올립니다. 접속 비밀번호와 API 키는 **Vercel 환경변수에만** 넣습니다(코드·git·README에는 쓰지 않습니다).
1. [vercel.com](https://vercel.com) → Add New → Project → 이 GitHub 저장소 가져오기(프레임워크는 Vite로 자동 인식).
2. Environment Variables에 넣기: `OPENAI_API_KEY`(또는 `ANTHROPIC_API_KEY`), `AI_MODEL_FAST`·`AI_MODEL_SMART`(예: gpt-4o-mini), `APP_PASSWORD`(접속 비밀번호), `VITE_REQUIRE_PASSWORD`=`1`, GitHub Pages에서도 부르려면 `ALLOWED_ORIGIN`=`https://bulovewj.github.io`.
3. Deploy → 나온 주소(예: https://○○.vercel.app)를 협업자에게 알려 주면, 처음 접속 때 비밀번호를 묻고 AI도 됩니다.
4. (선택) GitHub Pages 쪽에서도 AI를 쓰려면 저장소 Settings → Secrets and variables → Actions → Variables에 `API_BASE`=Vercel 주소를 넣습니다.
- 비밀번호는 서버가 확인합니다(틀리면 AI 호출이 막힘). 화면 파일 자체는 정적 파일이라 비밀번호 앞에서도 내려받을 수 있으니, 비밀번호는 AI 사용량을 지키는 용도입니다. **숫자 4자리는 짧습니다.** 더 긴 값으로 바꾸려면 Vercel의 `APP_PASSWORD`만 고치고 다시 배포하세요.
- OpenAI 대시보드에서 프로젝트 월 사용 한도(Budget)를 꼭 걸어 두세요.

## 매년 할 일
- 새 학년도 프로젝트를 만들고(S0), 학사일정·전담 시간표·편제·진도를 새 파일로 넣습니다.
- 기준 숫자(교육부 기준 시수, ±20% 등)는 `data/standards/*.json`에서 바꿉니다. 코드에는 숫자를 넣지 않습니다.
- 정답지 기대값을 새로 만들 때는 `npm run expected`(기대값 JSON을 손으로 고치지 마세요), 빈 양식은 `npm run templates`.

## 형이 해야 하는 확인
- 받은 hwpx를 **한글**에서 열어 깨짐·쪽 이어짐·머리 줄 반복·시간 운영계획 학기마다 한 쪽을 확인합니다(`templates/*.hwpx`도 같이).
- 2026 원본과 나란히 놓고 눈으로 비교하고, 다른 점은 `fixtures/2026-g6/expected/예외.md`에 이유를 적습니다.
- R9 빨강(편제 학기 배분 ≠ 주별 시수표)은 교육과정 담당자와 같이 확인합니다.

## 문제가 생기면
- 몇 번 단계(S1~S7)에서, 화면에 뜬 문장(스크린샷), 어떤 파일을 넣었는지 알려 주세요.
- 한글에서 안 열리는 hwpx는 파일 이름만 알려 주세요.
- 개발 서버가 안 켜지면 5173번이 이미 쓰이는 것입니다. 켜진 창을 쓰거나 끄고 다시 실행하세요.
- AI가 가끔 안 되면 잠시 뒤 다시 누르세요(자동으로 몇 번 다시 시도합니다).

## 보안 규칙
- `reference/`, `fixtures/**/원본/`은 git에 올리지 않습니다(교사 이름 포함). 학생 정보(이름·성적·평가)는 받지 않습니다.
- AI로 보내는 글은 `maskNames()`로 사람 이름을 가린 뒤 보냅니다. 키는 브라우저 코드·git에 넣지 않습니다.

## 폴더
`docs/` 작업지시서·기획서 · `data/standards/` 기준 데이터 · `templates/` hwpx 양식 · `api/` AI 서버 함수 · `scripts/` 개발용 · `tests/golden/` 정답지 테스트 · `src/`(model engine import export storage state ai lib screens components dev)
