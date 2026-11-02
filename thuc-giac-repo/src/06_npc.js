// ---------------------------------------------------------------- people still in the city
const NPCS = [];
const SURVIVORS = [
  { who: 'Bà cụ', line: 'Cháu ơi… cho bà xin ngụm nước. Bà ngồi đây từ trưa, không đi nổi nữa.', need: 'drink', items: ['bang', 'banhchung'], money: 120000, tip: 'Lũ dưới đất mù đấy cháu ạ. Chúng chỉ nghe tiếng thôi. Đừng nổ máy xe, đừng chạy rầm rầm.', old: true },
  { who: 'Người đàn ông bị thương', line: 'Chân tôi… gãy rồi. Anh chị có nẹp hay băng gì không? Tôi xin.', need: 'med', items: ['xabeng', 'nuocsuoi'], money: 200000, tip: 'Con mắt vàng chỉ đi đường lớn. Nó không chui vào nhà được. Đi xuyên qua nhà, ra cửa sau ấy.' },
  { who: 'Hai mẹ con', line: 'Con bé nhà tôi đói từ chiều. Anh chị còn gì ăn không… sữa cũng được.', need: 'food', items: ['giamdau', 'phao', 'phao'], money: 90000, tip: 'Phía đông có vết nứt to lắm. Chỉ có mấy tấm ván bắc qua, xe máy không qua được đâu.' },
  { who: 'Cậu sinh viên', line: 'Em trốn ở đây từ lúc nó đứng dậy. Anh chị đi về hướng nào? Em… em có mấy thứ này, chẳng dùng làm gì.', need: null, items: ['tangluc', 'chai', 'luongkho'], money: 50000, tip: 'Con trên hồ nhìn từ trên cao xuống. Nấp dưới mái hiên, trong nhà là nó không thấy.' },
  { who: 'Ông chú xe ôm', line: 'Xe tôi hết xăng rồi. Có ai cho tôi xin ít nước không, khát quá.', need: 'drink', items: ['canxang', 'mubaohiem'], money: 150000, tip: 'Đốt pháo ném ra xa là cả lũ kéo nhau tới chỗ đó. Tôi thấy rồi.' },
  { who: 'Chị nhân viên văn phòng', line: 'Anh chị có băng gạc không? Tay em chảy máu mãi không cầm được.', need: 'med', items: ['aokhoac', 'nuocsuoi'], money: 300000, tip: 'Lính lập trạm ở mấy ngã tư. Họ ngã hết rồi, nhưng súng đạn vẫn còn đấy.' },
];
const OWNER_LINES = {
  pharmacy: 'Thuốc còn ít lắm. Tôi bán đúng giá, thời này ai cũng khổ.', grocery: 'Muốn mua gì thì nhanh lên, tôi sắp đóng cửa trốn rồi.', food: 'Đồ ăn còn đây, lấy gì thì trả tiền.',
  cafe: 'Còn mấy chai nước. Trả tiền là được.', hardware: 'Mấy thứ này không giết được bọn chúng đâu… nhưng có còn hơn không.', bike: 'Xăng còn ít, mũ thì còn. Mua gì?',
  clothes: 'Áo tối màu à? Còn đấy. Mặc vào mà trốn.', shoes: 'Giày chạy tốt nhất còn đây.', bags: 'Balo to thì mang được nhiều.', workwear: 'Đồ bảo hộ đủ cả.',
};
const CIV_SHIRTS = [0x8a3b3b, 0x3b5a8a, 0x6a6a3b, 0xd9d0c0, 0x4a6a4a, 0xb57a3a, 0xe8e2d4, 0x2f2f35, 0xc2447a, 0x4f7fd9];
class NPC {
  constructor(B, kind, spot, data = {}) {
    this.B = B; this.kind = kind; this.data = data; this.dead = false; this.flee = 0;
    this.model = makeHuman({ shirt: pick(CIV_SHIRTS), pants: pick([0x2b2f3a, 0x3a2f2b, 0x222]), skin: pick([0xd9a77e, 0xc99268, 0xe0b48e]), hair: data.old ? 0xbdbdbd : 0x1c1814, scale: data.child ? 0.62 : 1 });
    this.x = spot[0]; this.z = spot[1];
    this.model.position.set(this.x, 0, this.z);
    const f = B ? B.front : { x: this.x, z: this.z - 1 }; this.heading = Math.atan2(f.x - this.x, f.z - this.z); this.model.rotation.y = this.heading + Math.PI;
    this.y = 0; this.hp = 100; this.maxHp = 100; this.fight = false; this.atkCd = 0; this.hitFlash = 0; this.attacked = false;
    this.sit = kind === 'survivor' && chance(0.6);
    animHuman(this.model, 0, 0, 0, this.sit);
    scene.add(this.model);
    this.items = data.items ? data.items.slice() : []; this.money = data.money || 0; this.helped = false;
    this.it = addInteract({ x: this.x, y: 1, z: this.z, r: 2.6, kind: 'npc', ref: this, box: [this.x - 0.4, 0, this.z - 0.4, this.x + 0.4, data.child ? 1.15 : 1.85, this.z + 0.4] });
    NPCS.push(this);
  }
  kill() { this.dead = true; this.model.visible = false; this.it.dead = true; if (this.kind === 'owner' && this.B) this.B.owner = null; }
  // the player hits this person: they fight back or run; killing them weighs heavily
  hurt(dmg, weapon) {
    if (this.dead || this.kind === 'family') return;
    const P = Player;
    if (!this.attacked) { this.attacked = true; P.cruelty = Math.min(100, P.cruelty + 6); UI.toast(`Bạn tấn công ${this.kind === 'owner' ? 'chủ tiệm' : this.data.who.toLowerCase()}. (+6 tàn nhẫn)`, 'bad'); emitNoise(this.x, this.z, 25, 'scream'); }
    this.hp -= dmg; this.hitFlash = 0.25; FX.dustS.burst(this.x, 1.2, this.z, 4, 1, 1, 0.4, 0.1);
    this.model.userData.torso.rotation.x = -0.3;
    if (this.hp <= 0) { this.die(); return; }
    this.it.dead = true; if (this.kind === 'owner' && this.B) this.B.owner = null;
    if (!this.fight && this.flee <= 0) {
      const tough = this.kind === 'owner' ? 0.55 : this.data.old || this.data.child ? 0 : 0.2;
      if (Math.random() < tough && this.hp > 40) { this.fight = true; UI.toast(this.kind === 'owner' ? 'Chủ tiệm vớ lấy cây gậy và lao vào bạn!' : 'Họ chống trả!', 'bad'); }
      else { this.runAway(); UI.toast(this.kind === 'owner' ? 'Chủ tiệm bỏ chạy. Đồ trong tiệm giờ không ai giữ.' : 'Họ hoảng sợ bỏ chạy, đánh rơi đồ.', 'bad'); this.dropStuff(); }
    } else if (this.fight && this.hp < 40) { this.fight = false; this.runAway(); UI.toast('Họ bị thương nặng, bỏ chạy.', 'bad'); this.dropStuff(); }
  }
  dropStuff() { if (this.items.length || this.money) { const c = addContainer(this.x, 0.3, this.z, 'Đồ đánh rơi', null, 0, null, { items: this.items.slice(), money: this.money, kind: 'ground', box: [this.x - 0.4, 0, this.z - 0.4, this.x + 0.4, 0.35, this.z + 0.4] }); this.items = []; this.money = 0; const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x6a5a40 })); m.position.set(this.x, 0.1, this.z); scene.add(m); } }
  die() {
    const P = Player; this.dead = true; this.fight = false; this.model.visible = false; this.it.dead = true;
    if (this.kind === 'owner' && this.B) this.B.owner = null;
    P.cruelty = Math.min(100, P.cruelty + 30); P.robbed++; P.killed = (P.killed || 0) + 1;
    UI.toast('Người đó gục xuống và không cử động nữa. (+30 tàn nhẫn)', 'bad');
    const b = new Body(this.x, this.z, this.heading, 'civ', { unc: false }); b.c.items.push(...this.items); b.c.money += this.money; b.c.label = 'Người bạn đã đánh gục';
  }
  updateFight(dt) {
    const P = Player; const dx = P.pos.x - this.x, dz = P.pos.z - this.z, d = Math.hypot(dx, dz);
    this.heading = Math.atan2(dx, dz); this.model.rotation.y = this.heading + Math.PI;
    if (d > 16) { this.fight = false; this.it.dead = false; return; }
    if (d > 1.3) { const p = { x: this.x + dx / d * 3.4 * dt, z: this.z + dz / d * 3.4 * dt }; collideCircle(p, 0.3, 0, 1.7, false, STEP_WALK); this.x = p.x; this.z = p.z; animHuman(this.model, 3.4, dt, 0, false); }
    this.model.position.set(this.x, 0, this.z);
    this.atkCd -= dt;
    if (d < 1.6 && this.atkCd <= 0) { this.atkCd = 1.2; this.model.userData.ra.rotation.x = -2.2; Snd.hit(); P.damage(R(7, 13), 'blunt', this.x, this.z); }
    else if (this.atkCd < 0.9) this.model.userData.ra.rotation.x = damp(this.model.userData.ra.rotation.x, 0, 8, dt);
  }
  runAway() {
    this.flee = 16; this.it.dead = true; this.sit = false;
    if (this.kind === 'owner' && this.B) this.B.owner = null;
    emitNoise(this.x, this.z, 32, 'scream'); Snd.tone({ f0: 700, f1: 500, dur: 0.6, type: 'triangle', gain: 0.12 });
  }
  update(dt) {
    if (this.dead) return;
    if (this.flee > 0) {
      this.flee -= dt;
      const tgt = this.fleeTarget || (this.fleeTarget = this.B ? [this.B.front.x + this.B.out[0] * 6, this.B.front.z + this.B.out[1] * 6] : [this.x + 10, this.z]);
      const dx = tgt[0] - this.x, dz = tgt[1] - this.z, d = Math.hypot(dx, dz);
      if (d < 1) this.fleeTarget = [this.x + R(-40, 40), this.z + R(-40, 40)];
      const p = { x: this.x + dx / (d || 1) * 5 * dt, z: this.z + dz / (d || 1) * 5 * dt }; collideCircle(p, 0.3, 0, 1.7, false, STEP_WALK); this.x = p.x; this.z = p.z;
      this.heading = Math.atan2(dx, dz); this.model.position.set(this.x, 0, this.z); this.model.rotation.y = this.heading + Math.PI; animHuman(this.model, 5, dt, 0, false);
      if (this.flee <= 0) this.kill();
      return;
    }
    if (this.hitFlash > 0) { this.hitFlash -= dt; this.model.userData.shirtMat.emissive.setRGB(this.hitFlash * 2, 0, 0); }
    if (this.fight) { this.updateFight(dt); return; }
    if (dist2(this.x, this.z, Player.pos.x, Player.pos.z) > 60) return;
    if (dist2(this.x, this.z, Player.pos.x, Player.pos.z) < 8) { const want = Math.atan2(Player.pos.x - this.x, Player.pos.z - this.z); this.heading += angleDiff(this.heading, want) * Math.min(1, dt * 3); this.model.rotation.y = this.heading + Math.PI; }
    const u = this.model.userData; u.phase += dt; if (!this.sit) u.hip.position.y = 0.92 * (this.data.child ? 0.62 : 1) + Math.sin(u.phase * 1.5) * 0.01; u.torso.rotation.x = this.sit ? 0.25 : Math.sin(u.phase * 0.7) * 0.03;
  }
}
function spawnNPCs() {
  rng = mulberry32(777);
  const shops = BUILDINGS.filter(B => B.enterable && !B.closed && !B.collapsed && OWNER_LINES[B.type] && B.npcSpots.length);
  for (const B of shops) if (chance(0.3)) B.owner = new NPC(B, 'owner', B.npcSpots[0]);
  const houses = BUILDINGS.filter(B => B.enterable && !B.collapsed && B.type === 'house' && B.npcSpots.length && B.cx > -230);
  let k = 0;
  for (const B of houses) if (chance(0.11)) { const d = SURVIVORS[k++ % SURVIVORS.length]; new NPC(B, 'survivor', B.npcSpots[0], d); }
  const H = HOME; const a = H.toWorld(H.w * 0.4, H.d * 0.55), b = H.toWorld(H.w * 0.62, H.d * 0.5);
  const p1 = new NPC(H, 'family', a, { who: 'Người thân' }); const p2 = new NPC(H, 'family', b, { who: 'Con gái', child: true });
  p1.sit = false; p2.sit = false; animHuman(p1.model, 0, 0, 0, false); animHuman(p2.model, 0, 0, 0, false);
  spawnBodies();
}

