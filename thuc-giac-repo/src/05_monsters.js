// ---------------------------------------------------------------- shared helpers
const MONSTERS = [];
const fromPlayer = (x, z) => Math.hypot(x - Player.pos.x, z - Player.pos.z) < 3;
// only loud noises reach the monsters above ground: firecrackers/bottles (lure), engines, gunshots, crashes, explosions
const LOUD = new Set(['lure', 'engine', 'gun', 'crash', 'slam', 'boom']);
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
function placeSeg(mesh, from, to) {
  _d.subVectors(to, from); const L = _d.length(); if (L < 1e-4) return;
  mesh.position.addVectors(from, to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(_up, _d.multiplyScalar(1 / L)); mesh.scale.set(1, L, 1);
}
function segMesh(rTop, rBot, mat, seg = 7) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1, seg), mat); m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; }
function ballMesh(r, mat, sx = 1, sy = 1, sz = 1, detail = 1) { const g = new THREE.IcosahedronGeometry(r, detail); g.scale(sx, sy, sz); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; }
// 2-bone IK: writes knee into out
function solveKnee(H, F, a, b, pole, out) {
  _d.subVectors(F, H); let d = _d.length(); const dir = _d.clone().normalize();
  d = Math.min(d, a + b - 0.01);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const po = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  out.copy(H).addScaledVector(dir, a * cosA).addScaledVector(po, a * sinA);
  return out;
}
function playerEye() { const P = Player; return { x: P.pos.x, y: P.pos.y + (P.bike ? 1.35 : P.height * 0.85), z: P.pos.z }; }
// how visible the player is from an eye: 0..~1.5
function seePlayer(ex, ey, ez, heading, fov, range) {
  const P = Player; const e = playerEye();
  if (P.pos.y < -1 || GOD.on) return 0; // in the underpass nobody can see you
  const dx = e.x - ex, dz = e.z - ez, d3 = Math.hypot(dx, dz, e.y - ey);
  if (d3 > range) return 0;
  if (fov < TAU && Math.hypot(dx, dz) > 6) { const ang = Math.atan2(dx, dz); if (Math.abs(angleDiff(heading, ang)) > fov / 2) return 0; }
  if (!lineOfSight(ex, ey, ez, e.x, e.y, e.z)) return 0;
  let v = 0.3 + 0.7 * (1 - d3 / range);
  v *= P.bike ? 1.5 : lerp(1, 0.4, P.crouch) * (P.sprinting ? 1.3 : 1);
  v *= 1 - P.stat('stealth');
  if (P.indoors) v *= 0.55;
  return Math.max(0, v);
}
function crushAt(x, z, rKill, rHurt, dmg, kind = 'crush') {
  const d = dist2(x, z, Player.pos.x, Player.pos.z);
  if (Player.pos.y > 6 || Player.pos.y < -1) return;
  if (d < rKill) Player.damage(dmg, kind, x, z);
  else if (d < rHurt) Player.damage(dmg * 0.3 * (1 - (d - rKill) / (rHurt - rKill)) + 6, 'blunt', x, z);
  if (Player.bike && d < rHurt) dismount(true);
}

