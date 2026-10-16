'use strict';
// ---------------------------------------------------------------------------
// Zombies
// ---------------------------------------------------------------------------
const ZSKIN = '#7d8a6e';
let _zid = 1;
const Zombie = {
  gHead: null, gNext: null, gRef: [], gw: 0, gh: 0, CELL: 4,
  create(x, y, outfit) {
    const female = R.chance(0.45);
    const wear = this.outfit(outfit, female);
    const z = {
      id: _zid++, x, y, a: R.f(-Math.PI, Math.PI), r: 0.26,
      hp: R.f(1.4, 2.4), st: 'idle', tx: x, ty: y, mem: 0, path: null, pathT: 0,
      think: R.f(0, 0.5), atkT: 0, cd: 0, downT: 0, lie: 0, lieDir: 1, stag: 0, svx: 0, svy: 0,
      speed: Zombie.rollSpeed(), crawl: false, female, wear,
      va: 0, ph: R.f(0, 6), amp: 0, idleT: R.f(1, 8), groanT: R.f(2, 12), dead: false,
      hair: female ? R.pick(['long', 'ponytail', 'short', 'messy']) : R.pick(['short', 'buzz', 'bald', 'messy', 'short']),
      hairCol: R.pick(HAIR_COLS), skin: Col.mix(R.pick(SKIN_TONES), ZSKIN, 0.5), blood: R.f(0.2, 1),
    };
    z.look = this.computeLook(z);
    if (G.sb && G.sb.tough) z.hp *= G.sb.tough;
    z.maxhp = z.hp;
    // some of the dead drag a ruined leg
    if (R.chance(0.22)) { z.limp = R.f(0.35, 0.85); z.limpSide = R.chance(0.5) ? 1 : -1; z.speed *= 1 - z.limp * 0.18; }
    return z;
  },
  rollSpeed() {
    let s = G.sb ? G.sb.speed : 'shambler';
    if (s === 'random') s = R.weighted([['shambler', 85], ['fast', 10], ['sprinter', 5]]);
    if (s === 'fast') return R.f(1.25, 1.65);
    if (s === 'sprinter') return R.f(2.7, 3.3);
    return R.f(0.62, 0.95);
  },
  outfit(kind, female) {
    const out = [];
    const mk = (id) => { const it = Items.make(id); if (it) { it.worn = ITEMS[id].slot; it.cond = R.f(0.3, 1); if (R.chance(0.6)) it.bloody = true; out.push(it); } };
    if (kind === 'military') { mk('MilitaryJacket'); mk('CargoPants'); mk('Boots'); if (R.chance(0.3)) mk('HardHat'); mk('Belt'); return out; }
    if (kind === 'police') { mk('PoliceShirt'); mk('PolicePants'); mk('Boots'); if (R.chance(0.4)) mk('PoliceCap'); if (R.chance(0.2)) mk('BulletVest'); mk('Belt'); if (R.chance(0.5)) mk('Holster'); return out; }
    if (kind === 'medic') { mk('Scrubs'); mk('ScrubPants'); mk('Sneakers'); if (R.chance(0.5)) mk('LabCoat'); return out; }
    // people dressed for the weather when they turned
    const cold = Season.tree === 'b' || Season.snow > 0.2 || Season.tree === 's', warm = Season.tree === 'g';
    mk(cold ? R.pick(['Shirt', 'Shirt', 'TShirt', 'Sweater']) : R.pick(['TShirt', 'TShirt', 'Shirt', 'TankTop', 'Shirt']));
    if (R.chance(cold ? 0.8 : warm ? 0.25 : 0.5)) mk(cold ? R.pick(['WinterCoat', 'WinterCoat', 'Hoodie', 'LeatherJacket', 'DenimJacket']) : R.pick(['Hoodie', 'DenimJacket', 'Sweater', 'LeatherJacket', 'WinterCoat']));
    mk(female && warm && R.chance(0.3) ? 'Shorts' : cold ? R.pick(['Jeans', 'Jeans', 'Trousers', 'CargoPants']) : R.pick(['Jeans', 'Jeans', 'Trousers', 'Shorts', 'CargoPants']));
    if (R.chance(0.85)) mk(cold ? R.pick(['Boots', 'Boots', 'Sneakers']) : R.pick(['Sneakers', 'Sneakers', 'Boots', 'DressShoes']));
    if (R.chance(cold ? 0.45 : 0.15)) mk(cold ? R.pick(['Beanie', 'Beanie', 'BaseballCap']) : R.pick(['BaseballCap', 'Beanie']));
    if (cold && R.chance(0.25)) mk(R.pick(['Gloves', 'Scarf']));
    if (R.chance(0.3)) mk('Belt');
    if (R.chance(0.06)) { const b = Items.make(R.pick(['SchoolBag', 'HikingBag', 'DuffelBag'])); b.worn = 'back'; b.items = Loot.zombiePockets(); out.push(b); }
    return out;
  },
  computeLook(z) {
    const L = { skin: z.skin, hair: z.hairCol, hairStyle: z.hair, zombie: !z.victim, blood: z.blood, female: z.female };
    const get = (s) => z.wear.find(it => it.worn === s);
    const shirt = get('shirt'), jacket = get('jacket'), pants = get('pants'), shoes = get('shoes'), hat = get('hat'), back = get('back'), vest = get('vest');
    const dirty = (c) => Col.mix(c, '#3a2a20', 0.3);
    L.shirt = shirt ? dirty(shirt.col) : z.skin;
    L.sleeves = shirt ? (ITEMS[shirt.id].cover.includes('farms') ? 'long' : 'short') : 'none';
    L.jacket = jacket ? dirty(jacket.col) : null;
    L.pants = pants ? dirty(pants.col) : z.skin;
    L.shorts = pants ? !ITEMS[pants.id].cover.includes('llegs') : true;
    L.shoes = shoes ? shoes.col : z.skin;
    L.hat = hat ? { type: ITEMS[hat.id].hatType || 'cap', col: hat.col } : null;
    L.bag = back ? (back.col || '#444') : null;
    L.vest = vest ? vest.col : null;
    L.gore = z.gore;
    return L;
  },
  // ------------------------------------------------------------------ feeding
  // a body that was never one of them: torn open where it fell, a while ago (minutes)
  victim(x, y, ago) {
    const z = this.create(x, y);
    z.victim = true; z.skin = R.pick(SKIN_TONES); z.blood = 1;
    z.dead = true; z.st = 'dead'; z.hp = 0; z.lie = 1; z.lieDir = R.chance(0.75) ? 1 : -1;
    z.diedAt = G.time - (ago === undefined ? R.f(30, 900) : ago); z.fallAt = undefined;
    z.loot = z.wear.concat(Loot.zombiePockets());
    for (const it of z.loot) { if (it.worn && ITEMS[it.id].cat === 'Clothing') delete it.worn; }
    const g = Gore.st(z);
    for (let k = R.int(2, 5); k > 0; k--) g.w.push([R.chance(0.6) ? 'chest' : 'belly', Math.round(R.f(0.2, 0.9) * 100) / 100, Math.round(R.f(-1.2, 1.2) * 100) / 100, Math.round(R.f(0.03, 0.06) * 1000) / 1000, 0]);
    if (Settings.v.dismember && R.chance(0.35)) g.m |= R.pick([GM.FARM_L, GM.FARM_R, GM.ARM_L, GM.SHIN_L, GM.SHIN_R]);
    g.n++;
    z.look = this.computeLook(z);
    return z;
  },
  // kneel by the body at (bx, by) and eat (for t seconds; 1e9: until something better comes along)
  feedOn(z, bx, by, t) {
    z.st = 'feed'; z.fx = bx; z.fy = by; z.feedT = t === undefined ? R.f(25, 70) : t; z.feeding = false; z.path = null;
  },
  feedUpdate(z, dt, dPlayer) {
    const dx = z.fx - z.x, dy = z.fy - z.y, d = Math.sqrt(dx * dx + dy * dy);
    z.feedT -= dt;
    if (z.feedT <= 0) { z.st = 'idle'; z.feeding = false; z.idleT = R.f(15, 45); return; }
    if (d > 0.9) {
      z.feeding = false; z.tx = z.fx; z.ty = z.fy;
      this.moveToward(z, dt, z.speed * 0.8, dPlayer);
      if (z.st !== 'feed') z.feeding = false;
      return;
    }
    if (d < 0.45) { World.move(z, -dx / (d || 1) * dt * 0.6, -dy / (d || 1) * dt * 0.6, z.r); }
    z.feeding = true;
    z.amp = Math.max(0, z.amp - dt * 3);
    z.a = U.normAng(z.a + U.clamp(U.angDiff(z.a, Math.atan2(dy, dx)), -dt * 3, dt * 3));
    // wet tearing: a little blood thrown up now and then (close by only)
    if (dPlayer < 22 && Gore.lv() > 0 && R.chance(dt * 0.5)) Gore.burst(z.fx, z.fy, 0.25, 3, z.a + Math.PI, 0.9, 0.3, 1.1, 0.6, 1.6);
    if (dPlayer < 14 && R.chance(dt * 0.12)) Sfx.play('zhit', z.x, z.y);
  },
  // an idle zombie looks for a body to eat nearby: the player's, or a victim's
  findMeal(z) {
    const p = G.player;
    if (p.dead && !p.inCar && World.lvDist(z.x, z.y, p.x, p.y) < 12) { this.feedOn(z, p.x, p.y, 1e9); return true; }
    if (!R.chance(0.5)) return false;
    for (const c of this.near(z.x, z.y, 8)) if (c.dead && c.victim && this.rot(c) < 0.6 && World.lineClear(z.x, z.y, c.x, c.y, 'move')) { this.feedOn(z, c.x, c.y); return true; }
    return false;
  },
  // ------------------------------------------------------------------ spawning
  spawnAll(avoidX, avoidY) {
    G.zombies = [];
    const w = Wd;
    const okTile = (x, y) => World.inb(x, y) && !World.tileSolid(x, y) && !World.isWater(x, y) && World.lvDist(x, y, avoidX, avoidY) > 22;
    const pop = G.sb ? G.sb.pop : 1;
    for (const zn of w.zones) {
      let n = Math.round(zn.n * pop), tries = 0;
      while (n > 0 && tries++ < zn.n * 30) {
        const x = R.int(zn.x0, zn.x1), y = R.int(zn.y0, zn.y1);
        if (!okTile(x, y) || World.room(x, y) >= 0) continue;
        const z = this.create(x + R.f(0.2, 0.8), y + R.f(0.2, 0.8), zn.outfit);
        G.zombies.push(z); n--;
        // small groups
        if (R.chance(0.25)) for (let k = 0; k < R.int(1, 3) && n > 0; k++) {
          const gx = x + R.int(-2, 2), gy = y + R.int(-2, 2);
          if (okTile(gx, gy) && World.room(gx, gy) < 0) { G.zombies.push(this.create(gx + 0.5, gy + 0.5, zn.outfit)); n--; }
        }
      }
    }
    for (const b of w.buildings) {
      let n = (b.zIndoor || 0) * pop;
      if (b.isHome) continue;
      while (n > 0) {
        if (n < 1 && !R.chance(n)) break;
        n--;
        const rid = R.pick(b.rooms);
        const rm = w.rooms[rid];
        for (let t = 0; t < 10; t++) {
          const x = R.int(rm.x0, rm.x1), y = R.int(rm.y0, rm.y1);
          if (okTile(x, y)) { G.zombies.push(this.create(x + 0.5, y + 0.5, b.type === 'police' ? 'police' : b.type === 'clinic' ? 'medic' : null)); break; }
        }
      }
    }
  },
  // ------------------------------------------------------------------ spatial hash
  // linked lists in typed arrays, rebuilt every step without allocating: gHead[cell] -> first slot,
  // gNext[slot] -> next slot, gRef[slot] -> zombie (references, so splices between rebuilds stay safe)
  rebuildGrid() {
    const C = this.CELL, gw = Math.ceil(Wd.w / C), gh = Math.ceil(Wd.h / C), zs = G.zombies, n = zs.length;
    if (!this.gHead || this.gw !== gw || this.gh !== gh) { this.gw = gw; this.gh = gh; this.gHead = new Int32Array(gw * gh); }
    if (!this.gNext || this.gNext.length < n) this.gNext = new Int32Array(Math.max(256, n * 1.5 | 0));
    const head = this.gHead, next = this.gNext, ref = this.gRef;
    head.fill(-1);
    if (ref.length > n) ref.length = n;
    // backwards so each cell lists its zombies in array order
    for (let i = n - 1; i >= 0; i--) {
      const z = zs[i];
      ref[i] = z;
      const cx = Math.floor(z.x / C), cy = Math.floor(z.y / C);
      if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) continue;
      const k = cy * gw + cx;
      next[i] = head[k]; head[k] = i;
    }
  },
  near(x, y, r) {
    const out = [];
    if (!this.gHead) return out;
    const C = this.CELL, gw = this.gw, head = this.gHead, next = this.gNext, ref = this.gRef;
    const x0 = Math.max(0, Math.floor((x - r) / C)), x1 = Math.min(gw - 1, Math.floor((x + r) / C));
    const y0 = Math.max(0, Math.floor((y - r) / C)), y1 = Math.min(this.gh - 1, Math.floor((y + r) / C));
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = head[cy * gw + cx]; i >= 0; i = next[i]) { const z = ref[i], dx = z.x - x, dy = z.y - y; if (dx * dx + dy * dy <= r2) out.push(z); }
    }
    return out;
  },
  // push z out of standing zombies it overlaps (walks the grid directly: runs for every walker every step)
  separate(z) {
    if (!this.gHead) return;
    const C = this.CELL, gw = this.gw, head = this.gHead, next = this.gNext, ref = this.gRef;
    const x0 = Math.max(0, Math.floor((z.x - 0.6) / C)), x1 = Math.min(gw - 1, Math.floor((z.x + 0.6) / C));
    const y0 = Math.max(0, Math.floor((z.y - 0.6) / C)), y1 = Math.min(this.gh - 1, Math.floor((z.y + 0.6) / C));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = head[cy * gw + cx]; i >= 0; i = next[i]) {
        const o = ref[i];
        if (o === z || o.dead || o.lie > 0.5) continue;
        const sx = z.x - o.x, sy = z.y - o.y, s2 = sx * sx + sy * sy;
        if (s2 < 0.25 && s2 > 1e-6) { const sd = Math.sqrt(s2), pp = (0.5 - sd) / sd * 0.3; z.x += sx * pp; z.y += sy * pp; }
      }
    }
  },
  // ------------------------------------------------------------------ update
  // Level of detail (settings): by CHUNK x CHUNK-tile chunk distance from the player - near chunks every step,
  // 3-5 chunks every other step (unless chasing or on screen), 6-11 a coarse update every ~2 s, 12+ frozen.
  // With a crowd close by, adaptive physics updates each crowd zombie every other step instead.
  updateAll(dt) {
    this.rebuildGrid();
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
    const lazy = Settings.v.zLazy, crowd = Settings.v.zAdapt && (this.nearN || 0) > 120;
    const W0 = LV.W0, plv = px >= W0, pvx = plv ? px - W0 : px;
    const pcx = Math.floor(pvx / CHUNK), pcy = Math.floor(py / CHUNK);
    const tick = this.tick = (this.tick || 0) + 1;
    let chasing = 0, nearN = 0, upd = 0;
    const zs = G.zombies;
    for (let k = 0; k < zs.length; k++) {
      const z = zs[k];
      if (z.dead) { if (z.lie < 1) z.lie = Math.min(1, z.lie + dt * 2.5); continue; }
      // World.lvDist inlined; frozen chunks (12+ away, so never within 32 tiles) skip even that
      const zl = z.x >= W0, zvx = zl ? z.x - W0 : z.x;
      const cd = Math.max(Math.abs(Math.floor(zvx / CHUNK) - pcx), Math.abs(Math.floor(z.y / CHUNK) - pcy));
      if (lazy && cd >= 12) { if (z.va) z.va = 0; continue; }
      const ddx = zvx - pvx, ddy = z.y - py;
      const d = Math.sqrt(ddx * ddx + ddy * ddy) + (zl !== plv ? 4 : 0);
      if (d < 32) nearN++;
      let zdt = dt;
      if (lazy) {
        if (cd >= 6 || d > 60) { z.far = (z.far || 0) + dt; if (z.far > (cd >= 6 ? 2 : 1)) { this.farUpdate(z, z.far); z.far = 0; } z.va = 0; continue; }
        const busy = z.st === 'chase' || z.st === 'attack' || z.va > 0.01;
        const rate = (!busy && cd >= 3) || (crowd && d < 32 && z.st !== 'attack') ? 2 : 1;
        if (rate > 1) {
          z.acc = (z.acc || 0) + dt;
          if ((tick + k) % rate) continue;
          zdt = z.acc; z.acc = 0;
        } else if (z.acc) { zdt += z.acc; z.acc = 0; }
      } else if (d > 60) { z.far = (z.far || 0) + dt; if (z.far > 1) { this.farUpdate(z, z.far); z.far = 0; } z.va = 0; continue; }
      this.update(z, zdt, px, py, d);
      upd++;
      if (z.st === 'chase' || z.st === 'attack') chasing++;
    }
    this.nearN = nearN; this.updN = upd;
    G.chasing = chasing;
    // corpse cleanup (a scan of every zombie, so twice a second is plenty)
    if (G.zombies.length > 900 && tick % 15 === 0) {
      const idx = G.zombies.findIndex(z => z.dead && U.dist(z.x, z.y, px, py) > 40);
      if (idx >= 0) G.zombies.splice(idx, 1);
    }
    if (Settings.v.corpses > 0 && tick % 15 === 7) this.corpseLimit(Settings.v.corpses, px, py);
  },
  // Corpse limit setting: past it, the oldest bodies out of sight (12+ tiles away, not visible) decay away and leave
  // what they carried on the ground; at most 20 per pass
  corpseLimit(max, px, py) {
    let n = 0;
    const C = [];
    for (const z of G.zombies) {
      if (!z.dead) continue;
      n++;
      if (World.lvDist(z.x, z.y, px, py) > 12 && !World.isVis(Math.floor(z.x), Math.floor(z.y))) C.push(z);
    }
    if (n <= max || !C.length) return;
    C.sort((a, b) => (a.diedAt === undefined ? -1e9 : a.diedAt) - (b.diedAt === undefined ? -1e9 : b.diedAt));
    const gone = new Set(C.slice(0, Math.min(20, n - max)));
    for (const z of gone) if (z.loot) for (const it of z.loot) World.dropItem(z.x, z.y, it);
    G.zombies = G.zombies.filter(z => !gone.has(z));
    this.rebuildGrid();
  },
  farUpdate(z, dt) {
    if (z.st === 'investigate') {
      const dx = World.lvX(z, z.tx) - z.x, dy = z.ty - z.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) { z.st = 'idle'; return; }
      const step = Math.min(d, z.speed * 0.7 * dt);
      World.move(z, dx / d * step, dy / d * step, z.r);
    }
  },
  sightRange(z, p) {
    let r = 18;
    const amb = G.light.amb;
    const pl = Render.lightAt(p.x, p.y);
    if (amb < 0.5) r = U.lerp(6, 18, Math.max(amb, Math.min(1, pl)) / 0.9);
    if (Player.flashlight()) r = Math.max(r, 16);
    if (p.sneak) r *= 0.55 - Player.skill('Sneaking') * 0.025;
    if (Player.hasTrait('inconspicuous')) r *= 0.75;
    if (Player.hasTrait('conspicuous')) r *= 1.3;
    if (G.weather.fog > 0) r *= 1 - G.weather.fog * 0.5;
    if (G.weather.rain > 0.5) r *= 0.85;
    // busy eating, they notice little
    if (z.st === 'feed' && z.feeding) r *= 0.45;
    return r;
  },
  update(z, dt, px, py, d) {
    const p = G.player;
    z.ph += 0; // keep
    if (z.cd > 0) z.cd -= dt;
    // visual fade
    // (after death the camera stays on the body: those close by are seen gathering and feeding)
    const vis = p.dead ? d < 9 : World.isVis(Math.floor(z.x), Math.floor(z.y)) && (Render.lightAt(z.x, z.y) > 0.13 || d < 2.6 || Render.shadeAt(z.x, z.y) > 0.2);
    z.va = U.clamp(z.va + (vis ? dt * 5 : -dt * 3), 0, 1);
    // fake-dead: lies still until the player is close
    if (z.fake) {
      z.va = vis ? 1 : z.va;
      if (!p.dead && !p.inCar && d < 2.2) { z.fake = false; z.st = 'getup'; z.getT = 0; z.downT = 0; z.canSee = true; Sfx.groan(z, d, true); }
      return;
    }
    // knocked down
    if (z.st === 'down') {
      z.lie = Math.min(1, z.lie + dt * 3);
      z.downT -= dt;
      this.slide(z, dt);
      if (z.downT <= 0 && !z.crawl) { z.st = 'getup'; z.getT = 0; }
      if (z.crawl && z.downT <= 0) { z.st = 'chase'; }
      return;
    }
    if (z.st === 'getup') {
      // rolling over, onto a knee and up takes a while (lie stays meaningful for what can hit it)
      z.getT = (z.getT || 0) + dt;
      z.lie = Math.min(z.lie, Math.max(0, 1 - z.getT / this.GETUP));
      if (z.getT >= this.GETUP) { z.st = 'chase'; z.lie = 0; z.getT = 0; z.mem = 4; z.tx = px; z.ty = py; }
      return;
    }
    if (z.stag > 0) { z.stag -= dt; this.slide(z, dt); return; }
    if (z.biteT > 0) z.biteT -= dt;
    if (z.st === 'climb') { this.climbUpdate(z, dt); return; }
    // perception
    z.think -= dt;
    if (z.think <= 0) {
      z.think = R.f(0.25, 0.45);
      this.perceive(z, p, px, py, d);
    }
    // groans
    z.groanT -= dt;
    if (z.groanT <= 0) { z.groanT = R.f(5, 14); if (d < 18) Sfx.groan(z, d, z.st === 'chase'); }
    // attack
    if (z.st === 'attack') {
      z.atkT -= dt;
      z.a = U.normAng(z.a + U.clamp(U.angDiff(z.a, Math.atan2(py - z.y, px - z.x)), -dt * 5, dt * 5));
      z.amp = Math.max(0, z.amp - dt * 3);
      if (z.atkT <= 0) {
        if (p.inCar) { if (d < 2.2) Vehicles.zombieHit(p.inCar, z); }
        else if (d < 1.05 && World.lineClear(z.x, z.y, px, py, 'move') && !p.dead) Player.zombieAttack(z);
        z.cd = R.f(0.9, 1.4);
        z.st = 'chase'; z.biteT = 0.4;
      }
      return;
    }
    if (z.st === 'thump') { this.thumpUpdate(z, dt); return; }
    if (z.st === 'feed') { this.feedUpdate(z, dt, d); return; }
    // movement
    let speed = 0;
    if (z.st === 'chase') {
      speed = z.speed * (d < 2.5 ? 1.25 : 1);
      if (!p.dead && z.canSee) { z.tx = px; z.ty = py; }
      const reach = p.inCar ? 1.9 : 0.85;
      if (!p.dead && d < reach && z.cd <= 0 && (z.canSee || d < 1) && (p.inCar || World.lineClear(z.x, z.y, px, py, 'move'))) { z.st = 'attack'; z.atkT = z.atk0 = R.f(0.55, 0.85) * (z.crawl ? 1.4 : 1); Sfx.play('zattack', z.x, z.y); return; }
    } else if (z.st === 'investigate') speed = z.speed * 0.8;
    else if (z.st === 'wander') speed = 0.32;
    else {
      z.idleT -= dt;
      z.amp = Math.max(0, z.amp - dt * 2);
      if (z.idleT <= 0) {
        z.idleT = R.f(4, 14);
        if (this.findMeal(z)) return;
        if (R.chance(0.45)) {
          const tx = z.x + R.f(-5, 5), ty = z.y + R.f(-5, 5);
          if (World.inb(tx | 0, ty | 0) && World.pathClear(z.x, z.y, tx, ty, z.r)) { z.st = 'wander'; z.tx = tx; z.ty = ty; }
        } else z.a += R.f(-1, 1);
      }
      return;
    }
    if (z.crawl) speed *= 0.3;
    this.moveToward(z, dt, speed, d);
  },
  perceive(z, p, px, py, d) {
    if (p.dead || Debug.invisible) {
      if (p.dead && (z.st === 'chase' || z.st === 'attack' || z.st === 'investigate') && !p.inCar && d < 9) this.feedOn(z, p.x, p.y, 1e9);
      else if (z.st === 'chase' || z.st === 'attack') { z.st = 'investigate'; }
      z.canSee = false; return;
    }
    const target = p.inCar || p;
    let see = false;
    const sr = p.inCar ? 22 : this.sightRange(z, p);
    if (d < sr && (z.x >= LV.W0) === (px >= LV.W0)) {
      const ad = Math.abs(U.angDiff(z.a, Math.atan2(py - z.y, px - z.x)));
      const fov = (z.st === 'chase') ? Math.PI : 1.25;
      if ((ad < fov || d < 1.6) && World.lineClear(z.x, z.y, px, py, 'sight')) see = true;
      if (d < 1.2) see = true;
    }
    if (p.asleep && d > 2.5 && z.st !== 'chase') see = see && d < 4;
    void target;
    if (see) {
      const busy = z.st === 'attack' || z.st === 'thump' || z.st === 'climb';
      if (!busy) {
        if (z.st !== 'chase') { if (d < 20) Sfx.groan(z, d, true); z.path = null; }
        z.st = 'chase';
      }
      z.canSee = true; z.mem = 12; z.tx = px; z.ty = py;
    } else {
      z.canSee = false;
      if (z.st === 'chase') {
        z.mem -= 0.35;
        if (z.mem <= 0) { z.st = 'investigate'; }
      }
    }
  },
  moveToward(z, dt, speed, dPlayer) {
    // a target on the other floor is steered toward from directly below/above until a path is found
    const cross = (z.x >= LV.W0) !== (z.tx >= LV.W0);
    const dx = World.lvX(z, z.tx) - z.x, dy = z.ty - z.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.4 && z.st !== 'chase') {
      z.st = 'idle'; z.path = null; z.idleT = R.f(3, 10);
      return;
    }
    let mx, my;
    z.pathT -= dt;
    let direct;
    if (cross) direct = false;
    else if (dist < 1.2) direct = World.lineClear(z.x, z.y, z.tx, z.ty, 'move');
    else { z.dcT = (z.dcT || 0) - dt; if (z.dcT <= 0) { z.dcT = 0.4; z.dcOk = World.pathClear(z.x, z.y, z.tx, z.ty, z.r * 0.8); } direct = z.dcOk; }
    if (direct) {
      z.path = null;
      mx = dx / (dist || 1); my = dy / (dist || 1);
    } else {
      z.pathCool = (z.pathCool || 0) - dt;
      if ((!z.path || z.pathT <= 0) && z.pathCool <= 0) {
        z.pathT = R.f(1.5, 2.5) + (dPlayer > 25 ? 2 : 0);
        z.pathCool = R.f(1.0, 1.8) + (dPlayer > 25 ? 2 : 0);
        z.path = World.findPath(z.x, z.y, z.tx, z.ty, 'z', dPlayer < 25 ? 900 : 400);
        z.pi = 0;
        if (!z.path) { z.st = z.st === 'chase' ? 'chase' : 'idle'; mx = dx / dist; my = dy / dist; }
      } else if (!z.path) { mx = dx / dist; my = dy / dist; }
      if (z.path) {
        while (z.pi < z.path.length) {
          const [wx, wy] = z.path[z.pi];
          if (Math.floor(z.x) === wx && Math.floor(z.y) === wy) z.pi++;
          else break;
        }
        if (z.pi >= z.path.length) { z.path = null; mx = dx / dist; my = dy / dist; }
        else {
          const wy = z.path[z.pi][1], wx = World.lvX(z, z.path[z.pi][0]);
          // blocked edge between current tile and next waypoint?
          const cx = Math.floor(z.x), cy = Math.floor(z.y);
          if (Math.abs(wx - cx) + Math.abs(wy - cy) === 1) {
            const e = World.edgeBetween(cx, cy, wx, wy);
            if (World.edgeBlocksMove(e[0], e[1], e[2])) {
              const ex = e[2] ? e[0] : e[0] + 0.5, ey = e[2] ? e[1] + 0.5 : e[1];
              if (U.dist(z.x, z.y, ex, ey) < 0.75) { this.startObstacle(z, e, wx, wy); return; }
            }
          }
          const gx = wx + 0.5 - z.x, gy = wy + 0.5 - z.y, gl = Math.sqrt(gx * gx + gy * gy) || 1;
          mx = gx / gl; my = gy / gl;
        }
      }
    }
    if (mx === undefined) return;
    const ta = Math.atan2(my, mx);
    z.a = U.normAng(z.a + U.clamp(U.angDiff(z.a, ta), -dt * 4, dt * 4));
    const ox = z.x, oy = z.y;
    World.move(z, mx * speed * dt, my * speed * dt, z.r);
    Vehicles.pushOut(z, z.r);
    this.separate(z);
    const moved = U.dist(ox, oy, z.x, z.y);
    z.ph += moved * 3.6;
    z.amp = Math.min(0.7, z.amp + dt * 3);
    if (moved < speed * dt * 0.15 && speed > 0.1) { z.stuck = (z.stuck || 0) + dt; if (z.stuck > 1.5) { z.stuck = 0; z.path = null; z.pathT = 0; z.dcT = 0; if (z.st === 'wander') z.st = 'idle'; } } else z.stuck = 0;
  },
  slide(z, dt) {
    if (Math.abs(z.svx) + Math.abs(z.svy) < 0.01) return;
    World.move(z, z.svx * dt, z.svy * dt, z.r);
    z.svx *= Math.max(0, 1 - dt * 6); z.svy *= Math.max(0, 1 - dt * 6);
  },
  // ------------------------------------------------------------------ obstacles
  startObstacle(z, e, wx, wy) {
    const [x, y, d] = e;
    const f = World.feat(x, y, d);
    const t = World.wall(x, y, d);
    z.obE = e; z.obTo = [wx + 0.5, wy + 0.5];
    // clever dead turn handles
    if (G.sb && G.sb.smart && f && f.k === 'door' && !f.locked && !f.barricade && !f.broken && !f.open && f.style !== 'garage') {
      f.open = true; Sfx.play('doorOpen', x + 0.5, y + 0.5); z.path = null; return;
    }
    if (f && (f.k === 'door' || (f.k === 'window' && (f.barricade > 0 || (!f.smashed && !f.open))))) {
      z.st = 'thump'; z.thumpT = R.f(0.3, 1.0); z.thump0 = 1;
      return;
    }
    if ((f && f.k === 'window') || (!f && WALL_INFO[t] && WALL_INFO[t].climb)) {
      z.st = 'climb'; z.climbT = 0;
      z.climbDur = f ? 2.2 : WALL_INFO[t].climb * 1.3;
      z.cFrom = [z.x, z.y];
      z.fall = !f && WALL_INFO[t].h > 1.2;
      return;
    }
    z.path = null;
  },
  thumpUpdate(z, dt) {
    const [x, y, d] = z.obE;
    const f = World.feat(x, y, d);
    const ex = d ? x : x + 0.5, ey = d ? y + 0.5 : y;
    z.a = U.normAng(z.a + U.clamp(U.angDiff(z.a, Math.atan2(ey - z.y, ex - z.x)), -dt * 5, dt * 5));
    z.amp = 0;
    if (!f || !World.edgeBlocksMove(x, y, d) || (f.k === 'window' && !f.barricade && (f.smashed || f.open))) { z.st = z.canSee ? 'chase' : 'investigate'; if (f && f.k === 'window') this.startObstacle(z, z.obE, Math.floor(z.obTo[0]), Math.floor(z.obTo[1])); return; }
    // keep checking if we can see the player
    z.think -= dt;
    if (z.think <= 0) { z.think = 0.5; const p = G.player; this.perceive(z, p, p.x, p.y, U.dist(z.x, z.y, p.x, p.y)); if (z.canSee && World.pathClear(z.x, z.y, z.tx, z.ty, z.r)) { z.st = 'chase'; return; } }
    z.thumpT -= dt;
    if (z.thumpT > 0) return;
    z.thumpT = z.thump0 = R.f(1.0, 1.6);
    Interact.damageEdge(x, y, d, R.f(2, 5), z);
  },
  climbUpdate(z, dt) {
    z.climbT += dt;
    const k = Math.min(1, z.climbT / z.climbDur);
    z.x = U.lerp(z.cFrom[0], z.obTo[0], k); z.y = U.lerp(z.cFrom[1], z.obTo[1], k);
    z.a = Math.atan2(z.obTo[1] - z.cFrom[1], z.obTo[0] - z.cFrom[0]);
    if (k >= 1) {
      z.path = null;
      if (z.fall) this.knockDown(z, z.a, 0, R.f(1, 2), -1);
      else z.st = z.canSee ? 'chase' : 'investigate';
      if (z.st === 'investigate' && U.dist(z.x, z.y, z.tx, z.ty) < 1) z.st = 'idle';
      World.resolve(z, z.r);
    }
  },
  // ------------------------------------------------------------------ damage
  hit(z, dmg, fromA, o) {
    o = o || {};
    if (z.dead) return;
    if (z.fake) { z.fake = false; z.downT = R.f(0.8, 1.6); }
    if (z.st === 'down') dmg *= 1.5;
    z.hp -= dmg;
    // blood by the kind of blow, wounds, limbs that come off (gore.js; o.kind blunt / blade / chop / stab / gun ...)
    z.blood = Math.min(1, z.blood + 0.2);
    z.look.blood = z.blood;
    Gore.hit(z, dmg, fromA, o);
    if (z.dead) return;
    const p = G.player;
    if (z.st !== 'down' && z.st !== 'climb' && z.st !== 'getup') { z.st = 'chase'; z.mem = 10; z.tx = p.x; z.ty = p.y; z.canSee = true; }
    if (z.hp <= 0) { o.dmg = dmg; this.kill(z, fromA, o); return; }
    const pushA = fromA !== undefined ? fromA : z.a + Math.PI;
    // a blow while it is still half way up puts it back down
    if ((o.knock || (z.st === 'getup' && z.lie > 0.35 && o.stag !== 0)) && z.st !== 'down' && z.st !== 'climb') {
      this.knockDown(z, pushA, 1.6, R.f(1.8, 3.6), z.st === 'getup' ? z.lieDir : 0);
      if (R.chance(0.08)) z.crawl = true;
      Sfx.play('zfall', z.x, z.y);
    } else if (z.st !== 'down' && z.st !== 'climb' && z.st !== 'getup' && o.stag !== 0) this.stagger(z, pushA, o.stag || R.f(0.35, 0.6), o.push || 1.2);
  },
  // knocked off its feet by a push from angle a: it falls away from the push (on its back when hit from the front)
  knockDown(z, a, push, dur, dir) {
    z.st = 'down'; z.downT = dur; z.downAt = G.time; z.stag = 0; z.getT = 0;
    z.lieDir = dir || (Math.cos(U.angDiff(z.a, a)) < 0.2 ? 1 : -1);
    z.svx = Math.cos(a) * push; z.svy = Math.sin(a) * push;
  },
  // where a body on the ground lies, as drawn: head and hips (it falls away from where it stood: back down, the
  // head ends up behind its feet; face down or crawling, ahead)
  bodyLine(z) {
    const down = z.crawl && !z.dead ? -1 : (z.lieDir || 1), c = Math.cos(z.a), s = Math.sin(z.a);
    const hip = z.crawl && !z.dead ? 0.1 : down > 0 ? -0.42 : 0.4, head = hip + down * -0.76;
    return [z.x + c * head, z.y + s * head, z.x + c * hip, z.y + s * hip];
  },
  // reeling back from a blow or a shove
  stagger(z, a, t, push) {
    z.stag = z.stag0 = t;
    z.stagA = U.angDiff(z.a, a);
    z.svx = Math.cos(a) * push; z.svy = Math.sin(a) * push;
    if (z.st === 'attack') { z.st = 'chase'; z.cd = Math.max(z.cd, 0.6); }
  },
  GETUP: 1.6,
  kill(z, fromA, o) {
    const wasDown = (z.st === 'down' || z.crawl) && z.lie > 0.5;
    z.dead = true; z.st = 'dead'; z.hp = 0;
    z.diedAt = G.time; z.fallAt = wasDown ? undefined : G.time;
    // dropped on its back by a blow from the front, on its face from behind; already down it stays as it lies
    if (z.crawl) z.lieDir = -1;
    else if (!wasDown) z.lieDir = fromA !== undefined ? (Math.cos(U.angDiff(z.a, fromA)) < 0.3 ? 1 : -1) * (R.chance(0.85) ? 1 : -1) : R.chance(0.7) ? 1 : -1;
    if (z.lie < 0.01) z.lie = 0.05;
    const pushA = fromA !== undefined ? fromA : z.a + Math.PI;
    World.move(z, Math.cos(pushA) * 0.3, Math.sin(pushA) * 0.3, z.r);
    z.loot = z.wear.concat(Loot.zombiePockets());
    for (const it of z.loot) { if (it.worn && ITEMS[it.id].cat === 'Clothing') delete it.worn; }
    if (z.carKey) z.loot.push(z.carKey);
    if (o && !o.noKill) { G.player.kills++; }
    Gore.kill(z, fromA, o || {});
    Sfx.play('zdie', z.x, z.y);
  },
  // 0 = fresh .. 1 = badly decomposed (game days since death)
  rot(z) { const days = (G.time - (z.diedAt === undefined ? G.time - 2880 : z.diedAt)) / 1440; return U.clamp((days - 0.6) / 4, 0, 1); },
  // ------------------------------------------------------------------ draw
  // pose, light level and fade a zombie is drawn with (null when it is not drawn); worked out once per rendered frame
  dim: new WeakMap(),
  drawInfo(z) {
    const fno = Render.fno;
    let m = this.dim.get(z);
    if (m && m.f === fno) return m.d;
    if (!m) this.dim.set(z, m = { f: 0, d: null, dead: null });
    m.f = fno;
    return (m.d = this.info(z, m));
  },
  info(z, m) {
    let alpha = z.va;
    if (z.dead) alpha = 1;
    if (alpha < 0.02) return null;
    if (z.dead && !World.isVis(Math.floor(z.x), Math.floor(z.y)) && !Wd.seen[Math.floor(z.y) * Wd.w + Math.floor(z.x)]) return null;
    let s = Math.max(0.12, Render.shadeSmooth(z.x, z.y));
    const rot = z.dead ? this.rot(z) : 0;
    if (rot > 0) s *= 1 - rot * 0.35;
    // a settled body keeps its pose and result objects: only light and decay change
    const D0 = m && m.dead;
    if (D0 && z.dead && !z.fake && D0.pose.lieDir === z.lieDir) { D0.s = s; D0.rot = rot; return D0; }
    // animation state for Char3D (mode, prog 0..1 through it) plus the simpler fields the 2D painter reads
    const pose = { walk: z.ph, amp: z.amp, t: Render.tnow + z.id, arms: 'zombie', lean: 0.12, headF: 0.03, headS: Math.sin(z.id) * 0.03, limp: z.limp || 0, limpSide: z.limpSide || 1,
      mode: 'loco', gait: z.speed > 2 ? 'run' : 'shamble' };
    const since = (t) => t === undefined ? 1e9 : (G.time - t) / MIN_PER_SEC;
    if (z.st === 'chase' || z.st === 'attack') {
      const p = G.player, d = U.dist(z.x, z.y, p.x, p.y);
      pose.reach = U.clamp(1.6 - d * 0.4, 0, 1);
      if (z.canSee || d < 3) pose.look = U.clamp(U.angDiff(z.a, Math.atan2(p.y - z.y, p.x - z.x)), -1, 1);
    }
    if (z.st === 'attack') { pose.mode = 'attack'; pose.prog = 0.82 * U.clamp(1 - Math.max(0, z.atkT) / (z.atk0 || 0.7), 0, 1); pose.reach = 1; pose.lean = 0.3; }
    else if (z.biteT > 0 && !z.crawl && z.st !== 'down') { pose.mode = 'attack'; pose.prog = 1 - z.biteT / 0.4 * 0.18; }
    if (z.st === 'feed' && z.feeding) { pose.mode = 'feed'; pose.crouch = 0.75; pose.amp = 0; }
    if (z.st === 'thump') { pose.arms = 'thump'; pose.reach = 1; pose.lean = 0.3; pose.prog = U.clamp(1 - z.thumpT / (z.thump0 || 1), 0, 1); }
    if (z.stag > 0) { pose.mode = 'stagger'; pose.prog = U.clamp(1 - z.stag / (z.stag0 || 0.6), 0, 1); pose.stagA = z.stagA || Math.PI; }
    if (z.st === 'climb') { pose.arms = 'climb'; pose.mode = 'climb'; pose.prog = U.clamp(z.climbT / z.climbDur, 0, 1); pose.crouch = Math.sin(pose.prog * Math.PI) * 0.5; }
    if (z.lie > 0 || z.dead) { pose.lie = z.lie; pose.lieDir = z.lieDir; pose.amp = z.crawl && !z.dead ? z.amp : 0; pose.arms = z.dead ? 'idle' : 'zombie'; pose.lieOff = 0; }
    if (z.dead || z.fake) { pose.mode = 'dead'; pose.prog = z.fake ? 1 : U.clamp(since(z.fallAt) / 0.9, 0, 1); }
    else if (z.st === 'down') { pose.mode = z.crawl ? 'crawl' : 'fall'; pose.prog = U.clamp(since(z.downAt) / 0.7, 0, 1); }
    else if (z.st === 'getup') { pose.mode = 'getup'; pose.prog = U.clamp((z.getT || 0) / this.GETUP, 0, 1); }
    else if (z.crawl) pose.mode = 'crawl';
    if (z.crawl && !z.dead && z.st !== 'down') { pose.lie = 1; pose.lieDir = -1; pose.arms = 'zombie'; }
    const res = { pose, s, alpha, rot };
    if (m) m.dead = z.dead && !z.fake && pose.prog === 1 ? res : null;
    return res;
  },
  draw(ctx, z, flat) {
    void flat;
    const d = this.drawInfo(z);
    if (!d) return;
    const [X, Y] = Render.epos(z);
    const alpha = d.alpha, rot = d.rot;
    if (!Char3D.draw(ctx, z, X, Y, d.s, alpha)) Humanoid.draw(ctx, X, Y, z.a, z.look, d.pose, d.s, alpha);
    // (flies are sub-pixel specks when zoomed far out)
    const amb = Settings.v.ambient;
    if (rot > 0.15 && z.dead && amb > 0 && Render.cam.zoom > 0.8 && Math.abs(vxOf(z.x) - Render.cam.x) + Math.abs(z.y - Render.cam.y) < 26) {
      // flies buzzing over a rotting body
      const t = Render.tnow;
      ctx.fillStyle = 'rgba(10,10,10,0.85)';
      const n = Math.round((2 + rot * 5) * amb);
      for (let k = 0; k < n; k++) {
        const a = t * (2.3 + k * 0.7) + k * 2.1 + z.id;
        ctx.fillRect(X + 10 + Math.cos(a) * (6 + k * 2) + Math.sin(a * 2.7) * 3, Y - 6 + Math.sin(a * 1.3) * 5 - (k % 3) * 3, 1.5, 1.5);
      }
    }
    if (z.fire > 0 && alpha > 0.3) {
      const t = performance.now() / 1000 + z.id;
      const ly = z.lie > 0.5 ? 4 : 24;
      Fx.drawFlame(ctx, X - 3, Y - ly, t, 0.9); Fx.drawFlame(ctx, X + 4, Y - ly + 8, t + 1.3, 0.7);
      if (R.chance(0.15)) Fx.smoke(z.x, z.y, 1.8, true);
    }
  },
};

