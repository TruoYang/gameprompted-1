// ---------------------------------------------------------------- humanoid model (player in 3rd person, NPCs, bodies)
function makeHuman(opt = {}) {
  const g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const skin = mat(opt.skin || 0xd9a77e), shirt = mat(opt.shirt || 0xeeeeee), pants = mat(opt.pants || 0x2b2f3a), hair = mat(opt.hair || 0x1c1814), shoe = mat(opt.shoe || 0x1d1d1d);
  const box = (sx, sy, sz, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); me.castShadow = true; return me; };
  const s = opt.scale || 1;
  const hip = new THREE.Group(); hip.position.y = 0.92 * s; g.add(hip);
  const torso = box(0.42 * s, 0.6 * s, 0.24 * s, shirt); torso.position.y = 0.3 * s; hip.add(torso);
  const neck = box(0.1 * s, 0.08 * s, 0.1 * s, skin); neck.position.y = 0.63 * s; hip.add(neck);
  const head = box(0.24 * s, 0.26 * s, 0.24 * s, skin); head.position.y = 0.76 * s; hip.add(head);
  const hr = box(0.26 * s, 0.09 * s, 0.26 * s, hair); hr.position.y = 0.92 * s; hip.add(hr);
  const hb = box(0.26 * s, 0.14 * s, 0.06 * s, hair); hb.position.set(0, 0.82 * s, 0.11 * s); hip.add(hb);
  const mkLimb = (x, y, len, w, m, parent, end) => { const p = new THREE.Group(); p.position.set(x, y, 0); const l = box(w, len, w, m); l.position.y = -len / 2; p.add(l); if (end) { const e = box(w * 1.05, 0.1 * s, w * 1.6, end); e.position.set(0, -len + 0.03 * s, -w * 0.3); p.add(e); } parent.add(p); return p; };
  const la = mkLimb(-0.28 * s, 0.56 * s, 0.6 * s, 0.12 * s, shirt, hip, skin), ra = mkLimb(0.28 * s, 0.56 * s, 0.6 * s, 0.12 * s, shirt, hip, skin);
  const ll = mkLimb(-0.11 * s, 0, 0.9 * s, 0.15 * s, pants, hip, shoe), rl = mkLimb(0.11 * s, 0, 0.9 * s, 0.15 * s, pants, hip, shoe);
  const helmet = box(0.3 * s, 0.18 * s, 0.3 * s, mat(opt.helmet || 0xc8302a)); helmet.position.y = 0.94 * s; helmet.visible = !!opt.helmet; hip.add(helmet);
  const pack = box(0.34 * s, 0.42 * s, 0.18 * s, mat(opt.packColor || 0x2d4a3a)); pack.position.set(0, 0.32 * s, 0.2 * s); pack.visible = !!opt.pack; hip.add(pack);
  g.userData = { hip, torso, head, la, ra, ll, rl, shirtMat: shirt, helmet, pack, phase: 0 };
  return g;
}
function animHuman(h, speed, dt, crouch, sit) {
  const u = h.userData; u.phase += dt * (2 + speed * 2.2);
  const sw = Math.min(1, speed / 3) * 0.7;
  if (sit) { u.ll.rotation.x = -1.3; u.rl.rotation.x = -1.3; u.la.rotation.x = -0.9; u.ra.rotation.x = -0.9; u.hip.position.y = 0.75; return; }
  u.ll.rotation.x = Math.sin(u.phase) * sw; u.rl.rotation.x = -Math.sin(u.phase) * sw;
  u.la.rotation.x = -Math.sin(u.phase) * sw * 0.8; u.ra.rotation.x = Math.sin(u.phase) * sw * 0.8;
  u.hip.position.y = lerp(0.92, 0.62, crouch) + Math.abs(Math.sin(u.phase)) * 0.04 * sw;
  u.torso.rotation.x = crouch * 0.45; u.head.position.z = -crouch * 0.12;
}

// ---------------------------------------------------------------- input
const Input = {
  keys: {}, mdx: 0, mdy: 0, locked: false, joy: { x: 0, y: 0 }, tRun: false, tCrouch: false, pressed: new Set(),
  down(k) { return !!this.keys[k]; },
  tap(k) { if (this.pressed.has(k)) { this.pressed.delete(k); return true; } return false; },
};
addEventListener('keydown', e => {
  const k = e.code; if (['Tab', 'Space'].includes(k)) e.preventDefault();
  if (!Input.keys[k]) Input.pressed.add(k); Input.keys[k] = true;
});
addEventListener('keyup', e => { Input.keys[e.code] = false; });
addEventListener('blur', () => { Input.keys = {}; });
addEventListener('mousemove', e => { if (Input.locked || (Input.dragLook && Input.mouseDown)) { Input.mdx += e.movementX; Input.mdy += e.movementY; } });
addEventListener('mousedown', e => { if (e.button === 0) { Input.mouseDown = true; if (Game.state === 'play' && !UI.modal) Input.pressed.add('Mouse0'); } });
addEventListener('mouseup', e => { if (e.button === 0) Input.mouseDown = false; });
document.addEventListener('pointerlockchange', () => {
  Input.locked = document.pointerLockElement === renderer.domElement;
  if (Input.locked) Input.dragLook = false;
  if (Input.locked && UI.modal) { document.exitPointerLock(); return; }
  if (!Input.locked && Game.state === 'play' && !UI.modal && !isTouch && !Input.dragLook && performance.now() - (UI.closedAt || 0) > 400) UI.openPause();
});
function requestLock() {
  if (isTouch) return;
  try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => { Input.dragLook = true; }); } catch (e) { Input.dragLook = true; }
  setTimeout(() => { if (!Input.locked) Input.dragLook = true; }, 400);
}
renderer.domElement.addEventListener('click', () => { if (Game.state === 'play' && !UI.modal && !Input.locked) requestLock(); });

