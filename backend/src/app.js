import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import authRoutes from './routes/auth.js';
import analysisRoutes from './routes/analysis.js';
import applicationRoutes from './routes/applications.js';
import interviewRoutes from './routes/interviews.js';
import knowledgeRoutes from './routes/knowledge.js';
import adminRoutes from './routes/admin.js';

import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/errors.js';
import { isRedisReady } from './config/redis.js';
import mongoose from 'mongoose';
import prisma from './config/prisma.js';

const app = express();

// Security Headers & CORS
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsing & General Rate Limiter
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', generalLimiter);

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
  let postgresConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    postgresConnected = true;
  } catch (err) {
    postgresConnected = false;
  }

  const mongoState = mongoose.connection.readyState;
  const mongoConnected = mongoState === 1;
  const redisConnected = isRedisReady();

  return res.status(200).json({
    status: 'ok',
    service: 'ResumeMatch AI Backend',
    timestamp: new Date().toISOString(),
    databases: {
      postgresql: postgresConnected ? 'connected' : 'disconnected',
      mongodb: mongoConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected (cache bypassed)'
    }
  });
});

// Mount Feature API Routes
app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/admin', adminRoutes);

// Unhandled Route 404
app.use('*', (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found.`));
});

// Centralized Error Middleware
app.use(errorHandler);

export default app;
