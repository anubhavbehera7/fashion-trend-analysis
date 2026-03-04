/**
 * Image endpoints — orchestrates between PostgreSQL, Redis, and C++ Image Processor.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../services/database';
import { cacheGet, cacheSet } from '../services/cache';
import { processImage, findSimilarImages } from '../services/imageProcessor';
import { validate, schemas } from '../middleware/validator';
import { config } from '../config';
import { logger } from '../logger';

export const imagesRouter = Router();

// POST /api/images/upload — Submit image for feature extraction
imagesRouter.post('/upload', validate(schemas.uploadImage), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, source, metadata } = req.body;

    // Idempotency: return existing record if already processed
    const existing = await query('SELECT id, vector_id FROM images WHERE url = $1', [url]);
    if (existing.rows.length > 0) {
      return res.status(200).json({ success: true, message: 'Already processed', data: existing.rows[0] });
    }

    const insertResult = await query(
      'INSERT INTO images (url, source, metadata, processed) VALUES ($1, $2, $3, false) RETURNING id',
      [url, source, metadata]
    );
    const imageId = insertResult.rows[0].id;

    // Fire-and-forget: delegate to C++ processor (in production, push to RabbitMQ queue)
    processImage(url, { imageId, source, ...metadata })
      .then(async ({ vectorId }) => {
        await query('UPDATE images SET vector_id = $1, processed = true WHERE id = $2', [vectorId, imageId]);
        logger.info('Image processing complete', { imageId, vectorId });
      })
      .catch((err) => logger.error('Image processing failed', { imageId, error: err.message }));

    res.status(202).json({ success: true, message: 'Processing started', data: { id: imageId, status: 'processing' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/images/:id/similar — Vector similarity search
imagesRouter.get('/:id/similar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imageId = parseInt(req.params.id);
    const limit = parseInt((req.query.limit as string) || '10');
    const imageResult = await query('SELECT * FROM images WHERE id = $1', [imageId]);

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    const image = imageResult.rows[0] as Record<string, unknown>;
    if (!image.vector_id) {
      return res.status(400).json({ success: false, error: 'Image not yet processed' });
    }

    const cacheKey = `similar:${imageId}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const similar = await findSimilarImages(image.vector_id as string, limit);
    const response = { success: true, data: similar };
    await cacheSet(cacheKey, response, config.cache.imagesTtl);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /api/images/:id
imagesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = `image:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const result = await query('SELECT * FROM images WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    const response = { success: true, data: result.rows[0] };
    await cacheSet(cacheKey, response, config.cache.imagesTtl);
    res.json(response);
  } catch (err) {
    next(err);
  }
});