// ---------------------------------------------------------------- player
const INJ_NAME = { bleed: 'Chảy máu', fracture: 'Gãy xương', infect: 'Nhiễm trùng', bruise: 'Bầm dập', concuss: 'Chấn động' };
const PART_NAME = { head: 'Đầu', torso: 'Thân', larm: 'Tay trái', rarm: 'Tay phải', lleg: 'Chân trái', rleg: 'Chân phải' };
const Player = {
  pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0, onGround: true, crouch: 0, height: 1.7,
  hp: 100, food: 82, water: 70, stam: 100, cruelty: 0, money: 350000,
  inv: [], equip: { head: null, body: null, feet: null, back: null }, weapon: null,
  injuries: [], painkiller: 0, speedNow: 0, noise: 0, indoors: null, bike: null, tp: false,
  stepT: 0, swingT: 0, swingCd: 0, knock: new THREE.Vector3(), dead: false, helped: 0, robbed: 0, distance: 0, time: 0,
  mag: 0, reloadT: 0,
  reset() {
    this.pos.set(START.x, START.y || 0, START.z); this.vy = 0; this.yaw = -Math.PI / 2 - 0.2; this.pitch = -0.05; this.crouch = 0;
    this.hp = DIFF.startInj ? 78 : 100; this.food = 80; this.water = DIFF.startInj ? 62 : 75; this.stam = 100; this.cruelty = 0; this.money = 350000;
    this.inv = ['dienthoai', 'nuocsuoi']; this.equip = { head: null, body: null, feet: null, back: null }; this.weapon = null;
    this.injuries = DIFF.startInj ? [{ part: 'larm', type: 'bleed', t: 0 }, { part: 'head', type: 'concuss', t: 0 }] : [];
    this.painkiller = 0; this.bike = null; this.dead = false; this.helped = 0; this.robbed = 0; this.distance = 0; this.time = 0; this.knock.set(0, 0, 0);
    this.weaponUses = {}; this.mag = 0; this.reloadT = 0; this.hadGun = false;
  },
  stat(k) { let v = 0; for (const s in this.equip) { const id = this.equip[s]; const it = id ? ITEMS[id] : STARTER[s]; if (it && it[k]) v += it[k]; } return v; },
  capacity() { return GOD.on ? 999 : 8 + this.stat('cap'); },
  weight() { let w = 0; for (const id of this.inv) w += ITEMS[id].w; for (const s in this.equip) if (this.equip[s]) w += ITEMS[this.equip[s]].w * 0.5; return w; },
  count(id) { return this.inv.filter(i => i === id).length; },
  has(id) { return this.inv.includes(id); },
  hasWatch() { return this.inv.includes('dongho'); },
  remove(id) { const i = this.inv.indexOf(id); if (i >= 0) { this.inv.splice(i, 1); if (this.weapon === id && !this.inv.includes(id)) this.weapon = this.inv.find(x => ITEMS[x].weapon) || null; return true; } return false; },
  // a bigger backpack can always be put on straight away, even when you are overloaded
  betterBag(id) { const it = ITEMS[id]; if (it.slot !== 'back') return false; const cur = this.equip.back ? ITEMS[this.equip.back].cap : 0; return it.cap > cur; },
  canCarry(id) { return this.betterBag(id) || this.weight() + ITEMS[id].w <= this.capacity() * 1.5; },
  add(id) {
    if (!this.canCarry(id)) return false;
    const it = ITEMS[id];
    if (this.betterBag(id)) { const prev = this.equip.back; this.equip.back = id; if (prev) this.inv.push(prev); updatePlayerLook(); UI.toast(`Đã đeo ${it.n}: sức chứa ${this.capacity()}kg`, 'good'); return true; }
    this.inv.push(id);
    if (it.gun) { if (!this.hadGun) { this.mag = 10; this.hadGun = true; } this.weapon = id; UI.toast('Có súng rồi. Chuột trái để bắn, R để nạp đạn. Tiếng súng sẽ kéo quái vật tới.', 'good'); }
    else if (it.weapon && !this.weapon) this.weapon = id;
    if (it.watch && this.count('dongho') === 1) UI.toast('Đồng hồ định vị đã bắt được tín hiệu: vị trí mọi con quái hiện trên bản đồ.', 'good');
    return true;
  },
  hasInj(type, part) { return this.injuries.some(i => i.type === type && (!part || i.part === part)); },
  legHurt() { return this.injuries.some(i => i.type === 'fracture' && (i.part === 'lleg' || i.part === 'rleg')); },
  armHurt() { return this.injuries.some(i => i.type === 'fracture' && (i.part === 'larm' || i.part === 'rarm')); },
  addInjury(part, type) {
    if (type === 'fracture' && (part === 'lleg' || part === 'rleg') && Math.random() < this.stat('legArmor')) type = 'bruise';
    if (part === 'head' && Math.random() < this.stat('headArmor')) type = 'bruise';
    if (this.injuries.some(i => i.part === part && i.type === type)) return;
    this.injuries.push({ part, type, t: 0 });
    UI.toast(`${PART_NAME[part]}: ${INJ_NAME[type]}`, 'bad');
  },
  damage(amount, kind = 'blunt', srcX, srcZ) {
    if (this.dead || Game.state !== 'play' || GOD.on) return;
    const armor = clamp(this.stat('armor'), 0, 0.6);
    const a = amount * (1 - armor) * DIFF.dmg;
    this.hp -= a; Snd.hurt(); UI.hurtFlash(Math.min(1, a / 40)); Shake.add(Math.min(1, a / 30));
    if (srcX != null) { const dx = this.pos.x - srcX, dz = this.pos.z - srcZ, l = Math.hypot(dx, dz) || 1; this.knock.set(dx / l * Math.min(10, a * 0.25), 0, dz / l * Math.min(10, a * 0.25)); this.vy = Math.min(5, a * 0.1); }
    const parts = ['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg'], q = DIFF.injure;
    if (kind === 'slash' && Math.random() < 0.85 * q) this.addInjury(pick(['torso', 'larm', 'rarm', 'lleg', 'rleg']), 'bleed');
    if (kind === 'crush') { if (Math.random() < 0.55 * q) this.addInjury(pick(['lleg', 'rleg', 'larm', 'rarm']), 'fracture'); if (Math.random() < 0.6 * q) this.addInjury(pick(parts), 'bleed'); if (Math.random() < 0.4 * q) this.addInjury('head', 'concuss'); }
    if (kind === 'blunt') { if (Math.random() < 0.6 * q) this.addInjury(pick(parts), 'bruise'); if (Math.random() < 0.25 * q) this.addInjury(pick(['lleg', 'rleg', 'larm', 'rarm']), 'fracture'); if (Math.random() < 0.3 * q) this.addInjury('head', 'concuss'); }
    if (kind === 'fall') { if (Math.random() < 0.5 * q) this.addInjury(pick(['lleg', 'rleg', 'larm', 'rarm']), Math.random() < 0.4 ? 'fracture' : 'bruise'); if (Math.random() < 0.5 * q) this.addInjury(pick(parts), 'bleed'); }
    if (this.hp <= 0) Game.die(kind);
  },
  use(id) {
    const it = ITEMS[id]; if (!it) return;
    if (it.slot) { this.equipItem(id); return; }
    if (it.weapon) { this.weapon = id; UI.toast(`Cầm ${it.n} trên tay`); return; }
    if (it.wallet) { const m = randi(3, 40) * 10000; this.money += m; this.remove(id); UI.toast(`Trong ví có ${money(m)}.`, 'good'); return; }
    if (it.lore) { const [who, msg] = pick(LORE); UI.dialog(`Tin nhắn từ ${who}`, msg, [{ t: 'Cất điện thoại', fn: () => { UI.close(true); UI.openInv(); } }, { t: 'Vứt nó đi', fn: () => { this.remove(id); UI.close(true); UI.openInv(); } }]); return; }
    if (it.radar) { UI.toast('Radar trên điện thoại luôn bật: chấm đỏ trên bản đồ góc trái là quái vật trong 90m.'); return; }
    if (it.watch) { UI.toast('Đồng hồ đang hiện vị trí mọi con quái trên bản đồ.'); return; }
    if (it.ammo) { reloadGun(); return; }
    if (it.fuel) {
      const b = BIKES.find(b => dist2(b.x, b.z, this.pos.x, this.pos.z) < 3.5 && b.usable);
      if (!b) { UI.toast('Phải đứng cạnh một chiếc xe máy'); return; }
      b.fuel = Math.min(100, b.fuel + it.fuel); this.remove(id); UI.toast(`Đã đổ xăng. Xăng: ${Math.round(b.fuel)}%`, 'good'); return;
    }
    if (it.throwable) { UI.toast('Ném bằng phím Q (hoặc nút Ném)'); return; }
    if (it.food || it.water) {
      if (it.food) this.food = clamp(this.food + it.food, 0, 100);
      if (it.water) this.water = clamp(this.water + it.water, 0, 100);
      if (it.stam) this.stam = 100;
      this.remove(id); Snd.pickup(); UI.toast(`Đã dùng ${it.n}`); return;
    }
    if (it.treat) {
      const t = it.treat;
      if (t === 'kit') { const had = this.injuries.length; this.injuries = this.injuries.filter(i => i.type !== 'bleed'); this.hp = Math.min(100, this.hp + it.heal); this.remove(id); UI.toast(had ? 'Đã sơ cứu: cầm máu, hồi 30 máu' : 'Hồi 30 máu', 'good'); return; }
      if (t === 'pain') { this.painkiller = 120; this.injuries = this.injuries.filter(i => i.type !== 'bruise' && i.type !== 'concuss'); this.remove(id); UI.toast('Uống thuốc giảm đau. Bầm dập và chấn động đã đỡ', 'good'); return; }
      if (t === 'clean') { this.cleaned = 60; this.remove(id); UI.toast('Đã sát trùng. Băng bó trong 60 giây tới sẽ không bị nhiễm trùng', 'good'); return; }
      const idx = this.injuries.findIndex(i => i.type === t);
      if (idx < 0) { UI.toast(`Không có vết thương cần ${it.n}`); return; }
      const inj = this.injuries[idx]; this.injuries.splice(idx, 1); this.remove(id);
      if (t === 'bleed' && !(this.cleaned > 0) && Math.random() < 0.35 * DIFF.injure) this.pendingInfect = { part: inj.part, t: 45 };
      UI.toast(`${PART_NAME[inj.part]}: đã xử lý ${INJ_NAME[inj.type].toLowerCase()}`, 'good'); return;
    }
  },
  treatInjury(inj) {
    const need = { bleed: ['bang', 'socuu'], fracture: ['nep'], infect: ['khangsinh'], bruise: ['giamdau'], concuss: ['giamdau'] }[inj.type];
    const id = need.find(n => this.has(n)); if (!id) { UI.toast(`Cần ${need.map(n => ITEMS[n].n).join(' hoặc ')}`); return; }
    if (inj.type === 'bleed' && id === 'bang') { const i = this.injuries.indexOf(inj); this.injuries.splice(i, 1); this.remove('bang'); if (!(this.cleaned > 0) && Math.random() < 0.35 * DIFF.injure) this.pendingInfect = { part: inj.part, t: 45 }; UI.toast(`${PART_NAME[inj.part]}: đã băng bó`, 'good'); return; }
    if (inj.type === 'fracture' || inj.type === 'infect') { const i = this.injuries.indexOf(inj); this.injuries.splice(i, 1); this.remove(id); UI.toast(`${PART_NAME[inj.part]}: đã xử lý ${INJ_NAME[inj.type].toLowerCase()}`, 'good'); return; }
    this.use(id);
  },
  equipItem(id) {
    const it = ITEMS[id]; const s = it.slot; const prev = this.equip[s];
    this.remove(id); if (prev) this.inv.push(prev); this.equip[s] = id;
    UI.toast(`Đã mặc/đeo: ${it.n}`, 'good'); updatePlayerLook();
  },
  unequip(s) { const id = this.equip[s]; if (!id) return; this.equip[s] = null; this.inv.push(id); updatePlayerLook(); },
  drop(id) { if (ITEMS[id].quest) { UI.toast('Không thể vứt thứ này'); return; } this.remove(id); dropToGround(id); },
};
function dropToGround(id) {
  const x = Player.pos.x, z = Player.pos.z;
  let c = CONTAINERS.find(c => c.kind === 'ground' && !c.dead && dist2(c.x, c.z, x, z) < 1.5);
  if (!c) { c = addContainer(x, 0.3, z, 'Đồ đã vứt', 'house', 0, null, { items: [], kind: 'ground', box: [x - 0.35, 0, z - 0.35, x + 0.35, 0.3, z + 0.35] }); c.searched = true; const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.3), new THREE.MeshLambertMaterial({ color: 0x6a5a40 })); m.position.set(x, 0.08, z); scene.add(m); }
  c.items.push(id);
}

