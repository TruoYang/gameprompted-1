// ---------------------------------------------------------------- layout
const RX = [-300, -200, -100, 0, 100, 200, 300], RZ = [-150, -50, 50, 150], RW = 14, HALF = RW / 2;
const LAKE = { x: -150, z: 0, rx: 34, rz: 31 };
const CRACK = { x0: 43, x1: 57 };
const BOUNDS = { x0: -309, x1: 309, z0: -159, z1: 159 };
const START = { x: -224, z: 6, y: 0 };
const OUT = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
const STEP_WALK = 0.65, STEP_BIKE = 0.3;

// ---------------------------------------------------------------- collision grid
const CELL = 16; const CGRID = new Map(); let QSTAMP = 1;
const ckey = (ix, iz) => (ix + 2048) * 4096 + (iz + 2048);
function addCol(minX, minZ, maxX, maxZ, minY, maxY, o = {}) {
  const b = { minX, minZ, maxX, maxZ, minY, maxY, sight: o.sight !== false, solid: o.solid !== false, bike: !!o.bikeOnly, dead: false, stamp: 0, tag: o.tag || null };
  for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++)
    for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
      const k = ckey(ix, iz); let a = CGRID.get(k); if (!a) CGRID.set(k, a = []); a.push(b);
    }
  return b;
}
function queryCols(minX, minZ, maxX, maxZ, fn) {
  const s = ++QSTAMP;
  for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++)
    for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
      const a = CGRID.get(ckey(ix, iz)); if (!a) continue;
      for (const b of a) { if (b.stamp === s || b.dead) continue; b.stamp = s; fn(b); }
    }
}
function lineOfSight(ax, ay, az, bx, by, bz, skipEnd = 0.7) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz), steps = Math.ceil(L / 1.1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps; if (L * (1 - t) < skipEnd) break;
    const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
    const a = CGRID.get(ckey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) continue;
    for (const b of a) { if (b.dead || !b.sight) continue; if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y > b.minY && y < b.maxY) return false; }
  }
  return true;
}
// distance along a ray until it hits something that blocks sight (bullets)
function rayWorld(o, d, maxT) {
  for (let t = 0.4; t < maxT; t += 0.35) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < 0) return t;
    const a = CGRID.get(ckey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) continue;
    for (const b of a) { if (b.dead || !b.sight) continue; if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y > b.minY && y < b.maxY) return t; }
  }
  return maxT;
}
// circle vs boxes push-out. step = obstacles this low are stepped over
function collideCircle(p, r, feetY, height, isBike, step = 0.45) {
  let hit = false;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    queryCols(p.x - r, p.z - r, p.x + r, p.z + r, b => {
      if (!b.solid) return;
      if (b.bike && !isBike) return;
      if (b.maxY <= feetY + step || b.minY >= feetY + height) return;
      const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
      let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; p.x += dx / d * push; p.z += dz / d * push; }
      else {
        const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z, m = Math.min(l, rr, t, bt);
        if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r; else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
      }
      hit = moved = true;
    });
    if (!moved) break;
  }
  return hit;
}
// pedestrian underpasses: stairs go down into a passage under the road
const TUNNELS = [];   // {stairs:[{x0,z0,x1,z1,ax,top:[x,z],bot:[x,z]}], pass:{x0,z0,x1,z1}, floor}
const TUN_FLOOR = -3.2;
function baseAt(x, z, feetY) {
  for (const T of TUNNELS) {
    for (const S of T.stairs) if (x > S.x0 && x < S.x1 && z > S.z0 && z < S.z1) {
      const L = Math.hypot(S.bot[0] - S.top[0], S.bot[1] - S.top[1]);
      const t = clamp(((x - S.top[0]) * (S.bot[0] - S.top[0]) + (z - S.top[1]) * (S.bot[1] - S.top[1])) / (L * L), 0, 1);
      return t * TUN_FLOOR;
    }
    if (feetY < -1) for (const Q of T.cors) if (x > Q.x0 && x < Q.x1 && z > Q.z0 && z < Q.z1) return TUN_FLOOR;
  }
  return 0;
}
function underground(x, z, y) { return y < -1; }
function groundAt(x, z, r, feetY, step = 0.45) {
  let g = baseAt(x, z, feetY);
  queryCols(x - r, z - r, x + r, z + r, b => {
    if (b.bike || !b.solid) return;
    if (b.maxY > feetY + step) return;
    if (x + r * 0.6 > b.minX && x - r * 0.6 < b.maxX && z + r * 0.6 > b.minZ && z - r * 0.6 < b.maxZ) g = Math.max(g, b.maxY);
  });
  return g;
}

// ---------------------------------------------------------------- ground with holes
const HOLES = [];  // [x0,z0,x1,z1]
function boxHoles(mb, x0, y0, z0, x1, y1, z1, hex, opt, holes = HOLES) {
  const h = holes.find(H => H[0] < x1 && H[2] > x0 && H[1] < z1 && H[3] > z0);
  if (!h) { mb.box(x0, y0, z0, x1, y1, z1, hex, opt); return; }
  const rest = holes.filter(H => H !== h);
  const hx0 = Math.max(x0, h[0]), hx1 = Math.min(x1, h[2]), hz0 = Math.max(z0, h[1]), hz1 = Math.min(z1, h[3]);
  if (hx0 > x0) boxHoles(mb, x0, y0, z0, hx0, y1, z1, hex, opt, rest);
  if (hx1 < x1) boxHoles(mb, hx1, y0, z0, x1, y1, z1, hex, opt, rest);
  if (hz0 > z0) boxHoles(mb, hx0, y0, z0, hx1, y1, hz0, hex, opt, rest);
  if (hz1 < z1) boxHoles(mb, hx0, y0, hz1, hx1, y1, z1, hex, opt, rest);
}
// a chunk of rubble you cannot walk through (collider shrunk a little so it never feels invisible)
function rubble(mb, x, z, sx, sy, sz, hex, ry = 0, y0 = 0) {
  mb.box(x - sx, y0, z - sz, x + sx, y0 + sy, z + sz, hex, { ry, pat: 3 });
  const c = Math.abs(Math.cos(ry)), s2 = Math.abs(Math.sin(ry));
  const ex = (sx * c + sz * s2) * 0.72, ez = (sx * s2 + sz * c) * 0.72;
  return addCol(x - ex, z - ez, x + ex, z + ez, y0, y0 + sy, { sight: sy > 1.4 });
}

// ---------------------------------------------------------------- interactables, containers, pickups
const INTERACT = [];
function addInteract(o) { o.r = o.r || 2.2; o.dead = false; if (!o.box) o.box = [o.x - 0.4, o.y - 1, o.z - 0.4, o.x + 0.4, o.y + 0.6, o.z + 0.4]; INTERACT.push(o); return o; }
const CONTAINERS = [];
function addContainer(x, y, z, label, table, n, B, opt = {}) {
  const items = opt.items ? opt.items.slice() : rollLoot(table, n);
  const c = { x, y, z, label, items, money: opt.money || 0, searched: false, B, altar: !!opt.altar, kind: opt.kind || 'container', goods: null, dead: false };
  CONTAINERS.push(c);
  c.it = addInteract({ x, y, z, r: opt.r || 2.4, kind: 'container', ref: c, box: opt.box });
  if (B) B.conts.push(c);
  return c;
}
// when a shelf unit is emptied its goods disappear from the shelf
function refreshGoods(c) {
  if (!c.goods || c.goodsHidden) return;
  if (c.items.length === 0 && !(c.money > 0)) {
    const { mesh, s, e } = c.goods; if (e <= s) return; const a = mesh.geometry.attributes.position;
    const x = a.getX(s), y = a.getY(s), z = a.getZ(s); for (let i = s; i < e; i++) a.setXYZ(i, x, y, z); a.needsUpdate = true; c.goodsHidden = true;
  }
}
const PICKUPS = [];
const PICK_DRAW = {
  canhcay(mb) { mb.box(-0.05, 0, -0.85, 0.06, 0.11, 0.85, '#5b4634', { pat: 5 }); mb.box(0.03, 0.02, 0.05, 0.4, 0.08, 0.12, '#5b4634', { ry: 0.6, pat: 5 }); mb.box(-0.32, 0.02, -0.45, -0.03, 0.07, -0.39, '#5b4634', { ry: -0.4 }); mb.box(0.25, 0.04, 0.22, 0.55, 0.22, 0.5, '#4e6b3a', { pat: 6 }); mb.box(-0.45, 0.04, -0.6, -0.2, 0.18, -0.35, '#5b7a40', { pat: 6 }); },
  banphim(mb) { mb.box(-0.22, 0, -0.075, 0.22, 0.025, 0.075, '#1e1f22'); for (let k = 0; k < 5; k++) mb.box(-0.205, 0.025, -0.062 + k * 0.026, 0.205, 0.04, -0.045 + k * 0.026, k === 4 ? '#55585e' : '#3a3c40'); },
  chao(mb) { mb.geo(new THREE.CylinderGeometry(0.17, 0.13, 0.06, 14), new THREE.Matrix4().makeTranslation(0, 0.03, 0), '#2a2a2a'); mb.box(-0.02, 0.04, 0.16, 0.02, 0.07, 0.48, '#3b2a1e', { pat: 5 }); },
  ongtuyp(mb) { mb.geo(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0, 0.04, 0)), '#8b8f94'); },
  gaysat(mb) { mb.box(-0.025, 0, -0.5, 0.025, 0.05, 0.5, '#5a5d61'); },
  xabeng(mb) { mb.box(-0.02, 0, -0.55, 0.02, 0.04, 0.5, '#3d4d6b'); mb.box(-0.02, 0, 0.45, 0.02, 0.18, 0.5, '#3d4d6b'); },
  sungtruong(mb) { mb.box(-0.04, 0, -0.45, 0.04, 0.08, 0.25, '#2b2e26'); mb.box(-0.015, 0.03, -0.85, 0.015, 0.06, -0.45, '#1c1d1a'); mb.box(-0.035, 0, 0.25, 0.035, 0.07, 0.55, '#4a3a28', { pat: 5 }); mb.box(-0.025, 0.08, -0.15, 0.025, 0.22, -0.05, '#1c1d1a'); },
  bangdan(mb) { mb.box(-0.03, 0, -0.06, 0.03, 0.18, 0.06, '#2f302a'); },
  def(mb) { mb.box(-0.12, 0, -0.12, 0.12, 0.2, 0.12, '#c9a227'); },
};
function addPickup(id, x, y, z, ry = 0, B = null, opt = {}) {
  const mb = new MB(); (PICK_DRAW[id] || PICK_DRAW.def)(mb);
  const m = new THREE.Mesh(mb.build(), MAT.vc); m.position.set(x, y, z); m.rotation.set(opt.rx || 0, ry, opt.rz || 0); m.castShadow = true; scene.add(m);
  m.updateMatrixWorld(); const bb = new THREE.Box3().setFromObject(m);
  const p = { id, x, y, z, mesh: m, dead: false, B };
  p.it = addInteract({ x, y: y + 0.2, z, r: 2.2, kind: 'pickup', ref: p, box: [bb.min.x - 0.06, bb.min.y - 0.05, bb.min.z - 0.06, bb.max.x + 0.06, bb.max.y + 0.1, bb.max.z + 0.06] });
  PICKUPS.push(p); if (B) B.picks.push(p);
  return p;
}
function killPickup(p) { p.dead = true; p.it.dead = true; p.mesh.visible = false; }

