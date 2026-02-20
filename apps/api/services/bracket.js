// Bracket generation service for tournament system
const db = require('../db')

const ROUND_NAMES = {
  1: 'final',
  2: 'semi',
  4: 'quarter',
  8: 'round_of_16',
  16: 'round_of_32',
  32: 'round_of_64'
}

/**
 * Calculate the bracket size (next power of 2) for N entries.
 * e.g. 10 → 16, 16 → 16, 20 → 32, 5 → 8
 */
function bracketSize(n) {
  if (n <= 2) return 2
  return Math.pow(2, Math.ceil(Math.log2(n)))
}

/**
 * Get round name from number of matches in that round.
 */
function roundName(matchCount) {
  return ROUND_NAMES[matchCount] || `round_of_${matchCount * 2}`
}

/**
 * Calculate total rounds needed.
 */
function totalRounds(size) {
  return Math.log2(size)
}

/**
 * Generate a seeded bracket for a tournament.
 * Creates all matches from first round through final.
 *
 * @param {string} tournamentId
 * @param {Array} entries - tournament_entries rows with { id, seed }
 * @returns {Array} created matches
 */
async function generateBracket(tournamentId, entries) {
  const size = bracketSize(entries.length)
  const rounds = totalRounds(size)
  const byeCount = size - entries.length

  // Sort entries by seed
  const sorted = [...entries].sort((a, b) => (a.seed || 999) - (b.seed || 999))

  // Place entries in bracket positions with byes spread out
  // Standard bracket seeding: 1v(size), 2v(size-1), etc.
  const slots = new Array(size).fill(null)
  const seedOrder = generateSeedOrder(size)

  for (let i = 0; i < sorted.length; i++) {
    slots[seedOrder[i]] = sorted[i]
  }

  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    // Create all matches from final backwards
    // We create from final round to first round, then link next_match_id
    const matchesByRound = []

    for (let r = 0; r < rounds; r++) {
      const matchCount = Math.pow(2, r)
      matchesByRound.unshift({ round: roundName(matchCount), matches: matchCount })
    }

    // Create matches round by round (first round first)
    const allMatches = []

    for (let r = 0; r < matchesByRound.length; r++) {
      const { round, matches: matchCount } = matchesByRound[r]
      const roundMatches = []

      for (let m = 0; m < matchCount; m++) {
        let entryA = null
        let entryB = null
        let status = 'pending'
        let winnerId = null

        if (r === 0) {
          // First round: assign entries from slots
          entryA = slots[m * 2] ? slots[m * 2].id : null
          entryB = slots[m * 2 + 1] ? slots[m * 2 + 1].id : null

          // Handle bye: if one side is null, auto-advance
          if (entryA && !entryB) {
            winnerId = entryA
            status = 'completed'
          } else if (!entryA && entryB) {
            winnerId = entryB
            status = 'completed'
          } else if (entryA && entryB) {
            status = 'pending'
          }
        }

        const result = await client.query(
          `INSERT INTO tournament_matches
           (tournament_id, round, match_order, entry_a_id, entry_b_id, winner_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [tournamentId, round, m + 1, entryA, entryB, winnerId, status]
        )
        roundMatches.push(result.rows[0])
      }
      allMatches.push(roundMatches)
    }

    // Link next_match_id: each pair of matches feeds into next round
    for (let r = 0; r < allMatches.length - 1; r++) {
      const current = allMatches[r]
      const next = allMatches[r + 1]

      for (let m = 0; m < current.length; m++) {
        const nextMatch = next[Math.floor(m / 2)]
        await client.query(
          'UPDATE tournament_matches SET next_match_id = $1 WHERE id = $2',
          [nextMatch.id, current[m].id]
        )

        // If this match was a bye, advance winner to next match
        if (current[m].winner_id) {
          const slot = m % 2 === 0 ? 'entry_a_id' : 'entry_b_id'
          await client.query(
            `UPDATE tournament_matches SET ${slot} = $1 WHERE id = $2`,
            [current[m].winner_id, nextMatch.id]
          )
        }
      }
    }

    // Update tournament total_rounds
    await client.query(
      'UPDATE tournaments SET total_rounds = $1, updated_at = NOW() WHERE id = $2',
      [rounds, tournamentId]
    )

    await client.query('COMMIT')

    // Flatten and return
    return allMatches.flat()
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Generate standard tournament seed order.
 * For size=8: [0, 7, 3, 4, 1, 6, 2, 5]
 * Ensures top seeds are spread across the bracket.
 */
function generateSeedOrder(size) {
  if (size === 2) return [0, 1]

  const order = [0, 1]
  let currentSize = 2

  while (currentSize < size) {
    const newOrder = []
    for (let i = 0; i < order.length; i++) {
      newOrder.push(order[i])
      newOrder.push(currentSize * 2 - 1 - order[i])
    }
    order.length = 0
    order.push(...newOrder)
    currentSize *= 2
  }

  return order
}

/**
 * Advance winner of a match to the next match.
 * Called after voting determines a winner.
 */
async function advanceWinner(matchId, winnerId) {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    // Update current match
    await client.query(
      `UPDATE tournament_matches
       SET winner_id = $1, status = 'completed', ended_at = NOW()
       WHERE id = $2`,
      [winnerId, matchId]
    )

    // Update entry vote totals
    const match = await client.query(
      'SELECT * FROM tournament_matches WHERE id = $1',
      [matchId]
    )
    const m = match.rows[0]
    if (!m) {
      await client.query('COMMIT')
      return
    }

    // Mark loser as eliminated
    const loserId = m.entry_a_id === winnerId ? m.entry_b_id : m.entry_a_id
    if (loserId) {
      await client.query(
        'UPDATE tournament_entries SET is_eliminated = true WHERE id = $1',
        [loserId]
      )
    }

    // Advance to next match if exists
    if (m.next_match_id) {
      // Determine which slot (a or b) based on match_order
      const slot = m.match_order % 2 === 1 ? 'entry_a_id' : 'entry_b_id'
      await client.query(
        `UPDATE tournament_matches SET ${slot} = $1 WHERE id = $2`,
        [winnerId, m.next_match_id]
      )

      // Check if next match now has both entries → activate it
      const nextMatch = await client.query(
        'SELECT * FROM tournament_matches WHERE id = $1',
        [m.next_match_id]
      )
      const nm = nextMatch.rows[0]
      if (nm && nm.entry_a_id && nm.entry_b_id && nm.status === 'pending') {
        await client.query(
          `UPDATE tournament_matches SET status = 'active', started_at = NOW() WHERE id = $1`,
          [nm.id]
        )
      }
    } else {
      // This was the final match → tournament complete
      await client.query(
        `UPDATE tournaments SET phase = 'completed', current_round = total_rounds, updated_at = NOW()
         WHERE id = $1`,
        [m.tournament_id]
      )
      // Set final rank 1 for winner
      await client.query(
        'UPDATE tournament_entries SET final_rank = 1 WHERE id = $1',
        [winnerId]
      )
      if (loserId) {
        await client.query(
          'UPDATE tournament_entries SET final_rank = 2 WHERE id = $1',
          [loserId]
        )
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Activate first-round matches that have both entries (not byes).
 * Called when tournament starts.
 */
async function activateFirstRound(tournamentId) {
  await db.query(
    `UPDATE tournament_matches
     SET status = 'active', started_at = NOW()
     WHERE tournament_id = $1
       AND entry_a_id IS NOT NULL
       AND entry_b_id IS NOT NULL
       AND status = 'pending'
       AND round = (
         SELECT round FROM tournament_matches
         WHERE tournament_id = $1
         ORDER BY created_at ASC
         LIMIT 1
       )`,
    [tournamentId]
  )
}

module.exports = {
  generateBracket,
  advanceWinner,
  activateFirstRound,
  bracketSize,
  totalRounds,
  generateSeedOrder
}
