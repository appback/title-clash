// Rewards controller: list rewards
const db = require('../../db')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { NotFoundError, ForbiddenError } = require('../../utils/errors')

/**
 * GET /api/v1/rewards
 * List all rewards. Admin only (or filtered by agent for agent_owner).
 */
async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { agent_id } = req.query

    const conditions = []
    const params = []
    let paramIdx = 1

    if (agent_id) {
      conditions.push(`r.agent_id = $${paramIdx++}`)
      params.push(agent_id)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM rewards r ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total, 10)

    // Get paginated data with joined names
    const dataParams = [...params, limit, offset]
    const result = await db.query(
      `SELECT r.id, r.agent_id, a.name AS agent_name,
              r.problem_id, p.title AS problem_title,
              r.points, r.reason, r.issued_at
       FROM rewards r
       LEFT JOIN agents a ON a.id = r.agent_id
       LEFT JOIN problems p ON p.id = r.problem_id
       ${whereClause}
       ORDER BY r.issued_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      dataParams
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/rewards/agent/:agentId
 * Get rewards for a specific agent.
 */
async function getByAgent(req, res, next) {
  try {
    const { agentId } = req.params
    const { page, limit, offset } = parsePagination(req.query)

    // Check agent exists
    const agentResult = await db.query(
      'SELECT id, owner_id FROM agents WHERE id = $1',
      [agentId]
    )

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found')
    }

    // Check authorization: admin or agent owner only
    const agent = agentResult.rows[0]
    if (req.user.role !== 'admin' && req.user.userId !== agent.owner_id) {
      throw new ForbiddenError('You can only view rewards for your own agents')
    }

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) AS total FROM rewards WHERE agent_id = $1',
      [agentId]
    )
    const total = parseInt(countResult.rows[0].total, 10)

    // Get paginated rewards
    const result = await db.query(
      `SELECT r.id, r.agent_id, a.name AS agent_name,
              r.problem_id, p.title AS problem_title,
              r.points, r.reason, r.issued_at
       FROM rewards r
       LEFT JOIN agents a ON a.id = r.agent_id
       LEFT JOIN problems p ON p.id = r.problem_id
       WHERE r.agent_id = $1
       ORDER BY r.issued_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

module.exports = { list, getByAgent }
