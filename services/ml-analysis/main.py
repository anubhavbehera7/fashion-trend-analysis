"""
ML Analysis Service — Fashion Trend Detection

FastAPI service that performs unsupervised clustering on fashion image feature vectors
to detect trends, then calculates trend velocity (growth rate over time).

Why DBSCAN for trend detection?
- Unlike K-means, DBSCAN doesn't require specifying the number of clusters upfront
- Fashion trends are unpredictable — we don't know how many will emerge
- DBSCAN handles outliers natively (marks them as noise, not forcing into clusters)
- DBSCAN can discover clusters of arbitrary shape (trends aren't always spherical in embedding space)

Algorithm flow:
1. Fetch recent image vectors from Qdrant
2. DBSCAN clusters similar images → trend clusters
3. Calculate trend velocity from historical PostgreSQL data
4. K-means used for well-separated known categories (as alternative)
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import redis
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import normalize
from qdrant_client import QdrantClient
from qdrant_client.models import Filter
import psycopg2
import psycopg2.extras
import json

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Fashion ML Analysis Service",
    description="Trend detection via DBSCAN clustering and velocity analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Configuration ────────────────────────────────────────────────────────────

DATABASE_URL  = os.getenv("DATABASE_URL",  "postgresql://fashion_user:fashion_password@localhost:5432/fashion_trends")
QDRANT_URL    = os.getenv("QDRANT_URL",    "http://localhost:6333")
REDIS_URL     = os.getenv("REDIS_URL",     "redis://localhost:6379")
COLLECTION    = "fashion_images"

# ─── Clients ──────────────────────────────────────────────────────────────────

def get_db():
    """Get PostgreSQL connection (connection-per-request pattern for simplicity)."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()

def get_qdrant():
    """Get Qdrant client (stateless, safe to create per-request)."""
    return QdrantClient(url=QDRANT_URL)

def get_redis():
    return redis.from_url(REDIS_URL, decode_responses=True)

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class TrendInfo(BaseModel):
    """Represents a detected fashion trend cluster."""
    cluster_id: int
    image_count: int
    popularity_score: float = Field(ge=0.0, le=1.0)
    growth_rate: float
    representative_color: Optional[list[float]] = None
    tags: list[str] = []

class ClusterRequest(BaseModel):
    """Request to cluster a set of vectors."""
    method: str = Field(default="dbscan", pattern="^(dbscan|kmeans)$")
    epsilon: float = Field(default=0.3, gt=0.0, le=1.0,
        description="DBSCAN: max cosine distance between points in same cluster")
    min_samples: int = Field(default=5, ge=2,
        description="DBSCAN: min points to form a dense region (trend)")
    n_clusters: Optional[int] = Field(default=None, ge=2, le=50,
        description="K-means only: number of clusters")
    max_vectors: int = Field(default=10000, ge=100, le=100000)

class ClusterResponse(BaseModel):
    clusters_found: int
    noise_points: int
    trends: list[TrendInfo]
    algorithm: str
    processing_time_ms: float

class VelocityResponse(BaseModel):
    trend_id: int
    trend_name: str
    current_score: float
    velocity_7d: float   # % change over 7 days
    velocity_30d: float  # % change over 30 days
    acceleration: float  # Change in velocity (is it speeding up or slowing down?)
    is_emerging: bool    # True if strong positive velocity

# ─── Core ML Functions ────────────────────────────────────────────────────────

def run_dbscan_clustering(
    vectors: np.ndarray,
    epsilon: float = 0.3,
    min_samples: int = 5
) -> np.ndarray:
    """
    DBSCAN clustering on normalized feature vectors using cosine distance.

    Cosine distance (1 - cosine_similarity) is better than Euclidean for
    high-dimensional normalized vectors — it measures angular similarity,
    which is what we want for feature embeddings.

    epsilon=0.3 means vectors within 30% cosine distance are in the same cluster.
    Tune this based on how granular you want trends to be:
    - Lower epsilon → more clusters (more specific trends)
    - Higher epsilon → fewer clusters (broader trend categories)

    Args:
        vectors: N×512 array of L2-normalized feature vectors
        epsilon: neighborhood radius in cosine distance space
        min_samples: minimum points to form a trend cluster

    Returns:
        Array of cluster labels (-1 = noise/outlier)
    """
    # Cosine distance = 1 - cosine_similarity
    # For L2-normalized vectors, cosine_similarity = dot product
    # DBSCAN with metric='cosine' computes this correctly
    db = DBSCAN(
        eps=epsilon,
        min_samples=min_samples,
        metric='cosine',
        algorithm='ball_tree',  # Efficient for cosine metric
        n_jobs=-1               # Use all CPU cores
    )
    return db.fit_predict(vectors)


