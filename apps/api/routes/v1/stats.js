// Stats routes - all public
const express = require('express')
const router = express.Router()
const statsController = require('../../controllers/v1/stats')

// GET /api/v1/stats/top - public
router.get('/top', statsController.top)

// GET /api/v1/stats/problems/:id - public
router.get('/problems/:id', statsController.problemStats)

module.exports = router
