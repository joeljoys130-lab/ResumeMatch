import app from './app.js';
import { validateEnv } from './config/env.js';
import { connectPrisma } from './config/prisma.js';
import { connectMongo } from './config/mongo.js';
import { initRedis } from './config/redis.js';
import { initScheduledJobs } from './jobs/cronJobs.js';

async function bootstrap() {
  console.log('🚀 Starting ResumeMatch AI Backend Server...');

  // 1. Validate Environment
  const config = validateEnv();

  // 2. Initialize Infrastructure Connections
  await connectPrisma();
  await connectMongo();
  initRedis();

  // 3. Start Scheduled Background Cron Jobs
  initScheduledJobs();

  // 4. Listen on PORT
  const server = app.listen(config.port, () => {
    console.log(`✨ Server running in [${config.nodeEnv}] mode on http://localhost:${config.port}`);
    console.log(`🔗 CORS origin configured for: ${config.frontendUrl}`);
  });

  // Graceful Shutdown Handling
  const shutdown = async () => {
    console.log('\n🛑 Shutdown signal received. Closing HTTP server and database connections...');
    server.close(() => {
      console.log('   ✓ HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('❌ Server startup error:', err);
  process.exit(1);
});
