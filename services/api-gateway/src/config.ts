import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://fashion_user:fashion_password@localhost:5432/fashion_trends',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  imageProcessorUrl: process.env.IMAGE_PROCESSOR_URL || 'http://localhost:8080',
  mlAnalysisUrl: process.env.ML_ANALYSIS_URL || 'http://localhost:8000',
  cache: {
    trendsTtl: 300,    // 5 minutes
    imagesTtl: 3600,   // 1 hour
    analyticsTtl: 60,  // 1 minute
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
} as const;
