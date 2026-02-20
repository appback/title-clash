// Upload controller: image upload via multer + sharp
const multer = require('multer')
const { uploadImage } = require('../../services/storage')
const { processImage } = require('../../utils/imageProcessor')
const { ValidationError } = require('../../utils/errors')

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB (원본 허용, 리사이즈 후 줄어듦)

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
