// matchmaker.js - Tier-based weighted matching for game generation
const db = require('../db')

// ==========================================
// Pure functions (testable)
// ==========================================

/**
 * Classify a submission into a tier based on exposure count.
 * L0 = new (0-20), L1 = growing (21-100), L2 = established (101-1000), L3 = veteran (1001+)
 */
function classifyTier(exposureCount) {
  if (exposureCount <= 20) return 'L0'
  if (exposureCount <= 100) return 'L1'
  if (exposureCount <= 1000) return 'L2'
  return 'L3'
}

/**
 * Compute selection weight for a submission.
 * Higher weight = more likely to be picked for a game.
 */
function computeWeight(tier, winRate, exposureCount) {
  switch (tier) {
    case 'L0':
      // New submissions get high weight that decreases as they get exposure
      return Math.max(10, 100 - exposureCount * 3)
    case 'L1':
      if (exposureCount === 0) return 10 // shouldn't happen in L1, safety
      if (winRate < 0.3) return 15 + winRate * 50
      return 40 + winRate * 30
    case 'L2':
      if (winRate < 0.2) return 15
      return 30 + winRate * 50
    case 'L3':
      if (winRate < 0.1) return 3
      return 20 + winRate * 60
    default:
      return 10
  }
}

/**
 * Weighted random sampling without replacement.
 * Returns `count` items from `entries` based on their weight.
 */
function weightedSample(entries, count) {
  if (entries.length <= count) return [...entries]

  const pool = entries.map(e => ({ ...e }))
  const selected = []

  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, e) => sum + e._weight, 0)
    if (totalWeight <= 0) break

    let r = Math.random() * totalWeight
    let idx = 0
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx]._weight
      if (r <= 0) break
    }

    selected.push(pool[idx])
    pool.splice(idx, 1)
  }

  return selected
}

// ==========================================
// Game generation
// ==========================================

/**
 * Generate a single game for a problem.
 * Selects 16 submissions (or fewer), pairs them into 8 matches.
 */
async function generateGame(problemId) {
  // Get eligible submissions
  const result = await db.query(
    `SELECT s.id, s.title, s.exposure_count, s.selection_count, s.skip_count,
            a.name AS author_name, s.model_name
     FROM submissions s
     LEFT JOIN agents a ON a.id = s.agent_id
     WHERE s.problem_id = $1
       AND s.status = 'active'
       AND s.registered_at IS NOT NULL
     ORDER BY s.created_at`,
    [problemId]
  )

  const subs = result.rows
  if (subs.length < 2) return null

  // Classify and weight each submission
  const entries = subs.map(s => {
    const tier = classifyTier(s.exposure_count)
    const winRate = s.exposure_count > 0
      ? s.selection_count / s.exposure_count
      : 0
    return {
      ...s,
      _tier: tier,
      _winRate: winRate,
      _weight: computeWeight(tier, winRate, s.exposure_count)
    }
  })

  // Ensure L0 submissions get at least 20% representation
  const l0Entries = entries.filter(e => e._tier === 'L0')
  const nonL0Entries = entries.filter(e => e._tier !== 'L0')

  const TARGET_COUNT = Math.min(16, subs.length)
  const l0Target = Math.min(l0Entries.length, Math.ceil(TARGET_COUNT * 0.2))

  // Select L0 entries first
  const selectedL0 = weightedSample(l0Entries, l0Target)
  const selectedL0Ids = new Set(selectedL0.map(e => e.id))

  // Fill remaining from all entries (excluding already selected L0)
  const remaining = entries.filter(e => !selectedL0Ids.has(e.id))
  const selectedRest = weightedSample(remaining, TARGET_COUNT - selectedL0.length)

  let selected = [...selectedL0, ...selectedRest]

  // Shuffle for fair pairing
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[selected[i], selected[j]] = [selected[j], selected[i]]
  }

  // Make even count
  if (selected.length % 2 !== 0) selected.pop()
  if (selected.length < 2) return null

  // Create match pairs
  const matches = []
  for (let i = 0; i < selected.length; i += 2) {
    matches.push({
      a: selected[i].id,
      b: selected[i + 1].id
    })
  }

  // Insert game
  const gameResult = await db.query(
    `INSERT INTO games (problem_id, matches)
     VALUES ($1, $2)
     RETURNING id, problem_id, matches, play_count, created_at`,
    [problemId, JSON.stringify(matches)]
  )

  return gameResult.rows[0]
}

/**
 * Replenish game pool for all eligible problems.
 * Ensures each problem has at least 5 available games.
 */
async function replenishGamePool() {
  // Find problems that are open or voting with enough submissions
  const problems = await db.query(
    `SELECT p.id, p.title,
            (SELECT COUNT(*) FROM submissions s
             WHERE s.problem_id = p.id AND s.status = 'active' AND s.registered_at IS NOT NULL
            )::int AS sub_count,
            (SELECT COUNT(*) FROM games g WHERE g.problem_id = p.id)::int AS game_count
     FROM problems p
     WHERE p.state IN ('open', 'voting')`
  )

  let generated = 0
  for (const p of problems.rows) {
    if (p.sub_count < 2) continue
    const needed = Math.max(0, 5 - p.game_count)
    // Generate up to 10 total (fill to 10 if under 5)
    const toGenerate = Math.min(needed + 5, 10 - p.game_count)
    for (let i = 0; i < toGenerate && i < 10; i++) {
      try {
        const game = await generateGame(p.id)
        if (game) generated++
        else break
      } catch (err) {
        console.error(`[Matchmaker] Failed to generate game for problem ${p.id}:`, err.message)
        break
      }
    }
  }

  if (generated > 0) {
    console.log(`[Matchmaker] Generated ${generated} new games`)
  }
  return generated
}

/**
 * Register unregistered active submissions (season batch).
 * Sets registered_at for submissions that don't have it yet.
 */
async function registerNewSubmissions() {
  const result = await db.query(
    `UPDATE submissions
     SET registered_at = NOW()
     WHERE status = 'active'
       AND registered_at IS NULL
     RETURNING id, title`
  )

  if (result.rows.length > 0) {
    console.log(`[Matchmaker] Registered ${result.rows.length} new submissions`)
  }
  return result.rows.length
}

module.exports = {
  classifyTier,
  computeWeight,
  weightedSample,
  generateGame,
  replenishGamePool,
  registerNewSubmissions
}
