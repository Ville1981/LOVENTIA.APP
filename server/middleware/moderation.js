// --- REPLACE START: Moderation middleware (CJS with ESM-friendly exports) ---
/**
 * Moderation middleware for Express.js
 * - Rate limiting to prevent abuse
 * - Profanity filtering on request body fields
 *
 * Dual-mode export:
 *   - CommonJS:   const { profanityFilter, moderationRateLimiter } = require('./middleware/moderation');
 *   - ESM:        import { profanityFilter, moderationRateLimiter } from './middleware/moderation.js';
 *                 (also supports `import mod from ...` via default export)
 */

const rateLimit = require('express-rate-limit');

// Basic banned words list (very small on purpose; extend as needed).
// You can also set BANNED_WORDS="foo,bar" in env to override.
const envWords = (process.env.BANNED_WORDS || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean);

const bannedWords = envWords.length > 0
  ? envWords
  : ['badword1', 'badword2', 'badword3'];

/**
 * Safe lowercasing helper.
 */
function toLowerSafe(v) {
  try {
    return String(v || '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Profanity filter middleware
 * - Checks req.body (string or object) for banned words.
 * - Fails with 400 if profanity is detected.
 * - Very lightweight by design — not a full moderation solution.
 */
function profanityFilter(req, res, next) {
  try {
    let content = '';

    if (req && req.body != null) {
      if (typeof req.body === 'string') {
        content = toLowerSafe(req.body);
      } else if (typeof req.body === 'object') {
        // Check common fields first, then entire body
        const primary =
          toLowerSafe(req.body.text) ||
          toLowerSafe(req.body.message) ||
          toLowerSafe(req.body.content);

        const serialized = toLowerSafe(JSON.stringify(req.body));
        content = primary || serialized;
      }
    }

    if (content) {
      for (const word of bannedWords) {
        if (word && content.includes(word)) {
          return res.status(400).json({ error: 'Your message contains inappropriate language.' });
        }
      }
    }
  } catch (err) {
    // Do not block request if our filter has an issue
    // eslint-disable-next-line no-console
    console.warn('profanityFilter warning:', err && err.message ? err.message : err);
  }

  return typeof next === 'function' ? next() : undefined;
}

/**
 * Rate limiter middleware (factory from express-rate-limit)
 * Limits each IP to 100 requests per 15 minutes.
 */
const moderationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,    // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
});

// CJS named exports
module.exports = {
  profanityFilter,
  moderationRateLimiter,
};

// ESM-friendly default export (so `import mod from ...` also works)
module.exports.default = {
  profanityFilter,
  moderationRateLimiter,
};
// --- REPLACE END ---
