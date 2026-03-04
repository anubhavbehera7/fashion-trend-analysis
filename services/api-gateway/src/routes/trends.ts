/**
 * Trend endpoints — read from PostgreSQL with Redis caching (cache-aside pattern).
 * Cache invalidated on updates; TTL ensures eventual consistency.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../services/database';
import { cacheGet, cacheSet } from '../services/cache';
import { validate, schemas } from '../middleware/validator';
import { config } from '../config';

export const trendsRouter = Router();

// GET /api/trends — List all trends with pagination
trendsRouter.get('/', validate(schemas.getTrends, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, sortBy, order } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const cacheKey = `trends:list:${page}:${limit}:${sortBy}:${order}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const sortColumn = sortBy === 'popularity' ? 'popularity_score'
      : sortBy === 'growth' ? 'growth_rate' : 'created_at';

    const [result, countResult] = await Promise.all([
      query(
        `SELECT id, name, cluster_id, popularity_score, growth_rate, created_at, metadata
         FROM trends ORDER BY ${sortColumn} ${order === 'asc' ? 'ASC' : 'DESC'}
         LIMIT $1 OFFSET $2`,
        [parseInt(limit), offset]
      ),
      query('SELECT COUNT(*) FROM trends'),
    ]);

    const total = parseInt(countResult.rows[0].count as string);
    const response = {
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    };

    await cacheSet(cacheKey, response, config.cache.trendsTtl);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /api/trends/:id — Get trend with 30-day history
trendsRouter.get('/:id', validate(schemas.trendId, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const cacheKey = `trend:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [trendResult, historyResult] = await Promise.all([
      query('SELECT * FROM trends WHERE id = $1', [id]),
      query(
        `SELECT date, popularity_score, image_count FROM trend_history
         WHERE trend_id = $1 ORDER BY date DESC LIMIT 30`,
        [id]
      ),
    ]);

    if (trendResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Trend not found' });
    }

    const response = { success: true, data: { ...trendResult.rows[0], history: historyResult.rows } };
    await cacheSet(cacheKey, response, config.cache.trendsTtl);
    res.json(response);
  } catch (err) {
    next(err);
  }
});
