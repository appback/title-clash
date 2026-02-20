#!/usr/bin/env node
/**
 * TitleClash Image Crawler & Registrator
 *
 * Crawls image URLs from web pages, downloads them, uploads to TitleClash API,
 * and registers as problems (optionally transitions to voting state).
 *
 * Usage:
 *   node crawl_images.js <url> [options]
 *   node crawl_images.js --file <path-to-html> [options]
 *
 * Options:
 *   --api <base>       API base URL (default: https://titleclash.com)
 *   --file <path>      Use local HTML file instead of fetching URL
 *   --out <dir>        Download directory (default: ./crawled_images)
 *   --limit <n>        Max images to process (default: 20)
 *   --min-size <kb>    Skip images smaller than N KB (default: 10)
 *   --state <state>    Target state: draft|open|voting (default: voting)
 *   --dry-run          Download only, don't upload/register
 *   --title-prefix <p> Prefix for generated titles (default: auto from page)
 *   --help             Show this help
 *
 * Examples:
 *   node crawl_images.js https://example.com/blog/funny-images
 *   node crawl_images.js https://example.com --limit 10 --state draft
 *   node crawl_images.js --file ./saved_page.html --out ./my_images
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// --- Config ---
const ADMIN_EMAIL = 'admin@titleclash.com';
const ADMIN_PASSWORD = '!au2222!';
const DEFAULT_API = 'https://titleclash.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// --- Arg parsing ---
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    url: null,
    api: DEFAULT_API,
    file: null,
    out: path.join(__dirname, 'crawled_images'),
    limit: 20,
    minSize: 10,
    state: 'voting',
    dryRun: false,
    titlePrefix: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') { opts.help = true; }
    else if (a === '--api') { opts.api = args[++i]; }
    else if (a === '--file') { opts.file = args[++i]; }
    else if (a === '--out') { opts.out = args[++i]; }
    else if (a === '--limit') { opts.limit = parseInt(args[++i], 10); }
    else if (a === '--min-size') { opts.minSize = parseInt(args[++i], 10); }
    else if (a === '--state') { opts.state = args[++i]; }
    else if (a === '--dry-run') { opts.dryRun = true; }
    else if (a === '--title-prefix') { opts.titlePrefix = args[++i]; }
    else if (!a.startsWith('-') && !opts.url) { opts.url = a; }
  }
  return opts;
}

// --- HTTP helpers ---
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, ...headers },
    };
    const req = mod.request(opts, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(httpGet(redirectUrl, headers));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, ...headers },
    };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function httpPatch(url, token, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'PATCH',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function uploadFile(url, token, filepath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fileData = fs.readFileSync(filepath);
    const filename = path.basename(filepath);
    const ext = path.extname(filename).toLowerCase();
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
    const mime = mimeMap[ext] || 'image/jpeg';

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileData, footer]);

    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const opts = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Authorization': `Bearer ${token}`,
      },
    };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// --- Image URL extraction ---
function extractImageUrls(html, baseUrl) {
  const urls = new Set();

  // Standard img src
  const srcPatterns = [
    /src=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"']*)?)/gi,
    /data-src=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"']*)?)/gi,
    /data-lazy-src=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"']*)?)/gi,
    /data-original=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"']*)?)/gi,
    /content=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"']*)?)/gi,
  ];

  // Naver blog specific: thumburl attribute
  const naverPattern = /thumburl="(https:\/\/[^"]+)"/gi;

  // Tistory/CDN specific: img with data in src
  const tistoryPattern = /src=["'](https:\/\/(?:img1\.daumcdn|t1\.daumcdn|k\.kakaocdn|tistory\.com\/[^"']+)\.(?:jpg|jpeg|png|webp|gif)[^"']*)/gi;

  for (const regex of [...srcPatterns, naverPattern, tistoryPattern]) {
    let m;
    while ((m = regex.exec(html)) !== null) {
      let url = m[1].replace(/&amp;/g, '&');
      // Make absolute
      if (url.startsWith('//')) url = 'https:' + url;
      else if (url.startsWith('/') && baseUrl) {
        const u = new URL(baseUrl);
        url = u.origin + url;
      }
      if (url.startsWith('http')) urls.add(url);
    }
  }

  // Bare URLs in text (for JSON/script blocks)
  const barePattern = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?)/gi;
  let bm;
  while ((bm = barePattern.exec(html)) !== null) {
    const url = bm[1].replace(/&amp;/g, '&');
    if (url.length > 30) urls.add(url);
  }

  // Filter out common non-content images (icons, logos, nav)
  const filtered = [...urls].filter(u => {
    const lower = u.toLowerCase();
    return !(
      lower.includes('logo') ||
      lower.includes('icon') ||
      lower.includes('favicon') ||
      lower.includes('avatar') ||
      lower.includes('button') ||
      lower.includes('banner_ad') ||
      lower.includes('ad_') ||
      lower.includes('/static/') ||
      lower.includes('emoji') ||
      lower.includes('sprite') ||
      (lower.includes('naver') && lower.includes('static'))
    );
  });

  return filtered;
}

// --- Download image ---
async function downloadImage(url, filepath, referer) {
  try {
    const headers = { 'User-Agent': USER_AGENT };
    if (referer) headers['Referer'] = referer;

    // For Naver images, request larger version
    let fetchUrl = url;
    if (url.includes('pstatic.net') && url.includes('?type=')) {
      fetchUrl = url.replace(/\?type=.*/, '?type=w2');
    }

    const data = await httpGet(fetchUrl, headers);
    fs.writeFileSync(filepath, data);
    return data.length;
  } catch (err) {
    console.log(`  Download error: ${err.message}`);
    return 0;
  }
}

