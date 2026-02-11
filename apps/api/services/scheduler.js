// scheduler.js - Round automation scheduler using node-cron
const cron = require('node-cron')
const db = require('../db')
const { distributeRewards } = require('./rewardDistributor')

/**
 * Start the scheduler.
 * Runs every 1 minute to check and process state transitions.
 */
function startScheduler() {
  console.log('[Scheduler] Starting round automation scheduler (every 1 minute)')

  cron.schedule('* * * * *', async () => {
    try {
      await processTransitions()
    } catch (err) {
      console.error('[Scheduler] Error in round transition:', err)
    }
  })
}

/**
 * Main state transition processing logic.
 */
async function processTransitions() {
  const now = new Date().toISOString()

  // Step 1: draft -> open (start_at reached)
  const draftToOpen = await db.query(
    `UPDATE problems
     SET state = 'open', updated_at = now()
     WHERE state = 'draft'
       AND start_at IS NOT NULL
       AND start_at <= $1
     RETURNING id, title`,
    [now]
  )
  for (const p of draftToOpen.rows) {
    console.log(`[Scheduler] Problem '${p.title}' (${p.id}): draft -> open`)
  }

  // Step 2: open -> voting (submission_deadline reached)
  // submission_deadline = start_at + (end_at - start_at) * 0.6
  const openToVoting = await db.query(
    `UPDATE problems
     SET state = 'voting', updated_at = now()
     WHERE state = 'open'
       AND start_at IS NOT NULL
       AND end_at IS NOT NULL
       AND (start_at + (end_at - start_at) * 0.6) <= $1
     RETURNING id, title`,
    [now]
  )
  for (const p of openToVoting.rows) {
    console.log(`[Scheduler] Problem '${p.title}' (${p.id}): open -> voting`)
  }

  // Step 3: voting -> closed (end_at reached) + reward distribution
  const votingToClosed = await db.query(
    `UPDATE problems
     SET state = 'closed', updated_at = now()
     WHERE state = 'voting'
       AND end_at IS NOT NULL
       AND end_at <= $1
     RETURNING id, title`,
    [now]
  )
  for (const p of votingToClosed.rows) {
    console.log(`[Scheduler] Problem '${p.title}' (${p.id}): voting -> closed`)
    // Trigger automatic reward distribution
    try {
      await distributeRewards(p.id)
      console.log(`[Scheduler] Rewards distributed for problem ${p.id}`)
      // After reward distribution, transition to archived
      await db.query(
        `UPDATE problems SET state = 'archived', updated_at = now() WHERE id = $1`,
        [p.id]
      )
      console.log(`[Scheduler] Problem '${p.title}' (${p.id}): closed -> archived`)
    } catch (rewardErr) {
      console.error(`[Scheduler] Failed to distribute rewards for problem ${p.id}:`, rewardErr)
      // On reward failure, keep closed state (manual intervention needed)
    }
  }
}

module.exports = { startScheduler, processTransitions }
