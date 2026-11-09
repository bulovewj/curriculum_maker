import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/app.css';

// 개발 화면(?dev)은 따로 불러와 운영 화면 파일을 무겁게 하지 않는다
const DevPreview = lazy(() => import('./dev/DevPreview').then((m) => ({ default: m.DevPreview })));

const root = document.getElementById('root');
if (!root) {
  throw new Error('index.html에 #root가 없습니다.');
}

createRoot(root).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('dev') ? <Suspense fallback={null}><DevPreview /></Suspense> : <App />}
  </StrictMode>,
);
