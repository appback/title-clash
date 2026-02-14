/**
 * Crop 제목학원 images: remove checkered border and text at bottom, keep only the photo.
 *
 * Layout pattern: [26px checkered border] -> [photo] -> [text at bottom] -> [26px checkered border]
 * All 제목학원 images have a consistent 26px checkered border on all sides.
 * Strategy: skip 26px border, then scan for text area at the bottom of the content.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.join(__dirname, 'blog_samples');
const OUTPUT_DIR = path.join(__dirname, 'cropped');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Consistent border size for 제목학원 format
const BORDER = 26;

async function analyzeAndCrop(filepath) {
  const img = sharp(filepath);
  const metadata = await img.metadata();
  const { width, height } = metadata;

  const { data, info } = await img
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const cL = BORDER, cT = BORDER, cR = width - BORDER, cB = height - BORDER;
  const pixelsPerRow = cR - cL;

  // Analyze a row: get color saturation, variance, and mean brightness
  function analyzeRow(y) {
    let colorful = 0, sum = 0, sumSq = 0;
    for (let x = cL; x < cR; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const brightness = (r + g + b) / 3;
      sum += brightness;
      sumSq += brightness * brightness;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 25) colorful++;
    }
    const mean = sum / pixelsPerRow;
    const variance = (sumSq / pixelsPerRow) - (mean * mean);
    return { colorPct: colorful / pixelsPerRow, variance, mean };
  }

  // Check if image has color content (not grayscale)
  const sampleRows = [cT + 20, cT + 50, cT + 100, Math.floor((cT + cB) / 2)];
  let maxColor = 0;
  for (const y of sampleRows) {
    if (y < cB) {
      const { colorPct } = analyzeRow(y);
      maxColor = Math.max(maxColor, colorPct);
    }
  }
  const isColorPhoto = maxColor > 0.2;

  // Find photo bottom boundary by scanning from bottom upward
  let photoEnd = cB;

  if (isColorPhoto) {
    // Color photos: scan for colorful rows (text/whitespace has ~0% color)
    let nonPhotoStreak = 0;
    for (let y = cB - 1; y > cT + 20; y--) {
      const { colorPct } = analyzeRow(y);
      if (colorPct > 0.15) {
        if (nonPhotoStreak > 5) {
          photoEnd = y + 1;
          break;
        }
        nonPhotoStreak = 0;
      } else {
        nonPhotoStreak++;
      }
    }
  } else {
    // Grayscale: use variance-based with multi-pass to skip past text bands
    // Scan from bottom, find ALL low-var blocks, use topmost boundary
    let bestTextStart = cB;
    let lowVarCount = 0;

    for (let y = cB - 1; y > cT + Math.floor((cB - cT) * 0.3); y--) {
      const { variance, mean } = analyzeRow(y);
      const isLowVar = (variance < 500 && mean > 170) || variance < 200;
      if (isLowVar) {
        lowVarCount++;
      } else {
        if (lowVarCount > 8) {
          bestTextStart = y + 1;
          // Don't break - continue scanning to find higher boundary
        }
        lowVarCount = 0;
      }
    }
    if (lowVarCount > 8) {
      bestTextStart = cT + Math.floor((cB - cT) * 0.3);
    }
    photoEnd = bestTextStart;
  }

  // Ensure we keep at least 40% of the content height
  const minHeight = Math.floor((cB - cT) * 0.4);
  if (photoEnd - cT < minHeight) {
    photoEnd = cT + Math.floor((cB - cT) * 0.75);
  }

  const pad = 1;
  const cropLeft = cL + pad;
  const cropTop = cT + pad;
  const cropWidth = Math.max(cR - cL - pad * 2, 50);
  const cropHeight = Math.max(photoEnd - cT - pad, 50);

  return { cropLeft, cropTop, cropWidth, cropHeight, originalWidth: width, originalHeight: height };
}

async function processAll() {
  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => f.startsWith('img_') && f.endsWith('.png'))
    .sort();

  console.log(`Processing ${files.length} images...\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const inPath = path.join(INPUT_DIR, file);
    const outPath = path.join(OUTPUT_DIR, file.replace('.png', '.jpg'));

    try {
      const crop = await analyzeAndCrop(inPath);

      await sharp(inPath)
        .extract({
          left: crop.cropLeft,
          top: crop.cropTop,
          width: crop.cropWidth,
          height: crop.cropHeight
        })
        .jpeg({ quality: 90 })
        .toFile(outPath);

      const outSize = fs.statSync(outPath).size;
      console.log(`OK ${file} -> ${Math.round(outSize / 1024)}KB (${crop.cropWidth}x${crop.cropHeight} from ${crop.originalWidth}x${crop.originalHeight})`);
      success++;
    } catch (err) {
      console.log(`FAIL ${file}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} OK, ${failed} failed`);
}

processAll();
