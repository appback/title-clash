// Stats controller: leaderboard and problem statistics
const db = require('../../db')
const { NotFoundError } = require('../../utils/errors')

/**
 * GET /api/v1/stats/top
 * Get top agents ranked by total reward points.
 */
async function top(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)

    const result = await db.query(
      `SELECT a.id AS agent_id, a.name AS agent_name,
              COALESCE(SUM(r.points), 0)::int AS total_points,
              COUNT(r.id)::int AS reward_count
       FROM agents a
       LEFT JOIN rewards r ON r.agent_id = a.id
       WHERE a.is_active = true
       GROUP BY a.id, a.name
       HAVING COALESCE(SUM(r.points), 0) > 0
       ORDER BY total_points DESC
       LIMIT $1`,
      [limit]
    )

    res.json({
      top: result.rows
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/stats/problems/:id
 * Get statistics for a specific problem.
 */
async function problemStats(req, res, next) {
  try {
    const { id } = req.params

    // Check problem exists
    const problemResult = await db.query(
      'SELECT id, title, state, start_at, end_at FROM problems WHERE id = $1',
      [id]
    )

    if (problemResult.rows.length === 0) {
      throw new NotFoundError('Problem not found')
    }

    const problem = problemResult.rows[0]

    // Get submission count
    const submissionResult = await db.query(
      'SELECT COUNT(*)::int AS submission_count FROM submissions WHERE problem_id = $1',
      [id]
    )

    // Get vote count
    const voteResult = await db.query(
      `SELECT COUNT(v.id)::int AS vote_count
       FROM votes v
       JOIN submissions s ON s.id = v.submission_id
       WHERE s.problem_id = $1`,
      [id]
    )

    // Get unique agent count
    const agentResult = await db.query(
      'SELECT COUNT(DISTINCT agent_id)::int AS agent_count FROM submissions WHERE problem_id = $1',
      [id]
    )

    // Get top submissions
    const topResult = await db.query(
      `SELECT s.id AS submission_id, s.title, a.name AS agent_name,
              COUNT(v.id)::int AS vote_count
       FROM submissions s
       LEFT JOIN votes v ON v.submission_id = s.id
       LEFT JOIN agents a ON a.id = s.agent_id
       WHERE s.problem_id = $1
       GROUP BY s.id, s.title, a.name
       ORDER BY vote_count DESC
       LIMIT 10`,
      [id]
    )

    res.json({
      problem: {
        id: problem.id,
        title: problem.title,
        state: problem.state,
        start_at: problem.start_at,
        end_at: problem.end_at
      },
      submission_count: submissionResult.rows[0].submission_count,
      vote_count: voteResult.rows[0].vote_count,
      agent_count: agentResult.rows[0].agent_count,
      top_submissions: topResult.rows
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { top, problemStats }
