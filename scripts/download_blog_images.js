const fs = require('fs');
const https = require('https');
const path = require('path');

const html = fs.readFileSync(__dirname + '/naver_blog.html', 'utf8');

// Extract thumburl from <span class="_img _inl fx" thumburl="...">
const thumbRegex = /thumburl="(https:\/\/mblogthumb-phinf\.pstatic\.net\/[^"]+)"/gi;
const urls = [];
let m;
while ((m = thumbRegex.exec(html)) !== null) {
  const url = m[1].replace(/&amp;/g, '&');
  if (!urls.includes(url)) urls.push(url);
}

console.log(`Found ${urls.length} blog content images`);

const dir = path.join(__dirname, 'blog_samples');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function download(url, filepath) {
  const fullUrl = url.includes('?type=') ? url.replace(/\?type=.*/, '?type=w2') : url + '?type=w2';
  return new Promise((resolve) => {
    const file = fs.createWriteStream(filepath);
    https.get(fullUrl, {
      headers: {
        'Referer': 'https://m.blog.naver.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', () => { resolve(); });
  });
}

async function main() {
  for (let i = 0; i < urls.length; i++) {
    const filename = `img_${String(i + 1).padStart(3, '0')}.png`;
    const filepath = path.join(dir, filename);
    await download(urls[i], filepath);
    const size = fs.statSync(filepath).size;
    console.log(`${i + 1}/${urls.length} ${filename} (${Math.round(size / 1024)}KB) - ${urls[i].split('/').pop().split('?')[0]}`);
  }
  console.log('\nDone!');
}

main();
