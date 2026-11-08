import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // localhost와 127.0.0.1 어느 주소로도 열리게 하고, 브라우저를 자동으로 띄운다
  server: { host: '127.0.0.1', port: 5173, strictPort: true, open: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts', 'api/**/*.test.ts'],
  },
});