def run_kmeans_clustering(
    vectors: np.ndarray,
    n_clusters: int
) -> np.ndarray:
    """
    K-means clustering for when the number of trend categories is known.

    Best used for: macro categories (streetwear, formal, casual) where the
    count is stable. Less useful for micro-trends where count varies.

    Uses k-means++ initialization (default) which is much better than random:
    - Random: may converge to poor local optima
    - k-means++: spreads initial centroids far apart → faster convergence, better results
    """
    km = KMeans(
        n_clusters=n_clusters,
        init='k-means++',
        n_init=10,      # Run 10 times with different seeds, pick best
        max_iter=300,
        random_state=42  # Reproducible results
    )
    return km.fit_predict(vectors)


def calculate_trend_velocity(history_scores: list[float]) -> dict:
    """
    Calculate trend velocity (growth rate) and acceleration.

    Velocity = rate of change in popularity score over time.
    High velocity = fast-growing trend (emerging).
    Negative velocity = declining trend.

    Acceleration = change in velocity (is growth speeding up or slowing down?)
    Positive acceleration + positive velocity = super-emerging trend.

    Args:
        history_scores: list of popularity scores from newest to oldest

    Returns:
        dict with velocity_7d, velocity_30d, acceleration, is_emerging
    """
    if len(history_scores) < 2:
        return {"velocity_7d": 0.0, "velocity_30d": 0.0, "acceleration": 0.0, "is_emerging": False}

    arr = np.array(history_scores, dtype=np.float64)

    # 7-day velocity: % change from 7 days ago to today
    v7 = 0.0
    if len(arr) >= 7 and arr[6] > 0:
        v7 = (arr[0] - arr[6]) / arr[6] * 100.0

    # 30-day velocity: % change from 30 days ago to today
    v30 = 0.0
    if len(arr) >= 30 and arr[29] > 0:
        v30 = (arr[0] - arr[29]) / arr[29] * 100.0

    # Acceleration: comparing recent velocity (0-7 days) vs older velocity (7-14 days)
    acceleration = 0.0
    if len(arr) >= 14 and arr[6] > 0 and arr[13] > 0:
        recent_v = (arr[0] - arr[6]) / arr[6] * 100.0
        older_v  = (arr[6] - arr[13]) / arr[13] * 100.0
        acceleration = recent_v - older_v

    is_emerging = v7 > 10.0  # Growing faster than 10% in the last week

    return {
        "velocity_7d": round(v7, 2),
        "velocity_30d": round(v30, 2),
        "acceleration": round(acceleration, 2),
        "is_emerging": is_emerging
    }


def generate_mock_vectors(n: int = 100, dim: int = 512) -> np.ndarray:
    """
    Generate mock feature vectors for testing when Qdrant is empty.
    Creates 5 distinct clusters (simulating 5 fashion trends).
    """
    np.random.seed(42)
    vectors = []
    n_per_cluster = n // 5

    # Create 5 cluster centers in the embedding space
    centers = np.random.randn(5, dim).astype(np.float32)
    centers = normalize(centers)  # Normalize to unit sphere

    for center in centers:
        # Add Gaussian noise around each center
        cluster_vecs = center + np.random.randn(n_per_cluster, dim).astype(np.float32) * 0.1
        cluster_vecs = normalize(cluster_vecs)
        vectors.append(cluster_vecs)

    return np.vstack(vectors)


# ─── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Kubernetes health check endpoint."""
    return {"status": "ok", "service": "ml-analysis", "timestamp": datetime.utcnow().isoformat()}


@app.get("/analyze/trends")
async def analyze_trends():
    """
    Analyze current trend velocity for all tracked trends.
    Called by the API Gateway for /api/analytics/velocity.
    """
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Get all trends
        cursor.execute("SELECT id, name, popularity_score, growth_rate FROM trends ORDER BY popularity_score DESC")
        trends = cursor.fetchall()

        results = []
        for trend in trends:
            # Get 30-day history for velocity calculation
            cursor.execute(
                """SELECT popularity_score FROM trend_history
                   WHERE trend_id = %s ORDER BY date DESC LIMIT 30""",
                (trend['id'],)
            )
            history = [row['popularity_score'] for row in cursor.fetchall()]

            velocity_data = calculate_trend_velocity(history)

            results.append({
                "trend_id": trend['id'],
                "trend_name": trend['name'],
                "current_score": round(float(trend['popularity_score']), 3),
                **velocity_data
            })

        cursor.close()
        conn.close()

        return {
            "trends": results,
            "analyzed_at": datetime.utcnow().isoformat(),
            "total": len(results)
        }

    except Exception as e:
        logger.error(f"Error analyzing trends: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cluster", response_model=ClusterResponse)