// ---------------------------------------------------------------- building collapse
const COLLAPSING = [];
function collapseBuilding(B, quiet, instant) {
  if (!B || B.collapsed || B.home || B.office || B.quest) return; B.collapsed = true;
  for (const p of B.picks) killPickup(p);
  if (typeof MAPDIRTY !== 'undefined') MAPDIRTY.v = true;
  if (NAV.walk) setTimeout(() => navBuild([B.x0 - 4, B.z0 - 4, B.x1 + 4, B.z1 + 4]), 0);
  for (const c of B.cols) c.dead = true;
  if (B.shutterIt) B.shutterIt.dead = true;
  for (const c of B.conts) { c.dead = true; c.it.dead = true; }
  for (const n of NPCS) if (n.B === B) n.kill();
  if (instant) B.group.visible = false; else { B.group.traverse(o => { o.matrixAutoUpdate = true; }); COLLAPSING.push({ B, t: 0, ax: R(-1, 1), az: R(-1, 1) }); }
  const d = dist2(Player.pos.x, Player.pos.z, B.cx, B.cz);
  if (!quiet) { Snd.crash(d); Shake.add(clamp(1 - d / 140, 0, 1) * 0.9); }
  if (!instant) for (let k = 0; k < 26; k++) FX.dust.emit(R(B.x0, B.x1), R(0, B.h * 0.7), R(B.z0, B.z1), R(-4, 4), R(0, 3), R(-4, 4), R(3, 6), 0.6);
  // rubble
  const mb = new MB(), cols = ['#8c857a', '#a49c8f', '#6e675e', '#7d7468'];
  const W = B.toWorld;
  const mh = Math.min(2.2, 1.0 + B.h * 0.08);
  const rr = B.rect(0.2, B.w - 0.2, 0.2, B.d - 0.2); mb.box(rr[0], 0, rr[1], rr[2], mh, rr[3], '#8a8276', { pat: 3 }); addCol(rr[0], rr[1], rr[2], rr[3], 0, mh);
  const fr = B.rect(0.4, B.w - 0.4, -1.6, 0.2); mb.box(fr[0], 0, fr[1], fr[2], 0.9, fr[3], '#8a8276', { pat: 3 }); addCol(fr[0], fr[1], fr[2], fr[3], 0, 0.9);
  for (let k = 0; k < 22; k++) { const p = W(R(0.8, B.w - 0.8), R(-1.2, B.d - 0.8)); const s2 = R(0.7, 2.0); rubble(mb, p[0], p[1], s2, R(0.5, Math.min(3.2, B.h * 0.3)), s2 * 0.6, pick(cols), R(0, 3), p[1] === p[1] && R(0, 1) < 0.5 ? mh * 0.7 : 0); }
  for (let k = 0; k < 6; k++) { const p = W(R(0.5, B.w - 0.5), R(0.5, B.d - 0.5)); mb.box(p[0] - 0.08, mh, p[1] - 0.08, p[0] + 0.08, mh + R(1.5, 3.5), p[1] + 0.08, '#5a4a3a', { ry: R(0, 3) }); }
  const rm = meshFrom(mb); scene.add(rm);
  // player caught?
  const P = Player;
  if (!P.bike && P.pos.x > B.x0 - 0.3 && P.pos.x < B.x1 + 0.3 && P.pos.z > B.z0 - 0.3 && P.pos.z < B.z1 + 0.3) {
    UI.toast('Tòa nhà đổ sập ngay trên đầu bạn!', 'bad');
    const f = W(B.doorU ?? B.w / 2, -3.2); P.pos.set(f[0], 1.0, f[1]);
    P.damage(48, 'crush', B.cx, B.cz);
  }
}
function updateCollapses(dt) {
  for (let i = COLLAPSING.length - 1; i >= 0; i--) {
    const C = COLLAPSING[i]; C.t += dt / 2.0; const e = smooth(Math.min(1, C.t));
    C.B.group.position.y = -e * C.B.h * 0.95; C.B.group.rotation.x = C.ax * 0.18 * e; C.B.group.rotation.z = C.az * 0.18 * e;
    if (Math.random() < 0.6) FX.dust.emit(R(C.B.x0, C.B.x1), R(0, 3), R(C.B.z0, C.B.z1), R(-3, 3), R(1, 4), R(-3, 3), R(3, 5), 0.5);
    if (C.t >= 1) { C.B.group.visible = false; COLLAPSING.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- legged gait (shared by Titan & Stalker)
class Gait {
  constructor(o) {
    Object.assign(this, o); // hips[], rests[], a, b, stride, dur, lift, rA, rB, mat, onLand
    this.legs = this.hips.map((h, i) => ({ hip: new THREE.Vector3(), foot: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), knee: new THREE.Vector3(), t: 1, step: false, group: o.groups ? o.groups[i] : (i === 0 || i === 3) ? 0 : 1, up: segMesh(o.rB, o.rA, o.mat), lo: segMesh(o.rFoot || o.rB * 0.7, o.rB, o.mat), kn: (() => { const m = ballMesh(o.rB * 1.15, o.mat); m.frustumCulled = false; scene.add(m); return m; })(), shadow: null }));
    this.inited = false;
  }
  place(root) { for (let i = 0; i < this.legs.length; i++) { const L = this.legs[i]; L.foot.copy(this.rests[i]).applyMatrix4(root); L.foot.y = 0; L.t = 1; L.step = false; } this.inited = true; }
  update(dt, root, vel, bodyCenter) {
    if (!this.inited) this.place(root);
    const stepping = [0, 0]; for (const L of this.legs) if (L.step) stepping[L.group]++;
    for (let i = 0; i < this.legs.length; i++) {
      const L = this.legs[i];
      L.hip.copy(this.hips[i]).applyMatrix4(root);
      const want = _a.copy(this.rests[i]).applyMatrix4(root); want.y = 0; want.addScaledVector(vel, this.lead || 1.0);
      if (L.ovr) { L.foot.copy(L.ovr); L.step = false; }
      else if (!L.step) {
        const far = Math.hypot(want.x - L.foot.x, want.z - L.foot.z);
        if (far > this.stride && stepping[1 - L.group] === 0) { L.step = true; L.t = 0; L.from.copy(L.foot); L.to.copy(want).addScaledVector(vel, this.dur * 0.6); L.to.y = 0; stepping[L.group]++; if (this.onLift) this.onLift(L); }
      }
      if (L.step && !L.ovr) {
        L.t = Math.min(1, L.t + dt / this.dur); const e = smooth(L.t);
        L.foot.lerpVectors(L.from, L.to, e); L.foot.y = Math.sin(L.t * Math.PI) * this.lift;
        if (L.t >= 1) { L.step = false; L.foot.y = 0; this.onLand && this.onLand(L.foot, L); }
      }
      const pole = _b.set(L.hip.x - bodyCenter.x, 0, L.hip.z - bodyCenter.z).normalize(); pole.y = this.poleUp ?? 1.2;
      solveKnee(L.hip, L.foot, this.a, this.b, pole, L.knee);
      placeSeg(L.up, L.hip, L.knee); placeSeg(L.lo, L.knee, L.foot); L.kn.position.copy(L.knee);
    }
  }
  setVisible(v) { for (const L of this.legs) { L.up.visible = L.lo.visible = L.kn.visible = v; } }
}

// ---------------------------------------------------------------- Thủy Quái (lake titan)
class Titan {
  constructor() {
    this.name = 'Thủy Quái'; this.kind = 'titan';
    this.x = LAKE.x; this.z = LAKE.z; this.heading = -Math.PI / 2; this.bodyY = -48; this.state = 'dormant'; this.t = 0;
    this.aw = 0; this.lastSeen = 99; this.lkp = new THREE.Vector2(); this.vel = new THREE.Vector3(); this.wp = null; this.atk = null; this.cd = 4; this.seeT = 0; this.seen = false;
    const mat = addDetail(new THREE.MeshLambertMaterial({ color: 0xbdbcb1, flatShading: true }));
    const dark = addDetail(new THREE.MeshLambertMaterial({ color: 0x8d8c83, flatShading: true }));
    this.root = new THREE.Group(); scene.add(this.root);
    const body = ballMesh(1, mat, 9, 6.5, 15); this.root.add(body);
    const hump = ballMesh(1, mat, 7, 5, 9); hump.position.set(0, 3, -2); this.root.add(hump);
    for (let k = 0; k < 46; k++) { const L = R(3, 9); const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, L, 0.25), dark); s.position.set(R(-6, 6), -5 - L / 2 + 1, R(-6, 12)); s.rotation.set(R(-0.15, 0.15), 0, R(-0.15, 0.15)); s.castShadow = true; this.root.add(s); }
    for (let k = 0; k < 9; k++) { const s = ballMesh(1, dark, 1.2, 2.2, 1.2, 0); s.position.set(0, 6, -10 + k * 2.6); this.root.add(s); }
    // neck + head (droops forward and down like an elephant-heron)
    const neckPts = [new THREE.Vector3(0, 1, 12), new THREE.Vector3(0, -1, 16.5), new THREE.Vector3(0, -5, 19.5), new THREE.Vector3(0, -9.5, 21)];
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(2.2 - k * 0.4, 2.8 - k * 0.4, 1, 8), mat); placeSeg(m, neckPts[k], neckPts[k + 1]); m.castShadow = true; this.root.add(m); }
    const head = ballMesh(1, mat, 2.6, 2.3, 5.2); head.position.set(0, -11, 22.5); head.rotation.x = 1.0; this.root.add(head);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1612 });
    for (const sx of [-1, 1]) { const e = ballMesh(0.45, eyeM); e.position.set(sx * 2.2, -10.2, 22.2); this.root.add(e); }
    this.mouthLocal = new THREE.Vector3(0, -14.5, 24.5);
    this.headLocal = new THREE.Vector3(0, -10, 22);
    // tentacles
    this.tent = [0, 1].map(s => ({ segs: Array.from({ length: 18 }, (_, k) => segMesh(0.28 - k * 0.012, 0.32 - k * 0.012, mat, 5)), side: s ? 1 : -1, tip: new THREE.Vector3(), ph: R(0, 6) }));
    this.gait = new Gait({
      hips: [new THREE.Vector3(-6, -2, 9), new THREE.Vector3(6, -2, 9), new THREE.Vector3(-6, -2, -9), new THREE.Vector3(6, -2, -9)],
      rests: [new THREE.Vector3(-13, 0, 15), new THREE.Vector3(13, 0, 15), new THREE.Vector3(-13, 0, -14), new THREE.Vector3(13, 0, -14)],
      a: 25, b: 25, stride: 11, dur: 1.7, lift: 8, rA: 2.9, rB: 2.1, rFoot: 1.5, mat, lead: 1.2, poleUp: 0.25,
      onLand: (p, L) => { this.footfall(p); if (L.decal) L.decal.visible = false; },
      onLift: (L) => { if (this.state === 'emerge' || this.state === 'preview') return; if (!L.decal) L.decal = makeDecal(0x000000, 0.35); L.decal.position.set(L.to.x, 0.09, L.to.z); L.decal.scale.setScalar(3.6); L.decal.visible = true; },
    });
    this.root.position.set(this.x, this.bodyY, this.z); this.root.rotation.y = this.heading; this.root.updateMatrixWorld();
    for (const L of this.gait.legs) { L.up.visible = L.lo.visible = L.kn.visible = false; }
    for (const T of this.tent) for (const s of T.segs) s.visible = false;
    this.ring = makeDecal(0xcf4a3b, 0.6, true); this.shadowD = makeDecal(0x000000, 0.25);
  }
  head() { return this.headLocal.clone().applyMatrix4(this.root.matrixWorld); }
  footfall(p) {
    if (this.state === 'emerge') { FX.water.burst(p.x, 0.5, p.z, 30, 6, 10, 1.6, 2); return; }
    const d = dist2(p.x, p.z, Player.pos.x, Player.pos.z);
    Snd.boom(d, 1.1); Shake.add(clamp(1 - d / 90, 0, 1) * 0.55);
    FX.dust.burst(p.x, 0.5, p.z, 14, 7, 2, 2.5, 3);
    const B = buildingAt(p.x, p.z); if (B && !B.home && Math.random() < 0.8) collapseBuilding(B);
    crushAt(p.x, p.z, 3.4, 9, 140); crushPeople(p.x, p.z, 4);
  }
  hear(x, z, r, kind) {
    if (this.state === 'dormant' || this.state === 'emerge' || this.state === 'rage' || !LOUD.has(kind)) return;
    const d = dist2(x, z, this.x, this.z); const eff = r * (kind === 'lure' ? 1.4 : 0.6);
    if (d < eff) { if (fromPlayer(x, z)) this.sense = 'hear'; if (kind === 'lure' || this.state === 'wander') { this.wp = new THREE.Vector2(x, z); if (this.state !== 'hunt') { this.state = 'investigate'; this.invT = 20; } } this.aw = Math.min(0.95, this.aw + (kind === 'lure' ? 0.0 : 0.05)); }
  }
  pickWaypoint() {
    const P = Player.pos;
    if (Math.random() < 0.65) return new THREE.Vector2(clamp(P.x + R(-110, 110), -280, 280), clamp(P.z + R(-90, 90), -140, 140));
    return new THREE.Vector2(R(-270, 270), R(-135, 135));
  }
  update(dt) {
    this.t += dt;
    if (this.state === 'dormant') { if (Game.time > 5) { this.state = 'emerge'; this.t = 0; Snd.roar(dist2(this.x, this.z, Player.pos.x, Player.pos.z), 0.8, 4); UI.toast('Mặt hồ nổi sóng dữ dội…', 'bad'); for (const L of this.gait.legs) L.up.visible = L.lo.visible = L.kn.visible = true; for (const T of this.tent) for (const s of T.segs) s.visible = true; } else return; }
    let speed = 0;
    if (this.state === 'emerge') {
      const k = Math.min(1, this.t / 13); this.bodyY = lerp(-48, 40, smooth(k));
      for (let i = 0; i < 8; i++) FX.water.emit(this.x + R(-14, 14), 0.3, this.z + R(-16, 16), R(-3, 3), R(6, 16), R(-3, 3), R(1, 2.2));
      if (Math.random() < 0.3) FX.smoke.emit(this.x + R(-10, 10), 2, this.z + R(-10, 10), 0, 2, 0, 4);
      Shake.t = Math.max(Shake.t, 0.25 * (1 - k));
      if (k >= 1) { this.state = 'wander'; this.wp = new THREE.Vector2(-150, -120); Snd.roar(dist2(this.x, this.z, Player.pos.x, Player.pos.z), 0.75, 4.5); UI.toast('Nó đứng dậy rồi. Đừng để nó nhìn thấy bạn.', 'bad'); }
    } else {
      // perception
      this.seeT -= dt;
      if (this.seeT <= 0) {
        this.seeT = 0.25; const h = this.head();
        const v = seePlayer(h.x, h.y, h.z, this.heading, 2.3, 125);
        this.seenV = v; if (v > 0) { this.seen = true; this.lkp.set(Player.pos.x, Player.pos.z); }
      }
      const v = this.seenV || 0;
      if (v > 0) { this.aw = Math.min(1.6, this.aw + v * 0.42 * DIFF.detect * dt); this.lastSeen = 0; this.sense = 'see'; } else { this.lastSeen += dt; this.aw = Math.max(0, this.aw - (this.state === 'hunt' ? 0.05 : 0.14) * dt); }
      if (this.aw >= 1 && this.state !== 'hunt') { this.state = 'hunt'; Snd.roar(dist2(this.x, this.z, Player.pos.x, Player.pos.z), 0.85, 3.2); UI.toast('Thủy Quái đã thấy bạn! Chạy vào nhà hoặc trốn dưới mái hiên!', 'bad'); }
      if (this.state === 'hunt' && this.lastSeen > 7) { this.state = 'investigate'; this.invT = 12; this.wp = this.lkp.clone(); this.aw = 0.6; }
      if (this.state === 'investigate') { this.invT -= dt; if (this.invT <= 0) { this.state = 'wander'; this.wp = null; } }
      let target = this.wp;
      if (this.state === 'hunt') target = this.lkp;
      if (!target || (this.state === 'wander' && dist2(this.x, this.z, target.x, target.y) < 15)) { this.wp = this.pickWaypoint(); target = this.wp; }
      const dx = target.x - this.x, dz = target.y - this.z, dd = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz); this.heading += clamp(angleDiff(this.heading, want), -0.3 * dt, 0.3 * dt);
      speed = this.state === 'hunt' ? (dd > 26 ? 4.6 : 0.6) : this.state === 'investigate' ? (dd > 12 ? 3.8 : 0) : 3.0;
      if (this.atk) speed = 0.3;
      // attack
      this.cd -= dt;
      // it stamps where it saw you; if you hid in a building it stamps the building
      const hidden = Player.indoors && this.lkp && dist2(this.lkp.x, this.lkp.y, Player.pos.x, Player.pos.z) < 14 && this.lastSeen < 12;
      if (this.state === 'hunt' && !this.atk && this.cd <= 0 && (this.lastSeen < 1.5 || hidden) && Player.pos.y > -1) {
        const L = this.gait.legs.slice(0, 2).sort((a, b) => dist2(a.hip.x, a.hip.z, Player.pos.x, Player.pos.z) - dist2(b.hip.x, b.hip.z, Player.pos.x, Player.pos.z))[0];
        if (dist2(L.hip.x, L.hip.z, Player.pos.x, Player.pos.z) < 30) this.startAttack(L);
      }
      if (this.atk) this.updateStomp(dt);
    }
    this.x += Math.sin(this.heading) * speed * dt; this.z += Math.cos(this.heading) * speed * dt;
    this.x = clamp(this.x, -300, 300); this.z = clamp(this.z, -150, 150);
    this.vel.set(Math.sin(this.heading) * speed, 0, Math.cos(this.heading) * speed);
    // body bob from gait
    let lifted = 0; for (const L of this.gait.legs) if (L.step) lifted++;
    const bob = this.state === 'emerge' ? 0 : Math.sin(this.t * 1.8) * 0.6 - lifted * 0.5;
    this.root.position.set(this.x, this.bodyY + bob, this.z); this.root.rotation.set(Math.sin(this.t * 0.9) * 0.02, this.heading, Math.sin(this.t * 0.7) * 0.025);
    this.root.updateMatrixWorld();
    if (this.state !== 'dormant') {
      if (this.state === 'emerge' && !this.gait.inited) this.gait.place(this.root.matrixWorld);
      this.gait.update(dt, this.root.matrixWorld, this.vel, this.root.position);
    }
    this.updateTentacles(dt);
    // proximity rumble
    const d = dist2(this.x, this.z, Player.pos.x, Player.pos.z);
    this.prox = clamp(1 - d / 160, 0, 1);
  }
  startAttack(leg) {
    const P = Player; const lead = P.bike ? 1.0 : 0.4;
    const tx = P.pos.x + (P.bike ? -Math.sin(P.bike.rot) * P.bike.speed * lead : 0), tz = P.pos.z + (P.bike ? -Math.cos(P.bike.rot) * P.bike.speed * lead : 0);
    this.atk = { t: 0, x: tx, z: tz, leg, from: leg.foot.clone(), hit: false };
    leg.ovr = leg.foot.clone();
    this.ring.position.set(tx, 0.08, tz); this.ring.scale.setScalar(5.2); this.ring.visible = true;
    Snd.roar(dist2(this.x, this.z, P.pos.x, P.pos.z), 1.25, 1.2);
  }
  // raise the foot high over you (shadow + red ring on the ground), then bring it down
  updateStomp(dt) {
    const A = this.atk; A.t += dt; const L = A.leg;
    const top = new THREE.Vector3(A.x, 17, A.z), tgt = new THREE.Vector3(A.x, 0, A.z);
    if (A.t < 1.6) { L.ovr.lerpVectors(A.from, top, smooth(A.t / 1.6)); L.ovr.y = Math.sin(Math.min(1, A.t / 1.6) * Math.PI * 0.5) * 17; this.ring.material.opacity = 0.35 + Math.sin(this.t * 18) * 0.25; this.ring.scale.setScalar(5.2 - A.t * 0.6); }
    else if (A.t < 1.85) { L.ovr.lerpVectors(top, tgt, (A.t - 1.6) / 0.25); }
    else { L.ovr.copy(tgt); if (!A.hit) { A.hit = true; this.slam(A.x, A.z); } }
    if (A.t > 2.8) { L.ovr = null; L.foot.copy(tgt); this.atk = null; this.cd = R(2.2, 3.6); this.ring.visible = false; }
  }
  updateTentacles(dt) {
    const M = this.mouthLocal.clone().applyMatrix4(this.root.matrixWorld);
    for (const T of this.tent) {
      T.ph += dt;
      const base = M.clone().add(new THREE.Vector3(Math.cos(this.heading) * T.side * 0.8, 0, -Math.sin(this.heading) * T.side * 0.8));
      let tip, ctrl;
      const A = null;
      if (this.state === 'rage' && this.rageWith) { // tentacles lash up at the flyer
        const F = this.rageWith, fp = new THREE.Vector3(F.x, F.y, F.z), dir = fp.clone().sub(base); const L = Math.min(dir.length(), 42);
        tip = base.clone().add(dir.normalize().multiplyScalar(L)).add(new THREE.Vector3(Math.sin(T.ph * 3 + T.side) * 4, Math.sin(T.ph * 2.3) * 4, Math.cos(T.ph * 2.7) * 4));
        ctrl = base.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, -5, 0));
        if (tip.distanceTo(fp) < 10) F.knock(this);
      } else if (A) {
        A.t += dt / 2; const tt = A.t;
        const target = new THREE.Vector3(A.x, 0.3, A.z);
        const hover = target.clone().add(new THREE.Vector3(0, 14, 0));
        if (tt < 1.5) { tip = T.tip.clone().lerp(hover, Math.min(1, dt * 3)); this.ring.material.opacity = 0.35 + Math.sin(this.t * 18) * 0.25; }
        else if (tt < 1.75) { tip = hover.clone().lerp(target, (tt - 1.5) / 0.25); }
        else { tip = target.clone(); if (!A.hit) { A.hit = true; this.slam(A.x, A.z); } }
        if (tt > 2.6) { this.atk = null; this.cd = R(2.5, 4); this.ring.visible = false; }
        ctrl = base.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 6, 0));
      } else {
        tip = base.clone().add(new THREE.Vector3(Math.sin(T.ph * 0.7 + T.side) * 5, -22 + Math.sin(T.ph * 0.5) * 2, Math.cos(T.ph * 0.6) * 5));
        tip.y = Math.max(tip.y, 1.5);
        ctrl = base.clone().add(new THREE.Vector3(Math.sin(this.heading) * 4, -6, Math.cos(this.heading) * 4));
      }
      T.tip.copy(tip);
      const n = T.segs.length; let prev = base.clone();
      for (let k = 1; k <= n; k++) {
        const s = k / n, a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
        const p = new THREE.Vector3(a * base.x + b * ctrl.x + c * tip.x, a * base.y + b * ctrl.y + c * tip.y, a * base.z + b * ctrl.z + c * tip.z);
        placeSeg(T.segs[k - 1], prev, p); prev = p;
      }
    }
  }
  slam(x, z) {
    const d = dist2(x, z, Player.pos.x, Player.pos.z);
    Snd.boom(d, 1.3); Shake.add(clamp(1 - d / 60, 0, 1)); FX.dust.burst(x, 0.5, z, 24, 9, 3, 2.5, 2); FX.dustS.burst(x, 0.5, z, 30, 8, 7, 1.4, 1);
    const B = buildingAt(x, z); if (B) collapseBuilding(B);
    crushPeople(x, z, 5);
    if (Player.pos.y > -1) { if (d < 4.8) Player.damage(40, 'crush', x, z); else if (d < 9) Player.damage(12, 'blunt', x, z); }
    if (Player.bike && d < 7) dismount(true);
    emitNoise(x, z, 30, 'slam');
  }
  meleeHit(px, pz) { for (const L of this.gait.legs) if (dist2(L.foot.x, L.foot.z, px, pz) < 4) { UI.toast('Bạn đập vào chân nó… nó thậm chí không để ý.'); return false; } return false; }
}

