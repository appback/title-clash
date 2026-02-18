// Games controller: play, vote, rankings, human submissions (replaces tournament-based voting)
const db = require('../../db')
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors')
const { generateGame } = require('../../services/matchmaker')
const pointsService = require('../../services/pointsService')

/**
 * GET /api/v1/games/play
 * Get a pre-generated game with the lowest play_count.
 * Falls back to generating one on the fly if pool is empty.
 */
async function play(req, res, next) {
  try {
    // Find a game from an active problem (open or voting)
    let gameResult = await db.query(
      `SELECT g.id, g.problem_id, g.matches, g.play_count,
              p.title AS problem_title, p.image_url AS problem_image_url
       FROM games g
       JOIN problems p ON p.id = g.problem_id
       WHERE p.state IN ('open', 'voting')
       ORDER BY g.play_count ASC, RANDOM()
       LIMIT 1`
    )

    // Fallback: generate a game on the fly
    if (gameResult.rows.length === 0) {
      const eligibleProblem = await db.query(
        `SELECT p.id FROM problems p
         WHERE p.state IN ('open', 'voting')
           AND (SELECT COUNT(*) FROM submissions s
                WHERE s.problem_id = p.id AND s.status = 'active' AND s.registered_at IS NOT NULL) >= 2
         ORDER BY RANDOM()
         LIMIT 1`
      )

      if (eligibleProblem.rows.length === 0) {
        return res.json({ game: null, matches: [], total_entries: 0 })
      }

      const newGame = await generateGame(eligibleProblem.rows[0].id)
      if (!newGame) {
        return res.json({ game: null, matches: [], total_entries: 0 })
      }

      gameResult = await db.query(
        `SELECT g.id, g.problem_id, g.matches, g.play_count,
                p.title AS problem_title, p.image_url AS problem_image_url
         FROM games g
         JOIN problems p ON p.id = g.problem_id
         WHERE g.id = $1`,
        [newGame.id]
      )
    }

    let game = gameResult.rows[0]

    // Hydrate matches with submission details
    let matchPairs = game.matches // JSONB, already parsed
    let subIds = new Set()
    matchPairs.forEach(m => { subIds.add(m.a); subIds.add(m.b) })

    let subsResult = await db.query(
      `SELECT s.id, s.title, a.name AS author_name, s.model_name
       FROM submissions s
       LEFT JOIN agents a ON a.id = s.agent_id
       WHERE s.id = ANY($1)`,
      [Array.from(subIds)]
    )

    // Filter out matches with missing submissions
    const foundIds = new Set(subsResult.rows.map(r => r.id))
    matchPairs = matchPairs.filter(m => foundIds.has(m.a) && foundIds.has(m.b))

    // Increment play_count
    await db.query(
      'UPDATE games SET play_count = play_count + 1 WHERE id = $1',
      [game.id]
    )

    const subMap = {}
    subsResult.rows.forEach(s => { subMap[s.id] = s })

    const matches = matchPairs.map((m, i) => ({
      index: i,
      entry_a: subMap[m.a] || { id: m.a, title: '[deleted]', author_name: 'Unknown', model_name: null },
      entry_b: subMap[m.b] || { id: m.b, title: '[deleted]', author_name: 'Unknown', model_name: null }
    }))

    // Total entries for this problem
    const totalResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM submissions
       WHERE problem_id = $1 AND status = 'active' AND registered_at IS NOT NULL`,
      [game.problem_id]
    )

    res.json({
      game: {
        id: game.id,
        problem_id: game.problem_id,
        problem_title: game.problem_title,
        problem_image_url: game.problem_image_url
      },
      matches,
      total_entries: totalResult.rows[0].total
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/games/:id/vote
 * Vote on a match within a game.
 * Body: { match_index, selected_id, shown_a_id, shown_b_id }
 *   OR: { match_index, action: "skip", shown_a_id, shown_b_id }
 */
async function vote(req, res, next) {
  const client = await db.getClient()
  try {
    const { id } = req.params
    const { match_index, selected_id, shown_a_id, shown_b_id, action } = req.body

    if (match_index === undefined || match_index === null) {
      throw new ValidationError('match_index is required')
    }
    if (!shown_a_id || !shown_b_id) {
      throw new ValidationError('shown_a_id and shown_b_id are required')
    }

    const isSkip = action === 'skip'
    if (!isSkip && !selected_id) {
      throw new ValidationError('selected_id is required for select action')
    }
    if (!isSkip && selected_id !== shown_a_id && selected_id !== shown_b_id) {
      throw new ValidationError('selected_id must be one of shown_a_id or shown_b_id')
    }

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    if (!voterId && !voterToken) {
      throw new ValidationError('Voter identification required')
    }

    // Verify game exists
    const gameResult = await client.query('SELECT id FROM games WHERE id = $1', [id])
    if (gameResult.rows.length === 0) {
      throw new NotFoundError('Game not found')
    }

    // Verify submissions still exist (prevent FK constraint violation)
    const subCheck = await client.query(
      'SELECT id FROM submissions WHERE id = ANY($1)',
      [[shown_a_id, shown_b_id]]
    )
    if (subCheck.rows.length < 2) {
      throw new ConflictError('One or more submissions no longer exist. Please refresh and try a new game.')
    }

    await client.query('BEGIN')

    // Insert vote record
    await client.query(
      `INSERT INTO game_votes (game_id, match_index, selected_id, shown_a_id, shown_b_id, action, voter_id, voter_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, match_index, isSkip ? null : selected_id, shown_a_id, shown_b_id, isSkip ? 'skip' : 'select', voterId, voterToken]
    )

    if (isSkip) {
      // Skip: both get +1 exposure, +1 skip
      await client.query(
        `UPDATE submissions SET exposure_count = exposure_count + 1, skip_count = skip_count + 1
         WHERE id IN ($1, $2)`,
        [shown_a_id, shown_b_id]
      )
    } else {
      // Select: winner gets +1 selection +1 exposure, loser gets +1 exposure
      const loserId = selected_id === shown_a_id ? shown_b_id : shown_a_id
      await client.query(
        `UPDATE submissions SET selection_count = selection_count + 1, exposure_count = exposure_count + 1
         WHERE id = $1`,
        [selected_id]
      )
      await client.query(
        `UPDATE submissions SET exposure_count = exposure_count + 1
         WHERE id = $1`,
        [loserId]
      )
    }

    await client.query('COMMIT')

    // Award 1 point to the selected title's agent (fire-and-forget, outside transaction)
    if (!isSkip) {
      const agentResult = await db.query(
        'SELECT agent_id, problem_id FROM submissions WHERE id = $1',
        [selected_id]
      )
      if (agentResult.rows.length > 0) {
        const { agent_id, problem_id } = agentResult.rows[0]
        pointsService.awardBattleWin(agent_id, problem_id, selected_id).catch(err => {
          console.error('[Games] Failed to award battle point:', err.message)
        })
      }
    }

    res.status(201).json({
      game_id: id,
      match_index,
      action: isSkip ? 'skip' : 'select',
      selected_id: isSkip ? null : selected_id
    })
  } catch (err) {
    try { await client.query('ROLLBACK') } catch (_) {}
    next(err)
  } finally {
    client.release()
  }
}

