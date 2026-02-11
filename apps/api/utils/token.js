// Token generation and verification utilities for TitleClash API

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const AGENT_TOKEN_PREFIX = 'tc_agent_';

/**
 * Generate a new agent API token.
 * Format: "tc_agent_" + 64-character hex string (32 random bytes)
 * @returns {string} The plain-text agent token
 */
function generateAgentToken() {
  return AGENT_TOKEN_PREFIX + crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a JWT for a user.
 * @param {object} payload - Data to encode (e.g. { userId, role })
 * @returns {string} Signed JWT
 */
function generateJWT(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify and decode a JWT.
 * @param {string} token - The JWT to verify
 * @returns {object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
function verifyJWT(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.verify(token, secret);
}

/**
 * Hash a token using SHA-256 for secure database storage.
 * @param {string} token - The plain-text token
 * @returns {string} SHA-256 hex digest
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Compare a plain-text token against its stored SHA-256 hash.
 * @param {string} plain - The plain-text token to check
 * @param {string} hash - The stored SHA-256 hash
 * @returns {boolean} True if match
 */
function compareToken(plain, hash) {
  const plainHash = hashToken(plain);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(plainHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch (e) {
    return false;
  }
}

module.exports = {
  AGENT_TOKEN_PREFIX,
  generateAgentToken,
  generateJWT,
  verifyJWT,
  hashToken,
  compareToken
};
