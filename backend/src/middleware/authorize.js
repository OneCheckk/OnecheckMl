const ApiError = require('../utils/ApiError');

const ROLE_EQUIVALENTS = {
  OFFICER: ['OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR'],
  SCRUTINY_OFFICER: ['OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR'],
  REGIONAL_DIRECTOR: ['REGIONAL_DIRECTOR'],
  INSTITUTION_USER: ['INSTITUTION_USER', 'INSTITUTION'],
  INSTITUTION: ['INSTITUTION', 'INSTITUTION_USER'],
  ADMIN: ['ADMIN'],
  AUDITOR: ['AUDITOR']
};

/**
 * Enforces role-based access control
 * @param {...string} allowedRoles - Roles permitted to access the route
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const userRole = req.user.role;
    const isAllowed = allowedRoles.some((role) => {
      if (role === userRole) return true;
      const equivalents = ROLE_EQUIVALENTS[role] || [role];
      return equivalents.includes(userRole);
    });

    if (!isAllowed) {
      return next(
        ApiError.forbidden(
          `Access forbidden: Role '${userRole}' is not authorized to perform this operation.`
        )
      );
    }

    next();
  };
}

module.exports = {
  authorize
};
