'use strict';
// ---------------------------------------------------------------------------
// Trees & shrubs: species, ages, seasons, snow, wind sway and see-through fade.
// A tree is { t: 'tree', kind, sz, v }: kind = species (TREE_SP), sz = size (-> age class: sapling,
// young, mature, old), v = shape variant. A tree is planned once per (kind, age, variant) in world
// metres - trunk, limbs, crown lobes, leaf clusters, twigs - and painted per season into a cached sprite:
// clusters of small leaves lit from the sun side (upper left) with dark undersides and inner shadow,
// limbs showing through the gaps, root flare and a soft ground shadow. Sprites live in an LRU cache with
// a pixel budget; far out (zoom < 0.72) a half-size copy is drawn, close up (zoom >= 1.55 on a screen that
// magnifies 1.6x or more) a double-resolution one, so the leaves stay crisp. Bushes, stumps and fallen logs too.
// MapGen.treeKind / MapGen.tree pick species and size by biome (called from MapGen.forest etc).
// ---------------------------------------------------------------------------
// f crown form; H height and C crown radius (m) per age; cb crown base (fraction of H); lobes per age;
// bark; lf summer leaf, sp spring leaf, au autumn hues (one per tree), bloom spring blossom, ev evergreen
// cb crown bottom and fk fork height (fractions of H), wk trunk thickness, cr leaf cluster radius (m)
const TREE_SP = {
  oak: { n: 'Oak', f: 'spread', H: [2.3, 4.2, 5.8, 7.0], C: [0.55, 1.25, 1.7, 2.1], cb: 0.34, fk: 0.26, wk: 1.2, lobes: [2, 4, 6, 7], bark: '#57493c', lf: '#3e5b29', sp: '#86a64e', au: ['#9a4e22', '#a8682c', '#83391f', '#a88438'], hold: 1, leaf: 3.4, cr: 0.5 },
  maple: { n: 'Maple', f: 'round', H: [2.4, 4.4, 6.0, 7.2], C: [0.5, 1.05, 1.45, 1.8], cb: 0.3, fk: 0.3, wk: 1, lobes: [2, 4, 5, 6], bark: '#62564a', lf: '#4a7130', sp: '#9cb24e', au: ['#c3331f', '#d4661e', '#d9a228', '#a32a26'], flow: '#c4383a', leaf: 3.2, cr: 0.48 },
  elm: { n: 'Elm', f: 'vase', H: [2.6, 4.8, 6.8, 7.8], C: [0.5, 1.2, 1.75, 2.1], cb: 0.5, fk: 0.3, wk: 1.05, lobes: [2, 4, 6, 7], bark: '#4e4237', lf: '#4d6d2f', sp: '#92ae4a', au: ['#c8a43a', '#b88f2e', '#d0b048'], leaf: 2.9, cr: 0.44 },
  birch: { n: 'Birch', f: 'oval', H: [2.6, 4.6, 6.2, 7.0], C: [0.38, 0.78, 1.0, 1.2], cb: 0.3, fk: 0.85, wk: 0.68, lobes: [2, 4, 5, 6], bark: '#e4e0d4', white: 1, lf: '#64893b', sp: '#a6c660', au: ['#e0bc36', '#d3a52c', '#e8cc50'], leaf: 2.3, airy: 1, cr: 0.33 },
  apple: { n: 'Apple', f: 'low', H: [1.8, 2.8, 3.6, 4.2], C: [0.5, 1.0, 1.4, 1.65], cb: 0.28, fk: 0.24, wk: 1.05, lobes: [2, 4, 5, 6], bark: '#5c4a3a', lf: '#4e7434', sp: '#8eae52', bloom: '#f4e6ea', fruit: '#b8302a', au: ['#b09a3a', '#a8822e'], leaf: 3.0, cr: 0.42 },
  cherry: { n: 'Cherry', f: 'low', H: [1.9, 3.0, 4.0, 4.6], C: [0.5, 1.0, 1.35, 1.6], cb: 0.34, fk: 0.28, wk: 0.9, lobes: [2, 4, 5, 6], bark: '#5e3c36', lf: '#405d2d', sp: '#7e9e4a', bloom: '#f0b2c6', au: ['#c44a2a', '#b2302a', '#d0702a'], leaf: 3.0, lent: 1, cr: 0.4 },
  pine: { n: 'Pine', f: 'pine', H: [2.2, 4.6, 6.8, 8.0], C: [0.5, 0.95, 1.3, 1.55], bark: '#62483a', lf: '#3e5e38', sp: '#7aa452', wi: '#3a5636', ev: 1, wk: 1 },
  spruce: { n: 'Spruce', f: 'cone', H: [1.8, 4.0, 6.2, 7.6], C: [0.55, 1.0, 1.35, 1.6], bark: '#4c3b2f', lf: '#2d4b35', sp: '#64985a', wi: '#2c4636', ev: 1, wk: 1 },
  cedar: { n: 'Cedar', f: 'column', H: [1.6, 3.4, 4.9, 5.8], C: [0.4, 0.7, 0.9, 1.05], bark: '#6c4733', lf: '#3b5631', sp: '#5f8040', wi: '#575a30', ev: 1, wk: 0.9 },
  dead: { n: 'Dead Tree', f: 'dead', H: [2.0, 4.0, 5.6, 6.6], C: [0.5, 1.0, 1.4, 1.7], cb: 0.4, fk: 0.34, wk: 1.1, lobes: [2, 3, 4, 5], bark: '#7a736b' },
};
const TREE_KINDS = Object.keys(TREE_SP);
const TREE_SNOW = '#eef2f6';
// sun from the upper left of the screen and above (world u = west->east, v = north->south)
const TREE_SUN = (() => { const l = Math.hypot(-0.62, -0.22, 0.76); return [-0.62 / l, -0.22 / l, 0.76 / l]; })();