// ---------------------------------------------------------------- Thổ Trùng (giant burrowing worm) — blind, hunts by sound
// persistent crater left where the worm bursts out: dark hole, broken asphalt slabs tilted up, a ring of thrown-up earth
const CRATERS = [];
function makeCrater(x, z, r) {
  const mb = new MB();
  mb.geo(new THREE.CylinderGeometry(r * 0.75, r * 0.5, 0.2, 18), new THREE.Matrix4().makeTranslation(x, -0.04, z), '#0d0907');
  mb.geo(new THREE.CylinderGeometry(r * 1.05, r * 0.8, 0.12, 18), new THREE.Matrix4().makeTranslation(x, -0.02, z), '#3a2a1e');
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * TAU + R(-0.15, 0.15), rr = r * R(0.95, 1.35), px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(px, 0.15, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(R(-0.3, 0.3), R(0, 3), R(-0.3, 0.3))), new THREE.Vector3(R(1, 1.8), R(0.35, 0.6), R(1, 1.8)));
    mb.geo(new THREE.IcosahedronGeometry(1, 1), m, pick(['#5a4636', '#6d5b48', '#4a3a2c']), 0.1, 6);
    addCol(px - 0.8, pz - 0.8, px + 0.8, pz + 0.8, 0, 0.55, { sight: false });
  }
  for (let k = 0; k < 7; k++) { // slabs of road heaved up around the hole
    const a = R(0, TAU), rr = r * R(0.7, 1.1), px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    mb.box(px - 1.1, 0, pz - 0.7, px + 1.1, 0.25, pz + 0.7, '#4b4c4c', { ry: a });
    const m = new THREE.Matrix4().compose(new THREE.Vector3(px, 0.5, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(R(0.4, 0.9) * (Math.random() < 0.5 ? 1 : -1), a, 0)), new THREE.Vector3(2.2, 0.25, 1.4)); mb.geo(new THREE.BoxGeometry(1, 1, 1), m, '#4f5050', 0, 2);
  }
  const mesh = meshFrom(mb); scene.add(mesh); CRATERS.push(mesh);
  if (CRATERS.length > 26) scene.remove(CRATERS.shift());
}
// ---------------------------------------------------------------- Thổ Trùng: blind, feels footsteps through the ground from far away (like Thủy Quái sees), but not slow or crouched walking
class Worm {
  constructor(zone, name) {
    this.name = name || 'Thổ Trùng'; this.kind = 'worm'; this.zone = zone;
    this.x = R(zone.x0, zone.x1); this.z = R(zone.z0, zone.z1); this.state = 'roam'; this.t = 0; this.aw = 0;
    this.target = null; this.heading = R(0, TAU); this.waitT = 0; this.restT = 0;
    const mat = new THREE.MeshLambertMaterial({ color: 0x5e4535, flatShading: true }), band = new THREE.MeshLambertMaterial({ color: 0xa8907a, flatShading: true }), belly = new THREE.MeshLambertMaterial({ color: 0x8a6a52, flatShading: true });
    addDetail(mat); addDetail(band);
    this.segs = [];
    for (let k = 0; k < 24; k++) {
      const r = 3.3 - k * 0.075; const m = ballMesh(r, k % 3 === 1 ? band : mat, 1, 1, 1.15, 1); m.visible = false; m.frustumCulled = false; scene.add(m); this.segs.push(m);
      if (k > 0 && k % 2 === 0) for (const sd of [-1, 1]) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 4), belly); sp.position.set(sd * r * 0.9, -r * 0.4, 0); sp.rotation.z = sd * 2.2; m.add(sp); }
    }
    this.jaws = [];
    const jm = new THREE.MeshLambertMaterial({ color: 0x7a3a33, flatShading: true });
    for (let k = 0; k < 5; k++) { const j = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5.2, 4), jm); j.geometry.translate(0, 2.6, 0); j.castShadow = true; this.segs[0].add(j); this.jaws.push({ j, a: k / 5 * TAU }); }
    const throat = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.2, 1.2, 12), new THREE.MeshBasicMaterial({ color: 0x1a0606 })); throat.rotation.x = Math.PI / 2; throat.position.z = 3.2; this.segs[0].add(throat);
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; const t = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 4), new THREE.MeshLambertMaterial({ color: 0xe8dcc4 })); t.position.set(Math.cos(a) * 2.0, Math.sin(a) * 2.0, 3.4); t.rotation.set(Math.PI / 2, 0, 0); t.lookAt(new THREE.Vector3(0, 0, 3.6)); this.segs[0].add(t); }
    this.mound = ballMesh(1, new THREE.MeshLambertMaterial({ color: 0x6d5b48, flatShading: true }), 3.6, 1.0, 3.6, 1); this.mound.receiveShadow = true; scene.add(this.mound);
    this.warnRing = makeDecal(0x7a5a3a, 0.55, true);
  }
  hear(x, z, r, kind) {
    if (this.state === 'erupt' || this.state === 'rest' || this.state === 'warn') return;
    if (buildingAt(x, z) || (Math.abs(x - Player.pos.x) < 0.5 && Math.abs(z - Player.pos.z) < 0.5 && Player.pos.y < -1)) return; // floors and the underpass muffle everything
    if (kind === 'step' && r < 3) return; // crouch-walking is too light to feel
    const mult = kind === 'step' ? 6.5 : kind === 'lure' ? 1.8 : kind === 'scream' ? 2 : 3;
    const d = dist2(x, z, this.x, this.z), eff = r * mult;
    if (d > eff) return;
    const fromPlayer = dist2(x, z, Player.pos.x, Player.pos.z) < 3;
    let tx = x, tz = z;
    const P = Player; if (fromPlayer && P.bike) { tx += -Math.sin(P.bike.rot) * P.bike.speed * 1.6; tz += -Math.cos(P.bike.rot) * P.bike.speed * 1.6; }
    this.target = new THREE.Vector2(tx, tz); this.heard = 0;
    if (fromPlayer) { this.sense = 'hear'; this.aw = Math.min(0.99, Math.max(this.aw, 0.35 + 0.6 * (1 - d / eff))); }
    if (this.state === 'roam') { this.state = 'track'; if (fromPlayer && d < 90) UI.toast('Mặt đất rung lên… Thổ Trùng đang lần theo tiếng bước chân của bạn. Ngồi xuống [C] và đi chậm để nó mất dấu.', 'bad'); }
  }
  update(dt) {
    this.t += dt; this.heard = (this.heard || 0) + dt;
    const P = Player;
    if (this.state === 'roam' || this.state === 'track') {
      let tx, tz, spd;
      if (this.state === 'track' && this.target) { tx = this.target.x; tz = this.target.y; spd = 9; }
      else { if (!this.target || dist2(this.x, this.z, this.target.x, this.target.y) < 4) this.target = new THREE.Vector2(clamp(P.pos.x + R(-120, 120), this.zone.x0, this.zone.x1), clamp(P.pos.z + R(-90, 90), this.zone.z0, this.zone.z1)); tx = this.target.x; tz = this.target.y; spd = 3.5; }
      const dx = tx - this.x, dz = tz - this.z, dd = Math.hypot(dx, dz);
      if (dd > 0.5) { this.heading = Math.atan2(dx, dz); const s = Math.min(dd, spd * dt); this.x += dx / dd * s; this.z += dz / dd * s; }
      if (this.state === 'track') {
        if (dd < 2.5) { if (this.heard < 2.2) { this.state = 'warn'; this.wt = 0; this.ex = this.x; this.ez = this.z; this.warnRing.position.set(this.x, 0.1, this.z); this.warnRing.scale.setScalar(6); this.warnRing.visible = true; } else { this.waitT += dt; if (this.waitT > 3) { this.state = 'roam'; this.waitT = 0; this.target = null; if (this.aw > 0.3) UI.toast('Mặt đất thôi rung. Thổ Trùng đã mất dấu bạn.', 'good'); this.aw = 0.1; } } }
        if (this.heard > 8) { this.state = 'roam'; this.target = null; }
        this.aw = Math.max(0, this.aw - 0.06 * dt);
      } else this.aw = Math.max(0, this.aw - 0.15 * dt);
      this.mound.visible = true; this.mound.position.set(this.x, -0.25 + Math.sin(this.t * 4) * 0.12, this.z); this.mound.rotation.y = this.heading;
      const em = this.state === 'track' ? 1 : 0.3; if (Math.random() < em) FX.dustS.emit(this.x + R(-2, 2), 0.3, this.z + R(-2, 2), R(-1, 1), R(2, 4), R(-1, 1), 0.8);
      if (this.state === 'track' && Math.random() < 0.25) FX.dust.emit(this.x, 0.5, this.z, 0, 1, 0, 2);
    } else if (this.state === 'warn') {
      this.wt += dt; Shake.t = Math.max(Shake.t, clamp(1 - dist2(this.ex, this.ez, P.pos.x, P.pos.z) / 60, 0, 1) * 0.6);
      this.warnRing.material.opacity = 0.3 + Math.sin(this.t * 20) * 0.25; this.warnRing.scale.setScalar(6 + this.wt * 2);
      for (let i = 0; i < 4; i++) FX.dustS.emit(this.ex + R(-5, 5), 0.2, this.ez + R(-5, 5), R(-1, 1), R(3, 8), R(-1, 1), 0.7);
      if (this.wt > 1.3) this.erupt();
    } else if (this.state === 'erupt') {
      this.et += dt; this.animErupt(dt);
      if (this.et > 4.0) { this.state = 'rest'; this.restT = 7; for (const s of this.segs) s.visible = false; this.x = this.end.x; this.z = this.end.z; this.aw = 0.2; }
    } else if (this.state === 'rest') { this.restT -= dt; this.mound.visible = true; this.mound.position.set(this.x, -0.4, this.z); if (this.restT <= 0) { this.state = 'roam'; this.target = null; } }
    const d = dist2(this.x, this.z, P.pos.x, P.pos.z); this.prox = clamp(1 - d / 50, 0, 1) * (this.state === 'track' || this.state === 'warn' ? 1 : 0.45);
  }
  // it leaps out of the ground in a tall arc and dives back in 22m away, leaving two craters
  erupt() {
    this.state = 'erupt'; this.et = 0; this.warnRing.visible = false; this.mound.visible = false; this.landed = false;
    const P = Player; const a = R(0, TAU);
    this.dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    this.start = new THREE.Vector3(this.ex, -18, this.ez); this.apex = new THREE.Vector3(this.ex + this.dir.x * 11, 46, this.ez + this.dir.z * 11); this.end = new THREE.Vector3(this.ex + this.dir.x * 22, -18, this.ez + this.dir.z * 22);
    const d = dist2(this.ex, this.ez, P.pos.x, P.pos.z);
    Snd.roar(d, 1.6, 1.8); Snd.boom(d, 1.4); Shake.add(clamp(1 - d / 80, 0, 1) * 1.3);
    FX.dust.burst(this.ex, 1, this.ez, 60, 14, 10, 3.5, 3); FX.dustS.burst(this.ex, 0.5, this.ez, 90, 14, 18, 2.2, 2.5);
    makeCrater(this.ex, this.ez, 5);
    const B = buildingAt(this.ex, this.ez); if (B) collapseBuilding(B);
    crushAt(this.ex, this.ez, 5.2, 11, 78); crushPeople(this.ex, this.ez, 6.5);
    emitNoise(this.ex, this.ez, 25, 'slam');
    for (const s of this.segs) s.visible = true;
  }
  animErupt(dt) {
    const T = 3.2;
    const pt = (s) => { s = clamp(s, 0, 1); const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s; return new THREE.Vector3(a * this.start.x + b * this.apex.x + c * this.end.x, a * this.start.y + b * this.apex.y + c * this.end.y, a * this.start.z + b * this.apex.z + c * this.end.z); };
    for (let k = 0; k < this.segs.length; k++) {
      const s = this.et / T - k * 0.04; const p = pt(s), p2 = pt(s + 0.02);
      const m = this.segs[k]; m.position.copy(p); m.lookAt(p2); m.rotateZ(Math.sin(this.et * 6 + k) * 0.1); m.visible = p.y > -5 && s > 0 && s < 1;
      if (m.visible && p.y > 2 && p.y < 9 && Math.random() < 0.35) FX.dustS.emit(p.x, p.y, p.z, R(-4, 4), R(-2, 3), R(-4, 4), 1.4); // dirt raining off its body
    }
    const open = clamp(Math.sin(this.et * 2.4), 0, 1);
    for (const { j, a } of this.jaws) { j.position.set(Math.cos(a) * (1.8 + open * 1.2), Math.sin(a) * (1.8 + open * 1.2), 2.6); j.rotation.set(Math.PI / 2 + Math.sin(a) * open * 0.9, -Math.cos(a) * open * 0.9, 0); }
    if (this.et > T * 0.82 && !this.landed) { this.landed = true; const d = dist2(this.end.x, this.end.z, Player.pos.x, Player.pos.z); Snd.boom(d, 1.3); Shake.add(clamp(1 - d / 70, 0, 1)); FX.dust.burst(this.end.x, 1, this.end.z, 40, 11, 7, 3, 3); FX.dustS.burst(this.end.x, 0.5, this.end.z, 60, 12, 14, 1.8, 2); makeCrater(this.end.x, this.end.z, 4.5); const B = buildingAt(this.end.x, this.end.z); if (B) collapseBuilding(B); crushAt(this.end.x, this.end.z, 4.5, 9, 55); crushPeople(this.end.x, this.end.z, 5); }
    if (this.et < 1.8) FX.dustS.emit(this.ex + R(-3, 3), 1, this.ez + R(-3, 3), R(-7, 7), R(6, 18), R(-7, 7), 1.8);
  }
}

