import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    lng: 'en',
    supportedLngs: [
      'fi',
      'en',
      'en-US',
      'en-GB',
      'pl',
      'pt',
      'pt-BR',
      'es',
      'es-MX',
      'es-AR',
      'es-CO',
      'es-ES',
      'fr',
      'it',
      'de',
      'ru',
      'tr',
      'sv',
      'hi',
      'ur',
      'ar',
      'zh',
      'ja',
      'he',
      'el',
      'sw',
    ],
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
