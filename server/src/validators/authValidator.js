// server/src/validators/authValidator.js

const Joi = require('joi');

/**
 * Schema for user login payload
 * @type {Joi.ObjectSchema}
 */
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email must be a valid email address',
    'string.empty': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'string.empty': 'Password is required',
  }),
});

/**
 * Schema for user registration payload
 * @type {Joi.ObjectSchema}
 */
const registerSchema = Joi.object({
  name: Joi.string().min(3).required().messages({
    'string.min': 'Name must be at least 3 characters',
    'string.empty': 'Name is required',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Email must be a valid email address',
    'string.empty': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'string.empty': 'Password is required',
  }),
});

module.exports = {
  loginSchema,
  registerSchema,
};