// ---------------------------------------------------------------------------
// Noise propagation
// ---------------------------------------------------------------------------
const Noise = {
  emit(x, y, radius, kind) {
    if (!G.zombies) return;
    const p = G.player;
    const rainMask = G.weather.rain > 0.6 ? 0.8 : 1;
    radius *= rainMask;
    // sound carries between floors, muffled
    const ox = x >= LV.W0 ? x - LV.W0 : x + LV.W0;
    const heard = Zombie.near(x, y, radius);
    if (ox < Wd.w && Wd.stairs.length) for (const z of Zombie.near(ox, y, radius * 0.6)) heard.push(z);
    for (const z of heard) {
      if (z.dead || z.st === 'down' || z.st === 'getup' || z.st === 'climb') continue;
      if (z.st === 'chase' && z.canSee) continue;
      if (z.st === 'thump' && kind !== 'gun' && kind !== 'alarm') continue;
      const d = World.lvDist(x, y, z.x, z.y);
      // walls and floors muffle
      let r = radius;
      if ((z.x >= LV.W0) !== (x >= LV.W0)) r *= kind === 'step' ? 0.35 : 0.6;
      else if (kind === 'step' && !World.lineClear(x, y, z.x, z.y, 'sight')) r *= 0.5;
      if (d > r) continue;
      const err = d * 0.12;
      z.tx = x + R.f(-err, err); z.ty = y + R.f(-err, err);
      if (z.st !== 'chase') z.st = 'investigate';
      z.path = null; z.pathT = 0; z.dcT = 0;
    }
    if (p && p.asleep && !['step', 'heli', 'gen', 'engine', 'meta', 'sneeze'].includes(kind) && U.dist(x, y, p.x, p.y) < Math.min(radius, 14)) p.wakeNoise = true;
  },
};
