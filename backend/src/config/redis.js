import Redis from 'ioredis';

let redisClient = null;
let isRedisConnected = false;

export function initRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('⚠️ Redis connection retry limit reached. Continuing without cache layer.');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      // Log cleanly without repetitive spam
      if (err.code === 'ECONNREFUSED') {
        // Silent connection warning handled gracefully
      } else {
        console.warn('⚠️ Redis client warning:', err.message);
      }
    });

    redisClient.connect().catch((err) => {
      console.warn('⚠️ Redis not available at startup. Operating without cache layer.');
    });
  } catch (err) {
    console.warn('⚠️ Failed to initialize Redis client:', err.message);
  }

  return redisClient;
}

export function getRedis() {
  return isRedisConnected ? redisClient : null;
}

export function isRedisReady() {
  return isRedisConnected;
}

export default { initRedis, getRedis, isRedisReady };
