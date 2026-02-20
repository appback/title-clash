// Request body validation middleware factory for TitleClash API

const { ValidationError } = require('../utils/errors');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse a single rule string like "required", "max:300", "in:a|b|c"
 * @param {string} ruleStr
 * @returns {{ name: string, param: string|null }}
 */
function parseRule(ruleStr) {
  const colonIdx = ruleStr.indexOf(':');
  if (colonIdx === -1) {
    return { name: ruleStr, param: null };
  }
  return {
    name: ruleStr.substring(0, colonIdx),
    param: ruleStr.substring(colonIdx + 1)
  };
}

/**
 * Validate a single field value against a list of rules.
 * @param {string} field - Field name
 * @param {*} value - Field value from request body
 * @param {string[]} rules - Array of rule strings
 * @returns {string|null} Error message or null if valid
 */
function validateField(field, value, rules) {
  const isRequired = rules.some(r => parseRule(r).name === 'required');

  // Check required
  if (isRequired && (value === undefined || value === null || value === '')) {
    return `${field} is required`;
  }

  // If not required and not present, skip further validation
  if (value === undefined || value === null || value === '') {
    return null;
  }

  for (const ruleStr of rules) {
    const { name, param } = parseRule(ruleStr);

    switch (name) {
      case 'required':
        // Already handled above
        break;

      case 'string':
        if (typeof value !== 'string') {
          return `${field} must be a string`;
        }
        break;

      case 'uuid':
        if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
          return `${field} must be a valid UUID`;
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) {
          return `${field} must be a valid email address`;
        }
        break;

      case 'max': {
        const max = parseInt(param, 10);
        if (typeof value === 'string' && value.length > max) {
          return `${field} must be at most ${max} characters`;
        }
        if (typeof value === 'number' && value > max) {
          return `${field} must be at most ${max}`;
        }
        break;
      }

      case 'min': {
        const min = parseInt(param, 10);
        if (typeof value === 'string' && value.length < min) {
          return `${field} must be at least ${min} characters`;
        }
        if (typeof value === 'number' && value < min) {
          return `${field} must be at least ${min}`;
        }
        break;
      }

      case 'in': {
        const allowed = param.split('|');
        if (!allowed.includes(String(value))) {
          return `${field} must be one of: ${allowed.join(', ')}`;
        }
        break;
      }

      default:
        // Unknown rule - ignore
        break;
    }
  }

  return null;
}

/**
 * Create a validation middleware from a rules object.
 *
 * Usage:
 *   validate({
 *     title: 'required|string|max:300',
 *     problem_id: 'required|uuid',
 *     email: 'required|email',
 *     role: 'in:voter|agent_owner'
 *   })
 *
 * @param {object} rules - Object mapping field names to pipe-separated rule strings
 * @returns {Function} Express middleware
 */
function validate(rules) {
  return function validationMiddleware(req, res, next) {
    const errors = {};
    const body = req.body || {};

    for (const [field, ruleString] of Object.entries(rules)) {
      const fieldRules = ruleString.split('|');
      const error = validateField(field, body[field], fieldRules);
      if (error) {
        errors[field] = error;
      }
    }

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      return next(new ValidationError(firstError, errors));
    }

    next();
  };
}

module.exports = validate;