// ---------------------------------------------------------------- people lying on the street (no gore: they look asleep)
const BODIES = [];
class Body {
  constructor(x, z, ry, kind, opt = {}) {
    this.x = x; this.z = z; this.kind = kind; this.unc = !!opt.unc; this.helped = false; this.lootedUnc = false;
    const sol = kind === 'sol';
    this.model = makeHuman(sol ? { shirt: 0x4a5a32, pants: 0x3f4a2a, helmet: 0x4a5a32, shoe: 0x2a2620 } : { shirt: pick(CIV_SHIRTS), pants: pick([0x2b2f3a, 0x3a2f2b, 0x222, 0x5a4a3a]), skin: pick([0xd9a77e, 0xc99268, 0xe0b48e]), pack: chance(0.25), packColor: pick([0x2d4a3a, 0x1d4f9c, 0x333]) });
    const u = this.model.userData;
    this.model.rotation.order = 'YXZ'; this.model.rotation.set(-Math.PI / 2 + 0.04, ry, 0);
    this.model.position.set(x + Math.sin(ry) * 0.9, 0.14, z + Math.cos(ry) * 0.9);
    u.la.rotation.z = R(-0.6, -0.1); u.ra.rotation.z = R(0.1, 1.2); u.la.rotation.x = R(-0.5, 0.5); u.ll.rotation.z = R(-0.2, 0.1); u.rl.rotation.z = R(0, 0.3); u.head.rotation.y = R(-0.6, 0.6);
    this.model.updateMatrixWorld(true); scene.add(this.model);
    // dust and scattered papers around them instead of blood
    const mb = new MB();
    for (let k = 0; k < 5; k++) { const a = R(0, TAU), r = R(0.4, 1.3); mb.box(x + Math.cos(a) * r - 0.1, 0.12, z + Math.sin(a) * r - 0.07, x + Math.cos(a) * r + 0.1, 0.13, z + Math.sin(a) * r + 0.07, pick(['#efece4', '#d9d4c9', '#bdb6a8']), { ry: R(0, 3) }); }
    scene.add(new THREE.Mesh(mb.build(), MAT.vc));
    const items = sol ? rollLoot('sol_body', randi(1, 3)) : rollLoot('civ_body', randi(1, 3));
    if (opt.gun) { items.unshift('sungtruong'); items.push('bangdan'); }
    if (opt.watch && !items.includes('dongho')) items.push('dongho');
    const label = sol ? (this.unc ? 'Người lính bất tỉnh' : 'Người lính đã hy sinh') : (this.unc ? 'Người bất tỉnh' : 'Người đã mất');
    const hb = 1.1;
    this.c = addContainer(x, 0.3, z, label, null, 0, null, { items, money: sol ? 0 : randi(0, 6) * 10000, kind: 'body', box: [x - hb, 0, z - hb, x + hb, 0.45, z + hb] });
    this.c.body = this;
    if (opt.gun) { // the rifle lies next to the soldier until taken
      const gx = x + Math.cos(ry) * 0.8, gz = z - Math.sin(ry) * 0.8; const mb2 = new MB(); PICK_DRAW.sungtruong(mb2);
      this.gunMesh = new THREE.Mesh(mb2.build(), MAT.vc); this.gunMesh.position.set(gx, 0.12, gz); this.gunMesh.rotation.y = ry + 0.4; scene.add(this.gunMesh);
    }
    BODIES.push(this);
  }
  onTake(id) { if (id === 'sungtruong' && this.gunMesh && !this.c.items.includes('sungtruong')) this.gunMesh.visible = false; }
  wake() {
    this.unc = false; this.helped = true; this.c.dead = true; this.c.it.dead = true; this.model.visible = false;
    const r = new Runner(this.x, this.z, { calm: true }); r.model.userData.shirtMat.color.copy(this.model.userData.shirtMat.color);
  }
  update(dt, t) { if (this.unc && this.model.visible) { const u = this.model.userData; u.torso.scale.z = 1 + Math.sin(t * 2.2 + this.x) * 0.06; } }
}
function spawnBodies() {
  rng = mulberry32(4242);
  for (const s of BODY_SPOTS) {
    let x = s.x, z = s.z, ok = freeSpot(x, z, 1.0);
    for (let k = 0; k < 30 && !ok && s.kind === 'sol'; k++) { x = s.x + rand(-4, 4); z = s.z + rand(-4, 4); ok = freeSpot(x, z, 1.0); }
    if (ok) new Body(x, z, s.ry, s.kind, s);
  }
}

