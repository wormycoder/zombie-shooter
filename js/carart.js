'use strict';
// ---------------------------------------------------------------------------
// Detailed vehicle art: pre-rendered car sprites per heading, damage states, lights.
// Every vehicle type is a low-poly model in car-local coordinates (f forward, s right,
// z up; FL = driver side = s < 0). Convex parts are painted back to front (pairwise
// separating planes + a topological sort), faces are shaded by their normal and
// back-face culled. Sprites are rendered at 2x into a bounded LRU cache keyed by type,
// colour, state bits and one of 64 heading buckets; head/tail/reverse lights, light
// bars, the dome light and the driver are cheap per-frame overlays (cached glows).
// ---------------------------------------------------------------------------
const CA_NB = 64, CA_SC = 2;
const CA_COL = {
  tyre: '#1e1e20', tread: '#141416', wall: '#2c2c2e', rim: '#c2c7cc', steel: '#80868c', hub: '#585d62',
  chrome: '#d2d8de', black: '#202124', glass: '#30465a', inside: '#2a2b2f', seat: '#3c3a38',
  head: '#e4e6d8', tail: '#b01e14', amber: '#dc8e1c', plate: '#e8e4ce', rust: '#7c3e1c', burnt: '#2b2521',
};
const CarArt = {
  cache: new Map(), bytes: 0, cap: 48e6, models: new Map(), bT: 0, bMs: 0, warned: false,
  stats: { sprites: 0, ms: 0, evicted: 0, models: 0, maxMs: 0 },
};
Object.assign(CarArt, {
  // ---------------------------------------------------------------- geometry
  // unit outward normal of polygon p (Newell's method), oriented away from centre c; null if degenerate
  normal(p, c) {
    let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
      cx += a[0]; cy += a[1]; cz += a[2];
    }
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l < 1e-9) return null;
    const k = p.length;
    if ((cx / k - c[0]) * nx + (cy / k - c[1]) * ny + (cz / k - c[2]) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    return [nx / l, ny / l, nz / l];
  },
  tagOf(n) {
    if (n[2] > 0.72) return 'T';
    if (n[2] < -0.72) return 'D';
    return ['F', 'FR', 'R', 'BR', 'B', 'BL', 'L', 'FL'][(Math.round(Math.atan2(n[1], n[0]) / (Math.PI / 4)) + 8) % 8];
  },
  // convex solid between two matching outlines A and B ([f, s, z] points). o: { skip: tags to
  // leave out, tags: per-side tags, cols / mats: per-tag overrides, body: wheels may overlap it }
  solid(A, B, col, o) {
    o = o || {};
    const all = A.concat(B), n = all.length, c = [0, 0, 0], bb = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9];
    for (const q of all) {
      c[0] += q[0] / n; c[1] += q[1] / n; c[2] += q[2] / n;
      for (let k = 0; k < 3; k++) { if (q[k] < bb[k * 2]) bb[k * 2] = q[k]; if (q[k] > bb[k * 2 + 1]) bb[k * 2 + 1] = q[k]; }
    }
    const P = { faces: [], bb, c, body: !!o.body, k: o.k || '' };
    const add = (p, tag) => {
      const nm = this.normal(p, c);
      if (!nm) return;
      const t = tag || this.tagOf(nm);
      if (o.skip && o.skip.indexOf(t) >= 0) return;
      P.faces.push({ p, n: nm, t, col: (o.cols && o.cols[t]) || col, mat: (o.mats && o.mats[t]) || o.mat || 'paint', fx: null, win: null });
    };
    if (!o.noA) add(A.slice().reverse(), o.tA);
    if (!o.noB) add(B, o.tB);
    for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; add([A[i], A[j], B[j], B[i]], o.tags && o.tags[i]); }
    return P;
  },
  // prism over a 2D outline [[f, s]...] from z0 up to zt (number or fn(f, s))
  prism(ol, z0, zt, col, o) {
    const A = ol.map(q => [q[0], q[1], z0]);
    const B = ol.map(q => [q[0], q[1], typeof zt === 'function' ? zt(q[0], q[1]) : zt]);
    return this.solid(A, B, col, o);
  },
  // rectangle outline with chamfered front (cf) and back (cb) corners; left side first, going forward
  rect(f0, f1, s0, s1, cf, cb) {
    cf = cf || 0; cb = cb || 0;
    const p = [[f0 + cb, s0], [f1 - cf, s0], [f1, s0 + cf], [f1, s1 - cf], [f1 - cf, s1], [f0 + cb, s1], [f0, s1 - cb], [f0, s0 + cb]];
    return p.filter((q, i) => { const r = p[(i + 1) % p.length]; return Math.abs(q[0] - r[0]) + Math.abs(q[1] - r[1]) > 1e-6; });
  },
  box(f0, f1, s0, s1, z0, z1, col, o) { return this.prism(this.rect(f0, f1, s0, s1), z0, z1, col, o); },
  // attach a feature painter fn(g, F, face) to the faces of part P with tag t
  fx(P, t, fn) { for (const fc of P.faces) if (fc.t === t) (fc.fx || (fc.fx = [])).push(fn); return P; },
  face(P, t) { return P.faces.find(fc => fc.t === t); },
  // point on a quad face from (u, v): u runs with +f on side faces and +s on front/back faces, v bottom -> top
  uv(fc, u, v) {
    const [p0, p1, p2, p3] = fc.p;
    const ax = fc.t === 'L' || fc.t === 'R' ? 0 : 1;
    if (p0[ax] > p1[ax]) u = 1 - u;
    const L3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    return L3(L3(p0, p1, u), L3(p3, p2, u), v);
  },
  // window (hole + glass) on face fc between u0..u1, v0..v1
  win(fc, id, u0, u1, v0, v1, st) {
    if (!fc) return;
    (fc.win || (fc.win = [])).push({ id, st: st || 0, p: [this.uv(fc, u0, v0), this.uv(fc, u1, v0), this.uv(fc, u1, v1), this.uv(fc, u0, v1)] });
  },
  // ---------------------------------------------------------------- projection
  // F maps car-local points to canvas pixels for heading a at scale sc around (ox, oy).
  // tilt [d0, df, ds] lowers the body by d0 + df*f + ds*s (missing tyres, burnt shells).
  proj(a, ox, oy, sc, tilt) {
    const ca = Math.cos(a), sa = Math.sin(a), kx = HTW * sc, ky = HTH * sc, kz = ZU * sc;
    const t = tilt || [0, 0, 0];
    return {
      ca, sa, sc, ox, oy, b: 1, tilt: true, glass: null, cf: ca + sa, cs: ca - sa,
      P(f, s, z) {
        if (this.tilt) z -= t[0] + t[1] * f + t[2] * s;
        const dx = f * ca - s * sa, dy = f * sa + s * ca;
        return [ox + (dx - dy) * kx, oy + (dx + dy) * ky - z * kz];
      },
      V(f, s, z) {
        if (this.tilt) z -= t[1] * f + t[2] * s;
        const dx = f * ca - s * sa, dy = f * sa + s * ca;
        return [(dx - dy) * kx, (dx + dy) * ky - z * kz];
      },
      // > 0 when a face with local normal n looks toward the camera (world view axis (1, 1, 1))
      vis(n) { return n[0] * (ca + sa) + n[1] * (ca - sa) + n[2]; },
      depth(f, s, z) { return f * (ca + sa) + s * (ca - sa) + z; },
      // light model: tops 1.0, faces looking +y FACE_S, faces looking +x FACE_E
      bright(n) {
        const wx = n[0] * ca - n[1] * sa, wy = n[0] * sa + n[1] * ca, nz = n[2];
        const h = Math.sqrt(wx * wx + wy * wy);
        const side = h > 1e-6 ? FACE_E + (FACE_S - FACE_E) * U.clamp((wy - wx) / h * 0.5 + 0.5, 0, 1) : 1;
        return nz >= 0 ? side + (1 - side) * Math.pow(nz, 0.9) : side * (1 + nz * 0.35);
      },
      sh(col, m) { return Col.shade(col, this.b * (m === undefined ? 1 : m)); },
      // canvas transform so that (x, y) draws at local point o + (x*u + y*v)*k
      frame(g, o, u, v, k) {
        k = k || 1;
        const p = this.P(o[0], o[1], o[2]), U_ = this.V(u[0] * k, u[1] * k, u[2] * k), V_ = this.V(v[0] * k, v[1] * k, v[2] * k);
        g.setTransform(U_[0], U_[1], V_[0], V_[1], p[0], p[1]);
      },
    };
  },
  rgba(hex, b, a) {
    const c = Col.rgb(hex);
    return 'rgba(' + Math.min(255, c[0] * b | 0) + ',' + Math.min(255, c[1] * b | 0) + ',' + Math.min(255, c[2] * b | 0) + ',' + a + ')';
  },
});
Object.assign(CarArt, {
  // ---------------------------------------------------------------- painting
  path(g, pts, rev) {
    const n = pts.length;
    g.moveTo(pts[rev ? n - 1 : 0][0], pts[rev ? n - 1 : 0][1]);
    for (let i = 1; i < n; i++) { const q = pts[rev ? n - 1 - i : i]; g.lineTo(q[0], q[1]); }
    g.closePath();
  },
  ybox(pts) { let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; for (const q of pts) { if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; } return [x0, y0, x1, y1]; },
  fillFor(g, F, fc, pts, b) {
    const m = fc.mat;
    if (m === 'chrome') {
      const bx = this.ybox(pts), gr = g.createLinearGradient(0, bx[1], 0, bx[3] + 0.01);
      gr.addColorStop(0, Col.shade('#f2f6fa', b)); gr.addColorStop(0.45, Col.shade('#9aa2aa', b)); gr.addColorStop(0.55, Col.shade('#6c737a', b)); gr.addColorStop(1, Col.shade('#c8ced4', b));
      return gr;
    }
    if (m === 'paint' && fc.t !== 'T' && fc.t !== 'D') {
      // painted sides catch more light near the top: reads as a rounded panel
      const bx = this.ybox(pts), gr = g.createLinearGradient(0, bx[1], 0, bx[3] + 0.01);
      gr.addColorStop(0, Col.shade(fc.col, b * 1.07)); gr.addColorStop(1, Col.shade(fc.col, b * 0.86));
      return gr;
    }
    return Col.shade(fc.col, b);
  },
  // one face: fill (with window holes), panel edge, glass, then attached feature painters
  drawFace(g, F, fc, see) {
    const pts = fc.p.map(q => F.P(q[0], q[1], q[2]));
    const b = F.b = F.bright(fc.n);
    if (fc.mat === 'none') { if (fc.fx) for (const fn of fc.fx) { F.b = b; g.save(); fn(g, F, fc); g.restore(); g.setTransform(1, 0, 0, 1, 0, 0); } return; }
    const fill = this.fillFor(g, F, fc, pts, b);
    g.fillStyle = fill;
    if (fc.win) {
      const ws = fc.win.map(w => w.p.map(q => F.P(q[0], q[1], q[2])));
      g.beginPath(); this.path(g, pts); for (const w of ws) this.path(g, w, true);
      g.fill('evenodd');
      for (let i = 0; i < ws.length; i++) this.glass(g, F, fc.win[i], ws[i], b, see);
    } else { g.beginPath(); this.path(g, pts); g.fill(); g.strokeStyle = fill; g.lineWidth = 0.8; g.stroke(); }
    if (fc.mat !== 'glass' && !fc.noEdge) { g.beginPath(); this.path(g, pts); g.strokeStyle = this.rgba(fc.col, b * 0.62, 0.55); g.lineWidth = 1; g.stroke(); }
    if (fc.fx) for (const fn of fc.fx) { F.b = b; g.save(); fn(g, F, fc); g.restore(); g.setTransform(1, 0, 0, 1, 0, 0); }
  },
  // window glass: st 0 intact, 1 cracked, 2 smashed (shards), 3 opaque panel, 4 empty frame (open door, burnt)
  glass(g, F, w, pts, b, see) {
    if (see && F.glass) F.glass.push(pts);
    const bx = this.ybox(pts), W = bx[2] - bx[0], H = bx[3] - bx[1];
    if (w.st === 4) { /* nothing in the frame */ } else if (w.st === 2) {
      // empty frame with a few shards left in it
      g.fillStyle = 'rgba(200,225,240,0.45)';
      for (let k = 0; k < 4; k++) {
        const t = (k + 0.5) / 4, a = pts[0], c = pts[1];
        const x = a[0] + (c[0] - a[0]) * t, y = a[1] + (c[1] - a[1]) * t;
        g.beginPath(); g.moveTo(x - W * 0.05, y); g.lineTo(x + W * 0.05, y); g.lineTo(x + W * 0.01 * (k - 1.5), y - H * (0.1 + 0.1 * (k & 1))); g.fill();
      }
    } else {
      g.save(); g.beginPath(); this.path(g, pts); g.clip();
      const gr = g.createLinearGradient(bx[0], bx[1], bx[0] + W * 0.3, bx[3]);
      const al = see && w.st !== 3 ? 0.8 : 1;
      gr.addColorStop(0, this.rgba('#8ea6b8', b, al)); gr.addColorStop(0.42, this.rgba(CA_COL.glass, b * 1.1, al)); gr.addColorStop(1, this.rgba('#1c2a36', b, al));
      g.fillStyle = gr; g.fillRect(bx[0] - 1, bx[1] - 1, W + 2, H + 2);
      g.fillStyle = 'rgba(255,255,255,0.13)';
      g.beginPath(); g.moveTo(bx[0] + W * 0.12, bx[3] + 1); g.lineTo(bx[0] + W * 0.34, bx[3] + 1); g.lineTo(bx[0] + W * 0.62, bx[1] - 1); g.lineTo(bx[0] + W * 0.4, bx[1] - 1); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath(); g.moveTo(bx[0] + W * 0.42, bx[3] + 1); g.lineTo(bx[0] + W * 0.48, bx[3] + 1); g.lineTo(bx[0] + W * 0.76, bx[1] - 1); g.lineTo(bx[0] + W * 0.7, bx[1] - 1); g.fill();
      if (w.st === 1) {
        // spider-web crack
        const cx = bx[0] + W * 0.35, cy = bx[1] + H * 0.45;
        g.strokeStyle = 'rgba(230,240,245,0.75)'; g.lineWidth = 0.8; g.beginPath();
        for (let k = 0; k < 7; k++) { const an = k * 0.9 + 0.3, r = Math.max(W, H) * (0.3 + (k % 3) * 0.12); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r * 0.8); }
        g.stroke(); g.beginPath(); g.ellipse(cx, cy, W * 0.08, H * 0.1, 0, 0, 7); g.stroke();
      }
      g.restore();
    }
    g.beginPath(); this.path(g, pts); g.strokeStyle = 'rgba(16,17,19,0.9)'; g.lineWidth = 1.3; g.stroke();
  },
  // hollow part (cabin): inside of the far walls, then the interior, then near walls with see-through glass
  drawHollow(g, F, P) {
    const near = [];
    for (const fc of P.faces) {
      if (F.vis(fc.n) > 1e-4) { near.push(fc); continue; }
      const pts = fc.p.map(q => F.P(q[0], q[1], q[2]));
      const b = fc.t === 'D' ? 0.62 : 0.78;
      g.fillStyle = Col.shade(P.inCol || CA_COL.inside, b);
      g.beginPath(); this.path(g, pts); g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 0.8; g.stroke();
      if (fc.win) for (const w of fc.win) {
        if (w.st === 3) continue;
        g.fillStyle = this.rgba('#6c7c88', 0.9, 0.9);
        g.beginPath(); this.path(g, w.p.map(q => F.P(q[0], q[1], q[2]))); g.fill();
      }
    }
    if (P.inner) for (const q of this.order(P.inner, F)) this.drawPart(g, F, q);
    for (const fc of near) this.drawFace(g, F, fc, true);
  },
  // ---------------------------------------------------------------- wheels
  // wheel spec w: { f, s (outer face), r, w (width), side, steer, st (0 ok / 1 flat / 2 missing), rim, burnt }
  wheelParts(M, steer) {
    const out = [];
    for (const w of M.wheels) {
      const ang = w.steer ? steer * 0.36 : 0;
      const bb = [w.f - w.r - 0.02, w.f + w.r + 0.02, w.side > 0 ? w.s - w.w : w.s, w.side > 0 ? w.s : w.s + w.w, 0, w.r * 2];
      const c = [w.f, w.s - w.side * w.w / 2, w.r];
      out.push({ wheel: w.side, pass: 0, bb, c, faces: [], spec: w, ang, draw: this.drawWheel });
      out.push({ wheel: w.side, pass: 1, bb, c, faces: [], spec: w, ang, draw: this.drawWheel });
    }
    return out;
  },
  drawWheel(g, F, P) {
    const w = P.spec, near = w.side * F.cs > 0;
    if (P.pass === 1 && !near) return;
    F.tilt = false;
    const cs = Math.cos(P.ang), sn = Math.sin(P.ang);
    const fw = [cs, sn, 0], ax = [-sn * w.side, cs * w.side, 0];
    const bare = w.st === 2 || w.burnt;
    const r = bare ? w.r * 0.66 : w.r, cz = bare ? r : w.st === 1 ? w.r * 0.82 : w.r;
    const th = P.pass === 1 ? Math.min(w.w, 0.07) : w.w;
    const O = [w.f, w.s, cz], I = [w.f - ax[0] * th, w.s - ax[1] * th, cz];
    const N = 16, po = [], pi = [];
    for (let k = 0; k < N; k++) {
      const t = k / N * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      const z = Math.max(0, cz + r * s);
      po.push(F.P(O[0] + fw[0] * r * c, O[1] + fw[1] * r * c, z));
      pi.push(F.P(I[0] + fw[0] * r * c, I[1] + fw[1] * r * c, z));
    }
    const tyre = bare ? (w.burnt ? '#3a2a22' : CA_COL.steel) : CA_COL.tread;
    // tread band: quads whose radial normal faces the camera
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N, t = (k + 0.5) / N * Math.PI * 2;
      const n = [fw[0] * Math.cos(t), fw[1] * Math.cos(t), Math.sin(t)];
      if (F.vis(n) <= 0) continue;
      g.fillStyle = Col.shade(tyre, F.bright(n)); g.beginPath(); g.moveTo(po[k][0], po[k][1]); g.lineTo(po[j][0], po[j][1]); g.lineTo(pi[j][0], pi[j][1]); g.lineTo(pi[k][0], pi[k][1]); g.closePath(); g.fill();
      g.strokeStyle = g.fillStyle; g.lineWidth = 0.6; g.stroke();
    }
    const outV = F.vis(ax) > 0, disc = outV ? po : pi, b = F.bright(outV ? ax : [-ax[0], -ax[1], 0]);
    g.fillStyle = Col.shade(bare ? tyre : CA_COL.wall, b * (outV ? 1 : 0.7)); g.beginPath(); this.path(g, disc); g.fill();
    if (outV) {
      // rim / hubcap painted in the wheel plane
      F.frame(g, O, fw, [0, 0, -1], 0.01);
      const R = r * 100, rimC = w.burnt ? '#4a3a30' : w.rim || CA_COL.rim;
      if (!bare && w.white) { g.strokeStyle = Col.shade('#e8e8e0', b); g.lineWidth = R * 0.12; g.beginPath(); g.arc(0, 0, R * 0.8, 0, 7); g.stroke(); }
      const rr = bare ? R * 0.96 : R * 0.6;
      g.fillStyle = Col.shade(rimC, b); g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill();
      g.fillStyle = Col.shade(rimC, b * 0.72); g.beginPath(); g.arc(0, 0, rr * 0.78, 0, 7); g.fill();
      if (w.spokes) {
        g.strokeStyle = Col.shade(rimC, b * 1.08); g.lineWidth = rr * 0.18; g.beginPath();
        for (let k = 0; k < 5; k++) { const an = k * 1.2566; g.moveTo(0, 0); g.lineTo(Math.cos(an) * rr * 0.8, Math.sin(an) * rr * 0.8); }
        g.stroke();
      } else {
        g.fillStyle = Col.shade(rimC, b * 1.1); g.beginPath(); g.arc(-rr * 0.12, -rr * 0.12, rr * 0.55, 0, 7); g.fill();
      }
      g.fillStyle = Col.shade(CA_COL.hub, b); g.beginPath(); g.arc(0, 0, rr * 0.26, 0, 7); g.fill();
      if (w.dual) { g.strokeStyle = Col.shade('#3a3a3a', b); g.lineWidth = R * 0.05; g.beginPath(); g.arc(0, 0, rr * 0.5, 0, 7); g.stroke(); }
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    F.tilt = true;
  },
  // soft contact shadow under the whole vehicle
  drawShadow(g, F, M) {
    F.tilt = false;
    const sx = F.sc * 2.4, sy = -F.sc * 1.2;
    for (const [e, a] of [[0.2, 0.08], [0.12, 0.1], [0.05, 0.14], [-0.04, 0.16]]) {
      const ol = this.rect(-M.hl - e, M.hl + e, -M.hw - e, M.hw + e, 0.25 + e, 0.2 + e);
      g.fillStyle = 'rgba(0,0,0,' + a + ')'; g.beginPath(); this.path(g, ol.map(q => { const p = F.P(q[0], q[1], 0); p[0] += sx; p[1] += sy; return p; })); g.fill();
    }
    F.tilt = true;
  },
  // ---------------------------------------------------------------- painter order
  // A before B? -1 A first, 1 B first. Separating planes along f, s, z decide; wheels straddle the
  // body so their full pass goes before it and the outer pass (near side only) after it.
  before(A, B, cf, cs) {
    if (A.on === B) return 1;
    if (B.on === A) return -1;
    const a = A.bb, b = B.bb, e = 1e-4;
    // a horizontal separating plane is always valid (camera above) and keeps low wheels consistent
    if (a[5] <= b[4] + e) return -1;
    if (b[5] <= a[4] + e) return 1;
    if (a[1] <= b[0] + e) return cf > 0 ? -1 : 1;
    if (b[1] <= a[0] + e) return cf > 0 ? 1 : -1;
    if (a[3] <= b[2] + e) return cs > 0 ? -1 : 1;
    if (b[3] <= a[2] + e) return cs > 0 ? 1 : -1;
    if (A.wheel && B.wheel) return A.pass - B.pass || (A._d < B._d ? -1 : 1);
    if (A.wheel) return A.pass ? 1 : -1;
    if (B.wheel) return B.pass ? -1 : 1;
    return A._d < B._d ? -1 : 1;
  },
  order(parts, F) {
    const n = parts.length;
    if (n < 2) return parts;
    for (const p of parts) {
      const bb = p.bb;
      p._d = F.depth(p.c[0], p.c[1], p.c[2]);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < 8; k++) { const q = F.P(bb[k & 1], bb[2 + ((k >> 1) & 1)], bb[4 + (k >> 2)]); if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
      p._s = [x0 - 2, y0 - 2, x1 + 2, y1 + 2];
    }
    const nxt = [], indeg = new Array(n).fill(0);
    for (let i = 0; i < n; i++) nxt.push([]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = parts[i], B = parts[j], sa = A._s, sb = B._s;
      if (sa[2] < sb[0] || sb[2] < sa[0] || sa[3] < sb[1] || sb[3] < sa[1]) continue;
      if (this.before(A, B, F.cf, F.cs) < 0) { nxt[i].push(j); indeg[j]++; } else { nxt[j].push(i); indeg[i]++; }
    }
    const out = [], ready = [];
    for (let i = 0; i < n; i++) if (!indeg[i]) ready.push(i);
    while (out.length < n) {
      if (!ready.length) { let bi = -1; for (let i = 0; i < n; i++) if (indeg[i] > 0 && (bi < 0 || parts[i]._d < parts[bi]._d)) bi = i; indeg[bi] = 0; ready.push(bi); }
      let k = 0;
      for (let q = 1; q < ready.length; q++) if (parts[ready[q]]._d < parts[ready[k]]._d) k = q;
      const i = ready.splice(k, 1)[0];
      out.push(parts[i]); indeg[i] = -1;
      for (const j of nxt[i]) if (indeg[j] > 0 && --indeg[j] === 0) ready.push(j);
    }
    return out;
  },
  paint(g, F, M, steer) {
    this.drawShadow(g, F, M);
    const parts = M.parts.concat(this.wheelParts(M, steer));
    for (const p of this.order(parts, F)) this.drawPart(g, F, p);
  },
});
Object.assign(CarArt, {
  // ---------------------------------------------------------------- state key
  // The model depends only on this key (it is parsed back in build): type|col|dmg|sides|glass|doors|hood|trunk|tyres|lights|flags|seed
  GLASS: ['windshield', 'rearWindow', 'winFL', 'winFR', 'winRL', 'winRR'],
  DOORS: ['doorFL', 'doorFR', 'doorRL', 'doorRR'],
  TYRES: ['tireFL', 'tireFR', 'tireRL', 'tireRR'],
  LIGHTS: ['lightFL', 'lightFR', 'lightRL', 'lightRR'],
  pv(p, k) { if (!p) return 100; const v = p[k]; return typeof v === 'number' ? v : 100; },
  mkey(c) {
    const p = c.parts && typeof c.parts === 'object' ? c.parts : null, dm = c.dmg && typeof c.dmg === 'object' ? c.dmg : null;
    const hp = Number.isFinite(c.hp) ? c.hp : 100;
    const d = hp >= 72 ? 0 : hp >= 48 ? 1 : hp >= 22 ? 2 : 3;
    const q = (v) => Math.max(0, Math.min(3, Math.round((+v || 0) * 3)));
    const sd = dm ? '' + q(dm.front) + q(dm.rear) + q(dm.left) + q(dm.right) : '-';
    let gl = '', smashed = false;
    for (const k of this.GLASS) { const v = this.pv(p, k), s = v <= 0 ? 2 : v < 40 ? 1 : 0; if (s === 2) smashed = true; gl += s; }
    if (c.winBroken && !smashed) gl = gl.slice(0, 2) + '2' + gl.slice(3);
    let dr = '';
    const dob = c.doorOpen | 0;
    for (let i = 0; i < 4; i++) dr += this.pv(p, this.DOORS[i]) === -1 ? 2 : (dob >> i) & 1;
    const ho = this.pv(p, 'hood') === -1 ? 2 : c.hoodOpen ? 1 : 0, tr = this.pv(p, 'trunkLid') === -1 ? 2 : c.trunkOpen ? 1 : 0;
    let ty = '', li = '';
    for (const k of this.TYRES) { const v = this.pv(p, k); ty += v === -1 ? 2 : v < 10 ? 1 : 0; }
    for (const k of this.LIGHTS) li += this.pv(p, k) < 10 ? 1 : 0;
    const fl = (c.burnt ? 'B' : '') + (Season.snow > 0.3 && !c.engine ? 'S' : '') + (c.type === 'sports' && c.lightsOn && c.engine ? 'P' : '');
    const seed = d || sd !== '-' ? (c.id | 0) & 3 : 0;
    return c.type + '|' + c.col + '|' + d + '|' + sd + '|' + gl + '|' + dr + '|' + ho + '|' + tr + '|' + ty + '|' + li + '|' + fl + '|' + seed;
  },
  parseKey(mk) {
    const a = mk.split('|');
    const S = { type: a[0], col: /^#[0-9a-fA-F]{6}$/.test(a[1]) || /^#[0-9a-fA-F]{3}$/.test(a[1]) ? a[1] : '#7a7a7a', d: +a[2], seed: +a[11] || 0 };
    S.sides = a[3] === '-' ? null : { front: +a[3][0], rear: +a[3][1], left: +a[3][2], right: +a[3][3] };
    S.glass = {}; this.GLASS.forEach((k, i) => { S.glass[k] = +a[4][i]; });
    S.doors = [0, 1, 2, 3].map(i => +a[5][i]);
    S.hood = +a[6]; S.trunk = +a[7];
    S.tyres = [0, 1, 2, 3].map(i => +a[8][i]);
    S.lights = [0, 1, 2, 3].map(i => +a[9][i]);
    S.burnt = a[10].indexOf('B') >= 0; S.snow = a[10].indexOf('S') >= 0; S.pop = a[10].indexOf('P') >= 0;
    return S;
  },
  // ---------------------------------------------------------------- sprite cache
  sprite(c, mk, bk, st) {
    const key = mk + '|' + bk + st;
    let rec = this.cache.get(key);
    if (rec) { this.cache.delete(key); this.cache.set(key, rec); return rec; }
    // per-frame budget for new sprites: past it, reuse the nearest cached heading of the same model
    const now = performance.now();
    if (now - this.bT > 12) { this.bT = now; this.bMs = 0; }
    if (this.bMs > 5) for (let d = 1; d < CA_NB / 2; d++) for (const b2 of [bk - d, bk + d]) { const r2 = this.cache.get(mk + '|' + ((b2 + CA_NB) % CA_NB) + st); if (r2) return r2; }
    let M = this.models.get(mk);
    if (!M) {
      try { M = this.build(mk); } catch (e) { M = this.fallback(c, mk, e); }
      this.models.set(mk, M); this.stats.models++;
      if (this.models.size > 64) this.models.delete(this.models.keys().next().value);
    }
    try { rec = this.render(M, bk * Math.PI * 2 / CA_NB, st - 1); } catch (e) {
      M = this.fallback(c, mk, e); this.models.set(mk, M);
      rec = this.render(M, bk * Math.PI * 2 / CA_NB, st - 1);
    }
    this.bMs += performance.now() - now;
    this.cache.set(key, rec); this.bytes += rec.bytes;
    while (this.bytes > this.cap && this.cache.size > 12) {
      const k0 = this.cache.keys().next().value, r0 = this.cache.get(k0);
      this.bytes -= r0.bytes * (r0.sil ? 2 : 1); this.cache.delete(k0); this.stats.evicted++;
    }
    return rec;
  },
  // drop every cached sprite and model (e.g. after loading a save)
  flush() { this.cache.clear(); this.models.clear(); this.bytes = 0; },
  // never let one broken model stop the frame: fall back to a plain sedan of the same colour
  fallback(c, mk, e) {
    if (!this.warned) { this.warned = true; console.warn('CarArt: model failed for ' + mk, e); }
    return this.build('sedan|' + (/^#[0-9a-fA-F]{6}$/.test(c.col) ? c.col : '#7a7a7a') + '|0|-|000000|0000|0|0|0000|0000||0');
  },
  // render model M at heading a into a fresh 2x canvas sized to its projected bounds
  render(M, a, steer) {
    const t0 = performance.now();
    const F0 = this.proj(a, 0, 0, CA_SC, M.tilt);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const acc = (q) => { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; };
    const scan = (ps) => {
      for (const P of ps) {
        for (const fc of P.faces) for (const q of fc.p) acc(F0.P(q[0], q[1], q[2]));
        if (!P.faces.length) for (let k = 0; k < 8; k++) acc(F0.P(P.bb[k & 1], P.bb[2 + ((k >> 1) & 1)], P.bb[4 + (k >> 2)]));
        if (P.inner) scan(P.inner);
      }
    };
    scan(M.parts);
    F0.tilt = false;
    const e = 0.24;
    for (const f of [-M.hl - e, M.hl + e]) for (const s of [-M.hw - e, M.hw + e]) acc(F0.P(f, s, 0));
    for (const w of M.wheels) for (const f of [w.f - w.r, w.f + w.r]) for (const s of [w.s, w.s - w.side * w.w]) { acc(F0.P(f, s, 0)); acc(F0.P(f, s, w.r * 2)); }
    const pad = 4, W = Math.ceil(x1 - x0 + pad * 2), H = Math.ceil(y1 - y0 + pad * 2);
    const cv = mkCanvas(W, H), g = cv.getContext('2d');
    const ax = Math.round(-x0 + pad), ay = Math.round(-y0 + pad);
    const F = this.proj(a, ax, ay, CA_SC, M.tilt);
    F.glass = [];
    g.lineJoin = 'round';
    this.paint(g, F, M, steer);
    const ms = performance.now() - t0;
    this.stats.sprites++; this.stats.ms += ms; if (ms > this.stats.maxMs) this.stats.maxMs = ms;
    return { c: cv, ax, ay, sil: null, bytes: W * H * 4, glass: F.glass, a, M };
  },
  silOf(rec) {
    if (!rec.sil) {
      const c = mkCanvas(rec.c.width, rec.c.height), g = c.getContext('2d');
      g.drawImage(rec.c, 0, 0);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgb(3,5,14)'; g.fillRect(0, 0, c.width, c.height);
      rec.sil = c; this.bytes += rec.bytes;
    }
    return rec.sil;
  },
  // cached additive glow sprite for an rgb triple
  glows: {},
  glow(k) {
    let c = this.glows[k];
    if (c) return c;
    const rgb = { h: [255, 244, 210], r: [255, 36, 24], b: [40, 90, 255], w: [255, 255, 255], a: [255, 166, 40], d: [255, 210, 150], v: [255, 250, 240] }[k] || [255, 255, 255];
    c = mkCanvas(64, 64);
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const s = rgb.join(',');
    gr.addColorStop(0, 'rgba(' + s + ',1)'); gr.addColorStop(0.18, 'rgba(' + s + ',0.55)'); gr.addColorStop(0.5, 'rgba(' + s + ',0.14)'); gr.addColorStop(1, 'rgba(' + s + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.glows[k] = c;
    return c;
  },
  // ---------------------------------------------------------------- per frame
  draw(ctx, c) {
    const s = Math.max(0.12, Render.shadeSmooth(c.x, c.y));
    if (!World.isVis(c.x | 0, c.y | 0) && !World.isVis((c.x + Math.cos(c.a)) | 0, (c.y + Math.sin(c.a)) | 0) && G.player && !G.player.inCar && Render.shadeAt(c.x, c.y) < 0.05) return;
    const mk = this.mkey(c);
    const bk = ((Math.round((Number.isFinite(c.a) ? c.a : 0) / (Math.PI * 2) * CA_NB) % CA_NB) + CA_NB) % CA_NB;
    const st = c.steer > 0.15 ? 2 : c.steer < -0.15 ? 0 : 1;
    const rec = this.sprite(c, mk, bk, st), M = rec.M;
    const X = (c.x - c.y) * HTW, Y = (c.x + c.y) * HTH;
    const x0 = X - rec.ax / CA_SC, y0 = Y - rec.ay / CA_SC, w = rec.c.width / CA_SC, h = rec.c.height / CA_SC;
    const lit = !!(c.engine && !c.burnt), night = 1 - U.clamp((G.light.amb - 0.25) / 0.5, 0, 1);
    const a = rec.a, ca = Math.cos(a), sa = Math.sin(a), tl = M.tilt;
    const LP = (f, sd, z) => { z -= tl[0] + tl[1] * f + tl[2] * sd; const dx = f * ca - sd * sa, dy = f * sa + sd * ca; return [X + (dx - dy) * HTW, Y + (dx + dy) * HTH - z * ZU]; };
    const heads = lit && c.lightsOn && M.lt.some(L => L.k === 'h' && !L.broken);
    // headlight beam on the ground ahead (under the car)
    if (heads && night > 0.05) {
      const C = LP(M.hl + 2.3, 0, 0), u = [(ca - sa) * HTW * 2.4, (ca + sa) * HTH * 2.4], v = [(-sa - ca) * HTW * 1.25, (-sa + ca) * HTH * 1.25];
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * night;
      ctx.transform(u[0], u[1], v[0], v[1], C[0], C[1]); ctx.drawImage(this.glow('h'), -1, -1, 2, 2);
      ctx.restore();
    }
    ctx.drawImage(rec.c, x0, y0, w, h);
    if (G.player && G.player.inCar === c && rec.glass.length) this.drawDriver(ctx, c, rec, x0, y0);
    if (1 - s > 0.02) { ctx.globalAlpha = Math.min(1, 1 - s); ctx.drawImage(this.silOf(rec), x0, y0, w, h); ctx.globalAlpha = 1; }
    if (!lit && !(c.doorOpen && night > 0.3)) return;
    // lamps: additive glows that stay bright in the dark
    const t = performance.now() / 1000, fv = ca + sa;
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    const spot = (L, key, r, al) => { const p = LP(L.f, L.s, L.z); ctx.globalAlpha = Math.min(1, al); ctx.drawImage(this.glow(key), p[0] - r, p[1] - r, r * 2, r * 2); };
    const k8 = Math.floor(t * 8) % 8;
    for (const L of M.lt) {
      if (L.broken) continue;
      if (L.k === 'h') { if (heads && fv > -0.15) spot(L, 'h', 7 + 9 * night, (0.55 + 0.45 * night) * Math.min(1, (fv + 0.15) * 2)); }
      else if (L.k === 't') { if (lit && (c.braking || c.lightsOn) && fv < 0.15) spot(L, 'r', c.braking ? 9 + 5 * night : 6 + 4 * night, (c.braking ? 0.95 : 0.5) * Math.min(1, (0.15 - fv) * 2)); }
      else if (L.k === 'c') { if (lit && c.braking && fv < 0.3) spot(L, 'r', 6, 0.8); }
      else if (L.k === 'r') { if (lit && c.rev && fv < 0.15) spot(L, 'v', 6 + 4 * night, 0.85); }
      else if (L.k === 'b') {
        if (L.taxi) { if (lit && c.lightsOn) spot(L, 'a', 9 + 9 * night, 0.35 + 0.4 * night); }
        else if (lit && c.siren) { const ph = (k8 - L.ph + 8) % 8; if (ph === 0 || ph === 2) { spot(L, L.c, 10 + 10 * night, 0.95); spot(L, 'w', 4, 0.8); } }
      } else if (L.k === 'd') { if (c.doorOpen && night > 0.3 && rec.glass.length) this.dome(ctx, rec, L, x0, y0, night); }
    }
    // siren wash on the ground around the car
    if (lit && c.siren && M.bar && night > 0.1 && (k8 & 2) === 0) {
      const p = LP(0, 0, 0), r = (M.hl + 2.5) * 32, key = k8 < 4 ? M.bar[0] : M.bar[1];
      ctx.globalAlpha = 0.22 * night; ctx.drawImage(this.glow(key), p[0] - r, p[1] - r * 0.6, r * 2, r * 1.2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = op;
  },
  // warm interior light seen through the windows (doors open after dark)
  dome(ctx, rec, L, x0, y0, night) {
    const F = this.proj(rec.a, rec.ax, rec.ay, CA_SC, rec.M.tilt), p = F.P(L.f, L.s, L.z - 0.12), r = 34 * CA_SC;
    ctx.save();
    ctx.translate(x0, y0); ctx.scale(1 / CA_SC, 1 / CA_SC);
    ctx.beginPath(); for (const pts of rec.glass) this.path(ctx, pts); ctx.clip();
    ctx.globalAlpha = 0.85 * night; ctx.drawImage(this.glow('d'), p[0] - r, p[1] - r, r * 2, r * 2);
    ctx.restore();
  },
  // head and shoulders of the player behind the glass
  drawDriver(ctx, c, rec, x0, y0) {
    const M = rec.M, look = Player.look();
    const F = this.proj(rec.a, rec.ax, rec.ay, CA_SC, M.tilt);
    const [f, sd, z] = M.seat;
    ctx.save();
    ctx.translate(x0, y0); ctx.scale(1 / CA_SC, 1 / CA_SC);
    ctx.beginPath(); for (const pts of rec.glass) this.path(ctx, pts); ctx.clip();
    const sh = F.P(f - 0.04, sd, z), hd = F.P(f, sd, z + 0.2), k = CA_SC;
    ctx.fillStyle = look.jacket || look.shirt || '#4a5a6a';
    ctx.beginPath(); ctx.ellipse(sh[0], sh[1], 7.5 * k, 5 * k, 0, 0, 7); ctx.fill();
    ctx.fillStyle = look.skin || '#c8a080';
    ctx.beginPath(); ctx.arc(hd[0], hd[1], 4.4 * k, 0, 7); ctx.fill();
    if (look.hat) { ctx.fillStyle = look.hat.col || '#333'; ctx.beginPath(); ctx.arc(hd[0], hd[1] - 1.2 * k, 4.6 * k, Math.PI, Math.PI * 2); ctx.fill(); }
    else if (look.hair && look.hairStyle !== 'bald') { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(hd[0], hd[1] - 0.8 * k, 4.4 * k, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); }
    // glass tint and reflection over the driver
    ctx.fillStyle = 'rgba(40,60,80,0.28)'; ctx.fillRect(sh[0] - 20 * k, hd[1] - 12 * k, 40 * k, 30 * k);
    ctx.restore();
  },
});
// per-type body styling for the passenger-car builder (dimensions come from CAR_TYPES)
const CA_CARS = {
  base: { z0: 0.15, r: 0.17, axF: 0.31, axR: -0.3, nose: 0.07, tail: 0.03, chF: 0.1, chR: 0.08, rakeF: 0.27, rakeR: 0.2, tum: 0.09, gin: 0.05, doors: 4, bump: 'chrome', grille: 'chrome', lamps: 'quad', tails: 'wide', trim: 'chrome', rim: 'cap' },
  sedan: { vinyl: true, white: true },
  police: { bar: 'police', pushbar: true, trim: 'black', rim: 'steel', livery: 'bw', spot: true },
  taxi: { sign: true, checker: true, trim: 'black', rim: 'steel' },
  hatchback: { z0: 0.14, r: 0.16, axF: 0.33, axR: -0.32, nose: 0.08, chR: 0.05, rakeF: 0.26, rakeR: 0.3, tum: 0.08, doors: 2, hatch: true, bump: 'black', grille: 'black', lamps: 'rect', tails: 'vert', trim: 'black', rim: 'steel' },
  wagon: { rakeR: 0.06, hatch: true, wood: true, rack: true, tails: 'vert', quarter: true, white: true },
  sports: { cab: [-0.37, 0.15], z0: 0.11, r: 0.16, axF: 0.32, axR: -0.31, nose: 0.13, tail: 0.04, chF: 0.15, chR: 0.07, rakeF: 0.36, rakeR: 0.44, tum: 0.11, doors: 2, bump: 'body', grille: 'none', lamps: 'popup', tails: 'band', spoiler: true, trim: 'black', rim: 'alloy' },
  suv: { z0: 0.25, r: 0.21, axF: 0.31, axR: -0.31, nose: 0.05, tail: 0, chF: 0.07, chR: 0.05, rakeF: 0.2, rakeR: 0.04, tum: 0.06, hatch: true, rack: true, spare: true, two: '#a4a9ae', bump: 'black', grille: 'black', lamps: 'rect', tails: 'vert', flares: true, rim: 'steel' },
};
Object.assign(CarArt, {
  // ---------------------------------------------------------------- model helpers
  // part-level painters run after all faces of the part when the direction n faces the camera
  pfx(P, n, fn) { (P.pfx || (P.pfx = [])).push({ n, fn }); return P; },
  drawPart(g, F, P) {
    if (P.draw) return P.draw.call(this, g, F, P);
    if (P.hollow) this.drawHollow(g, F, P);
    else for (const fc of P.faces) if (F.vis(fc.n) > 1e-4) this.drawFace(g, F, fc, false);
    if (P.pfx) for (const x of P.pfx) if (F.vis(x.n) > 1e-4) { F.b = F.bright(x.n); g.save(); x.fn.call(this, g, F); g.restore(); g.setTransform(1, 0, 0, 1, 0, 0); }
  },
  // deterministic small hash of a string (colour / type) for styling choices
  hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; },
  seatCol(col) {
    const c = Col.rgb(col);
    if (c[0] > c[1] + 40 && c[0] > c[2] + 30) return '#5a2828';
    if (c[2] > c[0] + 25) return '#2e3a58';
    if (c[0] > 140 && c[1] > 120 && c[2] < 130) return '#7a6648';
    return '#3c3c40';
  },
  // lower body as one convex part from f0 (rear) to f1 (front): hood slopes from fC down to noseZ,
  // trunk deck from fR down to tailZ; faces: sides, chamfers, front, rear, tops 'hood' / 'deck' / 'trunk'
  lowerBody(o) {
    const { f0, f1, hw, z0, zb, fC, fR, noseZ, tailZ, chF, chR, col } = o;
    const zf = (f) => f > fC ? zb - (zb - noseZ) * (f - fC) / (f1 - fC) : f < fR ? zb - (zb - tailZ) * (fR - f) / Math.max(1e-6, fR - f0) : zb;
    let ol = [[f0 + chR, -hw], [fR, -hw], [fC, -hw], [f1 - chF, -hw], [f1, -hw + chF], [f1, hw - chF], [f1 - chF, hw], [fC, hw], [fR, hw], [f0 + chR, hw], [f0, hw - chR], [f0, -hw + chR]];
    ol = ol.filter((q, i) => { const r = ol[(i + 1) % ol.length]; return Math.abs(q[0] - r[0]) + Math.abs(q[1] - r[1]) > 1e-6; });
    const A = ol.map(q => [q[0], q[1], z0]), B = ol.map(q => [q[0], q[1], zf(q[0])]);
    const P = this.solid(A, B, col, { noA: true, noB: true, body: true });
    const top = (pred, id) => {
      const p = B.filter(q => pred(q[0]));
      const n = p.length >= 3 && this.normal(p, P.c);
      if (n) P.faces.push({ p, n, t: 'T', id, col, mat: 'paint', fx: null, win: null });
    };
    top(f => f >= fC - 1e-6, 'hood'); top(f => f >= fR - 1e-6 && f <= fC + 1e-6, 'deck'); top(f => f <= fR + 1e-6, 'trunk');
    P.zf = zf;
    P.sideOl = [[f0 + chR, z0], [f1 - chF, z0], [f1 - chF, zf(f1 - chF)], [fC, zb], [fR, zb], [f0 + chR, zf(f0 + chR)]];
    return P;
  },
  // greenhouse: hollow part between the beltline outline and the roof outline
  cabin(o) {
    const { fR, fC, gw, gwT, zb, zr, rakeF, rakeR, col } = o;
    const A = [[fR, -gw, zb], [fC, -gw, zb], [fC, gw, zb], [fR, gw, zb]];
    const B = [[fR + rakeR, -gwT, zr], [fC - rakeF, -gwT, zr], [fC - rakeF, gwT, zr], [fR + rakeR, gwT, zr]];
    const P = this.solid(A, B, col, { tags: ['L', 'F', 'R', 'B'], tA: 'D', tB: 'T', cols: { T: o.roof || col } });
    P.hollow = true; P.inner = []; P.inCol = o.inCol;
    return P;
  },
  // trapezoid bumper wrapping the chamfered corners; dir 1 front, -1 rear; fe = body end
  bumper(dir, fe, hw, ch, z0, z1, mat, col) {
    const d = 0.055 * dir, b = fe - dir * Math.max(0.03, ch * 0.9);
    const ol = dir > 0 ? [[b, -hw + 0.012], [fe + d, -hw + ch * 0.55], [fe + d, hw - ch * 0.55], [b, hw - 0.012]] : [[fe + d, -hw + ch * 0.55], [b, -hw + 0.012], [b, hw - 0.012], [fe + d, hw - ch * 0.55]];
    return this.prism(ol, z0, z1, mat === 'chrome' ? CA_COL.chrome : mat === 'body' ? col : CA_COL.black, { mat: mat === 'chrome' ? 'chrome' : 'paint', skip: [dir > 0 ? 'B' : 'F'] });
  },
  // front bucket seats (+ headrests) at fs, optional rear bench at fr; w = half width available
  seats(P, fs, fr, zb, w, col, burnt) {
    const sc = burnt ? '#2a2420' : col;
    for (const sd of [-1, 1]) {
      const s0 = sd < 0 ? -w : 0.035, s1 = sd < 0 ? -0.035 : w;
      P.inner.push(this.box(fs - 0.07, fs, s0, s1, zb - 0.02, zb + 0.19, sc));
      if (!burnt) P.inner.push(this.box(fs - 0.06, fs - 0.015, s0 + (s1 - s0) * 0.25, s1 - (s1 - s0) * 0.25, zb + 0.19, zb + 0.26, sc));
    }
    if (fr !== null) P.inner.push(this.box(fr - 0.07, fr, -w, w, zb - 0.02, zb + 0.15, sc));
  },
  wheel(M, f, side, r, o) {
    const idx = (f > 0 ? 0 : 2) + (side > 0 ? 1 : 0);
    M.wheels.push(Object.assign({ f, s: side * (M.hw - 0.012), r, w: 0.15, side, steer: f > 0, st: M.S.tyres[idx], burnt: M.S.burnt, idx }, o || {}));
  },
  lamp(M, k, f, s, z, idx) {
    const broken = M.S.burnt || (idx !== undefined && M.S.lights[idx] === 1);
    M.lt.push({ k, f, s, z, broken, ph: 0, c: 'w' });
  },
});
Object.assign(CarArt, {
  // ---------------------------------------------------------------- painted detail
  // frame on a quad face: (x, y) in 0..k across the face (p0 -> p1) and up (p0 -> p3)
  qframe(g, F, fc, k) {
    const [p0, p1, , p3] = fc.p, K = 1 / (k || 1);
    F.frame(g, p0, [(p1[0] - p0[0]) * K, (p1[1] - p0[1]) * K, (p1[2] - p0[2]) * K], [(p3[0] - p0[0]) * K, (p3[1] - p0[1]) * K, (p3[2] - p0[2]) * K]);
  },
  snowCap(g, F, fc, ins) {
    let cx = 0, cy = 0;
    const pts = fc.p.map(q => F.P(q[0], q[1], q[2]));
    for (const q of pts) { cx += q[0] / pts.length; cy += q[1] / pts.length; }
    const k = 1 - (ins || 0.1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = Col.shade('#eef2f6', F.b * 0.98);
    g.beginPath(); this.path(g, pts.map(q => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k - 1.5])); g.fill();
    g.fillStyle = Col.shade('#ffffff', F.b); g.beginPath(); this.path(g, pts.map(q => [cx + (q[0] - cx) * k * 0.8, cy + (q[1] - cy) * k * 0.8 - 2.5])); g.fill();
  },
  // dents, scratches and rust inside the current frame (units * 100); lvl 0..3
  dmgArt(g, F, M, lvl, seed, a0, a1, b0, b1, col) {
    if (lvl <= 0 && !M.S.burnt) return;
    const rng = new RNG(seed), k = 100;
    if (M.S.burnt) lvl = 3;
    for (let i = 0; i < lvl * 3; i++) {
      const x = rng.f(a0, a1) * k, y = rng.f(b0, b0 + (b1 - b0) * 0.45) * k, r = rng.f(2.5, 6) * (0.6 + lvl * 0.25);
      g.fillStyle = Col.shade(i & 1 ? '#5a2e16' : CA_COL.rust, F.b);
      g.globalAlpha = 0.85;
      for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(x + rng.f(-r, r), y + rng.f(-r * 0.5, r * 0.5), r * rng.f(0.35, 0.8), 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
    if (lvl >= 2) for (let i = 0; i < lvl * 2 - 1; i++) {
      const x = rng.f(a0, a1) * k, y = rng.f(b0, b1) * k, rx = rng.f(5, 11) * lvl * 0.5, ry = rx * rng.f(0.5, 0.8);
      g.fillStyle = 'rgba(0,0,0,0.34)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x - rx * 0.2, y + ry * 0.15, rx * 0.55, ry * 0.5, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y + ry * 0.2, rx * 0.85, ry * 0.75, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
    g.strokeStyle = 'rgba(235,235,230,0.45)'; g.lineWidth = 0.7;
    for (let i = 0; i < lvl * 2; i++) { const x = rng.f(a0, a1) * k, y = rng.f(b0, b1) * k; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rng.f(6, 16), y + rng.f(-3, 3)); g.stroke(); }
  },
  star(g, F, x, y, r, col) {
    g.fillStyle = F.sh(col); g.beginPath();
    for (let i = 0; i < 10; i++) { const an = Math.PI / 2 + i * Math.PI / 5, rr = i & 1 ? r * 0.42 : r; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    g.fill();
  },
  sideLvl(M, side) { const S = M.S; return S.sides ? S.sides[side] : S.d >= 3 ? 3 : S.d >= 2 ? ((S.seed + (side === 'left' ? 0 : 1)) & 1 ? 2 : 1) : S.d; },
  sideArt(g, F, M, side) {
    const sp = M.sp, S = M.S, k = 100, zb = M.zb, z0 = M.z0, B = M.body, hw = M.sideHw || M.hw;
    F.frame(g, [0, side * hw, 0], [1, 0, 0], [0, 0, 1], 0.01);
    g.beginPath(); B.sideOl.forEach((q, i) => i ? g.lineTo(q[0] * k, q[1] * k) : g.moveTo(q[0] * k, q[1] * k)); g.closePath(); g.clip();
    const R = (a, b, c, d) => g.fillRect(a * k, b * k, (c - a) * k, (d - b) * k);
    const f0 = M.f0, f1 = M.f1, zt = M.zTrim, live = !S.burnt;
    if (sp.two && live) { g.fillStyle = F.sh(sp.two); if (M.band) R(f0, zt - 0.04, f1, zt + 0.05); else { R(f0, z0, f1, zt); g.fillStyle = F.sh(sp.two, 0.8); R(f0, zt, f1, zt + 0.012); } }
    if (M.wood && live) {
      const a = f0 + 0.08, b = M.fC + 0.04;
      g.fillStyle = F.sh('#7a5030'); R(a, z0 + 0.09, b, zb - 0.045);
      g.strokeStyle = F.sh('#5a3820'); g.lineWidth = 0.8; g.beginPath();
      for (let z = z0 + 0.12; z < zb - 0.05; z += 0.035) { g.moveTo(a * k, z * k); for (let f = a; f < b; f += 0.12) g.lineTo(f * k, (z + Math.sin(f * 37 + z * 50) * 0.006) * k); }
      g.stroke(); g.strokeStyle = F.sh('#d8c49a'); g.lineWidth = 2; g.strokeRect(a * k, (z0 + 0.09) * k, (b - a) * k, (zb - z0 - 0.135) * k);
    }
    const di = side < 0 ? [0, 2] : [1, 3];
    for (let j = 0; j < M.doorF.length; j++) {
      const [a, b] = M.doorF[j], ds = S.doors[di[j]];
      if (ds) {
        g.fillStyle = F.sh(CA_COL.inside, 0.75); R(a, z0 + 0.05, b, zb + 0.02);
        g.fillStyle = F.sh(M.seat2 || CA_COL.seat, 0.95); R(a + 0.05, zb - 0.17, b - 0.04, zb - 0.07);
        g.fillStyle = F.sh(CA_COL.black, 0.8); R(a, z0 + 0.05, b, z0 + 0.09);
        continue;
      }
      if (sp.livery === 'bw' && live) { g.fillStyle = F.sh(S.col); R(a, z0 + 0.035, b, zb + 0.02); }
      g.strokeStyle = 'rgba(0,0,0,0.42)'; g.lineWidth = 1.1; g.strokeRect(a * k, (z0 + 0.035) * k, (b - a) * k, (zb - z0) * k);
      g.fillStyle = F.sh(sp.trim === 'chrome' && live ? CA_COL.chrome : CA_COL.black); R(a + 0.035, zb - 0.08, a + 0.1, zb - 0.058);
    }
    // body side molding and lamps
    if (sp.livery !== 'bw' && !M.wood) { g.fillStyle = F.sh(sp.trim === 'chrome' && live ? CA_COL.chrome : CA_COL.black, 0.95); R(f0 + 0.1, zt - 0.009, f1 - 0.1, zt + 0.009); }
    if (live) {
      g.fillStyle = F.sh(CA_COL.amber); R(f1 - sp.chF - 0.08, zb - sp.nose - 0.14, f1 - sp.chF - 0.02, zb - sp.nose - 0.1);
      if (!M.noRear) { g.fillStyle = F.sh(CA_COL.tail); R(f0 + M.chR + 0.02, M.tailZ - 0.14, f0 + M.chR + 0.08, M.tailZ - 0.1); }
    }
    if (sp.livery === 'bw' && live) {
      const [a, b] = M.doorF[0], cx = (a + b) / 2;
      g.fillStyle = F.sh('#d8b040'); g.beginPath();
      for (let i = 0; i < 10; i++) { const an = Math.PI / 2 + i * Math.PI / 5, r = (i & 1 ? 0.024 : 0.055) * k; g.lineTo(cx * k + Math.cos(an) * r, (zb - 0.19) * k + Math.sin(an) * r); }
      g.fill();
      const [c0, c1] = M.doorF[1] || M.doorF[0];
      F.frame(g, [(c0 + c1) / 2, side * hw, zb - 0.16], [side, 0, 0], [0, 0, -1], 0.01);
      g.fillStyle = F.sh('#111'); g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POLICE', 0, 0);
      F.frame(g, [0, side * hw, 0], [1, 0, 0], [0, 0, 1], 0.01);
    }
    if (M.star) { const [a, b] = M.doorF[0]; this.star(g, F, (a + b) / 2 * k, (zb - 0.2) * k, 0.1 * k, '#e8e8e0'); }
    if (sp.checker && live) {
      for (let f = M.fR + 0.02, i = 0; f < M.fC + 0.06; f += 0.045, i++) for (let r = 0; r < 2; r++) { g.fillStyle = F.sh((i + r) & 1 ? '#111111' : '#f2f2ea'); R(f, zb - 0.12 + r * 0.04, f + 0.045, zb - 0.08 + r * 0.04); }
    }
    if (S.d && live) { const gr = g.createLinearGradient(0, z0 * k, 0, (z0 + 0.24) * k); gr.addColorStop(0, 'rgba(70,56,40,' + (0.16 * S.d) + ')'); gr.addColorStop(1, 'rgba(70,56,40,0)'); g.fillStyle = gr; R(f0, z0, f1, z0 + 0.24); }
    this.dmgArt(g, F, M, this.sideLvl(M, side < 0 ? 'left' : 'right'), S.seed * 131 + side * 17 + 5, f0 + 0.15, f1 - 0.15, z0 + 0.04, zb - 0.06);
    // wheel wells
    for (const w of M.wheels) {
      if (w.side !== side) continue;
      const r0 = (w.r + 0.035) * k;
      g.fillStyle = F.sh('#111113'); g.beginPath(); g.arc(w.f * k, w.r * k, r0, 0, 7); g.rect(w.f * k - r0, z0 * k - 4, r0 * 2, (w.r - z0) * k + 4); g.fill();
      g.strokeStyle = sp.flares && live ? F.sh(CA_COL.black) : F.sh(M.paint, 0.7); g.lineWidth = sp.flares ? 5 : 1.6;
      g.beginPath(); g.arc(w.f * k, w.r * k, r0 + (sp.flares ? 2 : 0.5), 0, Math.PI); g.stroke();
    }
    g.fillStyle = F.sh(CA_COL.black, 0.85); R(f0, z0, f1, z0 + 0.03);
  },
  frontArt(g, F, M) {
    const sp = M.sp, S = M.S, k = 100, w = M.hw - sp.chF, z0 = M.z0, zt = M.noseZ, live = !S.burnt;
    F.frame(g, [M.f1, 0, 0], [0, 1, 0], [0, 0, 1], 0.01);
    g.beginPath(); g.rect(-w * k, z0 * k, 2 * w * k, (zt - z0) * k); g.clip();
    const R = (a, b, c, d) => g.fillRect(a * k, b * k, (c - a) * k, (d - b) * k);
    const lz1 = zt - 0.035, lz0 = lz1 - 0.075, gw = w - 0.215;
    if (sp.grille === 'chrome' || sp.grille === 'black') {
      const ch = sp.grille === 'chrome' && live;
      g.fillStyle = F.sh(ch ? CA_COL.chrome : '#2a2b2e'); R(-gw, lz0 - 0.03, gw, lz1 + 0.005);
      g.fillStyle = F.sh('#141416'); R(-gw + 0.02, lz0 - 0.015, gw - 0.02, lz1 - 0.012);
      g.fillStyle = F.sh(ch ? '#b8c0c8' : '#3a3c40');
      for (let z = lz0 - 0.005; z < lz1 - 0.015; z += 0.022) R(-gw + 0.02, z, gw - 0.02, z + 0.007);
      if (ch) { g.fillStyle = F.sh('#e8ecf0'); R(-0.01, lz0 - 0.015, 0.01, lz1 - 0.012); }
    } else if (sp.grille === 'army') {
      g.fillStyle = F.sh('#1a1c18'); R(-gw - 0.04, z0 + 0.1, gw + 0.04, zt - 0.03);
      g.fillStyle = F.sh(M.paint, 0.9); for (let s = -gw - 0.02; s < gw + 0.03; s += 0.05) R(s, z0 + 0.12, s + 0.02, zt - 0.05);
    } else { g.fillStyle = F.sh('#141416'); R(-w + 0.08, z0 + 0.1, w - 0.08, z0 + 0.15); }
    for (const sd of [-1, 1]) {
      const a = sd * (w - 0.02), b = sd * (w - 0.2), s0 = Math.min(a, b), s1 = Math.max(a, b);
      const broken = S.burnt || S.lights[sd < 0 ? 0 : 1] === 1;
      if (sp.lamps === 'popup') { if (live) { g.fillStyle = F.sh(CA_COL.amber); R(s0 + 0.02, z0 + 0.12, s0 + 0.09, z0 + 0.16); } continue; }
      g.fillStyle = F.sh(sp.trim === 'chrome' && live ? CA_COL.chrome : CA_COL.black); R(s0 - 0.01, lz0 - 0.01, s1 + 0.01, lz1 + 0.01);
      const lens = (x0, x1) => {
        g.fillStyle = broken ? F.sh('#2c2c2a') : F.sh(CA_COL.head, 1.05); R(x0, lz0, x1, lz1);
        if (!broken) { g.fillStyle = 'rgba(255,255,255,0.55)'; R(x0 + 0.01, lz1 - 0.025, x0 + (x1 - x0) * 0.45, lz1 - 0.012); }
        else { g.strokeStyle = 'rgba(200,200,190,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x0 * k, lz0 * k); g.lineTo(x1 * k, lz1 * k); g.moveTo(x0 * k, lz1 * k); g.lineTo((x0 + x1) / 2 * k, lz0 * k); g.stroke(); }
      };
      if (sp.lamps === 'round') {
        const cx = (s0 + s1) / 2 * k, cz = (lz0 + lz1) / 2 * k, r = Math.min(s1 - s0, 0.13) * 40;
        g.fillStyle = F.sh(CA_COL.black); g.beginPath(); g.arc(cx, cz, r * 1.25, 0, 7); g.fill();
        g.fillStyle = broken ? F.sh('#2c2c2a') : F.sh(CA_COL.head, 1.05); g.beginPath(); g.arc(cx, cz, r, 0, 7); g.fill();
        if (!broken) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(cx - r * 0.3, cz + r * 0.3, r * 0.35, 0, 7); g.fill(); }
        continue;
      }
      if (sp.lamps === 'quad') { const m = (s0 + s1) / 2; lens(s0, m - 0.008); lens(m + 0.008, s1); } else lens(s0, s1);
      if (live) { g.fillStyle = F.sh(CA_COL.amber); R(s0, lz0 - 0.06, s1, lz0 - 0.025); }
    }
    const fl = M.S.sides ? M.S.sides.front : S.d >= 3 ? 3 : S.d >= 2 ? 1 : 0;
    this.dmgArt(g, F, M, fl, S.seed * 7 + 3, -w, w, z0 + 0.03, zt - 0.02);
  },
  rearArt(g, F, M) {
    const sp = M.sp, S = M.S, k = 100, w = M.hw - M.chR, z0 = M.z0, zt = M.tailZ, live = !S.burnt;
    F.frame(g, [M.f0, 0, 0], [0, 1, 0], [0, 0, 1], 0.01);
    g.beginPath(); g.rect(-w * k, z0 * k, 2 * w * k, (zt - z0) * k); g.clip();
    const R = (a, b, c, d) => g.fillRect(a * k, b * k, (c - a) * k, (d - b) * k);
    for (const sd of [-1, 1]) {
      const broken = S.burnt || S.lights[sd < 0 ? 2 : 3] === 1;
      const red = broken ? F.sh('#3a1a16') : F.sh(CA_COL.tail, 1.08);
      if (sp.tails === 'vert') {
        const a = sd * (w - 0.015), b = sd * (w - 0.12), s0 = Math.min(a, b), s1 = Math.max(a, b);
        g.fillStyle = F.sh(CA_COL.black); R(s0 - 0.008, z0 + 0.13, s1 + 0.008, zt - 0.012);
        g.fillStyle = red; R(s0, z0 + 0.14, s1, zt - 0.02);
        if (live) { g.fillStyle = F.sh('#e8e8e4'); R(s0, z0 + 0.14, s1, z0 + 0.18); g.fillStyle = F.sh(CA_COL.amber); R(s0, z0 + 0.18, s1, z0 + 0.21); }
      } else {
        const a = sd * (w - 0.015), b = sd * (sp.tails === 'band' ? 0.02 : w - 0.3), s0 = Math.min(a, b), s1 = Math.max(a, b);
        g.fillStyle = F.sh(CA_COL.black); R(s0 - 0.008, zt - 0.14, s1 + 0.008, zt - 0.03);
        g.fillStyle = red; R(s0, zt - 0.13, s1, zt - 0.04);
        if (live) {
          g.fillStyle = 'rgba(0,0,0,0.3)'; for (let s = s0 + 0.03; s < s1 - 0.01; s += 0.04) R(s, zt - 0.13, s + 0.006, zt - 0.04);
          const r0 = sd < 0 ? s1 - 0.05 : s0, r1 = sd < 0 ? s1 : s0 + 0.05;
          g.fillStyle = F.sh('#e8e8e4'); R(r0, zt - 0.13, r1, zt - 0.09);
        }
      }
    }
    if (sp.hatch && S.trunk) { g.fillStyle = F.sh('#1c1c1e'); R(-(w - 0.14), z0 + 0.13, w - 0.14, zt + 0.01); this.dmgArt(g, F, M, S.d >= 2 ? 1 : 0, S.seed * 11 + 9, -w, w, z0 + 0.03, z0 + 0.12); return; }
    // trunk / hatch seam, plate in a recess, badge
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(-(w - 0.02) * k, (sp.hatch ? z0 + 0.12 : zt - 0.16) * k); g.lineTo((w - 0.02) * k, (sp.hatch ? z0 + 0.12 : zt - 0.16) * k); g.stroke();
    g.fillStyle = F.sh('#1a1a1c'); R(-0.105, z0 + 0.14, 0.105, z0 + 0.25);
    g.fillStyle = F.sh(live ? CA_COL.plate : '#4a443e'); R(-0.09, z0 + 0.15, 0.09, z0 + 0.24);
    if (live) { g.fillStyle = F.sh('#2a3a7a'); R(-0.09, z0 + 0.22, 0.09, z0 + 0.24); g.fillStyle = F.sh('#202020'); for (let i = 0; i < 5; i++) R(-0.07 + i * 0.03, z0 + 0.17, -0.05 + i * 0.03, z0 + 0.205); }
    if (live) { g.fillStyle = F.sh(CA_COL.chrome); R(w - 0.2, zt - 0.025, w - 0.1, zt - 0.012); }
    const rl = M.S.sides ? M.S.sides.rear : S.d >= 3 ? 2 : S.d >= 2 ? 1 : 0;
    this.dmgArt(g, F, M, rl, S.seed * 11 + 9, -w, w, z0 + 0.03, zt - 0.02);
  },
  // hood plane: x along the hood from the cowl, y across
  hoodArt(g, F, fc, M) {
    const S = M.S, sp = M.sp, k = 100, len = M.f1 - M.fC, dz = -(M.zb - M.noseZ) / len, w = M.hw;
    F.frame(g, [M.fC, 0, M.zb], [1, 0, dz], [0, 1, 0], 0.01);
    const R = (a, b, c, d) => g.fillRect(a * k, b * k, (c - a) * k, (d - b) * k);
    if (S.hood) { this.engineBay(g, F, M, len, w); return; }
    g.fillStyle = F.sh(CA_COL.black, 0.9); R(0.005, -M.gw + 0.02, 0.05, M.gw - 0.02);
    g.strokeStyle = F.sh('#101010'); g.lineWidth = 1.2; g.beginPath(); g.moveTo(2, -M.gw * 60); g.lineTo(4.5, -M.gw * 10); g.moveTo(2, M.gw * 30); g.lineTo(4.5, M.gw * 80); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
    g.beginPath(); for (const sd of [-1, 1]) { g.moveTo(5, sd * (w - 0.075) * k); g.lineTo((len - 0.02) * k, sd * (w - sp.chF * 0.7 - 0.05) * k); } g.stroke();
    if (sp.trim === 'chrome' && !S.burnt) { g.fillStyle = F.sh(CA_COL.chrome); g.beginPath(); g.arc((len - 0.06) * k, 0, 1.8, 0, 7); g.fill(); }
    if (M.star) { g.strokeStyle = F.sh('#e8e8e0'); g.lineWidth = 1.5; g.beginPath(); g.arc(len * 0.5 * k, 0, 0.17 * k, 0, 7); g.stroke(); this.star(g, F, len * 0.5 * k, 0, 0.15 * k, '#e8e8e0'); }
    if (sp.lamps === 'popup' && !S.pop) { g.strokeStyle = 'rgba(0,0,0,0.45)'; for (const sd of [-1, 1]) g.strokeRect((len - 0.17) * k, sd > 0 ? (w - 0.27) * k : -(w - 0.07) * k, 0.12 * k, 0.2 * k); }
    const fl = M.S.sides ? M.S.sides.front : S.d >= 3 ? 3 : S.d >= 2 ? 2 : 0;
    this.dmgArt(g, F, M, fl, S.seed * 23 + 1, 0.05, len - 0.05, -w + 0.1, w - 0.1);
    if (S.snow) this.snowCap(g, F, fc, 0.12);
  },
  engineBay(g, F, M, len, w) {
    const k = 100, R = (a, b, c, d) => g.fillRect(a * k, b * k, (c - a) * k, (d - b) * k);
    g.fillStyle = F.sh('#1c1c1e'); R(0.02, -w + 0.06, len - 0.02, w - 0.06);
    g.fillStyle = F.sh('#4a4c50'); R(0.08, -w * 0.45, len * 0.75, w * 0.45);
    g.fillStyle = F.sh('#8a2a20'); R(0.1, -w * 0.4, len * 0.7, -w * 0.12); R(0.1, w * 0.12, len * 0.7, w * 0.4);
    g.fillStyle = F.sh('#141414'); g.beginPath(); g.arc(len * 0.42 * k, 0, w * 0.32 * k, 0, 7); g.fill();
    g.fillStyle = F.sh('#6a6c70'); g.beginPath(); g.arc(len * 0.42 * k, 0, w * 0.08 * k, 0, 7); g.fill();
    g.fillStyle = F.sh('#202022'); R(len * 0.15, w - 0.28, len * 0.45, w - 0.08);
    g.fillStyle = F.sh('#c02020'); R(len * 0.2, w - 0.12, len * 0.24, w - 0.09);
    g.fillStyle = F.sh('#3a3c40'); R(len - 0.08, -w + 0.08, len - 0.03, w - 0.08);
  },
  trunkArt(g, F, fc, M) {
    const S = M.S, k = 100, len = M.fR - M.f0, w = M.hw;
    if (len < 0.08) return;
    const dz = (M.tailZ - M.zb) / len;
    F.frame(g, [M.fR, 0, M.zb], [-1, 0, dz], [0, 1, 0], 0.01);
    const R = (a, b, c, d) => g.fillRect(a * k, b * k, (c - a) * k, (d - b) * k);
    if (S.trunk && !M.sp.hatch) {
      g.fillStyle = F.sh('#1a1a1c'); R(0.04, -w + 0.07, len - 0.03, w - 0.07);
      g.strokeStyle = F.sh('#2c2c2e'); g.lineWidth = 6; g.beginPath(); g.arc(len * 0.5 * k, -w * 0.4 * k, w * 0.28 * k, 0, 7); g.stroke();
      return;
    }
    g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 1.1; g.strokeRect(0.035 * k, -(w - 0.07) * k, (len - 0.06) * k, (w - 0.07) * 2 * k);
    if (!S.burnt) { g.fillStyle = F.sh(CA_COL.chrome); g.beginPath(); g.arc((len - 0.05) * k, 0, 1.4, 0, 7); g.fill(); }
    if (S.snow) this.snowCap(g, F, fc, 0.14);
  },
  roofArt(g, F, fc, M) {
    const S = M.S, k = 100, x0 = M.fR + M.sp.rakeR, len = M.fC - M.sp.rakeF - x0;
    F.frame(g, [x0, 0, M.zr], [1, 0, 0], [0, 1, 0], 0.01);
    if (M.vinyl && !S.burnt) { g.fillStyle = F.sh(M.vinyl); g.fillRect(-1, -(M.gwT + 0.01) * k, (len * 0.82) * k, (M.gwT + 0.01) * 2 * k); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 0.6; for (let x = 4; x < len * 80; x += 5) { g.beginPath(); g.moveTo(x, -M.gwT * k); g.lineTo(x, M.gwT * k); g.stroke(); } }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2;
    g.beginPath(); for (const sd of [-1, 1]) { g.moveTo(1, sd * (M.gwT - 0.012) * k); g.lineTo((len - 0.01) * k, sd * (M.gwT - 0.012) * k); } g.stroke();
    if (S.snow) this.snowCap(g, F, fc, 0.08);
  },
  // cabin sides: belt molding, black B-pillar; windshield wipers / mirror; rear defroster lines
  cabinArt(M, P) {
    const sp = M.sp, S = M.S, bl = (sp.trim === 'chrome' && !S.burnt) ? CA_COL.chrome : CA_COL.black;
    for (const t of ['L', 'R']) this.fx(P, t, (g, F, fc) => {
      const q = (u, v) => { const p = this.uv(fc, u, v); return F.P(p[0], p[1], p[2]); };
      g.fillStyle = F.sh(bl); g.beginPath(); this.path(g, [q(0, 0), q(1, 0), q(1, 0.06), q(0, 0.06)]); g.fill();
      if (sp.doors === 4 && !S.burnt) { g.fillStyle = F.sh(CA_COL.black, 0.9); g.beginPath(); this.path(g, [q(0.475, 0.07), q(0.525, 0.07), q(0.525, 0.93), q(0.475, 0.93)]); g.fill(); }
    });
    this.fx(P, 'F', (g, F, fc) => {
      if (S.glass.windshield === 2 || S.burnt) return;
      const q = (u, v) => { const p = this.uv(fc, u, v); return F.P(p[0], p[1], p[2]); };
      g.strokeStyle = '#0c0c0c'; g.lineWidth = 1.4; g.beginPath();
      for (const [a, b] of [[0.12, 0.45], [0.55, 0.88]]) { const p0 = q(a, 0.1), p1 = q(b, 0.16); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
      g.stroke();
      const m = q(0.5, 0.86); g.fillStyle = '#18181a'; g.fillRect(m[0] - 3, m[1] - 1, 6, 2.5);
    });
    this.fx(P, 'B', (g, F, fc) => {
      if (S.glass.rearWindow || S.burnt || (sp.hatch && S.trunk)) return;
      const q = (u, v) => { const p = this.uv(fc, u, v); return F.P(p[0], p[1], p[2]); };
      g.strokeStyle = 'rgba(150,90,60,0.35)'; g.lineWidth = 0.6; g.beginPath();
      for (let v = 0.3; v < 0.8; v += 0.09) { const a = q(0.12, v), b = q(0.88, v); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
      g.stroke();
    });
    this.fx(P, 'T', (g, F, fc) => this.roofArt(g, F, fc, M));
  },
});
Object.assign(CarArt, {
  // ---------------------------------------------------------------- model assembly
  build(mk) {
    const S = this.parseKey(mk);
    const T = CAR_TYPES[S.type] || { len: 2.3, wid: 1.05, h: 0.72, cab: [-0.32, 0.22], cabH: 0.52 };
    const M = { parts: [], wheels: [], lt: [], tilt: [0, 0, 0], S, T, hl: T.len / 2, hw: T.wid / 2, seat: [0, -T.wid * 0.2, T.h + 0.12], bar: null };
    // cosmetic damage derived from the key: faded paint, crumpled ends, a cracked windshield
    S.col0 = S.col;
    if (!S.burnt) {
      S.col = Col.mix(S.col, '#6a6258', [0, 0.07, 0.15, 0.26][S.d] || 0);
      if (S.d >= 2 && !S.glass.windshield) S.glass.windshield = 1;
      S.crF = (S.sides ? S.sides.front >= 3 : S.d >= 3) ? 0.09 : 0;
      S.crR = S.sides && S.sides.rear >= 3 ? 0.07 : 0;
    } else S.crF = S.crR = 0;
    const b = this['b_' + S.type];
    if (b) b.call(this, M, S, T); else if (T.bed && this.b_pickup) this.b_pickup(M, S, T); else this.b_car(M, S, T);
    this.finish(M);
    return M;
  },
  // text on the outside of a face (reads correctly from outside); o centre, u reading direction
  text(g, F, o, u, txt, px, col) {
    F.frame(g, o, u, [0, 0, -1], 0.01);
    g.fillStyle = col; g.font = 'bold ' + px + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0);
  },
  // reading direction for a vertical face tag
  tdir(t) { return t === 'L' ? [-1, 0, 0] : t === 'R' ? [1, 0, 0] : t === 'F' ? [0, -1, 0] : [0, 1, 0]; },
  // label all four vertical faces of box part P
  label(P, txt, px, col, only) {
    for (const fc of P.faces) {
      if ('LRFB'.indexOf(fc.t) < 0 || (only && only.indexOf(fc.t) < 0)) continue;
      (fc.fx || (fc.fx = [])).push((g, F, f) => {
        const o = [0, 0, 0]; for (const q of f.p) { o[0] += q[0] / 4; o[1] += q[1] / 4; o[2] += q[2] / 4; }
        const n = f.n; o[0] += n[0] * 0.002; o[1] += n[1] * 0.002;
        this.text(g, F, o, this.tdir(f.t), txt, px, F.sh(col));
      });
    }
    return P;
  },
  // thin line part (antenna) from (f, s, z) up by h
  stick(f, s, z, h, col) {
    return { bb: [f - 0.01, f + 0.01, s - 0.01, s + 0.01, z, z + h], c: [f, s, z + h / 2], faces: [], draw(g, F) { const a = F.P(f, s, z), b = F.P(f - 0.05, s, z + h); g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } };
  },
  b_car(M, S, T) {
    const sp = Object.assign({}, CA_CARS.base, CA_CARS[S.type] || {});
    if (S.type === 'suv') sp.quarter = true;
    const L = T.len, W = T.wid, hl = L / 2, hw = W / 2, h = this.hash(S.col0);
    const paint = S.burnt ? CA_COL.burnt : sp.livery === 'bw' ? '#1a1b1e' : S.col;
    const z0 = sp.z0, zb = T.h, zr = T.h + T.cabH;
    const ce = sp.cab || T.cab;
    const fC = Math.min(hl - 0.3, L * ce[1]);
    const fR = Math.max(-hl + (sp.hatch ? 0.06 : 0.32), Math.min(fC - 0.5, L * ce[0]));
    const chR = Math.min(sp.chR, Math.max(0, (fR + hl) * 0.7));
    // keep a roof: windshield + rear window rake must leave at least 0.28 of roof
    const rk = sp.rakeF + sp.rakeR, room = fC - fR - 0.28;
    if (rk > room) { sp.rakeF *= room / rk; sp.rakeR *= room / rk; }
    Object.assign(M, { sp, L, W, hl, hw, z0, zb, zr, fC, fR, chR, f0: -hl + S.crR, f1: hl - S.crF, noseZ: zb - sp.nose - S.crF * 0.5, tailZ: zb - sp.tail - S.crR * 0.5, gw: hw - sp.gin, gwT: hw - sp.gin - sp.tum, paint, zTrim: z0 + (zb - z0) * 0.46, seat2: sp.livery === 'bw' ? '#2a2a2e' : this.seatCol(S.col) });
    const c3 = Col.rgb(S.col0), dark = c3[0] * 0.3 + c3[1] * 0.59 + c3[2] * 0.11 < 110;
    if (sp.vinyl && h % 3 === 0) M.vinyl = dark ? '#e2ddd0' : '#3a2c26';
    if (sp.wood && h % 3 !== 1) M.wood = true;
    // lower body with painted sides, front, rear, hood and trunk
    const body = M.body = this.lowerBody({ f0: M.f0, f1: M.f1, hw, z0, zb, fC, fR, noseZ: M.noseZ, tailZ: M.tailZ, chF: sp.chF, chR, col: paint });
    M.parts.push(body);
    const fB = fR + (fC - fR) * 0.5;
    M.doorF = sp.doors === 4 ? [[fB + 0.012, fC + 0.07], [fR + (sp.quarter ? (fC - fR) * 0.29 : 0.03), fB - 0.012]] : [[fR + (fC - fR) * 0.34, fC + 0.07]];
    this.pfx(body, [0, -1, 0], (g, F) => this.sideArt(g, F, M, -1));
    this.pfx(body, [0, 1, 0], (g, F) => this.sideArt(g, F, M, 1));
    this.pfx(body, [1, 0, 0], (g, F) => this.frontArt(g, F, M));
    this.pfx(body, [-1, 0, 0], (g, F) => this.rearArt(g, F, M));
    for (const fc of body.faces) {
      if (fc.id === 'hood') fc.fx = [(g, F, f) => this.hoodArt(g, F, f, M)];
      if (fc.id === 'trunk') fc.fx = [(g, F, f) => this.trunkArt(g, F, f, M)];
    }
    // greenhouse with windows, seats and dash
    const cabCol = S.burnt ? CA_COL.burnt : sp.livery === 'bw' ? S.col : paint;
    const cab = M.cab = this.cabin({ fR, fC, gw: M.gw, gwT: M.gwT, zb, zr, rakeF: sp.rakeF, rakeR: sp.rakeR, col: cabCol, roof: cabCol, inCol: S.burnt ? '#1a1612' : null });
    M.parts.push(cab);
    const gs = (id, di) => S.burnt ? 4 : (di !== undefined && S.doors[di]) ? 4 : S.glass[id];
    this.win(this.face(cab, 'F'), 'windshield', 0.05, 0.95, 0.06, 0.93, gs('windshield'));
    this.win(this.face(cab, 'B'), 'rearWindow', 0.07, 0.93, 0.08, 0.9, sp.hatch && S.trunk ? 4 : gs('rearWindow'));
    for (const [t, sd] of [['L', 0], ['R', 1]]) {
      const fc = this.face(cab, t), fr = sd ? 'winFR' : 'winFL', rr = sd ? 'winRR' : 'winRL';
      if (sp.doors === 4) {
        if (sp.quarter) this.win(fc, 'q', 0.04, 0.26, 0.1, 0.9, S.burnt ? 4 : 0);
        this.win(fc, rr, sp.quarter ? 0.31 : 0.08, 0.47, 0.1, 0.9, gs(rr, sd ? 3 : 2));
        this.win(fc, fr, 0.53, 0.95, 0.1, 0.9, gs(fr, sd));
      } else {
        this.win(fc, rr, 0.07, 0.3, 0.12, 0.88, gs(rr));
        this.win(fc, fr, 0.36, 0.95, 0.1, 0.9, gs(fr, sd));
      }
    }
    const sw = M.gwT - 0.035;
    const fs = fR + (fC - fR) * (sp.doors === 4 ? (sp.quarter ? 0.68 : 0.62) : 0.55);
    const fr2 = S.type === 'sports' ? null : sp.quarter ? fR + (fC - fR) * 0.42 : sp.hatch ? fR + (fC - fR) * 0.3 : fR + 0.17;
    this.seats(cab, fs, fr2, zb, sw, M.seat2, S.burnt);
    cab.inner.push(this.box(fC - 0.2, fC - 0.1, -sw, sw, zb - 0.02, zb + 0.07, '#222226'));
    M.seat = [fs - 0.02, -sw * 0.5, zb + 0.12];
    this.cabinArt(M, cab);
    // bumpers (plates), mirrors, wheels, lamps
    const bm = S.burnt ? 'black' : sp.bump;
    const fbp = this.bumper(1, M.f1, hw, sp.chF, z0 + 0.02 - S.crF * 0.3, z0 + 0.14 - S.crF * 0.3, bm, paint), rbp = this.bumper(-1, M.f0, hw, chR, z0 + 0.02, z0 + 0.14, bm, paint);
    if (!(S.crF && S.seed & 1)) M.parts.push(fbp);
    M.parts.push(rbp);
    if (!S.burnt && S.type !== 'sports') this.fx(fbp, 'F', (g, F, fc) => { this.qframe(g, F, fc, 100); g.fillStyle = F.sh(CA_COL.plate); g.fillRect(41.5, 18, 17, 64); g.fillStyle = F.sh('#222'); g.fillRect(44, 40, 12, 18); });
    this.fx(rbp, 'B', (g, F, fc) => { this.qframe(g, F, fc, 100); g.fillStyle = '#0c0c0c'; g.beginPath(); g.ellipse(22, 8, 3.5, 9, 0, 0, 7); g.fill(); });
    const mc = S.burnt ? CA_COL.burnt : sp.trim === 'chrome' ? CA_COL.chrome : sp.livery === 'bw' ? CA_COL.black : paint;
    for (const sd of [-1, 1]) {
      const s0 = sd > 0 ? hw - 0.005 : -hw - 0.065, s1 = sd > 0 ? hw + 0.065 : -hw + 0.005;
      M.parts.push(this.box(fC - 0.15, fC - 0.065, s0, s1, zb + 0.015, zb + 0.09, mc, { mat: mc === CA_COL.chrome ? 'chrome' : 'paint' }));
    }
    const rim = sp.rim === 'cap' ? CA_COL.rim : sp.rim === 'alloy' ? '#d6dade' : CA_COL.steel;
    const white = sp.white && h % 2 === 0;
    for (const f of [L * sp.axF, L * sp.axR]) for (const sd of [-1, 1]) this.wheel(M, f, sd, sp.r, { rim, white, spokes: sp.rim === 'alloy' });
    const wf = hw - sp.chF, wr = hw - chR;
    if (sp.lamps !== 'popup') for (const sd of [-1, 1]) this.lamp(M, 'h', M.f1 + 0.004, sd * (wf - 0.11), M.noseZ - 0.072, sd < 0 ? 0 : 1);
    for (const sd of [-1, 1]) {
      const i = sd < 0 ? 2 : 3;
      if (sp.tails === 'vert') { this.lamp(M, 't', M.f0 - 0.004, sd * (wr - 0.065), (z0 + 0.14 + M.tailZ) / 2 + 0.03, i); this.lamp(M, 'r', M.f0 - 0.004, sd * (wr - 0.065), z0 + 0.16, i); }
      else { this.lamp(M, 't', M.f0 - 0.004, sd * (wr - (sp.tails === 'band' ? 0.22 : 0.15)), M.tailZ - 0.085, i); this.lamp(M, 'r', M.f0 - 0.004, sd * (wr - 0.27), M.tailZ - 0.11, i); }
    }
    this.lamp(M, 'c', sp.hatch ? fR + sp.rakeR - 0.012 : fR + 0.06, 0, sp.hatch ? zr - 0.03 : zb + 0.035);
    this.lamp(M, 'd', (fR + fC) / 2, 0, zr - 0.02);
    this.carExtras(M, S, sp);
  },
  carExtras(M, S, sp) {
    const live = !S.burnt, rf0 = M.fR + sp.rakeR, rf1 = M.fC - sp.rakeF, rc = (rf0 + rf1) / 2, zr = M.zr, w = M.gwT;
    if (sp.bar && live) {
      // light bar: black base, red / clear / blue lenses
      const f0 = rc - 0.03, f1 = rc + 0.09;
      M.parts.push(this.box(f0, f1, -w + 0.01, w - 0.01, zr, zr + 0.025, CA_COL.black));
      M.parts.push(this.box(f0 + 0.005, f1 - 0.005, -w + 0.02, -0.07, zr + 0.025, zr + 0.085, '#b81c1c'));
      M.parts.push(this.box(f0 + 0.01, f1 - 0.01, -0.06, 0.06, zr + 0.025, zr + 0.075, '#d8dcdc', { mat: 'chrome' }));
      M.parts.push(this.box(f0 + 0.005, f1 - 0.005, 0.07, w - 0.02, zr + 0.025, zr + 0.085, '#1c34c0'));
      M.lt.push({ k: 'b', f: (f0 + f1) / 2, s: -w * 0.55, z: zr + 0.06, c: 'r', ph: 0 }, { k: 'b', f: (f0 + f1) / 2, s: w * 0.55, z: zr + 0.06, c: 'b', ph: 4 });
      M.bar = ['r', 'b'];
    }
    if (sp.pushbar && live) {
      for (const sd of [-1, 1]) M.parts.push(this.box(M.hl + 0.06, M.hl + 0.095, sd * 0.2 - 0.022, sd * 0.2 + 0.022, M.z0 + 0.04, M.noseZ + 0.02, CA_COL.black));
      M.parts.push(this.box(M.hl + 0.06, M.hl + 0.095, -0.25, 0.25, M.noseZ + 0.02, M.noseZ + 0.055, CA_COL.black));
    }
    if (sp.spot && live) M.parts.push(this.box(M.fC - 0.06, M.fC - 0.005, -M.hw - 0.055, -M.hw - 0.005, M.zb + 0.13, M.zb + 0.18, CA_COL.chrome, { mat: 'chrome' }));
    if (live && (S.type === 'police')) for (const sd of [-0.5, 0.5]) { const a = this.stick(M.f0 + 0.12, sd * M.hw, M.tailZ, 0.5, '#202020'); a.on = M.body; M.parts.push(a); }
    else if (live && (S.type === 'sedan' || S.type === 'wagon')) { const a = this.stick(M.f1 - 0.3, M.hw - 0.07, M.noseZ + 0.03, 0.42, '#303030'); a.on = M.body; M.parts.push(a); }
    if (sp.sign && live) {
      const sg = this.prism([[rc - 0.11, -0.16], [rc + 0.11, -0.16], [rc + 0.11, 0.16], [rc - 0.11, 0.16]], zr + 0.012, zr + 0.11, '#f2eedc');
      this.label(sg, 'TAXI', 6, '#1a1a1a', 'LR');
      M.parts.push(this.box(rc - 0.07, rc + 0.07, -0.12, 0.12, zr, zr + 0.012, CA_COL.black), sg);
      M.lt.push({ k: 'b', f: rc, s: 0, z: zr + 0.07, c: 'a', ph: 0, taxi: true });
    }
    if (sp.rack && live) {
      const mat = S.type === 'wagon' ? 'chrome' : 'paint', col = S.type === 'wagon' ? CA_COL.chrome : CA_COL.black;
      for (const sd of [-1, 1]) M.parts.push(this.box(rf0 + 0.04, rf1 - 0.03, sd * (w - 0.015) - 0.012, sd * (w - 0.015) + 0.012, zr, zr + 0.03, col, { mat }));
      for (const f of [rf0 + 0.16, rf1 - 0.16]) M.parts.push(this.box(f - 0.015, f + 0.015, -w + 0.04, w - 0.04, zr + 0.03, zr + 0.05, col, { mat }));
    }
    if (sp.spare && live) M.parts.push(this.spare(M.f0, 0, (M.z0 + M.zb) / 2 + 0.04, 0.2));
    if (sp.spoiler && live) {
      for (const sd of [-1, 1]) { const p = this.box(M.f0 + 0.06, M.f0 + 0.1, sd * (M.hw - 0.16) - 0.015, sd * (M.hw - 0.16) + 0.015, M.zb - 0.02, M.zb + 0.06, CA_COL.black); p.on = M.body; M.parts.push(p); }
      const wing = this.box(M.f0 + 0.015, M.f0 + 0.15, -M.hw + 0.05, M.hw - 0.05, M.zb + 0.06, M.zb + 0.09, M.paint); wing.on = M.body;
      M.parts.push(wing);
    }
    if (sp.lamps === 'popup' && S.pop) {
      const wf = M.hw - sp.chF;
      for (const sd of [-1, 1]) {
        const a = sd * (wf - 0.03), b = sd * (wf - 0.24), zh = M.body.zf(M.f1 - 0.14);
        const p = this.box(M.f1 - 0.2, M.f1 - 0.08, Math.min(a, b), Math.max(a, b), zh, zh + 0.1, M.paint);
        this.fx(p, 'F', (g, F, fc) => { this.qframe(g, F, fc, 100); g.fillStyle = F.sh(CA_COL.head, 1.05); g.fillRect(10, 15, 80, 65); });
        p.on = M.body; M.parts.push(p);
        this.lamp(M, 'h', M.f1 - 0.075, (a + b) / 2, zh + 0.05, sd < 0 ? 0 : 1);
      }
    }
  },
  // spare wheel on the back, axis along f, outer face at f0 - 0.1
  spare(f0, s, z, r) {
    return { bb: [f0 - 0.11, f0 - 0.001, s - r, s + r, z - r, z + r], c: [f0 - 0.05, s, z], faces: [], draw(g, F) {
      const ring = (f) => { const p = []; for (let k = 0; k < 16; k++) { const t = k / 16 * Math.PI * 2; p.push(F.P(f, s + Math.cos(t) * r, z + Math.sin(t) * r)); } return p; };
      const a = ring(f0 - 0.001), b = ring(f0 - 0.1), v = F.vis([-1, 0, 0]) > 0;
      for (let k = 0; k < 16; k++) {
        const j = (k + 1) % 16, t = (k + 0.5) / 16 * Math.PI * 2, n = [0, Math.cos(t), Math.sin(t)];
        if (F.vis(n) <= 0) continue;
        g.fillStyle = Col.shade('#1a1a1c', F.bright(n)); g.beginPath(); g.moveTo(a[k][0], a[k][1]); g.lineTo(a[j][0], a[j][1]); g.lineTo(b[j][0], b[j][1]); g.lineTo(b[k][0], b[k][1]); g.closePath(); g.fill();
      }
      if (v) {
        const bb = F.bright([-1, 0, 0]);
        g.fillStyle = Col.shade('#202022', bb); g.beginPath(); CarArt.path(g, b); g.fill();
        F.frame(g, [f0 - 0.1, s, z], [0, 1, 0], [0, 0, 1], 0.01);
        g.strokeStyle = Col.shade('#d8d8d0', bb); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * 70, 0, 7); g.stroke();
        g.fillStyle = Col.shade('#5a5e62', bb); g.beginPath(); g.arc(0, 0, r * 30, 0, 7); g.fill();
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
    } };
  },
});
Object.assign(CarArt, {
  // ride height (missing / flat tyres, burnt shells) as a least-squares plane, then opened panels
  finish(M) {
    const d = [0, 0, 0, 0];
    let fA = -1e9, fB = 1e9;
    for (const w of M.wheels) {
      const dr = w.burnt || w.st === 2 ? w.r * 0.34 : w.st === 1 ? w.r * 0.18 : 0;
      d[w.idx] = Math.max(d[w.idx], dr);
      fA = Math.max(fA, w.f); fB = Math.min(fB, w.f);
    }
    if (M.wheels.length && fA > fB) {
      const sw = M.hw, mean = (d[0] + d[1] + d[2] + d[3]) / 4;
      const ds = ((d[1] + d[3]) - (d[0] + d[2])) / (4 * sw), df = ((d[0] + d[1]) - (d[2] + d[3])) / (2 * (fA - fB));
      M.tilt = [mean - df * (fA + fB) / 2, df, ds];
    }
    if (M.body && M.doorF) this.openParts(M);
  },
  // thin panel solid: base edge a -> b (local points), extruded by vector e (height) and thickness n*t
  panel(a, b, e, n, col, o) {
    const A = [a, b, [b[0] + e[0], b[1] + e[1], b[2] + e[2]], [a[0] + e[0], a[1] + e[1], a[2] + e[2]]];
    const B = A.map(q => [q[0] - n[0] * 0.025, q[1] - n[1] * 0.025, q[2] - n[2] * 0.025]);
    return this.solid(A, B, col, o);
  },
  openParts(M) {
    const S = M.S, sp = M.sp || {}, live = !S.burnt;
    const inner = '#3a3a3e';
    // doors swing out about their front hinge
    for (let j = 0; j < M.doorF.length; j++) for (const sd of [-1, 1]) {
      const id = (j ? 2 : 0) + (sd > 0 ? 1 : 0);
      if (S.doors[id] !== 1) continue;
      const [a, b] = M.doorF[j], Ld = b - a, th = 1.0, hw = M.hw + 0.02;
      const H = [b, sd * hw], u = [-Math.cos(th), sd * Math.sin(th)], on = [Math.sin(th), sd * Math.cos(th), 0];
      const E = [H[0] + u[0] * Ld, H[1] + u[1] * Ld];
      const col = live ? (sp.livery === 'bw' ? S.col : M.paint) : CA_COL.burnt;
      const lo = this.panel([H[0], H[1], M.z0 + 0.04], [E[0], E[1], M.z0 + 0.04], [0, 0, M.zb - M.z0 - 0.04], on, col, { cols: {} });
      for (const fc of lo.faces) if (F_dot(fc.n, on) < -0.5) fc.col = inner;
      lo.k = 'door'; M.parts.push(lo);
      if (M.cab && M.zr) {
        const wh = (M.zr - M.zb) * 0.86, ins = sp.rakeF ? Math.min(0.2, sp.rakeF * 0.6) : 0;
        const a2 = [H[0] + u[0] * (j ? 0 : ins), H[1] + u[1] * (j ? 0 : ins), M.zb], b2 = [E[0], E[1], M.zb];
        const up = this.panel(a2, b2, [0, 0, wh], on, col, {});
        for (const fc of up.faces) if (Math.abs(F_dot(fc.n, on)) > 0.5) { this.win(fc, 'door', 0.08, 0.92, 0.1, 0.88, S.burnt ? 4 : S.glass[['winFL', 'winFR', 'winRL', 'winRR'][id]]); if (F_dot(fc.n, on) < 0) fc.col = inner; }
        M.parts.push(up);
      }
    }
    // hood hinged at the cowl
    if (S.hood === 1 && M.noseZ !== undefined && !M.noHood) {
      const th = 1.05, Lh = M.f1 - (sp.chF || 0.08) * 0.5 - M.fC - 0.03, w = M.hw - 0.03;
      const h0 = [M.fC + 0.03, -w, M.zb + 0.002], h1 = [M.fC + 0.03, w, M.zb + 0.002];
      const nrm = [-Math.sin(th), 0, Math.cos(th)];
      const hp = this.panel(h0, h1, [Math.cos(th) * Lh, 0, Math.sin(th) * Lh], [-nrm[0], 0, -nrm[2]], live ? M.paint : CA_COL.burnt, {});
      for (const fc of hp.faces) if (F_dot(fc.n, nrm) < -0.5) fc.col = '#3c3c3a';
      M.parts.push(hp);
    }
    // trunk lid hinged at the rear window, or the hatch hinged at the roof
    if (S.trunk === 1 && M.fR !== undefined && !M.noTrunk) {
      if (sp.hatch && M.zr) {
        const ph = 0.38, hf = M.fR + sp.rakeR, Lh = Math.hypot(sp.rakeR, M.zr - M.zb) + (M.zb - M.z0) * 0.45, w = M.gw;
        const nrm = [Math.sin(ph), 0, Math.cos(ph)];
        const hp = this.panel([hf, -w, M.zr + 0.03], [hf, w, M.zr + 0.03], [-Math.cos(ph) * Lh, 0, Math.sin(ph) * Lh], [nrm[0], 0, nrm[2]], live ? M.paint : CA_COL.burnt, {});
        for (const fc of hp.faces) { const dd = F_dot(fc.n, nrm); if (dd < -0.5) fc.col = inner; else if (dd > 0.5) this.win(fc, 'hatch', 0.08, 0.92, 0.32, 0.94, S.burnt ? 4 : S.glass.rearWindow); }
        M.parts.push(hp);
      } else if (M.fR - M.f0 > 0.15) {
        const th = 1.2, hf = M.fR - 0.035, Lt = M.fR - M.f0 - (M.chR || 0) * 0.5 - 0.04, w = M.hw - 0.04;
        const nrm = [Math.sin(th), 0, Math.cos(th)];
        const tp = this.panel([hf, -w, M.zb + 0.002], [hf, w, M.zb + 0.002], [-Math.cos(th) * Lt, 0, Math.sin(th) * Lt], [-nrm[0], 0, -nrm[2]], live ? M.paint : CA_COL.burnt, {});
        for (const fc of tp.faces) if (F_dot(fc.n, nrm) < -0.5) fc.col = '#3c3c3a';
        M.parts.push(tp);
      }
    }
  },
});
function F_dot(a, b) { return a[0] * b[0] + a[1] * b[1] + (a[2] || 0) * (b[2] || 0); }
Object.assign(CarArt, {
  // ---------------------------------------------------------------- trucks & box bodies
  // side-profile extrusion: convex [f, z] profile swept across s0..s1 (caps are the L / R sides)
  xbody(prof, s0, s1, col, o) { return this.solid(prof.map(q => [q[0], s0, q[1]]), prof.map(q => [q[0], s1, q[1]]), col, o); },
  // window on a vertical side face between f0..f1, z0..z1
  sideWin(fc, id, f0, f1, z0, z1, st, f1t) {
    if (!fc) return;
    const s = fc.p[0][1];
    (fc.win || (fc.win = [])).push({ id, st: st || 0, p: [[f0, s, z0], [f1, s, z0], [f1t === undefined ? f1 : f1t, s, z1], [f0, s, z1]] });
  },
  sideFace(P, sd) { return P.faces.find(fc => fc.t === (sd < 0 ? 'L' : 'R') && Math.abs(fc.n[1]) > 0.95); },
  // painter on the side plane s = sd*hw clipped to the face: fn(g, R, k) in (f, z) units * 100
  sidePaint(P, sd, hw, fn) {
    return this.pfx(P, [0, sd, 0], (g, F) => {
      const fc = this.sideFace(P, sd);
      if (!fc) return;
      F.frame(g, [0, sd * hw, 0], [1, 0, 0], [0, 0, 1], 0.01);
      g.beginPath(); fc.p.forEach((q, i) => i ? g.lineTo(q[0] * 100, q[2] * 100) : g.moveTo(q[0] * 100, q[2] * 100)); g.closePath(); g.clip();
      fn(g, F, (a, b, c, d) => g.fillRect(a * 100, b * 100, (c - a) * 100, (d - b) * 100));
    });
  },
  // dark wheel wells for the wheels on side sd (inside a sidePaint frame)
  wells(g, F, M, sd, z0, flare) {
    for (const w of M.wheels) {
      if (w.side !== sd || w.dup) continue;
      const r0 = (w.r + 0.035) * 100;
      g.fillStyle = F.sh('#111113'); g.beginPath(); g.arc(w.f * 100, w.r * 100, r0, 0, 7); g.rect(w.f * 100 - r0, z0 * 100 - 6, r0 * 2, (w.r - z0) * 100 + 6); g.fill();
      g.strokeStyle = F.sh(flare || M.paint, flare ? 1 : 0.7); g.lineWidth = flare ? 4 : 1.6; g.beginPath(); g.arc(w.f * 100, w.r * 100, r0 + 1, 0, Math.PI); g.stroke();
    }
  },
  // shared truck front: hood slab + 2-door cab (lower body + greenhouse) from fb (cab back) to the nose
  truckFront(M, S, o) {
    const sp = Object.assign({}, CA_CARS.base, o.sp || {});
    const hl = M.hl, hw = o.hw || M.hw, live = !S.burnt;
    const paint = o.paint || (S.burnt ? CA_COL.burnt : S.col);
    Object.assign(M, { sp, hw, sideHw: hw, z0: o.z0, zb: o.zb, zr: o.zr, fC: o.fC, fR: o.fb, chR: 0, f0: o.fb, f1: hl, noseZ: o.zb - sp.nose, tailZ: o.zb, gw: hw - sp.gin, gwT: hw - sp.gin - sp.tum, paint, zTrim: o.z0 + (o.zb - o.z0) * 0.46, seat2: this.seatCol(S.col), noRear: true, noTrunk: true });
    const body = M.body = this.lowerBody({ f0: o.fb, f1: hl, hw, z0: o.z0, zb: o.zb, fC: o.fC, fR: o.fb, noseZ: M.noseZ, tailZ: o.zb, chF: sp.chF, chR: 0, col: paint });
    M.parts.push(body);
    M.doorF = [[o.fb + 0.04, o.fC + 0.06]];
    this.pfx(body, [0, -1, 0], (g, F) => this.sideArt(g, F, M, -1));
    this.pfx(body, [0, 1, 0], (g, F) => this.sideArt(g, F, M, 1));
    this.pfx(body, [1, 0, 0], (g, F) => this.frontArt(g, F, M));
    for (const fc of body.faces) if (fc.id === 'hood') fc.fx = [(g, F, f) => this.hoodArt(g, F, f, M)];
    const cc = o.cabCol || paint;
    const cab = M.cab = this.cabin({ fR: o.fb, fC: o.fC, gw: M.gw, gwT: M.gwT, zb: o.zb, zr: o.zr, rakeF: sp.rakeF, rakeR: sp.rakeR, col: cc, roof: o.roof || cc, inCol: S.burnt ? '#1a1612' : null });
    M.parts.push(cab);
    const gs = (id, di) => S.burnt ? 4 : (di !== undefined && S.doors[di]) ? 4 : S.glass[id];
    this.win(this.face(cab, 'F'), 'windshield', 0.05, 0.95, 0.06, 0.93, gs('windshield'));
    this.win(this.face(cab, 'B'), 'rearWindow', 0.22, 0.78, 0.3, 0.85, gs('rearWindow'));
    this.win(this.face(cab, 'L'), 'winFL', 0.12, 0.95, 0.1, 0.9, gs('winFL', 0));
    this.win(this.face(cab, 'R'), 'winFR', 0.12, 0.95, 0.1, 0.9, gs('winFR', 1));
    const sw = M.gwT - 0.035, fs = o.fb + (o.fC - o.fb) * 0.5;
    this.seats(cab, fs, null, o.zb, sw, M.seat2, S.burnt);
    cab.inner.push(this.box(o.fC - 0.2, o.fC - 0.1, -sw, sw, o.zb - 0.02, o.zb + 0.07, '#222226'));
    M.seat = [fs - 0.02, -sw * 0.5, o.zb + 0.12];
    this.cabinArt(M, cab);
    const fbp = this.bumper(1, hl, hw, sp.chF, o.z0 + 0.02, o.z0 + 0.16, S.burnt ? 'black' : sp.bump, paint);
    M.parts.push(fbp);
    if (live) this.fx(fbp, 'F', (g, F, fc) => { this.qframe(g, F, fc, 100); g.fillStyle = F.sh(CA_COL.plate); g.fillRect(41.5, 18, 17, 64); });
    const mc = S.burnt ? CA_COL.burnt : sp.trim === 'chrome' ? CA_COL.chrome : CA_COL.black;
    for (const sd of [-1, 1]) {
      if (S.doors[sd < 0 ? 0 : 1] === 1) continue;
      const s0 = sd > 0 ? hw - 0.005 : -hw - 0.08, s1 = sd > 0 ? hw + 0.08 : -hw + 0.005;
      M.parts.push(this.box(o.fC - 0.16, o.fC - 0.07, s0, s1, o.zb + 0.02, o.zb + 0.13, mc, { mat: mc === CA_COL.chrome ? 'chrome' : 'paint' }));
    }
    const wf = hw - sp.chF;
    for (const sd of [-1, 1]) this.lamp(M, 'h', hl + 0.004, sd * (wf - 0.11), M.noseZ - 0.072, sd < 0 ? 0 : 1);
    this.lamp(M, 'd', (o.fb + o.fC) / 2, 0, o.zr - 0.02);
    return { body, cab, sp };
  },
  b_pickup(M, S, T) {
    const L = T.len, hl = M.hl, hw = M.hw, h = this.hash(S.col0), live = !S.burnt;
    const z0 = 0.2, zb = T.h, zr = T.h + T.cabH, fb = L * T.cab[0], fC = L * T.cab[1] + 0.02;
    const { sp } = this.truckFront(M, S, { z0, zb, zr, fb, fC, sp: { r: 0.19, axF: 0.31, axR: -0.31, nose: 0.06, chF: 0.08, rakeF: 0.2, rakeR: 0.02, tum: 0.07, doors: 2, lamps: 'rect', grille: 'chrome', two: h % 2 ? null : (Col.rgb(S.col)[0] > 150 ? '#8a3a2a' : '#c8c0a8') } });
    M.band = true;
    const paint = M.paint, zf = z0 + 0.2, bf = fb - 0.03, t = 0.055;
    // bed: floor, side walls, front wall, tailgate
    const floor = this.box(-hl + t, bf - t, -hw + t, hw - t, z0, zf, '#232325', { body: true });
    this.fx(floor, 'T', (g, F, fc) => { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; for (let s = -hw + t + 0.06; s < hw - t; s += 0.07) { const a = F.P(-hl + t, s, zf), b = F.P(bf - t, s, zf); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } if (S.snow) this.snowCap(g, F, fc, 0.1); });
    M.parts.push(floor);
    for (const sd of [-1, 1]) {
      const wall = this.box(-hl, bf, sd < 0 ? -hw : hw - t, sd < 0 ? -hw + t : hw, z0, zb - 0.02, paint, { body: true });
      this.sidePaint(wall, sd, hw, (g, F, R) => {
        if (sp.two && live) { g.fillStyle = F.sh(sp.two); R(-hl, M.zTrim - 0.04, bf, M.zTrim + 0.05); }
        else { g.fillStyle = F.sh(CA_COL.chrome); R(-hl, M.zTrim - 0.009, bf, M.zTrim + 0.009); }
        if (live) { g.fillStyle = F.sh(CA_COL.tail); R(-hl + 0.02, zb - 0.16, -hl + 0.08, zb - 0.12); g.fillStyle = 'rgba(0,0,0,0.4)'; R(bf - 0.26, zb - 0.2, bf - 0.18, zb - 0.12); }
        this.dmgArt(g, F, M, this.sideLvl(M, sd < 0 ? 'left' : 'right'), S.seed * 37 + sd * 3, -hl + 0.1, bf - 0.1, z0 + 0.04, zb - 0.06);
        this.wells(g, F, M, sd, z0);
        g.fillStyle = F.sh(CA_COL.black, 0.85); R(-hl, z0, bf, z0 + 0.03);
      });
      this.fx(wall, 'B', (g, F, fc) => { this.qframe(g, F, fc, 100); const br = S.burnt || S.lights[sd < 0 ? 2 : 3] === 1; g.fillStyle = F.sh(br ? '#3a1a16' : CA_COL.tail, 1.08); g.fillRect(8, 38, 84, 52); if (!br) { g.fillStyle = F.sh('#e8e8e4'); g.fillRect(8, 38, 84, 13); } });
      this.fx(wall, 'T', (g, F, fc) => { if (live) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = Col.shade(CA_COL.chrome, F.b * 0.95); g.beginPath(); this.path(g, fc.p.map(q => F.P(q[0], q[1], q[2]))); g.fill(); } });
      M.parts.push(wall);
    }
    M.parts.push(this.box(bf - t, bf, -hw + t, hw - t, zf, zb - 0.02, paint, { body: true }));
    if (S.trunk === 0) {
      const tg = this.box(-hl, -hl + 0.045, -hw + t, hw - t, z0 + 0.03, zb - 0.02, paint, { body: true });
      this.fx(tg, 'B', (g, F, fc) => { this.qframe(g, F, fc, 100); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(6, 18, 88, 66); g.fillStyle = F.sh(CA_COL.black); g.fillRect(44, 66, 12, 8); });
      M.parts.push(tg);
    } else if (S.trunk === 1) {
      const tg = this.box(-hl - 0.36, -hl, -hw + t, hw - t, zf - 0.045, zf, paint);
      this.fx(tg, 'T', (g, F, fc) => { this.qframe(g, F, fc, 100); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; g.strokeRect(8, 8, 84, 84); });
      M.parts.push(tg);
    }
    const rbp = this.bumper(-1, -hl, hw, 0.03, z0 + 0.0, z0 + 0.12, S.burnt ? 'black' : 'chrome', paint);
    if (live) this.fx(rbp, 'B', (g, F, fc) => { this.qframe(g, F, fc, 100); g.fillStyle = F.sh(CA_COL.plate); g.fillRect(41.5, 14, 17, 70); g.fillStyle = F.sh('#222'); g.fillRect(44, 34, 12, 20); });
    M.parts.push(rbp);
    for (const f of [L * 0.31, L * -0.31]) for (const sd of [-1, 1]) this.wheel(M, f, sd, 0.19, { rim: CA_COL.rim, white: h % 3 === 0 });
    for (const sd of [-1, 1]) { const i = sd < 0 ? 2 : 3; this.lamp(M, 't', -hl - 0.004, sd * (hw - 0.028), zb - 0.1, i); this.lamp(M, 'r', -hl - 0.004, sd * (hw - 0.028), zb - 0.155, i); }
    this.lamp(M, 'c', fb + 0.01, 0, zr - 0.03);
  },
  b_van(M, S, T) {
    const L = T.len, hl = M.hl, hw = M.hw, h = this.hash(S.col0), live = !S.burnt;
    const paint = S.burnt ? CA_COL.burnt : S.col;
    const z0 = 0.2, zh = T.h, zr = T.h + T.cabH, fC = L * T.cab[1], rake = 0.3, win = h % 2 === 0;
    const sp = Object.assign({}, CA_CARS.base, { nose: 0.1, chF: 0.08, lamps: 'rect', grille: h % 3 ? 'black' : 'chrome', bump: 'chrome', trim: 'black', r: 0.19 });
    Object.assign(M, { sp, z0, zb: zh, zr, fC, fR: -hl, chR: 0.05, f0: -hl, f1: hl, noseZ: zh - sp.nose, tailZ: zh, gw: hw, gwT: hw, paint, zTrim: z0 + 0.3, seat2: this.seatCol(S.col), noTrunk: true });
    const hood = M.body = this.lowerBody({ f0: fC, f1: hl, hw, z0, zb: zh, fC, fR: fC, noseZ: M.noseZ, tailZ: zh, chF: sp.chF, chR: 0, col: paint });
    M.doorF = [];
    this.pfx(hood, [1, 0, 0], (g, F) => this.frontArt(g, F, M));
    for (const fc of hood.faces) if (fc.id === 'hood') fc.fx = [(g, F, f) => this.hoodArt(g, F, f, M)];
    for (const sd of [-1, 1]) this.sidePaint(hood, sd, hw, (g, F, R) => { this.wells(g, F, M, sd, z0); g.fillStyle = F.sh(CA_COL.amber); R(hl - 0.16, zh - 0.2, hl - 0.1, zh - 0.15); });
    M.parts.push(hood);
    // tall body with raked windshield, hollow so the seats show through the glass
    const prof = [[-hl, z0], [fC, z0], [fC, zh], [fC - rake, zr], [-hl + 0.04, zr], [-hl, zr - 0.04]];
    const box = M.cab = this.xbody(prof, -hw, hw, paint, { body: true });
    box.hollow = true; box.inner = []; box.inCol = S.burnt ? '#1a1612' : null;
    M.parts.push(box);
    const gs = (id, di) => S.burnt ? 4 : (di !== undefined && S.doors[di]) ? 4 : S.glass[id];
    const ws = box.faces.find(fc => fc.n[0] > 0.5 && fc.n[2] > 0.2);
    this.win(ws, 'windshield', 0.04, 0.96, 0.08, 0.9, gs('windshield'));
    const fd0 = fC - 0.5, zw0 = zh + 0.05, zw1 = zr - 0.1;
    M.doorF = [[fd0, fC - 0.02]];
    for (const sd of [-1, 1]) {
      const fc = this.sideFace(box, sd);
      const fe = (z) => fC - rake * (z - zh) / (zr - zh) - 0.045;
      this.sideWin(fc, sd < 0 ? 'winFL' : 'winFR', fd0 + 0.05, fe(zw0), zw0, zw1 - 0.02, gs(sd < 0 ? 'winFL' : 'winFR', sd < 0 ? 0 : 1), fe(zw1 - 0.02));
      if (win) for (let k = 0; k < 3; k++) { const a = -hl + 0.12 + k * 0.5; this.sideWin(fc, sd < 0 ? 'winRL' : 'winRR', a, a + 0.4, zw0, zw1, S.burnt ? 4 : k === 1 && sd > 0 && S.doors[3] ? 4 : S.glass[sd < 0 ? 'winRL' : 'winRR']); }
    }
    const rf = box.faces.find(fc => fc.n[0] < -0.95);
    if (rf) { rf.win = []; for (const sd of [-1, 1]) rf.win.push({ id: 'rearWindow', st: S.trunk ? 4 : gs('rearWindow'), p: [[-hl, sd * 0.04, zw0], [-hl, sd * (hw - 0.1), zw0], [-hl, sd * (hw - 0.1), zw1], [-hl, sd * 0.04, zw1]] }); }
    const stripe = live && h % 3 !== 2 ? ['#7a3a1a', '#c86a20', '#e0b040'] : null;
    for (const sd of [-1, 1]) this.sidePaint(box, sd, hw, (g, F, R) => {
      if (stripe) stripe.forEach((c, i) => { g.fillStyle = F.sh(c); R(-hl, zh - 0.12 - i * 0.04, fC + 0.1, zh - 0.09 - i * 0.04); });
      g.strokeStyle = 'rgba(0,0,0,0.42)'; g.lineWidth = 1.1;
      g.strokeRect(fd0 * 100, (z0 + 0.04) * 100, (fC - 0.02 - fd0) * 100, (zr - z0 - 0.1) * 100);
      if (sd > 0) { g.strokeRect((fd0 - 0.75) * 100, (z0 + 0.04) * 100, 0.7 * 100, (zr - z0 - 0.1) * 100); g.fillStyle = F.sh(CA_COL.black); R(fd0 - 0.12, zh - 0.08, fd0 - 0.06, zh - 0.05); }
      g.fillStyle = F.sh(CA_COL.black); R(fd0 + 0.03, zh - 0.08, fd0 + 0.09, zh - 0.05);
      if (live) { g.fillStyle = F.sh(CA_COL.tail); R(-hl + 0.01, zh - 0.12, -hl + 0.06, zh - 0.08); }
      this.dmgArt(g, F, M, this.sideLvl(M, sd < 0 ? 'left' : 'right'), S.seed * 41 + sd, -hl + 0.15, fC - 0.1, z0 + 0.05, zh);
      this.wells(g, F, M, sd, z0);
      g.fillStyle = F.sh(CA_COL.black, 0.85); R(-hl, z0, fC, z0 + 0.035);
    });
    if (rf) (rf.fx || (rf.fx = [])).push((g, F, fc) => {
      F.frame(g, [-hl, 0, 0], [0, 1, 0], [0, 0, 1], 0.01);
      const R = (a, b, c, d) => g.fillRect(a * 100, b * 100, (c - a) * 100, (d - b) * 100);
      if (S.trunk) { g.fillStyle = F.sh('#1c1c1e'); R(-hw + 0.06, z0 + 0.06, hw - 0.06, zr - 0.06); }
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, (z0 + 0.05) * 100); g.lineTo(0, (zr - 0.05) * 100); g.stroke();
      for (const sd of [-1, 1]) { const br = S.burnt || S.lights[sd < 0 ? 2 : 3] === 1; g.fillStyle = F.sh(br ? '#3a1a16' : CA_COL.tail, 1.08); R(sd < 0 ? -hw + 0.01 : hw - 0.07, z0 + 0.2, sd < 0 ? -hw + 0.07 : hw - 0.01, zh - 0.05); }
      g.fillStyle = F.sh(CA_COL.plate); R(-0.09, z0 + 0.12, 0.09, z0 + 0.21);
    });
    const top = box.faces.find(fc => fc.t === 'T');
    if (top) top.fx = [(g, F, fc) => { if (S.snow) this.snowCap(g, F, fc, 0.06); }];
    // seats behind the glass
    const sw = hw - 0.08, fs = fC - 0.36;
    this.seats(box, fs, win ? fs - 0.55 : null, zh - 0.05, sw, M.seat2, S.burnt);
    if (win) box.inner.push(this.box(fs - 1.07, fs - 1.0, -sw, sw, zh - 0.07, zh + 0.12, S.burnt ? '#2a2420' : M.seat2));
    box.inner.push(this.box(fC - 0.26, fC - 0.14, -sw, sw, zh - 0.06, zh + 0.04, '#222226'));
    M.seat = [fs - 0.02, -sw * 0.5, zh + 0.07];
    const fbp = this.bumper(1, hl, hw, sp.chF, z0 + 0.02, z0 + 0.16, S.burnt ? 'black' : 'chrome', paint), rbp = this.bumper(-1, -hl, hw, 0.04, z0 + 0.02, z0 + 0.14, S.burnt ? 'black' : 'chrome', paint);
    if (live) this.fx(fbp, 'F', (g, F, fc) => { this.qframe(g, F, fc, 100); g.fillStyle = F.sh(CA_COL.plate); g.fillRect(41.5, 18, 17, 64); });
    M.parts.push(fbp, rbp);
    for (const sd of [-1, 1]) if (S.doors[sd < 0 ? 0 : 1] !== 1) M.parts.push(this.box(fC - 0.2, fC - 0.1, sd > 0 ? hw - 0.005 : -hw - 0.09, sd > 0 ? hw + 0.09 : -hw + 0.005, zh + 0.05, zh + 0.2, CA_COL.black));
    for (const f of [fC - 0.08, -hl + 0.62]) for (const sd of [-1, 1]) this.wheel(M, f, sd, 0.19, { rim: CA_COL.steel });
    const wf = hw - sp.chF;
    for (const sd of [-1, 1]) {
      this.lamp(M, 'h', hl + 0.004, sd * (wf - 0.11), M.noseZ - 0.072, sd < 0 ? 0 : 1);
      this.lamp(M, 't', -hl - 0.004, sd * (hw - 0.04), zh - 0.15, sd < 0 ? 2 : 3); this.lamp(M, 'r', -hl - 0.004, sd * (hw - 0.04), z0 + 0.24, sd < 0 ? 2 : 3);
    }
    this.lamp(M, 'd', fC - 0.4, 0, zr - 0.02);
  },
});
Object.assign(CarArt, {
  // light-bar of boxes across the roof at f0..f1; cols left / middle / right; adds flashing lamps
  lightbar(M, f0, f1, w, z, cols, glow) {
    M.parts.push(this.box(f0, f1, -w, w, z, z + 0.025, CA_COL.black));
    M.parts.push(this.box(f0 + 0.005, f1 - 0.005, -w + 0.01, -0.07, z + 0.025, z + 0.085, cols[0]));
    M.parts.push(this.box(f0 + 0.01, f1 - 0.01, -0.06, 0.06, z + 0.025, z + 0.075, cols[1], { mat: 'chrome' }));
    M.parts.push(this.box(f0 + 0.005, f1 - 0.005, 0.07, w - 0.01, z + 0.025, z + 0.085, cols[2]));
    M.lt.push({ k: 'b', f: (f0 + f1) / 2, s: -w * 0.55, z: z + 0.06, c: glow[0], ph: 0 }, { k: 'b', f: (f0 + f1) / 2, s: w * 0.55, z: z + 0.06, c: glow[1], ph: 4 });
    M.bar = glow;
  },
  // rear barn doors swung open against the sides
  barnDoors(M, z0, z1, col) {
    for (const sd of [-1, 1]) {
      const p = this.box(-M.hl - M.hw * 0.92, -M.hl - 0.004, sd < 0 ? -M.hw - 0.03 : M.hw, sd < 0 ? -M.hw : M.hw + 0.03, z0, z1, col);
      for (const fc of p.faces) if (fc.n[1] * sd < -0.5) fc.col = '#8a8a88';
      M.parts.push(p);
    }
  },
  b_ambulance(M, S, T) {
    const L = T.len, hl = M.hl, hw = M.hw, live = !S.burnt, white = S.burnt ? CA_COL.burnt : S.col;
    const z0 = 0.24, zb = 0.8, zr = 1.32, fC = hl - 0.42, fb = fC - 0.62, zB = T.h + T.cabH + 0.1;
    this.truckFront(M, S, { z0, zb, zr, fb, fC, hw: hw - 0.05, paint: white, sp: { r: 0.2, nose: 0.06, chF: 0.07, rakeF: 0.14, rakeR: 0.02, tum: 0.05, doors: 2, lamps: 'rect', grille: 'chrome', trim: 'black' } });
    M.sideHw = hw - 0.05; M.hw = hw; M.f0 = -hl;
    const red = live ? '#c41e1e' : '#3a2a24', bx1 = fb - 0.04;
    // stripe on the cab sides
    for (const sd of [-1, 1]) this.pfx(M.body, [0, sd, 0], (g, F) => { F.frame(g, [0, sd * (hw - 0.05), 0], [1, 0, 0], [0, 0, 1], 0.01); g.fillStyle = F.sh(red); g.fillRect(fb * 100, (zb - 0.2) * 100, (hl - 0.06 - fb) * 100, 7); });
    const box = this.prism(this.rect(-hl, bx1, -hw, hw, 0.04, 0.04), z0 + 0.02, zB, white, { body: true });
    for (const sd of [-1, 1]) this.sidePaint(box, sd, hw, (g, F, R) => {
      g.fillStyle = F.sh(red); R(-hl, zb - 0.2, bx1, zb - 0.13);
      R(-hl + 0.1, zB - 0.1, bx1 - 0.04, zB - 0.06);
      const cx = (-hl + bx1) / 2 - 0.15, cz = zb + 0.32;
      if (live) { g.fillStyle = F.sh('#f8f8f4'); R(cx - 0.17, cz - 0.17, cx + 0.17, cz + 0.17); g.fillStyle = F.sh(red); R(cx - 0.05, cz - 0.15, cx + 0.05, cz + 0.15); R(cx - 0.15, cz - 0.05, cx + 0.15, cz + 0.05); }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.1;
      g.strokeRect((bx1 - 0.55) * 100, (z0 + 0.06) * 100, 0.45 * 100, (zb - z0 - 0.08) * 100); g.strokeRect((-hl + 0.08) * 100, (z0 + 0.06) * 100, 0.5 * 100, (zb - z0 - 0.08) * 100);
      this.dmgArt(g, F, M, this.sideLvl(M, sd < 0 ? 'left' : 'right'), S.seed * 53 + sd, -hl + 0.1, bx1 - 0.1, z0 + 0.05, zb);
      this.wells(g, F, M, sd, z0);
      if (live) { F.frame(g, [-hl / 2 + bx1 / 2 + 0.25, sd * hw, zB - 0.22], [sd, 0, 0], [0, 0, -1], 0.01); g.fillStyle = F.sh(red); g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AMBULANCE', 0, 0); }
    });
    const rear = this.face(box, 'B');
    if (rear) {
      rear.win = [-1, 1].map(sd => ({ id: 'rearWindow', st: S.trunk ? 4 : S.burnt ? 4 : S.glass.rearWindow, p: [[-hl, sd * 0.05, zb + 0.1], [-hl, sd * 0.3, zb + 0.1], [-hl, sd * 0.3, zB - 0.25], [-hl, sd * 0.05, zB - 0.25]] }));
      rear.fx = [(g, F) => {
        F.frame(g, [-hl, 0, 0], [0, 1, 0], [0, 0, 1], 0.01);
        const R = (a, b, c, d) => g.fillRect(a * 100, b * 100, (c - a) * 100, (d - b) * 100);
        if (S.trunk) { g.fillStyle = F.sh('#202022'); R(-hw + 0.08, z0 + 0.08, hw - 0.08, zB - 0.12); return; }
        g.fillStyle = F.sh(red); R(-hw + 0.04, zb - 0.2, hw - 0.04, zb - 0.13);
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, (z0 + 0.06) * 100); g.lineTo(0, (zB - 0.12) * 100); g.stroke();
        for (const sd of [-1, 1]) { const br = S.burnt || S.lights[sd < 0 ? 2 : 3] === 1; g.fillStyle = F.sh(br ? '#3a1a16' : CA_COL.tail, 1.08); R(sd < 0 ? -hw + 0.06 : hw - 0.13, z0 + 0.12, sd < 0 ? -hw + 0.13 : hw - 0.06, z0 + 0.36); g.fillStyle = F.sh(live ? '#e02020' : '#3a1a16'); R(sd < 0 ? -hw + 0.06 : hw - 0.13, zB - 0.11, sd < 0 ? -hw + 0.14 : hw - 0.05, zB - 0.04); }
        if (live) { g.fillStyle = F.sh(red); R(-0.05, zb + 0.2, 0.05, zb + 0.44); R(-0.12, zb + 0.27, 0.12, zb + 0.37); }
      }];
    }
    const top = this.face(box, 'T');
    if (top) top.fx = [(g, F, fc) => { if (S.snow) this.snowCap(g, F, fc, 0.06); }];
    M.parts.push(box);
    if (S.trunk === 1) this.barnDoors(M, z0 + 0.08, zB - 0.12, white);
    if (live) {
      this.lightbar(M, fb + 0.12, fb + 0.24, hw - 0.12, zr, ['#c81c1c', '#dadede', '#c81c1c'], ['r', 'w']);
      for (const sd of [-1, 1]) { M.lt.push({ k: 'b', f: bx1 - 0.02, s: sd * (hw - 0.06), z: zB - 0.06, c: 'r', ph: sd < 0 ? 2 : 6 }, { k: 'b', f: -hl - 0.01, s: sd * (hw - 0.09), z: zB - 0.075, c: 'r', ph: sd < 0 ? 0 : 4 }); }
    }
    this.fx(box, 'F', (g, F) => { F.frame(g, [bx1, 0, 0], [0, 1, 0], [0, 0, 1], 0.01); for (const sd of [-1, 1]) { g.fillStyle = F.sh(live ? '#e02020' : '#3a1a16'); g.fillRect(sd < 0 ? (-hw + 0.06) * 100 : (hw - 0.14) * 100, (zB - 0.11) * 100, 8, 7); } });
    M.parts.push(this.box(-hl - 0.12, -hl, -hw + 0.08, hw - 0.08, z0 + 0.02, z0 + 0.08, CA_COL.black));
    for (const f of [fC - 0.08, -hl + 0.72]) for (const sd of [-1, 1]) this.wheel(M, f, sd, 0.2, { rim: CA_COL.steel, dual: f < 0 });
    for (const sd of [-1, 1]) { this.lamp(M, 't', -hl - 0.004, sd * (hw - 0.095), z0 + 0.3, sd < 0 ? 2 : 3); this.lamp(M, 'r', -hl - 0.004, sd * (hw - 0.095), z0 + 0.16, sd < 0 ? 2 : 3); }
  },
  b_firetruck(M, S, T) {
    const hl = M.hl, hw = M.hw, live = !S.burnt, red = S.burnt ? CA_COL.burnt : S.col;
    const z0 = 0.28, zc = 1.52, fc0 = 0.62, zbd = 1.2, zf = 0.95;
    const sp = Object.assign({}, CA_CARS.base, { chF: 0.05, lamps: 'rect', grille: 'chrome', trim: 'chrome', bump: 'chrome' });
    Object.assign(M, { sp, z0, zb: zf, zr: zc, fC: hl, fR: fc0, chR: 0.04, f0: -hl, f1: hl, noseZ: zf, tailZ: zbd, gw: hw, gwT: hw, paint: red, seat2: '#2a2a2e', noRear: true, doorF: [], noHood: true, noTrunk: true });
    // cab-forward crew cab: hollow, big windshield, white roof
    const cab = M.cab = this.xbody([[fc0, z0], [hl, z0], [hl, zf], [hl - 0.1, zc], [fc0 + 0.03, zc], [fc0, zc - 0.03]], -hw, hw, red, { body: true, cols: { T: live ? '#f2f2ee' : CA_COL.burnt } });
    cab.hollow = true; cab.inner = []; cab.inCol = S.burnt ? '#1a1612' : null;
    M.parts.push(cab);
    const gs = (id, di) => S.burnt ? 4 : (di !== undefined && S.doors[di]) ? 4 : S.glass[id];
    const ws = cab.faces.find(fc => fc.n[0] > 0.5 && fc.n[2] > 0.1);
    if (ws) { (ws.win = []); for (const [a, b] of [[0.03, 0.49], [0.51, 0.97]]) { const q = (u, v) => this.uv(ws, v, u); ws.win.push({ id: 'windshield', st: gs('windshield'), p: [q(a, 0.06), q(b, 0.06), q(b, 0.92), q(a, 0.92)] }); } }
    for (const sd of [-1, 1]) {
      const fc = this.sideFace(cab, sd);
      this.sideWin(fc, sd < 0 ? 'winFL' : 'winFR', hl - 0.52, hl - 0.12, zf + 0.04, zc - 0.08, gs(sd < 0 ? 'winFL' : 'winFR', sd < 0 ? 0 : 1));
      this.sideWin(fc, sd < 0 ? 'winRL' : 'winRR', fc0 + 0.08, fc0 + 0.42, zf + 0.04, zc - 0.08, gs(sd < 0 ? 'winRL' : 'winRR', sd < 0 ? 2 : 3));
      this.sidePaint(cab, sd, hw, (g, F, R) => {
        if (live) { g.fillStyle = F.sh('#f2f2ee'); R(fc0, zf - 0.17, hl, zf - 0.1); }
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.1;
        g.strokeRect((hl - 0.56) * 100, (z0 + 0.12) * 100, 0.5 * 100, (zc - z0 - 0.15) * 100); g.strokeRect((fc0 + 0.04) * 100, (z0 + 0.12) * 100, 0.44 * 100, (zc - z0 - 0.15) * 100);
        this.dmgArt(g, F, M, this.sideLvl(M, sd < 0 ? 'left' : 'right'), S.seed * 59 + sd, fc0 + 0.1, hl - 0.1, z0 + 0.05, zf);
        this.wells(g, F, M, sd, z0);
      });
    }
    const fr = cab.faces.find(fc => fc.n[0] > 0.95);
    if (fr) fr.fx = [(g, F) => this.frontArt(g, F, Object.assign({}, M, { hw: hw + 0.04, noseZ: zf, z0 }))];
    const top = this.face(cab, 'T');
    if (top) top.fx = [(g, F, fc) => { if (S.snow) this.snowCap(g, F, fc, 0.08); }];
    this.seats(cab, hl - 0.38, fc0 + 0.3, zf - 0.05, hw - 0.1, '#2a2a2e', S.burnt);
    M.seat = [hl - 0.4, -(hw - 0.1) * 0.5, zf + 0.07];
    // pump body with roll-up compartment doors, hose bed on top
    const body = this.prism(this.rect(-hl, fc0 - 0.04, -hw, hw, 0, 0.05), z0 + 0.04, zbd, red, { body: true });
    for (const sd of [-1, 1]) this.sidePaint(body, sd, hw, (g, F, R) => {
      for (const [a, b] of [[-hl + 0.08, -hl + 0.62], [-hl + 1.5, -hl + 2.05], [-hl + 2.1, fc0 - 0.1]]) {
        g.fillStyle = F.sh(live ? '#c8ccd0' : '#3a3430'); R(a, z0 + 0.36, b, zbd - 0.06);
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let z = z0 + 0.4; z < zbd - 0.08; z += 0.05) R(a, z, b, z + 0.012);
      }
      if (live) { g.fillStyle = F.sh('#f2f2ee'); R(-hl, z0 + 0.26, fc0, z0 + 0.32); }
      this.dmgArt(g, F, M, this.sideLvl(M, sd < 0 ? 'left' : 'right'), S.seed * 61 + sd, -hl + 0.1, fc0 - 0.1, z0 + 0.05, zbd - 0.1);
      this.wells(g, F, M, sd, z0);
      g.fillStyle = F.sh(CA_COL.black, 0.85); R(-hl, z0 + 0.04, fc0, z0 + 0.08);
    });
    const bt = this.face(body, 'T');
    if (bt) bt.fx = [(g, F, fc) => {
      F.frame(g, [0, 0, zbd], [1, 0, 0], [0, 1, 0], 0.01);
      g.fillStyle = F.sh('#202022'); g.fillRect((-hl + 0.1) * 100, -(hw - 0.08) * 100, 1.4 * 100, (hw - 0.08) * 200);
      g.fillStyle = F.sh(live ? '#a89870' : '#2a2420'); for (let s = -hw + 0.12; s < hw - 0.1; s += 0.09) g.fillRect((-hl + 0.12) * 100, s * 100, 1.36 * 100, 4);
      if (S.snow) this.snowCap(g, F, fc, 0.06);
    }];
    const rf = this.face(body, 'B');
    if (rf) rf.fx = [(g, F) => {
      F.frame(g, [-hl, 0, 0], [0, 1, 0], [0, 0, 1], 0.01);
      for (const sd of [-1, 1]) { const br = S.burnt || S.lights[sd < 0 ? 2 : 3] === 1; g.fillStyle = F.sh(br ? '#3a1a16' : CA_COL.tail, 1.08); g.fillRect(sd < 0 ? (-hw + 0.08) * 100 : (hw - 0.16) * 100, (z0 + 0.18) * 100, 8, 16); }
      g.fillStyle = F.sh(live ? '#c8ccd0' : '#3a3430'); g.fillRect(-35, (z0 + 0.3) * 100, 70, (zbd - z0 - 0.38) * 100);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let z = z0 + 0.32; z < zbd - 0.1; z += 0.05) g.fillRect(-35, z * 100, 70, 1.2);
    }];
    M.parts.push(body);
    if (live) {
      // ladder on top, resting on posts, running over the cab roof
      for (const sd of [-1, 1]) M.parts.push(this.box(-hl + 0.22, -hl + 0.28, sd * 0.3 - 0.03, sd * 0.3 + 0.03, zbd, zc + 0.06, CA_COL.chrome, { mat: 'chrome' }));
      const lad = this.box(-hl + 0.08, hl - 0.32, -0.34, 0.34, zc + 0.06, zc + 0.11, CA_COL.chrome, { mat: 'chrome' });
      const lt = this.face(lad, 'T');
      lt.mat = 'none';
      lt.fx = [(g, F) => {
        const P = (f, s) => F.P(f, s, zc + 0.11);
        g.strokeStyle = Col.shade('#c8ccd0', F.b); g.lineWidth = 2.2; g.beginPath();
        for (const s of [-0.31, 0.31]) { const a = P(-hl + 0.08, s), b = P(hl - 0.32, s); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
        g.stroke(); g.lineWidth = 1.2; g.beginPath();
        for (let f = -hl + 0.14; f < hl - 0.34; f += 0.1) { const a = P(f, -0.31), b = P(f, 0.31); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
        g.stroke();
      }];
      for (const fc of lad.faces) if (fc.t === 'F' || fc.t === 'B') fc.mat = 'none';
      M.parts.push(lad);
      this.lightbar(M, hl - 0.3, hl - 0.18, hw - 0.1, zc, ['#c81c1c', '#dadede', '#c81c1c'], ['r', 'w']);
    }
    M.parts.push(this.bumper(1, hl, hw, 0.05, z0 + 0.02, z0 + 0.2, live ? 'chrome' : 'black', red));
    M.parts.push(this.box(-hl - 0.14, -hl, -hw + 0.06, hw - 0.06, z0 + 0.02, z0 + 0.1, live ? CA_COL.chrome : CA_COL.black, { mat: live ? 'chrome' : 'paint' }));
    for (const sd of [-1, 1]) if (S.doors[sd < 0 ? 0 : 1] !== 1) M.parts.push(this.box(hl - 0.2, hl - 0.12, sd > 0 ? hw - 0.005 : -hw - 0.1, sd > 0 ? hw + 0.1 : -hw + 0.005, zf + 0.05, zf + 0.25, CA_COL.black));
    for (const f of [hl - 0.62, -hl + 0.85]) for (const sd of [-1, 1]) this.wheel(M, f, sd, 0.25, { rim: CA_COL.rim, w: 0.18, dual: f < 0 });
    for (const sd of [-1, 1]) {
      this.lamp(M, 'h', hl + 0.004, sd * (hw - 0.06 - 0.11), zf - 0.072, sd < 0 ? 0 : 1);
      this.lamp(M, 't', -hl - 0.004, sd * (hw - 0.12), z0 + 0.26, sd < 0 ? 2 : 3);
    }
    this.lamp(M, 'd', hl - 0.5, 0, zc - 0.02);
  },
  b_army(M, S, T) {
    const hl = M.hl, hw = M.hw, live = !S.burnt, od = S.burnt ? CA_COL.burnt : S.col;
    const z0 = 0.36, zb = 0.98, zr = 1.5, fb = 0.32, fC = 0.88;
    this.truckFront(M, S, { z0, zb, zr, fb, fC, paint: od, sp: { r: 0.25, nose: 0.02, chF: 0.05, rakeF: 0.04, rakeR: 0.0, tum: 0.03, doors: 2, lamps: 'round', grille: 'army', bump: 'black', trim: 'black', gin: 0.08 } });
    M.f0 = -hl; M.star = live;
    const bf = fb - 0.06, zbd = zb - 0.06;
    const bed = this.box(-hl, bf, -hw, hw, z0 + 0.06, zbd, od, { body: true });
    for (const sd of [-1, 1]) this.sidePaint(bed, sd, hw, (g, F, R) => {
      g.fillStyle = 'rgba(0,0,0,0.22)'; for (let z = z0 + 0.14; z < zbd; z += 0.09) R(-hl, z, bf, z + 0.012);
      for (let f = -hl + 0.3; f < bf; f += 0.45) R(f, z0 + 0.06, f + 0.03, zbd);
      if (live) { F.frame(g, [-hl + 0.4, sd * hw, zbd - 0.1], [sd, 0, 0], [0, 0, -1], 0.01); g.fillStyle = F.sh('#e8e8e0'); g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('U.S. 4C-27', 0, 0); F.frame(g, [0, sd * hw, 0], [1, 0, 0], [0, 0, 1], 0.01); }
      this.dmgArt(g, F, M, this.sideLvl(M, sd < 0 ? 'left' : 'right'), S.seed * 67 + sd, -hl + 0.1, bf - 0.1, z0 + 0.1, zbd);
      this.wells(g, F, M, sd, z0 + 0.06, CA_COL.black);
    });
    M.parts.push(bed);
    // canvas cover: arched profile swept along the bed
    const zc = zr + 0.12, arch = [[-hw + 0.02, zbd], [hw - 0.02, zbd], [hw - 0.02, zc - 0.24], [hw * 0.72, zc - 0.07], [0, zc], [-hw * 0.72, zc - 0.07], [-hw + 0.02, zc - 0.24]];
    const cv = this.solid(arch.map(q => [-hl + 0.02, q[0], q[1]]), arch.map(q => [bf - 0.02, q[0], q[1]]), live ? '#6c6a48' : '#2c2622');
    for (const fc of cv.faces) {
      if (Math.abs(fc.n[0]) > 0.9) { fc.fx = [(g, F, f) => { const p = f.p.map(q => F.P(q[0], q[1], q[2])); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < p.length; i++) { g.moveTo(p[i][0], p[i][1]); g.lineTo((p[0][0] + p[3][0] + p[4][0]) / 3, (p[0][1] + p[3][1] + p[4][1]) / 3); } g.stroke(); }]; continue; }
      fc.fx = [(g, F, f) => {
        const [a, b, c, d] = f.p, L3 = (p, q, t) => F.P(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
        g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1.4; g.beginPath();
        for (let t = 0.12; t < 1; t += 0.19) { const p = L3(a, d, t), q = L3(b, c, t); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
        g.stroke();
        if (S.snow && f.n[2] > 0.3) this.snowCap(g, F, f, 0.08);
      }];
    }
    M.parts.push(cv);
    const rb = this.face(bed, 'B');
    if (rb) rb.fx = [(g, F) => { F.frame(g, [-hl, 0, 0], [0, 1, 0], [0, 0, 1], 0.01); for (const sd of [-1, 1]) { const br = S.burnt || S.lights[sd < 0 ? 2 : 3] === 1; g.fillStyle = F.sh(br ? '#3a1a16' : CA_COL.tail); g.fillRect(sd < 0 ? (-hw + 0.06) * 100 : (hw - 0.12) * 100, (z0 + 0.12) * 100, 6, 5); } }];
    M.parts.push(this.box(-hl - 0.06, -hl, -hw + 0.04, hw - 0.04, z0 - 0.04, z0 + 0.06, CA_COL.black));
    for (const f of [1.05, -0.5, -1.02]) for (const sd of [-1, 1]) this.wheel(M, f, sd, 0.25, { rim: '#4a5238', w: 0.2 });
    for (const sd of [-1, 1]) this.lamp(M, 't', -hl - 0.004, sd * (hw - 0.09), z0 + 0.145, sd < 0 ? 2 : 3);
  },
  b_bus(M, S, T) {
    const hl = M.hl, hw = M.hw, live = !S.burnt, yel = S.burnt ? CA_COL.burnt : S.col, blk = live ? '#18181a' : '#2a2420';
    const z0 = 0.3, zh = 0.95, zr = T.h + T.cabH, fC = hl - 0.55;
    const sp = Object.assign({}, CA_CARS.base, { nose: 0.12, chF: 0.06, lamps: 'round', grille: 'black', bump: 'black', trim: 'black' });
    Object.assign(M, { sp, z0, zb: zh, zr, fC, fR: -hl, chR: 0.05, f0: -hl, f1: hl, noseZ: zh - sp.nose, tailZ: zh, gw: hw, gwT: hw, paint: yel, zTrim: z0 + 0.3, seat2: '#3c5a3a', doorF: [], noTrunk: true });
    const hood = M.body = this.lowerBody({ f0: fC, f1: hl, hw: hw - 0.04, z0, zb: zh, fC, fR: fC, noseZ: M.noseZ, tailZ: zh, chF: sp.chF, chR: 0, col: yel });
    this.pfx(hood, [1, 0, 0], (g, F) => this.frontArt(g, F, Object.assign({}, M, { hw: hw - 0.04 })));
    for (const sd of [-1, 1]) this.sidePaint(hood, sd, hw - 0.04, (g, F, R) => { this.wells(g, F, M, sd, z0); g.fillStyle = F.sh(blk); R(fC, z0 + 0.12, hl, z0 + 0.15); });
    for (const fc of hood.faces) if (fc.id === 'hood') fc.fx = [(g, F, f) => { if (S.snow) this.snowCap(g, F, f, 0.1); }];
    M.parts.push(hood);
    const body = M.cab = this.xbody([[-hl, z0], [fC, z0], [fC, zh], [fC - 0.06, zr - 0.1], [fC - 0.14, zr], [-hl + 0.1, zr], [-hl, zr - 0.1]], -hw, hw, yel, { body: true });
    body.hollow = true; body.inner = []; body.inCol = S.burnt ? '#1a1612' : null;
    M.parts.push(body);
    const ws = body.faces.find(fc => fc.n[0] > 0.5 && fc.n[2] > 0.02 && fc.n[2] < 0.5);
    const gs = (id) => S.burnt ? 4 : S.glass[id];
    if (ws) { ws.win = []; for (const [a, b] of [[0.04, 0.49], [0.51, 0.96]]) { const q = (u, v) => this.uv(ws, v, u); ws.win.push({ id: 'windshield', st: gs('windshield'), p: [q(a, 0.08), q(b, 0.08), q(b, 0.9), q(a, 0.9)] }); } }
    const zw0 = zh + 0.02, zw1 = zr - 0.17, rows = [];
    for (let f = fC - 0.58; f > -hl + 0.2; f -= 0.42) rows.push(f);
    for (const sd of [-1, 1]) {
      const fc = this.sideFace(body, sd);
      for (const f of rows) this.sideWin(fc, sd < 0 ? 'winRL' : 'winRR', f - 0.34, f, zw0, zw1, gs(sd < 0 ? 'winRL' : 'winRR'));
      if (sd < 0) this.sideWin(fc, 'winFL', fC - 0.44, fC - 0.1, zw0, zw1, S.burnt ? 4 : S.doors[0] ? 4 : S.glass.winFL);
      else for (const [a, b] of [[fC - 0.44, fC - 0.28], [fC - 0.26, fC - 0.1]]) this.sideWin(fc, 'winFR', a, b, z0 + 0.12, zw1, S.burnt ? 4 : S.doors[1] ? 4 : S.glass.winFR);
      this.sidePaint(body, sd, hw, (g, F, R) => {
        g.fillStyle = F.sh(blk);
        for (const z of [z0 + 0.13, z0 + 0.35, zh - 0.05]) R(-hl, z, fC, z + 0.03);
        R(-hl, zw0 - 0.015, fC - 0.08, zw0);
        for (const f of rows) R(f - 0.36, zw0, f - 0.34, zw1 + 0.02);
        if (live && sd < 0) {
          const cx = (fC - 0.62) * 100, cz = (zh - 0.02) * 100, r = 8;
          g.fillStyle = F.sh('#f0f0f0'); g.beginPath(); for (let i = 0; i < 8; i++) g.lineTo(cx + Math.cos(i * Math.PI / 4 + Math.PI / 8) * (r + 1.2), cz + Math.sin(i * Math.PI / 4 + Math.PI / 8) * (r + 1.2)); g.fill();
          g.fillStyle = F.sh('#c01818'); g.beginPath(); for (let i = 0; i < 8; i++) g.lineTo(cx + Math.cos(i * Math.PI / 4 + Math.PI / 8) * r, cz + Math.sin(i * Math.PI / 4 + Math.PI / 8) * r); g.fill();
        }
        if (sd > 0) { g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.3; g.strokeRect((fC - 0.46) * 100, (z0 + 0.04) * 100, 0.38 * 100, (zw1 - z0 + 0.02) * 100); }
        this.dmgArt(g, F, M, this.sideLvl(M, sd < 0 ? 'left' : 'right'), S.seed * 71 + sd, -hl + 0.2, fC - 0.2, z0 + 0.05, zh);
        this.wells(g, F, M, sd, z0);
        if (live) { F.frame(g, [-0.2, sd * hw, zh - 0.18], [sd, 0, 0], [0, 0, -1], 0.01); g.fillStyle = F.sh(blk); g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HOLLOW CREEK SCHOOLS', 0, 0); }
      });
    }
    const rf = body.faces.find(fc => fc.n[0] < -0.95);
    if (rf) {
      rf.win = [{ id: 'rearWindow', st: S.trunk ? 4 : gs('rearWindow'), p: [[-hl, -0.24, zw0], [-hl, 0.24, zw0], [-hl, 0.24, zw1], [-hl, -0.24, zw1]] }];
      for (const sd of [-1, 1]) rf.win.push({ id: 'q', st: S.burnt ? 4 : 0, p: [[-hl, sd * 0.32, zw0], [-hl, sd * (hw - 0.07), zw0], [-hl, sd * (hw - 0.07), zw1], [-hl, sd * 0.32, zw1]] });
      rf.fx = [(g, F) => {
        F.frame(g, [-hl, 0, 0], [0, 1, 0], [0, 0, 1], 0.01);
        const R = (a, b, c, d) => g.fillRect(a * 100, b * 100, (c - a) * 100, (d - b) * 100);
        g.fillStyle = F.sh(blk); for (const z of [z0 + 0.13, z0 + 0.35]) R(-hw, z, hw, z + 0.03);
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.3; g.strokeRect(-27, (z0 + 0.05) * 100, 54, (zw1 - z0 + 0.03) * 100);
        for (const sd of [-1, 1]) { const br = S.burnt || S.lights[sd < 0 ? 2 : 3] === 1; g.fillStyle = F.sh(br ? '#3a1a16' : CA_COL.tail, 1.08); g.beginPath(); g.arc(sd * (hw - 0.12) * 100, (z0 + 0.25) * 100, 4.5, 0, 7); g.fill(); g.fillStyle = F.sh(live ? CA_COL.amber : '#3a2a20'); g.beginPath(); g.arc(sd * (hw - 0.12) * 100, (z0 + 0.43) * 100, 4, 0, 7); g.fill(); }
        if (live) { F.frame(g, [-hl, 0, zw1 + 0.08], [0, 1, 0], [0, 0, -1], 0.01); g.fillStyle = F.sh(blk); g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SCHOOL BUS', 0, 0); }
      }];
    }
    const top = this.face(body, 'T');
    if (top) top.fx = [(g, F, fc) => {
      F.frame(g, [0, 0, zr], [1, 0, 0], [0, 1, 0], 0.01);
      for (const f of [0.75, -0.9]) { g.fillStyle = F.sh(live ? '#d8d0b0' : '#3a3430'); g.fillRect((f - 0.16) * 100, -20, 32, 40); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2; g.strokeRect((f - 0.16) * 100, -20, 32, 40); }
      if (S.snow) this.snowCap(g, F, fc, 0.05);
    }];
    // roof sign with warning lamps at the front
    if (live) {
      const sg = this.box(fC - 0.22, fC - 0.16, -hw + 0.08, hw - 0.08, zr, zr + 0.1, yel);
      const fs = this.face(sg, 'F');
      fs.fx = [(g, F) => {
        F.frame(g, [fC - 0.16, 0, zr + 0.05], [0, -1, 0], [0, 0, -1], 0.01);
        g.fillStyle = F.sh(blk); g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SCHOOL BUS', 0, 0);
        for (const sd of [-1, 1]) { g.fillStyle = F.sh('#c01818'); g.beginPath(); g.arc(sd * (hw - 0.14) * 100, 0, 3.6, 0, 7); g.fill(); g.fillStyle = F.sh(CA_COL.amber); g.beginPath(); g.arc(sd * (hw - 0.24) * 100, 0, 3.2, 0, 7); g.fill(); }
      }];
      M.parts.push(sg);
    }
    // seats in rows behind the windows
    const sw = hw - 0.1;
    for (const f of rows) for (const sd of [-1, 1]) body.inner.push(this.box(f - 0.25, f - 0.19, sd < 0 ? -sw : 0.1, sd < 0 ? -0.1 : sw, zh - 0.08, zh + 0.12, S.burnt ? '#2a2420' : '#3c5a3a'));
    body.inner.push(this.box(fC - 0.4, fC - 0.34, -sw, -0.12, zh - 0.08, zh + 0.16, S.burnt ? '#2a2420' : '#2a2a2e'));
    M.seat = [fC - 0.34, -sw * 0.55, zh + 0.07];
    const fbp = this.bumper(1, hl, hw - 0.04, 0.05, z0 - 0.04, z0 + 0.12, 'black', yel), rbp = this.bumper(-1, -hl, hw, 0.04, z0 - 0.04, z0 + 0.1, 'black', yel);
    M.parts.push(fbp, rbp);
    for (const sd of [-1, 1]) if (S.doors[sd < 0 ? 0 : 1] !== 1) M.parts.push(this.box(fC - 0.06, fC + 0.02, sd > 0 ? hw - 0.005 : -hw - 0.12, sd > 0 ? hw + 0.12 : -hw + 0.005, zh + 0.1, zh + 0.3, CA_COL.black));
    for (const f of [hl - 0.42, -hl + 1.25]) for (const sd of [-1, 1]) this.wheel(M, f, sd, 0.24, { rim: CA_COL.steel, w: 0.18, dual: f < 0 });
    const wf = hw - 0.04 - sp.chF;
    for (const sd of [-1, 1]) {
      this.lamp(M, 'h', hl + 0.004, sd * (wf - 0.11), M.noseZ - 0.072, sd < 0 ? 0 : 1);
      this.lamp(M, 't', -hl - 0.004, sd * (hw - 0.12), z0 + 0.25, sd < 0 ? 2 : 3);
    }
    this.lamp(M, 'd', 0, 0, zr - 0.03);
  },
});
// ---------------------------------------------------------------------------
// Static burnt-out wreck object: a detailed shell from the same models (1x object sprite).
// o.kind may name a CAR_TYPES type; otherwise the facing picks a sedan (N) or a wagon (E).
// ---------------------------------------------------------------------------
OBJ.car_wreck.spr = { w: 150, h: 140, ax: 75, ay: 84 };
ObjArt.k_car_wreck = function () { return Season.snow > 0.3 ? 'S' : ''; };
ObjArt.d_car_wreck = function (o) {
  const type = o.kind && CAR_TYPES[o.kind] ? o.kind : o.dir === 'N' ? 'sedan' : 'wagon';
  const along = o.dir === 'N' || o.dir === 'S';
  const mk = type + '|#3a3430|3|3232|222222|' + (along ? '0000' : '0200') + '|' + (along ? 1 : 0) + '|0|2222|1111|B' + (Season.snow > 0.3 ? 'S' : '') + '|' + (along ? 1 : 2);
  const c = this.P(0.5, 0.5, 0);
  try {
    const M = CarArt.build(mk);
    const F = CarArt.proj(along ? -Math.PI / 2 + 0.12 : 0.1, c[0], c[1], 0.88, M.tilt);
    CarArt.paint(this.g, F, M, along ? 0 : 1);
  } catch (e) { console.warn('CarArt: wreck failed', e); }
  this.g.setTransform(1, 0, 0, 1, 0, 0);
};
