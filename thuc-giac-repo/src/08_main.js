// ---------------------------------------------------------------- game
const Game = {
  state: 'title', time: 0, hold: null, heartT: 0,
  start() {
    Snd.init();
    $('#title').hidden = true; $('#hud').hidden = false;
    if (isTouch) { $('#touch').hidden = false; setupTouch(); document.body.classList.add('playing'); setTimeout(() => { const r = $('#rotate'); if (r) r.remove(); }, 8000); }
    Player.reset(); updatePlayerLook();
    MONSTERS[0].resetDormant();
    this.state = 'play'; this.time = 0;
    requestLock();
    if (DIFF.startInj) {
      setTimeout(() => UI.toast('Đầu bạn đau như búa bổ. Văn phòng đổ nát, đồng nghiệp đã chạy hết.'), 400);
      setTimeout(() => UI.toast('Tay đang chảy máu. Tìm Tủ y tế trong văn phòng, rồi mở Túi đồ [Tab] để băng lại.'), 2600);
    } else {
      setTimeout(() => UI.toast('Bạn tỉnh dậy sau cơn ngất ở chỗ làm, tầng 1 văn phòng. Đầu hơi choáng, nhưng không bị thương. Cửa ra phố ở phía trước; cầu thang ở góc cuối phòng dẫn lên các tầng trên và sân thượng để nhìn toàn cảnh.'), 400);
      setTimeout(() => UI.toast('Nhìn vào đồ vật để thấy viền sáng, nhấn [E] để lục soát. Trên bàn có bàn phím, cầm lên làm vũ khí cũng được.'), 3200);
    }
    setTimeout(() => UI.toast('Mục tiêu: về nhà với gia đình. Bản đồ góc trái chỉ hướng NHÀ, điện thoại quét quái vật trong 90m.', 'good'), 9000);
    setTimeout(() => UI.toast('Xe máy của bạn đỗ ngay trước sảnh. Nhấn [F] cạnh xe để lên.'), 15000);
  },
  die(kind) {
    if (this.state !== 'play') return; Player.dead = true; Snd.engine(false, 0);
    const T = {
      crush: ['Bị giẫm nát', 'Bóng tối ập xuống trong một tiếng động như sấm. Không ai trong thành phố nghe thấy bạn nữa.\n\nỞ cuối phố, ngọn đèn trong căn nhà nhỏ vẫn sáng suốt đêm.'],

      slash: ['Săn Mồi bắt được bạn', 'Đôi mắt vàng ấy đã ở rất gần. Bạn đã chạy, nhưng không đủ nhanh.\n\nỞ cuối phố, ngọn đèn trong căn nhà nhỏ vẫn sáng suốt đêm.'],
      blunt: ['Gục ngã giữa đường', 'Cơ thể bạn không chịu nổi thêm nữa.\n\nỞ cuối phố, ngọn đèn trong căn nhà nhỏ vẫn sáng suốt đêm.'],
      fall: ['Gục ngã giữa đường', 'Bạn ngã xuống và không gượng dậy được nữa.\n\nỞ cuối phố, ngọn đèn trong căn nhà nhỏ vẫn sáng suốt đêm.'],
      starve: ['Kiệt sức', 'Đói, khát và mất máu. Bạn ngồi xuống nghỉ một chút, và không đứng lên nữa.\n\nỞ cuối phố, ngọn đèn trong căn nhà nhỏ vẫn sáng suốt đêm.'],
    }[kind] || ['Bạn đã chết', ''];
    setTimeout(() => UI.ending('Kết thúc · Không về được nhà', T[0], T[1]), 900);
    $('#flash').style.transition = 'none'; $('#flash').style.background = '#000'; $('#flash').style.opacity = '0.85';
  },
  win() {
    const c = Player.cruelty; Snd.engine(false, 0);
    let kind, title, story;
    if (c >= 60) {
      kind = 'Kết thúc xấu'; title = 'Kẻ xa lạ trở về';
      story = 'Cánh cửa hé mở. Người thân nhìn bạn, rồi nhìn những thứ bạn mang về. Có những thứ còn là của người khác.\n\nCon bé không chạy ra ôm bạn. Nó lùi lại, nấp sau lưng người lớn, như đang nhìn một người lạ.\n\nĐêm đó, cả nhà không ai nói với nhau câu nào. Bạn đã về đến nhà, nhưng không còn là người mà họ từng chờ.';
    } else if (c >= 20) {
      kind = 'Kết thúc'; title = 'Về đến nhà';
      story = 'Con bé lao vào lòng bạn, khóc nấc. Người thân đóng cửa, chèn bàn ghế lại sau lưng bạn.\n\nCả nhà đã ở bên nhau. Nhưng có những chuyện trên đường về bạn sẽ không bao giờ kể. Những gương mặt ấy vẫn hiện lên mỗi khi bạn nhắm mắt.';
    } else {
      kind = 'Kết thúc tốt'; title = 'Đoàn tụ';
      story = 'Con bé lao vào lòng bạn, khóc không thành tiếng. Người thân ôm chặt cả hai, run lên.\n\nBên ngoài, mặt đất vẫn rung từng hồi. Nhưng đêm nay cả nhà ở cạnh nhau, và bạn vẫn là người mà họ đã chờ.';
    }
    story = 'Nắp hầm bật tung. Bên dưới là căn phòng nhỏ đầy bao gạo, can nước và một ngọn đèn dầu. Cả nhà lần lượt bước xuống, bạn kéo nắp hầm đóng lại phía trên đầu.\n\n' + story;
    story += '\n\nHết chương 1 · Đường về nhà.\nĐêm nay, dưới lòng đất, có thứ gì đó lại cựa mình.';
    UI.ending(kind, title, story);
  },
};

