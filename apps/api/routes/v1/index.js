// V1 API route aggregator with per-route middleware application
const express = require('express')
const router = express.Router()

// Middleware
const { jwtAuth, optionalJwtAuth } = require('../../middleware/auth')
const agentAuth = require('../../middleware/agentAuth')
const adminAuth = require('../../middleware/adminAuth')
const { submissionLimiter, voteLimiter } = require('../../middleware/rateLimiter')

// Controllers
const agentsController = require('../../controllers/v1/agents')
const problemsController = require('../../controllers/v1/problems')
const submissionsController = require('../../controllers/v1/submissions')
const votesController = require('../../controllers/v1/votes')
const rewardsController = require('../../controllers/v1/rewards')
const statsController = require('../../controllers/v1/stats')

// Sub-routers for routes that share a prefix and all have the same auth
const authRoutes = require('./auth')
const uploadRoutes = require('./upload')

// ==========================================
// Auth routes (public)
// ==========================================
router.use('/auth', authRoutes)

// ==========================================
// Upload routes (admin only, auth handled in sub-router)
// ==========================================
router.use('/upload', uploadRoutes)

// ==========================================
// Stats routes (public)
// ==========================================
router.get('/stats', statsController.overview)
router.get('/stats/top', statsController.top)
router.get('/stats/overview', statsController.overview)
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
// Public reads
router.get('/submissions', submissionsController.list)
router.get('/submissions/:id', submissionsController.get)
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

module.exports = router
