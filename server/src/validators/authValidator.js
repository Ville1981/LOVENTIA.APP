// --- REPLACE START: lightweight login/register schemas (CommonJS, no external deps) ---
/**
 * Minimal schema objects with a .validate(data) function that returns:
 * - { value } when valid
 * - { error: { details: [{ message }, ...] } } when invalid
 *
 * This mirrors a tiny subset of Joi's API that our validateBody middleware expects,
 * but avoids adding dependencies.
 */

function normalize(obj) {
  return (obj && typeof obj === 'object') ? obj : {};
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  // Simple RFC5322-ish check (good enough for server-side basic validation)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function makeError(messages) {
  return { error: { details: messages.map((m) => ({ message: String(m) })) } };
}

const loginSchema = {
  validate(data) {
    const body = normalize(data);
    const errors = [];

    if (!body.email || !isValidEmail(body.email)) {
      errors.push('Email is required and must be a valid email address.');
    }
    if (!body.password || String(body.password).length < 6) {
      errors.push('Password is required and must be at least 6 characters long.');
    }

    if (errors.length) return makeError(errors);
    return { value: { email: String(body.email), password: String(body.password) } };
  },
};

const registerSchema = {
  validate(data) {
    const body = normalize(data);
    const errors = [];

    if (!body.email || !isValidEmail(body.email)) {
      errors.push('Email is required and must be a valid email address.');
    }
    if (!body.password || String(body.password).length < 6) {
      errors.push('Password is required and must be at least 6 characters long.');
    }
    // "name" optional, but if present must be a non-empty string
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim() === '')) {
      errors.push('Name, if provided, must be a non-empty string.');
    }

    if (errors.length) return makeError(errors);

    const value = {
      email: String(body.email),
      password: String(body.password),
    };
    if (typeof body.name === 'string' && body.name.trim() !== '') {
      value.name = body.name.trim();
    }
    return { value };
  },
};

module.exports = { loginSchema, registerSchema };
// --- REPLACE END ---