// ---------------------------------------------------------------- interaction: aim with the crosshair, the target gets a soft outline
function rayBox(o, d, b) {
  let tmin = 0, tmax = 1e9;
  for (let a = 0; a < 3; a++) {
    const oa = a === 0 ? o.x : a === 1 ? o.y : o.z, da = a === 0 ? d.x : a === 1 ? d.y : d.z;
    if (Math.abs(da) < 1e-8) { if (oa < b[a] || oa > b[a + 3]) return -1; continue; }
    let t1 = (b[a] - oa) / da, t2 = (b[a + 3] - oa) / da; if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmax < tmin) return -1;
  }
  return tmin;
}
const _io = new THREE.Vector3(), _id = new THREE.Vector3(), _hp = new THREE.Vector3();
function findInteract() {
  const P = Player; if (P.bike) return null;
  camera.getWorldPosition(_io); camera.getWorldDirection(_id);
  const ex = P.pos.x, ey = P.pos.y + P.height * 0.9, ez = P.pos.z;
  let best = null, bt = 1e9;
  for (const it of INTERACT) {
    if (it.dead) continue;
    if (Math.abs(it.x - ex) > 6 || Math.abs(it.z - ez) > 6) continue;
    const t = rayBox(_io, _id, it.box); if (t < 0) continue;
    _hp.copy(_io).addScaledVector(_id, t);
    const reach = Math.hypot(_hp.x - ex, _hp.y - ey, _hp.z - ez); if (reach > 2.6) continue;
    if (t < bt) { bt = t; best = it; }
  }
  if (best) { _hp.copy(_io).addScaledVector(_id, bt); if (!lineOfSight(ex, ey, ez, _hp.x, _hp.y, _hp.z, 0.35)) best = null; }
  if (!best) { // fallback for touch / sloppy aim: something right in front of you
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let bd = 1e9;
    for (const it of INTERACT) {
      if (it.dead || Math.abs(it.y - P.pos.y - 0.8) > 1.6) continue; const dx = it.x - P.pos.x, dz = it.z - P.pos.z, d = Math.hypot(dx, dz); if (d > (isTouch ? 2.0 : 1.4)) continue;
      const dot = (dx * fx + dz * fz) / (d || 1); if (d > 0.8 && dot < 0.5) continue;
      const sc = d - dot; if (sc < bd) { bd = sc; best = it; }
    }
  }
  return best;
}
const HL = new THREE.Group(); HL.visible = false; scene.add(HL);
const HL_EDGE = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.8 }));
const HL_FILL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.07, depthWrite: false }));
HL.add(HL_EDGE); HL.add(HL_FILL);
function highlight(it) {
  if (!it) { HL.visible = false; return; }
  const b = it.box, pad = 0.035;
  HL.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); HL.scale.set(b[3] - b[0] + pad * 2, b[4] - b[1] + pad * 2, b[5] - b[2] + pad * 2);
  let col = 0xffd08a; // amber: not searched yet
  if (it.kind === 'container') { const c = it.ref; if (c.searched && !c.items.length && !(c.money > 0)) col = 0x8a8d90; else if (c.searched) col = 0xf1ece0; }
  else if (it.kind === 'npc' || it.kind === 'bike') col = 0xbfe0ff;
  else if (it.kind === 'shutter') col = 0xe0453a;
  HL_EDGE.material.color.setHex(col); HL_FILL.material.color.setHex(col);
  const pulse = 0.6 + Math.sin(Game.time * 5) * 0.2; HL_EDGE.material.opacity = pulse; HL_FILL.material.opacity = 0.07 + pulse * 0.06;
  HL.visible = true;
}
function promptFor(it) {
  const P = Player;
  if (it.kind === 'container') {
    const c = it.ref;
    const owned = c.B && c.B.owner && !c.B.owner.dead && c.B.owner.flee <= 0; if (owned) return `<kbd>E</kbd>${esc(c.label)} <span style="color:var(--dim)">(của chủ tiệm)</span>`;
    if (c.body && c.body.unc && !c.body.helped) return `<kbd>E</kbd>${esc(c.label)} <span style="color:var(--dim)">(còn thở)</span>`;
    const empty = c.searched && !c.items.length && !(c.money > 0);
    return `<kbd>E</kbd>${c.searched ? 'Xem lại' : 'Lục soát'}: ${esc(c.label)}${empty ? ' <span style="color:var(--dim)">(đã lục, trống)</span>' : c.searched ? ` <span style="color:var(--dim)">(còn ${c.items.length} món)</span>` : ''}`;
  }
  if (it.kind === 'pickup') { const p = it.ref, iv = ITEMS[p.id]; return `<kbd>E</kbd>Nhặt ${esc(iv.n)}${iv.weapon && !iv.gun ? ` <span style="color:var(--dim)">vũ khí · ${iv.weapon} lần đánh</span>` : ''}`; }
  if (it.kind === 'npc') { const n = it.ref; return n.kind === 'owner' ? `<kbd>E</kbd>Nói chuyện với chủ tiệm` : n.kind === 'family' ? `<kbd>E</kbd>Về với gia đình` : `<kbd>E</kbd>Nói chuyện: ${esc(n.data.who)}`; }
  if (it.kind === 'bike') { const b = it.ref; return b.fuel > 0 ? `<kbd>F</kbd>Lên xe máy <span style="color:var(--dim)">xăng ${Math.round(b.fuel)}%</span>` : `Xe hết xăng${P.has('canxang') ? ' · mở Túi để đổ xăng' : ''}`; }
  if (it.kind === 'hatch') return QUEST.stage === 'home' ? 'Nắp hầm trú ẩn (gặp gia đình trước đã)' : P.has('xabeng') ? '<kbd>Giữ E</kbd>Cạy nắp hầm bằng xà beng' : 'Nắp hầm kẹt cứng. Cần xà beng.';
  if (it.kind === 'shutter') return P.has('xabeng') ? `<kbd>Giữ E</kbd>Cạy cửa cuốn bằng xà beng` : `<kbd>Giữ E</kbd>Phá cửa cuốn <span style="color:var(--red)">(rất ồn)</span>`;
  return '';
}
function doInteract(it) {
  const P = Player;
  if (it.kind === 'container') {
    const c = it.ref; const B = c.B;
    if (B && B.owner && !B.owner.dead && B.owner.flee <= 0) { shopDialog(B); return; }
    if (c.body && c.body.unc && !c.body.helped) { bodyDialog(c.body); return; }
    if (!c.searched) { Game.hold = { it, t: 0, dur: P.armHurt() ? 1.5 : 0.8, fn: () => { c.searched = true; emitNoise(c.x, c.z, 4, 'step'); UI.openLoot(c); } }; return; }
    UI.openLoot(c); return;
  }
  if (it.kind === 'pickup') {
    const p = it.ref; Game.hold = { it, t: 0, dur: 0.4, fn: () => { if (!P.add(p.id)) { UI.toast('Không mang thêm được nữa', 'bad'); return; } killPickup(p); Snd.pickup(); UI.toast(`Đã nhặt ${ITEMS[p.id].n}${ITEMS[p.id].weapon ? '. Chuột trái để đánh trả.' : ''}`, 'good'); } };
    return;
  }
  if (it.kind === 'npc') { npcDialog(it.ref); return; }
  if (it.kind === 'bike') { mount(it.ref); return; }
  if (it.kind === 'hatch') { if (QUEST.stage !== 'home' && P.has('xabeng')) Game.hold = { it, t: 0, dur: 3, tick: 8, fn: () => { Snd.metal(); Game.win(); } }; return; }
  if (it.kind === 'shutter') {
    const B = it.ref; const pry = P.has('xabeng');
    Game.hold = { it, t: 0, dur: pry ? 2.4 : 4.2, tick: pry ? 18 : 38, fn: () => {
      B.closed = false; B.shutterCol.dead = true; B.shutterMesh.visible = false; it.dead = true;
      Snd.metal(); emitNoise(B.front.x, B.front.z, pry ? 22 : 45, 'crash'); P.cruelty = Math.min(100, P.cruelty + 2);
      UI.toast(pry ? 'Cửa cuốn bật mở. (+2 tàn nhẫn)' : 'Cửa cuốn bung ra với tiếng động lớn! (+2 tàn nhẫn)', pry ? '' : 'bad');
    } };
  }
}
function bodyDialog(b) {
  const P = Player; const drink = P.inv.find(i => ITEMS[i].cat === 'drink');
  UI.dialog(b.kind === 'sol' ? 'Người lính bất tỉnh' : 'Người bất tỉnh', b.kind === 'sol' ? 'Anh ta nằm cạnh khẩu súng, mặt dính đầy bụi. Ngực vẫn còn phập phồng.' : 'Người này nằm úp giữa đường, bụi phủ kín tóc. Vẫn còn thở, nhưng rất yếu.', [
    { t: drink ? `Đỡ dậy, cho uống ${ITEMS[drink].n}` : 'Đỡ dậy (cần nước uống)', note: drink ? '−6 tàn nhẫn' : 'bạn không có', primary: !!drink, disabled: !drink, fn: () => {
      P.remove(drink); P.cruelty = Math.max(0, P.cruelty - 6); P.helped++;
      const gift = b.c.items.find(i => i !== 'sungtruong' && i !== 'dongho') || null; let extra = '';
      if (gift && P.add(gift)) { b.c.items.splice(b.c.items.indexOf(gift), 1); extra = ` Họ dúi vào tay bạn ${ITEMS[gift].n}.`; }
      const keep = b.c.items.filter(i => i === 'sungtruong' || i === 'bangdan'); // a soldier leaves his rifle for you
      if (b.kind === 'sol' && keep.length) { for (const id of keep) P.add(id); extra += ' Anh ta đưa súng cho bạn: "Cầm lấy… tôi không còn sức bắn nữa."'; if (b.gunMesh) b.gunMesh.visible = false; }
      b.wake(); UI.dialog(b.kind === 'sol' ? 'Người lính' : 'Người lạ', `Họ ho sặc sụa rồi mở mắt. "Cảm ơn… cảm ơn."${extra}`, [{ t: 'Đi tiếp', fn: () => UI.close() }]);
    } },
    { t: 'Lục soát đồ của họ', note: '+5 tàn nhẫn', danger: true, fn: () => { b.helped = true; b.c.searched = true; UI.openLoot(b.c); } },
    { t: 'Để họ lại', fn: () => UI.close() },
  ]);
}
function shopDialog(B) {
  const o = B.owner, P = Player;
  const stock = []; for (const c of B.conts) c.items.forEach((id, k) => stock.push({ c, k, id }));
  const groups = {}; for (const s of stock) (groups[s.id] = groups[s.id] || []).push(s);
  const ch = Object.keys(groups).slice(0, 7).map(id => { const it = ITEMS[id], n = groups[id].length; const price = Math.max(5000, Math.round(it.p * 1.5 / 1000) * 1000); return { t: `Mua ${it.n}${n > 1 ? ` (còn ${n})` : ''}`, note: money(price), disabled: P.money < price || !P.canCarry(id), fn: () => { if (P.money < price || !P.add(id)) return; P.money -= price; const s = groups[id][0]; const i = s.c.items.indexOf(id); if (i >= 0) s.c.items.splice(i, 1); refreshGoods(s.c); Snd.pickup(); UI.toast(`Đã mua ${it.n}`, 'good'); shopDialog(B); } }; });
  ch.push({ t: 'Rời đi', fn: () => UI.close() });
  UI.dialog(`Chủ ${TYPE_NAME[B.type].toLowerCase()} · bạn có ${money(P.money)}`, stock.length ? OWNER_LINES[B.type] : 'Hết hàng rồi. Đi đi, đừng ở đây gây chú ý.', ch);
}
function npcDialog(n) {
  const P = Player;
  if (n.kind === 'owner') { shopDialog(n.B); return; }
  if (n.kind === 'family') { familyDialog(); return; }
  const d = n.data;
  if (n.helped) { UI.dialog(d.who, d.tip, [{ t: 'Giữ an toàn nhé', fn: () => UI.close() }]); return; }
  const needIds = d.need === 'drink' ? P.inv.filter(i => ITEMS[i].cat === 'drink') : d.need === 'food' ? P.inv.filter(i => ITEMS[i].cat === 'food' || i === 'suahop') : d.need === 'med' ? P.inv.filter(i => ['bang', 'nep', 'socuu'].includes(i)) : [];
  const ch = [];
  if (d.need) {
    const give = needIds[0];
    ch.push({ t: give ? `Cho ${ITEMS[give].n}` : `Cho ${d.need === 'drink' ? 'nước uống' : d.need === 'food' ? 'đồ ăn' : 'băng gạc hoặc nẹp'}`, note: give ? '−8 tàn nhẫn' : 'bạn không có', primary: !!give, disabled: !give, fn: () => {
      P.remove(give); P.cruelty = Math.max(0, P.cruelty - 8); P.helped++; n.helped = true;
      const gift = n.items.shift(); let extra = ''; if (gift && P.add(gift)) extra = ` Họ dúi cho bạn ${ITEMS[gift].n}.`;
      UI.dialog(d.who, `"Cảm ơn… cảm ơn nhiều lắm."${extra}\n\n${d.tip}`, [{ t: 'Đi tiếp', fn: () => UI.close() }]);
    } });
  } else ch.push({ t: 'Hỏi đường', note: 'thông tin', primary: true, fn: () => { n.helped = true; const gift = n.items.shift(); let extra = ''; if (gift && P.add(gift)) extra = ` Cậu ấy đưa bạn ${ITEMS[gift].n}.`; UI.dialog(d.who, `${d.tip}${extra}`, [{ t: 'Cảm ơn', fn: () => UI.close() }]); } });
  ch.push({ t: 'Bỏ đi', fn: () => UI.close() });
  UI.dialog(d.who, d.line, ch);
}

