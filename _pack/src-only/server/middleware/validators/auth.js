// server/middleware/validators/auth.js

// --- REPLACE START: converted to ESM imports, translated comments and messages to English ---
import { body, validationResult } from 'express-validator';

// Registration validators and sanitization
const validateRegister = [
  body('username')
    .trim()
    .escape()
    .isString().withMessage('Username must be a string')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail().withMessage('Email must be valid'),
  body('password')
    .trim()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter'),
  // Validation and error handling
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
  }
];

// Login validators and sanitization
const validateLogin = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail().withMessage('Email must be valid'),
  body('password')
    .trim()
    .notEmpty().withMessage('Password cannot be empty'),
  // Validation and error handling
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
  }
];

// Export validators for use in routes
export { validateRegister, validateLogin };
// --- REPLACE END ---
