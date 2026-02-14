// Image URL validator for TitleClash API
// Validates that external image URLs are accessible and return valid image content

const https = require('https')
const http = require('http')

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
]

const TIMEOUT_MS = 8000

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TitleClash/1.0; +https://titleclash.com)',
  'Accept': 'image/*,*/*'
}

// 403 = CDN hotlink protection (image may still work in browsers)
// Only block clearly broken URLs: 404, 410, 5xx
const HARD_FAIL_STATUSES = [404, 410, 500, 502, 503, 504]

/**
 * Send an HTTP request and check for a valid image response.
 * @param {string} url
 * @param {string} method - 'HEAD' or 'GET'
 * @param {number} redirectsLeft
 * @returns {Promise<{valid, status?, contentType?, warning?, error?}>}
 */
function checkUrl(url, method, redirectsLeft) {
  return new Promise((resolve) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      return resolve({ valid: false, error: 'Invalid URL format' })
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return resolve({ valid: false, error: 'URL must use http or https' })
    }

    const client = parsed.protocol === 'https:' ? https : http

    const req = client.request(parsed, {
      method,
      timeout: TIMEOUT_MS,
      headers: REQUEST_HEADERS
    }, (res) => {
      const status = res.statusCode

      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirectsLeft > 0) {
        res.resume()
        const redirectUrl = new URL(res.headers.location, url).href
        return checkUrl(redirectUrl, method, redirectsLeft - 1).then(resolve)
      }

      if (method === 'GET') {
        res.destroy()
      } else {
        res.resume()
      }

      if (status !== 200) {
        return resolve({ valid: false, status, error: `HTTP ${status}` })
      }

      const contentType = (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      const isImage = ALLOWED_CONTENT_TYPES.some(t => contentType.startsWith(t))

      resolve({
        valid: isImage,
        status,
        contentType,
        error: isImage ? null : `Not an image (${contentType || 'unknown'})`
      })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({ valid: false, error: `Timeout after ${TIMEOUT_MS}ms` })
    })

    req.on('error', (err) => {
      resolve({ valid: false, error: err.message })
    })

    req.end()
  })
}

/**
 * Validate an image URL.
 * - HEAD first, fallback to GET if HEAD is blocked (403/405)
 * - Hard fail: 404, 410, 5xx, timeout, unreachable, non-image content-type
 * - Soft pass (warning): 403 from CDN hotlink protection
 * Returns { valid, status?, contentType?, warning?, error? }
 */
async function validateImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }

  // Skip validation for internal storage URLs (already uploaded via our API)
  const s3Prefix = process.env.S3_URL_PREFIX
  if (s3Prefix && url.startsWith(s3Prefix)) {
    return { valid: true, status: 200, contentType: 'image/webp' }
  }

  // Try HEAD first
  const headResult = await checkUrl(url, 'HEAD', 3)
  if (headResult.valid) return headResult

  // If HEAD got 403/405, retry with GET
  if (headResult.status === 403 || headResult.status === 405) {
    const getResult = await checkUrl(url, 'GET', 3)
    if (getResult.valid) return getResult

    // Still 403 after GET = CDN hotlink protection, allow with warning
    if (getResult.status === 403) {
      return {
        valid: true,
        status: 403,
        warning: 'CDN may block server-side requests (hotlink protection). Image may still work in browsers.'
      }
    }

    return getResult
  }

  // Hard fail on clearly broken URLs
  if (HARD_FAIL_STATUSES.includes(headResult.status)) {
    return headResult
  }

  // Other errors (timeout, connection refused, etc.)
  return headResult
}

module.exports = { validateImageUrl }
