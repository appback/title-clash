const { v4: uuidv4 } = require('uuid')
const store = require('../store')
const db = require('../db')

// createMatch: expects { titleAId, titleBId } or will pick two random active titles
async function createMatch({ titleAId, titleBId }) {
  let a = titleAId
  let b = titleBId

  if (!a || !b) {
    const res = await db.query('SELECT id, title, status FROM titles WHERE status = $1', ['active'])
    const active = res.rows
    if (active.length < 2) throw new Error('not enough titles')
    const idx = Math.floor(Math.random() * active.length)
    a = active[idx].id
    let j = Math.floor(Math.random() * (active.length - 1))
    if (j >= idx) j += 1
    b = active[j].id
  }

  const id = uuidv4()
  await db.query('INSERT INTO matches(id, title_a_id, title_b_id, status) VALUES($1,$2,$3,$4)', [id, a, b, 'open'])
  const m = { id, titleAId: a, titleBId: b, createdAt: Date.now(), votes: {}, status: 'open' }
  store.matches[id] = m
  return m
}

async function nextMatch() {
  const res = await db.query('SELECT * FROM matches WHERE status = $1 ORDER BY created_at ASC LIMIT 1', ['open'])
  let row = null
  if (res.rows.length > 0) row = res.rows[0]
  else {
    try {
      return await createMatch({})
    } catch (e) {
      return null
    }
  }

  // fetch title texts for A and B
  const tRes = await db.query('SELECT id, title FROM titles WHERE id = ANY($1::uuid[])', [[row.title_a_id, row.title_b_id]])
  const titles = {}
  tRes.rows.forEach(r => { titles[r.id] = r.title })

  return {
    id: row.id,
    titleAId: row.title_a_id,
    titleBId: row.title_b_id,
    titleA: titles[row.title_a_id] || null,
    titleB: titles[row.title_b_id] || null,
    createdAt: row.created_at,
    status: row.status
  }
}

async function vote(matchId, { voterId, choice }) {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')
    const mRes = await client.query('SELECT * FROM matches WHERE id = $1 FOR UPDATE', [matchId])
    if (mRes.rows.length === 0) throw new Error('match not found')
    const m = mRes.rows[0]
    if (m.status !== 'open') throw new Error('match closed')
    if (choice !== 'A' && choice !== 'B') throw new Error('choice must be A or B')

    // determine chosen title id
    const titleId = choice === 'A' ? m.title_a_id : m.title_b_id

    // enforce one vote per voter if voterId provided
    if (voterId) {
      const vcheck = await client.query('SELECT 1 FROM votes WHERE match_id = $1 AND voter_id = $2', [matchId, voterId])
      if (vcheck.rows.length > 0) throw new Error('already voted')
    }

    await client.query('INSERT INTO votes(match_id, title_id, voter_id) VALUES($1,$2,$3)', [matchId, titleId, voterId || null])

    await client.query('COMMIT')

    // return updated counts
    const counts = await db.query('SELECT title_id, COUNT(*) AS cnt FROM votes WHERE match_id = $1 GROUP BY title_id', [matchId])
    const votes = {}
    counts.rows.forEach(r => { votes[r.title_id] = parseInt(r.cnt,10) })
    return { success: true, votes }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = { createMatch, nextMatch, vote }
