'use strict';
// ---------------------------------------------------------------------------
// House exteriors & yards: porches, flower beds, hedges, patios and decks, gardens, sheds, fences,
// play things, lawn ornaments and back-yard clutter. Every home gets a household "character"
// (tidy, family, elderly, gardener, handyman, messy, rural) that decides what its yard holds.
// Extends OBJ / ObjArt / DECO_ART / LOOT and defines MapGen.yardPass (called from MapGen.generate).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------- object types
Object.assign(OBJ, {
  // front yard & porch
  yd_flowers: { n: 'Flower Bed', solid: false, h: 0.45, fuel: 4, burnGone: true },
  yd_hedge: { n: 'Hedge', solid: true, h: 1.05, fuel: 16, burnGone: true },
  yd_pathlight: { n: 'Garden Light', solid: false, h: 0.5, emit: (o, x, y, amb) => (amb < 0.6 ? { x: x + 0.5, y: y + 0.5, r: 2.4, p: 0.28, out: true, warm: true } : null) },
  yd_gnome: { n: 'Garden Gnome', solid: false, h: 0.5 },
  yd_flamingo: { n: 'Plastic Flamingo', solid: false, h: 0.9, fuel: 2, burnGone: true },
  yd_birdbath: { n: 'Birdbath', solid: 'circle', rad: 0.2, h: 0.95 },
  yd_feeder: { n: 'Bird Feeder', solid: 'circle', rad: 0.06, h: 1.75, fuel: 4, burnGone: true },
  yd_flagpole: { n: 'Flag Pole', solid: 'circle', rad: 0.06, h: 4.2, spr: { w: 150, h: 200, ax: 75, ay: 166 } },
  yd_forsale: { n: 'For Sale Sign', solid: false, h: 1.3, fuel: 3, burnGone: true },
  yd_tap: { n: 'Garden Tap', solid: false, h: 0.75, water: 'tap' },
  yd_rocker: { n: 'Rocking Chair', solid: false, h: 1.15, sit: true, fuel: 12 },
  yd_planter: { n: 'Flower Pot', solid: false, h: 0.75 },
  // back yard
  yd_lawnchair: { n: 'Lawn Chair', solid: false, h: 0.9, sit: true, fuel: 3, burnGone: true },
  yd_kpool: { n: 'Kiddie Pool', solid: false, h: 0.3 },
  yd_swing: { n: 'Swing Set', solid: true, h: 2.0 },
  yd_trampoline: { n: 'Trampoline', solid: true, h: 0.75 },
  yd_sandbox: { n: 'Sandbox', solid: false, h: 0.25 },
  yd_bike: { n: "Kid's Bicycle", solid: false, h: 0.2 },
  yd_toys: { n: 'Toys', solid: false, h: 0.25, fuel: 2, burnGone: true },
  yd_clothesline: { n: 'Clothesline', solid: false, h: 1.9 },
  yd_doghouse: { n: 'Doghouse', solid: true, h: 1.0, fuel: 20, burnBig: true },
  yd_compost: { n: 'Compost Bin', solid: true, h: 0.85, cont: { type: 'compost', cap: 20 }, fuel: 14 },
  yd_woodpile: { n: 'Woodpile', solid: true, h: 0.9, cont: { type: 'woodpile', cap: 60 }, fuel: 60, burnBig: true },
  yd_chopblock: { n: 'Chopping Block', solid: true, h: 0.6, cont: { type: 'chopblock', cap: 6 }, fuel: 20 },
  yd_mower: { n: 'Lawn Mower', solid: true, h: 0.85 },
  yd_wheelbarrow: { n: 'Wheelbarrow', solid: false, h: 0.6, cont: { type: 'wheelbarrow', cap: 25 } },
  yd_propane: { n: 'Propane Tank', solid: 'circle', rad: 0.26, h: 0.95 },
  yd_ac: { n: 'Air Conditioner', solid: true, h: 0.8 },
  yd_tires: { n: 'Old Tires', solid: true, h: 0.7, fuel: 40, burnBig: true },
  yd_junk: { n: 'Broken Appliance', solid: true, h: 0.9 },
  yd_carparts: { n: 'Car Parts', solid: true, h: 0.6, cont: { type: 'carparts', cap: 25 } },
  yd_couch: { n: 'Old Couch', solid: true, h: 0.85, sit: true, fuel: 40, burnBig: true },
  yd_trashbags: { n: 'Garbage Bags', solid: false, h: 0.5, cont: { type: 'trash', cap: 15 }, fuel: 6, burnGone: true },
  yd_weeds: { n: 'Weeds', solid: false, h: 0.6, fuel: 4, burnGone: true },
  yd_icechest: { n: 'Cooler Box', solid: false, h: 0.5, cont: { type: 'icechest', cap: 12 } },
  yd_dish: { n: 'Satellite Dish', solid: 'circle', rad: 0.1, h: 1.5 },
  yd_logbench: { n: 'Log Bench', solid: false, h: 0.45, sit: true, fuel: 25 },
  yd_shed: { n: 'Garden Shed', solid: true, h: 2.35, cont: { type: 'toolcab', cap: 40 }, fuel: 40, burnBig: true },
  // rural
  yd_outhouse: { n: 'Outhouse', solid: true, h: 2.4, cont: { type: 'outhouse', cap: 6 }, fuel: 35, burnBig: true },
  yd_coop: { n: 'Chicken Coop', solid: true, h: 1.45, cont: { type: 'coop', cap: 12 }, fuel: 30, burnBig: true },
});
Object.assign(MOVEABLE, { yd_lawnchair: 3, yd_rocker: 7, yd_planter: 6, yd_mower: 22, yd_icechest: 4, yd_gnome: 2, yd_flamingo: 1, yd_birdbath: 14, yd_doghouse: 16, yd_compost: 10, yd_wheelbarrow: 12, yd_bike: 6, yd_kpool: 3 });
Object.assign(LOOT, {
  'shed.toolcab': { n: [2, 5], empty: 0.1, items: [['@tools', 20], ['Shovel', 4], ['Trowel', 4], ['WateringCan', 3], ['Bucket', 2], ['GasCan', 4], ['Axe', 1.2], ['HandAxe', 1.5], ['WoodAxe', 0.7], ['Saw', 3], ['Hammer', 3], ['NailsBox', 4], ['Plank', 3], ['LeatherGloves', 2], ['@seeds', 4], ['Toolbox', 1], ['Crowbar', 1], ['Sledgehammer', 0.3], ['FishingRod', 1], ['BookFarming1', 0.6], ['BookCarpentry1', 0.6], ['Generator', 0.15], ['DuctTape', 2]] },
  '*.compost': { n: [0, 3], empty: 0.3, items: [['Worms', 6], ['Insects', 1], ['Twigs', 1]] },
  '*.woodpile': { n: [2, 5], empty: 0.05, items: [['Log', 7], ['Twigs', 3], ['TreeBranch', 2], ['Plank', 1]] },
  '*.chopblock': { n: [0, 1], empty: 0.45, items: [['HandAxe', 3], ['Axe', 2], ['WoodAxe', 1], ['Log', 2]] },
  '*.wheelbarrow': { n: [0, 2], empty: 0.45, items: [['Stone', 2], ['Twigs', 2], ['Trowel', 1], ['Shovel', 0.6], ['@seeds', 1], ['Log', 0.5], ['GarbageBag', 1]] },
  '*.carparts': { n: [0, 3], empty: 0.35, items: [['PipeWrench', 1], ['Screwdriver', 1], ['DuctTape', 1], ['GasCan', 1], ['Battery', 1.5], ['LeadPipe', 1], ['Toolbox', 0.3], ['BookMechanics1', 0.3]] },
  '*.outhouse': { n: [0, 2], empty: 0.5, items: [['Newspaper', 3], ['Magazine', 3], ['Matches', 0.5], ['RippedSheets', 1]] },
  '*.coop': { n: [0, 3], empty: 0.35, items: [['Egg', 6], ['Twigs', 1]] },
  '*.icechest': { n: [0, 3], empty: 0.35, items: [['Beer', 5], ['Pop', 3], ['PopOrange', 1], ['WaterBottle', 2], ['JuiceBox', 1]] },
});
// drop entries for items this build does not have (loot tables are shared data)
for (const k of ['shed.toolcab', '*.compost', '*.woodpile', '*.chopblock', '*.wheelbarrow', '*.carparts', '*.outhouse', '*.coop', '*.icechest']) LOOT[k].items = LOOT[k].items.filter(e => e[0][0] === '@' || ITEMS[e[0]]);

// flower palettes (o.col) and yard ground decals
const YD_FLOWERS = [['#e0304a', '#f0c030'], ['#f4f4f0', '#e890b0'], ['#9a50c8', '#f0e060'], ['#f08a20', '#e83030'], ['#e870a0', '#ffffff'], ['#4070d8', '#f0f0f0']];
const YD_DECO = { STRIPE: 60, STONES: 61 };

