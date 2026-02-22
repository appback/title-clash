// Activity controller: admin-only human activity history
const db = require('../../db')

/**
 * GET /api/v1/activity/admin
 * List all human activities (game_votes, battle_votes, human_submissions, title_ratings)
 * Query: page, limit, type (all/game_vote/image_battle/human_vs_ai/human_submission/title_rating), guest_token
 */
async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const offset = (page - 1) * limit
    const type = req.query.type || 'all'
    const guestToken = req.query.guest_token || null

    const validTypes = ['all', 'game_vote', 'image_battle', 'human_vs_ai', 'human_submission', 'title_rating']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid type filter' })
    }

    // Build UNION ALL parts based on type filter
    const unions = []
    const countUnions = []
    const params = []
    let paramIdx = 0

    function addUnion(activityType, sql, countSql) {
      if (type === 'all' || type === activityType) {
        unions.push(sql)
        countUnions.push(countSql)
      }
    }

    // Guest token filter clause
    const gvTokenFilter = guestToken ? `AND gv.voter_token = $${++paramIdx}` : ''
    const bvTokenFilter = guestToken ? `AND bv.voter_token = $${paramIdx || ++paramIdx}` : ''
    const hsTokenFilter = guestToken ? `AND hs.user_token = $${paramIdx || ++paramIdx}` : ''
    const trTokenFilter = guestToken ? `AND tr.voter_token = $${paramIdx || ++paramIdx}` : ''

    if (guestToken) {
      params.push(guestToken)
    }

    addUnion('game_vote',
      `SELECT gv.created_at, gv.voter_token AS guest_token, 'game_vote' AS activity_type,
              json_build_object('action', gv.action, 'match_index', gv.match_index) AS detail,
              gv.game_id AS reference_id
       FROM game_votes gv
       WHERE gv.voter_token IS NOT NULL ${gvTokenFilter}`,
      `SELECT COUNT(*)::int FROM game_votes gv WHERE gv.voter_token IS NOT NULL ${gvTokenFilter}`
    )

    addUnion('image_battle',
      `SELECT bv.created_at, bv.voter_token AS guest_token, 'image_battle' AS activity_type,
              json_build_object('winner_type', bv.winner_type) AS detail,
              bv.id AS reference_id
       FROM battle_votes bv
       WHERE bv.mode = 'image_battle' AND bv.voter_token IS NOT NULL ${bvTokenFilter}`,
      `SELECT COUNT(*)::int FROM battle_votes bv WHERE bv.mode = 'image_battle' AND bv.voter_token IS NOT NULL ${bvTokenFilter}`
    )

    addUnion('human_vs_ai',
      `SELECT bv.created_at, bv.voter_token AS guest_token, 'human_vs_ai' AS activity_type,
              json_build_object('winner_type', bv.winner_type) AS detail,
              bv.id AS reference_id
       FROM battle_votes bv
       WHERE bv.mode = 'human_vs_ai' AND bv.voter_token IS NOT NULL ${bvTokenFilter}`,
      `SELECT COUNT(*)::int FROM battle_votes bv WHERE bv.mode = 'human_vs_ai' AND bv.voter_token IS NOT NULL ${bvTokenFilter}`
    )

    addUnion('human_submission',
      `SELECT hs.created_at, hs.user_token AS guest_token, 'human_submission' AS activity_type,
              json_build_object('title', hs.title) AS detail,
              hs.id AS reference_id
       FROM human_submissions hs
       WHERE hs.user_token IS NOT NULL ${hsTokenFilter}`,
      `SELECT COUNT(*)::int FROM human_submissions hs WHERE hs.user_token IS NOT NULL ${hsTokenFilter}`
    )

    addUnion('title_rating',
      `SELECT tr.created_at, tr.voter_token AS guest_token, 'title_rating' AS activity_type,
              json_build_object('stars', tr.stars) AS detail,
              tr.submission_id AS reference_id
       FROM title_ratings tr
       WHERE tr.voter_token IS NOT NULL ${trTokenFilter}`,
      `SELECT COUNT(*)::int FROM title_ratings tr WHERE tr.voter_token IS NOT NULL ${trTokenFilter}`
    )

    if (unions.length === 0) {
      return res.json({ data: [], pagination: { page, limit, total: 0 } })
    }

    const dataQuery = `
      SELECT * FROM (${unions.join(' UNION ALL ')}) AS activities
      ORDER BY created_at DESC
      LIMIT $${++paramIdx} OFFSET $${++paramIdx}
    `
    params.push(limit, offset)

    const countQuery = `SELECT (${countUnions.map(c => `(${c})`).join(' + ')}) AS total`
    // Count query uses only the guest_token param (if any)
    const countParams = guestToken ? [guestToken] : []

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, params),
      db.query(countQuery, countParams)
    ])

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total
      }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/activity/admin/summary
 * Per-guest activity summary: total activities, last activity, type counts, game completion rate
 */