const Trees = {
  NV: 4,
  cache: new Map(), px: 0, PXCAP: 7e6, HICAP: 12e6, plans: new Map(), last: new Map(),
  tick: -1, spent: 0, BUDGET: 9, fade: new Map(), t0: 0, dt: 0, wind: 0.3, mx: -1e9, my: -1e9, res: '',
  hash(a, b, c) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; },
  age(o) { const s = o.sz || 1; return s < 0.6 ? 0 : s < 0.95 ? 1 : s < 1.2 ? 2 : 3; },
  sp(o) { return TREE_SP[o.kind] || TREE_SP.oak; },
  // season part of the sprite key: what the painter actually looks at for this species
  skey(kind) {
    const sp = TREE_SP[kind] || TREE_SP.oak, st = Season.tree, sn = Season.snow > 0.3 ? 'S' : '';
    if (sp.ev) return (st === 'p' ? 'p' : st === 'b' || st === 's' ? 'w' : 'g') + sn;
    if (sp.f === 'dead') return sn;
    if (sp.fruit && st === 'g' && Season.doy >= 213) return 'f' + sn;
    return st + sn;
  },
  // trees from old saves (no variant, 4 species) get a variant and a biome species the first time
  // they are drawn (their old species weighs in); trees placed with a variant keep their species
  fix(o, x, y) {
    if (o.v === undefined) { o.v = this.hash(x, y, 77) % this.NV; if (!o.stump) o.kind = MapGen.treeKind(x, y, undefined, o.kind); }
    if (!TREE_SP[o.kind]) o.kind = 'oak';
  },

  // ------------------------------------------------------------------ plan (season independent)
  // segs: [u0,v0,z0,u1,v1,z1,w0,w1,lvl]; clusters: {u,v,z,r,n:[x,y,z],o (outerness), q (random)}
  plan(kind, age, v) {
    const key = kind + age + v;
    let pl = this.plans.get(key);
    if (pl) return pl;
    const sp = TREE_SP[kind] || TREE_SP.oak;
    const rng = new RNG(this.hash(TREE_KINDS.indexOf(kind) + 1, age * 7 + 3, v * 13 + 5));
    pl = sp.f === 'cone' || sp.f === 'column' ? this.planCone(sp, age, rng) : sp.f === 'pine' ? this.planPine(sp, age, rng) : this.planDec(sp, age, rng);
    pl.sp = sp; pl.age = age; pl.v = v;
    this.plans.set(key, pl);
    return pl;
  },
  planDec(sp, age, rng) {
    const f = sp.f, dead = f === 'dead', oval = f === 'oval';
    const H = sp.H[age] * rng.f(0.92, 1.08), C = sp.C[age] * rng.f(0.9, 1.1);
    const zb = H * sp.cb * rng.f(0.9, 1.1) * (age ? 1 : 0.8), cv = (H - zb) / 2, zc = zb + cv;
    const zf = Math.max(0.4, H * sp.fk * rng.f(0.9, 1.1)), wT = (0.08 + age * 0.075) * sp.wk;
    const segs = [], clusters = [], twigs = [], lobes = [];
    const lean = [rng.f(-0.08, 0.08) * C, rng.f(-0.08, 0.08) * C];
    // trunk in two pieces with a slight bend: birch keeps a leader to near the top, dead trees snap off
    const tTop = oval ? H * 0.9 : dead && age > 1 && rng.chance(0.6) ? zf + (H - zf) * rng.f(0.2, 0.45) : zf;
    const tm = [lean[0] * 0.45 + rng.f(-0.04, 0.04), lean[1] * 0.45 + rng.f(-0.04, 0.04), tTop * 0.5];
    segs.push([0, 0, 0, tm[0], tm[1], tm[2], wT, wT * 0.86, 0], [tm[0], tm[1], tm[2], lean[0], lean[1], tTop, wT * 0.86, wT * (oval ? 0.22 : 0.7), 0]);
    const at = (z) => [lean[0] * z / tTop, lean[1] * z / tTop];
    // lobes (sub-crowns) on the crown envelope, each reached by a limb
    const nL = sp.lobes[age] + rng.int(0, 1), ph = rng.f(0, 6.283);
    for (let k = 0; k < nL; k++) {
      const top1 = k === 0 && !oval, a = ph + k / nL * 6.283 + rng.f(-0.4, 0.4);
      let e = top1 ? 0.8 : f === 'vase' ? rng.f(0.15, 0.7) : f === 'spread' || f === 'low' ? rng.f(-0.4, 0.4) : rng.f(-0.5, 0.6);
      if (oval) e = U.lerp(-0.75, 0.75, (k + 0.5) / nL) + rng.f(-0.12, 0.12);
      const rr = top1 ? 0.12 : f === 'vase' ? 0.8 : oval ? 0.45 : f === 'spread' ? 0.74 : 0.64, ce = Math.sqrt(Math.max(0, 1 - e * e)) * rng.f(0.85, 1.12);
      lobes.push({ u: lean[0] + Math.cos(a) * C * ce * rr, v: lean[1] + Math.sin(a) * C * ce * rr, z: zc + cv * e * 0.72, r: (top1 ? C * 0.55 : C * rng.f(0.42, 0.56)) * (age ? 1 : 1.2) * (oval ? 1.1 : 1), a, top: top1 });
    }
    // birch: a second or third stem now and then, with its own small lobes
    if (oval && age > 0 && rng.chance(0.45)) for (let k = rng.int(1, 2); k > 0; k--) {
      const a = rng.f(0, 6.283), d = C * rng.f(0.35, 0.55), hh = H * rng.f(0.72, 0.9);
      segs.push([Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.05, Math.cos(a) * d, Math.sin(a) * d, hh, wT * 0.75, wT * 0.2, 0]);
      for (let j = 0; j < 2; j++) lobes.push({ u: Math.cos(a) * d * 1.15, v: Math.sin(a) * d * 1.15, z: hh * (0.62 + j * 0.25), r: C * 0.42, a: a + j, stem: [Math.cos(a) * d, Math.sin(a) * d, hh] });
    }
    for (const L of lobes) {
      // limb from the fork (or up the leader) bending out toward the lobe centre
      const s0 = L.stem ? L.z - 0.4 : oval ? U.clamp(L.z - L.r * 0.9, zf * 0.55, tTop * 0.95) : tTop - rng.f(0, 0.18) * tTop;
      const [su, sv] = L.stem ? [L.stem[0] * s0 / L.stem[2], L.stem[1] * s0 / L.stem[2]] : at(s0);
      const flat = f === 'spread' ? 0.3 : f === 'low' ? 0.35 : 0.45;
      const mu = U.lerp(su, L.u, 0.55), mv = U.lerp(sv, L.v, 0.55), mz = U.lerp(s0, L.z, flat) + (f === 'vase' ? 0.3 : 0);
      const w0 = wT * (oval ? 0.3 : L.top ? 0.5 : 0.6), broken = dead && rng.chance(0.35);
      const eu = broken ? U.lerp(mu, L.u, 0.3) : L.u, ev = broken ? U.lerp(mv, L.v, 0.3) : L.v, ez = broken ? U.lerp(mz, L.z, 0.3) : L.z - L.r * 0.2;
      segs.push([su, sv, s0, mu, mv, mz, w0, w0 * 0.72, 1], [mu, mv, mz, eu, ev, ez, w0 * 0.72, broken ? w0 * 0.55 : w0 * 0.36, 1]);
      if (broken) { L.r *= 0.4; L.dead = 1; continue; }
      // branches from the limb to the lobe surface, fine twigs off those (seen when bare)
      const nb = 3 + (age > 1 ? 2 : 0) + (dead ? 1 : 0);
      for (let j = 0; j < nb; j++) {
        const a = L.a + rng.f(-1.6, 1.6), el = rng.f(-0.15, 1.0), t = rng.f(0.55, 1);
        const pu = U.lerp(mu, eu, t), pv = U.lerp(mv, ev, t), pz = U.lerp(mz, ez, t);
        const bu = L.u + Math.cos(a) * L.r * 0.9 * Math.cos(el), bv = L.v + Math.sin(a) * L.r * 0.9 * Math.cos(el), bz = L.z + L.r * 0.85 * Math.sin(el);
        segs.push([pu, pv, pz, bu, bv, bz, w0 * (dead ? 0.42 : 0.34), w0 * 0.1, 2]);
        for (let q = 0; q < (dead ? 2 : 4); q++) {
          const p = rng.f(0.35, 1), a2 = a + rng.f(-1, 1), l2 = L.r * rng.f(0.25, 0.55), e2 = el + rng.f(-0.4, 0.7);
          const qu = U.lerp(pu, bu, p), qv = U.lerp(pv, bv, p), qz = U.lerp(pz, bz, p);
          twigs.push([qu, qv, qz, qu + Math.cos(a2) * l2 * Math.cos(e2), qv + Math.sin(a2) * l2 * Math.cos(e2), qz + l2 * Math.sin(e2) * 0.8]);
        }
      }
    }
    // finer twigs off the twigs (own RNG so the crown keeps its shape): the grey haze of a bare crown
    const fine = [], r2 = new RNG(rng.int(1, 1e6));
    for (const t of twigs) for (let j = dead ? 0 : 4; j > 0; j--) {
      const p = r2.f(0.25, 1), ou = U.lerp(t[0], t[3], p), ov = U.lerp(t[1], t[4], p), oz = U.lerp(t[2], t[5], p);
      const l = Math.hypot(t[3] - t[0], t[4] - t[1], t[5] - t[2]) * r2.f(0.3, 0.6) + 0.04;
      let du = (t[3] - t[0]) / l + r2.f(-1.2, 1.2), dv = (t[4] - t[1]) / l + r2.f(-1.2, 1.2), dz = (t[5] - t[2]) / l + r2.f(-0.3, 1.1);
      const m = Math.hypot(du, dv, dz) || 1;
      fine.push([ou, ov, oz, ou + du / m * l, ov + dv / m * l, oz + dz / m * l]);
    }
    // leaf clusters: domes over each lobe (thin underneath, so limbs show going in), a dark fill inside
    if (!dead) {
      const cr = sp.cr * (age ? 1 : 0.7), cx = lean[0], cy = lean[1];
      const add = (u, vv, z, r, du, dv, dz) => {
        const gu = (u - cx) / C, gv = (vv - cy) / C, gz = (z - zc) / cv, gl = Math.hypot(gu, gv, gz) || 1;
        const nu = du * 0.5 + gu / gl * 0.5, nv = dv * 0.5 + gv / gl * 0.5, nz = dz * 0.5 + gz / gl * 0.5, nl = Math.hypot(nu, nv, nz) || 1;
        clusters.push({ u, v: vv, z, r, n: [nu / nl, nv / nl, nz / nl], o: Math.min(1, gl), q: rng.next(), s: rng.int(1, 1e6) });
      };
      for (const L of lobes) {
        if (L.dead) continue;
        const m = Math.round(3 + (L.r / cr) * (L.r / cr) * (sp.airy ? 1.7 : 2.2));
        for (let j = 0; j < m; j++) {
          let du = rng.f(-1, 1), dv = rng.f(-1, 1), dz = rng.f(-0.45, 1);
          const l = Math.hypot(du, dv, dz) || 1; du /= l; dv /= l; dz /= l;
          const d = L.r * rng.f(0.45, 1.0);
          add(L.u + du * d, L.v + dv * d, L.z + dz * d * 0.8, cr * rng.f(0.8, 1.2), du, dv, dz);
        }
      }
      if (!oval) for (let j = 0; j < nL; j++) { const a = rng.f(0, 6.283), d = C * rng.f(0, 0.35); add(cx + Math.cos(a) * d, cy + Math.sin(a) * d, zc + rng.f(-0.2, 0.4) * cv, cr * 1.2, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.2); }
    }
    return { H, C, cv, zc, segs, clusters, twigs, fine, lobes, wT, top: zc + cv + 0.35, lu: lean[0], lv: lean[1] };
  },
  // spruce (cone) and cedar (column): tiers of boughs from near the ground to the tip
  planCone(sp, age, rng) {
    const col = sp.f === 'column';
    const H = sp.H[age] * rng.f(0.92, 1.08), C = sp.C[age] * rng.f(0.9, 1.1);
    const z0 = col ? 0.12 : 0.22 + age * 0.06, wT = 0.06 + age * 0.05;
    const segs = [[0, 0, 0, 0, 0, H * 0.96, wT, wT * 0.2, 0]], clusters = [];
    const dz = (col ? 0.2 : 0.3) + age * 0.025;
    let z = z0, ti = 0;
    while (z < H - 0.12) {
      const t = (z - z0) / (H - z0);
      const r = (col ? C * Math.min(1, (1 - Math.pow(t, 1.6)) * 1.15) * (0.75 + 0.25 * Math.min(1, t * 5)) : C * Math.pow(1 - t, 0.9)) * rng.f(0.86, 1.12) + 0.08;
      const K = Math.max(3, Math.round(r * (col ? 9 : 6.5))), ph = rng.f(0, 6.283);
      for (let k = 0; k < K; k++) {
        const a = ph + k / K * 6.283 + rng.f(-0.3, 0.3), rk = r * rng.f(0.85, 1.08);
        const steps = rk > 0.55 ? 3 : rk > 0.3 ? 2 : 1;
        for (let j = 1; j <= steps; j++) {
          const f = j / steps, rr = rk * (0.25 + 0.75 * f), droop = col ? 0.05 : 0.22 * rr * rr / Math.max(0.3, rk);
          const nu = Math.cos(a), nv = Math.sin(a), nz = col ? 0.25 : 0.55, nl = Math.hypot(nu, nv, nz);
          clusters.push({ u: nu * rr, v: nv * rr, z: z - droop + (col ? rng.f(-0.06, 0.06) : 0), r: (col ? 0.17 : 0.2 + 0.07 * (1 - t)) * rng.f(0.85, 1.15) * (age ? 1 : 0.8), n: [nu / nl, nv / nl, nz / nl], o: f, q: rng.next(), s: rng.int(1, 1e6), tier: ti, tip: j === steps });
        }
      }
      z += dz * rng.f(0.85, 1.15); ti++;
    }
    // leader
    clusters.push({ u: 0, v: 0, z: H - 0.08, r: 0.13, n: [0, 0, 1], o: 1, q: rng.next(), s: rng.int(1, 1e6), tier: ti, tip: true });
    return { H, C, cv: H / 2, zc: H / 2, segs, clusters, twigs: [], lobes: [], wT, top: H + 0.25, cone: 1, lu: 0, lv: 0 };
  },
  // white pine: tall bare trunk, whorls of near-level limbs ending in needle tufts, open crown
  planPine(sp, age, rng) {
    const H = sp.H[age] * rng.f(0.92, 1.08), C = sp.C[age] * rng.f(0.9, 1.1);
    const wT = 0.08 + age * 0.06, zb = age ? H * rng.f(0.36, 0.48) : 0.35;
    const lean = [rng.f(-0.06, 0.06), rng.f(-0.06, 0.06)];
    const segs = [[0, 0, 0, lean[0], lean[1], H * 0.97, wT, wT * 0.18, 0]], clusters = [], twigs = [];
    const tuft = (u, v, z, r, a, o) => {
      const nu = Math.cos(a), nv = Math.sin(a), nz = 0.7, nl = Math.hypot(nu, nv, nz);
      clusters.push({ u, v, z, r: r * (age ? 1 : 0.75), n: [nu / nl, nv / nl, nz / nl], o, q: rng.next(), s: rng.int(1, 1e6), flat: 1 });
    };
    let z = zb, ph = rng.f(0, 6.283);
    while (z < H - 0.35) {
      const t = (z - zb) / (H - zb), n = rng.int(3, 4);
      for (let k = 0; k < n; k++) {
        if (rng.chance(0.18)) continue;
        const a = ph + k / n * 6.283 + rng.f(-0.4, 0.4), L = C * rng.f(0.6, 1.0) * (1 - 0.55 * t * t) + 0.1;
        const su = lean[0] * z / H, sv = lean[1] * z / H, eu = su + Math.cos(a) * L, ev = sv + Math.sin(a) * L, ez = z + L * rng.f(0.05, 0.3);
        segs.push([su, sv, z, eu, ev, ez, wT * 0.32 * (1 - t * 0.5), wT * 0.08, 1]);
        tuft(eu, ev, ez + 0.05, rng.f(0.32, 0.42), a, 1);
        if (L > 0.55) tuft(U.lerp(su, eu, 0.55), U.lerp(sv, ev, 0.55), U.lerp(z, ez, 0.55) + 0.06, rng.f(0.24, 0.32), a, 0.6);
        if (L > 0.9 && rng.chance(0.6)) { const b = a + rng.f(-0.8, 0.8); tuft(U.lerp(su, eu, 0.8) + Math.cos(b) * 0.3, U.lerp(sv, ev, 0.8) + Math.sin(b) * 0.3, ez + 0.1, rng.f(0.22, 0.3), b, 0.9); }
      }
      z += rng.f(0.5, 0.75) * (age ? 1 : 0.6); ph += rng.f(0.5, 1.4);
    }
    tuft(lean[0], lean[1], H, 0.3, 0, 1);
    // dead lower stubs
    for (let k = 0; k < 2 + age; k++) { const zz = rng.f(1, Math.max(1.1, zb - 0.2)), a = rng.f(0, 6.283), l = rng.f(0.15, 0.35); twigs.push([lean[0] * zz / H, lean[1] * zz / H, zz, Math.cos(a) * l, Math.sin(a) * l, zz - 0.05]); }
    return { H, C, cv: (H - zb) / 2, zc: (H + zb) / 2, segs, clusters, twigs, lobes: [], wT, top: H + 0.45, pine: 1, lu: lean[0], lv: lean[1] };
  },

  // ------------------------------------------------------------------ colours
  tones: new Map(),
  // colour at brightness f: darker = shade (slightly blue), brighter = toward warm sunlight
  tone(col, f) {
    const q = Math.round(f * 20), key = col + q;
    let s = this.tones.get(key);
    if (s) return s;
    if (this.tones.size > 40000) this.tones.clear();
    const k = q / 20;
    s = k <= 1 ? Col.shade(Col.mix(col, '#1c2a3a', Math.max(0, 0.75 - k) * 0.35), k) : Col.shade(Col.mix(col, '#f2f0a8', (k - 1) * 0.9), 1 + (k - 1) * 0.3);
    this.tones.set(key, s);
    return s;
  },
  // leaf colour of cluster c for season st, or null when the cluster is bare
  leafCol(pl, c, st, hue) {
    const sp = pl.sp, q = c.q;
    if (sp.ev) {
      const base = st[0] === 'w' ? Col.mix(sp.lf, sp.wi, 0.7) : sp.lf;
      return Col.mix(base, q < 0.5 ? '#1e3226' : '#6a8a4a', Math.abs(q - 0.5) * 0.35);
    }
    const s0 = st[0], au = sp.au, ai = hue % au.length;
    const auc = Col.mix(au[ai], au[(ai + 1) % au.length], (q * 7.3) % 1 * 0.55);
    if (s0 === 'b') return null;
    if (s0 === 'p') {
      if (sp.bloom) return q < 0.82 ? (q < 0.12 ? sp.sp : sp.bloom) : null;
      if (q > 0.85) return null;
      return Col.mix(sp.sp, '#c8d888', q * 0.3);
    }
    if (s0 === 'y') {
      // outer and upper clusters turn first
      return q * 0.75 + c.o * 0.35 + c.n[2] * 0.15 > 0.62 ? auc : Col.mix(sp.lf, auc, q * 0.35);
    }
    if (s0 === 'a') return q < (sp.hold ? 0.14 : 0.06) && c.o < 0.8 ? Col.mix(sp.lf, auc, 0.4) : auc;
    if (s0 === 's') return q < (sp.hold ? 0.62 : 0.3) ? Col.mix(auc, '#6e4e30', 0.45 + q * 0.3) : null;
    return Col.mix(sp.lf, q < 0.5 ? '#2c4420' : '#7a9a48', Math.abs(q - 0.5) * 0.3);
  },

  // ------------------------------------------------------------------ painting
  // light on a unit normal: wrapped diffuse from the sun, darker toward the ground
  light(n) { const d = n[0] * TREE_SUN[0] + n[1] * TREE_SUN[1] + n[2] * TREE_SUN[2]; return U.clamp((d + 0.42) / 1.42, 0, 1); },
  // a clump of leaves: dark mass, mid leaves, sunlit leaves toward the upper left
  cluster(g, x, y, r, col, tn, rng, leaf, kind, snow) {
    const T = (f) => this.tone(col, U.clamp(f, 0.22, 1.35));
    if (kind !== 'l') return this.needles(g, x, y, r, T, tn, rng, kind, snow);
    // lumpy dark core (self-shadow, mostly seen low and to the right), then three leaf layers
    g.fillStyle = T(tn * 0.62);
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * 1.047 + rng.f(-0.45, 0.45), d = r * rng.f(0.2, 0.48), rr = r * rng.f(0.42, 0.6); const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.8 + r * 0.1; g.moveTo(cx + rr, cy); g.arc(cx, cy, rr, 0, 6.283); }
    g.fill();
    const L = leaf, W = leaf * 0.55;
    const layer = (n, ox, oy, rad, f) => {
      g.fillStyle = T(f);
      g.beginPath();
      for (let k = 0; k < n; k++) {
        const a = rng.f(0, 6.283), d = rad * Math.sqrt(rng.next());
        const px = x + ox + Math.cos(a) * d, py = y + oy + Math.sin(a) * d * 0.88;
        const b = rng.f(0, 3.1416), c = Math.cos(b), s = Math.sin(b);
        g.moveTo(px + c * L, py + s * L * 0.8); g.lineTo(px - s * W, py + c * W); g.lineTo(px - c * L, py - s * L * 0.8); g.lineTo(px + s * W, py - c * W); g.closePath();
      }
      g.fill();
    };
    const k = r * r / 260;
    layer(Math.round(30 * k + 5), r * 0.02, r * 0.06, r * 1.04, tn * 0.8);
    layer(Math.round(28 * k + 5), -r * 0.14, -r * 0.18, r * 0.8, tn * 1.0);
    layer(Math.round(12 * k + 3), -r * 0.3, -r * 0.36, r * 0.48, tn * 1.18);
    if (snow) this.snowCap(g, x - r * 0.12, y - r * 0.5, r * 0.62, r * 0.3, tn, rng);
  },
  // lumpy snow lying on a clump: shaded lumps, then a brighter crest toward the sun
  snowCap(g, x, y, w, h, tn, rng) {
    g.fillStyle = this.tone(TREE_SNOW, U.clamp(0.7 + tn * 0.22, 0.6, 0.98));
    g.beginPath();
    for (let j = 0; j < 3; j++) { const cx = x + (j - 1) * w * 0.52 + rng.f(-0.1, 0.1) * w, cy = y + Math.abs(j - 1) * h * 0.35 + rng.f(-0.1, 0.1) * h, rx = w * rng.f(0.38, 0.55), ry = h * rng.f(0.6, 0.85); g.moveTo(cx + rx, cy); g.ellipse(cx, cy, rx, ry, 0, 0, 6.283); }
    g.fill();
    g.fillStyle = this.tone(TREE_SNOW, U.clamp(0.92 + tn * 0.14, 0.82, 1.08));
    g.beginPath();
    for (let j = 0; j < 2; j++) { const cx = x - w * (0.35 - j * 0.45) + rng.f(-0.08, 0.08) * w, cy = y - h * 0.3, rx = w * rng.f(0.25, 0.38), ry = h * 0.42; g.moveTo(cx + rx, cy); g.ellipse(cx, cy, rx, ry, 0, 0, 6.283); }
    g.fill();
  },
  // conifer clumps. n: spruce bough - a flat-topped mound drooping at both ends with a fringe of
  // needles hanging from its lower edge; c: cedar - a rounder mound of fine scale dabs; p: pine tuft -
  // a starburst of long needles around a dark core
  needles(g, x, y, r, T, tn, rng, kind, snow) {
    const k = r * r / 120;
    g.lineCap = 'round';
    const strokes = (n, f, w, fn) => { g.strokeStyle = T(f); g.lineWidth = w; g.beginPath(); for (let j = 0; j < n; j++) fn(); g.stroke(); };
    if (kind === 'p') {
      g.fillStyle = T(tn * 0.48);
      g.beginPath();
      for (let j = 0; j < 4; j++) { const cx = x + rng.f(-0.35, 0.35) * r, cy = y + rng.f(-0.2, 0.25) * r; g.moveTo(cx + r * 0.5, cy); g.ellipse(cx, cy, r * 0.5, r * 0.32, 0, 0, 6.283); }
      g.fill();
      const ray = (f0, up, len) => () => {
        const a = up ? rng.f(-2.9, -0.25) : rng.f(-3.1, 3.1), d = r * 0.3 * Math.sqrt(rng.next()), sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * 0.6;
        const l = r * rng.f(0.45, 0.95) * len;
        g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l * 0.55 + (Math.sin(a) > 0 ? l * 0.2 : 0));
      };
      strokes(Math.round(20 * k + 8), tn * 0.62, 1.1, ray(0, false, 1));
      strokes(Math.round(16 * k + 6), tn * 0.92, 1.1, ray(0, true, 0.9));
      strokes(Math.round(8 * k + 3), tn * 1.18, 1, () => { const a = rng.f(-2.8, -1.2), d = r * 0.25 * Math.sqrt(rng.next()), sx = x - r * 0.15 + Math.cos(a) * d, sy = y - r * 0.1 + Math.sin(a) * d * 0.6, l = r * rng.f(0.35, 0.7); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l * 0.55); });
      if (snow) this.snowCap(g, x - r * 0.1, y - r * 0.2, r * 0.5, r * 0.17, tn, rng);
      g.lineCap = 'butt';
      return;
    }
    const cedar = kind === 'c', w = r * (cedar ? 1.05 : 1.32), h = r * (cedar ? 0.82 : 0.6);
    // the mound: dark body
    g.fillStyle = T(tn * 0.5);
    g.beginPath(); g.moveTo(x - w, y + h * 0.45); g.quadraticCurveTo(x - w * 0.6, y - h * 1.2, x - w * 0.05, y - h); g.quadraticCurveTo(x + w * 0.55, y - h * 0.95, x + w, y + h * 0.5); g.quadraticCurveTo(x, y + h * 1.05, x - w, y + h * 0.45); g.fill();
    if (cedar) {
      // fine scale dabs, sunlit toward the upper left
      const dabs = (n, f, ox, oy, rad) => { g.fillStyle = T(f); g.beginPath(); for (let j = 0; j < n; j++) { const a = rng.f(0, 6.283), d = rad * Math.sqrt(rng.next()), px = x + ox + Math.cos(a) * d * w / r, py = y + oy + Math.sin(a) * d * h / r; g.moveTo(px + 1.4, py); g.ellipse(px, py, 1.4, 1, rng.f(0, 3), 0, 6.283); } g.fill(); };
      dabs(Math.round(22 * k + 6), tn * 0.72, 0, h * 0.1, r * 0.95);
      dabs(Math.round(16 * k + 5), tn * 0.95, -w * 0.12, -h * 0.25, r * 0.7);
      dabs(Math.round(7 * k + 2), tn * 1.18, -w * 0.28, -h * 0.45, r * 0.4);
    } else {
      // fringe hanging from the lower edge, needles fanning over the body, sunlit tips on top
      strokes(Math.round(12 * k + 5), tn * 0.58, 1.2, () => { const t = rng.f(-1, 1), px = x + t * w * 0.95, py = y + h * (0.45 + 0.5 * (1 - t * t)) - rng.f(0, h * 0.5), l = rng.f(2.5, 5); g.moveTo(px, py); g.lineTo(px + t * l * 0.6, py + l); });
      strokes(Math.round(16 * k + 5), tn * 0.82, 1.15, () => { const t = rng.f(-0.9, 0.9), px = x + t * w * 0.8, py = y + rng.f(-0.7, 0.4) * h, l = rng.f(2.5, 4.5); g.moveTo(px, py); g.lineTo(px + (t + rng.f(-0.4, 0.4)) * l, py + l * 0.55); });
      strokes(Math.round(9 * k + 3), tn * 1.12, 1.05, () => { const t = rng.f(-0.85, 0.35), px = x + t * w * 0.8, py = y - h * rng.f(0.35, 0.95) * (1 - t * t * 0.5), l = rng.f(2, 3.5); g.moveTo(px, py); g.lineTo(px + (t - 0.3) * l, py + l * 0.35); });
    }
    if (snow) {
      // snow load along the top of the bough
      g.fillStyle = this.tone(TREE_SNOW, U.clamp(0.7 + tn * 0.3, 0.62, 1.05));
      g.beginPath(); g.moveTo(x - w * 0.85, y - h * 0.05); g.quadraticCurveTo(x - w * 0.5, y - h * 1.25, x, y - h * 1.08); g.quadraticCurveTo(x + w * 0.5, y - h * 1.0, x + w * 0.8, y - h * 0.05); g.quadraticCurveTo(x, y - h * 0.55, x - w * 0.85, y - h * 0.05); g.fill();
      g.fillStyle = this.tone(TREE_SNOW, U.clamp(0.95 + tn * 0.12, 0.85, 1.1));
      g.beginPath(); g.ellipse(x - w * 0.3, y - h * 0.82, w * 0.3, h * 0.18, -0.15, 0, 6.283); g.fill();
    }
    g.lineCap = 'butt';
  },
  // tapered limb with a lit left edge and a dark right edge
  limb(g, a, b, w0, w1, bark, tn, snow, kind) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    if (w0 < 1.6) { g.strokeStyle = this.tone(bark, tn * 0.8); g.lineWidth = Math.max(0.7, (w0 + w1) / 2); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    else {
      const h0 = w0 / 2, h1 = w1 / 2;
      poly(g, [[a[0] + nx * h0, a[1] + ny * h0], [b[0] + nx * h1, b[1] + ny * h1], [b[0] - nx * h1, b[1] - ny * h1], [a[0] - nx * h0, a[1] - ny * h0]], this.tone(bark, tn * 0.72));
      g.fillStyle = this.tone(bark, tn * 0.72); g.beginPath(); g.arc(b[0], b[1], h1, 0, 6.283); g.fill();
      // lit side: the side whose normal points left (toward the sun)
      const s = nx < 0 ? 1 : -1;
      poly(g, [[a[0] + nx * h0 * s, a[1] + ny * h0 * s], [b[0] + nx * h1 * s, b[1] + ny * h1 * s], [b[0] + nx * h1 * s * 0.1, b[1] + ny * h1 * s * 0.1], [a[0] + nx * h0 * s * 0.1, a[1] + ny * h0 * s * 0.1]], this.tone(bark, tn * (kind === 'white' ? 1.0 : 0.98)));
      if (kind === 'white' && w0 > 2.5) {
        // birch: dark lenticel dashes across the stem
        g.fillStyle = 'rgba(30,26,24,0.75)';
        const n = Math.floor(l / 5);
        for (let k = 1; k < n; k++) { const t = k / n + Math.sin(k * 7.1) * 0.03, cx = a[0] + dx * t, cy = a[1] + dy * t, hw = U.lerp(h0, h1, t) * (0.3 + Math.abs(Math.sin(k * 3.7)) * 0.6); g.fillRect(cx - hw + Math.sin(k * 5.3) * hw * 0.5, cy, hw, 1); }
      }
      if (snow && Math.abs(dy) < l * 0.75) {
        g.strokeStyle = TREE_SNOW; g.lineWidth = Math.max(1, Math.min(2.5, w1 * 0.6));
        const up = ny < 0 ? 1 : -1;
        g.beginPath(); g.moveTo(a[0] + nx * h0 * up, a[1] + ny * h0 * up - 0.5); g.lineTo(b[0] + nx * h1 * up, b[1] + ny * h1 * up - 0.5); g.stroke();
      }
    }
  },
  // trunk base: root flare and a few surface roots
  roots(g, P, pl, bark, rng, white) {
    const w = pl.wT * 45, base = P(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const a = rng.f(0, 3.1416) + (k > 1 ? 0 : 0), l = pl.wT * rng.f(1.6, 2.6), e = P(Math.cos(a) * l, Math.sin(a) * l, 0);
      const s = P(Math.cos(a) * pl.wT * 0.3, Math.sin(a) * pl.wT * 0.3, 0.12);
      poly(g, [[s[0] - 2, s[1]], [e[0], e[1]], [s[0] + 2, s[1] + 2]], this.tone(bark, white ? 0.55 : 0.7));
    }
    const fl = w * 0.82, t = P(0, 0, Math.min(0.45, pl.wT * 2.2));
    poly(g, [[base[0] - fl, base[1] + 1], [t[0] - w * 0.48, t[1]], [t[0] + w * 0.48, t[1]], [base[0] + fl, base[1] + 1]], this.tone(white ? '#3a3632' : bark, 0.72));
    poly(g, [[base[0] - fl, base[1] + 1], [t[0] - w * 0.48, t[1]], [t[0] - w * 0.1, t[1]], [base[0] - fl * 0.2, base[1] + 2]], this.tone(white ? '#4a4640' : bark, 0.95));
  },
  // soft ground shadow toward the lower right; faded out above the base so it never lies over
  // things standing behind the tree (they are drawn before it)
  shadows: new Map(),
  shadow(g, bx, by, rx, a) {
    const R = Math.max(6, Math.round(rx / 2) * 2), A = Math.round(a * 20), key = R * 32 + A;
    let c = this.shadows.get(key);
    const ox = Math.ceil(R * 1.05) + 2, oy = 18;
    if (!c) {
      c = mkCanvas(ox + R * 1.3 + 4, oy + R * 0.62 + 4);
      const s = c.getContext('2d');
      s.save(); s.translate(ox + R * 0.25, oy + R * 0.1); s.scale(1, 0.46);
      const gr = s.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
      gr.addColorStop(0, 'rgba(8,12,6,' + A / 20 + ')'); gr.addColorStop(0.65, 'rgba(8,12,6,' + (A / 20 * 0.6) + ')'); gr.addColorStop(1, 'rgba(8,12,6,0)');
      s.fillStyle = gr; s.beginPath(); s.arc(0, 0, R, 0, 6.283); s.fill();
      s.restore();
      s.globalCompositeOperation = 'destination-out';
      const er = s.createLinearGradient(0, oy - 16, 0, oy - 3);
      er.addColorStop(0, 'rgba(0,0,0,1)'); er.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = er; s.fillRect(0, 0, c.width, oy - 3);
      this.shadows.set(key, c);
    }
    g.drawImage(c, bx - ox, by - oy);
  },
  // paint tree (kind, age, v) for season key st with its base (tile centre) at bx, by
  paint(g, bx, by, kind, age, v, st) {
    const pl = this.plan(kind, age, v), sp = pl.sp, snow = st.indexOf('S') >= 0, s0 = st[0] || 'g';
    const P = (u, vv, z) => [bx + (u - vv) * HTW, by + (u + vv) * HTH - z * ZU];
    const rng = new RNG(this.hash(age + 11, v + 3, TREE_KINDS.indexOf(kind) * 31 + 7));
    const hue = this.hash(v, age, 5) % 7;
    // which clusters carry leaves this season
    const items = [];
    let leafy = 0;
    for (const c of pl.clusters) { const col = this.leafCol(pl, c, st, hue); if (col) { items.push({ c, col, d: (c.u + c.v) * 0.612 + c.z * 0.5 }); leafy++; } }
    const full = pl.clusters.length ? leafy / pl.clusters.length : 0;
    const bare = !sp.ev && full < 0.5;
    // ground: shadow and autumn litter
    const rx = pl.C * 45 * (pl.cone ? 1.0 : 0.95);
    this.shadow(g, bx, by, rx, sp.ev ? 0.36 : 0.12 + 0.24 * full);
    if (!sp.ev && sp.au && (s0 === 's' || s0 === 'a' || (s0 === 'b' && !snow)) && pl.age > 0) {
      const lr = new RNG(v * 17 + age), au = sp.au;
      for (let k = 0; k < (s0 === 'b' ? 10 : 34); k++) {
        const a = lr.f(-0.5, 3.6), d = rx * Math.sqrt(lr.next()) * 0.9, px = bx + Math.cos(a) * d, py = by + Math.sin(a) * d * 0.5 + 2;
        if (py < by - 2) continue;
        g.fillStyle = this.tone(s0 === 'b' ? '#6e5a40' : au[(k + hue) % au.length], lr.f(0.6, 0.95)); g.fillRect(px, py, 2, 1.5);
      }
    }
    const bark = sp.bark, white = sp.white ? 'white' : '';
    // limbs and trunk as depth-sorted items among the clusters
    for (const s of pl.segs) {
      const d = ((s[0] + s[3]) / 2 + (s[1] + s[4]) / 2) * 0.612 + (s[2] + s[5]) / 2 * 0.5;
      items.push({ s, d: s[8] === 0 ? Math.min(d, 0.3) : d });
    }
    items.sort((a, b) => a.d - b.d);
    if (pl.segs.length && pl.age > 0) this.roots(g, P, pl, bark, rng, sp.white);
    const leaf = sp.leaf || 3, ck = sp.f === 'column' ? 'c' : sp.f === 'pine' ? 'p' : sp.ev ? 'n' : 'l';
    const crownTop = pl.zc + pl.cv;
    // fine twigs first when bare (a haze behind and among the limbs): the finest twigs paler (sky
    // shows through them), then the twigs
    if ((bare || sp.f === 'dead' || pl.pine) && pl.twigs.length) {
      const tw = sp.white ? '#5a4a48' : bark;
      if (pl.fine && pl.fine.length && !pl.pine) {
        g.strokeStyle = this.tone(Col.mix(tw, '#8a847c', 0.25), 0.85); g.lineWidth = 0.7; g.globalAlpha = sp.f === 'dead' ? 0.6 : 0.62;
        g.beginPath();
        for (const t of pl.fine) { const a = P(t[0], t[1], t[2]), b = P(t[3], t[4], t[5]); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
        g.stroke();
      }
      g.strokeStyle = this.tone(tw, sp.f === 'dead' ? 0.85 : 0.7); g.lineWidth = 0.8; g.globalAlpha = sp.f === 'dead' ? 0.9 : 0.75;
      g.beginPath();
      for (const t of pl.twigs) { const a = P(t[0], t[1], t[2]), b = P(t[3], t[4], t[5]); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
      g.stroke(); g.globalAlpha = 1;
    }
    for (const it of items) {
      if (it.s) {
        const s = it.s, a = P(s[0], s[1], s[2]), b = P(s[3], s[4], s[5]);
        // in leaf the outer branches stop inside the foliage instead of poking out of the crown
        if (s[8] === 2 && !bare && !sp.ev) { b[0] = U.lerp(a[0], b[0], 0.72); b[1] = U.lerp(a[1], b[1], 0.72); }
        const lit = s[8] === 0 ? 1 : 0.9 - Math.max(0, (crownTop - s[5]) / (crownTop + 0.1)) * 0.2;
        this.limb(g, a, b, s[6] * 45, s[7] * 45, s[8] && sp.white ? '#5c5048' : bark, lit * (bare ? 1 : 0.92), snow && (bare || sp.f === 'dead'), s[8] === 0 || s[6] > 0.09 ? white : '');
        continue;
      }
      const c = it.c, p = P(c.u, c.v, c.z), r = c.r * 45 * (bare && !sp.ev ? 0.62 : 1);
      let tn = 0.56 + 0.66 * this.light(c.n);
      // inner shadow: low and inner clusters darker
      const low = pl.cone ? 0.15 * (1 - c.z / pl.H) : U.clamp((pl.zc - c.z) / pl.cv, 0, 1) * 0.22;
      tn *= 1 - low - (1 - c.o) * 0.18;
      const cr = new RNG(c.s);
      const sn = snow && c.n[2] > -0.15;
      let col = it.col;
      if (s0 === 'p' && sp.bloom && col === sp.bloom) tn = 0.82 + tn * 0.25;
      this.cluster(g, p[0], p[1], r, col, tn, cr, leaf * (s0 === 'p' && !sp.bloom ? 0.8 : 1), ck, sn);
      // fruit / blossom specks
      if (sp.fruit && (st[0] === 'f' || s0 === 'y') && c.q < 0.6) for (let k = 0; k < 3; k++) { g.fillStyle = this.tone(sp.fruit, tn * 1.05); g.fillRect(p[0] + cr.f(-r, r) * 0.6, p[1] + cr.f(-r, r) * 0.5, 2, 2); }
      // maple: a haze of small red flowers among the young leaves
      if (sp.flow && s0 === 'p' && c.q < 0.55) { g.fillStyle = this.tone(sp.flow, tn * 1.05); for (let k = 0; k < 5; k++) g.fillRect(p[0] + cr.f(-r, r) * 0.7, p[1] + cr.f(-r, r * 0.6) * 0.7, 1.5, 1.5); }
      if (sp.ev && s0 === 'p' && c.tip !== false && c.q < 0.7) { g.fillStyle = this.tone(sp.sp, tn * 1.15); for (let k = 0; k < 4; k++) g.fillRect(p[0] + cr.f(-r, r) * 0.8, p[1] + cr.f(-r * 0.6, r * 0.3), 1.5, 1.5); }
    }
    return pl;
  },
  // bounds of a plan on screen relative to the base, for the sprite canvas: every cluster (with its
  // leaves, needles and snow), limb and twig, the ground shadow and the leaf litter
  bounds(pl) {
    if (pl.bd) return pl.bd;
    let l = 1e9, r = -1e9, t = 1e9, b = -1e9;
    const ext = (u, v, z, e) => { const X = (u - v) * HTW, Y = (u + v) * HTH - z * ZU; if (X - e < l) l = X - e; if (X + e > r) r = X + e; if (Y - e < t) t = Y - e; if (Y + e > b) b = Y + e; };
    for (const c of pl.clusters) ext(c.u, c.v, c.z, c.r * 45 * 1.45 + 6);
    for (const s of pl.segs) { ext(s[0], s[1], s[2], s[6] * 23 + 3); ext(s[3], s[4], s[5], s[7] * 23 + 3); }
    for (const s of pl.twigs) { ext(s[0], s[1], s[2], 2); ext(s[3], s[4], s[5], 2); }
    if (pl.fine) for (const s of pl.fine) ext(s[3], s[4], s[5], 2);
    const R = Math.max(6, Math.round(pl.C * 45 * (pl.cone ? 1.0 : 0.95) / 2) * 2);
    l = Math.min(l, -R * 1.05 - 4); r = Math.max(r, R * 1.3 + 6); t = Math.min(t, -20); b = Math.max(b, R * 0.62 + 6);
    return (pl.bd = { l: Math.floor(l), r: Math.ceil(r), t: Math.floor(t), b: Math.ceil(b) });
  },

  // ------------------------------------------------------------------ sprite cache
  // res: 'h' half size, 'x' double resolution, '' plain
  key(o, res) { return 'T' + o.kind + this.age(o) + ((o.v || 0) % this.NV) + '|' + this.skey(o.kind) + (res || ''); },
  sprite(o, res) {
    if (o.stump) return this.stumpSprite(o);
    if (!TREE_SP[o.kind]) o.kind = 'oak';
    const key = this.key(o, res);
    let rec = this.cache.get(key);
    if (!rec) {
      if (res === 'x') {
        // over this frame's paint budget: the plain sprite (upscaled) until there is time to paint this one;
        // the same when the trees in view already fill the close-up allowance (the densest woods)
        if (this.spent > this.BUDGET || this.px > this.HICAP) return this.sprite(o, '');
        const t0 = performance.now();
        rec = this.build(o.kind, this.age(o), (o.v || 0) % this.NV, this.skey(o.kind), 2);
        this.spent += performance.now() - t0;
      } else if (res) {
        // halve the real sprite, never a sibling borrowed while over budget (that one is drawn full size)
        const f = this.sprite(o, '');
        if (f.k !== this.key(o, '')) return f;
        rec = this.halve(f);
      } else {
        // over this frame's paint budget: borrow a finished sibling for now
        const lk = o.kind + this.age(o) + '|' + this.skey(o.kind), fb = this.last.get(lk);
        if (this.spent > this.BUDGET && fb && this.cache.has(fb)) { rec = this.cache.get(fb); rec.u = this.tick; return rec; }
        const t0 = performance.now();
        rec = this.build(o.kind, this.age(o), (o.v || 0) % this.NV, this.skey(o.kind));
        rec.k = key;
        this.spent += performance.now() - t0;
        this.last.set(lk, key);
      }
      // in use from now (u), so the eviction it may set off never takes it straight back out
      rec.px = rec.c.width * rec.c.height; rec.u = this.tick;
      this.cache.set(key, rec); this.px += rec.px;
      if (this.px > this.PXCAP) this.evict();
    }
    rec.u = this.tick;
    return rec;
  },
  // S: pixels per world px (2 = the close-up sprite, drawn at sc 1/2)
  build(kind, age, v, st, S) {
    const pl = this.plan(kind, age, v), bd = this.bounds(pl);
    const w = Math.ceil(bd.r - bd.l), h = Math.ceil(bd.b - bd.t), bx = Math.round(-bd.l), by = Math.round(-bd.t);
    const k = S || 1, c = mkCanvas(w * k, h * k), g = c.getContext('2d');
    if (k !== 1) g.scale(k, k);
    this.paint(g, bx, by, kind, age, v, st);
    // crown ellipse relative to the base, for the see-through test
    const ry = (pl.cone ? pl.H * 0.5 : pl.cv) * ZU + 10;
    return { c, ax: bx * k, ay: (by - HTH) * k, sc: 1 / k, sil: null, u: 0, m: { cx: (pl.lu - pl.lv) * HTW, cy: -(pl.zc * ZU), rx: pl.C * 45 + 12, ry: ry, tw: pl.wT * 45 / 2 + 3, th: -(pl.zc * ZU) } };
  },
  halve(r) {
    const w = Math.ceil(r.c.width / 2), h = Math.ceil(r.c.height / 2), c = mkCanvas(w, h), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(r.c, 0, 0, w, h);
    return { c, ax: r.ax / 2, ay: r.ay / 2, sc: 2, sil: null, u: 0, m: r.m };
  },
  evict() {
    const old = this.tick - 2;
    const arr = [];
    for (const [k, r] of this.cache) if (r.u < old) arr.push([k, r]);
    arr.sort((a, b) => a[1].u - b[1].u);
    for (const [k, r] of arr) { if (this.px <= this.PXCAP * 0.75) break; this.cache.delete(k); this.px -= r.px + (r.sil ? r.spx : 0); }
  },
  // drop every tree sprite (season change is handled by the keys; this is for tests and settings)
  flush() { this.cache.clear(); this.px = 0; this.last.clear(); },
  stats() { let n = 0, sil = 0; for (const r of this.cache.values()) { n++; if (r.sil) sil++; } return { sprites: n, sil, plans: this.plans.size, MB: +(this.px * 4 / 1048576).toFixed(1) }; },
  // burnt / cut stump of a tree object
  stumpSprite(o) {
    const k = 'oTstump|' + (o.burnt ? 'x' : '') + ((o.v || 0) % 3) + (Season.snow > 0.3 ? 'S' : '');
    return Spr.get(k, 90, 80, 45, 46, (g, ax, ay) => { const sv = ObjArt.g, sx = ObjArt.ax, sy = ObjArt.ay; ObjArt.g = g; ObjArt.ax = ax; ObjArt.ay = ay; ObjArt.stumpArt((o.v || 0) % 3, o.burnt); ObjArt.g = sv; ObjArt.ax = sx; ObjArt.ay = sy; });
  },

  // ------------------------------------------------------------------ per-frame drawing
  frame() {
    const now = performance.now();
    this.dt = Math.min(0.1, (now - this.t0) / 1000); this.t0 = now;
    this.tick = typeof Facade !== 'undefined' ? Facade.tick : this.tick + 1; this.spent = 0;
    this.holeN = this.holeC; this.holeC = 0; this.curN = this.curC; this.curC = 0;
    // fades of trees that went off screen mid-fade
    if ((this.tick & 255) === 0 && this.fade.size > 32) for (const [i, e] of this.fade) if (e[2] < this.tick - 30) this.fade.delete(i);
    const w = G.weather || {};
    const tw = U.clamp(0.25 + (w.rain || 0) * 0.55 + (w.storm ? 0.7 : 0), 0, 1.3);
    this.wind += (tw - this.wind) * Math.min(1, this.dt * 0.5);
    const z = Render.cam.zoom;
    this.mx = Input.overUI ? -1e9 : (Input.mx - Render.ox) / z; this.my = (Input.my - Render.oy) / z;
    // sway is a sheared draw, far dearer than a plain one on a software canvas: only where it shows
    this.swayOn = Settings.v.detail !== 0 && z >= 0.8; this.z = z;
    this.res = z < 0.72 ? 'h' : z >= 1.55 && z * Render.dpr >= 1.6 && Settings.v.detail !== 0 ? 'x' : '';
    // sprites left over from other views go before the close-up allowance is judged
    if (this.res === 'x' && this.px > this.HICAP) this.evict();
  },
  // horizontal shear of the sprite about its base: k * height px
  sway(x, y, t) {
    const ph = (x * 12.9898 + y * 78.233) % 6.283, w = this.wind;
    return (0.0025 + 0.011 * w) * (Math.sin(t * (1.1 + w * 0.6) + ph) * 0.75 + Math.sin(t * 2.7 + ph * 2.3) * 0.25) * (0.65 + 0.35 * Math.sin(t * 0.23 + x * 0.09 + y * 0.05));
  },
  // does a screen point (world px) fall in the crown / trunk of a tree sprite with base bx, by
  covers(m, bx, by, px, py) {
    const dx = (px - bx - m.cx) / m.rx, dy = (py - by - m.cy) / m.ry;
    if (dx * dx + dy * dy < 1) return true;
    return Math.abs(px - bx) < m.tw && py < by && py > by + m.th;
  },
  // see-through, PZ style: every tree standing in front of the player gets a soft window erased around
  // the player, and every tree whose crown covers the cursor a smaller one around the cursor. Both ease
  // in and out per tree (fade: tile -> [player, cursor]). In a forest a dozen trees stack over the
  // spot, and a dozen half-transparent layers add up to an opaque one, so each tree erases the N-th root
  // of the wanted see-through (N = trees over that spot last frame): the middle stays clear however
  // dense the wood is.
  HOLE: 84, CHOLE: 58, holeN: 1, holeC: 0, curN: 1, curC: 0,
  draw(o, x, y, X, Y, p, t, vx) {
    if (this.tick !== Facade.tick) this.frame();
    const ctx = Render.ctx, isT = o.t === 'tree';
    if (isT && (o.v === undefined || !TREE_SP[o.kind])) this.fix(o, x, y);
    const rec = isT ? this.sprite(o, this.res) : Spr.obj(o);
    const s = Render.shadeAt(x, y);
    const by = Y + HTH, sc = rec.sc || 1;
    const dx = X - rec.ax * sc, dy = Y - rec.ay * sc, dw = rec.c.width * sc, dh = rec.c.height * sc;
    let fh = 0, fc = 0;
    const hx = Render.PX, hy = Render.PY - 34, R = this.HOLE;
    if (!o.stump) {
      let hole = false;
      if (p && (vx === undefined ? x : vx) + y + 1.2 > (p.x >= LV.W0 ? p.x - LV.W0 : p.x) + p.y) hole = hx + R > dx && hx - R < dx + dw && hy + R > dy && hy - R < dy + dh;
      if (hole && hx > dx && hx < dx + dw && hy > dy && hy < dy + dh) this.holeC++;
      const cur = this.covers(rec.m || this.estM(rec), X, by, this.mx, this.my);
      if (cur) this.curC++;
      const i = y * Wd.w + x, st = this.fade.get(i);
      if (hole || cur || st) {
        const e = st || [0, 0, 0], up = this.dt * 4, dn = this.dt * 2.5;
        e[2] = this.tick;
        e[0] = hole ? Math.min(1, e[0] + up) : Math.max(0, e[0] - dn);
        e[1] = cur ? Math.min(1, e[1] + up) : Math.max(0, e[1] - dn);
        if (e[0] + e[1] <= 0) this.fade.delete(i); else if (!st) this.fade.set(i, e);
        fh = e[0]; fc = e[1];
      }
    }
    let k = this.swayOn && !o.stump ? this.sway(x, y, t) : 0;
    if (k && Math.abs(k) * dh * this.z < 0.4) k = 0;
    if (fh > 0.01 || fc > 0.01) {
      // hole centres in sprite pixels (undo the sway shear and the sprite's scale)
      const S = this.holed(rec, s, sc, fh > 0.01 ? fh : 0, (hx - k * (hy - by) - dx) / sc, (hy - dy) / sc, R / sc,
        fc > 0.01 ? fc : 0, (this.mx - k * (this.my - by) - dx) / sc, (this.my - dy) / sc, this.CHOLE / sc);
      if (k) ctx.transform(1, 0, k, 1, -k * by, 0);
      ctx.drawImage(S, 0, 0, rec.c.width, rec.c.height, dx, dy, dw, dh);
      if (k) ctx.transform(1, 0, -k, 1, k * by, 0);
      return;
    }
    if (k) ctx.transform(1, 0, k, 1, -k * by, 0);
    this.lit(ctx, rec, dx, dy, dw, dh, s, 1);
    if (k) ctx.transform(1, 0, -k, 1, k * by, 0);
  },
  // the lit sprite composed in a scratch canvas with soft windows erased: around the player (f1 at
  // x1, y1, radius r1) and around the cursor (f2 ...), all in sprite pixels
  holed(rec, s, sc, f1, x1, y1, r1, f2, x2, y2, r2) {
    const w = rec.c.width, h = rec.c.height;
    let S = this.scr;
    if (!S || S.width < w || S.height < h) { S = this.scr = mkCanvas(Math.max(w, S ? S.width : 0, 320), Math.max(h, S ? S.height : 0, 400)); this.sg = S.getContext('2d'); }
    const g = this.sg, dk = 1 - s;
    g.clearRect(0, 0, w + 1, h + 1);
    if (dk > 0.02) { this.silOf(rec); g.drawImage(rec.sil, 0, 0, w, h); if (dk < 0.97) { g.globalAlpha = 1 - dk; g.drawImage(rec.c, 0, 0); g.globalAlpha = 1; } }
    else g.drawImage(rec.c, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    if (f1) { g.fillStyle = this.holeGrad(g, Math.min(12, Math.max(1, this.holeN)), Math.round(f1 * 8)); g.setTransform(r1 / 100, 0, 0, r1 * 1.1 / 100, x1, y1); g.fillRect(-100, -100, 200, 200); }
    if (f2) { g.fillStyle = this.holeGrad(g, Math.min(12, Math.max(1, this.curN)), Math.round(f2 * 8)); g.setTransform(r2 / 100, 0, 0, r2 / 100, x2, y2); g.fillRect(-100, -100, 200, 200); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    return S;
  },
  // radial erase gradient (radius 100, scaled to the hole): see-through T(r) = clear core, soft rim,
  // eased in by fh; each of the n stacked trees erases T^(1/n)
  grads: new Map(),
  holeGrad(g, n, f8) {
    const key = n * 16 + f8;
    let gr = this.grads.get(key);
    if (gr) return gr;
    gr = g.createRadialGradient(0, 0, 0, 0, 0, 100);
    const f = f8 / 8;
    for (const [r, T] of [[0, 0.9], [0.55, 0.9], [0.7, 0.7], [0.84, 0.35], [0.94, 0.1], [1, 0]]) gr.addColorStop(r, 'rgba(0,0,0,' + Math.pow(T * f, 1 / n).toFixed(3) + ')');
    this.grads.set(key, gr);
    return gr;
  },
  // crown estimate for sprites painted elsewhere (street trees)
  estM(rec) {
    if (rec.m) return rec.m;
    const top = -(rec.ay + HTH);
    rec.m = { cx: rec.c.width / 2 - rec.ax, cy: top * 0.62, rx: rec.c.width * 0.42, ry: -top * 0.36, tw: 6, th: top * 0.3 };
    return rec.m;
  },
  // night shading without bright fringes: the dark silhouette goes under the sprite, which is then
  // laid over it at the light level (a faded tree uses the plain order to avoid double darkening)
  lit(ctx, rec, x, y, w, h, s, a) {
    const dk = 1 - s;
    if (dk <= 0.02) { if (a < 1) ctx.globalAlpha = a; ctx.drawImage(rec.c, x, y, w, h); ctx.globalAlpha = 1; return; }
    this.silOf(rec);
    if (a >= 0.99) {
      ctx.drawImage(rec.sil, x, y, w, h);
      if (dk < 0.97) { ctx.globalAlpha = 1 - dk; ctx.drawImage(rec.c, x, y, w, h); }
    } else {
      ctx.globalAlpha = a; ctx.drawImage(rec.c, x, y, w, h);
      ctx.globalAlpha = a * Math.min(1, dk); ctx.drawImage(rec.sil, x, y, w, h);
    }
    ctx.globalAlpha = 1;
  },
  // dark silhouette of a sprite (made on first use at night, counted in the cache budget); a close-up
  // sprite's is half size: it is a flat dark shape lying under the sprite, nothing in it to blur
  silOf(rec) {
    if (rec.sil) return rec.sil;
    const k = rec.sc < 1 ? 2 : 1, c = mkCanvas(rec.c.width / k, rec.c.height / k), g = c.getContext('2d');
    g.drawImage(rec.c, 0, 0, c.width, c.height); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgb(3,5,14)'; g.fillRect(0, 0, c.width, c.height);
    rec.sil = c; rec.spx = c.width * c.height;
    if (rec.px) this.px += rec.spx;
    return c;
  },
};

// ---------------------------------------------------------------- shrubs, stumps, logs (ObjArt)
// bush v % 5: 0 round shrub, 1 low spreading shrub, 2 evergreen (odd v: holly), 3 lilac, 4 fern clump
const BUSH_AU = [['#b8402a', '#d07028'], ['#d0a030', '#b88a2a'], ['#a03a3a', '#c0602a']];
Object.assign(ObjArt, {
  // street trees (street.js) paint a young tree into their own sprite
  d_tree(o) {
    const v = o.v !== undefined ? o.v % Trees.NV : Math.round((o.sz || 1) * 100) % Trees.NV;
    Trees.paint(this.g, this.ax, this.ay + HTH, TREE_SP[o.kind] ? o.kind : 'maple', Trees.age(o), v, Trees.skey(o.kind));
  },
  k_bush: (o) => Season.tree + (Season.snow > 0.3 ? 'S' : '') + (o.berries ? 'b' : ''),
  d_bush(o) {
    const g = this.g, v = (o.v || 0) % 5, st = Season.tree, snow = Season.snow > 0.3;
    const bx = this.ax, by = this.ay + HTH, P = (u, w, z) => [bx + (u - w) * HTW, by + (u + w) * HTH - z * ZU];
    const rng = new RNG((o.v || 0) * 37 + 11), hue = BUSH_AU[(o.v || 0) % 3];
    const R = [0.5, 0.62, 0.42, 0.5, 0.48][v], Hh = [0.85, 0.5, 0.9, 1.05, 0.55][v];
    Trees.shadow(g, bx, by, R * 52, 0.22);
    const ev = v === 2, fern = v === 4, bare = !ev && (st === 'b' || (fern && st === 's'));
    if (fern) {
      // fronds arching out from the crown, brown in late autumn, flattened in winter
      const col = st === 'b' ? '#7a6448' : st === 's' || st === 'a' ? '#9a6a34' : st === 'y' ? '#a8a040' : st === 'p' ? '#7aa448' : '#4e7a34';
      const n = st === 'b' ? 5 : 11;
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.283 + rng.f(-0.3, 0.3), l = R * rng.f(0.7, 1.05), up = st === 'b' ? 0.05 : rng.f(0.25, 0.5);
        const p0 = P(0, 0, 0.08), p1 = P(Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.5, up + 0.2), p2 = P(Math.cos(a) * l, Math.sin(a) * l, up * 0.4);
        const tn = 0.75 + 0.3 * (-Math.cos(a) * 0.7 - Math.sin(a) * 0.3) + (Math.sin(a) + Math.cos(a) > 0 ? 0.08 : -0.06);
        g.strokeStyle = Trees.tone(col, tn * 0.8); g.lineWidth = 1;
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); g.stroke();
        g.fillStyle = Trees.tone(col, tn);
        for (let j = 1; j < 9; j++) {
          const t = j / 9, q = 1 - t, x = q * q * p0[0] + 2 * q * t * p1[0] + t * t * p2[0], y = q * q * p0[1] + 2 * q * t * p1[1] + t * t * p2[1], s = (1 - t) * 3 + 1;
          g.beginPath(); g.ellipse(x, y, s, s * 0.45, a * 0.5, 0, 6.283); g.fill();
        }
      }
      if (snow) { g.fillStyle = TREE_SNOW; g.beginPath(); g.ellipse(bx, by - 4, 12, 4, 0, 0, 6.283); g.fill(); }
      return;
    }
    // stems (seen when bare or thin)
    const stems = [];
    for (let k = 0; k < 7; k++) { const a = rng.f(0, 6.283), l = R * rng.f(0.5, 0.95); stems.push([Math.cos(a) * l, Math.sin(a) * l, Hh * rng.f(0.6, 1.05)]); }
    if (bare || st === 's') {
      g.strokeStyle = Trees.tone('#5e4a38', 0.75); g.lineWidth = 1;
      g.beginPath();
      for (const s of stems) { const a = P(0, 0, 0.02), b = P(s[0], s[1], s[2]); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); for (let j = 0; j < 2; j++) { const t = rng.f(0.4, 0.8), m = [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t)]; g.moveTo(m[0], m[1]); g.lineTo(m[0] + rng.f(-6, 6), m[1] - rng.f(3, 7)); } }
      g.stroke();
      if (snow) { g.fillStyle = TREE_SNOW; for (const s of stems) { const b = P(s[0], s[1], s[2]); g.fillRect(b[0] - 2, b[1] - 1, 4, 1.5); } }
    }
    if (!bare) {
      const cl = [];
      for (let k = 0; k < (v === 1 ? 9 : 8); k++) {
        let du = rng.f(-1, 1), dv = rng.f(-1, 1), dz = rng.f(0, 1);
        const l = Math.hypot(du, dv, dz) || 1; du /= l; dv /= l; dz /= l;
        const q = rng.next(), s = rng.int(1, 1e6);
        if (st === 's' && !ev && q < 0.6) continue;
        cl.push({ u: du * R * 0.75, v: dv * R * 0.75, z: Hh * 0.5 + dz * Hh * 0.45, n: [du, dv, dz + 0.3], q, s });
      }
      cl.sort((a, b) => (a.u + a.v) * 0.612 + a.z * 0.5 - ((b.u + b.v) * 0.612 + b.z * 0.5));
      for (const c of cl) {
        const p = P(c.u, c.v, c.z), nl = Math.hypot(c.n[0], c.n[1], c.n[2]);
        const tn = (0.45 + 0.75 * Trees.light([c.n[0] / nl, c.n[1] / nl, c.n[2] / nl])) * (0.82 + 0.18 * c.z / Hh);
        const col = ev ? ((o.v || 0) % 2 ? '#2e4a2a' : '#3a5a2c') : st === 'p' ? '#86ae4e' : st === 'y' ? (c.q < 0.5 ? hue[0] : '#5a7a32') : st === 'a' ? (c.q < 0.5 ? hue[0] : hue[1]) : st === 's' ? '#8a6a3a' : v === 3 ? '#4a6e34' : '#466e2e';
        Trees.cluster(this.g, p[0], p[1], (v === 1 ? 10 : 11) * (0.85 + c.q * 0.3), col, tn, new RNG(c.s), ev ? 2.4 : 2.8, 'l', snow && c.n[2] > 0.1);
        if (v === 3 && st === 'p' && c.q < 0.7) { const cr = new RNG(c.s + 1); for (let j = 0; j < 3; j++) { g.fillStyle = Trees.tone(c.q < 0.35 ? '#a070c8' : '#c8a0e0', tn); g.beginPath(); g.ellipse(p[0] + cr.f(-7, 7), p[1] + cr.f(-8, 2), 2, 3.2, 0, 0, 6.283); g.fill(); } }
      }
    }
    // berries: blackberries on berry bushes, red holly berries on the evergreen in the cold months
    if (o.berries || (ev && (o.v || 0) % 2 && (st === 'b' || st === 's' || st === 'a'))) {
      const br = new RNG((o.v || 0) * 5 + 2), c = P(0, 0, Hh * 0.6);
      for (let k = 0; k < 12; k++) { const x = c[0] + br.f(-R, R) * 30, y = c[1] + br.f(-0.8, 0.6) * Hh * 22; g.fillStyle = ev ? '#c41e24' : br.chance(0.3) ? '#a8203a' : '#2a1030'; g.fillRect(x, y, 2, 2); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y, 1, 1); }
    }
  },
  // stump: v 0/1 sawn flat with rings, 2 snapped off; burnt = charred
  stumpArt(v, burnt) {
    const g = this.g, c = this.P(0.5, 0.5, 0), rng = new RNG(v * 7 + 3), snow = Season.snow > 0.3;
    const r = 0.2 + v * 0.03, h = v === 2 ? 0.5 : 0.3 + v * 0.06, rx = r * 45.25, ry = r * 22.6, top = c[1] - h * ZU;
    const bark = burnt ? '#2a2420' : '#5a4636';
    Trees.shadow(g, c[0], c[1], rx * 2.2, 0.25);
    for (let k = 0; k < 4; k++) { const a = rng.f(-0.4, 3.5), l = r * rng.f(1.6, 2.3), e = this.P(0.5 + Math.cos(a) * l, 0.5 + Math.sin(a) * l, 0); poly(g, [[c[0] - 3, c[1] - 2], [e[0], e[1]], [c[0] + 3, c[1] + 1]], Trees.tone(bark, 0.7)); }
    g.fillStyle = Trees.tone(bark, 0.72);
    g.beginPath(); g.moveTo(c[0] - rx, top); g.lineTo(c[0] - rx * 1.12, c[1]); g.ellipse(c[0], c[1], rx * 1.12, ry * 1.12, 0, Math.PI, 0, true); g.lineTo(c[0] + rx, top); g.closePath(); g.fill();
    g.fillStyle = Trees.tone(bark, 1.0);
    g.beginPath(); g.moveTo(c[0] - rx, top); g.lineTo(c[0] - rx * 1.12, c[1]); g.ellipse(c[0], c[1], rx * 1.12, ry * 1.12, 0, Math.PI, Math.PI * 0.62, true); g.lineTo(c[0] - rx * 0.35, top + ry); g.closePath(); g.fill();
    g.strokeStyle = Trees.tone(bark, 0.5); g.lineWidth = 1;
    for (let k = 0; k < 5; k++) { const x = c[0] - rx + (k + 0.5) / 5 * rx * 2; g.beginPath(); g.moveTo(x, top + ry * 0.8); g.lineTo(x + rng.f(-1.5, 1.5), c[1] + ry * 0.6); g.stroke(); }
    if (!burnt) { g.fillStyle = 'rgba(96,130,58,0.75)'; g.beginPath(); g.ellipse(c[0] - rx * 0.7, c[1] - h * ZU * 0.35, rx * 0.35, h * ZU * 0.3, 0, 0, 6.283); g.fill(); }
    if (v === 2) {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const a = Math.PI + k / 10 * Math.PI; pts.push([c[0] + Math.cos(a) * rx, top + Math.sin(a) * ry - (k % 2 ? rng.f(4, 12) : rng.f(0, 3))]); }
      for (let k = 1; k < 10; k++) { const a = k / 10 * Math.PI; pts.push([c[0] + Math.cos(a) * rx, top + Math.sin(a) * ry]); }
      poly(g, pts, Trees.tone(burnt ? '#1e1a18' : '#8a6a48', 0.85));
    } else {
      g.fillStyle = burnt ? '#1c1816' : '#c8a274'; g.beginPath(); g.ellipse(c[0], top, rx, ry, 0, 0, 6.283); g.fill();
      g.strokeStyle = burnt ? '#38302a' : 'rgba(120,84,48,0.6)';
      for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(c[0] + 1, top, rx * k / 4.2, ry * k / 4.2, 0, 0, 6.283); g.stroke(); }
      g.strokeStyle = Trees.tone(bark, 0.8); g.lineWidth = 1.5; g.beginPath(); g.ellipse(c[0], top, rx, ry, 0, 0, 6.283); g.stroke();
    }
    if (snow) { g.fillStyle = TREE_SNOW; g.beginPath(); g.ellipse(c[0], top - 1, rx * 0.95, ry * 0.9, 0, 0, 6.283); g.fill(); }
  },
  k_tstump: () => (Season.snow > 0.3 ? 'S' : ''),
  d_tstump(o) { this.stumpArt((o.v || 0) % 3, false); },
  // fallen log along u (dir E/W) or v (dir N/S); the end facing the camera is sawn or broken
  k_tlog: (o) => (Season.snow > 0.3 ? 'S' : '') + (Season.tree === 'y' || Season.tree === 'a' ? 'm' : '') + (o.n > 1 ? o.n : ''),
  d_tlog(o) {
    if (o.n > 1) return this.fallen(o);
    const g = this.g, alongU = o.dir === 'E' || o.dir === 'W', v = (o.v || 0) % 3, rng = new RNG(v * 13 + 7 + (alongU ? 1 : 0));
    const r = 0.16 + v * 0.03, snow = Season.snow > 0.3;
    const A = alongU ? this.P(-0.12, 0.5, r) : this.P(0.5, -0.12, r), B = alongU ? this.P(1.06, 0.5, r) : this.P(0.5, 1.06, r);
    const ax = B[0] - A[0], ay = B[1] - A[1], al = Math.hypot(ax, ay), dx = ax / al, dy = ay / al;
    let nx = -dy, ny = dx; if (ny > 0) { nx = -nx; ny = -ny; }   // n points up on screen
    const hw = r * 40.5, bark = v === 2 ? '#4e4840' : '#5c4a3a';
    const g0 = alongU ? this.P(-0.1, 0.62, 0) : this.P(0.62, -0.1, 0), g1 = alongU ? this.P(1.1, 0.62, 0) : this.P(0.62, 1.1, 0);
    g.lineCap = 'round'; g.strokeStyle = 'rgba(8,12,6,0.25)'; g.lineWidth = hw * 1.3; g.beginPath(); g.moveTo(g0[0], g0[1]); g.lineTo(g1[0], g1[1]); g.stroke(); g.lineCap = 'butt';
    const band = (t0, t1, col) => poly(g, [[A[0] + nx * hw * t0, A[1] + ny * hw * t0], [B[0] + nx * hw * t0, B[1] + ny * hw * t0], [B[0] + nx * hw * t1, B[1] + ny * hw * t1], [A[0] + nx * hw * t1, A[1] + ny * hw * t1]], col);
    // far end rounded, body in light bands: sunlit top, dark underside
    g.fillStyle = Trees.tone(bark, 0.62); g.beginPath(); g.arc(A[0], A[1], hw, 0, 6.283); g.fill();
    band(-1, 1, Trees.tone(bark, 0.62)); band(1, 0.25, Trees.tone(bark, 0.95)); band(0.95, 0.6, Trees.tone(bark, 1.1)); band(-0.45, -1, Trees.tone(bark, 0.5));
    g.strokeStyle = Trees.tone(bark, 0.45); g.lineWidth = 1;
    for (let k = 0; k < 6; k++) { const o2 = rng.f(-0.8, 0.8), t0 = rng.f(0, 0.4), t1 = t0 + rng.f(0.25, 0.55); g.beginPath(); g.moveTo(A[0] + ax * t0 + nx * hw * o2, A[1] + ay * t0 + ny * hw * o2); g.lineTo(A[0] + ax * t1 + nx * hw * o2, A[1] + ay * t1 + ny * hw * o2); g.stroke(); }
    g.fillStyle = 'rgba(92,128,54,0.8)';
    for (let k = 0; k < 3; k++) { const t = rng.f(0.1, 0.8); g.beginPath(); g.ellipse(A[0] + ax * t + nx * hw * 0.55, A[1] + ay * t + ny * hw * 0.55, rng.f(3, 7), 2, Math.atan2(dy, dx), 0, 6.283); g.fill(); }
    const st = rng.f(0.3, 0.6), sp = [A[0] + ax * st + nx * hw * 0.7, A[1] + ay * st + ny * hw * 0.7];
    g.strokeStyle = Trees.tone(bark, 0.9); g.lineWidth = 3; g.beginPath(); g.moveTo(sp[0], sp[1]); g.lineTo(sp[0] + rng.f(-4, 4), sp[1] - rng.f(7, 11)); g.stroke();
    if (snow) { band(1, 0.35, Trees.tone(TREE_SNOW, 0.98)); band(0.9, 0.6, TREE_SNOW); }
    // the near end: cross-section ellipse, sawn with rings or broken and rotten
    const vx = alongU ? [-HTW, HTH] : [HTW, HTH], E = [];
    for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283; E.push([B[0] + Math.cos(a) * vx[0] * r, B[1] + (Math.cos(a) * vx[1] - Math.sin(a) * ZU) * r]); }
    poly(g, E, v === 2 ? '#3a3028' : '#c09868', Trees.tone(bark, 0.7), 1.5);
    if (v !== 2) for (const f of [0.66, 0.36]) poly(g, E.map(p => [B[0] + (p[0] - B[0]) * f, B[1] + (p[1] - B[1]) * f]), null, 'rgba(110,76,44,0.55)', 1);
    else poly(g, E.map((p, k) => [B[0] + (p[0] - B[0]) * (k % 2 ? 0.55 : 0.8), B[1] + (p[1] - B[1]) * (k % 2 ? 0.55 : 0.8)]), '#4a3c30');
    // mushrooms in autumn
    if (!snow && (Season.tree === 'y' || Season.tree === 'a')) for (let k = 0; k < 3; k++) { const t = rng.f(0.2, 0.7), p = [A[0] + ax * t - nx * hw * 0.2, A[1] + ay * t - ny * hw * 0.2]; g.fillStyle = '#e8dcc0'; g.fillRect(p[0], p[1] - 2, 1, 3); g.fillStyle = '#b8783a'; g.beginPath(); g.ellipse(p[0] + 0.5, p[1] - 2, 3, 1.6, 0, Math.PI, 0); g.fill(); }
  },
  // a whole windthrown tree over n tiles along u (dir E) or v (dir S), one object per tile, each painting its
  // own stretch so the painter's order stays right: part 0 (back) holds the root plate torn up out of its
  // pit, the trunk tapers toward the front and ends in the broken, bare crown lying over the last part.
  // v % 3: 0 oak-like, 1 pine, 2 birch
  fallen(o) {
    const g = this.g, alongU = o.dir === 'E' || o.dir === 'W', n = o.n, k = o.part || 0, v = (o.v || 0) % 3;
    const st = Season.tree, snow = Season.snow > 0.3, birch = v === 2;
    // S along the whole tree from its back end, t across (+ = +v or +u), z up -> sprite px of this part
    const W = (S, t, z) => alongU ? this.P(S - k, 0.5 + t, z) : this.P(0.5 + t, S - k, z);
    const S0 = 0.34, S1 = n - 0.15, rA = [0.25, 0.22, 0.17][v], rB = 0.06;
    const rad = (S) => U.lerp(rA, rB, U.clamp((S - S0) / (S1 - S0), 0, 1));
    const lift = (S) => { const q = Math.max(0, 1 - (S - S0) / 1.5); return q * q * 0.32; };   // butt held up by the plate
    const zc = (S) => rad(S) + lift(S);
    const bark = ['#5c4a3a', '#6a4a38', '#dcd8cc'][v], rng = new RNG(v * 31 + n * 7 + (alongU ? 3 : 0) + k * 101);
    // screen axis and the screen normal pointing up
    const a0 = W(0, 0, 0), a1 = W(1, 0, 0), al = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), dx = (a1[0] - a0[0]) / al, dy = (a1[1] - a0[1]) / al;
    let nx = -dy, ny = dx; if (ny > 0) { nx = -nx; ny = -ny; }
    const Sa = Math.max(S0, k), Sb = Math.min(S1, k + 1);
    // ground shadow under this stretch, then the pit behind the root plate
    if (Sb > Sa) {
      const p0 = W(Sa, 0.14, 0), p1 = W(Sb, 0.14, 0);
      g.lineCap = Sb >= S1 || Sa <= S0 ? 'round' : 'butt'; g.strokeStyle = 'rgba(8,12,6,0.24)'; g.lineWidth = rad((Sa + Sb) / 2) * 52 + 4;
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); g.lineCap = 'butt';
    }
    if (k === 0) {
      const pit = [], rim = [];
      for (let j = 0; j < 16; j++) { const a = j / 16 * 6.283, jr = 1 + Math.sin(j * 2.7 + v) * 0.08; pit.push(W(S0 - 0.12 + Math.cos(a) * 0.26 * jr, Math.sin(a) * 0.5 * jr, 0)); rim.push(W(S0 - 0.12 + Math.cos(a) * 0.36 * jr, Math.sin(a) * 0.62 * jr, 0)); }
      poly(g, rim, snow ? Trees.tone(TREE_SNOW, 0.82) : Trees.tone('#6a5038', 0.85));
      poly(g, pit, snow ? Trees.tone('#8a8e96', 0.8) : Trees.tone('#3a2c20', 0.8));
    }
    // a tapered stretch of trunk from S = s0 to s1: dark body, lit top bands, darker underside
    const trunk = (s0, s1) => {
      const m = Math.max(2, Math.ceil((s1 - s0) * 5)), L = [], R = [];
      const ring = (f) => { L.length = 0; R.length = 0; for (let j = 0; j <= m; j++) { const S = U.lerp(s0, s1, j / m), c = W(S, 0, zc(S)), h = rad(S) * 40.5; L.push([c[0] + nx * h * f[0], c[1] + ny * h * f[0]]); R.push([c[0] + nx * h * f[1], c[1] + ny * h * f[1]]); } return L.concat(R.reverse()); };
      poly(g, ring([-1, 1]), Trees.tone(bark, birch ? 0.7 : 0.62));
      poly(g, ring([0.22, 1]), Trees.tone(bark, birch ? 0.95 : 0.92));
      poly(g, ring([0.58, 0.94]), Trees.tone(bark, birch ? 1.05 : 1.08));
      poly(g, ring([-1, -0.5]), Trees.tone(bark, birch ? 0.55 : 0.48));
      if (snow) { poly(g, ring([0.4, 1.02]), Trees.tone(TREE_SNOW, 0.95)); poly(g, ring([0.7, 0.98]), TREE_SNOW); }
      // bark: furrows along the trunk, birch lenticels across it, moss on the shaded side
      const len = s1 - s0, cnt = Math.round(len * (birch ? 9 : 7));
      g.lineWidth = 1;
      for (let j = 0; j < cnt; j++) {
        const S = rng.f(s0, s1), f = rng.f(-0.85, snow ? 0.3 : 0.85), c = W(S, 0, zc(S)), h = rad(S) * 40.5;
        const px = c[0] + nx * h * f, py = c[1] + ny * h * f;
        if (birch) { g.fillStyle = 'rgba(34,30,28,0.8)'; g.save(); g.translate(px, py); g.rotate(Math.atan2(ny, nx)); g.fillRect(-h * 0.25, -0.6, h * rng.f(0.25, 0.6), 1.3); g.restore(); }
        else { const l = rng.f(0.12, 0.3), c2 = W(Math.min(s1, S + l), 0, zc(Math.min(s1, S + l))), h2 = rad(S + l) * 40.5; g.strokeStyle = Trees.tone(bark, f > 0.2 ? 0.7 : 0.45); g.beginPath(); g.moveTo(px, py); g.lineTo(c2[0] + nx * h2 * f, c2[1] + ny * h2 * f); g.stroke(); }
      }
      if (!snow && !birch) for (let j = 0; j < Math.round(len * 6); j++) { const S = rng.f(s0, s1), c = W(S, 0, zc(S)), h = rad(S) * 40.5, f = rng.f(-0.2, 0.75); g.fillStyle = rng.chance(0.5) ? 'rgba(74,100,46,0.55)' : 'rgba(96,120,56,0.45)'; g.beginPath(); g.ellipse(c[0] + nx * h * f, c[1] + ny * h * f, rng.f(1.5, 3.5), rng.f(0.8, 1.5), Math.atan2(dy, dx), 0, 6.283); g.fill(); }
    };
    // root plate: the torn-up root ball standing on edge at S0. The camera sees the face that was the ground
    // surface (earth, grass and litter, the trunk coming out of it), torn soil and roots round the rim
    const plate = () => {
      const R = rA * 2.6 + 0.08, zr = R * 0.86, pr = new RNG(v * 13 + 5), at = (a, r, ds) => W(S0 + (ds || 0), Math.cos(a) * r, Math.max(0, zr + Math.sin(a) * r * 0.95));
      const rim = [], face = [];
      for (let j = 0; j < 30; j++) { const a = j / 30 * 6.283, jr = R * (1 + Math.sin(j * 3.1 + v * 2) * 0.09 + Math.sin(j * 7.3) * 0.07); rim.push(at(a, jr, -0.06)); face.push(at(a, jr * (0.8 + Math.sin(j * 5.1 + v) * 0.05), 0.01)); }
      poly(g, rim, Trees.tone('#3e3024', 0.75));
      // roots torn out round the rim, the top ones hanging down
      g.lineCap = 'round';
      for (let j = 0; j < 22; j++) {
        const a = j / 22 * 6.283 + pr.f(-0.15, 0.15), r0 = R * pr.f(0.78, 0.92), r1 = R * pr.f(1.05, 1.4), up = Math.sin(a) > 0.3;
        const b0 = at(a, r0, -0.03), b1 = at(a + pr.f(-0.25, 0.25), U.lerp(r0, r1, 0.55), -0.04), b2 = up ? [b1[0] + pr.f(-3, 3), b1[1] + pr.f(4, 10)] : at(a + pr.f(-0.35, 0.35), r1, pr.f(-0.12, 0.02));
        g.strokeStyle = Trees.tone(pr.chance(0.3) ? '#8a7460' : '#6a5444', 0.7 + Math.sin(a) * 0.25);
        g.lineWidth = pr.f(1.6, 3); g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke();
        g.lineWidth = pr.f(0.8, 1.4); g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.stroke();
      }
      g.lineCap = 'butt';
      // the face: earth with grass and litter, lighter toward the top
      poly(g, face, Trees.tone(snow ? '#6a6458' : '#4e4630', 0.78));
      for (let j = 0; j < 40; j++) {
        const a = pr.f(0, 6.283), d = R * 0.78 * Math.sqrt(pr.next()), q = at(a, d, 0.02), hi = Math.sin(a) * d / R;
        g.fillStyle = Trees.tone(pr.chance(0.4) ? '#4a5a2c' : pr.chance(0.5) ? '#5e4c34' : '#6a5a3c', 0.72 + hi * 0.3);
        g.fillRect(q[0] - 1, q[1] - 1, pr.f(1.5, 3.5), pr.f(1, 2.2));
      }
      // clods breaking off the rim
      for (let j = 0; j < 9; j++) { const a = pr.f(0, 6.283), q = at(a, R * pr.f(0.82, 0.98), 0.02); g.fillStyle = Trees.tone('#54422e', 0.75 + Math.sin(a) * 0.3); g.beginPath(); g.ellipse(q[0], q[1], pr.f(2, 4), pr.f(1.5, 2.8), 0, 0, 6.283); g.fill(); }
      // sunlit upper edge, grass tufts hanging over it, snow lying on it
      const top = []; for (let j = 0; j <= 12; j++) { const a = Math.PI * (0.12 + j / 12 * 0.76); top.push(at(a, R * 0.84, 0.02)); }
      g.strokeStyle = snow ? TREE_SNOW : Trees.tone('#7a6a48', 0.95); g.lineWidth = snow ? 3.5 : 1.6; g.beginPath(); top.forEach((q, j) => j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke();
      if (!snow && st !== 'b') { g.strokeStyle = Trees.tone(st === 's' || st === 'a' ? '#8a7a44' : '#5a7a34', 0.9); g.lineWidth = 1; g.beginPath(); for (let j = 1; j < 12; j++) { const q = top[j]; for (let m = 0; m < 2; m++) { g.moveTo(q[0] + m * 2 - 1, q[1]); g.lineTo(q[0] + m * 3 - 1 + pr.f(-2, 2), q[1] + pr.f(3, 7)); } } g.stroke(); }
    };
    // the crown: bare broken limbs lying on the ground and propped up off it, over the last part
    const crown = () => {
      const cr = new RNG(v * 17 + n * 3 + (alongU ? 1 : 0)), tw = birch ? '#5a4a48' : bark;
      const limbs = [];
      for (let j = 0; j < 10; j++) {
        const S = S1 - cr.f(0.05, 1.05), side = j % 2 ? 1 : -1, b = [S + cr.f(0.25, 0.85), side * cr.f(0.25, 0.9), cr.f(0.04, 0.55)];
        limbs.push([S, b, cr.f(1.4, 3.2)]);
      }
      limbs.push([S1 - 0.05, [S1 + 0.45, cr.f(-0.2, 0.2), 0.12], 2]);
      // back to front: the far side (-t) first
      limbs.sort((p, q) => p[1][1] - q[1][1]);
      g.lineCap = 'round';
      for (const [S, b, w] of limbs) {
        const a = W(S, 0, zc(S)), e = W(b[0], b[1], b[2]);
        g.strokeStyle = Trees.tone(tw, 0.72); g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(e[0], e[1]); g.stroke();
        g.strokeStyle = Trees.tone(tw, 0.95); g.lineWidth = Math.max(0.8, w * 0.4); g.beginPath(); g.moveTo(a[0] - 0.5, a[1] - w * 0.25); g.lineTo(e[0] - 0.5, e[1] - w * 0.2); g.stroke();
        // twigs off the limb
        g.strokeStyle = Trees.tone(tw, 0.8); g.lineWidth = 0.8; g.beginPath();
        for (let q = 0; q < 7; q++) {
          const t = cr.f(0.3, 1), p = [U.lerp(a[0], e[0], t), U.lerp(a[1], e[1], t)], l = cr.f(5, 14), an = Math.atan2(e[1] - a[1], e[0] - a[0]) + cr.f(-1.1, 1.1) - (q % 2 ? 0.4 : 0);
          const m = [p[0] + Math.cos(an) * l, p[1] + Math.sin(an) * l];
          g.moveTo(p[0], p[1]); g.lineTo(m[0], m[1]);
          const a2 = an + cr.f(-0.9, 0.9), l2 = l * cr.f(0.35, 0.6); g.moveTo(U.lerp(p[0], m[0], 0.6), U.lerp(p[1], m[1], 0.6)); g.lineTo(U.lerp(p[0], m[0], 0.6) + Math.cos(a2) * l2, U.lerp(p[1], m[1], 0.6) + Math.sin(a2) * l2);
        }
        g.stroke();
        if (snow) { g.strokeStyle = TREE_SNOW; g.lineWidth = Math.max(1, w * 0.5); g.beginPath(); g.moveTo(a[0], a[1] - w * 0.4); g.lineTo(e[0], e[1] - w * 0.4); g.stroke(); }
      }
      g.lineCap = 'butt';
      // dry leaves still clinging to the twigs outside winter
      if (!snow && st !== 'b') for (let j = 0; j < 22; j++) { const q = W(S1 - cr.f(0, 0.6) + cr.f(0, 0.9), cr.f(-0.8, 0.8), cr.f(0.05, 0.4)); g.fillStyle = Trees.tone(cr.chance(0.5) ? '#7a5a34' : '#8a6a3c', cr.f(0.7, 1.05)); g.fillRect(q[0], q[1], 2, 1.5); }
    };
    if (k === 0) plate();
    // stub of a snapped branch on the middle of the trunk
    const stubS = S0 + (S1 - S0) * 0.45;
    if (Sb > Sa) trunk(Math.max(S0, Sa - 0.03), Math.min(S1, Sb + 0.03));
    if (stubS >= k && stubS < k + 1) { const a = W(stubS, 0, zc(stubS) + rad(stubS) * 0.6), e = W(stubS + 0.16, -0.16, zc(stubS) + rad(stubS) + 0.2); g.lineCap = 'round'; g.strokeStyle = Trees.tone(bark, 0.7); g.lineWidth = 3.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(e[0], e[1]); g.stroke(); g.strokeStyle = Trees.tone(bark, 1.0); g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0] - 1, a[1]); g.lineTo(e[0] - 1, e[1]); g.stroke(); g.lineCap = 'butt'; }
    if (k === n - 1) crown();
    // autumn: a few mushrooms along the shaded flank
    if (!snow && (st === 'y' || st === 'a') && Sb > Sa) for (let j = 0; j < 2; j++) { const S = rng.f(Sa, Sb), c = W(S, 0, zc(S)), h = rad(S) * 40.5, p = [c[0] - nx * h * 0.3, c[1] - ny * h * 0.3]; g.fillStyle = '#e8dcc0'; g.fillRect(p[0], p[1] - 2, 1, 3); g.fillStyle = '#b8783a'; g.beginPath(); g.ellipse(p[0] + 0.5, p[1] - 2, 3, 1.6, 0, Math.PI, 0); g.fill(); }
  },
});

