import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUs from './locales/en-us.json';
import deDe from './locales/de-de.json';

export const SUPPORTED_UI_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'de-DE', label: 'Deutsch' },
] as const;

export function normalizeLanguageCode(code?: string): 'en-US' | 'de-DE' {
  const normalized = (code ?? '').toLowerCase().trim();
  if (normalized === 'de-de' || normalized === 'de') {
    return 'de-DE';
  }
  return 'en-US';
}

export function setUILanguage(code: string): void {
  const normalized = normalizeLanguageCode(code);
  try {
    localStorage.setItem('uiLanguage', normalized);
  } catch {
    // storage may be unavailable in private browsing
  }
  void i18n.changeLanguage(normalized);
}

export function getStoredUILanguage(): 'en-US' | 'de-DE' | undefined {
  try {
    const storedLanguage = localStorage.getItem('uiLanguage');
    return storedLanguage ? normalizeLanguageCode(storedLanguage) : undefined;
  } catch {
    return undefined;
  }
}

const storedLanguage = getStoredUILanguage();

const defaultLanguage = normalizeLanguageCode(
  storedLanguage ?? (typeof navigator !== 'undefined' ? navigator.language : undefined),
);

i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUs },
    'de-DE': { translation: deDe },
  },
  lng: defaultLanguage,
  fallbackLng: 'en-US',
  react: { useSuspense: false },
  interpolation: { escapeValue: false },
} as Parameters<typeof i18n.init>[0]);

export default i18n;