const playerModel = makeHuman({ shirt: 0xf1f1ee, pants: 0x2d3340 }); scene.add(playerModel);
function updatePlayerLook() {
  const u = playerModel.userData; const b = Player.equip.body;
  u.shirtMat.color.set(b === 'aokhoac' ? 0x2a2f33 : b === 'aophao' ? 0x3d4f3a : b === 'aobaoho' ? 0xe08a1e : b === 'aogiap' ? 0x4a5a32 : 0xf1f1ee);
  u.helmet.visible = !!Player.equip.head; u.helmet.material.color.set(Player.equip.head === 'musat' ? 0x4a5a32 : 0xc8302a);
  u.pack.visible = !!Player.equip.back;
}

// ---------------------------------------------------------------- motorbikes
const BIKES = [];
class Bike {
  constructor(x, z, rot, color, usable = true, fuel = 60) {
    this.x = x; this.z = z; this.rot = rot; this.speed = 0; this.usable = usable; this.fuel = fuel; this.lean = 0;
    const mb = new MB(); addBikeMesh(mb, 0, 0, 0, color);
    this.mesh = new THREE.Mesh(mb.build(), MAT.vc); this.mesh.castShadow = true; scene.add(this.mesh);
    this.rider = makeHuman({ shirt: 0xf1f1ee }); this.rider.visible = false; this.rider.position.set(0, 0, 0.15); this.mesh.add(this.rider);
    this.sync();
    this.it = addInteract({ x, y: 0.8, z, r: 2.4, kind: 'bike', ref: this });
    BIKES.push(this);
  }
  sync() {
    this.mesh.position.set(this.x, 0, this.z); this.mesh.rotation.set(0, this.rot, 0); this.mesh.rotateZ(this.lean);
    if (this.it) { this.it.x = this.x; this.it.z = this.z; this.it.box = [this.x - 0.95, 0, this.z - 0.95, this.x + 0.95, 1.35, this.z + 0.95]; }
  }
}
function spawnBikes() {
  new Bike(-197.5, 9, Math.PI, '#b8231d', true, 55).owned = true;
  const spots = [[-150, 54.6, 1.57], [-50, -45.4, -1.57], [120, -54.6, 1.57], [205.4, -20, 0], [160, 45.4, 1.57], [95.4, 130, 0], [-95.4, -120, 0], [260, 145.4, 1.57]];
  for (const [x, z, r] of spots) new Bike(x, z, r, pick(['#222', '#1d4f9c', '#e8e8e8', '#7a7f85']), true, randi(15, 45));
}

