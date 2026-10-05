'use strict';
// ---------------------------------------------------------------------------
// Procedural sprite generation & caching (floors, walls, furniture, trees)
// ---------------------------------------------------------------------------
const isoP = (ax, ay, u, v, z) => [ax + (u - v) * HTW, ay + (u + v) * HTH - (z || 0) * ZU];
const FACE_S = 0.84, FACE_E = 0.68;

const FLOOR_COL = {};
FLOOR_COL[FL.GRASS] = ['#56743a', '#5a783c', '#52703a', '#5c7a3e'];
FLOOR_COL[FL.GRASS2] = ['#687f3e', '#6c8442', '#647c3c', '#6f8644'];
FLOOR_COL[FL.FOREST] = ['#465a30', '#4a5e32', '#43572f', '#4c6034'];
FLOOR_COL[FL.DIRT] = ['#7a644a', '#76604a', '#7e6850', '#735e46'];
FLOOR_COL[FL.ASPHALT] = ['#47484b', '#494a4d', '#454649', '#4b4c4f'];
FLOOR_COL[FL.PARKING] = FLOOR_COL[FL.ASPHALT];
FLOOR_COL[FL.SIDEWALK] = ['#a19e98', '#9d9a94', '#a5a29c', '#9a978f'];
FLOOR_COL[FL.CONCRETE] = ['#8e8c86', '#8a8882', '#928f89', '#86847e'];
FLOOR_COL[FL.SAND] = ['#cbb88e', '#c8b48a', '#cfbc92', '#c4b088'];
FLOOR_COL[FL.WATER] = ['#3a6a8a', '#3c6c8c', '#386888', '#3e6e8e'];
FLOOR_COL[FL.DEEPWATER] = ['#2a4c6c', '#2c4e6e', '#284a6a', '#2e5070'];
FLOOR_COL[FL.GRAVEL] = ['#8a8478', '#86807a', '#8e887c', '#827c72'];
FLOOR_COL[FL.BURNT] = ['#2c2725', '#302a27', '#28231f', '#332c28'];
FLOOR_COL[FL.FURROW] = ['#5a4632', '#5c4834', '#584430', '#5e4a36'];
const PAL_WOOD = ['#8a6040', '#a07850', '#6a4a30', '#b08a60', '#7a5a3a', '#9a7048', '#5e4632', '#c09a70'];
const PAL_CARPET = ['#7a3a3a', '#3a4a6a', '#5a6a4a', '#8a7a5a', '#6a5a7a', '#a08a6a', '#4a6a6a', '#8a5a40'];
const PAL_TILE = ['#d8d8d0', '#c8d8e0', '#e0d0c0', '#d0e0d0', '#e8e8e8', '#c0c8c0', '#d8c8d0', '#b8c8d8'];
const PAL_LINO = ['#c8c0a8', '#b8c0b8', '#d0c8b0', '#a8b0b8', '#c0b8a0', '#d8d0c0', '#b0a898', '#c8c8c0'];

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function poly(g, pts, fill, stroke, lw) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
}
function line(g, a, b, col, w) { g.strokeStyle = col; g.lineWidth = w || 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }

