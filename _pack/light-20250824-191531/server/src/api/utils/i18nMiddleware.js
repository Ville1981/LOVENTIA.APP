// --- REPLACE START: convert ESM to CommonJS; keep logic intact and paths robust ---
'use strict';

const acceptLanguage = require('accept-language');
const fs = require('fs');
const path = require('path');

/**
 * Supported languages for server-side locale negotiation.
 * Keep in sync with client i18n.
 */
const supportedLanguages = ['en', 'fi'];
acceptLanguage.languages(supportedLanguages);

// Small in-memory cache to avoid reading JSON on every t() call
const _cache = Object.create(null);

/**
 * Safely load a translation JSON for a given locale from:
 *   <this dir>/../locales/<locale>/translation.json
 * Returns a plain object (may be empty if file is missing/invalid).
 */
function loadLocale(locale) {
  const lc = (locale || '').toLowerCase();
  if (_cache[lc]) return _cache[lc];

  const baseDir = path.resolve(__dirname, '../locales');
  const filePath = path.join(baseDir, lc, 'translation.json');

  try {
    // Synchronous read keeps behavior deterministic during request handling
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);
    _cache[lc] = json && typeof json === 'object' ? json : {};
  } catch (err) {
    // File may not exist; fall back to empty object so we return keys
    _cache[lc] = {};
  }
  return _cache[lc];
}

/**
 * Middleware that sets req.locale based on the "Accept-Language" header.
 * Falls back to process.env.DEFAULT_LOCALE or "en".
 */
function localeMiddleware(req, _res, next) {
  const header = req.headers && req.headers['accept-language'];
  const negotiated = header ? acceptLanguage.get(header) : null;
  req.locale = negotiated || process.env.DEFAULT_LOCALE || 'en';
  next();
}

/**
 * Fetch a translation string by key for a given locale.
 * If the key is not found, returns the key itself (safe fallback).
 */
function t(key, locale = 'en') {
  try {
    const dict = loadLocale(locale);
    // Simple literal-key lookup; nested keys can be added later if needed
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
  } catch {
    return key;
  }
}

module.exports = { localeMiddleware, t, supportedLanguages };
// --- REPLACE END ---