// ---------------------------------------------------------------- player update
const _fw = new THREE.Vector3(), _rt = new THREE.Vector3();
function playerUpdate(dt) {
  const P = Player;
  const sens = 0.0022;
  P.yaw -= Input.mdx * sens; P.pitch -= Input.mdy * sens; Input.mdx = Input.mdy = 0;
  P.pitch = clamp(P.pitch, -1.45, 1.35);
  if (Input.tap('KeyV')) P.tp = !P.tp;
  if (P.bike) { bikeUpdate(dt); return; }
  if (GOD.on && GOD.fly) { flyUpdate(dt); return; }
  let mx = 0, mz = 0;
  if (Input.down('KeyW') || Input.down('ArrowUp')) mz += 1; if (Input.down('KeyS') || Input.down('ArrowDown')) mz -= 1;
  if (Input.down('KeyA') || Input.down('ArrowLeft')) mx -= 1; if (Input.down('KeyD') || Input.down('ArrowRight')) mx += 1;
  mx += Input.joy.x; mz += Input.joy.y;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  if (Input.tap('KeyC')) Input.tCrouch = !Input.tCrouch;
  const crouching = Input.tCrouch;
  const legBad = P.legHurt(), heavy = P.weight() > P.capacity();
  const sprint = (Input.down('ShiftLeft') || Input.down('ShiftRight') || Input.tRun) && ml > 0.1 && P.stam > 2 && !legBad && !heavy && !crouching;
  let speed = crouching ? 1.7 : sprint ? 6.2 : 3.3;
  speed *= 1 + P.stat('speed');
  if (legBad) speed *= P.painkiller > 0 ? 0.75 : 0.55;
  if (heavy) speed *= 0.7;
  if (P.hp < 25) speed *= 0.85;
  P.crouch = damp(P.crouch, crouching ? 1 : 0, 10, dt);
  P.height = lerp(1.7, 1.05, P.crouch);
  _fw.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); _rt.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const vx = (_fw.x * mz + _rt.x * mx) * speed + P.knock.x, vz = (_fw.z * mz + _rt.z * mx) * speed + P.knock.z;
  P.knock.multiplyScalar(Math.exp(-5 * dt));
  const ox = P.pos.x, oz = P.pos.z;
  P.pos.x += vx * dt; P.pos.z += vz * dt;
  collideCircle(P.pos, 0.35, P.pos.y, P.height, false, STEP_WALK);
  const moved = Math.hypot(P.pos.x - ox, P.pos.z - oz); P.distance += moved; P.speedNow = moved / Math.max(dt, 1e-4);
  const g = groundAt(P.pos.x, P.pos.z, 0.35, P.pos.y, STEP_WALK);
  if (Input.tap('Space')) { if (Input.tCrouch) Input.tCrouch = false; else if (P.onGround && !legBad) { P.vy = 5.2; P.onGround = false; P.stam -= 8 * DIFF.stam; } }
  P.vy -= 15 * dt; P.pos.y += P.vy * dt;
  if (P.pos.y <= g) {
    if (!P.onGround && P.vy < -9) P.damage((-P.vy - 9) * 6, 'fall');
    if (!P.onGround) { emitNoise(P.pos.x, P.pos.z, crouching ? 2 : 7, 'step'); Snd.step(false); }
    P.pos.y = g; P.vy = 0; P.onGround = true;
  } else if (g < P.pos.y - 0.05 && P.pos.y - g < 0.7 && P.vy <= 0 && P.onGround) { P.pos.y = g; } // walk down steps smoothly
  else if (P.pos.y > g + 0.05) P.onGround = false;
  if (sprint && P.speedNow > 1) P.stam = Math.max(0, P.stam - 17 * DIFF.stam * dt); else P.stam = Math.min(100, P.stam + (crouching ? 16 : 12) / Math.sqrt(DIFF.stam) * dt);
  const quiet = 1 - P.stat('quiet');
  P.noise = P.speedNow < 0.4 ? 0 : (crouching ? 1.6 : sprint ? 17 : 6.5) * quiet * (P.indoors ? 0.7 : 1) * (P.pos.y < -1 ? 0.3 : 1);
  P.stepT -= dt * P.speedNow; if (P.stepT <= 0 && P.speedNow > 0.4 && P.onGround) { P.stepT = sprint ? 2.6 : 1.7; Snd.step(crouching); }
  P.sprinting = sprint && P.speedNow > 1;
}

