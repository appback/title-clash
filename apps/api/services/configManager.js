// configManager.js - Dynamic settings loaded from DB with in-memory cache
const db = require('../db')

let cache = new Map()

/**
 * Load all settings from DB into memory cache.
 */
async function loadSettings() {
  const result = await db.query('SELECT key, value, category FROM settings')
  cache = new Map()
  for (const row of result.rows) {
    cache.set(row.key, { value: row.value, category: row.category })
  }
  console.log(`[ConfigManager] Loaded ${cache.size} settings`)
}

/**
 * Get a setting value with optional default.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
function get(key, defaultValue = null) {
  const entry = cache.get(key)
  if (!entry) return defaultValue
  return entry.value
}

/**
 * Get a setting as a number.
 * @param {string} key
 * @param {number} defaultValue
 * @returns {number}
 */
function getNumber(key, defaultValue = 0) {
  const val = get(key, defaultValue)
  const num = Number(val)
  return isNaN(num) ? defaultValue : num
}

/**
 * Get a setting as a string.
 * @param {string} key
 * @param {string} defaultValue
 * @returns {string}
 */
function getString(key, defaultValue = '') {
  const val = get(key, defaultValue)
  return val != null ? String(val) : defaultValue
}

/**
 * Get all settings for a given category.
 * @param {string} category
 * @returns {object}
 */
function getAll(category) {
  const result = {}
  for (const [key, entry] of cache) {
    if (!category || entry.category === category) {
      result[key] = entry.value
    }
  }
  return result
}

/**
 * Update a single setting.
 * @param {string} key
 * @param {*} value
 * @param {string|null} userId
 */
async function set(key, value, userId = null) {
  const jsonValue = JSON.stringify(value)
  await db.query(
    `INSERT INTO settings (key, value, updated_at, updated_by)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now(), updated_by = $3`,
    [key, jsonValue, userId]
  )
  // Update local cache
  const existing = cache.get(key)
  cache.set(key, { value, category: existing ? existing.category : 'general' })
}

/**
 * Update multiple settings at once.
 * @param {object} updates - { key: value, ... }
 * @param {string|null} userId
 */
async function setMany(updates, userId = null) {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')
    for (const [key, value] of Object.entries(updates)) {
      const jsonValue = JSON.stringify(value)
      await client.query(
        `INSERT INTO settings (key, value, updated_at, updated_by)
         VALUES ($1, $2, now(), $3)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now(), updated_by = $3`,
        [key, jsonValue, userId]
      )
      const existing = cache.get(key)
      cache.set(key, { value, category: existing ? existing.category : 'general' })
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = { loadSettings, get, getNumber, getString, getAll, set, setMany }
