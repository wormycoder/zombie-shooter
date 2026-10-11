'use strict';
// ---------------------------------------------------------------------------
// Player settings: graphics & performance, saved in this browser
// ---------------------------------------------------------------------------
// tab: 'display' or 'perf' (Settings screen)
const SETTINGS_OPTS = {
  res: { tab: 'display', n: 'Render resolution', opts: [['Auto', 'auto'], ['50%', 0.5], ['67%', 0.67], ['75%', 0.75], ['100%', 1]], tip: 'Pixels drawn per frame. Lower is much faster, especially on high-DPI screens. Auto caps high-DPI screens at 1.5x.' },
  dynRes: { tab: 'display', n: 'Dynamic resolution', opts: [['Off', 0], ['On', 1]], tip: 'While the frame rate stays below its target (the frame rate limit, or 60), the render resolution steps down (to half at most) and comes back up when there is headroom again. Helps when the graphics card is the bottleneck (big or high-DPI screens).' },
  fps: { tab: 'display', n: 'Frame rate limit', opts: [['30 FPS', 30], ['60 FPS', 60], ['Unlimited', 0]], tip: 'A lower cap saves battery and keeps weak machines steady.' },
  detail: { tab: 'display', n: 'World detail', opts: [['Low', 0], ['High', 1]], tip: 'Low skips ground markings and litter, grass edges and power-line wires.' },
  chars3d: { tab: 'display', n: 'Character detail', opts: [['Auto', 1], ['High', 4], ['Medium', 3], ['Low', 2], ['2D', 0]], tip: 'Animated 3D survivors and zombies, drawn with WebGL on the graphics card. Auto: full detail up close, simpler models further away and in big crowds (more so when zoomed out or when the frame rate suffers). High: full detail everywhere. Medium / Low: simpler models sooner. 2D: the flat 2D figures (no WebGL).' },
  carDetail: { tab: 'display', n: 'Car detail', opts: [['Low', 0], ['Auto', 1], ['High', 2]], tip: 'Vehicles are painted once per heading at double resolution. Auto paints them at normal resolution while zoomed out (a quarter of the memory and painting time, and no visible difference), Low always does.' },
  shadows: { tab: 'display', n: 'Shadows', opts: [['Off', 0], ['On', 1]], tip: 'Soft shadows under characters and vehicles.' },
  particles: { tab: 'display', n: 'Particles', opts: [['Low', 0.3], ['Medium', 0.6], ['High', 1]], tip: 'Blood, smoke, sparks and glass.' },
  ambient: { tab: 'display', n: 'Ambient particles', opts: [['Off', 0], ['Reduced', 0.5], ['Full', 1]], tip: 'Exhaust, dust, spray and tyre smoke from vehicles, and flies over rotting bodies.' },
  weather: { tab: 'display', n: 'Rain & snow', opts: [['Off', 0], ['Light', 0.45], ['Full', 1]], tip: 'Falling rain and snow on screen (the weather itself is unchanged).' },
  fpsShow: { tab: 'display', n: 'Frame rate counter', opts: [['Off', 0], ['FPS', 1], ['Detailed', 2]], tip: 'Detailed adds frame time, simulation time, lighting and zombie counts.' },
  lodDist: { tab: 'perf', n: 'LOD distance', opts: [['Near', 0.6], ['Normal', 1], ['Far', 1.6]], tip: 'How far from you characters keep their detailed models before switching to simpler ones (anything within 6 tiles always stays detailed, except on Low character detail).' },
  lodMax: { tab: 'perf', n: 'Max detailed characters', opts: [['15', 15], ['25', 25], ['40', 40], ['80', 80], ['Unlimited', 0]], tip: 'In a crowd only this many moving characters (the nearest) get the detailed models; the rest use simpler ones. Bodies lying still are kept as pre-drawn pictures and do not count.' },
  corpses: { tab: 'perf', n: 'Corpse limit', opts: [['100', 100], ['200', 200], ['400', 400], ['Unlimited', 0]], tip: 'Beyond this many bodies, the oldest ones that are out of sight decay away (what they carried is left on the ground). Bodies are cheap to draw; this mostly keeps saves small.' },
  decals: { tab: 'perf', n: 'Decal limit', opts: [['100', 100], ['200', 200], ['450', 450], ['800', 800]], tip: 'Blood stains, scorch marks and puddles kept on the ground; past the limit the oldest disappear first.' },
  cache: { tab: 'perf', n: 'Sprite cache size', opts: [['Small', 0], ['Normal', 1], ['Large', 2]], tip: 'How many pre-painted walls, ground chunks, roofs, vehicle views and character pictures are kept in graphics memory. Small saves memory (older or integrated graphics); Large repaints less when you move around a lot.' },
  lightHz: { tab: 'perf', n: 'Lighting updates', opts: [['5 / sec', 5], ['10 / sec', 10], ['15 / sec', 15], ['20 / sec', 20], ['25 / sec', 25], ['30 / sec', 30], ['35 / sec', 35], ['40 / sec', 40], ['45 / sec', 45], ['50 / sec', 50], ['55 / sec', 55], ['60 / sec', 60]], tip: 'How often lights and shadows are recalculated. Lower is cheaper; moving lights (flashlight, headlights) update less smoothly.' },
  uiHz: { tab: 'perf', n: 'UI refresh rate', opts: [['10 / sec', 10], ['15 / sec', 15], ['20 / sec', 20], ['25 / sec', 25], ['30 / sec', 30], ['35 / sec', 35], ['40 / sec', 40], ['45 / sec', 45], ['50 / sec', 50], ['55 / sec', 55], ['60 / sec', 60]], tip: 'How often the HUD, clock, moodles and open windows refresh.' },
  zLazy: { tab: 'perf', n: 'Lazy zombie updates', opts: [['Off', 0], ['On', 1]], tip: 'Zombies in distant chunks (8x8 tiles) think less often: 3-5 chunks away every other step, 6-11 a coarse update every 2 s, 12+ paused. Chasing and visible zombies always run at full rate.' },
  zAdapt: { tab: 'perf', n: 'Adaptive zombie physics', opts: [['Off', 0], ['On', 1]], tip: 'With more than 120 zombies close by, crowd zombies update at half rate to keep the frame rate up.' },
  chunkLazy: { tab: 'perf', n: 'Lazy chunk updates', opts: [['Off', 0], ['On', 1]], tip: 'Chunks (8x8 tiles) 6+ away from you update at half speed and 12+ away are paused (food spoilage, crops, traps, fires catch up when you return).' },
};
// Auto (the default) is High plus the automatic helpers: dynamic resolution, adaptive character detail and car detail
// by zoom - full quality whenever the machine keeps up
const SETTINGS_PRESETS = {
  Low: { res: 0.5, dynRes: 1, fps: 30, detail: 0, chars3d: 2, carDetail: 0, shadows: 0, particles: 0.3, ambient: 0, weather: 0.45, lodDist: 0.6, lodMax: 15, corpses: 100, decals: 100, cache: 0, lightHz: 15, uiHz: 15, zLazy: 1, zAdapt: 1, chunkLazy: 1 },
  Medium: { res: 0.75, dynRes: 1, fps: 60, detail: 1, chars3d: 3, carDetail: 1, shadows: 1, particles: 0.6, ambient: 0.5, weather: 0.45, lodDist: 0.6, lodMax: 25, corpses: 200, decals: 200, cache: 1, lightHz: 30, uiHz: 30, zLazy: 1, zAdapt: 1, chunkLazy: 1 },
  Auto: { res: 'auto', dynRes: 1, fps: 60, detail: 1, chars3d: 1, carDetail: 1, shadows: 1, particles: 1, ambient: 1, weather: 1, lodDist: 1, lodMax: 40, corpses: 0, decals: 450, cache: 1, lightHz: 60, uiHz: 30, zLazy: 1, zAdapt: 1, chunkLazy: 1 },
  High: { res: 'auto', dynRes: 0, fps: 60, detail: 1, chars3d: 1, carDetail: 2, shadows: 1, particles: 1, ambient: 1, weather: 1, lodDist: 1, lodMax: 40, corpses: 0, decals: 450, cache: 1, lightHz: 60, uiHz: 30, zLazy: 1, zAdapt: 1, chunkLazy: 1 },
  Ultra: { res: 1, dynRes: 0, fps: 0, detail: 1, chars3d: 4, carDetail: 2, shadows: 1, particles: 1, ambient: 1, weather: 1, lodDist: 1.6, lodMax: 0, corpses: 0, decals: 800, cache: 2, lightHz: 60, uiHz: 60, zLazy: 0, zAdapt: 0, chunkLazy: 0 },
};
const Settings = {
  KEY: 'hc_settings',
  v: Object.assign({ fpsShow: 0 }, SETTINGS_PRESETS.Auto),
  listeners: [],
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (s) for (const k in this.v) if (SETTINGS_OPTS[k].opts.some(o => o[1] === s[k])) this.v[k] = s[k];
    } catch (e) { /* storage blocked */ }
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.v)); } catch (e) { /* storage blocked */ } },
  set(k, val) { this.v[k] = val; this.save(); this.apply(); },
  usePreset(name) { Object.assign(this.v, SETTINGS_PRESETS[name]); this.save(); this.apply(); },
  // name of the preset the current values match, or null
  presetName() {
    for (const n in SETTINGS_PRESETS) { const p = SETTINGS_PRESETS[n]; if (Object.keys(p).every(k => p[k] === this.v[k])) return n; }
    return null;
  },
  onChange(fn) { this.listeners.push(fn); },
  apply() { for (const fn of this.listeners) { try { fn(this.v); } catch (e) { console.error(e); } } },
  // backing-store pixels per CSS pixel for the main canvas
  dpr() {
    const d = Math.min(2, window.devicePixelRatio || 1), r = this.v.res, k = this.v.dynRes ? Perf.scale : 1;
    if (r === 'auto') return Math.max(0.5 * Math.min(d, 1.5), Math.min(d, 1.5) * k);
    return Math.max(0.5, d * r * k);
  },
};
Settings.load();

