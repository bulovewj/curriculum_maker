import { describe, expect, it } from 'vitest';
import { accessOf, corsHeaders } from './auth';

const req = (headers: Record<string, string> = {}) => new Request('http://x/api/ai', { headers });

describe('서버 비밀번호 검사', () => {
  it('비밀번호가 맞으면 통과, 틀리거나 없으면 막는다', () => {
    const env = { APP_PASSWORD: 'pw-test' };
    expect(accessOf(req({ 'x-app-password': 'pw-test' }), env)).toBe('ok');
    expect(accessOf(req({ 'x-app-password': 'pw-tesx' }), env)).toBe('wrong');
    expect(accessOf(req({ 'x-app-password': 'pw-test-longer' }), env)).toBe('wrong');
    expect(accessOf(req(), env)).toBe('wrong');
    expect(accessOf(req({ 'x-app-password': encodeURIComponent('비번') }), { APP_PASSWORD: '비번' })).toBe('ok'); // 한글 비밀번호
  });
  it('서버에 비밀번호가 없으면 내 컴퓨터에서만 통과하고 Vercel에서는 막는다', () => {
    expect(accessOf(req(), {})).toBe('ok');
    expect(accessOf(req(), { VERCEL: '1' })).toBe('unset');
  });
  it('허용한 주소에서 온 요청에만 CORS 헤더를 붙인다', () => {
    const env = { ALLOWED_ORIGIN: 'https://a.github.io, https://b.example' };
    expect(corsHeaders(req({ origin: 'https://b.example' }), env)['access-control-allow-origin']).toBe('https://b.example');
    expect(corsHeaders(req({ origin: 'https://evil.example' }), env)).toEqual({});
    expect(corsHeaders(req(), env)).toEqual({});
    expect(corsHeaders(req({ origin: 'https://a.github.io' }), {})).toEqual({});
  });
});
