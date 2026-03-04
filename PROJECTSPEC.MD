I need you to create a complete Fashion Trend Analysis Platform - a production-grade microservices system that demonstrates computer vision, vector databases, machine learning, and Kubernetes orchestration skills for my resume.

## PROJECT OVERVIEW

**Real-World Use Case**: Fashion retailers (like Zara/H&M) need to identify emerging trends quickly. This platform scrapes fashion images from social media, extracts visual features using computer vision, clusters similar styles to detect trends, and tracks popularity over time.

**Tech Stack Requirements**:
- Languages: C++ (image processing), Python (ML/scraping), Node.js/TypeScript (API)
- Computer Vision: OpenCV (SIFT, ORB, color histograms)
- Databases: PostgreSQL, Qdrant (vector DB), Redis
- Infrastructure: Docker, Kubernetes, microservices architecture

## ARCHITECTURE - 5 MICROSERVICES

### 1. API Gateway (Node.js/TypeScript)
- Express.js REST API with TypeScript
- Routes: /health, /api/trends, /api/images, /api/analytics
- Middleware: CORS, helmet, rate limiting, morgan logging
- Integration: PostgreSQL (pg), Redis (redis client), axios for service calls
- Health checks: /health, /health/ready, /health/live
- Environment config via dotenv
- Full error handling and validation (Joi)
- Comprehensive README with API documentation

### 2. Image Processor (C++)
- HTTP server using cpp-httplib
- OpenCV 4.x for computer vision
- Feature extraction methods:
  * SIFT features (scale-invariant keypoints)
  * ORB features (binary descriptors)
  * Color histograms (HSV color space)
- Endpoints: POST /process, POST /search, GET /health
- CMake build system
- JSON parsing with nlohmann/json
- Generates 512-dimensional feature vectors
- Base64 image decoding
- Comprehensive comments explaining CV algorithms

### 3. ML Analysis Service (Python)
- FastAPI framework
- scikit-learn for clustering (DBSCAN, K-means)
- Endpoints: GET /analyze/trends, POST /cluster, GET /trends/{id}/velocity
- Qdrant client for vector queries
- PostgreSQL connection (psycopg2)
- Trend detection algorithms
- Growth rate calculation
- Pydantic models for validation
- Comprehensive docstrings

### 4. Web Scraper Service (Python)
- Scrapy framework structure
- Playwright for JavaScript rendering
- Target sources: Instagram, Pinterest, fashion blogs
- Rate limiting and proxy rotation support
- Job queue integration (Redis)
- Image download to MinIO/S3
- Metadata extraction
- Ethical scraping practices (robots.txt, rate limits)

### 5. Frontend (Next.js)
- Next.js 14+ with App Router
- TypeScript throughout
- Dashboard components:
  * Trend visualization (charts with Recharts)
  * Image gallery with similarity search
  * Analytics dashboard
  * Upload interface
- TailwindCSS for styling
- API integration with fetch/axios
- Responsive design

## INFRASTRUCTURE

### Docker Compose (docker-compose.yml)
Services:
- postgres:16-alpine with persistent volume
- qdrant/qdrant:latest with storage volume
- redis:7-alpine with AOF persistence
- minio/minio:latest for object storage
- rabbitmq:3-management (optional, for queuing)
- All 5 application services with proper networking
- Health checks for all services
- Environment variables properly configured
- Volume mappings for development

### Kubernetes Manifests (k8s/base/)
Create separate YAML files:

**namespace.yaml**: fashion-trends namespace

**postgres.yaml**:
- StatefulSet with 1 replica
- PersistentVolumeClaim (10Gi)
- ConfigMap for DB config
- Secret for password
- Service (ClusterIP: None)
- Probes: pg_isready

**redis.yaml**:
- Deployment with 1 replica
- EmptyDir volume (or PVC for prod)
- Service
- Probes: redis-cli ping

**qdrant.yaml**:
- StatefulSet with PVC (20Gi)
- Service with ports 6333 (HTTP) and 6334 (gRPC)
- Resource limits (2Gi RAM, 1 CPU)
- Probes

**api-gateway.yaml**:
- Deployment with 2 replicas
- Service (LoadBalancer)
- HorizontalPodAutoscaler (2-10 replicas, 70% CPU target)
- Environment variables from ConfigMaps/Secrets
- Resource requests/limits
- Liveness/readiness probes

**image-processor.yaml**:
- Deployment with 3 replicas
- Service
- HPA (3-20 replicas, 75% CPU target)
- Higher CPU/memory resources (2Gi RAM, 1-2 CPU)
- Probes

**ml-analysis.yaml**:
- Deployment with 2 replicas
- Service
- HPA (2-10 replicas, 70% CPU target)
- Resource limits
- Probes

**kustomization.yaml**: Lists all resources with common labels

### Kubernetes Overlays
**k8s/overlays/dev/kustomization.yaml**:
- Patches to reduce replicas to 1 for dev
- Development environment label

**k8s/overlays/prod/kustomization.yaml**:
- Production environment label
- Uses base replica counts and HPA

## DOCKERFILES

Each service needs optimized Dockerfile:

**API Gateway**: Multi-stage Node.js build
**Image Processor**: Ubuntu with OpenCV, CMake build
**ML Analysis**: Python 3.11-slim with scientific packages
**Web Scraper**: Python with Playwright dependencies
**Frontend**: Next.js optimized build

