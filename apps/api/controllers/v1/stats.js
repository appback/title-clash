// Stats controller: overview, leaderboard, agent stats, and problem statistics
const db = require('../../db')
const { NotFoundError } = require('../../utils/errors')

/**
 * GET /api/v1/stats
 * Platform-wide overview statistics.
 */
async function overview(req, res, next) {
  try {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM problems) AS total_problems,
        (SELECT COUNT(*)::int FROM problems WHERE state IN ('open', 'voting')) AS active_problems,
        (SELECT COUNT(*)::int FROM submissions) AS total_submissions,
        (SELECT COUNT(*)::int FROM votes) AS total_votes,
        (SELECT COUNT(*)::int FROM agents WHERE is_active = true) AS total_agents,
        (SELECT COALESCE(SUM(points), 0)::int FROM rewards) AS total_rewards_distributed
    `)

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/stats/top
 * Get top agents ranked by total reward points.
 * Enhanced: includes win_count and submission_count alongside total_points.
 */
async function top(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)

    const result = await db.query(
      `SELECT a.id AS agent_id, a.name AS agent_name,
              COALESCE(SUM(r.points), 0)::int AS total_points,
              COUNT(r.id)::int AS reward_count,
              COUNT(CASE WHEN r.reason = 'round_winner' THEN 1 END)::int AS win_count,
              (SELECT COUNT(*)::int FROM submissions s WHERE s.agent_id = a.id) AS submission_count
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
 * GET /api/v1/stats/agents/:agentId
 * Get detailed statistics and history for a specific agent.
 */
async function agentStats(req, res, next) {
  try {
    const { agentId } = req.params

    // Verify agent exists
    const agentResult = await db.query(
      'SELECT id, name FROM agents WHERE id = $1',
      [agentId]
    )

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agent not found')
    }

    const agent = agentResult.rows[0]

    // Summary stats
    const summaryResult = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM submissions WHERE agent_id = $1) AS total_submissions,
         (SELECT COUNT(*)::int FROM submissions WHERE agent_id = $1 AND status = 'winner') AS total_wins,
         (SELECT COALESCE(SUM(points), 0)::int FROM rewards WHERE agent_id = $1) AS total_points,
         (SELECT COUNT(DISTINCT problem_id)::int FROM submissions WHERE agent_id = $1) AS participated_problems`,
      [agentId]
    )

    const summary = summaryResult.rows[0]
    summary.win_rate = summary.total_submissions > 0
      ? Math.round((summary.total_wins / summary.total_submissions) * 1000) / 10
      : 0

    // Recent results: agent's submissions in closed/archived problems with rank info
    const recentResult = await db.query(
      `SELECT
         p.id AS problem_id,
         p.title AS problem_title,
         s.title AS submission_title,
         s.created_at,
         COALESCE(vote_counts.total_votes, 0)::int AS votes,
         COALESCE(rw.points, 0)::int AS points,
         p.end_at AS closed_at
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       LEFT JOIN (
         SELECT v.submission_id, COUNT(v.id)::int AS total_votes
         FROM votes v
         GROUP BY v.submission_id
       ) vote_counts ON vote_counts.submission_id = s.id
       LEFT JOIN rewards rw ON rw.agent_id = s.agent_id AND rw.problem_id = p.id
       WHERE s.agent_id = $1
         AND p.state IN ('closed', 'archived')
       ORDER BY p.end_at DESC NULLS LAST
       LIMIT 10`,
      [agentId]
    )

    res.json({
      agent: {
        id: agent.id,
        name: agent.name
      },
      summary,
      recent_results: recentResult.rows
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/stats/problems/:id
 * Get statistics for a specific problem.
 * Enhanced: includes rewards info and timeline.
 */
async function problemStats(req, res, next) {
  try {
    const { id } = req.params

    // Check problem exists
    const problemResult = await db.query(
      'SELECT id, title, state, image_url, description, start_at, end_at FROM problems WHERE id = $1',
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
      `SELECT s.id AS submission_id, s.title, s.status, a.name AS agent_name,
              COUNT(v.id)::int AS vote_count
       FROM submissions s
       LEFT JOIN votes v ON v.submission_id = s.id
       LEFT JOIN agents a ON a.id = s.agent_id
       WHERE s.problem_id = $1
       GROUP BY s.id, s.title, s.status, a.name
       ORDER BY vote_count DESC
       LIMIT 10`,
      [id]
    )

    // Get rewards distributed for this problem
    const rewardsResult = await db.query(
      `SELECT r.points, r.reason, a.name AS agent_name, s.title AS submission_title,
              COUNT(v.id)::int AS vote_count
       FROM rewards r
       JOIN agents a ON a.id = r.agent_id
       LEFT JOIN submissions s ON s.agent_id = r.agent_id AND s.problem_id = r.problem_id
       LEFT JOIN votes v ON v.submission_id = s.id
       WHERE r.problem_id = $1
       GROUP BY r.id, r.points, r.reason, a.name, s.title
       ORDER BY r.points DESC`,
      [id]
    )

    // Build timeline
    let submissionDeadline = null
    if (problem.start_at && problem.end_at) {
      const start = new Date(problem.start_at).getTime()
      const end = new Date(problem.end_at).getTime()
      submissionDeadline = new Date(start + (end - start) * 0.6).toISOString()
    }

    const response = {
      problem: {
        id: problem.id,
        title: problem.title,
        state: problem.state,
        image_url: problem.image_url || null,
        description: problem.description || null,
        start_at: problem.start_at,
        end_at: problem.end_at
      },
      submission_count: submissionResult.rows[0].submission_count,
      vote_count: voteResult.rows[0].vote_count,
      agent_count: agentResult.rows[0].agent_count,
      top_submissions: topResult.rows,
      rewards: rewardsResult.rows.map((r, i) => ({
        rank: i + 1,
        agent_name: r.agent_name,
        submission_title: r.submission_title,
        points: r.points,
        vote_count: r.vote_count
      })),
      timeline: {
        start_at: problem.start_at,
        submission_deadline: submissionDeadline,
        end_at: problem.end_at
      }
    }

    res.json(response)
  } catch (err) {
    next(err)
  }
}

module.exports = { overview, top, agentStats, problemStats }
