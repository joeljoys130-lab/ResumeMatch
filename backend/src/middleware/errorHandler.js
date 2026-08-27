import { sendError } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

/**
 * Centralized Express Error Handling Middleware
 */
export function errorHandler(err, req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Operational AppErrors
  if (err instanceof AppError) {
    if (!isProd && err.statusCode >= 500) {
      console.error(`💥 [${err.code}] ${err.message}`, err.stack);
    }
    return sendError(res, err.message, err.statusCode, err.code, err.details);
  }

  // 2. Syntax/JSON Parse Errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 'Malformed JSON payload in request body.', 400, 'BAD_REQUEST');
  }

  // 3. Unhandled Server Errors
  console.error('💥 Unhandled Internal Error:', err);
  const message = isProd ? 'An unexpected internal server error occurred.' : err.message;
  return sendError(res, message, 500, 'INTERNAL_SERVER_ERROR');
}

/**
 * Higher-order async wrapper to catch rejected promises in route handlers
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
