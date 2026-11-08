# 내 손 안의 교육과정 (가칭)

## 개요
- 학교 파일(학사일정·시간표·편제·진도)을 넣으면 주별 시수표·진도표·시간 운영계획·시수증감 운영계획(hwpx)·NEIS 업로드 엑셀을 만드는 웹앱. 최종 목표: 2028학년도 편성 시즌에 스쿨마스터 완전 대체.
- 지금은 1차: 원진 혼자, 6학년 대표 학급, 내 컴퓨터에서 실행. 정답지 = 2026 신명초 6학년 실제 문서(`fixtures/2026-g6/`).
- 원칙: 계산은 알고리즘(같은 입력 → 같은 결과), 글은 AI 초안, 확정은 교사. AI가 꺼져도 계산·출력은 전부 동작.

## 기술 스택
- Vite + React + TypeScript(strict), 상태는 useState/Context만. `src/engine`은 순수 함수(UI·저장·네트워크 import 금지) + Vitest
- 저장: IndexedDB(idb-keyval) + JSON 내보내기. `src/storage`의 `ProjectStore`로만 접근(2차에 Supabase로 교체)
- xlsx: exceljs / hwpx: jszip + @xmldom/xmldom, 출력은 `templates/` 빈 양식 + 본문 XML. hwp·pdf는 1차 미지원
- AI: Vercel 서버 함수 `api/ai.ts` → Claude API. 키는 `.env.local`, 실행 `vercel dev`
- 명령: `npm run dev` / `npm test` / `npm run typecheck` / `npm run build` / `npm run expected`

## 폴더 구조
```
docs/ 작업지시서·기획서     reference/ 원진 자료(읽기 전용, git 제외)
fixtures/2026-g6/ 원본/(읽기 전용, git 제외) · expected/(기대값 JSON, git 포함) · 추출/(PDF에서 뽑은 진도, git 포함)
data/standards/ 기준 데이터   templates/ hwpx 양식   api/ 서버 함수   scripts/ 개발용
tests/golden/ 정답지 테스트
src/ model engine import export storage state ai lib screens components dev
```

## 코딩 컨벤션
- 파일 200줄 초과 금지. 컴포넌트·타입 PascalCase, 함수·변수 camelCase. 화면 문구·주석은 한국어
- 도메인 이름 고정: slot, PlanRow(진도 행), adjustment(증감 기록), curriculumPlan(편제), event, baseTimetable, representativeClass, creative(창체), autonomy(학교자율시간), tags(범교과)
- 날짜는 `'YYYY-MM-DD'`, 계산은 `src/lib/dates.ts`(UTC)로만. 엔진은 입력 → 새 출력(받은 객체 수정 금지), 함수마다 테스트
- 화면 1개 = `src/screens/` 폴더 1개. 100줄 넘는 UI 덩어리는 `components/`로

## 하지 말 것
- 새 라이브러리 설치 전 반드시 물어볼 것 / any 타입 금지 / 지시받지 않은 파일 수정 금지
- `npm create vite`를 이 폴더에서 실행 금지(기존 파일 삭제 위험)
- `reference/`, `fixtures/**/원본/` 수정·삭제 금지, git에 올리지 말 것(교사 이름 포함)
- 학생 정보(이름·성적·평가) 받는 기능 금지. 교사·강사 이름도 1차에선 읽지 않음
- AI로 보내는 데이터는 `maskNames()` 거칠 것. API 키를 브라우저 코드·git에 넣지 말 것(`VITE_` 접두사 금지)
- 기준 숫자(190, 2176, ±20% 등) 하드코딩 금지 → `data/standards/*.json`. 엔진에서 Math.random·현재 시각 금지
- 정답지 테스트가 깨진 채로 마무리 금지. 기대값 JSON을 손으로 고치지 말 것

## 현재 상태 (⬜ 미착수 · 🔄 진행 중 · ✅ 완료)
| M | 내용 | 상태 | M | 내용 | 상태 |
|---|---|---|---|---|---|
| 1 | 빈 앱 | ✅ | 12 | 재구성·행사·태그 편집 | ✅ |
| 2 | 모델·저장소·화면 뼈대 | ✅ | 13 | 기준 데이터·규정 검사 | ✅ |
| 3 | xlsx 읽기·NEIS형 진도 | ✅ | 14 | NEIS 엑셀·점검표 출력 | ⬜ |
| 4 | hwpx 읽기 | ✅ | 15 | hwpx 쓰기·진도표 출력 | ⬜ |
| 5 | 학사일정·시간표 매퍼 | ✅ | 16 | 운영계획·증감계획 hwpx → 관문 | ⬜ |
| 6 | 편제·진도표·자율시간·운영계획 매퍼 | ✅ | 17 | AI 서버 함수·재구성 후보 | ⬜ |
| 7 | 정답지 기대값 JSON | ✅ | 18 | AI 문장·활동명 | ⬜ |
| 8 | 파일 넣기·해석 확인 화면 | ✅ | 19 | AI 모르는 양식 열 맞추기 | ⬜ |
| 9 | 칸 표·주별 시수표(정답지 A) | ✅ | 20 | 화면 다듬기 | ⬜ |
| 10 | 진도 배치(정답지 B) | ✅ | 21 | 1차 정리 | ⬜ |
| 11 | 편제 화면·자동 맞추기(정답지 C) | ✅ | 11b | 기초 시간표 자동 생성(정답지 D) | ⬜ |

### 다음 세션 메모
- 개발 서버는 5173번 고정(`strictPort`). 이미 켜져 있으면 `npm run dev`가 오류로 멈춘다. 켜진 서버를 쓰거나 끄고 다시 실행
- `?dev` 화면 = 진도 xlsx·hwpx 읽기 결과 확인용(개발 전용). hwpx 원본 안내 표(안건 표)에 교사 이름이 있으니 테스트·기대값에 옮기지 말 것
- `npm run expected`(tsx) = 정답지 기대값 JSON 다시 만들기 + totals.json 대조. 기대값 JSON은 손으로 고치지 말 것. `curriculum.json`은 계획에 없던 추가 파일(CUR 읽은 값)
- `@types/node` 없음 → 테스트용 Node 함수는 `tests/node.d.ts`에 직접 선언
- 2026-11-08 협업 교사 검토 반영: 준비물은 학사일정·전담 시간표·작년·올해 편제(학년군 편제표)·진도. 기초 시간표는 자동 생성(M11b), 학교자율시간 운영(안)은 받지 않음(작업지시서 1장·2.8·12장)
- 학기 중 행사로 주별 값이 바뀌는 것이 정상. 시점이 다른 문서끼리 주별 일치를 가정하지 말 것(작업지시서 2.7)

## 참조
- 명세 `docs/작업지시서.md`, 마일스톤 상세 `CODING_PLAN.md`, 배경 `docs/기획서.md`, 자료 검토 `레퍼런스 검토 결과.md`. 필요할 때만 읽을 것.
- 번호 주의: 'M+숫자'는 마일스톤. 기획서·레퍼런스 검토 결과의 'M1~M16'은 기능 모듈 번호(작업지시서에선 F1~F9).