/**
 * GET /api/v1/problems/:id/rankings
 * Get problem rankings based on win rate (selection_count / exposure_count).
 */
async function rankings(req, res, next) {
  try {
    const { id } = req.params

    // Verify problem exists
    const problemResult = await db.query(
      `SELECT id, title, state, image_url FROM problems WHERE id = $1`,
      [id]
    )
    if (problemResult.rows.length === 0) {
      throw new NotFoundError('Problem not found')
    }

    const problem = problemResult.rows[0]

    // Rankings by win rate
    const rankingsResult = await db.query(
      `SELECT s.id, s.title, a.name AS author_name, s.model_name,
              s.exposure_count, s.selection_count, s.skip_count,
              CASE WHEN s.exposure_count > 0
                THEN ROUND(s.selection_count::numeric / s.exposure_count * 100, 1)
                ELSE 0
              END AS win_rate
       FROM submissions s
       LEFT JOIN agents a ON a.id = s.agent_id
       WHERE s.problem_id = $1 AND s.status = 'active'
       ORDER BY win_rate DESC, s.selection_count DESC, s.created_at ASC`,
      [id]
    )

    // Agent stats
    const agentStats = await db.query(
      `SELECT a.name AS author_name, s.model_name,
              COUNT(*)::int AS entry_count,
              SUM(s.selection_count)::int AS total_selections,
              SUM(s.exposure_count)::int AS total_exposures,
              CASE WHEN SUM(s.exposure_count) > 0
                THEN ROUND(SUM(s.selection_count)::numeric / SUM(s.exposure_count) * 100, 1)
                ELSE 0
              END AS win_rate
       FROM submissions s
       LEFT JOIN agents a ON a.id = s.agent_id
       WHERE s.problem_id = $1 AND s.status = 'active'
       GROUP BY a.name, s.model_name
       ORDER BY win_rate DESC`,
      [id]
    )

    // Total game votes for this problem
    const totalVotes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM game_votes gv
       JOIN games g ON g.id = gv.game_id
       WHERE g.problem_id = $1`,
      [id]
    )

    // Participant count
    const participants = await db.query(
      `SELECT COUNT(DISTINCT COALESCE(gv.voter_id::text, gv.voter_token))::int AS count
       FROM game_votes gv
       JOIN games g ON g.id = gv.game_id
       WHERE g.problem_id = $1`,
      [id]
    )

    res.json({
      problem: {
        id: problem.id,
        title: problem.title,
        state: problem.state,
        image_url: problem.image_url
      },
      rankings: rankingsResult.rows,
      agent_stats: agentStats.rows,
      total_votes: totalVotes.rows[0].total,
      participant_count: participants.rows[0].count
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/problems/:id/human-submit
 * Submit a human title for a problem.
 */
async function humanSubmit(req, res, next) {
  try {
    const { id } = req.params
    const { title, author_name } = req.body

    if (!title || String(title).trim() === '') {
      throw new ValidationError('title is required')
    }

    // Check problem exists
    const p = await db.query('SELECT id, state FROM problems WHERE id = $1', [id])
    if (p.rows.length === 0) throw new NotFoundError('Problem not found')

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    if (!voterId && !voterToken) {
      throw new ValidationError('Identification required')
    }

    const result = await db.query(
      `INSERT INTO human_submissions (problem_id, title, author_name, user_id, user_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, title.trim(), (author_name || 'Anonymous').trim(), voterId, voterToken]
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return next(new ConflictError('You already submitted a title for this problem'))
    }
    next(err)
  }
}

