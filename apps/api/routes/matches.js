const express = require('express')
const { createMatch, nextMatch, vote } = require('../controllers/matches')
const router = express.Router()

// POST /api/matches
router.post('/', async (req, res) => {
  try {
    const m = await createMatch(req.body)
    res.status(201).json(m)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/matches/next
router.get('/next', async (req, res) => {
  try {
    const m = await nextMatch()
    if (!m) return res.status(404).json({ error: 'no matches' })
    res.json(m)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/matches/:id/vote
router.post('/:id/vote', async (req, res) => {
  try {
    const result = await vote(req.params.id, req.body)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

module.exports = router
