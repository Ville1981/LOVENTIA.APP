const { body, validationResult } = require('express-validator');

// Register-validaattorit ja sanitointi
const validateRegister = [
  body('username')
    .trim()
    .escape()
    .isString()
    .withMessage('Käyttäjänimi on oltava tekstiä')
    .isLength({ min: 3, max: 30 })
    .withMessage('Käyttäjänimen pituus 3–30 merkkiä'),
  body('email').trim().normalizeEmail().isEmail().withMessage('Sähköpostin pitää olla validi'),
  body('password')
    .trim()
    .isLength({ min: 8 })
    .withMessage('Salasanan tulee olla vähintään 8 merkkiä')
    .matches(/\d/)
    .withMessage('Salasanassa täytyy olla vähintään yksi numero')
    .matches(/[A-Z]/)
    .withMessage('Salasanassa täytyy olla vähintään yksi iso kirjain'),
  // Validointi- ja virheentarkistus
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
  },
];

// Login-validaattorit ja sanitointi
const validateLogin = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Sähköpostin pitää olla validi'),
  body('password').trim().notEmpty().withMessage('Salasana ei saa olla tyhjä'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
  },
];

module.exports = { validateRegister, validateLogin };
