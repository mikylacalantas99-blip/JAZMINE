import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  try {
    registerSW({ immediate: true });
  } catch {
    // Service worker registration skipped if blocked in restricted context
  }
}

createRoot(document.getElementById('root')!).render(<App />);