// ---------------------------------------------------------------- survival
function survival(dt) {
  const P = Player; P.time += dt;
  if (GOD.on) { P.hp = 100; P.food = 100; P.water = 100; P.stam = 100; P.injuries = []; P.noise = 0; return; }
  const act = (P.sprinting ? 1.7 : 1) * DIFF.drain;
  P.food = Math.max(0, P.food - dt * 100 / 900 * act); P.water = Math.max(0, P.water - dt * 100 / 620 * act);
  if (P.food <= 0 || P.water <= 0) { P.hp -= 0.55 * DIFF.bleed * dt; if (!P._starveWarn) { P._starveWarn = true; UI.toast(P.water <= 0 ? 'Bạn khát khô cổ. Máu đang giảm!' : 'Bạn đói lả. Máu đang giảm!', 'bad'); } } else P._starveWarn = false;
  let bleeding = false, infected = false;
  for (const i of P.injuries) {
    i.t += dt;
    if (i.type === 'bleed') { bleeding = true; P.hp -= 0.32 * DIFF.bleed * dt; if (i.t > 100 / DIFF.bleed && !i.inf) { i.inf = true; P.injuries.push({ part: i.part, type: 'infect', t: 0 }); UI.toast(`${PART_NAME[i.part]}: vết thương bắt đầu nhiễm trùng`, 'bad'); } }
    if (i.type === 'infect') { infected = true; P.hp -= 0.12 * DIFF.bleed * dt; }
  }
  P.injuries = P.injuries.filter(i => !((i.type === 'bruise' && i.t > 90) || (i.type === 'concuss' && i.t > 160)));
  if (P.pendingInfect) { P.pendingInfect.t -= dt; if (P.pendingInfect.t <= 0) { P.injuries.push({ part: P.pendingInfect.part, type: 'infect', t: 0 }); UI.toast(`${PART_NAME[P.pendingInfect.part]}: vết băng không được sát trùng, đã nhiễm trùng`, 'bad'); P.pendingInfect = null; } }
  if (P.cleaned > 0) P.cleaned -= dt; if (P.painkiller > 0) P.painkiller -= dt;
  if (infected) P.stam = Math.min(P.stam, 70);
  if (!bleeding && !infected && P.food > 35 && P.water > 35) P.hp = Math.min(100, P.hp + 0.22 / Math.sqrt(DIFF.bleed) * dt);
  if (P.hp <= 0) Game.die(P.food <= 0 || P.water <= 0 || bleeding ? 'starve' : 'blunt');
}

