// ---------------------------------------------------------------- item icons (drawn once on a canvas, used as <img>)
// each item: [shape, main colour, accent colour]
const ICON_SPEC = {
  banhmi: ['bread', '#d99a4a', '#f2c27a'], mitom: ['pack', '#e8b21c', '#c8302a'], xoi: ['leaf', '#3d7a3a', '#f4efe2'], banhchung: ['chung', '#3d7a3a', '#c9b48a'],
  cahop: ['can', '#c9cdd1', '#d9452f'], luongkho: ['bar', '#e3c066', '#8a5a1e'], chuoi: ['banana', '#f0d03a', '#6a5a20'], banhquy: ['tin', '#2f5fa8', '#e8c66a'],
  nuocsuoi: ['bottle', '#9fd0e8', '#2f7fd0'], binhnuoc: ['jug', '#bfe3f2', '#2f7fd0'], trada: ['bag', '#d9a24a', '#e8e2d4'], tangluc: ['can', '#2a2a2e', '#e8b21c'],
  suahop: ['carton', '#f4f2ec', '#3a7bd5'], nuocdua: ['coconut', '#6a8a3a', '#e8e2d4'],
  bang: ['roll', '#f4f2ec', '#d9452f'], nep: ['splint', '#d9d4c9', '#3a7bd5'], giamdau: ['pills', '#f4f2ec', '#2f9e5b'], khangsinh: ['pills', '#f4f2ec', '#d9452f'],
  con: ['bottle', '#e8eef2', '#d9452f'], socuu: ['kit', '#d9452f', '#fff'],
  canhcay: ['branch', '#6b4a2e', '#5b7a40'], banphim: ['keyboard', '#26272b', '#55585e'], chao: ['pan', '#2a2a2a', '#5b3f2a'], ongtuyp: ['pipe', '#9aa0a6', '#6f7378'],
  gaysat: ['rod', '#6f7378', '#2a2a2a'], xabeng: ['crowbar', '#34466a', '#2a3550'], sungtruong: ['rifle', '#2b2e26', '#5a4630'], bangdan: ['mag', '#2f302a', '#c9a227'],
  phao: ['firecracker', '#c8302a', '#e8c66a'], chai: ['bottle', '#5fa36a', '#2f6a3a'], canxang: ['fuel', '#c8302a', '#2a2a2a'],
  dongho: ['watch', '#1d1d1f', '#59e09a'], vi: ['wallet', '#6b4a2e', '#c9a227'], dtla: ['phone', '#2a2a2e', '#7fb4d6'], dienthoai: ['phone', '#1d1d1f', '#59e09a'],
  giaythethao: ['shoe', '#f2f2f2', '#d9452f'], giaybaoho: ['boot', '#5a4a3a', '#e8b21c'], aokhoac: ['jacket', '#2a2f33', '#55595d'], aophao: ['jacket', '#3d4f3a', '#6a7a5a'],
  aobaoho: ['jacket', '#e08a1e', '#f4f2ec'], aogiap: ['vest', '#4a5a32', '#2f3a22'], mubaohiem: ['helmet', '#c8302a', '#2a2a2a'], musat: ['helmet', '#4a5a32', '#2f3a22'],
  balonho: ['backpack', '#1d4f9c', '#e8b21c'], balophuot: ['backpack', '#2d4a3a', '#d9452f'],
};
const ICON_CACHE = {};
function itemIconURL(id) {
  if (ICON_CACHE[id]) return ICON_CACHE[id];
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const [shape, A, Bc] = ICON_SPEC[id] || ['box', '#888', '#555'];
  x.translate(S / 2, S / 2); x.lineJoin = 'round'; x.lineCap = 'round';
  const out = (w = 3) => { x.lineWidth = w; x.strokeStyle = 'rgba(0,0,0,.55)'; x.stroke(); };
  const rr = (x0, y0, w, h, r, col) => { x.beginPath(); x.roundRect ? x.roundRect(x0, y0, w, h, r) : x.rect(x0, y0, w, h); x.fillStyle = col; x.fill(); out(); };
  const circ = (cx, cy, r, col) => { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fillStyle = col; x.fill(); out(); };
  const poly = (pts, col) => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fillStyle = col; x.fill(); out(); };
  switch (shape) {
    case 'bread': x.rotate(-0.5); rr(-34, -12, 68, 24, 12, A); x.strokeStyle = Bc; x.lineWidth = 3; for (const k of [-16, 0, 16]) { x.beginPath(); x.moveTo(k - 5, -8); x.lineTo(k + 5, 8); x.stroke(); } break;
    case 'pack': rr(-28, -24, 56, 48, 6, A); rr(-20, -10, 40, 20, 4, Bc); x.fillStyle = '#fff'; x.font = '900 13px sans-serif'; x.textAlign = 'center'; x.fillText('MÌ', 0, 5); break;
    case 'leaf': poly([[-30, 10], [0, -28], [30, 10], [0, 26]], A); circ(0, 2, 13, Bc); break;
    case 'chung': rr(-26, -26, 52, 52, 4, A); x.strokeStyle = Bc; x.lineWidth = 4; x.beginPath(); x.moveTo(-26, -8); x.lineTo(26, -8); x.moveTo(-26, 8); x.lineTo(26, 8); x.moveTo(-8, -26); x.lineTo(-8, 26); x.moveTo(8, -26); x.lineTo(8, 26); x.stroke(); break;
    case 'can': rr(-18, -28, 36, 56, 6, A); rr(-18, -6, 36, 14, 2, Bc); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(-12, -24, 5, 46); break;
    case 'bar': x.rotate(-0.3); rr(-32, -14, 64, 28, 4, A); x.fillStyle = Bc; x.fillRect(-32, -14, 16, 28); x.fillStyle = '#5a3a10'; x.font = '900 11px sans-serif'; x.textAlign = 'center'; x.fillText('702', 8, 4); break;
    case 'banana': x.beginPath(); x.arc(0, -30, 44, 0.6, 2.5); x.arc(0, -46, 46, 2.4, 0.7, true); x.closePath(); x.fillStyle = A; x.fill(); out(); break;
    case 'tin': rr(-28, -20, 56, 40, 10, A); rr(-28, -26, 56, 10, 5, Bc); break;
    case 'bottle': rr(-12, -16, 24, 44, 6, A); rr(-6, -30, 12, 16, 3, A); rr(-7, -34, 14, 6, 2, Bc); rr(-12, -2, 24, 12, 1, Bc); break;
    case 'jug': rr(-24, -20, 48, 48, 8, A); rr(-8, -32, 16, 14, 3, Bc); x.beginPath(); x.arc(16, -8, 10, -1.2, 1.2); x.lineWidth = 5; x.strokeStyle = Bc; x.stroke(); break;
    case 'bag': rr(-22, -18, 44, 46, 8, '#e8e2d4'); rr(-18, -8, 36, 32, 6, A); x.beginPath(); x.moveTo(-8, -18); x.lineTo(0, -32); x.lineTo(8, -18); x.lineWidth = 3; x.strokeStyle = '#888'; x.stroke(); break;
    case 'carton': poly([[-18, -16], [0, -30], [18, -16], [18, 28], [-18, 28]], A); rr(-18, -2, 36, 14, 1, Bc); break;
    case 'coconut': circ(0, 4, 26, A); circ(0, -6, 10, Bc); x.beginPath(); x.moveTo(6, -10); x.lineTo(16, -34); x.lineWidth = 3; x.strokeStyle = '#e8b21c'; x.stroke(); break;
    case 'roll': circ(0, 0, 26, A); circ(0, 0, 9, '#d8d2c4'); x.strokeStyle = Bc; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 18, 0, TAU); x.stroke(); break;
    case 'splint': rr(-32, -9, 64, 18, 4, A); x.fillStyle = Bc; x.fillRect(-14, -11, 6, 22); x.fillRect(8, -11, 6, 22); break;
    case 'pills': rr(-24, -28, 48, 56, 6, A); rr(-24, -8, 48, 16, 1, Bc); x.save(); x.rotate(0.6); rr(-18, 14, 22, 10, 5, Bc); x.restore(); break;
    case 'kit': rr(-30, -22, 60, 46, 6, A); x.fillStyle = Bc; x.fillRect(-5, -14, 10, 30); x.fillRect(-15, -4, 30, 10); rr(-10, -30, 20, 9, 3, '#7a1a12'); break;
    case 'branch': x.rotate(-0.6); rr(-36, -4, 72, 8, 4, A); x.beginPath(); x.moveTo(6, -2); x.lineTo(22, -18); x.lineWidth = 5; x.strokeStyle = A; x.stroke(); circ(26, -22, 10, Bc); circ(34, -6, 8, Bc); break;
    case 'keyboard': x.rotate(-0.2); rr(-36, -14, 72, 28, 3, A); x.fillStyle = Bc; for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) x.fillRect(-32 + k * 7.2, -10 + r * 7, 5.5, 5); break;
    case 'pan': x.rotate(-0.6); circ(-8, 0, 22, A); circ(-8, 0, 16, '#3a3a3a'); rr(12, -4, 30, 8, 3, Bc); break;
    case 'pipe': x.rotate(-0.7); rr(-36, -6, 72, 12, 6, A); rr(-36, -8, 8, 16, 2, Bc); rr(28, -8, 8, 16, 2, Bc); break;
    case 'rod': x.rotate(-0.7); rr(-36, -4, 72, 8, 4, A); rr(-36, -6, 16, 12, 3, Bc); break;
    case 'crowbar': x.rotate(-0.7); rr(-30, -4, 62, 8, 3, A); x.beginPath(); x.moveTo(-30, 0); x.quadraticCurveTo(-42, -2, -40, -14); x.lineWidth = 8; x.strokeStyle = A; x.stroke(); break;
    case 'rifle': x.rotate(-0.25); rr(-40, -6, 48, 12, 2, A); rr(8, -4, 30, 6, 1, '#1c1d1a'); rr(-44, -6, 16, 16, 3, Bc); rr(-6, 4, 8, 16, 2, '#1c1d1a'); rr(-20, 4, 6, 12, 2, '#1c1d1a'); break;
    case 'mag': x.rotate(0.15); rr(-11, -28, 22, 54, 4, A); x.fillStyle = Bc; x.fillRect(-6, -32, 12, 6); x.fillStyle = 'rgba(255,255,255,.2)'; for (let k = 0; k < 4; k++) x.fillRect(-7, -18 + k * 10, 14, 3); break;
    case 'firecracker': for (const dx of [-14, 0, 14]) rr(dx - 6, -24, 12, 44, 3, A); x.beginPath(); x.moveTo(0, -24); x.quadraticCurveTo(8, -34, 16, -32); x.lineWidth = 2; x.strokeStyle = Bc; x.stroke(); circ(17, -32, 3, '#ffd34d'); break;
    case 'fuel': rr(-24, -20, 48, 46, 6, A); rr(6, -30, 10, 12, 2, Bc); rr(-18, -28, 18, 6, 3, Bc); x.fillStyle = '#ffd34d'; x.font = '900 12px sans-serif'; x.textAlign = 'center'; x.fillText('XĂNG', 0, 8); break;
    case 'watch': rr(-10, -34, 20, 68, 4, '#3a3a3e'); circ(0, 0, 20, A); circ(0, 0, 15, '#0d2a1d'); x.fillStyle = Bc; x.beginPath(); x.arc(0, 0, 11, -1.4, 0.2); x.lineTo(0, 0); x.fill(); circ(5, -6, 2.5, '#e0453a'); break;
    case 'wallet': rr(-30, -18, 60, 38, 6, A); rr(4, -6, 26, 16, 4, shade(A, 0.8)); circ(14, 2, 3, Bc); break;
    case 'phone': rr(-17, -32, 34, 64, 6, A); rr(-13, -26, 26, 48, 2, Bc); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(0, -2, 8, 0, TAU); x.moveTo(0, -2); x.lineTo(6, -8); x.stroke(); break;
    case 'shoe': poly([[-32, 14], [-32, -10], [-8, -10], [2, 0], [32, 6], [32, 16]], A); x.fillStyle = Bc; x.fillRect(-32, 12, 64, 6); break;
    case 'boot': poly([[-24, 20], [-24, -26], [-2, -26], [-2, 4], [28, 10], [28, 20]], A); x.fillStyle = Bc; x.fillRect(-24, 16, 52, 6); break;
    case 'jacket': poly([[-12, -28], [12, -28], [30, -14], [26, 6], [18, 2], [18, 30], [-18, 30], [-18, 2], [-26, 6], [-30, -14]], A); x.strokeStyle = Bc; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -26); x.lineTo(0, 30); x.stroke(); break;
    case 'vest': poly([[-14, -28], [-6, -28], [-6, -16], [6, -16], [6, -28], [14, -28], [24, -16], [24, 30], [-24, 30], [-24, -16]], A); x.fillStyle = Bc; x.fillRect(-18, 2, 14, 12); x.fillRect(4, 2, 14, 12); break;
    case 'helmet': x.beginPath(); x.arc(0, 8, 28, Math.PI, 0); x.closePath(); x.fillStyle = A; x.fill(); out(); rr(-32, 6, 64, 8, 3, Bc); break;
    case 'backpack': rr(-24, -26, 48, 56, 10, A); rr(-16, 2, 32, 22, 6, shade(A, 0.8)); x.beginPath(); x.arc(0, -26, 9, Math.PI, 0); x.lineWidth = 4; x.strokeStyle = Bc; x.stroke(); x.fillStyle = Bc; x.fillRect(-2, -10, 4, 10); break;
    default: rr(-24, -24, 48, 48, 6, A);
  }
  return ICON_CACHE[id] = c.toDataURL();
}
const itemImg = (id, sz = 40) => `<img class="iic" src="${itemIconURL(id)}" width="${sz}" height="${sz}" alt="">`;
