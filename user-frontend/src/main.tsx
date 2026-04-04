import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './app/App';
import ErrorBoundary from './app/ErrorBoundary';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register service worker for PWA / Add to Home Screen
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed — non-critical
    });
  });
}