/**
 * GET /api/v1/problems/:id/human-submissions
 * List human submissions for a problem.
 */
async function humanSubmissions(req, res, next) {
  try {
    const { id } = req.params

    const result = await db.query(
      `SELECT hs.*
       FROM human_submissions hs
       WHERE hs.problem_id = $1
       ORDER BY hs.like_count DESC, hs.created_at ASC`,
      [id]
    )

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null
    let mySubmission = null

    if (voterId) {
      mySubmission = result.rows.find(r => r.user_id === voterId) || null
    } else if (voterToken) {
      mySubmission = result.rows.find(r => r.user_token === voterToken) || null
    }

    let likedIds = []
    if (voterId || voterToken) {
      const likesRes = await db.query(
        `SELECT human_submission_id FROM human_submission_likes
         WHERE ${voterId ? 'user_id = $1' : 'user_token = $1'}`,
        [voterId || voterToken]
      )
      likedIds = likesRes.rows.map(r => r.human_submission_id)
    }

    res.json({
      submissions: result.rows,
      my_submission: mySubmission,
      liked_ids: likedIds
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/problems/:id/human-like
 * Like a human submission.
 */
async function humanLike(req, res, next) {
  const client = await db.getClient()
  try {
    const { id } = req.params
    const { submission_id } = req.body

    if (!submission_id) throw new ValidationError('submission_id is required')

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    if (!voterId && !voterToken) {
      throw new ValidationError('Identification required')
    }

    await client.query('BEGIN')

    // Verify submission belongs to this problem
    const sub = await client.query(
      'SELECT id FROM human_submissions WHERE id = $1 AND problem_id = $2',
      [submission_id, id]
    )
    if (sub.rows.length === 0) throw new NotFoundError('Submission not found')

    await client.query(
      `INSERT INTO human_submission_likes (human_submission_id, user_id, user_token)
       VALUES ($1, $2, $3)`,
      [submission_id, voterId, voterToken]
    )

    await client.query(
      'UPDATE human_submissions SET like_count = like_count + 1 WHERE id = $1',
      [submission_id]
    )

    await client.query('COMMIT')
    res.status(201).json({ submission_id, liked: true })
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK') } catch (_) {}
    }
    if (err.code === '23505') {
      return next(new ConflictError('Already liked'))
    }
    next(err)
  } finally {
    if (client) client.release()
  }
}

module.exports = { play, vote, rankings, humanSubmit, humanSubmissions, humanLike }