// ---------------------------------------------------------------- art
const ydSeason = () => Season.tree + (stSnowy() ? 'S' : '');
DECO_ART[YD_DECO.STRIPE] = (g, P) => { poly(g, [P(0, 0), P(1, 0), P(1, 1), P(0, 1)], 'rgba(255,255,230,0.07)'); };
DECO_ART[YD_DECO.STONES] = (g, P) => {
  for (const [u, v, r] of [[0.3, 0.32, 0.15], [0.66, 0.62, 0.14]]) {
    const c = P(u, v);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(c[0] + 1, c[1] + 1, r * 45, r * 22, 0, 0, 7); g.fill();
    g.fillStyle = '#a8a49a'; g.beginPath(); g.ellipse(c[0], c[1], r * 45, r * 22, 0, 0, 7); g.fill();
  }
};
Object.assign(ObjArt, {
  // point on a visible box face: face 'S' (v = v1) or 'E' (u = u1), a 0..1 left to right on screen
  ydFace(face, b, a, z) { return face === 'S' ? this.P(U.lerp(b[0], b[3], a), b[4] + 0.002, z) : this.P(b[3] + 0.002, U.lerp(b[4], b[1], a), z); },
  // gable roof over a local box (ridge along the facing direction), gable ends drawn when visible
  ydGable(d, a0, a1, b0, b1, z0, z1, col, wall) {
    const g = this.g, L = (a, b, z) => this.stLP(d, a, b, z), am = (a0 + a1) / 2;
    const planes = [[a0, am], [am, a1]].map(([p, q]) => { const pts = [L(p === am ? am : p - 0.04, b0 - 0.04, p === am ? z1 : z0), L(q === am ? am : q + 0.04, b0 - 0.04, q === am ? z1 : z0), L(q === am ? am : q + 0.04, b1 + 0.04, q === am ? z1 : z0), L(p === am ? am : p - 0.04, b1 + 0.04, p === am ? z1 : z0)]; const c = this.stUV(d, (p + q) / 2, (b0 + b1) / 2); return { pts, depth: c[0] + c[1], sh: p === am ? 1 : 0 }; });
    planes.sort((A, B) => A.depth - B.depth);
    for (const pl of planes) poly(g, pl.pts, Col.shade(col, pl.depth > 1 ? FACE_E : 0.92), 'rgba(0,0,0,0.25)', 1);
    const end = this.stFront(d) ? b1 : b0;
    poly(g, [L(a0, end, z0), L(a1, end, z0), L(am, end, z1)], Col.shade(wall, FACE_S));
  },
  d_yd_flowers(o) {
    const g = this.g, rng = new RNG(31 + (o.v || 0) * 7), pal = YD_FLOWERS[(o.col || 0) % YD_FLOWERS.length], st = Season.tree;
    this.box(0.05, 0.05, 0, 0.95, 0.95, 0.07, (o.v || 0) & 1 ? '#8a7a68' : '#9a5a48', false);
    poly(g, [this.P(0.1, 0.1, 0.071), this.P(0.9, 0.1, 0.071), this.P(0.9, 0.9, 0.071), this.P(0.1, 0.9, 0.071)], '#4a3626');
    const bare = st === 'b' || stSnowy(), pts = [];
    for (let k = 0; k < (st === 's' ? 6 : 12); k++) pts.push([rng.f(0.18, 0.82), rng.f(0.18, 0.82), rng.f(0.12, 0.3), rng.next()]);
    pts.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [u, v, h, q] of pts) {
      const b = this.P(u, v, 0.07), t = this.P(u, v, 0.07 + h);
      if (bare) { line(g, b, t, '#6a5a3a', 1); continue; }
      g.fillStyle = st === 'a' || st === 'y' || st === 's' ? '#6a7a3a' : q < 0.5 ? '#3a7a34' : '#2e6a2a';
      g.beginPath(); g.ellipse(t[0], t[1] + 2, 5, 3, 0, 0, 7); g.fill();
      if (st === 'g' || st === 'p' || (st === 'y' && q < 0.5)) { g.fillStyle = pal[q < 0.6 ? 0 : 1]; g.beginPath(); g.arc(t[0] + (q - 0.5) * 4, t[1] - 1, 2.1, 0, 7); g.fill(); }
    }
    if (stSnowy()) poly(g, [this.P(0.08, 0.08, 0.1), this.P(0.92, 0.08, 0.1), this.P(0.92, 0.92, 0.1), this.P(0.08, 0.92, 0.1)], 'rgba(238,242,246,0.92)');
  },
  k_yd_flowers: ydSeason,
  d_yd_hedge(o) {
    const g = this.g, rng = new RNG(7 + (o.v || 0)), col = '#3a6a2e';
    this.shadow(0.03, 0.03, 0.97, 0.97);
    this.box(0.03, 0.03, 0, 0.97, 0.97, 1.0, col, false);
    for (let k = 0; k < 46; k++) {
      const f = rng.int(0, 2), a = rng.f(0.06, 0.94), z = rng.f(0.06, 0.95);
      const p = f === 0 ? this.P(a, 0.97, z) : f === 1 ? this.P(0.97, a, z) : this.P(rng.f(0.08, 0.92), rng.f(0.08, 0.92), 1.0);
      g.fillStyle = rng.chance(0.5) ? 'rgba(110,160,70,0.5)' : 'rgba(18,44,16,0.45)';
      g.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3);
    }
    this.stSnowTop(0.03, 0.03, 0.97, 0.97, 1.0);
  },
  k_yd_hedge: () => (stSnowy() ? 'S' : ''),
  d_yd_pathlight() {
    this.stShadow(0.5, 0.5, 4, 2);
    this.stCyl(0.5, 0.5, 0.035, 0, 0.34, '#2a2c2e');
    this.stCyl(0.5, 0.5, 0.07, 0.34, 0.44, '#e8e2c4', '#f4f0d8');
    this.stCyl(0.5, 0.5, 0.09, 0.44, 0.48, '#2a2c2e');
  },
  a_yd_pathlight(ctx, o, X, Y) {
    if (!Street.night()) return;
    const p = isoP(X, Y, 0.5, 0.5, 0.39);
    Street.drawGlow(ctx, '#fff0c0', p[0], p[1], 8, 0.8);
  },
  d_yd_gnome(o) {
    const g = this.g, coat = ['#3060b0', '#2a8a3a', '#c03030', '#d08020'][(o.v || 0) % 4];
    this.stShadow(0.5, 0.5, 5, 2.5);
    this.stCyl(0.5, 0.5, 0.09, 0, 0.2, coat);
    const f = this.P(0.5, 0.5, 0.27);
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.moveTo(f[0] - 3.4, f[1]); g.lineTo(f[0] + 3.4, f[1]); g.lineTo(f[0], f[1] + 7); g.closePath(); g.fill();
    g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(f[0], f[1] - 1, 2.8, 0, 7); g.fill();
    const t = this.P(0.5, 0.5, 0.5);
    poly(g, [[f[0] - 3.6, f[1] - 2.5], [f[0] + 3.6, f[1] - 2.5], [t[0] + 1, t[1]]], '#c82828');
  },
  d_yd_flamingo(o) {
    const g = this.g, s = o.v ? -1 : 1, pink = '#f070a0';
    this.stShadow(0.5, 0.5, 5, 2);
    line(g, this.P(0.47, 0.5, 0), this.P(0.47, 0.5, 0.52), '#3a3a3a', 1);
    line(g, this.P(0.53, 0.5, 0), this.P(0.53, 0.5, 0.52), '#3a3a3a', 1);
    const b = this.P(0.5, 0.5, 0.58);
    g.fillStyle = pink; g.beginPath(); g.ellipse(b[0], b[1], 7, 4, s * 0.25, 0, 7); g.fill();
    const h = this.P(0.5, 0.5, 0.9);
    g.strokeStyle = pink; g.lineWidth = 2; g.beginPath(); g.moveTo(b[0] + s * 4, b[1] - 1); g.quadraticCurveTo(b[0] + s * 8, h[1] + 4, h[0] + s * 4, h[1]); g.stroke();
    g.fillStyle = pink; g.beginPath(); g.arc(h[0] + s * 4, h[1], 2.4, 0, 7); g.fill();
    line(g, [h[0] + s * 5.5, h[1]], [h[0] + s * 8.5, h[1] + 2], '#2a2a2a', 1.5);
  },
  d_yd_birdbath() {
    this.stShadow(0.5, 0.5, 10, 5);
    this.stCyl(0.5, 0.5, 0.14, 0, 0.08, '#a8a49c');
    this.stCyl(0.5, 0.5, 0.06, 0.08, 0.72, '#b8b4ac');
    this.stCyl(0.5, 0.5, 0.27, 0.72, 0.86, '#c0bcb4', stSnowy() ? ST_SNOW : Season.tree === 'b' ? '#b8c8d0' : '#7a98a8');
  },
  k_yd_birdbath: () => (stSnowy() ? 'S' : Season.tree === 'b' ? 'b' : ''),
  d_yd_feeder() {
    this.stShadow(0.5, 0.5, 5, 2.5);
    this.stPost(0.5, 0.5, 0, 1.42, 2, '#6a4a2c');
    this.box(0.36, 0.36, 1.36, 0.64, 0.64, 1.39, '#8a6a42');
    this.box(0.41, 0.41, 1.39, 0.59, 0.59, 1.6, '#c8a870');
    this.box(0.37, 0.37, 1.6, 0.63, 0.63, 1.66, '#8a3a2a');
    this.stSnowTop(0.37, 0.37, 0.63, 0.63, 1.66);
  },
  k_yd_feeder: () => (stSnowy() ? 'S' : ''),
  d_yd_flagpole(o) {
    const g = this.g, top = 4.0;
    this.stShadow(0.5, 0.5, 6, 3);
    this.stCyl(0.5, 0.5, 0.1, 0, 0.12, '#9a968e');
    this.stCyl(0.5, 0.5, 0.025, 0.12, top, '#e8e8e4');
    const k = this.P(0.5, 0.5, top + 0.06); g.fillStyle = '#d8b040'; g.beginPath(); g.arc(k[0], k[1], 2.4, 0, 7); g.fill();
    // flag hanging off the pole toward +u
    const F = (a, z) => this.P(0.52 + a * 0.85, 0.5, top - 0.06 - z * 0.62);
    const kind = (o.v || 0) % 3;
    if (kind === 0) {
      for (let s = 0; s < 7; s++) poly(g, [F(0, s / 7), F(1, s / 7), F(1, (s + 1) / 7), F(0, (s + 1) / 7)], s & 1 ? '#f2f2ee' : '#c0282a');
      poly(g, [F(0, 0), F(0.42, 0), F(0.42, 4 / 7), F(0, 4 / 7)], '#2a3a7a');
    } else if (kind === 1) {
      poly(g, [F(0, 0), F(1, 0), F(1, 1), F(0, 1)], '#1a3a8a');
      const c = F(0.5, 0.5); g.fillStyle = '#e8d070'; g.beginPath(); g.arc(c[0], c[1], 4, 0, 7); g.fill();
    } else {
      poly(g, [F(0, 0), F(1, 0), F(1, 1), F(0, 1)], '#e8c020');
      const c = F(0.5, 0.55); g.strokeStyle = '#2a4a1a'; g.lineWidth = 1.5; g.beginPath(); g.arc(c[0], c[1], 3.5, 0.3, 5.8); g.stroke();
    }
  },
  d_yd_forsale(o) {
    const g = this.g, d = o.dir || 'S', fr = this.stFront(d);
    this.stShadow(0.5, 0.5, 5, 2.5);
    this.stPost(0.5, 0.5, 0, 1.3, 2.2, '#f2f0ea');
    line(g, this.stPl(d, 0.5, 0.5, 0, 1.25), this.stPl(d, 0.5, 0.5, 0.34, 1.25), '#f2f0ea', 2);
    for (const s of [0.1, 0.3]) line(g, this.stPl(d, 0.5, 0.5, s, 1.25), this.stPl(d, 0.5, 0.5, s, 1.18), '#3a3a3a', 0.8);
    this.stPlate(d, 0.5, 0.5, 0.04, 0.36, 0.78, 1.18, fr ? '#c02a2a' : '#e8e4dc', '#4a1a1a');
    if (fr) {
      const c = d === 'S' || d === 'N' ? [0.7, 0.5] : [0.5, 0.3];
      this.stSignText(d, c[0], c[1], 1.06, 'FOR', 3.4, '#ffffff', 12);
      this.stSignText(d, c[0], c[1], 0.9, 'SALE', 3.8, '#ffffff', 13);
    }
  },
  d_yd_tap(o) {
    const g = this.g, d = o.dir || 'S';
    line(g, this.stLP(d, 0.1, -0.44, 0), this.stLP(d, 0.1, -0.44, 0.62), '#8a8e92', 2.5);
    line(g, this.stLP(d, 0.1, -0.44, 0.6), this.stLP(d, 0.1, -0.33, 0.58), '#9aa0a4', 2.5);
    const k = this.stLP(d, 0.1, -0.44, 0.68); g.fillStyle = '#c03030'; g.beginPath(); g.ellipse(k[0], k[1], 3, 1.5, 0, 0, 7); g.fill();
    if ((o.v || 0) & 1) {
      const c = this.stLP(d, -0.12, -0.08, 0.03);
      g.strokeStyle = '#3a8a3a'; g.lineWidth = 2;
      for (const r of [9, 7, 5]) { g.beginPath(); g.ellipse(c[0], c[1], r, r / 2, 0, 0, 7); g.stroke(); }
    }
  },
  d_yd_rocker(o) {
    const d = o.dir || 'S', c = (o.v || 0) & 1 ? '#e4e0d6' : '#7a5234', rn = stTone(c, 0.8);
    const sh = this.stLB(d, -0.26, 0.26, -0.3, 0.3); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    this.stParts(d, [
      [-0.24, -0.19, -0.32, 0.3, 0, 0.06, rn], [0.19, 0.24, -0.32, 0.3, 0, 0.06, rn],
      [-0.22, -0.18, -0.2, -0.16, 0.06, 0.45, c], [0.18, 0.22, -0.2, -0.16, 0.06, 0.45, c],
      [-0.22, -0.18, 0.14, 0.18, 0.06, 0.45, c], [0.18, 0.22, 0.14, 0.18, 0.06, 0.45, c],
      [-0.24, 0.24, -0.22, 0.2, 0.45, 0.51, c],
      [-0.24, 0.24, -0.26, -0.2, 0.51, 1.12, c],
      [-0.27, -0.22, -0.2, 0.18, 0.68, 0.72, c], [0.22, 0.27, -0.2, 0.18, 0.68, 0.72, c],
    ]);
  },
  d_yd_planter(o) {
    const g = this.g, pal = YD_FLOWERS[(o.col || 0) % YD_FLOWERS.length], st = Season.tree, rng = new RNG(5 + (o.col || 0));
    this.stShadow(0.5, 0.5, 9, 4);
    this.stCyl(0.5, 0.5, 0.2, 0, 0.4, '#b0603a', '#4a3424');
    const c = this.P(0.5, 0.5, 0.4);
    if (st === 'b' || stSnowy()) { for (let k = 0; k < 5; k++) line(g, [c[0] + rng.f(-5, 5), c[1]], [c[0] + rng.f(-7, 7), c[1] - rng.f(5, 10)], '#6a5a3a', 1); }
    else {
      for (let k = 0; k < 6; k++) { g.fillStyle = k & 1 ? '#3a7a34' : '#2e6a2a'; g.beginPath(); g.arc(c[0] + rng.f(-6, 6), c[1] - rng.f(2, 9), rng.f(3, 5), 0, 7); g.fill(); }
      if (st === 'g' || st === 'p') for (let k = 0; k < 6; k++) { g.fillStyle = pal[k & 1]; g.beginPath(); g.arc(c[0] + rng.f(-6, 6), c[1] - rng.f(4, 12), 1.9, 0, 7); g.fill(); }
    }
  },
  k_yd_planter: ydSeason,
  d_yd_lawnchair(o) {
    const d = o.dir || 'S', web = ['#2a7a5a', '#d04a2a', '#3a6ab0', '#e0b030'][(o.v || 0) % 4], fr = '#c8ccd0';
    const sh = this.stLB(d, -0.24, 0.24, -0.26, 0.26); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    this.stParts(d, [
      [-0.24, -0.21, -0.24, 0.22, 0, 0.34, fr], [0.21, 0.24, -0.24, 0.22, 0, 0.34, fr],
      [-0.21, 0.21, -0.2, 0.22, 0.31, 0.35, web],
      [-0.21, 0.21, -0.27, -0.21, 0.35, 0.86, web],
      [-0.24, -0.21, -0.2, 0.18, 0.55, 0.58, fr], [0.21, 0.24, -0.2, 0.18, 0.55, 0.58, fr],
    ]);
  },
  d_yd_kpool(o) {
    const col = ['#3a8ad8', '#e06090', '#40b0a0'][(o.v || 0) % 3];
    this.stShadow(0.5, 0.5, 20, 10, 0.15);
    this.stCyl(0.5, 0.5, 0.42, 0, 0.2, col, stSnowy() ? ST_SNOW : Season.tree === 'g' || Season.tree === 'p' ? '#86d0ee' : '#8a9a88');
    const c = this.P(0.5, 0.5, 0.2), g = this.g;
    g.strokeStyle = Col.shade(col, 1.15); g.lineWidth = 1.5; g.beginPath(); g.ellipse(c[0], c[1], 0.4 * 45.25, 0.4 * 22.63, 0, 0, 7); g.stroke();
  },
  k_yd_kpool: ydSeason,
  d_yd_swing(o) {
    const g = this.g, d = o.dir === 'E' || o.dir === 'W' ? 'E' : 'S', frame = ['#3a7a3a', '#c03a2a', '#3a5aa8'][(o.v || 0) % 3];
    const sh = this.stLB(d, -0.48, 0.48, -0.32, 0.32); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    const L = (a, b, z) => this.stLP(d, a, b, z);
    for (const a of [-0.44, 0.44]) line(g, L(a, -0.3, 0), L(a, 0, 1.9), Col.shade(frame, 0.8), 2.4);
    for (const a of [-0.18, 0.18]) {
      line(g, L(a - 0.06, 0, 1.88), L(a - 0.06, 0, 0.48), '#8a8e92', 1); line(g, L(a + 0.06, 0, 1.88), L(a + 0.06, 0, 0.48), '#8a8e92', 1);
      this.stParts(d, [[a - 0.09, a + 0.09, -0.05, 0.05, 0.43, 0.48, '#2a2a2a']]);
    }
    line(g, L(-0.47, 0, 1.9), L(0.47, 0, 1.9), frame, 3);
    for (const a of [-0.44, 0.44]) line(g, L(a, 0.3, 0), L(a, 0, 1.9), frame, 2.4);
  },
  d_yd_trampoline() {
    const g = this.g;
    this.stShadow(0.5, 0.5, 22, 11, 0.16);
    for (const [u, v] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) line(g, this.P(u, v, 0), this.P(u, v, 0.64), '#8a8e92', 1.6);
    this.stCyl(0.5, 0.5, 0.47, 0.62, 0.7, '#3a6ac8', '#3a6ac8');
    const c = this.P(0.5, 0.5, 0.7);
    g.fillStyle = stSnowy() ? ST_SNOW : '#1e1e22'; g.beginPath(); g.ellipse(c[0], c[1], 0.38 * 45.25, 0.38 * 22.63, 0, 0, 7); g.fill();
  },
  k_yd_trampoline: () => (stSnowy() ? 'S' : ''),
  d_yd_sandbox() {
    const g = this.g;
    this.box(0.06, 0.06, 0, 0.94, 0.94, 0.2, '#9a7448');
    poly(g, [this.P(0.12, 0.12, 0.17), this.P(0.88, 0.12, 0.17), this.P(0.88, 0.88, 0.17), this.P(0.12, 0.88, 0.17)], stSnowy() ? ST_SNOW : '#e0cc94');
    this.stCyl(0.34, 0.62, 0.06, 0.17, 0.28, '#e03a2a');
    line(g, this.P(0.62, 0.4, 0.19), this.P(0.72, 0.3, 0.3), '#3a6ad0', 2);
  },
  k_yd_sandbox: () => (stSnowy() ? 'S' : ''),
  d_yd_bike(o) {
    const g = this.g, d = o.dir || 'S', col = ['#d03030', '#3060c0', '#e0a020', '#9040b0'][(o.v || 0) % 4];
    const w1 = this.stLP(d, -0.26, 0, 0.02), w2 = this.stLP(d, 0.26, 0, 0.02);
    g.strokeStyle = '#1e1e1e'; g.lineWidth = 2;
    for (const w of [w1, w2]) { g.beginPath(); g.ellipse(w[0], w[1], 9, 4.5, 0, 0, 7); g.stroke(); }
    const s = this.stLP(d, -0.02, -0.12, 0.03), h = this.stLP(d, 0.18, 0.1, 0.03);
    line(g, w1, s, col, 2); line(g, s, w2, col, 2); line(g, s, h, col, 2); line(g, h, w2, col, 2);
    line(g, h, this.stLP(d, 0.2, 0.22, 0.03), '#c8ccd0', 2);
    const se = this.stLP(d, -0.06, -0.16, 0.04); g.fillStyle = '#1e1e1e'; g.fillRect(se[0] - 3, se[1] - 1.5, 6, 3);
  },
  d_yd_toys(o) {
    const g = this.g, v = o.v || 0, rng = new RNG(91 + v);
    const b = this.P(rng.f(0.3, 0.7), rng.f(0.3, 0.7), 0.1);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(b[0] + 2, b[1] + 5, 6, 3, 0, 0, 7); g.fill();
    const bc = ['#d03030', '#3070d0', '#e0b020', '#30a050'][v % 4];
    const gr = g.createRadialGradient(b[0] - 2, b[1] - 2, 1, b[0], b[1], 6); gr.addColorStop(0, Col.mix(bc, '#ffffff', 0.5)); gr.addColorStop(1, bc);
    g.fillStyle = gr; g.beginPath(); g.arc(b[0], b[1], 5.5, 0, 7); g.fill();
    if (v & 1) { const u = rng.f(0.15, 0.5), w = rng.f(0.15, 0.5); this.box(u, w, 0.03, u + 0.24, w + 0.14, 0.12, '#e0c020'); this.box(u + 0.02, w + 0.02, 0.12, u + 0.1, w + 0.12, 0.2, '#3060c0'); }
    if (v & 2) { const u = rng.f(0.5, 0.75), w = rng.f(0.5, 0.75); this.stCyl(u, w, 0.06, 0, 0.1, '#30a050'); }
  },
  d_yd_clothesline(o) {
    const g = this.g, d = o.dir === 'E' || o.dir === 'W' ? 'E' : 'S', L = (a, z) => this.stLP(d, a, 0, z);
    for (const a of [-0.46, 0.46]) { line(g, L(a, 0), L(a, 1.85), '#8a8e92', 2.2); line(g, this.stLP(d, a, -0.16, 1.8), this.stLP(d, a, 0.16, 1.8), '#8a8e92', 2); }
    const rng = new RNG(13 + (o.v || 0)), cols = ['#f0f0ec', '#5a8ac8', '#d04a3a', '#e8d070', '#7ab060', '#f0b0c0'];
    for (const b of [-0.12, 0.12]) {
      line(g, this.stLP(d, -0.46, b, 1.8), this.stLP(d, 0.46, b, 1.76), 'rgba(230,230,220,0.8)', 0.8);
      if (stSnowy() || Season.tree === 'b') continue;
      let a = -0.4;
      while (a < 0.3) {
        const w = rng.f(0.1, 0.22), h = rng.f(0.25, 0.5), c = rng.pick(cols);
        poly(g, [this.stLP(d, a, b, 1.78), this.stLP(d, a + w, b, 1.78), this.stLP(d, a + w, b, 1.78 - h), this.stLP(d, a, b, 1.78 - h)], Col.shade(c, d === 'S' ? FACE_S : FACE_E), 'rgba(0,0,0,0.2)', 1);
        a += w + rng.f(0.04, 0.12);
      }
    }
  },
  k_yd_clothesline: () => (stSnowy() || Season.tree === 'b' ? 'w' : ''),
  d_yd_doghouse(o) {
    const g = this.g, d = o.dir || 'S', col = ['#b0603a', '#c8b890', '#8a6a48'][(o.v || 0) % 3];
    const b = this.stLB(d, -0.32, 0.32, -0.36, 0.36);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 0.55, col);
    if (this.stFront(d)) poly(g, [this.stLP(d, -0.11, 0.362, 0), this.stLP(d, 0.11, 0.362, 0), this.stLP(d, 0.11, 0.362, 0.3), this.stLP(d, 0, 0.362, 0.38), this.stLP(d, -0.11, 0.362, 0.3)], '#1a1410');
    this.ydGable(d, -0.36, 0.36, -0.38, 0.38, 0.55, 0.92, '#5a3a2a', col);
    if (stSnowy()) { const r = this.stLB(d, -0.3, 0.3, -0.3, 0.3); this.stSnowTop(r[0], r[1], r[3], r[4], 0.92); }
  },
  k_yd_doghouse: () => (stSnowy() ? 'S' : ''),
  d_yd_compost() {
    const g = this.g;
    this.shadow(0.18, 0.18, 0.82, 0.82);
    this.box(0.2, 0.2, 0, 0.8, 0.8, 0.74, '#2a5a32');
    this.box(0.17, 0.17, 0.74, 0.83, 0.83, 0.82, '#1e4426');
    for (let k = 0; k < 3; k++) { const z = 0.2 + k * 0.17; line(g, this.P(0.3, 0.802, z), this.P(0.7, 0.802, z), 'rgba(0,0,0,0.35)', 1.2); line(g, this.P(0.802, 0.7, z), this.P(0.802, 0.3, z), 'rgba(0,0,0,0.35)', 1.2); }
    this.stSnowTop(0.17, 0.17, 0.83, 0.83, 0.82);
  },
  k_yd_compost: () => (stSnowy() ? 'S' : ''),
  d_yd_woodpile(o) {
    const g = this.g, along = o.dir === 'N' || o.dir === 'S', b = along ? [0.04, 0.22, 0, 0.96, 0.78, 0] : [0.22, 0.04, 0, 0.78, 0.96, 0];
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 0.82, '#6a4a30', false);
    const rng = new RNG(3 + (o.v || 0)), endFace = along ? 'E' : 'S', sideFace = along ? 'S' : 'E';
    // log ends on the end face, bark lines along the side
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const p = this.ydFace(endFace, b, (c + 0.5 + (r & 1) * 0.3) / 3.3, 0.1 + r * 0.2);
      g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(p[0], p[1], 4.2, 4.6, 0, 0, 7); g.fill();
      g.strokeStyle = '#7a5a3a'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(p[0], p[1], 2, 2.3, 0, 0, 7); g.stroke();
    }
    for (let r = 0; r < 5; r++) { const z = 0.08 + r * 0.17 + rng.f(-0.02, 0.02); line(g, this.ydFace(sideFace, b, 0.02, z), this.ydFace(sideFace, b, 0.98, z), 'rgba(40,24,12,0.55)', 1.3); }
    this.stSnowTop(b[0], b[1], b[3], b[4], 0.82);
  },
  k_yd_woodpile: () => (stSnowy() ? 'S' : ''),
  d_yd_chopblock(o) {
    const g = this.g;
    this.stShadow(0.5, 0.5, 10, 5);
    this.stCyl(0.5, 0.5, 0.2, 0, 0.42, '#6a4a30', '#c8a070');
    const c = this.P(0.5, 0.5, 0.42); g.strokeStyle = 'rgba(110,70,40,0.6)'; g.lineWidth = 0.8;
    for (const r of [3, 6]) { g.beginPath(); g.ellipse(c[0], c[1], r, r / 2, 0, 0, 7); g.stroke(); }
    if ((o.v || 0) & 1) { line(g, this.P(0.5, 0.5, 0.44), this.P(0.62, 0.62, 0.86), '#8a6a4a', 2.4); poly(g, [this.P(0.44, 0.47, 0.42), this.P(0.58, 0.47, 0.42), this.P(0.58, 0.47, 0.56), this.P(0.46, 0.47, 0.52)], '#9aa2aa'); }
  },
  d_yd_mower(o) {
    const g = this.g, d = o.dir || 'S', col = (o.v || 0) & 1 ? '#c82a20' : '#3a8a3a';
    const sh = this.stLB(d, -0.24, 0.24, -0.18, 0.3); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    for (const [a, b] of [[-0.22, -0.1], [0.22, -0.1]]) { const p = this.stLP(d, a, b, 0.05); g.fillStyle = '#1e1e1e'; g.beginPath(); g.ellipse(p[0], p[1], 3.5, 3.5, 0, 0, 7); g.fill(); }
    line(g, this.stLP(d, -0.16, -0.08, 0.2), this.stLP(d, -0.18, -0.46, 0.85), '#2a2a2a', 1.6);
    line(g, this.stLP(d, 0.16, -0.08, 0.2), this.stLP(d, 0.18, -0.46, 0.85), '#2a2a2a', 1.6);
    line(g, this.stLP(d, -0.18, -0.46, 0.85), this.stLP(d, 0.18, -0.46, 0.85), '#2a2a2a', 2);
    this.stParts(d, [[-0.22, 0.22, -0.12, 0.28, 0.05, 0.18, col], [-0.1, 0.1, 0.0, 0.18, 0.18, 0.34, '#3a3a3c']]);
    for (const [a, b] of [[-0.22, 0.24], [0.22, 0.24]]) { const p = this.stLP(d, a, b, 0.05); g.fillStyle = '#1e1e1e'; g.beginPath(); g.ellipse(p[0], p[1], 3.5, 3.5, 0, 0, 7); g.fill(); }
  },
  d_yd_wheelbarrow(o) {
    const g = this.g, d = o.dir || 'S', col = ['#3a6ab0', '#c03a2a', '#3a8a4a'][(o.v || 0) % 3];
    const sh = this.stLB(d, -0.22, 0.22, -0.3, 0.42); this.shadow(sh[0], sh[1], sh[3], sh[4]);
    for (const a of [-0.15, 0.15]) { line(g, this.stLP(d, a, -0.46, 0.4), this.stLP(d, a, 0.3, 0.2), '#7a5a3a', 2); line(g, this.stLP(d, a, -0.16, 0.25), this.stLP(d, a, -0.2, 0), '#4a4a4a', 1.5); }
    this.stParts(d, [[-0.2, 0.2, -0.2, 0.24, 0.24, 0.5, col]]);
    const w = this.stLP(d, 0, 0.36, 0.11); g.fillStyle = '#1e1e1e'; g.beginPath(); g.ellipse(w[0], w[1], 4, 5, 0, 0, 7); g.fill();
  },
  d_yd_propane() {
    const g = this.g;
    this.stShadow(0.5, 0.5, 12, 6);
    this.stCyl(0.5, 0.5, 0.17, 0, 0.06, '#7a7a76');
    this.stCyl(0.5, 0.5, 0.24, 0.06, 0.74, '#e8e8e2');
    const c = this.P(0.5, 0.5, 0.74); g.fillStyle = Col.shade('#e8e8e2', 1.05); g.beginPath(); g.ellipse(c[0], c[1], 0.24 * 45.25, 0.24 * 22.6 + 3, 0, Math.PI, 0); g.fill();
    this.stCyl(0.5, 0.5, 0.1, 0.8, 0.9, '#b8b8b2');
    this.stCyl(0.5, 0.5, 0.03, 0.9, 0.95, '#c8a030');
  },
  d_yd_ac(o) {
    const g = this.g, d = o.dir || 'S', b = this.stLB(d, -0.36, 0.36, -0.42, 0.18);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0.05, b[3], b[4], 0.72, '#c8c8c0');
    const c = this.P((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, 0.721);
    g.fillStyle = '#3a3a3a'; g.beginPath(); g.ellipse(c[0], c[1], 11, 5.5, 0, 0, 7); g.fill();
    line(g, [c[0] - 10, c[1]], [c[0] + 10, c[1]], '#8a8a86', 1); line(g, [c[0], c[1] - 5], [c[0], c[1] + 5], '#8a8a86', 1);
    for (const f of ['S', 'E']) for (let k = 0; k < 5; k++) { const z = 0.15 + k * 0.11; line(g, this.ydFace(f, b, 0.08, z), this.ydFace(f, b, 0.92, z), 'rgba(0,0,0,0.25)', 1); }
    this.stSnowTop(b[0], b[1], b[3], b[4], 0.72);
  },
  k_yd_ac: () => (stSnowy() ? 'S' : ''),
  d_yd_tires(o) {
    const g = this.g, n = 2 + (o.v || 0) % 3;
    this.stShadow(0.5, 0.5, 15, 7);
    for (let k = 0; k < n; k++) {
      const z = k * 0.2, u = 0.5 + (k & 1) * 0.03;
      this.stCyl(u, 0.5, 0.31, z, z + 0.2, '#262628', '#2e2e30');
      const c = this.P(u, 0.5, z + 0.2); g.fillStyle = '#121214'; g.beginPath(); g.ellipse(c[0], c[1], 0.15 * 45.25, 0.15 * 22.6, 0, 0, 7); g.fill();
    }
  },
  d_yd_junk(o) {
    const g = this.g, v = (o.v || 0) % 3;
    if (v === 0) { this.shadow(0.06, 0.2, 0.94, 0.8); this.box(0.06, 0.22, 0, 0.94, 0.78, 0.55, '#d8d6cc'); line(g, this.P(0.3, 0.22, 0.3), this.P(0.3, 0.22, 0.5), '#8a8a86', 1.5); poly(g, [this.P(0.5, 0.78, 0.2), this.P(0.62, 0.78, 0.25), this.P(0.58, 0.78, 0.4)], 'rgba(120,70,30,0.6)'); }
    else if (v === 1) { this.shadow(0.15, 0.15, 0.85, 0.85); this.box(0.15, 0.15, 0, 0.85, 0.85, 0.82, '#e0ded6'); const c = this.ydFace('S', [0.15, 0.15, 0, 0.85, 0.85], 0.5, 0.42); g.fillStyle = '#4a5058'; g.beginPath(); g.ellipse(c[0], c[1], 7, 9, 0, 0, 7); g.fill(); }
    else { this.stShadow(0.5, 0.5, 12, 6); this.stCyl(0.5, 0.5, 0.22, 0, 0.9, '#a86a3a', '#8a5a32'); }
  },
  d_yd_carparts() {
    const g = this.g;
    this.shadow(0.1, 0.1, 0.9, 0.9);
    this.box(0.14, 0.2, 0, 0.6, 0.62, 0.38, '#4a4c50');
    this.box(0.2, 0.26, 0.38, 0.54, 0.56, 0.46, '#5a5c60');
    this.stCyl(0.72, 0.68, 0.18, 0, 0.12, '#262628', '#2e2e30');
    line(g, this.P(0.3, 0.75, 0.02), this.P(0.85, 0.3, 0.05), '#8a4a2a', 2);
  },
  d_yd_couch(o) {
    this.d_sofa({ dir: o.dir || 'S', col: ['#6a5a3a', '#5a6a5a', '#7a4a4a'][(o.v || 0) % 3], part: 0 });
    const g = this.g; g.fillStyle = 'rgba(40,30,20,0.35)';
    const c = this.P(0.45, 0.5, 0.43); g.beginPath(); g.ellipse(c[0], c[1], 5, 2.5, 0, 0, 7); g.fill();
  },
  d_yd_trashbags(o) {
    const g = this.g, rng = new RNG(19 + (o.v || 0));
    for (let k = 0; k < 3; k++) {
      const p = this.P(rng.f(0.25, 0.75), rng.f(0.25, 0.75), 0.15);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(p[0] + 2, p[1] + 6, 8, 3.5, 0, 0, 7); g.fill();
      g.fillStyle = '#1e1e22'; g.beginPath(); g.ellipse(p[0], p[1], 8, 7, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(p[0] - 3, p[1] - 2, 3, 2, 0, 0, 7); g.fill();
      poly(g, [[p[0] - 1.5, p[1] - 6], [p[0] + 1.5, p[1] - 6], [p[0] + 2.5, p[1] - 10], [p[0] - 2.5, p[1] - 10]], '#1e1e22');
    }
  },
  d_yd_weeds(o) {
    const g = this.g, rng = new RNG(23 + (o.v || 0)), st = Season.tree;
    const cols = st === 'b' || stSnowy() ? ['#8a7a5a', '#6a5a3a'] : st === 'a' || st === 's' || st === 'y' ? ['#a89040', '#7a7a3a'] : ['#4a8a34', '#6a9a3a', '#3a7a2a'];
    for (let k = 0; k < 22; k++) { const u = rng.f(0.15, 0.85), v = rng.f(0.15, 0.85), h = rng.f(0.25, 0.6); line(g, this.P(u, v, 0), this.P(u + rng.f(-0.06, 0.06), v + rng.f(-0.06, 0.06), h), rng.pick(cols), 1.2); }
  },
  k_yd_weeds: ydSeason,
  d_yd_icechest(o) {
    const col = ['#c83030', '#3060b0', '#2a8a5a'][(o.v || 0) % 3], along = o.dir === 'N' || o.dir === 'S';
    const b = along ? [0.22, 0.32, 0, 0.78, 0.68] : [0.32, 0.22, 0, 0.68, 0.78];
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 0.32, col);
    this.box(b[0] - 0.01, b[1] - 0.01, 0.32, b[3] + 0.01, b[4] + 0.01, 0.4, '#f0f0ec');
  },
  d_yd_dish(o) {
    const g = this.g, d = o.dir || 'S';
    this.stShadow(0.5, 0.5, 5, 2.5);
    this.stPost(0.5, 0.5, 0, 1.0, 2.2, '#8a8e92');
    const c = this.stLP(d, 0, 0.08, 1.12), f = this.stLP(d, 0, 0.36, 1.06);
    g.fillStyle = '#d8d8d4'; g.beginPath(); g.ellipse(c[0], c[1], 11, 9, d === 'S' || d === 'N' ? 0.35 : -0.35, 0, 7); g.fill();
    g.strokeStyle = '#9a9a96'; g.lineWidth = 1; g.stroke();
    line(g, this.stLP(d, 0, 0.0, 0.95), f, '#6a6e72', 1.4); g.fillStyle = '#3a3a3a'; g.fillRect(f[0] - 1.5, f[1] - 1.5, 3, 3);
  },
  d_yd_shed(o) {
    const g = this.g, d = o.dir || 'S', col = ['#a03a2a', '#e8e4d8', '#c8b890', '#5a7a5a'][(o.v || 0) % 4], trim = '#f0ece0';
    const b = this.stLB(d, -0.45, 0.45, -0.45, 0.45);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 1.75, col);
    if (this.stFront(d)) {
      poly(g, [this.stLP(d, -0.3, 0.452, 0), this.stLP(d, 0.3, 0.452, 0), this.stLP(d, 0.3, 0.452, 1.5), this.stLP(d, -0.3, 0.452, 1.5)], Col.shade(stTone(col, 0.85), FACE_S), Col.shade(trim, FACE_S), 1.5);
      line(g, this.stLP(d, 0, 0.452, 0), this.stLP(d, 0, 0.452, 1.5), Col.shade(trim, FACE_S), 1.5);
      line(g, this.stLP(d, -0.3, 0.452, 0), this.stLP(d, 0.3, 0.452, 1.5), 'rgba(255,255,255,0.35)', 1);
      line(g, this.stLP(d, 0.3, 0.452, 0), this.stLP(d, -0.3, 0.452, 1.5), 'rgba(255,255,255,0.35)', 1);
      const h = this.stLP(d, 0.06, 0.455, 0.8); g.fillStyle = '#2a2a2a'; g.fillRect(h[0] - 1, h[1] - 2, 2, 4);
    }
    this.ydGable(d, -0.5, 0.5, -0.5, 0.5, 1.75, 2.35, '#4a4440', col);
    if (stSnowy()) { const r = this.stLB(d, -0.42, 0.42, -0.42, 0.42); this.stSnowTop(r[0], r[1], r[3], r[4], 2.3); }
  },
  k_yd_shed: () => (stSnowy() ? 'S' : ''),
  d_yd_outhouse(o) {
    const g = this.g, d = o.dir || 'S', col = '#7a5a3a';
    const b = this.stLB(d, -0.34, 0.34, -0.36, 0.36);
    this.shadow(b[0], b[1], b[3], b[4]);
    this.box(b[0], b[1], 0, b[3], b[4], 2.05, col);
    for (let k = 1; k < 5; k++) { const a = k / 5; line(g, this.ydFace('S', b, a, 0.02), this.ydFace('S', b, a, 2.0), 'rgba(40,24,12,0.4)', 1); line(g, this.ydFace('E', b, a, 0.02), this.ydFace('E', b, a, 2.0), 'rgba(40,24,12,0.4)', 1); }
    if (this.stFront(d)) {
      poly(g, [this.stLP(d, -0.24, 0.362, 0), this.stLP(d, 0.24, 0.362, 0), this.stLP(d, 0.24, 0.362, 1.85), this.stLP(d, -0.24, 0.362, 1.85)], null, 'rgba(30,18,8,0.7)', 1.2);
      const m = this.stLP(d, 0, 0.364, 1.6); g.fillStyle = '#1a120a'; g.beginPath(); g.arc(m[0], m[1], 3, Math.PI * 0.3, Math.PI * 1.7); g.arc(m[0] + 1.5, m[1], 2.2, Math.PI * 1.6, Math.PI * 0.4, true); g.fill();
    }
    this.box(b[0] - 0.05, b[1] - 0.05, 2.05, b[3] + 0.05, b[4] + 0.05, 2.15, '#4a4440');
    this.stSnowTop(b[0] - 0.05, b[1] - 0.05, b[3] + 0.05, b[4] + 0.05, 2.15);
  },
  k_yd_outhouse: () => (stSnowy() ? 'S' : ''),
  d_yd_coop(o) {
    const g = this.g, d = o.dir || 'S', col = '#b8a07a';
    const b = this.stLB(d, -0.4, 0.4, -0.36, 0.3);
    this.shadow(b[0], b[1], b[3], b[4]);
    for (const [a, bb] of [[-0.36, -0.32], [0.36, -0.32], [-0.36, 0.26], [0.36, 0.26]]) line(g, this.stLP(d, a, bb, 0), this.stLP(d, a, bb, 0.4), '#5a4430', 2);
    line(g, this.stLP(d, 0.1, 0.3, 0.42), this.stLP(d, 0.1, 0.62, 0), '#8a6a48', 3);
    this.box(b[0], b[1], 0.4, b[3], b[4], 0.95, col);
    if (this.stFront(d)) poly(g, [this.stLP(d, 0.02, 0.302, 0.42), this.stLP(d, 0.18, 0.302, 0.42), this.stLP(d, 0.18, 0.302, 0.62), this.stLP(d, 0.02, 0.302, 0.62)], '#2a1e14');
    this.ydGable(d, -0.44, 0.44, -0.4, 0.34, 0.95, 1.4, '#6a3a2a', col);
    if (stSnowy()) { const r = this.stLB(d, -0.36, 0.36, -0.34, 0.28); this.stSnowTop(r[0], r[1], r[3], r[4], 1.38); }
  },
  k_yd_coop: () => (stSnowy() ? 'S' : ''),
});
// log bench: two stumps and a split log
ObjArt.d_yd_logbench = function (o) {
  const g = this.g, d = o.dir === 'E' || o.dir === 'W' ? 'E' : 'S';
  for (const a of [-0.3, 0.3]) { const p = this.stUV(d, a, 0); this.stCyl(p[0], p[1], 0.11, 0, 0.26, '#6a4a30', '#b08a5a'); }
  this.stParts(d, [[-0.46, 0.46, -0.13, 0.13, 0.24, 0.42, '#6a4a30']]);
  const e = this.stLP(d, 0.46, 0, 0.33); g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(e[0], e[1], 4, 5, 0, 0, 7); g.fill();
  if (stSnowy()) { const t = this.stLB(d, -0.44, 0.44, -0.1, 0.1); this.stSnowTop(t[0], t[1], t[3], t[4], 0.42); }
};
ObjArt.k_yd_logbench = () => (stSnowy() ? 'S' : '');

