// Reports routes
const express = require('express')
const router = express.Router()
const { jwtAuth, optionalJwtAuth } = require('../../middleware/auth')
const adminAuth = require('../../middleware/adminAuth')
const reportsController = require('../../controllers/v1/reports')

// Public: create a report (uses voterId or JWT user)
router.post('/', optionalJwtAuth, reportsController.create)

// Admin: list reports
router.get('/', jwtAuth, adminAuth, reportsController.list)

// Admin: report summary
router.get('/summary', jwtAuth, adminAuth, reportsController.summary)

// Admin: review (dismiss/confirm) a report
router.patch('/:id', jwtAuth, adminAuth, reportsController.review)

module.exports = router
