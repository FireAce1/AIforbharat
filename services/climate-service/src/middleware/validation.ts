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

export const uuidSchema = Joi.string().uuid().required().messages({
  'string.guid': 'Must be a valid UUID',
  'any.required': 'ID is required',
});

/**
 * Climate Service Validation Schemas
 */

// Weather forecast query schema
export const weatherForecastQuerySchema = Joi.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  days: Joi.number().integer().min(1).max(7).default(7).messages({
    'number.min': 'Days must be at least 1',
    'number.max': 'Days cannot exceed 7',
    'number.integer': 'Days must be an integer',
  }),
});

// Water advisory query schema
export const waterAdvisoryQuerySchema = Joi.object({
  farm_id: uuidSchema,
  crop_id: uuidSchema.optional(),
});

// Send alert schema
export const sendAlertSchema = Joi.object({
  user_ids: Joi.array().items(uuidSchema).min(1).required().messages({
    'array.min': 'At least one user ID is required',
    'any.required': 'User IDs are required',
  }),
  alert_type: Joi.string()
    .valid('HEAVY_RAINFALL', 'EXTREME_HEAT', 'FROST', 'HIGH_WIND', 'HAIL')
    .required()
    .messages({
      'any.only': 'Alert type must be one of: HEAVY_RAINFALL, EXTREME_HEAT, FROST, HIGH_WIND, HAIL',
      'any.required': 'Alert type is required',
    }),
  message: Joi.string().min(10).max(500).required().messages({
    'string.min': 'Message must be at least 10 characters',
    'string.max': 'Message must not exceed 500 characters',
    'any.required': 'Message is required',
  }),
  severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').default('MEDIUM').messages({
    'any.only': 'Severity must be one of: LOW, MEDIUM, HIGH, CRITICAL',
  }),
});

// Water savings query schema
export const waterSavingsQuerySchema = Joi.object({
  farm_id: uuidSchema,
  start_date: Joi.date().iso().required().messages({
    'date.base': 'Start date must be a valid date',
    'date.format': 'Start date must be in ISO 8601 format',
    'any.required': 'Start date is required',
  }),
  end_date: Joi.date()
    .iso()
    .required()
    .greater(Joi.ref('start_date'))
    .messages({
      'date.base': 'End date must be a valid date',
      'date.format': 'End date must be in ISO 8601 format',
      'date.greater': 'End date must be after start date',
      'any.required': 'End date is required',
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
