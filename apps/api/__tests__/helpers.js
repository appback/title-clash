// Test helper utilities for TitleClash API integration tests
const request = require('supertest');
const app = require('../server');
const db = require('../db');
const { generateAgentToken, hashToken, generateJWT } = require('../utils/token');

/**
 * Create a test user directly in the database.
 * Returns the user record plus a JWT token.
 * @param {object} overrides - Override default user fields
 * @returns {Promise<{id, name, email, role, password, token}>}
 */
async function createTestUser(overrides = {}) {
  const bcrypt = require('bcryptjs');
  const defaults = {
    name: 'Test User',
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'password123',
    role: 'voter'
  };
  const data = { ...defaults, ...overrides };
  const passwordHash = await bcrypt.hash(data.password, 4); // Low rounds for test speed

  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role`,
    [data.name, data.email, passwordHash, data.role]
  );

  const user = result.rows[0];
  const token = generateJWT({ userId: user.id, role: user.role });

  return { ...user, password: data.password, token };
}

/**
 * Create an admin user with JWT.
 * @param {object} overrides - Override default fields
 * @returns {Promise<{id, name, email, role, password, token}>}
 */
async function createAdminUser(overrides = {}) {
  return createTestUser({ role: 'admin', name: 'Admin User', ...overrides });
}

/**
 * Create an agent_owner user with JWT.
 * @param {object} overrides - Override default fields
 * @returns {Promise<{id, name, email, role, password, token}>}
 */
async function createAgentOwner(overrides = {}) {
  return createTestUser({ role: 'agent_owner', name: 'Agent Owner', ...overrides });
}

/**
 * Create a test agent directly in the database.
 * Returns the agent record plus the raw (unhashed) token.
 * @param {string} ownerId - Owner user UUID
 * @param {object} overrides - Override default agent fields
 * @returns {Promise<{id, name, owner_id, is_active, rawToken, tokenHash}>}
 */
async function createTestAgent(ownerId, overrides = {}) {
  const rawToken = generateAgentToken();
  const tokenHash = hashToken(rawToken);
  const defaults = { name: 'Test Agent' };
  const data = { ...defaults, ...overrides };

  const result = await db.query(
    `INSERT INTO agents (name, api_token, owner_id, is_active, meta)
     VALUES ($1, $2, $3, true, '{}')
     RETURNING id, name, owner_id, is_active`,
    [data.name, tokenHash, ownerId]
  );

  return { ...result.rows[0], rawToken, tokenHash };
}

/**
 * Create a test problem directly in the database.
 * @param {string} createdBy - Creator user UUID
 * @param {object} overrides - Override default problem fields
 * @returns {Promise<{id, title, state, ...}>}
 */
async function createTestProblem(createdBy, overrides = {}) {
  const defaults = {
    title: 'Test Problem',
    state: 'draft',
    image_url: 'https://example.com/test.jpg',
    description: 'A test problem'
  };
  const data = { ...defaults, ...overrides };

  const result = await db.query(
    `INSERT INTO problems (title, image_url, description, state, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.title, data.image_url, data.description, data.state, createdBy]
  );

  return result.rows[0];
}

/**
 * Create a test submission directly in the database.
 * @param {string} problemId - Problem UUID
 * @param {string} agentId - Agent UUID
 * @param {object} overrides - Override default submission fields
 * @returns {Promise<{id, problem_id, agent_id, title, status, ...}>}
 */
async function createTestSubmission(problemId, agentId, overrides = {}) {
  const defaults = { title: `Submission ${Date.now()}` };
  const data = { ...defaults, ...overrides };

  const result = await db.query(
    `INSERT INTO submissions (problem_id, agent_id, title, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING *`,
    [problemId, agentId, data.title]
  );

  return result.rows[0];
}

/**
 * Truncate all tables to ensure test isolation.
 * Deletes in foreign-key-safe order.
 */
async function cleanDatabase() {
  await db.query('DELETE FROM reports');
  await db.query('DELETE FROM rewards');
  await db.query('DELETE FROM votes');
  await db.query('DELETE FROM submissions');
  await db.query('DELETE FROM problems');
  await db.query('DELETE FROM agents');
  await db.query('DELETE FROM settings');
  await db.query('DELETE FROM users');
}

/**
 * Return a Bearer token string for use with .set('Authorization', ...).
 * @param {string} token - JWT or agent token
 * @returns {string}
 */
function authHeader(token) {
  return `Bearer ${token}`;
}

module.exports = {
  app,
  request,
  db,
  createTestUser,
  createAdminUser,
  createAgentOwner,
  createTestAgent,
  createTestProblem,
  createTestSubmission,
  cleanDatabase,
  authHeader
};
