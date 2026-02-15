// Agents controller: CRUD operations for AI agents
const db = require('../../db')
const { generateAgentToken, hashToken } = require('../../utils/token')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError, ForbiddenError, ConflictError } = require('../../utils/errors')

/**
 * Mask an agent token for display: show first 12 + last 4 chars.
 */
function maskToken(token) {
  if (!token || token.length <= 16) return token
  return token.slice(0, 12) + '...' + token.slice(-4)
}

/**
 * POST /api/v1/agents/register
 * Self-service agent registration. No auth required, rate-limited.
 */
async function selfRegister(req, res, next) {
  try {
    const { name, email, model_name, description } = req.body

    if (!name || String(name).trim() === '') {
      throw new ValidationError('name is required')
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('Invalid email format')
    }

    // Generate token
    const rawToken = generateAgentToken()
    const tokenHash = hashToken(rawToken)

    // Insert agent (owner_id = NULL for self-registered)
    const result = await db.query(
      `INSERT INTO agents (name, api_token, owner_id, is_active, meta, email, description)
       VALUES ($1, $2, NULL, true, $3, $4, $5)
       RETURNING id, name, email, description, created_at`,
      [
        name.trim(),
        tokenHash,
        model_name ? JSON.stringify({ model_name }) : '{}',
        email || null,
        description || null
      ]
    )

    const agent = result.rows[0]

    res.status(201).json({
      agent_id: agent.id,
      api_token: rawToken,
      name: agent.name,
      created_at: agent.created_at
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/agents
 * Create a new agent. Requires JWT auth (admin or agent_owner).
 */
async function create(req, res, next) {
  try {
    const { name, meta } = req.body

    if (!name || String(name).trim() === '') {
      throw new ValidationError('name is required')
    }

    // Only admin or agent_owner can create agents
    if (req.user.role !== 'admin' && req.user.role !== 'agent_owner') {
      throw new ForbiddenError('Agent registration requires admin or agent_owner role')
    }

    // Generate token
    const rawToken = generateAgentToken()
    const tokenHash = hashToken(rawToken)

    // Insert agent
    const result = await db.query(
      `INSERT INTO agents (name, api_token, owner_id, is_active, meta)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id, name, owner_id, is_active, meta, created_at, updated_at`,
      [name.trim(), tokenHash, req.user.userId, meta ? JSON.stringify(meta) : '{}']
    )

    const agent = result.rows[0]

    // Return the raw token only on creation
    res.status(201).json({
      id: agent.id,
      name: agent.name,
      api_token: rawToken,
      owner_id: agent.owner_id,
      is_active: agent.is_active,
      meta: agent.meta,
      created_at: agent.created_at
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/agents
 * List all agents. Admin only.
 */
async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const activeFilter = req.query.active

    let whereClause = ''
    const params = []

    if (activeFilter !== undefined) {
      whereClause = 'WHERE is_active = $1'
      params.push(activeFilter === 'true')
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM agents ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total, 10)

    // Get paginated data
    const dataParams = [...params, limit, offset]
    const result = await db.query(
      `SELECT id, name, api_token, owner_id, is_active, meta, created_at, updated_at
       FROM agents ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    )

    // Mask tokens in list response
    const data = result.rows.map(row => ({
      ...row,
      api_token: maskToken(row.api_token)
    }))

    res.json(formatPaginatedResponse(data, total, page, limit))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/agents/:id
 * Get agent by ID. Admin or owner.
 */
async function get(req, res, next) {
  try {
    const { id } = req.params

    const result = await db.query(
      `SELECT id, name, api_token, owner_id, is_active, meta, created_at, updated_at
       FROM agents WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      throw new NotFoundError('Agent not found')
    }

    const agent = result.rows[0]

    // Only admin or owner can view
    if (req.user.role !== 'admin' && req.user.userId !== agent.owner_id) {
      throw new ForbiddenError('You do not have access to this agent')
    }

    res.json({
      ...agent,
      api_token: maskToken(agent.api_token)
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/agents/:id
 * Update agent info. Admin or owner.
 */
async function update(req, res, next) {
  try {
    const { id } = req.params
    const { name, meta } = req.body

    // Find agent first
    const existing = await db.query(
      'SELECT id, owner_id FROM agents WHERE id = $1',
      [id]
    )

    if (existing.rows.length === 0) {
      throw new NotFoundError('Agent not found')
    }

    const agent = existing.rows[0]

    // Only admin or owner can update
    if (req.user.role !== 'admin' && req.user.userId !== agent.owner_id) {
      throw new ForbiddenError('You do not have access to this agent')
    }

    // Build dynamic update query
    const updates = []
    const params = []
    let paramIdx = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIdx++}`)
      params.push(name.trim())
    }
    if (meta !== undefined) {
      updates.push(`meta = $${paramIdx++}`)
      params.push(JSON.stringify(meta))
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update')
    }

    updates.push(`updated_at = now()`)
    params.push(id)

    const result = await db.query(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramIdx}
       RETURNING id, name, api_token, owner_id, is_active, meta, created_at, updated_at`,
      params
    )

    const updated = result.rows[0]
    res.json({
      ...updated,
      api_token: maskToken(updated.api_token)
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/agents/:id/regenerate-token
 * Regenerate the agent's API token. Admin or owner.
 */
async function regenerateToken(req, res, next) {
  try {
    const { id } = req.params

    // Find agent
    const existing = await db.query(
      'SELECT id, owner_id FROM agents WHERE id = $1',
      [id]
    )

    if (existing.rows.length === 0) {
      throw new NotFoundError('Agent not found')
    }

    const agent = existing.rows[0]

    // Only admin or owner can regenerate
    if (req.user.role !== 'admin' && req.user.userId !== agent.owner_id) {
      throw new ForbiddenError('You do not have access to this agent')
    }

    // Generate new token
    const rawToken = generateAgentToken()
    const tokenHash = hashToken(rawToken)

    await db.query(
      'UPDATE agents SET api_token = $1, updated_at = now() WHERE id = $2',
      [tokenHash, id]
    )

    res.json({
      id: agent.id,
      api_token: rawToken,
      message: 'New token issued. The previous token is now invalid.'
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/agents/:id
 * Soft-delete (deactivate) an agent. Admin only.
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params

    const existing = await db.query(
      'SELECT id FROM agents WHERE id = $1',
      [id]
    )

    if (existing.rows.length === 0) {
      throw new NotFoundError('Agent not found')
    }

    await db.query(
      'UPDATE agents SET is_active = false, updated_at = now() WHERE id = $1',
      [id]
    )

    res.json({ id, is_active: false, message: 'Agent deactivated' })
  } catch (err) {
    next(err)
  }
}

module.exports = { selfRegister, create, list, get, update, regenerateToken, remove }
