# Architecture — Fashion Trend Analysis Platform

## System Overview

```
External Traffic
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                        │
│                                                               │
│  ┌──────────┐   ┌───────────────┐   ┌──────────────────┐   │
│  │ Frontend │──▶│  API Gateway  │──▶│ Image Processor  │   │
│  │ Next.js  │   │ Node.js/TS    │   │ C++/OpenCV       │   │
│  │ 1 pod    │   │ 2-10 pods HPA │   │ 3-20 pods HPA    │   │
│  └──────────┘   └───────┬───────┘   └────────┬─────────┘   │
│                          │                    │              │
│                          ▼                    ▼              │
│                  ┌───────────────┐   ┌────────────────┐    │
│                  │  ML Analysis  │   │     Qdrant     │    │
│                  │ Python/FastAPI│──▶│  Vector DB     │    │
│                  │ 2-10 pods HPA │   │  20Gi PVC      │    │
│                  └───────────────┘   └────────────────┘    │
│                                                               │
│  ┌────────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐  │
│  │ PostgreSQL │  │  Redis  │  │  MinIO   │  │ RabbitMQ │  │
│  │ StatefulSet│  │  Cache  │  │ Storage  │  │  Queue   │  │
│  │ 10Gi PVC   │  │ 512MB   │  │ S3-compat│  │          │  │
│  └────────────┘  └─────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Image Processing Pipeline
```
User uploads URL
    │
    ▼
API Gateway → validates URL, stores pending record in PostgreSQL
    │
    ▼ (async, fire-and-forget)
Image Processor (C++)
    ├── Downloads image via HTTP
    ├── Preprocesses (resize to 512x512)
    ├── Extracts HSV color histogram (300D)
    ├── Extracts SIFT descriptors (128D)
    ├── Extracts ORB descriptors (84D)
    └── Upserts 512D vector to Qdrant
    │
    ▼
API Gateway updates PostgreSQL (processed=true, vector_id=xyz)
```

### Trend Detection Pipeline
```
Scheduled trigger (or POST /cluster)
    │
    ▼
ML Analysis service
    ├── Scrolls Qdrant for all vectors (batch of 10K)
    ├── Runs DBSCAN clustering on L2-normalized vectors
    │   ├── epsilon=0.3 (cosine distance threshold)
    │   └── min_samples=5 (minimum trend size)
    ├── Maps clusters → fashion trends
    └── Persists trend records to PostgreSQL
    │
    ▼
Trend history updated with today's popularity scores
    │
    ▼
API Gateway reads trends from PostgreSQL (Redis-cached)
    │
    ▼
Frontend displays trend dashboard
```

### Similarity Search Flow
```
GET /api/images/:id/similar
    │
    ▼
API Gateway retrieves vector_id from PostgreSQL
    │
    ▼
Image Processor GET /search { vectorId, limit }
    │
    ▼
Qdrant HNSW nearest-neighbor search (O(log N))
    │
    ▼
Top-K similar image IDs returned
    │
    ▼
API Gateway enriches with PostgreSQL metadata
    │
    ▼ (cached in Redis for 1 hour)
