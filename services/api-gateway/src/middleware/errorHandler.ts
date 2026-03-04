import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';
import { config } from '../config';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const isOperational = 'isOperational' in err ? err.isOperational : false;

  if (isOperational) {
    logger.warn('Operational error', { message: err.message, statusCode, path: req.path });
  } else {
    logger.error('Unexpected error', { message: err.message, stack: err.stack, path: req.path });
  }

  res.status(statusCode).json({
    success: false,
    error: err.message,
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
  });
}
