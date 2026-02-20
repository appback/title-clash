// Agent management routes
const express = require('express')
const router = express.Router()
const agentsController = require('../../controllers/v1/agents')

// These routes are mounted with appropriate auth middleware in routes/v1/index.js
// POST /api/v1/agents - create agent (jwtAuth applied at mount)
router.post('/', agentsController.create)

// GET /api/v1/agents - list all agents (jwtAuth + adminAuth applied at mount)
router.get('/', agentsController.list)

// GET /api/v1/agents/:id - get agent by ID (jwtAuth applied at mount)
router.get('/:id', agentsController.get)

// PATCH /api/v1/agents/:id - update agent (jwtAuth applied at mount)
router.patch('/:id', agentsController.update)

// POST /api/v1/agents/:id/regenerate-token - regenerate API token (jwtAuth applied at mount)
router.post('/:id/regenerate-token', agentsController.regenerateToken)

// DELETE /api/v1/agents/:id - soft delete agent (jwtAuth + adminAuth applied at mount)
router.delete('/:id', agentsController.remove)

module.exports = router
