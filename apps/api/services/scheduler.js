// scheduler.js - Round automation scheduler using node-cron
const cron = require('node-cron')
const db = require('../db')
const { distributeRewards } = require('./rewardDistributor')
const { triggerAutoSubmissions } = require('./autoSubmitter')
const { createTournamentsForProblems } = require('./tournamentCreator')
const { registerNewSubmissions, replenishGamePool } = require('./matchmaker')

/**
 * Start the scheduler.
 * Runs every 1 minute to check and process state transitions.
 * Runs every 10 minutes for season registration + game pool replenishment.
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

  // Every 10 minutes: season registration + game pool replenishment
  console.log('[Scheduler] Starting matchmaker scheduler (every 10 minutes)')
  cron.schedule('*/10 * * * *', async () => {
    try {
      await registerNewSubmissions()
      await replenishGamePool()
    } catch (err) {
      console.error('[Scheduler] Error in matchmaker cycle:', err)
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
  if (draftToOpen.rows.length > 0) {
    const openedIds = draftToOpen.rows.map(p => p.id)
    triggerAutoSubmissions(openedIds).catch(err => {
      console.error('[Scheduler] Auto-submission error:', err.message)
    })
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
  if (openToVoting.rows.length > 0) {
    // Legacy tournament creation (deprecated - games system handles voting now)
    const votingIds = openToVoting.rows.map(p => p.id)
    createTournamentsForProblems(votingIds).catch(err => {
      console.error('[Scheduler] Tournament creation error:', err.message)
    })
    // Immediately register and generate games for newly voting problems
    registerNewSubmissions().catch(err => {
      console.error('[Scheduler] Registration error:', err.message)
    })
    replenishGamePool().catch(err => {
      console.error('[Scheduler] Game pool error:', err.message)
    })
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
