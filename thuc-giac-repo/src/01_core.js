import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

// ---------------------------------------------------------------- utils
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const smooth = t => t * t * (3 - 2 * t);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rng = mulberry32(2611);
const rand = (a = 0, b = 1) => a + (b - a) * rng();
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(rng() * arr.length)];
const chance = p => rng() < p;
const R = (a = 0, b = 1) => a + (b - a) * Math.random(); // non-seeded, runtime
function angleDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const money = n => Math.round(n).toLocaleString('vi-VN') + 'đ';
const $ = s => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
let QUALITY = isTouch ? 'low' : 'high';
try { const q = localStorage.getItem('tg-quality'); if (q) QUALITY = q; } catch (e) { }
// difficulty: easy = waking up only dazed, slow hunger/thirst, monsters notice you more slowly
const DIFFS = {
  easy: { name: 'Dễ', drain: 0.45, stam: 0.6, bleed: 0.5, detect: 0.7, dmg: 0.7, injure: 0.6, startInj: false },
  normal: { name: 'Thường', drain: 1, stam: 1, bleed: 1, detect: 1, dmg: 1, injure: 1, startInj: true },
};
let DIFFICULTY = 'easy';
try { const d = localStorage.getItem('tg-diff'); if (DIFFS[d]) DIFFICULTY = d; } catch (e) { }
let DIFF = DIFFS[DIFFICULTY];
function shade(hex, k) { const c = new THREE.Color(hex); c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k); return '#' + c.getHexString(); }

