import Joi from 'joi';

/**
 * Auth Service Validation Schemas
 */

// Phone number validation (Indian format: +91[6-9]XXXXXXXXX)
export const phoneSchema = Joi.string()
  .pattern(/^\+91[6-9]\d{9}$/)
  .required()
  .messages({
    'string.pattern.base': 'Phone number must be a valid Indian phone number (+91[6-9]XXXXXXXXX)',
    'any.required': 'Phone number is required',
    'string.empty': 'Phone number cannot be empty',
  });

// OTP code validation (6 digits)
export const otpCodeSchema = Joi.string()
  .length(6)
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    'string.length': 'OTP must be exactly 6 digits',
    'string.pattern.base': 'OTP must contain only digits',
    'any.required': 'OTP code is required',
    'string.empty': 'OTP code cannot be empty',
  });

// Name validation (2-100 characters, alphanumeric + spaces)
export const nameSchema = Joi.string()
  .min(2)
  .max(100)
  .pattern(/^[a-zA-Z0-9\s\-']+$/)
  .trim()
  .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name must not exceed 100 characters',
    'string.pattern.base': 'Name can only contain letters, numbers, spaces, hyphens, and apostrophes',
    'string.empty': 'Name cannot be empty',
  });

// Language validation
export const languageSchema = Joi.string()
  .valid('hi', 'mr', 'en')
  .default('hi')
  .messages({
    'any.only': 'Language must be one of: hi (Hindi), mr (Marathi), en (English)',
  });

/**
 * Request validation schemas
 */

// Send OTP request
export const sendOTPSchema = Joi.object({
  phone: phoneSchema,
});

// Verify OTP request
export const verifyOTPSchema = Joi.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

// Update profile request
export const updateProfileSchema = Joi.object({
  name: nameSchema.optional(),
  language: languageSchema.optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

// Refresh token request (no body validation needed, uses JWT from header)
export const refreshTokenSchema = Joi.object({});