// ---------------------------------------------------------------- generation
// decorates every residential property (house / farmhouse / trailer / cabin) after all buildings exist
const YD_RES = { house: 1, farmhouse: 1, trailer: 1, cabin: 1 };
const YD_BIT = { N: 1, S: 2, W: 4, E: 8 };
// household characters and how likely each kind of home has them
const YD_CHARS = {
  tidy: { house: 3, trailer: 0.4, cabin: 0, farmhouse: 0.3 },
  family: { house: 3.2, trailer: 1.2, cabin: 0, farmhouse: 0.6 },
  elderly: { house: 2.2, trailer: 1.2, cabin: 0.3, farmhouse: 1 },
  gardener: { house: 1.8, trailer: 0.3, cabin: 0.2, farmhouse: 1.4 },
  handyman: { house: 1.8, trailer: 0.6, cabin: 0.5, farmhouse: 1 },
  messy: { house: 1.3, trailer: 2.2, cabin: 0.7, farmhouse: 0.4 },
  rural: { house: 0.15, trailer: 1, cabin: 3, farmhouse: 3 },
};
// feature probabilities per character: [tidy, family, elderly, gardener, handyman, messy, rural]
const YD_CI = { tidy: 0, family: 1, elderly: 2, gardener: 3, handyman: 4, messy: 5, rural: 6 };
const YD_P = {
  porch: [0.6, 0.45, 0.8, 0.5, 0.5, 0.35, 0.6],
  beds: [0.95, 0.5, 0.85, 1, 0.45, 0.12, 0.35],
  hedge: [0.5, 0.2, 0.35, 0.3, 0.2, 0.05, 0.05],
  lights: [0.6, 0.3, 0.35, 0.45, 0.35, 0.05, 0.05],
  stripes: [0.85, 0.3, 0.4, 0.4, 0.4, 0, 0],
  gnome: [0.1, 0.15, 0.55, 0.45, 0.05, 0.15, 0.1],
  flamingo: [0.02, 0.15, 0.3, 0.1, 0.02, 0.4, 0.2],
  birdbath: [0.3, 0.05, 0.55, 0.5, 0.05, 0.02, 0.1],
  feeder: [0.2, 0.1, 0.65, 0.55, 0.1, 0.05, 0.3],
  flag: [0.25, 0.12, 0.4, 0.1, 0.3, 0.05, 0.35],
  forsale: [0.07, 0.05, 0.08, 0.04, 0.04, 0.03, 0.02],
  kids: [0, 1, 0.08, 0, 0.05, 0.3, 0.1],
  tap: [0.5, 0.45, 0.45, 0.9, 0.6, 0.3, 0.4],
  patio: [0.7, 0.55, 0.45, 0.45, 0.6, 0.25, 0.25],
  deck: [0.3, 0.3, 0.2, 0.25, 0.45, 0.2, 0.2],
  bbq: [0.55, 0.65, 0.3, 0.35, 0.6, 0.5, 0.45],
  firepit: [0.1, 0.3, 0.05, 0.1, 0.3, 0.3, 0.6],
  picnic: [0.15, 0.45, 0.15, 0.2, 0.25, 0.2, 0.35],
  clothes: [0.2, 0.4, 0.55, 0.35, 0.25, 0.5, 0.6],
  dog: [0.2, 0.35, 0.15, 0.15, 0.3, 0.45, 0.5],
  garden: [0.15, 0.2, 0.45, 1, 0.3, 0.15, 0.7],
  compost: [0.1, 0.05, 0.15, 0.75, 0.2, 0.05, 0.3],
  barrel: [0.2, 0.15, 0.35, 0.75, 0.4, 0.15, 0.75],
  woodpile: [0.1, 0.15, 0.2, 0.15, 0.6, 0.25, 0.95],
  mower: [0.35, 0.3, 0.25, 0.4, 0.5, 0.2, 0.2],
  ac: [0.7, 0.65, 0.6, 0.5, 0.55, 0.45, 0.2],
  propane: [0.02, 0.05, 0.05, 0.05, 0.1, 0.2, 0.6],
  junk: [0, 0.05, 0.02, 0, 0.25, 1, 0.45],
  chairs: [0.3, 0.4, 0.5, 0.35, 0.3, 0.45, 0.5],
  fence: [0.4, 0.5, 0.3, 0.3, 0.35, 0.2, 0.1],
  shed: [0.45, 0.4, 0.3, 0.6, 0.8, 0.35, 0.5],
};

