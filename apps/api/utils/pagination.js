// Pagination helpers for TitleClash API

/**
 * Parse pagination parameters from query string.
 * @param {object} query - Express req.query object
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePagination(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isFinite(page) || page < 1) {
    page = 1;
  }

  if (!Number.isFinite(limit) || limit < 1) {
    limit = 20;
  }

  if (limit > 100) {
    limit = 100;
  }

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Format a paginated API response.
 * @param {Array} data - Array of result items
 * @param {number} total - Total count of matching records
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {{ data: Array, pagination: { page: number, limit: number, total: number } }}
 */
function formatPaginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      page,
      limit,
      total
    }
  };
}

module.exports = {
  parsePagination,
  formatPaginatedResponse
};
