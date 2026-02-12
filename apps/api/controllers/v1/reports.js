// Reports controller: submission reporting system
const db = require('../../db')
const configManager = require('../../services/configManager')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors')

const VALID_REASONS = ['inappropriate', 'spam', 'offensive', 'irrelevant', 'other']

/**
 * POST /api/v1/reports
 * Create a report. Public (uses voterId or userId).
 */
async function create(req, res, next) {
  try {
    const { submission_id, reason, detail } = req.body

    if (!submission_id) {
      throw new ValidationError('submission_id is required')
    }
    if (reason && !VALID_REASONS.includes(reason)) {
      throw new ValidationError(`reason must be one of: ${VALID_REASONS.join(', ')}`)
    }

    // Check submission exists
    const subResult = await db.query(
      'SELECT id, status FROM submissions WHERE id = $1',
      [submission_id]
    )
    if (subResult.rows.length === 0) {
      throw new NotFoundError('Submission not found')
    }

    // Determine reporter identity
    const reporterId = req.user ? req.user.id : null
    const reporterToken = req.voterId || null

    if (!reporterId && !reporterToken) {
      throw new ValidationError('Reporter identity required')
    }

    // Insert report
    const client = await db.getClient()
    try {
      await client.query('BEGIN')

      const insertResult = await client.query(
        `INSERT INTO reports (submission_id, reporter_token, reporter_id, reason, detail)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, submission_id, reason, detail, status, created_at`,
        [submission_id, reporterToken, reporterId, reason || 'other', detail || null]
      )

      // Check if report count >= threshold for auto-restrict
      const threshold = configManager.getNumber('report_auto_threshold', 5)
      const countResult = await client.query(
        'SELECT COUNT(*)::int AS cnt FROM reports WHERE submission_id = $1',
        [submission_id]
      )

      if (countResult.rows[0].cnt >= threshold && subResult.rows[0].status === 'active') {
        await client.query(
          "UPDATE submissions SET status = 'restricted' WHERE id = $1",
          [submission_id]
        )
      }

      await client.query('COMMIT')
      res.status(201).json(insertResult.rows[0])
    } catch (err) {
      await client.query('ROLLBACK')
      if (err.code === '23505') {
        throw new ConflictError('You have already reported this submission')
      }
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/reports
 * List reports. Admin only. Optional ?status, ?submission_id filters.
 */
async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status, submission_id } = req.query

    const conditions = []
    const params = []
    let paramIdx = 1

    if (status) {
      conditions.push(`r.status = $${paramIdx++}`)
      params.push(status)
    }
    if (submission_id) {
      conditions.push(`r.submission_id = $${paramIdx++}`)
      params.push(submission_id)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM reports r ${whereClause}`,
      params
    )
    const total = countResult.rows[0].total

    const dataParams = [...params, limit, offset]
    const result = await db.query(
      `SELECT r.id, r.submission_id, r.reporter_id, r.reason, r.detail,
              r.status, r.reviewed_by, r.reviewed_at, r.created_at,
              s.title AS submission_title, a.name AS agent_name
       FROM reports r
       LEFT JOIN submissions s ON s.id = r.submission_id
       LEFT JOIN agents a ON a.id = s.agent_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      dataParams
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/reports/summary
 * Per-submission report counts. Admin only.
 */
async function summary(req, res, next) {
  try {
    const result = await db.query(
      `SELECT r.submission_id, s.title AS submission_title, a.name AS agent_name,
              s.status AS submission_status,
              COUNT(*)::int AS report_count,
              COUNT(CASE WHEN r.status = 'pending' THEN 1 END)::int AS pending_count,
              COUNT(CASE WHEN r.status = 'confirmed' THEN 1 END)::int AS confirmed_count,
              COUNT(CASE WHEN r.status = 'dismissed' THEN 1 END)::int AS dismissed_count
       FROM reports r
       JOIN submissions s ON s.id = r.submission_id
       LEFT JOIN agents a ON a.id = s.agent_id
       GROUP BY r.submission_id, s.title, a.name, s.status
       ORDER BY report_count DESC`
    )

    res.json({ summary: result.rows })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/reports/:id
 * Review a report. Admin only. Body: { status: 'dismissed' | 'confirmed' }
 */
async function review(req, res, next) {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!status || !['dismissed', 'confirmed'].includes(status)) {
      throw new ValidationError('status must be "dismissed" or "confirmed"')
    }

    const client = await db.getClient()
    try {
      await client.query('BEGIN')

      const reportResult = await client.query(
        `UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = now()
         WHERE id = $3
         RETURNING id, submission_id, status, reviewed_by, reviewed_at`,
        [status, req.user.id, id]
      )

      if (reportResult.rows.length === 0) {
        throw new NotFoundError('Report not found')
      }

      // If confirmed, disqualify the submission
      if (status === 'confirmed') {
        await client.query(
          "UPDATE submissions SET status = 'disqualified' WHERE id = $1",
          [reportResult.rows[0].submission_id]
        )
      }

      await client.query('COMMIT')
      res.json(reportResult.rows[0])
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    next(err)
  }
}

module.exports = { create, list, summary, review }
