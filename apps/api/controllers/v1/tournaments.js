// Tournament controller: CRUD, random matchup voting, results
const db = require('../../db')
const { parsePagination, formatPaginatedResponse } = require('../../utils/pagination')
const { ValidationError, NotFoundError, AppError, ConflictError } = require('../../utils/errors')

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
// Start tournament: set phase to playing (no bracket needed)
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
      'SELECT * FROM tournament_entries WHERE tournament_id = $1',
      [id]
    )

    if (entries.rows.length < 2) {
      throw new ValidationError('Need at least 2 entries to start a tournament')
    }

    await client.query('BEGIN')

    // Update phase to playing (no bracket generation needed)
    await client.query(
      `UPDATE tournaments SET phase = 'playing', updated_at = NOW() WHERE id = $1`,
      [id]
    )

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
// Play: generate random matchups (ephemeral, no DB storage)
// ==========================================
async function play(req, res, next) {
  try {
    const { id } = req.params

    // Get tournament with problem info
    const tResult = await db.query(
      `SELECT t.*, p.title AS problem_title, p.image_url AS problem_image_url
       FROM tournaments t
       LEFT JOIN problems p ON p.id = t.problem_id
       WHERE t.id = $1`,
      [id]
    )
    if (tResult.rows.length === 0) throw new NotFoundError('Tournament not found')
    const tournament = tResult.rows[0]

    // Get all entries
    const entries = await db.query(
      `SELECT id, title, author_name, model_name, source, total_votes_received
       FROM tournament_entries
       WHERE tournament_id = $1
       ORDER BY RANDOM()`,
      [id]
    )

    if (entries.rows.length < 2) {
      throw new AppError(422, 'NOT_ENOUGH_ENTRIES', 'Need at least 2 entries to play')
    }

    // Shuffle is already done by ORDER BY RANDOM()
    // Make count even by dropping last if odd
    const shuffled = entries.rows
    const count = shuffled.length % 2 === 0 ? shuffled.length : shuffled.length - 1

    // Pair up: [0,1], [2,3], [4,5], ...
    const matches = []
    for (let i = 0; i < count; i += 2) {
      matches.push({
        entry_a: {
          id: shuffled[i].id,
          title: shuffled[i].title,
          author_name: shuffled[i].author_name,
          model_name: shuffled[i].model_name,
          source: shuffled[i].source
        },
        entry_b: {
          id: shuffled[i + 1].id,
          title: shuffled[i + 1].title,
          author_name: shuffled[i + 1].author_name,
          model_name: shuffled[i + 1].model_name,
          source: shuffled[i + 1].source
        }
      })
    }

    res.json({
      tournament: {
        id: tournament.id,
        title: tournament.title,
        problem_title: tournament.problem_title,
        problem_image_url: tournament.problem_image_url
      },
      matches,
      total_entries: entries.rows.length
    })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Vote on an entry (random matchup - no match_id needed)
// ==========================================
async function vote(req, res, next) {
  const client = await db.getClient()
  try {
    const { id } = req.params
    const { entry_id } = req.body

    if (!entry_id) {
      throw new ValidationError('entry_id is required')
    }

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    if (!voterId && !voterToken) {
      throw new ValidationError('Voter identification required')
    }

    await client.query('BEGIN')

    // Verify entry belongs to this tournament
    const entryResult = await client.query(
      'SELECT id, total_votes_received FROM tournament_entries WHERE id = $1 AND tournament_id = $2',
      [entry_id, id]
    )
    if (entryResult.rows.length === 0) {
      throw new NotFoundError('Entry not found in this tournament')
    }

    // Update entry total votes
    const updated = await client.query(
      `UPDATE tournament_entries
       SET total_votes_received = total_votes_received + 1
       WHERE id = $1
       RETURNING total_votes_received`,
      [entry_id]
    )

    // Insert vote record (match_id is NULL for random matchups)
    await client.query(
      `INSERT INTO tournament_votes (match_id, entry_id, voter_id, voter_token)
       VALUES (NULL, $1, $2, $3)`,
      [entry_id, voterId, voterToken]
    )

    // Update tournament participant count
    await client.query(
      `UPDATE tournaments SET participant_count = (
        SELECT COUNT(DISTINCT COALESCE(voter_id::text, voter_token))
        FROM tournament_votes tv
        WHERE tv.entry_id IN (
          SELECT te.id FROM tournament_entries te WHERE te.tournament_id = $1
        )
      ), updated_at = NOW() WHERE id = $1`,
      [id]
    )

    await client.query('COMMIT')

    res.status(201).json({
      entry_id,
      total_votes: updated.rows[0].total_votes_received
    })
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
// Complete a match (legacy - no longer used with random matchups)
// ==========================================
async function completeMatch(req, res, next) {
  next(new AppError(410, 'DEPRECATED', 'Match completion is not used with random matchups'))
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
// Get results + statistics (vote-based rankings)
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

    // Rankings by total_votes_received
    const rankings = await db.query(
      `SELECT id, title, author_name, model_name, source, total_votes_received
       FROM tournament_entries
       WHERE tournament_id = $1
       ORDER BY total_votes_received DESC, created_at ASC`,
      [id]
    )

    // Agent stats (grouped by model)
    const agentStats = await db.query(
      `SELECT author_name, model_name,
              COUNT(*)::int AS entry_count,
              SUM(total_votes_received)::int AS total_votes,
              MAX(total_votes_received)::int AS best_score
       FROM tournament_entries
       WHERE tournament_id = $1
       GROUP BY author_name, model_name
       ORDER BY total_votes DESC`,
      [id]
    )

    // Total votes
    const totalVotes = await db.query(
      `SELECT COALESCE(SUM(total_votes_received), 0)::int AS total
       FROM tournament_entries
       WHERE tournament_id = $1`,
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

module.exports = { list, get, create, start, play, vote, completeMatch, getBracket, results, humanSubmit, humanSubmissions, humanLike }