// ---------------------------------------------------------------- panicking people running through the streets
const RUNNERS = [];
class Runner {
  constructor(x, z, opt = {}) {
    this.x = x; this.z = z; this.dead = false; this.speed = opt.calm ? 2.6 : R(4.2, 5.8); this.route = []; this.stuck = 0; this.screamT = R(2, 6); this.calm = !!opt.calm; this.life = 0;
    this.model = makeHuman({ shirt: pick(CIV_SHIRTS), pants: pick([0x2b2f3a, 0x3a2f2b, 0x222]), skin: pick([0xd9a77e, 0xc99268, 0xe0b48e]), pack: chance(0.35), packColor: pick([0x2d4a3a, 0x1d4f9c, 0x8a3b3b]) });
    scene.add(this.model); this.heading = 0;
    this.pickRoute();
    RUNNERS.push(this);
  }
  pickRoute() {
    // run away from the nearest monster, along the streets
    let near = null, nd = 1e9; for (const M of MONSTERS) { if (M.kind === 'titan' && M.state === 'dormant') continue; const d = dist2(M.x, M.z, this.x, this.z); if (d < nd) { nd = d; near = M; } }
    let tx = R(-280, 280), tz = R(-140, 140);
    if (near && nd < 150) { const dx = this.x - near.x, dz = this.z - near.z, l = Math.hypot(dx, dz) || 1; tx = clamp(this.x + dx / l * 120 + R(-40, 40), -290, 290); tz = clamp(this.z + dz / l * 120 + R(-40, 40), -145, 145); }
    const a = roadProject(this.x, this.z), b = roadProject(tx, tz);
    this.route = [[a.x + R(-3, 3), a.z + R(-3, 3)], ...roadRoute(a, b).map(([x, z]) => [x + R(-3.5, 3.5), z + R(-3.5, 3.5)])];
  }
  die() {
    if (this.dead) return; this.dead = true; scene.remove(this.model);
    new Body(this.x, this.z, this.heading, 'civ', { unc: false });
  }
  remove() { this.dead = true; scene.remove(this.model); }
  update(dt) {
    if (this.dead) return;
    this.life += dt;
    if (!this.route.length) this.pickRoute();
    const [tx, tz] = this.route[0]; const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d < 1.2) { this.route.shift(); return; }
    this.heading = Math.atan2(dx, dz);
    const p = { x: this.x + dx / d * this.speed * dt, z: this.z + dz / d * this.speed * dt };
    collideCircle(p, 0.3, 0, 1.7, false, STEP_WALK);
    const moved = Math.hypot(p.x - this.x, p.z - this.z);
    if (moved < this.speed * dt * 0.3) { this.stuck += dt; if (this.stuck > 1.2) { this.stuck = 0; this.route.shift(); if (!this.route.length) this.pickRoute(); this.route.unshift([this.x + R(-6, 6), this.z + R(-6, 6)]); } } else this.stuck = 0;
    this.x = p.x; this.z = p.z;
    this.model.position.set(this.x, 0, this.z); this.model.rotation.y = this.heading + Math.PI; animHuman(this.model, this.speed, dt, 0, false);
    if (!this.calm) { this.screamT -= dt; if (this.screamT <= 0) { this.screamT = R(4, 9); emitNoise(this.x, this.z, 18, 'step'); const pd = dist2(this.x, this.z, Player.pos.x, Player.pos.z); if (pd < 45) Snd.tone({ f0: R(600, 800), f1: R(400, 520), dur: 0.5, type: 'triangle', gain: 0.08 * Snd.vol(pd, 45) }); } }
    if (dist2(this.x, this.z, Player.pos.x, Player.pos.z) > 150) this.remove();
  }
}
function updateRunners(dt) {
  for (let i = RUNNERS.length - 1; i >= 0; i--) { RUNNERS[i].update(dt); if (RUNNERS[i].dead) RUNNERS.splice(i, 1); }
  Game.runnerT = (Game.runnerT || 0) - dt;
  if (Game.runnerT <= 0 && RUNNERS.length < 9 && Game.time > 8) {
    Game.runnerT = R(2.5, 6);
    // appear on a street 45–90m away, preferably out of sight
    for (let k = 0; k < 8; k++) {
      const a = R(0, TAU), r = R(45, 90); const p = roadProject(Player.pos.x + Math.cos(a) * r, Player.pos.z + Math.sin(a) * r);
      const x = p.x + R(-3, 3), z = p.z + R(-3, 3);
      if (dist2(x, z, Player.pos.x, Player.pos.z) < 40 || !freeSpot(x, z, 0.5)) continue;
      const n = chance(0.35) ? 2 : 1; for (let j = 0; j < n; j++) new Runner(x + j * 0.8, z + j * 0.5);
      break;
    }
  }
}
function crushPeople(x, z, r) {
  for (const p of RUNNERS) if (!p.dead && dist2(p.x, p.z, x, z) < r) p.die();
  for (const n of NPCS) if (!n.dead && n.kind !== 'family' && dist2(n.x, n.z, x, z) < r) n.kill();
}
