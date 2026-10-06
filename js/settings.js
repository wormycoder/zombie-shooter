'use strict';
// ---------------------------------------------------------------------------
// Player settings: graphics & performance, saved in this browser
// ---------------------------------------------------------------------------
// tab: 'display' or 'perf' (Settings screen)
const SETTINGS_OPTS = {
  res: { tab: 'display', n: 'Render resolution', opts: [['Auto', 'auto'], ['50%', 0.5], ['67%', 0.67], ['75%', 0.75], ['100%', 1]], tip: 'Pixels drawn per frame. Lower is much faster, especially on high-DPI screens. Auto caps high-DPI screens at 1.5x.' },
  fps: { tab: 'display', n: 'Frame rate limit', opts: [['30 FPS', 30], ['60 FPS', 60], ['Unlimited', 0]], tip: 'A lower cap saves battery and keeps weak machines steady.' },
  detail: { tab: 'display', n: 'World detail', opts: [['Low', 0], ['High', 1]], tip: 'Low skips ground markings and litter, grass edges and power-line wires.' },
  particles: { tab: 'display', n: 'Particles', opts: [['Low', 0.3], ['Medium', 0.6], ['High', 1]], tip: 'Blood, smoke, sparks and glass.' },
  weather: { tab: 'display', n: 'Rain & snow', opts: [['Off', 0], ['Light', 0.45], ['Full', 1]], tip: 'Falling rain and snow on screen (the weather itself is unchanged).' },
  chars3d: { tab: 'display', n: '3D characters', opts: [['Off (2D)', 0], ['On', 1]], tip: 'Real-time 3D survivors and zombies (needs WebGL).' },
  cars3d: { tab: 'display', n: '3D vehicles', opts: [['Off', 0], ['On', 1]], tip: 'Real-time 3D vehicles (needs WebGL).' },
  fpsShow: { tab: 'display', n: 'Frame rate counter', opts: [['Off', 0], ['FPS', 1], ['Detailed', 2]], tip: 'Detailed adds frame time, simulation time, lighting and zombie counts.' },
  lightHz: { tab: 'perf', n: 'Lighting updates', opts: [['5 / sec', 5], ['10 / sec', 10], ['15 / sec', 15], ['20 / sec', 20], ['25 / sec', 25], ['30 / sec', 30], ['35 / sec', 35], ['40 / sec', 40], ['45 / sec', 45], ['50 / sec', 50], ['55 / sec', 55], ['60 / sec', 60]], tip: 'How often lights and shadows are recalculated. Lower is cheaper; moving lights (flashlight, headlights) update less smoothly.' },
  uiHz: { tab: 'perf', n: 'UI refresh rate', opts: [['10 / sec', 10], ['15 / sec', 15], ['20 / sec', 20], ['25 / sec', 25], ['30 / sec', 30], ['35 / sec', 35], ['40 / sec', 40], ['45 / sec', 45], ['50 / sec', 50], ['55 / sec', 55], ['60 / sec', 60]], tip: 'How often the HUD, clock, moodles and open windows refresh.' },
  zLazy: { tab: 'perf', n: 'Lazy zombie updates', opts: [['Off', 0], ['On', 1]], tip: 'Zombies in distant chunks (16x16 tiles) think less often: 3-5 chunks away every other step, 6-11 a coarse update every 2 s, 12+ paused. Chasing and visible zombies always run at full rate.' },
  zAdapt: { tab: 'perf', n: 'Adaptive zombie physics', opts: [['Off', 0], ['On', 1]], tip: 'With more than 120 zombies close by, crowd zombies update at half rate to keep the frame rate up.' },
  chunkLazy: { tab: 'perf', n: 'Lazy chunk updates', opts: [['Off', 0], ['On', 1]], tip: 'Chunks 6+ away from you update at half speed and 12+ away are paused (food spoilage, crops, traps, fires catch up when you return).' },
};
const SETTINGS_PRESETS = {
  Low: { res: 0.5, fps: 30, detail: 0, particles: 0.3, weather: 0.45, chars3d: 0, cars3d: 0, lightHz: 15, uiHz: 15, zLazy: 1, zAdapt: 1, chunkLazy: 1 },
  Medium: { res: 0.75, fps: 60, detail: 1, particles: 0.6, weather: 0.45, chars3d: 1, cars3d: 1, lightHz: 30, uiHz: 30, zLazy: 1, zAdapt: 1, chunkLazy: 1 },
  High: { res: 'auto', fps: 60, detail: 1, particles: 1, weather: 1, chars3d: 1, cars3d: 1, lightHz: 60, uiHz: 30, zLazy: 1, zAdapt: 1, chunkLazy: 1 },
  Ultra: { res: 1, fps: 0, detail: 1, particles: 1, weather: 1, chars3d: 1, cars3d: 1, lightHz: 60, uiHz: 60, zLazy: 0, zAdapt: 0, chunkLazy: 0 },
};
const Settings = {
  KEY: 'hc_settings',
  v: { res: 'auto', fps: 60, detail: 1, particles: 1, weather: 1, chars3d: 1, cars3d: 1, fpsShow: 0, lightHz: 60, uiHz: 30, zLazy: 1, zAdapt: 1, chunkLazy: 1 },
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
    const d = Math.min(2, window.devicePixelRatio || 1), r = this.v.res;
    if (r === 'auto') return Math.min(d, 1.5);
    return Math.max(0.5, d * r);
  },
};
Settings.load();
