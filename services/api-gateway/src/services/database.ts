/**
 * PostgreSQL connection pool using node-postgres.
 * Pool is shared across all requests — one connection per request would exhaust DB connections under load.
 */
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from '../logger';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error', { error: err.message });
});

/**
 * Execute a parameterized query. Always use parameterized queries — never string interpolation (SQL injection risk).
 */
export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (duration > 100) {
    logger.warn('Slow query', { query: text, duration, rows: result.rowCount });
  }

  return result;
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}
