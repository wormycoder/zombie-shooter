'use strict';
// ---------------------------------------------------------------------------
// Player: stats, moodles, body health, inventory, movement, combat
// ---------------------------------------------------------------------------
const PARTS = ['Head', 'Neck', 'TorsoUpper', 'TorsoLower', 'Groin', 'UpperArmL', 'UpperArmR', 'ForeArmL', 'ForeArmR', 'HandL', 'HandR', 'UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR', 'FootL', 'FootR'];
const PART_NAMES = { Head: 'Head', Neck: 'Neck', TorsoUpper: 'Upper Torso', TorsoLower: 'Lower Torso', Groin: 'Groin', UpperArmL: 'Left Upper Arm', UpperArmR: 'Right Upper Arm', ForeArmL: 'Left Forearm', ForeArmR: 'Right Forearm', HandL: 'Left Hand', HandR: 'Right Hand', UpperLegL: 'Left Thigh', UpperLegR: 'Right Thigh', LowerLegL: 'Left Shin', LowerLegR: 'Right Shin', FootL: 'Left Foot', FootR: 'Right Foot' };
const PART_REGION = { Head: 'head', Neck: 'neck', TorsoUpper: 'torso', TorsoLower: 'torso', Groin: 'groin', UpperArmL: 'uarms', UpperArmR: 'uarms', ForeArmL: 'farms', ForeArmR: 'farms', HandL: 'hands', HandR: 'hands', UpperLegL: 'ulegs', UpperLegR: 'ulegs', LowerLegL: 'llegs', LowerLegR: 'llegs', FootL: 'feet', FootR: 'feet' };
const ATTACK_W = [['HandL', 8], ['HandR', 8], ['ForeArmL', 11], ['ForeArmR', 11], ['UpperArmL', 6], ['UpperArmR', 6], ['TorsoUpper', 10], ['TorsoLower', 7], ['Head', 4], ['Neck', 3], ['Groin', 2], ['UpperLegL', 4], ['UpperLegR', 4], ['LowerLegL', 5], ['LowerLegR', 5], ['FootL', 2], ['FootR', 2]];
const WOUND = {
  scratch: { n: 'Scratched', heal: [10, 18], bleed: 0.12, pain: 8, dmg: 2.5 },
  cut: { n: 'Lacerated', heal: [24, 40], bleed: 0.35, pain: 18, dmg: 5 },
  bite: { n: 'Bitten', heal: [50, 70], bleed: 0.4, pain: 25, dmg: 8 },
  deep: { n: 'Deep Wound', heal: [60, 90], bleed: 0.7, pain: 30, dmg: 7 },
  burn: { n: 'Burned', heal: [40, 60], bleed: 0, pain: 35, dmg: 6 },
};
const WEAR_SLOTS = ['hat', 'eyes', 'neck', 'shirt', 'jacket', 'vest', 'gloves', 'pants', 'shoes', 'wrist', 'back', 'belt'];
const FISTS = { sk: null, dmg: [0.1, 0.25], range: 0.85, arc: 0.6, swing: 0.55, hits: 1, knock: 0.12, crit: 0.05, end: 0.012, model: null };

