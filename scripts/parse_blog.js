const fs = require('fs');
const html = fs.readFileSync(__dirname + '/naver_blog.html', 'utf8');

// Find ALL URLs that look like images
const patterns = [
  /src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/gi,
  /data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/gi,
  /data-lazy-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/gi,
  /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)[^\s"'<>]*)/gi,
];

const allUrls = new Set();
for (const regex of patterns) {
  let m;
  while ((m = regex.exec(html)) !== null) {
    const url = m[1].replace(/&amp;/g, '&');
    if (url.length > 30 && !url.includes('static.naver') && !url.includes('ssl.pstatic.net/imgblog')) {
      allUrls.add(url);
    }
  }
}

console.log('Page Title: 제목학원 모음 잔뜩가져왔어요~60장이상');
console.log('Found', allUrls.size, 'image URLs:\n');

let i = 1;
for (const url of allUrls) {
  console.log(i++ + '. ' + url.substring(0, 200));
}

// Check if it's a SPA that loads content dynamically
if (html.includes('__NEXT_DATA__') || html.includes('window.__INITIAL_DATA__')) {
  console.log('\n[NOTE] This page loads content dynamically via JavaScript');

  const jsonMatch = html.match(/window\.__INITIAL_DATA__\s*=\s*({.*?});?\s*<\/script>/s);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      console.log('Found __INITIAL_DATA__, keys:', Object.keys(data).join(', '));
    } catch (e) {
      console.log('Could not parse __INITIAL_DATA__');
    }
  }
}

// Search for any encoded image data
const encodedImgCount = (html.match(/data:image/gi) || []).length;
console.log('\nData URI images:', encodedImgCount);

// Check for Naver-specific image patterns
const naverImgPatterns = (html.match(/blogfiles\.naver|postfiles\.pstatic|mblogthumb-phinf/gi) || []);
console.log('Naver CDN references:', naverImgPatterns.length);

// Dump a portion of the HTML to see structure
console.log('\n--- HTML structure sample (first 500 chars with img/image mentions) ---');
const lines = html.split('\n');
for (const line of lines) {
  if (line.toLowerCase().includes('img') || line.toLowerCase().includes('image')) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && trimmed.length < 500) {
      console.log(trimmed.substring(0, 200));
    }
  }
}
