'use strict';
// ---------------------------------------------------------------------------
// Fire: burning tiles consume their fuel (floor + furniture) and spread to
// flammable neighbours. Wooden walls burn away, buildings lose their roofs,
// upper floors collapse. Rain, water and extinguishers put fires out.
// ---------------------------------------------------------------------------
const FIRE_FLOOR = [];   // floor type -> [fuel seconds, chance to catch]
FIRE_FLOOR[FL.GRASS] = [7, 0.2]; FIRE_FLOOR[FL.GRASS2] = [8, 0.24]; FIRE_FLOOR[FL.FOREST] = [12, 0.26];
FIRE_FLOOR[FL.WOOD] = [34, 0.75]; FIRE_FLOOR[FL.CARPET] = [28, 0.85]; FIRE_FLOOR[FL.LINO] = [16, 0.4];
FIRE_FLOOR[FL.TILE] = [6, 0.1]; FIRE_FLOOR[FL.FURROW] = [3, 0.05];
const FIRE_OBJ = {
  bed: 45, sofa: 45, armchair: 30, wardrobe: 50, dresser: 35, nightstand: 15, bookshelf: 45, desk: 30, table: 25, chair: 12,
  crate: 30, woodcrate: 35, counter: 20, counterbar: 30, pew: 30, bench: 20, hay: 40, logwall: 60, tree: 70, bush: 12, trash: 15,
  register: 10, shelf: 25, toolcab: 15, locker: 5, crop: 6, stairs: 40, landing: 40, railing: 10, stairtop: 5, sign: 10, mailbox: 4,
};
const BURN_WALL = { 1: true, 2: true, 4: true, 5: true, 7: true, 8: true };
// objects defined elsewhere can declare their own fuel: OBJ[t].fuel
for (const t in OBJ) if (OBJ[t].fuel && FIRE_OBJ[t] === undefined) FIRE_OBJ[t] = OBJ[t].fuel;

