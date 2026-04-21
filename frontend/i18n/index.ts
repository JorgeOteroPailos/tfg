import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import gl from './locales/gl.json';

i18n.use(initReactI18next).init({
  debug: true,
  resources: {
    en: { translation: en },
    es: { translation: es },
    gl: { translation: gl },
  },
  lng: 'gl',
  fallbackLng: 'en',
  defaultNS: 'translation',
  ns: ['translation'],
  interpolation: {
    escapeValue: false,
  },
});


export default i18n;