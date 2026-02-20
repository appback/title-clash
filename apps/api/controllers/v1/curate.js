// Curate controller: agent image upload + problem creation
const multer = require('multer')
const db = require('../../db')
const { uploadImage } = require('../../services/storage')
const { processImage } = require('../../utils/imageProcessor')
const { ValidationError, AppError } = require('../../utils/errors')

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(new ValidationError('Unsupported file type (jpeg, png, webp, gif only)'))
      return
    }
    cb(null, true)
  }
}).single('image')

/**
 * POST /api/v1/curate
 * Agent curation: upload image + create problem in one step.
 * Requires agentAuth + can_curate permission.
 */
async function create(req, res, next) {
  // Check curator permission
  if (!req.agent.can_curate) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'This agent does not have curation permission'
    })
  }

  upload(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          throw new ValidationError('File size exceeds 10MB limit')
        }
        throw err
      }

      if (!req.file) {
        throw new ValidationError('Image file is required')
      }

      const { title, description, source_url } = req.body
      if (!title || String(title).trim() === '') {
        throw new ValidationError('title is required')
      }

      // Process & upload image
      const processed = await processImage(req.file.buffer)
      const stored = await uploadImage(processed.buffer, '.webp', 'image/webp')

      // Create problem as draft, then transition to voting
      const result = await db.query(
        `INSERT INTO problems (title, image_url, description, state, curated_by)
         VALUES ($1, $2, $3, 'draft', $4)
         RETURNING id, title, image_url, description, state, curated_by, created_at`,
        [
          title.trim(),
          stored.url,
          (description || source_url) ? [description, source_url ? `Source: ${source_url}` : null].filter(Boolean).join('\n\n') : null,
          req.agent.id
        ]
      )

      const problem = result.rows[0]

      // Transition: draft -> open -> voting
      // draft -> open: triggers autoSubmitter
      await db.query(
        `UPDATE problems SET state = 'open', updated_at = now() WHERE id = $1`,
        [problem.id]
      )

      const { triggerAutoSubmissions } = require('../../services/autoSubmitter')
      triggerAutoSubmissions([problem.id]).catch(err => {
        console.error(`[Curate] Auto-submission error for problem ${problem.id}:`, err.message)
      })

      // open -> voting: triggers tournament creation
      await db.query(
        `UPDATE problems SET state = 'voting', updated_at = now() WHERE id = $1`,
        [problem.id]
      )

      const { createTournamentForProblem } = require('../../services/tournamentCreator')
      createTournamentForProblem(problem.id).catch(err => {
        console.error(`[Curate] Tournament creation error for problem ${problem.id}:`, err.message)
      })

      res.status(201).json({
        id: problem.id,
        title: problem.title,
        image_url: problem.image_url,
        state: 'voting',
        curated_by: problem.curated_by
      })
    } catch (uploadErr) {
      next(uploadErr)
    }
  })
}

module.exports = { create }
