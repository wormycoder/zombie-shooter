'use strict';
// ---------------------------------------------------------------------------
// Rendered sound clips: richer recipes than the live synthesis in audio.js, rendered once in the background (an
// OfflineAudioContext per clip, a few variations of each), normalised, then played like recorded samples with a
// little pitch and level variation. Until a clip is ready (or where none was made) Sfx falls back to live synthesis.
// Recipes build node graphs on the offline context; t is always 0 at the start of the clip.
// ---------------------------------------------------------------------------
const SfxBank = {
  clips: {}, ready: false, busy: false,
  // play level of each clip (its peak is normalised to 1) and whether it goes to the reverb
  LEVEL: {
    pistol: 0.85, pistol45: 0.9, magnum: 1.0, rifle: 1.0, shotgun: 1.0,
    hitBlunt: 0.6, hitBlade: 0.5, hitFlesh: 0.45, stomp: 0.65, thud: 0.55, zfall: 0.5,
    doorOpen: 0.22, doorClose: 0.5, glass: 0.55, window: 0.25,
    groanM: 0.3, groanF: 0.28, snarlM: 0.36, snarlF: 0.34,
    st_hard: 0.22, st_grass: 0.2, st_gravel: 0.22, st_wood: 0.24, st_carpet: 0.14, st_snow: 0.22,
  },
  VERB: { pistol: 0.5, pistol45: 0.5, magnum: 0.55, rifle: 0.6, shotgun: 0.6, glass: 0.3, groanM: 0.35, groanF: 0.35, snarlM: 0.3, snarlF: 0.3, doorClose: 0.25 },

  // ------------------------------------------------------------------ building
  async build(ctx) {
    if (this.busy || this.ready || typeof OfflineAudioContext === 'undefined') return;
    this.busy = true;
    const sr = ctx.sampleRate, R0 = new RNG(1993);
    const jobs = [];
    const add = (name, n, len, fn) => { for (let v = 0; v < n; v++) jobs.push([name, len, fn, v]); };
    add('pistol', 3, 1.3, (o, d, r) => this.gun(o, d, r, { crack: 1, bodyF: 1500, body: 0.07, th0: 170, thd: 0.12, tail: 0.9, tailF: 750, echo: [0.11, 0.27], mech: 1 }));
    add('pistol45', 3, 1.4, (o, d, r) => this.gun(o, d, r, { crack: 0.9, bodyF: 1150, body: 0.09, th0: 150, thd: 0.16, tail: 1.0, tailF: 650, echo: [0.12, 0.29], mech: 1 }));
    add('magnum', 3, 1.7, (o, d, r) => this.gun(o, d, r, { crack: 1.2, bodyF: 1250, body: 0.1, th0: 140, thd: 0.2, tail: 1.3, tailF: 700, echo: [0.13, 0.33] }));
    add('rifle', 3, 2.0, (o, d, r) => this.gun(o, d, r, { crack: 1.3, bodyF: 1000, body: 0.1, th0: 130, thd: 0.2, tail: 1.6, tailF: 560, echo: [0.15, 0.42] }));
    add('shotgun', 3, 2.0, (o, d, r) => this.gun(o, d, r, { crack: 0.85, bodyF: 650, body: 0.15, th0: 110, thd: 0.26, tail: 1.6, tailF: 450, echo: [0.16, 0.44] }));
    add('hitBlunt', 4, 0.4, (o, d, r) => this.hit(o, d, r, 'blunt'));
    add('hitBlade', 4, 0.4, (o, d, r) => this.hit(o, d, r, 'blade'));
    add('hitFlesh', 3, 0.35, (o, d, r) => this.hit(o, d, r, 'flesh'));
    add('stomp', 3, 0.45, (o, d, r) => this.hit(o, d, r, 'stomp'));
    add('thud', 3, 0.4, (o, d, r) => this.hit(o, d, r, 'thud'));
    add('zfall', 3, 0.5, (o, d, r) => this.hit(o, d, r, 'fall'));
    add('doorOpen', 3, 1.0, (o, d, r) => this.creak(o, d, r, 0.7));
    add('doorClose', 3, 0.7, (o, d, r) => this.slam(o, d, r));
    add('window', 2, 0.8, (o, d, r) => this.creak(o, d, r, 0.55, true));
    add('glass', 3, 1.4, (o, d, r) => this.shatter(o, d, r));
    for (const [name, f0, snarl] of [['groanM', 82, false], ['groanF', 125, false], ['snarlM', 120, true], ['snarlF', 165, true]]) add(name, 5, snarl ? 1.0 : 2.4, (o, d, r) => this.voice(o, d, r, f0, snarl));
    for (const s of ['hard', 'grass', 'gravel', 'wood', 'carpet', 'snow']) add('st_' + s, 4, 0.25, (o, d, r) => this.step(o, d, r, s));
    // render a few at a time between frames
    for (let i = 0; i < jobs.length; i += 4) {
      await Promise.all(jobs.slice(i, i + 4).map(async ([name, len, fn, v]) => {
        try {
          const oc = new OfflineAudioContext(1, Math.ceil(len * sr), sr), r = new RNG(R0.int(1, 1e9) + v);
          const bus = oc.createGain(); bus.connect(oc.destination);
          fn(oc, bus, r);
          const buf = await oc.startRendering();
          this.norm(buf);
          (this.clips[name] || (this.clips[name] = [])).push(buf);
        } catch (e) { console.warn('sfx clip', name, e); }
      }));
      await new Promise(res => setTimeout(res, 0));
    }
    this.ready = true; this.busy = false;
  },
  // peak to 0.95, and a short fade so nothing clicks at the end
  norm(buf) {
    const d = buf.getChannelData(0);
    let pk = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    const k = pk > 1e-6 ? 0.95 / pk : 1, fade = Math.min(d.length, 512);
    for (let i = 0; i < d.length; i++) d[i] *= k;
    for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
  },

  // ------------------------------------------------------------------ playing
  // name: a clip name; g: level 0..1 (distance), pan; returns false when there is no clip of that name
  play(name, g, pan, rate) {
    const L = this.clips[name];
    if (!L || !L.length || !Sfx.on) return false;
    const c = Sfx.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = L[(Math.random() * L.length) | 0];
    s.playbackRate.value = (rate || 1) * (0.96 + Math.random() * 0.08);
    const gn = c.createGain(); gn.gain.value = (this.LEVEL[name] || 0.5) * g * (0.9 + Math.random() * 0.15);
    s.connect(gn);
    let out = gn;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan || 0; gn.connect(p); out = p; }
    out.connect(Sfx.sfxG);
    const vb = this.VERB[name];
    if (vb) { const vg = c.createGain(); vg.gain.value = vb; out.connect(vg); vg.connect(Sfx.sfxVerb); }
    s.start(t);
    return true;
  },

  // ------------------------------------------------------------------ recipe helpers (offline context o)
  noiseOf(o, brown) {
    const key = brown ? '_b' : '_w';
    if (o[key]) return o[key];
    const n = Math.min(o.length, Math.ceil(o.sampleRate * 2.5)), b = o.createBuffer(1, n, o.sampleRate), a = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; a[i] = last * 3.5; } else a[i] = w; }
    return (o[key] = b);
  },
  // gain envelope: attack a to peak at t0, exponential decay with time constant tau; never cut before it has died
  // away (-60 dB), or the cut clicks
  end(a, tau, dur) { return Math.max(dur || 0, a + tau * 7); },
  env(o, t0, a, peak, tau, dur) {
    const g = o.createGain(), p = g.gain;
    p.setValueAtTime(0, 0); p.setValueAtTime(0, t0); p.linearRampToValueAtTime(peak, t0 + a);
    p.setTargetAtTime(0, t0 + a, tau);
    return g;
  },
  // filtered noise burst into d
  burst(o, d, t0, type, f, q, peak, a, tau, dur, opt) {
    opt = opt || {};
    const s = o.createBufferSource(); s.buffer = this.noiseOf(o, opt.brown); s.loop = true; s.playbackRate.value = opt.rate || 1;
    const fl = o.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
    if (opt.f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, opt.f1), t0 + (opt.ft || dur || tau * 5));
    const g = this.env(o, t0, a, peak, tau, dur);
    s.connect(fl); fl.connect(g); g.connect(opt.to || d);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + this.end(a, tau, dur) + 0.02);
    return g;
  },
  // a tone: type, f0 -> f1 over sweep seconds
  tone(o, d, t0, type, f0, f1, sweep, peak, a, tau, dur, to) {
    const os = o.createOscillator(); os.type = type;
    os.frequency.setValueAtTime(f0, t0); if (f1 !== f0) os.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t0 + sweep);
    const g = this.env(o, t0, a, peak, tau, dur);
    os.connect(g); g.connect(to || d);
    os.start(t0); os.stop(t0 + this.end(a, tau, dur) + 0.02);
    return os;
  },
  // soft clipper (tanh) for punch and rasp
  clip(o, drive) {
    const ws = o.createWaveShaper(), n = 1024, cv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; cv[i] = Math.tanh(x * drive) / Math.tanh(drive); }
    ws.curve = cv;
    return ws;
  },

  // ------------------------------------------------------------------ recipes
  // a gunshot: the supersonic crack, the muzzle blast, a low thump through a soft clipper, the rolling tail and the
  // slap echoes off the houses round about; self-loaders with the clack of the action
  gun(o, d, r, q) {
    const pre = o.createGain(), sh = this.clip(o, 2.2);
    pre.connect(sh); sh.connect(d);
    this.burst(o, pre, 0, 'highpass', 2600, 0.7, q.crack, 0.0005, 0.004, 0.04);
    this.burst(o, pre, 0, 'bandpass', q.bodyF * r.f(0.9, 1.1), 0.8, 0.95, 0.001, q.body / 3, q.body * 3.5, { f1: q.bodyF * 0.45 });
    this.tone(o, pre, 0, 'sine', q.th0 * r.f(0.92, 1.08), 38, q.thd, 1.1, 0.002, q.thd / 2.5, q.thd * 3);
    const tail = o.createGain(); tail.connect(d);
    this.burst(o, tail, 0.01, 'lowpass', q.tailF, 0.7, 0.32, 0.02, q.tail / 4, q.tail, { brown: true, f1: 180, ft: q.tail });
    // echoes: the blast again, later, duller and quieter
    for (const [k, e] of q.echo.entries()) {
      const dl = o.createDelay(1); dl.delayTime.value = e * r.f(0.85, 1.2);
      const lp = o.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400 - k * 500;
      const eg = o.createGain(); eg.gain.value = (k ? 0.12 : 0.24) * r.f(0.8, 1.2);
      pre.connect(dl); dl.connect(lp); lp.connect(eg); eg.connect(d);
    }
    if (q.mech) for (const [t0, f] of [[0.028, 2900], [0.034, 4700]]) this.tone(o, d, t0 + r.f(0, 0.004), 'triangle', f * r.f(0.95, 1.05), f * 0.9, 0.02, 0.12, 0.0005, 0.008, 0.05);
  },
  // melee and falls
  hit(o, d, r, kind) {
    const v = r.f(0.9, 1.1);
    if (kind === 'blunt') {
      this.tone(o, d, 0, 'sine', 130 * v, 48, 0.12, 1, 0.002, 0.05, 0.25);
      this.burst(o, d, 0, 'bandpass', 420 * v, 1.2, 0.7, 0.001, 0.025, 0.12);
      for (let k = 0; k < 5; k++) this.burst(o, d, r.f(0.004, 0.05), 'bandpass', r.f(1200, 3200), 2, r.f(0.15, 0.35), 0.0005, 0.006, 0.03);
      this.burst(o, d, 0.005, 'lowpass', 1100, 0.7, 0.35, 0.002, 0.04, 0.15);
    } else if (kind === 'blade') {
      this.burst(o, d, 0, 'bandpass', 5200 * v, 1.5, 0.55, 0.002, 0.03, 0.1, { f1: 1800 });
      this.tone(o, d, 0.01, 'sine', 110 * v, 50, 0.1, 0.6, 0.002, 0.04, 0.2);
      this.wet(o, d, r, 0.02, 0.55);
    } else if (kind === 'flesh') {
      this.burst(o, d, 0, 'lowpass', 900 * v, 0.8, 0.8, 0.001, 0.03, 0.12);
      this.tone(o, d, 0, 'sine', 100 * v, 50, 0.08, 0.6, 0.002, 0.04, 0.15);
      this.wet(o, d, r, 0.015, 0.5);
    } else if (kind === 'stomp') {
      this.tone(o, d, 0, 'sine', 80 * v, 34, 0.15, 1, 0.002, 0.06, 0.3);
      for (let k = 0; k < 9; k++) this.burst(o, d, r.f(0.002, 0.07), 'bandpass', r.f(900, 2800), 1.5, r.f(0.2, 0.5), 0.0005, 0.007, 0.03);
      this.wet(o, d, r, 0.03, 0.45);
    } else {
      // a body or a heavy thing hitting the floor (fall: a second, softer bounce)
      this.tone(o, d, 0, 'sine', 90 * v, 38, 0.15, 1, 0.003, 0.06, 0.3);
      this.burst(o, d, 0, 'lowpass', 500 * v, 0.7, 0.6, 0.002, 0.04, 0.18, { brown: true });
      if (kind === 'fall') { this.tone(o, d, 0.12, 'sine', 80 * v, 40, 0.1, 0.45, 0.003, 0.05, 0.22); this.burst(o, d, 0.12, 'lowpass', 600, 0.7, 0.3, 0.002, 0.04, 0.15); }
    }
  },
  // a wet squelch: low noise with a fast wobble in level
  wet(o, d, r, t0, peak) {
    const g = this.burst(o, d, t0, 'lowpass', r.f(500, 800), 1.5, peak, 0.004, 0.05, 0.22, { brown: true, f1: 250 });
    // (the wobble fades with the squelch, so nothing is left buzzing when it stops)
    const l = o.createOscillator(); l.frequency.value = r.f(28, 45); const lg = this.env(o, t0, 0.004, peak * 0.5, 0.05);
    l.connect(lg); lg.connect(g.gain); l.start(t0); l.stop(t0 + this.end(0.004, 0.05) + 0.02);
  },
  // a creaking hinge (or sash): stick-slip pulses through the resonances of the door
  creak(o, d, r, dur, sash) {
    const os = o.createOscillator(); os.type = 'square';
    const f0 = r.f(18, 34), curve = new Float32Array(16);
    for (let i = 0; i < 16; i++) curve[i] = f0 * (1 + 0.9 * Math.sin(i / 15 * Math.PI * r.f(0.8, 1.6) + r.f(0, 1))) + r.f(0, 8);
    os.frequency.setValueCurveAtTime(curve, 0.03, dur);
    const g = this.env(o, 0.03, dur * 0.25, 0.8, dur * 0.35, dur + 0.05), mix = o.createGain();
    os.connect(g);
    for (const [f, qq, gg] of sash ? [[700, 12, 0.6], [1500, 14, 0.35]] : [[r.f(420, 560), 18, 0.7], [r.f(1050, 1250), 20, 0.45], [r.f(2200, 2600), 22, 0.25]]) {
      const bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = qq;
      const bg = o.createGain(); bg.gain.value = gg; g.connect(bp); bp.connect(bg); bg.connect(mix);
    }
    mix.connect(d);
    os.start(0.03); os.stop(dur + 0.1);
    // the latch going
    this.tone(o, d, 0, 'triangle', 1800, 1500, 0.02, 0.25, 0.0005, 0.008, 0.04);
    if (sash) this.burst(o, d, 0, 'bandpass', 900, 1, 0.3, 0.05, 0.15, dur);
  },
  // a door shut: the latch, the thud of the leaf into the frame, a rattle
  slam(o, d, r) {
    this.tone(o, d, 0, 'triangle', 1500, 1200, 0.02, 0.3, 0.0005, 0.008, 0.04);
    this.tone(o, d, 0.03, 'sine', 105 * r.f(0.9, 1.1), 48, 0.12, 1, 0.002, 0.07, 0.35);
    this.burst(o, d, 0.03, 'lowpass', 750, 0.8, 0.6, 0.002, 0.05, 0.25);
    for (let k = 0; k < 4; k++) this.burst(o, d, 0.06 + k * r.f(0.025, 0.04), 'bandpass', r.f(700, 1300), 4, 0.18 - k * 0.03, 0.001, 0.01, 0.04);
  },
  // breaking glass: the crack, the crash, and a fall of shards ringing down
  shatter(o, d, r) {
    this.burst(o, d, 0, 'highpass', 3000, 0.7, 1, 0.0005, 0.02, 0.1);
    this.burst(o, d, 0.005, 'bandpass', 4500, 0.6, 0.6, 0.002, 0.08, 0.4, { f1: 2500 });
    const n = r.int(35, 55);
    for (let k = 0; k < n; k++) {
      const t0 = Math.pow(r.next(), 1.6) * 1.0, f = r.f(2600, 9500), pk = r.f(0.05, 0.22) * (1 - t0 * 0.6);
      this.tone(o, d, t0, 'sine', f, f * r.f(0.97, 1.0), 0.05, pk, 0.0005, r.f(0.01, 0.05), 0.25);
      if (r.chance(0.5)) this.tone(o, d, t0, 'sine', f * r.f(1.6, 2.3), f * 1.9, 0.05, pk * 0.5, 0.0005, r.f(0.005, 0.02), 0.12);
    }
    this.burst(o, d, 0.02, 'lowpass', 600, 0.7, 0.25, 0.01, 0.15, 0.6, { brown: true });
  },
  // the dead: a voiced moan through mouth formants that drift from 'uh' to 'aa' and back, with a ragged, gurgling
  // throat (jittered pitch, a wobble in level, a rasp of breath); snarls are higher, shorter and harsher
  voice(o, d, r, f0, snarl) {
    const dur = snarl ? r.f(0.45, 0.8) : r.f(1.0, 2.1), F = f0 * r.f(0.85, 1.15);
    const os = o.createOscillator(); os.type = 'sawtooth';
    const n = 24, curve = new Float32Array(n);
    let w = 0;
    for (let i = 0; i < n; i++) { w += r.f(-0.05, 0.05); const k = i / (n - 1); curve[i] = F * (snarl ? 1 + 0.35 * Math.sin(k * Math.PI) : 1.1 - 0.3 * k) * (1 + w); }
    os.frequency.setValueCurveAtTime(curve, 0, dur);
    // vibrato and jitter
    const vib = o.createOscillator(); vib.frequency.value = r.f(4, 7); const vg = o.createGain(); vg.gain.value = F * r.f(0.02, 0.05);
    vib.connect(vg); vg.connect(os.frequency);
    const jit = o.createBufferSource(); jit.buffer = this.noiseOf(o); jit.loop = true; const jl = o.createBiquadFilter(); jl.type = 'lowpass'; jl.frequency.value = 40; const jg = o.createGain(); jg.gain.value = F * 0.15;
    jit.connect(jl); jl.connect(jg); jg.connect(os.frequency);
    const src = o.createGain(), sh = this.clip(o, snarl ? 4 : 2);
    os.connect(src);
    // breath through the throat
    this.burst(o, src, 0, 'bandpass', snarl ? 2000 : 1200, 0.6, snarl ? 0.5 : 0.22, dur * 0.2, dur * 0.4, dur, {});
    const amp = this.env(o, 0, dur * (snarl ? 0.15 : 0.3), 0.7, dur * 0.3, dur);
    // the gurgle: a quick, uneven wobble in level
    const gl = o.createOscillator(), gg = this.env(o, 0, dur * (snarl ? 0.15 : 0.3), snarl ? 0.3 : 0.22, dur * 0.3, dur);
    gl.frequency.value = r.f(14, 26);
    gl.connect(gg); gg.connect(amp.gain);
    src.connect(sh); sh.connect(amp);
    const bus = o.createGain(); bus.connect(d);
    const V = snarl ? [[800, 1400, 2600], [950, 1550, 2800]] : [[600, 1000, 2400], [750, 1150, 2500]];
    for (let j = 0; j < 3; j++) {
      const bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = [6, 8, 10][j];
      bp.frequency.setValueAtTime(V[0][j] * r.f(0.92, 1.08), 0); bp.frequency.linearRampToValueAtTime(V[1][j] * r.f(0.92, 1.08), dur * 0.5); bp.frequency.linearRampToValueAtTime(V[0][j], dur);
      const bg = o.createGain(); bg.gain.value = [1, 0.55, 0.25][j];
      amp.connect(bp); bp.connect(bg); bg.connect(bus);
    }
    const stop = this.end(dur * 0.3, dur * 0.3, dur) + 0.02;
    for (const x of [os, vib, gl]) { x.start(0); x.stop(stop); }
    jit.start(0, r.f(0, 1));
  },
  // a footstep: heel then toe, by what is underfoot
  step(o, d, r, s) {
    const v = r.f(0.9, 1.1), toe = r.f(0.03, 0.05);
    if (s === 'hard') {
      this.burst(o, d, 0, 'bandpass', 2000 * v, 1.1, 0.8, 0.001, 0.008, 0.05);
      this.tone(o, d, 0, 'sine', 95 * v, 60, 0.03, 0.5, 0.001, 0.012, 0.06);
      this.burst(o, d, toe, 'bandpass', 3600 * v, 0.9, 0.35, 0.004, 0.012, 0.06);
    } else if (s === 'grass') {
      this.burst(o, d, 0, 'bandpass', 2600 * v, 0.6, 0.55, 0.004, 0.02, 0.1, { f1: 1800 });
      for (let k = 0; k < 7; k++) this.burst(o, d, r.f(0, 0.07), 'highpass', r.f(3000, 6000), 1, r.f(0.1, 0.25), 0.0005, 0.004, 0.02);
      this.tone(o, d, 0, 'sine', 80, 55, 0.04, 0.3, 0.002, 0.015, 0.06);
    } else if (s === 'gravel' || s === 'snow') {
      const n = s === 'snow' ? 26 : 18;
      for (let k = 0; k < n; k++) this.burst(o, d, r.f(0, 0.09) + (k > n / 2 ? toe : 0), 'bandpass', s === 'snow' ? r.f(700, 2000) : r.f(1600, 5000), 2, r.f(0.15, 0.45), 0.0005, s === 'snow' ? 0.006 : 0.004, 0.03);
      this.tone(o, d, 0, 'sine', 85, 55, 0.04, 0.3, 0.002, 0.015, 0.06);
    } else if (s === 'wood') {
      this.tone(o, d, 0, 'sine', 135 * v, 95, 0.05, 0.8, 0.001, 0.025, 0.1);
      this.burst(o, d, 0, 'bandpass', 380 * v, 3, 0.6, 0.001, 0.02, 0.08);
      this.burst(o, d, toe, 'bandpass', 1500, 1.5, 0.25, 0.003, 0.01, 0.05);
      if (r.chance(0.3)) this.tone(o, d, 0.05, 'sawtooth', r.f(300, 500), r.f(250, 450), 0.08, 0.04, 0.02, 0.04, 0.12);
    } else {
      this.burst(o, d, 0, 'lowpass', 420 * v, 0.8, 0.8, 0.003, 0.015, 0.07);
      this.burst(o, d, toe, 'lowpass', 600, 0.8, 0.3, 0.005, 0.015, 0.06);
    }
  },
};
