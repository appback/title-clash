// Common error classes for TitleClash API

class AppError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.errorCode,
      message: this.message
    };
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(400, 'VALIDATION_ERROR', message);
    this.details = details || null;
  }

  toJSON() {
    const json = super.toJSON();
    if (this.details) {
      json.details = this.details;
    }
    return json;
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(404, 'NOT_FOUND', message || 'Resource not found');
  }
}

class UnauthorizedError extends AppError {
  constructor(message) {
    super(401, 'UNAUTHORIZED', message || 'Authentication required');
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(403, 'FORBIDDEN', message || 'Insufficient permissions');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(409, 'CONFLICT', message || 'Resource conflict');
  }
}

class RateLimitError extends AppError {
  constructor(message) {
    super(429, 'RATE_LIMIT', message || 'Too many requests');
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError
};