function bikeUpdate(dt) {
  const P = Player, b = P.bike;
  let thr = 0, steer = 0;
  if (Input.down('KeyW') || Input.down('ArrowUp')) thr += 1; if (Input.down('KeyS') || Input.down('ArrowDown')) thr -= 1;
  if (Input.down('KeyA') || Input.down('ArrowLeft')) steer += 1; if (Input.down('KeyD') || Input.down('ArrowRight')) steer -= 1;
  thr += Input.joy.y; steer -= Input.joy.x;
  thr = clamp(thr, -1, 1); steer = clamp(steer, -1, 1);
  const hasFuel = b.fuel > 0;
  if (thr > 0 && hasFuel) b.speed += thr * 7 * dt * (1 - b.speed / 15);
  else if (thr < 0) b.speed += (b.speed > 0.5 ? -14 : -3) * dt * -thr;
  b.speed -= b.speed * 0.25 * dt; if (Math.abs(b.speed) < 0.05 && thr === 0) b.speed = 0;
  b.speed = clamp(b.speed, -3, 15);
  if (hasFuel) b.fuel = Math.max(0, b.fuel - (0.25 + Math.abs(b.speed) * 0.045) * dt);
  if (b.fuel <= 0 && !b.warned) { b.warned = true; UI.toast('Xe hết xăng!', 'bad'); }
  b.rot += steer * 1.9 * dt * clamp(Math.abs(b.speed) / 4, 0, 1) * Math.sign(b.speed || 1);
  b.lean = damp(b.lean, -steer * clamp(b.speed / 12, 0, 0.35), 6, dt);
  const ox = b.x, oz = b.z;
  b.x += -Math.sin(b.rot) * b.speed * dt; b.z += -Math.cos(b.rot) * b.speed * dt;
  const p = { x: b.x, z: b.z }; const hit = collideCircle(p, 0.62, 0, 1.4, true, STEP_BIKE);
  if (hit) {
    if (Math.abs(b.speed) > 8.5) {
      const sp = b.speed; b.x = p.x; b.z = p.z; b.speed = 0; dismount(true);
      P.damage(clamp((Math.abs(sp) - 7) * 5, 8, 35), 'fall', b.x - Math.sin(b.rot) * 2, b.z - Math.cos(b.rot) * 2);
      emitNoise(b.x, b.z, 45, 'crash'); Snd.crash(0); UI.toast('Bạn ngã xe!', 'bad'); return;
    }
    b.speed *= 0.4;
    if (!b.blockWarn || Game.time - b.blockWarn > 6) { b.blockWarn = Game.time; if (Math.abs(b.speed) < 2) UI.toast('Xe không qua được chỗ này. Xuống xe [F] rồi đi bộ.'); }
  }
  b.x = p.x; b.z = p.z;
  P.distance += Math.hypot(b.x - ox, b.z - oz);
  P.pos.set(b.x, 0, b.z); P.speedNow = Math.abs(b.speed);
  b.sync();
  P.noise = hasFuel ? 26 + Math.abs(b.speed) * 2.6 : 2;
  Snd.engine(hasFuel, Math.abs(b.speed));
}
function mount(b) {
  if (!b.usable) return;
  if (b.fuel <= 0) { UI.toast('Xe hết xăng. Cần can xăng.'); return; }
  Player.bike = b; b.rider.visible = true; b.warned = false; b.speed = 0;
  b.rider.userData.shirtMat.color.copy(playerModel.userData.shirtMat.color);
  b.rider.userData.helmet.visible = !!Player.equip.head;
  animHuman(b.rider, 0, 0, 0, true);
  Player.yaw = b.rot; Input.tCrouch = false;
  UI.toast('Nổ máy. Tiếng xe rất ồn, Thổ Trùng nghe được từ xa!', 'bad');
  emitNoise(b.x, b.z, 40, 'engine');
}
function dismount() {
  const b = Player.bike; if (!b) return;
  Player.bike = null; b.rider.visible = false; b.speed = 0; b.lean = 0; b.sync();
  const sx = b.x + Math.cos(b.rot) * 1.0, sz = b.z - Math.sin(b.rot) * 1.0;
  Player.pos.set(sx, 0, sz); collideCircle(Player.pos, 0.35, 0, 1.7, false, STEP_WALK);
  Snd.engine(false, 0);
}