// ---------------------------------------------------------------- Săn Mồi (stalker): sight hunter that walks the streets
function roadProject(x, z) {
  let best = null, bd = 1e9;
  for (const rx of RX) { const pz = clamp(z, -150, 150), d = Math.hypot(x - rx, z - pz); if (d < bd) { bd = d; best = { x: rx, z: pz, axis: 'x', line: rx }; } }
  for (const rz of RZ) { const px = clamp(x, -300, 300), d = Math.hypot(x - px, z - rz); if (d < bd) { bd = d; best = { x: px, z: rz, axis: 'z', line: rz }; } }
  best.d = bd; return best;
}
function roadRoute(a, b) {
  const pts = [];
  if (a.axis === b.axis && a.line === b.line) { pts.push([b.x, b.z]); return pts; }
  if (a.axis === 'x' && b.axis === 'z') { pts.push([a.line, b.line], [b.x, b.z]); return pts; }
  if (a.axis === 'z' && b.axis === 'x') { pts.push([b.line, a.line], [b.x, b.z]); return pts; }
  if (a.axis === 'x') { let zb = RZ[0], best = 1e9; for (const z of RZ) { const c = Math.abs(a.z - z) + Math.abs(b.z - z); if (c < best) { best = c; zb = z; } } pts.push([a.line, zb], [b.line, zb], [b.x, b.z]); return pts; }
  let xb = RX[0], best = 1e9; for (const x of RX) { const c = Math.abs(a.x - x) + Math.abs(b.x - x); if (c < best) { best = c; xb = x; } } pts.push([xb, a.line], [xb, b.line], [b.x, b.z]); return pts;
}
class Stalker {
  constructor(region, name) {
    this.name = name || 'Săn Mồi'; this.kind = 'stalker'; this.region = region;
    const p = roadProject(R(region.x0, region.x1), R(region.z0, region.z1)); this.x = p.x; this.z = p.z;
    this.heading = 0; this.state = 'patrol'; this.aw = 0; this.lastSeen = 99; this.lkp = new THREE.Vector2(); this.route = []; this.t = R(0, 10);
    this.vel = new THREE.Vector3(); this.seeT = 0; this.stunT = 0; this.cd = 0; this.lunge = null; this.repath = 0;
    const mat = addDetail(new THREE.MeshLambertMaterial({ color: 0x34363a, flatShading: true })), pale = addDetail(new THREE.MeshLambertMaterial({ color: 0x9a968c, flatShading: true }));
    this.root = new THREE.Group(); scene.add(this.root);
    const body = ballMesh(1, mat, 2.2, 1.7, 4.2); this.root.add(body);
    for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.25, R(1.2, 2.2), 4), pale); s.position.set(0, 1.5, -3 + k); s.rotation.x = -0.5; this.root.add(s); }
    this.neck = []; for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5 - k * 0.08, 0.7 - k * 0.08, 1, 6), mat); m.castShadow = true; this.root.add(m); this.neck.push(m); }
    this.headM = ballMesh(1, mat, 0.9, 0.8, 1.9); this.root.add(this.headM);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    for (const sx of [-1, 1]) { const e = ballMesh(0.16, eyeM); e.position.set(sx * 0.5, 0.25, 1.2); this.headM.add(e); }
    const jaw = ballMesh(1, pale, 0.6, 0.25, 1.4); jaw.position.set(0, -0.55, 0.4); this.headM.add(jaw);
    this.headRest = new THREE.Vector3(0, -0.6, 6.2); this.headPos = this.headRest.clone();
    this.gait = new Gait({
      hips: [new THREE.Vector3(-1.4, -0.3, 2.4), new THREE.Vector3(1.4, -0.3, 2.4), new THREE.Vector3(-1.4, -0.3, -2.4), new THREE.Vector3(1.4, -0.3, -2.4)],
      rests: [new THREE.Vector3(-4.2, 0, 4.6), new THREE.Vector3(4.2, 0, 4.6), new THREE.Vector3(-4.2, 0, -4.2), new THREE.Vector3(4.2, 0, -4.2)],
      a: 6.2, b: 6.6, stride: 3.2, dur: 0.42, lift: 1.6, rA: 0.42, rB: 0.32, rFoot: 0.12, mat, lead: 0.35, poleUp: 1.4,
      onLand: (p) => { const d = dist2(p.x, p.z, Player.pos.x, Player.pos.z); if (d < 70) Snd.burst({ dur: 0.12, freq: 260, gain: 0.12 * Snd.vol(d, 70) }); },
    });
    this.bodyH = 7.2;
  }
  headWorld() { return this.headPos.clone().applyMatrix4(this.root.matrixWorld); }
  stun(t) { this.stunT = Math.max(this.stunT, t); this.lunge = null; Snd.screech(dist2(this.x, this.z, Player.pos.x, Player.pos.z)); if (this.state !== 'hunt' && this.state !== 'flee') { this.state = 'hunt'; this.aw = 1; this.lkp.set(Player.pos.x, Player.pos.z); } }
  meleeHit(px, pz, yaw, stunT = 3.2) {
    const h = this.headWorld(); const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const near = (x, z, r) => { const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz); return d < r && (dx * fx + dz * fz) / (d || 1) > 0.2; };
    let ok = near(h.x, h.z, 3.6) && h.y < 4.5; for (const L of this.gait.legs) if (near(L.knee.x, L.knee.z, 2.4) || near(L.foot.x, L.foot.z, 2.4)) ok = true;
    if (ok) { this.stun(stunT); this.hits = (this.hits || 0) + 1; if (this.hits >= 5) this.startFlee(); FX.spark.burst(h.x, Math.min(h.y, 2.5), h.z, 10, 3, 3, 0.4, 0.3); UI.toast('Bạn đập trúng! Nó lùi lại, nhưng sẽ quay lại ngay.', 'good'); }
    return ok;
  }
  hear(x, z, r, kind) {
    if (!LOUD.has(kind)) return; // footsteps are too quiet for it; only the worm feels those
    const d = dist2(x, z, this.x, this.z), eff = r * (kind === 'lure' ? 1.6 : 0.85);
    if (d > eff) return;
    if ((this.state === 'hunt' && kind !== 'lure') || this.state === 'flee') return;
    this.aw = Math.min(0.9, this.aw + (kind === 'lure' ? 0.4 : 0.12)); if (fromPlayer(x, z)) this.sense = 'hear';
    this.state = 'investigate'; this.invT = 14; this.goal = new THREE.Vector2(x, z); this.repath = 0;
  }
  setRoute(tx, tz) { const a = roadProject(this.x, this.z), b = roadProject(tx, tz); this.route = roadRoute(a, b); this.routeEnd = b; }
  update(dt) {
    this.t += dt; const P = Player;
    // perception
    this.seeT -= dt;
    if (this.seeT <= 0) { this.seeT = 0.2; const h = this.headWorld(); this.seenV = (this.stunT > 0 || this.state === 'flee' || P.indoors) ? 0 : seePlayer(h.x, h.y, h.z, this.heading, 1.9, 60); if (this.seenV > 0) this.lkp.set(P.pos.x, P.pos.z); }
    const v = this.seenV || 0;
    if (v > 0) { this.aw = Math.min(1.5, this.aw + v * 1.05 * DIFF.detect * dt); this.lastSeen = 0; this.sense = 'see'; } else { this.lastSeen += dt; this.aw = Math.max(0, this.aw - (this.state === 'hunt' ? 0.04 : 0.18) * dt); }
    if (this.aw >= 1 && this.state !== 'hunt' && this.state !== 'flee') { this.state = 'hunt'; this.repath = 0; Snd.screech(dist2(this.x, this.z, P.pos.x, P.pos.z)); UI.toast('Săn Mồi đã phát hiện bạn! Cắt đuôi nó: chạy vào nhà, ra cửa sau.', 'bad'); }
    if (this.state === 'hunt' && this.lastSeen > 6) { this.state = 'search'; this.searchT = 10; this.goal = this.lkp.clone(); this.repath = 0; this.aw = 0.55; }
    if (this.state === 'search') { this.searchT -= dt; if (this.searchT <= 0) { this.state = 'patrol'; this.route = []; } }
    if (this.state === 'investigate') { this.invT -= dt; if (this.invT <= 0) { this.state = 'patrol'; this.route = []; } }
    if (this.state === 'flee') { this.fleeT -= dt; this.aw = 0; if (this.fleeT <= 0) { this.state = 'patrol'; this.route = []; this.hits = 0; } }
    // it also hunts the people still running in the streets
    this.preyScan = (this.preyScan || 0) - dt;
    if (this.preyScan <= 0 && (this.state === 'patrol' || this.state === 'investigate' || this.state === 'search')) {
      this.preyScan = 1; const h = this.headWorld();
      for (const r of RUNNERS) { if (r.dead) continue; const dx = r.x - this.x, dz = r.z - this.z, dd = Math.hypot(dx, dz); if (dd > 38 || Math.abs(angleDiff(this.heading, Math.atan2(dx, dz))) > 1.1) continue; if (!lineOfSight(h.x, h.y, h.z, r.x, 1.4, r.z)) continue; this.state = 'prey'; this.prey = r; this.preyT = 15; this.repath = 0; Snd.screech(dist2(this.x, this.z, P.pos.x, P.pos.z)); break; }
    }
    if (this.state === 'prey') {
      const r = this.prey; this.preyT -= dt;
      if (!r || r.dead || this.preyT <= 0) { this.state = 'patrol'; this.route = []; this.prey = null; }
      else if (dist2(r.x, r.z, this.x, this.z) < 7.5) { this.lunge = { t: 0.55, hit: true }; r.die(); Snd.screech(dist2(this.x, this.z, P.pos.x, P.pos.z)); this.state = 'patrol'; this.route = []; this.prey = null; }
    }
    // goals
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = this.state === 'hunt' ? 0.6 : 2.5;
      if (this.state === 'prey') { this.repath = 0.4; this.route = [[this.prey.x, this.prey.z]]; }
      else if (this.state === 'flee') this.setRoute(this.fleeTo.x, this.fleeTo.y);
      else if (this.state === 'hunt') this.setRoute(this.lkp.x, this.lkp.y);
      else if ((this.state === 'investigate' || this.state === 'search') && this.goal) this.setRoute(this.goal.x, this.goal.y);
      else if (!this.route.length) { const g = roadProject(R(this.region.x0, this.region.x1), R(this.region.z0, this.region.z1)); this.setRoute(g.x, g.z); }
    }
    let speed = { patrol: 2.6, investigate: 4.6, search: 3.4, hunt: 7.4, flee: 9, prey: 7.2 }[this.state];
    if (this.stunT > 0) { this.stunT -= dt; speed = -1.5; }
    // follow route; in the final stretch of a hunt step off the road centre toward the player
    let tx = this.x, tz = this.z;
    if (this.route.length) {
      [tx, tz] = this.route[0];
      if (this.route.length === 1 && this.state === 'hunt' && this.routeEnd) {
        const e = this.routeEnd; const ox = clamp(this.lkp.x - e.x, -6.5, 6.5), oz = clamp(this.lkp.y - e.z, -6.5, 6.5);
        if (e.axis === 'x') tx += ox; else tz += oz;
      }
      if (dist2(this.x, this.z, tx, tz) < 1.5) { this.route.shift(); if (!this.route.length && this.state === 'patrol') this.repath = R(1, 4); }
    }
    const dx = tx - this.x, dz = tz - this.z, dd = Math.hypot(dx, dz);
    let face = dd > 0.3 ? Math.atan2(dx, dz) : this.heading;
    if (this.state === 'hunt' && dist2(this.x, this.z, P.pos.x, P.pos.z) < 14) face = Math.atan2(P.pos.x - this.x, P.pos.z - this.z);
    this.heading += clamp(angleDiff(this.heading, face), -2.6 * dt, 2.6 * dt);
    if (dd < 0.5 && speed > 0) speed = 0;
    if (this.lunge) speed = 0;
    const fwd = Math.abs(angleDiff(this.heading, face)) < 0.8 ? 1 : 0.3;
    this.x += Math.sin(this.heading) * speed * fwd * dt; this.z += Math.cos(this.heading) * speed * fwd * dt;
    this.vel.set(Math.sin(this.heading) * speed * fwd, 0, Math.cos(this.heading) * speed * fwd);
    // attack
    this.cd -= dt;
    const dP = dist2(this.x, this.z, P.pos.x, P.pos.z);
    if (this.state === 'hunt' && !this.lunge && this.cd <= 0 && this.stunT <= 0 && dP < 10.5 && this.lastSeen < 0.6 && !P.indoors && P.pos.y > -1) { this.lunge = { t: 0, hit: false }; Snd.screech(dP); }
    // head animation
    const rest = this.headRest.clone().add(new THREE.Vector3(Math.sin(this.t * 0.8) * 0.6, Math.sin(this.t * 1.3) * 0.3, 0));
    if (this.lunge) {
      const L = this.lunge; L.t += dt;
      const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
      const tgt = new THREE.Vector3(P.pos.x, P.pos.y + 1.0, P.pos.z).applyMatrix4(inv);
      const reach = Math.min(tgt.length(), 10.5); tgt.setLength(reach);
      if (L.t < 0.55) this.headPos.lerp(rest.clone().add(new THREE.Vector3(0, 1.4, -2.2)), dt * 8);
      else if (L.t < 0.8) { this.headPos.lerp(tgt, dt * 18); if (!L.hit && L.t > 0.7) { L.hit = true; const h = this.headWorld(); if (dist2(h.x, h.z, P.pos.x, P.pos.z) < 2.6 && Math.abs(h.y - P.pos.y - 1) < 2.5) P.damage(27, 'slash', this.x, this.z); } }
      else { this.headPos.lerp(rest, dt * 5); if (L.t > 1.3) { this.lunge = null; this.cd = 1.6; } }
    } else this.headPos.lerp(this.stunT > 0 ? rest.clone().add(new THREE.Vector3(0, 2, -3)) : rest, dt * 4);
    // body transform
    let lifted = 0; for (const L of this.gait.legs) if (L.step) lifted++;
    this.root.position.set(this.x, this.bodyH + Math.sin(this.t * 6) * 0.08 * Math.min(1, Math.abs(speed)) - lifted * 0.08, this.z);
    this.root.rotation.set(-0.12, this.heading, 0); this.root.updateMatrixWorld();
    // neck chain from body front to head
    const n0 = new THREE.Vector3(0, 0.3, 3.4), n3 = this.headPos.clone().add(new THREE.Vector3(0, 0, -1.0)), mid = n0.clone().lerp(n3, 0.5).add(new THREE.Vector3(0, 1.2, 0));
    const pts = [n0, n0.clone().lerp(mid, 0.9), mid.clone().lerp(n3, 0.6), n3];
    for (let k = 0; k < 3; k++) placeSeg(this.neck[k], pts[k], pts[k + 1]);
    this.headM.position.copy(this.headPos); this.headM.lookAt(this.headPos.clone().add(this.headPos.clone().sub(pts[2]).normalize()).applyMatrix4(this.root.matrixWorld));
    this.gait.update(dt, this.root.matrixWorld, this.vel, this.root.position);
    this.prox = clamp(1 - dP / 40, 0, 1) * 0.3;
  }
}

