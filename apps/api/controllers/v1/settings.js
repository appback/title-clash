// Settings controller: dynamic service configuration (admin only)
const configManager = require('../../services/configManager')
const { resetS3Client } = require('../../services/storage')
const { ValidationError } = require('../../utils/errors')

/**
 * GET /api/v1/settings
 * List settings, optional ?category filter. Admin only.
 */
async function list(req, res, next) {
  try {
    const { category } = req.query
    const settings = configManager.getAll(category || null)
    res.json({ settings })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/v1/settings
 * Bulk update settings. Body: { settings: { key: value, ... } }. Admin only.
 */
async function update(req, res, next) {
  try {
    const { settings } = req.body
    if (!settings || typeof settings !== 'object') {
      throw new ValidationError('settings object is required')
    }

    await configManager.setMany(settings, req.user.id)
    const updated = configManager.getAll(null)
    res.json({ message: 'Settings updated', settings: updated })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/settings/refresh
 * Reload settings from DB into cache. Admin only.
 */
async function refresh(req, res, next) {
  try {
    await configManager.loadSettings()
    resetS3Client()
    res.json({ message: 'Settings refreshed' })
  } catch (err) {
    next(err)
  }
}

module.exports = { list, update, refresh }
