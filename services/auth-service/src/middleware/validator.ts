import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from './errorHandler';

/**
 * Validation error structure
 */
interface ValidationError {
  field: string;
  message: string;
  value?: any;
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

      const errorMessage = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
      return next(new AppError(errorMessage, 400, errors));
    }

    // Replace request data with sanitized/converted values
    req[source] = value;
    next();
  };
};

/**
 * Sanitization utilities
 */

/**
 * Sanitize string to prevent XSS attacks
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

/**
 * Sanitize object recursively
 */
const sanitizeObject = (obj: any): any => {
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
 */
export const preventSQLInjection = (req: Request, _res: Response, next: NextFunction) => {
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /(--|;|\/\*|\*\/|xp_|sp_)/gi,
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

  const sources = [req.body, req.query, req.params];
  
  for (const source of sources) {
    if (source && checkForSQLInjection(source)) {
      return next(
        new AppError('Invalid input detected. Please remove special characters.', 400)
      );
    }
  }

  next();
};

/**
 * XSS prevention middleware
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
 */
export const securityMiddleware = [preventSQLInjection, preventXSS];

/**
 * Validation schemas
 */
export const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+91[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be a valid Indian phone number (+91[6-9]XXXXXXXXX)',
      'any.required': 'Phone number is required',
      'string.empty': 'Phone number cannot be empty',
    }),
});

export const verifyOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+91[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be a valid Indian phone number (+91[6-9]XXXXXXXXX)',
      'any.required': 'Phone number is required',
      'string.empty': 'Phone number cannot be empty',
    }),
  code: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only digits',
      'any.required': 'OTP code is required',
      'string.empty': 'OTP code cannot be empty',
    }),
});
