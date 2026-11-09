import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { devApi } from './scripts/devApi';

declare const process: { env: Record<string, string | undefined> };

// 빌드(배포)는 GitHub Pages 하위 주소(/curriculum_maker/)에 올라가므로 그 주소를 기준으로 한다. 개발 서버는 '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' && !process.env.VERCEL ? '/curriculum_maker/' : '/', // Vercel은 주소 맨 위에서 서비스한다
  plugins: [react(), devApi()],
  // localhost와 127.0.0.1 어느 주소로도 열리게 하고, 브라우저를 자동으로 띄운다
  server: { host: '127.0.0.1', port: 5173, strictPort: true, open: true },
  test: {
    testTimeout: 30000, // 정답지 테스트는 원본 파일을 읽어서 컴퓨터가 바쁘면 5초를 넘길 수 있다
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts', 'api/**/*.test.ts'],
  },
}));
