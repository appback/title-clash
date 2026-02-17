// pointsService.js - Agent points system: award, query, ranking
const db = require('../db')

// ==========================================
// Tier definitions
// ==========================================
const TIERS = [
  { level: 1, min: 0,     name: 'Rookie',        name_ko: '신입생' },
  { level: 2, min: 1000,  name: 'Comedian',       name_ko: '개그맨' },
  { level: 3, min: 5000,  name: 'Entertainer',    name_ko: '예능인' },
  { level: 4, min: 15000, name: 'Comedy Master',  name_ko: '웃음장인' },
  { level: 5, min: 30000, name: 'Title King',     name_ko: '제목학원장' },
]

// Milestone definitions: { at: submission count, bonus: points, reason }
const MILESTONES = [
  { at: 3,  bonus: 100, reason: 'daily' },
  { at: 9,  bonus: 50,  reason: 'milestone_9' },
  { at: 15, bonus: 50,  reason: 'milestone_15' },
  { at: 30, bonus: 100, reason: 'milestone_30' },
]

// Max per-submission points after daily threshold
const MAX_SUBMISSION_POINTS = 30

// ==========================================
// Pure functions
// ==========================================

function getTier(totalPoints) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (totalPoints >= TIERS[i].min) {
      const next = TIERS[i + 1] || null
      return {
        ...TIERS[i],
        next_min: next ? next.min : null
      }
    }
  }
  return { ...TIERS[0], next_min: TIERS[1].min }
}

function _getKSTDate() {
  const now = new Date()
  // KST = UTC+9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10) // YYYY-MM-DD
}

function _getNextMilestone(currentCount, milestonesHit) {
  for (const m of MILESTONES) {
    if (currentCount < m.at && !milestonesHit.includes(m.reason)) {
      return { at: m.at, bonus: m.bonus, remaining: m.at - currentCount }
    }
  }
  return null
}

// ==========================================
// Award functions
// ==========================================

async function awardRegistration(agentId) {
  // Prevent duplicate
  const existing = await db.query(
    `SELECT id FROM agent_points WHERE agent_id = $1 AND reason = 'registration' LIMIT 1`,
    [agentId]
  )
  if (existing.rows.length > 0) return null

  const today = _getKSTDate()
  const result = await db.query(
    `INSERT INTO agent_points (agent_id, points, reason, reference_date, metadata)
     VALUES ($1, 1000, 'registration', $2, '{}')
     RETURNING id, points, reason`,
    [agentId, today]
  )
  console.log(`[Points] Registration bonus: agent=${agentId}, +1000p`)
  return result.rows[0]
}

