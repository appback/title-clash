#!/usr/bin/env node
/**
 * Download popular meme template images and register as TitleClash problems.
 * Only real photo/screenshot based templates (no cartoons/drawings).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const API = 'https://titleclash.com';
const ADMIN_EMAIL = 'admin@titleclash.com';
const ADMIN_PASSWORD = '!au2222!';
const OUT_DIR = path.join(__dirname, 'meme_images');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Selected photo-based meme templates from imgflip (no cartoons)
const IMAGES = [
  { url: 'https://i.imgflip.com/4/1ur9b0.jpg', name: 'distracted-boyfriend', title: 'Man looking back at another woman while girlfriend watches' },
  { url: 'https://i.imgflip.com/4/22bdq6.jpg', name: 'left-exit-12', title: 'Car swerving to highway exit at the last second' },
  { url: 'https://i.imgflip.com/4/23ls.jpg', name: 'disaster-girl', title: 'Little girl smiling in front of a burning house' },
  { url: 'https://i.imgflip.com/4/24y43o.jpg', name: 'change-my-mind', title: 'Man sitting at table with a sign inviting debate' },
  { url: 'https://i.imgflip.com/4/28j0te.jpg', name: 'epic-handshake', title: 'Two muscular arms clasped in an epic handshake' },
  { url: 'https://i.imgflip.com/4/1c1uej.jpg', name: 'sad-pablo', title: 'Lonely man sitting on a swing in an empty mansion' },
  { url: 'https://i.imgflip.com/4/54hjww.jpg', name: 'trade-offer', title: 'Man in suit presenting a trade offer deal' },
  { url: 'https://i.imgflip.com/4/3oevdk.jpg', name: 'bernie-asking', title: 'Old politician asking for your support once again' },
  { url: 'https://i.imgflip.com/4/3lmzyx.jpg', name: 'uno-draw25', title: 'Man holding an absurd pile of UNO cards' },
  { url: 'https://i.imgflip.com/4/5c7lwq.jpg', name: 'anakin-padme', title: 'Couple having a conversation with growing concern' },
  { url: 'https://i.imgflip.com/4/2odckz.jpg', name: 'marked-safe', title: 'Facebook safety check notification template' },
  { url: 'https://i.imgflip.com/4/46e43q.jpg', name: 'always-has-been', title: 'Two astronauts in space looking at Earth' },
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    mod.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redir = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return resolve(httpGet(redir));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function httpJson(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const req = mod.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

function httpUpload(url, token, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fileData = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileData, footer]);

    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        Authorization: `Bearer ${token}`,
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Upload timeout')); });
    req.write(body);
    req.end();
  });
}

async function login() {
  const res = await httpJson('POST', `${API}/api/v1/auth/login`, null, {
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
  });
  if (res.status !== 200 || !res.data.token) throw new Error('Login failed: ' + JSON.stringify(res.data));
  return res.data.token;
}

async function getExistingProblems(token) {
  const res = await httpJson('GET', `${API}/api/v1/problems?limit=100`, token);
  const d = res.data;
  return Array.isArray(d) ? d : (d.data || d.problems || []);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Logging in...');
  const token = await login();
  console.log('OK');

  // Check existing problems to avoid duplicates (by title similarity)
  const existing = await getExistingProblems(token);
  const existingTitles = existing.map(p => p.title.toLowerCase());
  console.log(`Existing problems: ${existing.length}`);

  let registered = 0;

  for (const img of IMAGES) {
    // Skip if a similar title already exists
    const skip = existingTitles.some(t =>
      t.includes(img.name.replace(/-/g, ' ')) || t.includes(img.title.toLowerCase().slice(0, 30))
    );
    if (skip) {
      console.log(`SKIP (exists): ${img.name}`);
      continue;
    }

    const filePath = path.join(OUT_DIR, `${img.name}.jpg`);

    // Download
    if (!fs.existsSync(filePath)) {
      console.log(`Downloading: ${img.url}`);
      try {
        const data = await httpGet(img.url);
        if (data.length < 5000) {
          console.log(`  SKIP: too small (${data.length} bytes)`);
          continue;
        }
        fs.writeFileSync(filePath, data);
        console.log(`  Saved: ${filePath} (${(data.length / 1024).toFixed(1)} KB)`);
      } catch (e) {
        console.log(`  FAIL download: ${e.message}`);
        continue;
      }
    } else {
      console.log(`Already downloaded: ${img.name}`);
    }

    // Step 1: Upload image to get URL
    console.log(`  Uploading image...`);
    const upRes = await httpUpload(`${API}/api/v1/upload/image`, token, filePath);
    if (upRes.status !== 201 && upRes.status !== 200) {
      console.log(`  FAIL upload: ${upRes.status} ${JSON.stringify(upRes.data)}`);
      continue;
    }
    const imageUrl = upRes.data.url;
    console.log(`  Image URL: ${imageUrl}`);

    // Step 2: Create problem with title + image_url
    console.log(`  Creating problem...`);
    const createRes = await httpJson('POST', `${API}/api/v1/problems`, token, {
      title: img.title,
      image_url: imageUrl,
      description: 'Write a creative title for this image!',
    });
    if (createRes.status !== 201 && createRes.status !== 200) {
      console.log(`  FAIL create: ${createRes.status} ${JSON.stringify(createRes.data)}`);
      continue;
    }
    const problemId = createRes.data.id;
    console.log(`  Created problem: ${problemId}`);

    // Transition: draft → open → voting
    for (const state of ['open', 'voting']) {
      const tr = await httpJson('PATCH', `${API}/api/v1/problems/${problemId}`, token, { state });
      if (tr.status !== 200) {
        console.log(`  FAIL transition to ${state}: ${tr.status} ${JSON.stringify(tr.data)}`);
        break;
      }
      console.log(`  → ${state}`);
    }

    registered++;
    // Small delay
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone! Registered ${registered} new problems.`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
