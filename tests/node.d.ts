// 테스트 도우미가 쓰는 Node 함수만 선언한다(@types/node 설치 대신).
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string): Uint8Array;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