// ---------------------------------------------------------------- sign atlas
const ATLAS = { canvas: document.createElement('canvas'), cells: [], byType: {}, cols: 4, rows: 16 };
ATLAS.canvas.width = 2048; ATLAS.canvas.height = 2048;
const SIGN_SPECS = {
  grocery: [['TẠP HÓA HƯƠNG LAN', '#c8302a', '#fff'], ['TẠP HÓA MINH ANH', '#1d4f9c', '#fff'], ['TẠP HÓA CÔ BA', '#e9c227', '#b5261e'], ['ĐẠI LÝ NƯỚC GIẢI KHÁT', '#1d7a46', '#fff'], ['SIÊU THỊ MINI 24H', '#d34d1f', '#fff']],
  food: [['PHỞ BÒ GIA TRUYỀN', '#b8231d', '#ffe27a'], ['BÁNH MÌ PATÊ', '#e7b928', '#7a1a12'], ['CƠM BÌNH DÂN', '#1d4f9c', '#fff'], ['BÚN BÒ HUẾ', '#9e1f1f', '#fff'], ['XÔI - BÁNH CHƯNG', '#2f7d3a', '#fff7c2']],
  cafe: [['CÀ PHÊ PHỐ', '#3b2a20', '#f3d9a6'], ['TRÀ SỮA BỐN MÙA', '#e6739d', '#fff'], ['CÀ PHÊ MUỐI', '#20443a', '#fff']],
  pharmacy: [['NHÀ THUỐC TÂM ĐỨC', '#147a4a', '#fff'], ['NHÀ THUỐC BÌNH AN', '#11668a', '#fff'], ['QUẦY THUỐC SỐ 7', '#1a8a5a', '#fff'], ['NHÀ THUỐC PHÚC HƯNG', '#0f6e40', '#fff']],
  clothes: [['THỜI TRANG NAM NỮ', '#121212', '#fff'], ['SHOP QUẦN ÁO MỸ LINH', '#c2447a', '#fff'], ['ÁO KHOÁC - ÁO GIÓ', '#2a3f6b', '#fff']],
  workwear: [['ĐỒ BẢO HỘ LAO ĐỘNG', '#f0b81e', '#111'], ['BẢO HỘ - MŨ - GIÀY', '#e85a1b', '#fff']],
  shoes: [['GIÀY DÉP THANH HẰNG', '#7b1fa2', '#fff'], ['GIÀY THỂ THAO', '#111', '#ffcc00']],
  bags: [['BALO - TÚI XÁCH', '#0d5c8c', '#fff'], ['VALI - BALO DU LỊCH', '#cf3a2e', '#fff']],
  bike: [['SỬA XE MÁY - VÁ XE', '#1d4f9c', '#ffe066'], ['XE MÁY CŨ THÀNH ĐẠT', '#c8302a', '#fff'], ['RỬA XE - THAY DẦU', '#0e7a6e', '#fff']],
  hardware: [['KIM KHÍ - ĐIỆN NƯỚC', '#3b4a5a', '#ffd34d'], ['SẮT THÉP - DỤNG CỤ', '#5a3b2a', '#fff'], ['VẬT LIỆU XÂY DỰNG', '#2b6b2b', '#fff']],
  office: [['CÔNG TY CP CÔNG NGHỆ SAO VIỆT', '#0d2238', '#cfe3f5']],
  hotel: [['NHÀ NGHỈ HOA HỒNG', '#a3195b', '#fff'], ['KHÁCH SẠN SÔNG HỒNG', '#1d3b6b', '#f3d27a']],
  rent: [['CHO THUÊ NHÀ', '#f4f0e6', '#c8302a']],
  flag: [['FLAG', '#da251d', '#ffcd00']],
  street: [['PHỐ HOA SỮA', '#1f4fa0', '#fff'], ['ĐƯỜNG BẠCH ĐẰNG', '#1f4fa0', '#fff'], ['PHỐ HÀNG BÔNG', '#1f4fa0', '#fff'], ['ĐƯỜNG TRẦN PHÚ', '#1f4fa0', '#fff'], ['PHỐ NGUYỄN DU', '#1f4fa0', '#fff'], ['ĐƯỜNG LÊ LỢI', '#1f4fa0', '#fff'], ['PHỐ HÀNG GAI', '#1f4fa0', '#fff'], ['ĐƯỜNG LÁNG', '#1f4fa0', '#fff'], ['PHỐ TRÀNG TIỀN', '#1f4fa0', '#fff'], ['ĐƯỜNG HOÀNG HOA THÁM', '#1f4fa0', '#fff'], ['PHỐ HUẾ', '#1f4fa0', '#fff']],
  banner: [['KHU PHỐ VĂN HÓA', '#c8251d', '#ffd84a'], ['TỔ DÂN PHỐ SỐ 7', '#c8251d', '#ffd84a']],
  army: [['KHU VỰC QUÂN SỰ - CẤM VÀO', '#4a5a2c', '#fff']],
  market: [['SIÊU THỊ BÌNH MINH', '#c8251d', '#fff'], ['SIÊU THỊ PHÚ QUÝ', '#0d5c8c', '#fff']],
  tunnel: [['HẦM ĐI BỘ', '#1f4fa0', '#fff']],
};
function phone() { return '0' + pick(['9', '8', '3', '7']) + randi(1, 9) + randi(0, 9) + '.' + randi(100, 999) + '.' + randi(100, 999); }
function buildAtlas() {
  const x = ATLAS.canvas.getContext('2d'); let idx = 0;
  for (const type in SIGN_SPECS) {
    ATLAS.byType[type] = [];
    for (const [text, bg, fg] of SIGN_SPECS[type]) {
      const col = idx % 4, row = Math.floor(idx / 4), X = col * 512, Y = row * 128;
      x.save(); x.beginPath(); x.rect(X, Y, 512, 128); x.clip();
      x.fillStyle = bg; x.fillRect(X, Y, 512, 128);
      if (text === 'FLAG') {
        const cx = X + 256, cy = Y + 64, R1 = 46, R2 = 18; x.fillStyle = fg; x.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R2 : R1; x.lineTo(cx + Math.cos(a) * rr * 1.6, cy + Math.sin(a) * rr); }
        x.closePath(); x.fill();
      } else {
        const plain = type === 'office' || type === 'street' || type === 'banner' || type === 'army' || type === 'rent';
        x.strokeStyle = fg; x.globalAlpha = 0.5; x.lineWidth = 4; x.strokeRect(X + 8, Y + 8, 496, 112); x.globalAlpha = 1;
        x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
        let fs = 64; const face = type === 'street' ? "700 FSpx 'Be Vietnam Pro', Arial, sans-serif" : "900 FSpx 'Big Shoulders Display', Impact, sans-serif";
        x.font = face.replace('FS', fs);
        while (x.measureText(text).width > 470 && fs > 22) { fs -= 2; x.font = face.replace('FS', fs); }
        x.fillText(text, X + 256, Y + 64);
        for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(40,30,20,${Math.random() * 0.12})`; x.fillRect(X + Math.random() * 512, Y + Math.random() * 128, Math.random() * 60, Math.random() * 6); }
      }
      x.restore();
      ATLAS.cells.push([col / 4, 1 - (row + 1) / 16, (col + 1) / 4, 1 - row / 16]);
      ATLAS.byType[type].push(idx); idx++;
    }
  }
  const tex = new THREE.CanvasTexture(ATLAS.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  ATLAS.mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, emissive: 0x222222, emissiveMap: tex });
}

// ---------------------------------------------------------------- buildings
const BUILDINGS = []; const BGRID = new Map();
function buildingAt(x, z) {
  const a = BGRID.get(ckey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) return null;
  for (const B of a) if (!B.collapsed && x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1) return B;
  return null;
}
function interiorAt(x, z) {
  const B = buildingAt(x, z); if (!B || !B.enterable) return null;
  const r = B.inner; return (x > r[0] && x < r[2] && z > r[1] && z < r[3]) ? B : null;
}
const FACADE = ['#e9d49a', '#d9a87e', '#c5d6bb', '#e6c2b6', '#b6cbd8', '#efebe2', '#e2bf6a', '#a9b9a2', '#d8cdb8', '#f0dcc0', '#c7b7d6'];
const AWN = ['#b23a2e', '#25579a', '#2f7d4c', '#d4a21c', '#6a6a6a', '#a8402a'];
const SHOP_TYPES = [['house', 47.4], ['grocery', 8.5], ['food', 7.6], ['cafe', 4.2], ['pharmacy', 8], ['clothes', 4.2], ['workwear', 1.7], ['shoes', 3.4], ['bags', 3.4], ['bike', 4.2], ['hardware', 4.2], ['hotel', 3]];
function pickType() { let tot = 0; for (const [, w] of SHOP_TYPES) tot += w; let r = rand(0, tot); for (const [t, w] of SHOP_TYPES) { r -= w; if (r <= 0) return t; } return 'house'; }
const TYPE_NAME = { market: 'Siêu thị', grocery: 'Tạp hóa', food: 'Quán ăn', cafe: 'Quán cà phê', pharmacy: 'Nhà thuốc', clothes: 'Shop quần áo', workwear: 'Đồ bảo hộ', shoes: 'Shop giày', bags: 'Shop balo', bike: 'Tiệm xe máy', hardware: 'Tiệm kim khí', house: 'Nhà dân', hotel: 'Nhà nghỉ', office: 'Văn phòng', home: 'Nhà bạn', apartment: 'Chung cư' };
// each shop is lined with separate, named shelf units: [label, loot table, goods style]
const UNIT_SPECS = {
  grocery: { frame: 'shelf', col: '#8d9296', list: [['Kệ mì gói', 'g_noodle', 'pack'], ['Kệ nước uống', 'g_drink', 'bottle'], ['Kệ đồ hộp', 'g_can', 'can'], ['Kệ bánh kẹo', 'g_snack', 'pack'], ['Kệ đồ lặt vặt', 'g_misc', 'pack']] },
  pharmacy: { frame: 'shelf', col: '#e9ecef', list: [['Kệ bông băng', 'p_band', 'med'], ['Kệ thuốc giảm đau', 'p_pain', 'med'], ['Kệ kháng sinh', 'p_anti', 'med'], ['Kệ dụng cụ y tế', 'p_tool', 'med']] },
  clothes: { frame: 'rack', list: [['Giá áo khoác', 'c_coat', 'cloth'], ['Giá áo bảo hộ', 'c_work', 'cloth'], ['Giá phụ kiện', 'c_acc', 'cloth']] },
  workwear: { frame: 'rack', list: [['Giá đồ bảo hộ', 'c_work', 'cloth'], ['Giá mũ bảo hộ', 'c_helmet', 'cloth']] },
  shoes: { frame: 'shelf', col: '#6b5440', list: [['Kệ giày thể thao', 's_sport', 'shoe'], ['Kệ giày bảo hộ', 's_work', 'shoe']] },
  bags: { frame: 'rack', list: [['Giá balo đi học', 'b_small', 'bag'], ['Giá balo phượt', 'b_big', 'bag']] },
  hardware: { frame: 'shelf', col: '#4f565c', list: [['Kệ dụng cụ', 'h_tool', 'tool'], ['Kệ ống sắt', 'h_pipe', 'tool'], ['Kệ đồ điện', 'h_misc', 'pack']] },
  bike: { frame: 'shelf', col: '#5d6670', list: [['Tủ phụ tùng', 'k_parts', 'tool'], ['Kệ mũ bảo hiểm', 'k_helmet', 'pack'], ['Góc xăng nhớt', 'k_fuel', 'bottle']] },
  food: { frame: 'cabinet', col: '#c9ced2', list: [['Tủ kính đồ ăn', 'f_cab', 'pack'], ['Tủ mát', 'fridge', 'bottle']] },
  cafe: { frame: 'cabinet', col: '#6b4a32', list: [['Tủ mát', 'fridge', 'bottle'], ['Quầy pha chế', 'g_drink', 'bottle']] },
};
const GOODS = ['#d9452f', '#f0c02a', '#3a7bd5', '#2f9e5b', '#f2f2f2', '#e07a2a', '#8a3fb0', '#e05a8a', '#3fb0a8'];
const ROOF_GEO = [];

function makeBuilding(spec) {
  const B = Object.assign({ cols: [], conts: [], picks: [], collapsed: false, npcSpots: [], id: BUILDINGS.length }, spec);
  const { x0, z0, x1, z1, face } = B;
  const NS = face === 'N' || face === 'S';
  const w = NS ? x1 - x0 : z1 - z0, d = NS ? z1 - z0 : x1 - x0; B.w = w; B.d = d;
  const Wp = (u, v) => face === 'N' ? [x0 + u, z0 + v] : face === 'S' ? [x0 + u, z1 - v] : face === 'W' ? [x0 + v, z0 + u] : [x1 - v, z0 + u];
  const rect = (u0, u1, v0, v1) => { const a = Wp(u0, v0), b = Wp(u1, v1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; };
  const mb = new MB(), smb = new MB(), gmb = new MB(), glb = new MB(), hi = QUALITY === 'high';
  const bx = (u0, u1, v0, v1, y0, y1, hex, opt) => { const r = rect(u0, u1, v0, v1); mb.box(r[0], y0, r[1], r[2], y1, r[3], hex, opt); };
  const gx = (u0, u1, v0, v1, y0, y1, hex, opt) => { const r = rect(u0, u1, v0, v1); gmb.box(r[0], y0, r[1], r[2], y1, r[3], hex, opt); };
  const col = (u0, u1, v0, v1, y0, y1, o) => { const r = rect(u0, u1, v0, v1); const c = addCol(r[0], r[1], r[2], r[3], y0, y1, o); B.cols.push(c); return c; };
  const out = OUT[face];
  B.toWorld = Wp; B.out = out; B.rect = rect;
  const t = 0.25, H1 = B.H1 || 4.0, FH = B.FH || 3.6, floors = B.floors, h = H1 + (floors - 1) * FH + 0.5; B.h = h; B.H1 = H1; B.FH = FH;
  const LV = k => k <= 0 ? 0 : H1 + (k - 1) * FH; B.LV = LV; B.levels = B.levels || 1;
  const fc = B.burning ? pick(['#5d554d', '#4f4a45', '#6a5f55']) : B.style === 'french' ? pick(['#e2bf6a', '#e8c878', '#d9b45a']) : B.style === 'modern' ? pick(['#e8e6e0', '#8a8f94', '#d8d4cc', '#3a3f44']) : (B.color || pick(FACADE));
  if (B.style === 'french' || B.style === 'tile') B.pitched = B.floors <= 3;
  const side = pick(['#b3a999', '#a89f92', '#bdb3a3', '#9f978c']);
  const enter = B.enterable;
  B.inner = rect(t, w - t, t, d - t);
  const rev = face === 'N' || face === 'E';
  const signQuad = (u0, u1, v, y0, y1, cell) => {
    const uv = ATLAS.cells[cell]; const L = rev ? u1 : u0, Rr = rev ? u0 : u1; const a = Wp(L, v), b = Wp(Rr, v);
    smb.tquad([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [out[0], 0, out[1]], uv);
  };
  const H = { B, bx, gx, col, rect, Wp, w, d, t, H1, FH, LV, hi, gmb };
  H.glass = (u0, u1, v0, v1, y0, y1) => { const r = rect(u0, u1, v0, v1); glb.box(r[0], y0, r[1], r[2], y1, r[3], '#ffffff'); };
  // a named container unit; goods drawn inside draw() vanish once the unit is emptied
  H.unit = (label, table, n, u0, u1, v0, v1, hgt, draw, opt = {}) => {
    const s = gmb.n; if (draw) draw(); const e = gmb.n; const y0 = opt.y0 || 0;
    const r = rect(u0, u1, v0, v1); const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    const c = addContainer(cx, y0 + Math.min(1.0, hgt * 0.6), cz, label, table, n, B, Object.assign({ box: [r[0] - 0.04, y0, r[1] - 0.04, r[2] + 0.04, y0 + hgt + 0.06, r[3] + 0.04] }, opt));
    c.gr = [s, e]; return c;
  };

  // climbable stairs from level k-1 to level k; every step is its own collider
  // switchback: odd flights run front→back against the right wall, even flights run back→front right beside them,
  // so the top of one flight is a step away from the bottom of the next
  H.stairs = (k, _side, sw = 1.0) => {
    const y0 = LV(k - 1), y1 = LV(k), rise = y1 - y0, N = Math.ceil(rise / 0.33), run = N * 0.3;
    const odd = k % 2 === 1, sv1 = d - 1.6, sv0 = sv1 - run, u1 = w - t - (odd ? 0 : sw + 0.12), u0 = u1 - sw;
    for (let i = 0; i < N; i++) { const va = odd ? sv0 + i * 0.3 : sv1 - (i + 1) * 0.3, top = y0 + (i + 1) * rise / N; gx(u0, u1, va, va + 0.3, y0, top, '#b7aa94', { pat: 5 }); gx(u0, u1, odd ? va - 0.02 : va + 0.27, odd ? va + 0.03 : va + 0.32, top - 0.02, top + 0.01, '#8a7f6c'); col(u0, u1, va, va + 0.3, y0, top, { sight: false }); }
    gx(u0 - 0.05, u0, sv0, sv1, y0 + 1.0, y0 + 1.05, '#555');
    return { u0: u0 - 0.15, u1: odd ? u1 : u1 + 0.06, v0: sv0 - 0.25, v1: sv1 + (odd ? 0 : 0.05), endRail: odd ? 'v0' : 'v1' };
  };
  // floor slab of level k with a hole for the stairwell, plus railings around the hole
  H.slab = (k, hole, hex) => {
    const y = LV(k), parts = [[0, hole.u0, 0, d], [hole.u1, w, 0, d], [hole.u0, hole.u1, 0, hole.v0], [hole.u0, hole.u1, hole.v1, d]];
    for (const [a, b, c2, e] of parts) { if (b - a < 0.01 || e - c2 < 0.01) continue; bx(a, b, c2, e, y - 0.15, y, hex, { bottom: true, pat: 1, topPat: 7 }); col(a, b, c2, e, y - 0.15, y); }
    const railU = hole.u0;
    gx(railU - 0.03, railU + 0.03, hole.v0, hole.v1, y, y + 1.0, '#444'); gx(railU - 0.03, railU + 0.03, hole.v0, hole.v1, y + 0.95, y + 1.0, '#666'); col(railU - 0.05, railU + 0.05, hole.v0, hole.v1, y, y + 1.0, { sight: false });
    const ev = hole.endRail === 'v1' ? hole.v1 : hole.v0; gx(hole.u0, hole.u1, ev - 0.03, ev + 0.03, y, y + 1.0, '#444'); col(hole.u0, hole.u1, ev - 0.05, ev + 0.05, y, y + 1.0, { sight: false });
  };
  // walls of an upper level (front wall gets window openings filled by the facade glass)
  H.levelWalls = k => {
    const y0 = LV(k), y1 = LV(k + 1) - 0.15;
    bx(0, t, 0, d, y0, y1, side, { pat: 3 }); bx(w - t, w, 0, d, y0, y1, side, { pat: 3 }); bx(0, w, d - t, d, y0, y1, side, { pat: 3 });
    // front wall with the window openings cut out (the facade puts clear glass in them)
    const holes = winRects(B, k, w, FH).map(([a, b2, c2, e]) => [a, y0 + c2, b2, y0 + e]);
    subRects([0, y0, w, y1], holes).forEach(([a, c2, b2, e]) => bx(a, b2, 0, t, c2, e, fc, { pat: 3 }));
    for (const [a, c2, b2, e] of holes) { bx(a, b2, t - 0.02, t + 0.05, c2 - 0.05, c2, '#d8d2c4'); }
    col(0, t, 0, d, y0, y1); col(w - t, w, 0, d, y0, y1); col(0, w, d - t, d, y0, y1); col(0, w, 0, t, y0, y1);
  };

  if (!enter) {
    bx(0, w, 0, d, 0, h, fc, { vary: 0.06, pat: 3 });
    col(0, w, 0, d, 0, h);
    bx(0.4, w - 0.4, -0.08, 0, 0, 2.7, B.type === 'hotel' ? '#3c4650' : '#8e9297', { pat: B.type === 'hotel' ? 0 : 4 });
    if (B.type === 'hotel') { bx(w / 2 - 1, w / 2 + 1, -0.12, -0.08, 0, 2.4, '#26303a'); bx(0.4, w - 0.4, -1.4, 0, 2.9, 3.05, '#d9d4c9'); }
  } else {
    const homeLike = B.type === 'house' || B.type === 'home';
    bx(t, w - t, t, d - t, -0.02, 0.03, homeLike ? '#c9b99c' : '#d6d1c6', { pat: homeLike ? 1 : 7 });
    if (B.levels > 1) {
      const wide = B.type === 'market' || B.type === 'office' ? 1.6 : 1.0, fl = B.type === 'house' || B.type === 'home' ? '#c9b99c' : '#d6d1c6';
      for (let k = 1; k < B.levels; k++) { const hole = H.stairs(k, k % 2, wide); H.slab(k, hole, fl); H.levelWalls(k); }
      if (B.roof) { // stairs out onto a flat roof with a parapet
        const hole = H.stairs(B.levels, B.levels % 2, wide); H.slab(B.levels, hole, '#9a958b'); const y = LV(B.levels);
        for (const [a, b2, c2, e] of [[0, w, 0, 0.3], [0, w, d - 0.3, d], [0, 0.3, 0, d], [w - 0.3, w, 0, d]]) { bx(a, b2, c2, e, y, y + 1.1, fc, { pat: 3 }); col(a, b2, c2, e, y, y + 1.1); }
        B.roofY = y;
      } else { const yt = LV(B.levels) - 0.15; bx(0, w, 0, d, yt, h, fc, { vary: 0.06, bottom: true, pat: 3 }); col(0, w, 0, d, yt, h); }
    } else { bx(0, w, 0, d, H1, h, fc, { vary: 0.06, bottom: true, pat: 3 }); col(0, w, 0, d, H1, h); }
    bx(0, t, 0, d, 0, H1, side, { pat: 3 }); bx(w - t, w, 0, d, 0, H1, side, { pat: 3 });
    col(0, t, 0, d, 0, H1); col(w - t, w, 0, d, 0, H1);
    if (B.backDoor) {
      const c0 = w / 2 - 0.65, c1 = w / 2 + 0.65;
      bx(0, c0, d - t, d, 0, H1, side, { pat: 3 }); bx(c1, w, d - t, d, 0, H1, side, { pat: 3 }); bx(c0, c1, d - t, d, 2.2, H1, side);
      bx(c0 - 0.08, c0, d - t - 0.05, d + 0.05, 0, 2.2, '#5a4632'); bx(c1, c1 + 0.08, d - t - 0.05, d + 0.05, 0, 2.2, '#5a4632');
      col(0, c0, d - t, d, 0, H1); col(c1, w, d - t, d, 0, H1); col(c0, c1, d - t, d, 2.2, H1);
    } else { bx(0, w, d - t, d, 0, H1, side, { pat: 3 }); col(0, w, d - t, d, 0, H1); }
    if (!homeLike) {
      bx(0, w, 0, t, H1 - 0.7, H1, fc, { pat: 3 }); col(0, w, 0, t, H1 - 0.7, H1);
      if (w > 11) { bx(w / 2 - 0.2, w / 2 + 0.2, 0, 0.4, 0, H1, side); col(w / 2 - 0.2, w / 2 + 0.2, 0, 0.4, 0, H1); }
      bx(0.1, w - 0.1, -0.35, 0, H1 - 0.7, H1 - 0.35, '#8b9096', { pat: 4 }); // rolled-up shutter box
      if (B.type !== 'office' && B.type !== 'market') {
        const ac = pick(AWN);
        bx(0.2, w - 0.2, -1.9, 0, H1 - 0.85, H1 - 0.72, ac, { pat: 7 }); col(0.2, w - 0.2, -1.9, 0, H1 - 0.85, H1 - 0.72);
        bx(0.2, w - 0.2, -1.95, -1.85, H1 - 1.15, H1 - 0.72, ac);
        if (hi) for (const u of [0.25, w - 0.3]) bx(u, u + 0.05, -1.9, -1.85, 0, H1 - 0.85, '#555');
      } else {
        for (let u = 1; u < w - 0.5; u += 3) bx(u - 0.06, u + 0.06, -0.05, 0.05, 0, H1 - 0.7, '#2b3138');
      }
      if (B.closed) {
        const r = rect(t, w - t, 0.05, 0.18);
        const smbS = new MB(); smbS.box(r[0], 0, r[1], r[2], H1 - 0.7, r[3], '#8b9096', { pat: 4 });
        B.shutterMesh = meshFrom(smbS); B.shutterCol = col(t, w - t, 0.05, 0.18, 0, H1 - 0.7);
      }
    } else {
      const dw = Math.min(2.2, w * 0.35), d0 = w * 0.42 - dw / 2, d1 = d0 + dw;
      bx(0, d0, 0, t, 0, H1, fc, { pat: 3 }); bx(d1, w, 0, t, 0, H1, fc, { pat: 3 }); bx(d0, d1, 0, t, 2.4, H1, fc, { pat: 3 });
      col(0, d0, 0, t, 0, H1); col(d1, w, 0, t, 0, H1); col(d0, d1, 0, t, 2.4, H1);
      for (const [a, b] of [[d0 - 0.05, d0 + 0.12], [d1 - 0.12, d1 + 0.05]]) bx(a, b, -0.5, 0, 0, 2.4, '#3e4448', { pat: 4 }); // folding steel door, pushed open
      const win = (ua, ub) => {
        bx(ua - 0.08, ub + 0.08, -0.06, 0, 0.9, 2.4, '#e5e1d8'); bx(ua, ub, -0.08, -0.06, 1.0, 2.3, pick(['#33414b', '#3b4954', '#2c3740']));
        if (hi) { bx(ua - 0.12, ub + 0.12, -0.35, -0.3, 0.85, 2.45, '#2e3134'); for (let u = ua; u <= ub; u += 0.14) bx(u, u + 0.025, -0.35, -0.32, 0.85, 2.45, '#2e3134'); bx(ua - 0.12, ub + 0.12, -0.35, 0, 2.42, 2.47, '#2e3134'); }
      };
      if (w - d1 > 1.8) win(d1 + 0.5, w - 0.5);
      if (d0 > 1.8) win(0.5, d0 - 0.5);
      B.doorU = (d0 + d1) / 2;
      bx(d1 + 0.15, d1 + 0.45, -0.04, 0, 2.5, 2.7, '#1f4fa0'); // house number plate
      if (hi) bx(0.2, 0.55, -0.15, 0, 1.4, 1.9, '#9aa3a8');   // electric meter box
    }
    B.doorU = B.doorU ?? w / 2;
    buildInterior(B, H);
  }
  if (B.type === 'market' || B.type === 'office') marketFacade(B, H, fc, floors, h, hi); else facade(B, H, fc, floors, h, hi);
  if (B.sign != null) {
    const sy = H1 + 0.1, sy1 = H1 + 1.15;
    bx(0.3, w - 0.3, -1.35, -1.2, sy - 0.05, sy1 + 0.05, '#2a2a2a');
    signQuad(0.35, w - 0.35, -1.36, sy, sy1, B.sign);
  }
  // house signs sit on the plain band above the ground-floor door, clear of balconies and windows
  if (B.rent) { const u = w - 0.4; bx(u - 1.4, u, -0.06, 0, 2.7, 3.3, '#ddd'); signQuad(u - 1.38, u - 0.02, -0.07, 2.72, 3.28, ATLAS.byType.rent[0]); }
  if (B.banner != null) { const u = w * 0.42; bx(u - 1.4, u + 1.4, -0.06, 0, 2.62, 3.32, '#c8251d'); signQuad(u - 1.38, u + 1.38, -0.07, 2.64, 3.3, B.banner); }
  if (B.flag) {
    const q = Wp(w - 0.5, -1.2); const fy = H1 + 1.4;
    mb.box(q[0] - 0.03, fy - 0.2, q[1] - 0.03, q[0] + 0.03, fy + 2.2, q[1] + 0.03, '#ddd');
    const q2 = NS ? [q[0] - 1.5, q[1]] : [q[0], q[1] - 1.5];
    const uv = ATLAS.cells[ATLAS.byType.flag[0]];
    smb.tquad([[q2[0], fy + 1.2, q2[1]], [q[0], fy + 1.2, q[1]], [q[0], fy + 2.2, q[1]], [q2[0], fy + 2.2, q2[1]]], NS ? [0, 0, 1] : [1, 0, 0], [uv[0] + 0.08, uv[1], uv[2] - 0.08, uv[3]]);
  }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const g = new THREE.Group(); g.position.set(cx, 0, cz);
  const shell = new THREE.Mesh(mb.build().translate(-cx, 0, -cz), MAT.vc); shell.castShadow = true; shell.receiveShadow = true; g.add(shell);
  if (!smb.empty) g.add(new THREE.Mesh(smb.build().translate(-cx, 0, -cz), ATLAS.mat));
  if (!glb.empty) { const gm = new THREE.Mesh(glb.build().translate(-cx, 0, -cz), GLASS_MAT); gm.renderOrder = 3; g.add(gm); }
  if (!gmb.empty) {
    const im = new THREE.Mesh(gmb.build().translate(-cx, 0, -cz), MAT.vc); im.receiveShadow = true; im.castShadow = hi; g.add(im); B.imesh = im;
    for (const c of B.conts) if (c.gr) c.goods = { mesh: im, s: c.gr[0], e: c.gr[1] };
  }
  if (B.shutterMesh) { B.shutterMesh.geometry.translate(-cx, 0, -cz); B.shutterMesh.matrixAutoUpdate = true; g.add(B.shutterMesh); }
  g.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); g.updateMatrixWorld(true);
  scene.add(g); B.group = g; B.cx = cx; B.cz = cz;
  const fu = B.doorU ?? w / 2;
  const fp = Wp(fu, -1.4), ip = Wp(fu, 1.4); B.front = { x: fp[0], z: fp[1] }; B.inside = { x: ip[0], z: ip[1] };
  for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) { const k = ckey(ix, iz); let a = BGRID.get(k); if (!a) BGRID.set(k, a = []); a.push(B); }
  if (B.closed && enter) {
    const sp = Wp(w / 2, -0.6); const r = rect(t, w - t, -0.05, 0.2);
    B.shutterIt = addInteract({ x: sp[0], y: 1.2, z: sp[1], r: 2.6, kind: 'shutter', ref: B, box: [r[0], 0, r[1], r[2], H1 - 0.7, r[3]] });
  }
  if (B.burning) for (let f = 1; f < floors; f++) for (let k = 0; k < 2; k++) if (chance(0.55)) { const p = Wp(rand(0.8, w - 0.8), -0.3); FIRES.push([p[0], H1 + (f - 1) * FH + 1.2, p[1], 1]); }
  BUILDINGS.push(B);
  return B;
}

// window openings of upper floor f, as [u0, u1, y0, y1] relative to the floor
function winRects(B, f, w, FH) {
  if (B.type === 'apartment') return [];
  if (B.type === 'market' || B.type === 'office') return [[0.3, w - 0.3, 0.3, FH - 0.4]];
  if (B.style === 'modern') return [[0.35, w - 0.35, 0.25, 2.85]];
  const balcony = (f + B.id) % 3 !== 0, bays = Math.max(1, Math.round((w - 1.0) / 3.2)), bw = (w - 1.0) / bays, out = [];
  for (let j = 0; j < bays; j++) { const ua = 0.5 + j * bw + 0.3, ub = ua + bw - 0.6; out.push(balcony ? [ua, ub, 0.15, 2.65] : [ua, ub, 0.8, 2.5]); }
  return out;
}
// rectangle minus holes, in 2D: [x0,y0,x1,y1]
function subRects(r, holes) {
  const h = holes.find(H => H[0] < r[2] && H[2] > r[0] && H[1] < r[3] && H[3] > r[1]); if (!h) return [r];
  const rest = holes.filter(H => H !== h), out = [];
  const hx0 = Math.max(r[0], h[0]), hx1 = Math.min(r[2], h[2]), hy0 = Math.max(r[1], h[1]), hy1 = Math.min(r[3], h[3]);
  if (hx0 > r[0]) out.push(...subRects([r[0], r[1], hx0, r[3]], rest));
  if (hx1 < r[2]) out.push(...subRects([hx1, r[1], r[2], r[3]], rest));
  if (hy0 > r[1]) out.push(...subRects([hx0, r[1], hx1, hy0], rest));
  if (hy1 < r[3]) out.push(...subRects([hx0, hy1, hx1, r[3]], rest));
  return out;
}
const GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0xb8d4e0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
// upper floors: cornices, framed windows, "chuồng cọp" window cages, balconies, AC units, pipes, roof clutter
function facade(B, H, fc, floors, h, hi) {
  const { bx, w, d, H1, FH } = H;
  const apt = B.type === 'apartment';
  const glass = () => B.burning && chance(0.5) ? '#16120f' : pick(['#33414b', '#3b4954', '#2c3740', '#4c5d68', '#283139']);
  for (let f = 1; f < floors; f++) {
    const clear = f < B.levels; // you can walk on this floor: real glass
    const gbx = (u0, u1, v0, v1, y0, y1, hex, o) => clear ? H.glass(u0, u1, v0, v1, y0, y1) : bx(u0, u1, v0, v1, y0, y1, hex, o);
    const yb = H1 + (f - 1) * FH;
    if (apt) { bx(0.7, w - 0.7, -0.05, 0, yb + 0.6, yb + 2.4, f % 2 ? '#3a4651' : '#46525c'); if (hi) for (let u = 3; u < w - 1; u += 3) bx(u - 0.05, u + 0.05, -0.08, 0, yb + 0.6, yb + 2.4, '#d8d4cc'); continue; }
    bx(-0.02, w + 0.02, -0.16, 0, yb - 0.12, yb + 0.04, shade(fc, 0.82));
    const balcony = (f + B.id) % 3 !== 0;
    if (balcony) {
      bx(0.15, w - 0.15, -1.1, 0, yb - 0.12, yb + 0.08, '#d9d4c9');
      if (hi) { bx(0.15, w - 0.15, -1.16, -1.06, yb + 0.08, yb + 1.05, '#2e3134'); for (let u = 0.3; u < w - 0.2; u += 0.4) bx(u, u + 0.035, -1.14, -1.08, yb + 0.08, yb + 1.0, '#2e3134'); }
      if (hi && chance(0.5)) { const u = rand(0.4, w - 1.2); bx(u, u + 0.5, -0.95, -0.45, yb + 0.08, yb + 0.45, '#8a5a3a'); bx(u - 0.05, u + 0.55, -1.0, -0.4, yb + 0.45, yb + 0.95, pick(['#3c6a35', '#4e7d3a', '#5d8a44']), { pat: 6 }); }
      if (hi && chance(0.35)) { const u0 = rand(0.4, Math.max(0.5, w - 2.5)); for (let k = 0; k < 4; k++) bx(u0 + k * 0.45, u0 + k * 0.45 + 0.35, -0.9, -0.88, yb + 2.0, yb + 2.7, pick(['#d94f4f', '#4f7fd9', '#eee', '#d9b84f', '#58a05a', '#333'])); }
    }
    if (B.style === 'modern') { // full-width glass with a timber slat screen
      gbx(0.35, w - 0.35, -0.07, -0.05, yb + 0.25, yb + 2.85, '#26343e'); bx(0.3, w - 0.3, -0.1, -0.07, yb + 2.85, yb + 2.95, '#2a2a2a');
      const su = w * (0.55 + (f % 2) * 0.1); for (let u = su; u < w - 0.35; u += 0.16) bx(u, u + 0.09, -0.22, -0.1, yb + 0.25, yb + 2.85, '#8a5a3a', { pat: 5 });
      if (balcony) bx(0.15, w - 0.15, -1.16, -1.1, yb + 0.08, yb + 1.05, '#9fc4d6');
      continue;
    }
    const bays = Math.max(1, Math.round((w - 1.0) / 3.2)), bw = (w - 1.0) / bays;
    for (let j = 0; j < bays; j++) {
      const ua = 0.5 + j * bw + 0.3, ub = ua + bw - 0.6;
      if (balcony) {
        if (clear) { bx(ua - 0.08, ua, -0.05, 0.27, yb + 0.1, yb + 2.75, '#dcd7cd'); bx(ub, ub + 0.08, -0.05, 0.27, yb + 0.1, yb + 2.75, '#dcd7cd'); bx(ua - 0.08, ub + 0.08, -0.05, 0.27, yb + 2.65, yb + 2.75, '#dcd7cd'); } else bx(ua - 0.08, ub + 0.08, -0.05, 0, yb + 0.1, yb + 2.75, '#dcd7cd'); gbx(ua, ub, -0.07, -0.05, yb + 0.15, yb + 2.65, glass());
        if (hi) bx((ua + ub) / 2 - 0.03, (ua + ub) / 2 + 0.03, -0.09, -0.07, yb + 0.15, yb + 2.65, '#dcd7cd');
      } else {
        if (clear) { bx(ua - 0.08, ua, -0.05, 0.27, yb + 0.7, yb + 2.6, '#e5e1d8'); bx(ub, ub + 0.08, -0.05, 0.27, yb + 0.7, yb + 2.6, '#e5e1d8'); bx(ua - 0.08, ub + 0.08, -0.05, 0.27, yb + 2.5, yb + 2.6, '#e5e1d8'); bx(ua - 0.08, ub + 0.08, -0.05, 0.27, yb + 0.7, yb + 0.8, '#e5e1d8'); } else bx(ua - 0.08, ub + 0.08, -0.05, 0, yb + 0.7, yb + 2.6, '#e5e1d8'); gbx(ua, ub, -0.07, -0.05, yb + 0.8, yb + 2.5, glass());
        if (B.style === 'french') { const sw = Math.min(0.55, (ub - ua) / 2); bx(ua - sw - 0.1, ua - 0.1, -0.14, -0.05, yb + 0.75, yb + 2.55, '#2f6a3a', { pat: 4 }); bx(ub + 0.1, ub + sw + 0.1, -0.14, -0.05, yb + 0.75, yb + 2.55, '#2f6a3a', { pat: 4 }); bx(ua - 0.2, ub + 0.2, -0.2, 0, yb + 2.6, yb + 2.75, shade(fc, 1.1)); continue; }
        if (hi) {
          bx((ua + ub) / 2 - 0.03, (ua + ub) / 2 + 0.03, -0.09, -0.07, yb + 0.8, yb + 2.5, '#e5e1d8'); bx(ua, ub, -0.09, -0.07, yb + 1.95, yb + 2.0, '#e5e1d8');
          if ((j + f + B.id) % 2 === 0) {
            bx(ua - 0.15, ub + 0.15, -0.52, -0.47, yb + 0.6, yb + 2.7, '#2b2e31'); bx(ua - 0.15, ub + 0.15, -0.52, 0, yb + 2.68, yb + 2.73, '#2b2e31'); bx(ua - 0.15, ub + 0.15, -0.52, 0, yb + 0.58, yb + 0.63, '#2b2e31');
            for (let u = ua - 0.1; u <= ub + 0.1; u += 0.15) bx(u, u + 0.025, -0.52, -0.49, yb + 0.6, yb + 2.7, '#2b2e31');
          }
        }
      }
    }
    if (!balcony && chance(0.55)) { const u = rand(0.5, Math.max(0.6, w - 1.6)); const ay = yb + 0.08; bx(u, u + 0.85, -0.5, -0.18, ay, ay + 0.48, '#e8e8e4'); if (hi) bx(u + 0.15, u + 0.6, -0.52, -0.5, ay + 0.06, ay + 0.42, '#8f908c'); }
  }
  if (!apt) { bx(w - 0.2, w - 0.08, -0.32, -0.2, 0, h, '#7f8388'); }
  if (B.pitched) { pitchedRoof(B, H, h); return; }
  bx(0, w, 0, d, h, h + 0.15, '#8d877f');
  if (hi) { bx(0, w, 0, 0.15, h + 0.15, h + 0.9, shade(fc, 0.92), { pat: 3 }); bx(0, 0.15, 0, d, h + 0.15, h + 0.9, shade(fc, 0.92)); bx(w - 0.15, w, 0, d, h + 0.15, h + 0.9, shade(fc, 0.92)); }
  // roof: solar heater at the front, tank in the middle, stair room at the back, antenna on the side; never overlapping
  if (hi && !apt) {
    if (chance(0.4)) { bx(w * 0.2, w * 0.2 + 1.6, d * 0.1, d * 0.1 + 1.0, h + 0.15, h + 0.9, '#2b3d55'); bx(w * 0.2, w * 0.2 + 1.6, d * 0.1 + 1.0, d * 0.1 + 1.2, h + 0.15, h + 1.3, '#cfd3d6'); }
    if (chance(0.7)) { const p = H.Wp(w * 0.62, d * 0.38); ROOF_GEO.push(new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(p[0], h + 1.2, p[1]))); bx(w * 0.62 - 0.6, w * 0.62 + 0.6, d * 0.38 - 0.4, d * 0.38 + 0.4, h + 0.15, h + 0.65, '#7a756f'); }
    if (chance(0.35)) bx(w * 0.2, w * 0.8, d * 0.6, d * 0.88, h + 0.15, h + 2.6, '#a8a297', { pat: 3 });
    if (chance(0.45)) { const u = 0.5; bx(u, u + 0.04, d * 0.3, d * 0.3 + 0.04, h, h + 3.2, '#888'); bx(u, u + 1.0, d * 0.3, d * 0.3 + 0.04, h + 2.6, h + 2.64, '#888'); }
  }
}

// a tiled pitched roof (ridge parallel to the street), gables in the wall colour
function pitchedRoof(B, H, h) {
  const { w, d } = H, o = H.Wp(0, 0), pu = H.Wp(1, 0), pv = H.Wp(0, 1);
  const U = new THREE.Vector3(pu[0] - o[0], 0, pu[1] - o[1]), V = new THREE.Vector3(pv[0] - o[0], 0, pv[1] - o[1]), Y = new THREE.Vector3(0, 1, 0);
  const peak = Math.min(3.2, d * 0.28), sh = new THREE.Shape(); sh.moveTo(-0.3, 0); sh.lineTo(d + 0.3, 0); sh.lineTo(d / 2, peak); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: w + 0.4, bevelEnabled: false });
  const m = new THREE.Matrix4().makeBasis(V, Y, U).setPosition(o[0] - U.x * 0.2, h, o[1] - U.z * 0.2);
  ROOF_PARTS.push([geo, m, B.style === 'french' ? '#8a3a28' : '#9a4a32']);
}
const ROOF_PARTS = [];
function buildInterior(B, H) {
  if (B.type === 'office') return officeInterior(B, H);
  if (B.type === 'market') return marketInterior(B, H);
  if (B.type === 'house' || B.type === 'home') return houseInterior(B, H);
  shopInterior(B, H);
}
function drawGoods(H, style, u0, u1, va, vb, levels) {
  const { gx, hi } = H; const step = hi ? 1 : 1.6;
  for (const y of levels) {
    let v = va + 0.1;
    while (v < vb - 0.15) {
      if (style === 'bottle') { const c = pick(['#3a7bd5', '#9fd0e8', '#2f9e5b', '#d9452f', '#e8e8e8', '#f0c02a']); const n = hi ? 3 : 2; for (let k = 0; k < n; k++) { const uu = u0 + 0.07 + k * ((u1 - u0 - 0.14) / n); gx(uu, uu + 0.08, v, v + 0.08, y, y + 0.3, c); } v += 0.12 * step; }
      else if (style === 'can') { const c = pick(GOODS); gx(u0 + 0.08, u1 - 0.08, v, v + 0.1, y, y + 0.12, c); gx(u0 + 0.08, u1 - 0.08, v, v + 0.1, y + 0.12, y + 0.24, c); v += 0.13 * step; }
      else if (style === 'med') { const L = rand(0.12, 0.22); gx(u0 + 0.1, u1 - 0.1, v, v + L, y, y + rand(0.1, 0.22), pick(['#f2f2f2', '#e8eef2', '#fff7e0'])); if (hi) gx(u0 + 0.09, u1 - 0.09, v + 0.02, v + L - 0.02, y + 0.04, y + 0.08, pick(['#2f9e5b', '#3a7bd5', '#d9452f'])); v += (L + 0.04) * step; }
      else if (style === 'shoe') { const c = pick(['#f2f2f2', '#222', '#d9452f', '#3a7bd5', '#8a6a4a', '#f0c02a']); gx(u0 + 0.08, u0 + 0.36, v, v + 0.1, y, y + 0.1, c); gx(u0 + 0.08, u0 + 0.36, v + 0.12, v + 0.22, y, y + 0.1, c); v += 0.32 * step; }
      else if (style === 'tool') { gx(u0 + 0.1, u1 - 0.1, v, v + 0.05, y, y + 0.35, pick(['#7a7f85', '#c8302a', '#e8b21c', '#3a3c40'])); v += 0.1 * step; }
      else { const L = rand(0.18, 0.35); gx(u0 + 0.06, u1 - 0.06, v, v + L, y, y + rand(0.18, 0.38), pick(GOODS)); v += (L + 0.03) * step; }
    }
  }
}
function shopUnit(H, sp, side, va, vb, label, table, style) {
  const { bx, col, w, t } = H;
  const frame = sp.frame, sw = frame === 'rack' ? 0.7 : 0.5;
  const u0 = side ? w - t - sw : t, u1 = u0 + sw;
  const hgt = frame === 'rack' ? 1.75 : frame === 'cabinet' ? 1.25 : 2.0;
  const fcol = sp.col || '#8d9296';
  if (frame === 'rack') {
    const um = (u0 + u1) / 2;
    for (const v of [va, vb - 0.05]) { bx(um - 0.03, um + 0.03, v, v + 0.05, 0, hgt, '#4a4d52'); bx(u0, u1, v, v + 0.05, 0, 0.04, '#4a4d52'); }
    bx(um - 0.02, um + 0.02, va, vb, hgt - 0.08, hgt - 0.04, '#7a7d82');
  } else {
    bx(u0, u1, va, vb, 0, 0.1, shade(fcol, 0.7));
    bx(u0, u1, va, va + 0.05, 0, hgt, fcol); bx(u0, u1, vb - 0.05, vb, 0, hgt, fcol);
    const bu0 = side ? u1 - 0.04 : u0; bx(bu0, bu0 + 0.04, va, vb, 0, hgt, shade(fcol, 0.88));
    const lv = frame === 'cabinet' ? [0.55] : [0.55, 1.05, 1.55];
    for (const y of lv) bx(u0, u1, va, vb, y - 0.03, y, fcol);
    bx(u0, u1, va, vb, hgt - 0.04, hgt, fcol);
    if (frame === 'cabinet') { const fu = side ? u0 : u1 - 0.02; bx(fu, fu + 0.02, va + 0.05, vb - 0.05, 0.1, hgt - 0.05, '#bfd6e0'); }
    // shelf-edge strip in the unit's own colour so neighbouring units read as separate pieces
    const tag = pick(['#e8b21c', '#d9452f', '#2f9e5b', '#3a7bd5']); const tu = side ? u0 - 0.01 : u1;
    for (const y of lv) bx(tu, tu + 0.01, va + 0.05, vb - 0.05, y - 0.06, y - 0.01, tag);
  }
  col(u0, u1, va, vb, 0, hgt, { sight: false });
  const levels = frame === 'rack' ? [0] : frame === 'cabinet' ? [0.12, 0.58] : [0.12, 0.58, 1.08, 1.58];
  const n = chance(0.15) ? 0 : randi(1, 2);
  return H.unit(label, table, n, u0, u1, va, vb, hgt, () => {
    if (frame === 'rack') {
      const um = (u0 + u1) / 2; let v = va + 0.15;
      if (style === 'bag') { while (v < vb - 0.3) { H.gx(um - 0.18, um + 0.18, v, v + 0.3, hgt - 0.65, hgt - 0.1, pick(['#2d4a3a', '#1d4f9c', '#c8302a', '#333', '#7b1fa2', '#e07a2a'])); v += 0.38; } }
      else { while (v < vb - 0.15) { H.gx(um - 0.24, um + 0.24, v, v + 0.05, hgt - rand(0.85, 1.1), hgt - 0.1, pick(['#2a2f33', '#3d4f3a', '#e08a1e', '#c2447a', '#4f7fd9', '#eee', '#8a6a4a'])); v += 0.11; } }
    } else drawGoods(H, style, u0, u1, va, vb, levels);
  });
}
function shopInterior(B, H) {
  const { gx, col, Wp, w, d, t, hi } = H;
  const sp = UNIT_SPECS[B.type];
  const v0 = 1.2, v1 = B.levels > 1 ? d - 5.5 : d - 3.1;
  if (B.levels > 1 && sp) { // second floor of the shop: more units, labelled
    const U = onLevel(H, H.LV(1)); const L2 = sp.frame === 'cabinet' ? 1.6 : 2.0, n2 = Math.max(1, Math.floor((v1 - v0 + 0.6) / (L2 + 0.6))); let li2 = randi(0, sp.list.length - 1);
    for (const side of [0, 1]) for (let k = 0; k < n2; k++) { const va = v0 + k * (L2 + 0.6), vb = va + L2; if (vb > v1 + 0.01) break; const [label, table, style] = sp.list[li2++ % sp.list.length]; shopUnit(U, sp, side, va, vb, label + ' · tầng 2', table, style); }
  }
  if (sp) {
    const L = sp.frame === 'cabinet' ? 1.6 : 2.0, gap = 0.6; const n = Math.max(1, Math.floor((v1 - v0 + gap) / (L + gap)));
    let li = randi(0, sp.list.length - 1);
    for (const side of [0, 1]) for (let k = 0; k < n; k++) {
      const va = v0 + k * (L + gap), vb = va + L; if (vb > v1 + 0.01) break;
      const [label, table, style] = sp.list[li++ % sp.list.length];
      shopUnit(H, sp, side, va, vb, label, table, style);
    }
  }
  const cu0 = t + 0.8, cu1 = Math.min(cu0 + 2.2, w / 2 - 0.9);
  if (cu1 - cu0 > 0.8) {
    gx(cu0, cu1, d - 2.5, d - 1.9, 0, 1.0, B.type === 'pharmacy' ? '#d9dde0' : '#7a5a3c', { pat: 5 }); col(cu0, cu1, d - 2.5, d - 1.9, 0, 1.0, { sight: false });
    gx(cu0, cu1, d - 2.55, d - 1.85, 1.0, 1.04, '#5a4430');
    const c = H.unit('Quầy thu ngân', 'register', randi(0, 1), cu0, cu1, d - 2.5, d - 1.9, 1.05, () => { gx(cu0 + 0.2, cu0 + 0.6, d - 2.35, d - 2.0, 1.04, 1.24, '#2a2a2a'); if (hi) gx(cu0 + 0.25, cu0 + 0.55, d - 2.38, d - 2.34, 1.1, 1.22, '#6fb3c8'); }, { money: randi(2, 12) * 10000 });
    c.kind = 'register';
    B.npcSpots.push(Wp((cu0 + cu1) / 2, d - 1.45));
  } else B.npcSpots.push(Wp(w / 2 - 1.2, d - 1.6));
  const T = B.type;
  if (T === 'grocery' || T === 'cafe') {
    const fu0 = w - t - 1.3, fu1 = w - t - 0.4;
    if (fu0 > w / 2 + 0.8) {
      col(fu0, fu1, d - 1.5, d - t, 0, 1.95, { sight: false });
      H.unit('Tủ lạnh đứng', 'fridge', randi(1, 2), fu0, fu1, d - 1.5, d - t - 0.02, 1.95, () => { gx(fu0, fu1, d - 1.5, d - t - 0.02, 0, 1.95, '#dfe6ea'); gx(fu0 + 0.05, fu1 - 0.05, d - 1.53, d - 1.5, 0.15, 1.8, '#9fc4d6'); drawGoods(H, 'bottle', fu0 + 0.1, fu1 - 0.1, d - 1.45, d - 1.0, [0.2, 0.8, 1.35]); });
    }
  }
  if (T === 'food') {
    const ku0 = w - t - 1.6, ku1 = w - t - 0.05;
    if (ku0 > w / 2 + 0.8) {
      gx(ku0, ku1, d - 1.3, d - t, 0, 0.85, '#b8bcc0'); col(ku0, ku1, d - 1.3, d - t, 0, 0.85, { sight: false });
      H.unit('Bếp', 'f_kitchen', randi(0, 2), ku0, ku1, d - 1.3, d - t, 0.95, () => { gx(ku0 + 0.2, ku0 + 0.7, d - 1.1, d - 0.6, 0.85, 1.25, '#9a9ea2'); gx(ku0 + 0.25, ku0 + 0.65, d - 1.05, d - 0.65, 1.25, 1.28, '#5a4430'); });
      if (chance(0.7)) { const p = Wp(ku1 - 0.4, d - 0.8); addPickup('chao', p[0], 0.86, p[1], rand(0, 3), B); }
    }
    if (w > 7.5 && hi) for (let k = 0; k < 2; k++) { const v = 2.2 + k * 2.2; if (v > d - 3.5) break; const u = w / 2; gx(u - 0.5, u + 0.5, v, v + 0.7, 0.62, 0.66, '#e8e2d4'); gx(u - 0.04, u + 0.04, v + 0.3, v + 0.38, 0, 0.62, '#888'); for (const du of [-0.75, 0.75]) gx(u + du - 0.15, u + du + 0.15, v + 0.2, v + 0.5, 0, 0.42, pick(['#c8302a', '#1d6fc4'])); }
  }
  if (T === 'hardware' && chance(0.85)) { const p = Wp(w / 2 + 0.6, d - t - 0.25); addPickup('ongtuyp', p[0], 0.55, p[1], 0, B, { rx: 1.25 }); }
  if (T === 'bike') {
    const p = Wp(w / 2, 3.2); addBikeMesh(H.gmb, p[0], p[1], B.face === 'N' || B.face === 'S' ? 0 : Math.PI / 2, pick(['#b8231d', '#222', '#1d4f9c']));
    const q = Wp(w / 2 + 1.1, d - 3.6); for (let k = 0; k < 4; k++) H.gmb.geo(new THREE.TorusGeometry(0.28, 0.09, 6, 12), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(q[0], 0.1 + k * 0.18, q[1])), '#1a1a1a');
  }
  if (T === 'pharmacy' && hi) { H.bx(w / 2 - 0.35, w / 2 + 0.35, -0.12, -0.05, H.H1 - 0.6, H.H1 - 0.15, '#1a8a5a'); H.bx(w / 2 - 0.08, w / 2 + 0.08, -0.14, -0.12, H.H1 - 0.55, H.H1 - 0.2, '#fff'); H.bx(w / 2 - 0.2, w / 2 + 0.2, -0.14, -0.12, H.H1 - 0.45, H.H1 - 0.3, '#fff'); }
}
function houseInterior(B, H) {
  const { gx, col, Wp, w, d, t, hi } = H;
  const home = B.type === 'home';
  gx(t + 0.1, t + 0.85, 2.0, 4.2, 0, 0.45, '#6b4a2e', { pat: 5 }); gx(t + 0.1, t + 0.3, 2.0, 4.2, 0.45, 0.95, '#6b4a2e', { pat: 5 }); col(t + 0.1, t + 0.85, 2.0, 4.2, 0, 0.75, { sight: false });
  gx(t + 1.3, t + 2.1, 2.5, 3.7, 0, 0.45, '#7a5a3c', { pat: 5 });
  if (hi) { gx(t + 1.55, t + 1.75, 2.9, 3.1, 0.45, 0.6, '#e8e2d4'); gx(t + 1.8, t + 1.9, 3.2, 3.3, 0.45, 0.55, '#e8e2d4'); }
  gx(w - t - 0.55, w - t, 1.5, 3.4, 0, 0.6, '#8a6a4a', { pat: 5 }); col(w - t - 0.55, w - t, 1.5, 3.4, 0, 0.6, { sight: false });
  gx(w - t - 0.35, w - t - 0.25, 1.8, 3.1, 0.6, 1.3, '#1b1c1e');
  // hanging altar on the left wall
  const av = Math.min(d * 0.5, d - 5.6);
  gx(t, t + 0.5, av, av + 1.3, 1.6, 1.68, '#7a2318'); gx(t, t + 0.06, av, av + 1.3, 1.68, 2.5, '#a8322a');
  gx(t + 0.2, t + 0.35, av + 0.55, av + 0.75, 1.68, 1.85, '#d9a21c'); if (hi) { gx(t + 0.15, t + 0.4, av + 0.1, av + 0.4, 1.68, 1.95, '#d9b84f'); gx(t + 0.15, t + 0.4, av + 0.9, av + 1.2, 1.68, 1.95, '#d9b84f'); }
  if (!home) H.unit('Bàn thờ', 'house', 0, t, t + 0.5, av, av + 1.3, 2.5, null, { money: randi(2, 10) * 10000, altar: true, items: [] });
  // stairs (climbable in houses that have an open upper floor)
  if (B.levels > 1) upperRoom(B, H); // only houses whose upper floor you can actually reach have stairs
  // kitchen along the back wall
  const ku1 = Math.min(w / 2 - 0.8, t + 2.6), ku0 = t;
  if (ku1 - ku0 > 1.0) {
    gx(ku0, ku1, d - t - 0.65, d - t, 0, 0.88, '#d8d3c8'); col(ku0, ku1, d - t - 0.65, d - t, 0, 0.88, { sight: false });
    if (!home) H.unit('Tủ bếp', 'kitchen', randi(0, 2), ku0, ku1, d - t - 0.65, d - t, 0.95, () => { gx(ku0 + 0.15, ku0 + 0.75, d - t - 0.55, d - t - 0.1, 0.88, 0.95, '#2a2a2a'); if (hi) gx(ku0 + 0.9, ku1 - 0.1, d - t - 0.5, d - t - 0.1, 0.88, 1.1, '#9aa3a8'); });
    if (!home && chance(0.5)) { const p = Wp(ku0 + 0.45, d - t - 0.32); addPickup('chao', p[0], 0.96, p[1], rand(0, 3), B); }
  }
  const fu1 = w - t - 0.05, fu0 = fu1 - 0.7;
  if (fu0 > w / 2 + 0.8) {
    gx(fu0, fu1, d - t - 0.7, d - t, 0, 1.7, '#e8ecee'); gx(fu0 + 0.02, fu1 - 0.02, d - t - 0.72, d - t - 0.7, 1.05, 1.08, '#b9c0c4'); col(fu0, fu1, d - t - 0.7, d - t, 0, 1.7, { sight: false });
    if (!home) H.unit('Tủ lạnh', 'fridge', randi(0, 2), fu0, fu1, d - t - 0.7, d - t, 1.72, null);
  }
  if (!home) {
    if (d > 11) {
      const v0 = av + 1.6, v1 = Math.min(v0 + 1.6, d - 2.2);
      if (v1 - v0 > 1) { gx(t, t + 0.6, v0, v1, 0, 2.0, '#8a6a4a', { pat: 5 }); col(t, t + 0.6, v0, v1, 0, 2.0, { sight: false }); H.unit('Tủ quần áo', 'wardrobe', randi(0, 2), t, t + 0.6, v0, v1, 2.02, null); }
    }
    if (chance(0.6)) {
      const u = Math.max(t + 0.3, ku1 + 0.15), mv = d - t - 0.18;
      gx(u, u + 0.5, mv - 0.15, mv, 1.4, 1.85, '#f2f2f2'); gx(u + 0.18, u + 0.32, mv - 0.17, mv - 0.15, 1.5, 1.75, '#d9452f'); gx(u + 0.1, u + 0.4, mv - 0.17, mv - 0.15, 1.57, 1.68, '#d9452f');
      H.unit('Hộp thuốc gia đình', 'medbox', randi(1, 2), u, u + 0.5, mv - 0.15, mv, 1.9, null);
    }
    if (w > 6.5 && chance(0.6)) { const p = Wp(w * 0.5 + 1.2, 5.2); addBikeMesh(H.gmb, p[0], p[1], B.face === 'N' || B.face === 'S' ? 0 : Math.PI / 2, pick(['#b8231d', '#222', '#1d4f9c', '#e8e8e8'])); }
  }
  B.npcSpots.push(Wp(w * 0.35, Math.min(d * 0.55, d - 4)));
}
// the bedroom upstairs
function upperRoom(B, H) {
  const { gx, col, w, d, t, hi } = H; const y = H.LV(1);
  gx(t, t + 1.7, d - 2.4 - t, d - t, y, y + 0.45, '#8a6a4a', { pat: 5 }); gx(t + 0.05, t + 1.65, d - 2.35 - t, d - t - 0.05, y + 0.45, y + 0.6, '#e8e2d4'); gx(t + 0.2, t + 1.5, d - t - 0.55, d - t - 0.15, y + 0.6, y + 0.75, '#c9d6e8');
  col(t, t + 1.7, d - 2.4 - t, d - t, y, y + 0.6, { sight: false });
  H.unit('Gầm giường', 'house', randi(0, 2), t, t + 1.7, d - 2.4 - t, d - t, 0.62, null, { y0: y });
  gx(t, t + 0.6, 0.8, 2.6, y, y + 2.0, '#7a5a3c', { pat: 5 }); col(t, t + 0.6, 0.8, 2.6, y, y + 2.0, { sight: false });
  H.unit('Tủ quần áo tầng 2', 'wardrobe', randi(1, 2), t, t + 0.6, 0.8, 2.6, 2.02, null, { y0: y });
  const du = w - t - 1.4; if (du > w / 2) { gx(du - 1.2, du, t + 0.05, t + 0.65, y, y + 0.75, '#d8d2c4', { pat: 5 }); col(du - 1.2, du, t + 0.05, t + 0.65, y, y + 0.75, { sight: false }); H.unit('Bàn học', 'drawer', randi(0, 2), du - 1.2, du, t + 0.05, t + 0.65, 0.8, () => { if (hi) gx(du - 0.9, du - 0.4, t + 0.1, t + 0.15, y + 0.75, y + 1.1, '#1b1c1e'); }, { y0: y }); }
  if (chance(0.5)) { gx(w / 2 - 0.25, w / 2 + 0.25, d * 0.45, d * 0.45 + 0.5, y, y + 0.5, '#8a5a3a'); }
}
// ---------------------------------------------------------------- supermarket: three floors joined by wide stairs
const MARKET_THEMES = [
  [['Kệ mì gói', 'g_noodle', 'pack'], ['Kệ nước uống', 'g_drink', 'bottle'], ['Kệ đồ hộp', 'g_can', 'can'], ['Kệ bánh kẹo', 'g_snack', 'pack']],
  [['Giá áo khoác', 'c_coat', 'cloth', 'rack'], ['Kệ giày thể thao', 's_sport', 'shoe'], ['Giá balo', 'b_big', 'bag', 'rack'], ['Giá đồ bảo hộ', 'c_work', 'cloth', 'rack'], ['Kệ giày bảo hộ', 's_work', 'shoe']],
  [['Kệ dụng cụ', 'h_tool', 'tool'], ['Kệ ống sắt', 'h_pipe', 'tool'], ['Kệ đồ lặt vặt', 'g_misc', 'pack'], ['Quầy thuốc', 'p_band', 'med'], ['Kệ thuốc giảm đau', 'p_pain', 'med']],
];
function marketInterior(B, H) {
  const { gx, col, Wp, w, d, t, hi } = H;
  for (let k = 0; k < B.levels; k++) {
    const y = H.LV(k); const theme = MARKET_THEMES[k % MARKET_THEMES.length]; let li = 0;
    const tagF = ` · tầng ${k + 1}`;
    for (let ui = 0; ui < 4; ui++) {
      const uc = 4.2 + ui * 4.9; if (uc + 1 > w - 2.2) break;
      for (let vi = 0; vi < 4; vi++) {
        const va = 2.0 + vi * 3.0, vb = va + 2.4; if (vb > d - 2.4) break;
        for (const side of [0, 1]) {
          const [label, table, style, frame] = theme[li++ % theme.length];
          const u0 = side ? uc : uc - 0.55, u1 = u0 + 0.55, hgt = frame === 'rack' ? 1.75 : 1.9;
          if (frame === 'rack') { const um = (u0 + u1) / 2; gx(um - 0.03, um + 0.03, va, va + 0.05, y, y + hgt, '#4a4d52'); gx(um - 0.03, um + 0.03, vb - 0.05, vb, y, y + hgt, '#4a4d52'); gx(um - 0.02, um + 0.02, va, vb, y + hgt - 0.08, y + hgt - 0.04, '#7a7d82'); }
          else { gx(u0, u1, va, vb, y, y + 0.1, '#6f7479'); for (const yy of [0.55, 1.05, 1.55]) gx(u0, u1, va, vb, y + yy - 0.03, y + yy, '#9aa0a6'); gx(u0, u1, va, va + 0.05, y, y + hgt, '#9aa0a6'); gx(u0, u1, vb - 0.05, vb, y, y + hgt, '#9aa0a6'); const bu = side ? u0 : u1 - 0.04; gx(bu, bu + 0.04, va, vb, y, y + hgt, '#8a9096'); const tu = side ? u1 : u0 - 0.01; gx(tu, tu + 0.01, va + 0.05, vb - 0.05, y + 0.49, y + 0.54, pick(['#e8b21c', '#d9452f', '#2f9e5b'])); }
          col(u0, u1, va, vb, y, y + hgt, { sight: false });
          H.unit(label + tagF, table, chance(0.45) ? 1 : 0, u0, u1, va, vb, hgt, () => {
            if (frame === 'rack') { const um = (u0 + u1) / 2; let v = va + 0.15; while (v < vb - 0.2) { gx(um - 0.22, um + 0.22, v, v + 0.05, y + hgt - 1.0, y + hgt - 0.1, pick(['#2a2f33', '#3d4f3a', '#e08a1e', '#c2447a', '#4f7fd9', '#eee'])); v += style === 'bag' ? 0.4 : 0.12; } }
            else { const H2 = Object.assign({}, H, { gx: (a, b, c, e, y0, y1, hex, o) => gx(a, b, c, e, y0 + y, y1 + y, hex, o) }); drawGoods(H2, style, u0, u1, va, vb, [0.12, 0.58, 1.08, 1.58]); }
          }, { y0: y });
        }
      }
    }
    if (k === 0) { // checkouts by the door
      for (const cu of [w * 0.62, w * 0.8]) { gx(cu - 0.4, cu + 0.4, 0.9, 1.6, 0, 0.95, '#7a5a3c', { pat: 5 }); col(cu - 0.4, cu + 0.4, 0.9, 1.6, 0, 0.95, { sight: false }); H.unit('Quầy thu ngân', 'register', 0, cu - 0.4, cu + 0.4, 0.9, 1.6, 1.0, () => gx(cu - 0.2, cu + 0.15, 1.1, 1.4, 0.95, 1.15, '#2a2a2a'), { money: randi(5, 25) * 10000 }); }
    }
    if (hi) for (let u = 3; u < w - 2; u += 4) for (let v = 3; v < d - 2; v += 4) gx(u, u + 1.2, v, v + 0.15, H.LV(k + 1) - 0.18, H.LV(k + 1) - 0.15, '#f4f2e6');
  }
}
function marketFacade(B, H, fc, floors, h, hi) {
  const { bx, w, d, H1, LV } = H;
  for (let k = 1; k < floors; k++) { const y = LV(k); bx(-0.05, w + 0.05, -0.2, 0, y - 0.25, y + 0.1, '#e8e4dc'); if (k < B.levels) H.glass(0.3, w - 0.3, -0.08, -0.06, y + 0.3, y + B.FH - 0.4); else bx(0.3, w - 0.3, -0.08, 0, y + 0.3, y + B.FH - 0.4, '#2c3e4c'); if (hi) for (let u = 2; u < w - 1; u += 2.2) bx(u - 0.04, u + 0.04, -0.12, -0.08, y + 0.3, y + B.FH - 0.4, '#d8d4cc'); }
  if (!B.roof) bx(0, w, 0, d, h, h + 0.4, '#d8d4cc');
  for (let u = 1.5; u < w - 1; u += 3.6) bx(u - 0.12, u + 0.12, -0.15, 0, 0, H1 - 0.7, '#d8d4cc');
  bx(0.4, w - 0.4, -1.6, 0, H1 - 0.6, H1 - 0.45, B.type === 'office' ? '#3b4a5a' : '#c8251d'); // entrance canopy
}

// shifts a building helper up to another floor
function onLevel(H, y) {
  return Object.assign({}, H, {
    gx: (a, b, c, e, y0, y1, hex, o) => H.gx(a, b, c, e, y0 + y, y1 + y, hex, o),
    bx: (a, b, c, e, y0, y1, hex, o) => H.bx(a, b, c, e, y0 + y, y1 + y, hex, o),
    col: (a, b, c, e, y0, y1, o) => H.col(a, b, c, e, y0 + y, y1 + y, o),
    unit: (label, table, n, u0, u1, v0, v1, hgt, draw, opt = {}) => H.unit(label, table, n, u0, u1, v0, v1, hgt, draw, Object.assign({}, opt, { y0: (opt.y0 || 0) + y })),
    y,
  });
}
// the office: lobby on the ground floor, open-plan desks on floors 2–4 (you work on floor 2), stairs up to the roof
function officeInterior(B, H) {
  for (let k = 0; k < B.levels; k++) {
    const L = onLevel(H, H.LV(k)); const { gx, col } = L; const hi = H.hi, Wp = H.Wp, yk = H.LV(k);
    const desk = (u, v) => {
      gx(u, u + 4, v, v + 1.6, 0.74, 0.78, '#d8d2c4', { pat: 5 }); for (const [a, b] of [[u, v], [u + 3.95, v], [u, v + 1.55], [u + 3.95, v + 1.55]]) gx(a, a + 0.05, b, b + 0.05, 0, 0.74, '#777');
      gx(u, u + 4, v + 0.78, v + 0.82, 0.78, 1.2, '#7d8c96'); col(u, u + 4, v, v + 1.6, 0, 0.82, { sight: false });
      for (const kk of [0, 1]) { const su = u + 0.6 + kk * 2; for (const side of [0, 1]) {
        const vv = side ? v + 1.0 : v + 0.15;
        gx(su + 0.35, su + 0.45, vv + 0.05, vv + 0.15, 0.78, 0.95, '#2a2a2a'); gx(su + 0.08, su + 0.72, vv + (side ? 0.12 : 0.0), vv + (side ? 0.16 : 0.04), 0.95, 1.33, '#1b1c1e');
        if (hi) gx(su + 0.11, su + 0.69, vv + (side ? 0.115 : 0.035), vv + (side ? 0.12 : 0.045), 0.98, 1.3, chance(0.3) ? '#0f1418' : '#3d6f8e');
        const kv = side ? v + 0.75 : v + 0.62; if (!(side === 0 && kk === 1)) { gx(su + 0.15, su + 0.6, kv, kv + 0.15, 0.78, 0.8, '#1e1f22'); gx(su + 0.7, su + 0.78, kv, kv + 0.1, 0.78, 0.81, '#2a2a2a'); }
        if (hi) { const cv = side ? v + 1.9 : v - 0.75; gx(su + 0.15, su + 0.65, cv, cv + 0.5, 0.42, 0.48, '#222'); gx(su + 0.15, su + 0.65, side ? cv + 0.45 : cv, side ? cv + 0.5 : cv + 0.05, 0.48, 1.0, '#222'); gx(su + 0.37, su + 0.43, cv + 0.22, cv + 0.28, 0, 0.42, '#555'); }
        if (hi && chance(0.4)) gx(su + 0.8, su + 1.1, vv + 0.1, vv + 0.35, 0.78, 0.82 + rand(0, 0.08), '#f4f2ec');
        if (hi && chance(0.3)) gx(su - 0.25, su - 0.15, vv + 0.4, vv + 0.5, 0.78, 0.88, pick(['#c8302a', '#fff', '#3a7bd5']));
      } }
    };
    if (k === 0) { // reception by the door
      gx(20, 30, 3, 4, 0, 1.1, '#3b4a5a'); col(20, 30, 3, 4, 0, 1.1, { sight: false });
      for (const u of [8, 40]) { gx(u, u + 3, 7.5, 8.5, 0, 0.45, '#2f3a44'); gx(u, u + 3, 8.3, 8.5, 0.45, 0.95, '#2f3a44'); col(u, u + 3, 7.5, 8.5, 0, 0.6, { sight: false }); }
    }
    {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        const u = 8 + c * 10, v = 12 + r * 7; if (k === 0 && Math.abs(u + 2 - 32) < 4 && Math.abs(v - 17) < 3) continue; desk(u, v);
        if ((r + c + k) % 3 === 0) L.unit('Ngăn kéo bàn', 'drawer', randi(1, 2), u + 3.2, u + 4, v + 0.2, v + 1.4, 0.8, null);
        if ((r * 4 + c + k) % 3 === 1) { const p = Wp(u + 2.6 + 0.375, v + 0.69); addPickup('banphim', p[0], yk + 0.79, p[1], Math.PI / 2, B); }
      }
    }
    if (k === 0) {
      gx(13.5, 14.6, 34.5, 35.0, 1.2, 2.0, '#f2f2f2'); gx(13.95, 14.15, 34.45, 34.5, 1.35, 1.85, '#d9452f'); gx(13.75, 14.35, 34.45, 34.5, 1.5, 1.7, '#d9452f');
      L.unit('Tủ y tế', 'pharmacy', 0, 13.5, 14.6, 34.5, 35.0, 2.0, null, { items: ['socuu', 'bang', 'giamdau'] });
      gx(43.5, 44.5, 34.2, 35.0, 0, 1.9, '#e8ecee'); col(43.5, 44.5, 34.2, 35.0, 0, 1.9, { sight: false });
      L.unit('Tủ lạnh pantry', 'office', 0, 43.5, 44.5, 34.2, 35.0, 1.9, null, { items: ['nuocsuoi', 'nuocsuoi', 'banhmi', 'tangluc'] });
      gx(46, 46.4, 34.4, 34.8, 0, 1.2, '#dfe6ea'); gx(46.05, 46.35, 34.45, 34.75, 1.2, 1.6, '#7fb4d6');
      if (hi) gx(20, 28, 36.4, 36.5, 1.0, 2.2, '#f4f4f0');
    }
    for (const [u, v] of [[4, 4], [50, 4], [5, 30], [48, 30]]) { gx(u, u + 0.5, v, v + 0.5, 0, 0.5, '#8a5a3a'); gx(u - 0.2, u + 0.7, v - 0.2, v + 0.7, 0.5, 1.5, '#4e7d3a', { pat: 6 }); }
    for (let n = 0; n < (k === 0 ? 4 : 7); n++) { const u = rand(4, 48), v = rand(3, 32); if (Math.abs(u - 32) < 5 && Math.abs(v - 17) < 5) continue; const s2 = rand(0.6, 1.3), hh = rand(0.3, 0.9); gx(u - s2, u + s2, v - s2 * 0.6, v + s2 * 0.6, 0, hh, pick(['#9c968c', '#857f75', '#5d6670'])); col(u - s2, u + s2, v - s2 * 0.6, v + s2 * 0.6, 0, hh, { sight: false }); }
  }
}

let scene_props = new MB();
let scene_props_count = 0;
function flushProps() { if (!scene_props.empty) scene.add(meshFrom(scene_props)); scene_props = new MB(); }

// scooter-style motorbike: tyres with hubs, fork, leg shield, footboard, seat, handlebar with grips, lights, exhaust, plate
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bv = new THREE.Vector3(), _bs = new THREE.Vector3();
const BIKE_GEO = { tyre: new THREE.CylinderGeometry(0.29, 0.29, 0.1, 14), hub: new THREE.CylinderGeometry(0.13, 0.13, 0.13, 10), light: new THREE.CylinderGeometry(0.075, 0.07, 0.06, 10), pipe: new THREE.CylinderGeometry(0.045, 0.06, 0.62, 8), seat: new THREE.IcosahedronGeometry(1, 1), box: new THREE.BoxGeometry(1, 1, 1) };
function addBikeMesh(mb, x, z, ry, color) {
  const W = new THREE.Matrix4().makeRotationY(ry).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z));
  const part = (geo, px, py, pz, rx, ryy, rz, sx, sy, sz, hex) => { _bq.setFromEuler(new THREE.Euler(rx, ryy, rz)); _bm.compose(_bv.set(px, py, pz), _bq, _bs.set(sx, sy, sz)).premultiply(W); mb.geo(geo, _bm, hex); };
  const B = (px, py, pz, sx, sy, sz, hex, rx = 0) => part(BIKE_GEO.box, px, py, pz, rx, 0, 0, sx, sy, sz, hex);
  for (const wz of [-0.66, 0.66]) { part(BIKE_GEO.tyre, 0, 0.29, wz, 0, 0, Math.PI / 2, 1, 1, 1, '#141414'); part(BIKE_GEO.hub, 0, 0.29, wz, 0, 0, Math.PI / 2, 1, 1, 1, '#9aa0a6'); }
  B(0, 0.44, 0.66, 0.2, 0.06, 0.55, color);                       // rear fender
  B(0.08, 0.64, -0.6, 0.03, 0.62, 0.05, '#2a2a2a', -0.32); B(-0.08, 0.64, -0.6, 0.03, 0.62, 0.05, '#2a2a2a', -0.32); // fork
  B(0, 0.75, -0.48, 0.38, 0.62, 0.12, color, -0.25);            // leg shield
  B(0, 0.33, -0.08, 0.3, 0.06, 0.72, '#2b2b2b');                  // footboard
  B(0, 0.62, 0.38, 0.36, 0.4, 0.75, color);                       // rear body
  part(BIKE_GEO.seat, 0, 0.86, 0.3, 0, 0, 0, 0.17, 0.07, 0.42, '#1d1d1d');  // seat
  B(0, 1.1, -0.66, 0.16, 0.16, 0.16, color);                      // headset
  B(0, 1.15, -0.64, 0.66, 0.035, 0.035, '#2e2e2e');               // handlebar
  B(0.31, 1.15, -0.64, 0.1, 0.05, 0.05, '#111'); B(-0.31, 1.15, -0.64, 0.1, 0.05, 0.05, '#111');
  part(BIKE_GEO.light, 0, 1.08, -0.75, Math.PI / 2, 0, 0, 1, 1, 1, '#f5f1d8');
  B(0.24, 1.33, -0.62, 0.012, 0.22, 0.012, '#333'); B(-0.24, 1.33, -0.62, 0.012, 0.22, 0.012, '#333'); B(0.26, 1.45, -0.62, 0.09, 0.06, 0.02, '#222'); B(-0.26, 1.45, -0.62, 0.09, 0.06, 0.02, '#222');
  B(0, 0.7, 0.77, 0.16, 0.05, 0.03, '#c8302a');                   // tail light
  B(0, 0.52, 0.94, 0.22, 0.12, 0.01, '#e8e8e4');                  // plate
  part(BIKE_GEO.pipe, 0.18, 0.34, 0.45, Math.PI / 2 - 0.15, 0, 0, 1, 1, 1, '#a8adb2');
  B(0, 0.55, 0.0, 0.08, 0.25, 0.08, '#333', 0.2);                 // stand
}
function addCarMesh(mb, x, z, ry, color, wreck) {
  const o = { ry, ox: x, oz: z };
  mb.box(x - 0.9, 0.3, z - 2.1, x + 0.9, 0.95, z + 2.1, wreck ? '#3a3330' : color, o);
  mb.box(x - 0.8, 0.95, z - 1.1, x + 0.8, 1.55, z + 0.9, wreck ? '#2a2522' : color, o);
  mb.box(x - 0.82, 1.0, z - 1.05, x + 0.82, 1.45, z + 0.85, wreck ? '#141210' : '#2b3a44', o);
  mb.box(x - 0.7, 0.98, z - 1.12, x + 0.7, 1.48, z - 1.08, wreck ? '#141210' : '#3b4a54', o);
  if (!wreck) { mb.box(x - 0.8, 0.6, z - 2.12, x - 0.5, 0.78, z - 2.08, '#f5f1d8', o); mb.box(x + 0.5, 0.6, z - 2.12, x + 0.8, 0.78, z - 2.08, '#f5f1d8', o); mb.box(x - 0.8, 0.6, z + 2.08, x - 0.5, 0.75, z + 2.12, '#c8302a', o); mb.box(x + 0.5, 0.6, z + 2.08, x + 0.8, 0.75, z + 2.12, '#c8302a', o); mb.box(x - 0.6, 0.35, z - 2.14, x + 0.6, 0.5, z - 2.1, '#d8d8d8', o); }
  for (const [a, b] of [[-0.85, -1.4], [0.85, -1.4], [-0.85, 1.4], [0.85, 1.4]]) { const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(a, 0.33, b)).premultiply(new THREE.Matrix4().makeRotationY(ry)).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z)); mb.geo(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10), m, '#151515'); }
}
// vehicles knocked over by the tremors
function toppledBike(mb, x, z, ry, color) {
  const t = new MB(); addBikeMesh(t, 0, 0, 0, color);
  const side = Math.random() < 0.5 ? 1 : -1;
  const m = new THREE.Matrix4().makeRotationZ(side * Math.PI / 2 * 0.94).premultiply(new THREE.Matrix4().makeTranslation(0, 0.18, 0)).premultiply(new THREE.Matrix4().makeRotationY(ry)).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z));
  mb.merge(t, m);
  addCol(x - 0.7, z - 0.7, x + 0.7, z + 0.7, 0, 0.5, { sight: false });
}
function toppledCar(mb, x, z, ry, color, how) {
  const t = new MB(); addCarMesh(t, 0, 0, 0, color, Math.random() < 0.5);
  const m = how === 'roof' ? new THREE.Matrix4().makeRotationZ(Math.PI).premultiply(new THREE.Matrix4().makeTranslation(0, 1.58, 0)) : new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0.95, 0.9, 0));
  m.premultiply(new THREE.Matrix4().makeRotationY(ry)).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z));
  mb.merge(t, m);
  const along = Math.abs(Math.sin(ry)) > 0.7, hw = how === 'roof' ? 0.9 : 0.8;
  addCol(along ? x - 2.1 : x - hw - (how === 'roof' ? 0 : 0.8), along ? z - hw - (how === 'roof' ? 0 : 0.8) : z - 2.1, along ? x + 2.1 : x + hw + (how === 'roof' ? 0 : 0.8), along ? z + hw + (how === 'roof' ? 0 : 0.8) : z + 2.1, 0, how === 'roof' ? 1.6 : 1.9);
}
function carCol(x, z, ry) { const along = Math.abs(Math.sin(ry)) > 0.7; addCol(along ? x - 2.1 : x - 0.9, along ? z - 0.9 : z - 2.1, along ? x + 2.1 : x + 0.9, along ? z + 0.9 : z + 2.1, 0, 1.55); }
function bikeCol(x, z, ry) { const along = Math.abs(Math.sin(ry)) > 0.7; addCol(along ? x - 0.95 : x - 0.2, along ? z - 0.2 : z - 0.95, along ? x + 0.95 : x + 0.2, along ? z + 0.2 : z + 0.95, 0, 1.1, { sight: false }); }

// ---------------------------------------------------------------- world generation
const WIRES = [], SINKHOLES = [], FIRES = [], PLANKS = [], BLOCKS = [];
const ROADBLOCKS = [];   // {x0,z0,x1,z1,kind:'wall'|'tree'|'jam'}
const MIL_SITES = [];
const BODY_SPOTS = [];   // {x,z,ry,kind:'civ'|'sol',unc,gun,watch}
const FX_SPOTS = [];
const SIGN_QUADS = [];
const BLOCK_COLLAPSE = [];
function inCrack(x0, x1) { return x1 > CRACK.x0 - 7 && x0 < CRACK.x1 + 7; }
function freeSpot(x, z, r) { let ok = true; queryCols(x - r, z - r, x + r, z + r, b => { if (!ok || !b.solid || b.maxY < 0.3) return; if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) ok = false; }); return ok; }

// the fissure is planned first so the ground can be cut open along it
const CRACK_SEGS = [];
function planCrack() {
  for (let z = -175; z < 175; z += 4) {
    const wob = Math.sin(z * 0.07) * 1.5 + Math.sin(z * 0.23) * 0.6;
    const x0 = CRACK.x0 + wob + rand(0, 1), x1 = CRACK.x1 + wob - rand(0, 1);
    CRACK_SEGS.push({ z, x0, x1 }); HOLES.push([x0, z, x1, z + 4]);
  }
}
// underpass networks: stairwells [axis, line, top, bottom] and corridors [x0,z0,x1,z1]; one long branching network in the west-centre
const TUNNEL_PLAN = [
  { name: 'Hầm Hồ Tây', stairs: [['x', 28, -121, -114], ['x', 28, -79, -86], ['z', -35, 65, 58], ['x', -15, 15, 8]],
    cors: [[-114, 26.6, -86, 29.4], [-101.4, 26.6, -98.6, 51.4], [-101.4, 48.6, 1.4, 51.4], [-36.4, 51.4, -33.6, 58], [-1.4, -16.4, 1.4, 51.4], [1.4, -16.4, 8, -13.6]],
    collapses: [[-22, 48.6, -17, 51.4], [-1.4, 10, 1.4, 15]] },
  { name: 'Hầm phố Huế', stairs: [['z', 150, -65, -58], ['z', 150, -35, -42]], cors: [[148.6, -58, 151.4, -42]], collapses: [] },
  { name: 'Hầm Bạch Đằng', stairs: [['x', -110, 185, 192], ['x', -110, 215, 208]], cors: [[192, -111.4, 208, -108.6]], collapses: [] },
];
// rows of buildings keep a gap where a stairwell comes up
const RESERVE = [{ i: 2, j: 2, face: 'N', a0: -42, a1: -28 }, { i: 3, j: 1, face: 'W', a0: -22, a1: -8 }, { i: 2, j: 1, face: 'W', a0: 21, a1: 35 }, { i: 4, j: 0, face: 'S', a0: 143, a1: 157 }, { i: 4, j: 1, face: 'N', a0: 143, a1: 157 }, { i: 4, j: 0, face: 'E', a0: -117, a1: -103 }, { i: 5, j: 0, face: 'W', a0: -117, a1: -103 }];
const MARKET_AT = [{ i: 2, j: 2, face: 'N' }, { i: 4, j: 1, face: 'S' }];
function planTunnels() {
  for (const P of TUNNEL_PLAN) {
    const half = 1.2, T = { stairs: [], cors: P.cors.map(([x0, z0, x1, z1]) => ({ x0, z0, x1, z1 })), collapses: [], plan: P, name: P.name };
    for (const [axis, at, top, bot] of P.stairs) {
      const lo = Math.min(top, bot), hi = Math.max(top, bot);
      const S = axis === 'x' ? { x0: lo, x1: hi, z0: at - half, z1: at + half, top: [top, at], bot: [bot, at], axis } : { x0: at - half, x1: at + half, z0: lo, z1: hi, top: [at, top], bot: [at, bot], axis };
      T.stairs.push(S); HOLES.push([S.x0, S.z0, S.x1, S.z1]);
    }
    // sometimes one stretch has caved in (decided fresh every game)
    if (P.collapses.length) { const r = Math.random(); const k = r < 0.4 ? 0 : r < 0.8 ? 1 : -1; if (k >= 0) { const [x0, z0, x1, z1] = P.collapses[k]; T.collapses.push({ x0, z0, x1, z1 }); } }
    TUNNELS.push(T);
  }
}
function nearHole(x, z, m) { return HOLES.some(H => x > H[0] - m && x < H[2] + m && z > H[1] - m && z < H[3] + m); }
function genWorld() {
  rng = mulberry32(2611);
  buildAtlas();
  planCrack(); planTunnels();
  const g = new MB();
  boxHoles(g, -420, -0.3, -260, 420, 0, 260, '#4b4c4c', { pat: 2 });
  for (let i = 0; i < RX.length - 1; i++) for (let j = 0; j < RZ.length - 1; j++) {
    const bx0 = RX[i] + HALF, bx1 = RX[i + 1] - HALF, bz0 = RZ[j] + HALF, bz1 = RZ[j + 1] - HALF;
    BLOCKS.push({ i, j, bx0, bx1, bz0, bz1 });
    boxHoles(g, bx0 - 2, 0, bz0 - 2, bx1 + 2, 0.12, bz1 + 2, '#a39d92', { pat: 1 });
    g.box(bx0 - 2.02, 0, bz0 - 2.02, bx1 + 2.02, 0.15, bz0 - 1.85, '#8d8a84'); g.box(bx0 - 2.02, 0, bz1 + 1.85, bx1 + 2.02, 0.15, bz1 + 2.02, '#8d8a84');
    g.box(bx0 - 2.02, 0, bz0 - 2.02, bx0 - 1.85, 0.15, bz1 + 2.02, '#8d8a84'); g.box(bx1 + 1.85, 0, bz0 - 2.02, bx1 + 2.02, 0.15, bz1 + 2.02, '#8d8a84');
    boxHoles(g, bx0, 0.12, bz0, bx1, 0.14, bz1, i === 1 && j === 1 ? '#6f7d55' : '#857c6c');
  }
  g.box(-420, 0, -260, 420, 0.12, -157, '#a39d92', { pat: 1 }); g.box(-420, 0, 157, 420, 0.12, 260, '#a39d92', { pat: 1 });
  g.box(-420, 0, -157, -307, 0.12, 157, '#a39d92', { pat: 1 }); g.box(307, 0, -157, 420, 0.12, 157, '#a39d92', { pat: 1 });
  for (const x of RX) for (let z = -150; z < 150; z += 6) { if (RZ.some(r => Math.abs(z - r) < 10)) continue; g.box(x - 0.08, 0, z, x + 0.08, 0.02, z + 3, '#d8d4c4'); }
  for (const z of RZ) for (let x = -300; x < 300; x += 6) { if (RX.some(r => Math.abs(x - r) < 10) || nearHole(x + 1.5, z, 1.5)) continue; g.box(x, 0, z - 0.08, x + 3, 0.02, z + 0.08, '#d8d4c4'); }
  for (const x of RX) for (const z of RZ) for (let k = -4; k <= 4; k += 1.1) { g.box(x + k - 0.3, 0, z + 8, x + k + 0.3, 0.02, z + 10.5, '#d8d4c4'); g.box(x + 8, 0, z + k - 0.3, x + 10.5, 0.02, z + k + 0.3, '#d8d4c4'); g.box(x + k - 0.3, 0, z - 10.5, x + k + 0.3, 0.02, z - 8, '#d8d4c4'); g.box(x - 10.5, 0, z + k - 0.3, x - 8, 0.02, z + k + 0.3, '#d8d4c4'); }
  for (let k = 0; k < 60; k++) { const vert = chance(0.5), line = vert ? pick(RX) : pick(RZ), along = vert ? rand(-140, 140) : rand(-290, 290), lat = rand(-3, 3); const x = vert ? line + lat : along, z = vert ? along : line + lat; if (nearHole(x, z, 1)) continue; g.geo(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 12), new THREE.Matrix4().makeTranslation(x, 0.01, z), '#2e2f30'); }
  scene.add(meshFrom(g, MAT.vc, false));

  addCol(-500, -400, 500, BOUNDS.z0 - 1, 0, 60); addCol(-500, BOUNDS.z1 + 1, 500, 400, 0, 60);
  addCol(-500, -400, BOUNDS.x0 - 1, 400, 0, 60); addCol(BOUNDS.x1 + 1, -400, 500, 400, 0, 60);
  const ring = (x0, z0, x1, z1, face) => makeBuilding({ x0, z0, x1, z1, face, type: 'apartment', floors: randi(7, 12), enterable: false, color: pick(['#cfc8bb', '#b9b3a8', '#d8cfbd', '#a7aeb0']) });
  for (let x = -330; x < 330; x += rand(18, 30)) { const w = rand(16, 28); ring(x, -182, x + w - 1, -158, 'S'); ring(x, 158, x + w - 1, 182, 'N'); }
  for (let z = -158; z < 158; z += rand(18, 30)) { const w = rand(16, 28); ring(-334, z, -308, Math.min(z + w - 1, 158), 'E'); ring(308, z, 334, Math.min(z + w - 1, 158), 'W'); }

  for (const K of BLOCKS) {
    const { i, j, bx0, bx1, bz0, bz1 } = K;
    if (i === 1 && j === 1) { genLake(K); continue; }
    const DM = 17;
    const rows = [['N', bx0, bx1], ['S', bx0, bx1], ['W', bz0 + DM + 1, bz1 - DM - 1], ['E', bz0 + DM + 1, bz1 - DM - 1]];
    for (const [face, a0, a1] of rows) {
      let s = a0 + rand(0, 1.5);
      while (s < a1 - 6) {
        let w = chance(0.25) ? rand(11, 15) : rand(6.5, 10.5); if (s + w > a1) w = a1 - s; if (w < 6) break;
        const dd = rand(11, DM);
        let fp;
        if (face === 'N') fp = [s, bz0, s + w, bz0 + dd]; else if (face === 'S') fp = [s, bz1 - dd, s + w, bz1]; else if (face === 'W') fp = [bx0, s, bx0 + dd, s + w]; else fp = [bx1 - dd, s, bx1, s + w];
        if (i === 0 && j === 1 && face === 'E' && s < 30 && s + w > -30) { s = 32; continue; }
        if (i === 5 && j === 1 && face === 'E' && s + w > -8 && s < 8) { s = 9; continue; }
        const rsv = RESERVE.find(R0 => R0.i === i && R0.j === j && R0.face === face && s < R0.a1 && s + w > R0.a0);
        if (rsv) { s = rsv.a1 + 0.3; continue; }
        const mk = MARKET_AT.find(M => M.i === i && M.j === j && M.face === face && !M.done);
        if (mk && w >= 6) {
          mk.done = true; const mw = 26, md = 17;
          const mfp = face === 'N' ? [s, bz0, s + mw, bz0 + md] : face === 'S' ? [s, bz1 - md, s + mw, bz1] : face === 'W' ? [bx0, s, bx0 + md, s + mw] : [bx1 - md, s, bx1, s + mw];
          const B = makeBuilding({ x0: mfp[0], z0: mfp[1], x1: mfp[2], z1: mfp[3], face, type: 'market', enterable: true, floors: 3, levels: 3, H1: 4.8, FH: 4.4, sign: pick(ATLAS.byType.market), backDoor: true, color: '#d8d4cc' });
          s += mw + 0.5; continue;
        }
        if (i === 3 && (face === 'N' || face === 'S') && inCrack(fp[0], fp[2])) { ruinPile(fp); s += w + 0.4; continue; }
        if (chance(0.09)) { lotProps(fp, face); s += w + 0.5; continue; }
        let type = pickType();
        if (type === 'hotel' && w < 8) type = 'house';
        const enterable = type === 'hotel' ? false : type === 'house' ? chance(0.88) : true;
        const fl = type === 'hotel' ? randi(5, 8) : type === 'house' ? (chance(0.2) ? 1 : randi(2, 5)) : randi(2, 5);
        const B = makeBuilding({
          x0: fp[0], z0: fp[1], x1: fp[2], z1: fp[3], face, type, enterable,
          floors: fl, levels: type === 'house' && enterable && fl >= 2 && dd >= 11 ? 2 : (UNIT_SPECS[type] && type !== 'food' && type !== 'cafe' && enterable && fl >= 2 && dd >= 13 && chance(0.35) ? 2 : 1),
          style: type === 'house' ? pick(['tube', 'tube', 'french', 'modern', 'tile']) : null,
          closed: enterable && type !== 'house' && chance(0.22),
          backDoor: enterable && chance(0.55),
          sign: type !== 'house' ? pick(ATLAS.byType[type === 'hotel' ? 'hotel' : type]) : null,
          rent: type === 'house' && chance(0.15), flag: chance(0.12), banner: type === 'house' && chance(0.05) ? pick(ATLAS.byType.banner) : null,
          burning: chance(0.035),
        });
        sidewalkProps(B);
        s += w + rand(0, 0.5);
      }
    }
    courtyardProps(K);
    if (++scene_props_count % 3 === 0) flushProps();
  }
  flushProps();
  OFFICE = makeBuilding({ x0: -246, z0: -26, x1: -207, z1: 28, face: 'E', type: 'office', enterable: true, floors: 4, levels: 4, roof: true, H1: 4.4, FH: 4.2, color: '#7f8f9c', sign: ATLAS.byType.office[0], backDoor: false });
  START.y = 0;
  OFFICE.office = true;
  genHome();
  genCrack(); genTunnels(); genSinkholes(); genJams(); genRoadblocks(); genFallenTrees(); genMilitary(); genPoles(); genFires(); genBodySpots();
  for (const m of ROOF_GEO) scene_props.geo(new THREE.CylinderGeometry(0.55, 0.55, 1.7, 12), m, '#d4d8db');
  for (const [geo, m, c] of ROOF_PARTS) scene_props.geo(geo, m, c, 0.08, 7);
  flushProps();
  if (SIGN_QUADS.length) { const smb = new MB(); for (const [a, b, c, d2, n, uv] of SIGN_QUADS) smb.tquad([a, b, c, d2], n, uv); scene.add(new THREE.Mesh(smb.build(), ATLAS.mat)); }
  if (WIRES.length) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(WIRES, 3));
    scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1d1d1d })));
  }
}

function sidewalkProps(B) {
  const hi = QUALITY === 'high'; const T = B.type;
  const ry = (B.face === 'N' || B.face === 'S') ? 0 : Math.PI / 2;
  if (chance(0.45) && T !== 'food' && T !== 'cafe') {
    const n = randi(2, Math.max(2, Math.floor(B.w / 1.1) - 1));
    const domino = chance(0.3);
    for (let k = 0; k < n; k++) { const p = B.toWorld(0.8 + k * 1.0, -1.15); const c = pick(['#b8231d', '#222', '#1d4f9c', '#e8e8e8', '#7a7f85', '#c48a1a']); if (domino) toppledBike(scene_props, p[0], p[1], ry + rand(-0.2, 0.2), c); else { addBikeMesh(scene_props, p[0], p[1], ry, c); bikeCol(p[0], p[1], ry); } }
  }
  if (T === 'food' || T === 'cafe') {
    for (let k = 0; k < 6; k++) { const p = B.toWorld(rand(0.5, B.w - 0.5), rand(-1.7, -0.5)); scene_props.box(p[0] - 0.15, 0, p[1] - 0.15, p[0] + 0.15, 0.42, p[1] + 0.15, pick(['#c8302a', '#1d6fc4']), { ry: rand(0, 1) }); }
    const p = B.toWorld(B.w / 2, -1.1); scene_props.box(p[0] - 0.4, 0, p[1] - 0.4, p[0] + 0.4, 0.55, p[1] + 0.4, '#c8302a');
    if (T === 'food' && chance(0.6)) { const q = B.toWorld(B.w - 1.2, -1.2); scene_props.box(q[0] - 0.5, 0, q[1] - 0.8, q[0] + 0.5, 0.9, q[1] + 0.8, '#d9d4c9', { ry: ry + 0.3 }); scene_props.box(q[0] - 0.45, 0.9, q[1] - 0.75, q[0] + 0.45, 1.3, q[1] + 0.75, '#bfd6e0', { ry: ry + 0.3 }); }
  }
  if (T === 'grocery' && chance(0.75)) { // crates of drinks stacked out front: their own container
    const u = B.w - 1.0; const r = B.rect(u - 0.5, u + 0.5, -1.1, -0.4);
    for (let k = 0; k < 3; k++) scene_props.box(r[0], k * 0.3, r[1], r[2], k * 0.3 + 0.28, r[3], pick(['#c8302a', '#e8b21c', '#2f7d4c']));
    addCol(r[0], r[1], r[2], r[3], 0, 0.9, { sight: false });
    addContainer((r[0] + r[2]) / 2, 0.6, (r[1] + r[3]) / 2, 'Két nước ngoài hiên', 'street', randi(1, 2), B, { box: [r[0] - 0.03, 0, r[1] - 0.03, r[2] + 0.03, 0.95, r[3] + 0.03] });
  }
  if (T === 'clothes' && hi) for (let k = 0; k < 2; k++) { const p = B.toWorld(0.8 + k * 0.9, -0.6); scene_props.box(p[0] - 0.05, 0, p[1] - 0.05, p[0] + 0.05, 1.0, p[1] + 0.05, '#ddd'); scene_props.box(p[0] - 0.22, 1.0, p[1] - 0.12, p[0] + 0.22, 1.55, p[1] + 0.12, pick(['#c2447a', '#2a3f6b', '#eee'])); scene_props.box(p[0] - 0.09, 1.55, p[1] - 0.09, p[0] + 0.09, 1.75, p[1] + 0.09, '#e8dcc8'); }
  if (T === 'bike') { const p = B.toWorld(B.w - 0.8, -0.6); for (let k = 0; k < 3; k++) scene_props.geo(new THREE.TorusGeometry(0.3, 0.1, 6, 12), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(p[0], 0.1 + k * 0.2, p[1])), '#1a1a1a'); }
  if (hi && chance(0.35)) { const p = B.toWorld(rand(0.3, B.w - 0.3), -0.35); scene_props.box(p[0] - 0.2, 0, p[1] - 0.2, p[0] + 0.2, 0.45, p[1] + 0.2, pick(['#8a5a3a', '#6a4a3a', '#2f6a8a'])); scene_props.geo(new THREE.IcosahedronGeometry(1, 0), new THREE.Matrix4().compose(new THREE.Vector3(p[0], 0.85, p[1]), new THREE.Quaternion(), new THREE.Vector3(0.45, 0.5, 0.45)), pick(['#4e6b3a', '#5b7a40']), 0.15, 6); }
  if (chance(0.18)) { const p = B.toWorld(rand(0.5, B.w - 0.5), -1.6); for (let k = 0; k < 3; k++) scene_props.geo(new THREE.IcosahedronGeometry(1, 0), new THREE.Matrix4().compose(new THREE.Vector3(p[0] + rand(-0.4, 0.4), 0.25, p[1] + rand(-0.3, 0.3)), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 1), rand(0, 3), 0)), new THREE.Vector3(0.32, 0.28, 0.3)), '#1d1d1f'); }
}
function lotProps(fp, face) {
  const cx = (fp[0] + fp[2]) / 2, cz = (fp[1] + fp[3]) / 2;
  scene_props.box(fp[0], 0.12, fp[1], fp[2], 0.16, fp[3], '#6d6a5e');
  tree(cx + rand(-2, 2), cz + rand(-2, 2), rand(1, 1.4));
  if (chance(0.5)) { const ry = face === 'N' || face === 'S' ? Math.PI / 2 : 0; addCarMesh(scene_props, cx + rand(-1, 1), cz + rand(-1, 1), ry, pick(['#d8d8d8', '#9aa0a6', '#2c2c2c', '#7a1f1f'])); carCol(cx, cz, ry); }
  else addPickup('canhcay', cx + rand(-2, 2), 0.16, cz + rand(-2, 2), rand(0, 3));
}
// a collapsed house: a low mound you cannot cross, with big chunks on top (each one solid)
function ruinPile(fp) {
  const cx = (fp[0] + fp[2]) / 2, cz = (fp[1] + fp[3]) / 2;
  const parts = [[fp[0], fp[2]]];
  if (fp[2] > CRACK.x0 - 2 && fp[0] < CRACK.x1 + 2) { parts.length = 0; if (fp[0] < CRACK.x0 - 2.5) parts.push([fp[0], CRACK.x0 - 2.5]); if (fp[2] > CRACK.x1 + 2.5) parts.push([CRACK.x1 + 2.5, fp[2]]); }
  for (const [a, b] of parts) {
    if (b - a < 1.5) continue;
    scene_props.box(a + 0.4, 0, fp[1] + 0.4, b - 0.4, 0.85, fp[3] - 0.4, '#8a8276', { pat: 3 }); addCol(a + 0.4, fp[1] + 0.4, b - 0.4, fp[3] - 0.4, 0, 0.85);
    for (let k = 0; k < 6; k++) { const x = rand(a + 1, b - 1), z = rand(fp[1] + 1, fp[3] - 1); const sx = rand(0.8, 2.2); rubble(scene_props, x, z, sx, rand(0.6, 2.4), sx * 0.6, pick(['#8c857a', '#a49c8f', '#6e675e']), rand(0, 3), 0.85); }
  }
  FX_SPOTS.push([cx, cz]);
}
function courtyardProps(K) {
  const { bx0, bx1, bz0, bz1, i } = K;
  const cx0 = bx0 + 18, cx1 = bx1 - 18, cz0 = bz0 + 18, cz1 = bz1 - 18;
  for (let k = 0; k < 4; k++) { const x = rand(cx0, cx1), z = rand(cz0, cz1); if (i === 3 && x > CRACK.x0 - 4 && x < CRACK.x1 + 4) continue; tree(x, z, rand(0.9, 1.5)); if (chance(0.5)) addPickup('canhcay', x + rand(1.2, 2.2), 0.14, z + rand(-1, 1), rand(0, 3)); }
  for (let k = 0; k < 3; k++) {
    const x = rand(cx0, cx1), z = rand(cz0, cz1); if (i === 3 && x > CRACK.x0 - 4 && x < CRACK.x1 + 4) continue;
    const s = rand(1, 2); scene_props.box(x - s, 0, z - s, x + s, rand(0.6, 1.3), z + s, pick(['#6e6a5f', '#7d6a55', '#5c6670'])); addCol(x - s, z - s, x + s, z + s, 0, 1.0, { sight: false });
  }
  if (QUALITY === 'high') { const x = rand(cx0, cx1), z = rand(cz0, cz1); WIRES.push(x, 2.4, z, x + 6, 2.4, z); for (let k = 0; k < 5; k++) scene_props.box(x + 0.6 + k, 1.6, z - 0.02, x + 1.2 + k, 2.35, z + 0.02, pick(['#d94f4f', '#4f7fd9', '#eee', '#d9b84f', '#58a05a'])); }
}
function tree(x, z, s = 1) {
  scene_props.box(x - 0.18 * s, 0, z - 0.18 * s, x + 0.18 * s, 3.2 * s, z + 0.18 * s, '#5b4634', { pat: 5 });
  scene_props.box(x - 0.2 * s, 0, z - 0.2 * s, x + 0.2 * s, 0.9, z + 0.2 * s, '#e8e6df'); // whitewashed base
  const m = new THREE.Matrix4(), hi = QUALITY === 'high';
  for (let k = 0; k < (hi ? 5 : 3); k++) {
    m.compose(new THREE.Vector3(x + rand(-1.2, 1.2) * s, (3.4 + rand(0, 1.8)) * s, z + rand(-1.2, 1.2) * s), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)), new THREE.Vector3(1, 0.8, 1).multiplyScalar(rand(1.4, 2.3) * s));
    scene_props.geo(new THREE.IcosahedronGeometry(1, hi ? 1 : 0), m, pick(['#4e6b3a', '#5b7a40', '#46623a', '#6b7d45']), 0.15, 6);
  }
  addCol(x - 0.25 * s, z - 0.25 * s, x + 0.25 * s, z + 0.25 * s, 0, 3);
}

function genLake(K) {
  const { bx0, bx1, bz0, bz1 } = K;
  const wg = new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2).scale(LAKE.rx, 1, LAKE.rz).translate(LAKE.x, 0.05, LAKE.z);
  const water = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ color: 0x4d625d, emissive: 0x0d1514 })); water.receiveShadow = true; scene.add(water);
  WATER = water;
  boxHoles(scene_props, bx0, 0.14, bz0, bx1, 0.16, bz1, '#6f7d55');
  const N = 72;
  for (let k = 0; k < N; k++) {
    const a0 = k / N * TAU, a1 = (k + 1) / N * TAU;
    const p0 = [LAKE.x + Math.cos(a0) * (LAKE.rx + 1), LAKE.z + Math.sin(a0) * (LAKE.rz + 1)], p1 = [LAKE.x + Math.cos(a1) * (LAKE.rx + 1), LAKE.z + Math.sin(a1) * (LAKE.rz + 1)];
    const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2, len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ang = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
    scene_props.box(mx - 0.25, 0, mz - len / 2, mx + 0.25, 0.35, mz + len / 2, '#8f8a80', { ry: ang });
    scene_props.box(mx - 0.04, 0.35, mz - len / 2, mx + 0.04, 1.0, mz + len / 2, '#2f3a33', { ry: ang });
    scene_props.box(mx - 0.06, 0.35, mz - 0.06, mx + 0.06, 1.05, mz + 0.06, '#2f3a33');
    const pm = [LAKE.x + Math.cos(a0) * (LAKE.rx + 3), LAKE.z + Math.sin(a0) * (LAKE.rz + 3)];
    if (!nearHole(pm[0], pm[1], 1.8)) scene_props.box(pm[0] - 1.2, 0.15, pm[1] - 1.2, pm[0] + 1.2, 0.18, pm[1] + 1.2, '#b5aea2', { ry: ang, pat: 1 });
    addCol(Math.min(p0[0], p1[0]) - 0.3, Math.min(p0[1], p1[1]) - 0.3, Math.max(p0[0], p1[0]) + 0.3, Math.max(p0[1], p1[1]) + 0.3, 0, 3, { sight: false });
  }
  const ix = LAKE.x - 14, iz = LAKE.z + 13;
  scene_props.geo(new THREE.CylinderGeometry(5, 5.6, 1, 18), new THREE.Matrix4().makeTranslation(ix, 0.3, iz), '#6d7a52');
  scene_props.box(ix - 2, 0.8, iz - 2, ix + 2, 3.4, iz + 2, '#b9a787', { pat: 3 });
  for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) scene_props.box(ix + a - 0.2, 0.8, iz + b - 0.2, ix + a + 0.2, 3.6, iz + b + 0.2, '#8a2a20');
  scene_props.geo(new THREE.ConeGeometry(3.6, 2.2, 4), new THREE.Matrix4().makeRotationY(Math.PI / 4).premultiply(new THREE.Matrix4().makeTranslation(ix, 4.5, iz)), '#5e4b3a');
  for (let k = 0; k <= 12; k++) { const t = k / 12, z = lerp(iz + 5, LAKE.z + LAKE.rz + 1, t), y = 0.4 + Math.sin(t * Math.PI) * 2.0; scene_props.box(ix - 1.1, y, z - 0.75, ix + 1.1, y + 0.25, z + 0.75, '#b8231d'); scene_props.box(ix - 1.15, y + 0.25, z - 0.1, ix - 1.0, y + 1.1, z + 0.1, '#b8231d'); scene_props.box(ix + 1.0, y + 0.25, z - 0.1, ix + 1.15, y + 1.1, z + 0.1, '#b8231d'); }
  for (let k = 0; k < 26; k++) {
    const a = k / 26 * TAU + rand(-0.1, 0.1), rr = rand(1.15, 1.25);
    const x = LAKE.x + Math.cos(a) * (LAKE.rx + 5) * rr, z = LAKE.z + Math.sin(a) * (LAKE.rz + 5) * rr;
    if (x < bx0 + 1 || x > bx1 - 1 || z < bz0 + 1 || z > bz1 - 1 || nearHole(x, z, 3)) continue; tree(x, z, rand(1.1, 1.6));
    if (chance(0.4)) addPickup('canhcay', x + rand(1.5, 2.5), 0.17, z + rand(-1, 1), rand(0, 3));
  }
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2, x = LAKE.x + Math.cos(a) * (LAKE.rx + 3.2), z = LAKE.z + Math.sin(a) * (LAKE.rz + 3.2); if (nearHole(x, z, 1.5)) continue; scene_props.box(x - 0.9, 0.4, z - 0.25, x + 0.9, 0.5, z + 0.25, '#6b4a2e', { ry: -a + Math.PI / 2, pat: 5 }); }
}
var WATER = null;
var OFFICE = null, HOME = null;
function genHome() {
  const B = makeBuilding({ x0: 281, z0: -7, x1: 293, z1: 7, face: 'E', type: 'home', enterable: true, floors: 3, color: '#cfe0d0', backDoor: false, flag: true });
  B.home = true; HOME = B;
  const W = B.toWorld;
  tree(W(10.5, -4.2)[0], W(10.5, -4.2)[1], 1.2);
  const lamp = new THREE.PointLight(0xffc77a, 6, 14, 1.6); const lp = W(B.w / 2, 3); lamp.position.set(lp[0], 2.6, lp[1]); scene.add(lamp);
}
// a real chasm: the ground is cut open, the walls drop into darkness; only planks or a fallen pole cross it
function genCrack() {
  const m = new MB();
  const crossings = [-50, 8, 150];
  for (const { z, x0, x1 } of CRACK_SEGS) {
    m.box(x0 - 0.3, -1.6, z, x0, 0, z + 4, '#4a4038'); m.box(x1, -1.6, z, x1 + 0.3, 0, z + 4, '#4a4038');
    m.box(x0 - 0.3, -12, z, x0 + 0.6, -1.6, z + 4, '#1e1915'); m.box(x1 - 0.6, -12, z, x1 + 0.3, -1.6, z + 4, '#1e1915');
    m.box(x0, -12.2, z, x1, -12, z + 4, '#050403');
    m.box(x0 - 0.3, -0.25, z, x1 + 0.3, -0.02, z + 0.05, '#3a322b');
    const crossing = crossings.find(c => z >= c - 2 && z < c + 2);
    for (const e of [x0, x1]) { const sx = rand(0.5, 1.2), sz = rand(0.6, 1.6), sy = rand(0.25, 0.9); const ex = e < (x0 + x1) / 2 ? e - sx - 0.2 : e + sx + 0.2; const rz = crossing !== undefined ? z + (chance(0.5) ? 0.5 : 3.5) : z + rand(1, 3); rubble(m, ex, rz, sx, sy, crossing !== undefined ? 0.45 : sz, pick(['#3f3f3f', '#4d4b48', '#5a4b3c']), crossing !== undefined ? 0 : rand(-0.4, 0.4)); }
    if (crossing === undefined) addCol(x0 - 0.2, z, x1 + 0.2, z + 4, -12, 4, { sight: false });
    else {
      // only the plank strip is walkable; the rest of this segment is still a drop
      addCol(x0 - 0.2, z, x1 + 0.2, z + 1.2, -12, 4, { sight: false }); addCol(x0 - 0.2, z + 2.8, x1 + 0.2, z + 4, -12, 4, { sight: false });
      addCol(x0 - 0.2, z + 1.2, x1 + 0.2, z + 2.8, -12, 4, { sight: false, bikeOnly: true });
      PLANKS.push([(x0 + x1) / 2, z + 2]);
      if (crossing === 8) { m.box(x0 - 3, -0.1, z + 1.2, x1 + 3, 0.2, z + 2.8, '#9b9890'); addCol(x0 - 3, z + 1.2, x1 + 3, z + 2.8, -0.2, 0.2, { sight: false }); }
      else { for (let k = 0; k < 4; k++) m.box(x0 - 2, 0.04 + k * 0.01, z + 1.2 + k * 0.4, x1 + 2, 0.16, z + 1.57 + k * 0.4, '#7b5b38', { pat: 5 }); addCol(x0 - 2, z + 1.2, x1 + 2, z + 2.8, -0.2, 0.15, { sight: false }); }
    }
    if (chance(0.25)) FX_SPOTS.push([(x0 + x1) / 2, z + 2]);
  }
  scene.add(meshFrom(m, MAT.vc, false));
}
// underpasses: stairwells with canopies and railings, tiled corridors under the roads, walls found on a 0.5m grid
function genTunnels() {
  const m = new MB(), lights = new MB();
  for (const T of TUNNELS) {
    for (const S of T.stairs) {
      const alongX = S.axis === 'x', N = 12;
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N, y = (i + 0.5) / N * TUN_FLOOR;
        const a0 = [lerp(S.top[0], S.bot[0], t0), lerp(S.top[1], S.bot[1], t0)], a1 = [lerp(S.top[0], S.bot[0], t1), lerp(S.top[1], S.bot[1], t1)];
        const bx0 = alongX ? Math.min(a0[0], a1[0]) : S.x0, bx1 = alongX ? Math.max(a0[0], a1[0]) : S.x1, bz0 = alongX ? S.z0 : Math.min(a0[1], a1[1]), bz1 = alongX ? S.z1 : Math.max(a0[1], a1[1]);
        m.box(bx0, y - 0.3, bz0, bx1, y, bz1, '#a7a196', { pat: 1 }); m.box(bx0, y - 0.02, bz0, bx1, y + 0.01, bz1, i % 2 ? '#d9b84f' : '#a7a196');
      }
      const sides = alongX ? [[S.x0, S.z0 - 0.25, S.x1, S.z0], [S.x0, S.z1, S.x1, S.z1 + 0.25]] : [[S.x0 - 0.25, S.z0, S.x0, S.z1], [S.x1, S.z0, S.x1 + 0.25, S.z1]];
      for (const [x0, z0, x1, z1] of sides) { m.box(x0, TUN_FLOOR - 0.3, z0, x1, 0.75, z1, '#c9c2b4', { pat: 3 }); m.box(x0 - 0.02, 0.75, z0 - 0.02, x1 + 0.02, 1.0, z1 + 0.02, '#3a6a8a'); addCol(x0, z0, x1, z1, TUN_FLOOR - 0.5, 1.0); }
      const deep = alongX ? [S.bot[0] - 0.12, S.z0 - 0.25, S.bot[0] + 0.12, S.z1 + 0.25] : [S.x0 - 0.25, S.bot[1] - 0.12, S.x1 + 0.25, S.bot[1] + 0.12];
      m.box(deep[0], -0.3, deep[1], deep[2], 1.0, deep[3], '#c9c2b4', { pat: 3 }); addCol(deep[0], deep[1], deep[2], deep[3], -0.5, 1.0);
      const tp = S.top; addCol(tp[0] - (alongX ? 0.3 : 1.2), tp[1] - (alongX ? 1.2 : 0.3), tp[0] + (alongX ? 0.3 : 1.2), tp[1] + (alongX ? 1.2 : 0.3), 0, 1, { sight: false, bikeOnly: true });
      for (const [cx, cz] of [[S.x0, S.z0 - 0.3], [S.x1, S.z0 - 0.3], [S.x0, S.z1 + 0.3], [S.x1, S.z1 + 0.3]]) m.box(cx - 0.06, 0.75, cz - 0.06, cx + 0.06, 2.9, cz + 0.06, '#4a5560');
      m.box(S.x0 - 0.2, 2.9, S.z0 - 0.5, S.x1 + 0.2, 3.0, S.z1 + 0.5, '#3a7aa8');
      const sx = tp[0], sz = tp[1], uv = ATLAS.cells[ATLAS.byType.tunnel[0]];
      if (alongX) { const f = S.top[0] < S.bot[0] ? -1 : 1; SIGN_QUADS.push([[sx + f * 0.02, 2.2, S.z1 + 0.3], [sx + f * 0.02, 2.2, S.z0 - 0.3], [sx + f * 0.02, 2.85, S.z0 - 0.3], [sx + f * 0.02, 2.85, S.z1 + 0.3], [f, 0, 0], uv]); m.box(sx - 0.03, 2.15, S.z0 - 0.35, sx + 0.03, 2.9, S.z1 + 0.35, '#1f4fa0'); }
      else { const f = S.top[1] < S.bot[1] ? -1 : 1; SIGN_QUADS.push([[S.x0 - 0.3, 2.2, sz + f * 0.02], [S.x1 + 0.3, 2.2, sz + f * 0.02], [S.x1 + 0.3, 2.85, sz + f * 0.02], [S.x0 - 0.3, 2.85, sz + f * 0.02], [0, 0, f], uv]); m.box(S.x0 - 0.35, 2.15, sz - 0.03, S.x1 + 0.35, 2.9, sz + 0.03, '#1f4fa0'); }
    }
    // corridors: floor, ceiling (casts shadow, blocks sight), ceiling lights
    for (const Q of T.cors) {
      m.box(Q.x0, TUN_FLOOR - 0.3, Q.z0, Q.x1, TUN_FLOOR, Q.z1, '#b5aea2', { pat: 1 });
      const ceil = new MB(); ceil.box(Q.x0 - 0.3, -0.3, Q.z0 - 0.3, Q.x1 + 0.3, -0.05, Q.z1 + 0.3, '#9a958b', { bottom: true }); const cm = meshFrom(ceil); cm.castShadow = true; scene.add(cm);
      addCol(Q.x0, Q.z0, Q.x1, Q.z1, -0.3, -0.03);
      const alongX = Q.x1 - Q.x0 > Q.z1 - Q.z0, L = alongX ? Q.x1 - Q.x0 : Q.z1 - Q.z0;
      for (let k = 1.5; k < L - 1; k += 3.5) { const cx = alongX ? Q.x0 + k : (Q.x0 + Q.x1) / 2, cz = alongX ? (Q.z0 + Q.z1) / 2 : Q.z0 + k; if (T.collapses.some(C => cx > C.x0 - 2 && cx < C.x1 + 2 && cz > C.z0 - 2 && cz < C.z1 + 2)) continue; lights.box(cx - (alongX ? 0.6 : 0.1), -0.34, cz - (alongX ? 0.1 : 0.6), cx + (alongX ? 0.6 : 0.1), -0.3, cz + (alongX ? 0.1 : 0.6), '#fff4d8'); }
    }
    // walls wherever a corridor cell touches solid ground
    const G = 0.5, xs = T.cors.flatMap(Q => [Q.x0, Q.x1]).concat(T.stairs.flatMap(S => [S.x0, S.x1])), zs = T.cors.flatMap(Q => [Q.z0, Q.z1]).concat(T.stairs.flatMap(S => [S.z0, S.z1]));
    const X0 = Math.min(...xs) - 1, Z0 = Math.min(...zs) - 1, NX = Math.ceil((Math.max(...xs) + 1 - X0) / G), NZ = Math.ceil((Math.max(...zs) + 1 - Z0) / G);
    const cell = new Uint8Array(NX * NZ); // 1 corridor, 2 stair
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = X0 + (i + 0.5) * G, z = Z0 + (j + 0.5) * G; if (T.cors.some(Q => x > Q.x0 && x < Q.x1 && z > Q.z0 && z < Q.z1)) cell[j * NX + i] = 1; else if (T.stairs.some(S => x > S.x0 - 0.3 && x < S.x1 + 0.3 && z > S.z0 - 0.3 && z < S.z1 + 0.3)) cell[j * NX + i] = 2; }
    const at = (i, j) => (i < 0 || j < 0 || i >= NX || j >= NZ) ? 0 : cell[j * NX + i];
    const wall = (x0, z0, x1, z1) => { m.box(x0, TUN_FLOOR, z0, x1, -0.3, z1, '#d8d2c4', { pat: 3 }); addCol(x0, z0, x1, z1, TUN_FLOOR - 0.5, -0.3); };
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (di) for (let i = 0; i < NX; i++) { let run = -1; for (let j = 0; j <= NZ; j++) { const need = j < NZ && at(i, j) === 1 && !at(i + di, j); if (need && run < 0) run = j; if (!need && run >= 0) { const xe = X0 + (di > 0 ? i + 1 : i) * G; wall(di > 0 ? xe : xe - 0.25, Z0 + run * G, di > 0 ? xe + 0.25 : xe, Z0 + j * G); run = -1; } } }
      else for (let j = 0; j < NZ; j++) { let run = -1; for (let i = 0; i <= NX; i++) { const need = i < NX && at(i, j) === 1 && !at(i, j + dj); if (need && run < 0) run = i; if (!need && run >= 0) { const ze = Z0 + (dj > 0 ? j + 1 : j) * G; wall(X0 + run * G, dj > 0 ? ze : ze - 0.25, X0 + i * G, dj > 0 ? ze + 0.25 : ze); run = -1; } } }
    }
    // blue stripe along the walls
    // caved-in stretches: rubble filling the corridor, broken ceiling, light from above
    for (const C of T.collapses) {
      for (let k = 0; k < 9; k++) { const x = R(C.x0, C.x1), z = R(C.z0, C.z1), sx = R(0.5, 1.2); m.box(x - sx, TUN_FLOOR, z - sx * 0.7, x + sx, TUN_FLOOR + R(1.2, 3.0), z + sx * 0.7, pick(['#8c857a', '#a49c8f', '#6e675e']), { ry: R(0, 3), pat: 3 }); }
      m.box(C.x0, TUN_FLOOR, C.z0, C.x1, TUN_FLOOR + 2.2, C.z1, '#8a8276', { pat: 3 });
      addCol(C.x0, C.z0, C.x1, C.z1, TUN_FLOOR - 0.5, -0.3);
      FX_SPOTS.push([(C.x0 + C.x1) / 2, (C.z0 + C.z1) / 2]);
    }
    // which stairwells are still connected underground (for the route finder)
    T.links = [];
    const open = (i, j) => { if (i < 0 || j < 0 || i >= NX || j >= NZ || !cell[j * NX + i]) return false; const x = X0 + (i + 0.5) * G, z = Z0 + (j + 0.5) * G; return !T.collapses.some(C => x > C.x0 && x < C.x1 && z > C.z0 && z < C.z1); };
    const idx = (x, z) => [Math.floor((x - X0) / G), Math.floor((z - Z0) / G)];
    T.stairs.forEach((A, ia) => {
      const dist = new Int32Array(NX * NZ).fill(-1); const [si, sj] = idx(...A.bot); const q = [sj * NX + si]; dist[q[0]] = 0;
      for (let h = 0; h < q.length; h++) { const c = q[h], i = c % NX, j = (c / NX) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (j + b) * NX + i + a; if (dist[k] >= 0 || !open(i + a, j + b)) continue; dist[k] = dist[c] + 1; q.push(k); } }
      T.stairs.forEach((B2, ib) => { if (ib <= ia) return; const [bi, bj] = idx(...B2.bot); const dd = dist[bj * NX + bi]; if (dd >= 0) T.links.push([ia, ib, Math.round(dd * G + 14)]); });
    });
  }
  scene.add(meshFrom(m));
  scene.add(new THREE.Mesh(lights.build(), new THREE.MeshBasicMaterial({ color: 0xfff1cc })));
}
function genSinkholes() {
  const spots = [[CRACK.x0 + 7, 50, 8], [CRACK.x0 + 7, -150, 7], [150, 50, 7], [250, -150, 7], [200, 102, 6], [100, -96, 6.5], [-100, 120, 6], [248, 50, 5.5]];
  for (const [x, z, r] of spots) {
    SINKHOLES.push({ x, z, r });
    scene_props.geo(new THREE.CylinderGeometry(r, r * 0.7, 0.3, 18), new THREE.Matrix4().makeTranslation(x, -0.1, z), '#0f0c0a');
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, s2 = rand(1, 2.2); rubble(scene_props, x + Math.cos(a) * r, z + Math.sin(a) * r, s2, rand(0.3, 1.1), s2 * 0.6, pick(['#3f3f3f', '#4d4b48', '#5a4b3c']), a); }
    const q = r * 0.75; addCol(x - q, z - q, x + q, z + q, -10, 3, { sight: false });
    const q2 = r * 0.95; addCol(x - q2, z - r * 0.45, x + q2, z + r * 0.45, -10, 3, { sight: false }); addCol(x - r * 0.45, z - q2, x + r * 0.45, z + q2, -10, 3, { sight: false });
    FX_SPOTS.push([x, z]);
  }
}
// abandoned traffic; low barricades on both sidewalks so bikes cannot slip past (people step over)
function sidewalkBarricade(axis, line, at) {
  for (const s of [-1, 1]) {
    const a = line + s * 6.0; const x0 = axis === 'z' ? at - 0.5 : a - 1.15, x1 = axis === 'z' ? at + 0.5 : a + 1.15, z0 = axis === 'z' ? a - 1.15 : at - 0.5, z1 = axis === 'z' ? a + 1.15 : at + 0.5;
    scene_props.box(x0, 0, z0, x1, 0.5, z1, pick(['#6b6f74', '#8a5a3a', '#c8302a']));
    addCol(x0, z0, x1, z1, 0, 0.5, { sight: false });
  }
}
function genJams() {
  const jams = [['z', -50, -52], ['x', -100, 100], ['z', 50, -250], ['x', 0, -100], ['z', 150, -150], ['z', 50, 18], ['z', -50, 140], ['x', 200, -10], ['z', 150, 230], ['x', 300, -100], ['z', -150, -60], ['x', -200, -100], ['z', 50, 150]];
  for (const [axis, line, at] of jams) {
    for (let k = 0; k < 3; k++) {
      const off = at + (k - 1) * 5.5;
      let lat = -5 + rand(0, 0.3);
      while (lat < 4.6) {
        const isCar = chance(0.6) && lat < 3.0;
        const along = off + rand(-0.6, 0.6);
        const x = axis === 'z' ? along : line + lat + (isCar ? 0.9 : 0.2), z = axis === 'z' ? line + lat + (isCar ? 0.9 : 0.2) : along;
        const ry = axis === 'z' ? Math.PI / 2 : 0;
        if (isCar) { addCarMesh(scene_props, x, z, ry + rand(-0.06, 0.06), pick(['#d8d8d8', '#9aa0a6', '#2c2c2c', '#7a1f1f', '#2b5d8a', '#d9c45a']), chance(0.15)); carCol(x, z, ry); lat += 1.8 + rand(0.85, 1.0); }
        else if (chance(0.35)) { toppledBike(scene_props, x, z, ry + rand(-0.3, 0.3), pick(['#b8231d', '#222', '#1d4f9c', '#e8e8e8'])); lat += 0.6 + rand(0.85, 1.0); }
        else { addBikeMesh(scene_props, x, z, ry, pick(['#b8231d', '#222', '#1d4f9c', '#e8e8e8'])); bikeCol(x, z, ry); lat += 0.4 + rand(0.85, 1.0); }
      }
    }
    sidewalkBarricade(axis, line, at);
    ROADBLOCKS.push(axis === 'z' ? { x0: at - 9, z0: line - 7, x1: at + 9, z1: line + 7, kind: 'jam' } : { x0: line - 7, z0: at - 9, x1: line + 7, z1: at + 9, kind: 'jam' });
  }
  for (let k = 0; k < 26; k++) {
    const vert = chance(0.5), line = vert ? pick(RX) : pick(RZ), along = vert ? rand(-140, 140) : rand(-290, 290), lat = rand(-3.5, 3.5);
    const x = vert ? line + lat : along, z = vert ? along : line + lat; const ry = vert ? 0 : Math.PI / 2;
    if (dist2(x, z, START.x, START.z) < 30) continue;
    const wreck = chance(0.4), flip = chance(0.4) ? pick(['roof', 'side']) : null;
    if (flip) { toppledCar(scene_props, x, z, ry, pick(['#d8d8d8', '#9aa0a6', '#2c2c2c', '#7a1f1f', '#2b5d8a']), flip); continue; }
    addCarMesh(scene_props, x, z, ry + rand(-0.4, 0.4), pick(['#d8d8d8', '#9aa0a6', '#2c2c2c', '#7a1f1f']), wreck); carCol(x, z, ry);
    if (wreck && chance(0.6)) FIRES.push([x, 1.4, z, 0.8]);
    if (chance(0.4)) BODY_SPOTS.push({ x: x + (vert ? 2.4 : rand(-1.5, 1.5)), z: z + (vert ? rand(-1.5, 1.5) : 2.4), ry: rand(0, TAU), kind: 'civ', unc: chance(0.3) });
  }
}
// collapsed tower lying across the whole street: nobody gets through
function genRoadblocks() {
  const RB = [['x', -100, -8], ['z', 50, -60], ['x', 200, 112], ['z', -50, 252], ['x', 0, 112], ['z', 150, 60], ['x', 100, -112], ['z', -50, -150], ['x', 300, 100]];
  for (const [axis, line, at] of RB) {
    const m = scene_props;
    const cx = axis === 'x' ? line : at, cz = axis === 'x' ? at : line;
    const ry = (axis === 'x' ? Math.PI / 2 : 0) + rand(-0.28, 0.28);
    const L = 22, W = 5.5;
    m.box(cx - W / 2, 0, cz - L / 2, cx + W / 2, 3.6, cz + L / 2, pick(['#c9c2b4', '#b8b0a2', '#d6cdb9']), { ry, pat: 3 });
    for (let k = -4; k <= 4; k++) for (const y of [0.8, 2.2]) m.box(cx + W / 2, y, cz + k * 2.2 - 0.6, cx + W / 2 + 0.05, y + 0.9, cz + k * 2.2 + 0.6, '#26303a', { ry, ox: cx, oz: cz });
    for (let k = -4; k <= 4; k++) m.box(cx - W / 2 - 0.05, 2.2, cz + k * 2.2 - 0.6, cx - W / 2, 3.1, cz + k * 2.2 + 0.6, '#26303a', { ry, ox: cx, oz: cz });
    for (let k = 0; k < 18; k++) { const a = rand(-8, 8), b = rand(-6, 6); const x = axis === 'x' ? line + a : at + b, z = axis === 'x' ? at + b : line + a; const s2 = rand(0.6, 2.0); rubble(m, x, z, s2, rand(0.5, 2.6), s2 * 0.7, pick(['#8c857a', '#a49c8f', '#6e675e', '#7d7468']), rand(0, 3)); }
    for (let k = 0; k < 6; k++) { const x = cx + rand(-5, 5), z = cz + rand(-5, 5); m.box(x - 0.03, 0, z - 0.03, x + 0.03, rand(2, 4.5), z + 0.03, '#5a4a3a', { ry: rand(0, 3) }); }
    const r = axis === 'x' ? [line - 7.4, at - 5, line + 7.4, at + 5] : [at - 5, line - 7.4, at + 5, line + 7.4];
    addCol(r[0], r[1], r[2], r[3], 0, 4.2);
    ROADBLOCKS.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], kind: 'wall' });
    FX_SPOTS.push([cx, cz]);
    BLOCK_COLLAPSE.push(axis === 'x' ? [line + (chance(0.5) ? 11 : -11), at] : [at, line + (chance(0.5) ? 11 : -11)]);
  }
}
// fallen street trees: bikes stop here, people climb over the trunk
function genFallenTrees() {
  const spots = [['x', -200, 20], ['z', -150, 30], ['x', 100, 30], ['z', 150, -50], ['x', -300, -20], ['z', 50, 230], ['x', 200, -110], ['z', -50, 80], ['x', 0, 30], ['z', 150, 180], ['x', -100, -110], ['z', -150, 200]];
  for (const [axis, line, at] of spots) {
    const side = chance(0.5) ? 1 : -1;
    const tx = (lat, al) => axis === 'x' ? [line + lat, at + al] : [at + al, line + lat];
    const a = tx(-7.3, rand(-0.6, 0.6)), b = tx(7.3, rand(-0.6, 0.6));
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
    scene_props.box(mx - 0.32, 0, mz - 7.6, mx + 0.32, 0.55, mz + 7.6, '#5b4634', { ry: ang, pat: 5 });
    for (let k = 0; k < 5; k++) { const p = tx(rand(-6, 6), rand(-0.5, 0.5)); scene_props.box(p[0] - 0.08, 0.3, p[1] - 1.2, p[0] + 0.08, 0.45, p[1] + 1.2, '#5b4634', { ry: rand(0, 3), pat: 5 }); }
    const cr = tx(side * 9.5, 0); const m = new THREE.Matrix4();
    for (let k = 0; k < 7; k++) { m.compose(new THREE.Vector3(cr[0] + rand(-2.5, 2.5), rand(0.8, 2.6), cr[1] + rand(-2.5, 2.5)), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)), new THREE.Vector3(1, 0.8, 1).multiplyScalar(rand(1.5, 2.4))); scene_props.geo(new THREE.IcosahedronGeometry(1, 1), m, pick(['#4e6b3a', '#5b7a40', '#46623a']), 0.15, 6); }
    for (let k = 0; k < 4; k++) { const p = tx(side * rand(2, 7), rand(-1.5, 1.5)); m.compose(new THREE.Vector3(p[0], 0.7, p[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)), new THREE.Vector3(1.3, 0.8, 1.3)); scene_props.geo(new THREE.IcosahedronGeometry(1, 1), m, pick(['#4e6b3a', '#5b7a40']), 0.15, 6); }
    const st = tx(-side * 7.6, 0); scene_props.box(st[0] - 0.35, 0, st[1] - 0.35, st[0] + 0.35, 0.7, st[1] + 0.35, '#5b4634', { pat: 5 });
    const r = axis === 'x' ? [line - 7.4, at - 0.6, line + 7.4, at + 0.6] : [at - 0.6, line - 7.4, at + 0.6, line + 7.4];
    addCol(r[0], r[1], r[2], r[3], 0, 0.55, { sight: false });
    const cb = axis === 'x' ? [line + side * 2, at - 3, line + side * 7, at + 3] : [at - 3, line + side * 2, at + 3, line + side * 7];
    addCol(Math.min(cb[0], cb[2]), Math.min(cb[1], cb[3]), Math.max(cb[0], cb[2]), Math.max(cb[1], cb[3]), 0.7, 3.5, { solid: false });
    ROADBLOCKS.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], kind: 'tree' });
    for (let k = 0; k < 2; k++) { const p = tx(rand(-5, 5), rand(1.5, 3) * (chance(0.5) ? 1 : -1)); addPickup('canhcay', p[0], 0.02, p[1], rand(0, 3)); }
  }
}
// army checkpoints
function sandbags(x0, z0, x1, z1, gapAt) {
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const L = along ? x1 - x0 : z1 - z0;
  for (let s = 0; s <= L; s += 0.62) {
    const p = (along ? x0 : z0) + s; if (Math.abs(p - gapAt) < 0.75) continue;
    for (let k = 0; k < 3; k++) { const a = p + (k % 2) * 0.3; if (Math.abs(a - gapAt) < 0.75 || a > (along ? x1 : z1)) continue; const cx = along ? a : x0, cz = along ? z0 : a; scene_props.box(cx - (along ? 0.3 : 0.22), k * 0.34, cz - (along ? 0.22 : 0.3), cx + (along ? 0.3 : 0.22), k * 0.34 + 0.33, cz + (along ? 0.22 : 0.3), pick(['#a39a73', '#968d68', '#b0a77f'])); }
  }
  if (along) { addCol(x0 - 0.25, z0 - 0.25, gapAt - 0.55, z0 + 0.25, 0, 1.0, { sight: false }); addCol(gapAt + 0.55, z0 - 0.25, x1 + 0.25, z0 + 0.25, 0, 1.0, { sight: false }); }
  else { addCol(x0 - 0.25, z0 - 0.25, x0 + 0.25, gapAt - 0.55, 0, 1.0, { sight: false }); addCol(x0 - 0.25, gapAt + 0.55, x0 + 0.25, z1 + 0.25, 0, 1.0, { sight: false }); }
}
function armyTruck(x, z, ry) {
  const o = { ry, ox: x, oz: z }, m = scene_props;
  m.box(x - 1.2, 0.6, z - 3.6, x + 1.2, 1.0, z + 3.2, '#3f4a2a', o);
  m.box(x - 1.15, 1.0, z - 3.5, x + 1.15, 2.5, z - 1.9, '#4a5a32', o); m.box(x - 1.0, 1.7, z - 3.52, x + 1.0, 2.3, z - 3.48, '#26303a', o);
  m.box(x - 1.2, 1.0, z - 1.7, x + 1.2, 3.0, z + 3.2, '#56653a', o);
  for (const b of [-2.8, 0.6, 2.2]) for (const a of [-1.1, 1.1]) { const mm = new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(a, 0.5, b)).premultiply(new THREE.Matrix4().makeRotationY(ry)).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z)); m.geo(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12), mm, '#151515'); }
  const along = Math.abs(Math.sin(ry)) > 0.7;
  addCol(along ? x - 3.6 : x - 1.25, along ? z - 1.25 : z - 3.6, along ? x + 3.6 : x + 1.25, along ? z + 1.25 : z + 3.6, 0, 3.0);
}
function apcWreck(x, z, ry) {
  const o = { ry, ox: x, oz: z }, m = scene_props;
  m.box(x - 1.5, 0.5, z - 3.4, x + 1.5, 2.0, z + 3.4, '#2e2a26', o); m.box(x - 1.2, 2.0, z - 2.6, x + 1.2, 2.3, z + 2.2, '#2a2622', o);
  m.box(x - 0.8, 2.3, z - 0.8, x + 0.8, 2.9, z + 0.8, '#26221f', o); m.box(x - 0.08, 2.5, z - 3.6, x + 0.08, 2.65, z - 0.8, '#1d1b19', o);
  for (const b of [-2.6, -0.9, 0.9, 2.6]) for (const a of [-1.5, 1.5]) { const mm = new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(a, 0.55, b)).premultiply(new THREE.Matrix4().makeRotationY(ry)).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z)); m.geo(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10), mm, '#141414'); }
  const along = Math.abs(Math.sin(ry)) > 0.7;
  addCol(along ? x - 3.5 : x - 1.6, along ? z - 1.6 : z - 3.5, along ? x + 3.5 : x + 1.6, along ? z + 1.6 : z + 3.5, 0, 2.9);
  FIRES.push([x, 2.6, z, 1.4]);
}
function genMilitary() {
  const sites = [{ x: 0, z: -50 }, { x: 200, z: 50 }, { x: -100, z: -150 }];
  sites.forEach((S, si) => {
    const { x: X, z: Z } = S; MIL_SITES.push(S);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ex = X + dx * 11, ez = Z + dz * 11;
      if (ez < -158 || ez > 158) continue;
      const gap = rand(-4, 4);
      if (dx) sandbags(ex, Z - 7, ex, Z + 7, Z + gap); else sandbags(X - 7, ez, X + 7, ez, X + gap);
    }
    armyTruck(X + 3.5, Z - 2, rand(-0.2, 0.2) + (si % 2 ? Math.PI / 2 : 0));
    apcWreck(X - 4, Z + 3.5, rand(0, 1) + Math.PI / 2 * (si % 2));
    const sp = [X + 7.8, Z + 7.8]; scene_props.box(sp[0] - 0.05, 0, sp[1] - 0.05, sp[0] + 0.05, 1.2, sp[1] + 0.05, '#555');
    SIGN_QUADS.push([[sp[0] - 1.1, 1.2, sp[1] + 0.06], [sp[0] + 1.1, 1.2, sp[1] + 0.06], [sp[0] + 1.1, 1.75, sp[1] + 0.06], [sp[0] - 1.1, 1.75, sp[1] + 0.06], [0, 0, 1], ATLAS.cells[ATLAS.byType.army[0]]]);
    for (let k = 0; k < 8; k++) scene_props.box(X - 7 + k * 0.6, 0.9, Z + 9.5 - 0.06, X - 6.4 + k * 0.6, 1.02, Z + 9.5 + 0.06, k % 2 ? '#c8302a' : '#eee');
    const crates = [['Thùng đạn', 'ammo', ['bangdan', 'bangdan']], ['Thùng quân y', 'army_med', null], ['Thùng lương khô', 'ration', null]];
    crates.forEach(([label, table, items], k) => {
      const cx = X - 6 + k * 1.3, cz = Z - 6.2;
      scene_props.box(cx - 0.55, 0, cz - 0.4, cx + 0.55, 0.6, cz + 0.4, '#4a5a32'); scene_props.box(cx - 0.56, 0.25, cz - 0.41, cx + 0.56, 0.35, cz + 0.41, k === 1 ? '#eee' : '#c9a227');
      if (k === 1) scene_props.box(cx - 0.1, 0.61, cz - 0.25, cx + 0.1, 0.62, cz + 0.25, '#c8302a');
      addCol(cx - 0.55, cz - 0.4, cx + 0.55, cz + 0.4, 0, 0.6, { sight: false });
      addContainer(cx, 0.4, cz, label, table, items ? 0 : randi(2, 3), null, { items: items || undefined, box: [cx - 0.58, 0, cz - 0.43, cx + 0.58, 0.66, cz + 0.43] });
    });
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * TAU + rand(-0.3, 0.3), r = rand(4.5, 8);
      BODY_SPOTS.push({ x: X + Math.cos(a) * r, z: Z + Math.sin(a) * r, ry: rand(0, TAU), kind: 'sol', gun: k === 0 || (si === 0 && k === 2), watch: si <= 1 && k === 1, unc: k === 3 && chance(0.6) });
    }
    FX_SPOTS.push([X - 4, Z + 3.5]);
  });
}
function genPoles() {
  const sag = (a, b, y, s) => { const n = 6; for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const f = t => y - Math.sin(t * Math.PI) * s; WIRES.push(lerp(a[0], b[0], t0), f(t0), lerp(a[1], b[1], t0), lerp(a[0], b[0], t1), f(t1), lerp(a[1], b[1], t1)); } };
  const hi = QUALITY === 'high';
  const pole = (x, z) => { scene_props.box(x - 0.16, 0, z - 0.16, x + 0.16, 8.5, z + 0.16, '#9d9a93'); scene_props.box(x - 0.5, 7.2, z - 0.06, x + 0.5, 7.35, z + 0.06, '#555'); addCol(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0, 8.5); if (hi) { scene_props.box(x - 0.45, 5.6, z - 0.3, x + 0.45, 6.4, z + 0.3, '#1a1a1a'); scene_props.geo(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), new THREE.Matrix4().makeTranslation(x + 0.55, 6.6, z), '#7a7d80'); for (let k = 0; k < 3; k++) scene_props.box(x - 0.17, 1.2 + k * 0.6, z - 0.17, x + 0.17, 1.45 + k * 0.6, z + 0.17, pick(['#f2efe6', '#e8e4d8'])); } };
  const lamp = (x, z, dx, dz) => { scene_props.box(x - 0.07, 0, z - 0.07, x + 0.07, 7, z + 0.07, '#5d6266'); scene_props.box(Math.min(x, x + dx * 1.6) - 0.04, 6.9, Math.min(z, z + dz * 1.6) - 0.04, Math.max(x, x + dx * 1.6) + 0.04, 6.98, Math.max(z, z + dz * 1.6) + 0.04, '#5d6266'); scene_props.box(x + dx * 1.6 - 0.3, 6.75, z + dz * 1.6 - 0.15, x + dx * 1.6 + 0.3, 6.9, z + dz * 1.6 + 0.15, '#cfd3c8'); addCol(x - 0.1, z - 0.1, x + 0.1, z + 0.1, 0, 7); };
  for (const x of RX) for (const side of [-1, 1]) {
    let prev = null; const px = x + side * 5.4;
    for (let z = -146; z <= 146; z += 24) { if (RZ.some(r => Math.abs(z - r) < 9)) { prev = null; continue; } pole(px, z); if (prev) for (let k = 0; k < 4; k++) sag([px, prev], [px, z], 7.3 - k * 0.25, rand(0.6, 1.6)); prev = z; if (side === 1 && hi && !RZ.some(r => Math.abs(z + 12 - r) < 9)) lamp(x - 5.4, z + 12, 1, 0); }
  }
  for (const z of RZ) for (const side of [-1, 1]) {
    let prev = null; const pz = z + side * 5.4;
    for (let x = -296; x <= 296; x += 24) { if (RX.some(r => Math.abs(x - r) < 9) || (x > CRACK.x0 - 3 && x < CRACK.x1 + 3)) { prev = null; continue; } pole(x, pz); if (prev != null) for (let k = 0; k < 4; k++) sag([prev, pz], [x, pz], 7.3 - k * 0.25, rand(0.6, 1.6)); prev = x; if (side === 1 && hi && !inCrack(x + 10, x + 14) && !RX.some(r => Math.abs(x + 12 - r) < 9)) lamp(x + 12, z - 5.4, 0, 1); }
  }
  const names = ATLAS.byType.street; let ni = 0;
  for (const x of RX) for (const z of RZ) {
    if (chance(0.45)) continue;
    const sx = x + 6.2, sz = z + 6.2; scene_props.box(sx - 0.05, 0, sz - 0.05, sx + 0.05, 3.2, sz + 0.05, '#666');
    SIGN_QUADS.push([[sx - 0.9, 2.6, sz + 0.06], [sx + 0.9, 2.6, sz + 0.06], [sx + 0.9, 3.05, sz + 0.06], [sx - 0.9, 3.05, sz + 0.06], [0, 0, 1], ATLAS.cells[names[ni++ % names.length]]]);
  }
  for (const z of RZ) for (let x = -290; x < 290; x += rand(14, 22)) { if (RX.some(r => Math.abs(x - r) < 10) || inCrack(x - 2, x + 2)) continue; const zz = z + (chance(0.5) ? 6.3 : -6.3); if (!freeSpot(x, zz, 0.5) || nearHole(x, zz, 2)) continue; tree(x, zz, rand(0.9, 1.2)); }
}
function genFires() { for (let k = 0; k < 9; k++) { const s = pick(FX_SPOTS); if (s) FIRES.push([s[0], 0.5, s[1], 1.2]); } }
function genBodySpots() {
  let tries = 0, n = 0;
  while (n < 46 && tries < 600) {
    tries++;
    const vert = chance(0.5), line = vert ? pick(RX) : pick(RZ), along = vert ? rand(-145, 145) : rand(-295, 295), lat = rand(-6.3, 6.3);
    const x = vert ? line + lat : along, z = vert ? along : line + lat;
    if (dist2(x, z, START.x, START.z) < 25 || dist2(x, z, 287, 0) < 20 || (x > CRACK.x0 - 3 && x < CRACK.x1 + 3)) continue;
    if (!freeSpot(x, z, 0.9) || nearHole(x, z, 2)) continue;
    BODY_SPOTS.push({ x, z, ry: rand(0, TAU), kind: 'civ', unc: chance(0.3) }); n++;
  }
  // two right outside the office so the mechanic is found early
  BODY_SPOTS.push({ x: -196, z: 20, ry: 1.2, kind: 'civ', unc: true, watch: true }); // a rescue-team watch, right outside the office
  BODY_SPOTS.push({ x: -194.5, z: -14, ry: 2.6, kind: 'civ', unc: false });
}
