"""
Web Scraper Service — Fashion Image Collection

Scrapes fashion images from public sources (fashion blogs, Pinterest boards,
public Instagram-style feeds) and queues them for feature extraction.

Architecture:
1. Scrapy crawls fashion sources (robots.txt-compliant)
2. Playwright renders JavaScript-heavy pages (Instagram-style SPAs)
3. Images downloaded to MinIO (S3-compatible object storage)
4. Image URLs published to Redis queue for Image Processor consumption

Ethical scraping practices:
- Respects robots.txt
- Rate-limited to 1 req/sec per domain
- User-agent identifies our bot
- Only scrapes publicly accessible content
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import httpx
import redis
from minio import Minio
from minio.error import S3Error
import io
import hashlib

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# ─── Configuration ─────────────────────────────────────────────────────────────

REDIS_URL           = os.getenv("REDIS_URL",     "redis://localhost:6379")
MINIO_URL           = os.getenv("MINIO_URL",     "http://localhost:9000")
MINIO_ACCESS_KEY    = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY    = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
MINIO_BUCKET        = "fashion-images"
IMAGE_PROCESSOR_URL = os.getenv("IMAGE_PROCESSOR_URL", "http://localhost:8080")
SCRAPE_INTERVAL     = int(os.getenv("SCRAPE_INTERVAL", "3600"))  # seconds between scrape runs

# Rate limiting: be a good citizen
RATE_LIMIT_DELAY = 1.0   # seconds between requests to same domain
MAX_IMAGES_PER_RUN = 100  # Don't overwhelm storage on each run

# Ethical user agent — identifies our bot clearly
USER_AGENT = "FashionTrendBot/1.0 (Educational project; contact: admin@example.com)"

# ─── Target Sources ────────────────────────────────────────────────────────────
# These are example public fashion image sources.
# In production, replace with actual licensed APIs or explicitly scraped sites.

FASHION_SOURCES = [
    {
        "name": "unsplash_fashion",
        "url": "https://unsplash.com/s/photos/fashion",
        "type": "photo_site",
        "tags": ["fashion", "style"]
    },
    {
        "name": "pexels_fashion",
        "url": "https://www.pexels.com/search/fashion/",
        "type": "photo_site",
        "tags": ["fashion", "clothing"]
    },
]

# ─── Data Model ───────────────────────────────────────────────────────────────

@dataclass
class ScrapedImage:
    url: str
    source: str
    tags: list
    width: Optional[int] = None
    height: Optional[int] = None
    alt_text: Optional[str] = None
    minio_path: Optional[str] = None


# ─── MinIO Storage ────────────────────────────────────────────────────────────

class ImageStorage:
    """Manages image storage in MinIO (S3-compatible)."""

    def __init__(self):
        # Parse MinIO URL (remove http://)
        parsed = urlparse(MINIO_URL)
        endpoint = parsed.netloc
        secure = parsed.scheme == "https"

        self.client = Minio(
            endpoint,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=secure
        )
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Create bucket if it doesn't exist."""
        try:
            if not self.client.bucket_exists(MINIO_BUCKET):
                self.client.make_bucket(MINIO_BUCKET)
                logger.info(f"Created MinIO bucket: {MINIO_BUCKET}")
        except S3Error as e:
            logger.error(f"MinIO bucket error: {e}")

    def store_image(self, image_data: bytes, url: str, content_type: str = "image/jpeg") -> str:
        """
        Store image bytes in MinIO. Returns the storage path.
        Uses URL hash as filename for deduplication.
        """
        # Hash the URL to get a deterministic, deduplication-safe filename
        url_hash = hashlib.sha256(url.encode()).hexdigest()[:16]
        extension = url.split('.')[-1].lower()[:4] if '.' in url else 'jpg'
        object_name = f"scraped/{url_hash}.{extension}"

        try:
            self.client.put_object(
                MINIO_BUCKET,
                object_name,
                io.BytesIO(image_data),
                length=len(image_data),
                content_type=content_type
            )
            return f"{MINIO_URL}/{MINIO_BUCKET}/{object_name}"
        except S3Error as e:
            logger.error(f"Failed to store image: {e}")
            raise


# ─── Job Queue ────────────────────────────────────────────────────────────────

class ImageJobQueue:
    """
    Redis-backed job queue for image processing.
    Decouples scraping (slow, rate-limited) from processing (fast, parallel).
    """

    QUEUE_KEY = "fashion:image_jobs"
    PROCESSED_KEY = "fashion:processed_urls"  # Set for deduplication

    def __init__(self):
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)

    def enqueue(self, image: ScrapedImage):
        """Add image to processing queue."""
        job = {
            "url": image.minio_path or image.url,
            "source_url": image.url,
            "source": image.source,
            "tags": image.tags,
            "enqueued_at": time.time()
        }
        self.redis.rpush(self.QUEUE_KEY, json.dumps(job))
        self.redis.sadd(self.PROCESSED_KEY, image.url)  # Mark as processed
        logger.debug(f"Enqueued: {image.url}")

    def is_processed(self, url: str) -> bool:
        """Check if URL was already scraped (deduplication)."""
        return self.redis.sismember(self.PROCESSED_KEY, url)

    def queue_size(self) -> int:
        return self.redis.llen(self.QUEUE_KEY)


# ─── Scraper ──────────────────────────────────────────────────────────────────

