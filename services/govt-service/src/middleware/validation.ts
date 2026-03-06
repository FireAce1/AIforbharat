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

export const uuidSchema = Joi.string().uuid().required().messages({
  'string.guid': 'Must be a valid UUID',
  'any.required': 'ID is required',
});

export const languageSchema = Joi.string().valid('hi', 'mr', 'en').default('hi').messages({
  'any.only': 'Language must be one of: hi (Hindi), mr (Marathi), en (English)',
});

export const phoneSchema = Joi.string().pattern(/^\+91[6-9]\d{9}$/).required().messages({
  'string.pattern.base': 'Phone number must be a valid Indian phone number (+91[6-9]XXXXXXXXX)',
  'any.required': 'Phone number is required',
});

/**
 * Government Service Validation Schemas
 */

// Search schemes query schema
export const searchSchemesQuerySchema = Joi.object({
  query: Joi.string().min(1).max(200).optional().trim().messages({
    'string.min': 'Search query must be at least 1 character',
    'string.max': 'Search query must not exceed 200 characters',
  }),
  language: languageSchema.optional(),
  scheme_type: Joi.string().max(50).optional(),
  state: Joi.string().max(50).optional(),
  max_land_hectares: Joi.number().positive().optional().messages({
    'number.positive': 'Max land hectares must be a positive number',
  }),
  crop_type: Joi.string().max(100).optional(),
  page: Joi.number().integer().min(1).default(1).messages({
    'number.min': 'Page must be at least 1',
    'number.integer': 'Page must be an integer',
  }),
  limit: Joi.number().integer().min(1).max(50).default(20).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 50',
    'number.integer': 'Limit must be an integer',
  }),
});

// Get eligible schemes query schema
export const eligibleSchemesQuerySchema = Joi.object({
  user_id: uuidSchema,
  language: languageSchema.optional(),
});

// Subscribe to alerts schema
export const subscribeAlertSchema = Joi.object({
  user_id: uuidSchema,
  scheme_id: uuidSchema,
  phone: phoneSchema,
});

// Chatbot query schema
export const chatbotQuerySchema = Joi.object({
  user_id: uuidSchema,
  query: Joi.string().min(1).max(500).required().trim().messages({
    'string.min': 'Query must be at least 1 character',
    'string.max': 'Query must not exceed 500 characters',
    'any.required': 'Query is required',
  }),
  language: languageSchema.optional(),
  is_voice: Joi.boolean().default(false),
});

// Get scheme by ID params schema
export const schemeIdParamsSchema = Joi.object({
  id: uuidSchema,
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
