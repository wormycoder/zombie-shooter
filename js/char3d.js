'use strict';
// ---------------------------------------------------------------------------
// 3D characters: low-poly survivors and zombies (rounded boxes, tapered limbs, ellipsoid heads and
// joints) with layered clothes, rendered by GL3D into an atlas each frame and blitted in painter's order.
// Animation: every character keeps a small state (WeakMap) and a pose vector of joint channels.
// Each frame the target pose is generated from the game's pose object (gait cycle, actions, falls ...)
// and any jump in the target (a new action, a new state) is hidden by an offset that decays away.
// Legs are solved with two-bone IK from ankle targets (feet stay planted: the gait phase advances with
// the distance actually moved), arms from wrist targets in the chest frame.
// Falls back to the 2D painter without WebGL or when switched off.
// Body frame: f forward, s right, z up (1 unit = 1 tile = about one metre).
// ---------------------------------------------------------------------------
// pose channels
const C3 = {
  PX: 0, PY: 1, PZ: 2, PP: 3, PR: 4, PW: 5,   // pelvis (hip-joint centre) position in the body frame; tilt fwd, roll (right side down), yaw
  SP: 6, SR: 7, SW: 8,                         // spine bend fwd, side bend right, twist right
  HP: 9, HR: 10, HW: 11,                       // head: look down, tilt right, turn right
  LA: 12, LK: 15, LF: 16,                      // left ankle (pelvis frame, 3), leg twist out, foot pitch (toes up, pelvis frame)
  RA: 17, RK: 20, RF: 21,
  LW: 22, LE: 25, RW: 26, RE: 29,              // wrists (offset from the shoulder, chest frame, 3), elbow down/out 0..1
  WD: 30, GR: 33, GO: 34, JAW: 35, LH: 36,     // weapon direction (chest frame, 3), left hand on the weapon 0..1 and where, jaw open, left fist
  N: 37,
};
// rig scratch: a frame is origin, f, s, up axes (model space: world-oriented, relative to the feet)
const c3F = () => new Float64Array(12);
function c3loc(d, p, a, b, c) {
  const x = p[0] + p[3] * a + p[6] * b + p[9] * c, y = p[1] + p[4] * a + p[7] * b + p[10] * c, z = p[2] + p[5] * a + p[8] * b + p[11] * c;
  if (d !== p) for (let i = 3; i < 12; i++) d[i] = p[i];
  d[0] = x; d[1] = y; d[2] = z;
  return d;
}
function c3yaw(d, a) { if (!a) return d; const c = Math.cos(a), s = Math.sin(a); for (let i = 3; i < 6; i++) { const f = d[i], r = d[i + 3]; d[i] = f * c + r * s; d[i + 3] = r * c - f * s; } return d; }
function c3pitch(d, a) { if (!a) return d; const c = Math.cos(a), s = Math.sin(a); for (let i = 3; i < 6; i++) { const f = d[i], u = d[i + 6]; d[i] = f * c + u * s; d[i + 6] = u * c - f * s; } return d; }
function c3roll(d, a) { if (!a) return d; const c = Math.cos(a), s = Math.sin(a); for (let i = 6; i < 9; i++) { const r = d[i], u = d[i + 3]; d[i] = r * c + u * s; d[i + 3] = u * c - r * s; } return d; }
function c3pt(o, p, a, b, c) { o[0] = p[0] + p[3] * a + p[6] * b + p[9] * c; o[1] = p[1] + p[4] * a + p[7] * b + p[10] * c; o[2] = p[2] + p[5] * a + p[8] * b + p[11] * c; return o; }
function c3dir(o, p, a, b, c) { o[0] = p[3] * a + p[6] * b + p[9] * c; o[1] = p[4] * a + p[7] * b + p[10] * c; o[2] = p[5] * a + p[8] * b + p[11] * c; return o; }
// model-space point -> frame-local
function c3inv(o, p, x, y, z) { x -= p[0]; y -= p[1]; z -= p[2]; o[0] = x * p[3] + y * p[4] + z * p[5]; o[1] = x * p[6] + y * p[7] + z * p[8]; o[2] = x * p[9] + y * p[10] + z * p[11]; return o; }
function c3body(d, ang) { d.fill(0); d[3] = Math.cos(ang); d[4] = Math.sin(ang); d[6] = -d[4]; d[7] = d[3]; d[11] = 1; return d; }
// projected bounds of everything emitted for the current model (world px relative to the feet)
const C3B = { x0: 0, x1: 0, y0: 0, y1: 0 };
function c3emit(m, cx, cy, cz, xx, xy, xz, yx, yy, yz, zx, zy, zz, col, t0, t1) {
  GL3D.prim(m, cx, cy, cz, xx, xy, xz, yx, yy, yz, zx, zy, zz, col[0], col[1], col[2], t0, t1);
  const px = (cx - cy) * HTW, py = (cx + cy) * HTH - cz * ZU;
  const ex = (Math.abs(xx - xy) + Math.abs(yx - yy) + Math.abs(zx - zy)) * HTW;
  const ey = Math.abs((xx + xy) * HTH - xz * ZU) + Math.abs((yx + yy) * HTH - yz * ZU) + Math.abs((zx + zy) * HTH - zz * ZU);
  if (px - ex < C3B.x0) C3B.x0 = px - ex;
  if (px + ex > C3B.x1) C3B.x1 = px + ex;
  if (py - ey < C3B.y0) C3B.y0 = py - ey;
  if (py + ey > C3B.y1) C3B.y1 = py + ey;
}
// mesh m on frame F's axes: centre at local (a, b, c), half sizes along f, s, up; taper t0 (bottom) -> t1 (top)
function c3box(m, F, a, b, c, hf, hs, hu, col, t0, t1) {
  c3emit(m, F[0] + F[3] * a + F[6] * b + F[9] * c, F[1] + F[4] * a + F[7] * b + F[10] * c, F[2] + F[5] * a + F[8] * b + F[11] * c,
    F[3] * hf, F[4] * hf, F[5] * hf, F[6] * hs, F[7] * hs, F[8] * hs, F[9] * hu, F[10] * hu, F[11] * hu, col, t0 === undefined ? 1 : t0, t1 === undefined ? 1 : t1);
}
// mesh m spanning points A -> B: local z along AB (taper t0 at A, t1 at B), local x (half rx) toward hint h, y (half ry)
function c3seg(m, A, B, rx, ry, col, t0, t1, hx, hy, hz) {
  let zx = (B[0] - A[0]) * 0.5, zy = (B[1] - A[1]) * 0.5, zz = (B[2] - A[2]) * 0.5;
  const l = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1e-6, ux = zx / l, uy = zy / l, uz = zz / l;
  let d = hx * ux + hy * uy + hz * uz, xx = hx - ux * d, xy = hy - uy * d, xz = hz - uz * d, xl = Math.sqrt(xx * xx + xy * xy + xz * xz);
  if (xl < 1e-3) { d = uz; xx = -ux * d; xy = -uy * d; xz = 1 - uz * d; xl = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1; }
  xx /= xl; xy /= xl; xz /= xl;
  const yx = uy * xz - uz * xy, yy = uz * xx - ux * xz, yz = ux * xy - uy * xx;
  c3emit(m, A[0] + zx, A[1] + zy, A[2] + zz, xx * rx, xy * rx, xz * rx, yx * ry, yy * ry, yz * ry, zx, zy, zz, col, t0, t1);
}
// Hermite through keyframes (Catmull-Rom tangents): keys {t: [..], v: Float32Array rows of n}, writes out[ch[j]]
function c3track(K, t, out, add) {
  const ts = K.t, n = K.ch.length, last = ts.length - 1;
  let i = 0;
  if (t <= ts[0]) i = 0; else if (t >= ts[last]) i = last - 1; else while (i < last - 1 && t > ts[i + 1]) i++;
  const t0 = ts[i], t1 = ts[i + 1], h = t1 - t0, s = U.clamp((t - t0) / (h || 1), 0, 1);
  const s2 = s * s, s3 = s2 * s, h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const v = K.v, a = i * n, b = a + n, pa = i > 0 ? a - n : -1, nb = i + 2 <= last ? b + n : -1;
  const ka = i > 0 ? h / (t1 - ts[i - 1]) : 0, kb = i + 2 <= last ? h / (ts[i + 2] - t0) : 0;
  for (let j = 0; j < n; j++) {
    const p0 = v[a + j], p1 = v[b + j];
    const m0 = pa >= 0 ? (p1 - v[pa + j]) * ka : 0, m1 = nb >= 0 ? (v[nb + j] - p0) * kb : 0;
    const r = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1, c = K.ch[j];
    if (add && add[j]) out[c] += r; else out[c] = r;
  }
}
const c3v = () => new Float64Array(3);
const c3a = c3v(), c3b = c3v(), c3c = c3v(), c3d = c3v(), c3e = c3v(), c3g = c3v(), c3AL = c3v(), c3AR = c3v(), c3S0 = c3v(), c3TG = c3v(), c3E = c3v(), c3W = c3v(), c3HC = c3v(), c3HR = c3v(), c3WD = c3v(), c3G1 = c3v(), c3G2 = c3v();

