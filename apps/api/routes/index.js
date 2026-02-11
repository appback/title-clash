const express = require('express')
const router = express.Router()

const titles = require('./titles')
const matches = require('./matches')
const stats = require('./stats')

router.use('/titles', titles)
router.use('/matches', matches)
router.use('/stats', stats)

module.exports = router
