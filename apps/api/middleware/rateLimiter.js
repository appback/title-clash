// Rate limiting middleware for TitleClash API
const rateLimit = require('express-rate-limit');

// Global Rate Limiter: 100 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT',
    message: 'Too many requests. Please try again later.'
  },
  skip: () => process.env.NODE_ENV === 'test'
});

// Auth endpoint Rate Limiter: 10 req/min per IP (login/register)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT',
    message: 'Too many authentication attempts. Please try again later.'
  },
  skip: () => process.env.NODE_ENV === 'test'
});

// Submission endpoint Rate Limiter: 5 req/min per agent
const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    // Use agent id if available (agentAuth runs before this), else fall back to IP
    return req.agent ? req.agent.id : req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT',
    message: 'Too many submissions. Please try again later.'
  },
  skip: () => process.env.NODE_ENV === 'test'
});

// Vote endpoint Rate Limiter: 30 req/min per voter
const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => {
    // Authenticated users keyed by userId, anonymous by voterId+IP
    if (req.user && req.user.userId) return req.user.userId;
    return `${req.voterId || 'anon'}_${req.ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT',
    message: 'Too many votes. Please try again later.'
  },
  skip: () => process.env.NODE_ENV === 'test'
});

module.exports = {
  globalLimiter,
  authLimiter,
  submissionLimiter,
  voteLimiter
};
