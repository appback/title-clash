// DB-backed titles using PostgreSQL
const { v4: uuidv4 } = require('uuid')
const db = require('../db')

async function createTitle({ title, authorId }) {
  if (!title || String(title).trim() === '') throw new Error('title required')
  const id = uuidv4()
  await db.query('INSERT INTO titles(id, title, author_id, status) VALUES($1,$2,$3,$4)', [id, String(title).trim(), authorId || null, 'active'])
  const t = { id, title: String(title).trim(), authorId: authorId || null, createdAt: Date.now(), status: 'active' }
  return t
}

async function getTitle(id) {
  const res = await db.query('SELECT id, title, author_id AS "authorId", status, created_at AS "createdAt" FROM titles WHERE id = $1', [id])
  return res.rows[0] || null
}

module.exports = { createTitle, getTitle }
