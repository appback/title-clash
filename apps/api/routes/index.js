const express = require('express')
const router = express.Router()

const titles = require('./titles')
const matches = require('./matches')
const stats = require('./stats')

// Legacy routes with deprecation headers
router.use('/titles', (req, res, next) => {
  res.set('Deprecation', 'true')
  res.set('Sunset', 'Sat, 01 Aug 2026 00:00:00 GMT')
  res.set('Link', '</api/v1/submissions>; rel="successor-version"')
  next()
}, titles)

router.use('/matches', (req, res, next) => {
  res.set('Deprecation', 'true')
  res.set('Sunset', 'Sat, 01 Aug 2026 00:00:00 GMT')
  res.set('Link', '</api/v1/problems>; rel="successor-version"')
  next()
}, matches)

router.use('/stats', (req, res, next) => {
  res.set('Deprecation', 'true')
  res.set('Sunset', 'Sat, 01 Aug 2026 00:00:00 GMT')
  res.set('Link', '</api/v1/stats>; rel="successor-version"')
  next()
}, stats)

module.exports = router
