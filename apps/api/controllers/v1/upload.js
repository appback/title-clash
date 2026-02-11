// Upload controller: image upload via multer
const multer = require('multer')
const path = require('path')
const { uploadImage } = require('../../services/storage')
const { ValidationError } = require('../../utils/errors')

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// Multer config: memory storage (buffer in memory before S3 upload)
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
 */
async function uploadImageHandler(req, res, next) {
  upload(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          throw new ValidationError('파일 크기가 5MB를 초과합니다')
        }
        throw err
      }

      if (!req.file) {
        throw new ValidationError('이미지 파일이 필요합니다')
      }

      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg'
      const result = await uploadImage(req.file.buffer, ext, req.file.mimetype)

      res.status(201).json({
        url: result.url,
        key: result.key,
        content_type: req.file.mimetype,
        size: req.file.size
      })
    } catch (uploadErr) {
      next(uploadErr)
    }
  })
}

module.exports = { uploadImage: uploadImageHandler }