const Yard = {
  // ------------------------------------------------------------ setup
  run(m) {
    this.m = m; this.r = m.rng; this.w = m.w; this.W = m.W; this.GW = m.GW; this.H = m.H;
    const n = m.W * m.H;
    if (!this.own || this.own.length !== n) {
      this.own = new Int16Array(n); this.clr = new Uint8Array(n); this.zone = new Uint8Array(n);
      this.adj = new Uint8Array(n); this.base = new Uint8Array(n); this.stamp = new Uint32Array(n); this.q = new Int32Array(4096);
      this.gen = 1;
    }
    this.own.fill(-1); this.zone.fill(0); this.adj.fill(0); this.base.fill(0); this.clr.fill(0);
    this.stats = { yards: 0, details: 0, min: 1e9, max: 0, by: {} };
    const list = this.w.buildings.filter(b => YD_RES[b.type] && b.x1 < this.GW);
    for (const b of list) if (b.lot) this.claimLot(b);
    for (const b of list) if (!b.lot) this.claimFree(b);
    for (const b of list) { try { this.decorate(b); } catch (e) { console.warn('yard', b.id, e); } }
  },
  claimLot(b) {
    const L = b.lot, W = this.W, own = this.own;
    for (let y = L.y0; y <= L.y1; y++) for (let x = L.x0; x <= L.x1; x++) {
      if (!World.inb(x, y) || x >= this.GW) continue;
      const i = y * W + x;
      if (this.w.room[i] < 0 && own[i] < 0) own[i] = b.id;
    }
  },
  // farmhouses, trailers and cabins: the grass around them, up to a margin, that is closer to them than to anything else
  claimFree(b) {
    const W = this.W, w = this.w, m = this.m, GW = this.GW;
    const M = b.type === 'trailer' ? 3 : b.type === 'cabin' ? 6 : 7;
    const x0 = Math.max(1, b.x0 - M), x1 = Math.min(GW - 2, b.x1 + M), y0 = Math.max(1, b.y0 - M), y1 = Math.min(this.H - 2, b.y1 + M);
    const near = w.buildings.filter(o => o !== b && o.x1 < GW && o.x1 >= x0 - 4 && o.x0 <= x1 + 4 && o.y1 >= y0 - 4 && o.y0 <= y1 + 4);
    const cheb = (x, y, o) => Math.max(o.x0 - x, x - o.x1, o.y0 - y, y - o.y1);
    const road = (f) => f === FL.ASPHALT || f === FL.SIDEWALK || f === FL.GRAVEL || f === FL.PARKING || f === FL.CONCRETE;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (this.own[i] >= 0 || w.room[i] >= 0) continue;
      const f = w.floor[i];
      if (f !== FL.GRASS && f !== FL.GRASS2) continue;
      if (road(w.floor[i - 1]) || road(w.floor[i + 1]) || road(w.floor[i - W]) || road(w.floor[i + W])) continue;
      const d0 = cheb(x, y, b);
      if (b.type === 'cabin' && d0 > M - 2.2 * m.nB(x / 4.3, y / 4.3, 2)) continue;
      let ok = true;
      for (const o of near) { const d1 = cheb(x, y, o); if (d1 <= 2 || d1 <= d0) { ok = false; break; } }
      if (!ok) continue;
      this.own[i] = b.id;
      if (!m.used[i]) m.used[i] = 1; // keeps the forest out of the clearing
    }
  },
  // per-tile facts for one property
  setup(b) {
    const W = this.W, w = this.w, own = this.own, id = b.id;
    const tiles = [];
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    const R = b.lot ? b.lot : { x0: b.x0 - 8, y0: b.y0 - 8, x1: b.x1 + 8, y1: b.y1 + 8 };
    for (let y = Math.max(0, R.y0); y <= Math.min(this.H - 1, R.y1); y++) for (let x = Math.max(0, R.x0); x <= Math.min(this.GW - 1, R.x1); x++) {
      const i = y * W + x;
      if (own[i] !== id) continue;
      tiles.push(i);
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
    if (tiles.length < 6) return null;
    const f = b.front || 'S';
    const Y = { b, id, tiles, bx0, by0, bx1, by1, f, back: OPP[f], kind: b.type, n: 0, doors: [], hx0: b.x0, hy0: b.y0, hx1: b.x1, hy1: b.y1 };
    for (const i of tiles) {
      const x = i % W, y = (i / W) | 0;
      let z;
      if (f === 'N') z = y < b.y0 ? 1 : y > b.y1 ? 3 : 2;
      else if (f === 'S') z = y > b.y1 ? 1 : y < b.y0 ? 3 : 2;
      else if (f === 'W') z = x < b.x0 ? 1 : x > b.x1 ? 3 : 2;
      else z = x > b.x1 ? 1 : x < b.x0 ? 3 : 2;
      this.zone[i] = z;
      let a = 0;
      for (const d in YD_BIT) { const [dx, dy] = DIRV[d]; const r = World.room(x + dx, y + dy); if (r >= 0 && w.rooms[r].b === id) a |= YD_BIT[d]; }
      this.adj[i] = a;
      this.clr[i] = 0;
    }
    // exterior doors: keep their outside tiles (and the one beyond) free
    const door = (ex, ey, ed, ox, oy, dir) => {
      const fe = World.feat(ex, ey, ed);
      if (!fe || (fe.k !== 'door' && fe.k !== 'doorway')) return;
      Y.doors.push({ x: ox, y: oy, dir, garage: fe.style === 'garage' });
      const [dx, dy] = DIRV[dir];
      for (let k = 0; k < (fe.style === 'garage' ? 4 : 2); k++) {
        const tx = ox + dx * k, ty = oy + dy * k;
        if (!World.inb(tx, ty)) break;
        const ti = ty * W + tx;
        this.clr[ti] |= k === 0 ? 3 : 1;
        if (k === 0) for (const q of [ti - (dy ? 1 : W), ti + (dy ? 1 : W)]) if (own[q] === id) this.clr[q] |= 1;
      }
    };
    for (let x = b.x0; x <= b.x1; x++) { door(x, b.y0, 0, x, b.y0 - 1, 'N'); door(x, b.y1 + 1, 0, x, b.y1 + 1, 'S'); }
    for (let y = b.y0; y <= b.y1; y++) { door(b.x0, y, 1, b.x0 - 1, y, 'W'); door(b.x1 + 1, y, 1, b.x1 + 1, y, 'E'); }
    Y.front = Y.doors.find(d => !d.garage && d.dir === f) || Y.doors.find(d => !d.garage) || null;
    // parked cars and the driveway stay clear
    for (const c of w.carSpots) {
      if (c.x < bx0 - 3 || c.x > bx1 + 4 || c.y < by0 - 3 || c.y > by1 + 4) continue;
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      for (let y = Math.floor(c.y - 2); y <= c.y + 2; y++) for (let x = Math.floor(c.x - 2); x <= c.x + 2; x++) {
        const dx = x + 0.5 - c.x, dy = y + 0.5 - c.y;
        if (Math.abs(dx * ca + dy * sa) < 1.85 && Math.abs(-dx * sa + dy * ca) < 1.15 && World.inb(x, y)) this.clr[y * W + x] |= 3;
      }
    }
    // the lot's street edge: only hedges may stand there
    if (b.lot) {
      const L = b.lot;
      for (const i of tiles) { const x = i % W, y = (i / W) | 0; if ((f === 'N' && y === L.y0) || (f === 'S' && y === L.y1) || (f === 'W' && x === L.x0) || (f === 'E' && x === L.x1)) this.clr[i] |= 4; }
    }
    this.reach(Y, true);
    return Y;
  },
  // ------------------------------------------------------------ connectivity
  // flood fill over the property (plus a 1-tile ring that connects it to the outside world).
  // setBase: remember which owned tiles are reachable now; otherwise return how many of those still are
  reach(Y, setBase) {
    const W = this.W, w = this.w, own = this.own, st = this.stamp, base = this.base, id = Y.id;
    const x0 = Math.max(0, Y.bx0 - 1), y0 = Math.max(0, Y.by0 - 1), x1 = Math.min(this.GW - 1, Y.bx1 + 1), y1 = Math.min(this.H - 1, Y.by1 + 1);
    const g = ++this.gen;
    let q = this.q, qt = 0, cnt = 0;
    const need = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (q.length < need) q = this.q = new Int32Array(need * 2);
    const ok = (i) => {
      if (w.room[i] >= 0) return false;
      const f = w.floor[i];
      if (f === FL.WATER || f === FL.DEEPWATER || f === FL.VOID) return false;
      const o = w.obj[i];
      if (!o) return true;
      const s = OBJ[o.t].solid;
      return !(s === true || s === 'portal' || (s === 'circle' && (o.t === 'tree' || OBJ[o.t].rad > 0.12)));
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
      const i = y * W + x;
      if (st[i] !== g && ok(i)) { st[i] = g; q[qt++] = i; }
    }
    for (let qh = 0; qh < qt; qh++) {
      const i = q[qh], x = i % W, y = (i / W) | 0;
      if (own[i] === id) { if (setBase) { base[i] = 1; cnt++; } else if (base[i]) cnt++; }
      if (y > y0 && st[i - W] !== g && !w.wallN[i] && ok(i - W)) { st[i - W] = g; q[qt++] = i - W; }
      if (y < y1 && st[i + W] !== g && !w.wallN[i + W] && ok(i + W)) { st[i + W] = g; q[qt++] = i + W; }
      if (x > x0 && st[i - 1] !== g && !w.wallW[i] && ok(i - 1)) { st[i - 1] = g; q[qt++] = i - 1; }
      if (x < x1 && st[i + 1] !== g && !w.wallW[i + 1] && ok(i + 1)) { st[i + 1] = g; q[qt++] = i + 1; }
    }
    if (setBase) Y.need = cnt;
    return cnt;
  },
  // after making tiles solid (or adding fences): is every tile that was reachable still reachable?
  keepsReach(Y, solidTiles) {
    let lost = 0;
    for (const i of solidTiles) if (this.base[i]) lost++;
    if (this.reach(Y) !== Y.need - lost) return false;
    for (const i of solidTiles) if (this.base[i]) { this.base[i] = 0; Y.need--; }
    return true;
  },
  // ------------------------------------------------------------ placement helpers
  lawn(i) { const f = this.w.floor[i]; return f === FL.GRASS || f === FL.GRASS2; },
  okObj(Y, i, floorOk) { return this.own[i] === Y.id && !this.w.obj[i] && !(this.clr[i] & 2) && (floorOk ? floorOk(this.w.floor[i]) : this.lawn(i)); },
  okSolid(Y, i, floorOk, edgeOk) { return this.okObj(Y, i, floorOk) && !(this.clr[i] & 1) && (edgeOk || !(this.clr[i] & 4)); },
  put(Y, i, t, dir, extra) {
    const o = this.m.mkObj(t, dir || 'S', extra);
    this.w.obj[i] = o;
    Y.n++;
    return o;
  },
  // solid object: reverted if it would cut anything off
  putSolid(Y, i, t, dir, extra) {
    const o = this.put(Y, i, t, dir, extra);
    if (this.keepsReach(Y, [i])) return o;
    this.w.obj[i] = null; Y.n--;
    return null;
  },
  pick(Y, fn) {
    const out = [];
    for (const i of Y.tiles) if (fn(i, i % this.W, (i / this.W) | 0)) out.push(i);
    return out;
  },
  // try candidates in random order until fn(i) succeeds
  tryEach(arr, fn) {
    const r = this.r;
    for (let n = arr.length; n > 0; n--) {
      const k = r.int(0, n - 1), i = arr[k];
      arr[k] = arr[n - 1];
      const v = fn(i);
      if (v) return v;
    }
    return null;
  },
  dist(Y, i) { const x = i % this.W, y = (i / this.W) | 0; return Math.max(Y.hx0 - x, x - Y.hx1, Y.hy0 - y, y - Y.hy1); },
  P(Y, k) { const v = YD_P[k]; return v ? v[YD_CI[Y.ch]] : 0; },
  blocks(t) { const d = OBJ[t]; return d.solid === true || d.solid === 'portal' || (d.solid === 'circle' && (t === 'tree' || d.rad > 0.12)); },
  // facing away from the house wall a tile touches
  awayDir(i) { const a = this.adj[i]; return a & 1 ? 'S' : a & 2 ? 'N' : a & 4 ? 'E' : a & 8 ? 'W' : null; },
  fenceNear(i) {
    const w = this.w, W = this.W;
    return !!(w.wallN[i] || w.wallW[i] || w.wallN[i + W] || w.wallW[i + 1]);
  },
  // generic single object: zones bitmask (1 front, 2 side, 4 back), solid, wall (against the house), minD / maxD (distance from house)
  one(Y, t, o) {
    const zm = o.zones || 7;
    const c = this.pick(Y, (i) => {
      if (!(zm & (1 << (this.zone[i] - 1)))) return false;
      if (!(o.solid ? this.okSolid(Y, i, o.floor, o.edge) : this.okObj(Y, i, o.floor))) return false;
      if (o.wall && !this.adj[i]) return false;
      if (o.minD && this.dist(Y, i) < o.minD) return false;
      if (o.maxD && this.dist(Y, i) > o.maxD) return false;
      if (o.nearFence && !this.fenceNear(i)) return false;
      return true;
    });
    if (!c.length && o.nearFence) return this.one(Y, t, Object.assign({}, o, { nearFence: false }));
    return this.tryEach(c, (i) => {
      const dir = o.dir || (o.wall ? this.awayDir(i) : null) || 'S';
      const ex = o.extra ? Object.assign({}, o.extra) : undefined;
      // thin poles (flagpole, feeder, dish) do not block the way, so they skip the reachability check
      const ob = o.solid && this.blocks(t) ? this.putSolid(Y, i, t, dir, ex) : this.put(Y, i, t, dir, ex);
      if (ob) ob._i = i;
      return ob;
    });
  },
  // ------------------------------------------------------------ one property
  decorate(b) {
    const Y = this.setup(b);
    if (!Y) return;
    const r = this.r, kind = Y.kind;
    const opts = [];
    for (const c in YD_CHARS) opts.push([c, YD_CHARS[c][kind] || 0]);
    Y.ch = r.weighted(opts);
    b.yard = Y.ch;
    const p = (k, mul) => r.chance(this.P(Y, k) * (mul || 1));
    this.tidyExisting(Y);
    // structures and fences first: they need the most room
    if (p('fence') && b.lot) this.backFence(Y);
    if (kind !== 'trailer' && p('shed', kind === 'house' ? 1 : 0.7)) this.shed(Y);
    if (kind === 'cabin' && r.chance(0.8)) this.one(Y, 'yd_outhouse', { zones: 6, solid: true, minD: 3, dir: Y.f });
    if (kind === 'farmhouse' || (kind === 'cabin' && r.chance(0.15))) this.one(Y, 'yd_coop', { zones: 6, solid: true, minD: 3, dir: r.pick(['S', 'E']) });
    // front of the house
    if (kind === 'trailer' ? r.chance(0.6) : p('porch')) this.porch(Y);
    if (p('beds')) this.beds(Y);
    if (p('hedge') && b.lot) this.hedges(Y);
    if (p('lights') && b.lot) this.pathLights(Y);
    if (p('tap')) this.one(Y, 'yd_tap', { zones: 6, wall: true, extra: { v: r.int(0, 3) } });
    // back and side yards
    if (p('patio')) this.patio(Y, p('deck'));
    if (p('bbq')) this.bbq(Y);
    if (p('firepit')) this.firepit(Y);
    if (p('kids')) this.kids(Y);
    if (p('garden')) this.garden(Y);
    if (p('compost')) this.one(Y, 'yd_compost', { zones: 6, solid: true, minD: 2, nearFence: true });
    if (p('barrel')) this.one(Y, 'barrel', { zones: 6, solid: true, wall: true, extra: { water: r.f(0.2, 0.9) } });
    if (p('clothes')) this.one(Y, 'yd_clothesline', { zones: 4, minD: 2, dir: r.pick(['S', 'E']), extra: { v: r.int(0, 9) } });
    if (p('picnic')) this.one(Y, 'st_table', { zones: 4, solid: true, minD: 2, dir: r.pick(['S', 'E']), extra: { kind: 'picnic' } });
    if (p('dog')) this.one(Y, 'yd_doghouse', { zones: 6, solid: true, minD: 1, dir: r.pick(['S', 'E']), extra: { v: r.int(0, 2) } });
    if (p('woodpile')) { const o = this.one(Y, 'yd_woodpile', { zones: 6, solid: true, wall: r.chance(0.6), nearFence: true, extra: { v: r.int(0, 5) } }); if (o && (kind === 'cabin' || kind === 'farmhouse' || r.chance(0.4))) this.one(Y, 'yd_chopblock', { zones: 6, solid: true, minD: 1, extra: { v: r.int(0, 1) } }); }
    if (p('ac') && kind !== 'cabin') this.one(Y, 'yd_ac', { zones: 6, solid: true, wall: true });
    if (p('propane') || (kind === 'trailer' && r.chance(0.6))) this.one(Y, 'yd_propane', { zones: 6, solid: true, wall: true });
    if (p('mower')) this.one(Y, 'yd_mower', { zones: 6, solid: true, wall: true, extra: { v: r.int(0, 1) } });
    if (p('junk')) this.junk(Y);
    if (p('chairs')) for (let k = r.int(1, 2); k > 0; k--) this.one(Y, 'yd_lawnchair', { zones: 4, minD: 1, dir: r.pick(['S', 'E', 'N', 'W']), extra: { v: r.int(0, 3) } });
    // little things out front
    if (p('flag')) this.one(Y, 'yd_flagpole', { zones: 1, solid: true, minD: 2, extra: { v: r.int(0, 2) } });
    if (p('birdbath')) this.one(Y, 'yd_birdbath', { zones: 7, solid: true, minD: 2 });
    if (p('feeder')) this.one(Y, 'yd_feeder', { zones: 7, solid: true, minD: 2 });
    if (p('gnome')) for (let k = r.int(1, 3); k > 0; k--) this.one(Y, 'yd_gnome', { zones: 1, dir: Y.f, extra: { v: r.int(0, 3) } });
    if (p('flamingo')) { const n = r.int(1, 3); for (let k = 0; k < n; k++) this.one(Y, 'yd_flamingo', { zones: kind === 'trailer' ? 7 : 1, extra: { v: k & 1 } }); }
    if (p('forsale') && b.lot) this.one(Y, 'yd_forsale', { zones: 1, edge: true, dir: Y.f });
    if (kind === 'trailer' && r.chance(0.3)) this.one(Y, 'yd_dish', { zones: 6, solid: true, wall: true });
    if (p('stripes') && b.lot) this.stripes(Y);
    if (!b.lot) this.ruralMailbox(Y);
    this.stats.yards++; this.stats.details += Y.n;
    this.stats.min = Math.min(this.stats.min, Y.n); this.stats.max = Math.max(this.stats.max, Y.n);
    this.stats.by[Y.ch] = (this.stats.by[Y.ch] || 0) + 1;
  },
  // lot furniture from the house generator: vary bins and mailboxes, move barbecues off the front lawn
  tidyExisting(Y) {
    const w = this.w, r = this.r;
    for (const i of Y.tiles) {
      const o = w.obj[i];
      if (!o) continue;
      if (o.t === 'trash') { o.v = r.int(0, 3); Y.n++; }
      else if (o.t === 'bbq' && this.zone[i] === 1) w.obj[i] = null;
    }
  },
  // ------------------------------------------------------------ features
  porch(Y) {
    const d = Y.front;
    if (!d) return null;
    const W = this.W, w = this.w, r = this.r, [dx, dy] = DIRV[d.dir], px = dy ? 1 : 0, py = dx ? 1 : 0;
    const tiles = [];
    for (let a = -1; a <= 1; a++) {
      const x = d.x + px * a, y = d.y + py * a, i = y * W + x;
      if (!World.inb(x, y) || this.own[i] !== Y.id || w.room[i] >= 0 || w.obj[i]) return null;
      const f = w.floor[i];
      if (!(this.lawn(i) || f === FL.SIDEWALK || f === FL.CONCRETE)) return null;
      tiles.push(i);
    }
    for (const i of tiles) { w.floor[i] = FL.WOOD; w.fvar[i] = 2; }
    const sides = r.chance(0.5) ? [tiles[0], tiles[2]] : [tiles[2], tiles[0]];
    if (r.chance(0.7)) this.put(Y, sides[0], 'yd_rocker', d.dir, { v: r.int(0, 1) });
    if (r.chance(0.6)) this.put(Y, sides[1], 'yd_planter', 'S', { col: r.int(0, YD_FLOWERS.length - 1) });
    return tiles;
  },
  // flower beds along the street-side wall of the house
  beds(Y) {
    const r = this.r, col = r.int(0, YD_FLOWERS.length - 1);
    const c = this.pick(Y, (i) => this.zone[i] === 1 && this.adj[i] && this.okObj(Y, i));
    let n = 0;
    for (const i of c) if (r.chance(0.8)) { this.put(Y, i, 'yd_flowers', 'S', { col, v: r.int(0, 7) }); n++; }
    // a few more beds against the side walls
    if (Y.ch === 'gardener' || Y.ch === 'tidy') for (const i of this.pick(Y, (j) => this.zone[j] === 2 && this.adj[j] && this.okObj(Y, j))) if (r.chance(0.35)) this.put(Y, i, 'yd_flowers', 'S', { col: (col + 1) % YD_FLOWERS.length, v: r.int(0, 7) });
    return n;
  },
  // hedges along the lot's side edges in the front yard
  hedges(Y) {
    const L = Y.b.lot, f = Y.f, r = this.r;
    const sides = f === 'N' || f === 'S' ? [['x', L.x0], ['x', L.x1]] : [['y', L.y0], ['y', L.y1]];
    for (const [ax, val] of sides) {
      if (!r.chance(0.7)) continue;
      for (const i of this.pick(Y, (j, x, y) => (ax === 'x' ? x === val : y === val) && this.zone[j] === 1)) if (this.okSolid(Y, i, null, true)) this.putSolid(Y, i, 'yd_hedge', 'S', { v: r.int(0, 5) });
    }
  },
  // garden lights beside the front walk
  pathLights(Y) {
    const W = this.W, w = this.w, [dx, dy] = DIRV[Y.f], step = dy ? 1 : W;
    let k = 0;
    for (const i of Y.tiles) {
      if (w.floor[i] !== FL.SIDEWALK || this.zone[i] !== 1) continue;
      if ((k++ & 1)) continue;
      for (const s of [-1, 1]) { const j = i + s * step; if (this.okObj(Y, j)) this.put(Y, j, 'yd_pathlight', 'S'); }
    }
    void dx;
  },
  // mowing stripes on a tidy lawn
  stripes(Y) {
    const W = this.W, w = this.w, alongX = Y.f === 'N' || Y.f === 'S';
    for (const i of Y.tiles) {
      if (!this.lawn(i) || w.deco[i] || w.obj[i]) continue;
      const x = i % W, y = (i / W) | 0;
      if (((alongX ? x : y) & 1) === 0) w.deco[i] = YD_DECO.STRIPE;
    }
  },
  // a paved patio or a wooden deck behind the back door (or the middle of the back wall), with a table and chairs
  patio(Y, deck) {
    const W = this.W, w = this.w, r = this.r, back = Y.back, [bx, by] = DIRV[back];
    const d = Y.doors.find(q => !q.garage && q.dir === back);
    let ax, ay;
    if (d) { ax = d.x; ay = d.y; }
    else if (back === 'N' || back === 'S') { ax = (Y.hx0 + Y.hx1) >> 1; ay = back === 'N' ? Y.hy0 - 1 : Y.hy1 + 1; }
    else { ay = (Y.hy0 + Y.hy1) >> 1; ax = back === 'W' ? Y.hx0 - 1 : Y.hx1 + 1; }
    const wd = r.int(3, 4), dp = r.int(2, 3), px = by ? 1 : 0, py = bx ? 1 : 0, half = Math.floor(wd / 2);
    const tiles = [];
    for (let a = -half; a < wd - half; a++) for (let k = 0; k < dp; k++) {
      const x = ax + px * a + bx * k, y = ay + py * a + by * k;
      if (!World.inb(x, y)) return null;
      const i = y * W + x;
      if (this.own[i] !== Y.id || w.room[i] >= 0 || w.obj[i] || !this.lawn(i)) return null;
      tiles.push(i);
    }
    for (const i of tiles) { w.floor[i] = deck ? FL.WOOD : FL.CONCRETE; w.fvar[i] = r.int(0, 3); }
    Y.patio = tiles;
    // umbrella table away from the door, chairs around it
    const spots = tiles.filter(i => !(this.clr[i] & 3));
    const ti = this.tryEach(spots.slice(), (i) => this.putSolid(Y, i, 'st_table', 'S', { v: r.int(0, 2) }) ? i : null);
    if (ti) for (const s of ['N', 'S', 'W', 'E']) {
      const [sx, sy] = DIRV[s], j = ti + sx + sy * W;
      if (tiles.includes(j) && !w.obj[j] && !(this.clr[j] & 2) && r.chance(0.6)) this.put(Y, j, 'yd_lawnchair', OPP[s], { v: r.int(0, 3) });
    }
    return tiles;
  },
  bbq(Y) {
    if (Y.patio) {
      const c = Y.patio.filter(i => !this.w.obj[i] && !(this.clr[i] & 3));
      if (this.tryEach(c, (i) => this.putSolid(Y, i, 'bbq', 'S'))) return;
    }
    this.one(Y, 'bbq', { zones: 4, solid: true, minD: 1, maxD: 3 });
  },
  // fire pit ringed by log benches
  firepit(Y) {
    const o = this.one(Y, 'campfire', { zones: 4, minD: 3 });
    if (!o) return;
    const W = this.W;
    let n = 0;
    for (const s of this.r.shuffle(['N', 'S', 'W', 'E'])) {
      if (n >= 2) break;
      const [sx, sy] = DIRV[s], j = o._i + sx * 2 + sy * 2 * W;
      if (this.okObj(Y, j)) { this.put(Y, j, 'yd_logbench', s === 'N' || s === 'S' ? 'S' : 'E'); n++; }
    }
  },
  kids(Y) {
    const r = this.r;
    if (r.chance(0.6)) this.one(Y, 'yd_swing', { zones: 4, solid: true, minD: 2, dir: r.pick(['S', 'E']), extra: { v: r.int(0, 2) } });
    if (r.chance(0.35)) this.one(Y, 'yd_trampoline', { zones: 4, solid: true, minD: 2 });
    if (r.chance(0.4)) this.one(Y, 'yd_sandbox', { zones: 4, minD: 2 });
    if (r.chance(0.35)) this.one(Y, 'yd_kpool', { zones: 4, minD: 1, extra: { v: r.int(0, 2) } });
    if (r.chance(0.5)) this.one(Y, 'yd_bike', { zones: 7, dir: r.pick(['S', 'E', 'N', 'W']), extra: { v: r.int(0, 3) } });
    for (let k = r.int(0, 2); k > 0; k--) this.one(Y, 'yd_toys', { zones: 7, extra: { v: r.int(0, 3) } });
  },
  // vegetable rows (real, harvestable crop plots) in the back yard
  garden(Y) {
    const W = this.W, w = this.w, r = this.r;
    const ws = r.int(2, 3), hs = r.int(2, 3);
    const c = this.pick(Y, (i) => this.zone[i] === 3 && this.dist(Y, i) >= 2);
    const crop = r.pick(Object.keys(CROPS)), crop2 = r.pick(Object.keys(CROPS));
    return this.tryEach(c, (i) => {
      const tl = [];
      for (let yy = 0; yy < hs; yy++) for (let xx = 0; xx < ws; xx++) { const j = i + xx + yy * W; if (!this.okObj(Y, j) || this.zone[j] !== 3) return null; tl.push(j); }
      for (const j of tl) { w.floor[j] = FL.FURROW; w.obj[j] = { t: 'crop', dir: 'S', crop: (j % W) & 1 ? crop : crop2, stage: 3, water: r.f(0.2, 0.6), grow: r.f(0.5, 0.75) }; Y.n++; }
      return tl;
    });
  },
  // garden shed tucked into a back corner, door toward the house
  shed(Y) {
    const r = this.r;
    const o = this.one(Y, 'yd_shed', { zones: 4, solid: true, minD: 2, nearFence: true, dir: Y.f, extra: { v: r.int(0, 3) } });
    if (o && o.c) o.c.loot = 'shed';
    if (o && r.chance(0.4)) this.one(Y, 'yd_wheelbarrow', { zones: 6, minD: 1, dir: r.pick(['S', 'E', 'N', 'W']), extra: { v: r.int(0, 2) } });
    return o;
  },
  junk(Y) {
    const r = this.r;
    const pool = [['yd_tires', 3], ['yd_junk', 2], ['yd_carparts', 1.5], ['yd_couch', 1.5], ['yd_trashbags', 2], ['yd_weeds', 4], ['yd_icechest', 1]];
    for (let k = r.int(2, 5); k > 0; k--) {
      const t = r.weighted(pool), solid = OBJ[t].solid === true;
      this.one(Y, t, { zones: t === 'yd_weeds' || t === 'yd_trashbags' ? 7 : 6, solid, dir: r.pick(['S', 'E', 'N', 'W']), extra: { v: r.int(0, 5) } });
    }
  },
  // privacy or chain-link fence round the back yard, with a gate gap beside the house
  backFence(Y) {
    const L = Y.b.lot, f = Y.f, w = this.w, W = this.W, r = this.r, type = r.chance(0.6) ? WT.WOODFENCE : WT.CHAIN;
    const E = [], ret = [[], []];
    if (f === 'S' || f === 'N') {
      const yb = f === 'S' ? L.y0 : L.y1 + 1, ys = f === 'S' ? [L.y0, Y.hy0 - 1] : [Y.hy1 + 1, L.y1], yr = f === 'S' ? Y.hy0 : Y.hy1 + 1;
      for (let x = L.x0; x <= L.x1; x++) E.push([x, yb, 0]);
      for (let y = ys[0]; y <= ys[1]; y++) { E.push([L.x0, y, 1]); E.push([L.x1 + 1, y, 1]); }
      for (let x = L.x0; x < Y.hx0; x++) ret[0].push([x, yr, 0]);
      for (let x = Y.hx1 + 1; x <= L.x1; x++) ret[1].push([x, yr, 0]);
    } else {
      const xb = f === 'E' ? L.x0 : L.x1 + 1, xs = f === 'E' ? [L.x0, Y.hx0 - 1] : [Y.hx1 + 1, L.x1], xr = f === 'E' ? Y.hx0 : Y.hx1 + 1;
      for (let y = L.y0; y <= L.y1; y++) E.push([xb, y, 1]);
      for (let x = xs[0]; x <= xs[1]; x++) { E.push([x, L.y0, 0]); E.push([x, L.y1 + 1, 0]); }
      for (let y = L.y0; y < Y.hy0; y++) ret[0].push([xr, y, 1]);
      for (let y = Y.hy1 + 1; y <= L.y1; y++) ret[1].push([xr, y, 1]);
    }
    // gate: one return run keeps an opening next to the house
    const gs = ret[0].length && (!ret[1].length || r.chance(0.5)) ? 0 : 1;
    if (ret[gs].length) ret[gs].splice(gs === 0 ? ret[gs].length - 1 : 0, 1);
    const set = [];
    for (const [x, y, d] of E.concat(ret[0], ret[1])) {
      if (!World.inb(x, y) || x >= this.GW) continue;
      const i = y * W + x;
      if (d ? w.wallW[i] : w.wallN[i]) continue;
      // no fence through objects' or buildings' edges
      const j = d ? i - 1 : i - W;
      if (w.room[i] >= 0 || w.room[j] >= 0) continue;
      World.setWall(x, y, d, type);
      set.push([x, y, d]);
    }
    if (this.reach(Y) !== Y.need) { for (const [x, y, d] of set) World.setWall(x, y, d, 0); return false; }
    Y.fence = true;
    return true;
  },
  // farm and cabin homes: a mailbox where the drive meets the road
  ruralMailbox(Y) {
    const d = Y.front;
    if (!d) return;
    const W = this.W, w = this.w;
    let best = null, bd = 1e9;
    for (let y = d.y - 10; y <= d.y + 10; y++) for (let x = d.x - 10; x <= d.x + 10; x++) {
      if (!World.inb(x, y) || x >= this.GW) continue;
      const f = w.floor[y * W + x];
      if (f !== FL.ASPHALT && f !== FL.GRAVEL) continue;
      for (const [dx, dy] of DIR4) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (!World.inb(nx, ny) || w.obj[j] || w.room[j] >= 0 || !this.lawn(j)) continue;
        const dd = Math.abs(nx - d.x) + Math.abs(ny - d.y);
        if (dd < bd) { bd = dd; best = [j, vecDir(-dx, -dy)]; }
      }
    }
    if (best && bd <= 12) { this.w.obj[best[0]] = this.m.mkObj('mailbox', best[1]); Y.n++; }
  },
};
MapGen.yardPass = function () { Yard.run(this); };