Client receives similar images with scores
```

## Component Details

### API Gateway (Node.js/TypeScript)

**Technology**: Express.js, TypeScript, pg, redis, axios

**Responsibilities**:
- HTTP routing for all client requests
- Request validation (Joi schemas)
- Redis caching (cache-aside pattern)
- Service orchestration (calls Image Processor + ML Analysis)
- Rate limiting (100 req/15min per IP)
- Health check endpoints for Kubernetes

**Scaling**: Stateless; auto-scales 2-10 pods via HPA. Session state in Redis.

### Image Processor (C++/OpenCV)

**Technology**: C++17, OpenCV 4.x, cpp-httplib, nlohmann/json

**Responsibilities**:
- HTTP server for processing requests
- Feature extraction (SIFT + ORB + HSV histogram → 512D)
- Qdrant vector upsert
- Vector similarity search (delegates to Qdrant)

**Performance**: ~200 imgs/sec per pod (4-core, 512x512 images)

**Why C++**:
- OpenCV's C++ API provides zero-copy `cv::Mat` operations
- No GIL (Python Global Interpreter Lock)
- SIMD-optimized matrix operations via OpenCV's LAPACK/IPP backends
- Direct memory layout control for large image batches

**Scaling**: Most CPU-intensive service; HPA scales 3-20 pods.

### ML Analysis Service (Python/FastAPI)

**Technology**: Python 3.11, FastAPI, scikit-learn, Qdrant client, psycopg2

**Responsibilities**:
- DBSCAN clustering for trend detection
- K-means for fixed-category analysis
- Trend velocity calculation (time-series analysis)
- PostgreSQL trend persistence

**Why Python**:
- scikit-learn, numpy, scipy are Python-first
- FastAPI provides automatic OpenAPI docs
- Rapid ML iteration without recompilation

**Scaling**: CPU-bound during clustering; scales 2-10 pods. Clustering runs are infrequent (scheduled) so scaling is less critical.

### Web Scraper (Python/Scrapy/Playwright)

**Technology**: Python 3.11, Scrapy, Playwright, Redis, MinIO, httpx

**Responsibilities**:
- Crawl fashion image sources
- Playwright for JavaScript-rendered pages
- Store images to MinIO (S3-compatible)
- Publish processing jobs to Redis queue

**Ethical design**:
- Respects robots.txt
- Rate-limited: 1 req/sec per domain
- Identifies as bot via User-Agent
- 1-hour between scrape cycles

### Frontend (Next.js 14)

**Technology**: Next.js 14 App Router, TypeScript, TailwindCSS, Recharts

**Architecture**: Hybrid rendering
- **Server Components**: Initial data fetch (no JS hydration overhead)
- **Client Components**: Interactive charts (Recharts requires browser APIs)
- **ISR**: Trend data revalidated every 60 seconds

## Database Design

### PostgreSQL (Relational Data)
Used for: structured metadata, trend history, audit trail
- `images`: URL, source, processing status, vector ID
- `trends`: cluster assignments, popularity scores, growth rates
- `trend_history`: time-series data for velocity calculation
- `scrape_jobs`: audit trail for scraping operations

### Qdrant (Vector Data)
Used for: 512D embeddings, similarity search
- Collection: `fashion_images`
- Distance metric: Cosine (better than Euclidean for normalized vectors)
- Index: HNSW (m=16, ef_construct=100)
- Storage: ~2KB per vector → 10M vectors ≈ 20GB

### Redis (Cache + Queue)
Used for: API response caching, job queue
- Cache keys: `trend:{id}`, `trends:list:*`, `analytics:*`
- TTL: 60-3600 seconds depending on data freshness requirement
- Job queue: `fashion:image_jobs` (LPUSH/BLPOP pattern)
- AOF persistence for queue durability

## Scalability Strategy

### Horizontal Scaling (Stateless Services)
All application services (API Gateway, Image Processor, ML Analysis) are stateless:
- No in-process state (all state in Redis/PostgreSQL/Qdrant)
- Can add/remove pods instantly
- HPA scales based on CPU utilization

### Vertical Scaling (Stateful Services)
Databases scale vertically first, then horizontally:
- PostgreSQL: add read replicas for read-heavy workloads
- Qdrant: Raft-based distributed mode for 3+ node cluster
- Redis: Redis Cluster for 100GB+ datasets

### Cost Optimization
- Off-peak: HPA scales image processors down to 3 replicas (40% cost reduction)
- Spot instances: Image processors are stateless → perfect for spot/preemptible VMs
- Tiered storage: Move old MinIO images to cheaper cold storage after 30 days

## High Availability Design

| Service | Strategy | RTO |
|---------|----------|-----|
| API Gateway | 2+ replicas, HPA | <30s |
| Image Processor | 3+ replicas, stateless | <30s |
| PostgreSQL | Single pod + backups | ~5min |
| Qdrant | Single pod + snapshots | ~5min |
| Redis | Single pod + AOF | <2min |

For production HA:
- PostgreSQL: managed service (RDS, Cloud SQL) with automated failover
- Redis: managed service (ElastiCache, Memorystore) with replica
- Qdrant: 3-node cluster with Raft consensus

## Technology Decisions

### Why Qdrant over Pinecone/Weaviate?
- **Open-source**: self-hosted, no vendor lock-in
- **Rust-based**: memory-safe, consistent performance
- **Payload filtering**: filter by metadata during vector search (unique)
- **Cost**: free at this scale vs $0.10/1K queries for Pinecone

### Why DBSCAN over K-means for trends?
- **No need to specify K**: fashion trends emerge unpredictably
- **Noise handling**: outliers marked as noise, not forced into clusters
- **Arbitrary shapes**: trend clusters aren't always spherically distributed

### Why C++ for image processing?
- **10-20x faster than Python equivalent**: same OpenCV code, different binding overhead
- **Memory control**: `cv::Mat` in-place operations, no Python object overhead
- **No GIL**: true parallelism within the process (future: CUDA GPU support)
