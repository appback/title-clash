// Stats controller: overview, leaderboard, agent stats, problem stats, model stats, admin stats
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
 */
async function top(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)

    const result = await db.query(
      `SELECT a.id AS agent_id, a.name AS agent_name,
              COALESCE(SUM(r.points), 0)::int AS total_points,
              COUNT(r.id)::int AS reward_count,
              COUNT(CASE WHEN r.reason = 'round_winner' THEN 1 END)::int AS win_count,
              (SELECT COUNT(*)::int FROM submissions s WHERE s.agent_id = a.id) AS submission_count,
              (SELECT COALESCE(SUM(s.selection_count), 0)::int FROM submissions s WHERE s.agent_id = a.id AND s.status = 'active') AS total_selections,
              (SELECT COALESCE(SUM(s.exposure_count), 0)::int FROM submissions s WHERE s.agent_id = a.id AND s.status = 'active') AS total_exposures
       FROM agents a
       LEFT JOIN rewards r ON r.agent_id = a.id
       WHERE a.is_active = true
       GROUP BY a.id, a.name
       HAVING COALESCE(SUM(r.points), 0) > 0
          OR (SELECT COALESCE(SUM(s.exposure_count), 0) FROM submissions s WHERE s.agent_id = a.id AND s.status = 'active') > 0
       ORDER BY total_points DESC, total_selections DESC
       LIMIT $1`,
      [limit]
    )

    // Add win_rate to each row
    const top = result.rows.map(r => ({
      ...r,
      win_rate: r.total_exposures > 0
        ? Math.round(r.total_selections / r.total_exposures * 1000) / 10
        : 0
    }))

    res.json({
      top
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

    // Recent results
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

/**
 * GET /api/v1/stats/models
 * Model stats: submissions, wins, agents per model. Public.
 */
async function modelStats(req, res, next) {
  try {
    const result = await db.query(
      `SELECT
         s.model_name,
         COUNT(*)::int AS submission_count,
         COUNT(CASE WHEN s.status = 'winner' THEN 1 END)::int AS win_count,
         COUNT(DISTINCT s.agent_id)::int AS agent_count
       FROM submissions s
       WHERE s.model_name IS NOT NULL
       GROUP BY s.model_name
       ORDER BY submission_count DESC`
    )

    res.json({ models: result.rows })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/stats/admin
 * Extended admin stats with reports, models, round analysis. Admin only.
 */
async function adminStats(req, res, next) {
  try {
    const overview = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM problems) AS total_problems,
        (SELECT COUNT(*)::int FROM problems WHERE state IN ('open', 'voting')) AS active_problems,
        (SELECT COUNT(*)::int FROM submissions) AS total_submissions,
        (SELECT COUNT(*)::int FROM votes) AS total_votes,
        (SELECT COUNT(*)::int FROM agents WHERE is_active = true) AS total_agents,
        (SELECT COALESCE(SUM(points), 0)::int FROM rewards) AS total_rewards_distributed,
        (SELECT COUNT(*)::int FROM reports) AS total_reports,
        (SELECT COUNT(*)::int FROM reports WHERE status = 'pending') AS pending_reports,
        (SELECT COUNT(*)::int FROM submissions WHERE status = 'restricted') AS restricted_submissions
    `)

    // Reports by reason
    const reportsByReason = await db.query(
      `SELECT reason, COUNT(*)::int AS count
       FROM reports GROUP BY reason ORDER BY count DESC`
    )

    // Model distribution
    const modelDistribution = await db.query(
      `SELECT model_name, COUNT(*)::int AS count
       FROM submissions WHERE model_name IS NOT NULL
       GROUP BY model_name ORDER BY count DESC LIMIT 10`
    )

    // Round activity (submissions + votes per problem, last 10)
    const roundActivity = await db.query(
      `SELECT p.id, p.title, p.state,
              (SELECT COUNT(*)::int FROM submissions WHERE problem_id = p.id) AS submission_count,
              (SELECT COUNT(*)::int FROM votes v JOIN submissions s ON s.id = v.submission_id WHERE s.problem_id = p.id) AS vote_count
       FROM problems p
       ORDER BY p.created_at DESC
       LIMIT 10`
    )

    // Vote trend (daily votes for last 14 days)
    const voteTrend = await db.query(
      `SELECT DATE(v.created_at) AS date, COUNT(*)::int AS count
       FROM votes v
       WHERE v.created_at >= NOW() - INTERVAL '14 days'
       GROUP BY DATE(v.created_at)
       ORDER BY date`
    )

    res.json({
      overview: overview.rows[0],
      reports_by_reason: reportsByReason.rows,
      model_distribution: modelDistribution.rows,
      round_activity: roundActivity.rows,
      vote_trend: voteTrend.rows
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { overview, top, agentStats, problemStats, modelStats, adminStats }
