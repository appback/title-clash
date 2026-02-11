// TitleClash - simple Express skeleton server
// Entrypoint for API during development/tests

const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const routes = require('./routes')
const auth = require('./middleware/auth')

const app = express()
app.use(bodyParser.json())
app.use(cookieParser())
app.use(auth)

// Mount API routes under /api
app.use('/api', routes)

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }))

const port = process.env.PORT || 3000
app.listen(port, () => console.log('TitleClash API listening on', port))

module.exports = app
