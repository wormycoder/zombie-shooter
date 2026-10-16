'use strict';
// ---------------------------------------------------------------------------
// Procedural audio (WebAudio): sound effects, ambience, generative music
// ---------------------------------------------------------------------------
const Sfx = {
  ctx: null, on: false, vol: { master: 0.8, sfx: 0.9, music: 0.45 },
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol.master; this.master.connect(c.destination);
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.connect(this.master);
    this.sfxG = c.createGain(); this.sfxG.gain.value = this.vol.sfx; this.sfxG.connect(this.comp);
    this.musG = c.createGain(); this.musG.gain.value = this.vol.music; this.musG.connect(this.master);
    // noise buffer
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // brown noise for rumbles
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const b = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    // reverb
    this.verb = c.createConvolver();
    const il = c.sampleRate * 2.8, ir = c.createBuffer(2, il, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const a = ir.getChannelData(ch); for (let i = 0; i < il; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / il, 2.6); }
    this.verb.buffer = ir;
    this.verbG = c.createGain(); this.verbG.gain.value = 0.5;
    this.verb.connect(this.verbG); this.verbG.connect(this.master);
    this.sfxVerb = c.createGain(); this.sfxVerb.gain.value = 0.18; this.sfxVerb.connect(this.verb);
    // loops
    this.rainSrc = this.loopNoise(this.noise, 'lowpass', 3500);
    this.windSrc = this.loopNoise(this.brown, 'lowpass', 500);
    this.fireSrc = this.loopNoise(this.brown, 'lowpass', 900);
    this.flySrc = this.loopNoise(this.noise, 'bandpass', 520); this.flySrc.fl.Q.value = 9;
    this.on = true;
    Music.init();
  },
  setVol(k, v) { this.vol[k] = v; if (!this.ctx) return; if (k === 'master') this.master.gain.value = v; if (k === 'sfx') this.sfxG.gain.value = v; if (k === 'music') this.musG.gain.value = v; },
  loopNoise(buf, type, f) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(this.sfxG);
    s.start();
    return { s, fl, g };
  },
  // positional helpers
  spatial(x, y, maxD) {
    const p = G.player;
    if (x === undefined || !p) return { g: 1, pan: 0 };
    const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
    const d = World.lvDist(px, py, x, y);
    const g = U.clamp(1 - d / (maxD || 30), 0, 1);
    const sx = (vxOf(x) - y) - (vxOf(px) - py);
    return { g: g * g, pan: U.clamp(sx / 14, -0.9, 0.9) };
  },
  out(pan, verb) {
    const c = this.ctx;
    const g = c.createGain();
    let node = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); p.connect(this.sfxG); if (verb) p.connect(this.sfxVerb); }
    else { g.connect(this.sfxG); }
    return node;
  },
  nz(t0, dur, type, f, q, gain, pan, opts) {
    const c = this.ctx;
    opts = opts || {};
    const s = c.createBufferSource(); s.buffer = opts.brown ? this.brown : this.noise;
    s.playbackRate.value = opts.rate || 1;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q || 1;
    if (opts.f1) fl.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t0 + dur);
    const g = this.out(pan, opts.verb);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + (opts.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
  },
  tn(t0, dur, type, f0, f1, gain, pan, opts) {
    const c = this.ctx;
    opts = opts || {};
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t0 + dur);
    const g = this.out(pan, opts.verb);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + (opts.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (opts.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = opts.lp; o.connect(fl); node = fl; }
    if (opts.vib) { const l = c.createOscillator(); l.frequency.value = opts.vib; const lg = c.createGain(); lg.gain.value = f0 * 0.04; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur); }
    node.connect(g);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  play(name, x, y) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    const sp = this.spatial(x, y, name === 'alarm' || name === 'thunder' ? 80 : 36);
    const G_ = sp.g, pan = sp.pan;
    if (G_ < 0.01) return;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      case 'swing': this.nz(t, 0.2, 'bandpass', 1400, 1.5, 0.18 * G_, pan, { f1: 350, a: 0.05 }); break;
      case 'swingLight': this.nz(t, 0.14, 'bandpass', 1800, 1.5, 0.12 * G_, pan, { f1: 600, a: 0.04 }); break;
      case 'swingHeavy': this.nz(t, 0.32, 'bandpass', 900, 1.2, 0.22 * G_, pan, { f1: 200, a: 0.08 }); break;
      case 'hitBlunt': this.tn(t, 0.14, 'sine', 140, 45, 0.5 * G_, pan); this.nz(t, 0.09, 'lowpass', 900, 1, 0.4 * G_, pan); break;
      case 'hitBlade': this.nz(t, 0.08, 'bandpass', 2500, 2, 0.25 * G_, pan); this.tn(t, 0.1, 'sine', 110, 50, 0.35 * G_, pan); this.nz(t + 0.02, 0.12, 'lowpass', 700, 1, 0.3 * G_, pan); break;
      case 'hitFlesh': this.nz(t, 0.1, 'lowpass', 800, 1, 0.35 * G_, pan); this.tn(t, 0.08, 'sine', 100, 50, 0.3 * G_, pan); break;
      case 'shove': case 'zfall': case 'thud': this.tn(t, 0.18, 'sine', 90, 40, 0.45 * G_, pan); this.nz(t, 0.12, 'lowpass', 400, 1, 0.3 * G_, pan); break;
      case 'stomp': this.tn(t, 0.16, 'sine', 70, 35, 0.6 * G_, pan); this.nz(t, 0.12, 'lowpass', 1200, 1, 0.35 * G_, pan); break;
      case 'zdie': this.tn(t, 0.25, 'sine', 80, 35, 0.5 * G_, pan); this.groanAt(t + 0.05, 0.6, 70, 0.15 * G_, pan); break;
      case 'pistol': this.gun(t, G_, pan, 1); break;
      case 'rifle': this.gun(t, G_, pan, 1.4); break;
      case 'shotgun': this.gun(t, G_, pan, 1.8); break;
      case 'dryfire': this.tn(t, 0.02, 'square', 2200, 1800, 0.2, pan); break;
      case 'reload': for (let k = 0; k < 3; k++) this.tn(t + k * 0.12, 0.03, 'square', 1600 - k * 300, 1200, 0.15, pan); break;
      case 'shellin': this.tn(t, 0.04, 'square', 1200, 900, 0.15, pan); break;
      case 'glass':
        this.nz(t, 0.5, 'highpass', 3000, 0.7, 0.45 * G_, pan, { verb: true });
        for (let k = 0; k < 9; k++) this.tn(t + r(0, 0.3), r(0.05, 0.2), 'sine', r(2500, 7000), r(2500, 7000), r(0.05, 0.15) * G_, pan);
        break;
      case 'doorOpen': this.tn(t, 0.4, 'sawtooth', 220, 150, 0.06 * G_, pan, { lp: 900 }); this.nz(t, 0.08, 'lowpass', 600, 1, 0.12 * G_, pan); break;
      case 'doorClose': this.tn(t, 0.25, 'sawtooth', 160, 120, 0.05 * G_, pan, { lp: 700 }); this.tn(t + 0.2, 0.15, 'sine', 110, 50, 0.45 * G_, pan); this.nz(t + 0.2, 0.1, 'lowpass', 700, 1, 0.3 * G_, pan); break;
      case 'garage': this.nz(t, 1.2, 'bandpass', 500, 2, 0.15 * G_, pan, { a: 0.2 }); break;
      case 'lock': this.tn(t, 0.03, 'square', 1800, 1500, 0.12 * G_, pan); this.tn(t + 0.08, 0.03, 'square', 1400, 1100, 0.12 * G_, pan); break;
      case 'locked': for (let k = 0; k < 3; k++) this.nz(t + k * 0.07, 0.05, 'bandpass', 1800, 3, 0.2 * G_, pan); break;
      case 'window': this.nz(t, 0.45, 'bandpass', 700, 1.5, 0.15 * G_, pan, { a: 0.1 }); break;
      case 'climb': this.nz(t, 0.3, 'lowpass', 900, 1, 0.12 * G_, pan, { a: 0.05 }); break;
      case 'thump': this.tn(t, 0.2, 'sine', r(60, 80), 35, 0.6 * G_, pan); this.nz(t, 0.15, 'lowpass', 350, 1, 0.45 * G_, pan, { verb: true }); break;
      case 'thumpGlass': this.tn(t, 0.15, 'sine', 90, 50, 0.3 * G_, pan); this.nz(t, 0.18, 'bandpass', 3000, 3, 0.12 * G_, pan); break;
      case 'thumpMetal': this.tn(t, 0.3, 'square', 260, 240, 0.08 * G_, pan, { lp: 1500 }); this.tn(t, 0.18, 'sine', 80, 40, 0.4 * G_, pan); break;
      case 'woodbreak': this.nz(t, 0.35, 'lowpass', 2500, 1, 0.5 * G_, pan, { verb: true }); for (let k = 0; k < 6; k++) this.nz(t + r(0, 0.25), 0.03, 'highpass', 2000, 1, 0.25 * G_, pan); this.tn(t, 0.2, 'sine', 80, 40, 0.4 * G_, pan); break;
      case 'wood': this.nz(t, 0.15, 'bandpass', 900, 2, 0.25 * G_, pan); this.tn(t, 0.1, 'sine', 200, 120, 0.2 * G_, pan); break;
      case 'hammer': this.tn(t, 0.06, 'triangle', 1100, 900, 0.3 * G_, pan); this.nz(t, 0.04, 'highpass', 2000, 1, 0.2 * G_, pan); break;
      case 'chop': this.tn(t, 0.08, 'triangle', 500, 300, 0.4 * G_, pan); this.nz(t, 0.1, 'bandpass', 1200, 1, 0.3 * G_, pan); break;
      case 'treefall': this.nz(t, 1.6, 'lowpass', 600, 1, 0.4 * G_, pan, { brown: true, a: 0.8, verb: true }); this.tn(t + 1.4, 0.4, 'sine', 70, 30, 0.6 * G_, pan); break;
      case 'pickup': this.nz(t, 0.06, 'bandpass', 2400, 2, 0.08, pan); break;
      case 'equip': this.nz(t, 0.08, 'bandpass', 1500, 2, 0.1, pan); this.tn(t, 0.04, 'triangle', 700, 600, 0.06, pan); break;
      case 'cloth': this.nz(t, 0.3, 'bandpass', 2500, 1, 0.08, pan, { a: 0.1 }); break;
      case 'eat': for (let k = 0; k < 4; k++) this.nz(t + k * 0.22, 0.07, 'bandpass', r(1500, 3000), 2, 0.12, pan); break;
      case 'drink': for (let k = 0; k < 3; k++) this.tn(t + k * 0.3, 0.12, 'sine', 380, 260, 0.12, pan); break;
      case 'pills': for (let k = 0; k < 5; k++) this.nz(t + k * 0.03, 0.02, 'highpass', 4000, 1, 0.1, pan); break;
      case 'bandage': case 'rip': this.nz(t, 0.35, 'bandpass', 2200, 1, 0.15, pan, { a: 0.05 }); break;
      case 'page': this.nz(t, 0.2, 'highpass', 3000, 1, 0.06, pan, { a: 0.05 }); break;
      case 'craft': this.nz(t, 0.1, 'bandpass', 1200, 2, 0.12, pan); this.tn(t + 0.1, 0.05, 'triangle', 800, 700, 0.08, pan); break;
      case 'fill': this.nz(t, 0.9, 'bandpass', 1100, 1.5, 0.1, pan, { a: 0.1 }); break;
      case 'spray': this.nz(t, 1.8, 'highpass', 3000, 0.7, 0.18 * G_, pan, { a: 0.05 }); break;
      case 'splash': this.nz(t, 0.5, 'bandpass', 700, 0.8, 0.25 * G_, pan, { a: 0.01 }); this.nz(t + 0.05, 0.9, 'highpass', 2500, 1, 0.12 * G_, pan, { a: 0.1 }); break;
      case 'splash': this.nz(t, 0.5, 'lowpass', 1500, 1, 0.25 * G_, pan); break;
      case 'dig': this.nz(t, 0.25, 'lowpass', 700, 1, 0.25, pan, { brown: true }); break;
      case 'switch': this.tn(t, 0.02, 'square', 2600, 2000, 0.1, pan); break;
      case 'levelup': [523, 659, 784].forEach((f, k) => this.tn(t + k * 0.1, 0.35, 'sine', f, f, 0.12, 0, { verb: true })); break;
      case 'hurt': this.tn(t, 0.18, 'sawtooth', G.player && G.player.look.female ? 330 : 190, G.player && G.player.look.female ? 260 : 140, 0.15, 0, { lp: 1200 }); break;
      case 'zhit': this.nz(t, 0.18, 'bandpass', 1500, 1, 0.2, 0); this.groanAt(t, 0.4, 110, 0.2, pan); break;
      case 'zattack': this.groanAt(t, 0.45, r(110, 150), 0.22 * G_, pan, true); break;
      case 'scream': this.tn(t, 1.0, 'sawtooth', 700, 400, 0.15, 0, { lp: 2500, vib: 8 }); break;
      case 'shout': {
        const f0 = G.player && G.player.look.female ? 300 : 175;
        for (const [fq, q, gg] of [[750, 6, 0.5], [1900, 8, 0.3], [2700, 9, 0.15]]) {
          const c2 = this.ctx, o = c2.createOscillator(); o.type = 'sawtooth';
          o.frequency.setValueAtTime(f0 * 1.25, t); o.frequency.linearRampToValueAtTime(f0, t + 0.35);
          const bp = c2.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(fq * 0.7, t); bp.frequency.linearRampToValueAtTime(fq, t + 0.12); bp.Q.value = q;
          const g = this.out(0, true); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gg * 0.6, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
          o.connect(bp); bp.connect(g); o.start(t); o.stop(t + 0.45);
        }
        this.nz(t, 0.08, 'highpass', 3000, 1, 0.08, 0);
        break;
      }
      case 'death': this.tn(t, 2.5, 'sine', 110, 55, 0.25, 0, { verb: true }); break;
      // ---- vehicles
      case 'engineStart': this.tn(t, 0.35, 'sawtooth', 55, 110, 0.1 * G_, pan, { lp: 500, a: 0.05 }); this.tn(t + 0.25, 0.7, 'sawtooth', 110, 46, 0.09 * G_, pan, { lp: 420 }); this.nz(t, 0.8, 'lowpass', 320, 1, 0.22 * G_, pan, { brown: true, a: 0.05 }); break;
      case 'crank': for (let k = 0; k < 6; k++) { this.tn(t + k * 0.15, 0.13, 'sawtooth', 62, 48, 0.08 * G_, pan, { lp: 360 }); this.nz(t + k * 0.15, 0.1, 'bandpass', 700, 2, 0.05 * G_, pan); } break;
      case 'crankFail': this.tn(t, 0.25, 'sawtooth', 70, 38, 0.08 * G_, pan, { lp: 300 }); this.nz(t + 0.05, 0.12, 'lowpass', 500, 1, 0.18 * G_, pan, { brown: true }); break;
      case 'crankDead': for (let k = 0; k < 3; k++) this.tn(t + k * 0.32, 0.03, 'square', 1500, 1100, 0.07 * G_, pan, { lp: 3000 }); break;
      case 'stall': this.tn(t, 0.5, 'sawtooth', 70, 28, 0.08 * G_, pan, { lp: 360 }); this.nz(t, 0.3, 'lowpass', 300, 1, 0.15 * G_, pan, { brown: true }); break;
      case 'engineOff': this.tn(t, 0.4, 'sawtooth', 52, 26, 0.06 * G_, pan, { lp: 300 }); break;
      case 'horn': this.tn(t, 0.6, 'square', 410, 410, 0.1 * G_, pan, { lp: 1600, a: 0.02 }); this.tn(t, 0.6, 'square', 520, 520, 0.08 * G_, pan, { lp: 1600, a: 0.02 }); break;
      case 'hornSmall': this.tn(t, 0.45, 'square', 560, 560, 0.09 * G_, pan, { lp: 2200, a: 0.015 }); this.tn(t, 0.45, 'square', 690, 690, 0.07 * G_, pan, { lp: 2200, a: 0.015 }); break;
      case 'hornTruck': this.tn(t, 0.75, 'sawtooth', 290, 290, 0.09 * G_, pan, { lp: 1300, a: 0.03 }); this.tn(t, 0.75, 'sawtooth', 365, 365, 0.07 * G_, pan, { lp: 1300, a: 0.03 }); break;
      case 'hornBus': this.tn(t, 1.0, 'sawtooth', 220, 220, 0.1 * G_, pan, { lp: 1000, a: 0.05, verb: true }); this.tn(t, 1.0, 'sawtooth', 277, 277, 0.08 * G_, pan, { lp: 1000, a: 0.05 }); this.tn(t, 1.0, 'sawtooth', 330, 330, 0.05 * G_, pan, { lp: 1000, a: 0.05 }); break;
      case 'crash': this.nz(t, 0.6, 'lowpass', 2000, 1, 0.5 * G_, pan, { verb: true }); this.tn(t, 0.45, 'square', 300, 180, 0.06 * G_, pan, { lp: 1500 }); this.tn(t, 0.3, 'sine', 70, 30, 0.55 * G_, pan); break;
      case 'crunch':
        this.nz(t, 0.9, 'lowpass', 2600, 0.8, 0.7 * G_, pan, { verb: true }); this.tn(t, 0.4, 'sine', 60, 25, 0.8 * G_, pan);
        for (let k = 0; k < 5; k++) this.tn(t + r(0, 0.35), r(0.08, 0.2), 'square', r(180, 420), r(90, 200), 0.05 * G_, pan, { lp: 1800 });
        this.nz(t + 0.05, 0.4, 'highpass', 3500, 0.7, 0.25 * G_, pan); break;
      case 'carHit': this.tn(t, 0.2, 'sine', 90, 40, 0.55 * G_, pan); this.nz(t, 0.15, 'lowpass', 900, 1, 0.35 * G_, pan); this.tn(t, 0.12, 'square', 240, 200, 0.04 * G_, pan, { lp: 1200 }); break;
      case 'cardoor': case 'carDoorClose': this.tn(t, 0.12, 'sine', 120, 55, 0.4 * G_, pan); this.nz(t, 0.08, 'lowpass', 800, 1, 0.25 * G_, pan); this.tn(t + 0.01, 0.05, 'square', 900, 700, 0.03 * G_, pan, { lp: 2500 }); break;
      case 'carDoorOpen': this.tn(t, 0.04, 'square', 1300, 1000, 0.05 * G_, pan, { lp: 3000 }); this.nz(t + 0.03, 0.15, 'bandpass', 900, 1.5, 0.08 * G_, pan); break;
      case 'hoodOpen': this.tn(t, 0.05, 'square', 900, 700, 0.06 * G_, pan, { lp: 2500 }); this.tn(t + 0.12, 0.45, 'sawtooth', 210, 160, 0.03 * G_, pan, { lp: 900 }); break;
      case 'hoodClose': this.tn(t, 0.18, 'sine', 100, 45, 0.5 * G_, pan); this.nz(t, 0.12, 'lowpass', 1200, 1, 0.3 * G_, pan); this.tn(t, 0.25, 'square', 330, 300, 0.04 * G_, pan, { lp: 1500 }); break;
      case 'lightBreak': this.nz(t, 0.18, 'highpass', 3500, 0.7, 0.25 * G_, pan); this.tn(t, 0.05, 'sine', 2800, 2000, 0.06 * G_, pan); break;
      case 'tireBurst': this.nz(t, 0.25, 'lowpass', 3000, 0.7, 0.8 * G_, pan, { verb: true }); this.tn(t, 0.12, 'sine', 120, 40, 0.6 * G_, pan); this.nz(t + 0.1, 1.1, 'bandpass', 600, 1, 0.12 * G_, pan, { a: 0.05 }); break;
      case 'ratchet': for (let k = 0; k < 7; k++) this.tn(t + k * 0.06, 0.02, 'square', 2600, 2200, 0.06 * G_, pan, { lp: 5000 }); break;
      case 'clunk': this.tn(t, 0.15, 'sine', 160, 70, 0.4 * G_, pan); this.tn(t, 0.2, 'square', 520, 480, 0.04 * G_, pan, { lp: 2000 }); break;
      case 'alarm': for (let k = 0; k < 4; k++) this.tn(t + k * 0.5, 0.48, 'square', k & 1 ? 760 : 960, k & 1 ? 760 : 960, 0.07 * G_, pan, { lp: 2500 }); break;
      case 'beep': for (let k = 0; k < 4; k++) this.tn(t + k * 0.25, 0.1, 'square', 2000, 2000, 0.06 * G_, pan, { lp: 4000 }); break;
      case 'powerdown': this.tn(t, 1.6, 'sawtooth', 120, 30, 0.1, 0, { lp: 600 }); break;
      case 'thunder': this.nz(t, 3.5, 'lowpass', 220, 1, 0.9, r(-0.5, 0.5), { brown: true, a: 0.15, verb: true }); this.nz(t, 0.4, 'lowpass', 1500, 1, 0.3, 0); break;
      case 'fire': for (let k = 0; k < 8; k++) this.nz(t + r(0, 1), 0.03, 'highpass', 2500, 1, 0.1 * G_, pan); this.nz(t, 1.2, 'lowpass', 400, 1, 0.15 * G_, pan, { a: 0.2 }); break;
      case 'cough': for (let k = 0; k < 2; k++) this.nz(t + k * 0.25, 0.15, 'bandpass', 900, 2, 0.25, 0); break;
      case 'break': this.tn(t, 0.08, 'square', 700, 300, 0.15, pan); this.nz(t, 0.2, 'highpass', 1500, 1, 0.2, pan); break;
      case 'heartbeat': this.tn(t, 0.1, 'sine', 60, 40, 0.4, 0); this.tn(t + 0.22, 0.1, 'sine', 55, 38, 0.3, 0); break;
    }
  },
  gun(t, G_, pan, k) {
    this.nz(t, 0.25 * k, 'lowpass', 4000, 0.7, 0.9 * G_, pan, { verb: true });
    this.nz(t, 0.05, 'highpass', 1500, 1, 0.7 * G_, pan);
    this.tn(t, 0.18 * k, 'sine', 160, 35, 0.9 * G_, pan);
    this.nz(t + 0.05, 0.9 * k, 'lowpass', 500, 1, 0.25 * G_, pan, { brown: true, a: 0.05 });
  },
  groanAt(t, dur, f0, gain, pan, snarl) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (snarl ? 1.3 : 0.75), t + dur);
    const l = c.createOscillator(); l.frequency.value = snarl ? 18 : 5 + Math.random() * 3;
    const lg = c.createGain(); lg.gain.value = f0 * (snarl ? 0.15 : 0.06); l.connect(lg); lg.connect(o.frequency);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = snarl ? 900 : 550 + Math.random() * 150; f1.Q.value = 5;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = snarl ? 1600 : 1000 + Math.random() * 300; f2.Q.value = 6;
    const g = this.out(pan, true);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g);
    o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05);
    if (snarl) this.nz(t, dur, 'bandpass', 1200, 1, gain * 0.5, pan, { a: 0.05 });
  },
  groan(z, d, aggressive) {
    if (!this.on || G.speed > 8) return;
    const sp = this.spatial(z.x, z.y, 22);
    if (sp.g < 0.02) return;
    this.groanAt(this.ctx.currentTime, Math.random() * 0.8 + (aggressive ? 0.6 : 1.0), (z.female ? 110 : 75) + Math.random() * 25, (aggressive ? 0.28 : 0.16) * sp.g, sp.pan, aggressive && Math.random() < 0.5);
  },
  footstep(fl, mode, sneak) {
    if (!this.on || G.speed > 5) return;
    const t = this.ctx.currentTime;
    const loud = (mode === 'sprint' ? 0.22 : mode === 'run' ? 0.17 : 0.1) * (sneak ? 0.45 : 1);
    if (fl === FL.GRASS || fl === FL.GRASS2 || fl === FL.FOREST || fl === FL.FURROW) this.nz(t, 0.09, 'bandpass', 1800, 0.8, loud * 0.8, 0, { a: 0.01 });
    else if (fl === FL.WOOD) { this.nz(t, 0.06, 'lowpass', 900, 1, loud, 0); this.tn(t, 0.05, 'sine', 160, 90, loud * 0.8, 0); }
    else if (fl === FL.DIRT || fl === FL.SAND || fl === FL.GRAVEL) this.nz(t, 0.1, 'bandpass', 1200, 0.7, loud, 0);
    else if (fl === FL.CARPET) this.nz(t, 0.05, 'lowpass', 500, 1, loud * 0.6, 0);
    else this.nz(t, 0.05, 'bandpass', 2600, 1.2, loud, 0);
  },
  rain(level, indoor) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    this.rainSrc.g.gain.setTargetAtTime(level * (indoor ? 0.12 : 0.3), t, 0.5);
    this.rainSrc.fl.frequency.setTargetAtTime(indoor ? 900 : 3500, t, 0.5);
    const cold = typeof Season !== 'undefined' && (Season.tree === 'b' || Season.snow > 0.3);
    this.windSrc.g.gain.setTargetAtTime(0.06 + level * 0.12 + (cold ? 0.07 : 0), t, 1);
  },
  // roar and crackle of nearby fires (level: summed intensity nearby)
  fire(level) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    const g = Math.min(0.5, level * 0.035);
    this.fireSrc.g.gain.setTargetAtTime(g, t, 0.4);
    if (level > 0.2 && Math.random() < Math.min(0.6, level * 0.05)) {
      const n = 1 + (Math.random() * 3 | 0);
      for (let k = 0; k < n; k++) this.nz(t + Math.random() * 0.2, 0.02 + Math.random() * 0.03, 'highpass', 1800 + Math.random() * 2500, 1, Math.min(0.25, 0.04 + level * 0.01), Math.random() * 1.2 - 0.6);
    }
  },
  flies(level) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    this.flySrc.g.gain.setTargetAtTime(Math.min(0.09, level * 0.02), t, 0.5);
    this.flySrc.fl.frequency.setTargetAtTime(480 + Math.random() * 120, t, 0.2);
  },
  // engine note of the car the player drives: rpm 0.15 idle .. 1 redline, th throttle 0/1
  engine(car, rpm, th) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    if (!car) { if (this.eng) { this.eng.g.gain.setTargetAtTime(0, t, 0.12); this.eng.ng.gain.setTargetAtTime(0, t, 0.12); } return; }
    if (!this.eng) {
      const o = c.createOscillator(); o.type = 'sawtooth';
      const o2 = c.createOscillator(); o2.type = 'square';
      const g2 = c.createGain(); g2.gain.value = 0.45;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 300; fl.Q.value = 2;
      const g = c.createGain(); g.gain.value = 0;
      // firing pulses: amplitude wobble at the cylinder rate
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 12;
      const lg = c.createGain(); lg.gain.value = 0.35; const am = c.createGain(); am.gain.value = 0.75;
      lfo.connect(lg); lg.connect(am.gain);
      o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(am); am.connect(g); g.connect(this.sfxG);
      const ns = c.createBufferSource(); ns.buffer = this.brown; ns.loop = true;
      const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 220;
      const ng = c.createGain(); ng.gain.value = 0;
      ns.connect(nf); nf.connect(ng); ng.connect(this.sfxG);
      o.start(); o2.start(); lfo.start(); ns.start();
      this.eng = { o, o2, g, fl, lfo, nf, ng };
    }
    const T = (typeof CAR_TYPES !== 'undefined' && CAR_TYPES[car.type]) || {};
    const pitch = T.pitch || 1, P = car.parts || {};
    if (rpm === undefined) rpm = 0.2 + Math.min(0.8, Math.abs(car.v || 0) / 18);
    const cranking = !car.engine;
    const loud = P.muffler !== undefined && P.muffler < 0 ? 1.9 : P.muffler !== undefined && P.muffler < 30 ? 1.35 : 1;
    const rough = P.engine !== undefined && P.engine < 35 ? (35 - P.engine) / 35 : 0;
    const f = cranking ? 9 + Math.random() * 3 : (24 + rpm * 92) * pitch * (1 + (Math.random() - 0.5) * 0.06 * rough);
    const e = this.eng;
    e.o.frequency.setTargetAtTime(f, t, 0.06);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    e.lfo.frequency.setTargetAtTime(cranking ? 6 : f * 0.25 * (1 + rough * 0.4), t, 0.06);
    e.fl.frequency.setTargetAtTime((cranking ? 260 : 170 + rpm * 900 + (th ? 280 : 0)) * (loud > 1 ? 1.5 : 1), t, 0.08);
    e.g.gain.setTargetAtTime(Math.min(0.2, (cranking ? 0.05 : 0.055 + rpm * 0.04 + (th ? 0.025 : 0)) * loud), t, 0.08);
    e.nf.frequency.setTargetAtTime(160 + rpm * 500, t, 0.1);
    e.ng.gain.setTargetAtTime(cranking ? 0.04 : Math.min(0.16, (0.05 + rpm * 0.06) * loud), t, 0.1);
  },
  // tyre squeal (level 0..1) at the loudest skidding car
  screech(level, x, y) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    if (!this.scr) {
      if (!(level > 0)) return;
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1700; fl.Q.value = 9;
      const lfo = c.createOscillator(); lfo.frequency.value = 7; const lg = c.createGain(); lg.gain.value = 220; lfo.connect(lg); lg.connect(fl.frequency);
      const g = c.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(this.sfxG); s.start(); lfo.start();
      this.scr = { g, fl };
    }
    const sp = level > 0 ? this.spatial(x, y, 40) : { g: 0 };
    this.scr.g.gain.setTargetAtTime(Math.min(0.5, (level || 0) * 0.5 * sp.g), t, level > 0 ? 0.04 : 0.12);
    if (level > 0) this.scr.fl.frequency.setTargetAtTime(1500 + level * 500, t, 0.1);
  },
  // two-tone wail of the nearest active siren
  siren(c) {
    if (!this.on) return;
    const ctx = this.ctx;
    if (!c) { if (this.sir) this.sir.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); return; }
    if (!this.sir) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 900;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.28;
      const lg = ctx.createGain(); lg.gain.value = 320; lfo.connect(lg); lg.connect(o.frequency);
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2200;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(fl); fl.connect(g); g.connect(this.sfxG); o.start(); lfo.start();
      this.sir = { g };
    }
    const p = G.player;
    const sp = p && p.inCar === c ? { g: 1 } : this.spatial(c.x, c.y, 120);
    this.sir.g.gain.setTargetAtTime(0.07 * sp.g + 0.004, ctx.currentTime, 0.1);
  },
  heli(h) {
    if (!this.on) return;
    const c = this.ctx;
    if (!h) { if (this.hel) this.hel.g.gain.setTargetAtTime(0, c.currentTime, 0.5); return; }
    if (!this.hel) {
      const s = c.createBufferSource(); s.buffer = this.brown; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 250;
      const am = c.createGain(); am.gain.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 11; const lg = c.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
      const g = c.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(am); am.connect(g); g.connect(this.sfxG); s.start(); lfo.start();
      this.hel = { g };
    }
    const sp = this.spatial(h.x, h.y, 110);
    this.hel.g.gain.setTargetAtTime(0.9 * sp.g + 0.02, c.currentTime, 0.3);
  },
  distant(kind, x, y) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const sp = this.spatial(x, y, 140);
    const g = Math.max(0.05, sp.g) * 0.5;
    if (kind === 'gunshots') { const n = 2 + Math.floor(Math.random() * 5); for (let k = 0; k < n; k++) { const tt = t + k * (0.2 + Math.random() * 0.5); this.nz(tt, 0.5, 'lowpass', 500, 1, 0.5 * g, sp.pan, { verb: true }); this.tn(tt, 0.2, 'sine', 90, 35, 0.4 * g, sp.pan); } }
    else if (kind === 'scream') this.tn(t, 1.2, 'sawtooth', 650, 380, 0.08 * g, sp.pan, { lp: 1200, vib: 7, verb: true });
    else if (kind === 'crash') { this.nz(t, 1.0, 'lowpass', 700, 1, 0.5 * g, sp.pan, { verb: true }); }
    else if (kind === 'dog') for (let k = 0; k < 3; k++) { this.tn(t + k * 0.35, 0.12, 'sawtooth', 500, 350, 0.08 * g, sp.pan, { lp: 1500, verb: true }); }
  },
};

