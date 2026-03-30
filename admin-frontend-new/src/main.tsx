import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface AppConfig {
  apiUrl: string;
}

async function bootstrap() {
  const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  let apiUrl = envApiUrl || 'http://localhost:5001';
  try {
    const res = await fetch('/config');
    const cfg: AppConfig = await res.json();
    apiUrl = cfg.apiUrl || apiUrl;
  } catch {
    console.warn(`Failed to load runtime config, using fallback apiUrl: ${apiUrl}`);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App apiUrl={apiUrl} />
    </React.StrictMode>,
  );
}

bootstrap();
