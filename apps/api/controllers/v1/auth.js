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

module.exports = { register, login }
