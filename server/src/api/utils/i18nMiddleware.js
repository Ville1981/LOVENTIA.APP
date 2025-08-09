// --- REPLACE START: convert ESM to CommonJS; keep logic intact and paths robust ---
'use strict';

const acceptLanguage = require('accept-language');
const fs = require('fs');
const path = require('path');

const supportedLanguages = ['en', 'fi'];
acceptLanguage.languages(supportedLanguages);

/**
 * Middleware sets req.locale based on the "Accept-Language" header.
 */
function localeMiddleware(req, res, next) {
  const lang = acceptLanguage.get(req.headers['accept-language']);
  req.locale = lang || 'en';
  next();
}

/**
 * Returns a translation string by key for a given locale.
 * Uses a stable file path relative to this file to avoid cwd issues.
 */
function t(key, locale = 'en') {
  const filePath = path.resolve(__dirname, '../locales', locale, 'translation.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const translations = JSON.parse(raw);
  return translations[key] || key;
}

module.exports = { localeMiddleware, t };
// --- REPLACE END ---
