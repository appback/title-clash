// Settings routes (admin only)
const express = require('express')
const router = express.Router()
const { jwtAuth } = require('../../middleware/auth')
const adminAuth = require('../../middleware/adminAuth')
const settingsController = require('../../controllers/v1/settings')

router.get('/', jwtAuth, adminAuth, settingsController.list)
router.put('/', jwtAuth, adminAuth, settingsController.update)
router.post('/refresh', jwtAuth, adminAuth, settingsController.refresh)

module.exports = router
