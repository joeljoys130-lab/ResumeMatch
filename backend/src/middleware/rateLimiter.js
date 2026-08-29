import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response.js';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 'Too many requests. Please try again after 15 minutes.', 429, 'TOO_MANY_REQUESTS');
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 'Too many authentication attempts. Please wait 15 minutes before retrying.', 429, 'TOO_MANY_REQUESTS');
  }
});

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 'AI rate limit exceeded (20 requests per 15 minutes). Please try again shortly.', 429, 'TOO_MANY_REQUESTS');
  }
});
