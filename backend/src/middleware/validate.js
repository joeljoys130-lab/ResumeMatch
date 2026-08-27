import { ValidationError } from '../utils/errors.js';

/**
 * Generic Zod Request Validation Middleware Factory
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const parsed = schema.parse(dataToValidate);
      req[source] = parsed; // Replace with clean, validated object
      next();
    } catch (err) {
      if (err.errors) {
        const details = err.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        return next(new ValidationError('Request validation failed', details));
      }
      next(err);
    }
  };
}
