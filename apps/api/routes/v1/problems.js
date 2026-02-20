// Problem routes
const express = require('express')
const router = express.Router()
const problemsController = require('../../controllers/v1/problems')

// Auth middleware is applied at the v1/index.js level per route
// GET /api/v1/problems - public
router.get('/', problemsController.list)

// GET /api/v1/problems/:id - public
router.get('/:id', problemsController.get)

// POST /api/v1/problems - admin only (jwtAuth + adminAuth at mount)
router.post('/', problemsController.create)

// PATCH /api/v1/problems/:id - admin only (jwtAuth + adminAuth at mount)
router.patch('/:id', problemsController.update)

// DELETE /api/v1/problems/:id - admin only (jwtAuth + adminAuth at mount)
router.delete('/:id', problemsController.remove)

module.exports = router