function spawnMonsters() {
  MONSTERS.push(new Titan());
  MONSTERS.push(new Worm({ x0: -290, x1: 290, z0: -145, z1: 145 }));
  MONSTERS.push(new Stalker({ x0: -120, x1: 40, z0: -150, z1: 150 }));
  MONSTERS.push(new Stalker({ x0: 80, x1: 280, z0: -150, z1: 150 }));
  MONSTERS.push(new Flyer());
  MONSTERS.push(new Wanderer());
}

// ---------------------------------------------------------------- bullets vs monsters
function raySphere(o, d, c, r) { const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z; const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r; const h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1; }
function minT(list) { let m = -1; for (const t of list) if (t > 0 && (m < 0 || t < m)) m = t; return m; }
const _mid = new THREE.Vector3();
function legTests(o, d, gait, r) { const out = []; for (const L of gait.legs) { out.push(raySphere(o, d, L.knee, r)); out.push(raySphere(o, d, _mid.lerpVectors(L.hip, L.knee, 0.5), r)); out.push(raySphere(o, d, _mid.lerpVectors(L.knee, L.foot, 0.5), r * 0.8)); } return out; }
Stalker.prototype.startFlee = function () {
  const P = Player; const dx = this.x - P.pos.x, dz = this.z - P.pos.z, l = Math.hypot(dx, dz) || 1;
  this.state = 'flee'; this.fleeT = 35; this.repath = 0; this.lunge = null; this.aw = 0;
  this.fleeTo = new THREE.Vector2(clamp(this.x + dx / l * 160, -290, 290), clamp(this.z + dz / l * 160, -145, 145));
  Snd.screech(l); UI.toast('Săn Mồi rít lên rồi bỏ chạy! Nó sẽ quay lại sau ít phút.', 'good');
};
Stalker.prototype.shotTest = function (o, d) { return minT([raySphere(o, d, this.root.position, 2.4), raySphere(o, d, this.headWorld(), 1.1), ...legTests(o, d, this.gait, 0.5)]); };
Stalker.prototype.shot = function () {
  this.hits = (this.hits || 0) + 1;
  if (this.state === 'flee') return;
  if (this.hits >= 4) { this.startFlee(); return; }
  this.stun(1.4); UI.toast(`Trúng! Săn Mồi chùn lại (${this.hits}/4)`, 'good');
};
Titan.prototype.shotTest = function (o, d) { if (this.state === 'dormant') return -1; return minT([raySphere(o, d, this.root.position, 10), raySphere(o, d, this.head(), 3.2), ...legTests(o, d, this.gait, 2.6)]); };
Titan.prototype.shot = function () {
  if (!this.shotMsg || Game.time - this.shotMsg > 20) { this.shotMsg = Game.time; UI.toast('Đạn không xuyên nổi lớp da của Thủy Quái. Nó chỉ chú ý tới bạn hơn.', 'bad'); }
  if (this.state === 'wander' || this.state === 'investigate') { this.aw = Math.min(0.95, this.aw + 0.3); this.wp = new THREE.Vector2(Player.pos.x, Player.pos.z); this.state = 'investigate'; this.invT = 15; }
};
Worm.prototype.shotTest = function (o, d) { if (this.state !== 'erupt') return -1; return minT(this.segs.filter(s => s.visible).map(s => raySphere(o, d, s.position, 2.6))); };
Worm.prototype.shot = function () { if (!this.shotMsg || Game.time - this.shotMsg > 15) { this.shotMsg = Game.time; UI.toast('Đạn bật ra khỏi lớp vỏ của Thổ Trùng.'); } };

