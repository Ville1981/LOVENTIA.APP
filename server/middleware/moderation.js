// middleware/moderation.js

/**
 * Moderation middleware for Express.js
 * - Rate limiting to prevent abuse
 * - Profanity filtering on request body fields
 */

const rateLimit = require('express-rate-limit');

// List of banned words for simple profanity filter.
// Add or remove words as needed.
const bannedWords = ['badword1', 'badword2', 'badword3'];

/**
 * Profanity filter middleware
 * Checks if req.body contains any banned words and rejects the request.
 */
function profanityFilter(req, res, next) {
  const content = JSON.stringify(req.body).toLowerCase();

  for (const word of bannedWords) {
    if (content.includes(word)) {
      return res.status(400).json({ error: 'Your message contains inappropriate language.' });
    }
  }
  next();
}

/**
 * Rate limiter middleware
 * Limits each IP to 100 requests per 15 minutes.
 */
const moderationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = {
  // **Profanity filter** to sanitize user input
  profanityFilter,

  // **Rate limiter** to prevent abuse
  moderationRateLimiter,
};
