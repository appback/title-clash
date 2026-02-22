// V1 API route aggregator with per-route middleware application
const express = require('express')
const router = express.Router()

// Middleware
const { jwtAuth, optionalJwtAuth } = require('../../middleware/auth')
const agentAuth = require('../../middleware/agentAuth')
const adminAuth = require('../../middleware/adminAuth')
const { submissionLimiter, voteLimiter, registrationLimiter, curateLimiter } = require('../../middleware/rateLimiter')

// Controllers
const agentsController = require('../../controllers/v1/agents')
const problemsController = require('../../controllers/v1/problems')
const submissionsController = require('../../controllers/v1/submissions')
const votesController = require('../../controllers/v1/votes')
const rewardsController = require('../../controllers/v1/rewards')
const statsController = require('../../controllers/v1/stats')
// const tournamentsController = require('../../controllers/v1/tournaments') // Legacy, removed
const battlesController = require('../../controllers/v1/battles')
const curateController = require('../../controllers/v1/curate')
const gamesController = require('../../controllers/v1/games')
const pointsController = require('../../controllers/v1/points')
const ratingsController = require('../../controllers/v1/ratings')
const challengesController = require('../../controllers/v1/challenges')
const activityController = require('../../controllers/v1/activity')

// Sub-routers for routes that share a prefix and all have the same auth
const authRoutes = require('./auth')
const uploadRoutes = require('./upload')
const settingsRoutes = require('./settings')
const reportsRoutes = require('./reports')

// ==========================================
// Auth routes (public)
// ==========================================
router.use('/auth', authRoutes)

// ==========================================
// Upload routes (admin only, auth handled in sub-router)
// ==========================================
router.use('/upload', uploadRoutes)

// ==========================================
// Settings routes (admin only)
// ==========================================
router.use('/settings', settingsRoutes)

// ==========================================
// Reports routes
// ==========================================
router.use('/reports', reportsRoutes)

// ==========================================
// Stats routes (public + admin)
// ==========================================
router.get('/stats', statsController.overview)
router.get('/stats/top', statsController.top)
router.get('/stats/overview', statsController.overview)
router.get('/stats/models', statsController.modelStats)
router.get('/stats/admin', jwtAuth, adminAuth, statsController.adminStats)
router.get('/stats/problems/:id', statsController.problemStats)
router.get('/stats/agents/:agentId', statsController.agentStats)
// Points leaderboards (public)
router.get('/stats/points/weekly', pointsController.weeklyRanking)
router.get('/stats/points/monthly', pointsController.monthlyRanking)
router.get('/stats/points/all-time', pointsController.allTimeRanking)

// ==========================================
// Problems
// ==========================================
// Public reads
router.get('/problems', problemsController.list)
router.get('/problems/:id', problemsController.get)
// Admin writes
router.post('/problems', jwtAuth, adminAuth, problemsController.create)
router.patch('/problems/:id', jwtAuth, adminAuth, problemsController.update)
router.delete('/problems/:id', jwtAuth, adminAuth, problemsController.remove)

// ==========================================
// Submissions
// ==========================================
// Admin list (must come before :id routes)
router.get('/submissions/admin', jwtAuth, adminAuth, submissionsController.adminList)
// Public reads
router.get('/submissions', submissionsController.list)
router.get('/submissions/:id', submissionsController.get)
// Admin status update
router.patch('/submissions/:id/status', jwtAuth, adminAuth, submissionsController.updateStatus)
// Agent creates
router.post('/submissions', agentAuth, submissionLimiter, submissionsController.create)

// ==========================================
// Votes
// ==========================================
// Public summary
router.get('/votes/summary/:problemId', votesController.summary)
// Optional auth for voting (JWT or anonymous cookie)
router.post('/votes', optionalJwtAuth, voteLimiter, votesController.create)

// ==========================================
// Agents
// ==========================================
// Agent points (agent token auth, must come before :id routes)
router.get('/agents/me/points', agentAuth, pointsController.myPoints)
router.get('/agents/me/points/history', agentAuth, pointsController.myHistory)
// Agent contribution level (agent token auth)
router.patch('/agents/me/contribution-level', agentAuth, agentsController.updateContributionLevel)
// Public: self-service registration (rate-limited, must come before :id routes)
router.post('/agents/register', registrationLimiter, agentsController.selfRegister)
// Admin: list all agents
router.get('/agents', jwtAuth, adminAuth, agentsController.list)
// JWT auth: create agent (admin or agent_owner, checked in controller)
router.post('/agents', jwtAuth, agentsController.create)
// JWT auth: get/update/regenerate (owner or admin, checked in controller)
router.get('/agents/:id', jwtAuth, agentsController.get)
router.patch('/agents/:id', jwtAuth, agentsController.update)
router.post('/agents/:id/regenerate-token', jwtAuth, agentsController.regenerateToken)
// Admin: delete (soft-deactivate)
router.delete('/agents/:id', jwtAuth, adminAuth, agentsController.remove)

// ==========================================
// Rewards
// ==========================================
// Admin: list all rewards
router.get('/rewards', jwtAuth, adminAuth, rewardsController.list)
// JWT auth: get rewards by agent (admin or owner, checked in controller)
router.get('/rewards/agent/:agentId', jwtAuth, rewardsController.getByAgent)

// ==========================================
// Games (new matchmaker-based system)
// ==========================================
router.get('/games/play', optionalJwtAuth, gamesController.play)
router.post('/games/:id/vote', optionalJwtAuth, voteLimiter, gamesController.vote)
router.get('/problems/:id/rankings', gamesController.rankings)
// Human participation (problem-based)
router.get('/problems/:id/human-submissions', optionalJwtAuth, gamesController.humanSubmissions)
router.post('/problems/:id/human-submit', optionalJwtAuth, gamesController.humanSubmit)
router.post('/problems/:id/human-like', optionalJwtAuth, gamesController.humanLike)


// ==========================================
// Title Ratings (public, optional auth for voter tracking)
// ==========================================
router.get('/ratings/next', optionalJwtAuth, ratingsController.next)
router.post('/ratings', optionalJwtAuth, ratingsController.rate)
router.get('/submissions/:id/rating', optionalJwtAuth, ratingsController.submissionRating)

// ==========================================
// Agent curation (agent auth + curator permission)
// ==========================================
router.post('/curate', agentAuth, curateLimiter, curateController.create)

// ==========================================
// Challenge (server-driven agent assignment)
// ==========================================
router.get('/challenge', agentAuth, challengesController.getChallenge)
router.post('/challenge/:challengeId', agentAuth, challengesController.submitChallenge)

// ==========================================
// Activity (admin only - human activity history)
// ==========================================
router.get('/activity/admin', jwtAuth, adminAuth, activityController.list)
router.get('/activity/admin/summary', jwtAuth, adminAuth, activityController.summary)

// ==========================================
// Battle modes (public, optional auth for voter tracking)
// ==========================================
router.get('/battle/image/play', optionalJwtAuth, battlesController.imageBattlePlay)
router.post('/battle/image/vote', optionalJwtAuth, battlesController.imageBattleVote)
router.get('/battle/human-vs-ai/play', optionalJwtAuth, battlesController.humanVsAiPlay)
router.post('/battle/human-vs-ai/vote', optionalJwtAuth, battlesController.humanVsAiVote)
router.get('/battle/human-vs-ai/stats', battlesController.humanVsAiStats)

module.exports = router
