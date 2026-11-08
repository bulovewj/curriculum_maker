import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

/** 키 글자가 브라우저 코드·빌드 결과에 없다 */
function files(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = `${d}/${n}`;
      if (/\.[a-z0-9]+$/i.test(n)) { if (ext.test(n)) out.push(p); } else walk(p);
    }
  };
  walk(dir);
  return out;
}
const text = (p: string) => new TextDecoder().decode(readFileSync(p));

describe('API 키 비밀 지키기', () => {
  it('src에는 키 이름·VITE_ 키가 없다(서버 함수 api/에만 있다)', () => {
    const bad = files('src', /\.(ts|tsx)$/).filter((f) => /ANTHROPIC_API_KEY|VITE_[A-Z_]*(KEY|SECRET|TOKEN)|sk-ant-/.test(text(f)));
    expect(bad).toEqual([]);
  });
  it('빌드 결과 dist에 키 글자가 없다(빌드한 뒤라면)', () => {
    const bad = files('dist', /\.(js|html|css)$/).filter((f) => /ANTHROPIC_API_KEY|sk-ant-/.test(text(f)));
    expect(bad).toEqual([]);
  });
});
