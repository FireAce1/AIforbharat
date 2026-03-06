import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
}

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors?: ValidationErrorDetail[];

  constructor(message: string, statusCode: number, errors?: ValidationErrorDetail[]) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    
    const response: any = {
      success: false,
      message: err.message,
    };

    // Include field-level validation errors if present
    if (err.errors && err.errors.length > 0) {
      response.errors = err.errors;
    }

    return res.status(err.statusCode).json(response);
  }

  logger.error(`500 - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
    stack: err.stack,
  });

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};