// ---------------------------------------------------------------- camera
const _camT = new THREE.Vector3();
function cameraUpdate(dt) {
  const P = Player; const conc = P.hasInj('concuss') && P.painkiller <= 0;
  const sh = Shake.t * Shake.t; const sx = (Math.random() - 0.5) * sh * 0.9, sy = (Math.random() - 0.5) * sh * 0.9;
  const wob = conc ? Math.sin(Game.time * 1.3) * 0.035 : 0;
  P.recoil = Math.max(0, (P.recoil || 0) - dt * 8);
  if (P.bike) {
    const b = P.bike;
    if (P.lookHold > 0) P.lookHold -= dt; else P.yaw = b.rot + angleDiff(b.rot, P.yaw) * Math.exp(-2.5 * dt);
    if (P.tp) {
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      _camT.set(b.x - fx * 5, 2.6 - P.pitch * 2, b.z - fz * 5); camera.position.lerp(_camT, 1 - Math.exp(-10 * dt));
      camera.lookAt(b.x + fx * 2, 1.3, b.z + fz * 2);
    } else {
      camera.position.set(b.x - Math.sin(b.rot) * 0.05, 1.62, b.z - Math.cos(b.rot) * 0.05);
      camera.rotation.set(P.pitch + sy, P.yaw + sx, -b.lean * 0.5 + wob);
    }
    playerModel.visible = false; viewModel.visible = false; b.rider.visible = P.tp;
    return;
  }
  P.bob = (P.bob || 0) + dt * P.speedNow * 1.9;
  const bobY = P.onGround ? Math.sin(P.bob * 2) * 0.035 * Math.min(1, P.speedNow / 3) : 0;
  playerModel.position.set(P.pos.x, P.pos.y, P.pos.z); playerModel.rotation.y = P.yaw;
  animHuman(playerModel, P.speedNow, dt, P.crouch, false);
  if (P.swingT > 0) playerModel.userData.ra.rotation.x = -2.2 + (0.35 - P.swingT) * 6;
  const pitch = P.pitch + P.recoil * 0.03;
  if (P.tp) {
    const fx = -Math.sin(P.yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(P.yaw) * Math.cos(pitch);
    const tgt = new THREE.Vector3(P.pos.x + Math.cos(P.yaw) * 0.45, P.pos.y + P.height * 0.95, P.pos.z - Math.sin(P.yaw) * 0.45);
    let dist = 3.6;
    for (let d = 0.6; d <= 3.6; d += 0.3) { const x = tgt.x - fx * d, y = tgt.y - fy * d, z = tgt.z - fz * d; let blocked = false; queryCols(x - 0.2, z - 0.2, x + 0.2, z + 0.2, b => { if (b.sight && x > b.minX - 0.2 && x < b.maxX + 0.2 && z > b.minZ - 0.2 && z < b.maxZ + 0.2 && y > b.minY - 0.2 && y < b.maxY + 0.2) blocked = true; }); if (blocked) { dist = Math.max(0.4, d - 0.4); break; } }
    camera.position.set(tgt.x - fx * dist, tgt.y - fy * dist, tgt.z - fz * dist);
    camera.rotation.set(pitch + sy, P.yaw + sx, wob);
    playerModel.visible = dist > 0.9; viewModel.visible = false;
  } else {
    camera.position.set(P.pos.x, P.pos.y + P.height * 0.93 + bobY, P.pos.z); camera.rotation.set(pitch + sy, P.yaw + sx, wob);
    playerModel.visible = false;
    const w = curWeapon(); const fist = !w && P.swingT > 0; viewModel.visible = !!w || fist;
    for (const k in VM) VM[k].visible = k === (w || (fist ? 'none' : ''));
    const s = P.swingT > 0 ? Math.sin((0.35 - P.swingT) / 0.35 * Math.PI) : 0;
    const rl = P.reloadT > 0 ? Math.sin(Math.min(1, (1.6 - P.reloadT) / 1.6) * Math.PI) : 0;
    if (w && ITEMS[w].gun) { viewModel.position.set(0.22, -0.2 - rl * 0.15 + Math.sin(P.bob * 2) * 0.008, -0.38 + P.recoil * 0.06); viewModel.rotation.set(0.02 + P.recoil * 0.12 - rl * 0.6, 0.04, rl * 0.4); }
    else { viewModel.position.set(0.32 - s * 0.25, -0.28 + Math.sin(P.bob * 2) * 0.012 + s * 0.12, -0.45 - s * 0.25); viewModel.rotation.set(0.5 - s * 1.6, 0.1 + s * 0.6, 0.2); }
  }
  renderer.domElement.style.filter = conc ? 'blur(0.8px) saturate(0.8)' : '';
}

// ---------------------------------------------------------------- per-frame ambience
function ambience(dt) {
  const P = Player;
  for (const f of FIRES) {
    const d = dist2(f[0], f[2], P.pos.x, P.pos.z); if (d > FOG_FAR) continue; const s = f[3] || 1;
    if (d < 140 && Math.random() < 0.6 * s) FX.fire.emit(f[0] + R(-0.6, 0.6) * s, f[1], f[2] + R(-0.6, 0.6) * s, R(-0.3, 0.3), R(1, 2.2), R(-0.3, 0.3), R(0.4, 0.9));
    if (Math.random() < 0.18 * s) FX.smoke.emit(f[0], f[1] + 2, f[2], R(-0.4, 0.4) + 0.6, R(2, 3.5), R(-0.4, 0.4), R(8, 13), 0.1);
  }
  for (const s of FX_SPOTS) { if (Math.random() < 0.02 && dist2(s[0], s[1], P.pos.x, P.pos.z) < 160) FX.smoke.emit(s[0] + R(-3, 3), 1, s[1] + R(-3, 3), 0.4, R(1, 2), 0, R(6, 10), 0.1); }
  SKY.material.uniforms.time.value = Game.time + 300;
  for (let k = 0; k < 2; k++) FX.ash.emit(P.pos.x + R(-25, 25), P.pos.y + R(8, 18), P.pos.z + R(-25, 25), R(-0.6, 0.6) + 0.4, R(-0.3, 0), R(-0.6, 0.6), 9, 0.3);
  if (Math.random() < 0.5) FX.mote.emit(P.pos.x + R(-8, 8), R(0.3, 3.5), P.pos.z + R(-8, 8), R(-0.3, 0.3), R(-0.1, 0.2), R(-0.3, 0.3), 4, 0.2);
  let prox = 0, aw = 0; for (const M of MONSTERS) { prox = Math.max(prox, M.prox || 0); aw = Math.max(aw, M.aw); }
  Snd.rumble(prox * 0.9); if (prox > 0.4) Shake.t = Math.max(Shake.t, (prox - 0.4) * 0.25);
  Game.heartT -= dt; if (aw > 0.5 && Game.heartT <= 0) { Game.heartT = aw >= 1 ? 0.55 : 0.85; Snd.heart(Math.min(1, aw)); }
  if (WATER) WATER.material.emissive.setRGB(0.05 + Math.sin(Game.time * 0.8) * 0.01, 0.08, 0.075);
  sun.position.set(P.pos.x - 60, 95, P.pos.z + 40); sun.target.position.set(P.pos.x, 0, P.pos.z); sun.target.updateMatrixWorld();
  // interiors only exist near you
  Game.cullT = (Game.cullT || 0) - dt;
  if (Game.cullT <= 0 || dist2(P.pos.x, P.pos.z, Game.cullX || 0, Game.cullZ || 0) > 25) { Game.cullT = 0.4; Game.cullX = P.pos.x; Game.cullZ = P.pos.z; const cx = P.pos.x, cz = P.pos.z; for (const B of BUILDINGS) if (B.imesh) B.imesh.visible = Math.abs(B.cx - cx) < 75 && Math.abs(B.cz - cz) < 75; for (const p of PICKUPS) if (!p.dead) p.mesh.visible = Math.abs(p.x - cx) < 90 && Math.abs(p.z - cz) < 90; for (const b of BODIES) b.model.visible = b.model.visible && !b.c.dead; }
  for (const b of BODIES) if (b.unc) b.update(dt, Game.time);
  if (MUZZLE.visible) { MUZZLE.userData.t -= dt; MUZZLE.rotation.z = R(0, 3); if (MUZZLE.userData.t <= 0) MUZZLE.visible = false; }
  if (TRACER.visible) { TRACER.userData.t -= dt; if (TRACER.userData.t <= 0) TRACER.visible = false; }
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (Game.state === 'title') { titleCam(dt); FX.update(dt); renderer.render(scene, camera); return; }
  if (Game.state === 'end') { FX.update(dt); for (const M of MONSTERS) M.update(dt * 0.5); renderer.render(scene, camera); return; }
  if (UI.modal === 'pause') { renderer.render(scene, camera); return; }
  tick(dt);
  renderer.render(scene, camera);
}
function tick(dt) {
  if (UI.modal) { Input.pressed.clear(); Input.mdx = Input.mdy = 0; dt *= 0.25; }
  Game.time += dt;
  const P = Player;
  if (!UI.modal) {
    if (Input.tap('Tab') || Input.tap('KeyI')) UI.openInv();
    else if (Input.tap('KeyM')) UI.openMap();
    else if (Input.tap('KeyP') || Input.tap('Escape')) UI.openPause();
    if (Input.tap('KeyG') && GOD.on) { GOD.fly = !GOD.fly; if (GOD.fly && Player.bike) dismount(); UI.toast(GOD.fly ? 'Đang bay: Space lên, Shift xuống, Ctrl bay nhanh, [G] để hạ cánh.' : 'Đã hạ cánh.'); }
    if (Input.tap('KeyZ')) { MM.zi = (MM.zi + 1) % MM_ZOOMS.length; UI.toast(`Bản đồ nhỏ: ${MM_ZOOMS[MM.zi] * 2}m`); }
  }
  if (Input.mdx || Input.mdy) P.lookHold = 1.2;
  const tq = performance.now(); playerUpdate(dt); if (window.__prof) window.__prof.player = (window.__prof.player || 0) + performance.now() - tq;
  { const B = P.bike ? null : interiorAt(P.pos.x, P.pos.z); P.indoors = B && !(B.roofY != null && P.pos.y > B.roofY - 0.3) ? B : null; }
  let target = null;
  if (!UI.modal && !P.dead) {
    if (P.swingCd > 0) P.swingCd -= dt; if (P.swingT > 0) P.swingT -= dt;
    if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) { P.mag = P.reloadTo || 10; UI.toast('Đã nạp đạn.'); } }
    if (Input.tap('Mouse0')) attack();
    if (Input.tap('KeyR')) reloadGun();
    if (Input.tap('KeyQ')) throwItem();
    if (Input.tap('KeyF')) { if (P.bike) dismount(); else { const b = BIKES.find(b => dist2(b.x, b.z, P.pos.x, P.pos.z) < 2.6); if (b) mount(b); } }
    const tf = performance.now(); target = findInteract(); if (window.__prof) window.__prof.find = (window.__prof.find || 0) + performance.now() - tf;
    if (Game.hold) {
      const H = Game.hold; const still = Input.down('KeyE') && target === H.it;
      if (!still) { Game.hold = null; UI.progress(null); }
      else { H.t += dt; UI.progress(H.t / H.dur); if (H.tick) { H.nt = (H.nt || 0) - dt; if (H.nt <= 0) { H.nt = 0.6; emitNoise(P.pos.x, P.pos.z, H.tick, 'crash'); Snd.burst({ dur: 0.2, freq: 900, q: 4, type: 'bandpass', gain: 0.25 }); } } if (H.t >= H.dur) { Game.hold = null; UI.progress(null); H.fn(); } }
    }
    if (target) { UI.prompt(promptFor(target)); if (Input.tap('KeyE') && !Game.hold) doInteract(target); } else { UI.prompt(null); Input.tap('KeyE'); }
  } else UI.prompt(null);
  highlight(UI.modal ? null : target);
  Input.pressed.delete('Space'); Input.pressed.delete('KeyV'); Input.pressed.delete('KeyC');
  P.noiseT = (P.noiseT || 0) - dt; if (P.noiseT <= 0) { P.noiseT = 0.3; if (P.noise > 0.5 && !GOD.on) emitNoise(P.pos.x, P.pos.z, P.noise, P.bike ? 'engine' : 'step'); }
  const PF = window.__prof; let t0 = PF ? performance.now() : 0; const mark = k => { if (PF) { const t = performance.now(); PF[k] = (PF[k] || 0) + t - t0; t0 = t; } };
  survival(dt); mark('surv');
  for (const M of MONSTERS) M.update(dt); mark('mon');
  for (const n of NPCS) n.update(dt); mark('npc');
  updateRunners(dt); mark('run');
  updateThrown(dt); updateFireballs(dt); updateCollapses(dt); FX.update(dt); Shake.update(dt); mark('fx');
  radarUpdate(dt); navUpdate(dt); questTick();
  // warn at the edge of the fissure
  if (Math.abs(P.pos.x - (CRACK.x0 + CRACK.x1) / 2) < 12 && (!Game.crackTip || Game.time - Game.crackTip > 25)) { Game.crackTip = Game.time; UI.toast('Vết nứt sâu hun hút, không nhảy qua được. Tìm chỗ có tấm ván hoặc cột điện đổ bắc ngang (vạch vàng trên bản đồ).'); }
  ambience(dt); mark('amb');
  cameraUpdate(dt); mark('cam');
  UI.hud(dt); UI.compass(); mark('hud'); UI.minimap(); mark('mini');
}
addEventListener('keydown', e => {
  if (Game.state !== 'play' || e.repeat) return;
  if (UI.modal === 'inv' && (e.code === 'Tab' || e.code === 'KeyI' || e.code === 'Escape')) { e.preventDefault(); UI.close(); Input.pressed.clear(); }
  else if (UI.modal === 'map' && (e.code === 'KeyM' || e.code === 'Escape')) { UI.close(); Input.pressed.clear(); }
  else if (UI.modal === 'loot' && (e.code === 'KeyE' || e.code === 'Escape')) { UI.close(); Input.pressed.clear(); }
  else if (UI.modal === 'dlg' && e.code === 'Escape') { UI.close(); Input.pressed.clear(); }
  else if (UI.modal === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) { UI.close(); Input.pressed.clear(); }
});

