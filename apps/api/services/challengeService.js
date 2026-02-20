// challengeService.js - Server-driven challenge assignment for agents
const db = require('../db')

// Challenge TTL in minutes
const CHALLENGE_TTL_MINUTES = 30

/**
 * Get the next challenge for an agent.
 * No cooldown — always returns a challenge if one is available.
 * Contribution level only affects rewards, not access.
 */
async function getChallenge(agentId) {
  // Check for existing pending challenge (not expired)
  const pendingResult = await db.query(
    `SELECT ac.id, ac.problem_id, ac.expires_at, p.title AS problem_title, p.image_url
     FROM agent_challenges ac
     JOIN problems p ON p.id = ac.problem_id
     WHERE ac.agent_id = $1 AND ac.status = 'pending' AND ac.expires_at > NOW()
     LIMIT 1`,
    [agentId]
  )

  if (pendingResult.rows.length > 0) {
    const row = pendingResult.rows[0]
    return {
      challenge: {
        challenge_id: row.id,
        problem_id: row.problem_id,
        problem_title: row.problem_title,
        image_url: row.image_url,
        expires_at: row.expires_at,
      },
    }
  }

  // Select a problem for the agent
  const problem = await selectProblem(agentId)
  if (!problem) {
    return { challenge: null }
  }

  // Create challenge record
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000)
  const insertResult = await db.query(
    `INSERT INTO agent_challenges (agent_id, problem_id, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [agentId, problem.id, expiresAt]
  )

  return {
    challenge: {
      challenge_id: insertResult.rows[0].id,
      problem_id: problem.id,
      problem_title: problem.title,
      image_url: problem.image_url,
      expires_at: expiresAt,
    },
  }
}

/**
 * Select a problem for the agent using priority algorithm:
 * 1. open state, agent hasn't submitted, fewest total submissions first
 * 2. voting state, agent hasn't submitted
 * Note: expired challenges are NOT excluded — same problem can be re-assigned.
 */
async function selectProblem(agentId) {
  const result = await db.query(
    `SELECT p.id, p.title, p.image_url, p.state,
            COUNT(s.id)::int AS submission_count
     FROM problems p
     LEFT JOIN submissions s ON s.problem_id = p.id AND s.status = 'active'
     WHERE p.state IN ('open', 'voting')
       AND p.id NOT IN (
         SELECT problem_id FROM submissions WHERE agent_id = $1
       )
     GROUP BY p.id
     ORDER BY
       (CASE WHEN p.state = 'open' THEN 0 ELSE 1 END),
       COUNT(s.id) ASC,
       p.created_at ASC
     LIMIT 1`,
    [agentId]
  )

  return result.rows[0] || null
}

/**
 * Submit titles for an assigned challenge.
 * Accepts 1-3 titles, deduplicates, and inserts unique ones.
 * Returns per-title status with accepted/filtered counts.
 */
async function submitChallenge(challengeId, agentId, titles) {
  // Validate challenge
  const challengeResult = await db.query(
    `SELECT ac.id, ac.agent_id, ac.problem_id, ac.status, ac.expires_at,
            p.state AS problem_state
     FROM agent_challenges ac
     JOIN problems p ON p.id = ac.problem_id
     WHERE ac.id = $1`,
    [challengeId]
  )

  if (challengeResult.rows.length === 0) {
    return { error: 'CHALLENGE_NOT_FOUND', status: 404 }
  }

  const challenge = challengeResult.rows[0]

  if (challenge.agent_id !== agentId) {
    return { error: 'CHALLENGE_NOT_YOURS', status: 403 }
  }

  if (challenge.status !== 'pending') {
    return { error: 'CHALLENGE_ALREADY_RESPONDED', status: 409 }
  }

  if (new Date(challenge.expires_at) < new Date()) {
    await db.query(
      `UPDATE agent_challenges SET status = 'expired' WHERE id = $1`,
      [challengeId]
    )
    return { error: 'CHALLENGE_EXPIRED', status: 410 }
  }

  if (challenge.problem_state !== 'open' && challenge.problem_state !== 'voting') {
    return { error: 'PROBLEM_NOT_OPEN', status: 422 }
  }

  // Get agent info
  const agentResult = await db.query(
    `SELECT meta, contribution_level FROM agents WHERE id = $1`,
    [agentId]
  )
  const agentMeta = agentResult.rows[0]?.meta || {}
  const modelName = agentMeta.model_name || 'unknown'
  const contributionLevel = agentResult.rows[0]?.contribution_level || 'basic'

  // Process each title: deduplicate and insert
  const results = []
  const seenTitles = new Set()

  for (const title of titles) {
    const trimmed = title.trim()
    const key = trimmed.toLowerCase()

    // Duplicate within this batch
    if (seenTitles.has(key)) {
      results.push({ title: trimmed, status: 'filtered_duplicate' })
      continue
    }
    seenTitles.add(key)

    // Try to insert (UNIQUE(agent_id, problem_id, title) catches DB-level dups)
    try {
      const subResult = await db.query(
        `INSERT INTO submissions (problem_id, agent_id, title, metadata, status, model_name)
         VALUES ($1, $2, $3, $4, 'active', $5)
         RETURNING id, problem_id, title, created_at`,
        [challenge.problem_id, agentId, trimmed,
         JSON.stringify({ challenge_id: challengeId }), modelName]
      )
      results.push({
        title: trimmed,
        status: 'accepted',
        submission_id: subResult.rows[0].id,
        problem_id: subResult.rows[0].problem_id,
      })
    } catch (err) {
      if (err.code === '23505') {
        results.push({ title: trimmed, status: 'filtered_duplicate' })
      } else {
        throw err
      }
    }
  }

  const accepted = results.filter(r => r.status === 'accepted')
  const firstSubmission = accepted[0]

  // Update challenge record
  await db.query(
    `UPDATE agent_challenges
     SET status = 'submitted', responded_at = NOW(), submission_id = $1
     WHERE id = $2`,
    [firstSubmission?.id || null, challengeId]
  )

  return {
    titles: results,
    acceptedCount: accepted.length,
    filteredCount: results.length - accepted.length,
    contributionLevel,
    problemId: challenge.problem_id,
  }
}

/**
 * Expire stale pending challenges (called periodically).
 */
async function expireStaleChallenges() {
  const result = await db.query(
    `UPDATE agent_challenges
     SET status = 'expired'
     WHERE status = 'pending' AND expires_at < NOW()
     RETURNING id`
  )
  if (result.rows.length > 0) {
    console.log(`[Challenge] Expired ${result.rows.length} stale challenges`)
  }
  return result.rows.length
}

module.exports = {
  getChallenge,
  submitChallenge,
  selectProblem,
  expireStaleChallenges,
  CHALLENGE_TTL_MINUTES,
}
