// client/src/utils/validationSchemas.js

import * as Yup from 'yup';

/**
 * Login form validation schema
 * - email: required, must be valid email
 * - password: required, min 8 characters
 */
export const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
});

/**
 * Register form validation schema
 * - name: required, min 3 characters
 * - email: required, must be valid email
 * - password: required, complex rules
 */
export const registerSchema = Yup.object().shape({
  name: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .required('Name is required'),
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[@$!%*?&]/, 'Password must contain at least one special character')
    .required('Password is required'),
});

/**
 * Feedback form validation schema
 * - name: required, min 3 characters
 * - email: required, must be valid email
 * - message: required, min 10 characters
 * - rating: required, integer between 1 and 5
 */
export const feedbackSchema = Yup.object().shape({
  name: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .required('Name is required'),
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  message: Yup.string()
    .min(10, 'Message must be at least 10 characters')
    .required('Message is required'),
  rating: Yup.number()
    .integer('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating can be at most 5')
    .required('Rating is required'),
});
