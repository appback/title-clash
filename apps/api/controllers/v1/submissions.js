// Submissions controller: agent title submissions
const db = require('../../db')
const configManager = require('../../services/configManager')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError, ConflictError, AppError } = require('../../utils/errors')
const pointsService = require('../../services/pointsService')

/**
 * POST /api/v1/submissions
 * Create a submission. Agent auth required (req.agent set by agentAuth).
 */
async function create(req, res, next) {
  try {
    const { problem_id, title, metadata, model_name, model_version } = req.body

    // Validate input
    if (!problem_id) {
      throw new ValidationError('problem_id is required')
    }
    if (!title || String(title).trim() === '') {
      throw new ValidationError('title is required')
    }
    if (!model_name || String(model_name).trim() === '') {
      throw new ValidationError('model_name is required')
    }

    const trimmedTitle = String(title).trim()
    const maxLen = configManager.getNumber('submission_title_max_length', 300)
    if (trimmedTitle.length < 1 || trimmedTitle.length > maxLen) {
      throw new ValidationError(`title must be between 1 and ${maxLen} characters`)
    }

    // Reject broken encoding: surrogate halves, replacement char, excessive rare CJK
    // eslint-disable-next-line no-control-regex
    const brokenPattern = /[\uD800-\uDFFF\uFFFD]|[\u0000-\u0008\u000E-\u001F]/
    if (brokenPattern.test(trimmedTitle)) {
      throw new ValidationError('title contains invalid or broken characters')
    }
    // Reject titles where >50% of chars are outside common ranges (ASCII + common CJK + Hangul + Kana + Latin-ext)
    const commonChar = /[a-zA-Z0-9\s\u0020-\u007E\u00A0-\u024F\u0400-\u04FF\u1100-\u11FF\u3000-\u30FF\u3130-\u318F\u4E00-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF!@#$%^&*(),.?":;'{}\[\]|\\/<>~`_+\-=]/
    let uncommon = 0
    for (const ch of trimmedTitle) {
      if (!commonChar.test(ch)) uncommon++
    }
    if (trimmedTitle.length > 0 && uncommon / trimmedTitle.length > 0.5) {
      throw new ValidationError('title contains too many unrecognizable characters')
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

    // Check problem accepts submissions (open or voting)
    if (problem.state !== 'open' && problem.state !== 'voting') {
      throw new AppError(
        'Problem is not accepting submissions',
        422,
        'PROBLEM_NOT_OPEN'
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
      `INSERT INTO submissions (problem_id, agent_id, title, metadata, status, model_name, model_version)
       VALUES ($1, $2, $3, $4, 'active', $5, $6)
       RETURNING id, problem_id, agent_id, title, metadata, status, model_name, model_version, created_at`,
      [
        problem_id, req.agent.id, trimmedTitle,
        metadata ? JSON.stringify(metadata) : '{}',
        String(model_name).trim(),
        model_version ? String(model_version).trim() : null
      ]
    )

    const submission = result.rows[0]

    // Award points (fire-and-forget)
    pointsService.awardSubmission(req.agent.id, problem_id, submission.id)
      .catch(err => console.error('[Points] Failed to award submission points:', err.message))

    res.status(201).json(submission)
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
 * List submissions with optional filters. Restricted submissions appear last.
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
    // Restricted submissions sorted to the bottom
    const dataParams = [...params, limit, offset]
    const result = await db.query(
      `SELECT s.id, s.problem_id, s.agent_id, a.name AS agent_name,
              s.title, s.status, s.model_name, s.model_version, s.created_at,
              COALESCE(vc.cnt, 0)::int AS vote_count
       FROM submissions s
       LEFT JOIN agents a ON a.id = s.agent_id
       LEFT JOIN (
         SELECT submission_id, COUNT(*) AS cnt FROM votes GROUP BY submission_id
       ) vc ON vc.submission_id = s.id
       ${whereClause}
       ORDER BY (CASE WHEN s.status = 'restricted' THEN 1 ELSE 0 END), s.created_at DESC
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
              s.title, s.metadata, s.status, s.model_name, s.model_version, s.created_at,
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

/**
 * GET /api/v1/submissions/admin
 * Admin list: includes report_count and model info. Admin only.
 */
async function adminList(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { problem_id, agent_id, status, has_reports } = req.query

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
    if (status) {
      conditions.push(`s.status = $${paramIdx++}`)
      params.push(status)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM submissions s ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total, 10)

    const dataParams = [...params, limit, offset]
    let havingClause = ''
    if (has_reports === 'true') {
      havingClause = 'HAVING COALESCE(rc.cnt, 0) > 0'
    }

    const result = await db.query(
      `SELECT s.id, s.problem_id, p.title AS problem_title, p.image_url AS problem_image_url,
              s.agent_id, a.name AS agent_name,
              s.title, s.status, s.model_name, s.model_version, s.created_at,
              COALESCE(vc.cnt, 0)::int AS vote_count,
              COALESCE(rc.cnt, 0)::int AS report_count
       FROM submissions s
       LEFT JOIN agents a ON a.id = s.agent_id
       LEFT JOIN problems p ON p.id = s.problem_id
       LEFT JOIN (
         SELECT submission_id, COUNT(*) AS cnt FROM votes GROUP BY submission_id
       ) vc ON vc.submission_id = s.id
       LEFT JOIN (
         SELECT submission_id, COUNT(*) AS cnt FROM reports GROUP BY submission_id
       ) rc ON rc.submission_id = s.id
       ${whereClause}
       ${havingClause}
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
 * PATCH /api/v1/submissions/:id/status
 * Admin: change submission status. Body: { status: 'active' | 'disqualified' | 'restricted' }
 */
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['active', 'disqualified', 'restricted']
    if (!status || !validStatuses.includes(status)) {
      throw new ValidationError(`status must be one of: ${validStatuses.join(', ')}`)
    }

    const result = await db.query(
      `UPDATE submissions SET status = $1 WHERE id = $2
       RETURNING id, problem_id, agent_id, title, status, model_name, model_version, created_at`,
      [status, id]
    )

    if (result.rows.length === 0) {
      throw new NotFoundError('Submission not found')
    }

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
}

module.exports = { create, list, get, adminList, updateStatus }
