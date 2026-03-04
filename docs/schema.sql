-- Fashion Trend Analysis Platform - Database Schema
-- PostgreSQL 16

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Images scraped from social media and fashion sources
CREATE TABLE IF NOT EXISTS images (
  id          SERIAL PRIMARY KEY,
  url         TEXT NOT NULL UNIQUE,
  source      VARCHAR(50),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata    JSONB,
  vector_id   TEXT,
  processed   BOOLEAN DEFAULT FALSE,
  cluster_id  INTEGER
);

-- Detected fashion trends
CREATE TABLE IF NOT EXISTS trends (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255),
  cluster_id        INTEGER UNIQUE,
  popularity_score  FLOAT DEFAULT 0.0,
  growth_rate       FLOAT DEFAULT 0.0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata          JSONB
);

-- Historical trend data for velocity calculations
CREATE TABLE IF NOT EXISTS trend_history (
  id                SERIAL PRIMARY KEY,
  trend_id          INTEGER REFERENCES trends(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  popularity_score  FLOAT,
  image_count       INTEGER DEFAULT 0,
  UNIQUE (trend_id, date)
);

-- Scraping job audit trail
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id           SERIAL PRIMARY KEY,
  source       VARCHAR(50) NOT NULL,
  status       VARCHAR(20) DEFAULT 'pending',
  started_at   TIMESTAMP,
  finished_at  TIMESTAMP,
  images_found INTEGER DEFAULT 0,
  error_msg    TEXT
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_source ON images(source);
CREATE INDEX IF NOT EXISTS idx_images_cluster_id ON images(cluster_id);
CREATE INDEX IF NOT EXISTS idx_images_processed ON images(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_images_vector_id ON images(vector_id);
CREATE INDEX IF NOT EXISTS idx_trends_cluster_id ON trends(cluster_id);
CREATE INDEX IF NOT EXISTS idx_trends_popularity ON trends(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_trends_growth_rate ON trends(growth_rate DESC);
CREATE INDEX IF NOT EXISTS idx_trend_history_trend_date ON trend_history(trend_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trend_history_date ON trend_history(date DESC);

-- Sample data for testing
INSERT INTO trends (name, cluster_id, popularity_score, growth_rate, metadata) VALUES
  ('Minimalist Streetwear', 1, 0.85, 12.5, '{"colors": ["white", "black", "grey"], "tags": ["minimal", "street", "casual"]}'),
  ('Cottagecore',           2, 0.72,  8.3, '{"colors": ["sage", "cream", "dusty_rose"], "tags": ["cottagecore", "floral", "vintage"]}'),
  ('Dark Academia',         3, 0.68,  5.1, '{"colors": ["navy", "brown", "burgundy"], "tags": ["academic", "tweed", "layered"]}'),
  ('Y2K Revival',           4, 0.91, 23.7, '{"colors": ["hot_pink", "silver", "baby_blue"], "tags": ["y2k", "retro", "2000s"]}'),
  ('Gorpcore',              5, 0.59, 15.2, '{"colors": ["olive", "orange", "grey"], "tags": ["outdoor", "functional", "techwear"]}')
ON CONFLICT DO NOTHING;

INSERT INTO trend_history (trend_id, date, popularity_score, image_count)
SELECT
  t.id,
  CURRENT_DATE - (n || ' days')::INTERVAL,
  GREATEST(0.1, t.popularity_score * (0.8 + random() * 0.4)),
  floor(random() * 100 + 10)::INTEGER
FROM trends t
CROSS JOIN generate_series(0, 29) AS n
ON CONFLICT DO NOTHING;
