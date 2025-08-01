// server/src/middleware/validateRequest.js

const Joi = require('joi');

/**
 * Middleware to validate req.body against a Joi schema.
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
function validateBody(schema) {
  return (req, res, next) => {
    const options = { abortEarly: false, stripUnknown: true };
    const { error, value } = schema.validate(req.body, options);
    if (error) {
      // Format Joi errors
      const formatted = error.details.map(detail => ({
        message: detail.message,
        path: detail.path.join('.')
      }));
      return res.status(400).json({ errors: formatted });
    }
    // Replace req.body with the validated and sanitized value
    req.body = value;
    next();
  };
}

/**
 * Middleware to validate req.params against a Joi schema.
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
function validateParams(schema) {
  return (req, res, next) => {
    const options = { abortEarly: false, stripUnknown: true };
    const { error, value } = schema.validate(req.params, options);
    if (error) {
      const formatted = error.details.map(detail => ({
        message: detail.message,
        path: detail.path.join('.')
      }));
      return res.status(400).json({ errors: formatted });
    }
    req.params = value;
    next();
  };
}

module.exports = {
  validateBody,
  validateParams
};
