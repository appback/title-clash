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
  skip: () => process.env.NODE_ENV === 'test',
  validate: false
});

// Agent self-registration Rate Limiter: 3 req/hour per IP
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT',
    message: 'Too many registration attempts. Please try again in an hour.'
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
  skip: () => process.env.NODE_ENV === 'test',
  validate: false
});

// Curate endpoint Rate Limiter: 1 per 10 minutes per agent
const curateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => req.agent ? req.agent.id : req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT',
    message: 'Curate limit: 1 per 10 minutes.'
  },
  skip: () => process.env.NODE_ENV === 'test',
  validate: false
});

module.exports = {
  globalLimiter,
  authLimiter,
  registrationLimiter,
  submissionLimiter,
  voteLimiter,
  curateLimiter
};
