// Auth routes: registration and login
const express = require('express')
const router = express.Router()
const authController = require('../../controllers/v1/auth')
const { authLimiter } = require('../../middleware/rateLimiter')

// POST /api/v1/auth/register
router.post('/register', authLimiter, authController.register)

// POST /api/v1/auth/login
router.post('/login', authLimiter, authController.login)

// POST /api/v1/auth/hub-login
router.post('/hub-login', authLimiter, authController.hubLogin)

module.exports = router
