# Web Scraper Service (Python/Scrapy/Playwright)

Collects fashion images from public sources, stores to MinIO, and queues for processing.

## Architecture

```
Source Sites → Playwright/httpx → MinIO Storage → Redis Queue → Image Processor
```

## Ethical Scraping

- Respects `robots.txt` via Scrapy middleware
- Rate-limited: 1 req/second per domain
- Identifies bot via User-Agent header
- Only scrapes publicly accessible content

## Components

- **FashionScraper**: Crawls sources, downloads images
- **ImageStorage**: Stores images in MinIO with URL-hash deduplication
- **ImageJobQueue**: Redis-backed queue for async processing
- **ProcessingWorker**: Consumes queue, submits to C++ image processor

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| REDIS_URL | redis://localhost:6379 | Job queue |
| RABBITMQ_URL | - | Alternative queue (AMQP) |
| MINIO_URL | http://localhost:9000 | Object storage |
| MINIO_ACCESS_KEY | minioadmin | MinIO credentials |
| MINIO_SECRET_KEY | minioadmin123 | MinIO credentials |
| IMAGE_PROCESSOR_URL | http://localhost:8080 | C++ service URL |
| SCRAPE_INTERVAL | 3600 | Seconds between scrape runs |

## Development

```bash
pip install -r requirements.txt
playwright install chromium
python main.py
```