// ---------------------------------------------------------------- Dực Quái: a winged giant that circles high above and spits exploding fireballs
const FIREBALLS = [];
const _fv = new THREE.Vector3();
class Flyer {
  constructor() {
    this.name = 'Dực Quái'; this.kind = 'flyer';
    this.x = 300; this.y = 80; this.z = -160; this.heading = -2.4; this.roll = 0; this.state = 'away'; this.t = 0; this.aw = 0; this.lastSeen = 99;
    this.lkp = new THREE.Vector2(); this.wp = null; this.spitT = 3; this.seeT = 0; this.speed = 15; this.rageT = 0; this.knockT = 0; this.flapPh = 0;
    const skin = new THREE.MeshLambertMaterial({ color: 0xcfe2e9, emissive: 0x5a7480, flatShading: true }), pale = new THREE.MeshLambertMaterial({ color: 0xeef6f8, emissive: 0x6a8490, flatShading: true }), dark = new THREE.MeshLambertMaterial({ color: 0x8fb0bd, emissive: 0x3a5460, flatShading: true });
    const root = this.root = new THREE.Group(); root.visible = false; scene.add(root);
    const add = (geo, mat, p, r = [0, 0, 0], sc = [1, 1, 1], parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); m.scale.set(...sc); m.castShadow = true; parent.add(m); return m; };
    add(new THREE.IcosahedronGeometry(1, 1), skin, [0, 0, 0], [0, 0, 0], [5, 2.6, 14]);
    add(new THREE.IcosahedronGeometry(1, 1), pale, [0, -1.2, 1], [0, 0, 0], [3.8, 1.6, 11]);
    // neck and narrow head pointing forward (+z)
    add(new THREE.CylinderGeometry(1.2, 2.2, 9, 8), skin, [0, 0.8, 16], [Math.PI / 2 - 0.15, 0, 0]);
    this.head = add(new THREE.IcosahedronGeometry(1, 1), skin, [0, 1.6, 23], [0.1, 0, 0], [1.8, 1.3, 4]);
    add(new THREE.ConeGeometry(0.9, 3, 6), dark, [0, 1.2, 27], [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) add(new THREE.IcosahedronGeometry(0.35, 0), new THREE.MeshBasicMaterial({ color: 0x3a6a7a }), [sx * 1.3, 2.2, 24.5]);
    // spine frills
    for (let k = 0; k < 9; k++) add(new THREE.ConeGeometry(0.5, 2.6 - k * 0.15, 4), pale, [0, 2.4, 10 - k * 2.6], [-0.6, 0, 0]);
    // long tail with fins
    this.tail = []; let prev = root; for (let k = 0; k < 6; k++) { const g = new THREE.Group(); g.position.set(0, 0, k === 0 ? -13 : -4.5); prev.add(g); add(new THREE.CylinderGeometry(1.1 - k * 0.15, 1.3 - k * 0.15, 4.8, 6), skin, [0, 0, -2.2], [Math.PI / 2, 0, 0], [1, 1, 1], g); this.tail.push(g); prev = g; }
    add(new THREE.BoxGeometry(7, 0.2, 3), pale, [0, 0, -3], [0, 0, 0], [1, 1, 1], prev);
    // wings: a fan of long feather blades on each side, like the reference picture
    this.wings = [];
    for (const side of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(side * 4, 1, 3); root.add(w); this.wings.push({ g: w, side });
      add(new THREE.BoxGeometry(14, 1, 5), skin, [side * 7, 0, 0], [0, 0, 0], [1, 1, 1], w);
      const tip = new THREE.Group(); tip.position.set(side * 14, 0, 0); w.add(tip); this.wings[this.wings.length - 1].tip = tip;
      for (let k = 0; k < 9; k++) {
        const a = -0.35 + k * 0.17, L = 22 - Math.abs(k - 3) * 1.8;
        const f = add(new THREE.BoxGeometry(L, 0.35, 2.4), k % 2 ? pale : skin, [side * L / 2 * Math.cos(a), 0, -L / 2 * Math.sin(a) * 0.9], [0, side * a, 0], [1, 1, 1], tip);
        if (k % 2 === 0) add(new THREE.BoxGeometry(L * 0.7, 0.4, 0.6), dark, [side * L / 2 * Math.cos(a) * 0.9, 0.2, -L / 2 * Math.sin(a) * 0.8], [0, side * a, 0], [1, 1, 1], tip);
      }
      for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(9, 0.3, 1.6), pale, [side * 8, -0.3, -3 - k * 1.8], [0, side * (0.4 + k * 0.08), 0], [1, 1, 1], w); // trailing feathers
    }
    this.shadow = makeDecal(0x000000, 0.18); this.shadow.scale.set(26, 1, 14);
  }
  mouth() { return new THREE.Vector3(0, 1.0, 28).applyMatrix4(this.root.matrixWorld); }
  hear(x, z, r, kind) {
    if (this.state === 'away' || this.state === 'rage' || !LOUD.has(kind)) return;
    if (dist2(x, z, this.x, this.z) > r * 1.6 + 40) return;
    if (kind === 'boom') return; // its own fireballs
    if (fromPlayer(x, z)) { this.sense = 'hear'; this.aw = Math.min(0.9, this.aw + 0.2); }
    if (this.state !== 'hunt') { this.state = 'investigate'; this.invT = 18; this.wp = new THREE.Vector2(x, z); }
  }
  rage(T) { this.state = 'rage'; this.rageT = 40; this.rageWith = T; this.aw = 0; }
  knock(T) { if (this.knockT > 0) return; this.knockT = 2.5; const dx = this.x - T.x, dz = this.z - T.z, l = Math.hypot(dx, dz) || 1; this.kx = dx / l * 30; this.kz = dz / l * 30; this.y += 6; Snd.screech(dist2(this.x, this.z, Player.pos.x, Player.pos.z) * 0.5); }
  stun() { }
  update(dt) {
    this.t += dt; const P = Player;
    if (this.state === 'away') { if (Game.time > 75) { this.state = 'patrol'; this.root.visible = true; this.shadow.visible = true; UI.toast('Có tiếng vỗ cánh rất lớn trên trời… Một con quái khổng lồ đang bay tới.', 'bad'); Snd.roar(200, 1.6, 3); } else return; }
    // perception: looks down from the sky; roofs and awnings hide you
    this.seeT -= dt;
    if (this.seeT <= 0) { this.seeT = 0.3; this.seenV = this.state === 'rage' ? 0 : seePlayer(this.x, this.y - 3, this.z, this.heading, TAU, 150); if (this.seenV > 0) this.lkp.set(P.pos.x, P.pos.z); }
    const v = this.seenV || 0;
    if (v > 0) { this.aw = Math.min(1.5, this.aw + v * 0.5 * DIFF.detect * dt); this.lastSeen = 0; this.sense = 'see'; } else { this.lastSeen += dt; this.aw = Math.max(0, this.aw - (this.state === 'hunt' ? 0.05 : 0.15) * dt); }
    if (this.aw >= 1 && this.state !== 'hunt' && this.state !== 'rage') { this.state = 'hunt'; Snd.roar(dist2(this.x, this.z, P.pos.x, P.pos.z), 1.7, 2); UI.toast('Dực Quái đã thấy bạn từ trên cao! Nó sẽ khạc cầu lửa. Chạy khỏi vòng đỏ, trốn dưới mái nhà.', 'bad'); }
    if (this.state === 'hunt' && this.lastSeen > 8) { this.state = 'investigate'; this.invT = 10; this.wp = this.lkp.clone(); this.aw = 0.5; }
    if (this.state === 'investigate') { this.invT -= dt; if (this.invT <= 0) { this.state = 'patrol'; this.wp = null; } }
    if (this.state === 'rage') { this.rageT -= dt; if (this.rageT <= 0 || !this.rageWith || this.rageWith.state !== 'rage') { this.state = 'patrol'; this.rageWith = null; this.wp = null; } }
    // where to fly
    let tx, tz, alt = 72, spd = 15;
    if (this.state === 'hunt' || this.state === 'rage') {
      const cx = this.state === 'rage' ? this.rageWith.x : this.lkp.x, cz = this.state === 'rage' ? this.rageWith.z : this.lkp.y;
      const a = Math.atan2(this.z - cz, this.x - cx) + 0.5; const r = this.state === 'rage' ? 55 : 42; tx = cx + Math.cos(a) * r; tz = cz + Math.sin(a) * r; alt = this.state === 'rage' ? 62 : 52; spd = 17;
      this.spitT -= dt;
      if (this.spitT <= 0) {
        if (this.state === 'rage') { this.spitT = R(4, 6); const T = this.rageWith; spitFireball(this, new THREE.Vector3(T.x + R(-6, 6), T.root.position.y, T.z + R(-6, 6)), true); }
        else if (this.lastSeen < 3) { this.spitT = R(2.8, 4.2) / Math.sqrt(DIFF.dmg); const lead = P.bike ? 1.2 : 0.5; const vx = P.bike ? -Math.sin(P.bike.rot) * P.bike.speed : 0, vz = P.bike ? -Math.cos(P.bike.rot) * P.bike.speed : 0; spitFireball(this, new THREE.Vector3(P.pos.x + vx * lead + R(-1.5, 1.5), 0, P.pos.z + vz * lead + R(-1.5, 1.5))); }
        else if (P.indoors && this.lastSeen < 10) { this.spitT = R(4, 6); spitFireball(this, new THREE.Vector3(this.lkp.x + R(-3, 3), 0, this.lkp.y + R(-3, 3))); } // it bombs the house you ran into
      }
    } else {
      if (!this.wp || dist2(this.x, this.z, this.wp.x, this.wp.y) < 25) this.wp = new THREE.Vector2(clamp(P.pos.x + R(-160, 160), -300, 300), clamp(P.pos.z + R(-120, 120), -150, 150));
      tx = this.wp.x; tz = this.wp.y;
    }
    const want = Math.atan2(tx - this.x, tz - this.z), turn = clamp(angleDiff(this.heading, want), -0.7 * dt, 0.7 * dt);
    this.heading += turn; this.roll = damp(this.roll, -turn / dt * 0.6, 2, dt);
    this.x += Math.sin(this.heading) * spd * dt; this.z += Math.cos(this.heading) * spd * dt;
    if (this.knockT > 0) { this.knockT -= dt; this.x += this.kx * dt; this.z += this.kz * dt; this.kx *= 0.97; this.kz *= 0.97; }
    this.x = clamp(this.x, -330, 330); this.z = clamp(this.z, -190, 190);
    this.y = damp(this.y, alt + Math.sin(this.t * 0.7) * 3, 0.6, dt);
    // flap, tail sway
    this.flapPh += dt * (this.state === 'hunt' || this.state === 'rage' ? 2.6 : 1.8);
    const fl = Math.sin(this.flapPh);
    for (const W of this.wings) { W.g.rotation.z = W.side * fl * 0.35; W.tip.rotation.z = W.side * Math.sin(this.flapPh - 0.6) * 0.3; }
    this.tail.forEach((g, k) => { g.rotation.y = Math.sin(this.t * 1.4 - k * 0.6) * 0.12; g.rotation.x = Math.sin(this.t * 1.1 - k * 0.5) * 0.05; });
    if (fl > 0.98 && !this.flapped) { this.flapped = true; const d = dist2(this.x, this.z, P.pos.x, P.pos.z); Snd.burst({ dur: 0.9, freq: 160, gain: 0.35 * Snd.vol(d, 220), attack: 0.2 }); if (d < 60) Shake.add(0.08); } else if (fl < 0.5) this.flapped = false;
    this.root.position.set(this.x, this.y + fl * 1.2, this.z); this.root.rotation.set(-0.05, this.heading, this.roll); this.root.updateMatrixWorld();
    this.shadow.position.set(this.x, 0.1, this.z); this.shadow.rotation.y = this.heading; this.shadow.visible = true;
    this.prox = clamp(1 - dist2(this.x, this.z, P.pos.x, P.pos.z) / 120, 0, 1) * 0.4;
  }
  shotTest(o, d) { if (this.state === 'away') return -1; return raySphere(o, d, this.root.position, 9); }
  shot() { if (!this.shotMsg || Game.time - this.shotMsg > 20) { this.shotMsg = Game.time; UI.toast('Đạn chẳng làm gì được Dực Quái, chỉ làm nó chú ý tới bạn.', 'bad'); } this.aw = Math.min(1.2, this.aw + 0.35); this.lkp.set(Player.pos.x, Player.pos.z); }
}
const FB_GEO = new THREE.IcosahedronGeometry(1.1, 1), FB_MAT = new THREE.MeshBasicMaterial({ color: 0xffa040 });
function spitFireball(F, target, air) {
  const p = F.mouth(); const d = Math.hypot(target.x - p.x, target.z - p.z); const T = clamp(d / 28, 1.6, 2.8), g = 9;
  const v = new THREE.Vector3((target.x - p.x) / T, (target.y - p.y) / T + 0.5 * g * T, (target.z - p.z) / T);
  const m = new THREE.Mesh(FB_GEO, FB_MAT); m.position.copy(p); scene.add(m);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: PTEX, color: 0xff7a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.set(7, 7, 1); m.add(glow);
  let ring = null; if (!air) { ring = makeDecal(0xff6a2a, 0.6, true); ring.position.set(target.x, 0.1, target.z); ring.scale.setScalar(5.2); ring.visible = true; }
  FIREBALLS.push({ m, p: p.clone(), v, t: 0, T, g, target, ring, from: F, air });
  Snd.tone({ f0: 300, f1: 90, dur: 1.2, type: 'sawtooth', gain: 0.12 * Snd.vol(dist2(p.x, p.z, Player.pos.x, Player.pos.z), 200) });
}
function updateFireballs(dt) {
  for (let i = FIREBALLS.length - 1; i >= 0; i--) {
    const B = FIREBALLS[i]; B.t += dt; B.v.y -= B.g * dt; B.p.addScaledVector(B.v, dt); B.m.position.copy(B.p); B.m.rotation.x += dt * 5;
    FX.fire.emit(B.p.x + R(-0.5, 0.5), B.p.y, B.p.z + R(-0.5, 0.5), R(-1, 1), R(0, 1), R(-1, 1), 0.6); if (Math.random() < 0.5) FX.smoke.emit(B.p.x, B.p.y, B.p.z, 0, 0.5, 0, 3, 0.4);
    if (B.ring) B.ring.material.opacity = 0.35 + Math.sin(Game.time * 20) * 0.25;
    if (B.t >= B.T || (!B.air && B.p.y <= 0.3)) { explodeFireball(B); scene.remove(B.m); if (B.ring) { B.ring.visible = false; scene.remove(B.ring); } FIREBALLS.splice(i, 1); }
  }
}
function explodeFireball(B) {
  const x = B.p.x, y = Math.max(0, B.p.y), z = B.p.z, P = Player; const d = dist2(x, z, P.pos.x, P.pos.z);
  FX.fire.burst(x, y + 1, z, 50, 10, 7, 1.0, 1.6); FX.smoke.burst(x, y + 2, z, 18, 4, 4, 6, 2); FX.spark.burst(x, y + 1, z, 30, 10, 10, 0.8, 1);
  Snd.boom(dist2(x, z, P.pos.x, P.pos.z), 1.4); Snd.burst({ dur: 1.4, freq: 900, q: 0.5, gain: 0.5 * Snd.vol(d, 250) }); Shake.add(clamp(1 - d / 70, 0, 1) * 0.8);
  emitNoise(x, z, 70, 'boom');
  const T = MONSTERS[0];
  // a fireball bursting near Thủy Quái makes it furious: the two fight and forget about you for a while
  if (T && T.state !== 'dormant' && T.state !== 'emerge' && T.state !== 'preview' && T.state !== 'rage' && (dist2(x, z, T.x, T.z) < 24 || T.gait.legs.some(L => dist2(x, z, L.foot.x, L.foot.z) < 9)) && B.from) {
    T.state = 'rage'; T.rageT = 40; T.rageWith = B.from; T.aw = 0; T.atk = null; for (const L of T.gait.legs) L.ovr = null; T.ring.visible = false;
    B.from.rage(T); Snd.roar(dist2(T.x, T.z, P.pos.x, P.pos.z), 0.7, 4.5);
    if (dist2(T.x, T.z, P.pos.x, P.pos.z) < 250) UI.toast('Cầu lửa trúng Thủy Quái! Nó nổi điên quay sang đánh Dực Quái. Hai con sẽ mặc kệ bạn một lúc, chạy đi!', 'good');
  }
  if (B.air) return;
  const Bd = buildingAt(x, z); if (Bd && x > Bd.x0 + 1.5 && x < Bd.x1 - 1.5 && z > Bd.z0 + 1.5 && z < Bd.z1 - 1.5 && Math.random() < 0.45) collapseBuilding(Bd);
  crushPeople(x, z, 4);
  if (P.pos.y > -1 && !(P.indoors && !Bd)) { if (d < 2.8) P.damage(45, 'crush', x, z); else if (d < 6) P.damage(18 * (1 - (d - 2.8) / 3.2) + 6, 'blunt', x, z); }
  if (FIRES.length < 160) FIRES.push([x + R(-1, 1), 0.4, z + R(-1, 1), 0.9]);
}
// Thủy Quái in a rage: turns on the flyer, ignores the player
const _titanUpd2 = Titan.prototype.update;
Titan.prototype.update = function (dt) {
  if (this.state !== 'rage') return _titanUpd2.call(this, dt);
  this.t += dt; this.rageT -= dt; this.aw = 0;
  const F = this.rageWith;
  if (this.rageT <= 0 || !F) { this.state = 'wander'; this.wp = null; this.rageWith = null; return; }
  const dx = F.x - this.x, dz = F.z - this.z, dd = Math.hypot(dx, dz);
  this.heading += clamp(angleDiff(this.heading, Math.atan2(dx, dz)), -0.5 * dt, 0.5 * dt);
  const speed = dd > 35 ? 4.2 : 0.8;
  this.x = clamp(this.x + Math.sin(this.heading) * speed * dt, -300, 300); this.z = clamp(this.z + Math.cos(this.heading) * speed * dt, -150, 150);
  this.vel.set(Math.sin(this.heading) * speed, 0, Math.cos(this.heading) * speed);
  this.root.position.set(this.x, this.bodyY + 1.5 + Math.sin(this.t * 3) * 0.8, this.z); this.root.rotation.set(-0.12 + Math.sin(this.t * 2) * 0.04, this.heading, Math.sin(this.t * 1.7) * 0.05); this.root.updateMatrixWorld();
  this.gait.update(dt, this.root.matrixWorld, this.vel, this.root.position);
  this.updateTentacles(dt);
  this.roarT = (this.roarT || 0) - dt; if (this.roarT <= 0) { this.roarT = R(5, 8); Snd.roar(dist2(this.x, this.z, Player.pos.x, Player.pos.z), 0.75, 2.5); }
  this.prox = clamp(1 - dist2(this.x, this.z, Player.pos.x, Player.pos.z) / 160, 0, 1);
};

