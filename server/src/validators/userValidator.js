// server/src/validators/userValidator.js

const Joi = require('joi');

/**
 * Schema for creating a new user
 * @type {Joi.ObjectSchema}
 */
const createUserSchema = Joi.object({
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

/**
 * Schema for updating an existing user
 * @type {Joi.ObjectSchema}
 */
const updateUserSchema = Joi.object({
  name: Joi.string().min(3).messages({
    'string.min': 'Name must be at least 3 characters',
  }),
  email: Joi.string().email().messages({
    'string.email': 'Email must be a valid email address',
  }),
  password: Joi.string().min(8).messages({
    'string.min': 'Password must be at least 8 characters',
  }),
})
  .or('name', 'email', 'password') // At least one field must be present
  .messages({
    'object.missing': 'At least one of name, email, or password is required',
  });

module.exports = {
  createUserSchema,
  updateUserSchema,
};
