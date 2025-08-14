// File: server/middleware/profileValidator.js

// --- REPLACE START: ESM imports for validation and sanitization ---
import { body, validationResult } from 'express-validator';
// --- REPLACE END ---

/**
 * Middleware: sanitize and validate profile-related fields
 * - Prevents XSS via escape()
 * - Normalizes email
 * - Converts numeric fields to proper types
 */
export const sanitizeAndValidateProfile = [
  // --- REPLACE START: trim and escape name ---
  body('name')
    .trim()
    .escape(),
  // --- REPLACE END ---

  // --- REPLACE START: normalize email ---
  body('email')
    .trim()
    .normalizeEmail(),
  // --- REPLACE END ---

  // --- REPLACE START: convert optional age to integer ---
  body('age')
    .optional()
    .toInt(),
  // --- REPLACE END ---

  // --- REPLACE START: convert optional height to float ---
  body('height')
    .optional()
    .toFloat(),
  // --- REPLACE END ---

  // --- REPLACE START: convert optional weight to float ---
  body('weight')
    .optional()
    .toFloat(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape status ---
  body('status')
    .trim()
    .escape(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape religion ---
  body('religion')
    .trim()
    .escape(),
  // --- REPLACE END ---

  // --- REPLACE START: convert optional children to boolean ---
  body('children')
    .optional()
    .toBoolean(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape pets ---
  body('pets')
    .trim()
    .escape(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape summary ---
  body('summary')
    .trim()
    .escape(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape goal ---
  body('goal')
    .trim()
    .escape(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape lookingFor ---
  body('lookingFor')
    .trim()
    .escape(),
  // --- REPLACE END ---

  // --- REPLACE START: trim and escape political ideology ---
  body('politicalIdeology')
    .optional()
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