// ---------------------------------------------------------------------------
// Perf: frame statistics (last 240 frames), dynamic resolution and the performance report players can send
// ---------------------------------------------------------------------------
const Perf = {
  N: 240, ft: new Float32Array(240), rt: new Float32Array(240), st: new Float32Array(240), ut: new Float32Array(240), n: 0, i: 0,
  // dynamic resolution: render scale 0.5 .. 1 applied on top of the resolution setting
  scale: 1, wN: 0, wJs: 0, good: 0, downT: 0, upT: 0, backoff: 4000, holdT: 0, probe: null,
  // one rendered frame: ms since the previous one, and the render / simulation / UI ms it took
  frame(iv, r, s, u) {
    const k = this.i;
    this.ft[k] = iv; this.rt[k] = r; this.st[k] = s; this.ut[k] = u;
    this.i = (k + 1) % this.N; if (this.n < this.N) this.n++;
    this.dyn(iv, r + s + u);
  },
  setScale(k) { if (k !== this.scale) { this.scale = k; if (typeof Render !== 'undefined' && Render.cv) Render.resize(); } },
  // Windows of 30 frames, judged by their median (a single hitch does not count). Below target while the scripts are not
  // the bottleneck (fewer pixels do not make them faster): one step down, kept only if the next window is faster. At
  // target with headroom for 2 s: one step up; a step up that does not hold doubles the wait before the next try.
  win: new Float32Array(30),
  dyn(iv, js) {
    if (!Settings.v.dynRes || !this.auto) { this.setScale(1); this.wN = 0; return; }
    const T = 1000 / (Settings.v.fps || 60);
    this.win[this.wN++] = iv; this.wJs += js;
    if (this.wN < 30) return;
    this.win.sort();
    const med = (this.win[14] + this.win[15]) / 2, jsAvg = this.wJs / this.wN, now = performance.now();
    this.wN = 0; this.wJs = 0;
    if (G.paused || document.hidden || G.mode !== 'play') { this.probe = null; return; }
    const P = this.probe;
    if (P) {
      this.probe = null;
      // no faster with fewer pixels: not limited by the graphics card (or a capped display); back up and stay a while
      if (med > P.med * 0.97) { this.setScale(P.k); this.holdT = now + 30000; return; }
    }
    if (med > T * 1.12) {
      this.good = 0;
      if (jsAvg < med * 0.75 && this.scale > 0.5 && now > this.holdT) {
        if (now - this.upT < 3000) this.backoff = Math.min(60000, this.backoff * 2);
        this.probe = { med, k: this.scale };
        this.downT = now; this.setScale(Math.max(0.5, Math.round(this.scale * 10 - 1) / 10));
      }
    } else if (med < T * 1.04 && jsAvg < T * 0.6) {
      if (now - this.upT > 15000) this.backoff = Math.max(4000, this.backoff / 2);
      if (++this.good >= 4 && this.scale < 1 && now - this.downT > this.backoff) { this.good = 0; this.upT = now; this.setScale(Math.min(1, Math.round(this.scale * 10 + 1) / 10)); }
    } else this.good = 0;
  },
  // frame statistics over the last n frames: [avg, p50, 1% low (99th percentile ms), worst, render, sim, ui]
  stats() {
    const n = this.n;
    if (!n) return null;
    const a = Array.from(this.ft.subarray(0, n)).sort((x, y) => x - y);
    let f = 0, r = 0, s = 0, u = 0;
    for (let k = 0; k < n; k++) { f += this.ft[k]; r += this.rt[k]; s += this.st[k]; u += this.ut[k]; }
    return { avg: f / n, p50: a[n >> 1], p99: a[Math.min(n - 1, Math.floor(n * 0.99))], worst: a[n - 1], r: r / n, s: s / n, u: u / n };
  },
  gpu() {
    if (typeof GL3D !== 'undefined' && GL3D.renderer) return GL3D.renderer;
    if (this.gpuS === undefined) {
      this.gpuS = 'unknown';
      try { const gl = document.createElement('canvas').getContext('webgl'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); if (gl) this.gpuS = String((d && gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER)); } catch (e) { /* none */ }
    }
    return this.gpuS;
  },
  // plain-text report to copy and send
  report() {
    const L = [], f2 = (v) => (+v).toFixed(2), f1 = (v) => (+v).toFixed(1), V = Settings.v;
    const st = this.stats();
    L.push('Hollow Creek performance report' + (typeof VERSION !== 'undefined' ? ' - version ' + VERSION : ''));
    L.push('Date: ' + new Date().toISOString().replace('T', ' ').slice(0, 19));
    L.push('Browser: ' + navigator.userAgent);
    L.push('GPU (WebGL): ' + this.gpu() + (typeof GL3D !== 'undefined' ? (GL3D.soft ? ' (software rendering)' : '') + (GL3D.failed ? ' - 3D characters unavailable' : '') : ''));
    L.push('CPU threads: ' + (navigator.hardwareConcurrency || '?') + (navigator.deviceMemory ? ' - memory ' + navigator.deviceMemory + ' GB' : ''));
    if (typeof Render !== 'undefined' && Render.cv) L.push('Window ' + Render.W + 'x' + Render.H + ' - devicePixelRatio ' + (window.devicePixelRatio || 1) + ' - render scale ' + f2(Render.dpr) + (V.dynRes ? ' (dynamic ' + Math.round(this.scale * 100) + '%)' : '') + ' - canvas ' + Render.cv.width + 'x' + Render.cv.height + ' - zoom ' + f2(Render.cam.zoom));
    if (st) {
      L.push('FPS ' + f1(1000 / st.avg) + ' (median ' + f1(1000 / st.p50) + ', 1% low ' + f1(1000 / st.p99) + ') over ' + this.n + ' frames');
      L.push('Frame ' + f1(st.avg) + ' ms avg, ' + f1(st.worst) + ' ms worst - render ' + f2(st.r) + ' ms - simulation ' + f2(st.s) + ' ms - UI ' + f2(st.u) + ' ms');
    }
    if (typeof G !== 'undefined' && G.zombies) {
      let al = 0, dd = 0; for (const z of G.zombies) if (z.dead) dd++; else al++;
      L.push('Zombies ' + G.zombies.length + ' (' + al + ' alive, ' + dd + ' bodies) - updated ' + ((typeof Zombie !== 'undefined' && Zombie.updN) || 0) + ' - cars ' + G.cars.length + ' (' + (typeof Vehicles !== 'undefined' && Vehicles.active ? Vehicles.active.length : '-') + ' active)');
    }
    if (typeof Char3D !== 'undefined' && Char3D.lodN) {
      const n = Char3D.lodN;
      L.push('Characters drawn: full ' + n[0] + ', simplified ' + n[1] + ', box ' + n[2] + ', far sprites ' + n[3] + ', still-body sprites ' + n[4] + ' - prepare ' + f2(Char3D.prepMs) + ' ms - LOD radii ' + Char3D.RL.map(r => r > 1e6 ? 'inf' : f1(r)).join('/') + (Char3D.bias ? ' (auto bias ' + f2(Char3D.bias) + ')' : ''));
      if (typeof GL3D !== 'undefined') L.push('GL atlas ' + GL3D.AW + 'x' + GL3D.AH + ' - cells ' + GL3D.cells.length + ' - sprite slots ' + C3Imp.n);
    }
    if (typeof Spr !== 'undefined') {
      L.push('Caches: sprites ' + Spr.cache.size + ', walls ' + Spr.wcache.size + ', ground chunks ' + Render.chunks.size + ' (' + Render.chunkVis + ' on screen), roofs ' + Facade.rcache.size + ' (' + f1(Facade.rpx * 4 / 1048576) + ' MB)'
        + (typeof CarArt !== 'undefined' ? ', car views ' + CarArt.cache.size + ' (' + f1(CarArt.bytes / 1048576) + ' MB)' : '') + ' - light grid ' + Render.lw + 'x' + Render.lh);
      L.push('Decals ' + Wd.decals.length + ' - floor item piles ' + Wd.items.size + ' - fires ' + (Wd.fire ? Wd.fire.size : 0) + ' - particles ' + Fx.parts.length + (typeof Vehicles !== 'undefined' ? '/' + Vehicles.pfx.length : ''));
    }
    if (performance.memory) L.push('JS heap ' + Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB of ' + Math.round(performance.memory.jsHeapSizeLimit / 1048576));
    L.push('Settings: ' + Object.keys(V).map(k => k + '=' + V[k]).join(' '));
    return L.join('\n');
  },
};