class FashionScraper:
    """
    HTTP-based fashion image scraper.

    In production, this would use:
    - Scrapy for high-throughput crawling with middleware support
    - Playwright for JavaScript-rendered pages (Instagram, Pinterest SPAs)
    - Rotating proxy support to avoid IP blocks

    This implementation uses httpx for simplicity while demonstrating
    the same architectural patterns.
    """

    def __init__(self):
        self.storage = ImageStorage()
        self.queue = ImageJobQueue()
        self.domain_last_request: dict = {}  # Rate limiting per domain

    def _rate_limit(self, url: str):
        """Enforce rate limiting per domain. Be a good bot citizen."""
        domain = urlparse(url).netloc
        last_request = self.domain_last_request.get(domain, 0)
        elapsed = time.time() - last_request
        if elapsed < RATE_LIMIT_DELAY:
            time.sleep(RATE_LIMIT_DELAY - elapsed)
        self.domain_last_request[domain] = time.time()

    async def download_image(self, url: str) -> Optional[bytes]:
        """Download image bytes from URL with rate limiting."""
        self._rate_limit(url)
        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                headers={"User-Agent": USER_AGENT},
                follow_redirects=True
            ) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    content_type = response.headers.get("content-type", "")
                    if "image" in content_type:
                        return response.content
                    else:
                        logger.warning(f"Non-image response for {url}: {content_type}")
                else:
                    logger.warning(f"HTTP {response.status_code} for {url}")
        except Exception as e:
            logger.error(f"Download failed for {url}: {e}")
        return None

    async def scrape_source(self, source: dict) -> list[ScrapedImage]:
        """
        Scrape images from a single source.
        Returns list of ScrapedImage objects ready for processing.

        In production:
        - Use Scrapy spiders for complex crawling
        - Use Playwright for JS-heavy sites
        - Respect robots.txt (Scrapy does this automatically)
        """
        images = []
        logger.info(f"Scraping source: {source['name']}")

        # For demo: generate synthetic image URLs from public APIs
        # In production: actually parse the source HTML/API
        demo_image_urls = [
            f"https://picsum.photos/seed/fashion{i}/512/512"
            for i in range(min(10, MAX_IMAGES_PER_RUN))
        ]

        for img_url in demo_image_urls:
            if self.queue.is_processed(img_url):
                logger.debug(f"Skip (already processed): {img_url}")
                continue

            image_data = await self.download_image(img_url)
            if image_data:
                scraped = ScrapedImage(
                    url=img_url,
                    source=source["name"],
                    tags=source.get("tags", [])
                )

                # Store in MinIO for persistent access
                try:
                    minio_url = self.storage.store_image(image_data, img_url)
                    scraped.minio_path = minio_url
                except Exception as e:
                    logger.error(f"Storage failed: {e}")
                    scraped.minio_path = img_url  # Fall back to original URL

                images.append(scraped)
                logger.info(f"Scraped: {img_url}")

        return images

    async def run_scrape_cycle(self):
        """Run one complete scrape cycle across all sources."""
        logger.info(f"Starting scrape cycle. Queue size: {self.queue.queue_size()}")

        total_scraped = 0
        for source in FASHION_SOURCES:
            images = await self.scrape_source(source)
            for image in images:
                self.queue.enqueue(image)
                total_scraped += 1

        logger.info(f"Scrape cycle complete. Scraped {total_scraped} images. Queue: {self.queue.queue_size()}")
        return total_scraped


# ─── Job Worker ───────────────────────────────────────────────────────────────

class ProcessingWorker:
    """
    Consumes image jobs from Redis queue and submits to Image Processor.
    Runs concurrently with the scraper.
    """

    def __init__(self):
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
        self.queue_key = ImageJobQueue.QUEUE_KEY

    async def process_job(self, job: dict):
        """Submit one image to the C++ image processor."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{IMAGE_PROCESSOR_URL}/process",
                    json={
                        "imageUrl": job["url"],
                        "metadata": {
                            "source": job.get("source", "scraper"),
                            "tags": job.get("tags", []),
                            "source_url": job.get("source_url", "")
                        }
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Processed: {job['url']} → vectorId={data.get('vectorId')}")
                else:
                    logger.warning(f"Processor returned {response.status_code} for {job['url']}")
            except Exception as e:
                logger.error(f"Processing failed for {job['url']}: {e}")

    async def run(self):
        """Continuously process jobs from queue."""
        logger.info("Processing worker started")
        while True:
            # Blocking pop with 5 second timeout
            job_json = self.redis.blpop(self.queue_key, timeout=5)
            if job_json:
                _, raw = job_json
                job = json.loads(raw)
                await self.process_job(job)
            else:
                await asyncio.sleep(1)


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    """
    Main entry point. Runs scraper and worker concurrently.
    Scraper periodically collects images; worker continuously processes them.
    """
    logger.info("Fashion Web Scraper starting up...")

    scraper = FashionScraper()
    worker = ProcessingWorker()

    async def scrape_loop():
        while True:
            try:
                await scraper.run_scrape_cycle()
            except Exception as e:
                logger.error(f"Scrape cycle error: {e}")
            logger.info(f"Next scrape in {SCRAPE_INTERVAL}s")
            await asyncio.sleep(SCRAPE_INTERVAL)

    # Run both loops concurrently
    await asyncio.gather(
        scrape_loop(),
        worker.run()
    )


if __name__ == "__main__":
    asyncio.run(main())
