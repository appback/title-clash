// storage.js - S3/local storage abstraction service
const { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3')
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
  const endpoint = configManager.getString('s3_endpoint', '') || process.env.S3_ENDPOINT
  if (!s3Client) {
    const opts = { region }
    if (endpoint) {
      opts.endpoint = endpoint
      opts.forcePathStyle = true
    }
    s3Client = new S3Client(opts)
  }
  return s3Client
}

let bucketEnsured = false

/**
 * Ensure the S3 bucket exists, creating it if necessary.
 * Called once before the first upload.
 */
async function ensureBucket() {
  if (bucketEnsured) return
  const bucket = configManager.getString('s3_bucket', '') || process.env.S3_BUCKET
  if (!bucket) return
  const client = getS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      await client.send(new CreateBucketCommand({ Bucket: bucket }))
      // Set public-read policy so uploaded images are accessible via URL
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`]
        }]
      })
      await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }))
    } else {
      throw err
    }
  }
  bucketEnsured = true
}

/**
 * Reset S3 client (called after config refresh to pick up new settings).
 */
function resetS3Client() {
  s3Client = null
  bucketEnsured = false
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

    await ensureBucket()
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
