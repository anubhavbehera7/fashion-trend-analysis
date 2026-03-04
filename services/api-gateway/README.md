# API Gateway Service

Node.js/TypeScript Express gateway — single entry point for all client requests.

## Features

- Type-safe TypeScript with strict mode
- Redis cache-aside pattern (5min TTL for trends, 1hr for images)
- Rate limiting: 100 req/15min per IP
- Joi schema validation on all inputs
- `/health/live` and `/health/ready` for Kubernetes probes
- Graceful shutdown with 30s drain on SIGTERM
- Winston structured JSON logging in production

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Basic health |
| GET | /health/ready | Readiness probe (checks DB + Redis) |
| GET | /health/live | Liveness probe |
| GET | /api/trends | List trends (paginated) |
| GET | /api/trends/:id | Trend details + 30-day history |
| POST | /api/images/upload | Submit image for processing |
| GET | /api/images/:id | Image details |
| GET | /api/images/:id/similar | Find visually similar images |
| GET | /api/analytics/overview | Platform statistics |
| GET | /api/analytics/velocity | Trend growth rates |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | HTTP port |
| DATABASE_URL | - | PostgreSQL connection string |
| REDIS_URL | - | Redis connection string |
| IMAGE_PROCESSOR_URL | - | C++ service URL |
| ML_ANALYSIS_URL | - | Python ML service URL |
| LOG_LEVEL | info | Winston log level |
| ALLOWED_ORIGINS | localhost:3001 | CORS origins (comma-separated) |

## Development

```bash
npm install
npm run dev      # Hot-reload dev server
npm run build    # Compile TypeScript
npm test         # Run Jest tests
npm run typecheck # Type-check without emit
```

## Architecture

Cache-aside pattern: check cache → miss → query DB → populate cache.
Reduces PostgreSQL load ~80% for read-heavy trend endpoints.

Service calls use Axios with 30s timeout to prevent cascade failures from slow downstream services.
