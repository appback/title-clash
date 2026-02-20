// Votes controller: create votes and get vote summaries
const db = require('../../db')
const { ValidationError, NotFoundError, ConflictError, AppError } = require('../../utils/errors')

/**
 * POST /api/v1/votes
 * Cast a vote for a submission.
 * Uses JWT user ID if authenticated, or cookie voter_token if anonymous.
 * Uses a transaction to prevent duplicates.
 */
async function create(req, res, next) {
  const client = await db.getClient()
  try {
    const { submission_id } = req.body

    if (!submission_id) {
      throw new ValidationError('submission_id is required')
    }

    await client.query('BEGIN')

    // Verify submission exists and get its problem
    const subResult = await client.query(
      `SELECT s.id, s.problem_id, p.state
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       WHERE s.id = $1`,
      [submission_id]
    )

    if (subResult.rows.length === 0) {
      throw new NotFoundError('Submission not found')
    }

    const submission = subResult.rows[0]

    // Check problem is in voting state (open state is for submissions only)
    if (submission.state !== 'voting') {
      throw new AppError(
        'Voting is not open for this problem',
        422,
        'VOTING_CLOSED'
      )
    }

    // Determine voter identity
    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    if (!voterId && !voterToken) {
      throw new ValidationError('Voter identification required (login or accept cookies)')
    }

    // Check for duplicate vote
    if (voterId) {
      const dupCheck = await client.query(
        'SELECT id FROM votes WHERE submission_id = $1 AND voter_id = $2',
        [submission_id, voterId]
      )
      if (dupCheck.rows.length > 0) {
        throw new ConflictError('You have already voted for this submission')
      }
    } else if (voterToken) {
      const dupCheck = await client.query(
        'SELECT id FROM votes WHERE submission_id = $1 AND voter_token = $2',
        [submission_id, voterToken]
      )
      if (dupCheck.rows.length > 0) {
        throw new ConflictError('You have already voted for this submission')
      }
    }

    // Insert vote
    const result = await client.query(
      `INSERT INTO votes (submission_id, voter_id, voter_token, weight)
       VALUES ($1, $2, $3, 1)
       RETURNING id, submission_id, created_at`,
      [submission_id, voterId, voterToken]
    )

    await client.query('COMMIT')

    res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    // Handle unique constraint violation
    if (err.code === '23505') {
      return next(new ConflictError('You have already voted for this submission'))
    }
    next(err)
  } finally {
    client.release()
  }
}

/**
 * GET /api/v1/votes/summary/:problemId
 * Get vote summary for a problem, aggregated by submission.
 */
async function summary(req, res, next) {
  try {
    const { problemId } = req.params

    // Check problem exists
    const problemResult = await db.query(
      'SELECT id FROM problems WHERE id = $1',
      [problemId]
    )

    if (problemResult.rows.length === 0) {
      throw new NotFoundError('Problem not found')
    }

    // Get total votes for the problem
    const totalResult = await db.query(
      `SELECT COUNT(*) AS total
       FROM votes v
       JOIN submissions s ON s.id = v.submission_id
       WHERE s.problem_id = $1`,
      [problemId]
    )
    const totalVotes = parseInt(totalResult.rows[0].total, 10)

    // Get per-submission vote counts
    const result = await db.query(
      `SELECT s.id AS submission_id, s.title, a.name AS agent_name,
              COUNT(v.id)::int AS vote_count
       FROM submissions s
       LEFT JOIN votes v ON v.submission_id = s.id
       LEFT JOIN agents a ON a.id = s.agent_id
       WHERE s.problem_id = $1
       GROUP BY s.id, s.title, a.name
       ORDER BY vote_count DESC`,
      [problemId]
    )

    const submissions = result.rows.map(row => ({
      submission_id: row.submission_id,
      title: row.title,
      agent_name: row.agent_name,
      vote_count: row.vote_count,
      percentage: totalVotes > 0
        ? Math.round((row.vote_count / totalVotes) * 1000) / 10
        : 0
    }))

    res.json({
      problem_id: problemId,
      total_votes: totalVotes,
      submissions
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { create, summary }
