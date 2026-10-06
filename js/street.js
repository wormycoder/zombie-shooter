'use strict';
// ---------------------------------------------------------------------------
// Street furniture & road detail: signs, traffic lights, poles and wires, litter, cracks.
// Extends OBJ / ObjArt / DECO_ART and defines MapGen.streetPass (called from MapGen.generate).
// All new object types are prefixed st_. Deco codes: 5-10 stop bars, 11-49 street detail.
// ---------------------------------------------------------------------------
const STREET_NAMES = ['Oak St', 'Maple St', 'Route 9', 'Church St', 'Willow St', 'Depot St', 'Birch Ave', 'Cedar Ave', 'Elm Ave', 'Main St', 'Hickory Ave', 'Quarry Rd',
  'Front St', 'Market St', 'Creek Rd', 'Orchard St', 'Ash Ave', 'Millbrook Rd', 'Poplar Ave', 'Spruce Ave'];
// edges: 0 N, 1 W, 2 S, 3 E (same order as the grass fringes)
const ST_EX = [0, -1, 0, 1], ST_EY = [-1, 0, 1, 0];
const ST_DV = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
// deco codes
const SD = {
  STOP: 5, STOP_S_DASH: 9, STOP_W_DASH: 10, SW_CRACK: 11, SW_STAIN: 14, SW_LITTER: 15, SW_VALVE: 16, SW_PATCH: 17,
  MANHOLE: 18, VAULT: 19, DRAIN: 20, CRACK: 24, PATCH: 27, POTHOLE: 29, OIL: 30, TAR: 32, EDGE: 33,
  STALL_V: 37, STALL_U: 38, WSTOP_U: 39, WSTOP_V: 40, SCHOOL: 41, SLOW: 43, LITTER: 45, SKID_U: 46, SKID_V: 47, GLASS: 48, BUS: 49,
};
const ST_STOP_CODE = [5, 6, 7, 8]; // stop bar on edge N, W, S, E

// ---------------------------------------------------------------------------
// Object types
// ---------------------------------------------------------------------------
const ST_NIGHT = 0.6;
Object.assign(OBJ, {
  st_pole: { n: 'Utility Pole', solid: 'circle', rad: 0.12, h: 5.3, fuel: 40,
    emit: (o, x, y, amb, pw) => o.lt && amb < ST_NIGHT && pw ? { x: x + 0.5 + ST_DV[o.lt][0] * 0.9, y: y + 0.5 + ST_DV[o.lt][1] * 0.9, r: 7, p: 0.7, out: true } : null },
  st_signal: { n: 'Traffic Light', solid: 'circle', rad: 0.1, h: 5.0 },
  st_sigpole: { n: 'Signal Pole', solid: 'circle', rad: 0.1, h: 5.0 },
  st_stop: { n: 'Stop Sign', solid: 'circle', rad: 0.06, h: 2.4 },
  st_namesign: { n: 'Street Sign', solid: 'circle', rad: 0.06, h: 2.7 },
  st_sign: { n: 'Road Sign', solid: 'circle', rad: 0.06, h: 2.5, spr: { w: 110, h: 150, ax: 55, ay: 112 } },
  st_welcome: { n: 'Town Sign', solid: true, h: 2.2, fuel: 30, spr: { w: 170, h: 150, ax: 85, ay: 110 } },
  st_newsbox: { n: 'Newspaper Box', solid: 'circle', rad: 0.2, h: 1.05, cont: { type: 'newsbox', cap: 8 } },
  st_mailbin: { n: 'Mail Drop Box', solid: 'circle', rad: 0.22, h: 1.25, cont: { type: 'maildrop', cap: 10 } },
  st_payphone: { n: 'Payphone', solid: 'circle', rad: 0.1, h: 2.1 },
  st_busstop: { n: 'Bus Stop', solid: 'circle', rad: 0.06, h: 2.6 },
  st_shelter: { n: 'Bus Shelter', solid: true, h: 2.4, sit: true,
    emit: (o, x, y, amb, pw) => amb < ST_NIGHT && pw ? { x: x + 0.5, y: y + 0.5, r: 2.6, p: 0.32, out: true } : null },
  st_bin: { n: 'Trash Can', solid: 'circle', rad: 0.19, h: 1.0, cont: { type: 'trash', cap: 15 } },
  st_meter: { n: 'Parking Meter', solid: 'circle', rad: 0.05, h: 1.35 },
  st_tree: { n: 'Street Tree', solid: 'circle', rad: 0.15, h: 4.0, fuel: 55, spr: { w: 200, h: 260, ax: 100, ay: 220 } },
  st_planter: { n: 'Planter', solid: true, h: 0.75 },
  st_bikerack: { n: 'Bike Rack', solid: 'circle', rad: 0.2, h: 0.8 },
  st_vending: { n: 'Vending Machine', solid: true, h: 1.9, cont: { type: 'vending', cap: 24 },
    emit: (o, x, y, amb, pw) => amb < ST_NIGHT && pw ? { x: x + 0.5 + ST_DV[o.dir][0] * 0.6, y: y + 0.5 + ST_DV[o.dir][1] * 0.6, r: 2.4, p: 0.3, out: true } : null },
  st_icechest: { n: 'Ice Chest', solid: true, h: 1.25, cont: { type: 'icechest', cap: 12 } },
  st_dumpster: { n: 'Dumpster', solid: true, h: 1.35, cont: { type: 'dumpster', cap: 50 } },
  st_pallet: { n: 'Pallets', solid: true, h: 0.6, fuel: 25 },
  st_tires: { n: 'Tire Stack', solid: true, h: 1.0, fuel: 45 },
  st_aframe: { n: 'Sidewalk Sign', solid: 'circle', rad: 0.14, h: 0.95, fuel: 6, burnGone: true },
  st_table: { n: 'Patio Table', solid: true, h: 0.8, fuel: 10 },
  st_box: { n: 'Cardboard Boxes', solid: false, h: 0.5, fuel: 8, burnGone: true },
  st_cone: { n: 'Traffic Cone', solid: 'circle', rad: 0.12, h: 0.65 },
  st_sawhorse: { n: 'Police Barricade', solid: true, h: 0.95, fuel: 12 },
  st_jersey: { n: 'Concrete Barrier', solid: true, h: 0.85 },
  st_closed: { n: 'Road Closed Barricade', solid: true, h: 1.6, fuel: 10 },
  st_floodlight: { n: 'Floodlight', solid: 'circle', rad: 0.22, h: 3.2,
    emit: (o, x, y, amb) => amb < ST_NIGHT ? { x: x + 0.5 + ST_DV[o.dir][0] * 2.5, y: y + 0.5 + ST_DV[o.dir][1] * 2.5, r: 8, p: 0.85, out: true } : null },
  st_booth: { n: 'Guard Booth', solid: true, h: 2.3 },
  st_cart: { n: 'Shopping Cart', solid: 'circle', rad: 0.2, h: 0.95 },
  st_corral: { n: 'Cart Return', solid: true, h: 1.05 },
  st_rail: { n: 'Guard Rail', solid: true, h: 0.75 },
  st_lotlight: { n: 'Lot Light', solid: 'circle', rad: 0.1, h: 5.6,
    emit: (o, x, y, amb, pw) => amb < ST_NIGHT && pw ? { x: x + 0.5, y: y + 0.5, r: 8, p: 0.75, out: true } : null },
  st_flagpole: { n: 'Flagpole', solid: 'circle', rad: 0.08, h: 6.4, spr: { w: 110, h: 260, ax: 55, ay: 228 } },
  st_pylon: { n: 'Sign', solid: 'circle', rad: 0.16, h: 5.2, spr: { w: 150, h: 240, ax: 75, ay: 205 },
    emit: (o, x, y, amb, pw) => amb < ST_NIGHT && pw ? { x: x + 0.5, y: y + 0.5, r: 4.5, p: 0.35, out: true } : null },
  st_airpump: { n: 'Air Pump', solid: 'circle', rad: 0.15, h: 1.3 },
  st_propane: { n: 'Propane Cage', solid: true, h: 1.6 },
  st_fountain: { n: 'Drinking Fountain', solid: 'circle', rad: 0.16, h: 0.95, water: 'tap' },
  // invisible anchors along the canopy's south edge; ghost: hint for pickers/menus to ignore them
  st_canopy: { n: 'Gas Station Canopy', solid: false, h: 0.02, ghost: true,
    emit: (o, x, y, amb, pw) => o.part === 0 && amb < ST_NIGHT && pw ? { x: x + (o.cw || 8) / 2, y: y - 1.5, r: 9, p: 0.75, out: true } : null },
  st_column: { n: 'Canopy Column', solid: true, h: 3.1 },
  st_billboard: { n: 'Billboard', solid: 'circle', rad: 0.12, h: 4.6, fuel: 30, spr: { w: 240, h: 250, ax: 120, ay: 205 },
    emit: (o, x, y, amb, pw) => amb < ST_NIGHT && pw ? { x: x + 0.5 + (o.dir === 'E' ? 1 : 0), y: y + 0.5 + (o.dir === 'S' ? 1 : 0), r: 4, p: 0.4, out: true } : null },
});
Object.assign(MOVEABLE, { st_cone: 2, st_sawhorse: 8, st_aframe: 4, st_bin: 6, st_planter: 30, st_cart: 9, st_tires: 20, st_pallet: 15, st_newsbox: 16 });
Object.assign(LOOT, {
  '*.newsbox': { n: [1, 3], empty: 0.2, items: [['Newspaper', 8], ['Magazine', 1]] },
  '*.maildrop': { n: [0, 2], empty: 0.5, items: [['Magazine', 3], ['Newspaper', 2], ['ComicBook', 1], ['Map', 0.4]] },
  '*.vending': { n: [2, 6], empty: 0.15, items: [['Pop', 6], ['PopOrange', 4], ['WaterBottle', 3], ['Crisps', 4], ['Chocolate', 3], ['CandyBar', 3], ['GranolaBar', 2], ['Crackers', 1]] },
  '*.icechest': { n: [0, 3], empty: 0.35, items: [['WaterBottle', 4], ['Pop', 2], ['JuiceBox', 1], ['Beer', 1]] },
  '*.dumpster': { n: [1, 5], empty: 0.12, items: [['@junk', 10], ['GarbageBag', 4], ['Plank', 2], ['EmptyBottle', 3], ['Newspaper', 2], ['Bread', 1], ['RippedSheets', 2], ['LeadPipe', 0.4], ['Nails', 1], ['Twigs', 1]] },
});

// ---------------------------------------------------------------------------
// Runtime helpers (drawing done every frame: wires, signal lamps, sign text, glows, curbs)
// ---------------------------------------------------------------------------
const Street = {
  glows: {},
  // soft additive glow sprite, cached per colour
  glow(col) {
    let c = this.glows[col];
    if (c) return c;
    c = mkCanvas(64, 64);
    const g = c.getContext('2d'), rgb = Col.rgb(col);
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + rgb + ',0.85)'); gr.addColorStop(0.25, 'rgba(' + rgb + ',0.32)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (this.glows[col] = c);
  },
  drawGlow(ctx, col, x, y, r, a) {
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    if (a < 1) ctx.globalAlpha = a;
    ctx.drawImage(this.glow(col), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
  },
  night() { return G.light.amb < ST_NIGHT; },
  // world-px corners of the front face (S or E) of a tile-local box b = [u0, v0, _, u1, v1] drawn at tile corner X,Y
  facePts(X, Y, d, b, a0, a1, z0, z1) {
    if (d === 'S' || d === 'N') { const ua = U.lerp(b[0], b[3], a0), ub = U.lerp(b[0], b[3], a1), v = b[4] + 0.002; return [isoP(X, Y, ua, v, z0), isoP(X, Y, ub, v, z0), isoP(X, Y, ub, v, z1), isoP(X, Y, ua, v, z1)]; }
    const va = U.lerp(b[4], b[1], a0), vb = U.lerp(b[4], b[1], a1), u = b[3] + 0.002;
    return [isoP(X, Y, u, va, z0), isoP(X, Y, u, vb, z0), isoP(X, Y, u, vb, z1), isoP(X, Y, u, va, z1)];
  },
  // will the main pass draw tile (tx,ty) at world-px (TX,TY) this frame? (mirrors Render.frame culling)
  drawn(tx, ty, TX, TY) {
    const R_ = Render, s = R_.scr;
    if (tx < R_.vx0 || ty < R_.vy0 || tx >= R_.vx0 + R_.vw || ty >= R_.vy0 + R_.vh) return false;
    return !(TX < s.L - 110 || TX > s.R + 110 || TY < s.T - 40 || TY > s.B + 280);
  },
  // utility pole wire attachment points (tile-local u, v, z) for a line running along x ('E') or y ('N')
  PW_E: [[0.5, 0.13, 4.8], [0.5, 0.87, 4.8], [0.5, 0.5, 5.22], [0.5, 0.5, 3.78]],
  PW_N: [[0.13, 0.5, 4.8], [0.87, 0.5, 4.8], [0.5, 0.5, 5.22], [0.5, 0.5, 3.78]],
  wpt(o, X, Y, k) {
    const a = (o.dir === 'N' ? this.PW_N : this.PW_E)[k];
    const p = isoP(X, Y, a[0], a[1], a[2]);
    if (o.lean) p[0] += o.lean * a[2] * 3.2;
    return p;
  },
  // sagging wires between this pole and the one at offset (dx, dy)
  wire(ctx, o, X, Y, dx, dy, s, x, y) {
    const q = World.obj(x + dx, y + dy);
    if (!q || q.t !== 'st_pole') return;
    const X2 = X + (dx - dy) * HTW, Y2 = Y + (dx + dy) * HTH;
    const len = Math.sqrt(dx * dx + dy * dy);
    const sag = (0.2 + len * 0.028 + (o.lean || q.lean ? 0.5 : 0)) * ZU;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = this.wpt(o, X, Y, k), b = this.wpt(q, X2, Y2, k);
      ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2, b[0], b[1]);
    }
    ctx.strokeStyle = Col.shade('#2e2b27', Math.max(0.25, s)); ctx.lineWidth = 0.7; ctx.stroke();
    const a = this.wpt(o, X, Y, 3), b = this.wpt(q, X2, Y2, 3);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2.4, b[0], b[1]);
    ctx.strokeStyle = Col.shade('#1c1a18', Math.max(0.25, s)); ctx.lineWidth = 1.15; ctx.stroke();
  },
  // crisp text on a vertical sign face. face 'S' runs along u, 'E' along -v. p: centre point (world px)
  text(ctx, txt, p, face, maxW, size, col, weight) {
    ctx.save();
    if (face === 'S') ctx.transform(0.8944, 0.4472, 0, 1, p[0], p[1]); else ctx.transform(0.8944, -0.4472, 0, 1, p[0], p[1]);
    ctx.font = (weight || 'bold') + ' ' + size.toFixed(2) + 'px Arial, Helvetica, sans-serif';
    const w = ctx.measureText(txt).width;
    if (w > maxW) ctx.scale(maxW / w, 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.fillText(txt, 0, 0.3);
    ctx.restore();
  },
  // ---- curbs: drawn after the floor pass from a per-world mask (sidewalk edges against roads)
  mask: null, maskW: null,
  buildMask() {
    const w = Wd, GW = w.gw || w.w, H = w.h, W = w.w, F = w.floor;
    const m = new Uint8Array(GW * H);
    const low = (f) => f === FL.ASPHALT || f === FL.PARKING;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < GW - 1; x++) {
      const i = y * W + x;
      if (F[i] !== FL.SIDEWALK || w.room[i] >= 0) continue;
      let b = 0;
      if (low(F[i + W])) b |= 1;  // south: face visible
      if (low(F[i + 1])) b |= 2;  // east: face visible
      if (low(F[i - W])) b |= 4;  // north: top edge only
      if (low(F[i - 1])) b |= 8;  // west
      m[y * GW + x] = b;
    }
    this.mask = m; this.maskW = Wd;
  },
  curbHook(ctx, minX, minY, maxX, maxY) {
    if (!Wd) return;
    if (this.maskW !== Wd) this.buildMask();
    const m = this.mask, GW = Wd.gw || Wd.w, hc = 4.2;
    const faceS = new Path2D(), faceE = new Path2D(), lit = new Path2D(), dark = new Path2D();
    let n = 0;
    for (let y = minY; y <= maxY; y++) {
      const row = y * GW;
      for (let x = minX; x <= maxX; x++) {
        const b = m[row + x];
        if (!b) continue;
        n++;
        const X = (x - y) * HTW, Y = (x + y) * HTH;
        if (b & 1) { // S edge: from left corner (x, y+1) to bottom corner (x+1, y+1)
          const ax = X - HTW, ay = Y + HTH, bx = X, by = Y + TH;
          faceS.moveTo(ax, ay); faceS.lineTo(bx, by); faceS.lineTo(bx, by + hc); faceS.lineTo(ax, ay + hc); faceS.closePath();
          lit.moveTo(ax + 1.6, ay - 0.8); lit.lineTo(bx + 1.6, by - 0.8);
        }
        if (b & 2) { // E edge: right corner (x+1, y) to bottom corner (x+1, y+1)
          const ax = X + HTW, ay = Y + HTH, bx = X, by = Y + TH;
          faceE.moveTo(ax, ay); faceE.lineTo(bx, by); faceE.lineTo(bx, by + hc); faceE.lineTo(ax, ay + hc); faceE.closePath();
          lit.moveTo(ax - 1.6, ay - 0.8); lit.lineTo(bx - 1.6, by - 0.8);
        }
        if (b & 4) { lit.moveTo(X - 1.6, Y + 0.8); lit.lineTo(X + HTW - 1.6, Y + HTH + 0.8); dark.moveTo(X, Y); dark.lineTo(X + HTW, Y + HTH); }
        if (b & 8) { lit.moveTo(X + 1.6, Y + 0.8); lit.lineTo(X - HTW + 1.6, Y + HTH + 0.8); dark.moveTo(X, Y); dark.lineTo(X - HTW, Y + HTH); }
      }
    }
    if (!n) return;
    ctx.fillStyle = '#7c7a74'; ctx.fill(faceS);
    ctx.fillStyle = '#66645f'; ctx.fill(faceE);
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(206,204,196,0.75)'; ctx.stroke(lit);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(30,30,32,0.55)'; ctx.stroke(dark);
  },
  // cached 4-way signal head (anchor = hanging point on top); lens centres per visible face, bottom to top
  SIG_LENS: [[[13.2, 28.2], [13.2, 20.9], [13.2, 13.5]], [[22.8, 28.2], [22.8, 20.9], [22.8, 13.5]]],
  sigHead() {
    return Spr.get('st_sighead', 36, 44, 18, 6, (g, ax, ay) => {
      const P = (u, v, z) => isoP(ax, ay, u, v, z), h = 0.78, r = 0.15, col = '#c9a227';
      poly(g, [P(-r, r, -h), P(r, r, -h), P(r, r, 0), P(-r, r, 0)], Col.shade(col, FACE_S));
      poly(g, [P(r, r, -h), P(r, -r, -h), P(r, -r, 0), P(r, r, 0)], Col.shade(col, FACE_E));
      poly(g, [P(-r, -r, 0), P(r, -r, 0), P(r, r, 0), P(-r, r, 0)], Col.shade(col, 1.05));
      poly(g, [P(-r, r, -h), P(r, r, -h), P(r, -r, -h), P(r, -r, 0), P(-r, -r, 0), P(-r, r, 0)], null, 'rgba(0,0,0,0.4)', 1);
      const base = ['#123a1e', '#4a3a12', '#4a1612'];
      for (let f = 0; f < 2; f++) for (let k = 0; k < 3; k++) {
        const L = this.SIG_LENS[f][k];
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.ellipse(L[0], L[1] - 0.6, 3, 3.1, 0, Math.PI, 0); g.fill();
        g.fillStyle = base[k]; g.beginPath(); g.ellipse(L[0], L[1], 2.2, 2.4, 0, 0, 7); g.fill();
      }
      line(g, P(0, 0, 0), P(0, 0, 0.12), '#2a2a2a', 1.5);
    });
  },
  // waving flag: 8 cached frames warped column by column from a flat flag
  flag(k) {
    return Spr.get('st_flag' + k, 40, 30, 1, 2, (g) => {
      if (!this.flagSrc) {
        const c = mkCanvas(30, 18), f = c.getContext('2d');
        for (let s = 0; s < 7; s++) { f.fillStyle = s & 1 ? '#f2f0ea' : '#b8282e'; f.fillRect(0, s * 18 / 7, 30, 18 / 7 + 0.5); }
        f.fillStyle = '#2a3a78'; f.fillRect(0, 0, 13, 9.6);
        f.fillStyle = '#f2f0ea'; for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) f.fillRect(1.3 + x * 2.4 + (y & 1) * 1.2, 1.2 + y * 2.2, 0.9, 0.9);
        this.flagSrc = c;
      }
      const ph = k / 8 * Math.PI * 2;
      for (let x = 0; x < 30; x++) { const f = x / 29, off = Math.sin(f * 5.5 - ph) * 2.4 * f + f * 2.5; g.drawImage(this.flagSrc, x, 0, 1, 18, 1 + x, 2 + off, 1, 18); }
      g.globalCompositeOperation = 'source-atop';
      for (let x = 0; x < 30; x++) { const f = x / 29; g.fillStyle = 'rgba(0,0,0,' + (0.2 * (0.5 + 0.5 * Math.cos(f * 5.5 - ph)) * f).toFixed(3) + ')'; g.fillRect(1 + x, 0, 1, 30); }
      g.globalCompositeOperation = 'source-over';
    });
  },
  // traffic signal colours for a phase: [north-south, east-west], 0 red 1 yellow 2 green.
  // 22 s cycle: NS green, NS yellow, all red, EW green, EW yellow (then NS again)
  sigState(t, ph) {
    const c = (t + ph * 1.7) % 22;
    const ns = c < 9 ? 2 : c < 11.5 ? 1 : 0;
    const ew = c >= 12 && c < 20 ? 2 : c >= 20 ? 1 : 0;
    return [ns, ew];
  },
};
// register the curb painter once render.js has defined FLOOR_HOOKS
document.addEventListener('DOMContentLoaded', () => { if (typeof FLOOR_HOOKS !== 'undefined') FLOOR_HOOKS.push((ctx, a, b, c, d) => Street.curbHook(ctx, a, b, c, d)); });

