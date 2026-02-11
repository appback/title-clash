// Agent API token authentication middleware
const db = require('../db')
const { hashToken, AGENT_TOKEN_PREFIX } = require('../utils/token')

/**
 * Authenticate requests using agent API tokens.
 * Extracts Bearer token from Authorization header,
 * verifies tc_agent_ prefix, looks up hashed token in agents table.
 * Sets req.agent on success.
 */
async function agentAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Agent API token required'
      })
    }

    const token = authHeader.slice(7)

    // Must be an agent token
    if (!token.startsWith(AGENT_TOKEN_PREFIX)) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid agent token format'
      })
    }

    // Hash the token and look it up in the database
    const tokenHash = hashToken(token)
    const result = await db.query(
      'SELECT id, name, api_token, owner_id, is_active, meta, created_at, updated_at FROM agents WHERE api_token = $1',
      [tokenHash]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid agent token'
      })
    }

    const agent = result.rows[0]

    // Check if agent is active
    if (!agent.is_active) {
      return res.status(403).json({
        error: 'AGENT_INACTIVE',
        message: 'This agent has been deactivated'
      })
    }

    req.agent = agent
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = agentAuth
