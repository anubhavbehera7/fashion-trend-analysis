/**
 * HTTP client for the C++ Image Processor service.
 * Handles feature extraction (SIFT+ORB+color→512D) and similarity search.
 */
import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../logger';

interface ProcessImageResponse {
  vectorId: string;
  features: number[];
  processingTimeMs: number;
}

interface SimilarImage {
  id: string;
  score: number;
  url: string;
  metadata: Record<string, unknown>;
}

interface SearchResponse {
  results: SimilarImage[];
  searchTimeMs: number;
}

const httpClient: AxiosInstance = axios.create({
  baseURL: config.imageProcessorUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export async function processImage(
  imageUrl: string,
  metadata: Record<string, unknown> = {}
): Promise<ProcessImageResponse> {
  logger.info('Submitting image for processing', { url: imageUrl });
  const response = await httpClient.post<ProcessImageResponse>('/process', { imageUrl, metadata });
  logger.info('Image processed', { vectorId: response.data.vectorId, ms: response.data.processingTimeMs });
  return response.data;
}

export async function findSimilarImages(vectorId: string, limit = 10): Promise<SearchResponse> {
  const response = await httpClient.post<SearchResponse>('/search', { vectorId, limit });
  return response.data;
}
