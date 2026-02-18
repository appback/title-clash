// scheduler.js - Round automation scheduler using node-cron
const cron = require('node-cron')
const db = require('../db')
const { triggerAutoSubmissions } = require('./autoSubmitter')
const { registerNewSubmissions, replenishGamePool } = require('./matchmaker')
const { expireStaleChallenges } = require('./challengeService')

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
      await expireStaleChallenges()
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

  // Step 2a: open -> voting (submission count >= 16)
  const openToVotingByCount = await db.query(
    `UPDATE problems
     SET state = 'voting', updated_at = now()
     WHERE state = 'open'
       AND (SELECT COUNT(*) FROM submissions s
            WHERE s.problem_id = problems.id AND s.status = 'active') >= 16
     RETURNING id, title`
  )
  for (const p of openToVotingByCount.rows) {
    console.log(`[Scheduler] Problem '${p.title}' (${p.id}): open -> voting (16+ submissions)`)
  }

  // Step 2b: open -> voting (time-based, submission_deadline reached)
  const openToVotingByTime = await db.query(
    `UPDATE problems
     SET state = 'voting', updated_at = now()
     WHERE state = 'open'
       AND start_at IS NOT NULL
       AND end_at IS NOT NULL
       AND (start_at + (end_at - start_at) * 0.6) <= $1
     RETURNING id, title`,
    [now]
  )
  for (const p of openToVotingByTime.rows) {
    console.log(`[Scheduler] Problem '${p.title}' (${p.id}): open -> voting (deadline)`)
  }

  const allNewVoting = [...openToVotingByCount.rows, ...openToVotingByTime.rows]
  if (allNewVoting.length > 0) {
    const votingIds = allNewVoting.map(p => p.id)
    // Immediately register and generate games for newly voting problems
    registerNewSubmissions().catch(err => {
      console.error('[Scheduler] Registration error:', err.message)
    })
    replenishGamePool().catch(err => {
      console.error('[Scheduler] Game pool error:', err.message)
    })
  }

}

module.exports = { startScheduler, processTransitions }