async def cluster_images(request: ClusterRequest, background_tasks: BackgroundTasks):
    """
    Run clustering on recent image vectors to detect fashion trends.

    POST /cluster
    {
        "method": "dbscan",
        "epsilon": 0.3,
        "min_samples": 5
    }
    """
    import time
    start_time = time.time()

    try:
        # Try to fetch real vectors from Qdrant
        qdrant = get_qdrant()
        vectors = None

        try:
            # Scroll through Qdrant collection to get vectors
            scroll_result = qdrant.scroll(
                collection_name=COLLECTION,
                limit=request.max_vectors,
                with_vectors=True,
                with_payload=False
            )
            points, _ = scroll_result

            if points:
                vectors = np.array([p.vector for p in points], dtype=np.float32)
                vectors = normalize(vectors)  # Ensure L2-normalized
                logger.info(f"Loaded {len(vectors)} vectors from Qdrant")
        except Exception as e:
            logger.warning(f"Qdrant unavailable, using mock data: {e}")

        # Fall back to mock data if Qdrant is empty or unavailable
        if vectors is None or len(vectors) == 0:
            logger.info("Using mock vectors for clustering demo")
            vectors = generate_mock_vectors(500)

        # Run the selected clustering algorithm
        if request.method == "dbscan":
            labels = run_dbscan_clustering(vectors, request.epsilon, request.min_samples)
        else:
            n_clusters = request.n_clusters or max(2, len(vectors) // 100)
            labels = run_kmeans_clustering(vectors, n_clusters)

        # Analyze results
        unique_labels = set(labels)
        noise_count = np.sum(labels == -1)
        cluster_ids = [l for l in unique_labels if l != -1]

        trends = []
        for cluster_id in cluster_ids:
            cluster_mask = labels == cluster_id
            cluster_size = int(np.sum(cluster_mask))

            # Popularity score = cluster size relative to total (normalized 0-1)
            popularity = cluster_size / len(vectors)

            trends.append(TrendInfo(
                cluster_id=int(cluster_id),
                image_count=cluster_size,
                popularity_score=round(popularity, 4),
                growth_rate=0.0,  # Calculated separately by velocity endpoint
                tags=[f"cluster_{cluster_id}"]
            ))

        # Sort by popularity
        trends.sort(key=lambda t: t.popularity_score, reverse=True)

        # Persist cluster assignments to PostgreSQL in background
        background_tasks.add_task(
            persist_clusters,
            labels.tolist(),
            cluster_ids
        )

        elapsed_ms = (time.time() - start_time) * 1000

        return ClusterResponse(
            clusters_found=len(cluster_ids),
            noise_points=int(noise_count),
            trends=trends,
            algorithm=request.method,
            processing_time_ms=round(elapsed_ms, 2)
        )

    except Exception as e:
        logger.error(f"Clustering error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def persist_clusters(labels: list[int], cluster_ids: list[int]):
    """Background task: save cluster results to PostgreSQL."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()

        for cluster_id in cluster_ids:
            # Upsert trend record
            cursor.execute(
                """INSERT INTO trends (cluster_id, name, popularity_score)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (cluster_id) DO UPDATE
                   SET popularity_score = EXCLUDED.popularity_score, updated_at = NOW()""",
                (cluster_id, f"Trend #{cluster_id}", labels.count(cluster_id) / len(labels))
            )

        conn.commit()
        cursor.close()
        conn.close()
        logger.info(f"Persisted {len(cluster_ids)} clusters to PostgreSQL")
    except Exception as e:
        logger.error(f"Failed to persist clusters: {e}")


@app.get("/trends/{trend_id}/velocity", response_model=VelocityResponse)
async def get_trend_velocity(trend_id: int):
    """
    Calculate velocity (growth rate) for a specific trend.
    Velocity is the rate of change of popularity_score over time.
    """
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("SELECT * FROM trends WHERE id = %s", (trend_id,))
        trend = cursor.fetchone()
        if not trend:
            raise HTTPException(status_code=404, detail=f"Trend {trend_id} not found")

        cursor.execute(
            """SELECT popularity_score FROM trend_history
               WHERE trend_id = %s ORDER BY date DESC LIMIT 30""",
            (trend_id,)
        )
        history = [row['popularity_score'] for row in cursor.fetchall()]
        velocity_data = calculate_trend_velocity(history)

        cursor.close()
        conn.close()

        return VelocityResponse(
            trend_id=trend_id,
            trend_name=trend['name'] or f"Trend #{trend_id}",
            current_score=float(trend['popularity_score']),
            **velocity_data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Velocity calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