// ---------------------------------------------------------------- audio (procedural)
const Snd = {
  ctx: null, master: null, enabled: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    try { this.ctx = new C(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
    this.noise = b;
    // wind ambience
    const wind = this._src(true), wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
    const wg = c.createGain(); wg.gain.value = 0.11; wind.connect(wf); wf.connect(wg); wg.connect(this.master); wind.start();
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 220; lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
    // rumble bed (worms / titan proximity)
    const rb = this._src(true), rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 70;
    this.rumbleG = c.createGain(); this.rumbleG.gain.value = 0; rb.connect(rf); rf.connect(this.rumbleG); this.rumbleG.connect(this.master); rb.start();
    // engine
    this.eng = c.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 40;
    const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 600;
    this.engG = c.createGain(); this.engG.gain.value = 0; this.eng.connect(ef); ef.connect(this.engG); this.engG.connect(this.master); this.eng.start();
    this.eng2 = c.createOscillator(); this.eng2.type = 'square'; this.eng2.frequency.value = 20; const e2g = c.createGain(); e2g.gain.value = 0.3; this.eng2.connect(e2g); e2g.connect(this.engG); this.eng2.start();
  },
  _src(loop) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = !!loop; s.loopStart = Math.random(); return s; },
  vol(d, max) { return clamp(1 - d / max, 0, 1) ** 1.6; },
  burst({ dur = 0.3, freq = 800, q = 1, gain = 0.3, type = 'lowpass', attack = 0.005, delay = 0 }) {
    if (!this.ctx || !this.enabled || gain < 0.003) return; const c = this.ctx, t = c.currentTime + delay;
    const s = this._src(), f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  tone({ f0 = 200, f1 = null, dur = 0.3, type = 'sine', gain = 0.2, attack = 0.01, delay = 0 }) {
    if (!this.ctx || !this.enabled || gain < 0.003) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  boom(d, size = 1) { const v = this.vol(d, 420) * size; this.tone({ f0: 62, f1: 26, dur: 1.2, gain: 0.7 * v }); this.burst({ dur: 1.0, freq: 140, gain: 0.6 * v }); },
  crash(d) { const v = this.vol(d, 380); this.burst({ dur: 2.6, freq: 500, q: 0.5, gain: 0.55 * v, attack: 0.05 }); this.burst({ dur: 1.4, freq: 2400, type: 'bandpass', q: 0.8, gain: 0.18 * v, delay: 0.1 }); this.boom(d, 0.8); },
  roar(d, pitch = 1, len = 2.6) {
    const v = this.vol(d, 600); if (!this.ctx || v < 0.01) return;
    this.tone({ f0: 95 * pitch, f1: 38 * pitch, dur: len, type: 'sawtooth', gain: 0.32 * v, attack: 0.35 });
    this.tone({ f0: 141 * pitch, f1: 55 * pitch, dur: len * 0.9, type: 'sawtooth', gain: 0.16 * v, attack: 0.4 });
    this.burst({ dur: len, freq: 380 * pitch, q: 2, type: 'bandpass', gain: 0.4 * v, attack: 0.3 });
  },
  screech(d) { const v = this.vol(d, 260); this.tone({ f0: 900, f1: 340, dur: 0.9, type: 'sawtooth', gain: 0.14 * v, attack: 0.05 }); this.burst({ dur: 0.8, freq: 2600, q: 4, type: 'bandpass', gain: 0.3 * v }); },
  step(soft) { this.burst({ dur: 0.08, freq: soft ? 600 : 1100, q: 0.7, gain: soft ? 0.03 : 0.07, type: 'bandpass' }); },
  hit() { this.burst({ dur: 0.25, freq: 900, type: 'bandpass', gain: 0.5 }); this.tone({ f0: 180, f1: 60, dur: 0.25, gain: 0.4 }); },
  hurt() { this.tone({ f0: 240, f1: 120, dur: 0.35, type: 'triangle', gain: 0.25 }); },
  click() { this.tone({ f0: 1200, dur: 0.05, type: 'square', gain: 0.04 }); },
  pickup() { this.tone({ f0: 520, f1: 780, dur: 0.12, type: 'triangle', gain: 0.08 }); },
  heart(v) { this.tone({ f0: 58, f1: 40, dur: 0.18, gain: 0.5 * v }); this.tone({ f0: 52, f1: 38, dur: 0.18, gain: 0.35 * v, delay: 0.22 }); },
  firecracker(d) { const v = this.vol(d, 300); for (let i = 0; i < 14; i++) this.burst({ dur: 0.07, freq: 1800, type: 'highpass', gain: 0.5 * v * R(0.5, 1), delay: i * R(0.05, 0.12) }); },
  glass(d) { const v = this.vol(d, 160); this.burst({ dur: 0.5, freq: 4200, type: 'highpass', gain: 0.35 * v }); this.tone({ f0: 2600, f1: 1800, dur: 0.3, type: 'triangle', gain: 0.05 * v }); },
  gun(d) { const v = this.vol(d, 500); this.burst({ dur: 0.35, freq: 1400, q: 0.6, type: 'bandpass', gain: 0.9 * v, attack: 0.001 }); this.burst({ dur: 0.9, freq: 220, gain: 0.7 * v, attack: 0.002 }); this.tone({ f0: 140, f1: 45, dur: 0.3, gain: 0.5 * v }); },
  ping() { this.tone({ f0: 1650, f1: 1500, dur: 0.18, type: 'sine', gain: 0.035 }); },
  reload() { this.burst({ dur: 0.06, freq: 2500, type: 'bandpass', q: 5, gain: 0.2 }); this.burst({ dur: 0.08, freq: 1800, type: 'bandpass', q: 5, gain: 0.25, delay: 0.9 }); },
  empty() { this.burst({ dur: 0.04, freq: 3000, type: 'bandpass', q: 8, gain: 0.15 }); },
  metal() { for (let i = 0; i < 5; i++) this.burst({ dur: 0.18, freq: 700 + i * 140, q: 6, type: 'bandpass', gain: 0.35, delay: i * 0.18 }); },
  engine(on, speed) { if (!this.ctx) return; const t = this.ctx.currentTime; this.engG.gain.setTargetAtTime(on && this.enabled ? 0.07 + speed * 0.004 : 0, t, 0.1); this.eng.frequency.setTargetAtTime(38 + speed * 7, t, 0.1); this.eng2.frequency.setTargetAtTime(19 + speed * 3.5, t, 0.1); },
  rumble(v) { if (!this.ctx) return; this.rumbleG.gain.setTargetAtTime(this.enabled ? clamp(v, 0, 1) * 0.9 : 0, this.ctx.currentTime, 0.3); },
  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? 0.8 : 0; },
};

// ---------------------------------------------------------------- renderer / scene
const container = $('#game');
const renderer = new THREE.WebGLRenderer({ antialias: QUALITY === 'high', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY === 'high' ? 2 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = QUALITY === 'high';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0xa6aaa6);
scene.background = FOG_COLOR.clone();
const FOG_FAR = QUALITY === 'high' ? 230 : 170;
scene.fog = new THREE.Fog(FOG_COLOR, 25, FOG_FAR);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, FOG_FAR + 5);
camera.rotation.order = 'YXZ';

const hemi = new THREE.HemisphereLight(0xd6dbe0, 0x5d5348, 1.55); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffdcb4, 2.2);
sun.position.set(-60, 90, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY === 'high' ? 4096 : 1024, QUALITY === 'high' ? 4096 : 1024);
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 320; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4;
scene.add(sun); scene.add(sun.target);

