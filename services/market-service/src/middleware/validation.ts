import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Validation error structure
 */
interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Custom error class for validation errors
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

    req[source] = value;
    next();
  };
};

/**
 * Common validation schemas
 */

// Coordinates validation
export const latitudeSchema = Joi.number().min(-90).max(90).required().messages({
  'number.min': 'Latitude must be between -90 and 90',
  'number.max': 'Latitude must be between -90 and 90',
  'any.required': 'Latitude is required',
  'number.base': 'Latitude must be a number',
});

export const longitudeSchema = Joi.number().min(-180).max(180).required().messages({
  'number.min': 'Longitude must be between -180 and 180',
  'number.max': 'Longitude must be between -180 and 180',
  'any.required': 'Longitude is required',
  'number.base': 'Longitude must be a number',
});

// UUID validation
export const uuidSchema = Joi.string().uuid().required().messages({
  'string.guid': 'Must be a valid UUID',
  'any.required': 'ID is required',
});

/**
 * Market Service Validation Schemas
 */

// Get prices query schema
export const getPricesQuerySchema = Joi.object({
  crop_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Crop name must be at least 2 characters',
    'string.max': 'Crop name must not exceed 100 characters',
    'any.required': 'Crop name is required',
  }),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  radius_km: Joi.number().positive().max(100).default(50).messages({
    'number.positive': 'Radius must be a positive number',
    'number.max': 'Radius cannot exceed 100 kilometers',
  }),
  limit: Joi.number().integer().min(1).max(20).default(5).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 20',
  }),
});

// Get forecast query schema
export const getForecastQuerySchema = Joi.object({
  crop_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Crop name must be at least 2 characters',
    'string.max': 'Crop name must not exceed 100 characters',
    'any.required': 'Crop name is required',
  }),
  market_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Market name must be at least 2 characters',
    'string.max': 'Market name must not exceed 100 characters',
    'any.required': 'Market name is required',
  }),
  days: Joi.number().integer().valid(7, 30, 90).default(7).messages({
    'any.only': 'Days must be one of: 7, 30, 90',
  }),
});

// Create price alert schema
export const createAlertSchema = Joi.object({
  user_id: uuidSchema,
  crop_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Crop name must be at least 2 characters',
    'string.max': 'Crop name must not exceed 100 characters',
    'any.required': 'Crop name is required',
  }),
  market_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Market name must be at least 2 characters',
    'string.max': 'Market name must not exceed 100 characters',
    'any.required': 'Market name is required',
  }),
  target_price: Joi.number().positive().required().messages({
    'number.positive': 'Target price must be a positive number',
    'any.required': 'Target price is required',
  }),
  phone: Joi.string().pattern(/^\+91[6-9]\d{9}$/).required().messages({
    'string.pattern.base': 'Phone number must be a valid Indian phone number (+91[6-9]XXXXXXXXX)',
    'any.required': 'Phone number is required',
  }),
});

/**
 * Security middleware
 */

const sanitizeString = (input: string): string => {
  if (!input) return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[<>'"]/g, (char) => {
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

const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
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

export const preventSQLInjection = (req: Request, _res: Response, next: NextFunction) => {
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /(--|;|\/\*|\*\/|xp_|sp_)/gi,
  ];

  const checkForSQLInjection = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlInjectionPatterns.some((pattern) => pattern.test(value));
    }
    if (Array.isArray(value)) return value.some(checkForSQLInjection);
    if (value !== null && typeof value === 'object') {
      return Object.values(value).some(checkForSQLInjection);
    }
    return false;
  };

  const sources = [req.body, req.query, req.params];
  for (const source of sources) {
    if (source && checkForSQLInjection(source)) {
      return next(
        new ValidationException([
          { field: 'input', message: 'Invalid input detected. Please remove special characters.' },
        ])
      );
    }
  }
  next();
};

export const preventXSS = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
};

export const securityMiddleware = [preventSQLInjection, preventXSS];
