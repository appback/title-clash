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
const tournamentsController = require('../../controllers/v1/tournaments')
const battlesController = require('../../controllers/v1/battles')
const curateController = require('../../controllers/v1/curate')

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
// Tournaments
// ==========================================
// Public reads
router.get('/tournaments', tournamentsController.list)
router.get('/tournaments/:id', tournamentsController.get)
router.get('/tournaments/:id/play', optionalJwtAuth, tournamentsController.play)
router.get('/tournaments/:id/current-match', optionalJwtAuth, tournamentsController.play) // legacy compat
router.get('/tournaments/:id/bracket', tournamentsController.getBracket)
router.get('/tournaments/:id/results', tournamentsController.results)
// Public voting (optional auth for voter tracking)
router.post('/tournaments/:id/vote', optionalJwtAuth, tournamentsController.vote)
// Admin: create, start, complete match
router.post('/tournaments', jwtAuth, adminAuth, tournamentsController.create)
router.post('/tournaments/:id/start', jwtAuth, adminAuth, tournamentsController.start)
router.post('/tournaments/:id/matches/:matchId/complete', jwtAuth, adminAuth, tournamentsController.completeMatch)
// Human participation (optional auth for voter tracking)
router.get('/tournaments/:id/human-submissions', optionalJwtAuth, tournamentsController.humanSubmissions)
router.post('/tournaments/:id/human-submit', optionalJwtAuth, tournamentsController.humanSubmit)
router.post('/tournaments/:id/human-like', optionalJwtAuth, tournamentsController.humanLike)

// ==========================================
// Agent curation (agent auth + curator permission)
// ==========================================
router.post('/curate', agentAuth, curateLimiter, curateController.create)

// ==========================================
// Battle modes (public, optional auth for voter tracking)
// ==========================================
router.get('/battle/image/play', optionalJwtAuth, battlesController.imageBattlePlay)
router.post('/battle/image/vote', optionalJwtAuth, battlesController.imageBattleVote)
router.get('/battle/human-vs-ai/play', optionalJwtAuth, battlesController.humanVsAiPlay)
router.post('/battle/human-vs-ai/vote', optionalJwtAuth, battlesController.humanVsAiVote)
router.get('/battle/human-vs-ai/stats', battlesController.humanVsAiStats)

module.exports = router
