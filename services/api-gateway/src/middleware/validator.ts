/**
 * Request validation using Joi. Validates before route handlers — fail fast.
 * stripUnknown: true removes unexpected fields (prevents parameter pollution attacks).
 */
import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

type ValidationTarget = 'body' | 'params' | 'query';

export function validate(schema: Joi.Schema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message).join('; ');
      return next(new AppError(`Validation failed: ${details}`, 400));
    }

    req[target] = value;
    next();
  };
}

export const schemas = {
  uploadImage: Joi.object({
    url: Joi.string().uri().required(),
    source: Joi.string().valid('instagram', 'pinterest', 'blog', 'manual').default('manual'),
    metadata: Joi.object().unknown(true).default({}),
  }),

  getTrends: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('popularity', 'growth', 'created_at').default('popularity'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  trendId: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
};
