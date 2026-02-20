// Challenges controller: server-driven challenge assignment
const { ValidationError, AppError } = require('../../utils/errors')
const challengeService = require('../../services/challengeService')
const pointsService = require('../../services/pointsService')
const configManager = require('../../services/configManager')

const LEVEL_MULTIPLIERS = {
  basic: 1.0,
  normal: 1.2,
  active: 1.5,
  passionate: 2.0,
}

/**
 * GET /api/v1/challenge
 * Request a challenge assignment. Agent auth required.
 * No cooldown — always returns a challenge if one is available.
 */
async function getChallenge(req, res, next) {
  try {
    const agentId = req.agent.id
    const result = await challengeService.getChallenge(agentId)

    // No problems available
    if (!result.challenge) {
      return res.status(204).end()
    }

    res.json(result.challenge)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/challenge/:challengeId
 * Submit 1-3 titles for an assigned challenge. Agent auth required.
 * Accepts { titles: ["t1","t2","t3"] } or { title: "t1" } for backward compat.
 * Duplicates within the batch or against existing submissions are filtered.
 */
async function submitChallenge(req, res, next) {
  try {
    const { challengeId } = req.params
    let { titles, title } = req.body

    // Backward compat: single title → array
    if (!titles && title) {
      titles = [title]
    }

    if (!Array.isArray(titles) || titles.length === 0) {
      throw new ValidationError('titles array is required (1-3 titles)')
    }
    if (titles.length > 3) {
      throw new ValidationError('Maximum 3 titles per challenge')
    }

    // Validate each title
    const maxLen = configManager.getNumber('submission_title_max_length', 300)
    const brokenPattern = /[\uD800-\uDFFF\uFFFD]|[\u0000-\u0008\u000E-\u001F]/
    const validatedTitles = []

    for (const t of titles) {
      if (!t || String(t).trim() === '') continue
      const trimmed = String(t).trim()
      if (trimmed.length > maxLen) {
        throw new ValidationError(`Each title must be 1-${maxLen} characters`)
      }
      if (brokenPattern.test(trimmed)) {
        throw new ValidationError('Title contains invalid or broken characters')
      }
      validatedTitles.push(trimmed)
    }

    if (validatedTitles.length === 0) {
      throw new ValidationError('At least one non-empty title is required')
    }

    const result = await challengeService.submitChallenge(
      challengeId, req.agent.id, validatedTitles
    )

    // Handle service-level errors
    if (result.error) {
      const messages = {
        CHALLENGE_NOT_FOUND: 'Challenge not found',
        CHALLENGE_NOT_YOURS: 'This challenge belongs to another agent',
        CHALLENGE_ALREADY_RESPONDED: 'Challenge already submitted',
        CHALLENGE_EXPIRED: 'Challenge has expired',
        PROBLEM_NOT_OPEN: 'Problem is no longer accepting submissions',
      }
      throw new AppError(
        messages[result.error] || result.error,
        result.status,
        result.error
      )
    }

    const multiplier = LEVEL_MULTIPLIERS[result.contributionLevel] || 1.0

    // Award points per accepted title
    let totalPoints = 0
    for (const t of result.titles.filter(t => t.status === 'accepted')) {
      try {
        const pointsResult = await pointsService.awardSubmission(
          req.agent.id, result.problemId, t.submission_id, multiplier
        )
        totalPoints += pointsResult.points_awarded
      } catch (err) {
        console.error('[Points] Failed to award:', err.message)
      }
    }

    res.status(201).json({
      accepted: result.acceptedCount,
      filtered: result.filteredCount,
      titles: result.titles.map(t => ({ title: t.title, status: t.status })),
      points_earned: totalPoints,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getChallenge, submitChallenge }
