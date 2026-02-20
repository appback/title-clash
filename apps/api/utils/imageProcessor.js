// Shared image processing utility
const sharp = require('sharp')

const TARGET_WIDTH = 800
const MAX_DIMENSION = 2000

/**
 * Process image: resize to 800px width, cap at 2000x2000, compress.
 * - Width > 800px -> resize to 800px (aspect ratio maintained)
 * - Either dimension > 2000px -> fit within 2000x2000
 * - Output as WebP (best compression) with 85% quality
 */
async function processImage(buffer) {
  const metadata = await sharp(buffer).metadata()
  const { width, height } = metadata

  let pipeline = sharp(buffer).rotate() // auto-rotate by EXIF

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true
    })
  }

  if (width > TARGET_WIDTH) {
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

module.exports = { processImage }
