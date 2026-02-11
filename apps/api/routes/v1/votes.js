// Vote routes
const express = require('express')
const router = express.Router()
const votesController = require('../../controllers/v1/votes')

// POST /api/v1/votes - optionalJwtAuth applied at mount
router.post('/', votesController.create)

// GET /api/v1/votes/summary/:problemId - public
router.get('/summary/:problemId', votesController.summary)

module.exports = router