// ---------------------------------------------------------------- throwing, melee, gun
const THROWN = [];
const thrownGeo = new THREE.BoxGeometry(0.12, 0.12, 0.3);
function throwItem() {
  const P = Player; if (P.bike) return;
  const id = P.has('phao') ? 'phao' : P.has('chai') ? 'chai' : null;
  if (!id) { UI.toast('Không có pháo hay chai để ném'); return; }
  P.remove(id);
  const m = new THREE.Mesh(thrownGeo, new THREE.MeshLambertMaterial({ color: id === 'phao' ? 0xc8302a : 0x5fa36a })); scene.add(m);
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const p = camera.position.clone().addScaledVector(dir, 0.5);
  THROWN.push({ id, m, p, v: dir.multiplyScalar(17).add(new THREE.Vector3(0, 3.5, 0)), t: 0, fuse: id === 'phao' ? 1.6 : 0, landed: false });
  UI.toast(id === 'phao' ? 'Ném pháo!' : 'Ném chai!');
}
function updateThrown(dt) {
  for (let i = THROWN.length - 1; i >= 0; i--) {
    const T = THROWN[i]; T.t += dt;
    if (!T.landed) {
      T.v.y -= 15 * dt; T.p.addScaledVector(T.v, dt);
      const q = { x: T.p.x, z: T.p.z }; const hit = collideCircle(q, 0.1, T.p.y - 0.1, 0.2, false);
      if (hit) { T.v.x *= -0.3; T.v.z *= -0.3; T.p.x = q.x; T.p.z = q.z; }
      if (T.p.y <= 0.06) { T.p.y = 0.06; T.landed = true; if (T.id === 'chai') { Snd.glass(dist2(T.p.x, T.p.z, Player.pos.x, Player.pos.z)); emitNoise(T.p.x, T.p.z, 30, 'lure'); FX.spark.burst(T.p.x, 0.2, T.p.z, 8, 2, 2, 0.4, 0.1); scene.remove(T.m); THROWN.splice(i, 1); continue; } }
      T.m.position.copy(T.p); T.m.rotation.x += dt * 8;
    }
    if (T.id === 'phao') {
      if (Math.random() < 0.5) FX.spark.emit(T.p.x, T.p.y + 0.1, T.p.z, R(-1, 1), R(1, 2), R(-1, 1), 0.3);
      if (T.t > 1.6) {
        Snd.firecracker(dist2(T.p.x, T.p.z, Player.pos.x, Player.pos.z)); emitNoise(T.p.x, T.p.z, 75, 'lure');
        FX.spark.burst(T.p.x, 0.4, T.p.z, 40, 6, 6, 0.6, 0.3); FX.smoke.burst(T.p.x, 0.5, T.p.z, 8, 1, 1, 3, 0.5);
        for (const M of MONSTERS) if (M.stun && dist2(M.x, M.z, T.p.x, T.p.z) < 9) M.stun(2.5);
        scene.remove(T.m); THROWN.splice(i, 1);
      }
    }
  }
}
function curWeapon() { const P = Player; if (!P.weapon || !P.has(P.weapon)) P.weapon = P.inv.find(i => ITEMS[i].weapon) || null; return P.weapon; }
// damage to people, by weapon (fists when empty-handed)
const MELEE_DMG = { none: 9, canhcay: 16, banphim: 12, chao: 28, ongtuyp: 30, gaysat: 28, xabeng: 36 };
function npcInFront(range = 2.2) {
  const P = Player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null, bd = 1e9;
  for (const n of NPCS) { if (n.dead || n.kind === 'family' || (n.flee > 0 && n.fleeFar)) continue; const dx = n.x - P.pos.x, dz = n.z - P.pos.z, d = Math.hypot(dx, dz); if (d > range || Math.abs(n.y - P.pos.y) > 1.5) continue; if ((dx * fx + dz * fz) / (d || 1) < 0.5) continue; if (d < bd) { bd = d; best = n; } }
  return best;
}
function attack() {
  const P = Player; if (P.bike || P.swingCd > 0) return;
  const w = curWeapon();
  if (w && ITEMS[w].gun) { shoot(); return; }
  if (P.armHurt() && P.painkiller <= 0) { UI.toast('Tay bị gãy, không vung nổi. Cần nẹp hoặc thuốc giảm đau.'); return; }
  P.swingCd = w ? 0.9 : 0.6; P.swingT = 0.35; P.stam = Math.max(0, P.stam - (w ? 12 : 6) * DIFF.stam);
  emitNoise(P.pos.x, P.pos.z, 10, 'hit');
  const npc = npcInFront();
  if (npc) { npc.hurt(MELEE_DMG[w || 'none'], w); Snd.hit(); Shake.add(0.2); if (w) { P.weaponUses[w] = (P.weaponUses[w] || 0) + 0.34; if (P.weaponUses[w] >= ITEMS[w].weapon) { P.remove(w); P.weaponUses[w] = 0; UI.toast(`${ITEMS[w].n} đã gãy!`, 'bad'); } } return; }
  if (!w) { if (!Game.punchTip || Game.time - Game.punchTip > 20) { Game.punchTip = Game.time; UI.toast('Tay không chẳng làm gì được quái vật. Tìm cành cây, chảo, ống tuýp, gậy sắt…'); } Snd.burst({ dur: 0.12, freq: 500, type: 'bandpass', gain: 0.06 }); return; }
  let hitAny = false;
  for (const M of MONSTERS) if (M.meleeHit && M.meleeHit(P.pos.x, P.pos.z, P.yaw, ITEMS[w].stun || 3)) hitAny = true;
  if (hitAny) {
    Snd.hit(); Shake.add(0.3);
    P.weaponUses[w] = (P.weaponUses[w] || 0) + 1;
    if (P.weaponUses[w] >= ITEMS[w].weapon) { P.remove(w); P.weaponUses[w] = 0; UI.toast(`${ITEMS[w].n} đã gãy!`, 'bad'); }
  } else Snd.burst({ dur: 0.15, freq: 500, type: 'bandpass', gain: 0.08 });
}
function reloadGun() {
  const P = Player;
  if (!P.has('sungtruong')) { UI.toast('Bạn chưa có súng.'); return; }
  if (P.reloadT > 0) return;
  if (P.mag >= 10) { UI.toast('Băng đạn đang đầy.'); return; }
  if (!P.has('bangdan')) { UI.toast('Hết băng đạn. Lục thùng đạn ở trạm quân sự hoặc trên người lính.', 'bad'); return; }
  P.remove('bangdan'); P.reloadT = 1.6; P.reloadTo = 10; Snd.reload();
}
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
function shoot() {
  const P = Player;
  if (P.reloadT > 0) return;
  if (P.mag <= 0) { Snd.empty(); P.swingCd = 0.3; if (P.has('bangdan')) reloadGun(); else UI.toast('Hết đạn!', 'bad'); return; }
  P.mag--; P.swingCd = 0.28; P.recoil = 1;
  camera.getWorldPosition(_ro); camera.getWorldDirection(_rd);
  _rd.x += R(-0.012, 0.012); _rd.y += R(-0.012, 0.012); _rd.normalize();
  const wallT = rayWorld(_ro, _rd, 160);
  let best = null, bt = wallT;
  for (const M of MONSTERS) if (M.shotTest) { const t = M.shotTest(_ro, _rd); if (t > 0 && t < bt) { bt = t; best = M; } }
  for (const n of NPCS) { if (n.dead || n.kind === 'family') continue; const t = raySphere(_ro, _rd, new THREE.Vector3(n.x, n.y + 1.1, n.z), 0.45); if (t > 0 && t < bt) { bt = t; best = { shot: () => n.hurt(60, 'sungtruong') }; } }
  const hp = _ro.clone().addScaledVector(_rd, bt);
  Snd.gun(0); Shake.add(0.18); emitNoise(P.pos.x, P.pos.z, 95, 'gun');
  MUZZLE.visible = true; MUZZLE.userData.t = 0.05;
  FX.spark.burst(hp.x, hp.y, hp.z, best ? 14 : 6, 3, 3, 0.35, 0.1); if (!best) FX.dustS.burst(hp.x, hp.y, hp.z, 6, 1.5, 1.5, 0.6, 0.1);
  TRACER.geometry.attributes.position.setXYZ(0, _ro.x + _rd.x * 0.8, _ro.y + _rd.y * 0.8 - 0.1, _ro.z + _rd.z * 0.8); TRACER.geometry.attributes.position.setXYZ(1, hp.x, hp.y, hp.z); TRACER.geometry.attributes.position.needsUpdate = true; TRACER.visible = true; TRACER.userData.t = 0.04;
  if (best) best.shot(hp);
}
const TRACER = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.8 })); TRACER.visible = false; TRACER.frustumCulled = false; scene.add(TRACER);

