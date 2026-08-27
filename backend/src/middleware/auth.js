import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';
import prisma from '../config/prisma.js';

/**
 * JWT Authentication Middleware
 * Verifies Bearer Token in Authorization header or HTTP-only cookie.
 */
export async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // 2. Fallback to HTTP-only cookie if present
      token = req.cookies.token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token missing. Please log in.');
    }

    const secret = process.env.JWT_SECRET || 'supersecretjwtkeyforresumematchai2026!';
    const decoded = jwt.verify(token, secret);

    // Attach user payload to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'USER'
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Invalid or expired authentication token.'));
    }
    next(err);
  }
}
