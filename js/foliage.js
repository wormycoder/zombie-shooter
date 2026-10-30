'use strict';
// ---------------------------------------------------------------------------
// Foliage: tall grass, weeds and wildflowers, reeds (objects, sorted with the world), and the flat
// ground layer under them (tufts, clover, dandelions, dry patches, weeds in cracks, leaf litter: deco
// codes FD.*, baked into the ground chunks). Placed after the rest of the world (MapGen.foliagePass):
// overgrown where nobody kept the grass - empty lots, verges, field margins, fence lines, the water's
// edge - and the odd weed in the lawns and the pavement. All of it follows the season.
// ---------------------------------------------------------------------------
Object.assign(OBJ, {
  tallgrass: { n: 'Tall Grass', solid: false, h: 0.6, fol: true, burnGone: true, fuel: 4 },
  weeds: { n: 'Weeds', solid: false, h: 0.8, fol: true, burnGone: true, fuel: 4 },
  reeds: { n: 'Reeds', solid: false, h: 1.0, fol: true, burnGone: true, fuel: 3 },
});
// ground layer codes (w.deco)
const FD = { TUFT: 100, CLOVER: 103, DANDELION: 104, DRY: 105, CRACK: 106, LITTER: 108, END: 110 };

const Foliage = {
  // blade colours by grass season (p spring, g summer, a autumn, w winter)
  COLS: {
    p: ['#6a9a3a', '#7aaa44', '#5a8a32', '#8ab850', '#6e9e46'],
    g: ['#55803a', '#668c3e', '#4a7234', '#7a9a48', '#5e8a40'],
    a: ['#a89a50', '#b8a458', '#8a8a48', '#c0aa60', '#9a7a40'],
    w: ['#9a8c68', '#8a7c5c', '#aa9c78', '#7a6e54', '#94866a'],
  },
  DRY: {
    p: ['#9aa858', '#8a9a4a', '#a8b060', '#7a9a48'],
    g: ['#b8a860', '#a89850', '#c8b870', '#98a050'],
    a: ['#c0a860', '#b09850', '#d0b870', '#a08848'],
    w: ['#a89a78', '#988a68', '#b8aa88', '#887a5c'],
  },
  gs() { return Season.grass || 'g'; },
  isFol(o) { return !!(o && OBJ[o.t] && OBJ[o.t].fol); },

  // ------------------------------------------------------------------ painting helpers
  // a grass blade from the ground point b (screen px) up h px, leaning lx px, w px wide at the base
  blade(g, b, h, lx, w, col, tipCol) {
    const tx = b[0] + lx, ty = b[1] - h;
    if (tipCol && h > 4) { const gr = g.createLinearGradient(b[0], b[1], tx, ty); gr.addColorStop(0, col); gr.addColorStop(1, tipCol); g.fillStyle = gr; }
    else g.fillStyle = col;
    g.beginPath();
    g.moveTo(b[0] - w / 2, b[1]);
    g.quadraticCurveTo(b[0] - w / 2 + lx * 0.25, b[1] - h * 0.6, tx, ty);
    g.quadraticCurveTo(b[0] + w / 2 + lx * 0.25, b[1] - h * 0.55, b[0] + w / 2, b[1]);
    g.closePath(); g.fill();
    return [tx, ty];
  },
  // a clump of n blades round the tile centre (bx, by) within R tiles, up to H tiles tall; flat: pressed down
  // by a wheel, lying along one way
  clump(g, bx, by, rng, n, R, H, cols, o) {
    const P = (u, v) => [bx + (u - v) * HTW, by + (u + v) * HTH];
    const flat = o && o.flat, snow = Season.snow > 0.3, bl = [];
    // a dark mass at the foot, so the clump stands out from the lawn
    g.fillStyle = Col.rgba(Col.mix(cols[0], '#10180c', 0.45), 0.42);
    g.beginPath(); g.ellipse(bx, by + 1, R * 44, R * 19, 0, 0, 6.283); g.fill();
    for (let k = 0; k < n; k++) {
      const a = rng.f(0, 6.283), r = R * Math.sqrt(rng.next()), u = Math.cos(a) * r, v = Math.sin(a) * r;
      bl.push({ u, v, h: H * ZU * rng.f(0.5, 1) * (1 - r / R * 0.4), lx: rng.f(-6, 6) + (u - v) * 14, c: cols[rng.int(0, cols.length - 1)], w: rng.f(1.6, 2.6), s: rng.next() });
    }
    bl.sort((p, q) => p.u + p.v - q.u - q.v);
    const out = [];
    for (const b of bl) {
      const p = P(b.u, b.v), front = (b.u + b.v) / (2 * R) + 0.5;
      let h = b.h, lx = b.lx;
      if (flat) { h *= 0.22; lx = (lx > 0 ? 1 : -1) * (6 + Math.abs(lx)); }
      else if (snow) h *= 0.7;
      const tn = 0.72 + front * 0.22 + (b.s - 0.5) * 0.12;
      const tip = this.blade(g, p, h, lx, b.w, Trees.tone(b.c, tn), Trees.tone(b.c, tn + 0.38));
      out.push({ tip, s: b.s, h });
      if (snow && b.s < 0.5) { g.fillStyle = TREE_SNOW; g.fillRect(tip[0] - 1, tip[1], 2, 1.2); }
    }
    if (snow) { g.fillStyle = 'rgba(238,242,246,0.85)'; g.beginPath(); g.ellipse(bx, by + 1, R * 40, R * 14, 0, 0, 6.283); g.fill(); }
    return out;
  },
  dots(g, x, y, n, rx, ry, col, rng, s) {
    g.fillStyle = col;
    for (let k = 0; k < n; k++) g.fillRect(x + rng.f(-rx, rx), y + rng.f(-ry, ry), s || 1.5, s || 1.5);
  },
};

