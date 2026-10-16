'use strict';
// ---------------------------------------------------------------------------
// Core constants & helpers
// ---------------------------------------------------------------------------
const TW = 64, TH = 32, HTW = 32, HTH = 16, ZU = 32;
const WALL_H = 2.45;               // wall height in z-units
let MIN_PER_SEC = 0.4;             // game minutes per real second at 1x (1 day = 1 hour); sandbox can change it

const U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  angDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  normAng(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
  smooth(t) { return t * t * (3 - 2 * t); },
  fmt1(v) { return (Math.round(v * 10) / 10).toFixed(1); },
  fmt2(v) { return (Math.round(v * 100) / 100).toFixed(2); },
  pad2(n) { return (n < 10 ? '0' : '') + n; },
  cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); },
  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
  // world -> screen (relative, before camera)
  isoX(x, y) { return (x - y) * HTW; },
  isoY(x, y, z) { return (x + y) * HTH - (z || 0) * ZU; },
};

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32)
// ---------------------------------------------------------------------------
class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = this.s = (this.s + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  f(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(list) { // [[value, weight], ...]
    let tot = 0;
    for (const e of list) tot += e[1];
    let r = this.next() * tot;
    for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
    return list[list.length - 1][0];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}
// gameplay rng (non-deterministic)
const R = new RNG((Date.now() ^ (Math.random() * 1e9)) >>> 0);

// ---------------------------------------------------------------------------
// Value noise
// ---------------------------------------------------------------------------
function makeNoise(seed) {
  const rng = new RNG(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rng.next(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const v = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
  function n(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  return function (x, y, oct) {
    oct = oct || 1;
    let s = 0, amp = 1, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  };
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const Col = {
  _rgb: new Map(),
  _sh: new Map(),
  rgb(hex) {
    let c = this._rgb.get(hex);
    if (c) return c;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    c = [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    this._rgb.set(hex, c);
    return c;
  },
  // multiply color by brightness f (0..1.3), optional tint toward blue at night
  shade(hex, f) {
    const q = Math.round(f * 40);
    const key = hex + q;
    let s = this._sh.get(key);
    if (s) return s;
    const c = this.rgb(hex), k = q / 40;
    s = 'rgb(' + Math.min(255, Math.round(c[0] * k)) + ',' + Math.min(255, Math.round(c[1] * k)) + ',' + Math.min(255, Math.round(c[2] * k * (k < 0.6 ? 1.08 : 1))) + ')';
    this._sh.set(key, s);
    return s;
  },
  mix(a, b, t) {
    const ca = this.rgb(a), cb = this.rgb(b);
    const r = Math.round(ca[0] + (cb[0] - ca[0]) * t), g = Math.round(ca[1] + (cb[1] - ca[1]) * t), bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  },
  rgba(hex, a) { const c = this.rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; },
  jitter(hex, amt, rng) {
    const c = this.rgb(hex);
    const j = () => Math.round((rng ? rng.next() : Math.random()) * amt * 2 - amt);
    const f = v => Math.max(0, Math.min(255, v));
    const r = f(c[0] + j()), g = f(c[1] + j()), b = f(c[2] + j());
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },
};

// ---------------------------------------------------------------------------
// Binary helpers for save files
// ---------------------------------------------------------------------------
const Bin = {
  toB64(u8) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  },
  fromB64(str) {
    const s = atob(str);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  },
};
