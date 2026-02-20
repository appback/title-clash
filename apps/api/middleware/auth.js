// Auth middleware: cookie-based voterId + JWT parsing
const { v4: uuidv4 } = require('uuid')
const { verifyJWT, AGENT_TOKEN_PREFIX } = require('../utils/token')

/**
 * Original cookie-based auth middleware.
 * Assigns anonymous voterId via cookie.
 * Also attempts JWT parsing from Authorization header if present.
 */
function auth(req, res, next) {
  try {
    // Attempt JWT parsing from Authorization header (non-agent tokens only)
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      // Only decode if it's NOT an agent token
      if (!token.startsWith(AGENT_TOKEN_PREFIX)) {
        try {
          const decoded = verifyJWT(token)
          req.user = { userId: decoded.userId, role: decoded.role }
        } catch (e) {
          // JWT invalid - continue without user
        }
      }
    }

    // Cookie-based voterId logic (always runs)
    const cookie = req.cookies && req.cookies['voterId']
    if (cookie) {
      req.voterId = cookie
      return next()
    }
    const id = uuidv4()
    res.cookie('voterId', id, { httpOnly: true, sameSite: 'lax' })
    req.voterId = id
    next()
  } catch (e) {
    next()
  }
}

/**
 * JWT required middleware.
 * Returns 401 if no valid JWT is present.
 */
function jwtAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' })
    }

    const token = authHeader.slice(7)

    // Reject agent tokens in JWT auth
    if (token.startsWith(AGENT_TOKEN_PREFIX)) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'JWT token required, agent token not accepted' })
    }

    const decoded = verifyJWT(token)
    req.user = { userId: decoded.userId, role: decoded.role }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' })
  }
}

/**
 * Optional JWT middleware.
 * Parses JWT if present but does not require it.
 * Also handles voterId cookie for anonymous users.
 */
function optionalJwtAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      if (!token.startsWith(AGENT_TOKEN_PREFIX)) {
        try {
          const decoded = verifyJWT(token)
          req.user = { userId: decoded.userId, role: decoded.role }
        } catch (e) {
          // JWT invalid - continue without user
        }
      }
    }

    // Cookie-based voterId logic for anonymous users
    // Skip if already set by the global auth middleware
    if (!req.voterId) {
      const cookie = req.cookies && req.cookies['voterId']
      if (cookie) {
        req.voterId = cookie
      } else {
        const id = uuidv4()
        res.cookie('voterId', id, { httpOnly: true, sameSite: 'lax' })
        req.voterId = id
      }
    }

    next()
  } catch (e) {
    next()
  }
}

module.exports = auth
module.exports.auth = auth
module.exports.jwtAuth = jwtAuth
module.exports.optionalJwtAuth = optionalJwtAuth
