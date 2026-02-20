/**
 * Upload cropped 제목학원 images to TitleClash and register as problems.
 *
 * Requires: admin credentials, production API at titleclash.com
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API_BASE = process.env.API_BASE || 'https://titleclash.com';
const ADMIN_EMAIL = 'admin@titleclash.com';
const ADMIN_PASSWORD = '!au2222!';
const CROPPED_DIR = path.join(__dirname, 'cropped');

// Best 15 images selected for TitleClash problems
const SELECTED_IMAGES = [
  { file: 'img_019.jpg', title: '화분 속 고양이' },           // Kitten facepalm in pot
  { file: 'img_005.jpg', title: '표범의 눈빛' },              // Leopard stare
  { file: 'img_011.jpg', title: '펭귄 세 마리' },              // 3 penguins
  { file: 'img_020.jpg', title: '방충망에 매달린 고양이' },    // Cat on screen door
  { file: 'img_021.jpg', title: '스모 경기장' },               // Sumo with referee
  { file: 'img_026.jpg', title: '시바견의 표정' },              // Shiba Inu face
  { file: 'img_044.jpg', title: '고질라 동상' },               // Godzilla statue
  { file: 'img_052.jpg', title: '미얀마 불상' },               // Myanmar Buddha
  { file: 'img_038.jpg', title: '일본 축구 골 세리머니' },     // Japan soccer celebration
  { file: 'img_024.jpg', title: '럭비 선수들' },               // Rugby players
  { file: 'img_016.jpg', title: '운하 옆 자전거' },            // Bicycle by canal
  { file: 'img_050.jpg', title: '사모예드 전후' },             // Samoyed before/after
  { file: 'img_029.jpg', title: '일본 스님의 미소' },           // Japanese monk smile
  { file: 'img_048.jpg', title: '미끄럼틀 시찰' },             // Playground inspection
  { file: 'img_008.jpg', title: '복도에서 포즈' },             // Hallway pose
];

function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const mod = isHttps ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function uploadFile(url, token, filepath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fileData = fs.readFileSync(filepath);
    const filename = path.basename(filepath);

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileData, footer]);

    const isHttps = url.startsWith('https');
    const urlObj = new URL(url);
    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Authorization': `Bearer ${token}`,
      }
    };

    const mod = isHttps ? https : http;
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: Login
  console.log('Logging in...');
  const loginRes = await makeRequest(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));

  if (loginRes.status !== 200 || !loginRes.data.token) {
    console.error('Login failed:', loginRes.status, loginRes.data);
    return;
  }

  const token = loginRes.data.token;
  console.log('Logged in successfully.\n');

  // Step 2: Upload images and create problems
  let success = 0;
  for (const item of SELECTED_IMAGES) {
    const filepath = path.join(CROPPED_DIR, item.file);
    if (!fs.existsSync(filepath)) {
      console.log(`SKIP ${item.file}: file not found`);
      continue;
    }

    // Upload image
    console.log(`Uploading ${item.file}...`);
    const uploadRes = await uploadFile(`${API_BASE}/api/v1/upload/image`, token, filepath);

    if (uploadRes.status !== 201 || !uploadRes.data.url) {
      console.log(`  UPLOAD FAIL: ${uploadRes.status} ${JSON.stringify(uploadRes.data)}`);
      continue;
    }

    const imageUrl = uploadRes.data.url;
    console.log(`  Uploaded: ${imageUrl} (${uploadRes.data.width}x${uploadRes.data.height})`);

    // Create problem
    const problemRes = await makeRequest(`${API_BASE}/api/v1/problems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, JSON.stringify({
      title: item.title,
      image_url: imageUrl,
      description: '제목학원 - 이 사진에 어울리는 재밌는 제목을 지어주세요!'
    }));

    if (problemRes.status === 201) {
      console.log(`  Problem #${problemRes.data.id} created: "${item.title}" [${problemRes.data.state}]`);
      success++;
    } else {
      console.log(`  PROBLEM FAIL: ${problemRes.status} ${JSON.stringify(problemRes.data)}`);
    }

    console.log('');
  }

  console.log(`\nDone: ${success}/${SELECTED_IMAGES.length} problems created.`);
}

main().catch(err => console.error('Error:', err));
