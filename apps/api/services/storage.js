// storage.js - S3/local storage abstraction service
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const STORAGE_MODE = process.env.STORAGE_MODE || 's3'
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

let s3Client = null
if (STORAGE_MODE === 's3') {
  s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' })
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

  if (STORAGE_MODE === 's3') {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }))
    const url = `${process.env.S3_URL_PREFIX}/${key}`
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

module.exports = { uploadImage }