async function summary(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const offset = (page - 1) * limit

    const result = await db.query(`
      WITH all_activity AS (
        SELECT voter_token AS guest_token, 'game_vote' AS activity_type, created_at
        FROM game_votes WHERE voter_token IS NOT NULL
        UNION ALL
        SELECT voter_token, mode, created_at
        FROM battle_votes WHERE voter_token IS NOT NULL
        UNION ALL
        SELECT user_token, 'human_submission', created_at
        FROM human_submissions WHERE user_token IS NOT NULL
        UNION ALL
        SELECT voter_token, 'title_rating', created_at
        FROM title_ratings WHERE voter_token IS NOT NULL
      ),
      guest_stats AS (
        SELECT
          guest_token,
          COUNT(*)::int AS total_activities,
          MAX(created_at) AS last_activity,
          COUNT(*) FILTER (WHERE activity_type = 'game_vote')::int AS game_votes,
          COUNT(*) FILTER (WHERE activity_type = 'image_battle')::int AS image_battles,
          COUNT(*) FILTER (WHERE activity_type = 'human_vs_ai')::int AS human_vs_ai,
          COUNT(*) FILTER (WHERE activity_type = 'human_submission')::int AS human_submissions,
          COUNT(*) FILTER (WHERE activity_type = 'title_rating')::int AS title_ratings
        FROM all_activity
        GROUP BY guest_token
      ),
      game_completion AS (
        SELECT
          gv.voter_token AS guest_token,
          COUNT(DISTINCT gv.game_id)::int AS games_started,
          COUNT(DISTINCT gv.game_id) FILTER (
            WHERE (SELECT COUNT(*) FROM game_votes gv2 WHERE gv2.game_id = gv.game_id AND gv2.voter_token = gv.voter_token)
                  >= (SELECT jsonb_array_length(g.matches) FROM games g WHERE g.id = gv.game_id)
          )::int AS games_completed
        FROM game_votes gv
        WHERE gv.voter_token IS NOT NULL
        GROUP BY gv.voter_token
      )
      SELECT
        gs.*,
        COALESCE(gc.games_started, 0) AS games_started,
        COALESCE(gc.games_completed, 0) AS games_completed
      FROM guest_stats gs
      LEFT JOIN game_completion gc ON gc.guest_token = gs.guest_token
      ORDER BY gs.last_activity DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset])

    const countResult = await db.query(`
      SELECT COUNT(DISTINCT guest_token)::int AS total FROM (
        SELECT voter_token AS guest_token FROM game_votes WHERE voter_token IS NOT NULL
        UNION
        SELECT voter_token FROM battle_votes WHERE voter_token IS NOT NULL
        UNION
        SELECT user_token FROM human_submissions WHERE user_token IS NOT NULL
        UNION
        SELECT voter_token FROM title_ratings WHERE voter_token IS NOT NULL
      ) t
    `)

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { list, summary }