let titleT = 0;
function titleCam(dt) {
  titleT += dt;
  const T = MONSTERS[0]; if (T) T.update(dt);
  const a = -0.5 + titleT * 0.01;
  camera.position.set(-150 + Math.cos(a) * 120, 16 + Math.sin(titleT * 0.1) * 2, 40 + Math.sin(a) * 60);
  camera.lookAt(T ? T.x : -100, 28, T ? T.z : 0);
  sun.position.set(camera.position.x - 60, 95, camera.position.z + 40); sun.target.position.set(camera.position.x, 0, camera.position.z); sun.target.updateMatrixWorld();
  if (FIRES.length && Math.random() < 0.5) for (const f of FIRES) if (Math.random() < 0.1) FX.smoke.emit(f[0], f[1] + 2, f[2], R(-0.4, 0.4) + 0.6, R(2, 3.5), R(-0.4, 0.4), R(8, 13), 0.1);
}

Titan.prototype.posePreview = function () {
  this.state = 'preview'; this.x = -40; this.z = -60; this.heading = -2.4; this.bodyY = 40;
  for (const L of this.gait.legs) L.up.visible = L.lo.visible = L.kn.visible = true; for (const T of this.tent) for (const s of T.segs) s.visible = true;
  this.root.position.set(this.x, this.bodyY, this.z); this.root.rotation.y = this.heading; this.root.updateMatrixWorld(); this.gait.inited = false;
};
const _titanUpdate = Titan.prototype.update;
Titan.prototype.update = function (dt) {
  if (this.state === 'preview') {
    this.t += dt; const sp = 1.6; this.heading += dt * 0.02;
    this.x += Math.sin(this.heading) * sp * dt; this.z += Math.cos(this.heading) * sp * dt;
    this.vel.set(Math.sin(this.heading) * sp, 0, Math.cos(this.heading) * sp);
    this.root.position.set(this.x, this.bodyY + Math.sin(this.t * 1.8) * 0.6, this.z); this.root.rotation.set(0, this.heading, 0); this.root.updateMatrixWorld();
    const saved = this.gait.onLand, savedL = this.gait.onLift; this.gait.onLand = null; this.gait.onLift = null; this.gait.update(dt, this.root.matrixWorld, this.vel, this.root.position); this.gait.onLand = saved; this.gait.onLift = savedL;
    this.updateTentacles(dt); return;
  }
  _titanUpdate.call(this, dt);
};
Titan.prototype.resetDormant = function () {
  this.state = 'dormant'; this.x = LAKE.x; this.z = LAKE.z; this.heading = -Math.PI / 2; this.bodyY = -48; this.aw = 0; this.t = 0; this.atk = null; this.ring.visible = false;
  this.root.position.set(this.x, this.bodyY, this.z); this.root.rotation.set(0, this.heading, 0); this.root.updateMatrixWorld(); this.gait.inited = false;
  for (const L of this.gait.legs) { L.up.visible = L.lo.visible = L.kn.visible = false; if (L.decal) L.decal.visible = false; } for (const T of this.tent) for (const s of T.segs) s.visible = false;
};