// ---------------------------------------------------------------------------
// Generative music & ambience
// ---------------------------------------------------------------------------
const Music = {
  bufs: {}, t: 0, nextPhrase: 3, tension: 0, ambT: 0,
  init() {
    const c = Sfx.ctx;
    const notes = { A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440 };
    for (const n in notes) this.bufs[n] = this.pluck(c, notes[n], 3.5);
    // tension drone
    const o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55 * 1.06;
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 220;
    const g = c.createGain(); g.gain.value = 0;
    const trem = c.createOscillator(); trem.frequency.value = 6; const tg = c.createGain(); tg.gain.value = 0;
    trem.connect(tg); tg.connect(g.gain);
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(Sfx.musG); g.connect(Sfx.verb);
    o1.start(); o2.start(); trem.start();
    this.drone = { g, fl, tg };
  },
  pluck(c, f, dur) {
    const sr = c.sampleRate, n = Math.floor(sr * dur);
    const buf = c.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const N = Math.round(sr / f);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const cur = ring[idx];
      const nx = 0.5 * (cur + prev) * 0.9965;
      prev = cur;
      ring[idx] = nx;
      d[i] = cur * 0.5;
      idx = (idx + 1) % N;
    }
    // soften attack
    for (let i = 0; i < 200; i++) d[i] *= i / 200;
    return buf;
  },
  note(name, t, gain, pan) {
    const c = Sfx.ctx;
    const s = c.createBufferSource(); s.buffer = this.bufs[name];
    const g = c.createGain(); g.gain.value = gain;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    s.connect(lp); lp.connect(g);
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); p.connect(Sfx.musG); p.connect(Sfx.verb); }
    else { g.connect(Sfx.musG); }
    s.start(t);
  },
  phrase() {
    const c = Sfx.ctx;
    const t = c.currentTime + 0.1;
    const prog = [['A2', 'E3', 'A3', 'C4', 'E4'], ['F3', 'C4', 'F4', 'A4'], ['C3', 'G3', 'C4', 'E4', 'G4'], ['E3', 'B3', 'E4', 'G4'], ['D3', 'A3', 'D4', 'F4', 'A4'], ['G3', 'D4', 'G4', 'B3']];
    const pick = R.pick([[0, 1, 2, 3], [0, 4, 1, 3], [4, 0, 5, 3], [0, 1, 4, 3]]);
    let tt = t;
    for (const ci of pick) {
      const ch = prog[ci];
      const arp = R.chance(0.5) ? ch : ch.slice().reverse();
      for (let k = 0; k < arp.length; k++) this.note(arp[k], tt + k * R.f(0.22, 0.34), k === 0 ? 0.5 : 0.32, R.f(-0.4, 0.4));
      tt += R.f(2.2, 3.2);
    }
    return tt - t;
  },
  update(dt) {
    if (!Sfx.on) return;
    this.t += dt;
    const p = G.player;
    // tension when chased
    const target = G.mode === 'play' && p && !p.dead ? U.clamp((G.chasing || 0) / 6, 0, 1) : 0;
    this.tension += (target - this.tension) * Math.min(1, dt * 0.6);
    const c = Sfx.ctx;
    this.drone.g.gain.setTargetAtTime(this.tension * 0.07, c.currentTime, 0.3);
    this.drone.tg.gain.setTargetAtTime(this.tension * 0.04, c.currentTime, 0.3);
    this.drone.fl.frequency.setTargetAtTime(180 + this.tension * 500, c.currentTime, 0.3);
    if (this.t > this.nextPhrase) {
      if (this.tension < 0.4 && !(p && p.asleep)) { const len = this.phrase(); this.nextPhrase = this.t + len + R.f(18, 45); }
      else this.nextPhrase = this.t + 5;
    }
    // ambience follows the season: songbirds in spring and summer, cicadas on hot days,
    // crickets on warm nights, crows and owls through the cold months
    this.ambT -= dt;
    if (this.ambT <= 0 && G.mode === 'play' && p && World.outdoor(p.x, p.y) && G.weather.rain < 0.3) {
      this.ambT = R.f(1.5, 6);
      const t = c.currentTime;
      const st = Season.tree, winter = st === 'b' || Season.snow > 0.3, autumn = st === 'y' || st === 'a' || st === 's', temp = G.weather.temp;
      if (G.light.amb > 0.6) {
        const birds = winter ? 0 : st === 'p' ? 1 : autumn ? 0.35 : 0.8;
        if (R.chance(birds)) { const f = R.f(2500, 4200); for (let k = 0; k < R.int(2, 5); k++) Sfx.tn(t + k * 0.12, 0.08, 'sine', f, f * R.f(1.1, 1.4), 0.025, R.f(-0.8, 0.8)); }
        else if ((winter || autumn) && R.chance(0.3)) { const pan = R.f(-0.8, 0.8); for (let k = 0; k < R.int(1, 3); k++) Sfx.nz(t + k * 0.32, 0.18, 'bandpass', R.f(800, 1000), 4, 0.06, pan, { a: 0.02 }); }
        if (!winter && !autumn && temp > 27 && R.chance(0.3)) Sfx.nz(t, R.f(2, 4), 'bandpass', 5200, 6, 0.018, R.f(-0.6, 0.6), { a: 0.6 });
      } else if (G.light.amb < 0.3) {
        if ((st === 'g' || st === 'y') && temp > 10) { for (let k = 0; k < R.int(3, 8); k++) Sfx.tn(t + k * 0.06, 0.03, 'sine', 4700, 4600, 0.012, R.f(-0.8, 0.8)); }
        else if (R.chance(0.2)) { const pan = R.f(-0.8, 0.8); Sfx.tn(t, 0.35, 'sine', 390, 370, 0.03, pan); Sfx.tn(t + 0.45, 0.5, 'sine', 380, 350, 0.03, pan); }
      }
    }
    // heartbeat when hurt / panicking
    if (p && !p.dead && (p.st.panic > 65 || p.health < 30)) { this.hbT = (this.hbT || 0) - dt; if (this.hbT <= 0) { this.hbT = p.health < 30 ? 0.8 : 1.0; Sfx.play('heartbeat'); } }
  },
  death() {
    if (!Sfx.on) return;
    const t = Sfx.ctx.currentTime + 0.5;
    ['A2', 'E3', 'A3', 'C4'].forEach((n, k) => this.note(n, t + k * 0.5, 0.45));
    ['F3', 'C4', 'A3'].forEach((n, k) => this.note(n, t + 3 + k * 0.6, 0.4));
    this.nextPhrase = this.t + 20;
  },
};