const NOISE_GLSL0 = `float h30(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn0(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(mix(mix(h30(i),h30(i+vec3(1,0,0)),f.x), mix(h30(i+vec3(0,1,0)),h30(i+vec3(1,1,0)),f.x),f.y), mix(mix(h30(i+vec3(0,0,1)),h30(i+vec3(1,0,1)),f.x), mix(h30(i+vec3(0,1,1)),h30(i+vec3(1,1,1)),f.x),f.y), f.z); }`;
// sky dome
{
  const g = new THREE.SphereGeometry(FOG_FAR - 10, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x5f6c78) }, mid: { value: FOG_COLOR.clone() }, sunDir: { value: new THREE.Vector3(-0.5, 0.35, 0.6).normalize() }, time: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 sunDir; uniform float time; varying vec3 vP;' + NOISE_GLSL0 + 'float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s += a*vn0(p); p *= 2.03; a *= 0.5; } return s; } void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(mid, top, pow(h,0.55)); vec2 uv = vP.xz/(vP.y+0.25); float cl = fbm(vec3(uv*1.6 + vec2(time*0.004, time*0.002), time*0.003)); float cov = smoothstep(0.42, 0.78, cl) * smoothstep(0.0, 0.25, vP.y); float lit = pow(max(dot(vP, sunDir),0.0), 3.0); vec3 cloudCol = mix(vec3(0.33,0.35,0.37), vec3(0.86,0.8,0.7), clamp(lit*0.9 + (cl-0.5)*0.6, 0.0, 1.0)); c = mix(c, cloudCol, cov*0.85); float s = pow(max(dot(vP, sunDir),0.0), 24.0); c += vec3(1.0,0.82,0.55)*s*0.45*(1.0-cov*0.7); c += vec3(0.25,0.12,0.05)*smoothstep(0.15,0.0,vP.y)*0.5; gl_FragColor = vec4(c,1.0);\n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  var SKY = sky;
}

