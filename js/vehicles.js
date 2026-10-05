'use strict';
// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
const CAR_TYPES = {
  sedan: { n: 'Sedan', len: 2.3, wid: 1.05, h: 0.72, cab: [-0.32, 0.22], cabH: 0.52, maxV: 15, acc: 4.5, trunk: 35, cols: ['#8a2a2a', '#2a4a7a', '#d8d8d0', '#3a3a3a', '#5a6a4a', '#a08a5a', '#6a7a8a', '#7a2a5a'] },
  pickup: { n: 'Pickup Truck', len: 2.5, wid: 1.1, h: 0.82, cab: [-0.05, 0.3], cabH: 0.58, bed: true, maxV: 14, acc: 4.2, trunk: 50, cols: ['#3a5a3a', '#7a3a2a', '#2a3a5a', '#c8c0a8', '#4a4a4a'] },
  van: { n: 'Van', len: 2.5, wid: 1.15, h: 0.85, cab: [-0.48, 0.36], cabH: 0.75, maxV: 12, acc: 3.5, trunk: 70, cols: ['#e0e0d8', '#3a4a6a', '#8a8a7a', '#5a3a2a'] },
  police: { n: 'Police Car', len: 2.35, wid: 1.05, h: 0.72, cab: [-0.32, 0.22], cabH: 0.52, maxV: 16, acc: 5, trunk: 35, cols: ['#f0f0f0'], lightbar: true },
  firetruck: { n: 'Fire Truck', len: 3.4, wid: 1.25, h: 1.05, cab: [0.18, 0.48], cabH: 0.6, maxV: 10, acc: 2.6, trunk: 60, cols: ['#c02020'] },
};
let _carId = 1;
const Vehicles = {
  typeName(c) { return CAR_TYPES[c.type].n; },
  spawnAll() {
    G.cars = [];
    this.active = null;
    for (const sp of Wd.carSpots) {
      let type = sp.kind || R.weighted([['sedan', 6], ['pickup', 2.5], ['van', 1.5], ['police', 0.4]]);
      const T = CAR_TYPES[type];
      const c = {
        id: _carId++, type, x: sp.x, y: sp.y, a: sp.a, v: 0, steer: 0,
        col: R.pick(T.cols), gas: sp.crashed ? R.f(0, 0.2) : R.f(0.05, 0.75), hp: sp.crashed ? R.f(15, 45) : R.f(55, 100),
        locked: R.chance(0.65), keyIn: R.chance(sp.crashed ? 0.3 : 0.08), engine: false, lightsOn: false, winBroken: false,
        alarm: R.chance(0.2), trunkOpen: false,
        trunk: { type: 'trunk', cap: T.trunk, items: null }, glove: { type: 'glovebox', cap: 5, items: null },
      };
      if (c.keyIn) c.locked = false;
      // occupy check
      if (G.cars.some(o => U.dist(o.x, o.y, c.x, c.y) < 2.6)) continue;
      G.cars.push(c);
      // keys
      if (!c.keyIn) {
        const key = Items.make('CarKey', { set: { keyId: c.id, keyName: 'Key for a ' + T.n.toLowerCase() + ' (' + this.colName(c.col) + ')' } });
        if (sp.driveway !== undefined) {
          const b = Wd.buildings[sp.driveway];
          const rm = b.rooms.map(r => Wd.rooms[r]).find(r => r.type === 'kitchen' || r.type === 'living');
          let placed = false;
          if (rm) for (let y = rm.y0; y <= rm.y1 && !placed; y++) for (let x = rm.x0; x <= rm.x1 && !placed; x++) {
            const o = World.obj(x, y);
            if (o && o.c && (o.t === 'counter' || o.t === 'dresser')) { World.contItems(o, x, y); o.c.items.push(key); placed = true; }
          }
        } else if (R.chance(0.5)) {
          const zs = Zombie.near(c.x, c.y, 25).filter(z => !z.carKey);
          if (zs.length) R.pick(zs).carKey = key;
        }
      }
    }
  },
  colName(c) {
    const m = { '#8a2a2a': 'red', '#2a4a7a': 'blue', '#d8d8d0': 'white', '#3a3a3a': 'black', '#5a6a4a': 'green', '#a08a5a': 'beige', '#6a7a8a': 'grey', '#7a2a5a': 'purple', '#3a5a3a': 'green', '#7a3a2a': 'brown', '#2a3a5a': 'blue', '#c8c0a8': 'tan', '#4a4a4a': 'grey', '#e0e0d8': 'white', '#3a4a6a': 'blue', '#8a8a7a': 'grey', '#5a3a2a': 'brown', '#f0f0f0': 'white', '#c02020': 'red' };
    return m[c] || 'grey';
  },
  hasKey(c) { return c.keyIn || c.hotwired || !!Player.find(it => it.id === 'CarKey' && it.keyId === c.id); },
  canHotwire() { return Player.hasTrait('burglar') || (Player.skill('Electrical') >= 1 && Player.skill('Mechanics') >= 2); },
  // local coordinates of point relative to car
  local(c, x, y) { const dx = x - c.x, dy = y - c.y, ca = Math.cos(c.a), sa = Math.sin(c.a); return [dx * ca + dy * sa, -dx * sa + dy * ca]; },
  pushOut(e, r) {
    for (const c of (this.active || G.cars)) {
      if (G.player && G.player.inCar === c && e === G.player) continue;
      if (Math.abs(e.x - c.x) > 3 || Math.abs(e.y - c.y) > 3) continue;
      const T = CAR_TYPES[c.type];
      const [f, s] = this.local(c, e.x, e.y);
      const hl = T.len / 2 + r, hw = T.wid / 2 + r;
      if (Math.abs(f) < hl && Math.abs(s) < hw) {
        const pf = hl - Math.abs(f), ps = hw - Math.abs(s);
        let nf = f, ns = s;
        if (pf < ps) nf = Math.sign(f || 1) * hl; else ns = Math.sign(s || 1) * hw;
        const ca = Math.cos(c.a), sa = Math.sin(c.a);
        e.x = c.x + nf * ca - ns * sa; e.y = c.y + nf * sa + ns * ca;
        World.resolve(e, r);
      }
    }
  },
  enter(c) {
    const p = G.player;
    if (c.locked && !this.hasKey(c) && !c.winBroken) { Player.say("It's locked.", '#ccc'); Sfx.play('locked'); return; }
    if (this.hasKey(c)) c.locked = false;
    Actions.cancel();
    p.inCar = c; p.path = null;
    p.x = c.x; p.y = c.y;
    Sfx.play('cardoor', c.x, c.y);
    if (this.hasKey(c)) UI.hint('W/S: accelerate/brake · A/D: steer · Q: horn · F: headlights · E: exit');
    else UI.hint(this.canHotwire() ? 'No key. Right-click > Hotwire to start the engine.' : 'No key for this car. Find it, or learn to hotwire (Electrical 1 + Mechanics 2, or Burglar).');
    this.tryStart(c, true);
  },
  exit(c, force) {
    const p = G.player;
    if (Math.abs(c.v) > 2 && !force) { Player.say('Too fast to get out!', '#ccc'); return; }
    const T = CAR_TYPES[c.type];
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    for (const side of [-1, 1]) {
      const s = side * (T.wid / 2 + 0.45), f = 0.2;
      const x = c.x + f * ca - s * sa, y = c.y + f * sa + s * ca;
      if (World.inb(x | 0, y | 0) && !World.tileSolid(x | 0, y | 0) && World.lineClear(c.x, c.y, x, y, 'move')) { p.x = x; p.y = y; break; }
      p.x = x; p.y = y;
    }
    p.inCar = null;
    c.v = force ? c.v : 0;
    World.resolve(p, p.r);
    Sfx.play('cardoor', c.x, c.y);
  },
  tryStart(c, quiet) {
    if (c.engine) return;
    if (c.gas <= 0.001) { if (!quiet) Player.say('Out of gas.', '#ccc'); return; }
    if (this.hasKey(c)) { this.startEngine(c); return; }
    if (quiet) return;
    if (this.canHotwire()) Actions.queue(Actions.hotwire(c));
    else Player.say("I don't have the key and can't hotwire it.", '#ccc');
  },
  startEngine(c) {
    if (c.hp < 15 && R.chance(0.6)) { Player.say("It won't start...", '#ccc'); Sfx.play('crank', c.x, c.y); return; }
    c.engine = true;
    Sfx.play('engineStart', c.x, c.y);
    Noise.emit(c.x, c.y, 20, 'engine');
  },
  smashWindow(c) {
    c.winBroken = true; c.locked = false;
    Sfx.play('glass', c.x, c.y);
    Noise.emit(c.x, c.y, 18, 'glass');
    Fx.shards(c.x, c.y, 1.0, 10, 'rgba(180,220,240,0.9)');
    if (c.alarm && !c.alarmDone) { c.alarmDone = true; G.alarms.push({ x: c.x, y: c.y, t: 25, pulse: 0, car: true }); Player.say('Car alarm!', '#f99'); }
  },
  zombieHit(c, z) {
    c.hp = Math.max(0, c.hp - R.f(0.3, 1.0));
    Sfx.play('thumpMetal', c.x, c.y);
    if (c.winBroken && R.chance(0.35)) Player.zombieAttack(z);
  },
  // ------------------------------------------------------------------ driving
  driveInput(c, dt) {
    const p = G.player;
    const T = CAR_TYPES[c.type];
    if (Input.hit('e')) { this.exit(c); return; }
    if (Input.hit('f')) { c.lightsOn = !c.lightsOn; Sfx.play('switch'); }
    if (Input.hit('q')) { Noise.emit(c.x, c.y, 40, 'horn'); Sfx.play('horn', c.x, c.y); }
    const W = Input.down('w'), S = Input.down('s'), A = Input.down('a'), D = Input.down('d');
    if ((W || S) && !c.engine) { if (!c.triedStart) { c.triedStart = true; this.tryStart(c); } }
    else c.triedStart = false;
    const acc = T.acc * (0.6 + c.hp / 250);
    if (c.engine && c.gas > 0) {
      if (W) c.v += acc * dt * (c.v < 0 ? 2.5 : 1);
      if (S) c.v -= (c.v > 0.3 ? acc * 2.2 : acc * 0.7) * dt;
    } else if (S) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 8 * dt);
    if (!W && !S) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 1.4 * dt);
    if (Input.down(' ')) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 12 * dt);
    const maxV = T.maxV * (0.55 + c.hp / 220);
    c.v = U.clamp(c.v, -4, maxV);
    const st = (D ? 1 : 0) - (A ? 1 : 0);
    c.steer += (st * 0.55 - c.steer) * Math.min(1, dt * 6);
    // iso feel: turning
    const yaw = c.v / (T.len * 0.75) * Math.tan(c.steer);
    p.x = c.x; p.y = c.y; p.angle = c.a;
    this.physics(c, dt, yaw);
    // fuel
    if (c.engine) {
      c.gas -= (Math.abs(c.v) * 0.00011 + 0.000012) * dt;
      if (c.gas <= 0) { c.gas = 0; c.engine = false; Player.say('Out of gas!', '#f99'); }
      c.noiseT = (c.noiseT || 0) - dt;
      if (c.noiseT <= 0) { c.noiseT = 1; Noise.emit(c.x, c.y, 12 + Math.abs(c.v) * 0.8, 'engine'); }
      Sfx.engine(c);
    } else Sfx.engine(null);
    if (c.lightsOn && c.engine) c.lightsOn = true;
  },
  physics(c, dt, yaw) {
    const T = CAR_TYPES[c.type];
    const steps = Math.max(1, Math.ceil(Math.abs(c.v) * dt / 0.15));
    for (let k = 0; k < steps; k++) {
      const h = dt / steps;
      const ox = c.x, oy = c.y, oa = c.a;
      c.a = U.normAng(c.a + yaw * h);
      c.x += Math.cos(c.a) * c.v * h; c.y += Math.sin(c.a) * c.v * h;
      if (this.collides(c, ox, oy, oa)) {
        c.x = ox; c.y = oy; c.a = oa;
        const imp = Math.abs(c.v);
        if (imp > 2.5) {
          c.hp = Math.max(0, c.hp - imp * 1.6);
          Sfx.play('crash', c.x, c.y);
          Noise.emit(c.x, c.y, 15 + imp, 'crash');
          if (imp > 9 && G.player.inCar === c) { Player.addWound(R.pick(['Head', 'TorsoUpper', 'ForeArmL', 'ForeArmR']), imp > 13 ? 'cut' : 'scratch', { isZombie: false }); }
          if (c.hp <= 0) { c.engine = false; Player.say('The engine died.', '#f99'); }
        }
        c.v = -c.v * 0.2;
        break;
      }
      // zombies
      if (Math.abs(c.v) > 0.3) {
        for (const z of Zombie.near(c.x, c.y, T.len / 2 + 0.6)) {
          if (z.dead) continue;
          const [f, s] = this.local(c, z.x, z.y);
          if (Math.abs(f) < T.len / 2 + z.r && Math.abs(s) < T.wid / 2 + z.r) {
            const sp = Math.abs(c.v);
            if (sp > 2.5) {
              Zombie.hit(z, sp * 0.22, c.a + (c.v < 0 ? Math.PI : 0), { knock: true });
              c.hp = Math.max(0, c.hp - 0.4); c.v *= 0.88;
              Sfx.play('carHit', z.x, z.y);
            }
            this.pushOut(z, z.r);
          }
        }
      }
    }
  },
  corners(c) {
    const T = CAR_TYPES[c.type];
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    const pts = [];
    for (const f of [-T.len / 2, 0, T.len / 2]) for (const s of [-T.wid / 2, T.wid / 2]) pts.push([c.x + f * ca - s * sa, c.y + f * sa + s * ca]);
    pts.push([c.x + T.len / 2 * ca, c.y + T.len / 2 * sa]);
    pts.push([c.x - T.len / 2 * ca, c.y - T.len / 2 * sa]);
    return pts;
  },
  collides(c, ox, oy, oa) {
    const now = this.corners(c);
    const save = [c.x, c.y, c.a];
    c.x = ox; c.y = oy; c.a = oa;
    const before = this.corners(c);
    c.x = save[0]; c.y = save[1]; c.a = save[2];
    for (let i = 0; i < now.length; i++) {
      const [x, y] = now[i];
      if (!World.inb(x | 0, y | 0)) return true;
      if (World.tileSolid(x | 0, y | 0)) {
        const o = World.obj(x | 0, y | 0);
        if (o && (o.t === 'bush' || o.t === 'crop')) continue;
        return true;
      }
      if (!World.lineClear(before[i][0], before[i][1], x, y, 'move')) return true;
    }
    // edges crossing the car body (walls between corners)
    if (!World.lineClear(now[0][0], now[0][1], now[5][0], now[5][1], 'move') || !World.lineClear(now[1][0], now[1][1], now[4][0], now[4][1], 'move')) return true;
    for (const o of G.cars) {
      if (o === c) continue;
      if (U.dist(o.x, o.y, c.x, c.y) > 3.5) continue;
      for (const [x, y] of now) { const [f, s] = this.local(o, x, y); const T2 = CAR_TYPES[o.type]; if (Math.abs(f) < T2.len / 2 && Math.abs(s) < T2.wid / 2) { o.v += c.v * 0.3; return true; } }
    }
    return false;
  },
  update(dt) {
    const p = G.player;
    // cars near the player are the only ones that can matter for collisions this step
    this.activeT = (this.activeT || 0) - dt;
    if (this.activeT <= 0 || !this.active) {
      this.activeT = 1;
      const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
      this.active = G.cars.filter(c => Math.abs(c.x - px) < 75 && Math.abs(c.y - py) < 75);
    }
    for (const c of G.cars) {
      if (p && p.inCar === c) continue;
      if (Math.abs(c.v) > 0.01) { this.physics(c, dt, 0); c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 3 * dt); }
      if (c.engine && c.gas > 0) { c.gas -= 0.00001 * dt; c.noiseT = (c.noiseT || 0) - dt; if (c.noiseT <= 0) { c.noiseT = 1.5; Noise.emit(c.x, c.y, 10, 'engine'); } }
    }
    if (!p || !p.inCar) Sfx.engine(null);
  },
  // ------------------------------------------------------------------ drawing
  draw(ctx, c) {
    const T = CAR_TYPES[c.type];
    const s = Math.max(0.12, Render.shadeSmooth(c.x, c.y));
    if (!World.isVis(c.x | 0, c.y | 0) && !World.isVis((c.x + Math.cos(c.a)) | 0, (c.y + Math.sin(c.a)) | 0) && G.player && !G.player.inCar && Render.shadeAt(c.x, c.y) < 0.05) return;
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    const P = (f, sd, z) => { const wx = c.x + f * ca - sd * sa, wy = c.y + f * sa + sd * ca; return [(wx - wy) * HTW, (wx + wy) * HTH - z * ZU]; };
    const L = T.len, W = T.wid;
    poly(ctx, [P(-L / 2 - 0.08, -W / 2 - 0.1, 0), P(L / 2 + 0.08, -W / 2 - 0.1, 0), P(L / 2 + 0.12, W / 2 + 0.12, 0), P(-L / 2 - 0.06, W / 2 + 0.12, 0)], 'rgba(0,0,0,' + (0.35 * s).toFixed(2) + ')');
    // wheels
    for (const f of [-L * 0.32, L * 0.32]) for (const sd of [-W / 2, W / 2]) {
      const a = P(f - 0.22, sd, 0.02), b = P(f + 0.22, sd, 0.02), q = P(f + 0.22, sd, 0.38), d = P(f - 0.22, sd, 0.38);
      poly(ctx, [a, b, q, d], Col.shade('#151515', s));
    }
    const col = c.hp < 30 ? Col.mix(c.col, '#3a3028', 0.35) : c.col;
    const box = (f0, f1, s0, s1, z0, z1, side, top, isCab) => {
      const faces = [
        { n: [ca, sa], pts: [P(f1, s0, z0), P(f1, s1, z0), P(f1, s1, z1), P(f1, s0, z1)], k: 'front' },
        { n: [-ca, -sa], pts: [P(f0, s1, z0), P(f0, s0, z0), P(f0, s0, z1), P(f0, s1, z1)], k: 'back' },
        { n: [-sa, ca], pts: [P(f0, s1, z0), P(f1, s1, z0), P(f1, s1, z1), P(f0, s1, z1)], k: 'side' },
        { n: [sa, -ca], pts: [P(f1, s0, z0), P(f0, s0, z0), P(f0, s0, z1), P(f1, s0, z1)], k: 'side' },
      ];
      for (const fc of faces) {
        if (fc.n[0] + fc.n[1] <= 0) continue;
        const lt = FACE_E + (FACE_S - FACE_E) * U.clamp((fc.n[1] - fc.n[0] + 1) / 2, 0, 1);
        poly(ctx, fc.pts, Col.shade(side, s * lt), Col.shade('#000000', 0), 0);
        if (isCab) {
          // window glass inset
          const g = fc.pts;
          const ins = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t)];
          const p0 = ins(g[0], g[2], 0.12), p1 = ins(g[1], g[3], 0.12), p2 = ins(g[2], g[0], 0.15), p3 = ins(g[3], g[1], 0.15);
          poly(ctx, [p0, p1, p2, p3], Col.shade(c.winBroken && fc.k === 'side' ? '#101418' : '#2a3a48', s * (0.8 + lt * 0.3)));
          if (!c.winBroken) line(ctx, ins(p0, p3, 0.3), ins(p1, p2, 0.6), 'rgba(255,255,255,' + (0.15 * s).toFixed(2) + ')', 1);
        }
        if (fc.k === 'front' && !isCab) {
          const hl = c.lightsOn && c.engine ? '#fffbe0' : '#d8d0a0';
          poly(ctx, [P(f1 + 0.001, s0 + 0.08, z1 - 0.2), P(f1 + 0.001, s0 + 0.28, z1 - 0.2), P(f1 + 0.001, s0 + 0.28, z1 - 0.08), P(f1 + 0.001, s0 + 0.08, z1 - 0.08)], Col.shade(hl, Math.max(s, c.lightsOn ? 1 : 0)));
          poly(ctx, [P(f1 + 0.001, s1 - 0.28, z1 - 0.2), P(f1 + 0.001, s1 - 0.08, z1 - 0.2), P(f1 + 0.001, s1 - 0.08, z1 - 0.08), P(f1 + 0.001, s1 - 0.28, z1 - 0.08)], Col.shade(hl, Math.max(s, c.lightsOn ? 1 : 0)));
        }
        if (fc.k === 'back' && !isCab) {
          poly(ctx, [P(f0 - 0.001, s1 - 0.08, z1 - 0.2), P(f0 - 0.001, s1 - 0.26, z1 - 0.2), P(f0 - 0.001, s1 - 0.26, z1 - 0.1), P(f0 - 0.001, s1 - 0.08, z1 - 0.1)], Col.shade('#a01010', s));
          poly(ctx, [P(f0 - 0.001, s0 + 0.26, z1 - 0.2), P(f0 - 0.001, s0 + 0.08, z1 - 0.2), P(f0 - 0.001, s0 + 0.08, z1 - 0.1), P(f0 - 0.001, s0 + 0.26, z1 - 0.1)], Col.shade('#a01010', s));
        }
      }
      poly(ctx, [P(f0, s0, z1), P(f1, s0, z1), P(f1, s1, z1), P(f0, s1, z1)], Col.shade(top, s));
    };
    box(-L / 2, L / 2, -W / 2, W / 2, 0.2, T.h, col, Col.mix(col, '#ffffff', 0.08));
    if (T.bed) {
      poly(ctx, [P(-L / 2 + 0.08, -W / 2 + 0.08, T.h), P(L * T.cab[0] - 0.02, -W / 2 + 0.08, T.h), P(L * T.cab[0] - 0.02, W / 2 - 0.08, T.h), P(-L / 2 + 0.08, W / 2 - 0.08, T.h)], Col.shade('#2a2a2a', s));
    }
    box(L * T.cab[0], L * T.cab[1], -W / 2 + 0.07, W / 2 - 0.07, T.h, T.h + T.cabH, col, col, true);
    if (T.lightbar) {
      const t = performance.now() / 200;
      const lb = (Math.floor(t) & 1) ? '#ff2020' : '#2040ff';
      box(-0.12, 0.12, -W / 2 + 0.15, W / 2 - 0.15, T.h + T.cabH, T.h + T.cabH + 0.1, c.engine ? lb : '#606060', c.engine ? lb : '#707070');
    }
    if (c.type === 'firetruck') box(-L / 2 + 0.1, L * T.cab[0] - 0.1, -W / 2 + 0.15, W / 2 - 0.15, T.h, T.h + 0.15, '#c0c0c0', '#d0d0d0');
    // driver head
    if (G.player && G.player.inCar === c) {
      const hp = P(L * (T.cab[0] + T.cab[1]) / 2 + 0.05, -W * 0.2, T.h + T.cabH * 0.55);
      ctx.fillStyle = Col.shade(G.player.look.skin, s); ctx.beginPath(); ctx.arc(hp[0], hp[1], 4, 0, 7); ctx.fill();
    }
  },
};
