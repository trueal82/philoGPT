import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface AppConfig {
  apiUrl: string;
}

async function bootstrap() {
  let apiUrl = '';
  try {
    const res = await fetch('/config');
    const cfg: AppConfig = await res.json();
    apiUrl = cfg.apiUrl || '';
  } catch {
    console.warn('Failed to load runtime config, using empty apiUrl');
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App apiUrl={apiUrl} />
    </React.StrictMode>,
  );
}

bootstrap();
