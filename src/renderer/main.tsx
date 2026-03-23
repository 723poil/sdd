import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/renderer/App';
import '@/renderer/styles/app.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container was not found.');
}

const isMacPlatform =
  navigator.userAgent.includes('Macintosh') || navigator.platform.toLowerCase().includes('mac');

document.documentElement.dataset.platform = isMacPlatform ? 'mac' : 'default';

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
