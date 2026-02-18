// Problems controller: CRUD with state machine
const db = require('../../db')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError, AppError } = require('../../utils/errors')
const { validateImageUrl } = require('../../utils/imageValidator')

// Valid state transitions
const VALID_TRANSITIONS = {
  draft: ['open', 'archived'],
  open: ['voting', 'archived'],
  voting: ['closed'],
  closed: ['archived'],
  archived: []
}

/**
 * POST /api/v1/problems
 * Create a new problem. Admin only.
 */
async function create(req, res, next) {
  try {
    const { title, image_url, description, start_at, end_at } = req.body

    // title is optional (problems are identified by short ID)

    // Validate external image URL if provided
    let imageWarning = null
    if (image_url) {
      const check = await validateImageUrl(image_url)
      if (!check.valid) {
        throw new ValidationError(`Image URL is not accessible: ${check.error}`)
      }
      if (check.warning) imageWarning = check.warning
    }

    const result = await db.query(
      `INSERT INTO problems (title, image_url, description, state, created_by, start_at, end_at)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6)
       RETURNING id, title, image_url, description, state, created_by, start_at, end_at, created_at, updated_at`,
      [
        title ? title.trim() : null,
        image_url || null,
        description || null,
        req.user.userId,
        start_at || null,
        end_at || null
      ]
    )

    const response = result.rows[0]
    if (imageWarning) response.image_warning = imageWarning
    res.status(201).json(response)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/problems
 * List problems with optional state filter.
 */
async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { state } = req.query

    let whereClause = ''
    const params = []

    if (state) {
      whereClause = 'WHERE p.state = $1'
      params.push(state)
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM problems p ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total, 10)

    // Get paginated data with submission count
    const dataParams = [...params, limit, offset]
    const result = await db.query(
      `SELECT p.id, p.title, p.image_url, p.description, p.state,
              p.created_by, p.start_at, p.end_at, p.created_at, p.updated_at,
              COALESCE(sc.cnt, 0)::int AS submission_count
       FROM problems p
       LEFT JOIN (
         SELECT problem_id, COUNT(*) AS cnt FROM submissions GROUP BY problem_id
       ) sc ON sc.problem_id = p.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/problems/:id
 * Get a single problem by ID.
 */
async function get(req, res, next) {
  try {
    const { id } = req.params

    const result = await db.query(
      `SELECT p.id, p.title, p.image_url, p.description, p.state,
              p.created_by, p.start_at, p.end_at, p.created_at, p.updated_at,
              COALESCE(sc.cnt, 0)::int AS submission_count
       FROM problems p
       LEFT JOIN (
         SELECT problem_id, COUNT(*) AS cnt FROM submissions GROUP BY problem_id
       ) sc ON sc.problem_id = p.id
       WHERE p.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      throw new NotFoundError('Problem not found')
    }

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/problems/:id
 * Update a problem. Admin only. Validates state transitions.
 */
async function update(req, res, next) {
  try {
    const { id } = req.params
    const { title, image_url, description, state, start_at, end_at } = req.body

    // Find existing problem
    const existing = await db.query(
      'SELECT id, state FROM problems WHERE id = $1',
      [id]
    )

    if (existing.rows.length === 0) {
      throw new NotFoundError('Problem not found')
    }

    const problem = existing.rows[0]

    // Validate state transition if state is being changed
    if (state && state !== problem.state) {
      const allowed = VALID_TRANSITIONS[problem.state] || []
      if (!allowed.includes(state)) {
        throw new AppError(
          `Cannot transition from '${problem.state}' to '${state}'. Allowed: ${allowed.join(', ') || 'none'}`,
          400,
          'INVALID_STATE_TRANSITION'
        )
      }
    }

    // Validate external image URL if being changed
    let imageWarning = null
    if (image_url !== undefined && image_url !== null && image_url !== '') {
      const check = await validateImageUrl(image_url)
      if (!check.valid) {
        throw new ValidationError(`Image URL is not accessible: ${check.error}`)
      }
      if (check.warning) imageWarning = check.warning
    }

    // Build dynamic update
    const updates = []
    const params = []
    let paramIdx = 1

    if (title !== undefined) {
      updates.push(`title = $${paramIdx++}`)
      params.push(title.trim())
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramIdx++}`)
      params.push(image_url)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIdx++}`)
      params.push(description)
    }
    if (state !== undefined) {
      updates.push(`state = $${paramIdx++}`)
      params.push(state)
    }
    if (start_at !== undefined) {
      updates.push(`start_at = $${paramIdx++}`)
      params.push(start_at)
    }
    if (end_at !== undefined) {
      updates.push(`end_at = $${paramIdx++}`)
      params.push(end_at)
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update')
    }

    updates.push(`updated_at = now()`)
    params.push(id)

    const result = await db.query(
      `UPDATE problems SET ${updates.join(', ')} WHERE id = $${paramIdx}
       RETURNING id, title, image_url, description, state, created_by, start_at, end_at, created_at, updated_at`,
      params
    )

    // Trigger auto-submission when manually transitioning to 'open'
    if (state === 'open' && problem.state !== 'open') {
      const { triggerAutoSubmissions } = require('../../services/autoSubmitter')
      triggerAutoSubmissions([id]).catch(err => {
        console.error(`[Problems] Auto-submission error for problem ${id}:`, err.message)
      })
    }


    const response = result.rows[0]
    if (imageWarning) response.image_warning = imageWarning
    res.json(response)
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/problems/:id
 * Delete a problem. Admin only.
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params

    const existing = await db.query(
      'SELECT id FROM problems WHERE id = $1',
      [id]
    )

    if (existing.rows.length === 0) {
      throw new NotFoundError('Problem not found')
    }

    await db.query('DELETE FROM problems WHERE id = $1', [id])

    res.json({ id, message: 'Problem deleted' })
  } catch (err) {
    next(err)
  }
}

module.exports = { create, list, get, update, remove }