const Fire = {
  acc: 0, MAX: 900,
  map() { if (!Wd.fire) Wd.fire = new Map(); return Wd.fire; },
  at(x, y) { return Wd.fire ? Wd.fire.get(y * Wd.w + x) : undefined; },
  fuelAt(i) {
    const ff = FIRE_FLOOR[Wd.floor[i]];
    let fuel = ff ? ff[0] : 0, ch = ff ? ff[1] : 0;
    const o = Wd.obj[i];
    if (o && FIRE_OBJ[o.t] && !(o.t === 'tree' && o.stump)) { fuel += FIRE_OBJ[o.t]; ch = Math.max(ch, o.t === 'tree' ? 0.36 : 0.55); }
    return [fuel, ch];
  },
  // set tile alight. extra: fuel that burns even on bare ground (spilled gasoline)
  ignite(x, y, power, extra) {
    if (!World.inb(x, y)) return false;
    const i = y * Wd.w + x, m = this.map();
    const e = m.get(i);
    if (e) { e.i = Math.min(1, e.i + (power || 0.3)); if (extra) { e.fuel += extra; e.max += extra; } return true; }
    if (m.size >= this.MAX || Wd.floor[i] === FL.VOID || World.isWater(x, y)) return false;
    const fuel = this.fuelAt(i)[0] + (extra || 0);
    if (fuel <= 0) return false;
    m.set(i, { fuel, max: fuel, i: Math.min(1, power || 0.3) });
    return true;
  },
  // knock the flames down by amt (0..1+); returns true if something was burning
  douse(x, y, amt) {
    const m = Wd.fire; if (!m) return false;
    const i = y * Wd.w + x, e = m.get(i);
    if (!e) return false;
    e.i -= amt;
    if (e.i <= 0.05) { m.delete(i); Fx.smoke(x + 0.5, y + 0.5, 0.4); }
    return true;
  },
  near(x, y, r) {
    const m = Wd.fire; if (!m || !m.size) return 0;
    let n = 0;
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) { const e = World.inb(xx, yy) && m.get(yy * Wd.w + xx); if (e) n += e.i; }
    return n;
  },
  update(dt) {
    this.entities(dt);
    const m = Wd.fire;
    if (!m || !m.size) return;
    this.acc += dt;
    if (this.acc < 0.25) return;
    const step = this.acc; this.acc = 0;
    const rain = G.weather.rain, W = Wd.w, W0 = LV.W0;
    const spread = !G.sb || G.sb.fire === undefined || G.sb.fire ? 1 : 0;
    const add = [];
    for (const [i, e] of m) {
      const x = i % W, y = (i / W) | 0;
      const outdoor = Wd.room[i] < 0;
      if (outdoor && rain > 0.25) e.i -= rain * 0.3 * step;
      e.i = Math.min(1, e.i + step * (e.fuel > e.max * 0.25 ? 0.14 : -0.25));
      e.fuel -= step * (0.35 + e.i * 0.65);
      if (e.fuel <= 0 || e.i <= 0) { m.delete(i); this.burnOut(i, x, y, e.fuel < e.max * 0.3); continue; }
      for (let k = 0; k < 4; k++) {
        const nx = x + DIR4[k][0], ny = y + DIR4[k][1];
        if (!World.inb(nx, ny)) continue;
        const ni = ny * W + nx;
        if (m.has(ni)) continue;
        const ch = this.fuelAt(ni)[1];
        if (ch <= 0) continue;
        let p = 0.11 * e.i * ch * step * spread;
        const ed = World.edgeBetween(x, y, nx, ny);
        const wt = World.wall(ed[0], ed[1], ed[2]);
        if (wt === WT.BOUND) continue;
        if (wt) {
          const f = World.feat(ed[0], ed[1], ed[2]);
          const open = f && (f.k === 'doorway' || f.k === 'gap' || (f.k === 'door' && (f.open || f.broken)) || (f.k === 'window' && (f.open || f.smashed)));
          if (!open) p *= BURN_WALL[wt] ? 0.22 : 0.04;
        }
        if (Wd.room[ni] < 0 && rain > 0.25) p *= 0.15;
        if (R.next() < p) add.push(ni);
      }
      // flames climb to the floor above, and burning floors drop embers below
      if (!spread) { /* fires stay where they started */ } else if (x < W0) {
        const up = i + W0;
        if (x + W0 < W && Wd.floor[up] !== FL.VOID && !m.has(up) && R.next() < 0.05 * e.i * this.fuelAt(up)[1] * step) add.push(up);
      } else if (!m.has(i - W0) && R.next() < 0.012 * e.i * this.fuelAt(i - W0)[1] * step) add.push(i - W0);
      if (R.next() < step * 0.25 * e.i) Fx.smoke(x + 0.5 + R.f(-0.3, 0.3), y + 0.5 + R.f(-0.3, 0.3), 0.6 + e.i, true);
    }
    for (const ni of add) this.ignite(ni % W, (ni / W) | 0, 0.25);
  },
  // tile has burnt through its fuel
  burnOut(i, x, y, consumed) {
    if (!consumed) return;
    const w = Wd, W0 = LV.W0;
    const f = w.floor[i];
    if (FIRE_FLOOR[f] || f === FL.DIRT) { w.floor[i] = FL.BURNT; w.fvar[i] = R.int(0, 7); w.deco[i] = 0; }
    const o = w.obj[i];
    if (o && FIRE_OBJ[o.t]) {
      if (o.t === 'tree') { o.stump = true; o.burnt = true; }
      else if (o.sx !== undefined) World.removeStairs(x, y);
      else if (o.t === 'crop' || o.t === 'bush' || o.t === 'mailbox' || o.t === 'sign' || (OBJ[o.t] && OBJ[o.t].burnGone)) w.obj[i] = null;
      else w.obj[i] = { t: 'ash', dir: 'S', v: R.int(0, 3), big: ['bed', 'sofa', 'wardrobe', 'bookshelf', 'counter', 'counterbar', 'shelf', 'pew', 'hay', 'logwall'].includes(o.t) || !!(OBJ[o.t] && OBJ[o.t].burnBig) };
    }
    const items = w.items.get(i);
    if (items) { const keep = items.filter(() => R.chance(0.25)); if (keep.length) w.items.set(i, keep); else w.items.delete(i); }
    // walls on this tile's edges burn down or char
    if (!w.charred) w.charred = new Set();
    for (const [ex, ey, ed] of [[x, y, 0], [x, y, 1], [x, y + 1, 0], [x + 1, y, 1]]) {
      const t = World.wall(ex, ey, ed);
      if (!t || !BURN_WALL[t]) continue;
      const k = World.ek(ex, ey, ed);
      if (w.charred.has(k) || R.chance(0.45)) { World.setWall(ex, ey, ed, 0); World.setFeat(ex, ey, ed, null); w.edgeHp.delete(k); w.charred.delete(k); Fx.shards(ex + (ed ? 0 : 0.5), ey + (ed ? 0.5 : 0), 1.2, 6, '#2a2420'); }
      else w.charred.add(k);
    }
    if (R.chance(0.4)) Fx.scorch(x + 0.5 + R.f(-0.3, 0.3), y + 0.5 + R.f(-0.3, 0.3));
    // roofs fall in once enough of the building has burnt
    const r = w.room[i];
    if (r >= 0) {
      const b = w.buildings[w.rooms[r].b];
      b.burnt = (b.burnt || 0) + 1;
      const area = (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
      if (!b.roofGone && b.burnt > area * 0.4) this.collapse(b);
    }
  },
  collapse(b) {
    const w = Wd, W0 = LV.W0, W = w.w;
    b.roofGone = true;
    for (const rid of b.rooms) w.rooms[rid].lights = false;
    if (b.floors !== 2) return;
    // the upper storey caves in onto the ground floor
    if (b.stair) World.removeStairs(b.stair.x, b.stair.y);
    for (let y = b.y0; y <= b.y1 + 1; y++) for (let x = b.x0 + W0; x <= b.x1 + 1 + W0; x++) {
      for (const d of [0, 1]) if (World.wall(x, y, d) && World.wall(x, y, d) !== WT.BOUND) { World.setWall(x, y, d, 0); World.setFeat(x, y, d, null); }
      if (y > b.y1 || x > b.x1 + W0) continue;
      const i = y * W + x;
      const items = w.items.get(i);
      if (items) { for (const it of items) World.dropItem(x - W0 + 0.5, y + 0.5, it); w.items.delete(i); }
      w.obj[i] = null; w.floor[i] = FL.VOID; w.room[i] = -1;
      if (w.fire) { if (w.fire.has(i)) this.ignite(x - W0, y, 0.6); w.fire.delete(i); }
      if (R.chance(0.35) && !w.obj[i - W0] && !World.tileSolid(x - W0, y)) w.obj[i - W0] = { t: 'ash', dir: 'S', v: R.int(0, 3), big: R.chance(0.4) };
      if (R.chance(0.3)) Fx.scorch(x - W0 + 0.5, y + 0.5);
    }
    for (const rid of b.rooms.slice()) if (w.rooms[rid].x0 >= W0) b.rooms.splice(b.rooms.indexOf(rid), 1);
    b.floors = 1;
    const fall = (e) => e.x >= W0 && e.x < b.x1 + 1 + W0 && e.x >= b.x0 + W0 && e.y >= b.y0 && e.y < b.y1 + 1;
    for (const z of G.zombies) if (fall(z)) { z.x -= W0; if (!z.dead) { z.st = 'down'; z.downT = R.f(1, 2); Zombie.hit(z, R.f(0.5, 1.5)); } }
    const p = G.player;
    if (p && !p.dead && fall(p)) {
      p.x -= W0; p.path = null;
      Player.say('The floor gave way!', '#f99');
      if (R.chance(0.5)) Player.fracture(LEG_PARTS); else Player.addWound(R.pick(['LowerLegL', 'LowerLegR', 'FootL', 'FootR']), 'deep', { isZombie: false });
    }
    Zombie.rebuildGrid();
    Sfx.play('woodbreak', (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    Noise.emit((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 30, 'crash');
  },
  // burning creatures: zombies catch fire and spread it; the player gets burnt
  entities(dt) {
    const m = Wd.fire, W = Wd.w;
    const has = m && m.size;
    let gone = false;
    for (const z of G.zombies) {
      if (z.dead) {
        z.fire = 0;
        // corpses in the flames char and burn away (the classic way to deal with corpse piles)
        if (has && m.has(Math.floor(z.y) * W + Math.floor(z.x))) {
          z.charT = (z.charT || 0) + dt;
          if (z.charT > 5 && !z.charred) { z.charred = true; z.keepLook = true; z.look = Object.assign({}, z.look, { skin: '#2a2420', shirt: '#2a2420', pants: '#221c18', jacket: z.look.jacket ? '#2a2420' : null, hair: '#1a1410' }); }
          if (z.charT > 14) { z.gone = true; gone = true; Fx.scorch(z.x, z.y, 1.2); }
        }
        continue;
      }
      if (has && m.has(Math.floor(z.y) * W + Math.floor(z.x)) && !z.fire) z.fire = R.f(14, 22);
      if (!z.fire) continue;
      z.fire = Math.max(0, z.fire - dt);
      z.burnT = (z.burnT || 0) + dt;
      if (z.burnT > 0.8) {
        z.burnT = 0;
        if (G.weather.rain > 0.5 && World.outdoor(z.x, z.y) && R.chance(0.3)) { z.fire = 0; continue; }
        Zombie.hit(z, R.f(0.12, 0.22), undefined, { stag: 0.05, push: 0.05 });
        if (R.chance(0.35)) this.ignite(Math.floor(z.x), Math.floor(z.y), 0.3);
      }
    }
    if (gone) { G.zombies = G.zombies.filter(z => !z.gone); Zombie.rebuildGrid(); }
    const p = G.player;
    if (!p || p.dead) return;
    const e = has ? m.get(Math.floor(p.y) * W + Math.floor(p.x)) : null;
    if (e && !p.inCar) {
      p.burnT = (p.burnT || 0) + dt * (0.5 + e.i);
      if (p.burnT > 1) {
        p.burnT = 0;
        Player.addWound(R.pick(['FootL', 'FootR', 'LowerLegL', 'LowerLegR', 'UpperLegL', 'UpperLegR', 'HandL', 'HandR']), 'burn');
        p.st.panic = Math.min(100, p.st.panic + 15);
      }
    }
  },
  // ---------------------------------------------------------------- drawing
  drawFlames(ctx, X, Y, e, t, seed) {
    const n = e.i > 0.6 ? 3 : e.i > 0.3 ? 2 : 1;
    const s = 0.7 + e.i * 0.9;
    for (let k = 0; k < n; k++) {
      const a = seed * 1.7 + k * 2.1;
      const ox = Math.sin(a) * 12, oy = Math.cos(a * 1.3) * 5;
      Fx.drawFlame(ctx, X + ox, Y + HTH + oy, t + seed + k * 0.7, s * (k ? 0.75 : 1));
    }
  },
};
