// 서버 함수의 비밀번호 검사와 다른 주소(GitHub Pages)에서 부르는 것(CORS) 허용.
// 비밀번호 값은 코드·git에 없다. 서버 환경변수 APP_PASSWORD에만 있다.
export interface AuthEnv {
  APP_PASSWORD?: string;
  VERCEL?: string; // Vercel 위에서 돌 때만 있다
  ALLOWED_ORIGIN?: string; // 쉼표로 여러 개: https://bulovewj.github.io
}

/** 같은 길이로 끝까지 비교(앞에서 멈추지 않는다) */
const same = (a: string, b: string) => {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
};

export type Access = 'ok' | 'wrong' | 'unset';

/** 요청의 비밀번호가 맞는지. 서버에 APP_PASSWORD가 없으면 내 컴퓨터(개발)에서만 통과, Vercel에서는 막는다. */
export function accessOf(request: Request, env: AuthEnv): Access {
  if (!env.APP_PASSWORD) return env.VERCEL ? 'unset' : 'ok';
  let sent = request.headers.get('x-app-password') ?? '';
  try { sent = decodeURIComponent(sent); } catch { /* 그대로 비교 */ } // 한글 같은 글자는 주소 인코딩으로 온다
  return same(sent, env.APP_PASSWORD) ? 'ok' : 'wrong';
}

/** 허용한 주소에서 온 요청에만 CORS 헤더를 붙인다 */
export function corsHeaders(request: Request, env: AuthEnv): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = (env.ALLOWED_ORIGIN ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type, x-app-password', 'access-control-allow-methods': 'GET, POST, OPTIONS', vary: 'Origin' };
}

const MSG: Record<Exclude<Access, 'ok'>, string> = {
  wrong: '비밀번호가 맞지 않습니다.',
  unset: '서버에 APP_PASSWORD가 설정되지 않아 막았습니다(Vercel 환경변수에 넣으세요).',
};
export const denied = (a: Exclude<Access, 'ok'>, headers: Record<string, string>): Response =>
  Response.json({ ok: false, error: MSG[a] }, { status: a === 'wrong' ? 401 : 503, headers });
