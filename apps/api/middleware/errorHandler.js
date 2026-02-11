// Express error handling middleware for TitleClash API

const { AppError } = require('../utils/errors');

/**
 * Global error handler middleware.
 * Must be registered after all routes: app.use(errorHandler)
 */
function errorHandler(err, req, res, next) {
  // Log the error
  if (err instanceof AppError) {
    console.error(`[${err.errorCode}] ${err.message}`);
  } else {
    console.error('[INTERNAL_ERROR]', err.stack || err);
  }

  // If response headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // AppError instances carry their own status code and error code
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Unknown errors -> 500 Internal Server Error
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Internal server error'
  });
}

module.exports = errorHandler;
