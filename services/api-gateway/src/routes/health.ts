/**
 * Health check endpoints for Kubernetes probes.
 * /health/live  — liveness:  is the process alive? K8s restarts on failure.
 * /health/ready — readiness: can we serve traffic? K8s removes from LB on failure.
 */
import { Router, Request, Response } from 'express';
import { pool } from '../services/database';
import { getRedisClient } from '../services/cache';
import { logger } from '../logger';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive' });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};
  let isReady = true;

  try {
    await pool.query('SELECT 1');
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'error';
    isReady = false;
    logger.warn('Readiness: PostgreSQL unavailable');
  }

  try {
    const client = await getRedisClient();
    await client.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
    isReady = false;
    logger.warn('Readiness: Redis unavailable');
  }

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});