// ---------------------------------------------------------------- mesh builder (merges boxes & geometries with vertex colors)
const _c = new THREE.Color(), _v3 = new THREE.Vector3(), _n3 = new THREE.Vector3();
class MB {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; this.pat = []; this.idx = []; this.n = 0; }
  _quad(p, nrm, color, uvs, pat = 0) {
    // auto-fix winding so the face points along nrm
    const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
    const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * nrm[0] + cy * nrm[1] + cz * nrm[2] < 0) { p = [p[0], p[3], p[2], p[1]]; if (uvs) uvs = [uvs[0], uvs[1], uvs[6], uvs[7], uvs[4], uvs[5], uvs[2], uvs[3]]; }
    const b = this.n;
    for (let i = 0; i < 4; i++) { this.pos.push(p[i][0], p[i][1], p[i][2]); this.nor.push(nrm[0], nrm[1], nrm[2]); this.col.push(color.r, color.g, color.b); this.pat.push(pat); }
    if (uvs) this.uv.push(...uvs); else this.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); this.n += 4;
  }
  // axis-aligned box: x0..x1, y0..y1, z0..z1 ; optional rotation ry about (rx,rz)
  box(x0, y0, z0, x1, y1, z1, hex, opt = {}) {
    const col = _c.set(hex); const c = { r: col.r, g: col.g, b: col.b };
    if (opt.vary) { const k = 1 + (Math.random() - 0.5) * opt.vary; c.r *= k; c.g *= k; c.b *= k; }
    const ry = opt.ry || 0, ox = opt.ox ?? (x0 + x1) / 2, oz = opt.oz ?? (z0 + z1) / 2;
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const P = (x, y, z) => { if (!ry) return [x, y, z]; const dx = x - ox, dz = z - oz; return [ox + dx * cs + dz * sn, y, oz - dx * sn + dz * cs]; };
    const N = (x, y, z) => { if (!ry) return [x, y, z]; return [x * cs + z * sn, y, -x * sn + z * cs]; };
    const sh = (k) => ({ r: c.r * k, g: c.g * k, b: c.b * k }); const pt = opt.pat || 0;
    this._quad([P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1)], N(1, 0, 0), sh(0.93), null, pt);
    this._quad([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], N(-1, 0, 0), sh(0.93), null, pt);
    this._quad([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], N(0, 0, 1), sh(1), null, pt);
    this._quad([P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0)], N(0, 0, -1), sh(1), null, pt);
    if (!opt.noTop) this._quad([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], N(0, 1, 0), sh(1.04), null, opt.topPat ?? pt);
    if (opt.bottom) this._quad([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], N(0, -1, 0), sh(0.8), null, pt);
  }
  // box by center/size
  cbox(cx, y0, cz, sx, sy, sz, hex, opt) { this.box(cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + sy, cz + sz / 2, hex, opt); }
  // textured quad (signs) — p0..p3 corners, uv rect
  tquad(p, nrm, uvr, hex = 0xffffff) { _c.set(hex); const c = { r: _c.r, g: _c.g, b: _c.b }; this._quad(p, nrm, c, [uvr[0], uvr[1], uvr[2], uvr[1], uvr[2], uvr[3], uvr[0], uvr[3]]); }
  geo(geometry, matrix, hex, vary = 0, pat = 0) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.computeVertexNormals();
    const p = g.attributes.position, nr = g.attributes.normal; _c.set(hex);
    const k = 1 + (Math.random() - 0.5) * vary; const r = _c.r * k, gg = _c.g * k, b = _c.b * k;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      _v3.fromBufferAttribute(p, i).applyMatrix4(matrix); _n3.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize();
      this.pos.push(_v3.x, _v3.y, _v3.z); this.nor.push(_n3.x, _n3.y, _n3.z); this.col.push(r, gg, b); this.uv.push(0, 0); this.pat.push(pat); this.idx.push(this.n++);
    }
  }
  // append another builder's geometry transformed by a matrix (keeps its colours)
  merge(o, m) {
    const nm = new THREE.Matrix3().getNormalMatrix(m), base = this.n;
    for (let i = 0; i < o.n; i++) {
      _v3.set(o.pos[i * 3], o.pos[i * 3 + 1], o.pos[i * 3 + 2]).applyMatrix4(m); _n3.set(o.nor[i * 3], o.nor[i * 3 + 1], o.nor[i * 3 + 2]).applyMatrix3(nm).normalize();
      this.pos.push(_v3.x, _v3.y, _v3.z); this.nor.push(_n3.x, _n3.y, _n3.z); this.col.push(o.col[i * 3], o.col[i * 3 + 1], o.col[i * 3 + 2]); this.uv.push(o.uv[i * 2] || 0, o.uv[i * 2 + 1] || 0); this.pat.push(o.pat[i] || 0);
    }
    for (const k of o.idx) this.idx.push(base + k); this.n += o.n;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('pat', new THREE.Float32BufferAttribute(this.pat, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  get empty() { return this.n === 0; }
}
const MAT = {
  vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
  vcFlat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
};
// procedural surface detail: world-space noise, sidewalk tiles, asphalt patches & cracks, wall grime, shutter ribs, wood grain, foliage
const NOISE_GLSL = `
float h3(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }`;
function addDetail(mat) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float pat; varying vec3 vWP; varying float vPat; varying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vPat = pat; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying float vPat; varying vec3 vWN;' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float n1 = vn(vWP*0.35), n2 = vn(vWP*2.3), n3 = vn(vWP*9.0);
        float k = 0.9 + 0.14*n1 + 0.07*(n2-0.5) + 0.05*(n3-0.5);
        if (vPat > 0.5 && vPat < 1.5) {
          vec2 t = fract(vWP.xz*2.5); float ln = max(step(t.x,0.05), step(t.y,0.05));
          k *= (1.0 - 0.16*ln) * (0.94 + 0.1*h3(vec3(floor(vWP.xz*2.5),1.0)));
        } else if (vPat > 1.5 && vPat < 2.5) {
          k = 0.9 + 0.1*n2 + 0.08*(n3-0.5);
          float pch = smoothstep(0.58,0.62,vn(vWP*0.11)); k *= 1.0 - 0.13*pch;
          float crack = 1.0 - smoothstep(0.0,0.012,abs(vn(vWP*0.5+vec3(3.1))-0.5)); k *= 1.0 - 0.28*crack*step(0.62,vn(vWP*0.07));
          float oil = smoothstep(0.7,0.75,vn(vWP*0.3+vec3(9.0))); k *= 1.0 - 0.1*oil;
        } else if (vPat > 2.5 && vPat < 3.5) {
          float grime = 1.0 - 0.26*(1.0 - smoothstep(0.0, 2.4, vWP.y));
          float streak = vn(vec3((vWP.x+vWP.z)*2.2, vWP.y*0.12, 0.0));
          float vert = 1.0 - smoothstep(0.4, 0.7, abs(vWN.y));
          k *= mix(1.0, grime * (0.86 + 0.16*streak), vert);
          float moss = smoothstep(0.62,0.72,vn(vWP*0.5)) * (1.0 - smoothstep(0.0,1.4,vWP.y)) * vert;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30,0.34,0.22), moss*0.45);
          float peel = smoothstep(0.74,0.76,vn(vWP*3.1+vec3(5.0))) * vert; diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*0.82 + 0.1, peel*0.35);
        } else if (vPat > 3.5 && vPat < 4.5) {
          k *= 0.8 + 0.2*step(0.3, fract(vWP.y*5.0));
        } else if (vPat > 4.5 && vPat < 5.5) {
          k *= 0.82 + 0.2*vn(vec3(vWP.x*0.8, vWP.y*14.0, vWP.z*0.8));
        } else if (vPat > 5.5 && vPat < 6.5) {
          k *= 0.72 + 0.42*n3;
        } else if (vPat > 6.5 && vPat < 7.5) {
          k *= 0.9 + 0.2*step(0.5, fract((vWP.x+vWP.z)*3.0)) * 0.5;
        }
        diffuseColor.rgb *= k;
      }`);
  };
  return mat;
}
addDetail(MAT.vc); addDetail(MAT.vcFlat);
function meshFrom(mb, mat = MAT.vc, shadow = true) {
  const m = new THREE.Mesh(mb.build(), mat);
  m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
  return m;
}

// ---------------------------------------------------------------- particles
function softTex(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}
const PTEX = softTex();
class Particles {
  constructor(max, size, color, opacity = 0.8, grav = 0, blend = THREE.NormalBlending) {
    this.max = max; this.g = grav; this.i = 0;
    this.p = new Float32Array(max * 3).fill(-9999); this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.dr = new Float32Array(max);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.mat = new THREE.PointsMaterial({ size, map: PTEX, color, transparent: true, opacity, depthWrite: false, sizeAttenuation: true, blending: blend });
    this.pts = new THREE.Points(geo, this.mat); this.pts.frustumCulled = false; scene.add(this.pts);
  }
  emit(x, y, z, vx, vy, vz, life, drag = 0.5) {
    const i = this.i = (this.i + 1) % this.max, k = i * 3;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz; this.life[i] = life; this.dr[i] = drag;
  }
  burst(x, y, z, n, spd, up, life, spread = 1) {
    for (let j = 0; j < n; j++) { const a = R(0, TAU), s = R(0.3, 1) * spd; this.emit(x + R(-spread, spread), y + R(0, spread), z + R(-spread, spread), Math.cos(a) * s, R(0.2, 1) * up, Math.sin(a) * s, life * R(0.6, 1.2)); }
  }
  update(dt) {
    const p = this.p, v = this.v;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue; const k = i * 3;
      this.life[i] -= dt; if (this.life[i] <= 0) { p[k + 1] = -9999; continue; }
      const d = Math.exp(-this.dr[i] * dt); v[k] *= d; v[k + 1] = v[k + 1] * d - this.g * dt; v[k + 2] *= d;
      p[k] += v[k] * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}
const FX = {
  dust: new Particles(900, 7, 0x9c958a, 0.5),
  dustS: new Particles(400, 1.6, 0x8a8174, 0.7, 4),
  smoke: new Particles(1400, 18, 0x3d3b3a, 0.32),
  water: new Particles(500, 2.6, 0xdfe8ea, 0.8, 9),
  spark: new Particles(200, 0.9, 0xffb050, 1, 6, THREE.AdditiveBlending),
  fire: new Particles(700, 3.2, 0xff7a2a, 0.75, -1.5, THREE.AdditiveBlending),
  mote: new Particles(160, 0.07, 0xd8d2c4, 0.7, 0),
  ash: new Particles(500, 0.12, 0x4a4642, 0.85, 0.4),
  update(dt) { this.mote.update(dt); this.ash.update(dt); this.dust.update(dt); this.dustS.update(dt); this.smoke.update(dt); this.water.update(dt); this.spark.update(dt); this.fire.update(dt); },
};

// ground decals (rings / shadows / craters)
const DECAL_GEO = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const RING_GEO = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
function makeDecal(color, opacity, ring = false) {
  const m = new THREE.Mesh(ring ? RING_GEO : DECAL_GEO, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.visible = false; m.renderOrder = 2; scene.add(m); return m;
}

// camera shake
const Shake = { t: 0, add(a) { this.t = Math.min(1.4, this.t + a); }, update(dt) { this.t = Math.max(0, this.t - dt * 0.9); } };
