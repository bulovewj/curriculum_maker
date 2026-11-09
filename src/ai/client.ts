import type { AiResponse, AiTask } from '../../api/_lib/types';
import { maskNames } from './maskNames';

// 배포 때만 다른 주소의 서버를 쓴다(GitHub Pages → Vercel). 비워 두면 같은 주소(/api/ai). 주소는 비밀이 아니다.
const API = `${(import.meta.env.VITE_API_BASE as string | undefined) ?? ''}/api/ai`;
const PW_KEY = 'app-pw';

/** 접속 비밀번호(이 탭에만 기억, 탭을 닫으면 사라짐) */
export const savedPassword = (): string => { try { return sessionStorage.getItem(PW_KEY) ?? ''; } catch { return ''; } };
export const savePassword = (pw: string): void => { try { pw ? sessionStorage.setItem(PW_KEY, pw) : sessionStorage.removeItem(PW_KEY); } catch { /* 저장 안 돼도 동작 */ } };
const authHeader = (): Record<string, string> => (savedPassword() ? { 'x-app-password': encodeURIComponent(savedPassword()) } : {}); // 한글도 헤더로 보내도록 인코딩

const MODEL_KEY = 'ai-model';
/** 모델 변경용 비밀번호(요청에 따라 일부러 코드에 둔다. 화면 잠금일 뿐 보안 장치가 아니다) */
export const MODEL_PASSWORD = '3430';
export const LUNA = 'gpt-6-luna';
/** 이 탭에서 gpt-6-luna를 켜 뒀는지(기본은 꺼짐 = 서버 기본 모델) */
export const lunaOn = (): boolean => { try { return sessionStorage.getItem(MODEL_KEY) === LUNA; } catch { return false; } };
export const setLuna = (on: boolean): void => { try { on ? sessionStorage.setItem(MODEL_KEY, LUNA) : sessionStorage.removeItem(MODEL_KEY); } catch { /* 저장 안 돼도 동작 */ } };

export const AI_OFF = 'AI 꺼짐(서버 연결 안 됨)';

/** 서버 함수가 살아 있는지. `npm run dev`만 켜면(vercel dev 아님) /api/ai가 JSON이 아니라서 false. */
export async function aiAvailable(fetchFn: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchFn(API, { headers: authHeader() });
    const data = (await res.json()) as { ok?: boolean };
    return res.ok && data.ok === true;
  } catch {
    return false;
  }
}

/** AI 작업 부르기. 보내기 전에 maskNames()를 거치고, 연결이 안 되면 'AI 꺼짐' 오류를 돌려준다. */
export async function callAi(task: AiTask, input: unknown, names: string[] = [], fetchFn: typeof fetch = fetch): Promise<AiResponse> {
  try {
    const res = await fetchFn(API, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeader() }, body: JSON.stringify({ task, input: maskNames(input, names), ...(lunaOn() ? { model: LUNA } : {}) }) });
    if (res.status === 401) savePassword(''); // 비밀번호가 바뀌었거나 틀림: 다시 입력하게 한다
    const data = (await res.json()) as AiResponse;
    return data && typeof data.ok === 'boolean' ? data : { ok: false, error: AI_OFF };
  } catch {
    return { ok: false, error: AI_OFF };
  }
}

/** 접속 비밀번호 확인: ok / wrong / down(서버에 못 닿음) */
export async function checkPassword(pw: string, fetchFn: typeof fetch = fetch): Promise<'ok' | 'wrong' | 'down'> {
  try {
    const res = await fetchFn(API, { headers: pw ? { 'x-app-password': encodeURIComponent(pw) } : {} });
    const data = (await res.json()) as { ok?: boolean; authed?: boolean };
    return data.ok && data.authed ? 'ok' : data.ok ? 'wrong' : 'down';
  } catch {
    return 'down';
  }
}