// ---------------------------------------------------------------- boot
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load("900 64px 'Big Shoulders Display'"), document.fonts.load("700 20px 'Be Vietnam Pro'")]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  genWorld(); spawnBikes(); spawnMonsters(); spawnNPCs();
  for (const [x, z] of BLOCK_COLLAPSE) { const B = buildingAt(x, z); if (B) collapseBuilding(B, true, true); }
  navBuild(); navField(); placeHatch();
  MONSTERS[0].posePreview();
  Player.reset();
  renderLegend();
  $('#load-note').textContent = isTouch ? 'Đã sẵn sàng. Trên điện thoại: cần gạt bên trái để đi, vuốt màn hình để nhìn.' : 'Đã sẵn sàng. Nên dùng tai nghe: tiếng động là thứ giữ bạn sống sót.';
  $('#btn-start').disabled = false;
  requestAnimationFrame(frame);
  let skip = false; try { skip = sessionStorage.getItem('tg-skip') === '1'; sessionStorage.removeItem('tg-skip'); } catch (e) { }
  if (skip) Game.start();
}
$('#btn-start').disabled = true;
$('#btn-start').addEventListener('click', () => Game.start());
window.__game = { THREE, navBuild, navField, NAV, TUNNELS, navCell, queryCols, npcInFront, attack, START, HOME: () => HOME, CRACK, tick: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { if (Game.state !== 'play') break; tick(dt); } }, FX, Snd, emitNoise, collapseBuilding, Game, Player, MONSTERS, BUILDINGS, NPCS, BIKES, INTERACT, UI, Input, scene, camera, renderer, BODIES, RUNNERS, PICKUPS, CONTAINERS, ROADBLOCKS, findInteract, shoot, Runner, GOD, setGod };
boot();

