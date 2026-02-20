#!/usr/bin/env node
/**
 * Re-upload imgflip images at full size (without /4/ thumbnail prefix)
 * and update existing problems with the new image URLs.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const API = 'https://titleclash.com';
const ADMIN_EMAIL = 'admin@titleclash.com';
const ADMIN_PASSWORD = '!au2222!';
const OUT_DIR = path.join(__dirname, 'meme_images_full');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Full-size URLs (without /4/ prefix) mapped to titles
const IMAGES = [
  { url: 'https://i.imgflip.com/1ur9b0.jpg', name: 'distracted-boyfriend', title: 'Man looking back at another woman while girlfriend watches' },
  { url: 'https://i.imgflip.com/22bdq6.jpg', name: 'left-exit-12', title: 'Car swerving to highway exit at the last second' },
  { url: 'https://i.imgflip.com/23ls.jpg', name: 'disaster-girl', title: 'Little girl smiling in front of a burning house' },
  { url: 'https://i.imgflip.com/24y43o.jpg', name: 'change-my-mind', title: 'Man sitting at table with a sign inviting debate' },
  { url: 'https://i.imgflip.com/28j0te.jpg', name: 'epic-handshake', title: 'Two muscular arms clasped in an epic handshake' },
  { url: 'https://i.imgflip.com/1c1uej.jpg', name: 'sad-pablo', title: 'Lonely man sitting on a swing in an empty mansion' },
  { url: 'https://i.imgflip.com/54hjww.jpg', name: 'trade-offer', title: 'Man in suit presenting a trade offer deal' },
  { url: 'https://i.imgflip.com/3oevdk.jpg', name: 'bernie-asking', title: 'Old politician asking for your support once again' },
  { url: 'https://i.imgflip.com/3lmzyx.jpg', name: 'uno-draw25', title: 'Man holding an absurd pile of UNO cards' },
  { url: 'https://i.imgflip.com/5c7lwq.jpg', name: 'anakin-padme', title: 'Couple having a conversation with growing concern' },
  { url: 'https://i.imgflip.com/46e43q.jpg', name: 'always-has-been', title: 'Two astronauts in space looking at Earth' },
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
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`
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
  if (res.status !== 200 || !res.data.token) throw new Error('Login failed');
  return res.data.token;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Logging in...');
  const token = await login();

  // Get existing problems to find matching ones by title
  const res = await httpJson('GET', `${API}/api/v1/problems?limit=100`, token);
  const problems = Array.isArray(res.data) ? res.data : (res.data.data || []);
  console.log(`Found ${problems.length} existing problems`);

  let updated = 0;

  for (const img of IMAGES) {
    // Find the matching problem by title
    const problem = problems.find(p => p.title === img.title);
    if (!problem) {
      console.log(`SKIP (not found): ${img.name} - "${img.title}"`);
      continue;
    }

    const filePath = path.join(OUT_DIR, `${img.name}.jpg`);

    // Download full-size
    if (!fs.existsSync(filePath)) {
      console.log(`Downloading full-size: ${img.url}`);
      const data = await httpGet(img.url);
      fs.writeFileSync(filePath, data);
      console.log(`  Saved: ${(data.length / 1024).toFixed(1)} KB`);
    } else {
      const stat = fs.statSync(filePath);
      console.log(`Already downloaded: ${img.name} (${(stat.size / 1024).toFixed(1)} KB)`);
    }

    // Upload new image
    console.log(`  Uploading full-size...`);
    const upRes = await httpUpload(`${API}/api/v1/upload/image`, token, filePath);
    if (upRes.status !== 201) {
      console.log(`  FAIL upload: ${upRes.status} ${JSON.stringify(upRes.data)}`);
      continue;
    }
    const newUrl = upRes.data.url;
    console.log(`  New URL: ${newUrl} (${upRes.data.width}x${upRes.data.height})`);

    // Update problem with new image URL
    const patchRes = await httpJson('PATCH', `${API}/api/v1/problems/${problem.id}`, token, {
      image_url: newUrl,
    });
    if (patchRes.status === 200) {
      console.log(`  Updated problem ${problem.id}`);
      updated++;
    } else {
      console.log(`  FAIL update: ${patchRes.status} ${JSON.stringify(patchRes.data)}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone! Updated ${updated} problems with full-size images.`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