const Char3D = {
  map: new Map(), cols: new Map(), st: new WeakMap(), pals: new WeakMap(),
  B: c3F(), P: c3F(), L: c3F(), C: c3F(), NB: c3F(), H: c3F(), T1: c3F(), T2: c3F(), mk: [0, 0, 0, 0],
  on() { return Settings.v.chars3d && !this.off && GL3D.ok(); },
  rgb(hex) {
    let c = this.cols.get(hex);
    if (c) return c;
    let h = String(hex || '#888').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h.slice(0, 6), 16) || 0x888888;
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    // gentle gamma lift: flat colours read darker as 3D faces
    c = c.map(v => Math.min(1, Math.pow(v, 0.92) * 1.04));
    this.cols.set(hex, c);
    return c;
  },
  mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },
  sc(a, k) { return [Math.min(1, a[0] * k), Math.min(1, a[1] * k), Math.min(1, a[2] * k)]; },
  rnd(id, k) { const x = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); },
  // ---- per frame: collect, animate and queue every character that may be drawn
  prepare(minX, minY, maxX, maxY) {
    this.map.clear();
    const now = performance.now();
    let dt = this.lastT ? Math.min(0.1, (now - this.lastT) / 1000) : 0;
    this.lastT = now;
    if (!this.on()) return;
    if (G.paused || (G.mode !== 'play' && G.mode !== 'dead') || (typeof UI !== 'undefined' && UI.modalPause && UI.modalPause())) dt = 0;
    else dt = Math.min(0.1, dt * (G.speed || 1));
    const z0 = Render.cam.zoom * Render.dpr;
    GL3D.begin(Math.min(3, Math.max(0.5, z0)));
    const p = G.player;
    try {
      if (p && !p.inCar && (!p.dead || G.corpse) && p.look) {
        const d = Player.drawInfo();
        if (d) this.queue(p, d.ang, Player.look(), Player.pose(), d.s, p.hurtFlash > 0 ? Math.min(0.6, p.hurtFlash) : 0, dt);
      }
      for (const z of G.zombies) {
        const vx = vxOf(z.x);
        if (vx < minX - 3 || vx > maxX + 3 || z.y < minY - 3 || z.y > maxY + 3) continue;
        const d = Zombie.drawInfo(z);
        if (!d) continue;
        this.queue(z, z.a, z.look, d.pose, d.s, z.stag > 0 ? 0.25 : 0, dt);
      }
      GL3D.flush();
    } catch (e) {
      console.warn('3D characters disabled after an error', e);
      this.off = true; this.map.clear();
    }
  },
  queue(e, ang, look, pose, shade, flash, dt) {
    const id = e.id === undefined ? 1 : e.id;
    let S = this.st.get(e);
    if (!S || S.look !== look && S.lookId !== this.lookKey(look)) {
      const prev = S;
      S = this.newState(id, look);
      if (prev) { S.cur.set(prev.cur); S.fresh = false; S.key = prev.key; S.ph = prev.ph; S.v = prev.v; S.amp = prev.amp; S.hip = prev.hip; S.lx = prev.lx; S.ly = prev.ly; S.mode = prev.mode; S.mt = prev.mt; S.t = prev.t; }
      this.st.set(e, S);
    }
    S.look = look;
    this.animate(S, e.x, e.y, ang, pose, dt);
    const cell = this.render(S, ang, look, pose, Math.max(0.05, Math.min(1, shade)), flash);
    if (cell) this.map.set(e, cell);
  },
  // the player's look object is rebuilt every frame: compare what shapes the model
  lookKey(L) { return (L.female ? 'f' : 'm') + (L.zombie ? 'z' : ''); },
  newState(id, look) {
    const N = C3.N;
    const S = { id, cur: new Float32Array(N), tgt: new Float32Array(N), off: new Float32Array(N), offT: 1, offD: 0.2, key: '', fresh: true,
      ph: 0, v: 0, amp: 0, lx: NaN, ly: 0, mdir: 0, hip: NaN, back: false, turn: 0, gw: new Float32Array(5), mode: '', mt: 0, t: 0, swN: 0, lastSw: 0, look, lookId: this.lookKey(look) };
    S.D = this.dims(look, id);
    return S;
  },
  // body measurements for a character (metres)
  dims(look, id) {
    const fem = !!look.female, r = (k) => this.rnd(id, k);
    const H = (fem ? 0.935 : 1) * (0.975 + r(3) * 0.05), bw = (fem ? 0.93 : 1) * (0.94 + r(1) * 0.16);
    const D = { H, bw, fem, zomb: !!look.zombie, thigh: 0.435 * H, shin: 0.425 * H, ankH: 0.075, hipW: (fem ? 0.094 : 0.088) * bw, ua: 0.3 * H, fa: 0.265 * H,
      shW: (fem ? 0.166 : 0.19) * bw, sp0: 0.09 * H, sp1: 0.18 * H, shZ: 0.25 * H, neck: 0.08 * H };
    D.hipH = D.ankH + (D.thigh + D.shin) * 0.985;
    D.L = (D.thigh + D.shin) * 0.995;
    return D;
  },
  // ===================================================================== animation
  // gait parameter sets: walk, run, sprint, sneak, shamble
  GAIT: [
    // st0, stk, stMin, stMax, beta, lift, peak, ff, base, bob, runBob, lean, arm, bend, twist, pyaw, proll, sway, stepW, hs, to
    [0.75, 0.36, 0.9, 1.5, 0.6, 0.1, 0.3, 0.42, 0.012, 0.024, 0, 0.03, 0.17, 0.12, 0.1, 0.1, 0.06, 0.02, 0.085, 0.26, 0.55],
    [1.2, 0.32, 1.6, 2.4, 0.37, 0.32, 0.38, 0.36, 0.05, 0.045, 1, 0.12, 0.17, 0.85, 0.2, 0.16, 0.05, 0.012, 0.062, 0.12, 0.9],
    [1.3, 0.35, 2.0, 3.0, 0.31, 0.44, 0.4, 0.3, 0.07, 0.05, 1, 0.24, 0.25, 0.92, 0.24, 0.2, 0.05, 0.01, 0.052, 0.1, 1.0],
    [0.75, 0.25, 0.8, 1.1, 0.64, 0.09, 0.4, 0.45, 0.23, 0.015, 0, 0.22, 0.05, 0.75, 0.06, 0.06, 0.03, 0.02, 0.1, 0.2, 0.5],
    [0.5, 0.5, 0.62, 1.2, 0.66, 0.045, 0.45, 0.5, 0.04, 0.02, 0, 0.15, 0.08, 0.2, 0.1, 0.08, 0.09, 0.035, 0.115, 0.05, 0.25],
  ],
  gp: new Float32Array(21),
  gaitOf(P) { const g = P.gait; return g === 'run' ? 1 : g === 'sprint' ? 2 : g === 'sneak' ? 3 : g === 'shamble' ? 4 : 0; },
  NOMV: [1.75, 3.1, 4.3, 1.1, 0.8],
  // advance trackers (speed, gait phase, hip yaw), build the target pose and blend it in
  animate(S, ex, ey, ang, P, dt) {
    const T = S.tgt, D = S.D, fresh = S.fresh, gi = this.gaitOf(P);
    S.t += dt; S.ang = ang;
    const mode = P.mode || 'loco';
    if (mode !== S.mode) { S.mode = mode; S.mt = 0; } else S.mt += dt;
    // ---- locomotion trackers
    const gw = S.gw;
    if (fresh || P.walk !== undefined && S.preview) {
      // previews and first frames: phase and amplitude from the pose object
      S.ph = P.walk || 0; S.amp = Math.min(1, P.amp === undefined ? 0 : P.amp / 0.85); S.v = this.NOMV[gi] * S.amp;
      gw.fill(0); gw[gi] = 1; S.hip = ang; S.lx = ex; S.ly = ey; S.mdir = ang;
    } else {
      let dx = ex - S.lx, dy = ey - S.ly, d = Math.sqrt(dx * dx + dy * dy);
      if (!(d < 1.5) || !(dt > 0)) d = 0;
      S.lx = ex; S.ly = ey;
      if (dt > 0) {
        S.v += (d / dt - S.v) * Math.min(1, dt * 9);
        if (d > 1e-4) S.mdir = Math.atan2(dy, dx);
        for (let k = 0; k < 5; k++) gw[k] += ((k === gi ? 1 : 0) - gw[k]) * Math.min(1, dt * 7);
      }
      const moving = S.v > 0.12 && (P.amp === undefined || P.amp > 0.02);
      S.amp += ((moving ? 1 : 0) - S.amp) * Math.min(1, dt * (moving ? 7 : 6));
      // hips follow the direction of travel (backwards steps run the cycle backwards); standing, they lag the torso
      let tgt = ang;
      S.back = false;
      if (S.amp > 0.25) { const rel = U.angDiff(ang, S.mdir); if (Math.abs(rel) > 1.95) { S.back = true; tgt = S.mdir + Math.PI; } else tgt = S.mdir; }
      if (!(S.hip === S.hip)) S.hip = ang;
      const h0 = S.hip;
      S.hip = U.normAng(S.hip + U.angDiff(S.hip, tgt) * Math.min(1, dt * (S.amp > 0.25 ? 9 : 5)));
      let lag = U.angDiff(ang, S.hip);
      if (Math.abs(lag) > 1.1) { S.hip = U.normAng(ang + Math.sign(lag) * 1.1); lag = Math.sign(lag) * 1.1; }
      // turning on the spot shuffles the feet
      const hr = dt > 0 ? Math.abs(U.angDiff(h0, S.hip)) / dt : 0;
      S.turn += (Math.min(0.55, hr * 0.22) * (1 - S.amp) - S.turn) * Math.min(1, dt * 8);
      const g = this.gp; this.gaitParams(g, gw, S.v);
      S.ph += (S.back ? -d : d) * Math.PI * 2 / g[0] + hr * dt * 0.7 * (1 - S.amp);
    }
    // ---- target pose
    this.base(T, S, D, ang, P, mode);
    // ---- blend: a change of state starts an offset from the old output that decays away
    const sw = P.swingT;
    if (sw !== undefined) { if (sw < S.lastSw - 0.25) S.swN++; S.lastSw = sw; }
    const key = mode + '|' + (P.arms || '') + '|' + (P.style || '') + '|' + (P.weapon || '') + '|' + S.swN + '|' + (P.lieDir || 0);
    if (key !== S.key) {
      const dur = mode !== S.lastMode ? (mode === 'loco' && S.lastMode === 'getup' ? 0.3 : mode === 'dead' || mode === 'fall' || mode === 'stagger' ? 0.1 : 0.25) : P.arms === 'fire' ? 0.05 : 0.16;
      if (!fresh) for (let i = 0; i < C3.N; i++) S.off[i] = S.cur[i] - T[i]; else S.off.fill(0);
      S.offT = 0; S.offD = dur; S.key = key; S.lastMode = mode;
    }
    S.offT += dt;
    const k = S.offT >= S.offD ? 0 : 1 - U.smooth(S.offT / S.offD);
    const cur = S.cur, off = S.off;
    for (let i = 0; i < C3.N; i++) cur[i] = T[i] + off[i] * k;
    S.fresh = false;
  },
  gaitParams(g, gw, v) {
    g.fill(0);
    for (let k = 0; k < 5; k++) {
      const w = gw[k];
      if (w < 0.001) continue;
      const G = this.GAIT[k];
      g[0] += w * U.clamp(G[0] + G[1] * v, G[2], G[3]);
      for (let j = 4; j < 21; j++) g[j - 3] += w * G[j];
    }
    // g: 0 stride, 1 beta, 2 lift, 3 peak, 4 ff, 5 base, 6 bob, 7 runBob, 8 lean, 9 arm, 10 bend, 11 twist, 12 pyaw, 13 proll, 14 sway, 15 stepW, 16 hs, 17 to
  },
  // the whole target pose for this frame
  base(T, S, D, ang, P, mode) {
    T.fill(0);
    const zomb = D.zomb;
    if (mode === 'fall' || mode === 'dead' || mode === 'lie' || mode === 'sleep') this.lying(T, S, D, P, mode);
    else if (mode === 'getup') this.getup(T, S, D, P);
    else if (mode === 'crawl') this.crawl(T, S, D, P);
    else if (mode === 'sit' || mode === 'kneel') this.seated(T, S, D, P, mode);
    else {
      this.loco(T, S, D, P);
      if (mode === 'climb') this.climb(T, S, D, P);
      else if (mode === 'attack') this.zAttack(T, S, D, P);
      else if (mode === 'stagger') this.stagger(T, S, D, P);
      else if (zomb && !P.arms || P.arms === 'zombie') this.zArms(T, S, D, P);
      else this.upper(T, S, D, P);
      if (P.arms === 'thump') this.thump(T, S, D, P);
    }
    // gaze: the head turns toward what the character looks at, beyond what the chest already turned
    if (P.look !== undefined && mode !== 'dead' && mode !== 'fall' && mode !== 'sleep') {
      T[C3.HW] += U.clamp(P.look - T[C3.PW] - T[C3.SW], -0.95, 0.95);
      if (P.lookP) T[C3.HP] += P.lookP;
    }
  },
  // ---- body-frame helpers for authoring
  // pelvis frame for the channels in T (body frame at the origin)
  pelvisOf(T, F) { c3body(F, 0); c3loc(F, F, T[0], T[1], T[2]); c3yaw(F, T[5]); c3pitch(F, -T[3]); c3roll(F, -T[4]); return F; },
  chestOf(T, D, F) { this.pelvisOf(T, F); c3loc(F, F, 0, 0, D.sp0); c3yaw(F, T[8] * 0.45); c3pitch(F, -T[6] * 0.5); c3roll(F, -T[7] * 0.5); c3loc(F, F, 0, 0, D.sp1); c3yaw(F, T[8] * 0.55); c3pitch(F, -T[6] * 0.5); c3roll(F, -T[7] * 0.5); return F; },
  // place an ankle (body frame) with ground foot pitch th into the leg channels of side
  foot(T, Pf, side, x, y, z, th, twist) {
    const o = c3inv(c3a, Pf, x, y, z), i = side < 0 ? C3.LA : C3.RA;
    T[i] = o[0]; T[i + 1] = o[1]; T[i + 2] = o[2];
    T[i + 3] = twist === undefined ? 0.1 : twist;
    // ground pitch to pelvis-frame pitch
    T[i + 4] = th - Math.asin(U.clamp(Pf[5], -1, 1));
  },
  // ankle position for a foot pivoting on its heel (th > 0) or ball (th < 0) at ground point x, height z
  rock(o, x, z, th, D) {
    const c = Math.cos(th), s = Math.sin(th), a = D.ankH;
    if (th >= 0) { const hd = 0.055; o[0] = x - hd + hd * c - a * s; o[1] = z + hd * s + a * c; }
    else { const bd = 0.13 * D.H; o[0] = x + bd - bd * c - a * s; o[1] = z - bd * s + a * c; }
    return o;
  },
  // arm channels: wrist offset from the shoulder in the chest frame (out = away from the body)
  arm(T, side, f, out, z, el) { const i = side < 0 ? C3.LW : C3.RW; T[i] = f; T[i + 1] = side * out; T[i + 2] = z; T[i + 3] = el || 0; },
  wdir(T, x, y, z) { const l = Math.sqrt(x * x + y * y + z * z) || 1; T[C3.WD] = x / l; T[C3.WD + 1] = y / l; T[C3.WD + 2] = z / l; },
  // a hanging arm: the wrist below the shoulder in world terms, whatever the torso lean
  hang(T, side, D, swing, out, bend) {
    const lam = T[C3.PP] + T[C3.SP], L = (D.ua + D.fa) * (0.955 - (bend || 0) * 0.25);
    const f = Math.sin(lam) * L + swing, z = -Math.cos(lam) * L + Math.abs(swing) * 0.22 + (bend || 0) * 0.08;
    this.arm(T, side, f + (bend || 0) * 0.1, out, z, 0);
  },
  // ---- locomotion: gait cycle + idle, with arms swinging
  loco(T, S, D, P) {
    const g = this.gp; this.gaitParams(g, S.gw, S.v);
    const amp = Math.max(S.amp, S.turn), ph = S.ph, t = S.t, zomb = D.zomb;
    const zv = zomb ? this.zvar(S) : null;
    const stride = g[0] * (S.turn > S.amp ? 0.18 : 1), beta = g[1], travel = beta * stride * amp;
    const crouch = Math.max(P.crouch || 0, 0) * (S.gw[3] > 0.5 ? 0 : 1);
    // pelvis: height with bob (walks peak mid-stance, runs dip mid-stance), hip drop and sway toward the stance leg
    const c2 = Math.cos(2 * (ph - beta * Math.PI)), rb = g[7];
    let pz = D.hipH - g[5] * amp - crouch * 0.32 - (1 - rb) * g[6] * amp * (0.5 - 0.5 * c2) - rb * g[6] * amp * (0.5 + 0.5 * c2);
    const cs = Math.cos(ph - beta * Math.PI);
    let pr = g[13] * amp * cs * (D.fem ? 1.4 : 1), py = -g[14] * amp * cs;
    const pw = g[12] * amp * Math.cos(ph);
    // idle: breathing and a slow shift of weight from leg to leg
    const idle = 1 - amp, ws = Math.sin(t * 0.55 + S.id * 1.7);
    py += idle * 0.022 * ws; pr -= idle * 0.035 * ws;
    const lean = g[8] * amp + (P.lean || 0) * 0.5 + crouch * 0.35 + (zomb ? zv.lean : 0);
    T[C3.PX] = -lean * 0.05 + (crouch ? -0.04 : 0); T[C3.PY] = py; T[C3.PZ] = pz; T[C3.PR] = pr;
    T[C3.PP] = lean * 0.45 + crouch * 0.25;
    // hip lag behind the torso (set by the tracker) plus gait rotation
    const lag = S.preview ? 0 : U.angDiff(S.ang, S.hip);
    T[C3.PW] = lag + pw;
    T[C3.SP] = lean * 0.6 + 0.012 * Math.sin(t * 1.8 + S.id) * idle + (zomb ? 0.04 * Math.sin(ph * 2) * amp : 0);
    T[C3.SW] = -lag - pw - g[11] * amp * Math.cos(ph);
    T[C3.SR] = zomb ? zv.side + zv.sway * Math.sin(ph) * amp + 0.03 * Math.sin(t * 0.7 + S.id) * idle : 0;
    T[C3.HP] = -lean * 0.45 + (zomb ? zv.headP : 0);
    T[C3.HR] = (zomb ? zv.headR + 0.06 * Math.sin(t * 0.9 + S.id * 3) : 0) - T[C3.SR] * 0.6;
    T[C3.HW] = zomb ? 0.2 * Math.sin(t * 0.37 + S.id) * idle : 0;
    // ---- legs
    const Pf = this.pelvisOf(T, this.T1);
    const psi = S.preview || S.amp < 0.25 ? 0 : U.angDiff(S.ang, S.back ? S.mdir + Math.PI : S.mdir);
    const cps = Math.cos(psi), sps = Math.sin(psi);
    const limp = P.limp || 0, ls = P.limpSide || 1;
    let drop = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (const side of [-1, 1]) {
        let u = (ph / (Math.PI * 2) + (side > 0 ? 0.5 : 0)) % 1; if (u < 0) u += 1;
        const bad = limp && side === ls ? limp : 0;
        let lift = g[2] * (1 - bad * 0.85) * (zomb ? zv.lift[side < 0 ? 0 : 1] : 1), to = g[17] * (1 - bad * 0.6);
        // the cycle: stance glides back linearly (planted), swing comes forward with a lifted, retracting foot
        const Af = g[4] * travel, Ab = travel - Af;
        let x, z = 0, th;
        if (u < beta) {
          const k = u / beta;
          x = Af - k * travel;
          th = g[16] * amp * (1 - U.smooth(Math.min(1, k / 0.22))) - to * amp * U.smooth(Math.max(0, (k - 0.6) / 0.4));
        } else {
          const s = (u - beta) / (1 - beta), m = -travel / beta * (1 - beta) * 0.45, s2 = s * s, s3 = s2 * s;
          x = (2 * s3 - 3 * s2 + 1) * -Ab + (s3 - 2 * s2 + s) * m + (-2 * s3 + 3 * s2) * Af + (s3 - s2) * m;
          const pk = Math.log(0.5) / Math.log(g[3]);
          z = lift * amp * Math.sin(Math.PI * Math.pow(s, pk));
          th = s < 0.4 ? U.lerp(-to, -0.25 * (zomb ? 2 : 1), U.smooth(s / 0.4)) : U.lerp(-0.25 * (zomb ? 2 : 1), g[16], U.smooth((s - 0.4) / 0.6));
          th *= amp;
        }
        const r = this.rock(c3b, x, z, th, D);
        let ax = r[0], az = r[1];
        const w = g[15] * (zomb ? zv.wide : 1) + crouch * 0.03;
        let fx = ax * cps - side * w * sps, fy = ax * sps + side * w * cps;
        // stance legs must reach: a trailing foot rises onto its ball, a leading one lowers the hips
        if (u < beta) {
          const hx = Pf[0] + Pf[6] * side * D.hipW, hy = Pf[1] + Pf[7] * side * D.hipW, hz = Pf[2] + Pf[8] * side * D.hipW - drop;
          const dxy2 = (fx - hx) * (fx - hx) + (fy - hy) * (fy - hy), need = hz - Math.sqrt(Math.max(0, D.L * D.L - dxy2));
          if (az < need) {
            if (ax * cps < -0.02) {
              for (let it = 0; it < 8 && az < need; it++) { th -= 0.12; const r2 = this.rock(c3b, x, z, th, D); ax = r2[0]; az = r2[1]; }
              fx = ax * cps - side * w * sps; fy = ax * sps + side * w * cps;
            } else if (pass === 0) drop = Math.max(drop, Math.min(0.12, need - az));
          }
        }
        if (pass === 1) this.foot(T, Pf, side, fx, fy, az + bad * 0.01, th, 0.1 + (zomb ? zv.toe : 0));
      }
      if (pass === 0 && drop > 0) { T[C3.PZ] -= drop; this.pelvisOf(T, Pf); drop = 0; }
    }
    // ---- arms: swing opposite the legs (lagging a little), bent and pumping when running
    const A = g[9] * amp, bend = g[10];
    for (const side of [-1, 1]) {
      const sw = A * Math.cos(ph - 0.35) * -side;
      if (bend < 0.3) this.hang(T, side, D, sw * (1 - bend), 0.035 + bend * 0.04, bend);
      else {
        const k = (bend - 0.3) / 0.7;
        const f0 = Math.sin(T[C3.PP] + T[C3.SP]) * 0.45;
        this.arm(T, side, U.lerp(f0 + sw, 0.1 + sw * 1.3, k), U.lerp(0.035, 0.0 - Math.max(0, sw) * 0.25, k), U.lerp(-0.52 + Math.abs(sw) * 0.2, -0.32 + sw * 0.35, k), k * 0.2);
      }
    }
    this.wdir(T, 0.35, 0.05, -0.93);
  },
  // per-zombie quirks (how it shambles)
  zvar(S) {
    if (S.zv) return S.zv;
    const r = (k) => this.rnd(S.id, k + 20);
    const st = r(0), style = st < 0.3 ? 0 : st < 0.62 ? 1 : st < 0.82 ? 2 : 3;   // 0 hang, 1 half raised, 2 one arm up, 3 both reaching
    return (S.zv = { style, lean: 0.06 + r(1) * 0.2, side: (r(2) - 0.5) * 0.18, sway: 0.04 + r(3) * 0.06, headP: (r(4) - 0.4) * 0.35, headR: (r(5) - 0.5) * 0.5,
      lift: [0.5 + r(6) * 0.9, 0.5 + r(7) * 0.9], wide: 0.9 + r(8) * 0.5, toe: r(9) * 0.25, arm: r(10) < 0.5 ? -1 : 1, jaw: r(11) * 0.4 });
  },
  // ---- zombie arms: hanging, half raised, one reaching or both reaching (more when close to prey)
  zArms(T, S, D, P, force) {
    const zv = this.zvar(S), t = S.t, amp = S.amp, ph = S.ph;
    const reach = force || U.clamp((P.reach || 0) + (zv.style === 3 ? 0.75 : 0), 0, 1);
    for (const side of [-1, 1]) {
      const own = zv.style === 2 && side === zv.arm ? 0.85 : zv.style === 1 ? 0.45 : 0;
      const r = Math.max(reach, own) + 0.08 * Math.sin(t * 1.3 + side + S.id);
      const sw = 0.07 * amp * Math.cos(ph - 0.6) * -side + 0.025 * Math.sin(t * 1.1 + side * 2 + S.id);
      // hanging pose, then blend toward reaching forward at chest height
      this.hang(T, side, D, sw, 0.04, 0.05);
      const i = side < 0 ? C3.LW : C3.RW;
      const fx = 0.5 + 0.04 * Math.sin(t * 2.1 + side), fz = -0.08 + 0.05 * Math.sin(t * 1.7 + side * 1.3) + sw * 0.3, fy = -side * 0.03;
      const k = U.smooth(U.clamp(r, 0, 1));
      T[i] = U.lerp(T[i], fx, k); T[i + 1] = U.lerp(T[i + 1], fy, k); T[i + 2] = U.lerp(T[i + 2], fz, k); T[i + 3] = k;
    }
    T[C3.JAW] = zv.jaw + 0.25 * Math.max(0, Math.sin(t * 0.8 + S.id));
    this.wdir(T, 0.35, 0.05, -0.93);
  },
  // ---- zombie lunge and bite (prog 0..1, the bite lands at the end)
  zAttack(T, S, D, P) {
    this.zArms(T, S, D, P, 1);
    const p = U.clamp(P.prog === undefined ? S.mt / 0.7 : P.prog, 0, 1);
    const K = this.keys('zatk', () => ({
      ch: [C3.PX, C3.SP, C3.HP, C3.JAW, C3.LW, C3.LW + 1, C3.LW + 2, C3.RW, C3.RW + 1, C3.RW + 2, C3.PZ],
      t: [0, 0.45, 0.72, 0.88, 1],
      v: [0, 0.05, 0.0, 0.3, 0.42, 0.02, -0.06, 0.42, -0.02, -0.06, 0,
        -0.03, 0.18, -0.25, 0.5, 0.48, 0.04, 0.0, 0.48, -0.04, 0.0, -0.02,
        0.16, 0.42, -0.35, 1.0, 0.36, 0.1, -0.08, 0.36, -0.1, -0.08, -0.06,
        0.2, 0.5, 0.15, 0.25, 0.3, 0.13, -0.12, 0.3, -0.13, -0.12, -0.07,
        0.12, 0.35, 0.05, 0.4, 0.38, 0.06, -0.1, 0.38, -0.06, -0.1, -0.04],
    }));
    c3track(K, p, T, this.ADD_ATK || (this.ADD_ATK = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1]));
    T[C3.LE] = 0.8; T[C3.RE] = 0.8;
  },
  // ---- hit reaction: jerk back, step back, recover
  stagger(T, S, D, P) {
    const zomb = D.zomb;
    if (zomb) this.zArms(T, S, D, P); else this.upper(T, S, D, P);
    const p = U.clamp(P.prog === undefined ? S.mt / 0.5 : P.prog, 0, 1);
    const K = this.keys('stag', () => ({
      ch: [C3.PX, C3.SP, C3.HP, C3.JAW, C3.PZ, C3.SR],
      t: [0, 0.15, 0.5, 1],
      v: [0, 0, 0, 0, 0, 0,
        -0.08, -0.32, -0.45, 0.6, -0.03, 0.1,
        -0.12, -0.1, -0.15, 0.3, -0.05, 0.05,
        0, 0, 0, 0, 0, 0],
    }));
    c3track(K, p, T, [1, 1, 1, 0, 1, 1]);
    // arms fly up and out
    const k = Math.sin(Math.min(1, p / 0.6) * Math.PI);
    for (const side of [-1, 1]) { const i = side < 0 ? C3.LW : C3.RW; T[i] += 0.05 * k; T[i + 1] += side * 0.18 * k; T[i + 2] += 0.25 * k; }
    // a step back with the right foot
    const st = U.smooth(U.clamp((p - 0.1) / 0.4, 0, 1)) * (1 - U.smooth(U.clamp((p - 0.7) / 0.3, 0, 1)) * 0.6);
    const Pf = this.pelvisOf(T, this.T1), lift = Math.sin(U.clamp((p - 0.1) / 0.4, 0, 1) * Math.PI) * 0.07;
    this.foot(T, Pf, 1, -0.28 * st, D.hipW * 1.1, D.ankH + lift, -0.2 * lift * 5);
  },
  // ---- the player: holding, readying, swinging, aiming, shoving, stomping, working ...
  upper(T, S, D, P) {
    const arms = P.arms || 'idle', W = P.weapon ? WEAPON_MODELS[P.weapon] || WEAPON_MODELS.generic : null;
    const gun = W && W.gun, long = gun && P.weapon !== 'pistol', two = !!P.two && !gun;
    const t = S.t;
    if (arms === 'idle' || arms === 'hold') this.hold(T, P, W, 0.08 * S.amp * Math.cos(S.ph - 0.35));
    else if (arms === 'ready') this.ready(T, S, D, P, W, two);
    else if (arms === 'swing') this.swing(T, S, D, P, W, two);
    else if (arms === 'aim' || arms === 'fire') this.aim(T, S, D, P, long);
    else if (arms === 'shove') this.shove(T, S, D, P);
    else if (arms === 'stomp') this.stomp(T, S, D, P);
    else if (arms === 'work' || arms === 'loot' || arms === 'craft') {
      const o = Math.sin(t * 7) * 0.04;
      this.arm(T, 1, 0.34 + o, -0.1, -0.36, 0.6); this.arm(T, -1, 0.34 - o, -0.1, -0.34, 0.6);
      T[C3.HP] += 0.45; T[C3.SP] += 0.12; this.wdir(T, 0.6, 0, -0.8);
    } else if (arms === 'eat') {
      const k = 0.5 + 0.5 * Math.sin(t * 3);
      this.arm(T, 1, 0.2 + k * 0.05, -0.15, -0.25 + k * 0.27, 1); this.arm(T, -1, 0.26, -0.08, -0.3, 0.8);
      T[C3.HP] += 0.12 - k * 0.1; this.wdir(T, 0.3, -0.3, 0.9);
    } else if (arms === 'hammer') {
      const k = Math.abs(Math.sin(t * 6));
      this.arm(T, 1, 0.34, -0.08, -0.32 + k * 0.18, 0.6); this.wdir(T, 0.75, -0.1, 0.65 - k * 1.3);
      this.arm(T, -1, 0.4, -0.04, -0.4, 0.6); T[C3.HP] += 0.4; T[C3.SP] += 0.1;
    } else if (arms === 'drive') { this.arm(T, 1, 0.4, -0.08, -0.28, 0.5); this.arm(T, -1, 0.4, -0.08, -0.28, 0.5); }
    else if (arms === 'squat') {
      const k = 0.5 + 0.5 * Math.sin(t * 4);
      T[C3.PZ] -= k * 0.42; T[C3.PX] -= k * 0.1; T[C3.PP] += k * 0.3; T[C3.SP] += k * 0.2;
      this.arm(T, 1, 0.48, -0.1, -0.08, 1); this.arm(T, -1, 0.48, -0.1, -0.08, 1);
      this.stance(T, D, 0, 0, 0.13);
    }
    // a flashlight in the off hand points ahead
    if (P.offhand && (arms === 'idle' || arms === 'hold' || arms === 'work') && !T[C3.GR]) this.arm(T, -1, 0.32, -0.12, -0.24, 0.6);
    if (arms === 'climb') this.climb(T, S, D, P);
  },
  // holding a weapon (also the start and end of every swing); sw is the arm swing while walking
  hold(T, P, W, sw) {
    if (!W) return;
    const gun = W.gun, long = gun && P.weapon !== 'pistol', two = !!P.two && !gun;
    if (long) { this.arm(T, 1, 0.16 + sw * 0.3, -0.05, -0.36, 0.3); this.wdir(T, 0.7, -0.38, -0.6); T[C3.GR] = 1; T[C3.GO] = 0.33; }
    else if (two) { this.arm(T, 1, 0.14 + sw * 0.3, -0.04, -0.4, 0.3); this.wdir(T, 0.45, -0.55, 0.7); T[C3.GR] = 1; T[C3.GO] = P.weapon === 'spear' ? 0.45 : 0.3; }
    else if (gun) { this.arm(T, 1, 0.1 + sw, 0.0, -0.5, 0); this.wdir(T, 0.3, 0.05, -0.95); }
    else { this.arm(T, 1, 0.1 + sw, 0.02, -0.5, 0); this.wdir(T, 0.42, 0.1, -0.9); }
  },
  // feet planted side by side (or staggered), for poses that are not walking
  stance(T, D, lf, rf, w, lth, rth) {
    const Pf = this.pelvisOf(T, this.T1);
    this.foot(T, Pf, -1, lf, -(w || 0.1), D.ankH, lth || 0, 0.15);
    this.foot(T, Pf, 1, rf, w || 0.1, D.ankH, rth || 0, 0.2);
  },
  // keyframe tables are built once
  keys(name, mk) {
    const K = this.K || (this.K = {});
    if (!K[name]) { const k = mk(); k.v = new Float32Array(k.v); K[name] = k; }
    return K[name];
  },
  // ---- melee: ready stance (aiming), then the swing styles keyed around the contact moment (0.48)
  styleOf(P, W, two) {
    if (P.style) return P.style;
    if (!W) return 'punch';
    if (P.weapon === 'knife') return 'stab';
    if (P.weapon === 'spear') return 'spear';
    if (P.weapon === 'sledge') return 'heavy';
    return two ? '2h' : '1h';
  },
  ready(T, S, D, P, W, two) {
    const st = this.styleOf(P, W, two);
    if (st === '2h' || st === 'heavy' || st === 'floor' && two) { this.arm(T, 1, 0.1, -0.1, -0.16, 0.5); this.wdir(T, -0.25, 0.3, 0.92); T[C3.GR] = 1; T[C3.GO] = -0.1; }
    else if (st === 'spear') { this.arm(T, 1, 0.06, -0.04, -0.38, 0.4); this.wdir(T, 0.96, -0.2, 0.18); T[C3.GR] = 1; T[C3.GO] = 0.45; }
    else if (st === 'stab' || st === 'floorStab') { this.arm(T, 1, 0.3, -0.06, -0.3, 0.6); this.wdir(T, 0.95, -0.1, 0.25); this.arm(T, -1, 0.26, -0.08, -0.22, 1); }
    else if (st === 'punch') { this.arm(T, 1, 0.22, -0.1, -0.2, 1); this.arm(T, -1, 0.26, -0.1, -0.16, 1); T[C3.LH] = 1; }
    else { this.arm(T, 1, 0.16, 0.06, 0.0, 0.6); this.wdir(T, -0.2, 0.15, 0.97); this.arm(T, -1, 0.26, -0.06, -0.3, 0.6); }
    // knees soften, left foot forward
    if (S.amp < 0.3) { T[C3.PZ] -= 0.04; T[C3.SW] += 0.1; this.stance(T, D, 0.13, -0.1, 0.12, 0, 0); }
  },
  SWINGS: {
    // t, right wrist f s z, weapon dir x y z, grip offset, then additive: twist SW, bend SP, pelvis yaw PW, pelvis PX, pelvis PZ, head HP
    '2h': [[0, 0.1, -0.1, -0.16, -0.25, 0.3, 0.92, -0.1, 0, 0, 0, 0, -0.03, 0],
      [0.3, 0.0, 0.02, -0.1, -0.6, 0.45, 0.66, -0.1, 0.5, -0.04, 0.22, -0.05, -0.05, 0],
      [0.41, 0.2, -0.04, -0.22, -0.1, 0.98, 0.15, -0.1, 0.25, 0, -0.08, 0.0, -0.06, 0],
      [0.48, 0.4, -0.2, -0.26, 0.92, 0.38, 0.0, -0.1, -0.12, 0.04, -0.26, 0.05, -0.07, 0.05],
      [0.6, 0.3, -0.38, -0.2, 0.15, -0.97, 0.15, -0.1, -0.5, 0.04, -0.36, 0.05, -0.06, 0.05],
      [0.78, 0.1, -0.34, -0.06, -0.55, -0.45, 0.7, -0.1, -0.55, 0, -0.3, 0.03, -0.04, 0],
      [1, -1]],
    '1h': [[0, -1],
      [0.3, -0.04, 0.06, 0.02, -0.35, 0.2, 0.91, 0, 0.3, -0.06, 0.12, -0.04, -0.02, -0.05],
      [0.42, 0.2, 0.02, 0.02, 0.35, 0.05, 0.94, 0, 0.1, 0.02, 0, 0, -0.03, 0],
      [0.48, 0.42, -0.1, -0.2, 0.82, -0.12, -0.55, 0, -0.14, 0.12, -0.16, 0.05, -0.05, 0.08],
      [0.63, 0.26, -0.26, -0.45, 0.25, -0.55, -0.8, 0, -0.35, 0.18, -0.22, 0.04, -0.05, 0.1],
      [1, -1]],
    'stab': [[0, -1],
      [0.3, -0.02, 0.05, -0.28, 0.97, 0.0, 0.2, 0, 0.32, 0, 0.1, -0.04, -0.03, 0],
      [0.48, 0.52, -0.14, -0.2, 0.98, -0.12, 0.1, 0, -0.26, 0.1, -0.16, 0.09, -0.06, 0.05],
      [0.62, 0.5, -0.14, -0.22, 0.98, -0.12, 0.08, 0, -0.24, 0.1, -0.15, 0.08, -0.06, 0.05],
      [1, -1]],
    'spear': [[0, -1],
      [0.3, -0.1, 0.02, -0.36, 0.96, -0.15, 0.22, 0.45, 0.25, 0, 0.08, -0.06, -0.04, 0],
      [0.48, 0.38, -0.12, -0.26, 0.98, -0.14, 0.06, 0.45, -0.2, 0.12, -0.12, 0.12, -0.07, 0.04],
      [0.64, 0.36, -0.12, -0.27, 0.98, -0.14, 0.06, 0.45, -0.18, 0.12, -0.12, 0.11, -0.07, 0.04],
      [1, -1]],
    'heavy': [[0, -1],
      [0.36, 0.0, -0.06, 0.1, -0.55, 0.12, 0.82, -0.28, 0.1, -0.18, 0.08, -0.05, -0.02, -0.1],
      [0.5, 0.36, -0.14, -0.4, 0.68, -0.05, -0.73, -0.14, -0.1, 0.38, -0.06, 0.06, -0.12, 0.2],
      [0.66, 0.36, -0.14, -0.48, 0.55, -0.05, -0.83, -0.14, -0.1, 0.45, -0.06, 0.06, -0.14, 0.25],
      [1, -1]],
    'punch': [[0, 0.22, -0.1, -0.2, 0.3, 0, -0.9, 0, 0, 0, 0, 0, -0.03, 0],
      [0.3, 0.1, -0.03, -0.16, 0.3, 0, -0.9, 0, 0.28, 0, 0.1, -0.03, -0.04, 0],
      [0.48, 0.55, -0.17, -0.05, 0.3, 0, -0.9, 0, -0.36, 0.06, -0.16, 0.07, -0.05, 0],
      [0.62, 0.5, -0.16, -0.07, 0.3, 0, -0.9, 0, -0.3, 0.06, -0.14, 0.06, -0.05, 0],
      [1, 0.22, -0.1, -0.2, 0.3, 0, -0.9, 0, 0, 0, 0, 0, -0.03, 0]],
    'floor': [[0, -1],
      [0.36, 0.02, -0.04, 0.1, -0.4, 0.05, 0.92, -0.1, 0, -0.1, 0.05, -0.04, -0.02, 0.1],
      [0.52, 0.44, -0.16, -0.56, 0.5, -0.06, -0.86, -0.1, -0.06, 0.62, -0.05, 0.05, -0.16, 0.45],
      [0.68, 0.44, -0.16, -0.6, 0.45, -0.06, -0.89, -0.1, -0.06, 0.65, -0.05, 0.05, -0.17, 0.45],
      [1, -1]],
    'floorStab': [[0, -1],
      [0.32, 0.16, -0.02, -0.18, 0.5, 0, -0.86, 0, 0.1, 0.5, 0.02, -0.04, -0.3, 0.4],
      [0.52, 0.38, -0.12, -0.56, 0.25, -0.05, -0.97, 0, -0.1, 0.72, -0.05, 0.02, -0.38, 0.55],
      [0.68, 0.38, -0.12, -0.58, 0.25, -0.05, -0.97, 0, -0.1, 0.72, -0.05, 0.02, -0.38, 0.55],
      [1, -1]],
  },
  swing(T, S, D, P, W, two) {
    const st = this.styleOf(P, W, two), rows = this.SWINGS[st] || this.SWINGS['1h'], st2h = two && st !== 'stab';
    // the first and last keys are the holding pose (a row of [t, -1])
    const name = 'sw_' + st + (st2h ? '2' : '1') + (P.weapon || '');
    const K = this.keys(name, () => {
      const H = new Float32Array(C3.N); this.hold(H, P, W, 0);
      if (st === 'punch' || !W) { H[C3.RW] = 0.22; H[C3.RW + 1] = -0.1; H[C3.RW + 2] = -0.2; }
      const v = [], ts = [];
      for (const r of rows) {
        ts.push(r[0]);
        if (r[1] === -1) v.push(H[C3.RW], H[C3.RW + 1], H[C3.RW + 2], H[C3.WD], H[C3.WD + 1], H[C3.WD + 2], st2h ? H[C3.GO] || -0.1 : 0, 0, 0, 0, 0, 0, 0);
        else v.push(...r.slice(1));
      }
      return { t: ts, v, ch: [C3.RW, C3.RW + 1, C3.RW + 2, C3.WD, C3.WD + 1, C3.WD + 2, C3.GO, C3.SW, C3.SP, C3.PW, C3.PX, C3.PZ, C3.HP] };
    });
    // the base pose for the legs comes from loco; channels the swing owns are reset first
    T[C3.RE] = 0.4;
    c3track(K, U.clamp(P.swingT || 0, 0, 1), T, this.ADD_SW || (this.ADD_SW = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]));
    const l = Math.hypot(T[C3.WD], T[C3.WD + 1], T[C3.WD + 2]) || 1; T[C3.WD] /= l; T[C3.WD + 1] /= l; T[C3.WD + 2] /= l;
    T[C3.GR] = st2h ? 1 : 0;
    if (!st2h) {
      // the free arm balances: forward on the wind-up, back on the strike
      const k = Math.sin(U.clamp(P.swingT || 0, 0, 1) * Math.PI);
      if (st === 'punch') this.arm(T, -1, 0.26 - k * 0.08, -0.1, -0.16, 1), T[C3.LH] = 1;
      else this.arm(T, -1, 0.12 + k * 0.18, 0.06 + k * 0.08, -0.42 + k * 0.12, 0.3);
    }
    // standing still: a fighting stance with the weight moving through the swing
    if (S.amp < 0.3) this.stance(T, D, st === 'floorStab' ? 0.3 : 0.15, st === 'floorStab' ? -0.2 : -0.12, 0.12, 0, st === 'floorStab' ? -0.6 : 0);
  },
  // ---- firearms: two-handed pistol stance or rifle shouldered, with recoil
  aim(T, S, D, P, long) {
    const r = P.arms === 'fire' ? U.clamp(P.swingT || 0, 0, 1) : 1, kick = r < 0.12 ? r / 0.12 : Math.max(0, 1 - (r - 0.12) / 0.7);
    const k2 = kick * kick * (3 - 2 * kick);
    if (long) {
      T[C3.PW] += 0.32; T[C3.SW] += -0.18; T[C3.SP] += 0.05 - k2 * 0.05;
      const cy = -(T[C3.PW] + T[C3.SW]);
      this.arm(T, 1, 0.2 - k2 * 0.05, -0.07, -0.1 + k2 * 0.02, 0.7);
      this.wdir(T, Math.cos(cy), Math.sin(cy), 0.02 + k2 * 0.22);
      T[C3.GR] = 1; T[C3.GO] = 0.32; T[C3.HR] += 0.2; T[C3.HP] += 0.14; T[C3.HW] += 0.12;
    } else {
      T[C3.SP] += 0.04 - k2 * 0.04; T[C3.SW] += 0.05;
      const cy = -(T[C3.PW] + T[C3.SW]);
      this.arm(T, 1, 0.46 - k2 * 0.06, -0.15, -0.05 + k2 * 0.06, 0.6);
      this.wdir(T, Math.cos(cy), Math.sin(cy), k2 * 0.5);
      T[C3.GR] = 1; T[C3.GO] = -0.015; T[C3.HP] += 0.1;
    }
    T[C3.HP] -= k2 * 0.06;
    if (S.amp < 0.3) this.stance(T, D, 0.12, -0.1, 0.13);
  },
  // ---- shove: chamber, a two-handed push with a step of the left foot, recover (contact 0.4)
  shove(T, S, D, P) {
    const p = U.clamp(P.swingT || 0, 0, 1);
    const K = this.keys('shove', () => ({
      ch: [0, 1, 2, 3, C3.SP, C3.PX, C3.PZ],
      t: [0, 0.22, 0.4, 0.58, 1],
      v: [0.06, 0.05, -0.5, 0, 0, 0, 0,
        0.12, -0.06, -0.22, 1, -0.05, -0.03, -0.03,
        0.47, -0.07, -0.12, 1, 0.2, 0.13, -0.05,
        0.44, -0.07, -0.14, 1, 0.18, 0.12, -0.05,
        0.06, 0.05, -0.5, 0, 0, 0, 0],
    }));
    const o = this.tmpRow || (this.tmpRow = new Float32Array(C3.N));
    c3track(K, p, o);
    for (const side of [-1, 1]) this.arm(T, side, o[0], o[1], o[2], o[3]);
    T[C3.SP] += o[4]; T[C3.PX] += o[5]; T[C3.PZ] += o[6]; T[C3.LH] = 0;
    // the left foot steps in and back
    const out = U.smooth(U.clamp((p - 0.06) / 0.3, 0, 1)), back = U.smooth(U.clamp((p - 0.62) / 0.33, 0, 1)), st = out * (1 - back);
    const lift = Math.sin(U.clamp((p - 0.06) / 0.3, 0, 1) * Math.PI) * 0.07 + Math.sin(U.clamp((p - 0.62) / 0.33, 0, 1) * Math.PI) * 0.05;
    if (S.amp < 0.3) {
      const Pf = this.pelvisOf(T, this.T1);
      this.foot(T, Pf, -1, 0.02 + st * 0.3, -0.11, D.ankH + lift, lift * 2, 0.12);
      this.foot(T, Pf, 1, -0.06 - st * 0.04, 0.11, D.ankH, -st * 0.3, 0.2);
    }
  },
  // ---- stomp: knee up, drive the heel down onto the body in front (contact 0.5), step back
  stomp(T, S, D, P) {
    const p = U.clamp(P.swingT || 0, 0, 1), sd = U.clamp(P.stompD || 0.5, 0.35, 0.62);
    const K = this.keys('stomp', () => ({
      // right ankle x z (body), foot pitch, SP, PX, PY, PZ, HP, PR
      ch: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      t: [0, 0.32, 0.42, 0.5, 0.64, 1],
      v: [0.0, 0.075, 0, 0.0, 0, 0, 0, 0.1, 0,
        0.24, 0.42, 0.25, 0.2, -0.02, -0.05, -0.02, 0.35, -0.06,
        0.38, 0.33, 0.1, 0.28, 0.02, -0.04, -0.03, 0.45, -0.05,
        1.0, 0.075, 0.0, 0.38, 0.07, -0.01, -0.09, 0.55, -0.02,
        1.0, 0.075, 0.0, 0.36, 0.06, -0.01, -0.1, 0.55, -0.02,
        0.0, 0.075, 0, 0.0, 0, 0, 0, 0.1, 0],
    }));
    const o = this.tmpRow || (this.tmpRow = new Float32Array(C3.N));
    c3track(K, p, o);
    T[C3.SP] += o[3]; T[C3.PX] += o[4]; T[C3.PY] += o[5]; T[C3.PZ] += o[6]; T[C3.HP] += o[7]; T[C3.PR] += o[8];
    // arms out for balance, then swinging down with the stomp
    const k = Math.sin(p * Math.PI);
    this.hang(T, -1, D, 0.1 * k, 0.1 + 0.18 * k, 0.15);
    this.hang(T, 1, D, -0.12 * k, 0.08 + 0.12 * k, 0.15);
    if (!P.weapon) T[C3.LH] = 1;
    const Pf = this.pelvisOf(T, this.T1);
    const fx = o[0] > 0.9 ? sd * o[0] : o[0];
    this.foot(T, Pf, -1, -0.04, -0.12, D.ankH, 0, 0.15);
    this.foot(T, Pf, 1, fx, 0.07, o[1], o[2], 0.05);
  },
  // ---- climbing over a fence or through a window (prog 0..1)
  climb(T, S, D, P) {
    const p = U.clamp(P.prog === undefined ? (S.mt / 1.2) % 1 : P.prog, 0, 1), k = Math.sin(p * Math.PI);
    T[C3.PZ] += k * 0.3; T[C3.SP] += k * 0.45; T[C3.PX] += -0.05 * k; T[C3.HP] += 0.2 * k;
    this.arm(T, 1, 0.42, -0.04, -0.28 + k * 0.1, 0.8); this.arm(T, -1, 0.42, -0.04, -0.28 + k * 0.1, 0.8);
    const Pf = this.pelvisOf(T, this.T1);
    this.foot(T, Pf, 1, 0.25 * k + 0.05, 0.1, D.ankH + k * 0.45, -0.2 * k);
    this.foot(T, Pf, -1, -0.05 - 0.15 * k, -0.1, D.ankH + k * 0.15, -0.5 * k);
    T[C3.GR] = 0;
  },
  // ---- zombie banging on a door or window with its fists
  thump(T, S, D, P) {
    const t = S.t * 5;
    for (const side of [-1, 1]) {
      const k = Math.max(0, Math.sin(t + (side > 0 ? 0 : Math.PI)));
      this.arm(T, side, 0.32 + k * 0.18, -0.02, 0.0 + k * 0.12 - (1 - k) * 0.1, 1);
    }
    T[C3.SP] += 0.12; T[C3.HP] -= 0.1;
  },
  // ---- sitting on the ground and kneeling
  seated(T, S, D, P, mode) {
    const t = S.t;
    if (mode === 'sit') {
      T[C3.PX] = -0.12; T[C3.PZ] = 0.13; T[C3.PP] = -0.3; T[C3.SP] = 0.42 + 0.01 * Math.sin(t * 1.6); T[C3.HP] = 0.05;
      const Pf = this.pelvisOf(T, this.T1);
      this.foot(T, Pf, -1, 0.36, -0.15, D.ankH, 0.05, 0.25); this.foot(T, Pf, 1, 0.3, 0.16, D.ankH, 0.05, 0.3);
      this.arm(T, -1, 0.34, -0.06, -0.3, 0.8); this.arm(T, 1, 0.34, -0.06, -0.3, 0.8);
    } else {
      T[C3.PX] = -0.06; T[C3.PZ] = 0.47; T[C3.PP] = 0.12; T[C3.SP] = 0.32; T[C3.HP] = 0.45;
      const Pf = this.pelvisOf(T, this.T1);
      this.foot(T, Pf, -1, 0.3, -0.12, D.ankH, 0, 0.1); this.foot(T, Pf, 1, -0.4, 0.13, 0.1, -1.1, 0.15);
      const o = Math.sin(t * 6) * 0.04;
      this.arm(T, 1, 0.42 + o, -0.08, -0.5, 0.6); this.arm(T, -1, 0.4 - o, -0.06, -0.48, 0.6);
    }
    this.wdir(T, 0.5, 0, -0.85);
  },
  // ===================================================================== lying, falling, getting up
  // lying pose (dir 1 on the back, -1 face down), with per-body variation for corpses
  liePose(T, D, dir, id, vary) {
    T.fill(0);
    const r = (k) => this.rnd(id, k + 40), v = vary ? 1 : 0.25;
    const back = dir > 0;
    T[C3.PX] = (back ? -0.42 : 0.4) * D.H; T[C3.PZ] = back ? 0.105 : 0.12; T[C3.PP] = back ? -1.5 : 1.48;
    T[C3.PW] = (r(1) - 0.5) * 0.3 * v; T[C3.PR] = (r(2) - 0.5) * 0.25 * v;
    T[C3.SP] = back ? -0.06 : 0.04; T[C3.SR] = (r(3) - 0.5) * 0.4 * v; T[C3.SW] = (r(4) - 0.5) * 0.3 * v;
    // head rests turned to a side (face down it has to)
    const hs = r(5) < 0.5 ? -1 : 1;
    T[C3.HW] = back ? hs * (0.2 + r(6) * 0.9 * v) : hs * 1.25; T[C3.HP] = back ? -0.15 : -0.2; T[C3.HR] = back ? 0 : hs * 0.2;
    // legs a little apart, one knee bent and fallen out
    const bk = r(7) < 0.5 ? -1 : 1;
    for (const side of [-1, 1]) {
      const i = side < 0 ? C3.LA : C3.RA, bent = side === bk ? r(8) * 0.35 * v : 0;
      const L = D.thigh + D.shin, spread = 0.12 + r(9 + side) * 0.1 * v;
      T[i] = back ? -0.03 + bent * 0.5 : 0.02; T[i + 1] = side * spread; T[i + 2] = -L * (0.99 - bent);
      T[i + 3] = back ? 0.5 + bent * 1.2 : 0.2; T[i + 4] = back ? -0.55 : -1.2;
    }
    // arms: by the sides, out, or across the belly
    for (const side of [-1, 1]) {
      const q = r(12 + side), i = side < 0 ? C3.LW : C3.RW;
      const out = q < 0.35 ? 0.12 : q < 0.7 ? 0.42 + r(15 + side) * 0.2 : -0.1;
      const f = back ? (q >= 0.7 ? 0.14 : -0.06) : (q >= 0.7 ? -0.1 : 0.06), z = q < 0.35 ? -0.5 : q < 0.7 ? -0.26 + r(17) * 0.35 : -0.34;
      if (!vary) { T[i] = back ? -0.06 : 0.06; T[i + 1] = side * 0.14; T[i + 2] = -0.5; }
      else { T[i] = f; T[i + 1] = side * out; T[i + 2] = z; }
      T[i + 3] = 0.3;
    }
    if (!back && vary && r(19) < 0.5) { const i = r(20) < 0.5 ? C3.LW : C3.RW, side = i === C3.LW ? -1 : 1; T[i] = -0.02; T[i + 1] = side * 0.22; T[i + 2] = 0.3; }
    this.wdir(T, 0.3, 0.2, -0.9);
    T[C3.JAW] = D.zomb ? 0.4 : 0;
  },
  // standing, as the start of falls and the end of getting up
  standPose(T, D) {
    T.fill(0);
    T[C3.PZ] = D.hipH - 0.02;
    const Pf = this.pelvisOf(T, this.T2);
    for (const side of [-1, 1]) this.foot(T, Pf, side, 0, side * 0.1, D.ankH, 0, 0.1);
    this.hang(T, -1, D, 0, 0.04, 0.05); this.hang(T, 1, D, 0, 0.04, 0.05);
    this.wdir(T, 0.35, 0.05, -0.93);
  },
  // full-body keyframes; each key is built by a function writing a pose vector
  bodyKeys(S, name, D, fns, ts) {
    const K = S.K || (S.K = {}), k = name;
    if (K[k]) return K[k];
    const N = C3.N, v = new Float32Array(N * fns.length), tmp = new Float32Array(N);
    fns.forEach((f, i) => { f(tmp); v.set(tmp, i * N); });
    const ch = []; for (let i = 0; i < N; i++) ch.push(i);
    return (K[k] = { t: ts, v, ch });
  },
  lying(T, S, D, P, mode) {
    const dir = P.lieDir || 1, vary = mode === 'dead';
    if (mode === 'sleep') {
      this.liePose(T, D, 1, S.id, false);
      T[C3.PX] = (P.lieOff ? 0.02 : -0.42) * D.H; T[C3.PZ] += P.lieOff ? 0.1 : 0; T[C3.HW] = 0.25;
      T[C3.SP] = -0.04 + 0.015 * Math.sin(S.t * 1.2);
      return;
    }
    // falling: from standing (or whatever we were doing: the blend offset carries it) to the ground
    const dur = mode === 'dead' ? 0.85 : 0.65;
    let p = P.prog !== undefined ? P.prog : S.fresh && S.mt === 0 ? 1 : U.clamp(S.mt / dur, 0, 1);
    if (S.fresh) p = P.prog !== undefined ? P.prog : 1;
    if (p < 1) {
      const self = this;
      const K = this.bodyKeys(S, (dir > 0 ? 'fallB' : 'fallF') + (vary ? 'd' : ''), D, [
        (A) => self.standPose(A, D),
        (A) => {
          self.standPose(A, D);
          A[C3.PX] = -0.1 * dir; A[C3.PZ] = D.hipH * 0.7; A[C3.PP] = -0.4 * dir; A[C3.SP] = -0.1 * dir; A[C3.HP] = 0.3 * dir;
          const Pf = self.pelvisOf(A, self.T2);
          self.foot(A, Pf, -1, 0.05 * dir, -0.12, D.ankH, 0); self.foot(A, Pf, 1, 0.0, 0.12, D.ankH, -0.2);
          self.arm(A, -1, 0.3, 0.12, 0.05, 0.5); self.arm(A, 1, 0.3, 0.18, 0.1, 0.5);
        },
        (A) => {
          self.liePose(A, D, dir, S.id, vary);
          A[C3.PX] = -0.3 * dir; A[C3.PZ] = 0.16 + (dir < 0 ? 0.2 : 0); A[C3.PP] = -0.95 * dir; A[C3.SP] = -0.25 * dir; A[C3.HP] = dir > 0 ? 0.2 : -0.3;
          for (const side of [-1, 1]) { const i = side < 0 ? C3.LA : C3.RA; A[i] = dir > 0 ? 0.42 : -0.3; A[i + 1] = side * 0.13; A[i + 2] = -0.55; A[i + 4] = 0; }
          self.arm(A, -1, dir > 0 ? -0.18 : 0.35, 0.2, -0.32, 0.4); self.arm(A, 1, dir > 0 ? -0.15 : 0.35, 0.22, -0.3, 0.4);
        },
        (A) => { self.liePose(A, D, dir, S.id, vary); A[C3.HP] += dir > 0 ? -0.3 : 0.2; A[C3.PZ] += 0.02; for (const i of [C3.LA, C3.RA]) A[i] += 0.12; },
        (A) => self.liePose(A, D, dir, S.id, vary),
      ], [0, 0.3, 0.58, 0.82, 1]);
      c3track(K, p, T);
      return;
    }
    this.liePose(T, D, dir, S.id, vary);
    if (mode !== 'dead' && D.zomb) {
      // a downed zombie keeps moving: head lifts, arms paw, a knee draws up
      const t = S.t + S.id;
      T[C3.HP] += (dir > 0 ? 0.3 : 0) * (0.5 + 0.5 * Math.sin(t * 1.7)); T[C3.SP] += dir > 0 ? 0.08 * Math.max(0, Math.sin(t * 1.3)) : 0;
      T[C3.LW] += 0.08 * Math.sin(t * 2.3); T[C3.RW + 2] += 0.1 * Math.sin(t * 1.9 + 1); T[C3.LA] += 0.12 * Math.max(0, Math.sin(t * 1.1));
      T[C3.JAW] = 0.3 + 0.3 * Math.max(0, Math.sin(t * 2.7));
    }
  },
  // getting up: from the back - sit up, onto a knee, rise; from the front - push up, kneel, rise
  getup(T, S, D, P) {
    const dir = P.lieDir || 1, p = U.clamp(P.prog === undefined ? S.mt / 1.3 : P.prog, 0, 1), self = this;
    const kneel = (A, px, pz, pp, sp) => {
      A.fill(0); A[C3.PX] = px; A[C3.PZ] = pz; A[C3.PP] = pp; A[C3.SP] = sp; A[C3.HP] = -0.25;
      const Pf = self.pelvisOf(A, self.T2);
      self.foot(A, Pf, -1, 0.22, -0.13, D.ankH, 0, 0.1);
      self.foot(A, Pf, 1, -0.36 + px * 0.3, 0.14, 0.09, -1.15, 0.15);
    };
    const K = this.bodyKeys(S, dir > 0 ? 'getB' : 'getF', D, dir > 0 ? [
      (A) => self.liePose(A, D, 1, S.id, false),
      (A) => {
        A.fill(0); A[C3.PX] = -0.34; A[C3.PZ] = 0.12; A[C3.PP] = -0.7; A[C3.SP] = 0.85; A[C3.HP] = -0.1;
        const Pf = self.pelvisOf(A, self.T2);
        self.foot(A, Pf, -1, 0.05, -0.15, D.ankH, 0.1, 0.4); self.foot(A, Pf, 1, 0.12, 0.17, D.ankH, 0.1, 0.4);
        self.arm(A, -1, -0.22, 0.12, -0.45, 0.2); self.arm(A, 1, -0.2, 0.14, -0.45, 0.2);
      },
      (A) => { kneel(A, -0.14, 0.42, 0.35, 0.5); A[C3.PW] = 0.2; self.arm(A, -1, 0.42, 0.0, -0.5, 0.6); self.arm(A, 1, 0.34, -0.02, -0.42, 0.6); },
      (A) => {
        A.fill(0); A[C3.PX] = -0.05; A[C3.PZ] = D.hipH * 0.72; A[C3.PP] = 0.3; A[C3.SP] = 0.38; A[C3.HP] = -0.2;
        const Pf = self.pelvisOf(A, self.T2);
        self.foot(A, Pf, -1, 0.14, -0.13, D.ankH, 0); self.foot(A, Pf, 1, -0.1, 0.13, D.ankH, -0.15);
        self.arm(A, -1, 0.3, -0.02, -0.44, 0.5); self.arm(A, 1, 0.3, -0.02, -0.44, 0.5);
      },
      (A) => self.standPose(A, D),
    ] : [
      (A) => self.liePose(A, D, -1, S.id, false),
      (A) => {
        self.liePose(A, D, -1, S.id, false);
        A[C3.PZ] = 0.14; A[C3.PP] = 1.25; A[C3.SP] = -0.55; A[C3.HP] = -0.4; A[C3.HW] = 0; A[C3.HR] = 0;
        self.arm(A, -1, 0.28, 0.0, -0.42, 0.5); self.arm(A, 1, 0.28, 0.0, -0.42, 0.5);
      },
      (A) => {
        A.fill(0); A[C3.PX] = -0.18; A[C3.PZ] = 0.4; A[C3.PP] = 1.0; A[C3.SP] = 0.1; A[C3.HP] = -0.6;
        for (const side of [-1, 1]) { const i = side < 0 ? C3.LA : C3.RA; A[i] = -0.32; A[i + 1] = side * 0.13; A[i + 2] = -0.36; A[i + 3] = 0.1; A[i + 4] = -1.3; }
        self.arm(A, -1, 0.42, 0.0, -0.36, 0.5); self.arm(A, 1, 0.42, 0.0, -0.36, 0.5);
      },
      (A) => { kneel(A, -0.08, 0.5, 0.3, 0.4); self.arm(A, -1, 0.3, -0.02, -0.44, 0.5); self.arm(A, 1, 0.3, -0.02, -0.44, 0.5); },
      (A) => self.standPose(A, D),
    ], [0, 0.25, 0.5, 0.76, 1]);
    c3track(K, p, T);
    if (D.zomb) T[C3.JAW] = 0.3;
  },
  // crawling face down: arms reach ahead and drag the body, legs trail
  crawl(T, S, D, P) {
    this.liePose(T, D, -1, S.id, false);
    const ph = S.ph * 2.2, amp = Math.max(0.25, S.amp), t = S.t;
    T[C3.PX] = 0.1; T[C3.HW] = 0; T[C3.HR] = 0; T[C3.HP] = -0.75; T[C3.SP] = -0.12; T[C3.PZ] = 0.13 + 0.015 * Math.abs(Math.sin(ph)) * amp;
    T[C3.SW] = 0.12 * Math.sin(ph) * amp; T[C3.PW] = -0.06 * Math.sin(ph) * amp;
    for (const side of [-1, 1]) {
      const c = Math.sin(ph + (side < 0 ? 0 : Math.PI)) * amp, i = side < 0 ? C3.LW : C3.RW;
      // reach ahead (along the body, above the head), lifted on the way forward, pulling back along the ground
      const up = Math.max(0, Math.cos(ph + (side < 0 ? 0 : Math.PI))) * amp;
      T[i] = 0.02 - up * 0.12; T[i + 1] = side * (0.08 + 0.04 * c); T[i + 2] = 0.12 + c * 0.24; T[i + 3] = 0.5;
      const j = side < 0 ? C3.LA : C3.RA, k = Math.max(0, -c);
      T[j + 2] += k * 0.18; T[j] += -k * 0.12;
    }
    T[C3.JAW] = 0.4 + 0.3 * Math.max(0, Math.sin(t * 2.3 + S.id));
  },
  // ===================================================================== model
  // colours for a look (cached per look object)
  pal(look, D) {
    let Pl = this.pals.get(look);
    if (Pl && Pl.b0 === look.blood) return Pl;
    const rgb = (h) => this.rgb(h), zomb = !!look.zombie;
    let skin = rgb(look.skin || '#d8a878');
    if (zomb) skin = this.mix(skin, [0.5, 0.56, 0.44], 0.3);
    const blood = Math.min(1, look.blood || 0), bl = [0.36, 0.05, 0.04];
    let shirt = rgb(look.shirt || look.skin), jacket = look.jacket ? rgb(look.jacket) : null, pants = rgb(look.pants || look.skin);
    if (blood > 0) { shirt = this.mix(shirt, bl, blood * 0.12); pants = this.mix(pants, bl, blood * 0.06); if (jacket) jacket = this.mix(jacket, bl, blood * 0.08); }
    const shoes = rgb(look.shoes || '#2a2a2a'), hair = rgb(look.hair || '#3a2a1a');
    Pl = {
      skin, skinD: this.sc(skin, 0.84), lip: zomb ? [0.2, 0.06, 0.06] : this.mix(this.sc(skin, 0.72), [0.55, 0.2, 0.2], 0.25), eye: zomb ? [0.16, 0.05, 0.04] : [0.07, 0.05, 0.04],
      eyeW: zomb ? [0.62, 0.6, 0.42] : [0.86, 0.84, 0.8], hair, brow: this.sc(hair, 0.8), shirt, shirtD: this.sc(shirt, 0.82),
      jacket, jacketD: jacket ? this.sc(jacket, 0.8) : null, pants, pantsD: this.sc(pants, 0.78), belt: [0.16, 0.12, 0.1], buckle: [0.6, 0.6, 0.56],
      shoes, sole: this.sc(shoes, 0.55), hand: look.gloves ? rgb(look.gloves) : skin, vest: look.vest ? rgb(look.vest) : null,
      bag: look.bag ? rgb(look.bag) : null, bagD: look.bag ? this.sc(rgb(look.bag), 0.75) : null, hat: look.hat ? rgb(look.hat.col || '#444') : null,
      blood: bl, bloodD: [0.25, 0.03, 0.03], wound: [0.42, 0.1, 0.09], glass: [0.08, 0.08, 0.09],
    };
    Pl.b0 = look.blood;
    Pl.sleeve = look.jacket || look.sleeves === 'long' ? (jacket || shirt) : skin;
    Pl.upper = look.sleeves === 'none' && !look.jacket ? skin : (jacket || shirt);
    this.pals.set(look, Pl);
    return Pl;
  },
  // pose -> joints -> primitives into a new atlas cell
  render(S, ang, look, P, light, flash) {
    const mk = GL3D.mark(this.mk);
    C3B.x0 = -12; C3B.x1 = 12; C3B.y0 = -8; C3B.y1 = 6;
    const sh = this.build(S, ang, look, P);
    const cell = GL3D.cell(C3B.x1 - C3B.x0 + 4, C3B.y1 - C3B.y0 + 4, 2 - C3B.x0, 2 - C3B.y0);
    if (!cell) { GL3D.undo(mk); return null; }
    GL3D.seal(cell, mk, light, flash);
    cell.shadow = sh;
    return cell;
  },
  // two-bone IK in model space: knee/elbow for a limb from A toward target Tg (lengths a, b), bending toward pole
  ik(A, Tg, a, b, px, py, pz, J, E) {
    let dx = Tg[0] - A[0], dy = Tg[1] - A[1], dz = Tg[2] - A[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    dx /= d; dy /= d; dz /= d;
    const dm = Math.max(Math.abs(a - b) + 0.01, Math.min(d, (a + b) * 0.999));
    const x = (a * a - b * b + dm * dm) / (2 * dm), r = Math.sqrt(Math.max(0, a * a - x * x));
    const pd = px * dx + py * dy + pz * dz;
    let qx = px - dx * pd, qy = py - dy * pd, qz = pz - dz * pd;
    const ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
    qx /= ql; qy /= ql; qz /= ql;
    J[0] = A[0] + dx * x + qx * r; J[1] = A[1] + dy * x + qy * r; J[2] = A[2] + dz * x + qz * r;
    E[0] = A[0] + dx * dm; E[1] = A[1] + dy * dm; E[2] = A[2] + dz * dm;
  },
  build(S, ang, look, Pose) {
    const T = S.cur, D = S.D, Pl = this.pal(look, D), H = D.H, bw = D.bw, fem = D.fem, zomb = D.zomb;
    const det = GL3D.scale >= 1.5 ? 2 : GL3D.scale >= 0.85 ? 1 : 0;
    const B = c3body(this.B, ang), Pf = this.P, Lf = this.L, Cf = this.C, NB = this.NB, Hf = this.H;
    const BOX = GL3D.BOX, RB = GL3D.RBOX, CY = GL3D.CYL, SP = GL3D.SPH;
    // ---- skeleton
    c3loc(Pf, B, T[0], T[1], T[2]); c3yaw(Pf, T[5]); c3pitch(Pf, -T[3]); c3roll(Pf, -T[4]);
    c3loc(Lf, Pf, 0, 0, D.sp0); c3yaw(Lf, T[8] * 0.45); c3pitch(Lf, -T[6] * 0.5); c3roll(Lf, -T[7] * 0.5);
    c3loc(Cf, Lf, 0, 0, D.sp1); c3yaw(Cf, T[8] * 0.55); c3pitch(Cf, -T[6] * 0.5); c3roll(Cf, -T[7] * 0.5);
    c3loc(NB, Cf, -0.012, 0, D.shZ + 0.02); c3yaw(NB, T[11] * 0.4); c3pitch(NB, -T[9] * 0.4); c3roll(NB, -T[10] * 0.4);
    c3loc(Hf, NB, 0.012, 0, D.neck); c3yaw(Hf, T[11] * 0.6); c3pitch(Hf, -T[9] * 0.6); c3roll(Hf, -T[10] * 0.6);
    const jk = !!look.jacket, sl = look.sleeves, shorts = !!look.shorts;
    // ---- legs
    const thR = 0.088 * bw, knR = 0.058 * bw, anR = 0.04 * bw, pantR = shorts ? 0 : 0.008;
    const ankL = c3AL, ankR = c3AR;
    for (const side of [-1, 1]) {
      const i = side < 0 ? C3.LA : C3.RA;
      const hip = c3pt(c3a, Pf, 0, side * D.hipW, 0), tg = c3pt(c3b, Pf, T[i], T[i + 1], T[i + 2]);
      // knee bends toward the pelvis' front, twisted outward by the leg twist
      const tw = T[i + 3] * side, pole = c3dir(c3c, Pf, Math.cos(tw), Math.sin(tw), 0);
      const kn = c3d, an = c3e;
      this.ik(hip, tg, D.thigh, D.shin, pole[0], pole[1], pole[2], kn, an);
      const fx = Pf[3], fy = Pf[4], fz = Pf[5];
      c3seg(CY, hip, kn, thR + pantR, thR * 0.92 + pantR, shorts ? Pl.skin : Pl.pants, 1, 0.68, fx, fy, fz);
      if (shorts) { c3g[0] = hip[0] + (kn[0] - hip[0]) * 0.62; c3g[1] = hip[1] + (kn[1] - hip[1]) * 0.62; c3g[2] = hip[2] + (kn[2] - hip[2]) * 0.62; c3seg(CY, hip, c3g, thR + 0.012, thR + 0.008, Pl.pants, 1, 0.88, fx, fy, fz); }
      c3emit(SP, kn[0], kn[1], kn[2], knR + pantR, 0, 0, 0, knR + pantR, 0, 0, 0, knR + pantR, shorts ? Pl.skin : Pl.pants, 1, 1);
      c3seg(CY, kn, an, knR * (shorts ? 0.98 : 1) + pantR, knR * 0.95 + pantR, shorts ? Pl.skin : Pl.pants, 1, shorts ? 0.68 : 0.88, fx, fy, fz);
      // foot: pitch in the pelvis frame, turned out by the leg twist
      const fp = T[i + 4], ct = Math.cos(fp), stt = Math.sin(fp), ft = 0.12 * side + tw * 0.5;
      const fd = c3dir(c3g, Pf, ct * Math.cos(ft), ct * Math.sin(ft), stt);
      // the foot's top faces back up the shin
      let ux = kn[0] - an[0], uy = kn[1] - an[1], uz = kn[2] - an[2];
      const fl = 0.13 * H, cx = an[0] + fd[0] * 0.055, cy = an[1] + fd[1] * 0.055, cz = an[2] + fd[2] * 0.055;
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const dd = ux * fd[0] + uy * fd[1] + uz * fd[2];
      let tx = ux - fd[0] * dd, ty = uy - fd[1] * dd, tz = uz - fd[2] * dd; const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const sx = fd[1] * tz - fd[2] * ty, sy = fd[2] * tx - fd[0] * tz, sz = fd[0] * ty - fd[1] * tx;
      const hh = 0.042, wdt = 0.048 * (fem ? 0.9 : 1);
      c3emit(RB, cx - tx * 0.035, cy - ty * 0.035, cz - tz * 0.035, tx * hh, ty * hh, tz * hh, sx * wdt, sy * wdt, sz * wdt, fd[0] * fl, fd[1] * fl, fd[2] * fl, Pl.shoes, 1.05, 0.78);
      if (det > 1) c3emit(BOX, cx - tx * 0.07, cy - ty * 0.07, cz - tz * 0.07, tx * 0.008, ty * 0.008, tz * 0.008, sx * (wdt + 0.004), sy * (wdt + 0.004), sz * (wdt + 0.004), fd[0] * (fl + 0.006), fd[1] * (fl + 0.006), fd[2] * (fl + 0.006), Pl.sole, 1, 0.82);
      const ak = side < 0 ? c3AL : c3AR; ak[0] = an[0]; ak[1] = an[1]; ak[2] = an[2];
    }
    // ---- pelvis, belt, torso
    c3box(RB, Pf, -0.012, 0, 0.035, 0.108 * bw, (fem ? 0.172 : 0.162) * bw, 0.115, Pl.pants, 1, 0.96);
    const chW = (fem ? 0.152 : 0.172) * bw, chD = (fem ? 0.1 : 0.112) * bw, waW = (fem ? 0.13 : 0.148) * bw, jx = jk ? 0.014 : 0;
    if (!jk) c3box(RB, Pf, -0.008, 0, 0.13, 0.108 * bw, 0.158 * bw, 0.018, Pl.belt);
    if (!jk && det > 1) c3box(BOX, Pf, 0.1 * bw, 0, 0.13, 0.008, 0.022, 0.014, Pl.buckle);
    const tor = jk ? Pl.jacket : Pl.shirt;
    c3box(RB, Lf, 0.0, 0, 0.07, 0.098 * bw + jx, waW + jx, 0.11, tor, 1, 1.06);
    c3box(RB, Cf, 0.004, 0, 0.11 * H, chD + jx, chW + jx, 0.15 * H, tor, 0.84, 1);
    if (fem) c3box(RB, Cf, chD * 0.62 + jx, 0, 0.1 * H, 0.05, chW * 0.75, 0.05, tor);
    if (jk) {
      // open jacket: the shirt shows down the front, the hem hangs over the belt, a collar stands up
      c3box(RB, Lf, -0.004, 0, -0.035, 0.108 * bw + jx, waW + jx + 0.012, 0.06, Pl.jacket, 1.04, 1);
      c3box(BOX, Cf, chD + jx + 0.002, 0, 0.06 * H, 0.004, 0.032, 0.17 * H, Pl.shirt, 1, 1);
      c3box(CY, Cf, -0.014, 0, D.shZ + 0.025, 0.074, 0.084, 0.03, Pl.jacketD, 1.04, 0.92);
    } else if (det > 0) c3box(CY, Cf, -0.008, 0, D.shZ + 0.012, 0.064, 0.07, 0.014, Pl.shirtD, 1, 0.95);
    if (look.vest) c3box(RB, Cf, 0.004, 0, 0.02, chD + jx + 0.016, chW + jx + 0.012, 0.21 * H, Pl.vest, 0.92, 1);
    // blood on the clothes; zombies get torn holes showing grey skin
    const blood = Math.min(1, look.blood || 0);
    if (blood > 0.05) {
      const fr = chD + jx + (look.vest ? 0.016 : 0), n = det > 0 ? 1 + Math.round(blood * 2.2) : 1;
      for (let k = 0; k < n; k++) {
        const ry = (this.rnd(S.id, 60 + k) - 0.5) * chW * 1.3, rz = 0.02 + this.rnd(S.id, 64 + k) * 0.22, rr = 0.025 + this.rnd(S.id, 68 + k) * 0.03 * (0.5 + blood);
        c3box(SP, Cf, fr * 0.96, ry, rz, 0.012, rr, rr * 1.2, k ? Pl.bloodD : Pl.blood);
      }
    }
    if (zomb && det > 0) {
      const r = (k) => this.rnd(S.id, 80 + k);
      if (r(0) < 0.45) c3box(SP, Lf, 0.096 * bw + jx * 0.6, (r(1) - 0.5) * 0.18, 0.06 + r(2) * 0.1, 0.012, 0.035 + r(3) * 0.02, 0.03, Pl.skin);
      if (r(4) < 0.4) c3box(SP, Cf, -chD * 0.9, (r(5) - 0.5) * 0.2, 0.12, 0.012, 0.04, 0.035, Pl.skinD);
    }
    // backpack with straps
    if (Pl.bag) {
      const bx = -(chD + jx + 0.065);
      c3box(RB, Cf, bx, 0, 0.06 * H, 0.07, 0.13, 0.17 * H, Pl.bag);
      c3box(RB, Cf, bx - 0.005, 0, 0.2 * H, 0.074, 0.122, 0.05, Pl.bagD);
      if (det > 0) for (const side of [-1, 1]) { c3pt(c3a, Cf, chD + jx + 0.004, side * 0.09, 0.04); c3pt(c3b, Cf, -0.02, side * 0.1, D.shZ + 0.035); c3seg(BOX, c3a, c3b, 0.008, 0.02, Pl.bagD, 1, 1, Cf[3], Cf[4], Cf[5]); }
    }
    // ---- neck and head
    c3pt(c3a, NB, 0, 0, -0.03); c3pt(c3b, Hf, 0.0, 0, 0.03);
    c3seg(CY, c3a, c3b, 0.05 * (fem ? 0.9 : 1), 0.052 * (fem ? 0.9 : 1), Pl.skin, 1.05, 0.95, NB[3], NB[4], NB[5]);
    if (zomb && det > 0 && this.rnd(S.id, 90) < 0.5) c3box(SP, NB, 0.035, (this.rnd(S.id, 91) - 0.5) * 0.06, 0.03, 0.018, 0.03, 0.025, Pl.wound);
    this.head(Hf, look, Pl, D, S, T, det);
    // ---- arms
    const ua = D.ua, fa = D.fa, Wm = Pose.weapon ? WEAPON_MODELS[Pose.weapon] || WEAPON_MODELS.generic : null;
    let handR = null, wd = null;
    for (const side of [1, -1]) {
      const i = side < 0 ? C3.LW : C3.RW;
      const S0 = c3pt(c3S0, Cf, -0.012, side * D.shW, D.shZ);
      const tg = c3TG;
      if (side < 0 && T[C3.GR] > 0.01 && handR && wd) {
        // the left hand on the weapon: slide along it from the right fist; a pistol is cupped from below
        const go = T[C3.GO];
        let gx = handR[0] + wd[0] * go, gy = handR[1] + wd[1] * go, gz = handR[2] + wd[2] * go;
        if (Math.abs(go) < 0.05) { gx -= Cf[6] * 0.035 + Cf[9] * 0.035; gy -= Cf[7] * 0.035 + Cf[10] * 0.035; gz -= Cf[8] * 0.035 + Cf[11] * 0.035; }
        // wrist sits behind the fist toward the shoulder
        let vx = gx - S0[0], vy = gy - S0[1], vz = gz - S0[2]; const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
        gx -= vx / vl * 0.06; gy -= vy / vl * 0.06; gz -= vz / vl * 0.06;
        c3pt(tg, Cf, -0.012 + T[i], side * D.shW + T[i + 1], D.shZ + T[i + 2]);
        const g = U.clamp(T[C3.GR], 0, 1);
        tg[0] += (gx - tg[0]) * g; tg[1] += (gy - tg[1]) * g; tg[2] += (gz - tg[2]) * g;
      } else c3pt(tg, Cf, -0.012 + T[i], side * D.shW + T[i + 1], D.shZ + T[i + 2]);
      const el = U.clamp(T[i + 3], 0, 1);
      const pole = c3dir(c3c, Cf, -1 + el * 0.75, side * (0.32 + el * 0.4), -0.25 - el * 0.6);
      const E = c3E, Wr = c3W;
      this.ik(S0, tg, ua, fa, pole[0], pole[1], pole[2], E, Wr);
      const sleeve = Pl.sleeve, up = Pl.upper;
      // shoulder cap, upper arm (short sleeves end half way), elbow, forearm, cuff, hand
      c3box(SP, Cf, -0.012, side * (D.shW - 0.01), D.shZ + 0.01, 0.064 * bw + jx, 0.06 * bw + jx, 0.06 + jx, up);
      const torn = zomb && this.rnd(S.id, 95 + side) < 0.22;
      c3seg(CY, S0, E, 0.05 * bw + (sl === 'long' || jk ? jx * 0.5 + 0.004 : 0), 0.048 * bw, torn ? Pl.skin : sleeve === Pl.skin ? Pl.skin : sleeve, 1, 0.84, Cf[3], Cf[4], Cf[5]);
      if (!torn && sleeve === Pl.skin && up !== Pl.skin) {
        c3g[0] = S0[0] + (E[0] - S0[0]) * 0.5; c3g[1] = S0[1] + (E[1] - S0[1]) * 0.5; c3g[2] = S0[2] + (E[2] - S0[2]) * 0.5;
        c3seg(CY, S0, c3g, 0.06 * bw, 0.058 * bw, up, 1, 0.94, Cf[3], Cf[4], Cf[5]);
      }
      if (torn && det > 0) { c3g[0] = (S0[0] + E[0]) / 2; c3g[1] = (S0[1] + E[1]) / 2; c3g[2] = (S0[2] + E[2]) / 2; c3emit(SP, c3g[0], c3g[1], c3g[2], 0.03, 0, 0, 0, 0.03, 0, 0, 0, 0.04, Pl.wound, 1, 1); }
      const eR = 0.042 * bw + (sleeve !== Pl.skin && !torn ? 0.004 : 0);
      c3emit(SP, E[0], E[1], E[2], eR, 0, 0, 0, eR, 0, 0, 0, eR, torn ? Pl.skin : sleeve, 1, 1);
      c3seg(CY, E, Wr, 0.043 * bw + (sleeve !== Pl.skin ? 0.004 : 0), 0.04 * bw, sleeve, 1, 0.78, Cf[3], Cf[4], Cf[5]);
      // forearm direction
      let ax = Wr[0] - E[0], ay = Wr[1] - E[1], az = Wr[2] - E[2]; const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1; ax /= al; ay /= al; az /= al;
      if (sleeve !== Pl.skin && det > 1) { c3a[0] = Wr[0] - ax * 0.035; c3a[1] = Wr[1] - ay * 0.035; c3a[2] = Wr[2] - az * 0.035; c3seg(CY, c3a, Wr, 0.038 * bw, 0.038 * bw, jk ? Pl.jacketD : Pl.shirtD, 1, 1, Cf[3], Cf[4], Cf[5]); }
      // hand: a flat hand hangs palm in; a fist round a grip faces along the weapon
      const fist = side > 0 ? !!Wm || T[C3.RE] > 0.9 : T[C3.GR] > 0.5 || T[C3.LH] > 0.5 || (Pose.offhand && T[C3.LW] > 0.2);
      const hc = side > 0 ? c3HR : c3HC; hc[0] = Wr[0] + ax * 0.05; hc[1] = Wr[1] + ay * 0.05; hc[2] = Wr[2] + az * 0.05;
      let nx = Cf[6] * side, ny = Cf[7] * side, nz = Cf[8] * side;
      const nd = nx * ax + ny * ay + nz * az; nx -= ax * nd; ny -= ay * nd; nz -= az * nd; const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const wx = ay * nz - az * ny, wy = az * nx - ax * nz, wz = ax * ny - ay * nx;
      const th = fist ? 0.034 : 0.021, wh = fist ? 0.038 : 0.042, ln = fist ? 0.042 : 0.052;
      c3emit(RB, hc[0], hc[1], hc[2], nx * th, ny * th, nz * th, wx * wh, wy * wh, wz * wh, ax * ln, ay * ln, az * ln, Pl.hand, 1, fist ? 1 : 0.8);
      if (side > 0) {
        handR = hc;
        const wl = Math.hypot(T[C3.WD], T[C3.WD + 1], T[C3.WD + 2]) || 1;
        wd = c3dir(c3WD, Cf, T[C3.WD] / wl, T[C3.WD + 1] / wl, T[C3.WD + 2] / wl);
      } else if (Pose.offhand && !T[C3.GR]) {
        const od = c3dir(c3c, Cf, 0.95, -0.05, -0.12);
        this.weapon('flashlight', hc, od, Cf, false, Pose.light, Pl);
      }
    }
    if (Wm && handR) this.weapon(Pose.weapon, handR, wd, Cf, Pose.flash, false, Pl);
    // ---- gear on the hotbar: a long weapon slung across the back, tools on the belt, a pistol in the holster
    if (look.att && det > 0) for (const [slot, model] of look.att) {
      const W = WEAPON_MODELS[model] || WEAPON_MODELS.generic;
      if (slot === 'back') {
        const d = c3dir(c3g, Cf, 0, -0.5, -0.86), c = c3pt(c3c, Cf, -(chD + jx + (Pl.bag ? 0.15 : 0) + 0.03), 0, 0.12);
        const h = c3G1; h[0] = c[0] - d[0] * W.len * 0.5; h[1] = c[1] - d[1] * W.len * 0.5; h[2] = c[2] - d[2] * W.len * 0.5;
        this.weapon(model, h, d, Cf, false, false, Pl);
      } else {
        const side = slot === 'beltL' ? -1 : 1, f = slot === 'holster' ? 0.07 : slot === 'beltR' ? -0.06 : 0;
        const h = c3pt(c3G1, Pf, f, side * 0.175 * bw, 0.1), d = c3dir(c3G2, Pf, 0.18, side * 0.08, -1), l = Math.hypot(d[0], d[1], d[2]);
        d[0] /= l; d[1] /= l; d[2] /= l;
        this.weapon(model, h, d, Pf, false, false, Pl);
      }
    }
    // ---- shadow: a disc under the feet, stretched toward the head when lying or bent over
    const hp = c3pt(c3a, Hf, 0, 0, 0.08);
    const fx = (ankL[0] + ankR[0]) * 0.5, fy = (ankL[1] + ankR[1]) * 0.5;
    const ax = (hp[0] - fx) * 0.5, ay = (hp[1] - fy) * 0.5, mx = fx + ax, my = fy + ay;
    const ux = (ax - ay) * HTW, uy = (ax + ay) * HTH, len = Math.hypot(ux, uy);
    return [(mx - my) * HTW, (mx + my) * HTH, Math.max(10, len + 9), 5 + Math.min(3, len * 0.12), len > 1 ? Math.atan2(uy, ux) : 0];
  },
  head(Hf, look, Pl, D, S, T, det) {
    const SP = GL3D.SPH, RB = GL3D.RBOX, BOX = GL3D.BOX, CY = GL3D.CYL, H = D.H, fem = D.fem, zomb = D.zomb;
    const hw = fem ? 0.078 : 0.082;
    // cranium and jaw
    c3box(SP, Hf, -0.006, 0, 0.11, 0.1, hw, 0.108, Pl.skin);
    c3box(RB, Hf, 0.042, 0, 0.045, 0.055, hw * 0.78, 0.058, Pl.skin, fem ? 0.62 : 0.72, 1);
    const jaw = T[C3.JAW] || 0;
    if (det > 0) {
      // ears, nose, eyes, brows, mouth
      if (det > 1) for (const sd of [-1, 1]) c3box(SP, Hf, -0.004, sd * (hw + 0.002), 0.095, 0.022, 0.01, 0.03, Pl.skinD);
      c3box(RB, Hf, 0.1, 0, 0.082, 0.022, 0.013, 0.026, Pl.skin, 1, 0.75);
      for (const sd of [-1, 1]) {
        c3box(BOX, Hf, 0.088, sd * 0.032, 0.112, 0.012, 0.012, zomb ? 0.009 : 0.008, Pl.eye);
        if (det > 1 && !zomb) c3box(BOX, Hf, 0.086, sd * 0.042, 0.111, 0.01, 0.006, 0.006, Pl.eyeW);
        c3box(BOX, Hf, 0.094, sd * 0.034, 0.133, 0.008, 0.02, 0.0055, zomb ? Pl.skinD : Pl.brow);
      }
      c3box(BOX, Hf, 0.094 - jaw * 0.01, 0, 0.035 - jaw * 0.012, 0.007, 0.021, 0.0045 + jaw * 0.012, Pl.lip);
      if (zomb && det > 1) c3box(SP, Hf, 0.09, 0.01, 0.0, 0.012, 0.03, 0.022, Pl.bloodD);
    }
    // hair or hat
    const hs = look.hairStyle || 'short', hat = look.hat;
    const fullHelm = hat && hat.type === 'fullhelmet';
    if (hs !== 'bald' && !fullHelm) {
      const hc = hs === 'buzz' ? this.mix(Pl.hair, Pl.skin, 0.35) : Pl.hair;
      const big = hs === 'messy' ? 0.012 : hs === 'buzz' ? -0.008 : 0;
      c3box(SP, Hf, -0.02, 0, 0.128, 0.104 + big, hw + 0.01 + big, 0.1 + big, hc);
      // sideburns / back of the head
      c3box(SP, Hf, -0.045, 0, 0.085, 0.07, hw + 0.006, 0.085, hc);
      if (hs === 'long') c3box(RB, Hf, -0.07, 0, 0.01, 0.045, hw + 0.004, 0.13, hc, 1.0, 1.05);
      if (hs === 'ponytail') { c3box(SP, Hf, -0.11, 0, 0.09, 0.035, 0.032, 0.035, hc); c3box(RB, Hf, -0.13, 0, 0.0, 0.025, 0.022, 0.07, hc, 0.6, 1); }
      if (hs === 'messy' && det > 0) { c3box(SP, Hf, 0.03, 0.03, 0.2, 0.04, 0.035, 0.03, hc); c3box(SP, Hf, -0.04, -0.035, 0.205, 0.04, 0.04, 0.03, hc); }
      if (fem && hs !== 'buzz' && hs !== 'short' && det > 0) for (const sd of [-1, 1]) c3box(RB, Hf, 0.02, sd * (hw + 0.008), 0.06, 0.04, 0.012, 0.06, hc);
    }
    if (hat) {
      const hcol = Pl.hat;
      if (fullHelm) { c3box(SP, Hf, 0.0, 0, 0.1, 0.122, 0.104, 0.13, hcol); c3box(RB, Hf, 0.09, 0, 0.1, 0.035, 0.07, 0.035, Pl.glass); }
      else if (hat.type === 'helmet') { c3box(SP, Hf, -0.005, 0, 0.165, 0.113, 0.1, 0.075, hcol); c3box(CY, Hf, 0.0, 0, 0.138, 0.13, 0.115, 0.007, hcol); }
      else if (hat.type === 'beanie') { c3box(SP, Hf, -0.01, 0, 0.15, 0.108, hw + 0.016, 0.088, hcol); c3box(CY, Hf, -0.008, 0, 0.12, 0.106, hw + 0.019, 0.016, this.sc(hcol, 0.85)); }
      else { c3box(SP, Hf, -0.006, 0, 0.165, 0.106, hw + 0.013, 0.065, hcol); c3box(RB, Hf, 0.115, 0, 0.165, 0.06, 0.07, 0.008, hcol, 1, 1); }
    }
    if (look.glasses && det > 0) c3box(BOX, Hf, 0.098, 0, 0.113, 0.006, 0.062, 0.013, Pl.glass);
    void H; void S; void CY;
  },
  // a weapon model held at hand, pointing along wd (unit, model space)
  weapon(key, hand, wd, Rf, flash, lit, Pl) {
    const W = WEAPON_MODELS[key] || WEAPON_MODELS.generic, BOX = GL3D.BOX, CY = GL3D.CYL, RB = GL3D.RBOX;
    let sx = -wd[1], sy = wd[0], sz = 0, sl = Math.sqrt(sx * sx + sy * sy);
    if (sl < 1e-3) { sx = Rf[6]; sy = Rf[7]; sz = Rf[8]; sl = 1; }
    sx /= sl; sy /= sl; sz /= sl;
    const ux = wd[1] * sz - wd[2] * sy, uy = wd[2] * sx - wd[0] * sz, uz = wd[0] * sy - wd[1] * sx;
    const blade = key === 'knife' || key === 'machete' || key === 'katana';
    // a piece from k0 to k1 along the weapon, half width w (sideways) and h (up), offset a up
    const piece = (m, k0, k1, w, h, col, a, t1) => {
      const k = (k0 + k1) / 2, l = (k1 - k0) / 2, ox = a || 0;
      c3emit(m, hand[0] + wd[0] * k + ux * ox, hand[1] + wd[1] * k + uy * ox, hand[2] + wd[2] * k + uz * ox, ux * h, uy * h, uz * h, sx * w, sy * w, sz * w, wd[0] * l, wd[1] * l, wd[2] * l, col, 1, t1 || 1);
    };
    const k0 = W.w0 * 0.0075, k1 = W.w1 * 0.0075, col = this.rgb(W.col), L = W.len, steel = this.rgb('#9aa2aa');
    if (W.gun) {
      if (key === 'pistol') { piece(BOX, -0.04, L, 0.016, 0.022, col, 0.02); piece(BOX, -0.035, 0.03, 0.014, 0.04, this.sc(col, 0.8), -0.03); }
      else {
        piece(BOX, -0.26, 0.0, 0.022, 0.04, this.rgb(W.stock), -0.02, 0.8);
        piece(BOX, -0.02, 0.3, 0.022, 0.032, col, 0.0);
        piece(CY, 0.3, L, 0.012, 0.012, col, 0.012);
        if (key === 'shotgun') piece(CY, 0.38, 0.62, 0.019, 0.019, this.rgb(W.stock), -0.018);
        else piece(BOX, 0.28, 0.5, 0.016, 0.02, this.rgb(W.stock), -0.01);
      }
      if (flash) piece(GL3D.SPH, L + 0.01, L + 0.15, 0.05, 0.05, [2, 1.85, 1.4]);
      return;
    }
    if (W.grip) piece(CY, -(W.gripLen || 0.08), 0.03, 0.019, 0.019, this.rgb(W.grip));
    const g0 = W.grip ? 0.02 : -0.08;
    if (blade) piece(BOX, g0, L, 0.004, (k0 + k1) / 2 * 0.9, col, 0, k1 / k0);
    else if (key === 'plank') piece(BOX, g0, L, 0.012, 0.045, col);
    else if (key === 'flashlight') { piece(CY, -0.06, 0.12, 0.018, 0.018, col); piece(CY, 0.12, 0.16, 0.026, 0.026, col); if (lit) piece(CY, 0.16, 0.168, 0.022, 0.022, [1.95, 1.92, 1.75]); }
    else piece(CY, g0, L, k0, k0, col, 0, U.clamp(k1 / k0, 0.5, 2.2));
    if (W.head === 'axe') piece(BOX, L - 0.16, L - 0.03, 0.01, 0.075, steel, 0.075, 1.3);
    else if (W.head === 'hammer') piece(BOX, L - 0.035, L + 0.025, 0.028, 0.07, this.rgb('#707880'), 0.01);
    else if (W.head === 'sledge') piece(RB, L - 0.07, L + 0.06, 0.055, 0.11, this.rgb('#606870'));
    else if (W.head === 'pan') piece(CY, L, L + 0.22, 0.1, 0.016, this.rgb('#303438'));
    else if (W.head === 'shovel') piece(RB, L - 0.04, L + 0.26, 0.085, 0.012, this.rgb('#80888f'), 0, 0.6);
    else if (W.head === 'spear') piece(BOX, L, L + 0.16, 0.022, 0.006, this.rgb('#c8ccd0'), 0, 0.15);
    else if (W.head === 'club') piece(RB, L - 0.09, L, 0.026, 0.032, this.rgb('#a0a8b0'), -0.015);
    void Pl; void RB;
  },
  // blit a prepared character; false when it was not prepared (caller falls back to 2D)
  draw(ctx, e, X, Y, shade, alpha) {
    const cell = this.map.get(e);
    if (!cell) return false;
    const fade = alpha !== undefined && alpha < 1;
    if (fade) ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.28 * shade + 0.05).toFixed(2) + ')';
    ctx.beginPath();
    const sd = cell.shadow;
    if (sd) ctx.ellipse(X + sd[0], Y + sd[1], sd[2], sd[3], sd[4], 0, Math.PI * 2); else ctx.ellipse(X, Y, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    GL3D.blit(ctx, cell, X, Y);
    if (fade) ctx.globalAlpha = 1;
    return true;
  },
  // one character drawn straight onto a 2D canvas at x, y (menu and character previews); false without 3D
  preview(g, x, y, ang, look, pose, state) {
    if (!this.on()) return false;
    try {
      const m = g.getTransform ? g.getTransform() : null;
      GL3D.begin(Math.min(4, Math.max(1, m ? Math.hypot(m.a, m.b) : 1)));
      const S = state || this.newState(pose.id || 1, look);
      S.preview = true;
      if (pose.mt !== undefined) { S.mode = pose.mode || 'loco'; S.mt = pose.mt; }
      if (pose.t !== undefined) S.t = pose.t;
      this.animate(S, 0, 0, ang, pose, 0);
      const cell = this.render(S, ang, look, pose, 1, 0);
      if (!cell) return false;
      GL3D.flush();
      const sd = cell.shadow;
      g.fillStyle = 'rgba(0,0,0,0.33)'; g.beginPath(); g.ellipse(x + sd[0], y + sd[1], sd[2], sd[3], sd[4], 0, Math.PI * 2); g.fill();
      GL3D.blit(g, cell, x, y);
      return true;
    } catch (e) {
      console.warn('3D preview failed', e);
      this.off = true;
      return false;
    }
  },
};