// --- Deduplicate by file content hash ---
function getFileHash(filepath) {
  const crypto = require('crypto');
  const data = fs.readFileSync(filepath);
  return crypto.createHash('md5').digest('hex');
}

function getSimpleHash(filepath) {
  const stat = fs.statSync(filepath);
  return `${stat.size}`;
}

// --- Main ---
async function main() {
  const opts = parseArgs();

  if (opts.help || (!opts.url && !opts.file)) {
    console.log(fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1]
      .split('\n').map(l => l.replace(/^ \* ?/, '')).join('\n'));
    process.exit(0);
  }

  console.log('=== TitleClash Image Crawler ===\n');

  // Step 1: Get HTML
  let html;
  let pageUrl = opts.url;

  if (opts.file) {
    console.log(`Reading local file: ${opts.file}`);
    html = fs.readFileSync(opts.file, 'utf8');
    pageUrl = opts.url || 'http://localhost';
  } else {
    console.log(`Fetching: ${opts.url}`);
    try {
      const buf = await httpGet(opts.url, { 'Referer': opts.url });
      html = buf.toString('utf8');
      console.log(`  Page size: ${Math.round(html.length / 1024)} KB`);
    } catch (err) {
      console.error(`Failed to fetch URL: ${err.message}`);
      process.exit(1);
    }
  }

  // Extract page title for auto-prefix
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : 'Untitled';
  console.log(`  Page title: ${pageTitle}`);

  // Step 2: Extract image URLs
  const imageUrls = extractImageUrls(html, pageUrl);
  console.log(`\nFound ${imageUrls.length} image URLs`);

  if (imageUrls.length === 0) {
    console.log('No images found. Try --file with saved HTML.');
    process.exit(0);
  }

  // Step 3: Download images
  if (!fs.existsSync(opts.out)) fs.mkdirSync(opts.out, { recursive: true });

  const referer = pageUrl;
  const downloaded = [];
  const seenSizes = new Set();

  console.log(`\nDownloading to: ${opts.out}`);
  console.log(`Limit: ${opts.limit}, Min size: ${opts.minSize} KB\n`);

  for (let i = 0; i < imageUrls.length && downloaded.length < opts.limit; i++) {
    const url = imageUrls[i];
    const ext = (url.match(/\.(jpg|jpeg|png|webp|gif)/i) || [null, 'jpg'])[1].toLowerCase();
    const filename = `img_${String(i + 1).padStart(3, '0')}.${ext}`;
    const filepath = path.join(opts.out, filename);

    process.stdout.write(`  [${i + 1}/${imageUrls.length}] ${filename}...`);
    const size = await downloadImage(url, filepath, referer);
    const sizeKb = Math.round(size / 1024);

    if (size === 0) {
      console.log(' FAILED');
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      continue;
    }

    if (sizeKb < opts.minSize) {
      console.log(` SKIP (${sizeKb} KB < ${opts.minSize} KB min)`);
      fs.unlinkSync(filepath);
      continue;
    }

    // Simple dedup by file size (crude but catches exact duplicates)
    const sizeKey = `${size}`;
    if (seenSizes.has(sizeKey)) {
      console.log(` SKIP (duplicate ${sizeKb} KB)`);
      fs.unlinkSync(filepath);
      continue;
    }
    seenSizes.add(sizeKey);

    console.log(` OK (${sizeKb} KB)`);
    downloaded.push({ filepath, filename, url, sizeKb });
  }

  console.log(`\nDownloaded: ${downloaded.length} images`);

  if (opts.dryRun) {
    console.log('\n--dry-run mode: skipping upload and registration.');
    process.exit(0);
  }

  if (downloaded.length === 0) {
    console.log('No images to upload.');
    process.exit(0);
  }

  // Step 4: Login to API
  console.log(`\nLogging in to ${opts.api}...`);
  const loginRes = await httpPost(`${opts.api}/api/v1/auth/login`, {
    'Content-Type': 'application/json',
  }, JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));

  if (loginRes.status !== 200 || !loginRes.data.token) {
    console.error('Login failed:', loginRes.status, loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.token;
  console.log('Logged in.\n');

  // Step 5: Upload and register
  const prefix = opts.titlePrefix || pageTitle.substring(0, 30);
  const results = [];

  for (let i = 0; i < downloaded.length; i++) {
    const { filepath, filename, sizeKb } = downloaded[i];
    const title = `${prefix} #${i + 1}`;

    process.stdout.write(`  [${i + 1}/${downloaded.length}] Uploading ${filename} (${sizeKb} KB)...`);

    // Upload image
    const uploadRes = await uploadFile(`${opts.api}/api/v1/upload/image`, token, filepath);
    if (uploadRes.status !== 201 || !uploadRes.data.url) {
      console.log(` UPLOAD FAIL: ${uploadRes.status}`);
      continue;
    }
    const imageUrl = uploadRes.data.url;

    // Create problem
    const problemRes = await httpPost(`${opts.api}/api/v1/problems`, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }, JSON.stringify({
      title,
      image_url: imageUrl,
      description: '이 사진에 어울리는 재밌는 제목을 지어주세요!',
    }));

    if (problemRes.status !== 201) {
      console.log(` PROBLEM FAIL: ${problemRes.status}`);
      continue;
    }

    const problemId = problemRes.data.id;
    let finalState = 'draft';

    // Transition state if needed
    if (opts.state !== 'draft') {
      const transitions = [];
      if (opts.state === 'open' || opts.state === 'voting') transitions.push('open');
      if (opts.state === 'voting') transitions.push('voting');

      for (const targetState of transitions) {
        const patchRes = await httpPatch(
          `${opts.api}/api/v1/problems/${problemId}`,
          token,
          { state: targetState }
        );
        if (patchRes.status === 200) {
          finalState = targetState;
        } else {
          console.log(` STATE FAIL (${targetState}): ${patchRes.status}`);
          break;
        }
      }
    }

    console.log(` OK → ${finalState} (${problemId.substring(0, 8)})`);
    results.push({ problemId, title, finalState, imageUrl });
  }

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Downloaded: ${downloaded.length}`);
  console.log(`Registered: ${results.length}`);
  console.log(`Final state: ${opts.state}`);
  console.log(`Problems:`);
  for (const r of results) {
    console.log(`  ${r.problemId.substring(0, 8)} [${r.finalState}] "${r.title}"`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