// ---------------------------------------------------------------------------
// Road paint and surface decals (cached once per code on a 66x34 tile canvas)
// ---------------------------------------------------------------------------
const ST_WHITE = 'rgba(228,228,220,0.84)', ST_YEL = 'rgba(216,176,40,0.86)';
const stQ = (P, u0, v0, u1, v1) => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
// band along edge e (0 N, 1 W, 2 S, 3 E): a0..a1 along the edge, d0..d1 depth into the tile
function stEdgeQ(P, e, a0, a1, d0, d1) {
  if (e === 0) return stQ(P, a0, d0, a1, d1);
  if (e === 2) return stQ(P, a0, 1 - d1, a1, 1 - d0);
  if (e === 1) return stQ(P, d0, a0, d1, a1);
  return stQ(P, 1 - d1, a0, 1 - d0, a1);
}
const stEdgeUV = (e, a, d) => e === 0 ? [a, d] : e === 2 ? [a, 1 - d] : e === 1 ? [d, a] : [1 - d, a];
// chip worn paint off with transparent specks
function stWear(g, P, rng, n, sz) {
  g.save(); g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) {
    const p = P(rng.next(), rng.next());
    g.fillStyle = 'rgba(0,0,0,' + rng.f(0.35, 0.95).toFixed(2) + ')';
    g.fillRect(p[0], p[1], rng.f(1, sz), rng.f(1, sz * 0.6));
  }
  g.restore();
}
function stClip(g, P) { g.save(); const a = P(0, 0), b = P(1, 0), c = P(1, 1), d = P(0, 1); g.beginPath(); g.moveTo(a[0], a[1] - 0.5); g.lineTo(b[0] + 0.5, b[1]); g.lineTo(c[0], c[1] + 0.5); g.lineTo(d[0] - 0.5, d[1]); g.closePath(); g.clip(); }
// random-walk crack from (u,v) heading (du,dv)
function stCrack(g, P, rng, u, v, du, dv, n, col, w) {
  const pts = [[u, v]];
  for (let k = 0; k < n; k++) { u += du + rng.f(-0.06, 0.06); v += dv + rng.f(-0.06, 0.06); pts.push([u, v]); }
  g.strokeStyle = 'rgba(150,150,146,0.25)'; g.lineWidth = w + 0.6; g.beginPath();
  pts.forEach((q, i) => { const p = P(q[0], q[1]); if (i) g.lineTo(p[0], p[1] + 0.8); else g.moveTo(p[0], p[1] + 0.8); }); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.beginPath();
  pts.forEach((q, i) => { const p = P(q[0], q[1]); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
  return pts;
}
function stBlob(g, P, cu, cv, ru, rv, rng, n) {
  g.beginPath();
  for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, f = k === n ? 1 : rng.f(0.7, 1.15); const p = P(cu + Math.cos(a) * ru * f, cv + Math.sin(a) * rv * f); if (k) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
  g.closePath();
}
// painted word on the ground for westbound drivers, spanning the two lanes (k = 0 southern tile, 1 northern):
// the text advances north across the lanes (-v), the glyphs stretch along the travel axis (+u is "down")
function stWord(g, P, word, k) {
  stClip(g, P);
  const o = P(0.12, 1 + k);
  g.setTransform(0.32, -0.16, 0.32, 0.16, o[0], o[1]);
  g.font = 'bold 92px Arial, Helvetica, sans-serif';
  const w = g.measureText(word).width;
  g.scale(184 / w, 1);
  g.fillStyle = ST_WHITE; g.textBaseline = 'top';
  g.fillText(word, 8 * w / 184, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.restore();
}
Object.assign(DECO_ART, {
  // lane dashes & crosswalks, now with worn paint
  1: (g, P) => { poly(g, stQ(P, 0.1, 0.9, 0.9, 1), ST_YEL); stWear(g, P, new RNG(11), 20, 3); },
  2: (g, P) => { poly(g, stQ(P, 0.9, 0.1, 1, 0.9), ST_YEL); stWear(g, P, new RNG(12), 20, 3); },
  3: (g, P) => { for (const v0 of [0.12, 0.62]) poly(g, stQ(P, 0.04, v0, 0.96, v0 + 0.26), ST_WHITE); stWear(g, P, new RNG(13), 55, 2.4); },
  4: (g, P) => { for (const u0 of [0.12, 0.62]) poly(g, stQ(P, u0, 0.04, u0 + 0.26, 0.96), ST_WHITE); stWear(g, P, new RNG(14), 55, 2.4); },
  // utility, drainage and damage
  [SD.MANHOLE]: (g, P) => {
    const c = P(0.5, 0.5);
    g.fillStyle = 'rgba(20,20,20,0.35)'; g.beginPath(); g.ellipse(c[0], c[1] + 1, 12, 6.2, 0, 0, 7); g.fill();
    g.fillStyle = '#3c3b39'; g.beginPath(); g.ellipse(c[0], c[1], 11, 5.6, 0, 0, 7); g.fill();
    g.strokeStyle = '#5c5a56'; g.lineWidth = 1; g.beginPath(); g.ellipse(c[0], c[1], 11, 5.6, 0, 0, 7); g.stroke();
    g.strokeStyle = '#4c4a47'; g.beginPath(); g.ellipse(c[0], c[1], 7.5, 3.8, 0, 0, 7); g.stroke();
    for (let k = -2; k <= 2; k++) { g.fillStyle = '#262524'; g.fillRect(c[0] + k * 3 - 0.5, c[1] - 0.5, 1.4, 1.2); }
    g.fillStyle = '#6a6862'; g.fillRect(c[0] - 4, c[1] - 3, 8, 1);
  },
  [SD.VAULT]: (g, P) => {
    poly(g, stQ(P, 0.3, 0.32, 0.7, 0.68), '#595a5b', '#3a3a3a', 1);
    g.strokeStyle = 'rgba(140,140,140,0.5)'; g.lineWidth = 1;
    for (let k = 1; k < 5; k++) { const a = P(0.3 + k * 0.08, 0.34), b = P(0.3 + k * 0.08, 0.66); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    const h = P(0.62, 0.5); g.fillStyle = '#2a2a2a'; g.fillRect(h[0] - 1, h[1] - 1, 3, 2);
  },
  [SD.POTHOLE]: (g, P) => {
    const rng = new RNG(29);
    stBlob(g, P, 0.5, 0.52, 0.26, 0.2, rng, 11); g.fillStyle = '#2a2b2d'; g.fill();
    stBlob(g, P, 0.5, 0.55, 0.18, 0.13, rng, 9); g.fillStyle = '#1c1d1f'; g.fill();
    stBlob(g, P, 0.47, 0.47, 0.27, 0.21, rng, 11); g.strokeStyle = 'rgba(110,110,108,0.6)'; g.lineWidth = 1; g.stroke();
    for (let k = 0; k < 14; k++) { const p = P(rng.f(0.25, 0.75), rng.f(0.3, 0.75)); g.fillStyle = rng.pick(['#6a6a68', '#4a4a4a', '#7a7470']); g.fillRect(p[0], p[1], 1.5, 1); }
  },
  [SD.TAR]: (g, P) => {
    const rng = new RNG(32);
    stCrack(g, P, rng, 0.05, rng.f(0.3, 0.7), 0.09, 0.0, 10, 'rgba(18,18,20,0.85)', 2);
    stCrack(g, P, rng, rng.f(0.3, 0.6), 0.1, 0.0, 0.09, 8, 'rgba(18,18,20,0.75)', 1.6);
  },
  [SD.BUS]: (g, P) => {
    // yellow box marking a bus loading zone
    g.strokeStyle = ST_YEL; g.lineWidth = 1.6; poly(g, stQ(P, 0.06, 0.06, 0.94, 0.94), null, ST_YEL, 1.6);
    g.beginPath(); const a = P(0.06, 0.06), b = P(0.94, 0.94), c = P(0.94, 0.06), d = P(0.06, 0.94); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke();
    stWear(g, P, new RNG(49), 30, 3);
  },
  [SD.LITTER]: (g, P) => {
    const n = P(0.32, 0.4);
    poly(g, [[n[0] - 7, n[1]], [n[0] + 2, n[1] - 4], [n[0] + 9, n[1]], [n[0], n[1] + 4]], '#d8d4c8');
    g.fillStyle = '#8a8680'; for (let k = 0; k < 3; k++) g.fillRect(n[0] - 3 + k * 2, n[1] - 1 + k, 4, 0.8);
    const c = P(0.68, 0.62); g.fillStyle = '#b02020'; g.fillRect(c[0], c[1], 4, 2); g.fillStyle = '#d0d0d0'; g.fillRect(c[0] + 4, c[1], 1, 2);
    const q = P(0.55, 0.25); g.fillStyle = '#ece8e0'; g.fillRect(q[0], q[1], 3, 2);
  },
  [SD.GLASS]: (g, P) => {
    const rng = new RNG(48);
    for (let k = 0; k < 40; k++) { const p = P(rng.f(0.1, 0.9), rng.f(0.1, 0.9)); g.fillStyle = rng.pick(['rgba(190,225,240,0.9)', 'rgba(240,250,255,0.8)', 'rgba(150,190,210,0.8)']); g.fillRect(p[0], p[1], rng.f(1, 2.2), 1); }
    for (let k = 0; k < 5; k++) { const p = P(rng.f(0.2, 0.8), rng.f(0.2, 0.8)); g.fillStyle = rng.pick(['#a02020', '#d0a020', '#202020']); g.fillRect(p[0], p[1], 3, 1.5); }
    const h = P(0.7, 0.35); g.fillStyle = '#9aa0a4'; g.beginPath(); g.ellipse(h[0], h[1], 5, 2.6, 0, 0, 7); g.fill(); g.fillStyle = '#5a5e62'; g.beginPath(); g.ellipse(h[0], h[1], 2, 1, 0, 0, 7); g.fill();
  },
  // parking lots
  [SD.STALL_V]: (g, P) => { poly(g, stQ(P, 0.465, 0, 0.535, 1), ST_WHITE); stWear(g, P, new RNG(37), 12, 2); },
  [SD.STALL_U]: (g, P) => { poly(g, stQ(P, 0, 0.465, 1, 0.535), ST_WHITE); stWear(g, P, new RNG(38), 12, 2); },
  [SD.WSTOP_U]: (g, P, ax, ay) => { const Q = (u, v, z) => isoP(ax, ay, u, v, z); stBar(g, Q, 0.2, 0.76, 0.8, 0.88); },
  [SD.WSTOP_V]: (g, P, ax, ay) => { const Q = (u, v, z) => isoP(ax, ay, u, v, z); stBar(g, Q, 0.76, 0.2, 0.88, 0.8); },
  // words
  [SD.SCHOOL]: (g, P) => stWord(g, P, 'SCHOOL', 0),
  [SD.SCHOOL + 1]: (g, P) => stWord(g, P, 'SCHOOL', 1),
  [SD.SLOW]: (g, P) => stWord(g, P, 'SLOW', 0),
  [SD.SLOW + 1]: (g, P) => stWord(g, P, 'SLOW', 1),
  [SD.SKID_U]: (g, P) => stSkid(g, P, false),
  [SD.SKID_V]: (g, P) => stSkid(g, P, true),
});
// concrete wheel stop (a low bar)
function stBar(g, Q, u0, v0, u1, v1) {
  const h = 0.08;
  poly(g, [Q(u0, v1, 0), Q(u1, v1, 0), Q(u1, v1, h), Q(u0, v1, h)], '#9a978f');
  poly(g, [Q(u1, v1, 0), Q(u1, v0, 0), Q(u1, v0, h), Q(u1, v1, h)], '#86837c');
  poly(g, [Q(u0, v0, h), Q(u1, v0, h), Q(u1, v1, h), Q(u0, v1, h)], '#bab6ad');
  g.fillStyle = 'rgba(0,0,0,0.25)'; const a = Q(u0, v1, 0), b = Q(u1, v1, 0); g.fillRect(Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.abs(b[0] - a[0]), 1);
}
function stSkid(g, P, alongV) {
  for (const off of [0.32, 0.68]) {
    for (let k = 0; k < 10; k++) {
      const t0 = k / 10, t1 = (k + 1) / 10, wob = Math.sin(k * 0.7 + off * 9) * 0.03;
      const a = alongV ? P(off + wob, t0) : P(t0, off + wob), b = alongV ? P(off + wob, t1) : P(t1, off + wob);
      g.strokeStyle = 'rgba(14,14,14,' + (0.22 + 0.25 * Math.sin(t0 * Math.PI)).toFixed(2) + ')'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
  }
}
// stop bars (edge e) and the two stop bar + centre dash combinations
for (let e = 0; e < 4; e++) DECO_ART[ST_STOP_CODE[e]] = (g, P) => { poly(g, stEdgeQ(P, e, 0, 1, 0.3, 0.5), ST_WHITE); stWear(g, P, new RNG(50 + e), 24, 2.4); };
DECO_ART[SD.STOP_S_DASH] = (g, P) => { poly(g, stQ(P, 0.9, 0.1, 1, 0.9), ST_YEL); poly(g, stEdgeQ(P, 2, 0, 0.9, 0.3, 0.5), ST_WHITE); stWear(g, P, new RNG(55), 24, 2.4); };
DECO_ART[SD.STOP_W_DASH] = (g, P) => { poly(g, stQ(P, 0.1, 0.9, 0.9, 1), ST_YEL); poly(g, stEdgeQ(P, 1, 0, 0.9, 0.3, 0.5), ST_WHITE); stWear(g, P, new RNG(56), 24, 2.4); };
// sidewalk detail
for (let k = 0; k < 3; k++) DECO_ART[SD.SW_CRACK + k] = (g, P) => {
  const rng = new RNG(300 + k * 17);
  const pts = stCrack(g, P, rng, rng.f(0.1, 0.3), rng.f(0.1, 0.9), 0.1, rng.f(-0.05, 0.05), 6 + k, 'rgba(78,76,70,0.85)', 1);
  if (k === 1) { const q = pts[3]; stCrack(g, P, rng, q[0], q[1], 0.02, 0.09, 3, 'rgba(78,76,70,0.8)', 1); }
  if (k === 2) for (let j = 0; j < 4; j++) { const q = P(pts[2 + j][0], pts[2 + j][1]); g.fillStyle = j & 1 ? '#5a7a3a' : '#6a8a42'; g.fillRect(q[0] - 1, q[1] - 2, 2, 2); }
};
DECO_ART[SD.SW_STAIN] = (g, P) => {
  const rng = new RNG(314);
  for (let k = 0; k < 7; k++) { const p = P(rng.f(0.15, 0.85), rng.f(0.15, 0.85)); g.fillStyle = 'rgba(60,58,54,0.55)'; g.beginPath(); g.ellipse(p[0], p[1], 1.6, 0.9, 0, 0, 7); g.fill(); }
  const c = P(0.4, 0.6); const gr = g.createRadialGradient(c[0], c[1], 1, c[0], c[1], 10); gr.addColorStop(0, 'rgba(110,80,50,0.35)'); gr.addColorStop(1, 'rgba(110,80,50,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(c[0], c[1], 11, 5.5, 0, 0, 7); g.fill();
};
DECO_ART[SD.SW_LITTER] = (g, P) => {
  DECO_ART[SD.LITTER](g, P);
  const rng = new RNG(315);
  for (let k = 0; k < 4; k++) { const p = P(rng.f(0.2, 0.8), rng.f(0.2, 0.8)); g.fillStyle = '#e8e2d0'; g.fillRect(p[0], p[1], 2, 1); g.fillStyle = '#c87a3a'; g.fillRect(p[0] + 2, p[1], 1, 1); }
};
DECO_ART[SD.SW_VALVE] = (g, P) => {
  poly(g, stQ(P, 0.58, 0.3, 0.8, 0.5), '#5e5f5f', '#3c3c3c', 1);
  const c = P(0.32, 0.62); g.fillStyle = '#4a4a4a'; g.beginPath(); g.ellipse(c[0], c[1], 4, 2, 0, 0, 7); g.fill(); g.strokeStyle = '#2a2a2a'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#7a7a7a'; g.fillRect(c[0] - 2, c[1] - 0.5, 4, 1);
};
DECO_ART[SD.SW_PATCH] = (g, P) => { poly(g, stQ(P, 0.02, 0.02, 0.5, 0.98), 'rgba(196,192,184,0.55)'); line(g, P(0.5, 0.02), P(0.5, 0.98), 'rgba(80,78,72,0.5)', 1); };
// storm drains: grate in the gutter along curb edge e
for (let e = 0; e < 4; e++) DECO_ART[SD.DRAIN + e] = (g, P) => {
  poly(g, stEdgeQ(P, e, 0.18, 0.82, 0, 0.3), '#6e6c66');
  poly(g, stEdgeQ(P, e, 0.24, 0.76, 0.03, 0.24), '#151516');
  for (let k = 1; k < 7; k++) { const a = 0.24 + k * 0.52 / 7; const s0 = stEdgeUV(e, a, 0.04), s1 = stEdgeUV(e, a, 0.23); line(g, P(s0[0], s0[1]), P(s1[0], s1[1]), '#5a5a5c', 1); }
};
// asphalt cracks
for (let k = 0; k < 3; k++) DECO_ART[SD.CRACK + k] = (g, P) => {
  const rng = new RNG(240 + k * 31), col = 'rgba(22,22,24,0.8)';
  if (k === 0) { const pts = stCrack(g, P, rng, 0.05, rng.f(0.3, 0.7), 0.11, rng.f(-0.03, 0.03), 8, col, 1.2); stCrack(g, P, rng, pts[4][0], pts[4][1], 0.03, 0.08, 3, col, 1); }
  else if (k === 1) {
    // alligator cracking
    for (let j = 0; j < 9; j++) { const u = rng.f(0.25, 0.7), v = rng.f(0.25, 0.7); stCrack(g, P, rng, u, v, rng.f(-0.08, 0.08), rng.f(-0.08, 0.08), 2, col, 1); }
    stBlob(g, P, 0.48, 0.48, 0.26, 0.24, rng, 10); g.fillStyle = 'rgba(30,30,32,0.12)'; g.fill();
  } else stCrack(g, P, rng, rng.f(0.3, 0.7), 0.04, rng.f(-0.03, 0.03), 0.11, 8, col, 1.3);
};
for (let k = 0; k < 2; k++) DECO_ART[SD.PATCH + k] = (g, P) => {
  const rng = new RNG(270 + k);
  const q = k ? stQ(P, 0.15, 0.08, 0.85, 0.62) : stQ(P, 0.06, 0.3, 0.7, 0.9);
  poly(g, q, k ? '#3a3b3e' : '#525356', 'rgba(14,14,16,0.7)', 1.2);
  for (let j = 0; j < 30; j++) { const p = P(rng.f(0.15, 0.7), rng.f(0.3, 0.8)); g.fillStyle = k ? '#45464a' : '#5e5f62'; g.fillRect(p[0], p[1], 1, 1); }
};
for (let k = 0; k < 2; k++) DECO_ART[SD.OIL + k] = (g, P) => {
  const rng = new RNG(300 + k * 7);
  for (let j = 0; j < (k ? 3 : 2); j++) {
    const c = P(rng.f(0.3, 0.7), rng.f(0.3, 0.7)), r = rng.f(5, 10);
    const gr = g.createRadialGradient(c[0], c[1], 0.5, c[0], c[1], r);
    gr.addColorStop(0, 'rgba(12,12,14,0.5)'); gr.addColorStop(0.6, 'rgba(20,20,26,0.3)'); gr.addColorStop(1, 'rgba(20,20,30,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(c[0], c[1], r * 1.4, r * 0.7, 0, 0, 7); g.fill();
  }
  if (k) { const c = P(0.5, 0.5); g.strokeStyle = 'rgba(120,90,160,0.18)'; g.lineWidth = 1; g.beginPath(); g.ellipse(c[0], c[1], 9, 4, 0.2, 0, 7); g.stroke(); }
};
// rural edge: white fog line and crumbling asphalt along edge e
for (let e = 0; e < 4; e++) DECO_ART[SD.EDGE + e] = (g, P) => {
  const rng = new RNG(330 + e);
  poly(g, stEdgeQ(P, e, 0, 1, 0.2, 0.26), 'rgba(222,222,214,0.7)');
  stWear(g, P, rng, 18, 3);
  for (let k = 0; k < 22; k++) {
    const q = stEdgeUV(e, rng.next(), rng.f(0, 0.18)), p = P(q[0], q[1]);
    g.fillStyle = rng.pick(['#8a8478', '#6e6a62', '#3a3b3d', '#9a9488']); g.fillRect(p[0], p[1], rng.f(1, 2.5), rng.f(1, 1.6));
  }
  for (let k = 0; k < 3; k++) { const a = rng.f(0.1, 0.8), q = stEdgeUV(e, a, 0.06), q2 = stEdgeUV(e, a + 0.1, 0.13); line(g, P(q[0], q[1]), P(q2[0], q2[1]), 'rgba(20,20,22,0.6)', 1); }
};

// ---------------------------------------------------------------------------
// Object painters
// ---------------------------------------------------------------------------
const ST_SNOW = '#eef2f6';
const stSnowy = () => Season.snow > 0.3;
// darker / lighter variant of a hex colour, still hex (box and cylinder painters shade it again)
const stTone = (hex, f) => f < 1 ? Col.mix(hex, '#000000', 1 - f) : Col.mix(hex, '#ffffff', f - 1);
Object.assign(ObjArt, {
  // ---- helpers
  // vertical cylinder at (u,v) radius r (tiles), lit from the left
  stCyl(u, v, r, z0, z1, col, topCol) {
    const g = this.g, c0 = this.P(u, v, z0), c1 = this.P(u, v, z1), rx = r * 45.25, ry = r * 22.63;
    const gr = g.createLinearGradient(c0[0] - rx, 0, c0[0] + rx, 0);
    gr.addColorStop(0, Col.shade(col, 0.82)); gr.addColorStop(0.35, Col.shade(col, 0.98)); gr.addColorStop(1, Col.shade(col, 0.58));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(c0[0] - rx, c1[1]); g.lineTo(c0[0] - rx, c0[1]); g.ellipse(c0[0], c0[1], rx, ry, 0, Math.PI, 0, true); g.lineTo(c0[0] + rx, c1[1]); g.closePath(); g.fill();
    g.fillStyle = topCol || Col.shade(col, 1.08); g.beginPath(); g.ellipse(c1[0], c1[1], rx, ry, 0, 0, 7); g.fill();
  },
  stShadow(u, v, rx, ry, a) { const c = this.P(u, v, 0); this.g.fillStyle = 'rgba(0,0,0,' + (a || 0.22) + ')'; this.g.beginPath(); this.g.ellipse(c[0] + 2, c[1] + 1, rx, ry, 0, 0, 7); this.g.fill(); },
  stPost(u, v, z0, z1, w, col) { line(this.g, this.P(u, v, z0), this.P(u, v, z1), col, w); },
  // point on a vertical plate centred at (u,v) facing dir: s along the plate (screen left->right for S/E), z up
  stPl(dir, u, v, s, z) { return dir === 'S' || dir === 'N' ? this.P(u + s, v, z) : this.P(u, v - s, z); },
  stPlate(dir, u, v, s0, s1, z0, z1, col, stroke) { poly(this.g, [this.stPl(dir, u, v, s0, z0), this.stPl(dir, u, v, s1, z0), this.stPl(dir, u, v, s1, z1), this.stPl(dir, u, v, s0, z1)], col, stroke, 1); },
  stSnowTop(u0, v0, u1, v1, z) { if (!stSnowy()) return; poly(this.g, [this.P(u0 + 0.02, v0 + 0.02, z + 0.02), this.P(u1 - 0.02, v0 + 0.02, z + 0.02), this.P(u1, v1, z + 0.03), this.P(u0, v1, z + 0.03)], ST_SNOW); },
  stFront: (dir) => dir === 'S' || dir === 'E',
  // ---- utility pole: tapered wooden pole, crossarm, insulators, optional transformer / street light / lean
  d_st_pole(o) {
    const g = this.g, lean = (o.lean || 0) * 3.2, ew = o.dir !== 'N', ax = this.ax, ay = this.ay;
    const Q = (u, v, z) => { const p = isoP(ax, ay, u, v, z); p[0] += lean * z; return p; };
    this.stShadow(0.5, 0.5, 7, 3.2);
    if (o.lean) { const c = this.P(0.5, 0.5, 0); g.fillStyle = 'rgba(70,52,34,0.55)'; g.beginPath(); g.ellipse(c[0] - 2, c[1] + 1, 9, 4, 0, 0, 7); g.fill(); }
    const b = Q(0.5, 0.5, 0), t = Q(0.5, 0.5, 5.25), wc = '#6e5d4a';
    poly(g, [[b[0] - 3.4, b[1]], [b[0], b[1] + 1.4], [t[0], t[1] + 0.8], [t[0] - 2.2, t[1]]], Col.shade(wc, 0.95));
    poly(g, [[b[0], b[1] + 1.4], [b[0] + 3.4, b[1]], [t[0] + 2.2, t[1]], [t[0], t[1] + 0.8]], Col.shade(wc, 0.66));
    for (let k = 0; k < 3; k++) { const z0 = 0.4 + k * 1.5, a = Q(0.5, 0.5, z0), c = Q(0.5, 0.5, z0 + 0.9); line(g, [a[0] - 1.4 + k, a[1]], [c[0] - 1.2 + k, c[1]], 'rgba(40,30,20,0.35)', 0.8); }
    // climbing steps & number tag
    for (let k = 0; k < 6; k++) { const p = Q(0.5, 0.5, 2.3 + k * 0.32); g.fillStyle = '#3a3634'; g.fillRect(p[0] + (k & 1 ? 2 : -4), p[1], 2, 1); }
    const tg = Q(0.5, 0.5, 1.55); g.fillStyle = '#c8ccd0'; g.fillRect(tg[0] - 2, tg[1], 3, 2);
    // crossarm with braces
    const arm = ew ? [[0.5, 0.08], [0.5, 0.92]] : [[0.08, 0.5], [0.92, 0.5]];
    const za = 4.72;
    const a0 = Q(arm[0][0], arm[0][1], za), a1 = Q(arm[1][0], arm[1][1], za);
    line(g, a0, a1, '#5a4836', 4); line(g, [a0[0], a0[1] - 1.5], [a1[0], a1[1] - 1.5], '#7a6650', 1.5);
    for (const f of [0.28, 0.72]) { const m = ew ? Q(0.5, f, za) : Q(f, 0.5, za); line(g, Q(0.5, 0.5, 4.25), m, '#3c3a38', 1); }
    // insulators
    const ins = (p) => { g.fillStyle = '#9fb3a8'; g.fillRect(p[0] - 1.5, p[1] - 4, 3, 4); g.fillStyle = '#c8d8cc'; g.fillRect(p[0] - 1.5, p[1] - 4, 1, 4); };
    ins(ew ? Q(0.5, 0.13, za + 0.05) : Q(0.13, 0.5, za + 0.05)); ins(ew ? Q(0.5, 0.87, za + 0.05) : Q(0.87, 0.5, za + 0.05)); ins(Q(0.5, 0.5, 5.25));
    // communication cable clamp
    const cc = Q(0.5, 0.5, 3.78); g.fillStyle = '#222'; g.fillRect(cc[0] - 3, cc[1] - 1, 6, 2);
    if (o.tr) {
      const tu = 0.66, tv = 0.66;
      const sv = this.P; this.P = Q;
      this.stCyl(tu, tv, 0.12, 3.85, 4.4, '#8e9498', '#a8aeb2');
      this.P = sv;
      const tp = Q(tu, tv, 4.4); line(g, tp, ew ? Q(0.5, 0.87, za + 0.15) : Q(0.87, 0.5, za + 0.15), '#2a2a2a', 0.8);
      g.fillStyle = '#d8dcd8'; g.fillRect(tp[0] - 3, tp[1] - 3, 2, 3); g.fillRect(tp[0] + 1, tp[1] - 3, 2, 3);
    }
    if (o.lt) {
      const d = ST_DV[o.lt], hu = 0.5 + d[0] * 0.62, hv = 0.5 + d[1] * 0.62;
      const s0 = Q(0.5, 0.5, 4.05), s1 = Q(0.5 + d[0] * 0.3, 0.5 + d[1] * 0.3, 4.3), h = Q(hu, hv, 4.3);
      g.strokeStyle = '#4a4e52'; g.lineWidth = 2; g.beginPath(); g.moveTo(s0[0], s0[1]); g.quadraticCurveTo(s1[0], s1[1] - 3, h[0], h[1]); g.stroke();
      poly(g, [[h[0] - 5, h[1] - 1], [h[0] + 5, h[1] - 2], [h[0] + 6, h[1] + 1.5], [h[0] - 4, h[1] + 2.5]], '#5a5e62');
      g.fillStyle = '#e8e2c8'; g.fillRect(h[0] - 3, h[1] + 1.5, 7, 1.6);
    }
  },
  k_st_pole: (o) => (o.tr ? 't' : '') + (o.lt || '') + (o.lean ? 'x' + o.lean : ''),
  a_st_pole(ctx, o, X, Y, t, s, x, y) {
    // wires are skipped at low world detail (settings)
    if (Settings.v.detail && o.lx !== undefined) Street.wire(ctx, o, X, Y, o.lx, o.ly, s, x, y);
    if (Settings.v.detail && o.nx !== undefined && !Street.drawn(x + o.nx, y + o.ny, X + (o.nx - o.ny) * HTW, Y + (o.nx + o.ny) * HTH)) Street.wire(ctx, o, X, Y, o.nx, o.ny, s, x, y);
    if (o.lt && Street.night() && !G.events.powerOff) {
      const d = ST_DV[o.lt], h = isoP(X, Y, 0.5 + d[0] * 0.62, 0.5 + d[1] * 0.62, 4.24);
      if (o.lean) h[0] += o.lean * 3.2 * 4.24;
      Street.drawGlow(ctx, '#fff0c0', h[0], h[1] + 2, 16, 0.9);
    }
  },
  // ---- traffic signal: steel pole at one corner, span wire to the opposite corner, 4-way head over the junction
  d_st_signal(o) {
    this.stShadow(0.5, 0.5, 6, 3);
    this.box(0.2, 0.22, 0, 0.42, 0.4, 0.95, '#7d8486');
    this.faceRect('S', [0.2, 0.22, 0, 0.42, 0.4], 0.15, 0.85, 0.15, 0.8, null, '#5a6062');
    this.stSteelPole(5.0);
  },
  d_st_sigpole() { this.stShadow(0.5, 0.5, 6, 3); this.stSteelPole(5.0); },
  stSteelPole(h) {
    const g = this.g, b = this.P(0.5, 0.5, 0), t = this.P(0.5, 0.5, h);
    this.stCyl(0.5, 0.5, 0.09, 0, 0.18, '#6e7476');
    poly(g, [[b[0] - 2.8, b[1] - 5], [b[0], b[1] - 5], [t[0], t[1]], [t[0] - 1.8, t[1]]], '#9ba2a5');
    poly(g, [[b[0], b[1] - 5], [b[0] + 2.8, b[1] - 5], [t[0] + 1.8, t[1]], [t[0], t[1]]], '#70777a');
    g.fillStyle = '#5c6264'; g.beginPath(); g.ellipse(t[0], t[1], 2.2, 1.1, 0, 0, 7); g.fill();
    const pb = this.P(0.5, 0.5, 1.1); g.fillStyle = '#d8b020'; g.fillRect(pb[0] - 2, pb[1] - 3, 4, 4); g.fillStyle = '#222'; g.fillRect(pb[0] - 1, pb[1] - 2, 2, 2);
  },
  a_st_signal(ctx, o, X, Y, t, s, x, y) {
    const fx = o.fx || 5, fy = o.fy || -5, q = World.obj(x + fx, y + fy);
    if (!q || q.t !== 'st_sigpole') return;
    const X2 = X + (fx - fy) * HTW, Y2 = Y + (fx + fy) * HTH;
    const a = isoP(X, Y, 0.5, 0.5, 4.95), b = isoP(X2, Y2, 0.5, 0.5, 4.95), sag = 0.42 * ZU;
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag];
    ctx.strokeStyle = Col.shade('#2a2826', Math.max(0.25, s)); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2, b[0], b[1]); ctx.stroke();
    // head hangs below the lowest point of the wire
    const rec = Street.sigHead();
    const ls = Math.max(s, Render.shadeAt(x + fx / 2, y + fy / 2));
    Spr.drawShaded(ctx, rec, m[0] - rec.ax, m[1] + 2 - rec.ay, ls, 1);
    line(ctx, m, [m[0], m[1] + 3], Col.shade('#222', ls), 1.5);
    if (!World.hasPower(x, y)) return;
    const st = Street.sigState(t, o.ph || 0), cols = ['#ff3a2a', '#ffc21a', '#3aff6a'], gl = ['#ff5040', '#ffc830', '#50ff80'];
    const ox = m[0] - rec.ax, oy = m[1] + 2 - rec.ay;
    for (let f = 0; f < 2; f++) {
      const k = st[f], L = Street.SIG_LENS[f][2 - k];
      const px = ox + L[0], py = oy + L[1];
      ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.ellipse(px, py, 2.1, 2.3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(px - 0.8, py - 1.2, 1.2, 1);
      Street.drawGlow(ctx, gl[k], px, py, Street.night() ? 14 : 6, Street.night() ? 0.9 : 0.45);
    }
  },
  // ---- stop sign (with optional street name blades on top)
  d_st_stop(o) {
    const g = this.g, d = o.dir, fr = this.stFront(d);
    this.stShadow(0.5, 0.5, 4, 2);
    this.stPost(0.5, 0.5, 0, 2.38, 2.2, '#8c9398');
    const off = ST_DV[d], u = 0.5 + off[0] * 0.05, v = 0.5 + off[1] * 0.05;
    const oct = (r, rz) => { const pts = []; for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; pts.push(this.stPl(d, u, v, Math.cos(a) * r, 2.08 + Math.sin(a) * rz)); } return pts; };
    if (fr) {
      poly(g, oct(0.25, 0.28), '#f2f2ee');
      poly(g, oct(0.22, 0.245), '#c41e24');
    } else {
      poly(g, oct(0.25, 0.28), '#9a9fa3', '#6a6e72', 1);
      const c = this.stPl(d, u, v, 0, 2.08); g.fillStyle = '#5a5e62'; g.fillRect(c[0] - 1, c[1] - 6, 2, 12);
    }
    if (stSnowy()) { const a = this.stPl(d, u, v, -0.1, 2.36), b = this.stPl(d, u, v, 0.1, 2.36); line(g, a, b, ST_SNOW, 2); }
  },
  k_st_stop: () => (stSnowy() ? 'S' : ''),
  a_st_stop(ctx, o, X, Y, t, s) {
    if (!this.stFront(o.dir) || Render.cam.zoom < 0.7) return;
    const off = ST_DV[o.dir];
    Street.text(ctx, 'STOP', isoP(X, Y, 0.5 + off[0] * 0.06, 0.5 + off[1] * 0.06, 2.08), o.dir, 12.5, 5, Col.shade('#f6f4f0', Math.max(0.2, s)));
  },
  // ---- street name sign: two green blades on a post (text drawn crisp in the overlay)
  d_st_namesign() {
    this.stShadow(0.5, 0.5, 4, 2);
    this.stPost(0.5, 0.5, 0, 2.62, 2.2, '#8c9398');
    this.box(0.5 - 0.62, 0.49, 2.4, 0.5 + 0.62, 0.53, 2.65, '#1d6a3a', false);
    this.box(0.49, 0.5 - 0.62, 2.12, 0.53, 0.5 + 0.62, 2.37, '#1d6a3a', false);
    const g = this.g;
    poly(g, [this.P(-0.1, 0.531, 2.42), this.P(1.1, 0.531, 2.42), this.P(1.1, 0.531, 2.63), this.P(-0.1, 0.531, 2.63)], null, 'rgba(240,240,230,0.85)', 0.8);
    poly(g, [this.P(0.531, 1.1, 2.14), this.P(0.531, -0.1, 2.14), this.P(0.531, -0.1, 2.35), this.P(0.531, 1.1, 2.35)], null, 'rgba(240,240,230,0.85)', 0.8);
    if (stSnowy()) { line(g, this.P(-0.1, 0.51, 2.67), this.P(1.1, 0.51, 2.67), ST_SNOW, 1.5); }
  },
  k_st_namesign: () => (stSnowy() ? 'S' : ''),
  a_st_namesign(ctx, o, X, Y, t, s) {
    if (Render.cam.zoom < 0.8 || o.n1 === undefined) return;
    const col = Col.shade('#f4f4ec', Math.max(0.18, s));
    Street.text(ctx, STREET_NAMES[o.n1].toUpperCase(), isoP(X, Y, 0.5, 0.532, 2.525), 'S', 39, 5.6, col);
    Street.text(ctx, STREET_NAMES[o.n2].toUpperCase(), isoP(X, Y, 0.532, 0.5, 2.245), 'E', 39, 5.6, col);
  },
});

// ---------------------------------------------------------------------------
// Oriented props: a local frame per facing. a runs across the front (viewer's left -> right),
// b is depth (front = +b). Boxes are sorted back to front before painting.
// ---------------------------------------------------------------------------
const ST_RIGHT = { S: [1, 0], N: [-1, 0], E: [0, -1], W: [0, 1] };
// billboard adverts: background, accent, headline, tag line
const ST_ADS = [
  ['#1e3a5a', '#f0902a', 'SUNSET MOTEL', 'CABLE TV  -  VACANCY  -  NEXT RIGHT'],
  ['#2a3a24', '#c8a040', 'RIDGELINE GUNS & AMMO', 'HUNTING SEASON IS HERE'],
  ['#a02a24', '#f4e0a0', 'LUCKY STAR DINER', 'PIE  -  COFFEE  -  OPEN 24 HOURS'],
  ['#3a6aa0', '#f4f0e0', 'VISIT MILLBROOK', 'A FRIENDLY PLACE TO STAY'],
  ['#e8e4d8', '#c02a24', 'FRESH MART', 'LOW PRICES EVERY DAY', '#2a2a2a'],
];
const ST_TEXT = { HC: ['WELCOME TO', 'HOLLOW CREEK', 'EST. 1868'], MB: ['WELCOME TO', 'MILLBROOK', 'A FRIENDLY PLACE'] };
Object.assign(ObjArt, {
  stUV(d, a, b) { const r = ST_RIGHT[d] || ST_RIGHT.S, f = ST_DV[d] || ST_DV.S; return [0.5 + a * r[0] + b * f[0], 0.5 + a * r[1] + b * f[1]]; },
  stLB(d, a0, a1, b0, b1) { const p = this.stUV(d, a0, b0), q = this.stUV(d, a1, b1); return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), 0, Math.max(p[0], q[0]), Math.max(p[1], q[1])]; },
  stLP(d, a, b, z) { const p = this.stUV(d, a, b); return this.P(p[0], p[1], z); },
  stParts(d, parts) {
    const L = parts.map(q => ({ q, bb: this.stLB(d, q[0], q[1], q[2], q[3]) }));
    L.sort((A, B) => (A.bb[0] + A.bb[3] + A.bb[1] + A.bb[4]) - (B.bb[0] + B.bb[3] + B.bb[1] + B.bb[4]));
    for (const { q, bb } of L) { if (q[6]) this.box(bb[0], bb[1], q[4], bb[3], bb[4], q[5], q[6], q[8]); if (q[7]) q[7](bb); }
  },
  // detail on the front face of a local box; skipped when the front faces away from the camera
  stFace(d, bb, a0, a1, z0, z1, col, stroke) { if (d === 'S' || d === 'E') this.faceRect(d, bb, a0, a1, z0, z1, col, stroke); },
  // small text painted on a sign face inside the cached sprite
  stSignText(d, u, v, z, txt, size, col, maxW, weight) {
    const g = this.g, p = this.P(u, v, z);
    g.save();
    if (d === 'S' || d === 'N') g.setTransform(0.8944, 0.4472, 0, 1, p[0], p[1]); else g.setTransform(0.8944, -0.4472, 0, 1, p[0], p[1]);
    g.font = (weight || 'bold') + ' ' + size + 'px Arial, Helvetica, sans-serif';
    const w = g.measureText(txt).width;
    if (maxW && w > maxW) g.scale(maxW / w, 1);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col;
    g.fillText(txt, 0, 0.3);
    g.restore();
  },
  stPolyPl(d, u, v, pts, col, stroke) { poly(this.g, pts.map(q => this.stPl(d, u, v, q[0], q[1])), col, stroke, 1); },
  // ---- restyled stock street furniture
  d_hydrant(o) {
    const g = this.g, col = ['#c42a22', '#d6ae22', '#a9afb3'][o.v || 0], cap = ['#ece8e0', '#c42a22', '#3366c4'][o.v || 0];
    this.stShadow(0.5, 0.5, 8, 3.6);
    this.stCyl(0.5, 0.5, 0.15, 0, 0.05, '#77746e');
    this.stCyl(0.5, 0.5, 0.105, 0.05, 0.47, col);
    this.box(0.44, 0.57, 0.23, 0.56, 0.69, 0.37, cap);
    this.box(0.57, 0.45, 0.26, 0.67, 0.55, 0.35, stTone(col, 0.95));
    this.stCyl(0.5, 0.5, 0.125, 0.45, 0.51, col);
    const c = this.P(0.5, 0.5, 0.51);
    g.fillStyle = Col.shade(col, 1.06); g.beginPath(); g.ellipse(c[0], c[1], 5.6, 4.6, 0, Math.PI, 0); g.fill();
    this.stCyl(0.5, 0.5, 0.035, 0.6, 0.68, cap);
    line(g, this.P(0.5, 0.66, 0.3), this.P(0.57, 0.56, 0.22), '#4a4a4a', 0.8);
    if (stSnowy()) { g.fillStyle = ST_SNOW; g.beginPath(); g.ellipse(c[0], c[1] - 3.5, 4.6, 2.3, 0, 0, 7); g.fill(); }
  },
  k_hydrant: () => (stSnowy() ? 'S' : ''),
  // street light: tapered steel pole, curved mast arm, cobra-head luminaire at (0.5, 1.0, 3.95)
  d_lamppost() {
    const g = this.g;
    this.stShadow(0.5, 0.5, 6, 3);
    this.stCyl(0.5, 0.5, 0.09, 0, 0.32, '#474c50');
    const b = this.P(0.5, 0.5, 0.3), t = this.P(0.5, 0.5, 3.86);
    poly(g, [[b[0] - 2.5, b[1]], [b[0], b[1] + 1], [t[0], t[1] + 0.6], [t[0] - 1.5, t[1]]], '#6a6f73');
    poly(g, [[b[0], b[1] + 1], [b[0] + 2.5, b[1]], [t[0] + 1.5, t[1]], [t[0], t[1] + 0.6]], '#4a4f53');
    const a0 = this.P(0.5, 0.5, 3.7), c = this.P(0.5, 0.62, 4.14), h = this.P(0.5, 0.86, 4.04);
    g.strokeStyle = '#575c60'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(a0[0], a0[1]); g.quadraticCurveTo(c[0], c[1], h[0], h[1]); g.stroke();
    const l = this.P(0.5, 0.98, 3.9);
    g.fillStyle = '#efe6c2'; g.beginPath(); g.ellipse(l[0], l[1] + 1, 4.5, 2.2, -0.45, 0, 7); g.fill();
    poly(g, [this.P(0.43, 0.84, 4.06), this.P(0.57, 0.84, 4.06), this.P(0.6, 1.08, 3.98), this.P(0.4, 1.08, 3.98)], '#5b6064');
    poly(g, [this.P(0.4, 1.08, 3.98), this.P(0.6, 1.08, 3.98), this.P(0.58, 1.07, 3.91), this.P(0.42, 1.07, 3.91)], '#3a3e42');
  },
  d_bench(o) {
    const d = o.dir, iron = '#33373b', wood = '#8f6b42';
    const b0 = this.stLB(d, -0.46, 0.46, -0.2, 0.2);
    this.shadow(b0[0], b0[1], b0[3], b0[4]);
    const P = [];
    for (const a of [-0.42, 0.37]) { P.push([a, a + 0.05, -0.17, 0.15, 0, 0.42, iron]); P.push([a, a + 0.05, -0.21, -0.16, 0.42, 0.88, iron]); }
    for (const b of [-0.15, -0.04, 0.07]) P.push([-0.46, 0.46, b, b + 0.09, 0.42, 0.47, wood]);
    for (const z of [0.58, 0.74]) P.push([-0.46, 0.46, -0.22, -0.17, z, z + 0.1, wood]);
    this.stParts(d, P);
    if (stSnowy()) { const s = this.stLB(d, -0.44, 0.44, -0.15, 0.16); this.stSnowTop(s[0], s[1], s[3], s[4], 0.47); }
  },
  k_bench: () => (stSnowy() ? 'S' : ''),
  // ---- road signs on a post: speed limit, deer, school, crossroad, park, bus stop, mile marker
  d_st_sign(o) {
    const g = this.g, d = o.dir || 'S', k = o.kind, fr = this.stFront(d);
    const off = ST_DV[d], u = 0.5 + off[0] * 0.05, v = 0.5 + off[1] * 0.05;
    const back = '#979ca0', edge = '#2a2a2a';
    this.stShadow(0.5, 0.5, 4, 2);
    if (k === 'mile') {
      this.stPost(0.5, 0.5, 0, 1.3, 2, '#8c9398');
      this.stPlate(d, u, v, -0.085, 0.085, 0.86, 1.32, fr ? '#1d6a3a' : back, fr ? '#e8e8e0' : null);
      if (fr) { this.stSignText(d, u, v, 1.22, 'MILE', 2.4, '#f0f0e8', 5.6); this.stSignText(d, u, v, 1.02, String(o.v || 0), 5, '#f4f4ec', 5.8); }
      return;
    }
    this.stPost(0.5, 0.5, 0, 2.32, 2.2, '#8c9398');
    if (k === 'speed') {
      this.stPlate(d, u, v, -0.19, 0.19, 1.68, 2.34, fr ? '#f2f2ec' : back, edge);
      if (fr) {
        this.stPlate(d, u, v, -0.165, 0.165, 1.71, 2.31, null, '#2a2a2a');
        this.stSignText(d, u, v, 2.22, 'SPEED', 3.2, '#1a1a1a', 10.5); this.stSignText(d, u, v, 2.12, 'LIMIT', 3.2, '#1a1a1a', 10.5);
        this.stSignText(d, u, v, 1.88, String(o.v || 35), 7.4, '#111', 11);
      }
    } else if (k === 'deer' || k === 'cross' || k === 'curve') {
      const dia = [[0, 2.36], [0.23, 2.06], [0, 1.76], [-0.23, 2.06]];
      this.stPolyPl(d, u, v, dia, fr ? '#1a1a1a' : back);
      if (fr) {
        this.stPolyPl(d, u, v, [[0, 2.32], [0.2, 2.06], [0, 1.8], [-0.2, 2.06]], '#e8c020');
        if (k === 'cross') { this.stPolyPl(d, u, v, [[-0.02, 2.22], [0.02, 2.22], [0.02, 1.9], [-0.02, 1.9]], '#1a1a1a'); this.stPolyPl(d, u, v, [[-0.12, 2.08], [0.12, 2.08], [0.12, 2.04], [-0.12, 2.04]], '#1a1a1a'); }
        else if (k === 'curve') { this.stPolyPl(d, u, v, [[-0.05, 1.92], [-0.01, 1.92], [-0.01, 2.08], [0.06, 2.16], [0.03, 2.2], [-0.05, 2.1]], '#1a1a1a'); }
        else this.stPolyPl(d, u, v, [[-0.11, 2.02], [0.04, 2.04], [0.08, 2.1], [0.1, 2.17], [0.14, 2.16], [0.13, 2.12], [0.1, 2.09], [0.08, 2.0], [0.07, 1.93], [0.05, 1.93], [0.05, 1.99], [-0.06, 1.99], [-0.08, 1.93], [-0.1, 1.93], [-0.1, 1.99], [-0.13, 2.04]], '#1a1a1a');
      }
    } else if (k === 'school') {
      this.stPolyPl(d, u, v, [[0, 2.4], [0.19, 2.24], [0.19, 1.8], [-0.19, 1.8], [-0.19, 2.24]], fr ? '#1a1a1a' : back);
      if (fr) {
        this.stPolyPl(d, u, v, [[0, 2.36], [0.165, 2.22], [0.165, 1.83], [-0.165, 1.83], [-0.165, 2.22]], '#c8e03a');
        for (const s of [-0.06, 0.06]) { const h = this.stPl(d, u, v, s, 2.16); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(h[0], h[1], 1.6, 0, 7); g.fill(); this.stPolyPl(d, u, v, [[s - 0.04, 2.12], [s + 0.04, 2.12], [s + 0.05, 1.9], [s - 0.05, 1.9]], '#1a1a1a'); }
      }
    } else if (k === 'park' || k === 'bus') {
      this.stPlate(d, u, v, -0.24, 0.24, 1.86, 2.34, fr ? (k === 'park' ? '#5a3a22' : '#1f4e9a') : back, fr ? '#e8e0d0' : edge);
      if (fr) {
        if (k === 'bus') { this.stSignText(d, u, v, 2.22, 'BUS', 3.6, '#fff', 14); this.stSignText(d, u, v, 2.0, 'STOP', 4.4, '#fff', 14); }
        else { this.stSignText(d, u, v, 2.2, o.v ? 'MILLBROOK' : 'TOWN', 3.4, '#f4ecd8', 15); this.stSignText(d, u, v, 2.0, o.v ? 'GREEN' : 'PARK', 4.2, '#f4ecd8', 15); }
      }
      if (k === 'bus') { const sb = this.stLB(d, -0.07, 0.07, 0.02, 0.08); this.box(sb[0], sb[1], 1.25, sb[3], sb[4], 1.62, '#d8d8d0'); }
    }
    if (stSnowy()) { const a = this.stPl(d, u, v, -0.12, 2.38), b = this.stPl(d, u, v, 0.12, 2.38); line(g, a, b, ST_SNOW, 2); }
  },
  k_st_sign: () => (stSnowy() ? 'S' : ''),
  // ---- big welcome board on two posts (double sided, text drawn crisp)
  d_st_welcome(o) {
    const g = this.g, along = o.dir === 'N' || o.dir === 'S', W2 = 0.86, col = o.v ? '#2a3c66' : '#24543a';
    const B = (a0, a1, b0, b1, z0, z1, c) => along ? this.box(0.5 + a0, 0.5 + b0, z0, 0.5 + a1, 0.5 + b1, z1, c) : this.box(0.5 + b0, 0.5 - a1, z0, 0.5 + b1, 0.5 - a0, z1, c);
    const sh = this.stLB(along ? 'S' : 'E', -1, 1, -0.3, 0.3); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    // stone bed with flowers
    B(-0.95, 0.95, -0.22, 0.22, 0, 0.12, '#8a8680');
    const st = Season.tree, fl = st === 'b' || st === 's' ? null : st === 'y' || st === 'a' ? ['#d0802a', '#b8502a', '#e0b030'] : ['#d03a3a', '#e8d040', '#9a50c0', '#f0f0f0'];
    const rng = new RNG(o.v * 7 + 3);
    for (let k = 0; k < 26; k++) {
      const a = rng.f(-0.9, 0.9), b = rng.f(-0.18, 0.18), p = along ? this.P(0.5 + a, 0.5 + b, 0.13) : this.P(0.5 + b, 0.5 - a, 0.13);
      g.fillStyle = fl ? (k % 3 ? '#3a6a2a' : rng.pick(fl)) : (stSnowy() ? ST_SNOW : '#6a5a3a'); g.fillRect(p[0] - 1, p[1] - 2, 2.5, 2);
    }
    for (const a of [-0.74, 0.7]) B(a, a + 0.08, -0.04, 0.04, 0.1, 1.72, '#6a4a2c');
    B(-W2, W2, -0.05, 0.05, 0.62, 1.56, col);
    B(-W2 - 0.04, W2 + 0.04, -0.07, 0.07, 1.56, 1.64, '#e4d8bc');
    B(-W2 - 0.04, W2 + 0.04, -0.07, 0.07, 0.56, 0.62, '#e4d8bc');
    const f = along ? (u, z) => this.P(0.5 + u, 0.552, z) : (u, z) => this.P(0.552, 0.5 - u, z);
    poly(g, [f(-W2 + 0.04, 0.66), f(W2 - 0.04, 0.66), f(W2 - 0.04, 1.52), f(-W2 + 0.04, 1.52)], null, 'rgba(232,220,190,0.8)', 1);
    if (stSnowy()) { const a = f(-W2, 1.66), b = f(W2, 1.66); line(g, a, b, ST_SNOW, 2.5); }
  },
  k_st_welcome: () => Season.tree + (stSnowy() ? 'S' : ''),
  a_st_welcome(ctx, o, X, Y, t, s) {
    if (Render.cam.zoom < 0.7) return;
    const along = o.dir === 'N' || o.dir === 'S', T = o.v ? ST_TEXT.MB : ST_TEXT.HC, col = Col.shade('#efe4c6', Math.max(0.2, s));
    const at = (z) => along ? isoP(X, Y, 0.5, 0.553, z) : isoP(X, Y, 0.553, 0.5, z), face = along ? 'S' : 'E';
    Street.text(ctx, T[0], at(1.4), face, 40, 4.2, col);
    Street.text(ctx, T[1], at(1.13), face, 54, 9, col);
    Street.text(ctx, T[2], at(0.82), face, 40, 3.8, col, 'italic bold');
  },
  // ---- sidewalk boxes
  d_st_newsbox(o) {
    const d = o.dir, col = ['#2a5aa0', '#c02a24', '#e0b020', '#3a7a3a'][(o.v || 0) & 3];
    const sh = this.stLB(d, -0.2, 0.2, -0.17, 0.17); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    this.stParts(d, [
      [-0.16, -0.12, -0.13, 0.13, 0, 0.32, '#3a3a3a'], [0.12, 0.16, -0.13, 0.13, 0, 0.32, '#3a3a3a'],
      [-0.18, 0.18, -0.16, 0.16, 0.3, 0.96, col, (bb) => {
        this.stFace(d, bb, 0.1, 0.9, 0.54, 0.88, '#d8dad6', '#2a2a2a');
        this.stFace(d, bb, 0.18, 0.82, 0.6, 0.64, '#7a7c7a'); this.stFace(d, bb, 0.18, 0.7, 0.68, 0.71, '#8a8c8a'); this.stFace(d, bb, 0.18, 0.78, 0.74, 0.77, '#8a8c8a');
        this.stFace(d, bb, 0.55, 0.85, 0.36, 0.5, '#b8bcc0', '#5a5e62'); this.stFace(d, bb, 0.65, 0.75, 0.45, 0.47, '#222');
        this.stFace(d, bb, 0.3, 0.5, 0.5, 0.52, '#d8d8d8');
      }],
      [-0.19, 0.19, -0.17, 0.17, 0.96, 1.02, stTone(col, 0.85)],
    ]);
    const tp = this.stLB(d, -0.18, 0.18, -0.16, 0.16); this.stSnowTop(tp[0], tp[1], tp[3], tp[4], 1.02);
  },
  k_st_newsbox: () => (stSnowy() ? 'S' : ''),
  d_st_mailbin(o) {
    const d = o.dir, col = '#27467f', fr = this.stFront(d);
    const sh = this.stLB(d, -0.23, 0.23, -0.21, 0.21); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    this.stParts(d, [
      [-0.19, -0.15, -0.17, 0.17, 0, 0.18, '#1e3560'], [0.15, 0.19, -0.17, 0.17, 0, 0.18, '#1e3560'],
      [-0.21, 0.21, -0.19, 0.19, 0.16, 0.92, col, (bb) => {
        this.stFace(d, bb, 0.12, 0.88, 0.74, 0.88, '#1c3058', '#162848'); this.stFace(d, bb, 0.35, 0.65, 0.76, 0.8, '#b8bcc0');
        this.stFace(d, bb, 0.15, 0.85, 0.42, 0.56, '#f0f0f0');
        this.stFace(d, bb, 0.15, 0.85, 0.3, 0.33, '#c02a2a');
      }],
      [-0.21, 0.21, -0.16, 0.16, 0.92, 1.03, col], [-0.21, 0.21, -0.11, 0.11, 1.03, 1.11, col], [-0.21, 0.21, -0.05, 0.05, 1.11, 1.16, col],
    ]);
    if (fr) { const c = this.stUV(d, 0, 0.195); this.stSignText(d, c[0], c[1], 0.49, 'MAIL', 3.6, '#27467f', 12); }
    if (stSnowy()) { const t = this.stLB(d, -0.2, 0.2, -0.1, 0.1); this.stSnowTop(t[0], t[1], t[3], t[4], 1.12); }
  },
  k_st_mailbin: () => (stSnowy() ? 'S' : ''),
  d_st_payphone(o) {
    const d = o.dir, fr = this.stFront(d), steel = '#9aa0a4';
    this.stShadow(0.5, 0.5, 6, 3);
    this.stPost(0.5, 0.5, 0, 1.05, 3, '#6a7074');
    this.stParts(d, [
      [-0.21, 0.21, -0.15, -0.11, 1.0, 2.0, steel],
      [-0.1, 0.1, -0.11, 0.0, 1.22, 1.76, '#b8bcc0', (bb) => {
        if (!fr) return;
        this.stFace(d, bb, 0.15, 0.85, 1.56, 1.7, '#3a4a5a'); this.stFace(d, bb, 0.25, 0.75, 1.3, 1.5, '#4a4e52');
        this.stFace(d, bb, 0.02, 0.18, 1.3, 1.62, '#1a1a1a');
      }],
      [-0.22, -0.19, -0.15, 0.08, 1.0, 1.95, steel], [0.19, 0.22, -0.15, 0.08, 1.0, 1.95, steel],
      [-0.23, 0.23, -0.16, 0.09, 1.86, 2.04, '#1f4e9a'],
    ]);
    if (fr) { const c = this.stUV(d, 0, 0.095); this.stSignText(d, c[0], c[1], 1.95, 'PHONE', 3.4, '#ffffff', 13); }
  },
  d_st_busstop(o) { o.kind = 'bus'; this.d_st_sign(o); delete o.kind; },
  k_st_busstop: () => (stSnowy() ? 'S' : ''),
  // bus shelter: glass back and ends, bench, flat roof, lit advert on one end
  d_st_shelter(o) {
    const d = o.dir, frame = '#3a3f44', glass = 'rgba(176,208,226,0.34)';
    const sh = this.stLB(d, -0.5, 0.5, -0.45, 0.45); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    const G = (bb, z0, z1) => { poly(this.g, [this.P(bb[0], bb[4], z0), this.P(bb[3], bb[4], z0), this.P(bb[3], bb[4], z1), this.P(bb[0], bb[4], z1)], glass); poly(this.g, [this.P(bb[3], bb[4], z0), this.P(bb[3], bb[1], z0), this.P(bb[3], bb[1], z1), this.P(bb[3], bb[4], z1)], glass); };
    this.stParts(d, [
      [-0.46, 0.46, -0.42, -0.38, 0.12, 2.1, null, (bb) => G(bb, 0.12, 2.1)],
      [-0.47, -0.43, -0.42, -0.38, 0, 2.12, frame], [0.43, 0.47, -0.42, -0.38, 0, 2.12, frame],
      [-0.47, -0.43, 0.3, 0.34, 0, 2.12, frame], [0.43, 0.47, 0.3, 0.34, 0, 2.12, frame],
      [-0.4, 0.4, -0.36, -0.12, 0.42, 0.48, '#8f6b42'], [-0.36, -0.32, -0.3, -0.18, 0, 0.42, '#33373b'], [0.32, 0.36, -0.3, -0.18, 0, 0.42, '#33373b'],
      [-0.46, -0.43, -0.38, 0.3, 0.12, 2.1, null, (bb) => G(bb, 0.12, 2.1)],
      [0.43, 0.46, -0.38, 0.3, 0.3, 2.0, '#d8d4c8', (bb) => { this.faceRect('E', bb, 0.1, 0.9, 0.5, 1.8, '#e85a2a'); this.faceRect('E', bb, 0.2, 0.8, 1.2, 1.6, '#f4e8c8'); this.faceRect('S', bb, 0, 1, 0.3, 2.0, '#5a6066'); }],
      [-0.52, 0.52, -0.47, 0.4, 2.1, 2.22, '#5a6066'],
    ]);
    const tp = this.stLB(d, -0.5, 0.5, -0.45, 0.38); this.stSnowTop(tp[0], tp[1], tp[3], tp[4], 2.22);
  },
  k_st_shelter: () => (stSnowy() ? 'S' : ''),
  a_st_shelter(ctx, o, X, Y, t, s, x, y) {
    if (!Street.night() || G.events.powerOff) return;
    const c = this.stUV(o.dir, 0.445, -0.04);
    const p = isoP(X, Y, c[0], c[1], 1.15);
    Street.drawGlow(ctx, '#ffe0b0', p[0], p[1], 18, 0.55);
  },
  // public trash can: slatted steel with a dome lid
  d_st_bin(o) {
    const g = this.g, col = o.v ? '#2e2e30' : '#2f4a36';
    this.stShadow(0.5, 0.5, 9, 4.2);
    this.stCyl(0.5, 0.5, 0.17, 0, 0.8, col);
    const c0 = this.P(0.5, 0.5, 0.08), c1 = this.P(0.5, 0.5, 0.74);
    for (let k = -3; k <= 3; k++) line(g, [c0[0] + k * 2.3, c0[1] + 3.6 - Math.abs(k) * 0.5], [c1[0] + k * 2.3, c1[1] + 3.6 - Math.abs(k) * 0.5], Col.shade(col, 0.7), 0.8);
    this.stCyl(0.5, 0.5, 0.185, 0.78, 0.84, stTone(col, 0.9));
    const t = this.P(0.5, 0.5, 0.84);
    g.fillStyle = Col.shade(col, 1.1); g.beginPath(); g.ellipse(t[0], t[1], 8.2, 5.5, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#1a1a1a'; g.fillRect(t[0] - 3, t[1] - 1.5, 6, 2);
    if (stSnowy()) { g.fillStyle = ST_SNOW; g.beginPath(); g.ellipse(t[0], t[1] - 3, 6.5, 2.6, 0, 0, 7); g.fill(); }
  },
  k_st_bin: () => (stSnowy() ? 'S' : ''),
  d_st_meter(o) {
    const g = this.g, d = o.dir || 'S';
    this.stShadow(0.5, 0.5, 3, 1.5);
    this.stPost(0.5, 0.5, 0, 1.05, 2.4, '#4c5256');
    this.stParts(d, [[-0.07, 0.07, -0.05, 0.05, 1.02, 1.28, '#8a9094', (bb) => { this.stFace(d, bb, 0.15, 0.85, 1.1, 1.22, '#d8dcd0', '#3a3a3a'); if (o.v) this.stFace(d, bb, 0.55, 0.8, 1.12, 1.17, '#d02020'); }]]);
    const t = this.P(0.5, 0.5, 1.28); g.fillStyle = '#9aa0a4'; g.beginPath(); g.ellipse(t[0], t[1], 3.6, 2.6, 0, Math.PI, 0); g.fill();
  },
  // street tree in an iron grate
  d_st_tree(o) {
    const g = this.g;
    poly(g, [this.P(0.12, 0.12, 0), this.P(0.88, 0.12, 0), this.P(0.88, 0.88, 0), this.P(0.12, 0.88, 0)], '#2c2b28', '#1a1918', 1);
    const c = this.P(0.5, 0.5, 0);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; line(g, [c[0] + Math.cos(a) * 7, c[1] + Math.sin(a) * 3.5], [c[0] + Math.cos(a) * 15, c[1] + Math.sin(a) * 7.5], '#4a4844', 1); }
    g.fillStyle = '#4a3a28'; g.beginPath(); g.ellipse(c[0], c[1], 6, 3, 0, 0, 7); g.fill();
    this.d_tree({ t: 'tree', kind: o.kind || 'maple', sz: o.sz || 0.78 });
  },
  k_st_tree: (o) => Season.tree + (stSnowy() ? 'S' : '') + (o.sz || ''),
  d_st_planter(o) {
    const g = this.g;
    this.shadow(0.12, 0.12, 0.88, 0.88);
    this.box(0.12, 0.12, 0, 0.88, 0.88, 0.5, '#b8b2a6');
    this.box(0.1, 0.1, 0.5, 0.9, 0.9, 0.56, '#c8c2b6');
    poly(g, [this.P(0.17, 0.17, 0.561), this.P(0.83, 0.17, 0.561), this.P(0.83, 0.83, 0.561), this.P(0.17, 0.83, 0.561)], '#4a3a2a');
    const st = Season.tree, rng = new RNG(31 + (o.v || 0));
    const cols = st === 'b' ? null : st === 'y' || st === 'a' || st === 's' ? Season.leafCols('oak', st) : ['#3a6e2e', '#4a7e36', '#2e5e26', '#5a8a3e'];
    const c = this.P(0.5, 0.5, 0.75);
    if (!cols) for (let k = 0; k < 9; k++) { const a = rng.f(Math.PI, Math.PI * 2), l = rng.f(6, 12); line(g, [c[0], c[1] + 6], [c[0] + Math.cos(a) * l, c[1] + 6 + Math.sin(a) * l * 0.8], '#5a4430', 1.2); }
    else for (let k = 0; k < 9; k++) { g.fillStyle = cols[k % cols.length]; g.beginPath(); g.arc(c[0] + rng.f(-11, 11), c[1] + rng.f(-5, 5), rng.f(5, 8), 0, 7); g.fill(); }
    if (st === 'p' || st === 'g') for (let k = 0; k < 10; k++) { g.fillStyle = rng.pick(['#e83a4a', '#f0d040', '#f4f0f0', '#c060d0']); g.fillRect(c[0] + rng.f(-12, 12), c[1] + rng.f(-7, 5), 2, 2); }
    if (stSnowy()) { g.fillStyle = 'rgba(238,242,246,0.92)'; g.beginPath(); g.ellipse(c[0], c[1] - 1, 13, 5, 0, 0, 7); g.fill(); }
  },
  k_st_planter: () => Season.tree + (stSnowy() ? 'S' : ''),
  d_st_bikerack(o) {
    const g = this.g, d = o.dir || 'S', steel = '#a8adb0';
    for (const a of [-0.3, 0, 0.3]) {
      const p0 = this.stLP(d, a, -0.12, 0), p1 = this.stLP(d, a, 0.12, 0), q0 = this.stLP(d, a, -0.12, 0.55), q1 = this.stLP(d, a, 0.12, 0.55);
      g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 2; g.beginPath(); g.moveTo(p0[0] + 2, p0[1] + 1); g.lineTo(p1[0] + 2, p1[1] + 1); g.stroke();
      g.strokeStyle = steel; g.lineWidth = 1.8; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(q0[0], q0[1]); g.quadraticCurveTo((q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2 - 6, q1[0], q1[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    }
    if (o.v) {
      // a bicycle locked to the rack
      const col = ['#c02a2a', '#2a5ab0', '#2a8a4a', '#d0a020'][o.v & 3];
      const w0 = this.stLP(d, 0.15, -0.32, 0.22), w1 = this.stLP(d, 0.15, 0.3, 0.22);
      g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.4;
      for (const w of [w0, w1]) { g.beginPath(); g.ellipse(w[0], w[1], 4.5, 6.5, d === 'S' || d === 'N' ? 0.9 : -0.9, 0, 7); g.stroke(); }
      const s = this.stLP(d, 0.15, -0.12, 0.55), h = this.stLP(d, 0.15, 0.22, 0.6);
      g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); g.moveTo(w0[0], w0[1]); g.lineTo(s[0], s[1]); g.lineTo(h[0], h[1]); g.lineTo(w1[0], w1[1]); g.moveTo(s[0], s[1]); g.lineTo(w1[0], w1[1] - 2); g.stroke();
      g.fillStyle = '#1a1a1a'; g.fillRect(s[0] - 2, s[1] - 2, 4, 1.5); line(g, [h[0] - 3, h[1] - 2], [h[0] + 3, h[1] - 2], '#2a2a2a', 1.2);
    }
  },
  // ---- vending & ice
  d_st_vending(o) {
    const d = o.dir, col = o.v ? '#2a4fa0' : '#b52a2a';
    const sh = this.stLB(d, -0.4, 0.4, -0.27, 0.27); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    this.stParts(d, [[-0.4, 0.4, -0.27, 0.27, 0, 1.88, col, (bb) => {
      this.stFace(d, bb, 0.05, 0.62, 0.55, 1.78, '#1a2430', '#0e1218');
      const cans = ['#d02a2a', '#f0f0f0', '#e0b020', '#2a8a3a', '#e86a1a'];
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) this.stFace(d, bb, 0.09 + k * 0.13, 0.17 + k * 0.13, 0.68 + r * 0.27, 0.84 + r * 0.27, cans[(r + k * 2) % 5]);
      this.stFace(d, bb, 0.68, 0.94, 1.2, 1.7, '#d8d8d0'); for (let k = 0; k < 4; k++) this.stFace(d, bb, 0.72, 0.9, 1.26 + k * 0.1, 1.31 + k * 0.1, '#5a5a5a');
      this.stFace(d, bb, 0.72, 0.9, 0.95, 1.08, '#3a3a3a');
      this.stFace(d, bb, 0.1, 0.6, 0.14, 0.36, '#151515');
      this.stFace(d, bb, 0.05, 0.62, 1.8, 1.86, '#f0e8d0');
    }]]);
    const tp = this.stLB(d, -0.4, 0.4, -0.27, 0.27); this.stSnowTop(tp[0], tp[1], tp[3], tp[4], 1.88);
  },
  k_st_vending: () => (stSnowy() ? 'S' : ''),
  a_st_vending(ctx, o, X, Y, t, s, x, y) {
    if (!this.stFront(o.dir) || !Street.night() || G.events.powerOff) return;
    // the lit product window and a soft spill
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    poly(ctx, Street.facePts(X, Y, o.dir, this.stLB(o.dir, -0.4, 0.4, -0.27, 0.27), 0.05, 0.62, 0.55, 1.78), 'rgba(150,190,230,0.32)');
    ctx.globalCompositeOperation = op;
    const c = this.stUV(o.dir, -0.12, 0.3), p = isoP(X, Y, c[0], c[1], 1.15);
    Street.drawGlow(ctx, '#d0e8ff', p[0], p[1], 24, 0.6);
  },
  d_st_icechest(o) {
    const d = o.dir, fr = this.stFront(d);
    const sh = this.stLB(d, -0.46, 0.46, -0.27, 0.27); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    this.stParts(d, [
      [-0.44, -0.38, -0.24, 0.24, 0, 0.1, '#5a5e62'], [0.38, 0.44, -0.24, 0.24, 0, 0.1, '#5a5e62'],
      [-0.46, 0.46, -0.27, 0.27, 0.08, 1.18, '#eef2f4', (bb) => {
        this.stFace(d, bb, 0.04, 0.96, 0.85, 1.12, '#2f6fc0');
        this.stFace(d, bb, 0.495, 0.505, 0.14, 0.82, '#9aa4ac');
        this.stFace(d, bb, 0.42, 0.46, 0.4, 0.6, '#8a949c'); this.stFace(d, bb, 0.54, 0.58, 0.4, 0.6, '#8a949c');
      }],
    ]);
    if (fr) { const c = this.stUV(d, 0, 0.275); this.stSignText(d, c[0], c[1], 0.985, 'ICE', 7, '#ffffff', 26); this.stSignText(d, c[0], c[1], 0.62, '* * *', 4, '#2f6fc0', 24); }
    const tp = this.stLB(d, -0.46, 0.46, -0.27, 0.27); this.stSnowTop(tp[0], tp[1], tp[3], tp[4], 1.18);
  },
  k_st_icechest: () => (stSnowy() ? 'S' : ''),
  // ---- back-alley clutter
  d_st_dumpster(o) {
    const d = o.dir || 'S', col = ['#2f5a3a', '#2a4a7a', '#7a4a2a'][(o.v || 0) % 3];
    const sh = this.stLB(d, -0.47, 0.47, -0.36, 0.36); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    this.stParts(d, [
      [-0.42, -0.34, -0.3, 0.3, 0, 0.14, '#1a1a1a'], [0.34, 0.42, -0.3, 0.3, 0, 0.14, '#1a1a1a'],
      [-0.46, 0.46, -0.34, 0.34, 0.12, 1.08, col, (bb) => {
        this.stFace(d, bb, 0.04, 0.96, 0.9, 0.98, stTone(col, 0.8));
        this.stFace(d, bb, 0.1, 0.3, 0.3, 0.5, '#1c1c1c'); this.stFace(d, bb, 0.7, 0.9, 0.3, 0.5, '#1c1c1c');
        this.stFace(d, bb, 0.38, 0.62, 0.6, 0.72, '#e8e0c8');
      }],
      [-0.47, 0.47, -0.36, 0.0, 1.08, 1.2, '#26282a'], [-0.47, 0.47, 0.0, 0.35, 1.08, 1.16, '#2e3032'],
    ]);
    // side rust streaks
    const rs = this.stLB(d, -0.46, 0.46, -0.34, 0.34), rng = new RNG(5 + (o.v || 0));
    for (let k = 0; k < 4; k++) { const a = rng.f(0.1, 0.9); this.faceRect('S', rs, a, a + 0.03, 0.2, rng.f(0.5, 0.9), '#6a4a2a'); }
    if (stSnowy()) { const t = this.stLB(d, -0.46, 0.46, -0.35, 0.34); this.stSnowTop(t[0], t[1], t[3], t[4], 1.2); }
  },
  k_st_dumpster: () => (stSnowy() ? 'S' : ''),
  d_st_pallet(o) {
    const g = this.g, wood = '#b08a58', n = 2 + ((o.v || 0) % 2);
    this.shadow(0.08, 0.1, 0.92, 0.9);
    for (let k = 0; k < n; k++) {
      const z = k * 0.14;
      this.box(0.08, 0.1, z, 0.92, 0.9, z + 0.04, stTone(wood, 0.9));
      for (const v0 of [0.1, 0.46, 0.82]) this.box(0.08, v0, z + 0.04, 0.92, v0 + 0.08, z + 0.1, stTone(wood, 0.8));
      this.box(0.08, 0.1, z + 0.1, 0.92, 0.9, z + 0.14, wood);
      for (let s = 1; s < 6; s++) line(g, this.P(0.08 + s * 0.14, 0.1, z + 0.14), this.P(0.08 + s * 0.14, 0.9, z + 0.14), 'rgba(60,40,20,0.55)', 1);
    }
    const top = n * 0.14;
    if (o.v >= 2) {
      // a few sacks or a box on top
      for (const [u, v] of [[0.15, 0.2], [0.5, 0.2], [0.15, 0.52], [0.5, 0.52]]) this.box(u, v, top, u + 0.32, v + 0.3, top + 0.13, '#d8cfb4');
      this.box(0.3, 0.32, top + 0.13, 0.62, 0.62, top + 0.25, '#cfc5a8');
    }
    this.stSnowTop(0.08, 0.1, 0.92, 0.9, top + (o.v >= 2 ? 0.25 : 0));
  },
  k_st_pallet: () => (stSnowy() ? 'S' : ''),
  d_st_tires(o) {
    const g = this.g, n = 3 + ((o.v || 0) % 3);
    this.stShadow(0.5, 0.5, 15, 7);
    for (let k = 0; k < n; k++) {
      const z0 = k * 0.19, c = this.P(0.5, 0.5, z0 + 0.19);
      this.stCyl(0.5, 0.5, 0.3, z0, z0 + 0.18, '#26262a', '#36363a');
      g.fillStyle = '#121214'; g.beginPath(); g.ellipse(c[0], c[1], 7.5, 3.8, 0, 0, 7); g.fill();
    }
    if ((o.v || 0) % 2) {
      // a loose tyre leaning on the stack
      const c = this.P(0.86, 0.84, 0.3);
      g.strokeStyle = '#1e1e22'; g.lineWidth = 4; g.beginPath(); g.ellipse(c[0], c[1], 6, 9, 0.5, 0, 7); g.stroke();
    }
    if (stSnowy()) { const t = this.P(0.5, 0.5, n * 0.19); g.fillStyle = ST_SNOW; g.beginPath(); g.ellipse(t[0], t[1], 12, 5, 0, 0, 7); g.fill(); g.fillStyle = '#121214'; g.beginPath(); g.ellipse(t[0], t[1], 6, 3, 0, 0, 7); g.fill(); }
  },
  k_st_tires: () => (stSnowy() ? 'S' : ''),
  d_st_aframe(o) {
    const d = o.dir || 'S', fr = this.stFront(d), g = this.g;
    const words = { open: ['OPEN', 'COME IN'], sale: ['SALE', '50% OFF'], eat: ['EAT', 'DAILY SPECIAL'], beer: ['COLD', 'BEER'], books: ['BOOKS', 'USED & NEW'], gas: ['COLD', 'DRINKS'] }[o.kind] || ['OPEN', ''];
    this.stShadow(0.5, 0.5, 9, 4);
    const leg = (b) => [this.stLP(d, -0.18, b * 0.22, 0), this.stLP(d, 0.18, b * 0.22, 0), this.stLP(d, 0.18, 0, 0.9), this.stLP(d, -0.18, 0, 0.9)];
    poly(g, fr ? leg(-1) : leg(1), '#5a4028');
    const pf = fr ? leg(1) : leg(-1);
    poly(g, pf, '#6a4a2c');
    const ins = (p, q, t) => [U.lerp(p[0], q[0], t), U.lerp(p[1], q[1], t)];
    const a = ins(pf[0], pf[3], 0.12), b = ins(pf[1], pf[2], 0.12), c = ins(pf[1], pf[2], 0.9), e = ins(pf[0], pf[3], 0.9);
    const cc = [ins(a, b, 0.08), ins(a, b, 0.92), ins(e, c, 0.92), ins(e, c, 0.08)];
    poly(g, cc, fr ? '#24302a' : '#4a3422');
    if (fr) {
      const mid = this.stUV(d, 0, 0.15);
      this.stSignText(d, mid[0], mid[1], 0.6, words[0], 3.6, '#f4f0e0', 10);
      if (words[1]) this.stSignText(d, mid[0], mid[1], 0.42, words[1], 2.2, '#e8c860', 10, 'normal');
    }
  },
  // wooden picnic table with two benches (parks)
  stPicnic(o) {
    const d = o.dir === 'E' || o.dir === 'W' ? 'E' : 'S', wood = '#8f6a42', leg = '#6a4a2c';
    const sh = this.stLB(d, -0.48, 0.48, -0.42, 0.42); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    const P = [];
    for (const a of [-0.36, 0.32]) { P.push([a, a + 0.05, -0.36, -0.3, 0, 0.42, leg]); P.push([a, a + 0.05, 0.3, 0.36, 0, 0.42, leg]); P.push([a, a + 0.05, -0.08, 0.08, 0, 0.7, leg]); }
    P.push([-0.48, 0.48, -0.42, -0.26, 0.4, 0.45, wood]); P.push([-0.48, 0.48, 0.26, 0.42, 0.4, 0.45, wood]);
    P.push([-0.48, 0.48, -0.2, 0.2, 0.7, 0.76, wood, (bb) => { line(this.g, this.P(bb[0], (bb[1] + bb[4]) / 2, 0.761), this.P(bb[3], (bb[1] + bb[4]) / 2, 0.761), 'rgba(60,40,20,0.5)', 1); }]);
    this.stParts(d, P);
    if (stSnowy()) { const t = this.stLB(d, -0.47, 0.47, -0.19, 0.19); this.stSnowTop(t[0], t[1], t[3], t[4], 0.76); }
  },
  d_st_table(o) {
    if (o.kind === 'picnic') return this.stPicnic(o);
    const g = this.g, col = ['#c03a2a', '#2a6a9a', '#3a8a4a'][(o.v || 0) % 3];
    this.stShadow(0.5, 0.5, 15, 7, 0.18);
    this.stCyl(0.5, 0.5, 0.06, 0, 0.72, '#4a4a4a');
    this.stCyl(0.5, 0.5, 0.32, 0.72, 0.76, '#e8e4dc');
    // umbrella
    line(g, this.P(0.5, 0.5, 0.76), this.P(0.5, 0.5, 2.15), '#d8d8d0', 1.6);
    const c = this.P(0.5, 0.5, 2.18), r = 30, ry = 15, b = this.P(0.5, 0.5, 1.72);
    for (let k = 0; k < 8; k++) {
      const a0 = Math.PI * (k / 8), a1 = Math.PI * ((k + 1) / 8);
      poly(g, [c, [b[0] + Math.cos(a0) * r, b[1] + Math.sin(a0) * ry], [b[0] + Math.cos(a1) * r, b[1] + Math.sin(a1) * ry]], k & 1 ? '#f0ece4' : col);
    }
    for (let k = 0; k < 8; k++) {
      const a0 = Math.PI + Math.PI * (k / 8), a1 = Math.PI + Math.PI * ((k + 1) / 8);
      poly(g, [c, [b[0] + Math.cos(a0) * r, b[1] + Math.sin(a0) * ry], [b[0] + Math.cos(a1) * r, b[1] + Math.sin(a1) * ry]], Col.shade(k & 1 ? '#f0ece4' : col, 1.08));
    }
    if (stSnowy()) { g.fillStyle = 'rgba(238,242,246,0.9)'; g.beginPath(); g.ellipse(c[0], c[1] + 6, 22, 8, 0, 0, 7); g.fill(); }
  },
  k_st_table: () => (stSnowy() ? 'S' : ''),
  d_st_box(o) {
    const g = this.g, rng = new RNG(17 + (o.v || 0)), cb = '#b08a58';
    this.shadow(0.12, 0.15, 0.88, 0.85);
    const n = 2 + (o.v || 0) % 2;
    for (let k = 0; k < n; k++) {
      const u = rng.f(0.1, 0.45), v = rng.f(0.12, 0.45), s = rng.f(0.28, 0.42), h = rng.f(0.22, 0.38), z = k === n - 1 && n > 2 ? 0.3 : 0;
      this.box(u, v, z, u + s, v + s * 0.85, z + h, Col.jitter(cb, 10, rng));
      line(g, this.P(u + s / 2, v, z + h), this.P(u + s / 2, v + s * 0.85, z + h), 'rgba(80,60,30,0.6)', 1);
      if (rng.chance(0.5)) { const p = this.P(u, v + s * 0.85, z + h); poly(g, [p, this.P(u + s / 2, v + s * 0.85, z + h), this.P(u + s / 2, v + s * 0.85 + 0.12, z + h + 0.12), this.P(u, v + s * 0.85 + 0.12, z + h + 0.12)], Col.shade(cb, 0.9)); }
    }
  },
  // ---- traffic control
  d_st_cone(o) {
    const g = this.g, b = this.P(0.5, 0.5, 0.05), t = this.P(0.5, 0.5, 0.62);
    this.box(0.36, 0.36, 0, 0.64, 0.64, 0.05, '#1e1e1e');
    poly(g, [[b[0] - 6, b[1]], [b[0] + 6, b[1]], [t[0] + 1, t[1]], [t[0] - 1, t[1]]], '#ea6a18');
    poly(g, [[b[0], b[1]], [b[0] + 6, b[1]], [t[0] + 1, t[1]], [t[0], t[1]]], '#c4520e');
    for (const [z0, z1] of [[0.2, 0.28], [0.38, 0.45]]) {
      const w0 = 6 - z0 * 9, w1 = 6 - z1 * 9, p0 = this.P(0.5, 0.5, z0), p1 = this.P(0.5, 0.5, z1);
      poly(g, [[p0[0] - w0, p0[1]], [p0[0] + w0, p0[1]], [p1[0] + w1, p1[1]], [p1[0] - w1, p1[1]]], '#f0f0ec');
    }
  },
  // linear barriers: dir N/S runs along u, E/W along v
  stAlong(o) { return o.dir === 'N' || o.dir === 'S' ? 'S' : 'E'; },
  d_st_sawhorse(o) {
    const g = this.g, d = this.stAlong(o);
    const sh = this.stLB(d, -0.46, 0.46, -0.2, 0.2); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    for (const a of [-0.38, 0.38]) for (const b of [-0.16, 0.16]) line(g, this.stLP(d, a, b, 0), this.stLP(d, a, 0, 0.82), '#d8d8d0', 2.2);
    this.stParts(d, [[-0.48, 0.48, -0.03, 0.03, 0.66, 0.9, '#f2f0ea', (bb) => {
      for (let k = 0; k < 5; k++) this.faceRect('S' === d ? 'S' : 'E', bb, k * 0.2 + 0.02, k * 0.2 + 0.1, 0.66, 0.9, '#e8661a');
    }]]);
    const m = this.stUV(d, 0, 0.032); this.stSignText(d, m[0], m[1], 0.47, 'POLICE', 2.6, '#1a3a8a', 16);
  },
  k_st_sawhorse: () => (stSnowy() ? 'S' : ''),
  d_st_jersey(o) {
    const d = this.stAlong(o), col = o.v === 1 ? '#e86a2a' : '#b8b3a8';
    const sh = this.stLB(d, -0.5, 0.5, -0.3, 0.3); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    this.stParts(d, [
      [-0.5, 0.5, -0.28, 0.28, 0, 0.18, stTone(col, 0.95)],
      [-0.5, 0.5, -0.18, 0.18, 0.18, 0.42, col],
      [-0.5, 0.5, -0.1, 0.1, 0.42, 0.82, stTone(col, 1.03), (bb) => {
        if (o.v === 1) for (let k = 0; k < 3; k++) this.faceRect(d, bb, k * 0.34 + 0.06, k * 0.34 + 0.2, 0.45, 0.78, '#f2f0ea');
        else { this.faceRect(d, bb, 0.1, 0.16, 0.6, 0.7, '#e0c020'); this.faceRect(d, bb, 0.84, 0.9, 0.6, 0.7, '#e0c020'); }
      }],
    ]);
    if (o.v === 2) { const m = this.stUV(d, 0, 0.11); this.stSignText(d, m[0], m[1], 0.32, ['NO', 'KEEP OUT', 'TURN BACK'][(o.kind | 0) % 3], 3, '#2a2a2a', 26, 'bold'); }
    const t = this.stLB(d, -0.5, 0.5, -0.1, 0.1); this.stSnowTop(t[0], t[1], t[3], t[4], 0.82);
  },
  k_st_jersey: () => (stSnowy() ? 'S' : ''),
  // type III barricade with a ROAD CLOSED (or QUARANTINE) board
  d_st_closed(o) {
    const g = this.g, d = this.stAlong(o);
    const sh = this.stLB(d, -0.55, 0.55, -0.2, 0.2); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    for (const a of [-0.44, 0.44]) { line(g, this.stLP(d, a, -0.12, 0), this.stLP(d, a, 0, 1.55), '#e8e8e2', 2.6); line(g, this.stLP(d, a, 0.12, 0), this.stLP(d, a, 0, 0.6), '#d8d8d2', 2); }
    for (const z of [0.3, 0.62, 0.94]) this.stParts(d, [[-0.56, 0.56, -0.02, 0.02, z, z + 0.2, '#f2f0ea', (bb) => { for (let k = 0; k < 6; k++) this.faceRect(d, bb, k / 6 + 0.02, k / 6 + 0.09, z, z + 0.2, '#e8661a'); }]]);
    const q = o.kind === 'q';
    this.stParts(d, [[-0.4, 0.4, 0.02, 0.05, 1.18, 1.6, q ? '#f4f0e8' : '#f2f2ec', (bb) => this.faceRect(d, bb, 0.03, 0.97, 1.21, 1.57, null, q ? '#b02020' : '#1a1a1a')]]);
    const m = this.stUV(d, 0, 0.055);
    this.stSignText(d, m[0], m[1], 1.48, q ? 'QUARANTINE' : 'ROAD', q ? 3.2 : 4.6, q ? '#b02020' : '#1a1a1a', 25);
    this.stSignText(d, m[0], m[1], 1.3, q ? 'NO ENTRY' : 'CLOSED', q ? 3.6 : 4.6, q ? '#b02020' : '#1a1a1a', 25);
  },
  // ---- military floodlight tower and guard booth
  d_st_floodlight(o) {
    const g = this.g, d = o.dir || 'S', ol = '#4a5a3a';
    this.stShadow(0.5, 0.5, 14, 6);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.4; line(g, this.P(0.5 + Math.cos(a) * 0.36, 0.5 + Math.sin(a) * 0.36, 0), this.P(0.5, 0.5, 1.6), '#3a4430', 2); }
    this.box(0.36, 0.38, 0, 0.64, 0.62, 0.32, ol);
    this.stPost(0.5, 0.5, 0.3, 2.85, 2.6, '#3e4a32');
    this.stParts(d, [[-0.4, 0.4, -0.04, 0.04, 2.8, 2.86, '#2e3628']]);
    for (const a of [-0.28, 0, 0.28]) this.stParts(d, [[a - 0.11, a + 0.11, -0.02, 0.12, 2.86, 3.12, '#3a4430', (bb) => this.stFace(d, bb, 0.12, 0.88, 2.89, 3.09, '#f4f0d8')]]);
  },
  a_st_floodlight(ctx, o, X, Y, t, s) {
    if (!Street.night()) return;
    for (const a of [-0.28, 0, 0.28]) { const c = this.stUV(o.dir || 'S', a, 0.14), p = isoP(X, Y, c[0], c[1], 2.98); Street.drawGlow(ctx, '#fff8e0', p[0], p[1], 14, 0.9); }
  },
  d_st_booth(o) {
    const d = o.dir || 'S', wall = o.v ? '#e8e4dc' : '#6a7a5a';
    const sh = this.stLB(d, -0.44, 0.44, -0.44, 0.44); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    this.stParts(d, [[-0.42, 0.42, -0.42, 0.42, 0, 2.0, wall, (bb) => {
      for (const f of ['S', 'E']) this.faceRect(f, bb, 0.1, 0.9, 1.05, 1.7, '#3a5060', '#2a2a2a');
      this.stFace(d, bb, 0.3, 0.7, 0, 0.95, stTone(wall, 0.8), '#2a2a2a');
    }], [-0.5, 0.5, -0.5, 0.5, 2.0, 2.14, '#4a4a48']]);
    const t = this.stLB(d, -0.5, 0.5, -0.5, 0.5); this.stSnowTop(t[0], t[1], t[3], t[4], 2.14);
  },
  k_st_booth: () => (stSnowy() ? 'S' : ''),
  // ---- grocery
  stCartArt(d, a0, b0, z, tipped) {
    const g = this.g, steel = '#9ea4a8';
    if (tipped) {
      const bb = this.stLB(d, a0 - 0.22, a0 + 0.22, b0 - 0.3, b0 + 0.3);
      poly(g, [this.P(bb[0], bb[1], 0.02), this.P(bb[3], bb[1], 0.02), this.P(bb[3], bb[4], 0.02), this.P(bb[0], bb[4], 0.02)], 'rgba(150,156,160,0.25)', steel, 1.2);
      for (let k = 1; k < 5; k++) line(g, this.P(U.lerp(bb[0], bb[3], k / 5), bb[1], 0.02), this.P(U.lerp(bb[0], bb[3], k / 5), bb[4], 0.02), 'rgba(160,166,170,0.7)', 0.8);
      poly(g, [this.P(bb[0], bb[4], 0.02), this.P(bb[3], bb[4], 0.02), this.P(bb[3], bb[4], 0.5), this.P(bb[0], bb[4], 0.5)], 'rgba(150,156,160,0.3)', steel, 1.2);
      return;
    }
    const bb = this.stLB(d, a0 - 0.18, a0 + 0.18, b0 - 0.28, b0 + 0.22);
    for (const [u, v] of [[bb[0], bb[1]], [bb[3], bb[1]], [bb[0], bb[4]], [bb[3], bb[4]]]) { const p = this.P(u, v, z + 0.05); g.fillStyle = '#1a1a1a'; g.fillRect(p[0] - 1.5, p[1] - 1, 3, 2); line(g, this.P(u, v, z + 0.05), this.P(u, v, z + 0.4), steel, 1); }
    const top = z + 0.88, bot = z + 0.42;
    const Fq = (u0, v0, u1, v1) => { poly(g, [this.P(u0, v0, bot), this.P(u1, v1, bot), this.P(u1, v1, top), this.P(u0, v0, top)], 'rgba(150,156,160,0.22)', steel, 1); for (let k = 1; k < 4; k++) line(g, this.P(U.lerp(u0, u1, k / 4), U.lerp(v0, v1, k / 4), bot), this.P(U.lerp(u0, u1, k / 4), U.lerp(v0, v1, k / 4), top), 'rgba(170,176,180,0.65)', 0.7); line(g, this.P(u0, v0, (top + bot) / 2), this.P(u1, v1, (top + bot) / 2), 'rgba(170,176,180,0.65)', 0.7); };
    Fq(bb[0], bb[1], bb[3], bb[1]); Fq(bb[0], bb[1], bb[0], bb[4]); Fq(bb[0], bb[4], bb[3], bb[4]); Fq(bb[3], bb[1], bb[3], bb[4]);
    const h0 = this.stLP(d, a0 - 0.18, b0 - 0.32, top + 0.06), h1 = this.stLP(d, a0 + 0.18, b0 - 0.32, top + 0.06);
    line(g, h0, h1, '#c02a2a', 2.2);
  },
  d_st_cart(o) { this.stShadow(0.5, 0.5, 10, 4, 0.16); this.stCartArt(o.dir || 'S', 0, 0, 0, !!o.v); },
  d_st_corral(o) {
    const g = this.g, d = this.stAlong(o), steel = '#a2a8ac';
    this.stCartArt(d, -0.15, 0.0, 0, false); this.stCartArt(d, 0.1, 0.0, 0, false);
    for (const b of [-0.3, 0.3]) {
      for (const a of [-0.48, 0.48]) line(g, this.stLP(d, a, b, 0), this.stLP(d, a, b, 1.0), steel, 2.2);
      line(g, this.stLP(d, -0.48, b, 1.0), this.stLP(d, 0.48, b, 1.0), steel, 2.2);
      line(g, this.stLP(d, -0.48, b, 0.55), this.stLP(d, 0.48, b, 0.55), steel, 1.6);
    }
    line(g, this.stLP(d, -0.48, -0.3, 1.0), this.stLP(d, -0.48, 0.3, 1.0), steel, 2.2);
    this.stParts(d, [[-0.32, 0.32, 0.27, 0.31, 1.05, 1.35, '#1f4e9a']]);
    const m = this.stUV(d, 0, 0.315); if (d === 'S' || d === 'E') this.stSignText(d, m[0], m[1], 1.2, 'CART RETURN', 3, '#ffffff', 21);
  },
  // ---- roadside
  d_st_rail(o) {
    const g = this.g, d = this.stAlong(o);
    for (const a of [-0.34, 0.16]) this.stParts(d, [[a, a + 0.08, -0.06, 0.04, 0, 0.62, '#6a5a44']]);
    this.stParts(d, [[-0.52, 0.52, 0.04, 0.09, 0.42, 0.66, '#b4babe', (bb) => { this.faceRect(d, bb, 0, 1, 0.52, 0.55, '#8a9094'); this.faceRect(d, bb, 0, 1, 0.62, 0.65, '#dfe4e8'); }]]);
    const r = this.stLP(d, -0.1, 0.1, 0.56); g.fillStyle = '#e8c020'; g.fillRect(r[0] - 1, r[1] - 1, 2.5, 2);
    if (stSnowy()) { const t = this.stLB(d, -0.52, 0.52, 0.04, 0.09); this.stSnowTop(t[0], t[1], t[3], t[4], 0.66); }
  },
  k_st_rail: () => (stSnowy() ? 'S' : ''),
  d_st_lotlight() {
    const g = this.g;
    this.stShadow(0.5, 0.5, 6, 3);
    this.stCyl(0.5, 0.5, 0.11, 0, 0.36, '#9a968e');
    const b = this.P(0.5, 0.5, 0.36), t = this.P(0.5, 0.5, 5.3);
    poly(g, [[b[0] - 2.4, b[1]], [b[0], b[1] + 1], [t[0], t[1] + 0.6], [t[0] - 1.8, t[1]]], '#7e8488');
    poly(g, [[b[0], b[1] + 1], [b[0] + 2.4, b[1]], [t[0] + 1.8, t[1]], [t[0], t[1] + 0.6]], '#5a6064');
    for (const s of [-1, 1]) {
      const u = 0.5 + s * 0.3;
      line(g, this.P(0.5, 0.5, 5.25), this.P(u, 0.5, 5.25), '#5a6064', 2);
      this.box(u - 0.14, 0.4, 5.12, u + 0.14, 0.6, 5.3, '#4a4e52');
      const l = this.P(u, 0.5, 5.12); g.fillStyle = '#efe8cc'; g.fillRect(l[0] - 4, l[1] - 1, 8, 2);
    }
  },
  a_st_lotlight(ctx, o, X, Y) {
    if (!Street.night() || G.events.powerOff) return;
    for (const s of [-1, 1]) { const p = isoP(X, Y, 0.5 + s * 0.3, 0.5, 5.1); Street.drawGlow(ctx, '#fff4d0', p[0], p[1] + 2, 15, 0.9); }
  },
  d_st_flagpole() {
    const g = this.g;
    this.stShadow(0.5, 0.5, 7, 3.5);
    this.box(0.3, 0.3, 0, 0.7, 0.7, 0.16, '#b8b2a6');
    const b = this.P(0.5, 0.5, 0.16), t = this.P(0.5, 0.5, 6.25);
    poly(g, [[b[0] - 2, b[1]], [b[0] + 2, b[1]], [t[0] + 1, t[1]], [t[0] - 1, t[1]]], '#d8dcde');
    poly(g, [[b[0], b[1]], [b[0] + 2, b[1]], [t[0] + 1, t[1]], [t[0], t[1]]], '#a8acae');
    g.fillStyle = '#d8b030'; g.beginPath(); g.arc(t[0], t[1] - 2, 2.4, 0, 7); g.fill();
    line(g, this.P(0.5, 0.5, 1.1), [t[0] + 1, t[1] + 4], 'rgba(220,220,220,0.6)', 0.6);
  },
  a_st_flagpole(ctx, o, X, Y, t, s) {
    const rec = Street.flag(Math.floor(t * 6 + (o.v || 0)) % 8);
    const p = isoP(X, Y, 0.5, 0.5, 6.15);
    Spr.drawShaded(ctx, rec, p[0] - rec.ax, p[1] - rec.ay, Math.max(0.15, s), 1);
  },
  // tall roadside pylon: gas prices or the motel sign (text drawn crisp)
  d_st_pylon(o) {
    const d = this.stAlong(o), motel = o.kind === 'motel';
    this.stShadow(0.5, 0.5, 14, 6);
    for (const a of [-0.32, 0.32]) this.stParts(d, [[a - 0.05, a + 0.05, -0.05, 0.05, 0, 3.5, '#6a7074']]);
    const body = motel ? '#1e3a5a' : '#f2f0ea', trim = motel ? '#e8a020' : '#c4302a';
    this.stParts(d, [
      [-0.62, 0.62, -0.13, 0.13, 3.5, 4.9, body, (bb) => { this.faceRect(d, bb, 0, 1, 3.5, 3.62, trim); this.faceRect(d, bb, 0, 1, 4.78, 4.9, trim); }],
      [-0.5, 0.5, -0.1, 0.1, 2.3, 3.4, motel ? '#2a2a2a' : '#1e1e1e', (bb) => this.faceRect(d, bb, 0.04, 0.96, 2.36, 3.34, null, '#6a6a6a')],
    ]);
  },
  a_st_pylon(ctx, o, X, Y, t, s, x, y) {
    if (Render.cam.zoom < 0.6) return;
    const d = this.stAlong(o), motel = o.kind === 'motel', lit = Street.night() && !G.events.powerOff;
    const at = (z) => d === 'S' ? isoP(X, Y, 0.5, 0.632, z) : isoP(X, Y, 0.632, 0.5, z);
    const ls = lit ? 1 : Math.max(0.2, s);
    if (lit) {
      // backlit sign box
      const bb = this.stLB(d, -0.62, 0.62, -0.13, 0.13);
      poly(ctx, Street.facePts(X, Y, d, bb, 0, 1, 3.62, 4.78), motel ? '#2a5080' : '#fffaf0');
      const p = at(4.2); Street.drawGlow(ctx, motel ? '#ffb040' : '#fff6e0', p[0], p[1], 30, 0.4);
    }
    if (motel) {
      Street.text(ctx, 'SUNSET', at(4.5), d, 38, 7.5, Col.shade('#f0a830', ls));
      Street.text(ctx, 'MOTEL', at(3.95), d, 38, 8, Col.shade('#f4ece0', ls));
      const on = lit && (Math.sin(t * 7.3) > -0.85 || Math.sin(t * 1.3) > 0.4);
      Street.text(ctx, 'VACANCY', at(2.85), d, 34, 6.5, on ? '#ff4a6a' : Col.shade('#6a2a34', Math.max(0.3, s)));
      if (on) { const p = at(2.85); Street.drawGlow(ctx, '#ff4060', p[0], p[1], 22, 0.6); }
    } else {
      Street.text(ctx, (o.nm || 'GAS').toUpperCase(), at(4.2), d, 40, 7.5, Col.shade('#c4302a', ls));
      Street.text(ctx, 'REG  1.09', at(3.12), d, 32, 5.6, lit ? '#ff5a3a' : Col.shade('#e85a3a', Math.max(0.3, s)));
      Street.text(ctx, 'UNL  1.19', at(2.62), d, 32, 5.6, lit ? '#ff5a3a' : Col.shade('#e85a3a', Math.max(0.3, s)));
    }
  },
  d_st_airpump(o) {
    const d = o.dir || 'S', g = this.g;
    this.stShadow(0.5, 0.5, 7, 3);
    this.stParts(d, [[-0.06, 0.06, -0.06, 0.06, 0, 0.6, '#5a5e62'], [-0.15, 0.15, -0.12, 0.12, 0.6, 1.3, '#c4302a', (bb) => { this.stFace(d, bb, 0.15, 0.85, 1.12, 1.24, '#f0f0e8'); this.stFace(d, bb, 0.25, 0.75, 0.75, 0.95, '#2a2a2a'); }]]);
    const h = this.stLP(d, 0.17, 0, 0.9); g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(h[0] + 2, h[1], 3.5, 5, 0, 0, 7); g.stroke();
    if (this.stFront(d)) { const c = this.stUV(d, 0, 0.125); this.stSignText(d, c[0], c[1], 1.18, 'AIR', 3, '#c4302a', 9); }
  },
  d_st_propane(o) {
    const g = this.g, d = this.stAlong(o), steel = '#8a9094';
    const sh = this.stLB(d, -0.45, 0.45, -0.3, 0.3); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    const bb = this.stLB(d, -0.44, 0.44, -0.28, 0.28);
    this.box(bb[0], bb[1], 0, bb[3], bb[4], 0.06, '#5a5e62');
    for (const a of [-0.28, 0, 0.28]) for (const z of [0.06, 0.72]) { const c = this.stUV(d, a, 0); this.stCyl(c[0], c[1], 0.11, z, z + 0.55, a === 0 ? '#e8e8e4' : '#3a6ac0'); }
    const F = (u0, v0, u1, v1) => { poly(g, [this.P(u0, v0, 0), this.P(u1, v1, 0), this.P(u1, v1, 1.45), this.P(u0, v0, 1.45)], 'rgba(120,128,132,0.18)', steel, 1); for (let k = 1; k < 6; k++) line(g, this.P(U.lerp(u0, u1, k / 6), U.lerp(v0, v1, k / 6), 0), this.P(U.lerp(u0, u1, k / 6), U.lerp(v0, v1, k / 6), 1.45), 'rgba(140,148,152,0.6)', 0.7); for (let z = 0.3; z < 1.45; z += 0.3) line(g, this.P(u0, v0, z), this.P(u1, v1, z), 'rgba(140,148,152,0.6)', 0.7); };
    F(bb[0], bb[4], bb[3], bb[4]); F(bb[3], bb[1], bb[3], bb[4]);
    this.box(bb[0], bb[1], 1.45, bb[3], bb[4], 1.6, '#3a6ac0');
    if (d === 'S') this.stSignText(d, 0.5, bb[4] + 0.001, 1.52, 'PROPANE', 3.4, '#ffffff', 28);
    else this.stSignText(d, bb[3] + 0.001, 0.5, 1.52, 'PROPANE', 3.4, '#ffffff', 28);
    this.stSnowTop(bb[0], bb[1], bb[3], bb[4], 1.6);
  },
  k_st_propane: () => (stSnowy() ? 'S' : ''),
  d_st_fountain() {
    const g = this.g;
    this.stShadow(0.5, 0.5, 8, 3.6);
    this.stCyl(0.5, 0.5, 0.11, 0, 0.72, '#8a8e90');
    this.stCyl(0.5, 0.5, 0.2, 0.72, 0.84, '#a2a6a8');
    const c = this.P(0.5, 0.5, 0.84); g.fillStyle = '#5a6a74'; g.beginPath(); g.ellipse(c[0], c[1], 6, 3, 0, 0, 7); g.fill();
    line(g, this.P(0.5, 0.42, 0.84), this.P(0.5, 0.45, 0.94), '#c8ccce', 2);
  },
  // ---- gas station canopy: invisible anchors along the south edge each draw one column of the roof
  d_st_canopy() {},
  d_st_column() { this.stShadow(0.5, 0.5, 7, 3.5); this.box(0.38, 0.38, 0, 0.62, 0.62, 3.1, '#e8e6e0'); this.box(0.36, 0.36, 0, 0.64, 0.64, 0.4, '#c4302a'); },
  a_st_canopy(ctx, o, X, Y, t, s, x, y) {
    const D = o.cd || 5, Z = o.cz || 3.1, k = o.part || 0, n = o.cw || 1, H = 0.36;
    // see-through while the player is underneath
    const p = G.player, x0 = x - k, y0 = y - D + 1;
    const under = p && !p.inCar && p.x >= x0 && p.x < x0 + n && p.y >= y0 - 0.5 && p.y < y + 1.5;
    // one light level for the whole roof (its own lamps point down, so at night it stays dark);
    // the fascia is backlit at night while the power is on
    const amb = G.light.amb, sh = Math.max(0.22, Math.min(amb + 0.2, Math.max(Render.shadeAt(x0 - 1, y + 1), Render.shadeAt(x0 + n, y + 1))));
    const lit = Street.night() && !G.events.powerOff, fs = lit ? 1 : sh;
    if (under) ctx.globalAlpha = 0.3;
    const T = (u, v, z) => isoP(X, Y, u, v, z);
    poly(ctx, [T(0, 1 - D, Z + H), T(1, 1 - D, Z + H), T(1, 1, Z + H), T(0, 1, Z + H)], Col.shade('#ecebe6', sh));
    poly(ctx, [T(0, 1, Z), T(1, 1, Z), T(1, 1, Z + H), T(0, 1, Z + H)], Col.shade('#c4302a', fs * FACE_S));
    line(ctx, T(0, 1, Z + H * 0.55), T(1, 1, Z + H * 0.55), Col.shade('#f4f0e8', fs * FACE_S), 2);
    if (lit && !under) { const q = T(0.5, 1, Z); Street.drawGlow(ctx, '#fff6e0', q[0], q[1] + 4, 21, 0.28); }
    if (k === n - 1) {
      poly(ctx, [T(1, 1, Z), T(1, 1 - D, Z), T(1, 1 - D, Z + H), T(1, 1, Z + H)], Col.shade('#c4302a', fs * FACE_E));
      line(ctx, T(1, 1, Z + H * 0.55), T(1, 1 - D, Z + H * 0.55), Col.shade('#f4f0e8', fs * FACE_E), 2);
      if (o.nm && Render.cam.zoom >= 0.6) {
        const mid = isoP(X - (n / 2 - 0.5) * HTW, Y - (n / 2 - 0.5) * HTH, 0.5, 1.001, Z + H * 0.5);
        Street.text(ctx, o.nm.toUpperCase(), mid, 'S', n * 20, 7.5, Col.shade('#ffffff', fs));
      }
    }
    if (k === 0) poly(ctx, [T(0, 1, Z), T(0, 1 - D, Z), T(0, 1 - D, Z + H), T(0, 1, Z + H)], null, Col.shade('#8a2420', fs), 1);
    if (under) ctx.globalAlpha = 1;
  },
});
// roadside billboard: two posts, a catwalk, a 3-tile panel with an advert (text crisp), lamps on top
Object.assign(ObjArt, {
  d_st_billboard(o) {
    const g = this.g, d = this.stAlong(o), ad = ST_ADS[(o.v || 0) % ST_ADS.length], rng = new RNG(41 + (o.v || 0));
    const sh = this.stLB(d, -1.6, 1.6, -0.3, 0.3); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    for (const a of [-0.95, 0.95]) { this.stParts(d, [[a - 0.07, a + 0.07, -0.07, 0.07, 0, 3.0, '#5e4c3a']]); line(g, this.stLP(d, a, -0.05, 1.2), this.stLP(d, a, 0.25, 0), '#4a3c2e', 2); }
    this.stParts(d, [[-1.4, 1.4, -0.02, 0.26, 2.86, 2.92, '#4a4e52']]);
    for (const a of [-1.4, -0.7, 0, 0.7, 1.4]) line(g, this.stLP(d, a, 0.26, 2.92), this.stLP(d, a, 0.26, 3.18), '#4a4e52', 1);
    line(g, this.stLP(d, -1.4, 0.26, 3.18), this.stLP(d, 1.4, 0.26, 3.18), '#4a4e52', 1);
    this.stParts(d, [[-1.55, 1.55, -0.1, 0.02, 2.95, 4.55, '#3a3e42', (bb) => {
      if (d !== 'S' && d !== 'E') return;
      this.faceRect(d, bb, 0.015, 0.985, 3.0, 4.5, ad[0]);
      this.faceRect(d, bb, 0.015, 0.985, 3.0, 3.1, ad[1]);
      this.faceRect(d, bb, 0.04, 0.29, 3.2, 4.32, ad[1]);
      this.faceRect(d, bb, 0.08, 0.25, 3.35, 4.17, ad[0]);
      this.faceRect(d, bb, 0.12, 0.21, 3.55, 3.97, ad[1]);
      for (let k = 0; k < 5; k++) { const a = rng.f(0.32, 0.95); this.faceRect(d, bb, a, a + rng.f(0.02, 0.05), rng.f(3.0, 3.6), rng.f(3.7, 4.5), stTone(ad[0], 0.86)); }
    }]]);
    for (const a of [-0.9, 0, 0.9]) { const p0 = this.stLP(d, a, 0.02, 4.55), p1 = this.stLP(d, a, 0.36, 4.74); line(g, p0, p1, '#3a3e42', 1.4); g.fillStyle = '#2a2e32'; g.fillRect(p1[0] - 3, p1[1] - 2, 6, 3); }
  },
  a_st_billboard(ctx, o, X, Y, t, s) {
    const d = this.stAlong(o), ad = ST_ADS[(o.v || 0) % ST_ADS.length], lit = Street.night() && !G.events.powerOff;
    const ls = lit ? 0.9 : Math.max(0.2, s);
    if (Render.cam.zoom >= 0.6) {
      const c = this.stUV(d, 0.45, 0.022), at = (z) => isoP(X, Y, c[0], c[1], z);
      Street.text(ctx, ad[2], at(3.98), d, 66, 9.5, Col.shade(ad[1], ls));
      Street.text(ctx, ad[3], at(3.42), d, 66, 4.4, Col.shade(ad[4] || '#f4f0e8', ls));
    }
    if (lit) for (const a of [-0.9, 0, 0.9]) { const q = this.stUV(d, a, 0.36), p = isoP(X, Y, q[0], q[1], 4.7); Street.drawGlow(ctx, '#fff4d0', p[0], p[1] + 8, 16, 0.55); }
  },
});
// sandbag walls (hay objects flagged sandbag) get proper stacked bags
const ST_HAY = ObjArt.d_hay;
ObjArt.d_hay = function (o) {
  if (!o.sandbag) return ST_HAY.call(this, o);
  const rng = new RNG(7 + (o.v || 0)), g = this.g;
  this.shadow(0.04, 0.08, 0.96, 0.92);
  for (let l = 0; l < 3; l++) {
    const z = l * 0.27, rot = l & 1;
    for (let k = 0; k < 2; k++) {
      const a0 = 0.06 + k * 0.45, b = rot ? [0.08 + k * 0.42, 0.1, 0.48 + k * 0.42, 0.9] : [0.06, a0, 0.94, a0 + 0.42];
      const c = Col.jitter('#a8996c', 10, rng);
      this.box(b[0], b[1], z, b[2], b[3], z + 0.25, c, false);
      const t = this.P((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, z + 0.25);
      g.fillStyle = Col.shade(c, 1.08); g.beginPath(); g.ellipse(t[0], t[1], 11, 4.5, 0, 0, 7); g.fill();
      line(g, this.P(b[0], b[3], z + 0.13), this.P(b[2], b[3], z + 0.13), 'rgba(70,60,40,0.4)', 1);
    }
  }
  if (Season.snow > 0.3) this.stSnowTop(0.06, 0.1, 0.94, 0.9, 0.81);
};
ObjArt.k_hay = (o) => (o.sandbag && Season.snow > 0.3 ? 'S' : '');

// ---------------------------------------------------------------------------
// Generation: runs inside MapGen.generate after the towns and outskirts (this = MapGen; this.rng only)
// ---------------------------------------------------------------------------
const ST_SIGNALS = new Set(['135,75', '135,105', '135,135', '105,105', '165,105', '300,285', '300,315']);
const ST_MAJOR = new Set([2, 9, 14, 17]); // Route 9, Main St, Creek Rd, Millbrook Rd
const ST_SOFT = []; for (const f of [FL.GRASS, FL.GRASS2, FL.FOREST, FL.DIRT, FL.SAND]) ST_SOFT[f] = true;
const ST_RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
Object.assign(MapGen, {
  streetPass() {
    this.stSetup();
    this.stSurface();
    this.stJunctions();
    this.stPoleLines();
    this.stShops();
    this.stGas();
    this.stMotel();
    this.stSchool();
    this.stParks();
    this.stBusStops();
    this.stTrouble();
    this.stCountry();
  },
  // ---------------------------------------------------------------- shared helpers
  stSetup() {
    const RP = this.RP, RX2 = this.RX2, RY2 = this.RY2;
    const a = RP[0], b = RP[5] + 3, a2x = RX2[0], b2x = RX2[RX2.length - 1] + 3, a2y = RY2[0], b2y = RY2[RY2.length - 1] + 3;
    // the same road rectangles MapGen.roads() paved, with street name indices
    const R = [];
    RP.forEach((y, i) => R.push({ h: true, p: y, s: y === 105 ? 0 : a, e: y === 105 ? this.GW - 1 : b, nm: i }));
    RP.forEach((x, i) => R.push({ h: false, p: x, s: x === 135 ? 0 : a, e: x === 135 ? this.H - 1 : b, nm: 6 + i }));
    RY2.forEach((y, i) => R.push({ h: true, p: y, s: y === 315 ? 135 : a2x, e: b2x, nm: 12 + i }));
    RX2.forEach((x, i) => R.push({ h: false, p: x, s: x === 300 ? 105 : a2y, e: b2y, nm: 16 + i }));
    this.stR = R;
    this.stBoxes = [[a - 1, a - 1, b + 1, b + 1], [a2x - 1, a2y - 1, b2x + 1, b2y + 1]];
    this.stNo = new Uint8Array(this.W * this.H); // tiles solid props must avoid (around car spots)
    for (const sp of this.w.carSpots) {
      this.stCarMark(sp);
      // the outskirts pass can drop a burnt wreck right under a parked car: the car wins
      const ca = Math.cos(sp.a), sa = Math.sin(sp.a);
      for (const f of [-1, 0, 1]) { const i = Math.floor(sp.y + f * sa) * this.W + Math.floor(sp.x + f * ca), o = this.w.obj[i]; if (o && o.t === 'car_wreck') this.w.obj[i] = null; }
    }
  },
  stIn(x, y) { for (const q of this.stBoxes) if (x >= q[0] && x <= q[2] && y >= q[1] && y <= q[3]) return true; return false; },
  stRoad(x, y) { const f = this.w.floor[y * this.W + x]; return f === FL.ASPHALT || f === FL.PARKING; },
  stCarMark(sp) {
    const L = (sp.kind === 'bus' ? 4.7 : sp.kind === 'firetruck' || sp.kind === 'army' ? 3.5 : 2.6) / 2 + 1.1, S = 1.55;
    const ca = Math.cos(sp.a), sa = Math.sin(sp.a), R = Math.ceil(L + 1), cx = Math.floor(sp.x), cy = Math.floor(sp.y);
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (x < 0 || y < 0 || x >= this.GW || y >= this.H) continue;
      const dx = x + 0.5 - sp.x, dy = y + 0.5 - sp.y, f = Math.abs(dx * ca + dy * sa), s = Math.abs(-dx * sa + dy * ca), i = y * this.W + x;
      if (f <= L && s <= S) this.stNo[i] = 1;
      // keep the forest from growing under a car left on the verge
      if (f <= L - 0.8 && s <= 0.9 && !this.used[i]) this.used[i] = 1;
    }
  },
  stSpot(sp) { this.w.carSpots.push(sp); this.stCarMark(sp); return sp; },
  // a free outdoor ground tile that is not a door front, reserved, or next to a car spot
  stFree(x, y) {
    if (x < 1 || y < 1 || x >= this.GW - 1 || y >= this.H - 1) return false;
    const i = y * this.W + x;
    return !this.w.obj[i] && this.w.room[i] < 0 && !World.isWater(x, y) && !this.stNo[i] && !this.resv.has(i) && !this.reservedOutside(x, y);
  },
  // blocking (x,y) must not cut its free neighbourhood in two (local articulation test, walls respected)
  stSafe(x, y) {
    const ok = [], lab = [-1, -1, -1, -1, -1, -1, -1, -1];
    for (let k = 0; k < 8; k++) { const nx = x + ST_RING[k][0], ny = y + ST_RING[k][1]; ok.push(nx >= 0 && ny >= 0 && nx < this.GW && ny < this.H && !World.tileSolid(nx, ny)); }
    const link = (a, b) => !World.edgeBlocksMove(...World.edgeBetween(x + ST_RING[a][0], y + ST_RING[a][1], x + ST_RING[b][0], y + ST_RING[b][1]));
    let c = 0;
    for (let k = 0; k < 8; k++) {
      if (!ok[k] || lab[k] >= 0) continue;
      lab[k] = c;
      for (let j = k, n = 0; n < 7; n++) { const nj = (j + 1) % 8; if (!ok[nj] || lab[nj] >= 0 || !link(j, nj)) break; lab[nj] = c; j = nj; }
      for (let j = k, n = 0; n < 7; n++) { const nj = (j + 7) % 8; if (!ok[nj] || lab[nj] >= 0 || !link(nj, j)) break; lab[nj] = c; j = nj; }
      c++;
    }
    let need = -2;
    for (let k = 0; k < 8; k += 2) {
      if (!ok[k] || World.edgeBlocksMove(...World.edgeBetween(x, y, x + ST_RING[k][0], y + ST_RING[k][1]))) continue;
      if (need === -2) need = lab[k]; else if (lab[k] !== need) return false;
    }
    return true;
  },
  // a solid prop may go here: free, off sidewalks / roads / driveways / paths, and not a choke point
  stSolidOK(x, y) {
    if (!this.stFree(x, y)) return false;
    const i = y * this.W + x, f = this.w.floor[i];
    if (f === FL.SIDEWALK || f === FL.ASPHALT || f === FL.PARKING || (f === FL.CONCRETE && this.w.fvar[i] === 2)) return false;
    return this.stSafe(x, y);
  },
  stSolid(x, y, t, dir, extra) { return this.stSolidOK(x, y) ? this.put(x, y, t, dir, extra) : null; },
  // anything within Chebyshev distance d (optionally only objects taller than h)
  stCrowd(x, y, d, h) {
    for (let yy = y - d; yy <= y + d; yy++) for (let xx = x - d; xx <= x + d; xx++) {
      if (!World.inb(xx, yy)) continue;
      const o = this.w.obj[yy * this.W + xx];
      if (o && (!h || OBJ[o.t].h > h)) return true;
    }
    return false;
  },
  // ---------------------------------------------------------------- road & sidewalk surfaces
  stSurface() {
    const W = this.W, w = this.w, F = w.floor, D = w.deco, RC = this.roadCnt, r = this.rng;
    const seen = new Uint8Array(W * this.H);
    for (const R of this.stR) {
      for (let t = R.s; t <= R.e; t++) for (let k = -1; k <= 4; k++) {
        const x = R.h ? t : R.p + k, y = R.h ? R.p + k : t;
        if (x < 1 || y < 1 || x >= this.GW - 1 || y >= this.H - 1) continue;
        const i = y * W + x;
        if (seen[i]) continue;
        seen[i] = 1;
        const f = F[i];
        if (k === -1 || k === 4) {
          if (f === FL.SIDEWALK) { if (w.room[i] < 0 && !D[i]) this.stWalkDeco(i); }
          else if (ST_SOFT[f] && f !== FL.DIRT && !this.used[i] && !w.obj[i]) {
            // country roads get a gravel shoulder; nothing grows right at the road
            this.used[i] = 1;
            if ((f === FL.GRASS || f === FL.GRASS2) && !this.stIn(x, y) && r.next() < 0.88) this.sf(x, y, FL.GRAVEL, r.int(0, 3));
          }
          continue;
        }
        if (f !== FL.ASPHALT || D[i] || !RC[i]) continue;
        const q = r.next();
        if (!this.stIn(x, y)) {
          // rural: white edge line along the outer lanes, a little more wear
          if ((k === 0 || k === 3) && RC[i] === 1) {
            const e = R.h ? (k === 0 ? 0 : 2) : (k === 0 ? 1 : 3), nf = F[i + ST_EY[e] * W + ST_EX[e]];
            if (ST_SOFT[nf] || nf === FL.GRAVEL) { D[i] = SD.EDGE + e; continue; }
          }
          if (q < 0.024) D[i] = SD.CRACK + r.int(0, 2); else if (q < 0.04) D[i] = SD.PATCH + r.int(0, 1); else if (q < 0.047) D[i] = SD.POTHOLE; else if (q < 0.058) D[i] = SD.TAR;
          continue;
        }
        const curb = k === 0 || k === 3;
        if (q < 0.013) D[i] = SD.CRACK + r.int(0, 2);
        else if (q < 0.021) D[i] = SD.PATCH + r.int(0, 1);
        else if (q < 0.024) D[i] = SD.POTHOLE;
        else if (q < 0.031) D[i] = SD.TAR;
        else if (curb && q < 0.058) D[i] = SD.OIL + r.int(0, 1);
        else if (curb && q < 0.066) D[i] = SD.LITTER;
      }
      // manholes and valve vaults down the middle of town streets
      for (let t = R.s + 6; t <= R.e - 6; t += r.int(13, 21)) {
        const x = R.h ? t : R.p + 2, y = R.h ? R.p + 2 : t, i = y * W + x;
        if (RC[i] === 1 && F[i] === FL.ASPHALT && (!D[i] || D[i] >= 11) && this.stIn(x, y)) D[i] = r.chance(0.78) ? SD.MANHOLE : SD.VAULT;
      }
    }
  },
  stWalkDeco(i) {
    const r = this.rng, q = r.next(), D = this.w.deco;
    if (q < 0.05) D[i] = SD.SW_CRACK + r.int(0, 2);
    else if (q < 0.07) D[i] = SD.SW_STAIN;
    else if (q < 0.08) D[i] = SD.SW_LITTER;
    else if (q < 0.093) D[i] = SD.SW_VALVE;
    else if (q < 0.105) D[i] = SD.SW_PATCH;
  },
  // ---------------------------------------------------------------- intersections
  stJunctions() {
    const r = this.rng, X = [];
    for (const Hr of this.stR) if (Hr.h) for (const Vr of this.stR) if (!Vr.h) {
      const q = Vr.p, p = Hr.p;
      if (q < Hr.s || q + 3 > Hr.e || p < Vr.s || p + 3 > Vr.e) continue;
      X.push({ q, p, Hr, Vr, n: Vr.s < p, s: Vr.e > p + 3, w: Hr.s < q, e: Hr.e > q + 3, town: this.stIn(q, p) });
    }
    this.stXs = X;
    for (const J of X) {
      const ways = J.n + J.s + J.w + J.e;
      if (ways < 3) continue;
      const mV = ST_MAJOR.has(J.Vr.nm), mH = ST_MAJOR.has(J.Hr.nm);
      let ctl, signal = false;
      if (ways === 4 && J.town && ST_SIGNALS.has(J.q + ',' + J.p) && this.stSignal(J)) { ctl = 'nswe'; signal = true; }
      else if (ways === 3) ctl = J.n + J.s === 1 ? (J.n ? 'n' : 's') : (J.w ? 'w' : 'e');
      else if (mV && !mH) ctl = 'we';
      else if (mH && !mV) ctl = 'ns';
      else ctl = r.chance(0.6) ? 'nswe' : 'ns';
      J.signal = signal; J.ctl = ctl;
      for (const a of 'nswe') {
        if (!J[a] || ctl.indexOf(a) < 0) continue;
        this.stStopBar(J, a);
        if (!signal) this.stStopSign(J, a);
      }
      this.stNameSign(J);
      if (!J.town) continue;
      // a fire hydrant near most corners, storm drains in the gutters
      if (r.chance(0.7)) {
        const c = r.shuffle([[J.q + 4, J.p + 6], [J.q - 1, J.p - 3], [J.q - 3, J.p + 4], [J.q + 6, J.p - 1], [J.q + 4, J.p - 3], [J.q - 1, J.p + 6]]);
        for (const [x, y] of c) if (this.stFree(x, y) && this.w.floor[y * this.W + x] === FL.SIDEWALK && !this.stCrowd(x, y, 1, 1.5)) { this.put(x, y, 'hydrant', 'S', { v: r.weighted([[0, 6], [1, 3], [2, 1]]) }); break; }
      }
      for (const a of 'nswe') if (J[a] && r.chance(0.45)) this.stDrain(J, a);
    }
  },
  stBarTiles(J, a) {
    const { q, p } = J, D = this.w.deco, W = this.W;
    const cw = (x, y) => D[y * W + x] === 3 || D[y * W + x] === 4;
    if (a === 'n') { const y = cw(q, p - 1) ? p - 2 : p - 1; return [[q, y], [q + 1, y]]; }
    if (a === 's') { const y = cw(q, p + 4) ? p + 5 : p + 4; return [[q + 2, y], [q + 3, y]]; }
    if (a === 'w') { const x = cw(q - 1, p) ? q - 2 : q - 1; return [[x, p + 2], [x, p + 3]]; }
    const x = cw(q + 4, p) ? q + 5 : q + 4; return [[x, p], [x, p + 1]];
  },
  stStopBar(J, a) {
    const D = this.w.deco, W = this.W;
    const code = { n: 7, s: 5, w: 8, e: 6 }[a], combo = a === 'n' ? [2, SD.STOP_S_DASH] : a === 'e' ? [1, SD.STOP_W_DASH] : null;
    for (const [x, y] of this.stBarTiles(J, a)) {
      const i = y * W + x;
      if (this.w.floor[i] !== FL.ASPHALT || this.roadCnt[i] !== 1) continue;
      if (!D[i] || D[i] >= 11) D[i] = code;
      else if (combo && D[i] === combo[0]) D[i] = combo[1];
    }
  },
  stStopSign(J, a) {
    const { q, p } = J;
    const pos = { n: [[q - 1, p - 2], [q - 1, p - 3]], s: [[q + 4, p + 5], [q + 4, p + 6]], w: [[q - 2, p + 4], [q - 3, p + 4]], e: [[q + 5, p - 1], [q + 6, p - 1]] }[a];
    for (const [x, y] of pos) if (this.stFree(x, y) && !this.stRoad(x, y)) { this.put(x, y, 'st_stop', { n: 'N', s: 'S', w: 'W', e: 'E' }[a]); return; }
  },
  stNameSign(J) {
    const { q, p } = J;
    for (const [x, y] of [[q - 1, p - 1], [q + 4, p + 4], [q + 4, p - 1], [q - 1, p + 4]]) {
      if (this.stFree(x, y) && !this.stRoad(x, y) && !this.stCrowd(x, y, 0)) { this.put(x, y, 'st_namesign', 'S', { n1: J.Hr.nm, n2: J.Vr.nm }); return; }
    }
  },
  stSignal(J) {
    const { q, p } = J;
    if (!this.stFree(q - 1, p + 4) || !this.stFree(q + 4, p - 1)) return false;
    this.put(q - 1, p + 4, 'st_signal', 'S', { fx: 5, fy: -5, ph: this.rng.int(0, 12) });
    this.put(q + 4, p - 1, 'st_sigpole', 'S');
    return true;
  },
  // storm drain inlet in the curb lane just upstream of the stop bar
  stDrain(J, a) {
    const D = this.w.deco, W = this.W, bt = this.stBarTiles(J, a);
    let x, y, e;
    if (a === 'n') { x = J.q; y = bt[0][1] - 1; e = 1; } else if (a === 's') { x = J.q + 3; y = bt[0][1] + 1; e = 3; }
    else if (a === 'w') { x = bt[0][0] - 1; y = J.p + 3; e = 2; } else { x = bt[0][0] + 1; y = J.p; e = 0; }
    const i = y * W + x;
    if (this.w.floor[i] !== FL.ASPHALT || (D[i] && D[i] < 11) || this.w.floor[i + ST_EY[e] * W + ST_EX[e]] !== FL.SIDEWALK) return;
    D[i] = SD.DRAIN + e;
  },
  // ---------------------------------------------------------------- utility poles: south side of E-W roads, east side of N-S roads
  stPoleLines() {
    const r = this.rng;
    this.stPoles = [];
    for (const R of this.stR) {
      let last = null;
      for (let t = R.s + 1; t <= R.e - 1; t++) {
        const x = R.h ? t : R.p + 4, y = R.h ? R.p + 4 : t, town = this.stIn(x, y);
        if (last && t - last.t < (town ? 8 : 11)) continue;
        if (!this.stPoleSpot(x, y, R, town)) continue;
        if (last && t - last.t > 13) last = null;
        const o = this.put(x, y, 'st_pole', R.h ? 'E' : 'N');
        if (last) { o.lx = last.x - x; o.ly = last.y - y; last.o.nx = x - last.x; last.o.ny = y - last.y; }
        if (town && r.chance(0.22)) o.tr = 1;
        this.stPoles.push({ x, y, o, R, town });
        last = { x, y, t, o };
      }
    }
    // rural poles near junctions carry a street light over the road
    for (const P of this.stPoles) {
      if (P.town) continue;
      if (this.stXs.some(J => !J.town && Math.abs(J.q + 2 - P.x) + Math.abs(J.p + 2 - P.y) < 14)) P.o.lt = P.R.h ? 'N' : 'W';
    }
  },
  stPoleSpot(x, y, R, town) {
    if (!this.stFree(x, y)) return false;
    const W = this.W, i = y * W + x, f = this.w.floor[i];
    if (town ? f !== FL.SIDEWALK : ((!ST_SOFT[f] && f !== FL.GRAVEL) || f === FL.DIRT)) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = i + dy * W + dx;
      if (this.roadCnt[j] > 1) return false;
      const o = this.w.obj[j];
      if (o && OBJ[o.t].h > 1.5) return false;
    }
    let rn = 0;
    for (let e = 0; e < 4; e++) if (this.roadCnt[i + ST_EY[e] * W + ST_EX[e]]) rn++;
    if (rn > 1) return false;
    // keep the sidewalk in front of doors, paths and driveways clear
    const bx = R.h ? x : x + 1, by = R.h ? y + 1 : y, bi = by * W + bx, bf = this.w.floor[bi];
    if (this.reservedOutside(bx, by) || (bf === FL.SIDEWALK && town) || (bf === FL.CONCRETE && this.w.fvar[bi] === 2)) return false;
    return true;
  },
});

// ---------------------------------------------------------------------------
// Generation part 2: storefronts, gas stations, motel, school, parks, bus stops, trouble, countryside
// ---------------------------------------------------------------------------
const ST_SHOPS = { grocery: 1, hardware: 1, gunstore: 1, pharmacy: 1, restaurant: 1, bar: 1, clothing: 1, bookstore: 1, office: 1, firestation: 1, laundromat: 1, diner: 1, clinic: 1, police: 1 };
// props against the shop window, per store type
const ST_KIT = {
  grocery: ['icechest', 'vending', 'corral'], hardware: ['pallet2', 'propane', 'pallet'], gunstore: ['bench'], pharmacy: ['bench', 'planter'],
  restaurant: ['table', 'table'], diner: ['table', 'table'], bar: ['bench', 'planter'], clothing: ['planter', 'planter'],
  bookstore: ['bench', 'planter'], office: ['planter', 'bench', 'planter'], laundromat: ['bench', 'vending'], clinic: ['bench', 'planter'], police: ['bench', 'planter'],
};
const ST_WORD = { grocery: 'sale', hardware: 'sale', restaurant: 'eat', diner: 'eat', bar: 'beer', clothing: 'sale', bookstore: 'books', gunstore: 'open', pharmacy: 'open', laundromat: 'open' };
const ST_CARS = [['sedan', 5], ['hatchback', 2.5], ['wagon', 1.5], ['suv', 2], ['pickup', 2.5], ['van', 1.5], ['taxi', 0.4], ['sports', 0.4]];
Object.assign(MapGen, {
  // ---------------------------------------------------------------- storefronts
  stShops() {
    const r = this.rng, W = this.W, F = this.w.floor;
    let n = 0;
    for (const b of this.w.buildings) {
      if (!ST_SHOPS[b.type] || (b.front !== 'N' && b.front !== 'S')) continue;
      const S = b.front === 'S', ay = S ? b.y1 + 1 : b.y0 - 1, wy = S ? b.y1 + 2 : b.y0 - 2, back = S ? b.y0 - 1 : b.y1 + 1, fd = S ? 'S' : 'N';
      if (F[ay * W + b.x0] !== FL.CONCRETE || F[wy * W + b.x0] !== FL.SIDEWALK) continue;
      n++;
      // apron along the shop window; doors and their neighbours stay clear
      const nearDoor = (x) => this.reservedOutside(x, ay) || this.reservedOutside(x - 1, ay) || this.reservedOutside(x + 1, ay);
      const slots = [];
      for (let x = b.x0; x <= b.x1; x++) if (!nearDoor(x)) slots.push(x);
      r.shuffle(slots);
      if (b.type !== 'firestation') {
        for (let item of ST_KIT[b.type] || []) {
          const x = slots.find(x => this.stSolidOK(x, ay) && !this.stCrowd(x, ay, 0));
          if (x === undefined) break;
          // behind a north-facing shop only low props make sense (tall ones would poke over the roof)
          if (!S && (item === 'table' || item === 'vending' || item === 'propane')) item = item === 'table' ? 'bench' : 'planter';
          this.stApron(item, x, ay, fd);
          slots.splice(slots.indexOf(x), 1);
        }
        if (n % 3 === 0) { const x = slots.find(x => this.stFree(x, ay) && !this.stCrowd(x, ay, 0)); if (x !== undefined) this.put(x, ay, 'st_payphone', fd); }
      }
      // sidewalk: street trees where no power line runs, parking meters, sandwich board, newspaper box, bin, mail box
      if (S) for (let k = 0, x = b.x0 + 1 + r.int(0, 2); k < 2 && x <= b.x1; x += r.int(4, 6)) {
        if (this.stFree(x, wy) && F[wy * W + x] === FL.SIDEWALK && !this.reservedOutside(x, ay) && !this.stCrowd(x, wy, 1, 1.5) && r.chance(0.8)) {
          this.put(x, wy, 'st_tree', 'S', { kind: r.pick(['maple', 'oak', 'birch', 'maple']), sz: r.pick([0.72, 0.78, 0.84]) }); k++;
        }
      }
      for (let x = b.x0 - 1; x <= b.x1 + 1; x++) {
        if ((x - b.x0) % 3 !== 1 || !this.stFree(x, wy) || F[wy * W + x] !== FL.SIDEWALK || this.reservedOutside(x, ay) || this.stCrowd(x, wy, 1, 1.5)) continue;
        if (r.chance(0.8)) this.put(x, wy, 'st_meter', fd, r.chance(0.25) ? { v: 1 } : null);
      }
      const walk = [];
      for (let x = b.x0; x <= b.x1; x++) if (F[wy * W + x] === FL.SIDEWALK && !this.reservedOutside(x, ay)) walk.push(x);
      r.shuffle(walk);
      const take = (gap) => { while (walk.length) { const x = walk.pop(); if (this.stFree(x, wy) && !this.stCrowd(x, wy, gap)) return x; } return undefined; };
      let x;
      if (ST_WORD[b.type] && r.chance(0.75) && (x = take(0)) !== undefined) this.put(x, wy, 'st_aframe', fd, { kind: ST_WORD[b.type] });
      if (r.chance(0.55) && (x = take(0)) !== undefined) this.put(x, wy, 'st_newsbox', fd, { v: r.int(0, 3) });
      if (r.chance(0.4) && (x = take(0)) !== undefined) this.put(x, wy, 'st_bin', 'S', { v: r.int(0, 1) });
      // a blue mail drop box at the end of every other block front
      if (n % 2 === 1) for (const mx of [b.x1 + 1, b.x0 - 1, b.x1]) if (this.stFree(mx, wy) && F[wy * W + mx] === FL.SIDEWALK && !this.reservedOutside(mx, ay) && !this.stCrowd(mx, wy, 0)) { this.put(mx, wy, 'st_mailbin', fd); break; }
      if (b.type === 'grocery') for (let k = 0; k < 2; k++) if ((x = take(0)) !== undefined) this.put(x, wy, 'st_cart', r.pick(['S', 'E', 'N', 'W']), { v: r.chance(0.3) ? 1 : 0 });
      // emergency vehicles at the kerb
      if (b.type === 'police' || b.type === 'clinic') {
        const lane = S ? wy + 1 : wy - 1, cx = (b.x0 + b.x1 + 1) / 2;
        for (let j = 0; j < (b.type === 'police' ? 2 : 1); j++) this.stTryCar(cx - 1.6 + j * 3.4, lane + 0.5 + (S ? 0.25 : -0.25), S ? Math.PI : 0, { kind: b.type === 'police' ? 'police' : 'ambulance' });
      }
      if (b.type === 'police' || b.type === 'firestation') {
        const fx = [b.x0, b.x1].find(x => this.stFree(x, ay) && !nearDoor(x));
        if (fx !== undefined) this.put(fx, ay, 'st_flagpole', 'S', { v: r.int(0, 7) });
      }
      this.stAlley(b, S, back);
    }
  },
  stApron(item, x, y, fd) {
    const r = this.rng;
    if (item === 'table') {
      this.put(x, y, 'st_table', fd, { v: r.int(0, 2) });
      for (const dx of [-1, 1]) if (this.stFree(x + dx, y) && !this.reservedOutside(x + dx, y)) this.put(x + dx, y, 'chair', dx < 0 ? 'E' : 'W');
    } else if (item === 'pallet' || item === 'pallet2') this.put(x, y, 'st_pallet', fd, { v: item === 'pallet2' ? 2 + r.int(0, 1) : r.int(0, 1) });
    else if (item === 'vending') this.put(x, y, 'st_vending', fd, { v: r.int(0, 1) });
    else if (item === 'bench') this.put(x, y, 'bench', fd);
    else if (item === 'corral') this.put(x, y, 'st_corral', 'S');
    else this.put(x, y, 'st_' + item, fd);
  },
  // dumpster in the side alley by the back corner, boxes and pallets out back
  stAlley(b, S, back) {
    const r = this.rng, by = S ? b.y0 : b.y1, by2 = S ? b.y0 + 1 : b.y1 - 1;
    if (r.chance(0.85)) for (const [x, y] of r.shuffle([[b.x1 + 1, by], [b.x0 - 1, by], [b.x1 + 1, by2], [b.x0 - 1, by2]])) {
      if (this.stSolid(x, y, 'st_dumpster', x > b.x1 ? 'W' : 'E', { v: r.int(0, 2) })) break;
    }
    if (r.chance(0.6)) for (let t = 0; t < 5; t++) {
      const x = r.int(b.x0, b.x1);
      if (this.stFree(x, back) && !this.stCrowd(x, back, 0)) { this.put(x, back, 'st_box', 'S', { v: r.int(0, 3) }); break; }
    }
    if (/hardware|grocery|restaurant|diner|bar/.test(b.type) && r.chance(0.7)) {
      for (const [x, y] of [[b.x0 - 1, S ? b.y0 + 2 : b.y1 - 2], [b.x1 + 1, S ? b.y0 + 2 : b.y1 - 2]]) if (this.stSolid(x, y, 'st_pallet', 'S', { v: r.int(0, 3) })) break;
    }
  },
  // ---------------------------------------------------------------- vehicles placed by this pass
  stCarOK(x, y, a, kind, loose) {
    const len = kind === 'bus' ? 4.7 : kind === 'firetruck' || kind === 'army' ? 3.5 : 2.6;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const sp of this.w.carSpots) {
      const dx = sp.x - x, dy = sp.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 2.75) return false;
      const ol = sp.kind === 'bus' ? 4.7 : sp.kind === 'firetruck' || sp.kind === 'army' ? 3.5 : 2.6;
      if (!loose && Math.abs(-dx * sa + dy * ca) < 0.8 && Math.abs(dx * ca + dy * sa) < Math.max(3, (len + ol) / 2 + 0.4)) return false;
    }
    for (let f = -len / 2; f <= len / 2 + 0.01; f += len / 4) for (const s of [-0.5, 0.5]) {
      const px = Math.floor(x + f * ca - s * sa), py = Math.floor(y + f * sa + s * ca);
      if (px < 1 || py < 1 || px >= this.GW - 1 || py >= this.H - 1 || World.tileSolid(px, py) || this.w.room[py * this.W + px] >= 0) return false;
      const o = this.w.obj[py * this.W + px];
      if (o && OBJ[o.t].solid) return false;
    }
    return true;
  },
  stTryCar(x, y, a, extra) {
    if (!this.stCarOK(x, y, a, extra && extra.kind, extra && extra.crashed)) return null;
    return this.stSpot(Object.assign({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, a: Math.round(a * 1000) / 1000 }, extra || {}));
  },
  // ---------------------------------------------------------------- gas stations: canopy over the pumps, shop-front clutter, price sign
  stGas() {
    const r = this.rng, W = this.W;
    for (const b of this.w.buildings) {
      if (b.type !== 'gasstation') continue;
      const pumps = [];
      for (let y = b.y1 + 1; y <= b.y1 + 8; y++) for (let x = b.x0 - 6; x <= b.x1 + 6; x++) { const o = this.w.obj[y * W + x]; if (o && o.t === 'pump') pumps.push(x); }
      if (!pumps.length) continue;
      let py = 0;
      for (let y = b.y1 + 1; y <= b.y1 + 8 && !py; y++) if (this.w.obj[y * W + pumps[0]] && this.w.obj[y * W + pumps[0]].t === 'pump') py = y;
      const px0 = Math.min(...pumps), px1 = Math.max(...pumps), cx0 = px0 - 2, cx1 = px1 + 2, cy = py + 2, n = cx1 - cx0 + 1;
      let ok = cy - 4 > b.y1;
      for (let x = cx0; x <= cx1 && ok; x++) { const i = cy * W + x; if (this.w.obj[i] || this.w.room[i] >= 0 || this.stRoad(x, cy)) ok = false; }
      if (ok) {
        for (let x = cx0; x <= cx1; x++) this.put(x, cy, 'st_canopy', 'S', Object.assign({ part: x - cx0, cw: n, cd: 5, cz: 3.1 }, x === cx1 ? { nm: b.name || 'Gas' } : {}));
        for (const x of [cx0, cx1, ...pumps.map(p => p + 2).filter(x => x < px1)]) this.stSolid(x, py, 'st_column', 'S');
      }
      const ay = b.y1 + 1, front = [];
      for (let x = b.x0; x <= b.x1; x++) if (!this.reservedOutside(x, ay) && !this.reservedOutside(x - 1, ay) && !this.reservedOutside(x + 1, ay)) front.push(x);
      for (const t of ['st_icechest', 'st_vending', 'st_vending']) {
        const x = front.find(x => this.stSolidOK(x, ay));
        if (x === undefined) break;
        this.put(x, ay, t, 'S', t === 'st_vending' ? { v: r.int(0, 1) } : null);
        front.splice(front.indexOf(x), 1);
      }
      this.stSolid(b.x1 + 1, b.y1 - 1, 'st_propane', 'E') || this.stSolid(b.x0 - 1, b.y1 - 1, 'st_propane', 'W');
      this.stSolid(b.x0 - 1, b.y0 + 1, 'st_tires', 'S', { v: r.int(0, 5) }) || this.stSolid(b.x1 + 1, b.y0 + 1, 'st_tires', 'S', { v: r.int(0, 5) });
      this.stSolid(b.x1 + 1, b.y0, 'st_dumpster', 'W', { v: r.int(0, 2) });
      for (const [x, y] of [[cx0 - 1, py], [cx1 + 1, py], [cx0 - 1, py - 1]]) if (this.stFree(x, y) && !this.stRoad(x, y)) { this.put(x, y, 'st_airpump', 'S'); break; }
      const ax = front.find(x => this.stFree(x, ay + 1) && !this.reservedOutside(x, ay + 1));
      if (ax !== undefined) this.put(ax, ay + 1, 'st_aframe', 'S', { kind: 'gas' });
      for (const [x, y] of [[cx0 - 2, cy], [cx1 + 2, cy], [cx0 - 1, cy]]) if (this.stFree(x, y) && !this.stRoad(x, y) && !this.stCrowd(x, y, 1, 1.5)) { this.put(x, y, 'st_pylon', 'N', { kind: 'gas', nm: b.name || 'Gas' }); break; }
    }
  },
  // ---------------------------------------------------------------- motel: striped lot, wheel stops, lot lights, pylon sign
  stMotel() {
    const W = this.W, r = this.rng, b = this.w.buildings.find(b => b.type === 'motel');
    if (!b) return;
    const y0 = b.y0 - 4, x0 = b.x0 - 1, x1 = b.x1 + 1;
    for (let y = y0; y <= y0 + 3; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (this.w.floor[i] === FL.ASPHALT && !this.roadCnt[i]) this.w.floor[i] = FL.PARKING; }
    for (let x = x0 + 2; x <= x1 - 1; x += 2) for (let y = y0; y <= y0 + 2; y++) if (!this.w.deco[y * W + x]) this.w.deco[y * W + x] = SD.STALL_V;
    for (let x = x0 + 3; x <= x1 - 1; x += 2) if (!this.w.deco[(y0 + 2) * W + x]) this.w.deco[(y0 + 2) * W + x] = SD.WSTOP_U;
    for (const x of [x0, x1]) if (this.stFree(x, y0)) this.put(x, y0, 'st_lotlight', 'S');
    for (const [x, y] of [[x1 + 1, y0], [x0 - 1, y0], [x1 + 1, y0 + 1]]) if (this.stFree(x, y) && !this.stRoad(x, y)) { this.put(x, y, 'st_pylon', 'S', { kind: 'motel' }); break; }
    this.stSolid(b.x1 + 1, b.y0, 'st_icechest', 'E');
    this.stSolid(b.x1 + 1, b.y0 + 1, 'st_vending', 'E', { v: r.int(0, 1) });
    this.stSolid(b.x0 - 1, b.y0 + 2, 'st_dumpster', 'E', { v: r.int(0, 2) });
  },
  // ---------------------------------------------------------------- school: flag, bike racks, bus, painted warnings, zone signs
  stSchool() {
    const W = this.W, r = this.rng, D = this.w.deco;
    for (const b of this.w.buildings) {
      if (b.type !== 'school' || b.front !== 'N') continue;
      const fy = b.y0 - 2, sy = b.y0 - 3, p = b.y0 - 7, cx = Math.floor((b.x0 + b.x1) / 2);
      if (this.w.floor[fy * W + cx] !== FL.CONCRETE) continue;
      if (this.stFree(cx, fy)) this.put(cx, fy, 'st_flagpole', 'S', { v: 3 });
      for (const dx of [-5, -3]) if (this.stFree(cx + dx, b.y0 - 1)) this.put(cx + dx, b.y0 - 1, 'st_bikerack', 'S', { v: r.chance(0.6) ? r.int(1, 3) : 0 });
      for (const dx of [4, 7]) this.stSolid(cx + dx, b.y0 - 1, 'bench', 'N');
      if (this.stFree(cx - 8, sy) && this.w.floor[sy * W + cx - 8] === FL.SIDEWALK) { this.put(cx - 8, sy, 'st_busstop', 'W'); this.stSolid(cx - 8, fy, 'st_shelter', 'N'); }
      this.stTryCar(cx + 0.5, p + 3.2, 0, { kind: 'bus' });
      // SLOW / SCHOOL on the westbound lanes, east of the entrance, where no centre dash runs
      let wx = cx + 4;
      while (((wx >> 1) & 1) && wx < cx + 8) wx++;
      for (const [x, code] of [[wx, SD.SCHOOL], [wx + 4, SD.SLOW]]) {
        const i0 = (p + 1) * W + x, i1 = p * W + x;
        if (this.roadCnt[i0] !== 1 || this.roadCnt[i1] !== 1 || (D[i0] && D[i0] < 11) || (D[i1] && D[i1] < 11)) continue;
        D[i0] = code; D[i1] = code + 1;
      }
      for (const [x, y, d] of [[b.x1 + 2, p - 1, 'E'], [b.x0 - 2, sy, 'W']]) {
        if (this.stFree(x, y) && this.w.floor[y * W + x] === FL.SIDEWALK && !this.stCrowd(x, y, 0)) this.put(x, y, 'st_sign', d, { kind: 'school' });
        const x2 = d === 'E' ? x + 2 : x - 2;
        if (this.stFree(x2, y) && this.w.floor[y * W + x2] === FL.SIDEWALK && !this.stCrowd(x2, y, 0)) this.put(x2, y, 'st_sign', d, { kind: 'speed', v: 20 });
      }
    }
  },
  // ---------------------------------------------------------------- parks: bins, fountain, picnic tables, sign, bike rack
  stParks() {
    const r = this.rng, W = this.W, RP = this.RP;
    const parks = [[RP[1] + 5, RP[3] + 5, RP[2] - 2, RP[4] - 2, 0], [this.RX2[1] + 5, this.RY2[1] + 5, this.RX2[2] - 2, this.RY2[2] - 2, 1]];
    for (const [x0, y0, x1, y1, v] of parks) {
      const cx = Math.floor((x0 + x1) / 2), cy = Math.floor((y0 + y1) / 2);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const o = this.w.obj[y * W + x];
        if (!o || o.t !== 'bench' || !r.chance(0.4)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (this.stFree(nx, ny) && !this.stCrowd(nx, ny, 0) && this.w.floor[ny * W + nx] !== FL.SIDEWALK) { this.put(nx, ny, 'st_bin', 'S'); break; }
        }
      }
      for (const [x, y] of [[cx - 2, cy + 2], [cx + 3, cy - 1], [cx - 2, cy - 1], [cx + 3, cy + 2]]) if (this.stFree(x, y) && !this.stCrowd(x, y, 0)) { this.put(x, y, 'st_fountain', 'S'); break; }
      for (let k = 0, t = 0; k < 3 && t < 40; t++) {
        const x = r.int(x0 + 1, x1 - 1), y = r.int(y0 + 1, y1 - 1), f = this.w.floor[y * W + x];
        if ((f === FL.GRASS || f === FL.GRASS2) && !this.stCrowd(x, y, 1) && this.stSolid(x, y, 'st_table', r.pick(['S', 'E']), { kind: 'picnic' })) k++;
      }
      for (const [x, y] of [[x1, cy + 2], [x1, cy - 1], [cx + 2, y1]]) if (this.stFree(x, y) && !this.stCrowd(x, y, 0)) { this.put(x, y, 'st_sign', x === x1 ? 'E' : 'S', { kind: 'park', v }); break; }
      for (const [x, y] of [[cx + 2, y1], [cx - 1, y1], [cx - 1, y0], [x0, cy + 2]]) if (this.stFree(x, y) && !this.stCrowd(x, y, 0)) { this.put(x, y, 'st_bikerack', 'S', { v: r.chance(0.4) ? 2 : 0 }); break; }
    }
  },
  // ---------------------------------------------------------------- bus stops along the main streets
  stBusStops() {
    const r = this.rng, W = this.W, F = this.w.floor;
    const parks = [[this.RP[1] + 5, this.RP[3] + 5, this.RP[2] - 2, this.RP[4] - 2], [this.RX2[1] + 5, this.RY2[1] + 5, this.RX2[2] - 2, this.RY2[2] - 2]];
    const pub = (x, y) => { const i = y * W + x; return (F[i] === FL.CONCRETE && this.w.fvar[i] !== 2) || parks.some(q => x >= q[0] && x <= q[2] && y >= q[1] && y <= q[3]); };
    for (const R of this.stR) {
      if (!ST_MAJOR.has(R.nm) && R.nm !== 12) continue;
      let side = r.int(0, 1);
      for (let t = R.s + 10; t <= R.e - 8; t += r.int(24, 34)) {
        side ^= 1;
        for (let dt = 0; dt < 7; dt++) {
          const off = side ? 4 : -1, x = R.h ? t + dt : R.p + off, y = R.h ? R.p + off : t + dt;
          if (!this.stIn(x, y) || F[y * W + x] !== FL.SIDEWALK || !this.stFree(x, y) || this.stCrowd(x, y, 1, 1.5)) continue;
          const lx = R.h ? x : x + (side ? 1 : -1), ly = R.h ? y + (side ? 1 : -1) : y;
          const kx = R.h ? x : x + (side ? -1 : 1), ky = R.h ? y + (side ? -1 : 1) : y, ki = ky * W + kx;
          if (this.roadCnt[ki] !== 1 || this.reservedOutside(lx, ly)) continue;
          this.put(x, y, 'st_busstop', R.h ? (side ? 'W' : 'E') : (side ? 'S' : 'N'));
          if (pub(lx, ly)) this.stSolid(lx, ly, r.chance(0.6) ? 'st_shelter' : 'bench', R.h ? (side ? 'N' : 'S') : (side ? 'W' : 'E'));
          if (F[ki] === FL.ASPHALT && (!this.w.deco[ki] || this.w.deco[ki] >= 11)) this.w.deco[ki] = SD.BUS;
          break;
        }
      }
    }
  },
  // ---------------------------------------------------------------- the outbreak: jams, crashes, barricades, roadblocks
  stTrouble() {
    const r = this.rng, W = this.W, D = this.w.deco;
    const kind = () => r.weighted(ST_CARS);
    // military roadblocks at both ends of Route 9: concrete barriers across the inbound lanes, floodlights, a booth, trucks
    this.stCheckpoint(-1);
    this.stCheckpoint(1);
    // queues of abandoned cars heading for the roadblocks and out of town (the opposite lanes stay open)
    this.stJam(105, true, 'w', 13, 43, r.int(9, 12));
    this.stJam(105, true, 'e', 350, 386, r.int(7, 10));
    this.stJam(135, false, 'n', 6, 40, r.int(6, 8));
    this.stJam(135, false, 's', 362, 393, r.int(5, 7));
    this.stJam(300, false, 'n', 112, 150, r.int(4, 6));
    // the county is sealed: closed barriers where Main St leaves the map
    this.stClosure(135, 2, 'S', 136, 4);
    this.stClosure(135, 397, 'N', 137, 395);
    // police barricades at two town exits: sawhorses across the inbound lanes, cones, cruisers
    this.stPolice(true, 201, [107, 108], 203.6, 107.8, Math.PI / 2 + 0.45);
    this.stPolice(false, 203, [135, 136], 136.2, 205.6, -Math.PI / 2 + 0.5);
    // fender benders in town: two cars askew in a junction, glass and skid marks
    const xs = r.shuffle(this.stXs.filter(J => J.town && !J.signal && J.n + J.s + J.w + J.e === 4)).slice(0, 3);
    for (const J of xs) {
      const { q, p } = J;
      if (!this.stTryCar(q + 0.9, p + 2.65, 0.35 + r.f(-0.15, 0.15), { crashed: true, kind: kind() })) continue;
      this.stTryCar(q + 3.05, p + 0.75, Math.PI / 2 + 0.55 + r.f(-0.2, 0.2), { crashed: true, kind: kind() });
      for (let k = 0; k < 4; k++) { const i = (p + r.int(0, 3)) * W + q + r.int(0, 3); if (!D[i]) D[i] = SD.GLASS; }
      for (const x of [q - 3, q - 4]) { const i = (p + 2) * W + x; if (this.roadCnt[i] === 1 && (!D[i] || D[i] >= 11)) D[i] = SD.SKID_U; }
      for (const x of [q + 5, q + 6]) { const i = (p + 1) * W + x; if (this.roadCnt[i] === 1 && (!D[i] || D[i] >= 11)) D[i] = SD.SKID_U; }
    }
    // a car wrapped round a utility pole on a country road
    const rural = r.shuffle(this.stPoles.filter(P => !P.town && P.R.h && P.o.lx !== undefined && P.o.nx !== undefined && !P.o.lt && P.x > 210 && P.x < 380));
    for (const P of rural.slice(0, 2)) {
      const a = 0.55, cx = P.x + 0.5 - Math.cos(a) * 1.4, cy = P.y + 0.5 - Math.sin(a) * 1.4;
      if (this.w.carSpots.some(sp => U.dist(sp.x, sp.y, cx, cy) < 3)) continue;
      P.o.lean = 1;
      this.stSpot({ x: Math.round(cx * 100) / 100, y: Math.round(cy * 100) / 100, a, crashed: true, kind: kind() });
      for (const dx of [-2, -3, -4]) { const i = (P.y - 1) * W + P.x + dx; if (this.roadCnt[i] === 1 && (!D[i] || D[i] >= 11)) D[i] = SD.SKID_U; }
      const i = P.y * W + P.x - 1; if (!D[i]) D[i] = SD.GLASS;
    }
    // burnt-out and ditched cars along the highway
    for (let k = 0, t = 0; k < 5 && t < 40; t++) {
      const x = r.pick([r.int(50, 190), r.int(235, 340)]), lane = r.int(0, 3);
      if (this.stTryCar(x + 0.5, 105 + lane + 0.5, (lane < 2 ? Math.PI : 0) + r.f(-0.5, 0.5), r.chance(0.6) ? { burnt: true, kind: kind() } : { crashed: true, kind: kind() })) k++;
    }
    for (let k = 0, t = 0; k < 3 && t < 30; t++) {
      const y = r.int(215, 380), x = r.chance(0.5) ? 133.3 : 140.7;
      if (this.stTryCar(x, y + 0.5, Math.PI / 2 + r.f(-0.7, 0.7), { crashed: true, kind: kind() })) k++;
    }
  },
  // cars queued in the two lanes of one direction. h: road runs along x; dir: travel direction; queue head at the lead end
  stJam(p, h, dir, t0, t1, n) {
    const r = this.rng;
    const a = { w: Math.PI, e: 0, n: -Math.PI / 2, s: Math.PI / 2 }[dir];
    const lanes = dir === 'w' || dir === 's' ? [p + 0.55, p + 1.5] : [p + 2.5, p + 3.45];
    const head = dir === 'w' || dir === 'n' ? t0 : t1, step = dir === 'w' || dir === 'n' ? 1 : -1;
    let placed = 0;
    for (let k = 0; placed < n && k < n * 3; k++) {
      const lane = k & 1, d = k * 2.5 + 1.2 + r.f(0, 0.5), t = head + step * d;
      if (t < Math.min(t0, t1) || t > Math.max(t0, t1)) break;
      if (r.chance(0.12)) continue;
      const c = lanes[lane], x = h ? t : c, y = h ? c : t;
      const ex = r.chance(0.12) ? { crashed: true } : r.chance(0.08) ? { burnt: true } : { jam: true };
      const ang = a + (ex.crashed ? r.f(-0.45, 0.45) : r.f(-0.07, 0.07));
      if (this.stTryCar(x, y, ang, Object.assign(ex, { kind: r.weighted(ST_CARS) }))) placed++;
    }
  },
  // place a deliberate barricade on a road tile when it keeps the surroundings connected
  stBlock(x, y, t, dir, extra) { return this.stFree(x, y) && this.stSafe(x, y) ? this.put(x, y, t, dir, extra) : null; },
  stClosure(q, y, face, sx, sy) {
    const r = this.rng;
    for (let k = 0; k < 3; k++) this.stBlock(q + (face === 'S' ? k : k + 1), y, 'st_jersey', 'S', { v: k === 1 ? 2 : 0, kind: r.int(0, 2) });
    this.stBlock(sx, sy, 'st_closed', 'S', { kind: 'q' });
    for (let k = 0; k < 3; k++) { const x = q + r.int(0, 3), yy = y + (face === 'S' ? r.int(2, 4) : -r.int(2, 4)); if (this.stFree(x, yy)) this.put(x, yy, 'st_cone', 'S'); }
  },
  // h: the road runs along x; t: where the barricade crosses it; lanes: the inbound lanes it closes
  stPolice(h, t, lanes, cx, cy, ca) {
    this.stTryCar(cx, cy, ca, { kind: 'police' });
    for (const l of lanes) this.stBlock(h ? t : l, h ? l : t, 'st_sawhorse', h ? 'E' : 'S');
    for (let k = 0; k < 3; k++) { const x = h ? t - 1 - k : lanes[k % 2] - (k === 2 ? 2 : 0), y = h ? lanes[k % 2] - (k === 2 ? 2 : 0) : t - 1 - k; if (this.stFree(x, y)) this.put(x, y, 'st_cone', 'S'); }
  },
  // military checkpoint at the west (s = -1) or east (s = 1) end of Route 9
  stCheckpoint(s) {
    const r = this.rng, gx = s < 0 ? 8 : 392;          // fence line
    const out = s < 0 ? 1 : -1;                         // toward the county
    const inbound = s < 0 ? [105, 106] : [107, 108];    // lanes running at the fence
    const bx = gx + out * (s < 0 ? 3 : 4);
    for (const y of inbound) this.stBlock(bx, y, 'st_jersey', 'E', { v: 0 });
    for (const y of inbound) this.stBlock(bx + out, y, 'st_jersey', 'E', { v: 1 });
    this.stBlock(bx + out * 2, s < 0 ? 104 : 110, 'st_closed', 'E', { kind: 'q' });
    for (let k = 0; k < 4; k++) { const x = bx + out * (3 + k * 2), y = s < 0 ? 107 : 106; if (this.stFree(x, y)) this.put(x, y, 'st_cone', 'S'); }
    for (const [y, d] of [[103, 'S'], [110, 'N']]) {
      const x = gx + out * 2;
      if (this.stFree(x, y)) this.put(x, y, 'st_floodlight', d);
      this.stSolid(x + out, y, 'hay', 'S', { sandbag: true, v: r.int(0, 5) });
    }
    this.stSolid(gx + out * 4, s < 0 ? 102 : 111, 'st_booth', s < 0 ? 'E' : 'W');
    this.stTryCar(gx - out * 3.5, s < 0 ? 102.6 : 111.4, 0, { kind: 'army' });
    this.stTryCar(gx - out * 4, s < 0 ? 107.6 : 105.6, s < 0 ? Math.PI : 0, { kind: 'army' });
  },
  // ---------------------------------------------------------------- countryside: town limits, speed limits, deer, mile markers, rails, fences
  stCountry() {
    const W = this.W;
    const road = (h, p) => this.stR.find(R => R.h === h && R.p === p);
    const RT9 = road(true, 105), MAIN = road(false, 135), MBR = road(false, 300), CRK = road(true, 315);
    this.stEntry(RT9, 'w', 44, 0); this.stEntry(RT9, 'e', 199, 0); this.stEntry(MAIN, 'n', 44, 0); this.stEntry(MAIN, 's', 199, 0);
    this.stEntry(MBR, 'n', 254, 1); this.stEntry(CRK, 'w', 269, 1);
    // open-road signs: [road, along, side offset, facing, kind, value]
    const signs = [
      [RT9, 262, 4, 'W', 'deer'], [RT9, 338, -1, 'E', 'deer'], [RT9, 280, -1, 'E', 'speed', 55], [RT9, 245, 4, 'W', 'speed', 55],
      [MBR, 165, 4, 'S', 'deer'], [MBR, 214, -1, 'N', 'deer'], [MBR, 196, 4, 'S', 'speed', 45], [MBR, 135, -1, 'N', 'speed', 45],
      [MAIN, 300, -1, 'N', 'deer'], [MAIN, 262, 4, 'S', 'speed', 55], [MAIN, 345, -1, 'N', 'speed', 55], [MAIN, 22, 4, 'S', 'deer'],
      [CRK, 205, -1, 'E', 'speed', 45], [CRK, 175, 4, 'W', 'speed', 45],
      [RT9, 293, 4, 'W', 'cross'], [RT9, 309, -1, 'E', 'cross'],
    ];
    for (const [R, t, k, d, kind, v] of signs) {
      if (!R) continue;
      for (const dt of [0, 1, -1, 2, -2]) {
        const x = R.h ? t + dt : R.p + k, y = R.h ? R.p + k : t + dt;
        if (this.stFree(x, y) && !this.stRoad(x, y) && !this.stCrowd(x, y, 0)) { this.put(x, y, 'st_sign', d, v ? { kind, v } : { kind }); break; }
      }
    }
    // mile markers on the north verge of Route 9, numbered from the west
    for (let x = 15; x < this.GW - 5; x += 30) {
      if (this.stIn(x, 104)) continue;
      for (const dx of [0, 1, -1, 2]) if (this.stFree(x + dx, 104) && !this.stRoad(x + dx, 104) && !this.stCrowd(x + dx, 104, 0)) { this.put(x + dx, 104, 'st_sign', 'E', { kind: 'mile', v: Math.round(x / 30) + 1 }); break; }
    }
    // guard rails where a road runs beside water, and across from the two T-junctions out of town
    for (const R of this.stR) for (let t = R.s; t <= R.e; t++) for (const k of [-1, 4]) {
      const x = R.h ? t : R.p + k, y = R.h ? R.p + k : t, kk = k < 0 ? -1 : 1;
      if (this.stIn(x, y) || x < 1 || y < 1 || x >= this.GW - 1 || y >= this.H - 1) continue;
      let wet = false;
      for (let d = 1; d <= 3; d++) if (World.isWater(R.h ? x : x + kk * d, R.h ? y + kk * d : y)) wet = true;
      if (wet && !this.stRoad(x, y)) this.stBlock(x, y, 'st_rail', R.h ? 'S' : 'E');
    }
    for (let x = 297; x <= 306; x++) this.stBlock(x, 104, 'st_rail', 'S');
    for (let y = 312; y <= 321; y++) this.stBlock(134, y, 'st_rail', 'E');
    // the farm frontage on Main Street gets a fence, with a gap at the farm track
    this.fenceLine(133, 236, 16, 1, WT.PICKET, 0.03);
    this.fenceLine(133, 257, 44, 1, WT.PICKET, 0.03);
    // billboards: parallel to E-W roads on the north verge, to N-S roads on the west verge (faces the camera)
    for (const [R, t, v] of [[RT9, 30, 0], [RT9, 252, 2], [RT9, 362, 1], [MAIN, 26, 3], [MAIN, 332, 4], [MBR, 182, 0]]) {
      if (!R) continue;
      for (const dt of [0, 4, -4, 8, -8]) {
        const x = R.h ? t + dt : R.p - 4, y = R.h ? R.p - 4 : t + dt;
        let ok = true;
        for (let yy = y - 2; yy <= y + 2 && ok; yy++) for (let xx = x - 2; xx <= x + 2 && ok; xx++) {
          const i = yy * W + xx;
          if (xx < 1 || yy < 1 || xx >= this.GW - 1 || yy >= this.H - 1 || this.w.obj[i] || this.w.room[i] >= 0 || World.isWater(xx, yy) || this.stRoad(xx, yy) || this.stIn(xx, yy)) ok = false;
        }
        if (!ok) continue;
        this.put(x, y, 'st_billboard', R.h ? 'S' : 'E', { v });
        // keep the trees off it and off the view from the road
        for (let yy = y - 2; yy <= (R.h ? y + 3 : y + 2); yy++) for (let xx = x - 2; xx <= (R.h ? x + 2 : x + 3); xx++) if (!this.used[yy * W + xx]) this.used[yy * W + xx] = 1;
        break;
      }
    }
  },
  // town limits on a road entering a town at 'edge' from 'side': welcome board, speed limits both ways
  stEntry(R, side, edge, town) {
    if (!R) return;
    const out = side === 'w' || side === 'n' ? -1 : 1, T = (d) => edge + out * d;
    const inR = { w: 4, e: -1, n: -1, s: 4 }[side], outR = inR === 4 ? -1 : 4;
    const inFace = { w: 'W', e: 'E', n: 'N', s: 'S' }[side], outFace = { w: 'E', e: 'W', n: 'S', s: 'N' }[side];
    const at = (t, k) => R.h ? [t, R.p + k] : [R.p + k, t];
    for (const d of [5, 6, 4, 7, 8]) {
      const [x, y] = at(T(d), inR + (inR === 4 ? 1 : -1)), f = this.w.floor[y * this.W + x];
      if (ST_SOFT[f] && f !== FL.DIRT && this.stSolid(x, y, 'st_welcome', inFace, { v: town })) break;
    }
    for (const d of [3, 2, 4]) { const [x, y] = at(T(d), outR); if (this.stFree(x, y) && !this.stRoad(x, y) && !this.stCrowd(x, y, 0)) { this.put(x, y, 'st_sign', outFace, { kind: 'speed', v: 55 }); break; } }
    for (const d of [-6, -7, -5, -8]) { const [x, y] = at(T(d), inR); if (this.stFree(x, y) && !this.stRoad(x, y) && !this.stCrowd(x, y, 0)) { this.put(x, y, 'st_sign', inFace, { kind: 'speed', v: town ? 25 : 35 }); break; } }
  },
});