// ---------------------------------------------------------------- species by biome (world generation)
// A tree's species follows what is around it: farmland -> orchard and hedgerow trees, built-up ->
// shade and ornamental trees, water -> spruce, pine and birch, deep forest -> conifer stands or old
// oak-maple woods, forest edge -> a deciduous mix with cedars. Groves (value noise) favour one species.
// All randomness is hashed from the position, so no generator RNG is consumed.
const TREE_RING = [];
for (const r of [2, 4, 6]) for (let k = 0; k < 8; k++) TREE_RING.push([Math.round(Math.cos(k * 0.785 + r) * r), Math.round(Math.sin(k * 0.785 + r) * r)]);
Object.assign(MapGen, {
  treeRnd(x, y, s) { return Trees.hash(x, y, s + ((Wd && Wd.seed) | 0)) / 4294967296; },
  treeNoise(x, y, sc, s) {
    const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = U.smooth(fx - x0), ty = U.smooth(fy - y0);
    const h = (a, b) => Trees.hash(a, b, s + ((Wd && Wd.seed) | 0)) / 4294967296;
    return U.lerp(U.lerp(h(x0, y0), h(x0 + 1, y0), tx), U.lerp(h(x0, y0 + 1), h(x0 + 1, y0 + 1), tx), ty);
  },
  treeEnv(x, y) {
    let wat = 0, bui = 0, farm = 0, fo = 0, n = 0;
    const W = Wd.w, GW = Wd.gw || W;
    for (const [dx, dy] of TREE_RING) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= GW || yy >= Wd.h) continue;
      const i = yy * W + xx, f = Wd.floor[i];
      n++;
      if (f === FL.WATER || f === FL.DEEPWATER) wat++;
      else if (Wd.room[i] >= 0 || f === FL.ASPHALT || f === FL.SIDEWALK || f === FL.CONCRETE || f === FL.PARKING) bui++;
      else if (f === FL.FURROW) farm++;
      else if (f === FL.FOREST) fo++;
    }
    n = n || 1;
    return { wat: wat / n, bui: bui / n, farm: farm / n, fo: fo / n };
  },
  // species weights [[kind, w], ...] and age-class odds for a spot
  treeBiome(x, y, dens) {
    const e = this.treeEnv(x, y), d = dens === undefined ? U.clamp(e.fo * 1.3, 0, 1) : dens;
    if (e.farm > 0.04) return { b: 'farm', list: [['apple', 3], ['oak', 1.2], ['elm', 1], ['maple', 0.8], ['cedar', 1.2], ['cherry', 0.5]], ages: [0.04, 0.4, 0.46, 0.1] };
    if (e.bui > 0.06) return { b: 'town', list: [['maple', 3], ['oak', 2], ['elm', 1.6], ['birch', 1.4], ['cherry', 1.6], ['apple', 0.4], ['spruce', 0.7], ['cedar', 0.4], ['pine', 0.3]], ages: [0.05, 0.35, 0.45, 0.15] };
    if (e.wat > 0.03) return { b: 'water', list: [['spruce', 3], ['pine', 2], ['birch', 2.2], ['elm', 0.8], ['cedar', 0.6], ['dead', 0.25]], ages: [0.08, 0.32, 0.45, 0.15] };
    if (d > 0.55) return this.treeNoise(x + 500, y + 200, 26, 9) > 0.52
      ? { b: 'conifer', list: [['pine', 3], ['spruce', 2.6], ['cedar', 0.3], ['oak', 0.5], ['birch', 0.3], ['dead', 0.18]], ages: [0.04, 0.22, 0.5, 0.24] }
      : { b: 'wood', list: [['oak', 3], ['maple', 2.6], ['elm', 0.8], ['birch', 0.7], ['pine', 0.7], ['spruce', 0.4], ['dead', 0.18]], ages: [0.04, 0.22, 0.5, 0.24] };
    return { b: 'edge', list: [['oak', 2.2], ['maple', 2.4], ['elm', 1.2], ['birch', 1.6], ['cedar', 1.0], ['cherry', 0.35], ['pine', 0.6], ['dead', 0.12]], ages: [0.16, 0.4, 0.34, 0.1] };
  },
  treePick(x, y, list, hint) {
    const fav = list[Math.floor(this.treeNoise(x, y, 9, 3) * list.length * 0.999)][0];
    let tot = 0;
    const w = list.map(([k, wt]) => { const v = wt * (k === fav ? 2.4 : 1) * (k === hint ? 1.5 : 1); tot += v; return v; });
    let r = this.treeRnd(x, y, 5) * tot;
    for (let k = 0; k < list.length; k++) { r -= w[k]; if (r <= 0) return list[k][0]; }
    return list[list.length - 1][0];
  },
  // species for a tree at x, y (dens: forest density 0..1 if known; hint: a species the caller would like)
  treeKind(x, y, dens, hint) { return this.treePick(x, y, this.treeBiome(x, y, dens).list, hint); },
  // a whole tree object; sz 0 / undefined picks an age class for the biome
  tree(x, y, sz, dens, hint) {
    const bm = this.treeBiome(x, y, dens), kind = this.treePick(x, y, bm.list, hint);
    if (!sz) {
      let r = this.treeRnd(x, y, 8), a = 0;
      while (a < 3 && (r -= bm.ages[a]) > 0) a++;
      sz = [0.45, 0.78, 1.04, 1.28][a] + this.treeRnd(x, y, 9) * 0.12;
    }
    return { t: 'tree', dir: 'S', kind, sz: Math.round(sz * 100) / 100, v: Trees.hash(x, y, 77) % Trees.NV };
  },
  // undergrowth: ferns and evergreen shrubs in the woods, berry and leafy shrubs at the edges
  shrub(x, y, dens) {
    const r = this.treeRnd(x, y, 21), d = dens || 0;
    const v = d > 0.55 ? (r < 0.4 ? 4 : r < 0.62 ? 0 : r < 0.8 ? 2 : 1) : (r < 0.15 ? 4 : r < 0.5 ? 0 : r < 0.75 ? 1 : r < 0.88 ? 2 : 3);
    return { t: 'bush', dir: 'S', v: v + 5 * (Trees.hash(x, y, 23) % 3), berries: v !== 4 && v !== 2 && this.treeRnd(x, y, 22) < 0.3 };
  },
  // garden shrub variant: kind v (0 round, 1 low, 2 evergreen, 3 lilac) in one of three shapes
  shrubV(x, y, v) { return v + 5 * (Trees.hash(x, y, 23) % 3); },
  // fallen logs, whole windthrown trees and old stumps on the forest floor, or null (for the tile x, y)
  deadwood(x, y, dens) {
    const r = this.treeRnd(x, y, 31);
    if (r > dens * 0.022) return null;
    if (r < dens * 0.012) {
      const alongU = this.treeRnd(x, y, 32) < 0.5, dir = alongU ? 'E' : 'S', v = Trees.hash(x, y, 33) % 3;
      // a fallen tree lies back over tiles this pass has already left empty (x, y is its front end), so the
      // pass's random sequence is untouched
      const n = this.treeRnd(x, y, 35) < 0.55 ? 3 + Trees.hash(x, y, 36) % 2 : 1;
      if (n > 1 && this.lieFree(x, y, alongU, n)) {
        for (let k = 1; k < n; k++) this.w.obj[alongU ? y * this.W + x - k : (y - k) * this.W + x] = { t: 'tlog', dir, v, n, part: n - 1 - k };
        return { t: 'tlog', dir, v, n, part: n - 1 };
      }
      return { t: 'tlog', dir, v };
    }
    return { t: 'tstump', dir: 'S', v: Trees.hash(x, y, 34) % 3 };
  },
  // the n - 1 tiles behind x, y (toward -u or -v) are open ground with nothing on them
  lieFree(x, y, alongU, n) {
    for (let k = 1; k < n; k++) {
      const xx = alongU ? x - k : x, yy = alongU ? y : y - k;
      if (xx < 0 || yy < 0) return false;
      const j = yy * this.W + xx, f = this.w.floor[j];
      if (this.used[j] || this.w.obj[j] || this.w.room[j] >= 0 || (f !== FL.GRASS && f !== FL.GRASS2 && f !== FL.FOREST)) return false;
    }
    return true;
  },
  // staggered rows of fruit trees on free grass (apples, now and then a row of cherries)
  orchard(x0, y0, x1, y1, step) {
    for (let y = y0; y <= y1; y += step) for (let x = x0 + ((y - y0) / step % 2 ? 1 : 0); x <= x1; x += step) {
      if (!this.free(x, y)) continue;
      const f = this.w.floor[y * this.W + x];
      if (f !== FL.GRASS && f !== FL.GRASS2 && f !== FL.DIRT) continue;
      const kind = Trees.hash(y0, (y - y0) / step | 0, 42) % 4 === 3 ? 'cherry' : 'apple';
      this.w.obj[y * this.W + x] = { t: 'tree', dir: 'S', kind, sz: Math.round((0.85 + this.treeRnd(x, y, 41) * 0.35) * 100) / 100, v: Trees.hash(x, y, 77) % Trees.NV };
    }
  },
});
