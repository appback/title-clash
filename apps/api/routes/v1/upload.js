// Upload routes: image upload endpoint
const express = require('express')
const router = express.Router()
const { jwtAuth } = require('../../middleware/auth')
const adminAuth = require('../../middleware/adminAuth')
const uploadController = require('../../controllers/v1/upload')

// POST /api/v1/upload/image - Admin only
router.post('/image', jwtAuth, adminAuth, uploadController.uploadImage)

module.exports = router
