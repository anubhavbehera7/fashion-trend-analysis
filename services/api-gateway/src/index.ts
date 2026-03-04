/**
 * API Gateway — Express.js entry point
 *
 * Single entry point for all client requests. Handles rate limiting, routing,
 * response caching, and graceful shutdown for zero-downtime Kubernetes deployments.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config';
import { logger } from './logger';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { trendsRouter } from './routes/trends';
import { imagesRouter } from './routes/images';
import { analyticsRouter } from './routes/analytics';
import { pool } from './services/database';
import { getRedisClient } from './services/cache';

const app = express();

// ─── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(rateLimiter);
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.path.startsWith('/health'),
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/api/trends', trendsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/analytics', analyticsRouter);
app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }));
app.use(errorHandler);

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connected');
  } catch (err) {
    logger.error('PostgreSQL unavailable', { error: (err as Error).message });
  }

  try {
    await getRedisClient();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn('Redis unavailable, caching disabled', { error: (err as Error).message });
  }

  const server = app.listen(config.port, () => {
    logger.info('API Gateway started', { port: config.port, env: config.nodeEnv });
  });

  // Graceful shutdown: drain in-flight requests before closing (K8s SIGTERM handling)
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await pool.end();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => { logger.error('Forced shutdown'); process.exit(1); }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Startup failed', { error: err.message });
  process.exit(1);
});