// floor decal painters registered by other modules: DECO_ART[code] = (g, P, ax, ay) => {...}
// codes: 1-9 road markings (sprites.js), 10-49 street details (street.js), 50-89 yards (yard.js)
const DECO_ART = {};
const Spr = {
  cache: new Map(),
  get(key, w, h, ax, ay, draw) {
    let rec = this.cache.get(key);
    if (rec) return rec;
    const c = mkCanvas(w, h);
    const g = c.getContext('2d');
    draw(g, ax, ay);
    rec = { c, ax, ay, sil: null };
    this.cache.set(key, rec);
    return rec;
  },
  draw(ctx, rec, sx, sy, s) { this.drawShaded(ctx, rec, sx - rec.ax, sy - rec.ay, s, 1); },
  // draw sprite darkened to brightness s using a cached silhouette overlay (memory-light)
  drawShaded(ctx, rec, x, y, s, alpha) {
    const a = alpha === undefined ? 1 : alpha;
    if (a < 1) ctx.globalAlpha = a;
    ctx.drawImage(rec.c, x, y);
    const dk = 1 - s;
    if (dk > 0.02) {
      if (!rec.sil) {
        const c = mkCanvas(rec.c.width, rec.c.height);
        const g = c.getContext('2d');
        g.drawImage(rec.c, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgb(3,5,14)';
        g.fillRect(0, 0, c.width, c.height);
        rec.sil = c;
      }
      ctx.globalAlpha = a * Math.min(1, dk);
      ctx.drawImage(rec.sil, x, y);
    }
    ctx.globalAlpha = 1;
  },

  // ------------------------------------------------------------ floors
  floor(f, v, vx, gs) {
    const key = 'f' + f + '_' + v + '_' + vx + (gs || '');
    return this.get(key, 66, 34, 33, 1, (g, ax, ay) => {
      const rng = new RNG(f * 977 + v * 131 + vx * 17 + 5);
      g.save();
      g.beginPath(); g.moveTo(ax, ay - 0.7); g.lineTo(ax + 32.9, ay + 16); g.lineTo(ax, ay + 32.7); g.lineTo(ax - 32.9, ay + 16); g.closePath();
      g.clip();
      let base;
      if (f === FL.WOOD) base = PAL_WOOD[v & 7];
      else if (f === FL.CARPET) base = PAL_CARPET[v & 7];
      else if (f === FL.TILE) base = PAL_TILE[v & 7];
      else if (f === FL.LINO) base = PAL_LINO[v & 7];
      else base = (FLOOR_COL[f] || FLOOR_COL[FL.GRASS])[vx & 3];
      if (gs) base = Season.grassCol(base, gs);
      g.fillStyle = base; g.fillRect(0, 0, 66, 34);
      const P = (u, w) => isoP(ax, ay, u, w, 0);
      const speck = (n, cols, sz) => { for (let i = 0; i < n; i++) { const p = P(rng.next(), rng.next()); g.fillStyle = rng.pick(cols); g.fillRect(p[0], p[1], sz || 1, sz || 1); } };
      switch (f) {
        case FL.GRASS: case FL.GRASS2: case FL.FOREST: {
          const dk = Col.mix(base, '#203010', 0.35), lt = Col.mix(base, '#c0d080', 0.25);
          for (let i = 0; i < 46; i++) {
            const p = P(rng.next(), rng.next());
            g.strokeStyle = rng.chance(0.5) ? dk : lt; g.lineWidth = 1;
            g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + rng.f(-1.5, 1.5), p[1] - rng.f(2, 4)); g.stroke();
          }
          if (f === FL.FOREST) speck(26, gs === 'a' ? ['#a0602a', '#c08030', '#8a4a20', '#d0a040'] : ['#5a4a2a', '#6a5030', '#3a4a22', '#7a6a3a'], 2);
          if (f === FL.GRASS2 && rng.chance(0.4) && (!gs || gs === 'g' || gs === 'p')) speck(3, ['#e8e080', '#f0f0f0', '#d090c0'], 2);
          if (gs === 'a' && rng.chance(0.5)) speck(5, ['#c06a2a', '#d0a040', '#a04a20'], 2);
          break;
        }
        case FL.DIRT: case FL.SAND: case FL.GRAVEL:
          speck(60, [Col.mix(base, '#000', 0.2), Col.mix(base, '#fff', 0.15)], f === FL.GRAVEL ? 2 : 1);
          break;
        case FL.ASPHALT: case FL.PARKING:
          speck(90, ['#3c3d40', '#56575a', '#404144', '#5c5d60'], 1);
          if (rng.chance(0.15)) { const a = P(rng.next(), rng.next()); g.strokeStyle = '#38393c'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); for (let k = 0; k < 4; k++) g.lineTo(a[0] + rng.f(-9, 9), a[1] + rng.f(-5, 5)); g.stroke(); }
          break;
        case FL.SIDEWALK: case FL.CONCRETE:
          speck(50, [Col.mix(base, '#000', 0.12), Col.mix(base, '#fff', 0.1)], 1);
          line(g, P(0, 0), P(1, 0), Col.mix(base, '#000', 0.25), 1);
          line(g, P(0, 0), P(0, 1), Col.mix(base, '#000', 0.25), 1);
          if (f === FL.SIDEWALK) line(g, P(0.5, 0), P(0.5, 1), Col.mix(base, '#000', 0.12), 1);
          break;
        case FL.WOOD: {
          for (let k = 0; k < 4; k++) {
            const c = Col.jitter(base, 10, rng);
            poly(g, [P(0, k / 4), P(1, k / 4), P(1, (k + 1) / 4), P(0, (k + 1) / 4)], c);
            line(g, P(0, k / 4), P(1, k / 4), Col.mix(base, '#000', 0.35), 1);
            const s = rng.f(0.1, 0.9);
            line(g, P(s, k / 4), P(s, (k + 1) / 4), Col.mix(base, '#000', 0.25), 1);
          }
          break;
        }
        case FL.CARPET:
          speck(120, [Col.mix(base, '#000', 0.15), Col.mix(base, '#fff', 0.1)], 1);
          break;
        case FL.TILE: {
          const alt = Col.mix(base, '#000', 0.08);
          for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) poly(g, [P(a / 2, b / 2), P((a + 1) / 2, b / 2), P((a + 1) / 2, (b + 1) / 2), P(a / 2, (b + 1) / 2)], (a + b) & 1 ? alt : base);
          const gr = Col.mix(base, '#000', 0.3);
          line(g, P(0, 0), P(1, 0), gr, 1); line(g, P(0, 0), P(0, 1), gr, 1); line(g, P(0.5, 0), P(0.5, 1), gr, 1); line(g, P(0, 0.5), P(1, 0.5), gr, 1);
          break;
        }
        case FL.LINO: {
          const alt = Col.mix(base, '#000', 0.06);
          poly(g, [P(0, 0), P(1, 0), P(1, 1), P(0, 1)], (vx & 1) ? alt : base);
          speck(30, [Col.mix(base, '#000', 0.08)], 1);
          line(g, P(0, 0), P(1, 0), Col.mix(base, '#000', 0.15), 1);
          line(g, P(0, 0), P(0, 1), Col.mix(base, '#000', 0.15), 1);
          break;
        }
        case FL.WATER: case FL.DEEPWATER: {
          const lt = Col.mix(base, '#c0e0f0', 0.35);
          for (let i = 0; i < 6; i++) { const p = P(rng.next(), rng.next()); g.strokeStyle = Col.rgba(lt, 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(p[0] - 4, p[1]); g.quadraticCurveTo(p[0], p[1] - 2, p[0] + 4, p[1]); g.stroke(); }
          break;
        }
        case FL.BURNT: {
          speck(70, ['#1a1614', '#4a4440', '#5a524c', '#221d1a', '#3a332e'], 2);
          for (let i = 0; i < 3; i++) { const a = P(rng.next(), rng.next()); g.strokeStyle = '#161210'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); for (let k = 0; k < 3; k++) g.lineTo(a[0] + rng.f(-8, 8), a[1] + rng.f(-4, 4)); g.stroke(); }
          if (rng.chance(0.3)) speck(4, ['#6a3a20', '#4a2a18'], 2);
          break;
        }
        case FL.FURROW: {
          for (let k = 0; k < 3; k++) {
            poly(g, [P(0, k / 3 + 0.05), P(1, k / 3 + 0.05), P(1, k / 3 + 0.2), P(0, k / 3 + 0.2)], Col.mix(base, '#fff', 0.12));
            poly(g, [P(0, k / 3 + 0.2), P(1, k / 3 + 0.2), P(1, k / 3 + 0.3), P(0, k / 3 + 0.3)], Col.mix(base, '#000', 0.25));
          }
          break;
        }
      }
      g.restore();
    });
  },
  // road markings and other floor decals (codes 1-9 here; other modules register painters in DECO_ART)
  deco(t) {
    return this.get('deco' + t, 66, 34, 33, 1, (g, ax, ay) => {
      const P = (u, v) => isoP(ax, ay, u, v, 0);
      if (DECO_ART[t]) DECO_ART[t](g, P, ax, ay);
      else if (t === 1) poly(g, [P(0.1, 0.9), P(0.9, 0.9), P(0.9, 1), P(0.1, 1)], 'rgba(220,180,40,0.85)');
      else if (t === 2) poly(g, [P(0.9, 0.1), P(1, 0.1), P(1, 0.9), P(0.9, 0.9)], 'rgba(220,180,40,0.85)');
      else if (t === 3) { for (const v0 of [0.12, 0.62]) poly(g, [P(0.05, v0), P(0.95, v0), P(0.95, v0 + 0.26), P(0.05, v0 + 0.26)], 'rgba(225,225,220,0.75)'); }
      else if (t === 4) { for (const u0 of [0.12, 0.62]) poly(g, [P(u0, 0.05), P(u0 + 0.26, 0.05), P(u0 + 0.26, 0.95), P(u0, 0.95)], 'rgba(225,225,220,0.75)'); }
    });
  },
  // grass creeping over the edge of a hard surface. dir: 0 N, 1 W, 2 S, 3 E
  fringe(dir, gf, v, gs) {
    return this.get('fr' + dir + '_' + gf + '_' + v + (gs || ''), 66, 34, 33, 1, (g, ax, ay) => {
      const rng = new RNG(dir * 101 + gf * 13 + v * 7 + 3);
      let base = (FLOOR_COL[gf] || FLOOR_COL[FL.GRASS])[v & 3];
      if (gs) base = Season.grassCol(base, gs);
      const P = (u, w) => isoP(ax, ay, u, w, 0);
      const at = (a, depth) => dir === 0 ? [a, depth] : dir === 2 ? [a, 1 - depth] : dir === 1 ? [depth, a] : [1 - depth, a];
      g.save();
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 32, ay + 16); g.lineTo(ax, ay + 32); g.lineTo(ax - 32, ay + 16); g.closePath(); g.clip();
      // irregular band
      g.beginPath();
      const steps = 8;
      const pts = [];
      for (let k = 0; k <= steps; k++) pts.push(at(k / steps, rng.f(0.04, 0.16)));
      let p0 = P(...at(0, 0)); g.moveTo(p0[0], p0[1]);
      for (const q of pts) { const s = P(...q); g.lineTo(s[0], s[1]); }
      p0 = P(...at(1, 0)); g.lineTo(p0[0], p0[1]);
      g.closePath();
      g.fillStyle = Col.rgba(base, 0.85); g.fill();
      const dk = Col.mix(base, '#203010', 0.35), lt = Col.mix(base, '#c0d080', 0.25);
      for (let i = 0; i < 16; i++) {
        const s = P(...at(rng.next(), rng.f(0, 0.2)));
        g.strokeStyle = rng.chance(0.5) ? dk : lt; g.lineWidth = 1;
        g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[0] + rng.f(-1.5, 1.5), s[1] - rng.f(2, 4)); g.stroke();
      }
      g.restore();
    });
  },
  blood(v) {
    return this.get('blood' + v, 80, 44, 40, 6, (g, ax, ay) => {
      const rng = new RNG(v * 7919 + 3);
      for (let i = 0; i < 9; i++) {
        const u = rng.f(0.2, 0.8), w = rng.f(0.2, 0.8);
        const p = isoP(ax, ay, u, w, 0);
        const r = rng.f(2, 7);
        g.fillStyle = rng.chance(0.5) ? 'rgba(110,8,8,0.8)' : 'rgba(80,4,4,0.75)';
        g.beginPath(); g.ellipse(p[0], p[1], r * 1.6, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 14; i++) {
        const p = isoP(ax, ay, rng.f(0, 1), rng.f(0, 1), 0);
        g.fillStyle = 'rgba(100,6,6,0.8)'; g.fillRect(p[0], p[1], 2, 1);
      }
    });
  },

  // snow cover on the ground
  snow(v) {
    return this.get('snow' + v, 66, 34, 33, 1, (g, ax, ay) => {
      const rng = new RNG(v * 313 + 7);
      g.save();
      g.beginPath(); g.moveTo(ax, ay - 0.8); g.lineTo(ax + 33, ay + 16); g.lineTo(ax, ay + 32.8); g.lineTo(ax - 33, ay + 16); g.closePath(); g.clip();
      g.fillStyle = '#e8eef4'; g.fillRect(0, 0, 66, 34);
      for (let i = 0; i < 40; i++) { const p = isoP(ax, ay, rng.next(), rng.next(), 0); g.fillStyle = rng.chance(0.5) ? '#d4dee8' : '#f8fbff'; g.fillRect(p[0], p[1], 2, 1); }
      for (let i = 0; i < 3; i++) { const p = isoP(ax, ay, rng.next(), rng.next(), 0); g.fillStyle = 'rgba(180,195,210,0.5)'; g.beginPath(); g.ellipse(p[0], p[1], rng.f(5, 10), rng.f(2, 4), 0, 0, 7); g.fill(); }
      g.restore();
    });
  },
  // soot / scorch marks left by fire
  scorch(v) {
    return this.get('scorch' + v, 80, 44, 40, 6, (g, ax, ay) => {
      const rng = new RNG(v * 4241 + 11);
      for (let i = 0; i < 7; i++) {
        const p = isoP(ax, ay, rng.f(0.2, 0.8), rng.f(0.2, 0.8), 0);
        const r = rng.f(4, 10);
        g.fillStyle = 'rgba(12,10,9,' + rng.f(0.35, 0.6).toFixed(2) + ')';
        g.beginPath(); g.ellipse(p[0], p[1], r * 1.6, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 18; i++) { const p = isoP(ax, ay, rng.f(0, 1), rng.f(0, 1), 0); g.fillStyle = rng.chance(0.5) ? 'rgba(90,84,78,0.7)' : 'rgba(20,18,16,0.8)'; g.fillRect(p[0], p[1], 2, 1); }
    });
  },
  // ------------------------------------------------------------ walls
  // Wall faces live in their own LRU cache: keys carry the facade style of the building
  // (material, trim, flags) and feature state, never building ids or positions.
  wcache: new Map(), WCAP: 1200,
  wallKey(type, d, col, f, cut, st) {
    let fk = '';
    if (f) fk = f.k + (f.open ? 'o' : '') + (f.smashed ? 's' : '') + (f.glassOut ? 'g' : '') + (f.broken ? 'b' : '') + (f.barricade || 0) + (f.curtains ? (f.curtainsClosed ? 'C' : 'c') + f.curtCol : '') + (f.style || '') + (f.col || '') + (f.big ? 'B' : '');
    return 'w' + type + '|' + d + '|' + col + '|' + fk + '|' + (cut ? 1 : 0) + (st ? '|' + st.k : '');
  },
  // st: optional face descriptor from Facade.edge (old callers get the plain look)
  wall(type, d, col, f, cut, st) {
    const key = this.wallKey(type, d, col, f, cut, st);
    let rec = this.wcache.get(key);
    if (!rec) {
      const info = WALL_INFO[type];
      const hz = cut ? (info.fence ? info.h : 0.32) : info.h;
      const H = hz * ZU;
      const w = 68, h = H + 36;
      const ax = d ? 44 : 24, ay = H + 12;
      const c = mkCanvas(w, h);
      this._drawWall(c.getContext('2d'), ax, ay, type, d, col, f, hz, cut, st, Facade.shash(key));
      rec = { c, ax, ay, sil: null, u: 0 };
      this.wcache.set(key, rec);
      if (this.wcache.size > this.WCAP) {
        let n = this.wcache.size - (this.WCAP * 0.8 | 0);
        const old = Facade.tick - 2;
        for (const [k, r] of this.wcache) { if (n <= 0) break; if (r.u < old) { this.wcache.delete(k); n--; } }
      }
    }
    rec.u = Facade.tick;
    return rec;
  },
  _drawWall(g, ax, ay, type, d, col, f, hz, cut, st, seed) { Facade.paint(g, ax, ay, type, d, col, f, hz, cut, st, seed || 1); },

  // ------------------------------------------------------------ furniture / objects
  obj(o) {
    const d = OBJ[o.t];
    let key = 'o' + o.t + '|' + o.dir + '|' + (o.part === undefined ? '' : o.part) + '|' + (o.col || '') + '|' + (o.kind || '') + '|' + (o.v === undefined ? '' : o.v);
    if (o.t === 'tree') key += '|' + Math.round((o.sz || 1) * 10) + (o.stump ? 's' : '') + (o.burnt ? 'x' : '') + '|' + (o.kind === 'pine' ? '' : Season.tree) + (Season.snow > 0.3 ? 'S' : '');
    if (o.t === 'bush') key += '|' + Season.tree + (Season.snow > 0.3 ? 'S' : '');
    if (o.t === 'trap') key += '|' + (o.bait ? 'b' : '') + (o.caught || '');
    if (o.t === 'crop') key = 'ocrop|' + o.crop + '|' + o.stage + '|' + (o.dead ? 1 : 0) + (o.seed ? 'x' : '');
    if (o.t === 'campfire') key += '|' + (o.lit ? 1 : 0);
    if (o.t === 'barrel') key += '|' + Math.round((o.water || 0) * 4);
    if (o.t === 'bush') key += '|' + (o.berries ? 1 : 0);
    if (o.t === 'hay') key += o.sandbag ? 's' : '';
    // optional per-type cache-key extension: ObjArt.k_<type>(o) -> string
    const kf = ObjArt['k_' + o.t];
    if (kf) key += '|' + kf.call(ObjArt, o);
    let w = 110, h = (d.h + 1.6) * ZU + 30, ax = 55, ay = (d.h + 0.6) * ZU + 14;
    if (o.t === 'tree') { w = 200; h = 260; ax = 100; ay = 220; }
    if (o.t === 'lamppost') { w = 110; h = 200; ax = 55; ay = 170; }
    // optional canvas override for big sprites: OBJ[t].spr = { w, h, ax, ay }
    if (d.spr) { w = d.spr.w; h = d.spr.h; ax = d.spr.ax; ay = d.spr.ay; }
    return this.get(key, w, h, ax, ay, (g) => ObjArt.draw(g, ax, ay, o));
  },
};

// ---------------------------------------------------------------------------
// Furniture painter
// ---------------------------------------------------------------------------
const ObjArt = {
  g: null, ax: 0, ay: 0,
  P(u, v, z) { return isoP(this.ax, this.ay, u, v, z); },
  box(u0, v0, z0, u1, v1, z1, col, outline) {
    const P = (u, v, z) => this.P(u, v, z), g = this.g;
    poly(g, [P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], Col.shade(col, FACE_S));
    poly(g, [P(u1, v1, z0), P(u1, v0, z0), P(u1, v0, z1), P(u1, v1, z1)], Col.shade(col, FACE_E));
    poly(g, [P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], Col.shade(col, 1));
    if (outline !== false) {
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
      poly(g, [P(u0, v1, z0), P(u1, v1, z0), P(u1, v0, z0), P(u1, v0, z1), P(u0, v0, z1), P(u0, v1, z1)], null, 'rgba(0,0,0,0.28)', 1);
    }
  },
  // rectangle on a visible face of a box. face 'S' (v=v1) or 'E' (u=u1); a along face 0..1 (left->right on screen)
  facePts(face, b, a0, a1, z0, z1) {
    const [u0, v0, , u1, v1] = b;
    if (face === 'S') { const ua = U.lerp(u0, u1, a0), ub = U.lerp(u0, u1, a1); return [this.P(ua, v1 + 0.001, z0), this.P(ub, v1 + 0.001, z0), this.P(ub, v1 + 0.001, z1), this.P(ua, v1 + 0.001, z1)]; }
    const va = U.lerp(v1, v0, a0), vb = U.lerp(v1, v0, a1);
    return [this.P(u1 + 0.001, va, z0), this.P(u1 + 0.001, vb, z0), this.P(u1 + 0.001, vb, z1), this.P(u1 + 0.001, va, z1)];
  },
  faceRect(face, b, a0, a1, z0, z1, col, stroke) {
    const fac = face === 'S' ? FACE_S : FACE_E;
    poly(this.g, this.facePts(face, b, a0, a1, z0, z1), col ? Col.shade(col, fac) : null, stroke ? Col.shade(stroke, fac) : null, 1);
  },
  // visible front face from dir (S or E), null if facing away
  front(o) { return o.dir === 'S' ? 'S' : o.dir === 'E' ? 'E' : null; },
  // box bounds given "back against wall" depth fraction. Returns [u0,v0,z0,u1,v1,z1]
  inset(dir, depth, m) {
    m = m || 0.04;
    let u0 = m, v0 = m, u1 = 1 - m, v1 = 1 - m;
    if (dir === 'S') v1 = v0 + depth; else if (dir === 'N') v0 = v1 - depth; else if (dir === 'E') u1 = u0 + depth; else u0 = u1 - depth;
    return [u0, v0, 0, u1, v1, 0];
  },
  shadow(u0, v0, u1, v1) {
    poly(this.g, [this.P(u0 - 0.03, v0 - 0.03, 0), this.P(u1 + 0.06, v0 - 0.03, 0), this.P(u1 + 0.06, v1 + 0.06, 0), this.P(u0 - 0.03, v1 + 0.06, 0)], 'rgba(0,0,0,0.22)');
  },
  draw(g, ax, ay, o) {
    this.g = g; this.ax = ax; this.ay = ay;
    const fn = this['d_' + o.t];
    if (fn) fn.call(this, o); else this.box(0.1, 0.1, 0, 0.9, 0.9, OBJ[o.t].h, '#888');
  },
  d_counter(o) {
    const b = this.inset(o.dir, 0.86, 0.0);
    this.shadow(b[0], b[1], b[3], b[4]);
    const cab = o.cabCol || '#e8e0d0';
    this.box(b[0], b[1], 0, b[3], b[4], 0.86, cab);
    this.box(b[0] - 0.01, b[1] - 0.01, 0.86, b[3] + 0.01, b[4] + 0.01, 0.94, '#9a948a');
    const fr = this.front(o);
    if (fr) {
      this.faceRect(fr, b, 0.05, 0.47, 0.08, 0.78, null, '#8a8478');
      this.faceRect(fr, b, 0.53, 0.95, 0.08, 0.78, null, '#8a8478');
      this.faceRect(fr, b, 0.36, 0.42, 0.55, 0.6, '#707070');
      this.faceRect(fr, b, 0.58, 0.64, 0.55, 0.6, '#707070');
    }
  },
  d_medcab(o) { o.cabCol = '#f4f4f4'; this.d_counter(o); },
  d_counterbar(o) {
    const b = this.inset(o.dir, 0.7, 0.0);
    this.box(b[0], b[1], 0, b[3], b[4], 1.02, '#5a3a24');
    this.box(b[0] - 0.02, b[1] - 0.02, 1.02, b[3] + 0.02, b[4] + 0.02, 1.1, '#7a4a2a');
  },
  d_sink(o) {
    this.d_counter(o);
    const c = [0.5, 0.5];
    const g = this.g;
    poly(g, [this.P(0.25, 0.25, 0.945), this.P(0.75, 0.25, 0.945), this.P(0.75, 0.75, 0.945), this.P(0.25, 0.75, 0.945)], '#c8ccd0', '#8a8e92', 1);
    poly(g, [this.P(0.32, 0.32, 0.945), this.P(0.68, 0.32, 0.945), this.P(0.68, 0.68, 0.945), this.P(0.32, 0.68, 0.945)], '#9aa0a6');
    const back = { S: [0.5, 0.15], N: [0.5, 0.85], E: [0.15, 0.5], W: [0.85, 0.5] }[o.dir];
    line(g, this.P(back[0], back[1], 0.95), this.P(back[0], back[1], 1.15), '#c0c4c8', 2);
    line(g, this.P(back[0], back[1], 1.15), this.P(U.lerp(back[0], c[0], 0.6), U.lerp(back[1], c[1], 0.6), 1.12), '#c0c4c8', 2);
  },
  d_stove(o) {
    const b = this.inset(o.dir, 0.86, 0.0);
    this.box(b[0], b[1], 0, b[3], b[4], 0.92, '#e8e8e4');
    const g = this.g;
    poly(g, [this.P(b[0] + 0.05, b[1] + 0.05, 0.921), this.P(b[3] - 0.05, b[1] + 0.05, 0.921), this.P(b[3] - 0.05, b[4] - 0.05, 0.921), this.P(b[0] + 0.05, b[4] - 0.05, 0.921)], '#2a2a2c');
    for (const [u, v] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) {
      const p = this.P(U.lerp(b[0], b[3], u), U.lerp(b[1], b[4], v), 0.925);
      g.strokeStyle = '#6a6a6c'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(p[0], p[1], 5, 2.5, 0, 0, Math.PI * 2); g.stroke();
    }
    const fr = this.front(o);
    if (fr) {
      this.faceRect(fr, b, 0.12, 0.88, 0.15, 0.62, '#2a2a2c');
      this.faceRect(fr, b, 0.12, 0.88, 0.7, 0.76, '#a0a0a0');
    }
  },
  d_fridge(o) {
    const b = this.inset(o.dir, 0.82, 0.06);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 1.85, o.col || '#f0f0ec');
    const fr = this.front(o);
    if (fr) {
      this.faceRect(fr, b, 0, 1, 1.2, 1.215, '#a0a0a0');
      this.faceRect(fr, b, 0.82, 0.88, 1.3, 1.6, '#909090');
      this.faceRect(fr, b, 0.82, 0.88, 0.5, 1.0, '#909090');
    }
  },
  d_cooler(o) {
    const b = this.inset(o.dir, 0.8, 0.04);
    this.box(b[0], b[1], 0, b[3], b[4], 1.95, '#c03030');
    const fr = this.front(o);
    if (fr) {
      this.faceRect(fr, b, 0.06, 0.94, 0.15, 1.6, '#1a2a3a');
      const cols = ['#c02020', '#20a040', '#f0a020', '#3060c0', '#e0e0e0'];
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) this.faceRect(fr, b, 0.1 + k * 0.14, 0.18 + k * 0.14, 0.25 + r * 0.35, 0.45 + r * 0.35, cols[(r * 3 + k) % 5]);
      poly(this.g, this.facePts(fr, b, 0.06, 0.94, 0.15, 1.6), 'rgba(180,220,240,0.25)');
      this.faceRect(fr, b, 0.06, 0.94, 1.7, 1.88, '#f0f0f0');
    }
  },
  d_table() {
    const g = this.g;
    this.shadow(0.12, 0.12, 0.88, 0.88);
    for (const [u, v] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) line(g, this.P(u, v, 0), this.P(u, v, 0.72), '#5a4030', 3);
    this.box(0.06, 0.06, 0.72, 0.94, 0.94, 0.78, '#8a6a48');
  },
  d_desk(o) {
    this.shadow(0.1, 0.1, 0.9, 0.9);
    this.box(0.08, 0.08, 0.72, 0.92, 0.92, 0.78, '#7a5a3a');
    const side = o.dir === 'S' || o.dir === 'N' ? [0.62, 0.12, 0, 0.9, 0.88, 0.72] : [0.12, 0.62, 0, 0.88, 0.9, 0.72];
    this.box(...side, '#6a4a30');
    line(this.g, this.P(0.12, 0.12, 0), this.P(0.12, 0.12, 0.72), '#4a3020', 2);
  },
  d_chair(o) {
    const g = this.g;
    for (const [u, v] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) line(g, this.P(u, v, 0), this.P(u, v, 0.45), '#4a3020', 2);
    this.box(0.26, 0.26, 0.45, 0.74, 0.74, 0.5, '#8a6040');
    const bk = { S: [0.26, 0.24, 0.74, 0.3], N: [0.26, 0.7, 0.74, 0.76], E: [0.24, 0.26, 0.3, 0.74], W: [0.7, 0.26, 0.76, 0.74] }[o.dir];
    this.box(bk[0], bk[1], 0.5, bk[2], bk[3], 1.0, '#7a5638');
  },
  d_bed(o) {
    const head = o.part === 0;
    const col = o.col || '#4060a0';
    const b = [0.04, 0.04, 0, 0.96, 0.96, 0];
    this.box(0.04, 0.04, 0, 0.96, 0.96, 0.32, '#6a4a30');
    this.box(0.06, 0.06, 0.32, 0.94, 0.94, 0.48, '#e8e8e0');
    // blanket covers foot part and half of head
    const cov = head ? ({ S: [0.06, 0.45, 0.94, 0.94], N: [0.06, 0.06, 0.94, 0.55], E: [0.45, 0.06, 0.94, 0.94], W: [0.06, 0.06, 0.55, 0.94] }[o.dir]) : [0.03, 0.03, 0.97, 0.97];
    this.box(cov[0], cov[1], 0.36, cov[2], cov[3], 0.52, col);
    if (head) {
      const pl = { S: [0.18, 0.1, 0.82, 0.36], N: [0.18, 0.64, 0.82, 0.9], E: [0.1, 0.18, 0.36, 0.82], W: [0.64, 0.18, 0.9, 0.82] }[o.dir];
      this.box(pl[0], pl[1], 0.48, pl[2], pl[3], 0.6, '#f4f4f0');
      const hb = { S: [0.02, 0.0, 0.98, 0.06], N: [0.02, 0.94, 0.98, 1.0], E: [0.0, 0.02, 0.06, 0.98], W: [0.94, 0.02, 1.0, 0.98] }[o.dir];
      this.box(hb[0], hb[1], 0, hb[2], hb[3], 1.0, '#5a3a24');
    }
    void b;
  },
  d_sofa(o) {
    const col = o.col || '#7a3a30';
    const b = this.inset(o.dir, 0.86, 0.03);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 0.42, col);
    const back = { S: [b[0], b[1], b[3], b[1] + 0.22], N: [b[0], b[4] - 0.22, b[3], b[4]], E: [b[0], b[1], b[0] + 0.22, b[4]], W: [b[3] - 0.22, b[1], b[3], b[4]] }[o.dir];
    this.box(back[0], back[1], 0.42, back[2], back[3], 0.85, Col.mix(col, '#000', 0.08));
    // arm on the outer end
    const along = o.dir === 'S' || o.dir === 'N';
    if (o.part !== undefined) {
      // part 0 is first placed tile; draw arms on both outer ends roughly
      if (along) { this.box(b[0], b[1], 0.42, b[0] + 0.12, b[4], 0.62, col); this.box(b[3] - 0.12, b[1], 0.42, b[3], b[4], 0.62, col); }
      else { this.box(b[0], b[1], 0.42, b[3], b[1] + 0.12, 0.62, col); this.box(b[0], b[4] - 0.12, 0.42, b[3], b[4], 0.62, col); }
    }
  },
  d_armchair(o) { o.part = 0; this.d_sofa(o); },
  d_tv(o) {
    const b = this.inset(o.dir, 0.6, 0.08);
    this.box(b[0], b[1], 0, b[3], b[4], 0.5, '#4a3a2a');
    const t = this.inset(o.dir, 0.45, 0.14);
    this.box(t[0], t[1], 0.5, t[3], t[4], 1.05, '#2a2a2c');
    const fr = this.front(o);
    if (fr) this.faceRect(fr, t, 0.1, 0.9, 0.58, 0.98, '#3a4a50');
  },
  d_toilet(o) {
    const g = this.g;
    const tank = { S: [0.25, 0.1, 0.75, 0.32], N: [0.25, 0.68, 0.75, 0.9], E: [0.1, 0.25, 0.32, 0.75], W: [0.68, 0.25, 0.9, 0.75] }[o.dir];
    const bowl = { S: [0.3, 0.3, 0.7, 0.8], N: [0.3, 0.2, 0.7, 0.7], E: [0.3, 0.3, 0.8, 0.7], W: [0.2, 0.3, 0.7, 0.7] }[o.dir];
    this.box(tank[0], tank[1], 0, tank[2], tank[3], 0.85, '#f4f4f4');
    this.box(bowl[0], bowl[1], 0, bowl[2], bowl[3], 0.45, '#f0f0f0');
    const c = this.P((bowl[0] + bowl[2]) / 2, (bowl[1] + bowl[3]) / 2, 0.455);
    g.fillStyle = '#b8c8d0'; g.beginPath(); g.ellipse(c[0], c[1], 6, 3, 0, 0, Math.PI * 2); g.fill();
  },
  d_bathtub(o) {
    const b = this.inset(o.dir, 0.86, 0.03);
    this.box(b[0], b[1], 0, b[3], b[4], 0.55, '#f2f2f0');
    poly(this.g, [this.P(b[0] + 0.08, b[1] + 0.08, 0.551), this.P(b[3] - 0.08, b[1] + 0.08, 0.551), this.P(b[3] - 0.08, b[4] - 0.08, 0.551), this.P(b[0] + 0.08, b[4] - 0.08, 0.551)], '#c8d8e0');
  },
  // small game traps
  d_trap(o) {
    const g = this.g;
    const animal = (u, v, kind) => {
      const c = this.P(u, v, 0.05);
      const col = { rabbit: '#8a7a68', squirrel: '#9a5a32', bird: '#4a4a58', mouse: '#7a7068' }[kind] || '#777';
      const s = kind === 'rabbit' ? 1 : kind === 'squirrel' ? 0.75 : kind === 'bird' ? 0.6 : 0.45;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(c[0] + 2, c[1] + 2, 10 * s, 4 * s, 0, 0, 7); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(c[0], c[1] - 3 * s, 9 * s, 4.5 * s, -0.2, 0, 7); g.fill();
      g.beginPath(); g.arc(c[0] + 8 * s, c[1] - 5 * s, 3.5 * s, 0, 7); g.fill();
      if (kind === 'rabbit') { g.fillRect(c[0] + 7, c[1] - 13, 2, 6); g.fillRect(c[0] + 10, c[1] - 12, 2, 5); g.fillStyle = '#e8e0d8'; g.beginPath(); g.arc(c[0] - 9, c[1] - 3, 2.5, 0, 7); g.fill(); }
      if (kind === 'squirrel') { g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(c[0] - 6, c[1] - 3); g.quadraticCurveTo(c[0] - 14, c[1] - 6, c[0] - 9, c[1] - 12); g.stroke(); }
      if (kind === 'bird') { g.fillStyle = '#2a2a34'; g.beginPath(); g.ellipse(c[0] - 1, c[1] - 4, 6, 2, -0.5, 0, 7); g.fill(); g.fillStyle = '#d0a030'; g.fillRect(c[0] + 10, c[1] - 6, 3, 1.5); }
      g.fillStyle = 'rgba(120,10,10,0.5)'; g.fillRect(c[0] + 2, c[1] - 1, 3, 2);
    };
    if (o.kind === 'snare') {
      line(g, this.P(0.5, 0.35, 0), this.P(0.5, 0.35, 0.45), '#6a4a2a', 2);
      g.strokeStyle = '#d8d0b8'; g.lineWidth = 1.2;
      const c = this.P(0.5, 0.6, 0.02);
      g.beginPath(); g.ellipse(c[0], c[1], 9, 4.5, 0, 0, 7); g.stroke();
      line(g, this.P(0.5, 0.35, 0.4), [c[0], c[1] - 4], '#d8d0b8', 1);
      if (o.bait) { g.fillStyle = '#e07a2a'; g.fillRect(c[0] - 2, c[1] - 2, 4, 3); }
      if (o.caught) animal(0.5, 0.62, o.caught);
      return;
    }
    const b = [0.22, 0.3, 0, 0.78, 0.7, 0.32];
    this.box(0.22, 0.3, 0, 0.78, 0.7, 0.32, '#8a6a40');
    for (let k = 1; k < 4; k++) this.faceRect('S', b, k / 4 - 0.02, k / 4 + 0.02, 0.02, 0.3, '#5a4028');
    if (o.caught) { this.faceRect('E', b, 0.15, 0.85, 0.03, 0.29, '#6a4a2c', '#3a2a18'); const e = this.P(0.66, 0.5, 0.33); g.fillStyle = { rabbit: '#8a7a68', squirrel: '#9a5a32', bird: '#4a4a58', mouse: '#7a7068' }[o.caught] || '#777'; g.fillRect(e[0] - 3, e[1] - 4, 2, 4); g.fillRect(e[0] + 1, e[1] - 4, 2, 4); }
    else { this.faceRect('E', b, 0.15, 0.85, 0.03, 0.29, '#1a140e'); if (o.bait) { const e = this.P(0.7, 0.5, 0.05); g.fillStyle = '#e07a2a'; g.fillRect(e[0] - 2, e[1] - 3, 4, 3); } }
  },
  // charred furniture remains
  d_ash(o) {
    const g = this.g, rng = new RNG((o.v || 0) * 71 + (o.big ? 13 : 3));
    poly(g, [this.P(0.08, 0.1, 0), this.P(0.92, 0.12, 0), this.P(0.9, 0.9, 0), this.P(0.1, 0.92, 0)], 'rgba(20,16,14,0.55)');
    const n = o.big ? 7 : 4;
    for (let k = 0; k < n; k++) {
      const u = rng.f(0.12, 0.7), v = rng.f(0.12, 0.7), l = rng.f(0.15, 0.4), h = rng.f(0.05, o.big ? 0.35 : 0.2);
      if (rng.chance(0.5)) this.box(u, v, 0, Math.min(0.95, u + l), Math.min(0.95, v + 0.08), h, rng.pick(['#2a2420', '#3a322c', '#1e1a18']), false);
      else this.box(u, v, 0, Math.min(0.95, u + 0.08), Math.min(0.95, v + l), h, rng.pick(['#2a2420', '#3a322c', '#1e1a18']), false);
    }
    for (let k = 0; k < 10; k++) { const p = this.P(rng.f(0.1, 0.9), rng.f(0.1, 0.9), 0.02); g.fillStyle = rng.pick(['#6a625a', '#8a827a', '#4a4440']); g.fillRect(p[0], p[1], 2, 1); }
  },
  // ---- staircase: 3 tiles of 4 steps each, climbing toward o.dir, wall on side o.ws
  d_stairs(o) {
    const H = WALL_H, k = o.part || 0, g = this.g;
    const boxes = [];
    for (let i = 0; i < 4; i++) {
      const a0 = i / 4, a1 = (i + 1) / 4, zt = (k * 4 + i + 1) * H / 12;
      let u0 = 0.02, v0 = 0.02, u1 = 0.98, v1 = 0.98;
      if (o.dir === 'E') { u0 = a0; u1 = a1; } else if (o.dir === 'W') { u0 = 1 - a1; u1 = 1 - a0; }
      else if (o.dir === 'S') { v0 = a0; v1 = a1; } else { v0 = 1 - a1; v1 = 1 - a0; }
      boxes.push([u0, v0, u1, v1, zt]);
    }
    boxes.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [u0, v0, u1, v1, zt] of boxes) {
      this.box(u0, v0, 0, u1, v1, zt, '#9a7650', false);
      // tread nosing
      poly(g, [this.P(u0, v0, zt), this.P(u1, v0, zt), this.P(u1, v1, zt), this.P(u0, v1, zt)], null, 'rgba(60,40,20,0.45)', 1);
    }
    // handrail on the open side
    const os = OPP[o.ws] || 'S';
    const z0 = k * H / 3 + 0.95, z1 = (k + 1) * H / 3 + 0.95;
    const end = (a) => {
      const t = o.dir === 'E' || o.dir === 'S' ? a : 1 - a;
      if (os === 'N') return [t, 0.06]; if (os === 'S') return [t, 0.94]; if (os === 'W') return [0.06, t]; return [0.94, t];
    };
    const pa = end(0), pb2 = end(1);
    const za = (o.dir === 'E' || o.dir === 'S') ? z0 : z1, zb = (o.dir === 'E' || o.dir === 'S') ? z1 : z0;
    const fa = (o.dir === 'E' || o.dir === 'S') ? k * H / 3 : (k + 1) * H / 3, fb = (o.dir === 'E' || o.dir === 'S') ? (k + 1) * H / 3 : k * H / 3;
    line(g, this.P(pa[0], pa[1], fa + 0.1), this.P(pa[0], pa[1], za), '#5a3e24', 2);
    line(g, this.P(pa[0], pa[1], za), this.P(pb2[0], pb2[1], zb), '#6a4a2c', 2.5);
    line(g, this.P(U.lerp(pa[0], pb2[0], 0.5), U.lerp(pa[1], pb2[1], 0.5), (fa + fb) / 2 + 0.1), this.P(U.lerp(pa[0], pb2[0], 0.5), U.lerp(pa[1], pb2[1], 0.5), (za + zb) / 2), '#5a3e24', 1.5);
  },
  // the solid block under the top landing (a little cupboard under the stairs)
  d_landing(o) {
    const H = WALL_H;
    this.box(0.02, 0.02, 0, 0.98, 0.98, H, '#8a6a48');
    const b = [0.02, 0.02, 0, 0.98, 0.98, H];
    const fr = OPP[o.ws] === 'S' || OPP[o.ws] === 'E' ? OPP[o.ws] : (o.dir === 'S' || o.dir === 'E' ? null : (o.dir === 'N' ? 'S' : 'E'));
    for (const face of ['S', 'E']) {
      for (let k = 1; k < 4; k++) this.faceRect(face, b, 0, 1, k * H / 4, k * H / 4 + 0.02, '#6a4e34');
    }
    if (fr) { this.faceRect(fr, b, 0.25, 0.75, 0.05, 1.7, '#7a5a3c', '#4a3422'); this.faceRect(fr, b, 0.62, 0.68, 0.85, 0.95, '#c8b070'); }
  },
  // balustrade round the stairwell opening upstairs
  d_railing(o) {
    const g = this.g, h = 0.9;
    const sides = [OPP[o.ws] || 'S'];
    if (o.part === 0) sides.push(OPP[o.dir]);
    const seg = (s) => s === 'N' ? [[0, 0.04], [1, 0.04]] : s === 'S' ? [[0, 0.96], [1, 0.96]] : s === 'W' ? [[0.04, 0], [0.04, 1]] : [[0.96, 0], [0.96, 1]];
    for (const sd of sides) {
      const [a, b] = seg(sd);
      for (let k = 0; k <= 4; k++) {
        const u = U.lerp(a[0], b[0], k / 4), v = U.lerp(a[1], b[1], k / 4);
        line(g, this.P(u, v, 0), this.P(u, v, h), '#6a4a2c', k % 4 === 0 ? 2.5 : 1.5);
      }
      line(g, this.P(a[0], a[1], h), this.P(b[0], b[1], h), '#7a5634', 3);
      line(g, this.P(a[0], a[1], 0.02), this.P(b[0], b[1], 0.02), '#5a3e24', 2);
    }
  },
  // top of the flight: the balustrade continues along the open side up to the landing
  d_stairtop(o) { this.d_railing(Object.assign({}, o, { part: 2 })); },
  d_wardrobe(o) {
    const b = this.inset(o.dir, 0.62, 0.05);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 1.95, o.col || '#7a5434');
    const fr = this.front(o);
    if (fr) { this.faceRect(fr, b, 0.495, 0.505, 0.1, 1.85, '#3a2a1a'); this.faceRect(fr, b, 0.4, 0.44, 0.9, 1.1, '#c0a060'); this.faceRect(fr, b, 0.56, 0.6, 0.9, 1.1, '#c0a060'); }
  },
  d_dresser(o) {
    const b = this.inset(o.dir, 0.55, 0.06);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 0.95, o.col || '#8a6440');
    const fr = this.front(o);
    if (fr) for (let k = 0; k < 3; k++) { const z = 0.1 + k * 0.28; this.faceRect(fr, b, 0.06, 0.94, z, z + 0.24, null, '#4a3420'); this.faceRect(fr, b, 0.45, 0.55, z + 0.1, z + 0.14, '#c0a060'); }
  },
  d_nightstand(o) {
    const b = this.inset(o.dir, 0.5, 0.2);
    this.box(b[0], b[1], 0, b[3], b[4], 0.55, '#7a5434');
    const fr = this.front(o);
    if (fr) this.faceRect(fr, b, 0.1, 0.9, 0.3, 0.48, null, '#4a3420');
  },
  d_bookshelf(o) {
    const b = this.inset(o.dir, 0.42, 0.04);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 1.9, '#6a4a2e');
    const fr = this.front(o);
    if (fr) {
      const rng = new RNG(o.dir.charCodeAt(0) * 31 + 7);
      for (let s = 0; s < 4; s++) {
        const z0 = 0.12 + s * 0.44;
        this.faceRect(fr, b, 0.05, 0.95, z0, z0 + 0.38, '#2a1c10');
        let a = 0.07;
        while (a < 0.9) { const wdt = rng.f(0.04, 0.08); this.faceRect(fr, b, a, a + wdt, z0, z0 + rng.f(0.24, 0.36), rng.pick(['#8a2a2a', '#2a4a7a', '#3a6a3a', '#c0a040', '#5a3a6a', '#d0d0c0', '#6a3a1a'])); a += wdt + 0.01; }
      }
    }
  },
  d_shelf(o) {
    const b = this.inset(o.dir, 0.7, 0.04);
    this.shadow(b[0], b[1], b[3], b[4]);
    const g = this.g;
    const mc = '#8a9098';
    for (const [u, v] of [[b[0], b[1]], [b[3], b[1]], [b[0], b[4]], [b[3], b[4]]]) line(g, this.P(u, v, 0), this.P(u, v, 1.75), '#6a7078', 2);
    const rng = new RNG(o.dir.charCodeAt(0) * 13 + 3 + (o.v || 0));
    for (let s = 0; s < 4; s++) {
      const z = 0.08 + s * 0.52;
      this.box(b[0], b[1], z, b[3], b[4], z + 0.05, mc, false);
      if (s < 3) {
        for (let k = 0; k < 4; k++) {
          if (rng.chance(0.25)) continue;
          const u0 = U.lerp(b[0], b[3], k / 4) + 0.03, u1 = U.lerp(b[0], b[3], (k + 1) / 4) - 0.03;
          const isS = o.dir === 'S' || o.dir === 'N';
          const hh = rng.f(0.18, 0.36);
          const col = rng.pick(['#c03030', '#3070c0', '#e0b030', '#40a050', '#e8e8e8', '#a05030', '#8040a0']);
          if (isS) this.box(u0, b[1] + 0.08, z + 0.05, u1, b[4] - 0.08, z + 0.05 + hh, col, false);
          else { const v0 = U.lerp(b[1], b[4], k / 4) + 0.03, v1 = U.lerp(b[1], b[4], (k + 1) / 4) - 0.03; this.box(b[0] + 0.08, v0, z + 0.05, b[3] - 0.08, v1, z + 0.05 + hh, col, false); }
        }
      }
    }
  },
  d_crate(o) {
    const s = o.t === 'woodcrate' ? 0.08 : 0.1;
    this.shadow(s, s, 1 - s, 1 - s);
    this.box(s, s, 0, 1 - s, 1 - s, 0.85, '#a8824e');
    for (const face of ['S', 'E']) {
      const b = [s, s, 0, 1 - s, 1 - s];
      for (let k = 1; k < 3; k++) this.faceRect(face, b, 0, 1, k * 0.28, k * 0.28 + 0.02, '#6a4a28');
      poly(this.g, this.facePts(face, b, 0, 1, 0, 0.85), null, Col.shade('#5a3a1a', 0.8), 1);
    }
  },
  d_woodcrate(o) { this.d_crate(o); },
  d_toolcab(o) {
    const b = this.inset(o.dir, 0.66, 0.04);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 0.9, '#a02a20');
    this.box(b[0] - 0.02, b[1] - 0.02, 0.9, b[3] + 0.02, b[4] + 0.02, 0.96, '#8a6a48');
    const bk = { S: [b[0], b[1], b[3], b[1] + 0.06], N: [b[0], b[4] - 0.06, b[3], b[4]], E: [b[0], b[1], b[0] + 0.06, b[4]], W: [b[3] - 0.06, b[1], b[3], b[4]] }[o.dir];
    this.box(bk[0], bk[1], 0.96, bk[2], bk[3], 1.6, '#b09070');
    const fr = this.front(o);
    if (fr) for (let k = 0; k < 4; k++) this.faceRect(fr, b, 0.06, 0.94, 0.08 + k * 0.2, 0.24 + k * 0.2, null, '#5a1a10');
  },
  d_locker(o) {
    const b = this.inset(o.dir, 0.5, 0.08);
    this.box(b[0], b[1], 0, b[3], b[4], 2.0, o.col || '#5a6a80');
    const fr = this.front(o);
    if (fr) { this.faceRect(fr, b, 0.49, 0.51, 0.05, 1.95, '#2a3440'); for (let k = 0; k < 3; k++) { this.faceRect(fr, b, 0.12, 0.38, 1.6 + k * 0.08, 1.63 + k * 0.08, '#2a3440'); this.faceRect(fr, b, 0.62, 0.88, 1.6 + k * 0.08, 1.63 + k * 0.08, '#2a3440'); } }
  },
  d_register(o) {
    const b = this.inset(o.dir, 0.7, 0.0);
    this.box(b[0], b[1], 0, b[3], b[4], 0.95, '#5a5a62');
    this.box(b[0] - 0.01, b[1] - 0.01, 0.95, b[3] + 0.01, b[4] + 0.01, 1.0, '#3a3a40');
    this.box(0.35, 0.35, 1.0, 0.65, 0.65, 1.2, '#2a2a2e');
  },
  d_trash() {
    this.shadow(0.25, 0.25, 0.75, 0.75);
    this.box(0.25, 0.25, 0, 0.75, 0.75, 0.85, '#3a5a3a');
    this.box(0.22, 0.22, 0.85, 0.78, 0.78, 0.92, '#2a4a2a');
  },
  d_mailbox() {
    line(this.g, this.P(0.5, 0.5, 0), this.P(0.5, 0.5, 1.0), '#5a4030', 3);
    this.box(0.35, 0.4, 1.0, 0.65, 0.6, 1.22, '#4a5a7a');
  },
  d_tree(o) {
    const g = this.g, sz = o.sz || 1;
    const rng = new RNG((o.kind || 'oak').length * 101 + Math.round(sz * 100));
    const base = this.P(0.5, 0.5, 0);
    const snow = Season.snow > 0.3;
    if (o.stump) {
      this.box(0.38, 0.38, 0, 0.62, 0.62, 0.3, o.burnt ? '#2a2420' : '#6a4a2e');
      if (snow) poly(g, [this.P(0.38, 0.38, 0.31), this.P(0.62, 0.38, 0.31), this.P(0.62, 0.62, 0.31), this.P(0.38, 0.62, 0.31)], '#eef2f6');
      return;
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(base[0] + 6, base[1] + 2, 34 * sz, 15 * sz, 0, 0, Math.PI * 2); g.fill();
    if (o.kind === 'pine') {
      const trunkTop = this.P(0.5, 0.5, 1.0);
      line(g, base, trunkTop, '#5a3a22', 6 * sz);
      for (let k = 0; k < 4; k++) {
        const z0 = 0.6 + k * 0.85 * sz, z1 = z0 + 1.5 * sz;
        const w = (36 - k * 7) * sz;
        const p0 = this.P(0.5, 0.5, z0), p1 = this.P(0.5, 0.5, z1);
        const col = ['#1e4a2a', '#24502e', '#2a5834', '#30603a'][k];
        poly(g, [[p0[0] - w, p0[1]], [p1[0], p1[1]], [p0[0] + w, p0[1]], [p0[0], p0[1] + w * 0.25]], col);
        poly(g, [[p0[0], p0[1] + w * 0.25], [p1[0], p1[1]], [p0[0] + w, p0[1]]], 'rgba(0,0,0,0.18)');
        if (snow) poly(g, [[p0[0] - w * 0.55, U.lerp(p0[1], p1[1], 0.42)], [p1[0], p1[1]], [p0[0] + w * 0.3, U.lerp(p0[1], p1[1], 0.5)], [p0[0] - w * 0.1, U.lerp(p0[1], p1[1], 0.3)]], 'rgba(238,242,246,0.85)');
      }
      return;
    }
    const tr = o.kind === 'birch' ? '#d8d4c8' : '#5a3e28';
    const top = this.P(0.5, 0.5, 2.0 * sz);
    line(g, base, top, tr, 7 * sz);
    if (o.kind === 'birch') for (let k = 0; k < 6; k++) { const p = this.P(0.5, 0.5, 0.3 + k * 0.3); g.fillStyle = '#303030'; g.fillRect(p[0] - 2, p[1], 3, 1); }
    line(g, this.P(0.5, 0.5, 1.4 * sz), [top[0] - 16 * sz, top[1] - 6 * sz], tr, 3 * sz);
    line(g, this.P(0.5, 0.5, 1.6 * sz), [top[0] + 14 * sz, top[1] - 8 * sz], tr, 3 * sz);
    const st = Season.tree;
    const cz = this.P(0.5, 0.5, 2.9 * sz);
    if (st === 'b') {
      // bare winter branches
      for (let k = 0; k < 9; k++) {
        const a = rng.f(Math.PI * 1.05, Math.PI * 1.95), l = rng.f(14, 30) * sz;
        const s0 = this.P(0.5, 0.5, rng.f(1.5, 2.6) * sz);
        const e = [s0[0] + Math.cos(a) * l, s0[1] + Math.sin(a) * l * 0.9 - 8 * sz];
        line(g, s0, e, tr, rng.f(1.5, 2.5) * sz);
        for (let j = 0; j < 3; j++) { const q = rng.f(0.4, 1), b0 = [U.lerp(s0[0], e[0], q), U.lerp(s0[1], e[1], q)]; line(g, b0, [b0[0] + rng.f(-9, 9) * sz, b0[1] - rng.f(4, 10) * sz], tr, 1); }
        if (snow) { g.fillStyle = 'rgba(238,242,246,0.9)'; g.fillRect(e[0] - 3, e[1] - 1, 6, 2); }
      }
      return;
    }
    const cols = Season.leafCols(o.kind, st) || (o.kind === 'maple' ? ['#3a6a2a', '#447832', '#4e8438', '#2f5a24'] : o.kind === 'birch' ? ['#5a8a3a', '#6a9a44', '#4e7e34', '#76a650'] : ['#2e5626', '#36622c', '#3e6e32', '#284c22']);
    if (st === 's' || st === 'a') {
      // fallen leaves under the tree
      for (let k = 0; k < (st === 's' ? 26 : 12); k++) { const p = this.P(0.5 + rng.f(-0.9, 0.9), 0.5 + rng.f(-0.9, 0.9), 0); g.fillStyle = cols[k % 4]; g.fillRect(p[0], p[1], 3, 2); }
    }
    const nBlobs = st === 's' ? 6 : st === 'p' ? 9 : 13, rMul = st === 's' ? 0.7 : st === 'p' ? 0.8 : 1;
    if (st === 's') for (let k = 0; k < 5; k++) { const a = rng.f(Math.PI * 1.1, Math.PI * 1.9), l = rng.f(14, 26) * sz, s0 = this.P(0.5, 0.5, 2.0 * sz); line(g, s0, [s0[0] + Math.cos(a) * l, s0[1] + Math.sin(a) * l - 6], tr, 2 * sz); }
    for (let k = 0; k < nBlobs; k++) {
      const a = rng.f(0, Math.PI * 2), r = rng.f(0, 24) * sz;
      const x = cz[0] + Math.cos(a) * r * 1.2, y = cz[1] + Math.sin(a) * r * 0.7 - rng.f(0, 10) * sz;
      const rad = rng.f(13, 21) * sz * rMul;
      g.fillStyle = cols[k % 4];
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    for (let k = 0; k < 8; k++) {
      const a = rng.f(Math.PI * 1.1, Math.PI * 1.9), r = rng.f(10, 26) * sz;
      g.fillStyle = 'rgba(200,230,140,0.12)';
      g.beginPath(); g.arc(cz[0] + Math.cos(a) * r, cz[1] + Math.sin(a) * r * 0.6 - 8, rng.f(6, 11) * sz, 0, Math.PI * 2); g.fill();
    }
    if (st === 'p' && (o.kind === 'maple' || rng.chance(0.3))) for (let k = 0; k < 14; k++) { g.fillStyle = rng.chance(0.5) ? '#f4e8f0' : '#f0c8d8'; g.fillRect(cz[0] + rng.f(-24, 24) * sz, cz[1] + rng.f(-20, 10) * sz, 2, 2); }
    if (snow) for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(238,242,246,0.8)'; g.beginPath(); g.ellipse(cz[0] + rng.f(-18, 18) * sz, cz[1] - rng.f(8, 22) * sz, rng.f(6, 10) * sz, 3 * sz, 0, 0, 7); g.fill(); }
  },
  d_bush(o) {
    const g = this.g;
    const rng = new RNG((o.v || 0) * 37 + 11);
    const c = this.P(0.5, 0.5, 0.3);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(c[0] + 3, c[1] + 10, 18, 7, 0, 0, Math.PI * 2); g.fill();
    const st = Season.tree;
    const bc = st === 'b' ? null : Season.leafCols('oak', st === 'y' || st === 'a' || st === 's' ? st : 'g') || ['#2e5a26', '#3a6a2e', '#447634', '#2a5022'];
    if (!bc) {
      for (let k = 0; k < 12; k++) { const a = rng.f(Math.PI * 1.0, Math.PI * 2.0), l = rng.f(6, 14); line(g, [c[0], c[1] + 6], [c[0] + Math.cos(a) * l, c[1] + 6 + Math.sin(a) * l], '#5a4430', 1.2); }
    } else for (let k = 0; k < (st === 's' ? 4 : 7); k++) {
      g.fillStyle = bc[k % 4];
      g.beginPath(); g.arc(c[0] + rng.f(-12, 12), c[1] + rng.f(-6, 6), rng.f(7, 11), 0, Math.PI * 2); g.fill();
    }
    if (Season.snow > 0.3) for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(238,242,246,0.85)'; g.beginPath(); g.ellipse(c[0] + rng.f(-10, 10), c[1] - rng.f(2, 8), rng.f(5, 8), 2.5, 0, 0, 7); g.fill(); }
    if (o.berries) for (let k = 0; k < 8; k++) { g.fillStyle = '#5a1a6a'; g.fillRect(c[0] + rng.f(-12, 12), c[1] + rng.f(-8, 6), 2, 2); }
  },
  d_lamppost() {
    const g = this.g;
    const b = this.P(0.5, 0.5, 0), t = this.P(0.5, 0.5, 4.0);
    line(g, b, t, '#3a3e42', 3);
    line(g, t, this.P(0.5, 0.95, 4.0), '#3a3e42', 3);
    const h = this.P(0.5, 1.0, 3.95);
    poly(g, [[h[0] - 6, h[1] - 2], [h[0] + 6, h[1] - 2], [h[0] + 4, h[1] + 3], [h[0] - 4, h[1] + 3]], '#2a2e32');
    g.fillStyle = '#f0e8c0'; g.fillRect(h[0] - 3, h[1] + 2, 6, 2);
  },
  d_pump() {
    this.box(0.2, 0.3, 0, 0.8, 0.7, 0.15, '#9a9a9a');
    this.box(0.28, 0.36, 0.15, 0.72, 0.64, 1.55, '#d0d0d0');
    this.box(0.26, 0.34, 1.55, 0.74, 0.66, 1.65, '#c02020');
    this.faceRect('S', [0.28, 0.36, 0, 0.72, 0.64], 0.15, 0.85, 1.0, 1.35, '#2a3a2a');
    this.faceRect('E', [0.28, 0.36, 0, 0.72, 0.64], 0.2, 0.8, 0.4, 0.9, '#c02020');
  },
  d_bench(o) {
    const g = this.g;
    const along = o.dir === 'N' || o.dir === 'S';
    const b = along ? [0.05, 0.3, 0.95, 0.7] : [0.3, 0.05, 0.7, 0.95];
    for (const [u, v] of [[b[0] + 0.05, b[1] + 0.05], [b[2] - 0.05, b[1] + 0.05], [b[0] + 0.05, b[3] - 0.05], [b[2] - 0.05, b[3] - 0.05]]) line(g, this.P(u, v, 0), this.P(u, v, 0.42), '#303030', 2);
    this.box(b[0], b[1], 0.42, b[2], b[3], 0.48, '#8a6a42');
    const bk = { S: [b[0], b[1], b[2], b[1] + 0.06], N: [b[0], b[3] - 0.06, b[2], b[3]], E: [b[0], b[1], b[0] + 0.06, b[3]], W: [b[2] - 0.06, b[1], b[2], b[3]] }[o.dir];
    this.box(bk[0], bk[1], 0.55, bk[2], bk[3], 0.85, '#8a6a42');
  },
  d_pew(o) {
    const b = { S: [0.02, 0.25, 0.98, 0.75], N: [0.02, 0.25, 0.98, 0.75], E: [0.25, 0.02, 0.75, 0.98], W: [0.25, 0.02, 0.75, 0.98] }[o.dir];
    this.box(b[0], b[1], 0.35, b[2], b[3], 0.45, '#6a4428');
    const bk = { N: [b[0], b[3] - 0.08, b[2], b[3]], S: [b[0], b[1], b[2], b[1] + 0.08], E: [b[0], b[1], b[0] + 0.08, b[3]], W: [b[2] - 0.08, b[1], b[2], b[3]] }[o.dir];
    this.box(bk[0], bk[1], 0, bk[2], bk[3], 0.95, '#5a3820');
  },
  d_campfire(o) {
    const g = this.g;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; this.box(0.5 + Math.cos(a) * 0.3 - 0.06, 0.5 + Math.sin(a) * 0.3 - 0.06, 0, 0.5 + Math.cos(a) * 0.3 + 0.06, 0.5 + Math.sin(a) * 0.3 + 0.06, 0.1, '#7a7a78', false); }
    line(g, this.P(0.3, 0.4, 0.06), this.P(0.7, 0.6, 0.12), '#5a3a20', 4);
    line(g, this.P(0.4, 0.7, 0.06), this.P(0.6, 0.3, 0.12), '#4a3018', 4);
    if (!o.lit) { const c = this.P(0.5, 0.5, 0.05); g.fillStyle = '#2a2a2a'; g.beginPath(); g.ellipse(c[0], c[1], 7, 3.5, 0, 0, Math.PI * 2); g.fill(); }
  },
  d_bbq() {
    const g = this.g;
    for (const [u, v] of [[0.3, 0.3], [0.7, 0.3], [0.5, 0.7]]) line(g, this.P(u, v, 0), this.P(u, v, 0.6), '#202020', 2);
    this.box(0.22, 0.25, 0.6, 0.78, 0.75, 0.95, '#2a2a2a');
  },
  d_barrel(o) {
    const g = this.g;
    const c0 = this.P(0.5, 0.5, 0), c1 = this.P(0.5, 0.5, 1.05);
    g.fillStyle = '#2a5a8a'; g.fillRect(c0[0] - 13, c1[1], 26, c0[1] - c1[1]);
    g.beginPath(); g.ellipse(c0[0], c0[1], 13, 6.5, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#3a6a9a'; g.beginPath(); g.ellipse(c1[0], c1[1], 13, 6.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = (o.water || 0) > 0.05 ? '#4a8ab8' : '#1a2a3a'; g.beginPath(); g.ellipse(c1[0], c1[1], 10, 5, 0, 0, Math.PI * 2); g.fill();
    line(g, [c0[0] - 13, c0[1] - 10], [c0[0] + 13, c0[1] - 10], '#1a4a7a', 2);
    line(g, [c0[0] - 13, c1[1] + 8], [c0[0] + 13, c1[1] + 8], '#1a4a7a', 2);
  },
  d_generator() {
    this.box(0.15, 0.25, 0, 0.85, 0.75, 0.7, '#d0a020');
    this.box(0.25, 0.32, 0.7, 0.75, 0.68, 0.85, '#303030');
    line(this.g, this.P(0.15, 0.25, 0.75), this.P(0.85, 0.25, 0.75), '#202020', 2);
  },
  d_crop(o) {
    const g = this.g;
    const cd = CROPS[o.crop] || CROPS.carrot;
    if (!o.seed && o.stage === undefined) return;
    const st = o.stage || 0;
    if (st <= 0) { for (let k = 0; k < 4; k++) { const p = this.P(0.2 + k * 0.2, 0.5, 0); g.fillStyle = '#4a3a28'; g.fillRect(p[0] - 1, p[1] - 1, 3, 2); } return; }
    const leaf = o.dead ? '#7a6a3a' : cd.leaf;
    const h = [0, 0.15, 0.3, 0.45, 0.5][Math.min(4, st)];
    for (let k = 0; k < 6; k++) {
      const u = 0.2 + (k % 3) * 0.3, v = 0.3 + Math.floor(k / 3) * 0.4;
      const b = this.P(u, v, 0), t = this.P(u, v, h);
      line(g, b, [t[0] - 3, t[1]], leaf, 2); line(g, b, [t[0] + 3, t[1] - 1], leaf, 2); line(g, b, t, Col.mix(leaf, '#fff', 0.15), 2);
      if (st >= 4 && !o.dead) { g.fillStyle = cd.col; g.beginPath(); g.arc(t[0], t[1] + 3, 2.5, 0, Math.PI * 2); g.fill(); }
    }
  },
  d_hay(o) {
    if (o.sandbag) { this.box(0.05, 0.1, 0, 0.95, 0.9, 0.45, '#a89870'); this.box(0.1, 0.15, 0.45, 0.9, 0.85, 0.85, '#b0a078'); return; }
    this.box(0.08, 0.15, 0, 0.92, 0.85, 0.8, '#d8b858');
    for (const f of ['S', 'E']) { this.faceRect(f, [0.08, 0.15, 0, 0.92, 0.85], 0, 1, 0.25, 0.27, '#a08030'); this.faceRect(f, [0.08, 0.15, 0, 0.92, 0.85], 0, 1, 0.55, 0.57, '#a08030'); }
  },
  d_washer(o) {
    const b = this.inset(o.dir, 0.8, 0.08);
    this.box(b[0], b[1], 0, b[3], b[4], 0.95, '#ececea');
    const fr = this.front(o);
    if (fr) { const pts = this.facePts(fr, b, 0.25, 0.75, 0.2, 0.7); const cx = (pts[0][0] + pts[2][0]) / 2, cy = (pts[0][1] + pts[2][1]) / 2; this.g.fillStyle = '#4a5a6a'; this.g.beginPath(); this.g.ellipse(cx, cy, 7, 8, 0, 0, Math.PI * 2); this.g.fill(); }
  },
  d_car_wreck(o) {
    const along = o.dir === 'N' || o.dir === 'S';
    const b = along ? [0.15, -0.4, 0.85, 1.4] : [-0.4, 0.15, 1.4, 0.85];
    this.box(b[0], b[1], 0.15, b[2], b[3], 0.75, '#3a3430');
    const c = along ? [0.2, 0.0, 0.8, 0.9] : [0.0, 0.2, 0.9, 0.8];
    this.box(c[0], c[1], 0.75, c[2], c[3], 1.2, '#2a2420');
    this.box(c[0] + 0.05, c[1] + 0.05, 1.2, c[2] - 0.05, c[3] - 0.05, 1.22, '#4a3a30');
  },
  d_grave(o) {
    if ((o.v || 0) === 1) { this.box(0.42, 0.2, 0, 0.58, 0.8, 0.9, '#8a8a88'); this.box(0.42, 0.35, 0.55, 0.58, 0.65, 0.65, '#8a8a88'); }
    else this.box(0.3, 0.35, 0, 0.7, 0.55, 0.7, '#9a9894');
    poly(this.g, [this.P(0.25, 0.6, 0), this.P(0.75, 0.6, 0), this.P(0.75, 1.0, 0), this.P(0.25, 1.0, 0)], 'rgba(60,45,30,0.5)');
  },
  d_hydrant() {
    this.box(0.4, 0.4, 0, 0.6, 0.6, 0.55, '#c02020');
    this.box(0.36, 0.36, 0.55, 0.64, 0.64, 0.62, '#a01818');
  },
  d_lamp() {
    const g = this.g;
    const b = this.P(0.5, 0.5, 0), t = this.P(0.5, 0.5, 1.3);
    g.fillStyle = '#3a3a3a'; g.beginPath(); g.ellipse(b[0], b[1], 5, 2.5, 0, 0, Math.PI * 2); g.fill();
    line(g, b, t, '#3a3a3a', 2);
    poly(g, [[t[0] - 6, t[1] + 4], [t[0] + 6, t[1] + 4], [t[0] + 4, t[1] - 8], [t[0] - 4, t[1] - 8]], '#e8dcb0');
  },
  d_logwall() { this.box(0.05, 0.2, 0, 0.95, 0.8, 0.7, '#7a5a38'); },
  d_sign() { line(this.g, this.P(0.5, 0.5, 0), this.P(0.5, 0.5, 2.5), '#555', 3); this.box(0.2, 0.45, 1.8, 0.8, 0.55, 2.6, '#2a5a2a'); },
};

// ---------------------------------------------------------------------------
// Building exteriors: deterministic per-building facade styles, detailed wall faces
// (siding, trim, windows, doors, fixtures, store fronts), fences and cached roofs.
// Faces are painted in "s" space: s 0..1 runs left to right on screen along the wall,
// z is height, o is the distance out from the face toward the viewer.
// ---------------------------------------------------------------------------
const Facade = {
  bs: new WeakMap(), tick: 0, E: { k: '' }, NEUTRAL: { side: 'n', k: 'n' }, CHAR: '#3a322e',
  TRIM_L: ['#f4f1ea', '#ebe3d0', '#f6f5f0', '#e0d8c4', '#3b3a37', '#4c3b2c', '#2f4236', '#7a2e26', '#2c3a52', '#f4f1ea'],
  TRIM_D: ['#f4f1ea', '#ebe3d0', '#f6f5f0', '#d8d0bc'],
  SHUT: ['#2c3b2f', '#23272f', '#4b2521', '#2b3955', '#5b2b23', '#3b4b3a', '#e9e5db', '#6b5b41', '#3a5a6a'],
  AWN: [['#b42a24', '#f2eee6'], ['#2a5c3c', '#f2eee6'], ['#1f3c6c', '#ebe7df'], ['#d9a221', '#3b2b1b'], ['#6b2b5b', '#f2eaf2'], ['#2b6b7b', '#f5f1e9'], ['#a33b1b', '#ead9a1'], ['#3a3a3a', '#d8c070']],
  SIGN: [['#1e2a44', '#f0e6c8'], ['#5a1a16', '#f4ead0'], ['#f0ece0', '#2a2a2a'], ['#2a4a2a', '#f0e6c8'], ['#202020', '#e8c050'], ['#7a1e1a', '#f8f0d8']],
  METAL: ['#8f979b', '#7b8b7b', '#9b917b', '#7b8999', '#a1a5a7'],
  ACC: ['#7a5a3a', '#3a6a7a', '#8a3a2a', '#4a6a3a', '#5a5a6a'],
  GAR: ['#e6e4dc', '#d8d0bc', '#ebe9e2', '#8a6a4a', '#c8ccd0'],
  PLH: { conc: 0.18, stone: 0.3, brick: 0.14, skirt: 0.42, metal: 0.45 },
  hash(n) { n |= 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; },
  shash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; },
  luma(c) { const v = Col.rgb(c); return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11; },
  // colour c at brightness k with +-j random jitter, as an uncached rgb() string (per-brick / per-tab noise)
  jit(c, k, j, rng) { const v = Col.rgb(c), q = (rng.next() * 2 - 1) * j, f = (x) => Math.max(0, Math.min(255, x * k + q | 0)); return 'rgb(' + f(v[0]) + ',' + f(v[1]) + ',' + f(v[2]) + ')'; },

  // ------------------------------------------------------------ per-building style
  style(b) {
    let S = this.bs.get(b);
    if (S) return S;
    const r = new RNG(this.hash(b.id * 7919 + b.x0 * 131 + b.y0 * 977 + 17)), t = b.type || '';
    const house = t === 'house' || t === 'farmhouse', shed = /shed|barn|coop|outhouse|stable|hut/.test(t), flat = b.roof === 'flat';
    let mat;
    if (t === 'warehouse') mat = 'metal';
    else if (b.wallType === WT.BRICK) mat = 'brick';
    else if (t === 'cabin') mat = 'log';
    else if (shed) mat = 'batten';
    else if (t === 'trailer') mat = 'trailer';
    else if (t === 'church' || t === 'farmhouse') mat = 'clap';
    else if (t === 'motel' || t === 'gasstation') mat = 'stucco';
    else if (house || t === 'garage') mat = r.weighted([['clap', 5], ['vinyl', 4], ['stucco', 1.3], ['batten', 0.5]]);
    else mat = r.weighted([['stucco', 3], ['vinyl', 1.5], ['clap', 1]]);
    const col = mat === 'metal' ? r.pick(this.METAL) : (b.extCol || '#c8c0b0');
    const dark = this.luma(col) < 115;
    let trim;
    if (mat === 'brick') trim = r.pick(['#f2efe6', '#ebe3d0', '#e8e4dc', '#4c3b2c', '#3b3a37']);
    else if (mat === 'log') trim = r.pick(['#3a2a1c', '#2e3a2a', '#5a2a20']);
    else if (t === 'barn') trim = '#efece4';
    else if (mat === 'metal') trim = Col.mix(col, '#ffffff', 0.3);
    else if (mat === 'trailer') trim = '#e8eaea';
    else trim = r.pick(dark ? this.TRIM_D : this.TRIM_L);
    let shut = '';
    if (house && mat !== 'stucco' && r.chance(0.45)) { shut = r.pick(this.SHUT); if (Math.abs(this.luma(shut) - this.luma(col)) < 35) shut = this.luma(col) > 128 ? '#23272f' : '#e9e5db'; }
    const box = (house && r.chance(0.3)) || (t === 'cabin' && r.chance(0.4));
    const mun = t === 'farmhouse' || t === 'church' ? 2 : t === 'cabin' ? 1 : t === 'trailer' || t === 'motel' ? 3 : house ? r.weighted([[0, 3], [1, 2], [2, 2]]) : 0;
    const storm = house && r.chance(t === 'farmhouse' ? 0.5 : 0.35);
    const door = r.int(0, 3), porch = house && r.chance(0.4);
    let rf;
    if (flat) rf = t === 'trailer' || shed || t === 'garage' ? 'tin' : 'gravel';
    else if (t === 'barn' || shed) rf = 'metal';
    else if (t === 'cabin') rf = r.chance(0.55) ? 'shake' : 'metal';
    else if (t === 'church') rf = 'slate';
    else if (t === 'farmhouse') rf = r.chance(0.45) ? 'metal' : 'shingle';
    else rf = r.chance(0.06) ? 'metal' : 'shingle';
    const plinth = mat === 'brick' ? 'brick' : mat === 'metal' ? 'metal' : mat === 'trailer' ? 'skirt' : (mat === 'log' || t === 'barn' || t === 'farmhouse') ? 'stone' : 'conc';
    const gut = flat || mat === 'log' || shed ? '' : mat === 'brick' ? r.pick(['#e8e6e0', '#5a4636']) : r.pick(['#ecebe6', '#ecebe6', trim, '#6a5646']);
    const shop = !house && !shed && flat && t !== 'trailer';
    const awn = shop && !/police|school|firestation|warehouse|gasstation|clinic|bank/.test(t) && r.chance(0.72) ? r.pick(this.AWN) : null;
    const frame = r.pick(['#4a4036', '#a9adb1', '#2c2c2c']), sign = r.pick(this.SIGN), acc = r.pick(this.ACC);
    const gm = house && (mat === 'clap' || mat === 'vinyl') ? r.weighted([[mat, 5], ['scale', 1.6], ['batten', 1]]) : mat;
    let num = 0;
    if (house || t === 'cabin' || t === 'trailer') {
      const fr = b.front || 'S', along = fr === 'N' || fr === 'S' ? b.x0 : b.y0;
      num = 100 * (1 + Math.floor(along / 30)) + (Math.floor(along % 30) >> 1) * 2 + (fr === 'N' || fr === 'W' ? 1 : 0);
    }
    const chim = house ? r.chance(t === 'farmhouse' ? 1 : 0.85) : t === 'cabin' ? (r.chance(0.5) ? 'pipe' : true) : false;
    const ant = house && r.chance(0.32), dish = house && !ant && r.chance(0.08);
    S = { b, t, mat, col, trim, shut, box, mun, storm, door, porch, rf, plinth, gut, shop, awn, frame, sign, acc, gm, num, chim, ant, dish, flat, house,
      alongX: (b.x1 - b.x0) >= (b.y1 - b.y0), fix: null, lamp: undefined, rs: r.int(1, 1e6) };
    S.kw = mat + trim + (mat === 'metal' ? col : '') + (mat === 'trailer' ? acc : '') + (gut || '-') + plinth + (t === 'barn' ? 'B' : '');
    S.kwin = S.kw + (shut || '-') + (box ? 'x' : '') + mun;
    S.kdoor = S.kw + (storm ? 's' : '') + door + (porch ? 'p' + (b.roofCol || '') : '');
    S.kshop = S.kw + frame + (awn ? awn[0] : '-');
    this.bs.set(b, S);
    return S;
  },
  // interior finish of a room: w0-w2 wallpapers, b bath tiles, k kitchen splash, g block, l logs, r boards, p panelling, c wainscot, e two-tone
  inner(rm, b) {
    const t = rm.type, bt = b ? b.type : '';
    if (bt === 'cabin') return 'l';
    if (bt === 'barn' || /shed|coop|stable/.test(bt)) return 'r';
    if (t === 'garage') return 'g';
    if (t === 'bathroom') return 'b';
    if (t === 'kitchen') return 'k';
    if (bt === 'trailer') return 'p';
    if (bt === 'church') return 'c';
    if (bt === 'school' || bt === 'police' || bt === 'clinic' || bt === 'firestation') return 'e';
    if (bt === 'house' || bt === 'farmhouse' || bt === 'motel') { const h = this.hash(rm.id * 13 + 5) % 5; return h < 3 ? 'w' + h : ''; }
    return '';
  },
  // the door a porch lantern hangs beside: the front door, else the first plain exterior door of a home
  mainDoor(b) {
    if (b.frontDoor) return [b.frontDoor.ex, b.frontDoor.ey, b.frontDoor.ed];
    if (b.type !== 'cabin' && b.type !== 'trailer' && b.type !== 'house' && b.type !== 'farmhouse') return null;
    const ok = (f) => f && f.k === 'door' && f.ext && (f.style || 'wood') === 'wood';
    for (let x = b.x0; x <= b.x1; x++) for (const y of [b.y1 + 1, b.y0]) if (ok(World.feat(x, y, 0))) return [x, y, 0];
    for (let y = b.y0; y <= b.y1; y++) for (const x of [b.x1 + 1, b.x0]) if (ok(World.feat(x, y, 1))) return [x, y, 1];
    return null;
  },
  // porch lantern: on the plain wall beside the main door; x, y = where its light falls
  lampOf(b) {
    const S = this.style(b);
    if (S.lamp !== undefined) return S.lamp;
    S.lamp = null;
    const md = this.mainDoor(b);
    if (!md) return null;
    const [ex, ey, ed] = md;
    const outB = World.room(ex, ey) < 0, sg = outB ? 1 : -1;
    for (const k of (this.hash(b.id + 3) & 1) ? [1, -1] : [-1, 1]) {
      const nx = ed ? ex : ex + k, ny = ed ? ey + k : ey;
      if (!World.wall(nx, ny, ed) || World.feat(nx, ny, ed)) continue;
      const a = k < 0 ? 0.8 : 0.2;
      S.lamp = { ex: nx, ey: ny, ed, a, code: k < 0 ? 'L' : 'J', vis: outB, x: ed ? ex + sg * 0.45 : nx + a, y: ed ? ny + a : ey + sg * 0.45 };
      return S.lamp;
    }
    return null;
  },
  // all porch lanterns of the current world (for the light pass)
  lamps() {
    if (this.lw === Wd && this.lnb === Wd.buildings.length) return this.ll;
    this.lw = Wd; this.lnb = Wd.buildings.length; this.ll = [];
    for (const b of Wd.buildings) { const L = this.lampOf(b); if (L) this.ll.push({ x: L.x, y: L.y, b }); }
    return this.ll;
  },
  // wall fixtures on the facades the camera sees (south / east): lantern + house number, meter, tap, vent
  fixtures(b, S) {
    const fix = S.fix = new Map();
    const L = this.lampOf(b);
    if (L && L.vis) fix.set(World.ek(L.ex, L.ey, L.ed), L.code + (S.num || ''));
    if (S.t === 'barn' || S.t === 'trailer' || S.t === 'cabin' || /shed|coop/.test(S.t)) return;
    const r = new RNG(this.hash(b.id * 31 + 7)), cand = [];
    const ok = (x, y, d) => {
      const t = World.wall(x, y, d);
      if (!t || t === WT.INT || World.feat(x, y, d) || World.room(x, y) >= 0 || fix.has(World.ek(x, y, d))) return false;
      const rr = d ? World.room(x - 1, y) : World.room(x, y - 1);
      if (rr < 0 || Wd.rooms[rr].b !== b.id) return false;
      for (const k of [-1, 1]) {
        if (!(d ? World.wall(x, y + k, d) : World.wall(x + k, y, d))) return false;
        const f = d ? World.feat(x, y + k, d) : World.feat(x + k, y, d);
        if (f && f.k !== 'window') return false;
      }
      return true;
    };
    for (let x = b.x0; x <= b.x1; x++) if (ok(x, b.y1 + 1, 0)) cand.push([x, b.y1 + 1, 0]);
    for (let y = b.y0; y <= b.y1; y++) if (ok(b.x1 + 1, y, 1)) cand.push([b.x1 + 1, y, 1]);
    r.shuffle(cand);
    const put = (code) => { const c = cand.pop(); if (c) fix.set(World.ek(c[0], c[1], c[2]), code); };
    put('M');
    if (S.house) { if (r.chance(0.8)) put(r.chance(0.45) ? 'H' : 'T'); if (r.chance(0.4)) put('V'); }
  },
  // does the edge s-left (k=-1) / s-right (k=1) of (x,y,d) carry a feature matching fn?
  nb(x, y, d, k, fn) { const f = d ? World.feat(x, y - k, 1) : World.feat(x + k, y, 0); return !!f && fn(f); },

  // ------------------------------------------------------------ face descriptor for one wall edge
  // Returns a shared scratch record: read it right away, never keep it.
  edge(x, y, d, t, f, col) {
    const E = this.E;
    E.S = null; E.b = null; E.fx = ''; E.top = E.base = E.eave = E.eL = E.eR = E.front = E.nL = E.nR = E.ext = E.bl = false; E.awn = 0; E.pst = 0; E.it = ''; E.gc = '';
    if (WALL_INFO[t].fence) { E.side = 'f'; E.k = Season.snow > 0.3 ? 'fS' : 'f'; return E; }
    if (col === this.CHAR) { E.side = 'x'; E.k = 'x'; return E; }
    if (t === WT.BUILT) { E.side = 'n'; E.k = 'n'; return E; }
    const w = Wd, W_ = w.w, i = y * W_ + x;
    const ra = w.room[i], rb = (d ? x > 0 : y > 0) ? w.room[d ? i - 1 : i - W_] : -1;
    if (ra >= 0) {
      const rm = w.rooms[ra], A = d ? w.wallW : w.wallN;
      E.side = 'i'; E.it = this.inner(rm, w.buildings[rm.b]); E.ext = rb < 0;
      E.eL = d ? !A[i + W_] : !A[i - 1]; E.eR = d ? !A[i - W_] : !A[i + 1];
      E.k = 'i' + E.it + (E.ext ? 'x' : '') + (E.eL ? 'L' : '') + (E.eR ? 'R' : '');
      if (f && f.k === 'window' && !f.big && !f.curtains && this.hash(i * 5 + d) % 3 === 0) { E.bl = true; E.k += 'z'; }
      return E;
    }
    if (rb < 0) { E.side = 'n'; E.k = 'n'; return E; }
    const b = w.buildings[w.rooms[rb].b], S = this.style(b);
    if (!S.fix) this.fixtures(b, S);
    E.side = 'e'; E.S = S; E.b = b;
    const up = x >= LV.W0, A = d ? w.wallW : w.wallN, R = w.room, RM = w.rooms, id = b.id;
    const c = (ii, jj) => A[ii] !== 0 && R[ii] < 0 && R[jj] >= 0 && RM[R[jj]].b === id;
    E.eL = d ? !c(i + W_, i + W_ - 1) : !c(i - 1, i - 1 - W_);
    E.eR = d ? !c(i - W_, i - W_ - 1) : !c(i + 1, i + 1 - W_);
    E.top = up || !A[i + LV.W0];
    E.base = !up;
    E.eave = !S.flat && (S.alongX ? !d : !!d);
    let k = 'e' + S.kw + (E.eL ? 'L' : '') + (E.eR ? 'R' : '') + (E.top ? 't' : '') + (E.base ? 'b' : '') + (E.eave ? 'v' : '');
    const shopFront = S.shop && b.front === (d ? 'E' : 'S');
    const sf = (q) => (q.k === 'window' && q.big) || (q.k === 'door' && q.style === 'glass');
    if (!f) {
      const fx = S.fix.get((i << 1) | d);
      if (fx) { E.fx = fx; k += fx; }
    } else if (f.k === 'window') {
      k += S.kwin;
      if (f.big) {
        E.pst = this.nb(x, y, d, 1, (q) => q.k === 'door' && q.style === 'glass') ? 9 : this.hash(i * 3 + d) % 9;
        k += S.kshop + 'p' + E.pst;
        if (shopFront && S.awn) E.awn = 1 | (this.nb(x, y, d, -1, sf) ? 2 : 0) | (this.nb(x, y, d, 1, sf) ? 4 : 0);
      } else {
        if (S.box) k += Season.tree;
        // some windows without curtains have half-drawn blinds instead
        if (!f.curtains && this.hash(i * 5 + d) % 3 === 0) { E.bl = true; k += 'z'; }
      }
      if (Season.snow > 0.3) k += 'S';
    } else if (f.k === 'door') {
      const fd = b.frontDoor;
      E.front = !!fd && fd.ex === x && fd.ey === y && fd.ed === d;
      if (f.style === 'garage') {
        const gq = (q) => q.k === 'door' && q.style === 'garage';
        E.nL = this.nb(x, y, d, -1, gq); E.nR = this.nb(x, y, d, 1, gq);
        E.gc = S.t === 'firestation' ? '#b02a22' : S.t === 'barn' ? Col.mix(S.col, '#000000', 0.12) : S.house && (!f.col || f.col === '#d8d8d0') ? this.GAR[S.rs % 5] : '';
        k += 'G' + (E.nL ? 'l' : '') + (E.nR ? 'r' : '') + S.t.charAt(0) + E.gc;
      } else if (f.style === 'glass') {
        const gq = (q) => q.k === 'door' && q.style === 'glass';
        E.nL = this.nb(x, y, d, -1, gq); E.nR = this.nb(x, y, d, 1, gq);
        k += 'Q' + S.kshop + (E.nL ? 'l' : '') + (E.nR ? 'r' : '');
        if (shopFront && S.awn) E.awn = 1 | (this.nb(x, y, d, -1, sf) ? 2 : 0) | (this.nb(x, y, d, 1, sf) ? 4 : 0);
      } else k += E.front ? 'F' + S.kdoor + (Season.snow > 0.3 ? 'S' : '') : 'd';
    }
    if (E.awn) k += 'a' + E.awn;
    E.k = k;
    return E;
  },

  // ------------------------------------------------------------ wall face painter
  // drawing helpers bound to a face mapping P(s, z, o)
  ctx(g, P, d, fac, sideF, rng) {
    const C = { g, P, d, fac, sideF, rng };
    C.rect = (s0, s1, z0, z1, fill, o) => poly(g, [P(s0, z0, o), P(s1, z0, o), P(s1, z1, o), P(s0, z1, o)], fill);
    C.hl = (s0, s1, z, c, w, o) => line(g, P(s0, z, o), P(s1, z, o), c, w || 1);
    C.vl = (s, z0, z1, c, w, o) => line(g, P(s, z0, o), P(s, z1, o), c, w || 1);
    // box standing out of the face between depths o0..o1: front, top and the side the camera sees
    C.box = (s0, s1, z0, z1, o0, o1, c) => {
      const sv = d ? s0 : s1;
      poly(g, [P(sv, z0, o0), P(sv, z0, o1), P(sv, z1, o1), P(sv, z1, o0)], Col.shade(c, sideF));
      poly(g, [P(s0, z1, o0), P(s1, z1, o0), P(s1, z1, o1), P(s0, z1, o1)], Col.shade(c, 1));
      C.rect(s0, s1, z0, z1, Col.shade(c, fac), o1);
    };
    C.dot = (s, z, o, c, sz) => { const p = P(s, z, o), q = sz || 1; g.fillStyle = c; g.fillRect(p[0] - q / 2, p[1] - q / 2, q, q); };
    C.idT = () => g.setTransform(1, 0, 0, 1, 0, 0);
    return C;
  },
  paint(g, ax, ay, type, d, col, f, hz, cut, E, seed) {
    E = E || this.NEUTRAL;
    const fac = d ? FACE_E : FACE_S, sideF = d ? FACE_S : FACE_E;
    const P = d ? (s, z, o) => [ax - (1 - s) * HTW + (o || 0) * HTW, ay + (1 - s) * HTH - z * ZU + (o || 0) * HTH]
      : (s, z, o) => [ax + s * HTW - (o || 0) * HTW, ay + s * HTH - z * ZU + (o || 0) * HTH];
    const C = this.ctx(g, P, d, fac, sideF, new RNG(seed));
    Object.assign(C, { hz, col, E, type, cut });
    // face space for text / arcs: u = s * 32 to the right, v = -z * 32
    C.faceT = (o) => { o = o || 0; if (d) g.setTransform(1, -0.5, 0, 1, ax - HTW + o * HTW, ay + HTH + o * HTH); else g.setTransform(1, 0.5, 0, 1, ax - o * HTW, ay + o * HTH); };
    if (WALL_INFO[type].fence) { this.fence(C, type, E.k === 'fS'); return; }
    let op = null;
    if (f) {
      if (f.k === 'door' || f.k === 'doorway') {
        const gar = f.style === 'garage';
        op = { s0: gar ? 0.03 : 0.18, s1: gar ? 0.97 : 0.82, z0: 0, z1: gar ? 1.9 : 2.0 };
        if (f.k === 'door' && (gar || f.style === 'glass')) { if (E.nL) op.s0 = 0; if (E.nR) op.s1 = 1; }
      } else if (f.k === 'window' && !cut) op = f.big ? { s0: 0.05, s1: 0.95, z0: 0.3, z1: 2.1 } : { s0: 0.22, s1: 0.78, z0: 0.95, z1: 2.0 };
    }
    if (cut && op) {
      // low cut-away wall beside a doorway
      this.body(C, 0, op.s0); this.body(C, op.s1, 1);
      this.cap(C, hz, 0, op.s0); this.cap(C, hz, op.s1, 1);
      return;
    }
    this.body(C, 0, 1);
    if (!cut && E.side === 'e') this.trims(C);
    this.cap(C, hz, 0, 1);
    if (op) {
      g.save(); g.globalCompositeOperation = 'destination-out';
      C.rect(op.s0, op.s1, op.z0, op.z1, '#000');
      g.restore();
      this.reveal(C, op);
      if (f.k === 'doorway') this.doorway(C, op);
      else if (f.k === 'door') this.door(C, f, op);
      else this.window(C, f, op);
      if (f.barricade) this.planks(C, f, op);
    }
    if (!cut && E.side === 'e') { if (E.fx) this.fixture(C, E.fx); if (E.awn) this.awning(C, E.awn); }
  },
  cap(C, z, s0, s1) {
    const E = C.E, c = E.side === 'e' ? E.S.col : C.col, fl = E.side === 'e' || E.side === 'i';
    if (s0 === 0 && !(fl && E.eL)) s0 = -0.02;
    if (s1 === 1 && !(fl && E.eR)) s1 = 1.02;
    poly(C.g, [C.P(s0, z), C.P(s1, z), C.P(s1, z, -0.11), C.P(s0, z, -0.11)], Col.shade(c, 1.08));
  },
  // the visible inside of an opening: one jamb and the sill
  reveal(C, op) {
    const E = C.E, P = C.P;
    const jc = E.side === 'e' ? (/clap|vinyl|batten|trailer|log/.test(E.S.mat) ? E.S.trim : E.S.col) : C.col;
    const sj = C.d ? op.s1 : op.s0;
    poly(C.g, [P(sj, op.z0), P(sj, op.z1), P(sj, op.z1, -0.11), P(sj, op.z0, -0.11)], Col.shade(jc, C.fac * 0.62));
    if (op.z0 > 0.05) poly(C.g, [P(op.s0, op.z0), P(op.s1, op.z0), P(op.s1, op.z0, -0.11), P(op.s0, op.z0, -0.11)], Col.shade(jc, 0.92));
    C.rect(op.s0, op.s1, op.z1 - 0.07, op.z1, 'rgba(0,0,0,0.18)', -0.11);
  },
  body(C, s0, s1) {
    if (s1 - s0 < 0.001) return;
    const E = C.E, hz = C.hz;
    // texture runs a hair into the next segment of the same wall: hides antialiased seams between sprites
    const fl = E.side === 'e' || E.side === 'i';
    if (s0 === 0 && !(fl && E.eL)) s0 = -0.02;
    if (s1 === 1 && !(fl && E.eR)) s1 = 1.02;
    // a partition's south end is drawn after the facade segment it butts against: keep its edge off it
    if (E.side === 'i' && C.d && E.eL && s0 === 0) s0 = 0.018;
    if (E.side === 'e') {
      const S = E.S, z0 = E.base ? Math.min(hz, this.PLH[S.plinth]) : 0;
      if (E.base) this.plinth(C, S, s0, s1, z0);
      if (hz > z0) this.mat(C, S.mat, S.col, s0, s1, z0, hz);
    } else if (E.side === 'i') this.inside(C, s0, s1);
    else if (E.side === 'x') this.charred(C, s0, s1);
    else this.legacy(C, s0, s1);
  },
  // siding / masonry texture over s0..s1 x z0..z1
  mat(C, m, col, s0, s1, z0, z1) {
    const { g, P, rect, hl, vl, rng, fac } = C;
    rect(s0, s1, z0, z1, Col.shade(col, fac));
    if (m === 'clap' || m === 'vinyl') {
      const bh = m === 'clap' ? 0.2 : 0.155;
      const dk = Col.shade(col, fac * (m === 'clap' ? 0.72 : 0.8)), lt = Col.shade(col, Math.min(1.3, fac * 1.08));
      for (let z = z0 + bh; z < z1 - 0.02; z += bh) {
        if (m === 'clap' && rng.chance(0.3)) rect(s0, s1, z - bh, z, rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
        hl(s0, s1, z, dk); hl(s0, s1, z + 0.035, lt);
        if (m === 'vinyl') { g.globalAlpha = 0.45; hl(s0, s1, z - bh * 0.5, dk); g.globalAlpha = 1; }
        else if (rng.chance(0.22)) vl(rng.f(s0 + 0.06, Math.max(s0 + 0.07, s1 - 0.06)), z - bh + 0.03, z, dk);
      }
    } else if (m === 'batten') {
      const dk = Col.shade(col, fac * 0.68), lt = Col.shade(col, Math.min(1.3, fac * 1.12));
      for (let k = 0; k < 8; k++) { const a = k / 8; if (a + 0.125 <= s0 || a >= s1 || !rng.chance(0.45)) continue; rect(Math.max(s0, a), Math.min(s1, a + 0.125), z0, z1, rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'); }
      for (let k = 0; k < 4; k++) { const s = k / 4 + 0.125; if (s < s0 + 0.02 || s > s1 - 0.02) continue; rect(s - 0.022, s + 0.022, z0, z1, lt); vl(s + 0.025, z0, z1, dk); }
      for (let k = 0; k < 3; k++) { const s = rng.f(s0, s1); vl(s, z1 - rng.f(0.4, 1.4), z1, 'rgba(0,0,0,0.08)'); }
    } else if (m === 'brick') {
      const mc = Col.shade(Col.mix(col, '#d6cfc2', 0.55), fac);
      rect(s0, s1, z0, z1, mc);
      let r = 0;
      for (let z = z0; z < z1 - 0.01; z += 0.1, r++) {
        const zt = Math.min(z1, z + 0.078), off = (r & 1) ? 0.125 : 0;
        for (let s = -off; s < s1; s += 0.25) {
          const a = Math.max(s0, s + 0.012), e = Math.min(s1, s + 0.238);
          if (e <= a) continue;
          poly(g, [P(a, z), P(e, z), P(e, zt), P(a, zt)], this.jit(col, fac * (rng.chance(0.12) ? 0.84 : 1), 10, rng));
        }
      }
    } else if (m === 'stucco') {
      const n = Math.round((s1 - s0) * (z1 - z0) * 110);
      for (let k = 0; k < n; k++) C.dot(rng.f(s0, s1), rng.f(z0, z1), 0, rng.chance(0.5) ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)', 1);
      for (let k = 0; k < 3; k++) { const z = rng.f(z0, z1 - 0.3); rect(s0, s1, z, z + rng.f(0.08, 0.3), 'rgba(255,255,255,0.035)'); }
      if (z0 < 0.5) rect(s0, s1, z0, z0 + 0.2, 'rgba(70,50,30,0.08)');
    } else if (m === 'log') {
      const chink = Col.shade('#cbbfa3', fac);
      for (let z = z0; z < z1 - 0.02; z += 0.27) {
        const zt = Math.min(z1, z + 0.27);
        rect(s0, s1, z, zt, this.jit(col, fac, 9, rng));
        hl(s0, s1, zt - 0.05, Col.shade(col, Math.min(1.3, fac * 1.22)), 1);
        hl(s0, s1, z + 0.045, Col.shade(col, fac * 0.66), 1.5);
        hl(s0, s1, z + 0.006, chink, 1);
        for (let k = 0; k < 3; k++) { const s = rng.f(s0, Math.max(s0, s1 - 0.12)), zz = rng.f(z + 0.08, zt - 0.06); hl(s, Math.min(s1, s + rng.f(0.04, 0.12)), zz, Col.shade(col, fac * 0.8), 1); }
      }
    } else if (m === 'metal') {
      const lt = Col.shade(col, Math.min(1.3, fac * 1.18)), dk = Col.shade(col, fac * 0.74);
      for (let s = Math.ceil(s0 * 16) / 16; s < s1 - 0.01; s += 1 / 16) { vl(s, z0, z1, lt); vl(s + 0.024, z0, z1, dk); }
      const zs = z0 + (z1 - z0) * 0.52;
      hl(s0, s1, zs, dk);
      for (let s = s0 + 0.06; s < s1; s += 0.125) C.dot(s, zs + 0.035, 0, 'rgba(30,30,30,0.5)', 1);
      if (rng.chance(0.6)) { const s = rng.f(s0, s1 - 0.03); rect(s, s + 0.025, z1 - rng.f(0.5, 1.3), z1 - 0.04, 'rgba(130,64,30,0.2)'); }
    } else if (m === 'trailer') {
      const lt = Col.shade(col, Math.min(1.3, fac * 1.1)), dk = Col.shade(col, fac * 0.8);
      for (let s = Math.floor(s0 * 8) / 8 + 0.0625; s < s1; s += 0.125) { if (s < s0) continue; vl(s, z0, z1, lt); vl(s + 0.03, z0, z1, dk); }
      const S = C.E.S, za = 1.3;
      if (S && za > z0 && za + 0.16 < z1) { rect(s0, s1, za, za + 0.16, Col.shade(S.acc, fac)); hl(s0, s1, za + 0.16, Col.shade('#ffffff', fac * 0.9), 1); hl(s0, s1, za, Col.shade(S.acc, fac * 0.7), 1); }
    } else if (m === 'scale') {
      // fish-scale shingles (gable accents)
      g.save(); C.faceT(0); g.strokeStyle = Col.shade(col, fac * 0.7); g.lineWidth = 0.8;
      const u0 = s0 * 32 - 5, u1 = s1 * 32 + 5;
      let row = 0;
      for (let v = -z0 * 32; v > -z1 * 32; v -= 4, row++) {
        g.beginPath();
        for (let u = u0 - (row & 1 ? 2.25 : 0); u < u1; u += 4.5) { g.moveTo(u + 4.5, v); g.arc(u + 2.25, v, 2.25, 0, Math.PI); }
        g.stroke();
      }
      g.restore();
    }
  },
  plinth(C, S, s0, s1, z0) {
    const { g, rect, hl, rng, fac } = C;
    if (S.plinth === 'skirt') {
      rect(s0, s1, 0, z0, Col.shade('#4a4640', fac));
      g.save(); poly(g, [C.P(s0, 0), C.P(s1, 0), C.P(s1, z0), C.P(s0, z0)]); g.clip();
      C.faceT(0); g.strokeStyle = Col.shade('#d8d4c8', fac); g.lineWidth = 1.5; g.beginPath();
      const h = z0 * 32;
      for (let u = s0 * 32 - h; u < s1 * 32 + h; u += 4.5) { g.moveTo(u, 0); g.lineTo(u + h, -h); g.moveTo(u + h, 0); g.lineTo(u, -h); }
      g.stroke(); g.restore();
      hl(s0, s1, z0, Col.shade('#e8e4d8', fac), 1.5);
      return;
    }
    if (S.plinth === 'brick') { this.mat(C, 'brick', Col.mix(S.col, '#2a1e1a', 0.22), s0, s1, 0, z0); C.box(s0, s1, z0 - 0.035, z0, 0, 0.03, '#b8b2a6'); return; }
    const pc = S.plinth === 'stone' ? '#8e8a80' : S.plinth === 'metal' ? '#a09c92' : '#a6a298';
    rect(s0, s1, 0, z0, Col.shade(pc, fac));
    if (S.plinth === 'stone') {
      for (let k = 0; k < 9; k++) { const a = rng.f(s0, Math.max(s0, s1 - 0.1)), z = rng.f(0.01, Math.max(0.02, z0 - 0.11)); rect(a, Math.min(s1, a + rng.f(0.07, 0.17)), z, Math.min(z0 - 0.015, z + rng.f(0.06, 0.12)), this.jit(pc, fac, 16, rng)); }
    } else for (let k = 0; k < Math.round((s1 - s0) * 30); k++) C.dot(rng.f(s0, s1), rng.f(0, z0), 0, rng.chance(0.5) ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', 1);
    hl(s0, s1, z0, Col.shade(pc, Math.min(1.3, fac * 1.3)), 1);
  },
  inside(C, s0, s1) {
    const { g, rect, hl, vl, rng, fac, hz, col } = C, it = C.E.it || '', c0 = it.charAt(0);
    if (c0 === 'l') { this.mat(C, 'log', '#8a6a48', s0, s1, 0, hz); return; }
    if (c0 === 'r') { this.mat(C, 'batten', '#7a6044', s0, s1, 0, hz); return; }
    if (c0 === 'g') {
      const bc = '#a8a49a';
      rect(s0, s1, 0, hz, Col.shade(bc, fac));
      for (let z = 0.2, r = 0; z < hz; z += 0.2, r++) { hl(s0, s1, z, Col.shade(bc, fac * 0.78)); for (let s = (r & 1) ? 0.2 : 0; s < 1; s += 0.4) if (s > s0 && s < s1) vl(s, z - 0.2, z, Col.shade(bc, fac * 0.78)); }
      return;
    }
    rect(s0, s1, 0, hz, Col.shade(col, fac));
    if (c0 === 'w') {
      const v = it.charAt(1);
      if (v === '0') { for (let s = 0.025; s < 1; s += 0.1) if (s > s0 && s < s1) rect(s, Math.min(s1, s + 0.045), 0.1, hz, 'rgba(255,255,255,0.08)'); }
      else if (v === '1') { for (let z = 0.25; z < hz; z += 0.16) for (let s = ((z * 10 | 0) & 1) ? 0.06 : 0.12; s < 1; s += 0.12) if (s > s0 && s < s1) C.dot(s, z, 0, Col.shade(col, fac * 0.8), 1.5); }
      else { rect(s0, s1, 0.1, 0.9, Col.shade(Col.mix(col, '#5a4636', 0.28), fac)); hl(s0, s1, 0.9, Col.shade('#f0ece4', fac), 2); }
    } else if (c0 === 'b') {
      const tc = '#e6eaea';
      rect(s0, s1, 0, 1.2, Col.shade(tc, fac));
      for (let z = 0.15; z < 1.2; z += 0.15) hl(s0, s1, z, Col.shade(tc, fac * 0.86));
      for (let s = 0.125; s < 1; s += 0.125) if (s > s0 && s < s1) vl(s, 0, 1.2, Col.shade(tc, fac * 0.86));
      C.box(s0, s1, 1.2, 1.25, 0, 0.02, '#d8dcdc');
    } else if (c0 === 'k') {
      const tc = Col.mix(col, '#ffffff', 0.55);
      rect(s0, s1, 0.92, 1.45, Col.shade(tc, fac));
      for (let z = 0.92; z < 1.45; z += 0.09) hl(s0, s1, z, Col.shade(tc, fac * 0.84));
      for (let s = 0.0625, r = 0; s < 1; s += 0.125, r++) if (s > s0 && s < s1) vl(s, 0.92, 1.45, Col.shade(tc, fac * 0.88));
    } else if (c0 === 'p') {
      rect(s0, s1, 0, hz, 'rgba(110,70,30,0.22)');
      for (let s = 0.0625; s < 1; s += 0.125) if (s > s0 && s < s1) vl(s, 0, hz, Col.shade(col, fac * 0.62));
    } else if (c0 === 'c') {
      const wc = '#7a5634';
      rect(s0, s1, 0, 1.0, Col.shade(wc, fac));
      for (let s = 0.03; s < 1; s += 0.25) if (s + 0.19 > s0 && s < s1) { rect(Math.max(s0, s + 0.02), Math.min(s1, s + 0.21), 0.16, 0.86, Col.shade(wc, fac * 0.86)); }
      C.box(s0, s1, 0.98, 1.04, 0, 0.03, '#6a4a2c');
    } else if (c0 === 'e') {
      rect(s0, s1, 0, 1.05, Col.shade(Col.mix(col, '#2a3a4a', 0.32), fac));
      hl(s0, s1, 1.05, Col.shade('#d8d4c8', fac), 2);
    }
    if (c0 !== 'b') { rect(s0, s1, 0, 0.1, Col.shade(c0 === 'p' || c0 === 'c' ? '#5a4030' : '#ece6da', fac)); hl(s0, s1, 0.1, Col.shade('#ffffff', fac * 0.85)); }
    hl(s0, s1, hz - 0.035, Col.shade(col, Math.min(1.3, fac * 1.18)), 1.5);
  },
  charred(C, s0, s1) {
    const { rect, hl, rng, fac, hz } = C;
    rect(s0, s1, 0, hz, Col.shade(this.CHAR, fac));
    for (let z = 0.2; z < hz; z += 0.2) hl(s0, s1, z + rng.f(-0.02, 0.02), 'rgba(8,6,5,0.6)');
    for (let k = 0; k < 5; k++) { const s = rng.f(s0, Math.max(s0, s1 - 0.2)), z = rng.f(0, hz - 0.4); rect(s, Math.min(s1, s + rng.f(0.1, 0.3)), z, z + rng.f(0.2, 0.6), 'rgba(0,0,0,0.3)'); }
    for (let k = 0; k < 12; k++) C.dot(rng.f(s0, s1), rng.f(0, hz), 0, rng.chance(0.25) ? 'rgba(140,60,20,0.55)' : 'rgba(110,100,92,0.5)', 1.5);
    rect(s0, s1, hz * 0.6, hz, 'rgba(0,0,0,0.22)');
  },
  // walls with no building context (player built walls, build ghost, unknown)
  legacy(C, s0, s1) {
    const { type, col, hz, fac, rng } = C;
    if (type === WT.BUILT) {
      for (let z = 0, k = 0; z < hz - 0.01; z += 0.2, k++) {
        C.rect(s0, s1, z, Math.min(hz, z + 0.2), this.jit(col, fac * (k & 1 ? 0.94 : 1.02), 8, rng));
        C.hl(s0, s1, z, Col.shade(col, fac * 0.6));
        for (const s of [0.07, 0.93]) if (s > s0 && s < s1) C.dot(s, z + 0.1, 0.01, '#3a3a3a', 1.5);
      }
      for (const s of [0.035, 0.965]) if (s > s0 && s < s1) C.box(s - 0.035, s + 0.035, 0, hz, 0, 0.04, '#7a5a38');
    } else if (type === WT.BRICK) this.mat(C, 'brick', col, s0, s1, 0, hz);
    else if (type === WT.EXT) this.mat(C, 'clap', col, s0, s1, 0, hz);
    else { C.rect(s0, s1, 0, hz, Col.shade(col, fac)); C.rect(s0, s1, 0, 0.12, Col.shade(Col.mix(col, '#3a2a1a', 0.5), fac)); }
  },
  // trim on exterior faces: eave shade, frieze / belt / cornice, corner boards or log ends, downspouts
  trims(C) {
    const { g, P, rect, hl, vl, box, fac, rng, hz, d } = C, E = C.E, S = E.S;
    const z0 = E.base ? Math.min(hz, this.PLH[S.plinth]) : 0;
    const wood = S.mat === 'clap' || S.mat === 'vinyl' || S.mat === 'batten' || S.mat === 'trailer';
    const a0 = E.eL ? 0 : -0.02, a1 = E.eR ? 1 : 1.02; // horizontal bands carry on into the next segment
    if (E.top && E.eave) {
      // shade under the eaves (gradient built in face space so it follows the wall, not the screen)
      g.save(); C.faceT(0);
      const gr = g.createLinearGradient(0, -hz * 32, 0, -(hz - 0.5) * 32);
      gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(a0 * 32, -hz * 32, (a1 - a0) * 32, 16);
      g.restore();
    }
    if (wood) {
      const fz = E.top ? 0.15 : 0.1;
      rect(a0, a1, hz - fz, hz, Col.shade(S.trim, fac)); hl(a0, a1, hz - fz, Col.shade(S.trim, fac * 0.68));
    } else if (S.mat === 'brick') {
      if (E.top && !S.flat) { rect(a0, a1, hz - 0.13, hz, Col.shade(S.trim, fac)); hl(a0, a1, hz - 0.13, Col.shade(S.trim, fac * 0.68)); }
      else {
        const zb = hz - (S.flat && E.top ? 0.36 : 0.22), zt = zb + 0.17, hc = Col.mix(S.col, '#2a1e1a', 0.12);
        rect(a0, a1, zb, zt, Col.shade(Col.mix(S.col, '#d6cfc2', 0.55), fac));
        for (let s = 0; s < 1; s += 1 / 18) poly(g, [P(s + 0.004, zb + 0.012), P(s + 1 / 18 - 0.004, zb + 0.012), P(s + 1 / 18 - 0.004, zt - 0.012), P(s + 0.004, zt - 0.012)], this.jit(hc, fac, 10, rng));
        if (S.flat && E.top) box(a0, a1, hz - 0.12, hz - 0.03, 0, 0.05, '#bab4a8');
      }
    } else if (S.mat === 'stucco') {
      if (E.top && S.flat) box(a0, a1, hz - 0.22, hz - 0.09, 0, 0.05, Col.mix(S.col, '#ffffff', 0.3));
      else if (!E.top) hl(a0, a1, hz - 0.05, Col.shade(S.col, fac * 0.85), 1.5);
    } else if (S.mat === 'metal') rect(a0, a1, hz - 0.09, hz, Col.shade(S.trim, fac));
    if (wood) {
      const cw = S.mat === 'trailer' ? 0.035 : 0.06;
      if (E.eL) { rect(0, cw, z0, hz, Col.shade(S.trim, fac)); vl(cw, z0, hz, Col.shade(S.trim, fac * 0.66)); }
      if (E.eR) { rect(1 - cw, 1, z0, hz, Col.shade(S.trim, fac)); vl(1 - cw, z0, hz, Col.shade(S.trim, fac * 0.66)); }
    } else if (S.mat === 'log') {
      for (let z = z0; z < hz - 0.05; z += 0.27) {
        if (E.eL) { rect(-0.13, 0.002, z + 0.01, z + 0.26, Col.shade(S.col, fac * 0.94)); hl(-0.13, 0, z + 0.22, Col.shade(S.col, Math.min(1.3, fac * 1.2))); if (d) this.logEnd(C, -0.13, z + 0.135, 0.125, S.col); }
        if (E.eR) { rect(0.998, 1.13, z + 0.01, z + 0.26, Col.shade(S.col, fac * 0.94)); hl(1, 1.13, z + 0.22, Col.shade(S.col, Math.min(1.3, fac * 1.2))); if (!d) this.logEnd(C, 1.13, z + 0.135, 0.125, S.col); }
      }
    } else {
      if (E.eL) vl(0.006, z0, hz, Col.shade(S.col, Math.min(1.3, fac * 1.16)));
      if (E.eR) vl(0.994, z0, hz, Col.shade(S.col, fac * 0.78));
    }
    if (E.eave && S.gut) { if (E.eL) this.spout(C, 0.1); if (E.eR) this.spout(C, 0.9); }
  },
  logEnd(C, s, zc, r, col) {
    const a = [], b = [];
    for (let k = 0; k < 14; k++) { const t = k / 14 * Math.PI * 2; a.push(C.P(s, zc + Math.sin(t) * r, -0.05 + Math.cos(t) * r)); b.push(C.P(s, zc + Math.sin(t) * r * 0.55, -0.05 + Math.cos(t) * r * 0.55)); }
    poly(C.g, a, Col.shade('#b8935f', C.sideF), Col.shade(col, 0.5), 1);
    poly(C.g, b, null, Col.shade('#8a6a40', C.sideF), 0.7);
  },
  // downspout from the gutter to a splash block
  spout(C, s) {
    const { g, P, rect, hl, vl, box, fac, sideF, hz, d } = C, E = C.E, gc = E.S.gut, o = 0.05;
    const zb = E.base ? 0.22 : 0;
    rect(s - 0.022, s + 0.022, zb, hz, Col.shade(gc, fac), o);
    vl(d ? s - 0.02 : s + 0.02, zb, hz, Col.shade(gc, sideF * 0.85), 1, o);
    for (let z = zb + 0.55; z < hz - 0.2; z += 0.8) hl(s - 0.032, s + 0.032, z, Col.shade(gc, fac * 0.68), 1, o + 0.004);
    if (E.base) {
      poly(g, [P(s - 0.022, 0.26, o), P(s + 0.022, 0.26, o), P(s + 0.022, 0.07, 0.25), P(s - 0.022, 0.07, 0.25)], Col.shade(gc, 0.95));
      box(s - 0.065, s + 0.065, 0, 0.035, 0.16, 0.42, '#a8a49c');
    }
    if (E.top) poly(g, [P(s - 0.022, hz - 0.14, o), P(s + 0.022, hz - 0.14, o), P(s + 0.022, hz + 0.02, 0.2), P(s - 0.022, hz + 0.02, 0.2)], Col.shade(gc, 1));
  },
  // lantern + house number, electric meter, tap / hose reel, dryer vent
  fixture(C, code) {
    const { g, P, rect, hl, vl, box, fac, d } = C, c0 = code.charAt(0);
    if (c0 === 'L' || c0 === 'J') {
      const a = c0 === 'L' ? 0.8 : 0.2, s = d ? 1 - a : a;
      box(s - 0.035, s + 0.035, 1.6, 1.8, 0, 0.025, '#2a2a2a');
      poly(g, [P(s - 0.012, 1.7, 0.025), P(s + 0.012, 1.7, 0.025), P(s + 0.012, 1.72, 0.09), P(s - 0.012, 1.72, 0.09)], '#2a2a2a');
      box(s - 0.05, s + 0.05, 1.66, 1.9, 0.05, 0.15, '#2b2d2f');
      rect(s - 0.037, s + 0.037, 1.69, 1.87, '#cdb882', 0.151);
      vl(s, 1.69, 1.87, 'rgba(30,30,30,0.85)', 1, 0.152);
      poly(g, [P(s - 0.065, 1.9, 0.04), P(s + 0.065, 1.9, 0.04), P(s + 0.065, 1.9, 0.16), P(s, 1.99, 0.1), P(s - 0.065, 1.9, 0.16)], '#1e2022');
      const num = code.slice(1);
      if (num) {
        const zc = 1.36, w = 0.05 + num.length * 0.045;
        box(s - w, s + w, zc - 0.075, zc + 0.075, 0, 0.015, '#2e2a26');
        g.save(); C.faceT(0.016); g.fillStyle = '#e2cf8e'; g.font = 'bold 6px Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(num, s * 32, -zc * 32 + 0.5); g.restore();
      }
    } else if (c0 === 'M') {
      const s = 0.5;
      vl(s, 0.2, 1.1, Col.shade('#6e7274', fac), 2, 0.03);
      vl(s, 1.56, C.hz - 0.2, Col.shade('#6e7274', fac), 2, 0.03);
      box(s - 0.085, s + 0.085, 1.1, 1.56, 0, 0.07, '#9ca0a0');
      const p = P(s, 1.33, 0.072);
      g.fillStyle = '#e4ecef'; g.beginPath(); g.ellipse(p[0], p[1], 2.6, 2.6, 0, 0, 7); g.fill();
      g.strokeStyle = '#3e4244'; g.lineWidth = 0.7; g.stroke();
    } else if (c0 === 'T' || c0 === 'H') {
      const s = 0.4;
      box(s - 0.02, s + 0.02, 0.38, 0.45, 0, 0.07, '#a8843c');
      C.dot(s, 0.49, 0.06, '#b03424', 2.5);
      if (c0 === 'H') {
        // garden hose coiled on a reel, running down to the tap and onto the ground
        const hc = Col.shade('#2f6a2a', fac), u = (s + 0.24) * 32, v = -0.58 * 32;
        box(s + 0.19, s + 0.29, 0.5, 0.78, 0, 0.05, '#5a5048');
        g.save(); C.faceT(0.08); g.fillStyle = hc; g.beginPath(); g.ellipse(u, v, 5.2, 4.2, 0, 0, 7); g.fill();
        g.strokeStyle = Col.shade('#1e4a1c', fac); g.lineWidth = 0.8;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(u, v, 4.8 - k * 1.3, 3.8 - k * 1.1, 0, 0, 7); g.stroke(); }
        g.fillStyle = '#3a342e'; g.beginPath(); g.ellipse(u, v, 1.4, 1.2, 0, 0, 7); g.fill();
        g.restore();
        C.vl(s + 0.17, 0.12, 0.44, hc, 1.4, 0.07); C.hl(s + 0.02, s + 0.17, 0.43, hc, 1.4, 0.07);
      }
    } else if (c0 === 'V') {
      const s = 0.62;
      box(s - 0.06, s + 0.06, 0.58, 0.7, 0, 0.05, '#e4e2dc');
      for (let z = 0.6; z < 0.69; z += 0.03) hl(s - 0.05, s + 0.05, z, Col.shade('#8a8880', fac), 1, 0.052);
      rect(s - 0.05, s + 0.05, 0.36, 0.58, 'rgba(70,60,50,0.1)', 0.002);
    }
  },
  // striped canvas awning over a store front. bits: 1 on, 2 continues left, 4 continues right
  awning(C, bits) {
    const { g, P, rect, fac, sideF, d } = C, S = C.E.S, [c1, c2] = S.awn;
    const zt = 2.2, zb = 1.92, ob = 0.52, vz = 0.13;
    const s0 = bits & 2 ? 0 : 0.03, s1 = bits & 4 ? 1 : 0.97;
    rect(s0, s1, zb - 0.45, zt, 'rgba(0,0,0,0.16)', 0.004);
    for (let k = 0; k < 6; k++) {
      const a = Math.max(s0, k / 6), b = Math.min(s1, (k + 1) / 6);
      if (b <= a) continue;
      const c = k & 1 ? c2 : c1;
      poly(g, [P(a, zt, 0), P(b, zt, 0), P(b, zb, ob), P(a, zb, ob)], Col.shade(c, 0.94));
      poly(g, [P(a, zb, ob), P(b, zb, ob), P(b, zb - vz, ob), P(a, zb - vz, ob)], Col.shade(c, fac));
    }
    // scalloped hem
    g.save(); C.faceT(ob);
    for (let k = 0; k < 12; k++) {
      const u = (k + 0.5) / 12;
      if (u < s0 || u > s1) continue;
      g.fillStyle = Col.shade((k >> 1) & 1 ? c2 : c1, fac);
      g.beginPath(); g.arc(u * 32, -(zb - vz) * 32, 1.35, 0, Math.PI); g.fill();
    }
    g.restore();
    C.hl(s0, s1, zt, Col.shade(c1, 0.6), 1, 0.01);
    if (d ? !(bits & 2) : !(bits & 4)) { const sv = d ? s0 : s1; poly(g, [P(sv, zt, 0), P(sv, zb, ob), P(sv, zb - vz, ob)], Col.shade(c1, sideF)); }
  },

  // ------------------------------------------------------------ glazing
  glass(C, s0, s1, z0, z1, inn) {
    const { g, P } = C;
    g.save(); C.faceT(0);
    const gr = g.createLinearGradient(0, -z1 * 32, 0, -z0 * 32);
    if (inn) { gr.addColorStop(0, 'rgba(205,228,242,0.34)'); gr.addColorStop(1, 'rgba(175,205,225,0.24)'); }
    else { gr.addColorStop(0, 'rgba(208,228,242,0.66)'); gr.addColorStop(0.45, 'rgba(120,150,175,0.46)'); gr.addColorStop(1, 'rgba(62,84,104,0.56)'); }
    g.fillStyle = gr; g.fillRect(s0 * 32, -z1 * 32, (s1 - s0) * 32, (z1 - z0) * 32);
    g.restore();
    const w = s1 - s0, h = z1 - z0;
    poly(g, [P(s0 + w * 0.22, z1 - 0.02), P(s0 + w * 0.36, z1 - 0.02), P(s0 + w * 0.12, z1 - h * 0.58), P(s0 + w * 0.02, z1 - h * 0.58)], 'rgba(255,255,255,0.17)');
    poly(g, [P(s0 + w * 0.44, z1 - 0.02), P(s0 + w * 0.48, z1 - 0.02), P(s0 + w * 0.3, z1 - h * 0.42), P(s0 + w * 0.26, z1 - h * 0.42)], 'rgba(255,255,255,0.12)');
  },
  drapes(C, f, op, front) {
    if (!f.curtains) {
      if (!C.E.bl || f.smashed) return;
      // venetian blinds lowered part way
      const { hl, fac } = C, { s0, s1, z0, z1 } = op, zb = z0 + (z1 - z0) * 0.45, bc = Col.shade('#e6e0d0', fac), o = front ? 0.03 : -0.03;
      C.rect(s0, s1, zb, z1, Col.shade('#d8d2c2', fac), o);
      for (let z = z1 - 0.045; z > zb; z -= 0.06) hl(s0, s1, z, bc, 1.2, o);
      hl(s0, s1, zb, Col.shade('#bcb6a6', fac), 2, o);
      return;
    }
    const { rect, vl, hl, fac } = C, { s0, s1, z0, z1 } = op, cc = f.curtCol || '#c8b890', o = front ? 0.03 : -0.03, top = front ? z1 + 0.04 : z1;
    if (f.curtainsClosed && !f.smashed) {
      rect(s0, s1, z0, top, Col.shade(cc, fac), o);
      for (let k = 1; k < 8; k++) vl(s0 + (s1 - s0) * k / 8, z0, top, Col.shade(cc, fac * (k & 1 ? 0.76 : 1.12)), 1, o);
      vl((s0 + s1) / 2, z0, top, Col.shade(cc, fac * 0.55), 1, o);
    } else for (const [a, b] of [[s0, s0 + 0.11], [s1 - 0.11, s1]]) {
      rect(a, b, z0, top, Col.shade(cc, fac), o);
      vl((a + b) / 2, z0, top, Col.shade(cc, fac * 0.72), 1, o);
    }
    if (front) hl(s0 - 0.05, s1 + 0.05, z1 + 0.06, Col.shade('#5a4a3a', fac), 1.5, 0.04);
  },
  shards(C, op) {
    const { g, P, rng } = C, col = 'rgba(178,214,236,0.6)', edge = 'rgba(255,255,255,0.4)';
    for (let k = 0; k < 10; k++) {
      const side = k % 4;
      if (side < 2) { const s = side ? op.s1 : op.s0, z = rng.f(op.z0 + 0.1, op.z1 - 0.1), dr = side ? -1 : 1; poly(g, [P(s, z - 0.11), P(s + dr * rng.f(0.05, 0.17), z + rng.f(-0.06, 0.06)), P(s, z + 0.1)], col, edge, 0.5); }
      else { const z = side === 2 ? op.z0 : op.z1, s = rng.f(op.s0 + 0.06, op.s1 - 0.06), dr = side === 2 ? 1 : -1; poly(g, [P(s - 0.07, z), P(s + rng.f(-0.04, 0.04), z + dr * rng.f(0.1, 0.32)), P(s + 0.07, z)], col, edge, 0.5); }
    }
  },
  window(C, f, op) {
    const { g, rect, hl, vl, box, fac, rng, E } = C, S = E.S, ext = E.side === 'e', inn = E.side === 'i';
    const { s0, s1, z0, z1 } = op, zm = (z0 + z1) / 2;
    if (E.side === 'x') {
      // burnt out: blackened frame, a few cracked shards, soot above
      if (!f.glassOut) this.shards(C, op);
      const fc = '#1e1a18';
      vl(s0 + 0.015, z0, z1, fc, 2); vl(s1 - 0.015, z0, z1, fc, 2); hl(s0, s1, z1 - 0.02, fc, 2); hl(s0, s1, z0 + 0.02, fc, 2.5);
      hl(s0, s0 + 0.12, zm, fc, 2);
      rect(s0 - 0.05, s1 + 0.05, z1, Math.min(C.hz, z1 + 0.35), 'rgba(0,0,0,0.35)');
      return;
    }
    if (f.big) { this.shopWin(C, f, op); return; }
    const sash = ext ? (S.mat === 'trailer' ? '#c8ccd0' : S.mat === 'log' ? '#4a3624' : S.mat === 'metal' ? '#5a5e60' : '#f2f0ea') : '#f0ece4';
    const sc = Col.shade(sash, fac);
    if (!inn) this.drapes(C, f, op, false);
    if (f.smashed) { if (!f.glassOut) this.shards(C, op); }
    else if (f.open) { this.glass(C, s0, s1, zm, z1, inn); rect(s0, s1, z0, zm, 'rgba(40,46,52,0.22)'); }
    else this.glass(C, s0, s1, z0, z1, inn);
    if (!f.smashed) {
      hl(s0, s1, z1 - 0.02, sc, 2); hl(s0, s1, z0 + 0.02, sc, 2); vl(s0 + 0.015, z0, z1, sc, 2); vl(s1 - 0.015, z0, z1, sc, 2);
      const mun = ext ? S.mun : 0;
      if (mun === 3) vl((s0 + s1) / 2, z0, z1, sc, 2);
      else {
        hl(s0, s1, zm, sc, 2);
        if (mun === 1) vl((s0 + s1) / 2, z0, z1, sc, 1);
        else if (mun === 2) { for (const q of [1 / 3, 2 / 3]) vl(s0 + (s1 - s0) * q, z0, z1, sc, 1); hl(s0, s1, (z0 + zm) / 2, sc, 1); hl(s0, s1, (zm + z1) / 2, sc, 1); }
      }
    } else { hl(s0, s0 + 0.14, zm, sc, 2); hl(s1 - 0.09, s1, zm + 0.04, sc, 2); }
    if (inn) {
      const ic = '#ece8de';
      rect(s0 - 0.04, s0, z0 - 0.02, z1 + 0.04, Col.shade(ic, fac)); rect(s1, s1 + 0.04, z0 - 0.02, z1 + 0.04, Col.shade(ic, fac)); rect(s0 - 0.04, s1 + 0.04, z1, z1 + 0.045, Col.shade(ic, fac));
      box(s0 - 0.06, s1 + 0.06, z0 - 0.06, z0, 0, 0.07, ic);
      this.drapes(C, f, op, true);
      return;
    }
    if (!ext) return;
    const m = S.mat, tc = S.trim, snow = Season.snow > 0.3, sn = '#eef2f6';
    if (m === 'brick') {
      const hc = Col.mix(S.col, '#2a1e1a', 0.12);
      rect(s0 - 0.045, s1 + 0.045, z1, z1 + 0.17, Col.shade(Col.mix(S.col, '#d6cfc2', 0.55), fac));
      for (let s = s0 - 0.045; s < s1 + 0.04; s += 0.056) rect(s + 0.004, Math.min(s1 + 0.045, s + 0.052), z1 + 0.012, z1 + 0.158, this.jit(hc, fac, 10, rng));
      box(s0 - 0.07, s1 + 0.07, z0 - 0.085, z0 - 0.005, 0, 0.07, '#bab3a5');
    } else if (m === 'stucco') {
      const lc = Col.mix(S.col, '#ffffff', 0.3);
      rect(s0 - 0.035, s0, z0, z1, Col.shade(lc, fac)); rect(s1, s1 + 0.035, z0, z1, Col.shade(lc, fac)); rect(s0 - 0.035, s1 + 0.035, z1, z1 + 0.04, Col.shade(lc, fac));
      box(s0 - 0.06, s1 + 0.06, z0 - 0.07, z0 - 0.005, 0, 0.06, lc);
    } else if (m === 'metal' || m === 'trailer') {
      const fc = Col.shade(m === 'trailer' ? '#d6dadc' : '#70767a', fac);
      rect(s0 - 0.025, s0, z0 - 0.025, z1 + 0.025, fc); rect(s1, s1 + 0.025, z0 - 0.025, z1 + 0.025, fc);
      rect(s0 - 0.025, s1 + 0.025, z1, z1 + 0.025, fc); rect(s0 - 0.025, s1 + 0.025, z0 - 0.025, z0, fc);
      if (m === 'trailer') box(s0 - 0.05, s1 + 0.05, z1 + 0.04, z1 + 0.07, 0, 0.12, '#d6dadc');
    } else {
      rect(s0 - 0.045, s0, z0 - 0.02, z1 + 0.05, Col.shade(tc, fac)); rect(s1, s1 + 0.045, z0 - 0.02, z1 + 0.05, Col.shade(tc, fac));
      box(s0 - 0.07, s1 + 0.07, z1 + 0.05, z1 + 0.115, 0, 0.035, tc);
      box(s0 - 0.065, s1 + 0.065, z0 - 0.075, z0 - 0.01, 0, 0.065, tc);
    }
    if (snow) { rect(s0 - 0.065, s1 + 0.065, z0 - 0.01, z0 + 0.012, sn, 0.03); if (m !== 'metal' && m !== 'stucco') rect(s0 - 0.07, s1 + 0.07, z1 + 0.115, z1 + 0.14, sn, 0.02); }
    if (S.shut) {
      const w = 0.13, c = S.shut;
      for (const [a, b] of [[s0 - 0.05 - w, s0 - 0.05], [s1 + 0.05, s1 + 0.05 + w]]) {
        box(a, b, z0, z1, 0, 0.025, c);
        for (let z = z0 + 0.08; z < z1 - 0.06; z += 0.075) hl(a + 0.02, b - 0.02, z, Col.shade(c, fac * 0.66), 1, 0.026);
        hl(a + 0.02, b - 0.02, zm, Col.shade(c, Math.min(1.3, fac * 1.15)), 1.5, 0.026);
      }
    }
    if (S.box) this.windowBox(C, op, snow);
  },
  // planter under a window; blooms follow the season
  windowBox(C, op, snow) {
    const { g, P, box, rng, fac, sideF, d } = C, S = C.E.S, st = Season.tree;
    const a = op.s0 - 0.03, b = op.s1 + 0.03, zt = op.z0 - 0.11, zb = zt - 0.22, o0 = 0.02, o1 = 0.17;
    const bc = S.mat === 'log' ? '#6a4a2e' : S.trim;
    const pal = st === 'p' ? ['#d8303a', '#f0d040', '#f08ab0', '#f4f0e8'] : st === 'g' ? ['#d82a2a', '#e8508a', '#c02020', '#f4f0f4', '#9a4ac8'] : st === 'y' || st === 'a' ? ['#e07a1a', '#e8b020', '#8a2a3a', '#c85a1a'] : null;
    const leaf = st === 's' || st === 'b' ? '#6a5a3a' : st === 'a' || st === 'y' ? '#4a6a2a' : '#3a7a2a';
    // foliage behind the front board
    if (st !== 'b') for (let k = 0; k < 16; k++) { const s = rng.f(a + 0.03, b - 0.03); C.dot(s, zt + rng.f(0.0, st === 's' ? 0.1 : 0.17), rng.f(0.06, 0.13), Col.shade(leaf, rng.f(0.75, 1.05)), rng.f(2, 3.2)); }
    if (pal) for (let k = 0; k < (st === 'p' ? 9 : 14); k++) { const s = rng.f(a + 0.04, b - 0.04), z = zt + rng.f(0.06, st === 'p' ? 0.24 : 0.2); if (st === 'p') C.vl(s, zt, z, Col.shade('#3a8a2a', fac), 1, 0.1); C.dot(s, z, 0.1, Col.shade(rng.pick(pal), 1), st === 'p' ? 2.2 : 1.8); }
    // the planter itself
    const sv = d ? a : b;
    poly(g, [P(sv, zb, o0), P(sv, zb, o1), P(sv, zt, o1), P(sv, zt, o0)], Col.shade(bc, sideF));
    poly(g, [P(a, zt, o0), P(b, zt, o0), P(b, zt, o1), P(a, zt, o1)], Col.shade(snow ? '#eef2f6' : '#3a2a1e', 1));
    C.rect(a, b, zb, zt, Col.shade(bc, fac), o1);
    C.hl(a, b, zt - 0.03, Col.shade(bc, fac * 0.75), 1, o1);
    if (st === 'g') for (let k = 0; k < 7; k++) { const s = rng.f(a + 0.03, b - 0.03); C.dot(s, zt - rng.f(0.02, 0.12), o1 + 0.01, Col.shade(rng.chance(0.5) ? '#9a4ac8' : '#f0eef4', fac), 1.8); }
    if (snow) box(a, b, zt, zt + 0.03, o0, o1, '#eef2f6');
  },
  // big store-front glazing with posters behind the glass
  shopWin(C, f, op) {
    const { rect, hl, vl, fac, E } = C, ext = E.side === 'e', S = E.S;
    const fc = Col.shade(ext ? S.frame : '#8a8e92', fac), { s0, s1, z0, z1 } = op;
    if (f.smashed) { if (!f.glassOut) this.shards(C, op); }
    else {
      this.glass(C, s0, s1, z0, z1, !ext);
      if (ext && E.pst > 3) { this.poster(C, E.pst, op); rect(s0, s1, z0, z1, 'rgba(190,215,232,0.12)'); }
    }
    vl(s0 + 0.012, z0, z1, fc, 2.5); vl(s1 - 0.012, z0, z1, fc, 2.5);
    hl(s0, s1, z1 - 0.015, fc, 2.5); hl(s0, s1, z0 + 0.018, fc, 3.5);
    if (!f.smashed) hl(s0, s1, 1.8, fc, 2);
    if (!ext && E.side === 'i') rect(s0 - 0.03, s1 + 0.03, z0 - 0.06, z0, Col.shade('#ece8de', fac), 0.02);
  },
  poster(C, p, op) {
    const { g, rect, hl, fac, rng } = C, m = (op.s0 + op.s1) / 2;
    const txt = (t, s, z, col, px) => { g.save(); C.faceT(-0.01); g.fillStyle = col; g.font = 'bold ' + px + 'px Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, s * 32, -z * 32); g.restore(); };
    if (p === 4) { rect(m - 0.26, m + 0.06, 1.05, 1.42, Col.shade('#c8281e', fac), -0.01); txt('SALE', m - 0.1, 1.235, '#fff4d0', 5); }
    else if (p === 5) { rect(m + 0.08, m + 0.34, 0.85, 1.5, Col.shade('#f2efe6', fac), -0.01); for (let z = 0.95; z < 1.42; z += 0.08) hl(m + 0.11, m + 0.31 - rng.f(0, 0.08), z, Col.shade('#4a4a4a', fac), 1, -0.009); }
    else if (p === 6) { const c = rng.pick(['#2a5a9a', '#e0a020', '#3a8a4a', '#9a2a6a']); rect(m - 0.32, m - 0.04, 0.6, 1.55, Col.shade(c, fac), -0.01); C.dot(m - 0.18, 1.2, -0.009, Col.shade('#f4f0e0', fac), 5); hl(m - 0.28, m - 0.08, 0.8, Col.shade('#f4f0e0', fac), 2, -0.009); }
    else if (p === 7) { rect(m - 0.12, m + 0.18, 1.12, 1.38, Col.shade('#f0d040', fac), -0.01); txt('HELP', m + 0.03, 1.3, '#2a2a2a', 4); txt('WANTED', m + 0.03, 1.19, '#2a2a2a', 3); }
    else if (p === 8) { for (let z = 2.04; z > 1.25; z -= 0.055) hl(op.s0, op.s1, z, 'rgba(232,228,214,0.88)', 1.5, -0.01); }
    else if (p === 9) { rect(m - 0.21, m + 0.21, 1.12, 1.36, 'rgba(20,20,30,0.65)', -0.01); txt('OPEN', m, 1.24, '#ff4a3a', 6); }
  },
  // ------------------------------------------------------------ doors
  door(C, f, op) {
    const { rect, box, fac, E, d } = C, ext = E.side === 'e', S = E.S, { s0, s1, z1 } = op;
    if (E.side === 'x') { if (f.open && !f.broken && f.style !== 'garage') this.openPanel(C, f, op, '#2a2420'); else this.brokenDoor(C, op, '#2a2420'); return; }
    if (f.style === 'garage') { this.garage(C, f, op); return; }
    if (f.style === 'glass') { this.glassDoor(C, f, op); return; }
    const dc = f.col || '#7a5a3a';
    const kind = f.style === 'metal' ? 'M' : ext ? (E.front ? 'F' : f.ext ? 'B' : 'I') : (f.ext && E.side === 'i' ? 'B' : 'I');
    if (f.open && !f.broken) this.openPanel(C, f, op, dc);
    else if (f.broken) this.brokenDoor(C, op, dc);
    else this.slab(C, op, dc, kind);
    if (ext) {
      this.casing(C, op, E.front);
      if (E.front) {
        if (S.storm && !f.open && !f.broken && !f.barricade) this.storm(C, op);
        box(s0 - 0.1, s1 + 0.1, 0, 0.11, 0, 0.32, '#aca89e');
        if (Season.snow > 0.3) box(s0 - 0.1, s1 + 0.1, 0.11, 0.13, 0.12, 0.32, '#eef2f6');
        if (S.porch) this.canopy(C, op);
      }
    } else if (E.side === 'i') {
      const c = Col.shade('#ece8de', fac);
      rect(s0 - 0.04, s0, 0, z1 + 0.04, c); rect(s1, s1 + 0.04, 0, z1 + 0.04, c); rect(s0 - 0.04, s1 + 0.04, z1, z1 + 0.05, c);
    } else { const c = Col.shade('#d8d0c0', fac); C.vl(s0, 0, z1, c, 2); C.vl(s1, 0, z1, c, 2); C.hl(s0, s1, z1, c, 2); }
    void d;
  },
  // the door swung open into the tile (same geometry the game always used)
  openPanel(C, f, op, dc) {
    const { g, P, sideF, d } = C, hs = d ? op.s1 : op.s0, z1 = op.z1;
    const pc = f.glass ? 'rgba(150,190,215,0.5)' : Col.shade(dc, sideF);
    poly(g, [P(hs, 0, 0), P(hs, 0, 0.62), P(hs, z1, 0.62), P(hs, z1, 0)], pc, Col.shade(f.glass ? '#4a4f54' : dc, 0.5), 1);
    if (!f.glass) for (const [p, q] of [[0.16, 0.9], [1.02, 1.86]]) poly(g, [P(hs, p, 0.09), P(hs, p, 0.53), P(hs, q, 0.53), P(hs, q, 0.09)], null, Col.shade(dc, sideF * 0.72), 1);
    else C.hl(hs, hs, 1.0, '#c0c4c8', 1);
  },
  brokenDoor(C, op, dc) {
    const { g, P, rng, fac } = C;
    for (let k = 0; k < 5; k++) { const z = 0.2 + k * 0.38; poly(g, [P(op.s0, z), P(op.s0 + 0.06 + rng.f(0, 0.08), z + 0.05), P(op.s0 + 0.02, z + 0.14)], Col.shade(dc, fac * 0.8)); poly(g, [P(op.s1, z + 0.1), P(op.s1 - 0.05 - rng.f(0, 0.07), z + 0.16), P(op.s1, z + 0.24)], Col.shade(dc, fac * 0.8)); }
    poly(g, [P(op.s0 + 0.04, 1.2), P(op.s0 + 0.3, 1.5), P(op.s0 + 0.24, 1.95), P(op.s0 + 0.03, 1.9)], Col.shade(dc, fac * 0.9), Col.shade(dc, 0.45), 1);
  },
  // door leaf: F front (per-house style), B back / side door, M steel, I interior
  slab(C, op, dc, kind) {
    const { g, rect, hl, vl, fac, d, E } = C, { s0, s1, z1 } = op, m = (s0 + s1) / 2, w = s1 - s0;
    rect(s0, s1, 0, z1, Col.shade(dc, fac));
    const hi = Col.shade(dc, Math.min(1.3, fac * 1.17)), lo = Col.shade(dc, fac * 0.66);
    const pan = (a, b, p, q) => { rect(a, b, p, q, Col.shade(dc, fac * 0.94)); hl(a, b, q, lo); vl(a, p, q, lo); hl(a, b, p, hi); vl(b, p, q, hi); };
    const lite = (a, b, p, q, nx, ny) => {
      rect(a, b, p, q, '#1e252b');
      this.glass(C, a, b, p, q, false);
      for (let k = 1; k < nx; k++) vl(a + (b - a) * k / nx, p, q, Col.shade(dc, fac), 1.5);
      for (let k = 1; k < ny; k++) hl(a, b, p + (q - p) * k / ny, Col.shade(dc, fac), 1.5);
      hl(a, b, q, lo); vl(a, p, q, lo);
    };
    const st = kind === 'F' ? E.S.door : kind === 'B' ? 3 : kind === 'M' ? 9 : 8;
    const two = [[s0 + 0.06, m - 0.025], [m + 0.025, s1 - 0.06]];
    if (st === 0) for (const [a, b] of two) { pan(a, b, 0.14, 0.72); pan(a, b, 0.82, 1.5); pan(a, b, 1.6, 1.88); }
    else if (st === 1) { lite(s0 + 0.07, s1 - 0.07, 1.48, 1.88, 3, 1); for (const [a, b] of two) { pan(a, b, 0.14, 0.7); pan(a, b, 0.8, 1.38); } }
    else if (st === 2) {
      lite(s0 + 0.07, s1 - 0.07, 1.54, 1.87, 3, 1);
      rect(s0 + 0.04, s1 - 0.04, 1.43, 1.49, Col.shade(dc, Math.min(1.3, fac * 1.1))); hl(s0 + 0.04, s1 - 0.04, 1.43, lo);
      for (let k = 0; k < 3; k++) { const a = s0 + 0.07 + k * (w - 0.14) / 3; pan(a + 0.012, a + (w - 0.14) / 3 - 0.012, 0.16, 1.34); }
    } else if (st === 3) { lite(s0 + 0.07, s1 - 0.07, 1.02, 1.86, 3, 3); pan(s0 + 0.07, s1 - 0.07, 0.14, 0.9); }
    else if (st === 9) { pan(s0 + 0.04, s1 - 0.04, 0.05, z1 - 0.05); lite(m - 0.07, m + 0.07, 1.36, 1.8, 1, 1); rect(s0 + 0.08, s1 - 0.08, 0.95, 1.02, Col.shade('#b8bcc0', fac)); }
    else { pan(s0 + 0.07, s1 - 0.07, 0.16, 0.92); pan(s0 + 0.07, s1 - 0.07, 1.04, 1.86); }
    const ls = d ? s0 + 0.065 : s1 - 0.065;
    C.dot(ls, 0.98, 0.01, kind === 'M' ? '#a0a4a8' : '#d8bc5a', 2.5);
    if (kind === 'F' || kind === 'B') C.dot(ls, 1.2, 0.01, '#c8ac4a', 1.6);
    if (kind === 'F') { rect(s0 + 0.03, s1 - 0.03, 0.02, 0.12, Col.shade('#c8a850', fac)); if (st !== 3) { rect(m - 0.07, m + 0.07, 1.08, 1.12, Col.shade('#c8ac4a', fac)); } }
  },
  // door / window casing by material; front doors get a crown head
  casing(C, op, front) {
    const { rect, box, fac, rng, E } = C, S = E.S, { s0, s1, z1 } = op, m = S.mat, tc = S.trim;
    if (m === 'brick') {
      const hc = Col.mix(S.col, '#2a1e1a', 0.12);
      rect(s0 - 0.05, s1 + 0.05, z1, z1 + 0.18, Col.shade(Col.mix(S.col, '#d6cfc2', 0.55), fac));
      for (let s = s0 - 0.05; s < s1 + 0.045; s += 0.056) rect(s + 0.004, Math.min(s1 + 0.05, s + 0.052), z1 + 0.012, z1 + 0.168, this.jit(hc, fac, 10, rng));
      rect(s0 - 0.025, s0, 0, z1, Col.shade(tc, fac)); rect(s1, s1 + 0.025, 0, z1, Col.shade(tc, fac));
    } else if (m === 'metal' || m === 'trailer' || m === 'stucco') {
      const fc = Col.shade(m === 'stucco' ? Col.mix(S.col, '#ffffff', 0.3) : m === 'trailer' ? '#d6dadc' : '#70767a', fac);
      rect(s0 - 0.03, s0, 0, z1 + 0.03, fc); rect(s1, s1 + 0.03, 0, z1 + 0.03, fc); rect(s0 - 0.03, s1 + 0.03, z1, z1 + 0.04, fc);
    } else {
      const cw = m === 'log' ? 0.06 : 0.045;
      rect(s0 - cw, s0, 0, z1 + 0.05, Col.shade(tc, fac)); rect(s1, s1 + cw, 0, z1 + 0.05, Col.shade(tc, fac));
      box(s0 - cw - 0.02, s1 + cw + 0.02, z1 + 0.05, z1 + 0.12, 0, 0.035, tc);
      if (front) box(s0 - cw - 0.045, s1 + cw + 0.045, z1 + 0.12, z1 + 0.17, 0, 0.07, tc);
    }
  },
  // little shingled canopy on brackets over the front door
  canopy(C, op) {
    const { g, P, fac, sideF, d, E } = C, S = E.S, rc = S.b.roofCol || '#5a4038', tc = S.trim, snow = Season.snow > 0.3;
    const a = op.s0 - 0.15, b = op.s1 + 0.15, zb = 2.32, zf = 2.12, of = 0.52;
    for (const s of [op.s0 - 0.08, op.s1 + 0.08]) {
      poly(g, [P(s - 0.02, 1.78, 0), P(s + 0.02, 1.78, 0), P(s + 0.02, zf - 0.03, of - 0.08), P(s - 0.02, zf - 0.03, of - 0.08)], Col.shade(tc, sideF));
      poly(g, [P(s - 0.02, zf - 0.03, 0), P(s + 0.02, zf - 0.03, 0), P(s + 0.02, zf - 0.03, of - 0.04), P(s - 0.02, zf - 0.03, of - 0.04)], Col.shade(tc, 0.75));
    }
    const sv = d ? a : b;
    poly(g, [P(sv, zb, 0), P(sv, zf, of), P(sv, zf - 0.08, of)], Col.shade(tc, sideF));
    poly(g, [P(a, zb, 0), P(b, zb, 0), P(b, zf, of), P(a, zf, of)], snow ? Col.shade('#eef3f8', 0.95) : Col.shade(rc, 0.92));
    if (!snow) for (let k = 1; k < 4; k++) { const t = k / 4; line(g, P(a, zb + (zf - zb) * t, of * t), P(b, zb + (zf - zb) * t, of * t), Col.shade(rc, 0.62), 1); }
    poly(g, [P(a, zf, of), P(b, zf, of), P(b, zf - 0.08, of), P(a, zf - 0.08, of)], Col.shade(tc, fac));
    if (snow) poly(g, [P(a, zf + 0.02, of + 0.02), P(b, zf + 0.02, of + 0.02), P(b, zf - 0.03, of + 0.03), P(a, zf - 0.03, of + 0.03)], '#f4f7fa');
  },
  // aluminium storm door in front of the closed front door
  storm(C, op) {
    const { rect, hl, vl, fac, d, E } = C, { s0, s1, z1 } = op, o = 0.035;
    const fc = Col.shade(E.S.trim === '#3b3a37' || E.S.trim === '#4c3b2c' ? E.S.trim : '#e6e6e2', fac);
    rect(s0 + 0.02, s1 - 0.02, 0.95, z1 - 0.03, 'rgba(190,215,232,0.3)', o);
    rect(s0 + 0.02, s1 - 0.02, 0.12, 0.9, 'rgba(190,215,232,0.2)', o);
    vl(s0 + 0.016, 0.02, z1 - 0.01, fc, 2.5, o); vl(s1 - 0.016, 0.02, z1 - 0.01, fc, 2.5, o);
    hl(s0, s1, z1 - 0.02, fc, 2.5, o); hl(s0, s1, 0.06, fc, 4, o); hl(s0, s1, 0.93, fc, 3, o);
    C.dot(d ? s0 + 0.06 : s1 - 0.06, 1.0, o + 0.01, '#b4b8bc', 2.5);
    C.vl(s0 + 0.12, 1.2, 1.85, 'rgba(255,255,255,0.3)', 1, o);
  },
  glassDoor(C, f, op) {
    const { rect, hl, vl, fac, E } = C, S = E.side === 'e' ? E.S : null, { s0, s1, z1 } = op;
    const fc = Col.shade(S ? S.frame : '#5a5f64', fac), m = (s0 + s1) / 2;
    if (f.open && !f.broken) this.openPanel(C, f, op, S ? S.frame : '#5a5f64');
    else if (f.broken) this.shards(C, { s0, s1, z0: 0.12, z1 });
    else {
      this.glass(C, s0, s1, 0, z1, E.side === 'i');
      vl(s0 + 0.02, 0, z1, fc, 3); vl(s1 - 0.02, 0, z1, fc, 3); hl(s0, s1, z1 - 0.03, fc, 3); rect(s0, s1, 0, 0.13, fc);
      hl(s0 + 0.05, s1 - 0.05, 1.02, Col.shade('#c8ccd0', fac), 2);
      if (S) { rect(m - 0.07, m + 0.07, 1.36, 1.56, Col.shade('#f2f0e8', fac)); for (let z = 1.41; z < 1.53; z += 0.04) hl(m - 0.05, m + 0.05, z, Col.shade('#505050', fac)); }
    }
    if (E.nL) rect(0, 0.03, 0, z1, fc);
    if (E.nR) rect(0.97, 1, 0, z1, fc);
    if (!E.nL) rect(s0 - 0.03, s0, 0, z1 + 0.03, fc);
    if (!E.nR) rect(s1, s1 + 0.03, 0, z1 + 0.03, fc);
    rect(E.nL ? s0 : s0 - 0.03, E.nR ? s1 : s1 + 0.03, z1, z1 + 0.04, fc);
  },
  // sectional garage doors, barn doors, fire station bays (neighbouring door segments join up)
  garage(C, f, op) {
    const { g, P, rect, hl, vl, box, fac, rng, E } = C, S = E.side === 'e' ? E.S : null, { s0, s1, z1 } = op;
    const dc = E.gc || f.col || '#d8d8d0';
    const tc = Col.shade(S ? S.trim : '#d8d0c0', fac);
    const barn = S && S.t === 'barn';
    if (f.open && !f.broken) {
      rect(s0, s1, z1 - 0.2, z1, Col.shade(dc, fac * 0.85));
      hl(s0, s1, z1 - 0.2, Col.shade(dc, fac * 0.55));
    } else if (f.broken) {
      rect(s0, s1, z1 - 0.5, z1, Col.shade(dc, fac * 0.9));
      poly(g, [P(s0 + 0.1, z1 - 0.5), P(s1 - 0.2, z1 - 0.5), P(s1 - 0.35, z1 - 0.9), P(s0 + 0.2, z1 - 0.75)], Col.shade(dc, fac * 0.7));
    } else if (barn) {
      rect(s0, s1, 0, z1, Col.shade(dc, fac));
      for (let s = s0 + 0.0625; s < s1; s += 0.125) vl(s, 0, z1, Col.shade(dc, fac * 0.7));
      const a = s0 + 0.05, b = s1 - 0.05, wc = Col.shade('#efece4', fac);
      rect(s0, s1, z1 - 0.07, z1, wc); rect(s0, s1, 0, 0.07, wc); rect(s0, s0 + 0.05, 0, z1, wc); rect(s1 - 0.05, s1, 0, z1, wc);
      rect(s0, s1, z1 / 2 - 0.035, z1 / 2 + 0.035, wc);
      for (const [p, q] of [[0.07, z1 / 2 - 0.035], [z1 / 2 + 0.035, z1 - 0.07]]) { poly(g, [P(a, p), P(a + 0.06, p), P(b, q), P(b - 0.06, q)], wc); poly(g, [P(b, p), P(b - 0.06, p), P(a, q), P(a + 0.06, q)], wc); }
      box(s0 - 0.05, s1 + 0.05, z1 + 0.04, z1 + 0.09, 0, 0.06, '#3a3a3a');
    } else {
      rect(s0, s1, 0, z1, Col.shade(dc, fac));
      const fire = S && S.t === 'firestation', n = 4, sh = z1 / n, cols = Math.max(2, Math.round((s1 - s0) * 4));
      for (let r = 0; r < n; r++) {
        const zb = r * sh;
        if (r) { hl(s0, s1, zb, Col.shade(dc, fac * 0.6)); hl(s0, s1, zb + 0.025, Col.shade(dc, Math.min(1.3, fac * 1.14))); }
        for (let c = 0; c < cols; c++) {
          const a = s0 + (s1 - s0) * c / cols + 0.03, b = s0 + (s1 - s0) * (c + 1) / cols - 0.03;
          if (r === n - 1 || (fire && r === n - 2)) { rect(a, b, zb + 0.09, zb + sh - 0.09, '#1e252b'); this.glass(C, a, b, zb + 0.09, zb + sh - 0.09, false); }
          else { rect(a, b, zb + 0.08, zb + sh - 0.08, Col.shade(dc, fac * 0.95)); hl(a, b, zb + sh - 0.08, Col.shade(dc, fac * 0.7)); hl(a, b, zb + 0.08, Col.shade(dc, Math.min(1.3, fac * 1.12))); }
        }
      }
      if (rng.chance(0.5) || !E.nR) rect((s0 + s1) / 2 - 0.05, (s0 + s1) / 2 + 0.05, 0.1, 0.15, '#3a3a3a');
    }
    if (!E.nL) rect(s0 - 0.04, s0, 0, z1 + 0.05, tc);
    if (!E.nR) rect(s1, s1 + 0.04, 0, z1 + 0.05, tc);
    rect(E.nL ? s0 : s0 - 0.04, E.nR ? s1 : s1 + 0.04, z1, z1 + 0.07, tc);
  },
  doorway(C, op) {
    const E = C.E, c = Col.shade(E.side === 'e' ? E.S.trim : '#ece8de', C.fac);
    C.rect(op.s0 - 0.04, op.s0, 0, op.z1 + 0.04, c); C.rect(op.s1, op.s1 + 0.04, 0, op.z1 + 0.04, c); C.rect(op.s0 - 0.04, op.s1 + 0.04, op.z1, op.z1 + 0.05, c);
  },
  // boards nailed across a barricaded opening
  planks(C, f, op) {
    const { g, P, fac } = C, nb = f.barricade || 0, isWin = f.k === 'window';
    const pz0 = isWin ? op.z0 : 0.25, pz1 = isWin ? op.z1 : 1.8, rng = new RNG(31 + nb * 7);
    for (let k = 0; k < nb; k++) {
      const z = pz0 + (pz1 - pz0) * (k + 0.5) / 4 + 0.08, tilt = (k & 1) ? 0.12 : -0.12;
      const a0 = op.s0 - 0.08 - rng.f(0, 0.03), a1 = op.s1 + 0.08 + rng.f(0, 0.03), wc = ['#b08a5a', '#a07a4c', '#b89464', '#9a7448'][k & 3];
      poly(g, [P(a0, z - tilt - 0.02, 0.03), P(a1, z + tilt - 0.02, 0.03), P(a1, z + tilt, 0.03), P(a0, z - tilt, 0.03)], Col.shade('#4a3220', fac));
      poly(g, [P(a0, z - tilt, 0.035), P(a1, z + tilt, 0.035), P(a1, z + tilt + 0.17, 0.035), P(a0, z - tilt + 0.17, 0.035)], Col.shade(wc, fac), Col.shade('#5a3a1e', fac), 0.8);
      for (const q of [0.05, 0.11]) line(g, P(a0 + 0.04, z - tilt + q, 0.036), P(a1 - 0.04, z + tilt + q + rng.f(-0.02, 0.02), 0.036), Col.shade(wc, fac * 0.82), 0.7);
      C.dot(a0 + 0.05, z - tilt + 0.085, 0.04, '#2e2e2e', 1.6); C.dot(a1 - 0.05, z + tilt + 0.085, 0.04, '#2e2e2e', 1.6);
    }
  },
  // ------------------------------------------------------------ fences
  fence(C, type, snow) {
    const { g, rect, hl, vl, box, fac, rng } = C, sn = '#eef2f6';
    if (type === WT.PICKET) {
      const wc = '#ecebe3';
      for (const z of [0.24, 0.6]) { rect(0, 1, z, z + 0.06, Col.shade(wc, fac * 0.8), -0.03); if (snow) hl(0, 1, z + 0.07, sn, 1.5, -0.03); }
      box(0, 0.07, 0, 0.98, -0.05, 0.02, '#e4e2d8');
      if (snow) box(0, 0.07, 0.98, 1.01, -0.05, 0.02, sn);
      for (let k = 0; k < 7; k++) {
        const c = (k + 0.5) / 7 + 0.02, w = 0.032;
        if (c + w > 1) continue;
        const pc = rng.chance(0.15) ? '#d6d4ca' : wc;
        poly(g, [C.P(c - w, 0.04), C.P(c + w, 0.04), C.P(c + w, 0.78), C.P(c, 0.88), C.P(c - w, 0.78)], Col.shade(pc, fac));
        vl(c + w, 0.04, 0.78, Col.shade(pc, fac * 0.7));
        if (snow) poly(g, [C.P(c - w, 0.78), C.P(c, 0.88), C.P(c + w, 0.78), C.P(c, 0.83)], sn);
      }
      rect(0, 1, 0.04, 0.12, 'rgba(60,70,40,0.12)');
      return;
    }
    if (type === WT.WOODFENCE) {
      const bc = '#8f6d4a', top = 1.8;
      for (let k = 0; k < 8; k++) {
        const s0 = k / 8, s1 = (k + 1) / 8, pc = this.jit(bc, fac, 10, rng);
        poly(g, [C.P(s0, 0.02), C.P(s1, 0.02), C.P(s1, top - 0.05), C.P(s1 - 0.025, top), C.P(s0 + 0.025, top), C.P(s0, top - 0.05)], pc);
        vl(s1 - 0.004, 0.02, top - 0.05, Col.shade(bc, fac * 0.55));
        if (rng.chance(0.5)) vl(rng.f(s0 + 0.03, s1 - 0.03), rng.f(0.2, 0.8), rng.f(0.9, 1.6), Col.shade(bc, fac * 0.84));
        if (rng.chance(0.3)) C.dot(rng.f(s0 + 0.03, s1 - 0.03), rng.f(0.3, 1.5), 0, Col.shade(bc, fac * 0.6), 1.5);
        if (snow) poly(g, [C.P(s0 + 0.025, top), C.P(s1 - 0.025, top), C.P(s1, top - 0.05), C.P(s1 - 0.03, top - 0.02), C.P(s0, top - 0.05)], sn);
      }
      rect(0, 1, 0.02, 0.16, 'rgba(0,0,0,0.12)');
      hl(0, 1, 0.42, 'rgba(0,0,0,0.13)'); hl(0, 1, 1.42, 'rgba(0,0,0,0.13)');
      box(0, 0.075, 0, 1.92, 0, 0.05, '#76583a');
      box(-0.012, 0.087, 1.92, 1.98, -0.012, 0.062, '#664a30');
      if (snow) box(-0.012, 0.087, 1.98, 2.01, -0.012, 0.062, sn);
      return;
    }
    if (type === WT.CHAIN) {
      const top = 1.8;
      g.save();
      poly(g, [C.P(0, 0.05), C.P(1, 0.05), C.P(1, top), C.P(0, top)], 'rgba(150,160,165,0.1)');
      g.clip();
      C.faceT(0); g.strokeStyle = 'rgba(182,190,194,0.55)'; g.lineWidth = 0.8; g.beginPath();
      const h = (top - 0.05) * 32;
      for (let u = -h; u < 32 + h; u += 3.4) { g.moveTo(u, -1.6); g.lineTo(u + h, -top * 32); g.moveTo(u + h, -1.6); g.lineTo(u, -top * 32); }
      g.stroke(); g.restore();
      hl(0, 1, 0.06, 'rgba(120,128,132,0.75)');
      hl(0, 1, top, Col.shade('#a2a8ac', fac), 2.2);
      vl(0.035, 0, top + 0.07, Col.shade('#8a9094', fac), 2.6);
      box(0.015, 0.055, top + 0.06, top + 0.1, -0.02, 0.02, '#7a8084');
      if (snow) hl(0, 1, top + 0.035, sn, 1.6);
      return;
    }
    if (type === WT.LOG) {
      for (let k = 0; k < 4; k++) {
        const z = 0.04 + k * 0.29, lc = k & 1 ? '#7a5a38' : '#6a4a2c';
        rect(-0.04, 1.04, z, z + 0.27, Col.shade(lc, fac));
        hl(-0.04, 1.04, z + 0.22, Col.shade(lc, Math.min(1.3, fac * 1.22)));
        hl(-0.04, 1.04, z + 0.04, Col.shade(lc, fac * 0.62), 1.5);
        this.logEnd(C, C.d ? -0.04 : 1.04, z + 0.135, 0.13, lc);
      }
      for (const s of [0.14, 0.86]) for (let z = 0.1; z < 1.18; z += 0.11) hl(s - 0.022, s + 0.022, z, Col.shade('#c8b890', fac), 1, 0.01);
      if (snow) hl(-0.04, 1.04, 1.21, sn, 2.5);
    }
  },

  // ------------------------------------------------------------ roofs
  // Each building's roof is painted once into a cached canvas (LRU by pixel count) and blitted.
  // Night shading darkens it through its outline path rather than a second silhouette canvas.
  rcache: new Map(), rpx: 0, RCAP: 10e6, rbudget: 3, rw: null, tiles: new Map(),
  roof(b, sq) {
    if (this.rw !== Wd) { this.rw = Wd; this.rcache.clear(); this.rpx = 0; }
    const lf = Season.snow < 0.15 && (Season.tree === 'a' || Season.tree === 's') ? 'L' : '';
    const key = b.id + '|' + sq + '|' + (b.floors || 1) + lf;
    let rec = this.rcache.get(key);
    if (!rec) {
      if (this.rbudget <= 0) return null;
      this.rbudget--;
      rec = this.buildRoof(b, sq, lf);
      this.rcache.set(key, rec);
      this.rpx += rec.c.width * rec.c.height;
      if (this.rpx > this.RCAP) {
        const old = this.tick - 2;
        for (const [k, r] of this.rcache) { if (this.rpx <= this.RCAP * 0.7) break; if (r.u < old) { this.rcache.delete(k); this.rpx -= r.c.width * r.c.height; } }
      }
    }
    rec.u = this.tick;
    return rec;
  },
  roofH(b, S, H) {
    if (S.t === 'barn') return H + Math.min(3.4, (((S.alongX ? b.y1 - b.y0 : b.x1 - b.x0) + 1) / 2 + 0.18) * 0.62);
    return H + Math.min(1.7, ((S.alongX ? b.y1 - b.y0 : b.x1 - b.x0) + 1) * 0.3);
  },
  buildRoof(b, sq, lf) {
    const S = this.style(b), H = WALL_H * (b.floors || 1), ov = 0.18;
    // tight canvas: top is the higher of the back eave corner and the ridge end plus whatever stands on the ridge
    let top;
    if (S.flat) top = (b.x0 + b.y0) * HTH - (H + 0.75) * ZU;
    else {
      const zr = this.roofH(b, S, H), vm = S.alongX ? (b.y0 + b.y1 + 1) / 2 : (b.x0 + b.x1 + 1) / 2, u0 = (S.alongX ? b.x0 : b.y0) - ov;
      const extra = S.t === 'church' ? 4.35 : S.ant ? 1.62 : S.chim ? 0.9 : 0.12;
      top = Math.min((b.x0 + b.y0 - 2 * ov) * HTH - H * ZU, (u0 + vm) * HTH - (zr + extra) * ZU);
    }
    const minX = Math.floor((b.x0 - b.y1 - 1 - 2 * ov) * HTW) - 14, maxX = Math.ceil((b.x1 + 1 - b.y0 + 2 * ov) * HTW) + 14;
    const minY = Math.floor(top) - 6, maxY = Math.ceil((b.x1 + b.y1 + 2 + 2 * ov) * HTH - (H - 0.62) * ZU) + 4;
    const c = mkCanvas(maxX - minX, maxY - minY), g = c.getContext('2d');
    const R = { b, S, H, sq, lf, g, rng: new RNG(S.rs), out: [] };
    R.P = (x, y, z) => [(x - y) * HTW - minX, (x + y) * HTH - z * ZU - minY];
    R.fill = (pts, col, out) => { poly(g, pts, col); if (out) R.out.push(pts); };
    R.outLine = (a, q, w) => { const dx = q[0] - a[0], dy = q[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2; R.out.push([[a[0] + nx, a[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [a[0] - nx, a[1] - ny]]); };
    if (S.flat) this.flatRoof(R); else this.pitchedRoof(R);
    const path = new Path2D();
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (const pts of R.out) {
      let a = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
      const q = a < 0 ? pts.slice().reverse() : pts;
      path.moveTo(q[0][0] + minX, q[0][1] + minY);
      for (let i = 1; i < q.length; i++) path.lineTo(q[i][0] + minX, q[i][1] + minY);
      path.closePath();
      for (const p of pts) { if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0]; if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1]; }
    }
    // crop the canvas to what was painted (less to blit every frame, less memory)
    bx0 = Math.max(0, Math.floor(bx0) - 3); by0 = Math.max(0, Math.floor(by0) - 3);
    bx1 = Math.min(c.width, Math.ceil(bx1) + 3); by1 = Math.min(c.height, Math.ceil(by1) + 3);
    if (bx1 > bx0 && by1 > by0 && (bx1 - bx0) * (by1 - by0) < c.width * c.height * 0.92) {
      const cc = mkCanvas(bx1 - bx0, by1 - by0);
      cc.getContext('2d').drawImage(c, -bx0, -by0);
      return { c: cc, x: minX + bx0, y: minY + by0, path, u: 0 };
    }
    return { c, x: minX, y: minY, path, u: 0 };
  },
  // seamless roofing texture tiles, one per material + colour + slope shade k (baked in)
  tile(kind, col, k) {
    k = k === undefined ? 1 : Math.round(k * 100) / 100;
    const key = kind + col + k;
    let c = this.tiles.get(key);
    if (c) return c;
    const rng = new RNG(this.shash(key));
    const W = kind === 'metal' || kind === 'tin' ? 64 : kind === 'gravel' ? 96 : 168, H = kind === 'metal' || kind === 'tin' ? 64 : kind === 'gravel' ? 96 : 108;
    c = mkCanvas(W, H);
    const g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, W, H);
    const rect = (x, y, w, h, f) => { g.fillStyle = f; for (const ox of [0, -W, W]) g.fillRect(x + ox, y, w, h); };
    if (kind === 'shingle' || kind === 'slate') {
      const ch = kind === 'slate' ? 4.5 : 5.4, tw = kind === 'slate' ? 7 : 10.5, rows = Math.round(H / ch);
      for (let r = 0; r < rows; r++) {
        const y = r * ch, off = (r & 1) ? tw / 2 : 0;
        for (let x = off; x < W + off - 0.01; x += tw) {
          rect(x + 0.6, y, tw - 1.2, ch - 1, this.jit(col, rng.f(0.86, 1.1), 5, rng));
          rect(x - 0.4, y + 0.6, 0.9, ch - 1.4, 'rgba(0,0,0,0.3)');
        }
        rect(0, y + ch - 1, W, 1, 'rgba(0,0,0,0.34)');
        rect(0, y, W, 0.7, 'rgba(255,255,255,0.06)');
      }
      for (let i = 0; i < W * H / 40; i++) rect(rng.f(0, W), rng.f(0, H), 1, 1, rng.chance(0.5) ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.14)');
    } else if (kind === 'shake') {
      const ch = 6.75;
      for (let r = 0; r < 16; r++) {
        const y = r * ch;
        for (let x = rng.f(0, 6); x < W;) { const w = rng.f(5, 12); rect(x + 0.6, y, w - 1.2, ch - 1, this.jit(col, rng.f(0.8, 1.15), 8, rng)); rect(x - 0.3, y, 0.8, ch - 1, 'rgba(0,0,0,0.38)'); x += w; }
        rect(0, y + ch - 1.2, W, 1.2, 'rgba(0,0,0,0.4)');
      }
    } else if (kind === 'metal') {
      for (let x = 6; x < W; x += 12.8) { rect(x, 0, 1.3, H, 'rgba(255,255,255,0.22)'); rect(x + 1.3, 0, 1.1, H, 'rgba(0,0,0,0.3)'); }
      for (let i = 0; i < 40; i++) rect(rng.f(0, W), rng.f(0, H), rng.f(1, 3), 1, 'rgba(0,0,0,0.05)');
    } else if (kind === 'tin') {
      for (let x = 0; x < W; x += 8) { rect(x, 0, 1, H, 'rgba(255,255,255,0.25)'); rect(x + 1, 0, 1, H, 'rgba(0,0,0,0.18)'); }
    } else {
      for (let i = 0; i < W * H / 5; i++) rect(rng.f(0, W), rng.f(0, H), 1, 1, rng.pick(['rgba(255,255,255,0.14)', 'rgba(0,0,0,0.16)', 'rgba(120,110,90,0.18)', 'rgba(255,250,235,0.1)']));
      for (let i = 0; i < 30; i++) rect(rng.f(0, W), rng.f(0, H), 2, 2, 'rgba(0,0,0,0.12)');
    }
    if (k < 0.995) { g.fillStyle = 'rgba(0,0,0,' + (1 - k).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
    this.tiles.set(key, c);
    return c;
  },
  // fill one roof plane (plane space: p along the eave, q down the slope, 32 px per tile)
  // (the plane rect 0..Lp x 0..Lq is exactly the roof plane, so nothing needs clipping)
  roofTex(g, col, kind, k, Lp, Lq, rng, lf, sq) {
    g.fillStyle = g.createPattern(this.tile(kind, col, k), 'repeat');
    g.fillRect(0, 0, Lp, Lq);
    const box = (x, y, w, h) => { const a = Math.max(0, x), b = Math.max(0, y); g.fillRect(a, b, Math.min(Lp, x + w) - a, Math.min(Lq, y + h) - b); };
    if (kind === 'shingle' && rng.chance(0.55)) for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(30,40,25,0.07)'; box(rng.f(0, Lp), rng.f(0, Lq * 0.4), rng.f(5, 16), Lq); }
    if (kind === 'metal') for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(140,72,30,0.12)'; box(rng.f(0, Lp), rng.f(0, Lq), rng.f(3, 12), rng.f(4, 22)); }
    if (lf && !sq) for (let i = 0, n = Lp * Lq / 160; i < n; i++) { g.fillStyle = Col.shade(rng.pick(['#b8682a', '#c88a30', '#8a4a22', '#a87a2a', '#7a5a2a']), k); g.fillRect(rng.f(0, Lp - 2), rng.f(0, Lq - 1.5), 2, 1.5); }
    if (sq > 0) this.snowTex(g, Lp, Lq, sq, k, rng);
  },
  // snow blanket in plane space, a ragged edge (texture showing) toward the lower edge
  snowTex(g, Lp, Lq, sq, k, rng) {
    g.fillStyle = Col.shade('#eef3f8', Math.min(1, 0.22 + k * 0.8));
    if (sq >= 0.5) {
      const band = (1 - sq) * 16 + 1.5;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Lp, 0);
      for (let p = Lp; p > 0; p -= 5) g.lineTo(p, Math.max(0, Lq - band - rng.f(0, band + 2)));
      g.lineTo(0, Math.max(0, Lq - band - rng.f(0, band + 2)));
      g.closePath(); g.fill();
      for (let i = 0, n = Lp / 9; i < n; i++) { g.fillStyle = 'rgba(150,170,196,0.16)'; const x = rng.f(0, Lp - 8); g.fillRect(x, rng.f(0, Math.max(1, Lq - band)), Math.min(rng.f(8, 26), Lp - x), 1); }
      for (let i = 0, n = Lp * Lq / 240; i < n; i++) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(rng.f(0, Lp - 1), rng.f(0, Math.max(1, Lq - band)), 1, 1); }
    } else for (let i = 0, n = Lp * Lq / 220; i < n; i++) { const rx = rng.f(4, 12), ry = rng.f(2.5, 5); if (Lp < rx * 2 + 2 || Lq < ry * 2 + 2) break; g.beginPath(); g.ellipse(rng.f(rx, Lp - rx), rng.f(ry, Math.max(ry, Lq * 0.85 - ry)), rx, ry, 0, 0, 7); g.fill(); }
  },
  // a box sitting on the roof (frame F: W(u, v, z), zAt(v), face shades): +v face, +u face, top
  rbox(R, F, u, v, du, dv, h, col, topCol) {
    const { W, zAt, fE, fV } = F, u1 = u + du, v1 = v + dv, zt = Math.max(zAt(v), zAt(v1)) + h;
    R.fill([W(u, v1, zAt(v1) - 0.03), W(u1, v1, zAt(v1) - 0.03), W(u1, v1, zt), W(u, v1, zt)], Col.shade(col, fV), true);
    R.fill([W(u1, v, zAt(v) - 0.03), W(u1, v1, zAt(v1) - 0.03), W(u1, v1, zt), W(u1, v, zt)], Col.shade(col, fE), true);
    R.fill([W(u, v, zt), W(u1, v, zt), W(u1, v1, zt), W(u, v1, zt)], topCol || Col.shade(col, 1), true);
    return zt;
  },
  // gable / gambrel roofs: shingles, ridge cap, gable end with siding and vent, fascia, gutter, chimney, extras
  pitchedRoof(R) {
    const { g, b, S, H, rng, sq, lf } = R, ax = S.alongX, ov = 0.18;
    const wu0 = ax ? b.x0 : b.y0, wu1 = (ax ? b.x1 : b.y1) + 1, wv0 = ax ? b.y0 : b.x0, wv1 = (ax ? b.y1 : b.x1) + 1;
    const u0 = wu0 - ov, u1 = wu1 + ov, v0 = wv0 - ov, v1 = wv1 + ov, vm = (wv0 + wv1) / 2, half = vm - v0;
    const W = ax ? (u, v, z) => R.P(u, v, z) : (u, v, z) => R.P(v, u, z);
    const barn = S.t === 'barn', snowy = sq >= 0.5, sn = '#eef3f8';
    const zr = this.roofH(b, S, H);
    let prof;
    if (barn) { const zk = H + (zr - H) * 0.6, dv = half * 0.36; prof = [[v0, H], [v0 + dv, zk], [vm, zr], [v1 - dv, zk], [v1, H]]; }
    else prof = [[v0, H], [vm, zr], [v1, H]];
    const zAt = (v) => { for (let i = 1; i < prof.length; i++) if (v <= prof[i][0]) { const [a, za] = prof[i - 1], [bb, zb] = prof[i]; return za + (zb - za) * (v - a) / (bb - a); } return H; };
    const fE = ax ? FACE_E : FACE_S, fV = ax ? FACE_S : FACE_E, kB = ax ? 1.0 : 0.95, kF = ax ? 0.78 : 0.7;
    const F = { W, zAt, fE, fV };
    const rc = b.roofCol || '#5a4038', kind = S.rf, nseg = prof.length - 1;
    // roof planes, back to front
    for (let i = 0; i < nseg; i++) {
      const [va, za] = prof[i], [vb, zb] = prof[i + 1], back = i < nseg / 2;
      const k = back ? (barn && i === 0 ? 0.86 : kB) : (barn ? (i === nseg - 1 ? kF * 0.94 : kF * 1.08) : kF);
      const pts = [W(u0, va, za), W(u1, va, za), W(u1, vb, zb), W(u0, vb, zb)];
      const top = back ? [vb, zb] : [va, za], bot = back ? [va, za] : [vb, zb];
      const O = W(u0, top[0], top[1]), Ua = W(u1, top[0], top[1]), Qa = W(u0, bot[0], bot[1]);
      const Lq = Math.hypot(bot[0] - top[0], bot[1] - top[1]) * 32, Lp = (u1 - u0) * 32;
      g.save();
      g.setTransform((Ua[0] - O[0]) / Lp, (Ua[1] - O[1]) / Lp, (Qa[0] - O[0]) / Lq, (Qa[1] - O[1]) / Lq, O[0], O[1]);
      this.roofTex(g, rc, kind, k, Lp, Lq, rng, lf, sq);
      g.restore();
      R.out.push(pts);
    }
    // ridge cap
    if (!snowy) {
      const dv = 0.085, cc = kind === 'metal' ? rc : Col.mix(rc, '#000000', 0.15);
      R.fill([W(u0, vm - dv, zAt(vm - dv) + 0.03), W(u1, vm - dv, zAt(vm - dv) + 0.03), W(u1, vm, zr + 0.045), W(u0, vm, zr + 0.045)], Col.shade(cc, kB * 0.92));
      R.fill([W(u0, vm, zr + 0.045), W(u1, vm, zr + 0.045), W(u1, vm + dv, zAt(vm + dv) + 0.03), W(u0, vm + dv, zAt(vm + dv) + 0.03)], Col.shade(cc, kF * 0.95));
      line(g, W(u0, vm, zr + 0.045), W(u1, vm, zr + 0.045), Col.shade(rc, 1.15), 1);
    } else line(g, W(u0, vm, zr + 0.05), W(u1, vm, zr + 0.05), '#f6f9fc', 2);
    // gable end facing the camera: siding, attic vent / hay loft door
    const gp = prof.map(([v, z], i) => (i === 0 ? W(wu1, wv0, H) : i === nseg ? W(wu1, wv1, H) : W(wu1, v, z)));
    R.out.push(gp);
    const dG = ax ? 1 : 0, dep = wv1 - wv0, sm = dep / 2;
    const Pg = ax ? (s, z, o) => R.P(wu1 + (o || 0), wv1 - s, z) : (s, z, o) => R.P(wv0 + s, wu1 + (o || 0), z);
    const Cg = this.ctx(g, Pg, dG, fE, dG ? FACE_S : FACE_E, rng);
    Cg.E = { S, side: 'e' };
    Cg.faceT = (o) => { const q = Pg(0, 0, o || 0); g.setTransform(1, dG ? -0.5 : 0.5, 0, 1, q[0], q[1]); };
    g.save(); poly(g, gp); g.clip();
    this.mat(Cg, barn ? 'batten' : S.gm, S.col, 0, dep, H, zr + 0.2);
    const wood = /clap|vinyl|batten|scale/.test(S.gm);
    if (wood && !barn) { Cg.rect(0, dep, H, H + 0.1, Col.shade(S.trim, fE)); Cg.hl(0, dep, H + 0.1, Col.shade(S.trim, fE * 0.7)); }
    g.restore();
    if (barn) {
      const zk = prof[1][1], wc = '#efece4';
      Cg.rect(sm - 0.42, sm + 0.42, zk - 0.2, zk + 0.75, Col.shade('#5a1a14', fE));
      for (const [a, q] of [[sm - 0.42, sm - 0.36], [sm + 0.36, sm + 0.42]]) Cg.rect(a, q, zk - 0.2, zk + 0.75, Col.shade(wc, fE));
      Cg.rect(sm - 0.42, sm + 0.42, zk + 0.69, zk + 0.75, Col.shade(wc, fE)); Cg.rect(sm - 0.42, sm + 0.42, zk - 0.2, zk - 0.14, Col.shade(wc, fE));
      poly(g, [Pg(sm - 0.36, zk - 0.14), Pg(sm - 0.3, zk - 0.14), Pg(sm + 0.36, zk + 0.69), Pg(sm + 0.3, zk + 0.69)], Col.shade(wc, fE));
      poly(g, [Pg(sm + 0.36, zk - 0.14), Pg(sm + 0.3, zk - 0.14), Pg(sm - 0.36, zk + 0.69), Pg(sm - 0.3, zk + 0.69)], Col.shade(wc, fE));
      // white trim along the roof line
      for (let i = 0; i < nseg; i++) { const a = gp[i], q = gp[i + 1]; line(g, a, q, Col.shade(wc, fE), 3); }
    } else if (S.t !== 'motel') {
      const zv0 = H + (zr - H) * 0.3, zv1 = H + (zr - H) * 0.68, w = 0.16 + (zv1 - zv0) * 0.18;
      if (zv1 - zv0 > 0.25) {
        Cg.box(sm - w, sm + w, zv0, zv1, 0, 0.03, S.trim);
        for (let z = zv0 + 0.05; z < zv1 - 0.03; z += 0.06) Cg.hl(sm - w + 0.03, sm + w - 0.03, z, Col.shade('#33302c', fE), 1, 0.031);
      }
    }
    // rake board on the gable end and the eave fascia with its gutter
    const fh = 0.13, tc = barn ? '#efece4' : S.trim;
    for (let i = 0; i < nseg; i++) {
      const [va, za] = prof[i], [vb, zb] = prof[i + 1];
      R.fill([W(u1, va, za), W(u1, vb, zb), W(u1, vb, zb - fh), W(u1, va, za - fh)], Col.shade(tc, fE), true);
      if (snowy) line(g, W(u1, va, za + 0.025), W(u1, vb, zb + 0.025), sn, 2);
    }
    R.fill([W(u0, v1, H), W(u1, v1, H), W(u1, v1, H - fh), W(u0, v1, H - fh)], Col.shade(tc, fV), true);
    if (S.gut) {
      const gc = S.gut;
      R.fill([W(u0, v1, H - 0.02), W(u1, v1, H - 0.02), W(u1, v1 + 0.1, H - 0.02), W(u0, v1 + 0.1, H - 0.02)], snowy ? sn : Col.shade('#2a2a2a', 0.9), true);
      R.fill([W(u0, v1 + 0.1, H - 0.02), W(u1, v1 + 0.1, H - 0.02), W(u1, v1 + 0.1, H - 0.16), W(u0, v1 + 0.1, H - 0.16)], Col.shade(gc, fV), true);
      line(g, W(u0, v1 + 0.1, H - 0.03), W(u1, v1 + 0.1, H - 0.03), Col.shade(gc, 1.12), 1);
      R.fill([W(u1, v1, H - 0.02), W(u1, v1 + 0.1, H - 0.02), W(u1, v1 + 0.1, H - 0.16), W(u1, v1, H - 0.16)], Col.shade(gc, fE), true);
    }
    if (sq >= 0.75) {
      // snow lip over the eave and icicles
      const lip = [];
      for (let u = u0; u <= u1 + 0.001; u += (u1 - u0) / 24) lip.push(W(u, v1 + 0.03, H - 0.02 - rng.f(0, 0.05)));
      R.fill([W(u0, v1 - 0.1, zAt(v1 - 0.1) + 0.03), W(u1, v1 - 0.1, zAt(v1 - 0.1) + 0.03)].concat(lip.reverse()), Col.shade(sn, 0.9), true);
      for (let u = u0 + 0.2; u < u1 - 0.1; u += rng.f(0.25, 0.6)) { const l = rng.f(0.08, 0.32), zt = S.gut ? H - 0.16 : H - fh; R.fill([W(u - 0.03, v1 + 0.1, zt), W(u + 0.03, v1 + 0.1, zt), W(u, v1 + 0.1, zt - l)], 'rgba(222,238,250,0.9)', true); }
    }
    // chimney / stovepipe on the back slope
    const len = u1 - u0;
    if (S.chim) {
      const cu = u0 + 0.9 + rng.f(0, Math.max(0, len - 2.8)), cv = vm - 0.78;
      if (S.chim === 'pipe') {
        const p0 = W(cu, cv + 0.3, zAt(cv + 0.3) - 0.04), p1 = W(cu, cv + 0.3, zr + 0.5);
        line(g, p0, p1, '#2a2a2c', 3.5); R.outLine(p0, p1, 3.5);
        R.fill([[p1[0] - 5, p1[1] + 1], [p1[0] + 5, p1[1] + 1], [p1[0], p1[1] - 4]], snowy ? sn : '#1e1e20', true);
      } else this.chim(R, F, cu, cv, 0.55, zr + 0.55);
    }
    // plumbing vent, box vent, antenna, dish
    if (!barn) {
      const pu = u0 + 1 + rng.f(0, Math.max(0.1, len - 2)), pv = vm + Math.min(1, (v1 - vm) * 0.4);
      const b0 = W(pu, pv, zAt(pv) - 0.02), b1 = W(pu, pv, zAt(pv) + 0.3);
      line(g, b0, b1, '#3c3c3e', 3); R.outLine(b0, b1, 3);
      g.fillStyle = snowy ? sn : '#5a5a5e'; g.beginPath(); g.ellipse(b1[0], b1[1], 1.6, 0.8, 0, 0, 7); g.fill();
      const bu = u0 + 1.2 + rng.f(0, Math.max(0.1, len - 2.6));
      this.rbox(R, F, bu, vm - 0.62, 0.32, 0.3, 0.12, '#4a4a4c', snowy ? sn : null);
      if (S.t === 'motel') for (let u = u0 + 2.5; u < u1 - 1; u += 4.2) this.rbox(R, F, u, vm - 0.6, 0.3, 0.3, 0.12, '#4a4a4c', snowy ? sn : null);
    }
    if (S.ant) {
      const au = u0 + len * rng.f(0.55, 0.75), p0 = W(au, vm, zr + 0.03), p1 = W(au, vm, zr + 1.55);
      line(g, p0, p1, '#4e5256', 1.4); R.outLine(p0, p1, 1.6);
      const a = rng.f(0, Math.PI), cx = Math.cos(a), cy = Math.sin(a), zb = zr + 1.42;
      const e0 = W(au - cx * 0.55, vm - cy * 0.55, zb), e1 = W(au + cx * 0.55, vm + cy * 0.55, zb);
      line(g, e0, e1, '#4e5256', 1); R.outLine(e0, e1, 1.4);
      for (let k = 0; k < 6; k++) {
        const t = -0.5 + k / 5, hl = 0.32 - k * 0.03, mu = au + cx * 0.55 * t * 2, mv = vm + cy * 0.55 * t * 2;
        const q0 = W(mu - cy * hl, mv + cx * hl, zb), q1 = W(mu + cy * hl, mv - cx * hl, zb);
        line(g, q0, q1, '#5a5e62', 1); R.outLine(q0, q1, 1.4);
      }
    }
    if (S.dish) {
      const du = u0 + len * 0.22, dv = vm + (v1 - vm) * 0.45, zb = zAt(dv), m0 = W(du, dv, zb), m1 = W(du, dv, zb + 0.32);
      line(g, m0, m1, '#5a5e62', 1.6); R.outLine(m0, m1, 1.8);
      const c = W(du, dv + 0.05, zb + 0.42), pts = [];
      for (let k = 0; k < 14; k++) { const t = k / 14 * Math.PI * 2; pts.push([c[0] + Math.cos(t) * 5.5 * Math.cos(0.5) - Math.sin(t) * 7 * Math.sin(0.5), c[1] + Math.cos(t) * 5.5 * Math.sin(0.5) + Math.sin(t) * 7 * Math.cos(0.5)]); }
      R.fill(pts, snowy ? sn : '#d6d8da', true); poly(g, pts, null, '#8a8e92', 0.8);
      line(g, c, [c[0] + 6, c[1] + 3], '#6a6e72', 1);
    }
    if (S.t === 'church') this.steeple(R, F, (u0 + u1) / 2 - 0.5, vm - 0.5, 1.0, zr);
  },
  chim(R, F, cu, cv, w, top) {
    const { g, S, sq } = R, { W, zAt, fE, fV } = F, stone = S.t === 'cabin', col = stone ? '#8a877e' : '#8e4a38';
    const u1 = cu + w, v1 = cv + w, sn = '#eef3f8';
    const fv = [W(cu, v1, zAt(v1) - 0.05), W(u1, v1, zAt(v1) - 0.05), W(u1, v1, top), W(cu, v1, top)];
    const fu = [W(u1, cv, zAt(cv) - 0.05), W(u1, v1, zAt(v1) - 0.05), W(u1, v1, top), W(u1, cv, top)];
    for (const [pts, k, alongV] of [[fv, fV, false], [fu, fE, true]]) {
      R.fill(pts, Col.shade(col, k), true);
      g.save(); poly(g, pts); g.clip();
      const mc = Col.shade(stone ? '#5a5850' : '#c8b8a8', k);
      let r = 0;
      for (let z = top - 0.11; z > zAt(cv) - 0.3; z -= 0.11, r++) {
        line(g, alongV ? W(u1, cv, z) : W(cu, v1, z), alongV ? W(u1, v1, z) : W(u1, v1, z), mc, 0.8);
        for (let t = (r & 1) ? 0.14 : 0.28; t < w; t += 0.28) line(g, alongV ? W(u1, cv + t, z) : W(cu + t, v1, z), alongV ? W(u1, cv + t, z + 0.11) : W(cu + t, v1, z + 0.11), mc, 0.8);
      }
      g.restore();
    }
    const e = 0.05, ct = top + 0.08, cc = '#a29e96';
    R.fill([W(cu - e, v1 + e, top), W(u1 + e, v1 + e, top), W(u1 + e, v1 + e, ct), W(cu - e, v1 + e, ct)], Col.shade(cc, fV), true);
    R.fill([W(u1 + e, cv - e, top), W(u1 + e, v1 + e, top), W(u1 + e, v1 + e, ct), W(u1 + e, cv - e, ct)], Col.shade(cc, fE), true);
    R.fill([W(cu - e, cv - e, ct), W(u1 + e, cv - e, ct), W(u1 + e, v1 + e, ct), W(cu - e, v1 + e, ct)], sq >= 0.5 ? sn : Col.shade('#b4b0a8', 1), true);
    const a = cu + w * 0.3, b = cu + w * 0.7, c = cv + w * 0.3, d = cv + w * 0.7, ft = ct + 0.17;
    R.fill([W(a, d, ct), W(b, d, ct), W(b, d, ft), W(a, d, ft)], Col.shade('#9a5636', fV), true);
    R.fill([W(b, c, ct), W(b, d, ct), W(b, d, ft), W(b, c, ft)], Col.shade('#9a5636', fE), true);
    R.fill([W(a, c, ft), W(b, c, ft), W(b, d, ft), W(a, d, ft)], '#1c1614', true);
  },
  // church tower with belfry and spire, straddling the ridge
  steeple(R, F, su, sv, w, zr) {
    const { g } = R, { W, zAt, fE, fV } = F, u1 = su + w, v1 = sv + w, zt = zr + 1.3, tc = '#ece8e0';
    R.fill([W(su, v1, zAt(v1) - 0.05), W(u1, v1, zAt(v1) - 0.05), W(u1, v1, zt), W(su, v1, zt)], Col.shade(tc, fV), true);
    R.fill([W(u1, sv, zAt(sv) - 0.05), W(u1, v1, zAt(v1) - 0.05), W(u1, v1, zt), W(u1, sv, zt)], Col.shade(tc, fE), true);
    for (const [k, face] of [[fV, (t, z) => W(su + t, v1, z)], [fE, (t, z) => W(u1, v1 - t, z)]]) {
      for (let z = zAt(v1) + 0.1; z < zt - 0.1; z += 0.18) line(g, face(0, z), face(w, z), Col.shade(tc, k * 0.82), 0.8);
      poly(g, [face(0.3, zr + 0.5), face(0.7, zr + 0.5), face(0.7, zr + 0.95), face(0.5, zr + 1.08), face(0.3, zr + 0.95)], '#2a2622');
      for (let z = zr + 0.58; z < zr + 0.95; z += 0.08) line(g, face(0.32, z), face(0.68, z), Col.shade('#6a6058', k), 0.8);
    }
    const e = 0.06;
    R.fill([W(su - e, v1 + e, zt), W(u1 + e, v1 + e, zt), W(u1 + e, v1 + e, zt + 0.1), W(su - e, v1 + e, zt + 0.1)], Col.shade(tc, fV), true);
    R.fill([W(u1 + e, sv - e, zt), W(u1 + e, v1 + e, zt), W(u1 + e, v1 + e, zt + 0.1), W(u1 + e, sv - e, zt + 0.1)], Col.shade(tc, fE), true);
    const apex = W(su + w / 2, sv + w / 2, zt + 2.3), sc = '#3c3c46';
    R.fill([W(su, v1, zt + 0.1), W(u1, v1, zt + 0.1), apex], Col.shade(sc, fV), true);
    R.fill([W(u1, sv, zt + 0.1), W(u1, v1, zt + 0.1), apex], Col.shade(sc, fE), true);
    if (R.sq >= 0.5) R.fill([W(su, v1, zt + 0.1), W(su + w * 0.5, v1, zt + 0.1), apex], 'rgba(238,243,248,0.55)');
    const c0 = W(su + w / 2, sv + w / 2, zt + 2.28), c1 = W(su + w / 2, sv + w / 2, zt + 2.8);
    line(g, c0, c1, '#d8c890', 1.8); R.outLine(c0, c1, 2);
    const h0 = W(su + w / 2 - 0.13, sv + w / 2 + 0.13, zt + 2.64), h1 = W(su + w / 2 + 0.13, sv + w / 2 - 0.13, zt + 2.64);
    line(g, h0, h1, '#d8c890', 1.5); R.outLine(h0, h1, 1.8);
  },
  // flat roofs: gravel deck with parapet + coping, rooftop units, painted name, store sign; trailers get a tin roof
  flatRoof(R) {
    const { g, b, S, H, rng, sq } = R, P = R.P, snowy = sq >= 0.5, sn = '#eef3f8';
    const x0 = b.x0, y0 = b.y0, x1 = b.x1 + 1, y1 = b.y1 + 1, rc = b.roofCol || '#6a6a68';
    const plane = (O, Ua, Qa, Lp, Lq) => g.setTransform((Ua[0] - O[0]) / Lp, (Ua[1] - O[1]) / Lp, (Qa[0] - O[0]) / Lq, (Qa[1] - O[1]) / Lq, O[0], O[1]);
    if (S.rf === 'tin') {
      const e = 0.06, z = H + 0.07, lx = x1 - x0 >= y1 - y0;
      const deck = [P(x0 - e, y0 - e, z), P(x1 + e, y0 - e, z), P(x1 + e, y1 + e, z), P(x0 - e, y1 + e, z)];
      const Lp = ((lx ? x1 - x0 : y1 - y0) + 2 * e) * 32, Lq = ((lx ? y1 - y0 : x1 - x0) + 2 * e) * 32;
      g.save();
      if (lx) plane(P(x0 - e, y0 - e, z), P(x1 + e, y0 - e, z), P(x0 - e, y1 + e, z), Lp, Lq);
      else plane(P(x0 - e, y0 - e, z), P(x0 - e, y1 + e, z), P(x1 + e, y0 - e, z), Lp, Lq);
      g.fillStyle = g.createPattern(this.tile('tin', '#b4b8b8'), 'repeat'); g.fillRect(0, 0, Lp, Lq);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, Lq * 0.35, Lp, Lq * 0.3);
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, Lq * 0.78, Lp, Lq * 0.22);
      if (sq > 0) this.snowTex(g, Lp, Lq, sq, 0.95, rng);
      g.restore();
      R.out.push(deck);
      R.fill([P(x0 - e, y1 + e, z), P(x1 + e, y1 + e, z), P(x1 + e, y1 + e, H - 0.05), P(x0 - e, y1 + e, H - 0.05)], Col.shade('#e2e4e4', FACE_S), true);
      R.fill([P(x1 + e, y0 - e, z), P(x1 + e, y1 + e, z), P(x1 + e, y1 + e, H - 0.05), P(x1 + e, y0 - e, H - 0.05)], Col.shade('#e2e4e4', FACE_E), true);
      const F = { W: P, zAt: () => z, fE: FACE_E, fV: FACE_S };
      this.rbox(R, F, x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.4, 0.3, 0.3, 0.1, '#d0d2d2', snowy ? sn : null);
      if (S.rs % 3 === 0) { const u = x0 + (x1 - x0) * 0.62, v = y0 + (y1 - y0) * 0.25; this.rbox(R, F, u, v, 0.8, 0.6, 0.38, '#c4c6c2', snowy ? sn : null); const c = P(u + 0.4, v + 0.3, z + 0.39); g.fillStyle = '#3a3c3e'; g.beginPath(); g.ellipse(c[0], c[1], 7, 3.5, 0, 0, 7); g.fill(); }
      return;
    }
    const e = 0.14, zp = H + 0.3;
    const deck = [P(x0, y0, H), P(x1, y0, H), P(x1, y1, H), P(x0, y1, H)];
    R.out.push(deck);
    const Lp = (x1 - x0) * 32, Lq = (y1 - y0) * 32;
    g.save();
    plane(P(x0, y0, H), P(x1, y0, H), P(x0, y1, H), Lp, Lq);
    g.fillStyle = g.createPattern(this.tile('gravel', rc), 'repeat'); g.fillRect(0, 0, Lp, Lq);
    for (let p = 32; p < Lp; p += 32) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(p, 0, 1, Lq); }
    for (let i = 0; i < 4; i++) { const rx = Math.min(Lp / 3, rng.f(10, 30)), ry = Math.min(Lq / 3, rng.f(6, 16)); g.fillStyle = 'rgba(30,30,30,0.07)'; g.beginPath(); g.ellipse(rng.f(rx, Lp - rx), rng.f(ry, Lq - ry), rx, ry, 0, 0, 7); g.fill(); }
    if (sq > 0) {
      this.snowTex(g, Lp, Lq, sq, 0.97, rng);
      if (sq < 1) for (let i = 0, n = Lp * Lq * (1 - sq) / 900; i < n; i++) { const rx = Math.min(Lp / 4, rng.f(6, 18)), ry = Math.min(Lq / 4, rng.f(3, 9)); g.fillStyle = 'rgba(96,96,92,0.3)'; g.beginPath(); g.ellipse(rng.f(rx + 8, Lp - rx - 2), rng.f(ry + 8, Lq - ry - 2), rx, ry, 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, Lp, 5); g.fillRect(0, 0, 5, Lq);
    }
    if (b.name) {
      g.save();
      g.translate(Lp / 2, Lq / 2);
      if (!S.alongX) g.rotate(-Math.PI / 2);
      g.font = 'bold 15px Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = snowy ? 'rgba(220,214,190,0.4)' : Col.shade('#e8e0c0', 0.9);
      g.fillText(b.name.toUpperCase(), 0, 0);
      g.restore();
    }
    g.restore();
    const pc = S.col, F = { W: P, zAt: () => H, fE: FACE_E, fV: FACE_S };
    // inner faces of the back parapets
    R.fill([P(x0 + e, y0 + e, H), P(x1 - e, y0 + e, H), P(x1 - e, y0 + e, zp), P(x0 + e, y0 + e, zp)], Col.shade(pc, FACE_S * 0.9), true);
    R.fill([P(x0 + e, y0 + e, H), P(x0 + e, y1 - e, H), P(x0 + e, y1 - e, zp), P(x0 + e, y0 + e, zp)], Col.shade(pc, FACE_E * 0.9), true);
    // rooftop units, vents and a hatch
    const n = 1 + (b.id % 3) + ((x1 - x0) * (y1 - y0) > 200 ? 2 : 0);
    for (let k = 0; k < n; k++) {
      let u = rng.f(x0 + 0.8, x1 - 1.8), v = rng.f(y0 + 0.8, y1 - 1.5);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (S.alongX ? Math.abs(v + 0.3 - cy) < 0.9 : Math.abs(u + 0.4 - cx) < 0.9) { if (S.alongX) v = y0 + 0.8; else u = x0 + 0.8; }
      const zt = this.rbox(R, F, u, v, 0.9, 0.65, 0.48, '#b2b4ae', snowy ? sn : null);
      for (let t = 0.1; t < 0.85; t += 0.08) line(g, P(u + t, v + 0.65, H + 0.06), P(u + t, v + 0.65, zt - 0.06), Col.shade('#7a7c76', FACE_S), 0.8);
      const c = P(u + 0.45, v + 0.32, zt);
      if (!snowy) { g.fillStyle = '#2e3032'; g.beginPath(); g.ellipse(c[0], c[1], 8, 4, 0, 0, 7); g.fill(); g.strokeStyle = '#8a8c88'; g.lineWidth = 1; g.stroke(); line(g, [c[0] - 6, c[1]], [c[0] + 6, c[1]], '#6a6c68', 1); line(g, [c[0], c[1] - 3], [c[0], c[1] + 3], '#6a6c68', 1); }
    }
    for (let k = 0; k < 3; k++) { const u = rng.f(x0 + 0.6, x1 - 0.6), v = rng.f(y0 + 0.6, y1 - 0.6), p0 = P(u, v, H), p1 = P(u, v, H + 0.28); line(g, p0, p1, '#4a4a4c', 3); R.outLine(p0, p1, 3); g.fillStyle = snowy ? sn : '#626266'; g.beginPath(); g.ellipse(p1[0], p1[1], 1.8, 0.9, 0, 0, 7); g.fill(); }
    this.rbox(R, F, x1 - 1.6, y0 + 0.5, 0.6, 0.6, 0.16, '#8a8a84', snowy ? sn : null);
    // the walls continue up as parapets on the camera side
    for (const dS of [0, 1]) {
      const Pf = dS ? (s, z, o) => P(x1 + (o || 0), y1 - s, z) : (s, z, o) => P(x0 + s, y1 + (o || 0), z), len = dS ? y1 - y0 : x1 - x0;
      const fac = dS ? FACE_E : FACE_S, Cf = this.ctx(g, Pf, dS, fac, dS ? FACE_S : FACE_E, rng);
      Cf.E = { S, side: 'e' }; Cf.faceT = (o) => { const q = Pf(0, 0, o || 0); g.setTransform(1, dS ? -0.5 : 0.5, 0, 1, q[0], q[1]); };
      const face = [Pf(0, H), Pf(len, H), Pf(len, zp), Pf(0, zp)];
      R.out.push(face);
      g.save(); poly(g, face); g.clip();
      this.mat(Cf, S.mat, pc, 0, len, H - 0.2, zp);
      g.restore();
    }
    const cc = '#bcb8ae', tc = snowy ? sn : Col.shade(cc, 1), ce = 0.03;
    R.fill([P(x0, y0, zp), P(x1, y0, zp), P(x1, y0 + e, zp), P(x0, y0 + e, zp)], tc, true);
    R.fill([P(x0, y0, zp), P(x0 + e, y0, zp), P(x0 + e, y1, zp), P(x0, y1, zp)], tc, true);
    R.fill([P(x0, y1 - e, zp), P(x1, y1 - e, zp), P(x1 + ce, y1 + ce, zp), P(x0, y1 + ce, zp)], tc, true);
    R.fill([P(x1 - e, y0, zp), P(x1 + ce, y0, zp), P(x1 + ce, y1 + ce, zp), P(x1 - e, y1, zp)], tc, true);
    R.fill([P(x0, y1 + ce, zp), P(x1 + ce, y1 + ce, zp), P(x1 + ce, y1 + ce, zp - 0.05), P(x0, y1 + ce, zp - 0.05)], Col.shade(cc, FACE_S), true);
    R.fill([P(x1 + ce, y0, zp), P(x1 + ce, y1 + ce, zp), P(x1 + ce, y1 + ce, zp - 0.05), P(x1 + ce, y0, zp - 0.05)], Col.shade(cc, FACE_E), true);
    if (S.shop && b.name && (b.front === 'S' || b.front === 'E')) this.storeSign(R);
  },
  // painted sign board along the top of a store front the camera sees
  storeSign(R) {
    const { g, b, S, H } = R, P = R.P, dS = b.front === 'E' ? 1 : 0;
    const x0 = b.x0, y0 = b.y0, x1 = b.x1 + 1, y1 = b.y1 + 1, len = dS ? y1 - y0 : x1 - x0;
    const Pf = dS ? (s, z, o) => P(x1 + (o || 0), y1 - s, z) : (s, z, o) => P(x0 + s, y1 + (o || 0), z);
    const fac = dS ? FACE_E : FACE_S, C = this.ctx(g, Pf, dS, fac, dS ? FACE_S : FACE_E, R.rng);
    const a = Math.min(0.6, len * 0.08), e = len - a, z0 = H - 0.22, z1 = H + 0.16, o = 0.06, [bg, fg] = S.sign;
    C.box(a, e, z0, z1, 0, o, bg);
    R.out.push([Pf(a, z0, o), Pf(e, z0, o), Pf(e, z1, o), Pf(a, z1, o)], [Pf(a, z1, 0), Pf(e, z1, 0), Pf(e, z1, o), Pf(a, z1, o)]);
    poly(g, [Pf(a + 0.05, z0 + 0.045, o), Pf(e - 0.05, z0 + 0.045, o), Pf(e - 0.05, z1 - 0.045, o), Pf(a + 0.05, z1 - 0.045, o)], null, Col.shade(fg, fac * 0.85), 0.8);
    g.save();
    const q = Pf(0, 0, o + 0.002);
    g.setTransform(1, dS ? -0.5 : 0.5, 0, 1, q[0], q[1]);
    const t = b.name.toUpperCase(), wMax = (e - a - 0.3) * 32;
    g.font = 'bold 9px Verdana, sans-serif';
    const tw = g.measureText(t).width;
    if (tw > wMax) g.font = 'bold ' + Math.max(5, Math.floor(9 * wMax / tw)) + 'px Verdana, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = Col.shade(fg, Math.min(1, fac * 1.15));
    g.fillText(t, (a + e) / 2 * 32, -((z0 + z1) / 2) * 32 + 0.5);
    g.restore();
  },
};
