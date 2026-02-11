// Auth routes: registration and login
const express = require('express')
const router = express.Router()
const authController = require('../../controllers/v1/auth')

// POST /api/v1/auth/register
router.post('/register', authController.register)

// POST /api/v1/auth/login
router.post('/login', authController.login)

module.exports = router