// ---------------------------------------------------------------- Bạch Trùng: a pale, fleshy, many-legged grub ~64m long and as wide as the street;
// blind and deaf, it only crawls the roads. Its body is a chain of segments that follow the head's path, so it bends round corners.
class Wanderer {
  constructor() {
    this.name = 'Bạch Trùng'; this.kind = 'wander'; this.aw = 0; this.t = 0; this.state = 'crawl';
    const p0 = roadProject(110, 95); this.x = p0.x; this.z = p0.z; this.heading = 0; this.route = []; this.hurtT = 0; this.warnT = 0;
    const flesh = addDetail(new THREE.MeshLambertMaterial({ color: 0xd9cfc2, flatShading: true })), flesh2 = addDetail(new THREE.MeshLambertMaterial({ color: 0xc8bcae, flatShading: true }));
    const vein = new THREE.MeshLambertMaterial({ color: 0x8a3a2e, flatShading: true }), raw = new THREE.MeshLambertMaterial({ color: 0xa8584a, flatShading: true });
    const add = (geo, mat, p, r, sc, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); m.scale.set(...sc); m.castShadow = true; parent.add(m); return m; };
    // head
    this.headG = new THREE.Group(); scene.add(this.headG);
    add(new THREE.IcosahedronGeometry(1, 2), flesh2, [0, 1.6, 1.2], [0.7, 0, 0], [1.9, 1.6, 2.6], this.headG);
    add(new THREE.IcosahedronGeometry(1, 1), flesh2, [0, 2.4, 0.1], [0.3, 0, 0], [2.4, 1.8, 1.6], this.headG);
    for (const sx of [-1, 1]) add(new THREE.IcosahedronGeometry(1, 1), raw, [sx * 1.6, 1.9, 0.5], [0, 0, 0], [0.5, 1.2, 0.9], this.headG);
    add(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x2a0806 }), [0, 0.35, 2.3], [0, 0, 0], [1.0, 0.35, 0.7], this.headG);
    // body: 40 ridged segments, tapering towards the tail
    const NSEG = 40; this.SP = 1.55; this.segs = [];
    for (let k = 0; k < NSEG; k++) {
      const r = k < 3 ? 2.5 + k * 0.25 : k < NSEG - 8 ? 3.1 + Math.sin(k * 0.35) * 0.15 : Math.max(1.0, 3.1 - (k - NSEG + 9) * 0.27), hy = r * 1.02;
      const g = new THREE.Group(); scene.add(g);
      const m = add(new THREE.IcosahedronGeometry(1, 2), flesh, [0, 0, 0], [0, 0, 0], [r, hy, 1.15], g);
      add(new THREE.TorusGeometry(1, 0.08, 5, 18), vein, [0, -0.1, -0.6], [0, 0, 0], [r * 0.97, hy * 0.95, 1], g);
      if (Math.random() < 0.6) add(new THREE.IcosahedronGeometry(0.5, 0), raw, [R(-r * 0.8, r * 0.8), R(0, hy * 0.8), R(-0.6, 0.6)], [R(0, 3), R(0, 3), 0], [R(0.4, 0.9), R(0.15, 0.3), R(0.4, 1)], g);
      const S = { g, m, r, y: Math.max(1.0, hy * 0.85), x: 0, z: 0, h: 0 };
      // a pair of long, jointed legs on every second segment of the thick part
      if (k % 2 === 1 && r > 1.8) {
        S.gait = new Gait({ hips: [new THREE.Vector3(-r * 0.75, 0.2, 0), new THREE.Vector3(r * 0.75, 0.2, 0)], rests: [new THREE.Vector3(-r * 1.75, -S.y, 0.4), new THREE.Vector3(r * 1.75, -S.y, 0.4)], groups: [k % 4 === 1 ? 0 : 1, k % 4 === 1 ? 1 : 0], a: 3.4, b: 3.9, stride: 2.2, dur: 0.45, lift: 1.3, rA: 0.36, rB: 0.28, rFoot: 0.13, mat: flesh, lead: 0.6, poleUp: 2.2, onLand: p => this.footfall(p) });
        S.claws = S.gait.legs.map(() => { const cg = new THREE.Group(); for (let j = 0; j < 3; j++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.1, 4), flesh2); c.rotation.set(Math.PI / 2 - 0.25, (j - 1) * 0.55, 0); c.position.set(Math.sin((j - 1) * 0.55) * 0.5, 0.05, Math.cos((j - 1) * 0.55) * 0.5); c.castShadow = true; cg.add(c); } scene.add(cg); return cg; });
        S.vel = new THREE.Vector3();
      }
      this.segs.push(S);
    }
    // the path the head has crawled; segments are placed along it
    this.trail = []; for (let k = 0; k <= 120; k++) this.trail.push([this.x, this.z - k * 0.6]);
  }
  hear() { } // blind and deaf
  footfall(p) { const d = dist2(p.x, p.z, Player.pos.x, Player.pos.z); if (d < 60) Snd.burst({ dur: 0.15, freq: 300, gain: 0.1 * Snd.vol(d, 60) }); if (Math.random() < 0.25) FX.dustS.emit(p.x, 0.2, p.z, R(-1, 1), R(1, 2), R(-1, 1), 0.6); }
  pointAt(dist) {
    const T = this.trail; let acc = 0;
    for (let i = 0; i < T.length - 1; i++) { const a = T[i], b = T[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc + L >= dist) { const t = (dist - acc) / (L || 1); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(a[0] - b[0], a[1] - b[1])]; } acc += L; }
    const a = T[T.length - 1]; return [a[0], a[1], this.heading];
  }
  update(dt) {
    this.t += dt; const P = Player;
    if (!this.route.length) { const a = roadProject(this.x, this.z), b = roadProject(R(-290, 290), R(-145, 145)); this.route = roadRoute(a, b); }
    const [tx, tz] = this.route[0]; const dx = tx - this.x, dz = tz - this.z, dd = Math.hypot(dx, dz);
    if (dd < 1.5) this.route.shift();
    const want = Math.atan2(dx, dz); this.heading += clamp(angleDiff(this.heading, want), -0.5 * dt, 0.5 * dt);
    const turning = Math.abs(angleDiff(this.heading, want)) > 0.6, speed = turning ? 1.0 : 2.4;
    this.x += Math.sin(this.heading) * speed * dt; this.z += Math.cos(this.heading) * speed * dt;
    const T = this.trail; if (Math.hypot(this.x - T[0][0], this.z - T[0][1]) > 0.5) { T.unshift([this.x, this.z]); if (T.length > 150) T.pop(); } else T[0] = [T[0][0], T[0][1]];
    // head
    this.headG.position.set(this.x, Math.sin(this.t * 3) * 0.1, this.z); this.headG.rotation.set(0, this.heading + Math.sin(this.t * 0.9) * 0.15, 0); this.headG.updateMatrixWorld();
    // body along the trail with a ripple running down it
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.segs.forEach((S, k) => {
      const [sx, sz, h] = this.pointAt(1.6 + (k + 1) * this.SP); const w = Math.sin(this.t * 3.2 - k * 0.7);
      const vx = (sx - S.x) / Math.max(dt, 1e-3), vz = (sz - S.z) / Math.max(dt, 1e-3); S.x = sx; S.z = sz; S.h = h;
      S.g.position.set(sx, S.y + w * 0.16, sz); S.g.rotation.set(0.03, h, w * 0.02); S.m.scale.x = S.r * (1 + w * 0.04); S.g.updateMatrixWorld();
      if (S.gait) { S.vel.set(vx, 0, vz).clampLength(0, 4); S.gait.update(dt, S.g.matrixWorld, S.vel, S.g.position); S.gait.legs.forEach((L, i) => { S.claws[i].position.copy(L.foot); S.claws[i].rotation.y = h; }); }
    });
    // a moving wall: you are shoved out from under any part of it; the head bites
    let under = null;
    for (const S of this.segs) { const lx = P.pos.x - S.x, lz = P.pos.z - S.z; if (lx * lx + lz * lz < (S.r + 0.5) ** 2) { under = S; break; } }
    const hx = P.pos.x - this.x, hz = P.pos.z - this.z; const atHead = hx * hx + hz * hz < 3.4 * 3.4;
    this.hurtT -= dt;
    if (P.pos.y > -1 && P.pos.y < 5 && (under || atHead) && !P.dead && Game.state === 'play' && !GOD.on) {
      const c = under || { x: this.x, z: this.z }, ox = P.pos.x - c.x, oz = P.pos.z - c.z, ol = Math.hypot(ox, oz) || 1; P.pos.x += ox / ol * 7 * dt; P.pos.z += oz / ol * 7 * dt;
      if (P.bike) { P.bike.x = P.pos.x; P.bike.z = P.pos.z; }
      if (atHead && this.hurtT <= 0) { this.hurtT = 1.0; P.damage(34, 'slash', this.x, this.z); Snd.screech(0); UI.toast('Bạch Trùng ngoạm vào bạn! Tránh xa đầu nó!', 'bad'); }
      else if (this.hurtT <= 0) { this.hurtT = 0.8; P.damage(12, 'crush', c.x, c.z); }
    } else if (P.pos.y > -1 && Math.hypot(hx, hz) < 18 && hx * fx + hz * fz > 0) { this.warnT -= dt; if (this.warnT <= 0) { this.warnT = 10; UI.toast('Bạch Trùng dài hơn 60m đang bò tới, chiếm gần hết lòng đường. Nó không thấy, không nghe: tránh sang lề hoặc vào nhà.'); } }
    for (const r of RUNNERS) { if (r.dead) continue; if (Math.hypot(r.x - this.x, r.z - this.z) < 3.4 || this.segs.some(S => Math.hypot(r.x - S.x, r.z - S.z) < S.r)) r.die(); }
    let dmin = Math.hypot(hx, hz); for (const S of this.segs) dmin = Math.min(dmin, Math.hypot(P.pos.x - S.x, P.pos.z - S.z));
    this.prox = clamp(1 - dmin / 50, 0, 1) * 0.4;
  }
  shotTest(o, dd) { let best = raySphere(o, dd, this.headG.position, 3); for (const S of this.segs) { const t = raySphere(o, dd, S.g.position, S.r); if (t > 0 && (best < 0 || t < best)) best = t; } return best; }
  shot() { if (!this.shotMsg || Game.time - this.shotMsg > 20) { this.shotMsg = Game.time; UI.toast('Bạch Trùng không cảm thấy gì. Đạn chỉ lún vào lớp thịt của nó.'); } }
  meleeHit() { return false; }
}
