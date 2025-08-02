const { body, validationResult } = require('express-validator');

// Middleware: sanitize and normalize profile-related fields to prevent XSS and format issues
const sanitizeFields = [
  body('name').trim().escape(),
  body('email').trim().normalizeEmail(),
  body('age').optional().toInt(),
  body('height').optional().toFloat(),
  body('weight').optional().toFloat(),
  body('status').trim().escape(),
  body('religion').trim().escape(),
  body('children').optional().toBoolean(),
  body('pets').trim().escape(),
  body('summary').trim().escape(),
  body('goal').trim().escape(),
  body('lookingFor').trim().escape(),
  // Final check (though sanitizers don't add errors, this catches any accidental validation errors)
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
  },
];

module.exports = { sanitizeFields };
