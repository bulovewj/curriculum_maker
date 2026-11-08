import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = `${dir}/${f}`;
  return statSync(p).isDirectory() ? (f === 'dev' ? [] : files(p)) : /\.(tsx|css)$/.test(f) ? [p] : [];
});
const text = (p: string) => new TextDecoder().decode(readFileSync(p));

describe('디자인 토큰', () => {
  it('색 코드는 tokens.css에만 있고, 화면 코드(tsx·app.css)에는 없다(개발용 src/dev 제외)', () => {
    const bad = files('src').filter((f) => !f.endsWith('tokens.css')).filter((f) => /#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl)a?\(/.test(text(f).replace(/&#\d+;/g, '')));
    expect(bad).toEqual([]);
  });
  it('글자 모양(font-family)도 tokens.css에서만 정한다', () => {
    const bad = files('src').filter((f) => !f.endsWith('tokens.css')).filter((f) => /font-family/.test(text(f)));
    expect(bad).toEqual([]);
  });
});
