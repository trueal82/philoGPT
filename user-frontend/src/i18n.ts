import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUs from './locales/en-us.json';
import deDe from './locales/de-de.json';

i18n.use(initReactI18next).init({
  resources: {
    'en-us': { translation: enUs },
    'de-de': { translation: deDe },
  },
  fallbackLng: 'en-us',
  interpolation: { escapeValue: false },
});

export default i18n;
