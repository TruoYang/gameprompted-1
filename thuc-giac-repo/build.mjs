import fs from 'fs';
const src = 'src/';
const js = fs.readdirSync(src).filter(f => f.endsWith('.js')).sort().map(f => `// ===== ${f}\n` + fs.readFileSync(src + f, 'utf8')).join('\n');
const html = fs.readFileSync(src + 'page.html', 'utf8') + '\n<script type="module">\n' + js + '\n</script>\n';
fs.writeFileSync('dist/index.html', html);
// local test page with a full document + local three
const test = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + html.replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js', './three.module.min.js') + '</body></html>';
fs.writeFileSync('dist/test.html', test);
console.log('built', (html.length/1024).toFixed(0)+'KB');
// standalone web build for public hosting (itch.io, GitHub Pages, Netlify…): full document + bundled three.js
fs.mkdirSync('dist', { recursive: true });
fs.mkdirSync('web', { recursive: true });
const head = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<meta name="description" content="Thức Giấc: game sinh tồn lén lút 3D. Quái vật khổng lồ trỗi dậy giữa thành phố Việt Nam, bạn phải tìm đường về nhà.">'
  + '<meta property="og:title" content="Thức Giấc"><meta property="og:description" content="Game sinh tồn lén lút 3D: tránh quái vật khổng lồ, tìm đường về nhà.">'
  + '<meta name="theme-color" content="#111417"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2230%22 fill=%22%23cf4a3b%22/%3E%3Cellipse cx=%2232%22 cy=%2232%22 rx=%2220%22 ry=%2211%22 fill=%22%23111417%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%226%22 fill=%22%23e4a03a%22/%3E%3C/svg%3E">'
  + '<style>[hidden]{display:none!important}body{margin:0}</style></head><body>';
fs.writeFileSync('web/index.html', head + html.replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js', './three.module.min.js') + '</body></html>');
fs.copyFileSync('dist/three.module.min.js', 'web/three.module.min.js');
