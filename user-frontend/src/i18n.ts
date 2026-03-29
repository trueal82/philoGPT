import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUs from './locales/en-us.json';
import deDe from './locales/de-de.json';

export function normalizeLanguageCode(code?: string): 'en-US' | 'de-DE' {
  const normalized = (code ?? '').toLowerCase().trim();
  if (normalized === 'de-de' || normalized === 'de') {
    return 'de-DE';
  }
  return 'en-US';
}

const defaultLanguage = normalizeLanguageCode(
  typeof navigator !== 'undefined' ? navigator.language : undefined,
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
