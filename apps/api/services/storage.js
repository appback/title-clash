// storage.js - S3/local storage abstraction service
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const configManager = require('./configManager')

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

let s3Client = null

function getStorageMode() {
  return configManager.getString('storage_mode', '') || process.env.STORAGE_MODE || 's3'
}

function getS3Client() {
  const region = configManager.getString('s3_region', '') || process.env.AWS_REGION || 'ap-northeast-2'
  if (!s3Client) {
    s3Client = new S3Client({ region })
  }
  return s3Client
}

/**
 * Reset S3 client (called after config refresh to pick up new settings).
 */
function resetS3Client() {
  s3Client = null
}

/**
 * Upload a file to storage and return a public URL.
 * @param {Buffer} buffer - File buffer
 * @param {string} ext - File extension (.jpg, .png, etc.)
 * @param {string} contentType - MIME type
 * @returns {Promise<{ url: string, key: string }>}
 */
async function uploadImage(buffer, ext, contentType) {
  const key = `images/${uuidv4()}${ext}`
  const mode = getStorageMode()

  if (mode === 's3') {
    const bucket = configManager.getString('s3_bucket', '') || process.env.S3_BUCKET
    const urlPrefix = configManager.getString('s3_url_prefix', '') || process.env.S3_URL_PREFIX

    await getS3Client().send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }))
    const url = `${urlPrefix}/${key}`
    return { url, key }
  } else {
    // Local mode
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }
    const filename = `${uuidv4()}${ext}`
    const filePath = path.join(UPLOAD_DIR, filename)
    fs.writeFileSync(filePath, buffer)
    const url = `/uploads/${filename}`
    return { url, key: filename }
  }
}

module.exports = { uploadImage, resetS3Client }
