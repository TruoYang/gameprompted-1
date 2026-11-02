// ---------------------------------------------------------------- UI
const CAT_LABEL = { food: 'ĂN', drink: 'UỐNG', med: 'Y TẾ', tool: 'DỤNG CỤ', gear: 'TRANG BỊ' };
const SLOT_LABEL = { head: 'Đầu', body: 'Áo', feet: 'Giày', back: 'Balo' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MAPDIRTY = { v: true };

// ---------------------------------------------------------------- map icons
const ICON = {
  grocery: { c: '#c8302a', n: 'Tạp hóa' }, food: { c: '#d9782a', n: 'Quán ăn' }, cafe: { c: '#7a5236', n: 'Cà phê' }, pharmacy: { c: '#1a8a5a', n: 'Nhà thuốc' },
  clothes: { c: '#c2447a', n: 'Quần áo' }, workwear: { c: '#c99a12', n: 'Đồ bảo hộ' }, shoes: { c: '#7b1fa2', n: 'Giày' }, bags: { c: '#0d6c9c', n: 'Balo' },
  bike: { c: '#1d4f9c', n: 'Sửa xe' }, hardware: { c: '#5b6670', n: 'Kim khí' }, military: { c: '#56653a', n: 'Trạm quân sự' }, home: { c: '#e4a03a', n: 'Nhà bạn' },
  market: { c: '#d0261e', n: 'Siêu thị (3 tầng)' }, quest: { c: '#1fae5a', n: 'Nhà ông Tư (xà beng)' }, tunnel: { c: '#1f6fd0', n: 'Hầm đi bộ' },
};
function drawGlyph(x, type, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.scale(s / 10, s / 10); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 1.6; x.lineCap = 'round'; x.lineJoin = 'round';
  const P = pts => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); };
  switch (type) {
    case 'pharmacy': x.fillRect(-1.6, -5, 3.2, 10); x.fillRect(-5, -1.6, 10, 3.2); break;
    case 'food': x.beginPath(); x.arc(0, 0.5, 4.5, 0, Math.PI); x.fill(); x.beginPath(); x.moveTo(-1, -5.5); x.lineTo(3, 0); x.moveTo(1.5, -5.5); x.lineTo(5, -0.5); x.stroke(); break;
    case 'cafe': x.fillRect(-4, -2, 6, 6); x.beginPath(); x.arc(2.5, 1, 2, -Math.PI / 2, Math.PI / 2); x.stroke(); x.beginPath(); x.moveTo(-2, -3.5); x.lineTo(-2, -5.5); x.moveTo(0.5, -3.5); x.lineTo(0.5, -5.5); x.stroke(); break;
    case 'grocery': P([[-5, -1.5], [5, -1.5], [3.5, 4.5], [-3.5, 4.5]]); x.beginPath(); x.arc(0, -1.5, 3, Math.PI, 0); x.stroke(); break;
    case 'clothes': P([[-2, -4.5], [2, -4.5], [5, -2.5], [3.8, 0], [2.5, -0.8], [2.5, 4.5], [-2.5, 4.5], [-2.5, -0.8], [-3.8, 0], [-5, -2.5]]); break;
    case 'workwear': x.beginPath(); x.arc(0, 1.5, 4.5, Math.PI, 0); x.fill(); x.fillRect(-5.5, 1.2, 11, 1.6); break;
    case 'shoes': P([[-5, 3.5], [-5, -3], [-1.5, -3], [0, 0], [5, 1.5], [5, 3.5]]); break;
    case 'bags': x.beginPath(); x.roundRect ? x.roundRect(-3.8, -2.5, 7.6, 7.5, 1.8) : x.rect(-3.8, -2.5, 7.6, 7.5); x.fill(); x.beginPath(); x.arc(0, -2.5, 2.2, Math.PI, 0); x.stroke(); break;
    case 'bike': x.beginPath(); x.arc(-3, 2, 2.4, 0, TAU); x.moveTo(5.4, 2); x.arc(3, 2, 2.4, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(-3, 2); x.lineTo(0, -1.5); x.lineTo(3, 2); x.moveTo(0, -1.5); x.lineTo(2, -4); x.stroke(); break;
    case 'hardware': x.lineWidth = 2.2; x.beginPath(); x.moveTo(-4, 4); x.lineTo(2, -2); x.stroke(); x.beginPath(); x.arc(3, -3, 2.4, 0, TAU); x.stroke(); break;
    case 'military': { x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 2.2 : 5.2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); break; }
    case 'quest': case 'home': P([[0, -5], [5, -0.5], [3.5, -0.5], [3.5, 4.5], [-3.5, 4.5], [-3.5, -0.5], [-5, -0.5]]); break;
    case 'market': P([[-5.5, -2.5], [5.5, -2.5], [4, 3], [-4, 3]]); x.fillRect(-4, 3.6, 2, 1.6); x.fillRect(2, 3.6, 2, 1.6); x.beginPath(); x.moveTo(-5.5, -2.5); x.lineTo(-6.5, -5); x.stroke(); break;
    case 'tunnel': x.lineWidth = 2.2; x.beginPath(); x.arc(0, 2, 4.6, Math.PI, 0); x.stroke(); x.beginPath(); x.moveTo(-4.6, 2); x.lineTo(-4.6, 4.5); x.moveTo(4.6, 2); x.lineTo(4.6, 4.5); x.stroke(); x.fillRect(-1.2, -1, 2.4, 2.4); break;
  }
  x.restore();
}
function drawIcon(x, type, cx, cy, s = 9) {
  const ic = ICON[type]; if (!ic) return;
  x.fillStyle = 'rgba(0,0,0,.65)'; x.beginPath(); x.arc(cx, cy + s * 0.12, s + Math.max(1.5, s * 0.22), 0, TAU); x.fill();
  x.fillStyle = ic.c; x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = Math.max(1.2, s * 0.16); x.stroke();
  drawGlyph(x, type, cx, cy, s * 0.95);
}
const MAPICONS = [];
function collectMapIcons() {
  MAPICONS.length = 0;
  for (const B of BUILDINGS) if (!B.collapsed && B.enterable && ICON[B.type]) MAPICONS.push({ type: B.type, x: B.front.x + B.out[0] * 1.2, z: B.front.z + B.out[1] * 1.2 });
  for (const S of MIL_SITES) MAPICONS.push({ type: 'military', x: S.x, z: S.z });
  for (const T of TUNNELS) for (const S of T.stairs) MAPICONS.push({ type: 'tunnel', x: S.top[0], z: S.top[1] });
  if (QUEST.house && QUEST.stage === 'crowbar') MAPICONS.push({ type: 'quest', x: QUEST.house.front.x, z: QUEST.house.front.z });
}
// pre-rendered top-down city map, 2px per metre
const BASEMAP = document.createElement('canvas'); const MS = 2, MOX = 330, MOZ = 180; BASEMAP.width = 1320; BASEMAP.height = 720;
function renderBaseMap() {
  const x = BASEMAP.getContext('2d'); const X = v => (v + MOX) * MS, Z = v => (v + MOZ) * MS;
  x.fillStyle = '#1b1f22'; x.fillRect(0, 0, BASEMAP.width, BASEMAP.height);
  for (const K of BLOCKS) { x.fillStyle = '#5d5a55'; x.fillRect(X(K.bx0 - 2), Z(K.bz0 - 2), (K.bx1 - K.bx0 + 4) * MS, (K.bz1 - K.bz0 + 4) * MS); x.fillStyle = K.i === 1 && K.j === 1 ? '#34402e' : '#2c2a27'; x.fillRect(X(K.bx0), Z(K.bz0), (K.bx1 - K.bx0) * MS, (K.bz1 - K.bz0) * MS); }
  x.fillStyle = '#3a3f42'; for (const r of RX) x.fillRect(X(r - 5), Z(-157), 10 * MS, 314 * MS); for (const r of RZ) x.fillRect(X(-307), Z(r - 5), 614 * MS, 10 * MS);
  for (const B of BUILDINGS) {
    if (B.collapsed) { x.fillStyle = '#5a3a30'; x.fillRect(X(B.x0), Z(B.z0), (B.x1 - B.x0) * MS, (B.z1 - B.z0) * MS); continue; }
    x.fillStyle = B.type === 'apartment' ? '#2a2e31' : B.home ? '#8a6a30' : B.enterable ? (ICON[B.type] ? shade(ICON[B.type].c, 0.55) : '#55595d') : '#3e4246';
    x.fillRect(X(B.x0) + 0.5, Z(B.z0) + 0.5, (B.x1 - B.x0) * MS - 1, (B.z1 - B.z0) * MS - 1);
  }
  x.fillStyle = '#4f6b66'; x.beginPath(); x.ellipse(X(LAKE.x), Z(LAKE.z), LAKE.rx * MS, LAKE.rz * MS, 0, 0, TAU); x.fill();
  x.fillStyle = '#0d0907'; x.fillRect(X(CRACK.x0), Z(-175), (CRACK.x1 - CRACK.x0) * MS, 350 * MS);
  x.strokeStyle = '#c49a5a'; x.lineWidth = 4; for (const [, pz] of PLANKS) { x.beginPath(); x.moveTo(X(CRACK.x0 - 3), Z(pz)); x.lineTo(X(CRACK.x1 + 3), Z(pz)); x.stroke(); }
  for (const s of SINKHOLES) { x.fillStyle = '#0d0907'; x.beginPath(); x.arc(X(s.x), Z(s.z), s.r * MS, 0, TAU); x.fill(); }
  x.setLineDash([6, 4]); x.strokeStyle = '#4f9cf0'; x.lineWidth = 4; for (const T of TUNNELS) { for (const Q of T.cors) { const alongX = Q.x1 - Q.x0 > Q.z1 - Q.z0; x.beginPath(); if (alongX) { x.moveTo(X(Q.x0), Z((Q.z0 + Q.z1) / 2)); x.lineTo(X(Q.x1), Z((Q.z0 + Q.z1) / 2)); } else { x.moveTo(X((Q.x0 + Q.x1) / 2), Z(Q.z0)); x.lineTo(X((Q.x0 + Q.x1) / 2), Z(Q.z1)); } x.stroke(); } for (const S of T.stairs) { x.beginPath(); x.moveTo(X(S.top[0]), Z(S.top[1])); x.lineTo(X(S.bot[0]), Z(S.bot[1])); x.stroke(); } } x.setLineDash([]);
  x.strokeStyle = '#e0453a'; x.lineWidth = 3; for (const T of TUNNELS) for (const C of T.collapses) { const cx = X((C.x0 + C.x1) / 2), cz = Z((C.z0 + C.z1) / 2); x.beginPath(); x.moveTo(cx - 7, cz - 7); x.lineTo(cx + 7, cz + 7); x.moveTo(cx + 7, cz - 7); x.lineTo(cx - 7, cz + 7); x.stroke(); }
  for (const R0 of ROADBLOCKS) {
    const w = (R0.x1 - R0.x0) * MS, h = (R0.z1 - R0.z0) * MS;
    if (R0.kind === 'wall') { x.fillStyle = '#9a4a3a'; x.fillRect(X(R0.x0), Z(R0.z0), w, h); x.strokeStyle = '#2a1410'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(R0.x0), Z(R0.z0)); x.lineTo(X(R0.x1), Z(R0.z1)); x.moveTo(X(R0.x1), Z(R0.z0)); x.lineTo(X(R0.x0), Z(R0.z1)); x.stroke(); }
    else if (R0.kind === 'tree') { x.fillStyle = '#4e6b3a'; x.fillRect(X(R0.x0), Z(R0.z0), w, h); }
    else { x.fillStyle = 'rgba(160,160,160,.5)'; x.fillRect(X(R0.x0), Z(R0.z0), w, h); }
  }
  MAPDIRTY.v = false;
}
const RADAR = { t: 0, blips: [], ring: 0 };
function radarUpdate(dt) {
  RADAR.t -= dt; RADAR.ring += dt;
  for (const b of RADAR.blips) b.age += dt;
  if (RADAR.t <= 0) {
    RADAR.t = 2.5; RADAR.ring = 0; RADAR.blips = [];
    let any = false;
    for (const M of MONSTERS) { if (M.kind === 'titan' && M.state === 'dormant') continue; if (dist2(M.x, M.z, Player.pos.x, Player.pos.z) < 90) { RADAR.blips.push({ x: M.x, z: M.z, name: M.name, kind: M.kind, age: 0 }); any = true; } }
    if (any && Player.hasWatch()) Snd.ping();
  }
}

