// Tournament controller: CRUD, bracket, voting, results
const db = require('../../db')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError, AppError, ConflictError } = require('../../utils/errors')
const bracket = require('../../services/bracket')

// ==========================================
// List tournaments
// ==========================================
async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { content_type, phase } = req.query

    let where = 'WHERE 1=1'
    const params = []
    let idx = 1

    if (content_type) {
      where += ` AND t.content_type = $${idx++}`
      params.push(content_type)
    }
    if (phase) {
      where += ` AND t.phase = $${idx++}`
      params.push(phase)
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM tournaments t ${where}`, params
    )
    const total = parseInt(countResult.rows[0].count, 10)

    const result = await db.query(
      `SELECT t.*,
              p.title AS problem_title, p.image_url AS problem_image_url,
              (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = t.id) AS entry_count
       FROM tournaments t
       LEFT JOIN problems p ON p.id = t.problem_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    )

    res.json(formatPaginatedResponse(result.rows, total, page, limit))
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Get tournament detail with bracket
// ==========================================
async function get(req, res, next) {
  try {
    const { id } = req.params

    const result = await db.query(
      `SELECT t.*,
              p.title AS problem_title, p.image_url AS problem_image_url, p.description AS problem_description
       FROM tournaments t
       LEFT JOIN problems p ON p.id = t.problem_id
       WHERE t.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      throw new NotFoundError('Tournament not found')
    }

    const tournament = result.rows[0]

    // Get entries
    const entries = await db.query(
      `SELECT * FROM tournament_entries
       WHERE tournament_id = $1
       ORDER BY seed ASC NULLS LAST`,
      [id]
    )
    tournament.entries = entries.rows

    // Get match count by status
    const matchStats = await db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM tournament_matches WHERE tournament_id = $1
       GROUP BY status`,
      [id]
    )
    tournament.match_stats = {}
    matchStats.rows.forEach(r => { tournament.match_stats[r.status] = r.count })

    res.json(tournament)
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Create tournament (admin)
// ==========================================
async function create(req, res, next) {
  const client = await db.getClient()
  try {
    const { title, description, content_type, problem_id } = req.body

    if (!title || String(title).trim() === '') {
      throw new ValidationError('title is required')
    }

    const validTypes = ['title_battle', 'image_battle', 'versus_battle']
    if (content_type && !validTypes.includes(content_type)) {
      throw new ValidationError('Invalid content_type')
    }

    const type = content_type || 'title_battle'

    // For title_battle, problem_id is required
    if (type === 'title_battle' && !problem_id) {
      throw new ValidationError('problem_id is required for title_battle')
    }

    await client.query('BEGIN')

    // Create tournament
    const result = await client.query(
      `INSERT INTO tournaments (title, description, content_type, problem_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title.trim(), description || null, type, problem_id || null, req.user.userId]
    )
    const tournament = result.rows[0]

    // For title_battle: auto-import submissions from problem
    if (type === 'title_battle' && problem_id) {
      const subs = await client.query(
        `SELECT s.id, s.title, a.name AS agent_name, s.model_name
         FROM submissions s
         LEFT JOIN agents a ON a.id = s.agent_id
         WHERE s.problem_id = $1 AND s.status = 'active'
         ORDER BY RANDOM()`,
        [problem_id]
      )

      for (let i = 0; i < subs.rows.length; i++) {
        const s = subs.rows[i]
        await client.query(
          `INSERT INTO tournament_entries
           (tournament_id, submission_id, source, title, author_name, model_name, seed)
           VALUES ($1, $2, 'ai', $3, $4, $5, $6)`,
          [tournament.id, s.id, s.title, s.agent_name || 'Unknown', s.model_name, i + 1]
        )
      }

      tournament.entry_count = subs.rows.length
    }

    await client.query('COMMIT')
    res.status(201).json(tournament)
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
}

// ==========================================
// Start tournament: generate bracket, activate first round
// ==========================================
async function start(req, res, next) {
  const client = await db.getClient()
  try {
    const { id } = req.params

    const result = await client.query(
      'SELECT * FROM tournaments WHERE id = $1 FOR UPDATE',
      [id]
    )
    if (result.rows.length === 0) throw new NotFoundError('Tournament not found')

    const tournament = result.rows[0]

    if (tournament.phase !== 'draft' && tournament.phase !== 'ready') {
      throw new AppError(422, 'INVALID_PHASE', `Cannot start tournament in phase: ${tournament.phase}`)
    }

    // Get entries
    const entries = await client.query(
      'SELECT * FROM tournament_entries WHERE tournament_id = $1 ORDER BY seed ASC',
      [id]
    )

    if (entries.rows.length < 2) {
      throw new ValidationError('Need at least 2 entries to start a tournament')
    }

    await client.query('BEGIN')

    // Generate bracket
    await bracket.generateBracket(id, entries.rows)

    // Update phase
    await client.query(
      `UPDATE tournaments SET phase = 'playing', current_round = 1, updated_at = NOW() WHERE id = $1`,
      [id]
    )

    // Activate first round matches
    await bracket.activateFirstRound(id)

    await client.query('COMMIT')

    // Return updated tournament
    const updated = await db.query('SELECT * FROM tournaments WHERE id = $1', [id])
    res.json(updated.rows[0])
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK') } catch (_) {}
    }
    next(err)
  } finally {
    if (client) client.release()
  }
}

// ==========================================
// Get current match for a user
// ==========================================
async function currentMatch(req, res, next) {
  try {
    const { id } = req.params
    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    // Find the first active match that this user hasn't voted on
    let query = `
      SELECT m.*,
             ea.title AS entry_a_title, ea.author_name AS entry_a_author, ea.model_name AS entry_a_model,
             ea.image_url AS entry_a_image, ea.source AS entry_a_source,
             eb.title AS entry_b_title, eb.author_name AS entry_b_author, eb.model_name AS entry_b_model,
             eb.image_url AS entry_b_image, eb.source AS entry_b_source
      FROM tournament_matches m
      LEFT JOIN tournament_entries ea ON ea.id = m.entry_a_id
      LEFT JOIN tournament_entries eb ON eb.id = m.entry_b_id
      WHERE m.tournament_id = $1
        AND m.status = 'active'
        AND m.entry_a_id IS NOT NULL
        AND m.entry_b_id IS NOT NULL`

    const params = [id]

    // Exclude matches already voted
    if (voterId) {
      query += ` AND NOT EXISTS (
        SELECT 1 FROM tournament_votes tv WHERE tv.match_id = m.id AND tv.voter_id = $2
      )`
      params.push(voterId)
    } else if (voterToken) {
      query += ` AND NOT EXISTS (
        SELECT 1 FROM tournament_votes tv WHERE tv.match_id = m.id AND tv.voter_token = $2
      )`
      params.push(voterToken)
    }

    query += ' ORDER BY m.match_order ASC LIMIT 1'

    const result = await db.query(query, params)

    if (result.rows.length === 0) {
      // Check if tournament is still playing
      const t = await db.query('SELECT phase FROM tournaments WHERE id = $1', [id])
      if (t.rows.length === 0) throw new NotFoundError('Tournament not found')

      return res.json({ match: null, status: t.rows[0].phase === 'playing' ? 'waiting' : 'completed' })
    }

    // Get progress info
    const progress = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'active')::int AS active,
         COUNT(*)::int AS total
       FROM tournament_matches WHERE tournament_id = $1`,
      [id]
    )

    res.json({
      match: result.rows[0],
      progress: progress.rows[0],
      status: 'playing'
    })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Vote on a match
// ==========================================
async function vote(req, res, next) {
  const client = await db.getClient()
  try {
    const { id } = req.params
    const { match_id, entry_id } = req.body

    if (!match_id || !entry_id) {
      throw new ValidationError('match_id and entry_id are required')
    }

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    if (!voterId && !voterToken) {
      throw new ValidationError('Voter identification required')
    }

    await client.query('BEGIN')

    // Verify match belongs to tournament and is active
    const matchResult = await client.query(
      'SELECT * FROM tournament_matches WHERE id = $1 AND tournament_id = $2 FOR UPDATE',
      [match_id, id]
    )
    if (matchResult.rows.length === 0) {
      throw new NotFoundError('Match not found in this tournament')
    }

    const match = matchResult.rows[0]
    if (match.status !== 'active') {
      throw new AppError(422, 'MATCH_NOT_ACTIVE', 'This match is not active')
    }

    // Verify entry is part of this match
    if (entry_id !== match.entry_a_id && entry_id !== match.entry_b_id) {
      throw new ValidationError('Entry is not part of this match')
    }

    // Check duplicate vote
    if (voterId) {
      const dup = await client.query(
        'SELECT id FROM tournament_votes WHERE match_id = $1 AND voter_id = $2',
        [match_id, voterId]
      )
      if (dup.rows.length > 0) throw new ConflictError('Already voted on this match')
    } else {
      const dup = await client.query(
        'SELECT id FROM tournament_votes WHERE match_id = $1 AND voter_token = $2',
        [match_id, voterToken]
      )
      if (dup.rows.length > 0) throw new ConflictError('Already voted on this match')
    }

    // Insert vote
    await client.query(
      `INSERT INTO tournament_votes (match_id, entry_id, voter_id, voter_token)
       VALUES ($1, $2, $3, $4)`,
      [match_id, entry_id, voterId, voterToken]
    )

    // Update vote counts on match
    const voteField = entry_id === match.entry_a_id ? 'vote_count_a' : 'vote_count_b'
    await client.query(
      `UPDATE tournament_matches SET ${voteField} = ${voteField} + 1 WHERE id = $1`,
      [match_id]
    )

    // Update entry total votes
    await client.query(
      'UPDATE tournament_entries SET total_votes_received = total_votes_received + 1 WHERE id = $1',
      [entry_id]
    )

    // Update tournament participant count
    await client.query(
      `UPDATE tournaments SET participant_count = (
        SELECT COUNT(DISTINCT COALESCE(voter_id::text, voter_token))
        FROM tournament_votes tv
        JOIN tournament_matches tm ON tm.id = tv.match_id
        WHERE tm.tournament_id = $1
      ), updated_at = NOW() WHERE id = $1`,
      [id]
    )

    await client.query('COMMIT')

    // Return updated match vote counts
    const updated = await db.query(
      'SELECT vote_count_a, vote_count_b FROM tournament_matches WHERE id = $1',
      [match_id]
    )

    const vcA = updated.rows[0].vote_count_a
    const vcB = updated.rows[0].vote_count_b

    // Auto-advance: if total votes reach threshold, complete match and advance winner
    const AUTO_ADVANCE_THRESHOLD = 3
    if (vcA + vcB >= AUTO_ADVANCE_THRESHOLD && match.status === 'active') {
      try {
        const winnerId = vcA >= vcB ? match.entry_a_id : match.entry_b_id
        await bracket.advanceWinner(match_id, winnerId)
      } catch (_) {
        // Non-critical: auto-advance failed, admin can manually complete
      }
    }

    res.status(201).json({
      match_id,
      entry_id,
      vote_count_a: vcA,
      vote_count_b: vcB
    })
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK') } catch (_) {}
    }
    if (err.code === '23505') {
      return next(new ConflictError('Already voted on this match'))
    }
    next(err)
  } finally {
    if (client) client.release()
  }
}

// ==========================================
// Complete a match (determine winner based on votes)
// Called by admin or automatically
// ==========================================
async function completeMatch(req, res, next) {
  try {
    const { id, matchId } = req.params

    const matchResult = await db.query(
      'SELECT * FROM tournament_matches WHERE id = $1 AND tournament_id = $2',
      [matchId, id]
    )
    if (matchResult.rows.length === 0) {
      throw new NotFoundError('Match not found')
    }

    const match = matchResult.rows[0]
    if (match.status !== 'active') {
      throw new AppError(422, 'MATCH_NOT_ACTIVE', 'Match is not active')
    }

    // Determine winner
    let winnerId
    if (match.vote_count_a > match.vote_count_b) {
      winnerId = match.entry_a_id
    } else if (match.vote_count_b > match.vote_count_a) {
      winnerId = match.entry_b_id
    } else {
      // Tie: pick entry_a (higher seed advantage)
      winnerId = match.entry_a_id
    }

    await bracket.advanceWinner(matchId, winnerId)

    const updated = await db.query(
      'SELECT * FROM tournament_matches WHERE id = $1',
      [matchId]
    )

    res.json(updated.rows[0])
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Get full bracket
// ==========================================
async function getBracket(req, res, next) {
  try {
    const { id } = req.params

    const matches = await db.query(
      `SELECT m.*,
              ea.title AS entry_a_title, ea.author_name AS entry_a_author, ea.model_name AS entry_a_model,
              ea.source AS entry_a_source, ea.image_url AS entry_a_image,
              eb.title AS entry_b_title, eb.author_name AS entry_b_author, eb.model_name AS entry_b_model,
              eb.source AS entry_b_source, eb.image_url AS entry_b_image,
              ew.title AS winner_title, ew.author_name AS winner_author
       FROM tournament_matches m
       LEFT JOIN tournament_entries ea ON ea.id = m.entry_a_id
       LEFT JOIN tournament_entries eb ON eb.id = m.entry_b_id
       LEFT JOIN tournament_entries ew ON ew.id = m.winner_id
       WHERE m.tournament_id = $1
       ORDER BY m.created_at ASC, m.match_order ASC`,
      [id]
    )

    // Group by round
    const rounds = {}
    matches.rows.forEach(m => {
      if (!rounds[m.round]) rounds[m.round] = []
      rounds[m.round].push(m)
    })

    res.json({ tournament_id: id, rounds })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Get results + statistics
// ==========================================
async function results(req, res, next) {
  try {
    const { id } = req.params

    const tournament = await db.query(
      `SELECT t.*, p.title AS problem_title, p.image_url AS problem_image_url
       FROM tournaments t
       LEFT JOIN problems p ON p.id = t.problem_id
       WHERE t.id = $1`,
      [id]
    )
    if (tournament.rows.length === 0) throw new NotFoundError('Tournament not found')

    // Rankings
    const rankings = await db.query(
      `SELECT e.*, e.total_votes_received,
              (SELECT COUNT(*) FROM tournament_matches
               WHERE (winner_id = e.id)) AS wins,
              (SELECT COUNT(*) FROM tournament_matches
               WHERE (entry_a_id = e.id OR entry_b_id = e.id) AND winner_id IS NOT NULL AND winner_id != e.id) AS losses
       FROM tournament_entries e
       WHERE e.tournament_id = $1
       ORDER BY e.final_rank ASC NULLS LAST, e.total_votes_received DESC`,
      [id]
    )

    // Agent stats
    const agentStats = await db.query(
      `SELECT e.author_name, e.model_name,
              COUNT(*) FILTER (WHERE m.winner_id = e.id)::int AS wins,
              COUNT(*) FILTER (WHERE m.winner_id IS NOT NULL AND m.winner_id != e.id)::int AS losses,
              SUM(CASE WHEN e.id = m.entry_a_id THEN m.vote_count_a ELSE m.vote_count_b END)::int AS total_votes
       FROM tournament_entries e
       JOIN tournament_matches m ON (m.entry_a_id = e.id OR m.entry_b_id = e.id)
       WHERE e.tournament_id = $1 AND m.status = 'completed'
       GROUP BY e.author_name, e.model_name
       ORDER BY wins DESC`,
      [id]
    )

    // Total votes
    const totalVotes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM tournament_votes tv
       JOIN tournament_matches tm ON tm.id = tv.match_id
       WHERE tm.tournament_id = $1`,
      [id]
    )

    res.json({
      tournament: tournament.rows[0],
      rankings: rankings.rows,
      agent_stats: agentStats.rows,
      total_votes: totalVotes.rows[0].total,
      participant_count: tournament.rows[0].participant_count
    })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Human submission: submit a title
// ==========================================
async function humanSubmit(req, res, next) {
  try {
    const { id } = req.params
    const { title, author_name } = req.body

    if (!title || String(title).trim() === '') {
      throw new ValidationError('title is required')
    }

    // Check tournament exists
    const t = await db.query('SELECT * FROM tournaments WHERE id = $1', [id])
    if (t.rows.length === 0) throw new NotFoundError('Tournament not found')

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    if (!voterId && !voterToken) {
      throw new ValidationError('Identification required')
    }

    const result = await db.query(
      `INSERT INTO human_submissions (tournament_id, title, author_name, user_id, user_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, title.trim(), (author_name || 'Anonymous').trim(), voterId, voterToken]
    )

    // Auto-open human submissions on first submit
    if (!t.rows[0].human_submissions_open) {
      await db.query('UPDATE tournaments SET human_submissions_open = true WHERE id = $1', [id])
    }

    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return next(new ConflictError('You already submitted a title for this battle'))
    }
    next(err)
  }
}

// ==========================================
// Human submissions: list
// ==========================================
async function humanSubmissions(req, res, next) {
  try {
    const { id } = req.params

    const result = await db.query(
      `SELECT hs.*
       FROM human_submissions hs
       WHERE hs.tournament_id = $1
       ORDER BY hs.like_count DESC, hs.created_at ASC`,
      [id]
    )

    // Check if current user already submitted
    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null
    let mySubmission = null

    if (voterId) {
      mySubmission = result.rows.find(r => r.user_id === voterId) || null
    } else if (voterToken) {
      mySubmission = result.rows.find(r => r.user_token === voterToken) || null
    }

    // Check which ones current user liked
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

// ==========================================
// Human like
// ==========================================
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

    // Verify submission belongs to this tournament
    const sub = await client.query(
      'SELECT id FROM human_submissions WHERE id = $1 AND tournament_id = $2',
      [submission_id, id]
    )
    if (sub.rows.length === 0) throw new NotFoundError('Submission not found')

    // Insert like
    await client.query(
      `INSERT INTO human_submission_likes (human_submission_id, user_id, user_token)
       VALUES ($1, $2, $3)`,
      [submission_id, voterId, voterToken]
    )

    // Increment like count
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

module.exports = { list, get, create, start, currentMatch, vote, completeMatch, getBracket, results, humanSubmit, humanSubmissions, humanLike }
