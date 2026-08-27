import { getRedis, isRedisReady } from '../config/redis.js';
import { generateAnalysisCacheKey } from '../utils/hashes.js';

const DEFAULT_TTL_SECONDS = 86400; // 24 hours

export async function getCachedAnalysis(resumeText, jobDescriptionText) {
  if (!isRedisReady()) return null;

  try {
    const redis = getRedis();
    if (!redis) return null;

    const cacheKey = generateAnalysisCacheKey(resumeText, jobDescriptionText);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      console.log('⚡ Redis Cache Hit for resume analysis key:', cacheKey.slice(0, 20) + '...');
      return JSON.parse(cachedData);
    }
  } catch (err) {
    console.warn('⚠️ Redis getCachedAnalysis warning:', err.message);
  }

  return null;
}

export async function setCachedAnalysis(resumeText, jobDescriptionText, resultData, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!isRedisReady()) return false;

  try {
    const redis = getRedis();
    if (!redis) return false;

    const cacheKey = generateAnalysisCacheKey(resumeText, jobDescriptionText);
    await redis.set(cacheKey, JSON.stringify(resultData), 'EX', ttlSeconds);
    console.log('💾 Result cached in Redis with TTL:', ttlSeconds, 'seconds');
    return true;
  } catch (err) {
    console.warn('⚠️ Redis setCachedAnalysis warning:', err.message);
    return false;
  }
}
