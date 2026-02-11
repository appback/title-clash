// TitleClash - Express API server
// Entrypoint for API during development/tests

const express = require('express')
const path = require('path')
const helmet = require('helmet')
const corsMiddleware = require('./middleware/corsConfig')
const { globalLimiter } = require('./middleware/rateLimiter')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const routes = require('./routes')
const v1Routes = require('./routes/v1')
const auth = require('./middleware/auth')
const errorHandler = require('./middleware/errorHandler')
const { startScheduler } = require('./services/scheduler')

const app = express()

// 1. Security headers (highest priority)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}))

// 2. CORS (including preflight)
app.use(corsMiddleware)

// 3. Global rate limiting
app.use(globalLimiter)

// 4. Body parsing
app.use(bodyParser.json({ limit: '1mb' }))
app.use(cookieParser())

// 5. Auth (cookie + JWT parsing)
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

// Only listen when not in test mode (supertest manages the server in tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log('TitleClash API listening on', port)
    startScheduler()
  })
}

module.exports = app
