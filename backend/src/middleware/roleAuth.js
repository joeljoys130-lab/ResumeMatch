import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * Role-Based Access Control (RBAC) Middleware Factory
 * Demonstrates closure pattern in JavaScript: captures `requiredRole` in lexical scope.
 */
export function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('User authentication context missing.'));
    }

    if (req.user.role !== requiredRole && req.user.role !== 'ADMIN') {
      return next(new ForbiddenError(`Access denied. Requires '${requiredRole}' administrative role.`));
    }

    next();
  };
}