// ------------------------------------------------------------------ object painters
Object.assign(ObjArt, {
  k_tallgrass: (o) => Foliage.gs() + (Season.snow > 0.3 ? 'S' : '') + (o.flat ? 'f' : ''),
  k_weeds: (o) => Foliage.gs() + Season.tree + (Season.snow > 0.3 ? 'S' : '') + (o.flat ? 'f' : ''),
  k_reeds: (o) => Foliage.gs() + (Season.snow > 0.3 ? 'S' : '') + (o.flat ? 'f' : ''),
  // v 0-2 meadow grass (round, sprawling, tall), 3-4 dry grass of the verges
  d_tallgrass(o) {
    const g = this.g, v = (o.v || 0) % 5, gs = Foliage.gs(), bx = this.ax, by = this.ay + HTH;
    const rng = new RNG((o.v || 0) * 53 + 7);
    Trees.shadow(g, bx, by, 34, 0.14);
    const dry = v >= 3, cols = (dry ? Foliage.DRY : Foliage.COLS)[gs];
    const R = [0.5, 0.58, 0.44, 0.54, 0.48][v], H = [0.62, 0.5, 0.78, 0.52, 0.6][v], n = [90, 104, 78, 84, 74][v];
    const tips = Foliage.clump(g, bx, by, rng, n, R, H, cols, o);
    // seed heads in summer and autumn
    if (!o.flat && (gs === 'g' || gs === 'a') && Season.snow <= 0.3) {
      const hc = gs === 'a' ? '#c8b070' : dry ? '#c8b878' : '#a8a060';
      for (const t of tips) if (t.s > 0.72 && t.h > 10) { g.fillStyle = Trees.tone(hc, 0.85 + t.s * 0.2); g.beginPath(); g.ellipse(t.tip[0], t.tip[1] + 1.5, 1.1, 2.6, 0.2, 0, 6.283); g.fill(); }
    }
  },
  // v 0 goldenrod, 1 Queen Anne's lace, 2 thistle, 3 chicory and dandelions
  d_weeds(o) {
    const g = this.g, v = (o.v || 0) % 4, gs = Foliage.gs(), bx = this.ax, by = this.ay + HTH, snow = Season.snow > 0.3;
    const rng = new RNG((o.v || 0) * 71 + 3), dead = gs === 'w';
    const P = (u, w, z) => [bx + (u - w) * HTW, by + (u + w) * HTH - z * ZU];
    Trees.shadow(g, bx, by, 24, 0.12);
    // grass round the foot
    Foliage.clump(g, bx, by, rng, 36, 0.42, 0.34, Foliage.COLS[gs], o);
    if (o.flat) return;
    const stemC = dead ? '#7a6a50' : gs === 'a' ? '#7a7a40' : '#4e7434';
    const n = [7, 6, 3, 6][v], tops = [];
    for (let k = 0; k < n; k++) {
      const a = rng.f(0, 6.283), r = rng.f(0, 0.26), u = Math.cos(a) * r, w = Math.sin(a) * r;
      const h = [0.75, 0.7, 0.6, 0.55][v] * rng.f(0.7, 1) * (snow ? 0.85 : 1), lean = rng.f(-0.12, 0.12);
      const b = P(u, w, 0), t = P(u + lean, w - lean, h);
      g.strokeStyle = Trees.tone(stemC, 0.8 + rng.f(0, 0.2)); g.lineWidth = v === 2 ? 1.6 : 1.1;
      g.beginPath(); g.moveTo(b[0], b[1]); g.quadraticCurveTo(b[0] + rng.f(-2, 2), (b[1] + t[1]) / 2, t[0], t[1]); g.stroke();
      // leaves along the stem
      if (!dead && v !== 2) for (let j = 1; j < 4; j++) { const q = j / 4, x = b[0] + (t[0] - b[0]) * q, y = b[1] + (t[1] - b[1]) * q, s = rng.chance(0.5) ? 1 : -1; Foliage.blade(g, [x, y], 2.2, s * 4, 1.2, Trees.tone(stemC, 0.95)); }
      tops.push(t);
    }
    if (v === 2 && !dead) {
      // thistle: a rosette of broad spiny leaves
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.3, p = P(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.02); g.fillStyle = Trees.tone('#4a6a38', 0.85 + (Math.sin(a) + Math.cos(a)) * 0.08); g.beginPath(); g.ellipse((p[0] + bx) / 2, (p[1] + by) / 2, 7, 2.6, a * 0.5, 0, 6.283); g.fill(); }
    }
    for (const t of tops) {
      if (dead) { g.fillStyle = '#6a5a44'; g.fillRect(t[0] - 1.5, t[1] - 1, 3, 2); if (snow) { g.fillStyle = TREE_SNOW; g.fillRect(t[0] - 2, t[1] - 2, 4, 1.4); } continue; }
      if (v === 0) {
        // goldenrod plumes: green buds in summer, gold from late summer
        const c = gs === 'a' || Season.tree === 'y' ? '#e0b830' : gs === 'g' ? '#b8b840' : '#7a9a40';
        for (let j = 0; j < 7; j++) { g.fillStyle = Trees.tone(c, rng.f(0.85, 1.1)); g.fillRect(t[0] + rng.f(-2.5, 2.5) + j * 0.3, t[1] - j * 1.1 + 4, 1.8, 1.8); }
      } else if (v === 1) {
        // white umbels, brown and curled up in autumn
        const c = gs === 'a' ? '#a89a78' : gs === 'g' ? '#f0eee4' : '#a8c070';
        g.fillStyle = c; g.beginPath(); g.ellipse(t[0], t[1], 4, 1.6, 0, 0, 6.283); g.fill();
        Foliage.dots(g, t[0], t[1] - 0.5, 5, 3.4, 1, Trees.tone(c, 1.1), rng, 1.2);
      } else if (v === 2) {
        // thistle heads: purple in summer, white down in autumn
        const c = gs === 'g' ? '#9a4aa0' : gs === 'a' ? '#e8e4dc' : '#6a8a40';
        g.fillStyle = '#5a7a3a'; g.beginPath(); g.ellipse(t[0], t[1] + 2, 2.4, 2.4, 0, 0, 6.283); g.fill();
        g.fillStyle = c; g.beginPath(); g.ellipse(t[0], t[1], 2.6, 2, 0, 0, 6.283); g.fill();
      } else {
        // chicory: small sky-blue flowers along the top of the stem
        if ((gs === 'g' || gs === 'p') && rng.chance(0.7)) for (let j = 0; j < 2; j++) { g.fillStyle = gs === 'p' ? '#e8d030' : '#8aa4e4'; g.beginPath(); g.arc(t[0] + rng.f(-1.5, 1.5), t[1] + j * 3.5, 1.2, 0, 6.283); g.fill(); }
      }
    }
  },
  // cattails at the water's edge
  d_reeds(o) {
    const g = this.g, v = (o.v || 0) % 2, gs = Foliage.gs(), bx = this.ax, by = this.ay + HTH, snow = Season.snow > 0.3;
    const rng = new RNG((o.v || 0) * 29 + 5), dead = gs === 'w' || gs === 'a';
    const P = (u, w, z) => [bx + (u - w) * HTW, by + (u + w) * HTH - z * ZU];
    Trees.shadow(g, bx, by, 24, 0.12);
    const cols = dead ? ['#a89468', '#988458', '#b8a478'] : ['#5a8a3a', '#4a7a34', '#6a9a44'];
    const n = v ? 30 : 22, bl = [];
    for (let k = 0; k < n; k++) { const a = rng.f(0, 6.283), r = rng.f(0, 0.34); bl.push({ u: Math.cos(a) * r, w: Math.sin(a) * r, h: rng.f(0.6, 1.05), lx: rng.f(-4, 4), c: cols[rng.int(0, cols.length - 1)], head: rng.chance(0.3) }); }
    bl.sort((p, q) => p.u + p.w - q.u - q.w);
    for (const b of bl) {
      const p = P(b.u, b.w, 0);
      const h = b.h * ZU * (o.flat ? 0.25 : snow ? 0.8 : 1);
      if (b.head && !o.flat) {
        // a stalk with its brown head (fluffy and pale in winter)
        const t = [p[0] + b.lx * 0.3, p[1] - h * 1.05];
        g.strokeStyle = Trees.tone('#6a7a40', 0.9); g.lineWidth = 1; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(t[0], t[1]); g.stroke();
        g.fillStyle = gs === 'w' ? '#b8a890' : '#5a3a22'; g.beginPath(); g.ellipse(t[0], t[1] + 4, 1.8, 4.2, 0, 0, 6.283); g.fill();
        if (snow) { g.fillStyle = TREE_SNOW; g.fillRect(t[0] - 1.5, t[1] - 0.5, 3, 1.5); }
      } else Foliage.blade(g, p, h, o.flat ? 8 : b.lx, 1.6, Trees.tone(b.c, 0.85 + (b.u + b.w) * 0.3));
    }
  },
});

