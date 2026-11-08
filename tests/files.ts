import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 폴더에서 이름(NFC 비교)에 key가 들어간 파일 경로. 없으면 undefined. */
export function findFile(dir: string, key: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const name = readdirSync(dir).find((n) => n.normalize('NFC').includes(key.normalize('NFC')));
  return name ? join(dir, name) : undefined;
}

/** 폴더 안 파일 경로 전부(이름 순) */
export function listFiles(dir: string, ext: string): string[] {
  return readdirSync(dir).filter((n) => n.endsWith(ext)).sort().map((n) => join(dir, n));
}

export function readBuffer(path: string): ArrayBuffer {
  const b = readFileSync(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

export const REF = 'reference';
export const ORIGINAL = 'fixtures/2026-g6/원본';
export const EXTRACTED = 'fixtures/2026-g6/추출';