// first-person view models, one per weapon
const viewModel = new THREE.Group(); camera.add(viewModel); scene.add(camera);
const VM = {};
let MUZZLE;
{
  const L = c => new THREE.MeshLambertMaterial({ color: c });
  const geoOf = (k, a, b, c) => k === 'c' ? new THREE.CylinderGeometry(a, b, c, 10) : new THREE.BoxGeometry(a, b, c);
  // parts: [kind 'b'|'c', a, b, c, color, x, y, z, rx, ry, rz]
  const mk = (id, parts) => {
    const g = new THREE.Group();
    for (const [k, a, b, c, col, x, y, z, rx = 0, ry = 0, rz = 0] of parts) { const m = new THREE.Mesh(geoOf(k, a, b, c), L(col)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); }
    const hand = new THREE.Group(); const palm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.12), L(0xd9a77e)); hand.add(palm);
    for (let f = 0; f < 4; f++) { const fi = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.06), L(0xcf9c72)); fi.position.set(-0.035 + f * 0.023, 0.03, -0.075); hand.add(fi); }
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.3), L(0xe8e6df)); sleeve.position.set(0.02, -0.03, 0.2); hand.add(sleeve);
    hand.position.set(0, -0.02, 0.05); g.add(hand);
    g.visible = false; viewModel.add(g); VM[id] = g;
  };
  const X = Math.PI / 2;
  mk('gaysat', [['c', 0.022, 0.022, 0.85, 0x5a5d61, 0, 0.01, -0.32, X], ['c', 0.03, 0.03, 0.16, 0x2a2a2a, 0, 0.01, 0.0, X]]);
  mk('xabeng', [['c', 0.02, 0.02, 0.85, 0x34466a, 0, 0, -0.34, X], ['b', 0.04, 0.15, 0.03, 0x34466a, 0, 0.06, -0.76, -0.5], ['b', 0.05, 0.02, 0.05, 0x2a3550, 0, 0.13, -0.8]]);
  mk('ongtuyp', [['c', 0.035, 0.035, 0.95, 0x8b8f94, 0, 0, -0.38, X], ['c', 0.045, 0.045, 0.07, 0x6f7378, 0, 0, -0.84, X], ['c', 0.045, 0.045, 0.07, 0x6f7378, 0, 0, -0.4, X]]);
  mk('canhcay', [['c', 0.035, 0.045, 0.9, 0x5b4634, 0, 0, -0.35, X], ['c', 0.015, 0.02, 0.32, 0x5b4634, 0.07, 0.06, -0.55, X - 0.5, 0, 0.6], ['b', 0.16, 0.12, 0.16, 0x4e6b3a, 0.11, 0.12, -0.68, 0.4, 0.3], ['b', 0.12, 0.1, 0.12, 0x5b7a40, -0.04, 0.05, -0.82, 0.2, 0.7]]);
  mk('banphim', [['b', 0.46, 0.028, 0.16, 0x1e1f22, 0, 0.02, -0.25], ...Array.from({ length: 5 }, (_, r) => ['b', 0.43, 0.014, 0.022, r === 4 ? 0x55585e : 0x3a3c40, 0, 0.04, -0.31 + r * 0.028]), ['b', 0.04, 0.012, 0.02, 0x3a8a5a, 0.17, 0.042, -0.33]]);
  mk('chao', [['b', 0.035, 0.03, 0.34, 0x3b2a1e, 0, 0, -0.12], ['c', 0.18, 0.16, 0.05, 0x2a2a2a, 0, 0.01, -0.46], ['c', 0.15, 0.15, 0.052, 0x3a3a3a, 0, 0.012, -0.46]]);
  mk('sungtruong', [
    ['b', 0.055, 0.085, 0.42, 0x2b2e26, 0, 0, -0.22],             // receiver
    ['b', 0.06, 0.07, 0.3, 0x3a3020, 0, -0.005, -0.55],            // handguard
    ['c', 0.014, 0.014, 0.42, 0x1c1d1a, 0, 0.02, -0.86, X],        // barrel
    ['c', 0.02, 0.02, 0.06, 0x1c1d1a, 0, 0.02, -1.06, X],          // muzzle
    ['b', 0.045, 0.075, 0.26, 0x4a3a28, 0, -0.02, 0.12],           // stock
    ['b', 0.04, 0.15, 0.05, 0x1c1d1a, 0, -0.11, -0.28, 0.25],      // magazine
    ['b', 0.035, 0.09, 0.04, 0x1c1d1a, 0, -0.07, -0.08, -0.3],     // grip
    ['b', 0.012, 0.04, 0.012, 0x1c1d1a, 0, 0.065, -0.95],          // front sight
    ['b', 0.03, 0.03, 0.06, 0x1c1d1a, 0, 0.06, -0.1],              // rear sight
  ]);
  MUZZLE = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, map: PTEX }));
  MUZZLE.position.set(0, 0.02, -1.12); MUZZLE.visible = false; VM.sungtruong.add(MUZZLE);
  mk('none', []);
  viewModel.position.set(0.32, -0.28, -0.45); viewModel.rotation.set(0.5, 0.1, 0.2);
}

