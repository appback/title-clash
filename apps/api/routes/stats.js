const express = require('express')
const router = express.Router()

router.get('/top', async (req, res) => {
  // placeholder: return simple stats
  res.json({ top: [] })
})

module.exports = router
