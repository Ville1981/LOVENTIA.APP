import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// Haetaan tallennettu kieli tai oletuksena suomi
const storedLang = localStorage.getItem('language') || 'fi';
// Käytetään pelkästään kahden merkin kieltä (esim. "en" tai "fi")
const language = storedLang.split('-')[0];

i18n
  // lataa käännöstiedostot HTTP-pyynnöllä
  .use(HttpBackend)
  // havaitse käyttäjän kieliasetukset
  .use(LanguageDetector)
  // React-integraatio
  .use(initReactI18next)
  .init({
    // asetetaan aktiiviseksi kieleksi kahden merkin koodi
    lng: language,
    // fallback-kielet eri lokalisaatioille
    fallbackLng: {
      'en-US': ['en'],
      'en-GB': ['en'],
      'pt-BR': ['pt'],
      'es-MX': ['es'],
      'es-AR': ['es'],
      'es-CO': ['es'],
      'es-ES': ['es'],
      default: ['en'], // aina englanti, jos ei löytynyt
    },
    // tuetut kielet (sisältää sekä 2- että 5-merkkiset koodit)
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
    // asetetaan, mistä haetaan käännöstiedostot
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    debug: false,
  });

// Määritellään RTL-kielet ja asetetaan sivun suunta
const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
const html = document.documentElement;
html.setAttribute('dir', rtlLanguages.includes(language) ? 'rtl' : 'ltr');

export default i18n;
