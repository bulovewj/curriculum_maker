import type { AiResponse, AiTask } from '../../api/_lib/types';
import { maskNames } from './maskNames';

export const AI_OFF = 'AI 꺼짐(서버 연결 안 됨)';

/** 서버 함수가 살아 있는지. `npm run dev`만 켜면(vercel dev 아님) /api/ai가 JSON이 아니라서 false. */
export async function aiAvailable(fetchFn: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchFn('/api/ai');
    const data = (await res.json()) as { ok?: boolean };
    return res.ok && data.ok === true;
  } catch {
    return false;
  }
}

/** AI 작업 부르기. 보내기 전에 maskNames()를 거치고, 연결이 안 되면 'AI 꺼짐' 오류를 돌려준다. */
export async function callAi(task: AiTask, input: unknown, names: string[] = [], fetchFn: typeof fetch = fetch): Promise<AiResponse> {
  try {
    const res = await fetchFn('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, input: maskNames(input, names) }) });
    const data = (await res.json()) as AiResponse;
    return data && typeof data.ok === 'boolean' ? data : { ok: false, error: AI_OFF };
  } catch {
    return { ok: false, error: AI_OFF };
  }
}
