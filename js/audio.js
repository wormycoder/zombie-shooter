'use strict';
// ---------------------------------------------------------------------------
// Audio (Web Audio): the files in audio/ first (audiofiles.js), and synthesized sounds, ambience and generative music
// for anything without a file
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
    this.fl = {};
    // the audio files; without a list of them, the clips rendered in the background (sfxbank.js)
    AudioFiles.init(c);
    if (typeof SfxBank !== 'undefined' && !AudioFiles.mode) SfxBank.build(c);
    Music.init();
  },
  setVol(k, v) { this.vol[k] = v; if (!this.ctx) return; if (Music.curEl) AudioFiles.elLevel('music', Music.cur, Music.curLvl || 0.8); if (k === 'master') this.master.gain.value = v; if (k === 'sfx') this.sfxG.gain.value = v; if (k === 'music') this.musG.gain.value = v; },
  loopNoise(buf, type, f) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(this.sfxG);
    s.start();
    return { s, fl, g };
  },
  // a loop file at a level (and playback rate): Web Audio once decoded, or an audio element from the disk; false: no
  // file (the caller synthesizes it)
  fileLoop(name, v, rate) {
    if (AudioFiles.mode === 'el') return AudioFiles.elLevel('loops', name, v, rate);
    if (!AudioFiles.loops[name]) return false;
    let L = this.fl[name];
    if (!L) { const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.sfxG); L = this.fl[name] = { g, s: AudioFiles.loopSrc(name, g) }; }
    const t = this.ctx.currentTime;
    L.g.gain.setTargetAtTime(v, t, 0.15);
    if (rate) L.s.playbackRate.setTargetAtTime(rate, t, 0.08);
    return true;
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
    // the file for it (the survivor's voice by the character's sex; an attack is a snarl)
    const fem = G.player && G.player.look && G.player.look.female;
    const fn = name === 'hurt' || name === 'shout' ? name + (fem ? 'F' : 'M') : name === 'zattack' ? (Math.random() < 0.5 ? 'snarlM' : 'snarlF') : name === 'cardoor' ? 'carDoorClose' : name;
    if (AudioFiles.play(fn, G_, pan)) return;
    if (SfxBank.play(name, G_, pan)) return;
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
      case 'pistol45': case 'magnum': this.gun(t, G_, pan, 1.2); break;
      case 'rifle': this.gun(t, G_, pan, 1.4); break;
      case 'shotgun': this.gun(t, G_, pan, 1.8); break;
      case 'dryfire': this.tn(t, 0.02, 'square', 2200, 1800, 0.2, pan); break;
      case 'reload': for (let k = 0; k < 3; k++) this.tn(t + k * 0.12, 0.03, 'square', 1600 - k * 300, 1200, 0.15, pan); break;
      case 'shellin': this.tn(t, 0.04, 'square', 1200, 900, 0.15, pan); break;
      // a spent brass case on the floor; a plastic shotgun hull; working a pump and a bolt
      case 'casing': this.tn(t, 0.05, 'sine', r(4800, 5600), 5000, 0.05 * G_, pan); this.tn(t + r(0.05, 0.08), 0.04, 'sine', r(4200, 5000), 4400, 0.03 * G_, pan); break;
      case 'shellDrop': this.nz(t, 0.05, 'bandpass', 1500, 1.5, 0.12 * G_, pan); this.tn(t, 0.04, 'sine', 900, 600, 0.06 * G_, pan); break;
      case 'pump': this.nz(t, 0.06, 'bandpass', 1100, 2, 0.3 * G_, pan); this.nz(t + 0.15, 0.05, 'bandpass', 1700, 2, 0.35 * G_, pan); break;
      case 'bolt': this.tn(t, 0.03, 'square', 900, 700, 0.12 * G_, pan); this.nz(t + 0.1, 0.06, 'bandpass', 2200, 2, 0.2 * G_, pan); this.tn(t + 0.24, 0.03, 'square', 1100, 900, 0.14 * G_, pan); break;
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
      case 'zattack': if (!SfxBank.play(Math.random() < 0.5 ? 'snarlM' : 'snarlF', G_, pan)) this.groanAt(t, 0.45, r(110, 150), 0.22 * G_, pan, true); break;
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
    const vn = (aggressive && Math.random() < 0.5 ? 'snarl' : 'groan') + (z.female ? 'F' : 'M');
    if (AudioFiles.play(vn, sp.g * (aggressive ? 1.15 : 0.9), sp.pan)) return;
    if (SfxBank.play(vn, sp.g * (aggressive ? 1.15 : 0.9), sp.pan)) return;
    this.groanAt(this.ctx.currentTime, Math.random() * 0.8 + (aggressive ? 0.6 : 1.0), (z.female ? 110 : 75) + Math.random() * 25, (aggressive ? 0.28 : 0.16) * sp.g, sp.pan, aggressive && Math.random() < 0.5);
  },
  footstep(fl, mode, sneak) {
    if (!this.on || G.speed > 5) return;
    const t = this.ctx.currentTime;
    const loud = (mode === 'sprint' ? 0.22 : mode === 'run' ? 0.17 : 0.1) * (sneak ? 0.45 : 1);
    const p = G.player, snow = Season.snow > 0.3 && p && World.room(Math.floor(p.x), Math.floor(p.y)) < 0;
    const surf = snow ? 'snow' : fl === FL.GRASS || fl === FL.GRASS2 || fl === FL.FOREST || fl === FL.FURROW ? 'grass' : fl === FL.WOOD ? 'wood' : fl === FL.DIRT || fl === FL.SAND || fl === FL.GRAVEL ? 'gravel' : fl === FL.CARPET ? 'carpet' : 'hard';
    if (AudioFiles.play('st_' + surf, loud * 4.5, 0, mode === 'sprint' ? 1.06 : 1)) return;
    if (SfxBank.play('st_' + surf, loud * 4.5, 0, mode === 'sprint' ? 1.06 : 1)) return;
    if (fl === FL.GRASS || fl === FL.GRASS2 || fl === FL.FOREST || fl === FL.FURROW) this.nz(t, 0.09, 'bandpass', 1800, 0.8, loud * 0.8, 0, { a: 0.01 });
    else if (fl === FL.WOOD) { this.nz(t, 0.06, 'lowpass', 900, 1, loud, 0); this.tn(t, 0.05, 'sine', 160, 90, loud * 0.8, 0); }
    else if (fl === FL.DIRT || fl === FL.SAND || fl === FL.GRAVEL) this.nz(t, 0.1, 'bandpass', 1200, 0.7, loud, 0);
    else if (fl === FL.CARPET) this.nz(t, 0.05, 'lowpass', 500, 1, loud * 0.6, 0);
    else this.nz(t, 0.05, 'bandpass', 2600, 1.2, loud, 0);
  },
  rain(level, indoor) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const cold = typeof Season !== 'undefined' && (Season.tree === 'b' || Season.snow > 0.3), wind = 0.06 + level * 0.12 + (cold ? 0.07 : 0);
    if (this.fileLoop('rain', level * (indoor ? 0.25 : 0.7))) this.rainSrc.g.gain.setTargetAtTime(0, t, 0.5);
    else { this.rainSrc.g.gain.setTargetAtTime(level * (indoor ? 0.12 : 0.3), t, 0.5); this.rainSrc.fl.frequency.setTargetAtTime(indoor ? 900 : 3500, t, 0.5); }
    if (this.fileLoop('wind', wind * 2.2)) this.windSrc.g.gain.setTargetAtTime(0, t, 1);
    else this.windSrc.g.gain.setTargetAtTime(wind, t, 1);
  },
  // roar and crackle of nearby fires (level: summed intensity nearby)
  fire(level) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    const g = Math.min(0.5, level * 0.035);
    if (this.fileLoop('fire', Math.min(0.9, level * 0.07))) { this.fireSrc.g.gain.setTargetAtTime(0, t, 0.4); return; }
    this.fireSrc.g.gain.setTargetAtTime(g, t, 0.4);
    if (level > 0.2 && Math.random() < Math.min(0.6, level * 0.05)) {
      const n = 1 + (Math.random() * 3 | 0);
      for (let k = 0; k < n; k++) this.nz(t + Math.random() * 0.2, 0.02 + Math.random() * 0.03, 'highpass', 1800 + Math.random() * 2500, 1, Math.min(0.25, 0.04 + level * 0.01), Math.random() * 1.2 - 0.6);
    }
  },
  flies(level) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    if (this.fileLoop('flies', Math.min(0.35, level * 0.08))) { this.flySrc.g.gain.setTargetAtTime(0, t, 0.5); return; }
    this.flySrc.g.gain.setTargetAtTime(Math.min(0.09, level * 0.02), t, 0.5);
    this.flySrc.fl.frequency.setTargetAtTime(480 + Math.random() * 120, t, 0.2);
  },
  // engine note of the car the player drives: rpm 0.15 idle .. 1 redline, th throttle 0/1
  engine(car, rpm, th) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    if (!car) { if (this.eng) { this.eng.g.gain.setTargetAtTime(0, t, 0.12); this.eng.ng.gain.setTargetAtTime(0, t, 0.12); } this.fileLoop('engine', 0); return; }
    // the engine loop file, pitched with the revs
    if (AudioFiles.loops.engine || (AudioFiles.mode === 'el' && AUDIO_LIST.loops.engine)) {
      const P = car.parts || {}, cr = !car.engine, r2 = rpm === undefined ? 0.2 + Math.min(0.8, Math.abs(car.v || 0) / 18) : rpm;
      const loud = P.muffler !== undefined && P.muffler < 30 ? 1.4 : 1, T = (typeof CAR_TYPES !== 'undefined' && CAR_TYPES[car.type]) || {};
      if (this.fileLoop('engine', Math.min(0.9, (cr ? 0.25 : 0.32 + r2 * 0.35 + (th ? 0.12 : 0)) * loud), (cr ? 0.35 : 0.55 + r2 * 1.5) * (T.pitch || 1))) return;
    }
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
    if (this.fileLoop('screech', Math.min(0.8, (level || 0) * sp.g), 0.9 + (level || 0) * 0.25)) { this.scr.g.gain.setTargetAtTime(0, t, 0.1); return; }
    this.scr.g.gain.setTargetAtTime(Math.min(0.5, (level || 0) * 0.5 * sp.g), t, level > 0 ? 0.04 : 0.12);
    if (level > 0) this.scr.fl.frequency.setTargetAtTime(1500 + level * 500, t, 0.1);
  },
  // two-tone wail of the nearest active siren
  siren(c) {
    if (!this.on) return;
    const ctx = this.ctx;
    if (!c) { if (this.sir) this.sir.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); this.fileLoop('siren', 0); return; }
    { const p = G.player, sp = p && p.inCar === c ? { g: 1 } : this.spatial(c.x, c.y, 120); if (this.fileLoop('siren', 0.4 * sp.g + 0.02)) return; }
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
    if (!h) { if (this.hel) this.hel.g.gain.setTargetAtTime(0, c.currentTime, 0.5); this.fileLoop('heli', 0); return; }
    if (this.fileLoop('heli', 0.8 * this.spatial(h.x, h.y, 110).g + 0.02)) return;
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
    const fk = { gunshots: 'distantGun', scream: 'distantScream', crash: 'distantCrash', dog: 'distantDog' }[kind];
    if (fk && AudioFiles.play(fk, Math.max(0.15, sp.g), sp.pan)) return;
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
  t: 0, nextPhrase: 3, tension: 0, ambT: 0, piano: {}, pianoBusy: {}, inFlight: 0, piece: null,
  init() {
    const c = Sfx.ctx;
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
    // the first piece a little after the start; the piano warms up meanwhile (not needed with the music files)
    this.nextPhrase = this.t + 4;
    if (!this.files()) for (const m of [45, 48, 52, 57, 60, 64, 69]) this.pianoNote(m);
  },
  // ------------------------------------------------------------------ the music files (audio/music)
  files() { return typeof AUDIO_LIST !== 'undefined' && !!AudioFiles.mode && Object.keys(AUDIO_LIST.music).length > 0; },
  // the track for now: a title piece on the menus; in play the rain, night, dusk or day pieces (the winter ones on cold
  // days), one of the mood's at random and not the one just played. A mood is every file named after it: day1, day2 ...
  moodTrack() {
    const all = typeof AUDIO_LIST !== 'undefined' ? Object.keys(AUDIO_LIST.music) : [];
    const ok = (mood) => all.filter(n => n.replace(/\d+$/, '') === mood && AudioFiles.hasMusic(n));
    let L;
    if (G.mode !== 'play') L = ok('title');
    else {
      const h = Game.hour(), rain = G.weather && G.weather.rain > 0.4, night = G.light.amb < 0.35, winter = Season.tree === 'b' || Season.snow > 0.3;
      L = rain ? ok('rain') : night ? ok('night') : winter && R.chance(0.7) ? ok('winter') : h >= 17 && h < 21 ? ok('dusk') : ok('day');
      if (!L.length) L = ok('day');
    }
    if (!L.length) L = ok('title');
    if (L.length > 1) L = L.filter(n => n !== this.lastTrack);
    return L.length ? (this.lastTrack = L[(Math.random() * L.length) | 0]) : null;
  },
  async startTrack(name, lvl) {
    this.cur = name; this.curLvl = lvl || 0.8; this.trackEnd = null;
    if (AudioFiles.mode === 'el') {
      const a = AudioFiles.el('music', name, false);
      try { a.currentTime = 0; } catch (e) { /* not loaded yet */ }
      a.onended = () => { if (this.curEl === a) { this.curEl = null; this.cur = null; this.trackEnd = this.t; } };
      this.curEl = a; AudioFiles.elLevel('music', name, this.curLvl);
      return;
    }
    let b;
    try { b = await AudioFiles.track(name); } catch (e) { AudioFiles.failed.add('music/' + name); this.cur = null; return; }
    if (this.cur !== name) return;
    const c = Sfx.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; g.gain.value = this.curLvl; s.connect(g); g.connect(Sfx.musG); s.start();
    s.onended = () => { if (this.src === s) { this.src = null; this.cur = null; this.trackEnd = this.t; } };
    this.src = s; this.srcG = g;
  },
  stopTrack(fade) {
    fade = fade || 1;
    if (this.src) { const t = Sfx.ctx.currentTime; this.srcG.gain.setTargetAtTime(0, t, fade); this.src.stop(t + fade * 5); this.src = null; }
    if (this.curEl) { const a = this.curEl; this.curEl = null; a.pause(); }
    this.cur = null;
  },
  // the chase: a tension loop rises with it (and the calm track ducks under it); after a quiet spell the loop is let go,
  // and the next chase picks one of the tension pieces afresh
  tensName() {
    const L = typeof AUDIO_LIST !== 'undefined' ? Object.keys(AUDIO_LIST.music).filter(n => /^tension\d*$/.test(n) && AudioFiles.hasMusic(n)) : [];
    return L.length ? L[(Math.random() * L.length) | 0] : null;
  },
  async tensionFile(v) {
    if (v > 0.02) this.tensQuiet = this.t; else if (this.tensN && !this.tensBusy && this.t - (this.tensQuiet || 0) > 25) { if (this.tens) try { this.tens.s.stop(); } catch (e) { /* stopped */ } this.tens = null; this.tensN = null; }
    if (!this.tensN) { if (v < 0.05) return true; this.tensN = this.tensName(); if (!this.tensN) return false; }
    const name = this.tensN;
    if (AudioFiles.mode === 'el') {
      for (const k of Object.keys(AudioFiles.els || {})) if (/^music\/tension/.test(k) && k !== 'music/' + name && !AudioFiles.els[k].paused) AudioFiles.els[k].pause();
      const a = AudioFiles.el('music', name, true); a.loop = true; AudioFiles.elLevel('music', name, v * 0.85); if (v <= 0.01 && !a.paused) a.pause(); return true;
    }
    if (!this.tens) {
      if (this.tensBusy || v < 0.05) return true;
      this.tensBusy = true;
      try {
        const r = await fetch(AudioFiles.url('music', name)), b = await Sfx.ctx.decodeAudioData(await r.arrayBuffer());
        const c = Sfx.ctx, g = c.createGain(); g.gain.value = 0; g.connect(Sfx.musG);
        const s = c.createBufferSource(); s.buffer = b; s.loop = true; if (b.duration > 2) { s.loopStart = 0.08; s.loopEnd = b.duration - 0.42; } s.connect(g); s.start();
        this.tens = { g, s };
      } catch (e) { AudioFiles.failed.add('music/' + name); this.tensN = null; }
      this.tensBusy = false;
      return true;
    }
    this.tens.g.gain.setTargetAtTime(v * 0.85, Sfx.ctx.currentTime, 0.6);
    return true;
  },
  fileUpdate(dt) {
    const p = G.player, menu = G.mode !== 'play';
    // a change between the menus and play: what is on fades and the right music follows
    if (menu !== this.wasMenu) { this.wasMenu = menu; this.stopTrack(1.2); this.nextPhrase = this.t + (menu ? 1 : 15); }
    if (this.trackEnd !== null && this.trackEnd !== undefined) { this.nextPhrase = this.t + (menu ? R.f(4, 8) : R.f(40, 120)); this.trackEnd = null; }
    const calm = this.tension < 0.4 && !(p && p.asleep);
    if (!this.cur && this.t > this.nextPhrase && calm) { const n = this.moodTrack(); if (n) this.startTrack(n); else this.nextPhrase = this.t + 30; }
    if (this.srcG) this.srcG.gain.setTargetAtTime((this.curLvl || 0.8) * (1 - this.tension * 0.75), Sfx.ctx.currentTime, 0.8);
    else if (this.curEl) AudioFiles.elLevel('music', this.cur, (this.curLvl || 0.8) * (1 - this.tension * 0.75));
    return this.tensionFile(this.tension);
  },
  // ------------------------------------------------------------------ instruments
  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  // a piano note (midi m), rendered once in the background: partials a little sharp of harmonic, each dying away
  // at its own rate (the high ones first, in two stages), a felt hammer knock at the start, the two strings of a
  // note a hair apart left and right
  pianoNote(m) {
    if (this.piano[m] || this.pianoBusy[m] || typeof OfflineAudioContext === 'undefined') return this.piano[m] || null;
    // three at a time: setting up a note's graph is main-thread work, and a piece asks for thirty at once
    if (this.inFlight >= 3) return null;
    this.pianoBusy[m] = true; this.inFlight++;
    const sr = Sfx.ctx.sampleRate, f = this.hz(m), dur = U.clamp(5.5 - (m - 40) * 0.06, 2.5, 5.5);
    const o = new OfflineAudioContext(2, Math.ceil(sr * dur), sr), out = o.createGain(); out.connect(o.destination);
    const tau0 = U.clamp(2.6 * Math.pow(261.6 / f, 0.5), 0.6, 4.2), B = 0.00035, P = Math.max(3, Math.min(12, Math.floor(7000 / f)));
    for (let k = 1; k <= P; k++) {
      const fk = k * f * Math.sqrt(1 + B * k * k), amp = 0.5 / Math.pow(k, 1.25) * (k === 2 ? 1.2 : 1), tau = tau0 / (1 + 0.55 * (k - 1));
      for (const [ch, det] of [[0, 0.9994], [1, 1.0006]]) {
        const os = o.createOscillator(); os.frequency.value = fk * det;
        const g = o.createGain(), gp = g.gain;
        gp.setValueAtTime(0, 0); gp.linearRampToValueAtTime(amp, 0.004);
        gp.setTargetAtTime(amp * 0.35, 0.004, tau * 0.12); gp.setTargetAtTime(0, 0.25, tau);
        const mg = o.createChannelMerger(2);
        os.connect(g); g.connect(mg, 0, ch); mg.connect(out);
        os.start(0); os.stop(dur);
      }
    }
    // the hammer
    const nb = o.createBuffer(1, Math.ceil(sr * 0.03), sr), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.006));
    const ns = o.createBufferSource(); ns.buffer = nb; const nf = o.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = Math.min(4000, f * 6); const ng = o.createGain(); ng.gain.value = 0.18;
    ns.connect(nf); nf.connect(ng); ng.connect(out); ns.start(0);
    o.startRendering().then(buf => {
      // fade the end of the buffer
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch), F = Math.min(d.length, 2048); for (let i = 0; i < F; i++) d[d.length - 1 - i] *= i / F; }
      this.piano[m] = buf;
    }).catch(() => {}).finally(() => { this.pianoBusy[m] = false; this.inFlight--; });
    return null;
  },
  // play midi note m at time t (gain, pan); a note not rendered yet asks for it and is left out this time
  key(m, t, gain, pan) {
    const buf = this.pianoNote(m);
    if (!buf) return;
    const c = Sfx.ctx, s = c.createBufferSource(); s.buffer = buf;
    const g = c.createGain(); g.gain.value = gain;
    s.connect(g);
    let o = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); o = p; }
    o.connect(Sfx.musG); const vg = c.createGain(); vg.gain.value = 0.55; o.connect(vg); vg.connect(Sfx.verb);
    s.start(t);
  },
  // a soft string pad under a chord: three detuned saws through a slow filter, swelling in and out
  pad(ms, t, dur, gain) {
    const c = Sfx.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(600, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(2.5, dur * 0.4)); g.gain.setValueAtTime(gain, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
    lp.connect(g); g.connect(Sfx.musG); g.connect(Sfx.verb);
    for (const m of ms) for (const det of [-0.006, 0, 0.006]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.hz(m) * (1 + det);
      const og = c.createGain(); og.gain.value = 0.25 / ms.length;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 1.6);
    }
  },
  // ------------------------------------------------------------------ pieces
  // key (tonic midi), scale, tempo, chords (scale degrees, from 0), the left hand's pattern (chord tone indices:
  // 0 root, 1 third, 2 fifth, 3 octave; beats per note) and how busy the melody is
  PIECES: {
    title: { tonic: 57, minor: true, bpm: 70, prog: [0, 5, 2, 6, 0, 5, 3, 4], lh: [[0, 2, 3, 2], 1], mel: 0.75, pad: 0.05 },
    day: { tonic: 60, minor: false, bpm: 66, prog: [0, 4, 5, 3, 0, 3, 4, 0], lh: [[0, 2, 3, 1], 1], mel: 0.6, pad: 0.035 },
    dusk: { tonic: 57, minor: true, bpm: 62, prog: [0, 3, 6, 2, 5, 3, 4, 0], lh: [[0, 2, 3, 2, 1, 2], 2 / 3], mel: 0.5, pad: 0.04 },
    night: { tonic: 50, minor: true, bpm: 52, prog: [0, 5, 3, 4, 0, 5, 6, 0], lh: [[0, 3], 2], mel: 0.3, pad: 0.06 },
    rain: { tonic: 52, minor: true, bpm: 58, prog: [0, 3, 6, 2, 0, 3, 4, 0], lh: [[3, 2, 1, 0], 1], mel: 0.45, pad: 0.05 },
  },
  scale(P) { return P.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]; },
  // midi of scale degree d (any integer) in the piece's key, around octave o
  deg(P, d, o) { const S = this.scale(P), q = Math.floor(d / 7); return P.tonic + (o || 0) * 12 + q * 12 + S[((d % 7) + 7) % 7]; },
  // a whole piece, scheduled from t: the eight-bar progression twice, the left hand under a melody built from a
  // motif (stated, answered, varied, brought home to the tonic; the second time round varied again and an octave
  // up in its middle); returns its length in seconds
  // every note a piece can use rendered yet (asks for those that are not)
  ready(name) {
    const P = this.PIECES[name];
    let ok = true;
    for (let d = 0; d <= 14; d++) if (!this.pianoNote(this.deg(P, d, -1))) ok = false;
    for (let d = 7; d <= 25; d++) if (!this.pianoNote(this.deg(P, d, 0))) ok = false;
    return ok;
  },
  play(name, t) {
    const P = this.PIECES[name], beat = 60 / P.bpm, bar = beat * 4, rng = new RNG((Math.random() * 1e9) | 0);
    // the motif: rhythm (beats) and scale steps from the chord root
    const RH = [[1, 1, 2], [2, 1, 1], [1.5, 0.5, 2], [1, 1, 1, 1], [3, 1], [2, 2]];
    const rhythm = rng.pick(RH), steps = rhythm.map((_, i) => i === 0 ? rng.pick([0, 2, 4]) : rng.pick([-1, 1, 2, -2, 0, 4]));
    const N = P.prog.length;
    for (let bb = 0; bb < N * 2; bb++) {
      const b = bb % N, second = bb >= N, tb = t + bb * bar, d = P.prog[b], last = bb === N * 2 - 1;
      const tones = [this.deg(P, d, -1), this.deg(P, d + 2, -1), this.deg(P, d + 4, -1), this.deg(P, d, 0)];
      // left hand
      const [pat, per] = P.lh;
      let k = 0;
      for (let x = 0; x < 4 - 1e-6; x += per, k++) this.key(tones[pat[k % pat.length]], tb + x * beat + rng.f(0, 0.015), (x === 0 ? 0.32 : 0.22) * (last && x > 0 ? 0.6 : 1), -0.25);
      if (P.pad) this.pad([tones[0] + 12, tones[1] + 12, tones[2] + 12], tb, bar, P.pad);
      // the melody: the motif on bars 0, 2, 4 (varied), an answer on 1, 3, 5; 6 rises, 7 comes home
      if (last) { this.key(this.deg(P, 0, 1), tb, 0.3, 0.2); continue; }
      if (b === N - 1) continue;
      if (rng.next() > P.mel && b % 2) continue;
      let x = 0, base = d + 7 + (second && b >= 2 && b <= 5 ? 7 : 0);
      const vary = b >= 4 || second ? rng.pick([0, 1, -1]) : 0, answer = b % 2 === 1;
      rhythm.forEach((len, i) => {
        let st = steps[i] + vary;
        if (answer) st = i === rhythm.length - 1 ? 0 : -steps[i] + 2;
        if (b === 6 && i === rhythm.length - 1) st = 4;
        this.key(this.deg(P, base + st, 0), tb + x * beat + rng.f(0, 0.02), (i === 0 ? 0.3 : 0.24), 0.2);
        x += len;
      });
    }
    return N * 2 * bar + 3;
  },
  // which piece suits the moment
  choose() {
    if (G.mode !== 'play') return 'title';
    const h = (G.time / 60) % 24, rain = G.weather && G.weather.rain > 0.4;
    if (rain) return 'rain';
    if (h >= 21 || h < 5) return 'night';
    if (h >= 18) return 'dusk';
    return R.chance(0.5) ? 'day' : 'dusk';
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
    if (this.files()) {
      // the music files instead of the generated pieces (and the tension loop instead of the drone)
      if (AudioFiles.hasMusic('tension')) { this.drone.g.gain.setTargetAtTime(0, c.currentTime, 0.3); this.drone.tg.gain.setTargetAtTime(0, c.currentTime, 0.3); }
      this.fileUpdate(dt);
    } else if (this.t > this.nextPhrase) {
      const name = this.piece || (this.piece = this.choose());
      if (this.tension >= 0.4 || (p && p.asleep)) this.nextPhrase = this.t + 5;
      else if (!this.ready(name)) this.nextPhrase = this.t + 0.5;
      else { const len = this.play(name, c.currentTime + 0.3); this.piece = null; this.nextPhrase = this.t + len + (G.mode === 'play' ? R.f(60, 150) : R.f(8, 15)); }
    }
    if (G.mode !== 'play') return;
    // the ambience beds (files): birdsong by day, crickets on warm nights, outdoors and out of the rain
    const outside = p && World.outdoor(p.x, p.y) && G.weather.rain < 0.3, warm = Season.tree !== 'b' && Season.snow < 0.3;
    const bedD = Sfx.fileLoop('day', outside && warm && G.light.amb > 0.6 ? 0.35 : 0), bedN = Sfx.fileLoop('night', outside && warm && G.light.amb < 0.3 && G.weather.temp > 8 ? 0.3 : 0);
    // ambience follows the season: songbirds in spring and summer, cicadas on hot days,
    // crickets on warm nights, crows and owls through the cold months
    this.ambT -= dt;
    if (this.ambT <= 0 && G.mode === 'play' && p && World.outdoor(p.x, p.y) && G.weather.rain < 0.3 && !(bedD && bedN)) {
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
    if (this.files() && AudioFiles.hasMusic('death')) { this.stopTrack(0.4); this.tensionFile(0); this.startTrack('death', 0.9); this.nextPhrase = this.t + 40; return; }
    const t = Sfx.ctx.currentTime + 0.5;
    [45, 52, 57, 60].forEach((m, k) => this.key(m, t + k * 0.5, 0.4, 0));
    [53, 60, 57].forEach((m, k) => this.key(m, t + 3 + k * 0.6, 0.35, 0));
    this.pad([45, 52, 60], t, 6, 0.05);
    this.nextPhrase = this.t + 40;
  },
};