const Player = {
  create(o) {
    const p = {
      x: o.x, y: o.y, angle: 0.8, r: 0.27,
      name: o.name, occ: o.occ, traits: o.traits.slice(),
      skills: {}, bookMult: {},
      look: o.look,
      inv: [], hotbar: [null, null, null, null, null],
      st: { hunger: 0.06, thirst: 0.06, fatigue: 0.1, endurance: 1, panic: 0, stress: 0, boredom: 0, unhappy: 0, foodSick: 0, wet: 0, temp: 37, drunk: 0, smokeT: 0, cold: 0, coldT: 0, painkill: 0, beta: 0, antidep: 0, antibio: 0, poison: 0 },
      body: {}, health: 100, infection: null,
      moveMode: 'walk', sneak: false,
      swing: null, fireCd: 0, action: null, queue: [], path: null,
      asleep: false, inCar: null, dead: false,
      anim: { ph: 0, amp: 0 }, halo: [], kills: 0, hurtFlash: 0, grabbed: 0,
      fovT: 0, noiseT: 0, minutesAlive: 0, flashOn: false, sleepFade: 0, sitting: false,
      seenZ: 0, lastFov: null,
    };
    for (const pt of PARTS) p.body[pt] = { w: {}, bandage: null, infect: 0, disinf: 0, glass: false, stitched: false };
    for (const sk in SKILL_NAMES) p.skills[sk] = { lv: 0, xp: 0 };
    p.skills.Fitness.lv = 5; p.skills.Strength.lv = 5;
    const occ = OCCUPATIONS.find(x => x.id === o.occ);
    if (occ) { for (const sk in occ.sk) p.skills[sk].lv += occ.sk[sk]; for (const t of occ.traits || []) if (!p.traits.includes(t)) p.traits.push(t); }
    for (const tid of p.traits) { const t = traitDef(tid); if (t && t.sk) for (const sk in t.sk) p.skills[sk].lv += t.sk[sk]; }
    for (const sk in p.skills) p.skills[sk].lv = U.clamp(p.skills[sk].lv, 0, 10);
    return p;
  },
  get p() { return G.player; },
  hasTrait(id) { return !!(G.player && G.player.traits && G.player.traits.includes(id)); },
  skill(sk) { return G.player.skills[sk] ? G.player.skills[sk].lv : 0; },
  xp(sk, amt) {
    const p = G.player;
    const s = p.skills[sk];
    if (!s || s.lv >= 10) return;
    let m = 1;
    if (this.hasTrait('fastlearner')) m *= 1.3;
    if (this.hasTrait('slowlearner')) m *= 0.7;
    if (this.hasTrait('pacifist') && ['Axe', 'LongBlunt', 'ShortBlunt', 'LongBlade', 'ShortBlade', 'Spear', 'Aiming'].includes(sk)) m *= 0.75;
    const bm = p.bookMult[sk];
    if (bm && s.lv >= bm.min && s.lv <= bm.max) m *= bm.mult;
    s.xp += amt * m;
    const tbl = (sk === 'Fitness' || sk === 'Strength') ? XP_TABLE_PASSIVE : XP_TABLE;
    while (s.lv < 10 && s.xp >= tbl[s.lv]) {
      s.xp -= tbl[s.lv]; s.lv++;
      this.say('+ ' + SKILL_NAMES[sk], '#8f8');
      Sfx.play('levelup');
    }
  },
  say(txt, col) {
    const p = G.player;
    if (!p) return;
    if (p.halo.length && p.halo[p.halo.length - 1].txt === txt) { p.halo[p.halo.length - 1].t = 3; return; }
    p.halo.push({ txt, col: col || '#fff', t: 3 });
    if (p.halo.length > 4) p.halo.shift();
  },

  // ------------------------------------------------------------------ inventory
  bags() { return G.player.inv.filter(it => ITEMS[it.id].bag && (it.worn || it.equipped)); },
  containers() { return [{ items: G.player.inv, name: 'Inventory', main: true }].concat(this.bags().map(b => ({ items: b.items, name: Items.name(b), bag: b }))); },
  allItems() { const out = []; for (const c of this.containers()) for (const it of c.items) out.push(it); return out; },
  find(pred) { for (const c of this.containers()) for (const it of c.items) if (pred(it)) return it; return null; },
  findAll(pred) { const out = []; for (const c of this.containers()) for (const it of c.items) if (pred(it)) out.push(it); return out; },
  findTag(tag) { return this.find(it => Items.has(it, tag) && (it.cond === undefined || it.cond > 0 || ITEMS[it.id].cat === 'Clothing')); },
  findId(id) { return this.find(it => it.id === id); },
  count(id) { return this.findAll(it => it.id === id).length; },
  removeItem(it) {
    for (const c of this.containers()) { const k = c.items.indexOf(it); if (k >= 0) { c.items.splice(k, 1); this.unflag(it); return true; } }
    return false;
  },
  unflag(it) {
    delete it.equipped; delete it.worn;
    const p = G.player;
    for (let i = 0; i < 5; i++) if (p.hotbar[i] === it.uid) p.hotbar[i] = null;
  },
  addItem(it) { G.player.inv.push(it); },
  capacity() { return 8 + this.skill('Strength') * 0.55; },
  bagCap(bag) { let c = ITEMS[bag.id].bag.cap; if (this.hasTrait('organized')) c *= 1.3; if (this.hasTrait('disorganized')) c *= 0.7; return c; },
  weight() {
    let w = 0;
    for (const it of G.player.inv) {
      const d = ITEMS[it.id];
      let iw = Items.weight(it);
      if (it.worn && d.cat === 'Clothing') iw *= 0.35;
      w += iw;
    }
    return w;
  },
  heavyRatio() { return this.weight() / this.capacity(); },
  primary() { return G.player.inv.find(it => it.equipped === 'primary' || it.equipped === 'both') || null; },
  secondary() { return G.player.inv.find(it => it.equipped === 'secondary' || it.equipped === 'both') || null; },
  weaponDef() {
    const it = this.primary();
    if (!it) return null;
    const d = ITEMS[it.id];
    return d.wpn || d.gun ? d : null;
  },
  ensureMain(it) {
    const p = G.player;
    if (p.inv.includes(it)) return;
    for (const b of this.bags()) { const k = b.items.indexOf(it); if (k >= 0) { b.items.splice(k, 1); p.inv.push(it); return; } }
  },
  equip(it, slot) {
    const d = ITEMS[it.id];
    this.ensureMain(it);
    if (it.worn) delete it.worn;
    const two = (d.wpn && d.wpn.two) || (d.gun && d.gun.two) || d.generator;
    if (slot === 'primary' && two) slot = 'both';
    for (const o of G.player.inv) {
      if (o === it) continue;
      if (slot === 'both' && o.equipped) delete o.equipped;
      else if (o.equipped === slot || o.equipped === 'both') delete o.equipped;
    }
    it.equipped = slot;
    Sfx.play('equip');
  },
  unequip(it) { delete it.equipped; if (ITEMS[it.id].light) it.on = false; Sfx.play('equip'); },
  wear(it) {
    const d = ITEMS[it.id];
    this.ensureMain(it);
    let slot = d.slot;
    if (d.bag) slot = d.bag.back ? 'back' : d.bag.belt ? 'belt' : null;
    if (!slot) return;
    for (const o of G.player.inv) if (o !== it && o.worn === slot) delete o.worn;
    delete it.equipped;
    it.worn = slot;
    Sfx.play('cloth');
  },
  unwear(it) { delete it.worn; Sfx.play('cloth'); },
  worn(slot) { return G.player.inv.find(it => it.worn === slot) || null; },
  hasWatch() { return !!G.player.inv.find(it => it.worn === 'wrist' && ITEMS[it.id].watch) || !!this.find(it => ITEMS[it.id].watch); },
  hasKeyFor(f) {
    if (!f || f.b === undefined) return false;
    const b = Wd.buildings[f.b];
    return !!this.find(it => it.id === 'HouseKey' && it.keyId === (b ? b.keyId : -1));
  },
  flashlight() {
    const p = G.player;
    if (!p || p.inCar) return false;
    const s = this.secondary(), pr = this.primary();
    for (const it of [s, pr]) if (it && ITEMS[it.id].light && it.on && it.pow > 0) return true;
    return false;
  },
  look() {
    const p = G.player;
    const L = Object.assign({}, p.look);
    const w = (s) => this.worn(s);
    const shirt = w('shirt'), jacket = w('jacket'), pants = w('pants'), shoes = w('shoes'), hat = w('hat'), back = w('back'), vest = w('vest'), gloves = w('gloves');
    const bl = (it) => it.bloody ? Col.mix(it.col, '#4a0a08', 0.35) : it.col;
    L.shirt = shirt ? bl(shirt) : L.skin;
    L.sleeves = shirt ? (ITEMS[shirt.id].cover.includes('farms') ? 'long' : ITEMS[shirt.id].id === 'TankTop' ? 'none' : 'short') : 'none';
    L.jacket = jacket ? bl(jacket) : null;
    L.pants = pants ? bl(pants) : L.skin;
    L.shorts = pants ? !ITEMS[pants.id].cover.includes('llegs') : true;
    L.shoes = shoes ? shoes.col : L.skin;
    L.hat = hat ? { type: ITEMS[hat.id].hatType || 'cap', col: hat.col } : null;
    L.bag = back ? (back.col || ITEMS[back.id].bag.col || '#555') : null;
    L.vest = vest ? vest.col : null;
    L.gloves = gloves ? gloves.col : null;
    L.glasses = !!w('eyes');
    return L;
  },

  // ------------------------------------------------------------------ update
  update(dt) {
    const p = G.player;
    if (p.dead) { p.deadT = (p.deadT || 0) + dt; return; }
    const gh = dt * MIN_PER_SEC / 60;
    p.minutesAlive += dt * MIN_PER_SEC;
    p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2);
    for (const h of p.halo) h.t -= dt / Math.max(1, G.speed);
    p.halo = p.halo.filter(h => h.t > 0);
    if (p.grabbed > 0) p.grabbed -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;
    // camera
    const cx = p.inCar ? p.inCar.x : vxOf(p.x), cy = p.inCar ? p.inCar.y : p.y;
    const cz = p.inCar ? 0 : Render.entZ(p);
    Render.cam.x += (cx - Render.cam.x) * Math.min(1, dt * 8);
    Render.cam.y += (cy - Render.cam.y) * Math.min(1, dt * 8);
    Render.cam.z += (cz - Render.cam.z) * Math.min(1, dt * 8);
    if (p.asleep) { this.sleepUpdate(dt, gh); this.updateStats(gh, dt); this.fov(dt); return; }
    p.sleepFade = Math.max(0, p.sleepFade - dt);
    if (p.inCar) { Vehicles.driveInput(p.inCar, dt); this.updateStats(gh, dt); this.fov(dt); return; }
    this.movement(dt);
    this.combat(dt);
    this.updateStats(gh, dt);
    this.fov(dt);
    // flashlight battery
    for (const it of [this.primary(), this.secondary()]) if (it && ITEMS[it.id].light && it.on) { it.pow -= gh * 0.012; if (it.pow <= 0) { it.pow = 0; it.on = false; this.say('The batteries are dead.'); } }
    for (const it of p.inv) if (ITEMS[it.id].radio && it.on) { it.pow -= gh * 0.008; if (it.pow <= 0) { it.pow = 0; it.on = false; } }
  },
  fov(dt) {
    const p = G.player;
    p.fovT -= dt / Math.max(1, G.speed > 5 ? 3 : 1);
    const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
    const ang = p.inCar ? p.inCar.a : p.angle;
    const key = Math.floor(px * 4) + ',' + Math.floor(py * 4) + ',' + Math.round(ang * 10);
    if (p.fovT > 0 && key === p.lastFov) return;
    p.fovT = 0.12; p.lastFov = key;
    let range = 42;
    if (this.hasTrait('shortsighted') && !this.worn('eyes')) range = 20;
    if (G.weather.fog > 0) range *= 1 - G.weather.fog * 0.55;
    let cone = this.hasTrait('eagleeyed') ? 1.95 : 1.65;
    if (p.inCar) cone = 1.9;
    let near = this.hasTrait('keenhearing') ? 3.2 : this.hasTrait('hardofhearing') ? 1.2 : 2.0;
    if (p.asleep) { range = 0.5; near = 0.5; }
    World.computeFOV(px, py, ang, cone, range, near);
  },
  speedMult() {
    const p = G.player;
    let m = 1;
    const hr = this.heavyRatio();
    if (hr > 1) m *= hr > 1.75 ? 0.4 : hr > 1.5 ? 0.55 : hr > 1.25 ? 0.7 : 0.85;
    const end = p.st.endurance;
    if (end < 0.1) m *= 0.65; else if (end < 0.25) m *= 0.8; else if (end < 0.5) m *= 0.92;
    if (p.health < 40) m *= 0.85;
    if (p.grabbed > 0) m *= 0.25;
    for (const pt of ['UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR', 'FootL', 'FootR']) { const b = p.body[pt]; if (b.w.cut || b.w.bite || b.w.deep) { m *= 0.85; break; } }
    if (this.hasTrait('obese')) m *= 0.88; else if (this.hasTrait('overweight')) m *= 0.94;
    if (this.hasTrait('adrenaline')) m *= 1 + p.st.panic / 400;
    if (p.st.fatigue > 0.9) m *= 0.85;
    return m;
  },
  movement(dt) {
    const p = G.player;
    let mx = 0, my = 0;
    if (!UI.typing) {
      if (Input.down('w')) { mx -= 1; my -= 1; }
      if (Input.down('s')) { mx += 1; my += 1; }
      if (Input.down('a')) { mx -= 1; my += 1; }
      if (Input.down('d')) { mx += 1; my -= 1; }
    }
    const moving = mx !== 0 || my !== 0;
    if (moving) {
      p.path = null;
      if (p.action && !p.action.walkOk) Actions.cancel();
      p.sitting = false;
    }
    if (Input.hit('c')) { p.sneak = !p.sneak; this.say(p.sneak ? 'Sneaking' : 'Walking', '#ccc'); }
    const aiming = Input.aiming() && !p.action;
    p.aiming = aiming;
    let run = Input.down('Shift');
    let sprint = Input.down('Alt') || Input.down('x');
    if (p.st.endurance < 0.1) { run = false; sprint = false; }
    if (aiming) { run = false; sprint = false; }
    // auto-walk path
    if (!moving && p.path && p.path.length) {
      const ty = p.path[0][1], tx = World.lvX(p, p.path[0][0]);
      const gx = tx + 0.5, gy = ty + 0.5;
      const dx = gx - p.x, dy = gy - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.25 || (p.path.length === 1 && p.pathStop && d < p.pathStop)) {
        p.path.shift();
        if (!p.path.length) { p.path = null; if (p.onArrive) { const f = p.onArrive; p.onArrive = null; f(); } }
      } else {
        // open doors along the way
        const e = World.edgeBetween(Math.floor(p.x), Math.floor(p.y), tx, ty);
        if (e) {
          const f = World.feat(e[0], e[1], e[2]);
          if (f && f.k === 'door' && !f.open && !f.broken && d < 1.2) { Interact.toggleDoor(f, e); }
          else if (f && f.k === 'window' && d < 1.1 && (f.open || f.smashed)) { Interact.climb(e); p.path.shift(); return; }
          else if (!f && World.wall(e[0], e[1], e[2]) && WALL_INFO[World.wall(e[0], e[1], e[2])].climb && d < 1.1) { Interact.climb(e); p.path.shift(); return; }
        }
        mx = dx / d; my = dy / d;
        this.applyMove(mx, my, dt, false, Input.down('Shift'), false, true);
        return;
      }
    }
    if (p.action && !moving) { p.anim.amp = Math.max(0, p.anim.amp - dt * 4); return; }
    // facing
    const [wx, wy] = Render.mouseWorld();
    const mouseA = Math.atan2(wy - p.y, wx - p.x);
    let target = p.angle;
    if (aiming || (p.swing && p.swing.kind !== 'shove')) target = mouseA;
    else if (moving) target = Math.atan2(my, mx);
    else if (!Input.overUI) target = mouseA;
    const turnRate = aiming ? 9 : 11;
    const da = U.angDiff(p.angle, target);
    p.angle = U.normAng(p.angle + U.clamp(da, -turnRate * dt, turnRate * dt));
    if (moving) {
      const l = Math.sqrt(mx * mx + my * my);
      this.applyMove(mx / l, my / l, dt, aiming, run, sprint, false);
    } else {
      p.moveMode = 'idle';
      p.anim.amp = Math.max(0, p.anim.amp - dt * 5);
    }
  },
  applyMove(nx, ny, dt, aiming, run, sprint, auto) {
    const p = G.player;
    let sp = 1.75;
    let mode = 'walk';
    if (sprint) { sp = 4.0 + this.skill('Sprinting') * 0.12; mode = 'sprint'; }
    else if (run) { sp = 3.0 + this.skill('Sprinting') * 0.05; mode = 'run'; }
    if (p.sneak && mode === 'walk') sp = 1.05 + this.skill('Sneaking') * 0.04;
    if (aiming) {
      sp = 1.0 + this.skill('Nimble') * 0.08;
      const back = Math.abs(U.angDiff(p.angle, Math.atan2(ny, nx))) > 1.6;
      if (back) sp *= 0.75;
      this.xp('Nimble', dt * 0.15);
    }
    if (p.swing) sp *= 0.5;
    sp *= this.speedMult();
    if (p.st.drunk > 0.3) { const wob = Math.sin(performance.now() / 300) * p.st.drunk * 0.5; const c = Math.cos(wob), s = Math.sin(wob); const tx = nx * c - ny * s; ny = nx * s + ny * c; nx = tx; }
    p.moveMode = mode;
    const ox = p.x, oy = p.y;
    World.move(p, nx * sp * dt, ny * sp * dt, p.r);
    Vehicles.pushOut(p, p.r);
    this.pushZombies(p);
    const moved = U.dist(ox, oy, p.x, p.y);
    p.anim.ph += moved * (mode === 'sprint' ? 3.2 : mode === 'run' ? 3.6 : 4.4);
    p.anim.amp = Math.min(1, p.anim.amp + dt * 6) * (moved > 0.0005 ? 1 : 0.9);
    if (auto && moved < sp * dt * 0.1) { p.stuckT = (p.stuckT || 0) + dt; if (p.stuckT > 1.2) { p.path = null; p.stuckT = 0; } } else p.stuckT = 0;
    // endurance & xp
    const st = p.st;
    const fit = this.skill('Fitness');
    let drain = 0;
    if (mode === 'sprint') { drain = 0.032 * (1.35 - fit * 0.06) * (1.2 - this.skill('Sprinting') * 0.04); this.xp('Sprinting', dt * 0.5); this.xp('Fitness', dt * 0.25); }
    else if (mode === 'run') { drain = 0.009 * (1.35 - fit * 0.06); this.xp('Fitness', dt * 0.1); this.xp('Lightfooted', dt * 0.04); }
    else { this.xp('Lightfooted', dt * 0.03); if (p.sneak) this.xp('Sneaking', dt * (p.seenZ > 0 ? 0.25 : 0.04)); }
    if (this.hasTrait('asthmatic')) drain *= 1.4;
    if (this.heavyRatio() > 1) { drain += 0.003 * this.heavyRatio(); this.xp('Strength', dt * 0.05); }
    st.endurance = Math.max(0, st.endurance - drain * dt);
    // footstep noise
    p.noiseT -= dt;
    const stepInt = mode === 'sprint' ? 0.28 : mode === 'run' ? 0.34 : 0.48;
    if (p.noiseT <= 0 && moved > 0.001) {
      p.noiseT = stepInt;
      let rad = mode === 'sprint' ? 10 : mode === 'run' ? 6.5 : p.sneak ? 1.2 : 3.2;
      rad *= 1 - this.skill('Lightfooted') * 0.05;
      if (this.hasTrait('graceful')) rad *= 0.65;
      if (this.hasTrait('clumsy')) rad *= 1.35;
      if (World.isWater(p.x | 0, p.y | 0)) rad *= 1.5;
      Noise.emit(p.x, p.y, rad, 'step');
      Sfx.footstep(World.floor(p.x | 0, p.y | 0), mode, p.sneak);
    }
  },
  pushZombies(p) {
    for (const z of Zombie.near(p.x, p.y, 1.2)) {
      if (z.dead || (z.lie || 0) > 0.5) continue;
      const dx = p.x - z.x, dy = p.y - z.y;
      const d = Math.sqrt(dx * dx + dy * dy), m = p.r + z.r;
      if (d < m && d > 0.0001) { const push = (m - d) / d; p.x += dx * push * 0.5; p.y += dy * push * 0.5; z.x -= dx * push * 0.5; z.y -= dy * push * 0.5; World.resolve(p, p.r); }
    }
  },

  // ------------------------------------------------------------------ combat
  combat(dt) {
    const p = G.player;
    if (p.swing) {
      const s = p.swing;
      s.t += dt / s.dur;
      if (!s.done && s.t >= (s.kind === 'shove' ? 0.4 : 0.48)) { s.done = true; Combat.resolveSwing(s); }
      if (s.t >= 1) p.swing = null;
    }
    if (G.build) {
      if (Input.hit('r')) G.build.d = (G.build.d + 1) & 1;
      if (!Input.overUI && Input.takeClick()) Build.click();
      return;
    }
    if (p.action || Input.overUI || UI.modalOpen()) return;
    const wd = this.weaponDef();
    const prim = this.primary();
    if (Input.hit(' ')) { Combat.startShove(); return; }
    if (prim && ITEMS[prim.id].throwable) { if (Input.takeClick()) Combat.throwItem(prim); return; }
    if (wd && wd.gun) {
      if (((Input.lmbClick && Input.takeClick()) || (Input.lmb && wd.gun.auto)) && p.fireCd <= 0 && !p.swing) Combat.fire(prim);
    } else if (Input.lmb && !p.swing) {
      Combat.startMelee();
    }
    if (Input.hit('r')) Actions.reload();
  },

  // ------------------------------------------------------------------ zombie attacks
  zombieAttack(z) {
    const p = G.player;
    if (p.dead) return;
    const ang = Math.atan2(z.y - p.y, z.x - p.x);
    const behind = Math.abs(U.angDiff(p.angle, ang)) > 1.7;
    let chance = 0.62;
    if (!behind) chance -= 0.12;
    if (p.swing) chance -= 0.08;
    chance -= this.skill('Nimble') * 0.01;
    if (p.inCar) chance = 0.35;
    if (!R.chance(chance)) { if (R.chance(0.3)) this.say(R.pick(['Close call!', 'Missed me!']), '#ddd'); return; }
    // surrounded -> dragged down
    let around = 0;
    for (const o of Zombie.near(p.x, p.y, 1.25)) if (!o.dead && !o.down && (o.st === 'attack' || o.st === 'chase')) around++;
    if (around >= 3 && R.chance(0.18 + (around - 3) * 0.08) && !p.inCar) { this.die('Dragged down by the dead'); Sfx.play('scream'); return; }
    const part = R.weighted(ATTACK_W);
    let type;
    const r = R.next();
    if (r < 0.17) type = 'bite'; else if (r < 0.45) type = 'cut'; else type = 'scratch';
    let skin = 1;
    if (this.hasTrait('thickskinned')) skin = 0.75;
    if (this.hasTrait('thinskinned')) skin = 1.3;
    // clothing
    const region = PART_REGION[part];
    let block = 0;
    for (const it of p.inv) {
      if (!it.worn) continue;
      const d = ITEMS[it.id];
      if (!d.cover || !d.cover.includes(region)) continue;
      const pv = (type === 'bite' ? d.bi : d.sc) / 100 * (it.cond === undefined ? 1 : 0.5 + it.cond * 0.5);
      block = 1 - (1 - block) * (1 - pv);
      if (R.chance(0.15)) { it.cond = Math.max(0, (it.cond === undefined ? 1 : it.cond) - 0.1); it.bloody = true; }
    }
    p.grabbed = 0.5;
    p.hurtFlash = 1;
    p.st.panic = Math.min(100, p.st.panic + 25);
    Sfx.play('zhit');
    if (R.chance(block) || !R.chance(Math.min(1, 0.9 * skin))) {
      this.say(block > 0.2 ? 'My clothes protected me' : 'Grabbed!', '#ddd');
      return;
    }
    this.addWound(part, type, z);
  },
  addWound(part, type, src) {
    const p = G.player;
    const b = p.body[part];
    const wd = WOUND[type];
    b.w[type] = Math.max(b.w[type] || 0, R.f(wd.heal[0], wd.heal[1]));
    if (type !== 'burn') { b.bandage = b.bandage ? b.bandage : null; if (b.bandage) b.bandage.dirt = Math.min(1, b.bandage.dirt + 0.6); }
    p.health -= wd.dmg;
    p.st.stress = Math.min(1, p.st.stress + 0.1);
    Fx.blood(p.x, p.y, 6);
    this.say(PART_NAMES[part] + ': ' + wd.n + '!', '#f66');
    Sfx.play('hurt');
    if (src && src.isZombie !== false && (type === 'bite' || type === 'cut' || type === 'scratch')) {
      const ch = type === 'bite' ? 1 : type === 'cut' ? 0.25 : 0.07;
      if (!p.infection && R.chance(ch)) {
        const prone = this.hasTrait('proneillness') ? 0.8 : 1;
        p.infection = { t: 0, sym: R.f(8, 16) * prone, death: R.f(48, 72) * prone };
      }
    }
    if (this.hasTrait('hemophobic')) p.st.panic = Math.min(100, p.st.panic + 20);
    if (p.health <= 0) this.die('Succumbed to wounds');
  },

  // ------------------------------------------------------------------ stats
  updateStats(gh, dt) {
    const p = G.player, st = p.st;
    const tr = (id) => this.hasTrait(id);
    const active = p.moveMode === 'run' || p.moveMode === 'sprint' || p.swing ? 1 : 0;
    // hunger/thirst
    let hm = 1; if (tr('lighteater')) hm = 0.75; if (tr('heartyappetite')) hm = 1.3;
    let tm = 1; if (tr('lowthirst')) tm = 0.6; if (tr('highthirst')) tm = 1.5;
    st.hunger = Math.min(1, st.hunger + gh * 0.021 * hm * (1 + active * 0.6) * (p.asleep ? 0.5 : 1));
    st.thirst = Math.min(1, st.thirst + gh * 0.032 * tm * (1 + active * 0.8) * (p.asleep ? 0.5 : 1) * (G.weather.temp > 28 ? 1.25 : 1));
    // fatigue
    if (!p.asleep) {
      let fm = 1; if (tr('wakeful')) fm = 0.8; if (tr('sleepyhead')) fm = 1.25; if (tr('nightowl')) fm = 0.85;
      st.fatigue = Math.min(1, st.fatigue + gh * 0.042 * fm * (1 + active * 0.3));
    }
    // endurance regen
    if (p.moveMode !== 'run' && p.moveMode !== 'sprint') {
      let rg = p.moveMode === 'walk' ? 0.01 : 0.022;
      if (p.sitting || p.asleep) rg = 0.05;
      rg *= 0.7 + this.skill('Fitness') * 0.06;
      if (st.hunger > 0.45) rg *= 0.7;
      if (st.fatigue > 0.8) rg *= 0.6;
      if (this.heavyRatio() > 1.25) rg *= 0.5;
      st.endurance = Math.min(1, st.endurance + rg * dt);
    }
    // panic from visible zombies
    let seen = 0, close = 0;
    for (const z of Zombie.near(p.x, p.y, 12)) {
      if (z.dead || (z.va || 0) < 0.5) continue;
      seen++;
      const d = U.dist(p.x, p.y, z.x, z.y);
      if (d < 4) close++;
    }
    p.seenZ = seen;
    let pm = 1; if (tr('brave')) pm = 0.4; if (tr('cowardly')) pm = 2; if (tr('desensitized')) pm = 0;
    if (st.beta > 0) pm *= 0.3;
    if (st.drunk > 0.2) pm *= 0.6;
    if (seen) st.panic = Math.min(100, st.panic + (seen * 1.5 + close * 4) * dt * pm * 2.2);
    else st.panic = Math.max(0, st.panic - dt * 4);
    if (tr('agoraphobic') && World.outdoor(p.x, p.y)) st.panic = Math.min(100, st.panic + dt * 2 * pm);
    if (tr('claustrophobic') && !World.outdoor(p.x, p.y)) st.panic = Math.min(100, st.panic + dt * 2 * pm);
    // stress
    let sTarget = 0;
    if (p.infection && p.infection.t > p.infection.sym) sTarget += 0.5;
    if (seen) sTarget += Math.min(0.4, seen * 0.05);
    if (st.hunger > 0.45) sTarget += 0.1;
    if (tr('smoker')) { st.smokeT += gh; if (st.smokeT > 5) sTarget += Math.min(0.5, (st.smokeT - 5) * 0.05); }
    st.stress = U.clamp(st.stress + (sTarget > st.stress ? 0.06 : -0.03) * gh, 0, 1);
    // boredom/unhappy
    const indoors = !World.outdoor(p.x, p.y);
    const idle = !p.action && p.moveMode === 'idle' && !seen;
    if (p.action && p.action.fun) st.boredom = Math.max(0, st.boredom - p.action.fun * gh);
    else if (idle) st.boredom = Math.min(100, st.boredom + gh * (indoors ? 5 : 2));
    else st.boredom = Math.max(0, st.boredom - gh * 2);
    if (st.boredom > 50) st.unhappy = Math.min(100, st.unhappy + gh * 3);
    if (st.antidep > 0) { st.unhappy = Math.max(0, st.unhappy - gh * 4); st.antidep -= gh; }
    if (st.stress > 0.6) st.unhappy = Math.min(100, st.unhappy + gh * 1.5);
    // wetness & temperature
    const rain = G.weather.rain;
    if (!indoors && rain > 0.05 && !p.inCar) st.wet = Math.min(1, st.wet + gh * rain * 0.9);
    else st.wet = Math.max(0, st.wet - gh * (indoors ? 0.2 : 0.1));
    let ins = 0;
    for (const it of p.inv) if (it.worn && ITEMS[it.id].ins) ins += ITEMS[it.id].ins;
    const amb = indoors ? Math.max(G.weather.temp, 19) : G.weather.temp;
    const thermal = amb + ins * 12 + (active ? 8 : 0) - st.wet * 10;
    let target = 37;
    if (thermal < 14) target = 37 - (14 - thermal) * 0.12;
    else if (thermal > 31) target = 37 + (thermal - 31) * 0.1;
    if (tr('outdoorsman')) target = 37 + (target - 37) * 0.5;
    st.temp += (target - st.temp) * Math.min(1, gh * 0.8);
    if (st.wet > 0.5 && st.temp < 36.6 && !st.cold && R.chance(gh * (tr('proneillness') ? 0.15 : 0.06))) { st.cold = 1; st.coldT = R.f(36, 72); this.say('I think I caught a cold...', '#ccc'); }
    if (st.cold) {
      st.coldT -= gh;
      if (st.coldT <= 0) st.cold = 0;
      if (R.chance(gh * 4)) { this.say(R.pick(['*Achoo!*', '*Cough* *cough*']), '#ccc'); Noise.emit(p.x, p.y, 9, 'sneeze'); Sfx.play('cough'); }
    }
    // drunk, drugs
    st.drunk = Math.max(0, st.drunk - gh * 0.15);
    st.painkill = Math.max(0, st.painkill - gh);
    st.beta = Math.max(0, st.beta - gh);
    st.antibio = Math.max(0, st.antibio - gh);
    st.foodSick = Math.max(0, st.foodSick - gh * 0.04);
    st.poison = Math.max(0, st.poison - gh * 0.06);
    // body
    this.updateBody(gh);
    // health effects
    let regen = 0;
    if (st.hunger >= 0.7) p.health -= gh * 2.5; else if (st.hunger < 0.45) regen += 1;
    if (st.thirst >= 0.84) p.health -= gh * 4; else if (st.thirst < 0.7) regen += 0.5;
    if (st.foodSick > 0.5 || st.poison > 0.4) p.health -= gh * (st.foodSick + st.poison * 3) * 3;
    if (st.temp < 34 || st.temp > 40) p.health -= gh * 3;
    if (regen && !this.bleeding() && st.foodSick < 0.4 && !(p.infection && p.infection.t > p.infection.sym)) {
      let r2 = regen * (tr('fasthealer') ? 1.5 : tr('slowhealer') ? 0.6 : 1) * (p.asleep ? 2 : 1);
      p.health = Math.min(this.maxHealth(), p.health + r2 * gh);
    }
    // zombie infection
    if (p.infection) {
      const inf = p.infection;
      inf.t += gh;
      if (inf.t > inf.sym) {
        const k = (inf.t - inf.sym) / (inf.death - inf.sym);
        if (k > 0.6) p.health = Math.min(p.health, 100 * (1 - (k - 0.6) / 0.4));
        if (R.chance(gh * 0.5)) this.say(R.pick(['I feel awful...', 'My head is pounding', 'So cold...', 'I need to lie down']), '#cc9');
      }
      if (inf.t >= inf.death) { this.die('Zombie infection'); return; }
    }
    if (p.health <= 0 && !p.dead) this.die(st.thirst >= 0.84 ? 'Dehydration' : st.hunger >= 0.7 ? 'Starvation' : 'Succumbed to wounds');
    // occasional thoughts
    if (!p.asleep && R.chance(gh * 0.6)) {
      if (st.hunger > 0.45) this.say("I'm starving", '#cc9');
      else if (st.thirst > 0.25) this.say("I'm thirsty", '#cc9');
      else if (st.fatigue > 0.8) this.say('I need to sleep', '#cc9');
      else if (st.boredom > 60) this.say("I'm so bored...", '#cc9');
    }
  },
  maxHealth() {
    const p = G.player;
    let n = 0;
    for (const pt of PARTS) for (const k in p.body[pt].w) if (p.body[pt].w[k] > 0) n += k === 'scratch' ? 1 : 3;
    return Math.max(30, 100 - n * 2);
  },
  bleeding() {
    let b = 0;
    const p = G.player;
    for (const pt of PARTS) b += this.partBleed(p.body[pt]);
    return b;
  },
  partBleed(b) {
    let bl = 0;
    for (const k in b.w) if (b.w[k] > 0) bl += WOUND[k].bleed * (b.bandage ? (k === 'deep' && !b.stitched ? 0.3 : 0) : (k === 'deep' && b.stitched ? 0.2 : 1));
    return bl;
  },
  updateBody(gh) {
    const p = G.player, st = p.st;
    let bleed = 0, pain = 0;
    const hm = (this.hasTrait('fasthealer') ? 1.4 : this.hasTrait('slowhealer') ? 0.6 : 1) * (st.hunger > 0.45 || st.thirst > 0.7 ? 0.5 : 1);
    for (const pt of PARTS) {
      const b = p.body[pt];
      let has = false;
      for (const k in b.w) {
        if (b.w[k] <= 0) { delete b.w[k]; continue; }
        has = true;
        let r = hm * (b.bandage ? 1.5 : 1);
        if (b.infect > 0.3 || b.glass) r = 0;
        if (k === 'deep' && !b.stitched) r = 0;
        b.w[k] -= gh * r;
        const wd = WOUND[k];
        pain += wd.pain * Math.min(1, b.w[k] / wd.heal[0] + 0.3);
      }
      bleed += this.partBleed(b);
      if (b.bandage) {
        b.bandage.dirt = Math.min(1, b.bandage.dirt + gh * 0.04);
        if (!has) { b.bandage.dirt = Math.max(b.bandage.dirt, 0.3); }
      }
      if (!has) { b.glass = false; b.stitched = false; b.infect = Math.max(0, b.infect - gh * 0.1); continue; }
      if (b.disinf > 0) b.disinf -= gh;
      if (b.disinf <= 0 && b.infect <= 0) {
        let ch = b.bandage ? (b.bandage.dirt >= 0.99 ? 0.03 : 0.004) : 0.015;
        if (b.glass) ch *= 3;
        if (R.chance(gh * ch)) { b.infect = 0.05; this.say('My wound looks infected', '#cc9'); }
      }
      if (b.infect > 0) {
        b.infect = U.clamp(b.infect + gh * (st.antibio > 0 ? -0.12 : b.disinf > 0 ? -0.03 : 0.02), 0, 1);
        pain += b.infect * 25;
      }
      if (b.glass) pain += 10;
    }
    if (bleed > 0) {
      p.health -= bleed * 12 * gh;
      if (R.chance(gh * bleed * 40)) Fx.decal(p.x + R.f(-0.3, 0.3), p.y + R.f(-0.3, 0.3), 0.4);
    }
    if (st.painkill > 0) pain *= 0.35;
    st.pain = Math.min(100, pain);
  },
  sickLevel() {
    const p = G.player, st = p.st;
    let s = Math.max(st.foodSick, st.poison);
    if (p.infection && p.infection.t > p.infection.sym) s = Math.max(s, 0.2 + 0.8 * (p.infection.t - p.infection.sym) / (p.infection.death - p.infection.sym));
    let wi = 0;
    for (const pt of PARTS) wi = Math.max(wi, p.body[pt].infect);
    s = Math.max(s, wi * 0.6);
    if (st.cold) s = Math.max(s, 0.26);
    return Math.min(1, s);
  },
  moodles() {
    const p = G.player, st = p.st;
    const out = [];
    const lvl = (v, th) => { let l = 0; for (let i = 0; i < 4; i++) if (v >= th[i]) l = i + 1; return l; };
    const add = (id, l, names, desc, good) => { if (l > 0) out.push({ id, lv: l, name: names[l - 1], desc, good }); };
    if (st.hunger < -0.05) add('fed', st.hunger < -0.15 ? 2 : 1, ['Satiated', 'Stuffed'], 'Well fed.', true);
    add('hungry', lvl(st.hunger, [0.15, 0.25, 0.45, 0.7]), ['Peckish', 'Hungry', 'Very Hungry', 'Starving'], 'Eat something.');
    add('thirsty', lvl(st.thirst, [0.12, 0.25, 0.7, 0.84]), ['Slightly Thirsty', 'Thirsty', 'Parched', 'Dying of Thirst'], 'Drink something.');
    add('tired', lvl(st.fatigue, [0.6, 0.7, 0.8, 0.9]), ['Drowsy', 'Tired', 'Very Tired', 'Ridiculously Tired'], 'Find a bed and sleep.');
    add('endurance', lvl(1 - st.endurance, [0.25, 0.5, 0.75, 0.9]), ['Moderate Exertion', 'High Exertion', 'Excessive Exertion', 'Exhausted'], 'Rest to recover endurance.');
    add('panic', lvl(st.panic / 100, [0.06, 0.3, 0.65, 0.8]), ['Slight Panic', 'Panic', 'Strong Panic', 'Extreme Panic'], 'Aim and accuracy reduced.');
    add('stress', lvl(st.stress, [0.25, 0.5, 0.75, 0.9]), ['Anxious', 'Agitated', 'Nervous', 'Stressed'], 'Feeling on edge.');
    add('bored', lvl(st.boredom / 100, [0.25, 0.5, 0.75, 0.9]), ['Slightly Bored', 'Bored', 'Very Bored', 'Extremely Bored'], 'Read or do something fun.');
    add('unhappy', lvl(st.unhappy / 100, [0.2, 0.45, 0.6, 0.8]), ['Sad', 'Unhappy', 'Very Unhappy', 'Depressed'], 'Feeling down.');
    add('pain', lvl(st.pain / 100, [0.1, 0.25, 0.5, 0.75]), ['Minor Pain', 'Pain', 'Severe Pain', 'Agony'], 'Painkillers help.');
    let bl = 0; for (const pt of PARTS) if (this.partBleed(p.body[pt]) > 0) bl++;
    add('bleeding', Math.min(4, bl), ['Minor Bleeding', 'Bleeding', 'Severe Bleeding', 'Massive Blood Loss'], 'Bandage your wounds! (H)');
    add('injured', lvl((100 - p.health) / 100, [0.15, 0.35, 0.55, 0.75]), ['Minor Injury', 'Injured', 'Severely Injured', 'Critically Injured'], 'Health: ' + Math.round(p.health));
    add('sick', lvl(this.sickLevel(), [0.25, 0.5, 0.75, 0.9]), ['Queasy', 'Nauseous', 'Sick', 'Fever'], 'You feel unwell.');
    add('heavy', lvl(this.heavyRatio(), [1, 1.25, 1.5, 1.75]), ['Heavy Load', 'Very Heavy Load', 'Extremely Heavy Load', 'Crushing Weight'], 'Carrying too much.');
    add('wet', lvl(st.wet, [0.15, 0.4, 0.7, 0.9]), ['Damp', 'Wet', 'Soaking', 'Drenched'], 'Get indoors and dry off.');
    add('hot', lvl(st.temp, [37.6, 38.5, 39.5, 40.5]), ['Hot', 'Overheated', 'Hyperthermic', 'Heatstroke'], 'Remove clothes, rest in shade.');
    add('cold', lvl(-st.temp, [-36.4, -35.5, -34, -32]), ['Chilly', 'Cold', 'Freezing', 'Hypothermic'], 'Wear warmer clothes, dry off.');
    add('drunk', lvl(st.drunk, [0.1, 0.3, 0.6, 0.85]), ['Tipsy', 'Drunk', 'Wasted', 'Blackout Drunk'], 'Aim reduced.');
    return out;
  },

  // ------------------------------------------------------------------ sleep
  sleepUpdate(dt, gh) {
    const p = G.player, st = p.st;
    p.sleepFade = Math.min(0.85, p.sleepFade + dt);
    let rate = 0.12 * (this.hasTrait('restless') ? 0.75 : 1) * (this.hasTrait('nightowl') ? 1.3 : 1) * (p.sleepQ || 1);
    st.fatigue = Math.max(0, st.fatigue - gh * rate);
    st.endurance = Math.min(1, st.endurance + gh * 0.5);
    st.stress = Math.max(0, st.stress - gh * 0.05);
    p.sleepH = (p.sleepH || 0) + gh;
    // wake conditions
    let wake = null;
    if (st.fatigue <= 0.02 || p.sleepH > 11) wake = 'I feel rested.';
    if (st.hunger > 0.6 || st.thirst > 0.7) wake = 'Hunger woke me up.';
    if (st.pain > 60) wake = 'The pain woke me up.';
    for (const z of Zombie.near(p.x, p.y, 4)) if (!z.dead && (z.st === 'chase' || z.st === 'attack' || z.st === 'thump') && World.lineClear(z.x, z.y, p.x, p.y, 'sight')) { wake = 'Something woke me up!'; break; }
    if (p.wakeNoise) { wake = 'A noise woke me up!'; p.wakeNoise = false; }
    if (wake) this.wakeUp(wake);
  },
  sleep(quality, onBed) {
    const p = G.player;
    if (p.st.fatigue < 0.3 && !p.sleepPill) { this.say("I'm not tired enough to sleep.", '#ccc'); return; }
    p.asleep = true; p.sleepQ = quality; p.sleepH = 0; p.sleepBed = onBed; p.sleepPill = false;
    p.preSleepSpeed = G.speed;
    G.speed = 40;
    UI.hint('Sleeping... (any zombie nearby will wake you)');
  },
  wakeUp(msg) {
    const p = G.player;
    p.asleep = false;
    G.speed = 1;
    this.say(msg || 'I woke up.', '#ccc');
    p.sleepBed = null;
    // step off the bed
    if (World.tileSolid(Math.floor(p.x), Math.floor(p.y))) {
      for (const [dx, dy] of DIR8) { const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy; if (!World.tileSolid(x, y) && World.adjacentReach(Math.floor(p.x), Math.floor(p.y), x, y)) { p.x = x + 0.5; p.y = y + 0.5; break; } }
    }
    World.resolve(p, p.r);
  },

  // ------------------------------------------------------------------ death
  die(cause) {
    const p = G.player;
    if (p.dead) return;
    p.dead = true; p.deathCause = cause; p.deadT = 0;
    G.corpse = true;
    p.swing = null; p.action = null; p.queue = [];
    if (p.inCar) Vehicles.exit(p.inCar, true);
    G.speed = 1;
    Sfx.play('death');
    Music.death();
    for (const it of p.inv) { delete it.equipped; }
    // reanimate if infected
    if (p.infection || cause === 'Dragged down by the dead') p.reanimate = true;
    setTimeout(() => UI.showDeath(), 3500);
    Save.wipe();
  },

  // ------------------------------------------------------------------ rendering
  pose() {
    const p = G.player;
    const prim = this.primary(), sec = this.secondary();
    const pd = prim ? ITEMS[prim.id] : null;
    const model = pd ? (pd.wpn ? pd.wpn.model : pd.gun ? pd.gun.model : (pd.light ? 'flashlight' : pd.generator ? 'generic' : (pd.throwable ? 'generic' : 'generic'))) : null;
    const pose = { walk: p.anim.ph, amp: p.anim.amp * (p.moveMode === 'sprint' ? 1.25 : p.moveMode === 'run' ? 1.1 : 0.85), t: performance.now() / 1000, weapon: model, crouch: p.sneak ? 0.55 : 0 };
    if (p.moveMode === 'sprint') pose.lean = 0.25; else if (p.moveMode === 'run') pose.lean = 0.12;
    if (pd && pd.wpn && pd.wpn.two) pose.two = true;
    if (sec && ITEMS[sec.id].light) { pose.offhand = 'flashlight'; pose.light = sec.on && sec.pow > 0; }
    if (p.swing) {
      if (p.swing.kind === 'shove' || p.swing.kind === 'stomp') { pose.arms = 'shove'; pose.swingT = p.swing.t; if (p.swing.kind === 'stomp') pose.crouch = 0.3; }
      else if (p.swing.kind === 'fire') { pose.arms = 'aim'; pose.flash = p.swing.t < 0.25; }
      else { pose.arms = 'swing'; pose.swingT = p.swing.t; pose.stab = pd && pd.wpn && (pd.wpn.sk === 'ShortBlade' || pd.wpn.sk === 'Spear'); }
    } else if (p.aiming && pd && pd.gun) pose.arms = 'aim';
    else if (p.aiming) pose.arms = 'swing', pose.swingT = 0.2;
    else if (p.action && p.action.anim) {
      const an = p.action.anim;
      pose.arms = an;
      if (an === 'loot' || an === 'craft') pose.arms = 'work';
      if (an === 'kneel') { pose.arms = 'work'; pose.crouch = 0.7; }
      if (an === 'sit') pose.crouch = 0.8;
      if (an === 'squat') { pose.arms = 'shove'; pose.swingT = 0.5; pose.crouch = (Math.sin(pose.t * 4) + 1) * 0.42; }
    }
    if (p.climb) { pose.arms = 'climb'; pose.crouch = Math.sin(p.climb.t * Math.PI) * 0.4; }
    if (p.sitting) pose.crouch = 0.8;
    if (p.asleep || p.dead) {
      pose.lie = p.dead ? Math.min(1, (p.deadT || 0) * 2) : 1;
      pose.lieDir = 1; pose.arms = 'idle'; pose.amp = 0; pose.weapon = null; pose.lieOff = p.asleep ? 0.85 : 0;
    }
    return pose;
  },
  draw(ctx) {
    const p = G.player;
    if (p.inCar) return;
    const [X, Y] = Render.epos(p);
    const s = Math.max(0.35, Render.shadeSmooth(p.x, p.y));
    let ang = p.angle;
    if (p.asleep && p.sleepBed) ang = p.sleepAng || ang;
    Humanoid.draw(ctx, X, Y, ang, this.look(), this.pose(), s);
  },
  drawOverlay(ctx) {
    const p = G.player;
    if (p.inCar) return;
    const [X, Y] = Render.epos(p, 2.05);
    // action progress bar
    if (p.action && p.action.dur > 0.3) {
      const k = U.clamp(p.action.t / p.action.dur, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(X - 26, Y - 8, 52, 7);
      ctx.fillStyle = '#c8b860'; ctx.fillRect(X - 25, Y - 7, 50 * k, 5);
    }
    // halo texts
    ctx.font = '11px Verdana, sans-serif'; ctx.textAlign = 'center';
    let yy = Y - 14;
    for (let i = p.halo.length - 1; i >= 0; i--) {
      const h = p.halo[i];
      ctx.globalAlpha = Math.min(1, h.t);
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(h.txt, X + 1, yy + 1);
      ctx.fillStyle = h.col; ctx.fillText(h.txt, X, yy);
      yy -= 13;
    }
    ctx.globalAlpha = 1;
    // aim reticle for guns
    const wd = this.weaponDef();
    if (wd && wd.gun && !p.action && !p.dead) {
      const [wx, wy] = Render.mouseWorld();
      const d = U.dist(p.x, p.y, wx, wy);
      const sp = Combat.spread(wd.gun, p.aiming);
      const r = Math.max(4, Math.tan(sp) * d * HTW * 1.1);
      const [cx, cy] = Render.P(wx, wy, 0);
      ctx.strokeStyle = p.aiming ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.5, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3); ctx.stroke();
    }
    // aim cone for melee when aiming
    if (p.aiming && !(wd && wd.gun)) {
      const def = wd ? wd.wpn : FISTS;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      const [px0, py0] = Render.epos(p);
      ctx.moveTo(px0, py0);
      const zf = Render.entZ(p);
      for (let k = -8; k <= 8; k++) {
        const a = p.angle + def.arc * k / 8;
        const x = p.x + Math.cos(a) * def.range, y = p.y + Math.sin(a) * def.range;
        const q = Render.P(x, y, p.x >= LV.W0 ? 0 : zf);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.closePath(); ctx.fill();
    }
  },
};
