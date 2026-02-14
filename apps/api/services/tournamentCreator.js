// tournamentCreator.js - Auto-create and start tournaments when problems enter voting
const db = require('../db')
const bracket = require('./bracket')

/**
 * Create and start a title_battle tournament for a problem.
 * Idempotent: skips if a tournament already exists for the problem.
 *
 * @param {string} problemId
 * @returns {Promise<object|null>} Created tournament or null if skipped
 */
async function createTournamentForProblem(problemId) {
  // 1. Check if tournament already exists for this problem
  const existing = await db.query(
    'SELECT id FROM tournaments WHERE problem_id = $1 LIMIT 1',
    [problemId]
  )
  if (existing.rows.length > 0) {
    console.log(`[TournamentCreator] Tournament already exists for problem ${problemId}. Skipping.`)
    return null
  }

  // 2. Get problem info
  const problemResult = await db.query(
    'SELECT id, title, image_url FROM problems WHERE id = $1',
    [problemId]
  )
  if (problemResult.rows.length === 0) {
    console.log(`[TournamentCreator] Problem ${problemId} not found. Skipping.`)
    return null
  }
  const problem = problemResult.rows[0]

  // 3. Get active submissions
  const subs = await db.query(
    `SELECT s.id, s.title, a.name AS agent_name, s.model_name
     FROM submissions s
     LEFT JOIN agents a ON a.id = s.agent_id
     WHERE s.problem_id = $1 AND s.status = 'active'
     ORDER BY RANDOM()`,
    [problemId]
  )

  if (subs.rows.length < 2) {
    console.log(`[TournamentCreator] Problem ${problemId} has ${subs.rows.length} submissions (need >=2). Skipping.`)
    return null
  }

  // 4. Create tournament + entries + bracket in a transaction
  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    // Create tournament
    const tResult = await client.query(
      `INSERT INTO tournaments (title, content_type, problem_id, created_by)
       VALUES ($1, 'title_battle', $2, (SELECT id FROM users WHERE role = 'admin' LIMIT 1))
       RETURNING *`,
      [`${problem.title} Battle`, problemId]
    )
    const tournament = tResult.rows[0]

    // Import submissions as entries
    for (let i = 0; i < subs.rows.length; i++) {
      const s = subs.rows[i]
      await client.query(
        `INSERT INTO tournament_entries
         (tournament_id, submission_id, source, title, author_name, model_name, seed)
         VALUES ($1, $2, 'ai', $3, $4, $5, $6)`,
        [tournament.id, s.id, s.title, s.agent_name || 'Unknown', s.model_name, i + 1]
      )
    }

    // Get entries for bracket generation
    const entries = await client.query(
      'SELECT * FROM tournament_entries WHERE tournament_id = $1 ORDER BY seed ASC',
      [tournament.id]
    )

    await client.query('COMMIT')

    // Generate bracket (bracket.js manages its own transaction)
    await bracket.generateBracket(tournament.id, entries.rows)

    // Update phase to playing and activate first round
    await db.query(
      `UPDATE tournaments SET phase = 'playing', current_round = 1, updated_at = NOW() WHERE id = $1`,
      [tournament.id]
    )
    await bracket.activateFirstRound(tournament.id)

    console.log(
      `[TournamentCreator] Created tournament "${tournament.title}" (${tournament.id}) ` +
      `for problem ${problemId} with ${subs.rows.length} entries`
    )

    return tournament
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Create tournaments for multiple problems.
 * Fire-and-forget safe.
 *
 * @param {string[]} problemIds
 */
async function createTournamentsForProblems(problemIds) {
  for (const problemId of problemIds) {
    try {
      await createTournamentForProblem(problemId)
    } catch (err) {
      console.error(`[TournamentCreator] Failed for problem ${problemId}:`, err.message)
    }
  }
}

module.exports = { createTournamentForProblem, createTournamentsForProblems }
