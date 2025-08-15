// --- REPLACE START: ESM imports for validation and sanitization ---
import { body, validationResult } from 'express-validator';
// --- REPLACE END ---

/**
 * Normalize a political ideology value to canonical enum (English) keys.
 * Accepts emoji labels and multilingual synonyms (FI/EN), returns one of:
 * ['', 'Left','Centre','Right','Democracy','Conservatism','Liberalism','Socialism',
 *  'Communism','Fascism','Environmentalism','Anarchism','Nationalism','Populism',
 *  'Progressivism','Libertarianism','Other']
 */
function normalizePoliticalIdeology(input) {
  if (input == null) return '';
  let s = String(input).trim();

  // strip common emoji/symbols/spaces
  s = s.replace(/[^\p{L}\p{N}\s-]/gu, '').trim(); // remove emojis/pictos
  const lc = s.toLowerCase();

  // direct hits in English enum
  const direct = {
    'left': 'Left',
    'centre': 'Centre',
    'center': 'Centre',
    'right': 'Right',
    'democracy': 'Democracy',
    'conservatism': 'Conservatism',
    'liberalism': 'Liberalism',
    'socialism': 'Socialism',
    'communism': 'Communism',
    'fascism': 'Fascism',
    'environmentalism': 'Environmentalism',
    'anarchism': 'Anarchism',
    'nationalism': 'Nationalism',
    'populism': 'Populism',
    'progressivism': 'Progressivism',
    'libertarianism': 'Libertarianism',
    'other': 'Other',
    '': '',
  };
  if (direct[lc] != null) return direct[lc];

  // Finnish and common synonyms → map to English enum keys
  const fiMap = {
    'vasemmisto': 'Left',
    'keskusta': 'Centre',
    'keskinen': 'Centre',
    'oikeisto': 'Right',
    'demokratia': 'Democracy',
    'konservatismi': 'Conservatism',
    'liberalismi': 'Liberalism',
    'sosialismi': 'Socialism',
    'kommunismi': 'Communism',
    'fasismi': 'Fascism',
    'ymparistoliike': 'Environmentalism',
    'ympäristöliike': 'Environmentalism',
    'vihreat': 'Environmentalism',
    'vihreät': 'Environmentalism',
    'anarkismi': 'Anarchism',
    'nationalismi': 'Nationalism',
    'populismi': 'Populism',
    'progressivismi': 'Progressivism',
    'libertarismi': 'Libertarianism',
    'muu': 'Other',
  };
  if (fiMap[lc] != null) return fiMap[lc];

  // If nothing matches, fall back to empty (prevents enum reject → default '')
  return '';
}

/**
 * Middleware: sanitize and validate profile-related fields
 * - Prevents XSS via escape()
 * - Normalizes email
 * - Converts numeric fields to proper types
 * - Normalizes `politicalIdeology` to backend enum keys
 */
export const sanitizeAndValidateProfile = [
  // --- REPLACE START: trim and escape name ---
  body('name').trim().escape(),
  // --- REPLACE END ---

  // --- REPLACE START: normalize email ---
  body('email').trim().normalizeEmail(),
  // --- REPLACE END ---

  // --- REPLACE START: convert optional age to integer ---
  body('age').optional().toInt(),
  // --- REPLACE END ---

  // --- REPLACE START: convert optional height to float ---
  body('height').optional().toFloat(),
  // --- REPLACE END ---

  // --- REPLACE START: convert optional weight to float ---
  body('weight').optional().toFloat(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape status ---
  body('status').trim().escape(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape religion ---
  body('religion').trim().escape(),
  // --- REPLACE END ---

  // --- REPLACE START: convert optional children to boolean ---
  body('children').optional().toBoolean(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape pets ---
  body('pets').trim().escape(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape summary ---
  body('summary').trim().escape(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape goal ---
  body('goal').trim().escape(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape lookingFor ---
  body('lookingFor').trim().escape(),
  // --- REPLACE END ---

  // --- REPLACE START: normalize and escape political ideology ---
  body('politicalIdeology')
    .optional()
    .customSanitizer(normalizePoliticalIdeology)
    .trim()
    .escape(),
  body('ideology')
    .optional()
    .customSanitizer(normalizePoliticalIdeology)
    .trim()
    .escape(),
  // --- REPLACE END ---

  // Final check for validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
  }
];
