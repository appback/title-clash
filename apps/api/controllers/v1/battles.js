// Battles controller: Image Battle (mode 2) and Human vs AI (mode 3)
const db = require('../../db')

// ==========================================
// Mode 2: Image Battle — play
// GET /api/v1/battle/image/play
// Returns 8 matches of AI submissions from different problems
// ==========================================
async function imageBattlePlay(req, res, next) {
  try {
    // Get random active submissions with their problem image_url (different problems)
    const result = await db.query(
      `SELECT s.id AS submission_id, s.title, a.name AS author_name,
              s.model_name, p.image_url
       FROM submissions s
       JOIN agents a ON a.id = s.agent_id
       JOIN problems p ON p.id = s.problem_id
       WHERE s.status = 'active' AND p.image_url IS NOT NULL
       ORDER BY RANDOM()
       LIMIT 16`
    )

    const entries = result.rows
    const matches = []

    // Pair them into matches, ensuring different problems where possible
    for (let i = 0; i + 1 < entries.length && matches.length < 8; i += 2) {
      matches.push({
        entry_a: entries[i],
        entry_b: entries[i + 1]
      })
    }

    res.json({ matches })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Mode 2: Image Battle — vote
// POST /api/v1/battle/image/vote
// ==========================================
async function imageBattleVote(req, res, next) {
  try {
    const { winner_id, loser_id } = req.body
    if (!winner_id || !loser_id) {
      return res.status(400).json({ error: 'winner_id and loser_id are required' })
    }

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    await db.query(
      `INSERT INTO battle_votes (mode, winner_id, winner_type, loser_id, loser_type, voter_id, voter_token)
       VALUES ('image_battle', $1, 'ai', $2, 'ai', $3, $4)`,
      [winner_id, loser_id, voterId, voterToken]
    )

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Mode 3: Human vs AI — play
// GET /api/v1/battle/human-vs-ai/play
// ==========================================
async function humanVsAiPlay(req, res, next) {
  try {
    // Check if human_submissions exist
    const countResult = await db.query('SELECT COUNT(*)::int AS cnt FROM human_submissions')
    if (countResult.rows[0].cnt === 0) {
      return res.json({ available: false, matches: [] })
    }

    // Get random human submissions with their tournament's problem image
    const humanResult = await db.query(
      `SELECT hs.id, hs.title, hs.author_name,
              p.image_url
       FROM human_submissions hs
       JOIN tournaments t ON t.id = hs.tournament_id
       JOIN problems p ON p.id = t.problem_id
       WHERE p.image_url IS NOT NULL
       ORDER BY RANDOM()
       LIMIT 8`
    )

    if (humanResult.rows.length === 0) {
      return res.json({ available: false, matches: [] })
    }

    // Get random AI submissions
    const aiResult = await db.query(
      `SELECT s.id AS submission_id, s.title, a.name AS author_name,
              s.model_name, p.image_url
       FROM submissions s
       JOIN agents a ON a.id = s.agent_id
       JOIN problems p ON p.id = s.problem_id
       WHERE s.status = 'active' AND p.image_url IS NOT NULL
       ORDER BY RANDOM()
       LIMIT $1`,
      [humanResult.rows.length]
    )

    const matches = []
    const limit = Math.min(humanResult.rows.length, aiResult.rows.length)
    for (let i = 0; i < limit; i++) {
      matches.push({
        human: humanResult.rows[i],
        ai: aiResult.rows[i]
      })
    }

    res.json({ available: true, matches })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Mode 3: Human vs AI — vote
// POST /api/v1/battle/human-vs-ai/vote
// ==========================================
async function humanVsAiVote(req, res, next) {
  try {
    const { winner_id, winner_type, loser_id, loser_type } = req.body
    if (!winner_id || !winner_type || !loser_id || !loser_type) {
      return res.status(400).json({ error: 'winner_id, winner_type, loser_id, loser_type are required' })
    }

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    await db.query(
      `INSERT INTO battle_votes (mode, winner_id, winner_type, loser_id, loser_type, voter_id, voter_token)
       VALUES ('human_vs_ai', $1, $2, $3, $4, $5, $6)`,
      [winner_id, winner_type, loser_id, loser_type, voterId, voterToken]
    )

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// ==========================================
// Mode 3: Human vs AI — stats
// GET /api/v1/battle/human-vs-ai/stats
// ==========================================
async function humanVsAiStats(req, res, next) {
  try {
    const result = await db.query(
      `SELECT
         COUNT(*)::int AS total_battles,
         COUNT(*) FILTER (WHERE winner_type = 'ai')::int AS ai_wins,
         COUNT(*) FILTER (WHERE winner_type = 'human')::int AS human_wins
       FROM battle_votes
       WHERE mode = 'human_vs_ai'`
    )

    const { total_battles, ai_wins, human_wins } = result.rows[0]
    const ai_win_rate = total_battles > 0 ? Math.round((ai_wins / total_battles) * 100) : 0

    let message
    if (total_battles === 0) {
      message = 'no_data'
    } else if (ai_win_rate >= 70) {
      message = 'ai_dominant'
    } else if (ai_win_rate >= 50) {
      message = 'ai_ahead'
    } else if (ai_win_rate >= 30) {
      message = 'human_ahead'
    } else {
      message = 'human_dominant'
    }

    res.json({ total_battles, ai_wins, human_wins, ai_win_rate, message })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  imageBattlePlay,
  imageBattleVote,
  humanVsAiPlay,
  humanVsAiVote,
  humanVsAiStats
}
