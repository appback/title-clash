// Reward routes
const express = require('express')
const router = express.Router()
const rewardsController = require('../../controllers/v1/rewards')

// GET /api/v1/rewards - admin only (jwtAuth + adminAuth at mount)
router.get('/', rewardsController.list)

// GET /api/v1/rewards/agent/:agentId - admin or owner (jwtAuth at mount)
router.get('/agent/:agentId', rewardsController.getByAgent)

module.exports = router
