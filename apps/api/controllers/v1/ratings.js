// Ratings controller: title star ratings (0-5)
const db = require('../../db')
const { ValidationError, NotFoundError } = require('../../utils/errors')

/**
 * GET /api/v1/ratings/next
 * Get next title(s) to rate. Prioritizes least-rated submissions.
 */
async function next(req, res, next_mw) {
  try {
    const count = Math.min(parseInt(req.query.count, 10) || 1, 10)
    const problemId = req.query.problem_id || null

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    if (!voterId && !voterToken) {
      return res.json({ items: [] })
    }

    // Find submissions the voter hasn't rated yet, from open/voting problems
    const voterFilter = voterId
      ? `AND NOT EXISTS (SELECT 1 FROM title_ratings tr WHERE tr.submission_id = s.id AND tr.voter_id = $2)`
      : `AND NOT EXISTS (SELECT 1 FROM title_ratings tr WHERE tr.submission_id = s.id AND tr.voter_token = $2)`

    const problemFilter = problemId ? `AND s.problem_id = $3` : ''
    const params = problemId
      ? [count, voterId || voterToken, problemId]
      : [count, voterId || voterToken]

    const result = await db.query(
      `SELECT s.id AS submission_id, s.title, s.avg_rating, s.rating_count,
              p.id AS problem_id, p.title AS problem_title, p.image_url AS problem_image_url
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       WHERE s.status = 'active'
         AND p.state IN ('open', 'voting')
         ${voterFilter}
         ${problemFilter}
       ORDER BY s.rating_count ASC, RANDOM()
       LIMIT $1`,
      params
    )

    const items = result.rows.map(r => ({
      submission_id: r.submission_id,
      title: r.title,
      problem: {
        id: r.problem_id,
        title: r.problem_title,
        image_url: r.problem_image_url
      },
      current_stats: {
        avg_rating: r.avg_rating ? parseFloat(r.avg_rating) : null,
        rating_count: r.rating_count
      }
    }))

    res.json({ items })
  } catch (err) {
    next_mw(err)
  }
}

/**
 * POST /api/v1/ratings
 * Rate a title (0-5 stars). Upsert — allows re-rating.
 */
async function rate(req, res, next_mw) {
  try {
    const { submission_id, stars } = req.body

    if (!submission_id) throw new ValidationError('submission_id is required')
    if (stars === undefined || stars === null) throw new ValidationError('stars is required')

    const starsInt = parseInt(stars, 10)
    if (isNaN(starsInt) || starsInt < 0 || starsInt > 5) {
      throw new ValidationError('stars must be between 0 and 5')
    }

    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null

    if (!voterId && !voterToken) {
      throw new ValidationError('Voter identification required')
    }

    // Verify submission exists and is active
    const subResult = await db.query(
      `SELECT s.id, s.problem_id FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       WHERE s.id = $1 AND s.status = 'active' AND p.state IN ('open', 'voting')`,
      [submission_id]
    )
    if (subResult.rows.length === 0) {
      throw new NotFoundError('Submission not found or not eligible for rating')
    }

    // Upsert rating
    if (voterId) {
      await db.query(
        `INSERT INTO title_ratings (submission_id, stars, voter_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (submission_id, COALESCE(voter_id::text, ''), COALESCE(voter_token, ''))
         DO UPDATE SET stars = $2, created_at = NOW()`,
        [submission_id, starsInt, voterId]
      )
    } else {
      await db.query(
        `INSERT INTO title_ratings (submission_id, stars, voter_token)
         VALUES ($1, $2, $3)
         ON CONFLICT (submission_id, COALESCE(voter_id::text, ''), COALESCE(voter_token, ''))
         DO UPDATE SET stars = $2, created_at = NOW()`,
        [submission_id, starsInt, voterToken]
      )
    }

    // Update cached avg_rating and rating_count
    const statsResult = await db.query(
      `UPDATE submissions SET
         avg_rating = (SELECT ROUND(AVG(stars)::numeric, 2) FROM title_ratings WHERE submission_id = $1),
         rating_count = (SELECT COUNT(*)::int FROM title_ratings WHERE submission_id = $1)
       WHERE id = $1
       RETURNING avg_rating, rating_count`,
      [submission_id]
    )

    const stats = statsResult.rows[0]

    res.status(201).json({
      submission_id,
      stars: starsInt,
      avg_rating: stats.avg_rating ? parseFloat(stats.avg_rating) : null,
      rating_count: stats.rating_count
    })
  } catch (err) {
    next_mw(err)
  }
}

/**
 * GET /api/v1/submissions/:id/rating
 * Get rating details for a submission.
 */
async function submissionRating(req, res, next_mw) {
  try {
    const { id } = req.params

    const subResult = await db.query(
      `SELECT id, avg_rating, rating_count FROM submissions WHERE id = $1`,
      [id]
    )
    if (subResult.rows.length === 0) {
      throw new NotFoundError('Submission not found')
    }

    const sub = subResult.rows[0]

    // Distribution
    const distResult = await db.query(
      `SELECT stars, COUNT(*)::int AS count
       FROM title_ratings WHERE submission_id = $1
       GROUP BY stars ORDER BY stars`,
      [id]
    )
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    distResult.rows.forEach(r => { distribution[r.stars] = r.count })

    // My rating
    const voterId = req.user ? req.user.userId : null
    const voterToken = !voterId ? (req.voterId || null) : null
    let myRating = null

    if (voterId || voterToken) {
      const myResult = await db.query(
        `SELECT stars FROM title_ratings
         WHERE submission_id = $1 AND ${voterId ? 'voter_id = $2' : 'voter_token = $2'}`,
        [id, voterId || voterToken]
      )
      if (myResult.rows.length > 0) myRating = myResult.rows[0].stars
    }

    res.json({
      submission_id: id,
      avg_rating: sub.avg_rating ? parseFloat(sub.avg_rating) : null,
      rating_count: sub.rating_count,
      distribution,
      my_rating: myRating
    })
  } catch (err) {
    next_mw(err)
  }
}

module.exports = { next, rate, submissionRating }