const UI = {
  modal: null, hudT: 0,
  toast(msg, kind = '') {
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
    const box = $('#toasts'); box.appendChild(el); while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 520); }, 4200 + msg.length * 30);
  },
  hurtFlash(a) { const v = $('#vignette'); v.style.transition = 'none'; v.style.opacity = String(Math.min(1, 0.35 + a)); requestAnimationFrame(() => { v.style.transition = 'opacity 1.2s'; v.style.opacity = String(UI.baseVig || 0); }); },
  open(id) {
    this.close(true); this.modal = id; $('#' + id).hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();
    Input.keys = {}; Snd.click();
  },
  close(silent) {
    if (!this.modal) return; $('#' + this.modal).hidden = true; this.modal = null; this.closedAt = performance.now();
    if (!silent && Game.state === 'play') requestLock();
  },
  openPause() { if (Game.state !== 'play') return; this.open('pause'); },
  hud(dt) {
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 0.1;
    const P = Player;
    const bar = (id, v) => { $('#bar-' + id + ' i').style.width = clamp(v, 0, 100) + '%'; };
    bar('hp', P.hp); bar('food', P.food); bar('water', P.water); bar('stam', P.stam); bar('cruel', P.cruelty);
    $('#v-hp').textContent = Math.ceil(Math.max(0, P.hp)); $('#v-food').textContent = Math.ceil(P.food); $('#v-water').textContent = Math.ceil(P.water); $('#v-stam').textContent = Math.ceil(P.stam); $('#v-cruel').textContent = Math.round(P.cruelty);
    const inj = $('#injuries'); const html = P.injuries.map(i => `<span class="inj ${i.type === 'bruise' || i.type === 'concuss' ? 'mild' : ''}">${PART_NAME[i.part]} · ${INJ_NAME[i.type]}</span>`).join('') + (P.painkiller > 0 ? `<span class="inj mild" style="border-color:var(--green);color:#bfe0b8;background:rgba(134,180,127,.12)">Giảm đau ${Math.ceil(P.painkiller)}s</span>` : '');
    if (inj.innerHTML !== html) inj.innerHTML = html;
    const w = P.weight(), cap = P.capacity(), wp = curWeapon();
    let wl = '—'; if (wp) { const it = ITEMS[wp]; wl = it.gun ? `${esc(it.n)} <span style="color:${P.mag ? 'var(--ink)' : 'var(--red)'}">${P.reloadT > 0 ? 'nạp…' : P.mag + '/10'}</span> · ${P.count('bangdan')} băng` : `${esc(it.n)} <span style="color:var(--dim)">${Math.max(0, it.weapon - (P.weaponUses[wp] || 0))} lần</span>`; }
    const q = `<div>Vũ khí <b>${wl}</b></div><div>Pháo <b>${P.count('phao')}</b> · Chai <b>${P.count('chai')}</b></div><div>Mang <b style="color:${w > cap ? 'var(--red)' : 'var(--ink)'}">${w.toFixed(1)}/${cap}kg</b></div><div>Tiền <b>${money(P.money)}</b></div>`;
    const qe = $('#quick'); if (qe.innerHTML !== q) qe.innerHTML = q;
    // what you are wearing
    const eq = ['head', 'body', 'feet', 'back'].map(sl => { const id = P.equip[sl]; return `<div class="eqs${id ? ' on' : ''}" title="${SLOT_LABEL[sl]}">${id ? itemImg(id, 30) : `<span>${SLOT_LABEL[sl]}</span>`}</div>`; }).join('');
    const ee = $('#equip'); if (ee.innerHTML !== eq) ee.innerHTML = eq;
    const v = $('#vehicle');
    if (P.bike) { v.hidden = false; v.innerHTML = `<b>${Math.round(Math.abs(P.bike.speed) * 3.6)}</b>km/h · xăng ${Math.round(P.bike.fuel)}% · <span style="color:var(--amber)">[F] xuống xe</span>`; } else v.hidden = true;
    let top = null; for (const M of MONSTERS) if (!top || M.aw > top.aw) top = M;
    const d = $('#detect'), aw = top ? top.aw : 0;
    d.classList.toggle('warn', aw > 0.25 && aw < 1); d.classList.toggle('hunt', aw >= 1);
    $('#eye i').style.setProperty('--s', String(0.4 + Math.min(1, aw) * 0.8));
    $('#eye-fill').style.height = Math.min(100, aw * 100) + '%';
    const how = top && top.sense === 'hear' ? 'nghe thấy bạn' : 'nhìn thấy bạn';
    $('#detect-label').innerHTML = aw >= 1 ? `${esc(top.name)}<br>đã ${how}` : aw > 0.25 ? `${esc(top.name)}<br>${top.sense === 'hear' ? 'nghe tiếng động' : 'đang để ý'}` : (P.pos.y < -1 ? 'trong hầm<br>quái không thấy' : P.indoors ? 'trong nhà<br>chỉ Thủy Quái đánh được' : 'an toàn');
    const nz = P.bike ? P.noise : P.noise; const lvl = nz < 0.5 ? 0 : nz < 3 ? 1 : nz < 8 ? 2 : nz < 20 ? 3 : 4;
    const nzEl = $('#noise'); const nzHtml = `<span>TIẾNG ỒN</span><b>${'▮'.repeat(lvl)}<i>${'▮'.repeat(4 - lvl)}</i></b><span>${lvl === 0 ? 'im lặng' : P.bike ? 'tiếng xe: mọi con nghe ~' + Math.round(nz) + 'm' : 'Thổ Trùng nghe ~' + Math.round(nz * 1.45) + 'm'}</span>`; if (nzEl.innerHTML !== nzHtml) { nzEl.innerHTML = nzHtml; nzEl.className = 'lv' + lvl; }
    this.baseVig = P.hp < 35 ? (35 - P.hp) / 35 * 0.8 : 0; $('#vignette').style.opacity = String(this.baseVig);
  },
  compass() {
    const P = Player, el = $('#compass'), W = el.clientWidth || 400, fov = 160 * Math.PI / 180;
    if (!W) return;
    const head = -P.yaw;
    if (!this._ticks) {
      this._ticks = [['B', 0, 1], ['ĐB', 45], ['Đ', 90, 1], ['ĐN', 135], ['N', 180, 1], ['TN', 225], ['T', 270, 1], ['TB', 315]].map(([t, a, m]) => { const s = document.createElement('span'); s.className = 'tick' + (m ? ' major' : ''); s.textContent = t; el.appendChild(s); return { s, a: a * Math.PI / 180 }; });
      this._home = document.createElement('div'); this._home.className = 'home'; el.appendChild(this._home);
    }
    for (const t of this._ticks) { const r = angleDiff(head, t.a); t.s.style.left = (W / 2 + r / fov * W * 2) + 'px'; t.s.style.display = Math.abs(r) < fov / 2 ? '' : 'none'; }
    const gx = NAV.goal ? NAV.goal.fx : HOME.front.x, gz = NAV.goal ? NAV.goal.fz : HOME.front.z; const hb = Math.atan2(gx - P.pos.x, -(gz - P.pos.z)), r = angleDiff(head, hb);
    const dd = NAV.route.length > 1 ? NAV.len : dist2(HOME.front.x, HOME.front.z, P.pos.x, P.pos.z);
    this._home.style.left = (W / 2 + clamp(r / fov * W * 2, -W / 2 + 20, W / 2 - 20)) + 'px';
    this._home.innerHTML = `<b></b>${NAV.goal ? 'ÔNG TƯ' : 'NHÀ'} ${Math.round(dd)}m`;
  },
  // ---- minimap (top-left): rotates with you, zoom with Z; route home in amber; monsters as pulsing red markers
  minimap() {
    const cv = $('#minimap'); if (!cv || !cv.clientWidth) return;
    const css = cv.clientWidth, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(css * dpr)) { cv.width = cv.height = Math.round(css * dpr); }
    if (MAPDIRTY.v) { renderBaseMap(); collectMapIcons(); }
    const x = cv.getContext('2d'), Wd = cv.width, C = Wd / 2, RM = MM_ZOOMS[MM.zi], k = C / RM;
    const P = Player, yaw = P.yaw, t = Game.time;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, Wd, Wd);
    x.save(); x.beginPath(); x.arc(C, C, C - 1, 0, TAU); x.clip();
    x.fillStyle = '#1b1f22'; x.fillRect(0, 0, Wd, Wd);
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    const toS = (wx, wz) => { const dx = wx - P.pos.x, dz = wz - P.pos.z; return [C + (dx * ca - dz * sa) * k, C + (dx * sa + dz * ca) * k]; };
    x.save(); x.translate(C, C); x.rotate(yaw); x.scale(k / MS, k / MS); x.translate(-(P.pos.x + MOX) * MS, -(P.pos.z + MOZ) * MS);
    x.imageSmoothingEnabled = true; x.drawImage(BASEMAP, 0, 0); x.restore();
    const mons = visibleMonsters(false);
    // danger zones
    for (const m of mons) { const [sx, sy] = toS(m.x, m.z); x.fillStyle = `rgba(224,69,58,${0.13 * m.alpha})`; x.beginPath(); x.arc(sx, sy, m.r * k, 0, TAU); x.fill(); }
    // route home
    if (NAV.route.length > 1) { x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 6 * dpr; x.beginPath(); NAV.route.forEach(([wx, wz], i) => { const [sx, sy] = toS(wx, wz); i ? x.lineTo(sx, sy) : x.moveTo(sx, sy); }); x.stroke(); x.strokeStyle = '#ffc04a'; x.lineWidth = 3 * dpr; x.setLineDash([7 * dpr, 5 * dpr]); x.lineDashOffset = -t * 20 * dpr; x.stroke(); x.setLineDash([]); }
    x.fillStyle = 'rgba(220,214,200,.8)';
    for (const b of BODIES) { if (b.c.dead || (b.c.searched && !b.c.items.length)) continue; if (dist2(b.x, b.z, P.pos.x, P.pos.z) > RM) continue; const [sx, sy] = toS(b.x, b.z); x.fillRect(sx - 2 * dpr, sy - 2 * dpr, 4 * dpr, 4 * dpr); }
    const isz = (RM <= 40 ? 10 : RM <= 60 ? 8.5 : RM <= 100 ? 7 : 5.5) * dpr;
    for (const ic of MAPICONS) { if (dist2(ic.x, ic.z, P.pos.x, P.pos.z) > RM * 1.05) continue; const [sx, sy] = toS(ic.x, ic.z); drawIcon(x, ic.type, sx, sy, ic.type === 'market' || ic.type === 'military' ? isz * 1.25 : isz); }
    const rr = P.hasWatch() ? RADAR.ring / 2.5 : 1; x.strokeStyle = `rgba(120,220,160,${0.4 * (1 - rr)})`; x.lineWidth = 2 * dpr; x.beginPath(); x.arc(C, C, rr * 90 * k, 0, TAU); x.stroke();
    for (const m of mons) {
      let [sx, sy] = toS(m.x, m.z); const dx = sx - C, dy = sy - C, L = Math.hypot(dx, dy), edge = C - 12 * dpr; const out = L > edge;
      if (out) { sx = C + dx / L * edge; sy = C + dy / L * edge; }
      monsterMarker(x, sx, sy, m, dpr, out ? Math.atan2(dy, dx) : null, t);
    }
    { let [sx, sy] = toS(HOME.front.x, HOME.front.z); const dx = sx - C, dy = sy - C, L = Math.hypot(dx, dy), edge = C - 13 * dpr; if (L > edge) { sx = C + dx / L * edge; sy = C + dy / L * edge; } drawIcon(x, 'home', sx, sy, 10 * dpr); }
    x.restore();
    const na = Math.atan2(-ca, sa); const nx = C + Math.cos(na) * (C - 10 * dpr), ny = C + Math.sin(na) * (C - 10 * dpr);
    x.fillStyle = '#111'; x.beginPath(); x.arc(nx, ny, 8 * dpr, 0, TAU); x.fill(); x.fillStyle = '#ebe5d8'; x.font = `700 ${10 * dpr}px 'JetBrains Mono', monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('B', nx, ny + 0.5);
    x.fillStyle = '#fff'; x.strokeStyle = '#111'; x.lineWidth = 2 * dpr; x.beginPath(); x.moveTo(C, C - 10 * dpr); x.lineTo(C + 7 * dpr, C + 7 * dpr); x.lineTo(C, C + 3.5 * dpr); x.lineTo(C - 7 * dpr, C + 7 * dpr); x.closePath(); x.stroke(); x.fill();
    x.strokeStyle = 'rgba(235,229,216,.45)'; x.lineWidth = 2.5 * dpr; x.beginPath(); x.arc(C, C, C - 1.5 * dpr, 0, TAU); x.stroke();
    const tag = $('#mm-tag'); const txt = (P.hasWatch() ? 'ĐỒNG HỒ ĐỊNH VỊ' : 'XEM QUÁI: BẢN ĐỒ [M]') + ` · ${RM * 2}m`; if (tag.textContent !== txt) tag.textContent = txt;
  },
  prompt(html) { const p = $('#prompt'); if (!html) { p.hidden = true; return; } p.hidden = false; if (p.innerHTML !== html) p.innerHTML = html; },
  progress(v) { const p = $('#progress'); if (v == null) { p.hidden = true; return; } p.hidden = false; p.firstElementChild.style.width = (v * 100) + '%'; },

  openInv() { this.open('inv'); this.renderInv(); },
  renderInv() {
    const P = Player;
    $('#inv-sub').textContent = `Mang ${P.weight().toFixed(1)} / ${P.capacity()} kg${P.weight() > P.capacity() ? ' · quá tải: đi chậm, không chạy được' : ''}`;
    document.querySelectorAll('#body-svg .part').forEach(el => { const ps = P.injuries.filter(i => i.part === el.dataset.part); el.classList.toggle('hurt', ps.some(i => i.type === 'bleed' || i.type === 'fracture' || i.type === 'infect')); el.classList.toggle('mild', ps.length > 0 && ps.every(i => i.type === 'bruise' || i.type === 'concuss')); });
    const need = { bleed: 'Băng gạc', fracture: 'Nẹp cố định', infect: 'Kháng sinh', bruise: 'Thuốc giảm đau', concuss: 'Thuốc giảm đau' };
    $('#inv-inj').innerHTML = P.injuries.length ? P.injuries.map((i, k) => `<div class="it"><span>${PART_NAME[i.part]} · <b>${INJ_NAME[i.type]}</b><br><small style="color:var(--dim)">Cần: ${need[i.type]}</small></span><button class="btn" data-treat="${k}" style="padding:4px 8px;font-size:12px">Chữa</button></div>`).join('') : '<div class="empty">Không có vết thương.</div>';
    const groups = {}; for (const id of P.inv) groups[id] = (groups[id] || 0) + 1;
    const order = ['med', 'food', 'drink', 'tool', 'gear'];
    const ids = Object.keys(groups).sort((a, b) => order.indexOf(ITEMS[a].cat) - order.indexOf(ITEMS[b].cat));
    $('#inv-items-h').textContent = `Vật phẩm (${P.inv.length})`;
    // a grid of item slots; hovering (or tapping) a slot shows its details and actions below
    this.invGroups = groups;
    if (this.invSel && !groups[this.invSel]) this.invSel = null;
    const slots = Math.max(15, Math.ceil((ids.length + 1) / 5) * 5);
    let html = '';
    for (let k = 0; k < slots; k++) { const id = ids[k]; if (!id) { html += '<div class="slot empty-slot"></div>'; continue; } const it = ITEMS[id]; html += `<button class="slot c-${it.cat}${this.invSel === id ? ' sel' : ''}${curWeapon() === id ? ' held' : ''}" data-sel="${id}" aria-label="${esc(it.n)}">${itemImg(id, 44)}${groups[id] > 1 ? `<span class="cnt">${groups[id]}</span>` : ''}${curWeapon() === id ? '<span class="tag">TAY</span>' : ''}</button>`; }
    $('#inv-items').innerHTML = html;
    this.renderInvDetail(this.invHover || this.invSel || ids[0]);
    // god mode: a creative shelf with every item
    const cr = $('#inv-creative'); cr.hidden = !GOD.on;
    if (GOD.on) cr.innerHTML = '<h3>Kho đồ · chế độ thần (nhấp để lấy)</h3><div class="bag">' + Object.keys(ITEMS).filter(id => !ITEMS[id].quest).map(id => `<button class="slot c-${ITEMS[id].cat}" data-give="${id}" title="${esc(ITEMS[id].n)}">${itemImg(id, 40)}</button>`).join('') + '</div>';
    $('#inv-equip').innerHTML = Object.keys(SLOT_LABEL).map(s => { const id = P.equip[s]; const n = id ? ITEMS[id].n : (STARTER[s] ? STARTER[s].n : '—'); return `<div><span>${SLOT_LABEL[s]}</span><span>${id ? itemImg(id, 22) + ' ' : ''}${esc(n)}${id ? ` <button class="btn" data-unequip="${s}" style="padding:1px 6px;font-size:11px">Tháo</button>` : ''}</span></div>`; }).join('');
    const pct = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
    $('#inv-stats').innerHTML = [['Chế độ', DIFF.name], ['Tốc độ', pct(P.stat('speed'))], ['Khó bị thấy', pct(P.stat('stealth'))], ['Giảm sát thương', pct(clamp(P.stat('armor'), 0, 0.6))], ['Bước chân êm', pct(P.stat('quiet'))], ['Sức chứa', P.capacity() + 'kg'], ['Tàn nhẫn', Math.round(P.cruelty) + '/100'], ['Đã giúp', P.helped + ' người'], ['Quãng đường', Math.round(P.distance) + 'm']].map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
  },

  renderInvDetail(id) {
    const box = $('#inv-detail'), P = Player; if (!box) return;
    if (!id || !this.invGroups || !this.invGroups[id]) { box.innerHTML = '<div class="empty">Túi trống. Lục soát kệ hàng, tủ bếp, quầy thuốc để tích trữ đồ.</div>'; return; }
    const it = ITEMS[id], n = this.invGroups[id];
    const useLbl = it.slot ? 'Mặc' : it.weapon ? (curWeapon() === id ? 'Đang cầm' : 'Cầm') : it.wallet ? 'Mở ví' : it.lore ? 'Đọc tin nhắn' : it.ammo ? 'Nạp đạn' : (it.throwable || it.radar || it.watch) ? '' : it.fuel ? 'Đổ xăng' : 'Dùng';
    const facts = [];
    if (it.food) facts.push(`${it.food > 0 ? '+' : ''}${it.food} no`); if (it.water) facts.push(`${it.water > 0 ? '+' : ''}${it.water} nước`); if (it.stam) facts.push('hồi thể lực');
    if (it.weapon && !it.gun) facts.push(`còn ${Math.max(0, Math.ceil(it.weapon - (P.weaponUses[id] || 0)))} lần đánh`); if (it.gun) facts.push(`đạn ${P.mag}/10`);
    if (it.cap) facts.push(`+${it.cap}kg sức chứa`); if (it.speed) facts.push(`+${Math.round(it.speed * 100)}% tốc độ`); if (it.stealth) facts.push(`+${Math.round(it.stealth * 100)}% khó bị thấy`); if (it.armor) facts.push(`−${Math.round(it.armor * 100)}% sát thương`);
    facts.push(`${it.w}kg`);
    box.innerHTML = `<div class="det-ic">${itemImg(id, 64)}</div><div class="det-tx"><b>${esc(it.n)}${n > 1 ? ` <span class="mono" style="color:var(--dim)">×${n}</span>` : ''}</b><span class="cat c-${it.cat}">${CAT_LABEL[it.cat]}</span><p>${esc(it.d)}</p><small>${facts.join(' · ')}</small></div><div class="act">${useLbl ? `<button class="btn primary" data-use="${id}">${useLbl}</button>` : ''}${it.quest ? '' : `<button class="btn" data-drop="${id}">Vứt</button>`}</div>`;
  },
  openLoot(c) { this.lootC = c; this.open('loot'); this.renderLoot(); },
  renderLoot() {
    const c = this.lootC, P = Player; if (!c) return;
    $('#loot-title').textContent = c.label;
    const house = c.B && c.B.type === 'house';
    const unc = c.body && c.body.unc;
    $('#loot-sub').textContent = c.altar ? 'Bàn thờ gia tiên của một gia đình đã bỏ chạy.' : unc ? 'Người này vẫn còn thở. Lấy đồ của họ: +5 tàn nhẫn.' : c.body ? 'Họ không cần những thứ này nữa.' : house ? 'Nhà dân bỏ trống. Lấy đồ ở đây: +1 tàn nhẫn mỗi lần.' : c.B ? (TYPE_NAME[c.B.type] || '') + ' · bỏ trống' : '';
    const list = [];
    if (c.money > 0) list.push(`<div class="item"><span class="cat c-gear">TIỀN</span><span class="nm">${money(c.money)}<small>${c.altar ? 'Tiền lễ trên bàn thờ' : 'Tiền lẻ'}</small></span><span class="act"><button class="btn ${c.altar ? 'danger' : ''}" data-takemoney>${c.altar ? 'Lấy (+6 tàn nhẫn)' : 'Lấy'}</button></span></div>`);
    c.items.forEach((id, k) => { const it = ITEMS[id]; list.push(`<div class="item">${itemImg(id, 40)}<span class="nm"><span class="cat c-${it.cat}" style="display:inline-block;padding:1px 4px;margin-right:6px;font-family:var(--mono);font-size:9px;border:1px solid currentColor">${CAT_LABEL[it.cat]}</span>${esc(it.n)}<small>${esc(it.d)} · ${it.w}kg</small></span><span class="act"><button class="btn" data-take="${k}" ${P.canCarry(id) ? '' : 'disabled'}>${P.canCarry(id) ? 'Lấy' : 'Quá nặng'}</button></span></div>`); });
    $('#loot-items').innerHTML = list.length ? list.join('') : '<div class="empty">Trống rỗng. Ai đó đã lấy hết rồi.</div>';
    $('#loot-all').disabled = !c.items.length && !(c.money > 0 && !c.altar);
  },
  lootCruelty(c) {
    const P = Player;
    if (c.B && c.B.type === 'house' && !c.cruelDone) { c.cruelDone = true; P.cruelty = Math.min(100, P.cruelty + 1); }
    if (c.body && c.body.unc && !c.cruelDone) { c.cruelDone = true; P.cruelty = Math.min(100, P.cruelty + 5); this.toast('Bạn lục đồ của một người còn đang bất tỉnh. (+5 tàn nhẫn)', 'bad'); }
  },
  takeLoot(k) {
    const c = this.lootC, P = Player; const id = c.items[k]; if (!id) return;
    if (!P.add(id)) { this.toast('Không mang thêm được nữa', 'bad'); return; }
    c.items.splice(k, 1); Snd.pickup(); this.lootCruelty(c);
    if (c.body) c.body.onTake(id);
    refreshGoods(c); this.renderLoot();
  },
  takeMoney() { const c = this.lootC, P = Player; P.money += c.money; if (c.altar) { P.cruelty = Math.min(100, P.cruelty + 6); this.toast('Bạn lấy tiền trên bàn thờ nhà người ta. (+6 tàn nhẫn)', 'bad'); } else this.lootCruelty(c); c.money = 0; Snd.pickup(); refreshGoods(c); this.renderLoot(); },

  dialog(who, line, choices) {
    this.open('dlg'); $('#dlg-who').textContent = who; $('#dlg-line').textContent = line;
    const box = $('#dlg-choices'); box.innerHTML = '';
    for (const ch of choices) { const b = document.createElement('button'); b.className = 'btn' + (ch.danger ? ' danger' : '') + (ch.primary ? ' primary' : ''); b.innerHTML = `<span>${esc(ch.t)}</span>${ch.note ? `<em>${esc(ch.note)}</em>` : ''}`; b.disabled = !!ch.disabled; b.onclick = () => { Snd.click(); ch.fn(); }; box.appendChild(b); }
  },
  openMap() { this.open('map'); BIGMAP.z = 2.2; BIGMAP.cx = Player.pos.x; BIGMAP.cz = Player.pos.z; this.drawMap(); },
  drawMap() {
    if (MAPDIRTY.v) { renderBaseMap(); collectMapIcons(); }
    const c = $('#mapc'), x = c.getContext('2d'), W = c.width, H = c.height, Z0 = BIGMAP.z, t = Game.time;
    const ppm = MS * Z0 * (W / 1320); // pixels per metre
    BIGMAP.cx = clamp(BIGMAP.cx, -320, 320); BIGMAP.cz = clamp(BIGMAP.cz, -170, 170);
    const toS = (wx, wz) => [W / 2 + (wx - BIGMAP.cx) * ppm, H / 2 + (wz - BIGMAP.cz) * ppm];
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#14171a'; x.fillRect(0, 0, W, H);
    x.save(); const [ox, oy] = toS(-MOX, -MOZ); x.translate(ox, oy); x.scale(ppm / MS, ppm / MS); x.imageSmoothingEnabled = Z0 < 2.5; x.drawImage(BASEMAP, 0, 0); x.restore();
    const mons = visibleMonsters(true);
    for (const m of mons) { const [sx, sy] = toS(m.x, m.z); x.fillStyle = `rgba(224,69,58,${0.15 * m.alpha})`; x.beginPath(); x.arc(sx, sy, m.r * ppm, 0, TAU); x.fill(); x.strokeStyle = `rgba(224,69,58,${0.5 * m.alpha})`; x.lineWidth = 1.5; x.stroke(); }
    if (NAV.route.length > 1) { x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 9; x.beginPath(); NAV.route.forEach(([wx, wz], i) => { const [sx, sy] = toS(wx, wz); i ? x.lineTo(sx, sy) : x.moveTo(sx, sy); }); x.stroke(); x.strokeStyle = '#ffc04a'; x.lineWidth = 5; x.setLineDash([12, 8]); x.stroke(); x.setLineDash([]); }
    const isz = clamp(7 + Z0 * 2.2, 9, 17);
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (const ic of MAPICONS) { const [sx, sy] = toS(ic.x, ic.z); if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue; const big = ic.type === 'market' || ic.type === 'military' || ic.type === 'tunnel'; drawIcon(x, ic.type, sx, sy, big ? isz * 1.3 : isz); if (Z0 >= 3 || (big && Z0 >= 1.5)) { x.font = `700 ${Z0 >= 3 ? 13 : 12}px 'Be Vietnam Pro', sans-serif`; const lab = ICON[ic.type].n; const tw = x.measureText(lab).width; x.fillStyle = 'rgba(10,12,14,.8)'; x.fillRect(sx - tw / 2 - 4, sy + isz + 3, tw + 8, 17); x.fillStyle = '#fff'; x.fillText(lab, sx, sy + isz + 5); } }
    const [hx, hy] = toS(HOME.cx, HOME.cz); drawIcon(x, 'home', hx, hy, isz * 1.6); x.font = "800 15px 'Be Vietnam Pro', sans-serif"; x.fillStyle = '#ffc04a'; x.fillText('NHÀ', hx, hy + isz * 1.6 + 4);
    x.font = "700 18px 'Be Vietnam Pro', sans-serif"; x.fillStyle = 'rgba(235,229,216,.75)';
    const [vx, vy] = toS(-226, -36); x.fillText('VĂN PHÒNG', vx, vy); const [lx, ly] = toS(LAKE.x, LAKE.z - 4); x.fillText('HỒ', lx, ly); const [kx, ky] = toS(50, -158); x.fillText('VẾT NỨT (chỉ qua bằng ván)', kx, ky);
    for (const m of mons) { const [sx, sy] = toS(m.x, m.z); monsterMarker(x, sx, sy, m, 1.6, null, t); x.font = "800 14px 'Be Vietnam Pro', sans-serif"; const tw = x.measureText(m.name).width; x.fillStyle = 'rgba(120,16,10,.9)'; x.fillRect(sx - tw / 2 - 5, sy + 15, tw + 10, 19); x.fillStyle = '#fff'; x.fillText(m.name, sx, sy + 17); }
    const P = Player, [px, py] = toS(P.pos.x, P.pos.z); x.save(); x.translate(px, py); x.rotate(-P.yaw); x.fillStyle = '#fff'; x.strokeStyle = '#111'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -16); x.lineTo(11, 12); x.lineTo(0, 6); x.lineTo(-11, 12); x.closePath(); x.stroke(); x.fill(); x.restore();
    $('#map-note').textContent = (P.hasWatch() ? 'Có đồng hồ định vị: quái hiện cả trên bản đồ nhỏ. ' : 'Ứng dụng bản đồ trên điện thoại cho thấy quái ở đây. Tìm đồng hồ định vị (trên người lính, người nằm ngoài đường) để thấy chúng ngay trên bản đồ nhỏ. ') + `Vùng đỏ: khu nguy hiểm. Vạch vàng: đường đi bộ về nhà (${Math.round(NAV.len)}m). Lăn chuột hoặc + / − để phóng to, kéo để di chuyển.`;
    $('#map-zoom').textContent = Z0.toFixed(1) + '×';
  },
  ending(kind, title, story) {
    Game.state = 'end'; this.open('ending'); $('#hud').hidden = true; if (isTouch) $('#touch').hidden = true;
    $('#end-kind').textContent = kind; $('#end-title').textContent = title; $('#end-story').textContent = story;
    const P = Player; let food = 0, water = 0, med = 0;
    for (const id of P.inv) { const it = ITEMS[id]; food += Math.max(0, it.food || 0) * (it.uses || 1); water += Math.max(0, it.water || 0) * (it.uses || 1); if (it.cat === 'med') med++; }
    const days = Math.min(food / 150, water / 150);
    const mins = Math.floor(Game.time / 60), secs = Math.floor(Game.time % 60);
    const cells = [['Thời gian', `${mins}:${String(secs).padStart(2, '0')}`], ['Tàn nhẫn', `${Math.round(P.cruelty)}`], ['Đồ ăn tích trữ', `${Math.round(food)}`], ['Nước tích trữ', `${Math.round(water)}`], ['Thuốc men', `${med}`], ['Đủ cho cả nhà', `${days.toFixed(1)} ngày`], ['Người đã giúp', `${P.helped}`], ['Người đã cướp', `${P.robbed}`]];
    $('#end-sum').innerHTML = cells.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  },
};
// map legend with the same icons
function renderLegend() {
  const box = $('#map-legend'); if (!box) return; box.innerHTML = '';
  for (const t of ['home', 'grocery', 'food', 'cafe', 'pharmacy', 'clothes', 'workwear', 'shoes', 'bags', 'bike', 'hardware', 'military']) {
    const s = document.createElement('span'); const cv = document.createElement('canvas'); cv.width = cv.height = 36; cv.style.width = cv.style.height = '18px'; drawIcon(cv.getContext('2d'), t, 18, 18, 15); s.appendChild(cv); s.appendChild(document.createTextNode(ICON[t].n)); box.appendChild(s);
  }
  for (const k of ['titan', 'stalker', 'worm', 'flyer', 'wander']) { const s2 = document.createElement('span'); const cv = document.createElement('canvas'); cv.width = cv.height = 36; cv.style.width = cv.style.height = '18px'; const cx = cv.getContext('2d'); cx.fillStyle = MON_BG[k]; cx.beginPath(); cx.arc(18, 18, 16, 0, TAU); cx.fill(); monsterGlyph(cx, k, 18, 18, 14); s2.appendChild(cv); s2.appendChild(document.createTextNode({ titan: 'Thủy Quái', stalker: 'Săn Mồi', worm: 'Thổ Trùng', flyer: 'Dực Quái', wander: 'Bạch Trùng' }[k])); box.appendChild(s2); }
  for (const [c, n] of [['#e0453a', 'Vùng nguy hiểm'], ['#9a4a3a', 'Đường bị chặn'], ['#4e6b3a', 'Cây đổ (xe không qua)'], ['#0d0907', 'Vết nứt, hố sụt']]) { const s = document.createElement('span'); s.innerHTML = `<i style="background:${c}"></i>${n}`; box.appendChild(s); }
}
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.hasAttribute('data-close')) { UI.close(); return; }
  if (t.dataset.give) { Player.add(t.dataset.give); Snd.pickup(); UI.renderInv(); return; }
  if (t.dataset.sel) { UI.invSel = t.dataset.sel; UI.invHover = null; UI.renderInv(); return; }
  if (t.dataset.use) { Player.use(t.dataset.use); if (UI.modal === 'inv') UI.renderInv(); return; }
  if (t.dataset.drop) { Player.drop(t.dataset.drop); UI.renderInv(); return; }
  if (t.dataset.unequip) { Player.unequip(t.dataset.unequip); UI.renderInv(); return; }
  if (t.dataset.treat) { const inj = Player.injuries[+t.dataset.treat]; if (inj) Player.treatInjury(inj); UI.renderInv(); return; }
  if (t.dataset.take) { UI.takeLoot(+t.dataset.take); return; }
  if (t.hasAttribute('data-takemoney')) { UI.takeMoney(); return; }
});
$('#loot-all').addEventListener('click', () => { const c = UI.lootC; if (!c) return; if (c.money > 0 && !c.altar) { Player.money += c.money; c.money = 0; UI.lootCruelty(c); } for (let k = c.items.length - 1; k >= 0; k--) { if (Player.canCarry(c.items[k])) UI.takeLoot(k); } refreshGoods(c); UI.renderLoot(); });
$('#btn-resume').addEventListener('click', () => UI.close());
$('#btn-restart').addEventListener('click', () => { try { sessionStorage.setItem('tg-skip', '1'); } catch (e) { } location.reload(); });
$('#btn-again').addEventListener('click', () => { try { sessionStorage.setItem('tg-skip', '1'); } catch (e) { } location.reload(); });
$('#btn-sound').addEventListener('click', e => { Snd.setEnabled(!Snd.enabled); e.currentTarget.textContent = 'Âm thanh: ' + (Snd.enabled ? 'Bật' : 'Tắt'); });
$('#btn-quality').textContent = 'Đồ họa: ' + (QUALITY === 'high' ? 'Cao' : 'Thấp');
$('#btn-quality').addEventListener('click', () => { const q = QUALITY === 'high' ? 'low' : 'high'; try { localStorage.setItem('tg-quality', q); } catch (e) { } location.reload(); });
$('#btn-diff').textContent = 'Chế độ: ' + DIFF.name;
$('#btn-diff').addEventListener('click', e => { DIFFICULTY = DIFFICULTY === 'easy' ? 'normal' : 'easy'; DIFF = DIFFS[DIFFICULTY]; try { localStorage.setItem('tg-diff', DIFFICULTY); } catch (x) { } e.currentTarget.textContent = 'Chế độ: ' + DIFF.name; $('#diff-note').textContent = DIFF_NOTE[DIFFICULTY]; });
const DIFF_NOTE = { easy: 'Dễ: tỉnh dậy chỉ hơi choáng, không bị thương. Đói, khát, mệt giảm chậm. Quái phát hiện bạn chậm hơn.', normal: 'Thường: tỉnh dậy với tay chảy máu và chấn động đầu. Phải tìm đồ y tế ngay.' };
$('#diff-note').textContent = DIFF_NOTE[DIFFICULTY];
$('#btn-pq').addEventListener('click', () => { const q = QUALITY === 'high' ? 'low' : 'high'; try { localStorage.setItem('tg-quality', q); sessionStorage.setItem('tg-skip', '1'); } catch (e) { } location.reload(); });

function setupTouch() {
  document.body.classList.add('touch');
  const joy = $('#joy'), knob = joy.firstElementChild; let jid = null, jc = null;
  joy.addEventListener('touchstart', e => { const t = e.changedTouches[0]; jid = t.identifier; const r = joy.getBoundingClientRect(); jc = [r.left + r.width / 2, r.top + r.height / 2]; e.preventDefault(); }, { passive: false });
  const jmove = e => { for (const t of e.changedTouches) if (t.identifier === jid) { let dx = (t.clientX - jc[0]) / 50, dy = (t.clientY - jc[1]) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } Input.joy.x = dx; Input.joy.y = -dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; e.preventDefault(); } };
  const jend = e => { for (const t of e.changedTouches) if (t.identifier === jid) { jid = null; Input.joy.x = Input.joy.y = 0; knob.style.transform = ''; } };
  joy.addEventListener('touchmove', jmove, { passive: false }); joy.addEventListener('touchend', jend); joy.addEventListener('touchcancel', jend);
  let lid = null, lp = null;
  const cv = renderer.domElement;
  cv.addEventListener('touchstart', e => { for (const t of e.changedTouches) if (lid == null) { lid = t.identifier; lp = [t.clientX, t.clientY]; } }, { passive: true });
  cv.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === lid) { Input.mdx += (t.clientX - lp[0]) * 1.6; Input.mdy += (t.clientY - lp[1]) * 1.6; lp = [t.clientX, t.clientY]; } e.preventDefault(); }, { passive: false });
  const lend = e => { for (const t of e.changedTouches) if (t.identifier === lid) lid = null; };
  cv.addEventListener('touchend', lend); cv.addEventListener('touchcancel', lend);
  const press = k => { Input.pressed.add(k); };
  document.querySelectorAll('#touch [data-t]').forEach(b => {
    const k = b.dataset.t;
    b.addEventListener('touchstart', e => {
      e.preventDefault(); Snd.init();
      if (k === 'run') { Input.tRun = !Input.tRun; b.classList.toggle('on', Input.tRun); }
      else if (k === 'crouch') { Input.tCrouch = !Input.tCrouch; b.classList.toggle('on', Input.tCrouch); }
      else if (k === 'jump') press('Space'); else if (k === 'hit') press('Mouse0'); else if (k === 'throw') press('KeyQ'); else if (k === 'bike') press('KeyF'); else if (k === 'reload') press('KeyR');
      else if (k === 'use') { press('KeyE'); Input.keys.KeyE = true; }
      else if (k === 'zoom') MM.zi = (MM.zi + 1) % MM_ZOOMS.length;
      else if (k === 'inv') press('Tab'); else if (k === 'map') press('KeyM'); else if (k === 'cam') press('KeyV'); else if (k === 'pause') UI.modal ? UI.close() : UI.openPause();
    }, { passive: false });
    b.addEventListener('touchend', () => { if (k === 'use') Input.keys.KeyE = false; });
  });
}

// ---------------------------------------------------------------- map helpers: zoom, monster markers, route home
const MM_ZOOMS = [35, 55, 90, 150]; const MM = { zi: 1 };
const BIGMAP = { z: 2.2, cx: 0, cz: 0, drag: null };
const DANGER_R = { titan: 60, stalker: 32, worm: 40, flyer: 45, wander: 9 };
// the corner map shows monsters only with the watch; the big map (phone app) always shows them
function visibleMonsters(big) {
  const out = [], P = Player;
  if (!big && !P.hasWatch()) return out;
  for (const M of MONSTERS) { if ((M.kind === 'titan' && M.state === 'dormant') || M.state === 'away') continue; out.push({ x: M.x, z: M.z, kind: M.kind, name: M.name, r: DANGER_R[M.kind], alpha: 1, hunt: M.aw >= 1 || M.state === 'rage', rage: M.state === 'rage' }); }
  return out;
}
// a little picture of each monster, used inside its map marker
function monsterGlyph(x, kind, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.scale(s / 10, s / 10); x.lineCap = 'round'; x.lineJoin = 'round';
  if (kind === 'titan') { x.fillStyle = '#eef0ea'; x.beginPath(); x.ellipse(0, -2.5, 5, 2.6, 0, 0, TAU); x.fill(); x.strokeStyle = '#eef0ea'; x.lineWidth = 1.6; x.beginPath(); for (const [a, b] of [[-3.5, -6], [-1.5, -3], [1.5, 3], [3.5, 6]]) { x.moveTo(a, -1); x.lineTo(b, 6); } x.moveTo(4.5, -2); x.quadraticCurveTo(7, 0, 6, 4); x.stroke(); }
  else if (kind === 'stalker') { x.fillStyle = '#16171a'; x.beginPath(); x.ellipse(-1, 0, 4.5, 3, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(4, -1.5, 2.6, 1.8, 0, 0, TAU); x.fill(); x.strokeStyle = '#16171a'; x.lineWidth = 1.4; x.beginPath(); for (const a of [-4, -1.5, 1.5]) { x.moveTo(a, 1); x.lineTo(a - 1.5, 6); x.moveTo(a, 1); x.lineTo(a + 1.5, 6); } x.stroke(); x.fillStyle = '#ffb347'; x.beginPath(); x.arc(4.8, -2, 1, 0, TAU); x.fill(); }
  else if (kind === 'worm') { x.strokeStyle = '#d9b48a'; x.lineWidth = 3.2; x.beginPath(); x.arc(0, 4, 5.5, Math.PI * 1.05, Math.PI * 1.95); x.stroke(); x.fillStyle = '#5a1a12'; x.beginPath(); x.arc(4.6, 1, 2, 0, TAU); x.fill(); x.fillStyle = '#3a2a20'; x.fillRect(-7, 4, 14, 1.6); }
  else if (kind === 'wander') { x.fillStyle = '#e8dccb'; x.beginPath(); x.ellipse(0, 0, 3.4, 5.5, 0, 0, TAU); x.fill(); x.strokeStyle = '#e8dccb'; x.lineWidth = 1.2; x.beginPath(); for (const yy of [-3, -1, 1, 3]) for (const sx of [-1, 1]) { x.moveTo(sx * 3, yy); x.lineTo(sx * 7, yy + 1.5); x.lineTo(sx * 7.5, yy + 4); } x.stroke(); x.strokeStyle = '#8a3a2e'; x.lineWidth = 0.8; x.beginPath(); for (const yy of [-2, 0, 2]) { x.moveTo(-3, yy); x.lineTo(3, yy); } x.stroke(); }
  else if (kind === 'flyer') { x.fillStyle = '#dff0f5'; x.beginPath(); x.moveTo(0, -1); x.lineTo(-7, -5); x.lineTo(-6, 0); x.lineTo(-7.5, 3); x.lineTo(0, 1.5); x.lineTo(7.5, 3); x.lineTo(6, 0); x.lineTo(7, -5); x.closePath(); x.fill(); x.fillRect(-0.8, -5, 1.6, 10); x.fillStyle = '#ffd34d'; x.beginPath(); x.arc(0, 6.5, 1.6, 0, TAU); x.fill(); }
  x.restore();
}
const MON_BG = { titan: '#7a2a24', stalker: '#c8302a', worm: '#a0401e', flyer: '#b8301e', wander: '#7a2a24' };
function monsterMarker(x, sx, sy, m, dpr, arrowAng, t) {
  const s = (m.kind === 'titan' || m.kind === 'flyer' ? 9 : 7.5) * dpr, pulse = 1 + Math.sin(t * 6) * 0.15;
  x.globalAlpha = m.alpha;
  x.strokeStyle = m.hunt ? '#ff3b2e' : 'rgba(255,90,70,.8)'; x.lineWidth = 2 * dpr; x.beginPath(); x.arc(sx, sy, s * 1.7 * pulse, 0, TAU); x.stroke();
  x.fillStyle = '#e0302a'; x.strokeStyle = '#fff'; x.lineWidth = 2 * dpr;
  if (arrowAng != null) { x.beginPath(); x.moveTo(sx + Math.cos(arrowAng) * s * 1.3, sy + Math.sin(arrowAng) * s * 1.3); x.lineTo(sx + Math.cos(arrowAng + 2.3) * s, sy + Math.sin(arrowAng + 2.3) * s); x.lineTo(sx + Math.cos(arrowAng - 2.3) * s, sy + Math.sin(arrowAng - 2.3) * s); x.closePath(); x.fill(); x.stroke(); }
  else { x.fillStyle = MON_BG[m.kind] || '#e0302a'; x.beginPath(); x.arc(sx, sy, s * 1.25, 0, TAU); x.fill(); x.stroke(); monsterGlyph(x, m.kind, sx, sy, s * 1.05); }
  x.globalAlpha = 1;
}
// walkable grid (2m) + distance field from home; the route is the steepest descent from the player
const NAV = { S: 1, X0: -312, Z0: -162, NX: 624, NZ: 324, walk: null, dist: null, route: [], len: 0, t: 0, dirty: true };
function navWalkable(x, z) {
  let ok = true; const r = 0.3;
  queryCols(x - r, z - r, x + r, z + r, b => { if (!ok || !b.solid || b.bike) return; if (b.maxY <= 0.65 || b.minY >= 1.6) return; if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) ok = false; });
  return ok;
}
function navBuild(rect) {
  const N = NAV; if (!N.walk) { N.walk = new Uint8Array(N.NX * N.NZ); rect = null; }
  const i0 = rect ? Math.max(0, Math.floor((rect[0] - N.X0) / N.S)) : 0, i1 = rect ? Math.min(N.NX - 1, Math.ceil((rect[2] - N.X0) / N.S)) : N.NX - 1;
  const j0 = rect ? Math.max(0, Math.floor((rect[1] - N.Z0) / N.S)) : 0, j1 = rect ? Math.min(N.NZ - 1, Math.ceil((rect[3] - N.Z0) / N.S)) : N.NZ - 1;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) N.walk[j * N.NX + i] = navWalkable(N.X0 + (i + 0.5) * N.S, N.Z0 + (j + 0.5) * N.S) ? 1 : 0;
  N.dirty = true;
}
const navCell = (x, z) => [Math.floor((x - NAV.X0) / NAV.S), Math.floor((z - NAV.Z0) / NAV.S)];
function navPortals() {
  const N = NAV, P = new Map();
  for (const T of TUNNELS) for (const [ia, ib, cost] of T.links || []) { const a = navCell(...T.stairs[ia].top), b = navCell(...T.stairs[ib].top); const ca = a[1] * N.NX + a[0], cb = b[1] * N.NX + b[0]; N.walk[ca] = N.walk[cb] = 1; if (!P.has(ca)) P.set(ca, []); if (!P.has(cb)) P.set(cb, []); P.get(ca).push([cb, cost]); P.get(cb).push([ca, cost]); }
  return P;
}
// cost field from the current goal (home, or the quest house); Dijkstra with a binary heap, 1m cells, underpasses as shortcuts
function navField() {
  const N = NAV, n = N.NX * N.NZ; N.dist = new Float32Array(n).fill(-1); N.portals = navPortals();
  const tg = N.goal || { x: HOME.inside.x, z: HOME.inside.z };
  const [hi, hj] = navCell(tg.x, tg.z); const s0 = hj * N.NX + hi; N.walk[s0] = 1; N.dist[s0] = 0;
  const hk = [s0], hd = [0]; const push = (k, d) => { hk.push(k); hd.push(d); let i = hk.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= hd[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hd[p], hd[i]] = [hd[i], hd[p]]; i = p; } };
  const pop = () => { const k = hk[0], d = hd[0]; const lk = hk.pop(), ld = hd.pop(); if (hk.length) { hk[0] = lk; hd[0] = ld; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hk.length && hd[l] < hd[m]) m = l; if (r < hk.length && hd[r] < hd[m]) m = r; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hd[m], hd[i]] = [hd[i], hd[m]]; i = m; } } return [k, d]; };
  const done = new Uint8Array(n);
  while (hk.length) {
    const [c, dc] = pop(); if (done[c]) continue; done[c] = 1;
    const i = c % N.NX, j = (c / N.NX) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N.NX || nj >= N.NZ) continue; const k = nj * N.NX + ni; if (!N.walk[k] || done[k]) continue; const nd = dc + 1; if (N.dist[k] < 0 || nd < N.dist[k]) { N.dist[k] = nd; push(k, nd); } }
    const pl = N.portals.get(c); if (pl) for (const [k, cost] of pl) { const nd = dc + cost; if (!done[k] && (N.dist[k] < 0 || nd < N.dist[k])) { N.dist[k] = nd; push(k, nd); } }
  }
  N.dirty = false;
}
function navUpdate(dt) {
  const N = NAV; N.t -= dt; if (N.t > 0) return; N.t = 0.6;
  if (!N.walk) navBuild(); if (N.dirty) navField();
  let [i, j] = navCell(Player.pos.x, Player.pos.z); let c = j * N.NX + i;
  if (!(N.dist[c] >= 0)) { let best = -1, bd = 1e9; for (let dj = -5; dj <= 5; dj++) for (let di = -5; di <= 5; di++) { const k = (j + dj) * N.NX + (i + di); if (N.dist[k] >= 0 && N.dist[k] < bd) { bd = N.dist[k]; best = k; } } if (best < 0) { N.route = []; return; } c = best; }
  const pts = [[Player.pos.x, Player.pos.z]]; let guard = 0, len = 0; N.tunnelLegs = [];
  while (N.dist[c] > 0 && guard++ < 6000) {
    const i2 = c % N.NX, j2 = (c / N.NX) | 0; let nxt = -1, nd = N.dist[c], viaPortal = false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (j2 + dj) * N.NX + (i2 + di); if (N.dist[k] >= 0 && N.dist[k] < nd) { nd = N.dist[k]; nxt = k; } }
    const pl = N.portals.get(c); if (pl) for (const [k] of pl) if (N.dist[k] >= 0 && N.dist[k] < nd) { nd = N.dist[k]; nxt = k; viaPortal = true; }
    if (nxt < 0) break; c = nxt;
    const p = [N.X0 + (c % N.NX + 0.5) * N.S, N.Z0 + (((c / N.NX) | 0) + 0.5) * N.S]; const q2 = pts[pts.length - 1]; len += Math.hypot(p[0] - q2[0], p[1] - q2[1]); if (viaPortal) N.tunnelLegs.push([q2, p]); pts.push(p);
  }
  const tg = N.goal || { x: HOME.front.x, z: HOME.front.z }; pts.push([tg.fx ?? tg.x, tg.fz ?? tg.z]);
  N.route = pts; N.len = len;
}

// big map: wheel zoom, drag to pan, buttons
{
  const c = $('#mapc');
  const toW = (e) => { const r = c.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * c.width, py = (e.clientY - r.top) / r.height * c.height; const ppm = MS * BIGMAP.z * (c.width / 1320); return [BIGMAP.cx + (px - c.width / 2) / ppm, BIGMAP.cz + (py - c.height / 2) / ppm]; };
  c.addEventListener('wheel', e => { e.preventDefault(); const before = toW(e); BIGMAP.z = clamp(BIGMAP.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 0.9, 6); const after = toW(e); BIGMAP.cx += before[0] - after[0]; BIGMAP.cz += before[1] - after[1]; UI.drawMap(); }, { passive: false });
  c.addEventListener('pointerdown', e => { BIGMAP.drag = [e.clientX, e.clientY, BIGMAP.cx, BIGMAP.cz]; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (!BIGMAP.drag) return; const r = c.getBoundingClientRect(); const ppm = MS * BIGMAP.z * (c.width / 1320) * (r.width / c.width); BIGMAP.cx = BIGMAP.drag[2] - (e.clientX - BIGMAP.drag[0]) / ppm; BIGMAP.cz = BIGMAP.drag[3] - (e.clientY - BIGMAP.drag[1]) / ppm; UI.drawMap(); });
  c.addEventListener('pointerup', () => { BIGMAP.drag = null; });
  document.querySelectorAll('[data-mz]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.mz; if (k === '+') BIGMAP.z = Math.min(6, BIGMAP.z * 1.35); else if (k === '-') BIGMAP.z = Math.max(0.9, BIGMAP.z / 1.35); else { BIGMAP.cx = Player.pos.x; BIGMAP.cz = Player.pos.z; } UI.drawMap(); }));
}
$('#btn-home').addEventListener('click', () => { try { sessionStorage.removeItem('tg-skip'); } catch (e) { } location.reload(); });

// hovering a bag slot previews it
document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-sel]'); if (!t || UI.modal !== 'inv') return; if (UI.invHover !== t.dataset.sel) { UI.invHover = t.dataset.sel; UI.renderInvDetail(UI.invHover); } });
document.addEventListener('mouseout', e => { const t = e.target.closest && e.target.closest('#inv-items'); if (!t || UI.modal !== 'inv' || (e.relatedTarget && t.contains(e.relatedTarget))) return; UI.invHover = null; UI.renderInvDetail(UI.invSel || Object.keys(UI.invGroups || {})[0]); });

// double-click a bag slot to use / wear it straight away
document.addEventListener('dblclick', e => { const t = e.target.closest && e.target.closest('[data-sel]'); if (!t || UI.modal !== 'inv') return; Player.use(t.dataset.sel); UI.renderInv(); });

// god mode lock: password sheet
$('#btn-god').addEventListener('click', () => { if (GOD.on) { setGod(false); return; } UI.open('godsheet'); $('#god-pass').value = ''; $('#god-err').textContent = ''; setTimeout(() => $('#god-pass').focus(), 50); });
const tryGod = () => { if ($('#god-pass').value.trim() === GOD.pass) { UI.close(true); setGod(true); UI.openPause(); } else { $('#god-err').textContent = 'Sai mật khẩu.'; Snd.empty(); } };
$('#god-ok').addEventListener('click', tryGod);
$('#god-pass').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') tryGod(); if (e.key === 'Escape') { UI.close(true); UI.openPause(); } });
$('#god-cancel').addEventListener('click', () => { UI.close(true); UI.openPause(); });
// teleport by double-clicking the big map in god mode
document.addEventListener('dblclick', e => { if (!GOD.on || UI.modal !== 'map') return; const c = $('#mapc'), r = c.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return; const px = (e.clientX - r.left) / r.width * c.width, py = (e.clientY - r.top) / r.height * c.height; const ppm = MS * BIGMAP.z * (c.width / 1320); const wx = BIGMAP.cx + (px - c.width / 2) / ppm, wz = BIGMAP.cz + (py - c.height / 2) / ppm; if (Player.bike) dismount(); Player.pos.set(wx, GOD.fly ? Math.max(Player.pos.y, 20) : groundAt(wx, wz, 0.35, 50, 99), wz); UI.toast('Đã dịch chuyển.'); UI.drawMap(); });