// ---------------------------------------------------------------- noise bus
function emitNoise(x, z, radius, kind) { for (const M of MONSTERS) M.hear && M.hear(x, z, radius, kind); }

// ---------------------------------------------------------------- god mode (like creative): unhurt, no hunger, invisible to monsters, can fly, spawn any item
const GOD = { on: false, fly: false, pass: 'thucgiac' };
function flyUpdate(dt) {
  const P = Player; let mx = 0, mz = 0, my = 0;
  if (Input.down('KeyW') || Input.down('ArrowUp')) mz += 1; if (Input.down('KeyS') || Input.down('ArrowDown')) mz -= 1;
  if (Input.down('KeyA') || Input.down('ArrowLeft')) mx -= 1; if (Input.down('KeyD') || Input.down('ArrowRight')) mx += 1;
  mx += Input.joy.x; mz += Input.joy.y;
  if (Input.down('Space')) my += 1; if (Input.down('ShiftLeft') || Input.down('ShiftRight') || Input.tCrouch) my -= 1;
  Input.pressed.delete('Space');
  const sp = Input.down('ControlLeft') ? 40 : 16;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  P.pos.x += (fx * mz + rx * mx) * sp * dt; P.pos.z += (fz * mz + rz * mx) * sp * dt; P.pos.y = Math.max(groundAt(P.pos.x, P.pos.z, 0.35, P.pos.y, 0.65), P.pos.y + my * sp * 0.7 * dt);
  P.pos.x = clamp(P.pos.x, -330, 330); P.pos.z = clamp(P.pos.z, -180, 180); P.pos.y = Math.min(P.pos.y, 160);
  P.vy = 0; P.onGround = false; P.speedNow = 0; P.noise = 0; P.height = 1.7; P.crouch = 0; P.sprinting = false;
}
function setGod(on) {
  GOD.on = on; if (!on) GOD.fly = false;
  const P = Player; if (on) { P.hp = 100; P.food = 100; P.water = 100; P.stam = 100; P.injuries = []; P.pendingInfect = null; for (const M of MONSTERS) { M.aw = 0; if (M.state === 'hunt') M.state = M.kind === 'titan' ? 'wander' : M.kind === 'stalker' ? 'patrol' : M.kind === 'flyer' ? 'patrol' : M.state; } }
  $('#god-badge').hidden = !on; $('#btn-god').textContent = 'Chế độ thần: ' + (on ? 'Bật' : 'Tắt');
  UI.toast(on ? 'Chế độ thần: bất tử, không đói khát, quái không thấy bạn. [G] bay (Space lên, Shift xuống, Ctrl bay nhanh). Túi đồ có kho đồ đầy đủ. Nhấp đúp bản đồ lớn để dịch chuyển.' : 'Đã tắt chế độ thần.', on ? 'good' : '');
}
