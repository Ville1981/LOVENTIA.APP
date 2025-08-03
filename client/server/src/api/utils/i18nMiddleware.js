// src/utils/i18nMiddleware.js  (Server-side Express)

import acceptLanguage from 'accept-language';
import fs from 'fs';
import path from 'path';

const supportedLanguages = ['en', 'fi'];
acceptLanguage.languages(supportedLanguages);

/**
 * Middleware asettaa req.locale pohjautuen "Accept-Language" headeriin
 */
export function localeMiddleware(req, res, next) {
  const lang = acceptLanguage.get(req.headers['accept-language']);
  req.locale = lang || 'en';
  next();
}

/**
 * Palauttaa käännöstiedoston avainkohtaisesti
 */
export function t(key, locale = 'en') {
  const filePath = path.join(process.cwd(), 'src/locales', locale, 'translation.json');
  const translations = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return translations[key] || key;
}
