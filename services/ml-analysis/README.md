# ML Analysis Service (Python/FastAPI)

Trend detection service using DBSCAN and K-means clustering on 512D fashion image embeddings.

## Algorithms

### DBSCAN (Default)
- **Why**: Discovers cluster count automatically; handles outliers as noise
- `epsilon=0.3`: Cosine distance threshold — vectors within 30% similarity are same cluster
- `min_samples=5`: At least 5 images needed to form a trend cluster
- **Best for**: Micro-trend detection where count is unknown

### K-means
- **Why**: Fast, deterministic, good for known macro-categories
- Requires pre-specifying `n_clusters`
- Uses k-means++ initialization for better convergence
- **Best for**: Fixed taxonomy (streetwear, formal, casual, athletic)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /analyze/trends | Trend velocity for all trends |
| POST | /cluster | Run clustering on image vectors |
| GET | /trends/:id/velocity | Velocity for specific trend |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | - | PostgreSQL connection string |
| QDRANT_URL | http://localhost:6333 | Qdrant server URL |
| REDIS_URL | redis://localhost:6379 | Redis URL |
| LOG_LEVEL | INFO | Logging level |

## Development

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Docs at http://localhost:8000/docs
```

## Trend Velocity Calculation

```
velocity_7d  = (score_today - score_7_days_ago) / score_7_days_ago × 100%
velocity_30d = (score_today - score_30_days_ago) / score_30_days_ago × 100%
acceleration = velocity_7d_recent - velocity_7d_older
is_emerging  = velocity_7d > 10%
```
