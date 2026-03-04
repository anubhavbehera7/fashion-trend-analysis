import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { query } from '../services/database';
import { cacheGet, cacheSet } from '../services/cache';
import { config } from '../config';
import { logger } from '../logger';

export const analyticsRouter = Router();

// GET /api/analytics/overview
analyticsRouter.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'analytics:overview';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [imagesResult, trendsResult, recentResult] = await Promise.all([
      query('SELECT COUNT(*) as total, SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed FROM images'),
      query('SELECT COUNT(*) as total, AVG(popularity_score) as avg_popularity, MAX(growth_rate) as max_growth FROM trends'),
      query(`SELECT COUNT(*) as count FROM images WHERE created_at > NOW() - INTERVAL '24 hours'`),
    ]);

    const response = {
      success: true,
      data: {
        images: {
          total: parseInt(imagesResult.rows[0].total as string),
          processed: parseInt(imagesResult.rows[0].processed as string),
        },
        trends: {
          total: parseInt(trendsResult.rows[0].total as string),
          avgPopularity: parseFloat(trendsResult.rows[0].avg_popularity as string || '0'),
          maxGrowthRate: parseFloat(trendsResult.rows[0].max_growth as string || '0'),
        },
        activity: { imagesLast24h: parseInt(recentResult.rows[0].count as string) },
        timestamp: new Date().toISOString(),
      },
    };

    await cacheSet(cacheKey, response, config.cache.analyticsTtl);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/velocity — delegates to ML service
analyticsRouter.get('/velocity', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'analytics:velocity';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const mlResponse = await axios.get(`${config.mlAnalysisUrl}/analyze/trends`, { timeout: 10000 });
    const response = { success: true, data: mlResponse.data };
    await cacheSet(cacheKey, response, config.cache.analyticsTtl);
    res.json(response);
  } catch (err) {
    logger.error('ML Analysis service error', { error: (err as Error).message });
    next(err);
  }
});
