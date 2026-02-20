const express = require('express')
const { createTitle, getTitle } = require('../controllers/titles')
const router = express.Router()

// POST /api/titles
router.post('/', async (req, res) => {
  try {
    const result = await createTitle(req.body)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/titles/:id
router.get('/:id', async (req, res) => {
  try {
    const t = await getTitle(req.params.id)
    if (!t) return res.status(404).json({ error: 'not found' })
    res.json(t)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

module.exports = router
