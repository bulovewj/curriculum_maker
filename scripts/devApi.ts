import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, type Plugin } from 'vite';

// @types/node 없이 쓰는 최소 선언
declare const process: { env: Record<string, string | undefined>; cwd(): string };
interface Req { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; on(ev: 'data', f: (c: Uint8Array) => void): void; on(ev: 'end', f: () => void): void }
interface Res { statusCode: number; setHeader(k: string, v: string): void; end(s: string | Uint8Array): void }

/** 개발 서버(npm run dev)에서도 /api/ai 가 동작하게 한다. .env.local 의 키는 서버 쪽에서만 읽는다(브라우저로 안 나감). */
/** 2026 정답지 샘플(내 컴퓨터의 fixtures·reference 폴더). 개발 서버에서만 열리고 빌드에는 안 들어간다. */
const SAMPLES: [string, RegExp][] = [
  ['fixtures/2026-g6/원본', /^(학년 행사|2026 전담|2026학년도 6학년 .학기 교과진도)/],
  ['reference', /^(2026학년도 학사일정 및 교육과정편제|2026학년도 학년별 시수 증가)/],
];
const sampleFiles = (): string[][] => SAMPLES.flatMap(([dir, re]) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f.normalize('NFC'))).map((f) => [dir, f]) : []));

export function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), '')); // VITE_ 없는 키도 서버에서 읽는다
      server.middlewares.use('/dev-sample', ((req: Req, res: Res) => {
        const list = sampleFiles();
        const name = decodeURIComponent((req.url ?? '/').slice(1));
        const hit = list.find(([, f]) => f.normalize('NFC') === name.normalize('NFC'));
        res.setHeader('content-type', hit ? 'application/octet-stream' : 'application/json');
        res.end(hit ? readFileSync(join(hit[0], hit[1])) : JSON.stringify(list.map(([, f]) => f.normalize('NFC'))));
      }) as never);
      server.middlewares.use('/api/ai', (async (req: Req, res: Res) => {
        const body = await new Promise<string>((done) => {
          let text = '';
          const dec = new TextDecoder();
          req.on('data', (c) => { text += dec.decode(c, { stream: true }); });
          req.on('end', () => done(text));
        });
        const mod = (await server.ssrLoadModule('/api/ai.ts')) as { POST: (r: Request) => Promise<Response>; GET: (r: Request) => Promise<Response> };
        const headers = { 'x-app-password': String(req.headers['x-app-password'] ?? '') };
        const out = req.method === 'POST' ? await mod.POST(new Request('http://localhost/api/ai', { method: 'POST', body, headers })) : await mod.GET(new Request('http://localhost/api/ai', { headers }));
        res.statusCode = out.status;
        res.setHeader('content-type', 'application/json');
        res.end(await out.text());
      }) as never); // Node 타입이 없어 as never
    },
  };
}
