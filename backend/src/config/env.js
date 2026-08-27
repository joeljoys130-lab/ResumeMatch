import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const requiredEnvVars = [
  'DATABASE_URL',
  'MONGODB_URI',
  'JWT_SECRET'
];

export function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ FATAL: Missing critical environment variables: ${missing.join(', ')}`);
    console.error('   Please configure backend/.env using backend/.env.example');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('dummy')) {
    console.warn('⚠️ WARNING: ANTHROPIC_API_KEY is not set or using dummy placeholder.');
    console.warn('   AI Features will use graceful fallback responses where applicable.');
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn('ℹ️ INFO: OPENAI_API_KEY is omitted. RAG will use functional fallback deterministic embeddings.');
  }

  return {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    databaseUrl: process.env.DATABASE_URL,
    mongodbUri: process.env.MONGODB_URI,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    openaiApiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
  };
}

export default validateEnv();
