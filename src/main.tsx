import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DevPreview } from './dev/DevPreview';
import './styles/tokens.css';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('index.html에 #root가 없습니다.');
}

createRoot(root).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('dev') ? <DevPreview /> : <App />}
  </StrictMode>,
);
