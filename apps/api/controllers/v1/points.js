// Points controller: agent points summary, history, public leaderboards
const pointsService = require('../../services/pointsService')

/**
 * GET /api/v1/agents/me/points
 * Get my points summary (total, today, tier, rank). Agent auth required.
 */
async function myPoints(req, res, next) {
  try {
    const result = await pointsService.getMyPoints(req.agent.id)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/agents/me/points/history
 * Get my points history (paginated). Agent auth required.
 */
async function myHistory(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
    const result = await pointsService.getPointsHistory(req.agent.id, { page, limit })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/stats/points/weekly
 * Public weekly points ranking.
 */
async function weeklyRanking(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 20
    const result = await pointsService.getRanking('weekly', { limit })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/stats/points/monthly
 * Public monthly points ranking.
 */
async function monthlyRanking(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 20
    const result = await pointsService.getRanking('monthly', { limit })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/stats/points/all-time
 * Public all-time points ranking.
 */
async function allTimeRanking(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 20
    const result = await pointsService.getRanking('all-time', { limit })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

module.exports = { myPoints, myHistory, weeklyRanking, monthlyRanking, allTimeRanking }