All should include:
- Health check commands
- Proper WORKDIR
- Non-root users (where applicable)
- Layer optimization

## DOCUMENTATION

### README.md (root)
- Project overview with architecture diagram (ASCII art)
- Tech stack summary
- Quick start instructions
- Service URLs
- Learning objectives
- Resume highlights section

### GETTING_STARTED.md
- 5-minute quick start
- What makes this resume-worthy
- Resume bullet points (copy-paste ready)
- Common commands
- Interview talking points
- Next steps for customization

### docs/ARCHITECTURE.md
- System overview with detailed component descriptions
- Data flow diagrams (text-based)
- Scalability strategy
- High availability design
- Performance benchmarks
- Technology decisions explained

### docs/DEPLOYMENT.md
- Prerequisites
- Docker Compose setup
- Kubernetes deployment (minikube, GKE, EKS, AKS)
- Database initialization SQL
- Monitoring deployment status
- Troubleshooting guide
- Scaling instructions

### Service READMEs
Each service directory needs README.md:
- Purpose and features
- API endpoints
- Environment variables
- Development setup
- Docker commands
- Architecture notes

## AUTOMATION

### Makefile
Common targets:
- help, build, up, down, logs, ps, clean
- dev-api, dev-ml (run services locally)
- test-* (test each service)
- k8s-build, k8s-deploy-dev, k8s-deploy-prod, k8s-delete
- k8s-status, k8s-logs-*, k8s-port-forward
- db-connect, db-init
- monitor (open dashboards)
- format, install

### scripts/quick-start.sh
Interactive bash script:
- Check prerequisites (docker, kubectl)
- Prompt for deployment type (compose vs k8s)
- Build and deploy accordingly
- Print access URLs
- Show status commands

### .gitignore
Cover: node_modules, __pycache__, build/, dist/, .env, .vscode, .DS_Store, etc.

## KEY IMPLEMENTATION DETAILS

### Image Processor (C++)
```cpp
// Include structure for:
- FeatureExtractor class with SIFT, ORB, color histogram methods
- ImageProcessorServer class with HTTP endpoints
- Base64 decoding utility
- Feature vector combination (512D total: 300 color + 128 SIFT + 84 ORB)
- Proper OpenCV Mat handling
- JSON request/response handling
```

### ML Analysis (Python)
```python
# Include:
- FastAPI app with CORS
- DBSCAN clustering with cosine distance
- K-means clustering with adaptive cluster count
- Trend velocity calculation (time-series analysis)
- Mock data generators for testing
- Qdrant client integration structure
- PostgreSQL query examples
```

### API Gateway (TypeScript)
```typescript
// Include:
- Express app with middleware chain
- Route handlers with proper error handling
- Redis caching wrapper
- PostgreSQL connection pool
- Service-to-service communication (axios)
- Request validation with Joi
- Winston logger configuration
- Graceful shutdown handlers
```

## DATABASE SCHEMAS

### PostgreSQL
```sql
-- Include in deployment docs or init script:
CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  vector_id TEXT
);

CREATE TABLE trends (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  cluster_id INTEGER,
  popularity_score FLOAT,
  growth_rate FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trend_history (
  id SERIAL PRIMARY KEY,
  trend_id INTEGER REFERENCES trends(id),
  date DATE NOT NULL,
  popularity_score FLOAT,
  image_count INTEGER
);

-- Indexes for performance
CREATE INDEX idx_images_created_at ON images(created_at);
CREATE INDEX idx_images_source ON images(source);
```

## PACKAGE.JSON / REQUIREMENTS.TXT / CMAKELISTS.TXT

Provide complete, working dependency files for each service with specific versions that are known to work together.

## PROJECT SUMMARY

Create PROJECT_SUMMARY.md with:
- What's included (checklist)
- Resume bullet points (6+ ready-to-use)
- Interview talking points
- Technical depth examples
- Trade-off discussions
- Performance claims with justification
- What to learn next
- Common issues & solutions

## CRITICAL REQUIREMENTS

1. **Production-Ready**: All code should be production-quality with error handling
2. **Well-Commented**: Explain WHY not just WHAT, especially for CV and ML algorithms
3. **Runnable**: Everything should work with `docker-compose up`
4. **Resume-Focused**: Include explicit resume bullet points and interview talking points
5. **Learning-Oriented**: Comments should teach, not just document
6. **Complete**: No TODO stubs for core functionality - implement real feature extraction, clustering, etc.
7. **Realistic Performance**: Claims should be realistic (200 imgs/sec is achievable with C++/OpenCV)

## DELIVERABLES

Organize as:
fashion-trend-analysis/
├── README.md
├── GETTING_STARTED.md
├── PROJECT_SUMMARY.md
├── .gitignore
├── Makefile
├── docker-compose.yml
├── services/
│   ├── api-gateway/
│   ├── image-processor/
│   ├── ml-analysis/
│   ├── web-scraper/
│   └── frontend/
├── k8s/
│   ├── base/
│   └── overlays/
├── docs/
│   ├── ARCHITECTURE.md
│   └── DEPLOYMENT.md
└── scripts/
└── quick-start.sh

Make this impressive, educational, and genuinely useful for my resume. Focus on demonstrating real skills that employers want: performance optimization, system design, modern tech stack, and production-grade infrastructure.