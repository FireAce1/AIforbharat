import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Validation error response structure
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Validation error class
 */
export class ValidationException extends Error {
  public statusCode: number;
  public errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
    this.statusCode = 400;
    this.errors = errors;
  }
}

/**
 * Generic validation middleware factory
 * @param schema - Joi schema to validate against
 * @param source - Request property to validate ('body', 'query', 'params')
 */
export const validate = (
  schema: Joi.ObjectSchema,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errors: ValidationError[] = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      return next(new ValidationException(errors));
    }

    // Replace request data with sanitized/converted values
    req[source] = value;
    next();
  };
};

/**
 * Common validation schemas
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

// Name validation (2-100 characters, alphanumeric + spaces, hyphens, apostrophes)
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

// Latitude validation (-90 to 90)
export const latitudeSchema = Joi.number()
  .min(-90)
  .max(90)
  .required()
  .messages({
    'number.min': 'Latitude must be between -90 and 90',
    'number.max': 'Latitude must be between -90 and 90',
    'any.required': 'Latitude is required',
    'number.base': 'Latitude must be a number',
  });

// Longitude validation (-180 to 180)
export const longitudeSchema = Joi.number()
  .min(-180)
  .max(180)
  .required()
  .messages({
    'number.min': 'Longitude must be between -180 and 180',
    'number.max': 'Longitude must be between -180 and 180',
    'any.required': 'Longitude is required',
    'number.base': 'Longitude must be a number',
  });

// Coordinates validation (latitude and longitude together)
export const coordinatesSchema = Joi.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

// UUID validation
export const uuidSchema = Joi.string()
  .uuid()
  .required()
  .messages({
    'string.guid': 'Must be a valid UUID',
    'any.required': 'ID is required',
  });

// Email validation
export const emailSchema = Joi.string()
  .email()
  .lowercase()
  .trim()
  .messages({
    'string.email': 'Must be a valid email address',
  });

// Positive integer validation
export const positiveIntSchema = Joi.number()
  .integer()
  .positive()
  .messages({
    'number.base': 'Must be a number',
    'number.integer': 'Must be an integer',
    'number.positive': 'Must be a positive number',
  });

// Positive number validation (allows decimals)
export const positiveNumberSchema = Joi.number()
  .positive()
  .messages({
    'number.base': 'Must be a number',
    'number.positive': 'Must be a positive number',
  });

// Date validation (ISO 8601 format)
export const dateSchema = Joi.date()
  .iso()
  .messages({
    'date.base': 'Must be a valid date',
    'date.format': 'Date must be in ISO 8601 format',
  });

// Language code validation (ISO 639-1)
export const languageSchema = Joi.string()
  .valid('hi', 'mr', 'en')
  .default('hi')
  .messages({
    'any.only': 'Language must be one of: hi (Hindi), mr (Marathi), en (English)',
  });

/**
 * Sanitization utilities
 */

/**
 * Sanitize string to prevent XSS attacks
 * Removes HTML tags and dangerous characters
 */
export const sanitizeString = (input: string): string => {
  if (!input) return input;
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/[<>'"]/g, (char) => {
      // Escape dangerous characters
      const escapeMap: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#x27;',
        '"': '&quot;',
      };
      return escapeMap[char] || char;
    })
    .trim();
};

/**
 * Sanitize object recursively
 * Applies sanitization to all string values in an object
 */
export const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * SQL injection prevention middleware
 * Validates that strings don't contain SQL injection patterns
 */
export const preventSQLInjection = (req: Request, _res: Response, next: NextFunction) => {
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /(--|;|\/\*|\*\/|xp_|sp_)/gi,
    /('|(\\')|(;)|(--)|(\/\*))/gi,
  ];

  const checkForSQLInjection = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlInjectionPatterns.some((pattern) => pattern.test(value));
    }
    
    if (Array.isArray(value)) {
      return value.some(checkForSQLInjection);
    }
    
    if (value !== null && typeof value === 'object') {
      return Object.values(value).some(checkForSQLInjection);
    }
    
    return false;
  };

  // Check body, query, and params
  const sources = [req.body, req.query, req.params];
  
  for (const source of sources) {
    if (source && checkForSQLInjection(source)) {
      return next(
        new ValidationException([
          {
            field: 'input',
            message: 'Invalid input detected. Please remove special characters.',
          },
        ])
      );
    }
  }

  next();
};

/**
 * XSS prevention middleware
 * Sanitizes all string inputs to prevent XSS attacks
 */
export const preventXSS = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

/**
 * Combined security middleware
 * Applies both SQL injection and XSS prevention
 */
export const securityMiddleware = [preventSQLInjection, preventXSS];
