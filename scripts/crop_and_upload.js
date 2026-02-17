/**
 * crop_and_upload.js — Crop borders/text bars from images + upload to TitleClash API
 *
 * Usage:
 *   node scripts/crop_and_upload.js --crop-only --input <dir> --output <dir>
 *   node scripts/crop_and_upload.js --upload --input <dir>
 *   node scripts/crop_and_upload.js --input <dir> --output <dir>   (crop + upload)
 *
 * Defaults:
 *   --input   C:\Users\au212\Downloads\title\title
 *   --output  C:\tmp\cropped
 */
const sharp = require('../apps/api/node_modules/sharp')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

// Parse CLI args
const args = process.argv.slice(2)
function getArg(name, defaultVal) {
  const idx = args.indexOf(name)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal
}
const CROP_ONLY = args.includes('--crop-only')
const UPLOAD_ONLY = args.includes('--upload')
const INPUT_DIR = getArg('--input', 'C:/Users/au212/Downloads/title/title')
const OUTPUT_DIR = getArg('--output', 'C:/tmp/cropped')
const API_BASE = getArg('--api', 'https://titleclash.com')
const ADMIN_EMAIL = 'admin@titleclash.com'
const ADMIN_PASSWORD = '!au2222!'
const RESULTS_FILE = path.join(OUTPUT_DIR, 'upload_results.json')
const DELAY_MS = 2000

