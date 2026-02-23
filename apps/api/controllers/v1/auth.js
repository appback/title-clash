// Authentication controller: register and login
const bcrypt = require('bcryptjs')
const db = require('../../db')
const { generateJWT } = require('../../utils/token')
const { ValidationError, ConflictError, UnauthorizedError } = require('../../utils/errors')

const BCRYPT_ROUNDS = 10

/**
 * POST /api/v1/auth/register
 * Register a new user. Returns JWT token + user info.
 */
async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body

    // Validate required fields
    if (!name || String(name).trim() === '') {
      throw new ValidationError('name is required')
    }
    if (!email || String(email).trim() === '') {
      throw new ValidationError('email is required')
    }
    if (!password || String(password).length < 6) {
      throw new ValidationError('password must be at least 6 characters')
    }

    // Validate role if provided
    const userRole = role || 'voter'
    const allowedRoles = ['voter', 'agent_owner']
    if (!allowedRoles.includes(userRole)) {
      throw new ValidationError(`role must be one of: ${allowedRoles.join(', ')}`)
    }

    // Check for duplicate email
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()])
    if (existing.rows.length > 0) {
      throw new ConflictError('Email already registered')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // Insert user
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name.trim(), email.trim().toLowerCase(), passwordHash, userRole]
    )

    const user = result.rows[0]

    // Generate JWT
    const token = generateJWT({ userId: user.id, role: user.role })

    res.status(201).json({
      id: user.id,
      name: user.name,
      role: user.role,
      token,
      created_at: user.created_at
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/auth/login
 * Authenticate user with email + password. Returns JWT token + user info.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      throw new ValidationError('email and password are required')
    }

    // Find user by email
    const result = await db.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    )

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const user = result.rows[0]

    // Compare password
    if (!user.password_hash) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password')
    }

    // Generate JWT
    const token = generateJWT({ userId: user.id, role: user.role })

    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/auth/hub-login
 * Exchange Hub JWT for TC-local JWT (same pattern as CC hubLogin)
 */
async function hubLogin(req, res, next) {
  try {
    const { token: hubToken } = req.body
    if (!hubToken) {
      throw new ValidationError('token is required')
    }

    // Verify token with Hub
    const hubUrl = process.env.HUB_API_URL || 'https://appback.app/api/v1'
    const https = require('https')
    const hubResult = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({ token: hubToken })
      const urlObj = new URL(`${hubUrl}/auth/verify`)
      const req = https.request({
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid Hub response')) }
        })
      })
      req.on('error', reject)
      req.write(postData)
      req.end()
    })

    if (!hubResult.valid) {
      throw new UnauthorizedError('Invalid Hub token')
    }

    // Find or create TC user by hub_user_id
    const hubUserId = hubResult.userId
    const hubDisplayName = hubResult.displayName || (hubResult.email ? hubResult.email.split('@')[0] : 'User')
    let user

    const existing = await db.query('SELECT * FROM users WHERE hub_user_id = $1', [hubUserId])
    if (existing.rows.length > 0) {
      user = existing.rows[0]
      // Sync display_name + refresh hub_token
      const newName = (hubResult.displayName && hubResult.displayName !== user.display_name)
        ? hubResult.displayName : user.display_name || hubDisplayName
      await db.query(
        'UPDATE users SET display_name = $1, hub_token = $2, avatar_url = COALESCE($3, avatar_url) WHERE id = $4',
        [newName, hubToken, hubResult.avatarUrl || null, user.id]
      )
      user.display_name = newName
      if (hubResult.avatarUrl) user.avatar_url = hubResult.avatarUrl
    } else {
      // Try matching by email
      if (hubResult.email) {
        const emailMatch = await db.query('SELECT * FROM users WHERE email = $1', [hubResult.email])
        if (emailMatch.rows.length > 0) {
          user = emailMatch.rows[0]
          await db.query(
            'UPDATE users SET hub_user_id = $1, display_name = COALESCE(display_name, $2), hub_token = $3, avatar_url = COALESCE($4, avatar_url) WHERE id = $5',
            [hubUserId, hubDisplayName, hubToken, hubResult.avatarUrl || null, user.id]
          )
          user.hub_user_id = hubUserId
          if (!user.display_name) user.display_name = hubDisplayName
        }
      }

      if (!user) {
        // Create new user (no password)
        const result = await db.query(
          `INSERT INTO users (email, name, display_name, role, hub_user_id, hub_token, avatar_url)
           VALUES ($1, $2, $3, 'voter', $4, $5, $6)
           RETURNING *`,
          [hubResult.email, hubDisplayName, hubDisplayName, hubUserId, hubToken, hubResult.avatarUrl || null]
        )
        user = result.rows[0]
      }
    }

    // Issue TC-local JWT
    const token = generateJWT({ userId: user.id, role: user.role })

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name || user.display_name,
        display_name: user.display_name || user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url || hubResult.avatarUrl || null
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { register, login, hubLogin }
