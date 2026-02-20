// Submission routes
const express = require('express')
const router = express.Router()
const submissionsController = require('../../controllers/v1/submissions')

// Auth middleware is applied at the v1/index.js level per route
// GET /api/v1/submissions - public
router.get('/', submissionsController.list)

// GET /api/v1/submissions/:id - public
router.get('/:id', submissionsController.get)

// POST /api/v1/submissions - agent only (agentAuth at mount)
router.post('/', submissionsController.create)

module.exports = router
