// Activity controller: admin-only human activity history
const db = require('../../db')

/**
 * GET /api/v1/activity/admin
 * List all human activities (game_votes, battle_votes, human_submissions, title_ratings)
 * Includes both guest (token) and logged-in (user_id) activities.
 * Query: page, limit, type (all/game_vote/image_battle/human_vs_ai/human_submission/title_rating), identity (search by token or user email)
 */
async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const offset = (page - 1) * limit
    const type = req.query.type || 'all'
    const identity = req.query.identity || null

    const validTypes = ['all', 'game_vote', 'image_battle', 'human_vs_ai', 'human_submission', 'title_rating']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid type filter' })
    }

    const params = []
    let paramIdx = 0

    // Identity filter: matches voter_token, user_token, or user email (partial)
    let identityParam = null
    if (identity) {
      identityParam = `$${++paramIdx}`
      params.push(identity)
    }

    // For each table, COALESCE token/user info into a single identity column
    const gvIdentityFilter = identity
      ? `AND (gv.voter_token = ${identityParam} OR u.email ILIKE '%' || ${identityParam} || '%')`
      : ''
    const bvIdentityFilter = identity
      ? `AND (bv.voter_token = ${identityParam} OR u.email ILIKE '%' || ${identityParam} || '%')`
      : ''
    const hsIdentityFilter = identity
      ? `AND (hs.user_token = ${identityParam} OR u.email ILIKE '%' || ${identityParam} || '%')`
      : ''
    const trIdentityFilter = identity
      ? `AND (tr.voter_token = ${identityParam} OR u.email ILIKE '%' || ${identityParam} || '%')`
      : ''

    const unions = []
    const countUnions = []

    function addUnion(activityType, sql, countSql) {
      if (type === 'all' || type === activityType) {
        unions.push(sql)
        countUnions.push(countSql)
      }
    }

    addUnion('game_vote',
      `SELECT gv.created_at,
              COALESCE(gv.voter_token, u.email, gv.voter_id::text) AS identity,
              CASE WHEN gv.voter_token IS NOT NULL THEN 'guest' ELSE 'user' END AS identity_type,
              'game_vote' AS activity_type,
              json_build_object('action', gv.action, 'match_index', gv.match_index) AS detail,
              gv.game_id AS reference_id
       FROM game_votes gv
       LEFT JOIN users u ON u.id = gv.voter_id
       WHERE (gv.voter_token IS NOT NULL OR gv.voter_id IS NOT NULL) ${gvIdentityFilter}`,
      `SELECT COUNT(*)::int FROM game_votes gv LEFT JOIN users u ON u.id = gv.voter_id
       WHERE (gv.voter_token IS NOT NULL OR gv.voter_id IS NOT NULL) ${gvIdentityFilter}`
    )

    addUnion('image_battle',
      `SELECT bv.created_at,
              COALESCE(bv.voter_token, u.email, bv.voter_id::text) AS identity,
              CASE WHEN bv.voter_token IS NOT NULL THEN 'guest' ELSE 'user' END AS identity_type,
              'image_battle' AS activity_type,
              json_build_object('winner_type', bv.winner_type) AS detail,
              bv.id AS reference_id
       FROM battle_votes bv
       LEFT JOIN users u ON u.id = bv.voter_id
       WHERE bv.mode = 'image_battle' AND (bv.voter_token IS NOT NULL OR bv.voter_id IS NOT NULL) ${bvIdentityFilter}`,
      `SELECT COUNT(*)::int FROM battle_votes bv LEFT JOIN users u ON u.id = bv.voter_id
       WHERE bv.mode = 'image_battle' AND (bv.voter_token IS NOT NULL OR bv.voter_id IS NOT NULL) ${bvIdentityFilter}`
    )

    addUnion('human_vs_ai',
      `SELECT bv.created_at,
              COALESCE(bv.voter_token, u.email, bv.voter_id::text) AS identity,
              CASE WHEN bv.voter_token IS NOT NULL THEN 'guest' ELSE 'user' END AS identity_type,
              'human_vs_ai' AS activity_type,
              json_build_object('winner_type', bv.winner_type) AS detail,
              bv.id AS reference_id
       FROM battle_votes bv
       LEFT JOIN users u ON u.id = bv.voter_id
       WHERE bv.mode = 'human_vs_ai' AND (bv.voter_token IS NOT NULL OR bv.voter_id IS NOT NULL) ${bvIdentityFilter}`,
      `SELECT COUNT(*)::int FROM battle_votes bv LEFT JOIN users u ON u.id = bv.voter_id
       WHERE bv.mode = 'human_vs_ai' AND (bv.voter_token IS NOT NULL OR bv.voter_id IS NOT NULL) ${bvIdentityFilter}`
    )

    addUnion('human_submission',
      `SELECT hs.created_at,
              COALESCE(hs.user_token, u.email, hs.user_id::text) AS identity,
              CASE WHEN hs.user_token IS NOT NULL THEN 'guest' ELSE 'user' END AS identity_type,
              'human_submission' AS activity_type,
              json_build_object('title', hs.title) AS detail,
              hs.id AS reference_id
       FROM human_submissions hs
       LEFT JOIN users u ON u.id = hs.user_id
       WHERE (hs.user_token IS NOT NULL OR hs.user_id IS NOT NULL) ${hsIdentityFilter}`,
      `SELECT COUNT(*)::int FROM human_submissions hs LEFT JOIN users u ON u.id = hs.user_id
       WHERE (hs.user_token IS NOT NULL OR hs.user_id IS NOT NULL) ${hsIdentityFilter}`
    )

    addUnion('title_rating',
      `SELECT tr.created_at,
              COALESCE(tr.voter_token, u.email, tr.voter_id::text) AS identity,
              CASE WHEN tr.voter_token IS NOT NULL THEN 'guest' ELSE 'user' END AS identity_type,
              'title_rating' AS activity_type,
              json_build_object('stars', tr.stars) AS detail,
              tr.submission_id AS reference_id
       FROM title_ratings tr
       LEFT JOIN users u ON u.id = tr.voter_id
       WHERE (tr.voter_token IS NOT NULL OR tr.voter_id IS NOT NULL) ${trIdentityFilter}`,
      `SELECT COUNT(*)::int FROM title_ratings tr LEFT JOIN users u ON u.id = tr.voter_id
       WHERE (tr.voter_token IS NOT NULL OR tr.voter_id IS NOT NULL) ${trIdentityFilter}`
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
    const countParams = identity ? [identity] : []

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
 * Per-identity activity summary: total activities, last activity, type counts, game completion rate
 * Includes both guest and logged-in users.
 */
async function summary(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const offset = (page - 1) * limit

    const result = await db.query(`
      WITH all_activity AS (
        SELECT COALESCE(gv.voter_token, u.email, gv.voter_id::text) AS identity,
               CASE WHEN gv.voter_token IS NOT NULL THEN 'guest' ELSE 'user' END AS identity_type,
               'game_vote' AS activity_type, gv.created_at
        FROM game_votes gv LEFT JOIN users u ON u.id = gv.voter_id
        WHERE gv.voter_token IS NOT NULL OR gv.voter_id IS NOT NULL
        UNION ALL
        SELECT COALESCE(bv.voter_token, u.email, bv.voter_id::text),
               CASE WHEN bv.voter_token IS NOT NULL THEN 'guest' ELSE 'user' END,
               bv.mode, bv.created_at
        FROM battle_votes bv LEFT JOIN users u ON u.id = bv.voter_id
        WHERE bv.voter_token IS NOT NULL OR bv.voter_id IS NOT NULL
        UNION ALL
        SELECT COALESCE(hs.user_token, u.email, hs.user_id::text),
               CASE WHEN hs.user_token IS NOT NULL THEN 'guest' ELSE 'user' END,
               'human_submission', hs.created_at
        FROM human_submissions hs LEFT JOIN users u ON u.id = hs.user_id
        WHERE hs.user_token IS NOT NULL OR hs.user_id IS NOT NULL
        UNION ALL
        SELECT COALESCE(tr.voter_token, u.email, tr.voter_id::text),
               CASE WHEN tr.voter_token IS NOT NULL THEN 'guest' ELSE 'user' END,
               'title_rating', tr.created_at
        FROM title_ratings tr LEFT JOIN users u ON u.id = tr.voter_id
        WHERE tr.voter_token IS NOT NULL OR tr.voter_id IS NOT NULL
      ),
      identity_stats AS (
        SELECT
          identity,
          (array_agg(DISTINCT identity_type))[1] AS identity_type,
          COUNT(*)::int AS total_activities,
          MAX(created_at) AS last_activity,
          COUNT(*) FILTER (WHERE activity_type = 'game_vote')::int AS game_votes,
          COUNT(*) FILTER (WHERE activity_type = 'image_battle')::int AS image_battles,
          COUNT(*) FILTER (WHERE activity_type = 'human_vs_ai')::int AS human_vs_ai,
          COUNT(*) FILTER (WHERE activity_type = 'human_submission')::int AS human_submissions,
          COUNT(*) FILTER (WHERE activity_type = 'title_rating')::int AS title_ratings
        FROM all_activity
        GROUP BY identity
      ),
      game_completion AS (
        SELECT
          COALESCE(gv.voter_token, u.email, gv.voter_id::text) AS identity,
          COUNT(DISTINCT gv.game_id)::int AS games_started,
          COUNT(DISTINCT gv.game_id) FILTER (
            WHERE (SELECT COUNT(*) FROM game_votes gv2 WHERE gv2.game_id = gv.game_id
                    AND COALESCE(gv2.voter_token, gv2.voter_id::text) = COALESCE(gv.voter_token, gv.voter_id::text))
                  >= (SELECT jsonb_array_length(g.matches) FROM games g WHERE g.id = gv.game_id)
          )::int AS games_completed
        FROM game_votes gv
        LEFT JOIN users u ON u.id = gv.voter_id
        WHERE gv.voter_token IS NOT NULL OR gv.voter_id IS NOT NULL
        GROUP BY COALESCE(gv.voter_token, u.email, gv.voter_id::text)
      )
      SELECT
        ist.*,
        COALESCE(gc.games_started, 0) AS games_started,
        COALESCE(gc.games_completed, 0) AS games_completed
      FROM identity_stats ist
      LEFT JOIN game_completion gc ON gc.identity = ist.identity
      ORDER BY ist.last_activity DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset])

    const countResult = await db.query(`
      SELECT COUNT(DISTINCT identity)::int AS total FROM (
        SELECT COALESCE(voter_token, voter_id::text) AS identity FROM game_votes WHERE voter_token IS NOT NULL OR voter_id IS NOT NULL
        UNION
        SELECT COALESCE(voter_token, voter_id::text) FROM battle_votes WHERE voter_token IS NOT NULL OR voter_id IS NOT NULL
        UNION
        SELECT COALESCE(user_token, user_id::text) FROM human_submissions WHERE user_token IS NOT NULL OR user_id IS NOT NULL
        UNION
        SELECT COALESCE(voter_token, voter_id::text) FROM title_ratings WHERE voter_token IS NOT NULL OR voter_id IS NOT NULL
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
