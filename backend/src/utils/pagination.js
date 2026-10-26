/**
 * Parses and sanitizes pagination query parameters
 * @param {Object} query - Express req.query
 * @param {Array<string>} allowedSortFields - Allowlist of fields that can be sorted
 * @param {string} defaultSortField - Default field to sort by
 */
function parsePagination(query, allowedSortFields = ['createdAt'], defaultSortField = 'createdAt') {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;

  let sortBy = defaultSortField;
  if (query.sortBy && allowedSortFields.includes(query.sortBy)) {
    sortBy = query.sortBy;
  }

  const sortOrder = query.sortOrder && query.sortOrder.toLowerCase() === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  return {
    page,
    limit,
    skip,
    sort,
    sortBy,
    sortOrder: sortOrder === 1 ? 'asc' : 'desc'
  };
}

/**
 * Builds standard pagination metadata object
 */
function buildPaginationMeta(page, limit, totalItems) {
  const totalPages = Math.ceil(totalItems / limit) || 1;
  return {
    page,
    limit,
    totalItems,
    totalPages
  };
}

module.exports = {
  parsePagination,
  buildPaginationMeta
};