// ==========================================
// HTTP helpers (no external dependencies)
// ==========================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.request(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, data }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function uploadFile(url, token, filepath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const fileData = fs.readFileSync(filepath)
    const filename = path.basename(filepath)
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`
    )
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
    const body = Buffer.concat([header, fileData, footer])
    const urlObj = new URL(url)
    const mod = url.startsWith('https') ? https : http
    const req = mod.request({
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (url.startsWith('https') ? 443 : 80),
      path: urlObj.pathname,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, data }) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ==========================================
// Crop: border detection + text bar removal
// ==========================================
function detectBorderFromEdge(data, width, height, channels, edge) {
  const THRESHOLD = 30
  const UNIFORMITY = 0.92
  let borderSize = 0
  const maxScan = edge === 'top' || edge === 'bottom'
    ? Math.floor(height * 0.15)
    : Math.floor(width * 0.15)

  for (let i = 0; i < maxScan; i++) {
    const pixels = []
    if (edge === 'top') {
      for (let x = 0; x < width; x++) {
        const idx = (i * width + x) * channels
        pixels.push((data[idx] + data[idx + 1] + data[idx + 2]) / 3)
      }
    } else if (edge === 'bottom') {
      const y = height - 1 - i
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels
        pixels.push((data[idx] + data[idx + 1] + data[idx + 2]) / 3)
      }
    } else if (edge === 'left') {
      for (let y = 0; y < height; y++) {
        const idx = (y * width + i) * channels
        pixels.push((data[idx] + data[idx + 1] + data[idx + 2]) / 3)
      }
    } else {
      const x = width - 1 - i
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * channels
        pixels.push((data[idx] + data[idx + 1] + data[idx + 2]) / 3)
      }
    }
    const sorted = [...pixels].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const uniform = pixels.filter(p => Math.abs(p - median) < THRESHOLD).length / pixels.length
    if (uniform >= UNIFORMITY) {
      borderSize = i + 1
    } else {
      break
    }
  }
  return borderSize
}

function detectTextBar(data, width, height, channels, cTop, cBottom, cLeft, cRight, bgColor) {
  const contentWidth = cRight - cLeft
  let textBarHeight = 0
  const maxTextBar = Math.floor((cBottom - cTop) * 0.3)
  let consecutiveMiss = 0
  const MAX_MISS = 15 // allow text rows (dense Korean chars) within the bar

  for (let i = 0; i < maxTextBar; i++) {
    const y = cBottom - 1 - i
    if (y <= cTop) break
    let matchCount = 0
    let brightSum = 0
    for (let x = cLeft; x < cRight; x++) {
      const idx = (y * width + x) * channels
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
      brightSum += brightness
      if (bgColor === 'white' && brightness > 200) matchCount++
      else if (bgColor === 'black' && brightness < 55) matchCount++
    }
    const bgRatio = matchCount / contentWidth
    const meanBright = brightSum / contentWidth

    // A row is part of a text bar if:
    // 1. High bg ratio (>30% = relaxed from 50%) — pure background or sparse text
    // 2. OR mean brightness strongly suggests bg color even with dense text overlaid
    const isBgMatch = bgRatio > 0.3
    const isMeanMatch = (bgColor === 'white' && meanBright > 170) ||
                        (bgColor === 'black' && meanBright < 80)

    if (isBgMatch || isMeanMatch) {
      textBarHeight = i + 1
      consecutiveMiss = 0
    } else {
      consecutiveMiss++
      if (consecutiveMiss > MAX_MISS) break
    }
  }
  return textBarHeight
}

async function analyzeAndCrop(filepath) {
  const img = sharp(filepath)
  const metadata = await img.metadata()
  const { width, height } = metadata
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const channels = info.channels

  const borderTop = detectBorderFromEdge(data, width, height, channels, 'top')
  const borderBottom = detectBorderFromEdge(data, width, height, channels, 'bottom')
  const borderLeft = detectBorderFromEdge(data, width, height, channels, 'left')
  const borderRight = detectBorderFromEdge(data, width, height, channels, 'right')

  // Use full detected bottom border — border detection (92% uniformity) is reliable
  // Previous: cappedBottom = min(borderBottom, sideBorder * 1.5) lost valid border rows
  const cappedBottom = borderBottom

  const cTop = borderTop
  const cBottom = height - cappedBottom
  const cLeft = borderLeft
  const cRight = width - borderRight

  const textBarWhite = detectTextBar(data, width, height, channels, cTop, cBottom, cLeft, cRight, 'white')
  const textBarBlack = detectTextBar(data, width, height, channels, cTop, cBottom, cLeft, cRight, 'black')
  const textBar = Math.max(textBarWhite, textBarBlack)

  const contentHeight = cBottom - cTop
  const minPhotoHeight = Math.floor(contentHeight * 0.4)
  const adjustedTextBar = (contentHeight - textBar) < minPhotoHeight ? 0 : textBar

  return {
    cropLeft: cLeft, cropTop: cTop,
    cropWidth: Math.max(cRight - cLeft, 1),
    cropHeight: Math.max(contentHeight - adjustedTextBar, 1),
    originalWidth: width, originalHeight: height,
    borders: { top: borderTop, bottom: cappedBottom, left: borderLeft, right: borderRight },
    textBar: adjustedTextBar
  }
}

function listImages(dir) {
  return fs.readdirSync(dir)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort((a, b) => {
      const na = a.match(/\d+/g)?.map(Number) || [0]
      const nb = b.match(/\d+/g)?.map(Number) || [0]
      for (let i = 0; i < Math.max(na.length, nb.length); i++) {
        const diff = (na[i] || 0) - (nb[i] || 0)
        if (diff !== 0) return diff
      }
      return a.localeCompare(b)
    })
}

// ==========================================
// Crop all images
// ==========================================
async function cropAll() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const files = listImages(INPUT_DIR)
  console.log(`Found ${files.length} images in ${INPUT_DIR}\n`)
  let success = 0, failed = 0

  for (const file of files) {
    const inPath = path.join(INPUT_DIR, file)
    let outName = file.replace(/\.(png|jpg|jpeg|webp)$/i, '.jpg')
    if (outName.includes(' (')) outName = outName.replace(/ \(\d+\)/, '_dup')
    const outPath = path.join(OUTPUT_DIR, outName)

    try {
      const crop = await analyzeAndCrop(inPath)
      await sharp(inPath)
        .extract({ left: crop.cropLeft, top: crop.cropTop, width: crop.cropWidth, height: crop.cropHeight })
        .jpeg({ quality: 92 })
        .toFile(outPath)
      const sizeKB = Math.round(fs.statSync(outPath).size / 1024)
      console.log(
        `OK  ${file.padEnd(25)} -> ${outName.padEnd(25)} ${crop.cropWidth}x${crop.cropHeight} ` +
        `(borders: T${crop.borders.top} B${crop.borders.bottom} L${crop.borders.left} R${crop.borders.right}, textBar: ${crop.textBar}px) ${sizeKB}KB`
      )
      success++
    } catch (err) {
      console.log(`FAIL ${file}: ${err.message}`)
      failed++
    }
  }
  console.log(`\nCrop done: ${success} OK, ${failed} failed. Output: ${OUTPUT_DIR}`)
  return success
}

// ==========================================
// Upload all images from output dir
// ==========================================
async function uploadAll() {
  const files = listImages(OUTPUT_DIR)

  // Load existing results to skip already uploaded
  let existingResults = []
  if (fs.existsSync(RESULTS_FILE)) {
    try { existingResults = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')) } catch {}
  }
  const uploadedFiles = new Set(existingResults.map(r => r.file))
  const remaining = files.filter(f => !uploadedFiles.has(f))

  console.log(`Total: ${files.length}, Already uploaded: ${uploadedFiles.size}, Remaining: ${remaining.length}\n`)
  if (remaining.length === 0) { console.log('Nothing to upload.'); return }

  // Login
  console.log('Logging in...')
  const loginRes = await makeRequest(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }))

  if (loginRes.status !== 200 || !loginRes.data.token) {
    console.error('Login failed:', loginRes.status, loginRes.data)
    process.exit(1)
  }
  const token = loginRes.data.token
  console.log('Logged in.\n')

  const results = [...existingResults]
  let success = 0, failed = 0

  for (let i = 0; i < remaining.length; i++) {
    const file = remaining[i]
    const filepath = path.join(OUTPUT_DIR, file)
    const title = file.replace(/\.(jpg|jpeg|png|webp)$/i, '').replace(/\./g, '-')

    process.stdout.write(`[${i + 1}/${remaining.length}] ${file}... `)

    try {
      // Upload image
      let uploadRes = await uploadFile(`${API_BASE}/api/v1/upload/image`, token, filepath)
      if (uploadRes.status === 429) {
        console.log('RATE LIMITED - waiting 10s...')
        await sleep(10000)
        uploadRes = await uploadFile(`${API_BASE}/api/v1/upload/image`, token, filepath)
      }
      if (uploadRes.status !== 201 || !uploadRes.data.url) {
        console.log(`UPLOAD FAIL: ${uploadRes.status}`)
        failed++
        await sleep(DELAY_MS)
        continue
      }
      const imageUrl = uploadRes.data.url

      await sleep(500)

      // Create problem
      const problemRes = await makeRequest(`${API_BASE}/api/v1/problems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      }, JSON.stringify({
        title,
        image_url: imageUrl,
        description: '이 사진에 어울리는 재밌는 제목을 지어주세요!'
      }))

      if (problemRes.status !== 201) {
        console.log(`PROBLEM FAIL: ${problemRes.status}`)
        failed++
        await sleep(DELAY_MS)
        continue
      }
      const problemId = problemRes.data.id

      await sleep(500)

      // Open
      const openRes = await makeRequest(`${API_BASE}/api/v1/problems/${problemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      }, JSON.stringify({ state: 'open' }))

      const finalState = openRes.data?.state || 'unknown'
      console.log(`OK  Problem #${problemId} [${finalState}]`)

      results.push({ file, problemId, title, imageUrl, state: finalState })
      success++
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      failed++
    }

    await sleep(DELAY_MS)
  }

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))
  console.log(`\nUpload done: ${success} OK, ${failed} failed. Total: ${results.length}`)
  console.log(`Results: ${RESULTS_FILE}`)
}

// ==========================================
// Main
// ==========================================
async function main() {
  if (UPLOAD_ONLY) {
    await uploadAll()
  } else if (CROP_ONLY) {
    await cropAll()
  } else {
    // Full pipeline: crop then upload
    const cropped = await cropAll()
    if (cropped > 0) {
      console.log('\n--- Starting upload ---\n')
      await uploadAll()
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