// ------------------------------------------------------------------ ground layer (flat, in the ground chunks)
Foliage.deco = function (dc, gs) {
  gs = gs || 'g';
  return Spr.get('fd' + dc + gs, 66, 34, 33, 1, (g, ax, ay) => {
    const P = (u, v) => isoP(ax, ay, u, v, 0), rng = new RNG(dc * 97 + 13), cols = Foliage.COLS[gs];
    if (dc >= FD.TUFT && dc < FD.TUFT + 3) {
      // a few short tufts, darker than the lawn round them
      for (let k = 0; k < 3 + (dc - FD.TUFT); k++) {
        const c = P(rng.f(0.3, 0.8), rng.f(0.3, 0.8));
        for (let j = 0; j < 7; j++) Foliage.blade(g, [c[0] + rng.f(-3, 3), c[1] + rng.f(-1, 1.5)], rng.f(2, 4.5), rng.f(-2.5, 2.5), 1.2, Trees.tone(cols[rng.int(0, cols.length - 1)], rng.f(0.72, 0.95)));
      }
    } else if (dc === FD.CLOVER || dc === FD.DANDELION) {
      // low leaves in a patch; white clover heads in summer, dandelions yellow in spring, puffs in early summer
      const n = 9;
      for (let k = 0; k < n; k++) {
        const c = P(rng.f(0.25, 0.8), rng.f(0.25, 0.8));
        g.fillStyle = Trees.tone(gs === 'w' ? '#7a7a58' : gs === 'a' ? '#7a8a48' : '#4e8a3a', rng.f(0.85, 1.1));
        g.beginPath(); g.ellipse(c[0], c[1], dc === FD.CLOVER ? 2.4 : 3.2, dc === FD.CLOVER ? 1.4 : 1.1, rng.f(-0.5, 0.5), 0, 6.283); g.fill();
        if (gs === 'w' || rng.chance(0.45)) continue;
        if (dc === FD.CLOVER && gs === 'g') { g.fillStyle = '#f2f0e6'; g.beginPath(); g.arc(c[0] + 1, c[1] - 1.5, 1.4, 0, 6.283); g.fill(); }
        if (dc === FD.DANDELION && (gs === 'p' || gs === 'g')) { g.fillStyle = gs === 'p' || rng.chance(0.6) ? '#f0c820' : '#f4f4ee'; g.beginPath(); g.arc(c[0] + 0.5, c[1] - 2, 1.6, 0, 6.283); g.fill(); }
      }
    } else if (dc === FD.DRY) {
      // a dry, thin patch: straw-coloured blades and bare earth showing
      for (let k = 0; k < 4; k++) { const c = P(rng.f(0.25, 0.75), rng.f(0.25, 0.75)); g.fillStyle = 'rgba(120,96,64,0.35)'; g.beginPath(); g.ellipse(c[0], c[1], rng.f(4, 8), rng.f(1.6, 3), 0, 0, 6.283); g.fill(); }
      const dc2 = Foliage.DRY[gs];
      for (let k = 0; k < 24; k++) { const c = P(rng.f(0.2, 0.85), rng.f(0.2, 0.85)); Foliage.blade(g, c, rng.f(1.5, 3.5), rng.f(-3, 3), 1, Trees.tone(dc2[rng.int(0, dc2.length - 1)], rng.f(0.85, 1.05))); }
    } else if (dc === FD.CRACK || dc === FD.CRACK + 1) {
      // weeds coming up through a crack in the pavement
      const a = P(rng.f(0.15, 0.3), rng.f(0.3, 0.7)), b = P(rng.f(0.7, 0.85), rng.f(0.3, 0.7)), m = [(a[0] + b[0]) / 2 + rng.f(-3, 3), (a[1] + b[1]) / 2 + rng.f(-1.5, 1.5)];
      g.strokeStyle = 'rgba(40,38,34,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(m[0], m[1]); g.lineTo(b[0], b[1]); g.stroke();
      const wc = gs === 'w' ? Foliage.DRY.w : cols;
      for (const c of dc === FD.CRACK ? [m] : [m, [(a[0] + m[0]) / 2, (a[1] + m[1]) / 2]]) for (let j = 0; j < 8; j++) Foliage.blade(g, [c[0] + rng.f(-2, 2), c[1] + rng.f(-0.5, 0.8)], rng.f(2, 4.5), rng.f(-3, 3), 1.2, Trees.tone(wc[rng.int(0, wc.length - 1)], rng.f(0.8, 1.05)));
    } else if (dc === FD.LITTER || dc === FD.LITTER + 1) {
      // fallen leaves and twigs, thick in autumn
      const n = gs === 'a' ? 26 : gs === 'w' ? 18 : 10, lc = gs === 'a' ? ['#b0602a', '#c88a30', '#8a5a2a', '#a8742e'] : ['#7a5a3a', '#8a6a44', '#6a4e34'];
      for (let k = 0; k < n; k++) { const c = P(rng.f(0.15, 0.85), rng.f(0.15, 0.85)); g.fillStyle = lc[rng.int(0, lc.length - 1)]; g.beginPath(); g.ellipse(c[0], c[1], 1.8, 1, rng.f(0, 3), 0, 6.283); g.fill(); }
      if (dc === FD.LITTER + 1) { const a = P(0.3, 0.4), b = P(0.6, 0.55); g.strokeStyle = '#5a4430'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    }
  });
};

// ------------------------------------------------------------------ placement (end of world generation)
Foliage.place = function (m) {
  const w = m.w, W = m.W, GW = m.GW, H = m.H, n = W * H;
  const own = Yard.own && Yard.own.length === n ? Yard.own : null;
  const rng = new RNG((w.seed || 1) * 7 + 1301), nP = makeNoise((w.seed || 1) + 71), nQ = makeNoise((w.seed || 1) + 97);
  const F = w.floor, O = w.obj, RM = w.room;
  const grass = (f) => f === FL.GRASS || f === FL.GRASS2;
  const road = (f) => f === FL.ASPHALT || f === FL.GRAVEL || f === FL.PARKING || f === FL.SIDEWALK || f === FL.CONCRETE;
  const water = (f) => f === FL.WATER || f === FL.DEEPWATER;
  // chessboard distances (capped at 9) to the nearest road, water and building
  const dist = (src) => {
    const d = new Uint8Array(n).fill(9);
    for (let y = 0; y < H; y++) for (let x = 0; x < GW; x++) if (src(y * W + x)) d[y * W + x] = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < GW; x++) {
      const i = y * W + x; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + 1); if (x < GW - 1) v = Math.min(v, d[i - W + 1] + 1); }
      d[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = GW - 1; x >= 0; x--) {
      const i = y * W + x; let v = d[i];
      if (x < GW - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) { v = Math.min(v, d[i + W] + 1); if (x < GW - 1) v = Math.min(v, d[i + W + 1] + 1); if (x > 0) v = Math.min(v, d[i + W - 1] + 1); }
      d[i] = v;
    }
    return d;
  };
  const dR = dist(i => road(F[i])), dW = dist(i => water(F[i])), dB = dist(i => RM[i] >= 0);
  // kept grounds: the towns' building plots near buildings, the army base, the prison, grounds someone mowed (kept)
  const kept = (zs => (x, y) => zs.some(z => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1))(w.zones.filter(z => z.outfit === 'military' || z.outfit === 'prisoner' || z.outfit === 'police' || z.kept));
  const inTown = (x, y) => (w.towns || []).some(t => x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1);
  const fence = (x, y) => World.wall(x, y, 0) || World.wall(x, y, 1) || World.wall(x + 1, y, 1) || World.wall(x, y + 1, 0);
  const field = (i) => F[i - 1] === FL.FURROW || F[i + 1] === FL.FURROW || F[i - W] === FL.FURROW || F[i + W] === FL.FURROW;
  const put = (i, t, v) => { O[i] = { t, dir: 'S', v }; };
  let nObj = 0, nDeco = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < GW - 1; x++) {
    const i = y * W + x, f = F[i];
    if (RM[i] >= 0 || O[i]) continue;
    const r = rng.next(), r2 = rng.next(), patch = nP(x / 9, y / 9, 2), fine = nQ(x / 3.2, y / 3.2, 1);
    // the pavement: weeds in the cracks, more where grass is next to it
    if (road(f)) {
      if (w.deco[i] || f === FL.ASPHALT && dR[i] === 0 && !grass(F[i - 1]) && !grass(F[i + 1]) && !grass(F[i - W]) && !grass(F[i + W])) continue;
      const pc = f === FL.SIDEWALK ? 0.035 : f === FL.PARKING ? 0.05 : f === FL.GRAVEL ? 0.06 : 0.02;
      if (r < pc) { w.deco[i] = FD.CRACK + (r2 < 0.4 ? 1 : 0); nDeco++; }
      continue;
    }
    // reeds along the water, on any soft shore
    if (dW[i] === 1 && (f === FL.FOREST || f === FL.SAND || f === FL.DIRT) && !(own && own[i] >= 0) && r < 0.45) { put(i, 'reeds', r2 < 0.5 ? 0 : 1); nObj++; continue; }
    if (f === FL.FOREST) {
      if (!w.deco[i] && r < 0.12) { w.deco[i] = FD.LITTER + (r2 < 0.3 ? 1 : 0); nDeco++; }
      continue;
    }
    if (!grass(f)) continue;
    const owned = own && own[i] >= 0, town = inTown(x, y), keep = kept(x, y);
    // the water's edge: reeds, then tall grass
    if (dW[i] <= 2 && !owned && !keep) {
      if (dW[i] === 1 && r < 0.55) { put(i, 'reeds', r2 < 0.5 ? 0 : 1); nObj++; continue; }
      if (r < 0.3) { put(i, 'tallgrass', rng.int(0, 2)); nObj++; continue; }
    }
    let p = 0;
    if (owned || keep) p = 0;
    else if (town) {
      // a town's own grass is mostly kept; lots well away from any building and the verges' far side go wild in patches
      if (dB[i] >= 5 && dR[i] >= 2) p = Math.max(0, patch - 0.42) * 1.6;
      if (fence(x, y) && dB[i] >= 2) p += 0.25;
    } else {
      // the countryside: verges, field margins, fence lines and meadow patches
      p = dR[i] === 1 ? 0.3 : dR[i] <= 3 ? 0.2 : 0.04;
      p += Math.max(0, patch - 0.45) * 1.1;
      if (field(i)) p += 0.35;
      if (fence(x, y)) p += 0.3;
      if (dB[i] <= 2) p *= 0.4;
    }
    if (r < p * (0.6 + fine * 0.8)) {
      // now and then a wild shrub among it
      if (r2 > 0.95 && m.shrubV) { O[i] = { t: 'bush', dir: 'S', v: m.shrubV(x, y, r2 > 0.98 ? 1 : 0), berries: rng.next() < 0.35 }; nObj++; continue; }
      const kind = r2 < 0.18 ? 'weeds' : 'tallgrass';
      put(i, kind, kind === 'weeds' ? rng.int(0, 3) : (dR[i] <= 2 && !town ? rng.int(3, 4) : rng.int(0, 2)));
      nObj++;
      continue;
    }
    // the flat layer: tufts and dry patches in the rough, clover and dandelions here and there in the lawns
    if (w.deco[i]) continue;
    const pd = owned || keep ? 0.06 : 0.22;
    if (r2 < pd) {
      const q = rng.next();
      w.deco[i] = owned || keep ? (q < 0.5 ? FD.CLOVER : q < 0.8 ? FD.DANDELION : FD.TUFT) : q < 0.55 ? FD.TUFT + rng.int(0, 2) : q < 0.75 ? FD.DRY : q < 0.88 ? FD.DANDELION : FD.CLOVER;
      nDeco++;
    }
  }
  return { obj: nObj, deco: nDeco };
};
if (typeof MapGen !== 'undefined') MapGen.foliagePass = function () { this.foliageStats = Foliage.place(this); };
