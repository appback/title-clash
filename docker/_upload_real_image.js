/**
 * Upload a visible test image (colorful gradient) to MinIO via API
 * and update existing problems to use it.
 */
const http = require('http')
const crypto = require('crypto')

const API = 'http://localhost:3000'

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API)
    const data = typeof body === 'string' ? body : body ? JSON.stringify(body) : null
    const isMultipart = Buffer.isBuffer(body)

    const headers = {}
    if (token) headers['Authorization'] = 'Bearer ' + token
    if (data && !isMultipart) headers['Content-Type'] = 'application/json'

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    }, (res) => {
      let chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString()
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }) }
        catch { resolve({ status: res.statusCode, data: text }) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function multipartUpload(path, fieldName, filename, fileBuffer, contentType, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API)
    const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex')

    let body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ])

    const headers = {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': body.length
    }
    if (token) headers['Authorization'] = 'Bearer ' + token

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers
    }, (res) => {
      let chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString()
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }) }
        catch { resolve({ status: res.statusCode, data: text }) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// Create a 400x300 PNG with colorful blocks (a simple but visible image)
function createColorfulPng() {
  const width = 400
  const height = 300

  // PNG minimal structure
  function crc32(buf) {
    let c = 0xFFFFFFFF
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let k = n
      for (let i = 0; i < 8; i++) k = k & 1 ? 0xEDB88320 ^ (k >>> 1) : k >>> 1
      table[n] = k
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeAndData = Buffer.concat([Buffer.from(type), data])
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(typeAndData))
    return Buffer.concat([len, typeAndData, crcBuf])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type RGB
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // IDAT - raw image data with filter byte
  const rawData = []
  for (let y = 0; y < height; y++) {
    rawData.push(0) // filter: none
    for (let x = 0; x < width; x++) {
      // Create a gradient/pattern
      const r = Math.floor((x / width) * 255)
      const g = Math.floor((y / height) * 255)
      const b = Math.floor(((x + y) / (width + height)) * 200 + 55)
      rawData.push(r, g, b)
    }
  }

  const { deflateSync } = require('zlib')
  const compressed = deflateSync(Buffer.from(rawData))

  // IEND
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

async function main() {
  console.log('1. Logging in as admin...')
  const loginRes = await request('POST', '/api/v1/auth/login', {
    email: 'admin@titleclash.com',
    password: '!au2222!'
  })
  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes)
    return
  }
  const token = loginRes.data.token || loginRes.data.data?.token
  console.log('   Token:', token ? token.substring(0, 20) + '...' : 'MISSING')

  console.log('2. Creating colorful test image...')
  const pngBuffer = createColorfulPng()
  console.log('   PNG size:', pngBuffer.length, 'bytes')

  console.log('3. Uploading image...')
  const uploadRes = await multipartUpload('/api/v1/upload/image', 'image', 'test-battle.png', pngBuffer, 'image/png', token)
  console.log('   Upload status:', uploadRes.status)
  console.log('   Upload result:', JSON.stringify(uploadRes.data))

  const imageUrl = uploadRes.data?.url || uploadRes.data?.data?.url
  if (!imageUrl) {
    console.error('No image URL in upload response')
    return
  }
  console.log('   Image URL:', imageUrl)

  console.log('4. Fetching existing problems...')
  const problemsRes = await request('GET', '/api/v1/problems', null, token)
  const problems = problemsRes.data?.data || problemsRes.data || []
  console.log('   Found', problems.length, 'problems')

  for (const p of problems) {
    console.log('5. Updating problem', p.id, '(' + p.title + ') with image...')
    const updateRes = await request('PATCH', '/api/v1/problems/' + p.id, {
      image_url: imageUrl
    }, token)
    console.log('   Update status:', updateRes.status)
  }

  console.log('Done! Image URL:', imageUrl)
}

main().catch(console.error)
