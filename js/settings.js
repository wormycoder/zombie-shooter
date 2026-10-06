'use strict';
// ---------------------------------------------------------------------------
// Player settings: graphics & performance, saved in this browser
// ---------------------------------------------------------------------------
const SETTINGS_OPTS = {
  res: { n: 'Render resolution', opts: [['Auto', 'auto'], ['50%', 0.5], ['67%', 0.67], ['75%', 0.75], ['100%', 1]], tip: 'Pixels drawn per frame. Lower is much faster, especially on high-DPI screens. Auto caps high-DPI screens at 1.5x.' },
  fps: { n: 'Frame rate limit', opts: [['30 FPS', 30], ['60 FPS', 60], ['Unlimited', 0]], tip: 'A lower cap saves battery and keeps weak machines steady.' },
  detail: { n: 'World detail', opts: [['Low', 0], ['High', 1]], tip: 'Low skips ground markings and litter, grass edges, power-line wires and window-box flowers.' },
  particles: { n: 'Particles', opts: [['Low', 0.3], ['Medium', 0.6], ['High', 1]], tip: 'Blood, smoke, sparks and glass.' },
  weather: { n: 'Rain & snow', opts: [['Off', 0], ['Light', 0.45], ['Full', 1]], tip: 'Falling rain and snow on screen (the weather itself is unchanged).' },
  chars3d: { n: '3D characters', opts: [['Off (2D)', 0], ['On', 1]], tip: 'Real-time 3D survivors and zombies (needs WebGL).' },
  cars3d: { n: '3D vehicles', opts: [['Off', 0], ['On', 1]], tip: 'Real-time 3D vehicles (needs WebGL).' },
  fpsShow: { n: 'Show FPS', opts: [['Off', 0], ['On', 1]] },
};
const SETTINGS_PRESETS = {
  Low: { res: 0.5, fps: 30, detail: 0, particles: 0.3, weather: 0.45, chars3d: 0, cars3d: 0 },
  Medium: { res: 0.75, fps: 60, detail: 1, particles: 0.6, weather: 0.45, chars3d: 1, cars3d: 1 },
  High: { res: 'auto', fps: 60, detail: 1, particles: 1, weather: 1, chars3d: 1, cars3d: 1 },
  Ultra: { res: 1, fps: 0, detail: 1, particles: 1, weather: 1, chars3d: 1, cars3d: 1 },
};
const Settings = {
  KEY: 'hc_settings',
  v: { res: 'auto', fps: 60, detail: 1, particles: 1, weather: 1, chars3d: 1, cars3d: 1, fpsShow: 0 },
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
