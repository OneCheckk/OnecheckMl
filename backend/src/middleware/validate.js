const { z, ZodSchema } = require('zod');
const ApiError = require('../utils/ApiError');

/**
 * Higher-order middleware to run a Zod schema or validator function on req
 * @param {ZodSchema|Function} schemaOrValidator - Zod schema or function returning error array
 */
function validate(schemaOrValidator) {
  return (req, res, next) => {
    try {
      if (schemaOrValidator && typeof schemaOrValidator.safeParse === 'function') {
        const result = schemaOrValidator.safeParse(req.body);
        if (!result.success) {
          const errors = result.error.issues.map((issue) => ({
            field: issue.path.join('.') || 'body',
            message: issue.message
          }));
          return next(ApiError.badRequest('Validation failed for one or more fields.', errors));
        }
        req.validatedBody = result.data;
        return next();
      }

      if (typeof schemaOrValidator === 'function') {
        const errors = schemaOrValidator(req);
        if (errors && errors.length > 0) {
          return next(ApiError.badRequest('Validation failed for one or more fields.', errors));
        }
        return next();
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
