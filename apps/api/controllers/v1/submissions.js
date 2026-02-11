// Submissions controller: agent title submissions
const db = require('../../db')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError, ConflictError, AppError } = require('../../utils/errors')

/**
 * POST /api/v1/submissions
 * Create a submission. Agent auth required (req.agent set by agentAuth).
 */
async function create(req, res, next) {
  try {
    const { problem_id, title, metadata } = req.body

    // Validate input
    if (!problem_id) {
      throw new ValidationError('problem_id is required')
    }
    if (!title || String(title).trim() === '') {
      throw new ValidationError('title is required')
    }

    const trimmedTitle = String(title).trim()
    if (trimmedTitle.length < 1 || trimmedTitle.length > 300) {
      throw new ValidationError('title must be between 1 and 300 characters')
    }

    // Check problem exists
    const problemResult = await db.query(
      'SELECT id, state FROM problems WHERE id = $1',
      [problem_id]
    )

    if (problemResult.rows.length === 0) {
      throw new NotFoundError('Problem not found')
    }

    const problem = problemResult.rows[0]

    // Check problem is open for submissions
    if (problem.state !== 'open') {
      throw new AppError(
        422,
        'PROBLEM_NOT_OPEN',
        'Problem is not open for submissions'
      )
    }

    // Check for duplicate (same agent, same problem, same title)
    const dupCheck = await db.query(
      'SELECT id FROM submissions WHERE agent_id = $1 AND problem_id = $2 AND title = $3',
      [req.agent.id, problem_id, trimmedTitle]
    )

    if (dupCheck.rows.length > 0) {
      throw new ConflictError('This title has already been submitted for this problem')
    }

    // Insert submission
    const result = await db.query(
      `INSERT INTO submissions (problem_id, agent_id, title, metadata, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, problem_id, agent_id, title, metadata, status, created_at`,
      [problem_id, req.agent.id, trimmedTitle, metadata ? JSON.stringify(metadata) : '{}']
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    // Handle unique constraint violation from DB
    if (err.code === '23505') {
      return next(new ConflictError('Duplicate submission'))
    }
    next(err)
  }
}

/**
 * GET /api/v1/submissions
 * List submissions with optional filters.
 */
async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { problem_id, agent_id } = req.query

    const conditions = []
    const params = []
    let paramIdx = 1

    if (problem_id) {
      conditions.push(`s.problem_id = $${paramIdx++}`)
      params.push(problem_id)
    }
    if (agent_id) {
      conditions.push(`s.agent_id = $${paramIdx++}`)
      params.push(agent_id)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM submissions s ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total, 10)

    // Get paginated data with agent name and vote count
    const dataParams = [...params, limit, offset]
    const result = await db.query(
      `SELECT s.id, s.problem_id, s.agent_id, a.name AS agent_name,
              s.title, s.status, s.created_at,
              COALESCE(vc.cnt, 0)::int AS vote_count
       FROM submissions s
       LEFT JOIN agents a ON a.id = s.agent_id
       LEFT JOIN (
         SELECT submission_id, COUNT(*) AS cnt FROM votes GROUP BY submission_id
       ) vc ON vc.submission_id = s.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      dataParams
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/submissions/:id
 * Get a single submission by ID.
 */
async function get(req, res, next) {
  try {
    const { id } = req.params

    const result = await db.query(
      `SELECT s.id, s.problem_id, s.agent_id, a.name AS agent_name,
              s.title, s.metadata, s.status, s.created_at,
              COALESCE(vc.cnt, 0)::int AS vote_count
       FROM submissions s
       LEFT JOIN agents a ON a.id = s.agent_id
       LEFT JOIN (
         SELECT submission_id, COUNT(*) AS cnt FROM votes GROUP BY submission_id
       ) vc ON vc.submission_id = s.id
       WHERE s.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      throw new NotFoundError('Submission not found')
    }

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
}

module.exports = { create, list, get }
