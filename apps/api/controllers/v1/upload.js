// Upload controller: image upload via multer + sharp
const multer = require('multer')
const path = require('path')
const sharp = require('sharp')
const { uploadImage } = require('../../services/storage')
const { ValidationError } = require('../../utils/errors')

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB (원본 허용, 리사이즈 후 줄어듦)
const TARGET_WIDTH = 800
const MAX_DIMENSION = 2000

// Multer config: memory storage (buffer in memory before processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(new ValidationError('허용되지 않는 파일 형식입니다 (jpeg, png, webp, gif만 가능)'))
      return
    }
    cb(null, true)
  }
}).single('image')

/**
 * Process image: resize to 800px width, cap at 2000x2000, compress.
 * - Width > 800px → resize to 800px (aspect ratio maintained)
 * - Either dimension > 2000px → fit within 2000x2000
 * - Output as WebP (best compression) with 85% quality
 */
async function processImage(buffer) {
  const metadata = await sharp(buffer).metadata()
  const { width, height } = metadata

  let pipeline = sharp(buffer).rotate() // auto-rotate by EXIF

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    // First cap within 2000x2000
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true
    })
  }

  if (width > TARGET_WIDTH) {
    // Resize to 800px width
    pipeline = pipeline.resize(TARGET_WIDTH, null, {
      fit: 'inside',
      withoutEnlargement: true
    })
  }

  const processed = await pipeline
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true })

  return {
    buffer: processed.data,
    width: processed.info.width,
    height: processed.info.height,
    size: processed.data.length,
    originalWidth: width,
    originalHeight: height
  }
}

/**
 * POST /api/v1/upload/image
 * Upload an image. Admin only.
 * Auto-resizes to 800px width, caps at 2000x2000, outputs WebP.
 */
async function uploadImageHandler(req, res, next) {
  upload(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          throw new ValidationError('파일 크기가 10MB를 초과합니다')
        }
        throw err
      }

      if (!req.file) {
        throw new ValidationError('이미지 파일이 필요합니다')
      }

      const processed = await processImage(req.file.buffer)
      const result = await uploadImage(processed.buffer, '.webp', 'image/webp')

      res.status(201).json({
        url: result.url,
        key: result.key,
        content_type: 'image/webp',
        size: processed.size,
        width: processed.width,
        height: processed.height,
        original: {
          width: processed.originalWidth,
          height: processed.originalHeight,
          size: req.file.size
        }
      })
    } catch (uploadErr) {
      next(uploadErr)
    }
  })
}

module.exports = { uploadImage: uploadImageHandler }
