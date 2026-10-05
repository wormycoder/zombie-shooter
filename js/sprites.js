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
  wallKey(type, d, col, f, cut) {
    let fk = '';
    if (f) fk = f.k + (f.open ? 'o' : '') + (f.smashed ? 's' : '') + (f.glassOut ? 'g' : '') + (f.broken ? 'b' : '') + (f.barricade || 0) + (f.curtains ? (f.curtainsClosed ? 'C' : 'c') + f.curtCol : '') + (f.style || '') + (f.col || '') + (f.big ? 'B' : '');
    return 'w' + type + '|' + d + '|' + col + '|' + fk + '|' + (cut ? 1 : 0);
  },
  wall(type, d, col, f, cut) {
    const key = this.wallKey(type, d, col, f, cut);
    const info = WALL_INFO[type];
    const hz = cut ? (info.fence ? info.h : 0.32) : info.h;
    const H = hz * ZU;
    const w = 82, h = H + 30;
    const ax = d ? 44 : 24, ay = H + 10;
    return this.get(key, w, h, ax, ay, (g) => this._drawWall(g, ax, ay, type, d, col, f, hz, cut));
  },
  _drawWall(g, ax, ay, type, d, col, f, hz, cut) {
    const F = (a, z) => d ? [ax - a * HTW, ay + a * HTH - z * ZU] : [ax + a * HTW, ay + a * HTH - z * ZU];
    const T = d ? [-0.11 * HTW, -0.11 * HTH] : [0.11 * HTW, -0.11 * HTH];
    const fac = d ? FACE_E : FACE_S;
    const fcol = Col.shade(col, fac);
    const quad = (a0, a1, z0, z1, fill) => poly(g, [F(a0, z0), F(a1, z0), F(a1, z1), F(a0, z1)], fill);
    const cap = (z, a0, a1) => { const p0 = F(a0 === undefined ? 0 : a0, z), p1 = F(a1 === undefined ? 1 : a1, z); poly(g, [p0, p1, [p1[0] + T[0], p1[1] + T[1]], [p0[0] + T[0], p0[1] + T[1]]], Col.shade(col, 1.08)); };
    // fences
    if (type === WT.PICKET) {
      line(g, F(0, 0.32), F(1, 0.32), Col.shade('#e8e8e0', fac), 2);
      line(g, F(0, 0.68), F(1, 0.68), Col.shade('#e8e8e0', fac), 2);
      for (let k = 0; k < 6; k++) {
        const a = (k + 0.5) / 6;
        const b = F(a, 0), t = F(a, 0.88);
        line(g, b, t, Col.shade('#f0f0e8', fac), 3);
        g.fillStyle = '#f8f8f0'; g.fillRect(t[0] - 1, t[1] - 2, 2, 2);
      }
      return;
    }
    if (type === WT.CHAIN) {
      const top = 1.8;
      g.save();
      poly(g, [F(0, 0), F(1, 0), F(1, top), F(0, top)], 'rgba(150,160,165,0.13)');
      g.clip();
      g.strokeStyle = 'rgba(170,178,182,0.55)'; g.lineWidth = 1;
      for (let k = -6; k < 12; k++) {
        g.beginPath(); const a = F(k / 6, 0), b = F(k / 6 + 0.5, top); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        g.beginPath(); const c = F(k / 6 + 0.5, 0), e = F(k / 6, top); g.moveTo(c[0], c[1]); g.lineTo(e[0], e[1]); g.stroke();
      }
      g.restore();
      line(g, F(0, 0), F(0, top), '#8a9094', 2); line(g, F(1, 0), F(1, top), '#8a9094', 2);
      line(g, F(0, top), F(1, top), '#9aa0a4', 2);
      return;
    }
    if (type === WT.WOODFENCE) {
      const top = cut ? 1.8 : 1.8;
      const bc = '#8a6a48';
      quad(0, 1, 0, top, Col.shade(bc, fac));
      for (let k = 1; k < 8; k++) line(g, F(k / 8, 0), F(k / 8, top), Col.shade(bc, fac * 0.75), 1);
      for (let k = 0; k < 8; k++) { const t = F((k + 0.5) / 8, top); g.fillStyle = Col.shade(bc, 0.9); g.fillRect(t[0] - 2, t[1] - 2, 4, 2); }
      line(g, F(0, 0.4), F(1, 0.4), Col.shade(bc, fac * 0.6), 1);
      line(g, F(0, 1.4), F(1, 1.4), Col.shade(bc, fac * 0.6), 1);
      return;
    }
    if (type === WT.LOG) {
      for (let k = 0; k < 4; k++) { const z = 0.18 + k * 0.3; line(g, F(0.02, z), F(0.98, z), Col.shade(k & 1 ? '#7a5a38' : '#6a4a2a', fac), 9); }
      return;
    }
    // solid walls
    let hasOpening = false, oa0 = 0, oa1 = 1, oz0 = 0, oz1 = 0;
    if (f) {
      if (f.k === 'door' || f.k === 'doorway') { hasOpening = true; oa0 = f.style === 'garage' ? 0.03 : 0.18; oa1 = f.style === 'garage' ? 0.97 : 0.82; oz0 = 0; oz1 = f.style === 'garage' ? 1.9 : 2.0; }
      else if (f.k === 'window') { hasOpening = !cut; if (f.big) { oa0 = 0.05; oa1 = 0.95; oz0 = 0.3; oz1 = 2.1; } else { oa0 = 0.22; oa1 = 0.78; oz0 = 0.95; oz1 = 2.0; } }
    }
    if (cut && f && (f.k === 'door' || f.k === 'doorway')) {
      quad(0, oa0, 0, hz, fcol); quad(oa1, 1, 0, hz, fcol);
      cap(hz, 0, oa0); cap(hz, oa1, 1);
      return;
    }
    quad(0, 1, 0, hz, fcol);
    // texture
    if (!cut) {
      if (type === WT.EXT) for (let z = 0.25; z < hz; z += 0.25) line(g, F(0, z), F(1, z), Col.shade(col, fac * 0.86), 1);
      else if (type === WT.BRICK) {
        for (let z = 0.16, r = 0; z < hz; z += 0.16, r++) {
          line(g, F(0, z), F(1, z), Col.shade(col, fac * 0.7), 1);
          for (let a = (r & 1) ? 0.125 : 0; a < 1; a += 0.25) line(g, F(a, z - 0.16), F(a, z), Col.shade(col, fac * 0.72), 1);
        }
      } else if (type === WT.INT) {
        quad(0, 1, 0, 0.12, Col.shade(Col.mix(col, '#3a2a1a', 0.5), fac));
      } else if (type === WT.BUILT) {
        for (let k = 1; k < 6; k++) line(g, F(k / 6, 0), F(k / 6, hz), Col.shade(col, fac * 0.7), 1);
        for (let k = 0; k < 6; k++) { const p = F((k + 0.5) / 6, 0.4); g.fillStyle = '#555'; g.fillRect(p[0], p[1], 1, 1); }
      }
    }
    cap(hz);
    if (!hasOpening) return;
    // cut out opening
    g.save();
    g.globalCompositeOperation = 'destination-out';
    poly(g, [F(oa0, oz0), F(oa1, oz0), F(oa1, oz1), F(oa0, oz1)], '#000');
    g.restore();
    // inner jamb (depth)
    const jc = Col.shade(col, fac * 0.6);
    const a0 = F(oa0, oz0), a1 = F(oa0, oz1);
    poly(g, [a0, a1, [a1[0] + T[0], a1[1] + T[1]], [a0[0] + T[0], a0[1] + T[1]]], jc);
    const b0 = F(oa0, oz1), b1 = F(oa1, oz1);
    poly(g, [b0, b1, [b1[0] + T[0], b1[1] + T[1]], [b0[0] + T[0], b0[1] + T[1]]], Col.shade(col, fac * 0.5));
    const frameCol = Col.shade(f.k === 'window' ? '#e8e4dc' : '#d8d0c0', fac);
    if (f.k === 'doorway') {
      line(g, F(oa0, 0), F(oa0, oz1), frameCol, 2); line(g, F(oa1, 0), F(oa1, oz1), frameCol, 2); line(g, F(oa0, oz1), F(oa1, oz1), frameCol, 2);
      return;
    }
    if (f.k === 'door') {
      const dc = f.col || '#7a5a3a';
      if (f.style === 'garage') {
        if (!f.open && !f.broken) {
          quad(oa0, oa1, 0, oz1, Col.shade(dc, fac));
          for (let z = 0.38; z < oz1; z += 0.38) line(g, F(oa0, z), F(oa1, z), Col.shade(dc, fac * 0.75), 1);
        } else quad(oa0, oa1, oz1 - 0.15, oz1, Col.shade(dc, fac * 0.9));
      } else if (!f.open && !f.broken) {
        if (f.glass) {
          quad(oa0, oa1, 0, oz1, 'rgba(150,190,215,0.42)');
          line(g, F(oa0 + 0.02, 0), F(oa0 + 0.02, oz1), '#5a5f64', 2); line(g, F(oa1 - 0.02, 0), F(oa1 - 0.02, oz1), '#5a5f64', 2);
          line(g, F(oa0, oz1 - 0.04), F(oa1, oz1 - 0.04), '#5a5f64', 2); line(g, F(oa0, 0.03), F(oa1, 0.03), '#5a5f64', 3);
          line(g, F(oa1 - 0.12, 1.0), F(oa1 - 0.12, 1.2), '#c0c4c8', 2);
        } else {
          quad(oa0, oa1, 0, oz1, Col.shade(dc, fac));
          poly(g, [F(oa0 + 0.08, 1.15), F(oa1 - 0.08, 1.15), F(oa1 - 0.08, 1.85), F(oa0 + 0.08, 1.85)], null, Col.shade(dc, fac * 0.7), 1);
          poly(g, [F(oa0 + 0.08, 0.15), F(oa1 - 0.08, 0.15), F(oa1 - 0.08, 0.95), F(oa0 + 0.08, 0.95)], null, Col.shade(dc, fac * 0.7), 1);
          const k = F(oa1 - 0.1, 1.0); g.fillStyle = '#d8c060'; g.fillRect(k[0] - 1, k[1] - 1, 3, 3);
        }
      } else if (f.open && !f.broken) {
        // open panel perpendicular to wall, swinging into the tile
        const hb = F(oa0, 0);
        const V = d ? [0.62 * HTW, 0.62 * HTH] : [-0.62 * HTW, 0.62 * HTH];
        const pc = f.glass ? 'rgba(150,190,215,0.5)' : Col.shade(dc, d ? FACE_S : FACE_E);
        poly(g, [hb, [hb[0] + V[0], hb[1] + V[1]], [hb[0] + V[0], hb[1] + V[1] - oz1 * ZU], [hb[0], hb[1] - oz1 * ZU]], pc, Col.shade(dc, 0.5), 1);
      } else if (f.broken) {
        for (let k = 0; k < 4; k++) { const z = 0.3 + k * 0.4; line(g, F(oa0, z), F(oa0 + 0.08 + (k % 2) * 0.05, z + 0.1), '#5a4030', 2); }
      }
      line(g, F(oa0, 0), F(oa0, oz1), frameCol, 2); line(g, F(oa1, 0), F(oa1, oz1), frameCol, 2); line(g, F(oa0, oz1), F(oa1, oz1), frameCol, 2);
    } else if (f.k === 'window') {
      const gl = 'rgba(150,195,225,0.38)';
      const zm = (oz0 + oz1) / 2;
      if (f.curtains && f.curtainsClosed && !f.smashed) {
        quad(oa0, oa1, oz0, oz1, Col.shade(f.curtCol, fac));
        for (let k = 1; k < 5; k++) { const a = oa0 + (oa1 - oa0) * k / 5; line(g, F(a, oz0), F(a, oz1), Col.shade(f.curtCol, fac * 0.75), 1); }
      } else {
        if (f.curtains) {
          quad(oa0, oa0 + 0.08, oz0, oz1, Col.shade(f.curtCol, fac));
          quad(oa1 - 0.08, oa1, oz0, oz1, Col.shade(f.curtCol, fac));
        }
        if (f.smashed) {
          if (!f.glassOut) {
            const rng = new RNG(7 + (f.big ? 3 : 0));
            for (let k = 0; k < 6; k++) {
              const a = rng.chance(0.5) ? oa0 : oa1, z = rng.f(oz0, oz1);
              const dir = a === oa0 ? 1 : -1;
              poly(g, [F(a, z - 0.12), F(a + dir * rng.f(0.06, 0.18), z), F(a, z + 0.12)], 'rgba(170,210,235,0.6)');
            }
            poly(g, [F(oa0, oz0), F(oa1, oz0), F(oa0 + 0.3, oz0 + 0.15)], 'rgba(170,210,235,0.6)');
          }
        } else if (f.open) {
          quad(oa0, oa1, zm, oz1, gl);
          line(g, F(oa0, zm), F(oa1, zm), frameCol, 2);
        } else {
          quad(oa0, oa1, oz0, oz1, gl);
          // reflections
          line(g, F(oa0 + 0.1, oz1 - 0.15), F(oa0 + 0.3, oz1 - 0.6), 'rgba(255,255,255,0.35)', 2);
          if (!f.big) line(g, F(oa0, zm), F(oa1, zm), frameCol, 2);
          else for (let a = 0.35; a < 1; a += 0.3) line(g, F(a, oz0), F(a, oz1), '#5a5f64', 2);
        }
      }
      line(g, F(oa0, oz0), F(oa0, oz1), frameCol, 2); line(g, F(oa1, oz0), F(oa1, oz1), frameCol, 2);
      line(g, F(oa0, oz1), F(oa1, oz1), frameCol, 2);
      line(g, F(oa0 - 0.03, oz0), F(oa1 + 0.03, oz0), Col.shade('#f0ece4', fac), 3);
    }
    // barricade planks
    const nb = f.barricade || 0;
    if (nb && !cut) {
      const pz0 = f.k === 'window' ? oz0 : 0.25, pz1 = f.k === 'window' ? oz1 : 1.8;
      for (let k = 0; k < nb; k++) {
        const z = pz0 + (pz1 - pz0) * (k + 0.5) / 4 + 0.08;
        const tilt = (k & 1) ? 0.12 : -0.12;
        const p = [F(oa0 - 0.08, z - tilt), F(oa1 + 0.08, z + tilt), F(oa1 + 0.08, z + tilt + 0.17), F(oa0 - 0.08, z - tilt + 0.17)];
        poly(g, p, Col.shade('#b08a5a', fac), Col.shade('#6a4a2a', fac), 1);
        g.fillStyle = '#404040';
        const n1 = F(oa0 - 0.02, z - tilt + 0.08), n2 = F(oa1 + 0.02, z + tilt + 0.08);
        g.fillRect(n1[0], n1[1], 1.5, 1.5); g.fillRect(n2[0], n2[1], 1.5, 1.5);
      }
    }
  },

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
