// TitleClash - Express API server
// Entrypoint for API during development/tests

const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const routes = require('./routes')
const v1Routes = require('./routes/v1')
const auth = require('./middleware/auth')
const errorHandler = require('./middleware/errorHandler')
const { startScheduler } = require('./services/scheduler')

const app = express()
app.use(bodyParser.json())
app.use(cookieParser())
app.use(auth)

// Static file serving for local uploads (STORAGE_MODE=local)
if (process.env.STORAGE_MODE === 'local' || !process.env.STORAGE_MODE) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
}

// Mount legacy API routes under /api (backward compatible)
app.use('/api', routes)

// Mount v1 API routes under /api/v1
app.use('/api/v1', v1Routes)

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// Global error handler (must be after all routes)
app.use(errorHandler)

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log('TitleClash API listening on', port)
  // Start scheduler (production/development only, not in test)
  if (process.env.NODE_ENV !== 'test') {
    startScheduler()
  }
})

module.exports = app
