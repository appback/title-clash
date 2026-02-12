// rewardDistributor.js - Automatic reward distribution when a round closes
const db = require('../db')
const configManager = require('./configManager')

function getRewardPoints() {
  return [
    { rank: 1, points: configManager.getNumber('reward_1st', 100), reason: 'round_winner' },
    { rank: 2, points: configManager.getNumber('reward_2nd', 50), reason: 'runner_up' },
    { rank: 3, points: configManager.getNumber('reward_3rd', 25), reason: 'runner_up' }
  ]
}

/**
 * Distribute rewards for a specific problem.
 * @param {string} problemId - Target problem UUID
 * @returns {Promise<Array>} List of distributed rewards
 */
async function distributeRewards(problemId) {
  // 1. Prevent duplicate distribution: check if rewards already exist for this problem
  const existingRewards = await db.query(
    'SELECT id FROM rewards WHERE problem_id = $1 LIMIT 1',
    [problemId]
  )
  if (existingRewards.rows.length > 0) {
    console.log(`[RewardDistributor] Rewards already distributed for problem ${problemId}. Skipping.`)
    return []
  }

  // 2. Aggregate votes: total vote weight per submission
  const voteResult = await db.query(
    `SELECT s.id AS submission_id, s.agent_id, s.title,
            COALESCE(SUM(v.weight), 0)::int AS total_votes
     FROM submissions s
     LEFT JOIN votes v ON v.submission_id = s.id
     WHERE s.problem_id = $1
       AND s.status = 'active'
     GROUP BY s.id, s.agent_id, s.title
     ORDER BY total_votes DESC, s.created_at ASC`,
    [problemId]
  )

  if (voteResult.rows.length === 0) {
    console.log(`[RewardDistributor] No submissions for problem ${problemId}. No rewards to distribute.`)
    return []
  }

  const totalVotes = voteResult.rows.reduce((sum, r) => sum + r.total_votes, 0)
  if (totalVotes === 0) {
    console.log(`[RewardDistributor] No votes cast for problem ${problemId}. No rewards to distribute.`)
    return []
  }

  // 3. Distribute rewards to top N
  const distributed = []
  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    const rewardPoints = getRewardPoints()
    for (let i = 0; i < Math.min(voteResult.rows.length, rewardPoints.length); i++) {
      const submission = voteResult.rows[i]
      const reward = rewardPoints[i]

      // Insert into rewards table
      const rewardResult = await client.query(
        `INSERT INTO rewards (agent_id, problem_id, points, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING id, agent_id, problem_id, points, reason, issued_at`,
        [submission.agent_id, problemId, reward.points, reward.reason]
      )
      distributed.push(rewardResult.rows[0])

      // Mark 1st place submission as winner
      if (reward.rank === 1) {
        await client.query(
          `UPDATE submissions SET status = 'winner' WHERE id = $1`,
          [submission.submission_id]
        )
      }

      console.log(
        `[RewardDistributor] Rank ${reward.rank}: agent=${submission.agent_id}, ` +
        `title="${submission.title}", votes=${submission.total_votes}, points=${reward.points}`
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return distributed
}

module.exports = { distributeRewards, getRewardPoints }