// ---------------------------------------------------------------- final stage: the shelter under the kitchen needs a crowbar, lent to ông Tư
const QUEST = { stage: 'home', house: null, box: null };
function familyDialog() {
  const P = Player;
  if (QUEST.stage === 'home') {
    UI.dialog('Nhà', 'Tiếng khóa cửa lách cách. Một giọng nói run run vọng ra: "Ai… ai đấy?"', [
      { t: 'Là mình đây. Mở cửa đi.', primary: true, fn: () => {
        const has = P.has('xabeng');
        UI.dialog('Người thân', `Con bé lao ra ôm chầm lấy bạn, khóc nấc. Người thân kéo bạn vào nhà, nói thật nhanh:\n\n"Dưới bếp có căn hầm trú ẩn bố làm từ hồi trước. Nắp hầm kẹt cứng, phải cạy bằng xà beng… mà hôm trước mình cho ông Tư mượn mất rồi. Nhà ông ấy cách đây chừng hai trăm mét."`, [
          has ? { t: 'Mình có xà beng đây. Mở hầm thôi.', primary: true, fn: () => { QUEST.stage = 'hatch'; UI.close(true); UI.toast('Nắp hầm ở góc bếp, phía sau nhà. Giữ [E] để cạy.', 'good'); } }
              : { t: 'Để mình sang nhà ông Tư lấy xà beng.', primary: true, fn: () => { startCrowbarQuest(); UI.close(); } },
          { t: 'Ở lại một chút đã', fn: () => { if (!has) startCrowbarQuest(); else QUEST.stage = 'hatch'; UI.close(); } },
        ]);
      } },
      { t: 'Đợi đã, mình cần đi tìm thêm đồ tiếp tế', fn: () => UI.close() },
    ]); return;
  }
  if (QUEST.stage === 'crowbar') { UI.dialog('Người thân', P.has('xabeng') ? '"Có xà beng rồi à? Cạy nắp hầm dưới bếp đi, nhanh lên!"' : '"Nhà ông Tư có dấu xanh trên bản đồ đấy. Đi cẩn thận, nhớ quay về."', [{ t: 'Ừ', fn: () => UI.close() }]); return; }
  UI.dialog('Người thân', '"Nắp hầm ở góc bếp. Cạy ra đi, cả nhà xuống đó trú."', [{ t: 'Ừ', fn: () => UI.close() }]);
}
function startCrowbarQuest() {
  if (QUEST.stage !== 'home') return;
  QUEST.stage = 'crowbar';
  const cands = BUILDINGS.filter(B => B.type === 'house' && B.enterable && !B.collapsed && !B.home && B.levels >= 1 && Math.hypot(B.cx - HOME.cx, B.cz - HOME.cz) > 160 && Math.hypot(B.cx - HOME.cx, B.cz - HOME.cz) < 240);
  const B = QUEST.house = pick(cands.length ? cands : BUILDINGS.filter(b => b.type === 'house' && b.enterable && !b.collapsed && !b.home));
  B.quest = true;
  const p = B.toWorld(B.w * 0.5 + 0.9, 1.3);
  const m = new MB(); m.box(p[0] - 0.35, 0, p[1] - 0.22, p[0] + 0.35, 0.32, p[1] + 0.22, '#c8302a'); m.box(p[0] - 0.12, 0.32, p[1] - 0.03, p[0] + 0.12, 0.4, p[1] + 0.03, '#222'); m.box(p[0] - 0.5, 0.02, p[1] + 0.1, p[0] + 0.45, 0.06, p[1] + 0.16, '#3d4d6b', { ry: 0.3 }); scene.add(meshFrom(m));
  QUEST.box = addContainer(p[0], 0.3, p[1], 'Góc đồ nghề nhà ông Tư', null, 0, B, { items: ['xabeng', 'bang', 'nuocsuoi'], box: [p[0] - 0.55, 0, p[1] - 0.3, p[0] + 0.5, 0.45, p[1] + 0.3] });
  NAV.goal = { x: B.inside.x, z: B.inside.z, fx: B.front.x, fz: B.front.z }; NAV.dirty = true; MAPDIRTY.v = true;
  UI.toast('Nhà ông Tư được đánh dấu xanh trên bản đồ. Lấy xà beng rồi quay về mở hầm.', 'good');
}
function questTick() {
  if (QUEST.stage === 'crowbar' && Player.has('xabeng') && NAV.goal) { NAV.goal = null; NAV.dirty = true; UI.toast('Có xà beng rồi! Quay về nhà, cạy nắp hầm dưới bếp.', 'good'); }
  const el = $('#objective'); let t;
  if (QUEST.stage === 'home') t = 'Về nhà với gia đình';
  else if (QUEST.stage === 'crowbar') t = Player.has('xabeng') ? 'Mang xà beng về nhà, cạy nắp hầm dưới bếp' : 'Đến nhà ông Tư (dấu xanh) lấy xà beng';
  else t = 'Cạy nắp hầm dưới bếp [giữ E]';
  if (el.textContent !== t) el.textContent = t;
}
// the hatch itself
function placeHatch() {
  const B = HOME, p = B.toWorld(B.w * 0.68, B.d - 2.2);
  const m = new MB(); m.box(p[0] - 0.75, 0.03, p[1] - 0.6, p[0] + 0.75, 0.08, p[1] + 0.6, '#5a5f64', { pat: 4 }); m.box(p[0] - 0.2, 0.08, p[1] - 0.05, p[0] + 0.2, 0.13, p[1] + 0.05, '#2a2a2a'); scene.add(meshFrom(m));
  QUEST.hatch = addInteract({ x: p[0], y: 0.4, z: p[1], r: 2.4, kind: 'hatch', box: [p[0] - 0.8, 0, p[1] - 0.65, p[0] + 0.8, 0.2, p[1] + 0.65] });
}