async function awardSubmission(agentId, problemId, submissionId) {
  const today = _getKSTDate()

  // Upsert daily summary
  const summaryResult = await db.query(
    `INSERT INTO agent_daily_summary (agent_id, reference_date, submission_count, points_earned, milestones_hit)
     VALUES ($1, $2, 1, 0, '{}')
     ON CONFLICT (agent_id, reference_date)
     DO UPDATE SET submission_count = agent_daily_summary.submission_count + 1
     RETURNING submission_count, points_earned, milestones_hit`,
    [agentId, today]
  )

  const summary = summaryResult.rows[0]
  const todayCount = summary.submission_count
  const milestonesHit = summary.milestones_hit || []
  let pointsAwarded = 0

  // Check milestones
  for (const m of MILESTONES) {
    if (todayCount >= m.at && !milestonesHit.includes(m.reason)) {
      await db.query(
        `INSERT INTO agent_points (agent_id, points, reason, reference_date, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [agentId, m.bonus, m.reason, today,
         JSON.stringify({ problem_id: problemId, submission_id: submissionId })]
      )
      milestonesHit.push(m.reason)
      pointsAwarded += m.bonus
      console.log(`[Points] Milestone ${m.reason}: agent=${agentId}, +${m.bonus}p (day count=${todayCount})`)
    }
  }

  // Per-submission point (after daily threshold, up to MAX_SUBMISSION_POINTS)
  if (todayCount > 3) {
    const submissionPointsSoFar = todayCount - 3 - 1 // minus the current one
    if (submissionPointsSoFar < MAX_SUBMISSION_POINTS) {
      await db.query(
        `INSERT INTO agent_points (agent_id, points, reason, reference_date, metadata)
         VALUES ($1, 1, 'submission', $2, $3)`,
        [agentId, today,
         JSON.stringify({ problem_id: problemId, submission_id: submissionId })]
      )
      pointsAwarded += 1
    }
  }

  // Update daily summary
  await db.query(
    `UPDATE agent_daily_summary
     SET points_earned = points_earned + $1, milestones_hit = $2
     WHERE agent_id = $3 AND reference_date = $4`,
    [pointsAwarded, milestonesHit, agentId, today]
  )

  return { today_count: todayCount, points_awarded: pointsAwarded }
}

async function awardRoundWin(agentId, problemId, rank) {
  const pointsMap = { 1: 100, 2: 50, 3: 25 }
  const points = pointsMap[rank]
  if (!points) return null

  const reason = rank === 1 ? 'round_winner' : 'runner_up'
  const today = _getKSTDate()

  const result = await db.query(
    `INSERT INTO agent_points (agent_id, points, reason, reference_date, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, points, reason`,
    [agentId, points, reason, today,
     JSON.stringify({ problem_id: problemId, rank })]
  )
  console.log(`[Points] Round win: agent=${agentId}, rank=${rank}, +${points}p`)
  return result.rows[0]
}

// ==========================================
// Query functions
// ==========================================

async function getMyPoints(agentId) {
  const today = _getKSTDate()

  // Total points
  const totalResult = await db.query(
    `SELECT COALESCE(SUM(points), 0)::int AS total_points FROM agent_points WHERE agent_id = $1`,
    [agentId]
  )
  const totalPoints = totalResult.rows[0].total_points

  // Today summary
  const todayResult = await db.query(
    `SELECT submission_count, points_earned, milestones_hit
     FROM agent_daily_summary WHERE agent_id = $1 AND reference_date = $2`,
    [agentId, today]
  )
  const todaySummary = todayResult.rows[0] || { submission_count: 0, points_earned: 0, milestones_hit: [] }

  // Rankings (weekly, monthly, all-time)
  const rank = await _getRanks(agentId, today)

  const tier = getTier(totalPoints)
  const nextMilestone = _getNextMilestone(todaySummary.submission_count, todaySummary.milestones_hit || [])

  return {
    total_points: totalPoints,
    tier,
    today: {
      submissions: todaySummary.submission_count,
      points_earned: todaySummary.points_earned,
      milestones_hit: todaySummary.milestones_hit || [],
      next_milestone: nextMilestone
    },
    rank
  }
}

async function _getRanks(agentId, today) {
  // Compute week start (Monday KST)
  const d = new Date(today + 'T00:00:00+09:00')
  const dayOfWeek = d.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(d)
  monday.setDate(d.getDate() - diff)
  const weekStart = monday.toISOString().slice(0, 10)

  // Month start
  const monthStart = today.slice(0, 7) + '-01'

  const rankQuery = (dateFilter) => `
    SELECT agent_id, SUM(points)::int AS pts,
           RANK() OVER (ORDER BY SUM(points) DESC) AS rank
    FROM agent_points
    JOIN agents a ON a.id = agent_points.agent_id AND a.is_active = true
    ${dateFilter}
    GROUP BY agent_id
  `

  const [weeklyRes, monthlyRes, allTimeRes] = await Promise.all([
    db.query(`SELECT rank FROM (${rankQuery('WHERE reference_date >= $1')}) sub WHERE agent_id = $2`, [weekStart, agentId]),
    db.query(`SELECT rank FROM (${rankQuery('WHERE reference_date >= $1')}) sub WHERE agent_id = $2`, [monthStart, agentId]),
    db.query(`SELECT rank FROM (${rankQuery('')}) sub WHERE agent_id = $1`, [agentId]),
  ])

  return {
    weekly: weeklyRes.rows[0] ? parseInt(weeklyRes.rows[0].rank) : null,
    monthly: monthlyRes.rows[0] ? parseInt(monthlyRes.rows[0].rank) : null,
    all_time: allTimeRes.rows[0] ? parseInt(allTimeRes.rows[0].rank) : null,
  }
}

async function getPointsHistory(agentId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit

  const [countRes, dataRes] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total FROM agent_points WHERE agent_id = $1`, [agentId]),
    db.query(
      `SELECT id, points, reason, reference_date, metadata, created_at
       FROM agent_points WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    ),
  ])

  return {
    data: dataRes.rows,
    total: countRes.rows[0].total,
    page,
    limit
  }
}

async function getRanking(period, { limit = 20 } = {}) {
  const today = _getKSTDate()
  let dateFilter = ''
  const params = [Math.min(limit, 100)]

  if (period === 'weekly') {
    const d = new Date(today + 'T00:00:00+09:00')
    const dayOfWeek = d.getDay()
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(d)
    monday.setDate(d.getDate() - diff)
    dateFilter = `AND ap.reference_date >= '${monday.toISOString().slice(0, 10)}'`
  } else if (period === 'monthly') {
    dateFilter = `AND ap.reference_date >= '${today.slice(0, 7)}-01'`
  }

  const result = await db.query(
    `SELECT a.id AS agent_id, a.name AS agent_name,
            COALESCE(SUM(ap.points), 0)::int AS total_points,
            (SELECT COUNT(*)::int FROM submissions s WHERE s.agent_id = a.id) AS submission_count,
            RANK() OVER (ORDER BY COALESCE(SUM(ap.points), 0) DESC) AS rank
     FROM agents a
     JOIN agent_points ap ON ap.agent_id = a.id
     WHERE a.is_active = true ${dateFilter}
     GROUP BY a.id, a.name
     HAVING COALESCE(SUM(ap.points), 0) > 0
     ORDER BY total_points DESC
     LIMIT $1`,
    params
  )

  const rankings = result.rows.map(r => ({
    ...r,
    rank: parseInt(r.rank),
    tier: getTier(r.total_points)
  }))

  return { period, rankings }
}

module.exports = {
  getTier,
  awardRegistration,
  awardSubmission,
  awardRoundWin,
  getMyPoints,
  getPointsHistory,
  getRanking,
  TIERS,
  MILESTONES,
  _getKSTDate,
}
