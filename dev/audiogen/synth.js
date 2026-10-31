'use strict';
// ---------------------------------------------------------------------------
// Audio generator: the game's sounds and ambience loops, rendered offline (OfflineAudioContext) for dev/audiogen/build.js
// to write out as the .mp3 files in audio/. Each recipe takes a render context X (helpers below), a seeded random r and
// the variation number v. Recipes are in seconds; X.out is the dry bus, X.wet the reverb send.
// ---------------------------------------------------------------------------
const SR = 44100;
function rng(seed) { let s = seed >>> 0 || 1; return { next() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }, f(a, b) { return a + (b - a) * this.next(); }, int(a, b) { return Math.floor(this.f(a, b + 1)); }, pick(a) { return a[Math.floor(this.next() * a.length)]; }, chance(p) { return this.next() < p; } }; }

// a render: stereo context of len seconds, a dry bus and a reverb (ir: 'none' | 'room' | 'small' | 'hall' | 'outdoor')
function Render(len, ir, r) {
  const o = new OfflineAudioContext(2, Math.ceil(len * SR), SR);
  const X = { o, len, r, t: 0 };
  X.out = o.createGain(); X.out.connect(o.destination);
  X.wet = o.createGain(); X.wet.gain.value = 0;
  if (ir && ir !== 'none') { const cv = o.createConvolver(); cv.buffer = makeIR(o, ir, r); X.wet.gain.value = 1; X.wet.connect(cv); cv.connect(o.destination); }
  // noise buffers
  const nb = (kind) => {
    const n = Math.ceil(Math.min(len + 0.5, 30) * SR), b = o.createBuffer(1, n, SR), a = b.getChannelData(0);
    let l = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = r.next() * 2 - 1;
      if (kind === 'brown') { l = (l + 0.02 * w) / 1.02; a[i] = l * 3.5; }
      else if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; a[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
      else a[i] = w;
    }
    return b;
  };
  const NB = {};
  X.noise = (k) => NB[k || 'white'] || (NB[k || 'white'] = nb(k || 'white'));
  // a noise source from t0 for dur (looped buffer, random start)
  X.nsrc = (kind, t0, dur) => { const s = o.createBufferSource(); s.buffer = X.noise(kind); s.loop = true; s.start(t0, r.f(0, 1.5)); s.stop(Math.min(len, t0 + dur + 0.05)); return s; };
  X.osc = (type, f, t0, dur) => { const s = o.createOscillator(); s.type = type; s.frequency.setValueAtTime(f, t0); s.start(t0); s.stop(Math.min(len, t0 + dur + 0.05)); return s; };
  X.filt = (type, f, q) => { const b = o.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; };
  // a gain with an attack to peak at t0 + a, then an exponential decay (time constant tau); holds h before decaying
  X.env = (t0, a, peak, tau, h) => {
    const g = o.createGain(), p = g.gain;
    p.setValueAtTime(0, 0); p.setValueAtTime(0.0001, t0);
    if (a > 0) p.linearRampToValueAtTime(peak, t0 + a); else p.setValueAtTime(peak, t0);
    if (h) p.setValueAtTime(peak, t0 + a + h);
    p.setTargetAtTime(0, t0 + a + (h || 0), tau);
    return g;
  };
  // a gain following points [[t, v], ...] (linear)
  X.curve = (pts) => { const g = o.createGain(), p = g.gain; p.setValueAtTime(pts[0][1], 0); for (const [t, v] of pts) p.linearRampToValueAtTime(v, t); return g; };
  X.pan = (v) => { const p = o.createStereoPanner(); p.pan.value = v || 0; return p; };
  X.shaper = (k) => { const s = o.createWaveShaper(), n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } s.curve = c; return s; };
  // connect a chain; the last goes to the dry bus (and the reverb at send)
  X.chain = (nodes, send, dest) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); const last = nodes[nodes.length - 1]; last.connect(dest || X.out); if (send) { const s = o.createGain(); s.gain.value = send; last.connect(s); s.connect(X.wet); } return last; };
  // ---- building blocks
  // a burst of filtered noise
  X.burst = (t0, kind, type, f, q, peak, a, tau, o2) => {
    o2 = o2 || {};
    const s = X.nsrc(kind, t0, a + tau * 7 + (o2.h || 0)), fl = X.filt(type, f, q);
    if (o2.f1) fl.frequency.setTargetAtTime(o2.f1, t0, o2.ft || tau * 2);
    return X.chain([s, fl, X.env(t0, a, peak, tau, o2.h), X.pan(o2.pan)], o2.send, o2.dest);
  };
  // a tone sliding f0 -> f1
  X.tone = (t0, type, f0, f1, peak, a, tau, o2) => {
    o2 = o2 || {};
    const s = X.osc(type, f0, t0, a + tau * 7 + (o2.h || 0));
    if (f1 !== f0) s.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + (o2.glide || a + tau * 3));
    const nodes = [s];
    if (o2.lp) nodes.push(X.filt('lowpass', o2.lp, o2.q || 0.7));
    nodes.push(X.env(t0, a, peak, tau, o2.h), X.pan(o2.pan));
    return X.chain(nodes, o2.send, o2.dest);
  };
  // a struck resonant body: partials [[f, amp, tau], ...]
  X.ring = (t0, parts, peak, o2) => { for (const [f, amp, tau] of parts) X.tone(t0, 'sine', f, f * (o2 && o2.bend || 1), peak * amp, 0.001, tau, o2); };
  // grains: n short noise ticks spread over dur
  X.grains = (t0, dur, n, type, f0, f1, q, peak, tau) => { for (let k = 0; k < n; k++) X.burst(t0 + r.f(0, dur), 'white', type, r.f(f0, f1), q, peak * r.f(0.3, 1), 0.0005, tau * r.f(0.5, 1.5), { pan: r.f(-0.3, 0.3) }); };
  // a struck body: a short noise exciting narrow resonances [[f, q, gain], ...] - the body colours the hit the way a
  // real one does (a door, a plank, a car panel), where bare sines sound like a synthesizer
  X.modal = (t0, modes, peak, o2) => {
    o2 = o2 || {};
    const s = X.nsrc(o2.kind || 'white', t0, 0.05), e = X.env(t0, 0.0004, 1, o2.exc || 0.003), amp = o.createGain(); amp.gain.value = peak;
    s.connect(e);
    for (const [f, q, g] of modes) { const bp = X.filt('bandpass', f, q), gg = o.createGain(); gg.gain.value = g * Math.sqrt(q) * 1.5; e.connect(bp); bp.connect(gg); gg.connect(amp); }
    return X.chain([amp, X.pan(o2.pan)], o2.send, o2.dest);
  };
  // a bubble: a sine rising in pitch as it rings down (how liquid sounds), tiny
  X.bubble = (t0, f, g, tau) => X.tone(t0, 'sine', f, f * r.f(1.3, 1.8), g, 0.0006, tau || Math.max(0.003, 12 / f), { glide: (tau || 12 / f) * 4 });
  return X;
}
// an impulse response: noise decaying, early reflections; outdoor is sparse slap echoes and a long soft tail
function makeIR(o, kind, r) {
  const P = { room: [0.5, 2.4, 0.4], small: [0.25, 3, 0.3], hall: [2.2, 2.2, 0.6], outdoor: [1.6, 1.6, 0.25] }[kind] || [0.8, 2.4, 0.4];
  const n = Math.ceil(P[0] * SR), b = o.createBuffer(2, n, SR);
  for (let ch = 0; ch < 2; ch++) {
    const a = b.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) { const w = r.next() * 2 - 1; lp += (w - lp) * (kind === 'outdoor' ? 0.25 : 0.55); a[i] = lp * Math.pow(1 - i / n, P[1]) * P[2]; }
    if (kind === 'outdoor') for (const [d, g] of [[0.11, 0.35], [0.23, 0.22], [0.41, 0.14], [0.66, 0.08]]) { const i0 = Math.floor((d + r.f(-0.02, 0.02)) * SR); for (let i = 0; i < 400 && i0 + i < n; i++) a[i0 + i] += (r.next() * 2 - 1) * g * Math.exp(-i / 80); }
    else for (let k = 0; k < 8; k++) { const i0 = Math.floor(r.f(0.005, 0.06) * SR); a[i0] += (r.next() - 0.5) * 0.6; }
  }
  return b;
}

// ---------------------------------------------------------------------------
// recipes
// ---------------------------------------------------------------------------
const voiceAt = (X, t0, dur, o) => {
  // a vocal tract: a glottal source (harmonics falling off like a real voice's, not a buzzy sawtooth; pitch jitter and
  // loudness shimmer) through four formants that drift towards formEnd, breath noise that follows the voice, vocal fry,
  // a little distortion for the snarls, and for the dead a wet throat (gurgle: small bubbles bursting)
  const { o: c, r } = X, f0 = o.f0, src = c.createOscillator();
  const N = 48, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) im[n] = Math.pow(n, -(o.tilt || 1.35)) * r.f(0.75, 1.25) * (r.chance(0.5) ? 1 : -1);
  src.setPeriodicWave(c.createPeriodicWave(re, im, { disableNormalization: false }));
  src.frequency.setValueAtTime(f0 * (o.start || 1), t0);
  for (const [k, m] of (o.contour || [[0.3, 1.05], [0.7, 0.95], [1, 0.8]])) src.frequency.linearRampToValueAtTime(f0 * m, t0 + dur * k);
  const jit = X.nsrc('brown', t0, dur), jg = c.createGain(); jg.gain.value = f0 * (o.jitter || 0.08); jit.connect(jg); jg.connect(src.frequency);
  src.start(t0); src.stop(t0 + dur + 0.1);
  const sub = c.createOscillator(); sub.type = 'triangle'; sub.frequency.setValueAtTime(f0 / 2, t0); sub.start(t0); sub.stop(t0 + dur + 0.1);
  jg.connect(sub.frequency);
  const sg = c.createGain(); sg.gain.value = o.sub || 0.15; sub.connect(sg);
  // fry and shimmer: the level flutters irregularly (a noise, not a steady wobble)
  const fry = c.createGain(); fry.gain.value = 0.65; const fl = c.createOscillator(); fl.frequency.value = o.fry || r.f(32, 55); const fd = c.createGain(); fd.gain.value = (o.fryDepth || 0.4) * 0.7; fl.connect(fd); fd.connect(fry.gain); fl.start(t0); fl.stop(t0 + dur + 0.1);
  const sh = X.nsrc('brown', t0, dur), shl = X.filt('lowpass', 30, 0.7), shg = c.createGain(); shg.gain.value = 0.5; sh.connect(shl); shl.connect(shg); shg.connect(fry.gain);
  src.connect(fry); sg.connect(fry);
  const drive = X.shaper(o.drive || 1.5);
  fry.connect(drive);
  const amp = X.curve([[t0, 0], [t0 + dur * 0.12, o.peak], [t0 + dur * 0.6, o.peak * 0.8], [t0 + dur, 0]]);
  const F = o.formants || [[600, 7, 1], [1150, 9, 0.6], [2500, 10, 0.25]];
  const F4 = F.length < 4 ? F.concat([[F[F.length - 1][0] * 1.35, 12, 0.08]]) : F;
  const tract = c.createGain(); tract.gain.value = 1;
  for (const [f, q, g] of F4) {
    const bp = X.filt('bandpass', f * r.f(0.92, 1.08), q * 0.8); if (o.formEnd) bp.frequency.linearRampToValueAtTime(f * o.formEnd, t0 + dur);
    const gg = c.createGain(); gg.gain.value = g; tract.connect(bp); bp.connect(gg); gg.connect(amp);
  }
  // a little of the source unfiltered under the formants (the chest), lowpassed
  const chest = X.filt('lowpass', f0 * 3, 0.7), cg = c.createGain(); cg.gain.value = 0.12; drive.connect(chest); chest.connect(cg); cg.connect(amp);
  drive.connect(tract);
  // breath through the same tract, swelling with the voice
  X.burst(t0, 'white', 'bandpass', o.breathF || 1800, 1.2, o.peak * (o.breath || 0.12), dur * 0.2, dur * 0.4, { dest: amp });
  const asp = X.nsrc('white', t0, dur), ag = X.curve([[t0, 0], [t0 + dur * 0.2, (o.breath || 0.12) * 0.6], [t0 + dur, 0]]); asp.connect(ag); ag.connect(tract);
  if (o.gurgle) gurgle(X, t0, dur, o.gurgle, amp);
  X.chain([amp, X.pan(o.pan || 0)], o.send || 0.15);
};
// a wet throat: small bubbles (a sine chirping up as it bursts, a few ms) at an uneven rate, through a low band
function gurgle(X, t0, dur, g, dest) {
  const { o, r } = X, n = Math.ceil((dur + 0.05) * SR), b = o.createBuffer(1, n, SR), a = b.getChannelData(0);
  let t = r.f(0, 0.03);
  while (t < dur) {
    const f = r.f(180, 520), tau = r.f(0.004, 0.012), amp = r.f(0.3, 1) * Math.sin(Math.PI * t / dur), i0 = Math.floor(t * SR);
    let ph = 0;
    for (let i = 0; i < tau * 6 * SR && i0 + i < n; i++) { const tt = i / SR; ph += 2 * Math.PI * f * (1 + 40 * tt) / SR; a[i0 + i] += amp * Math.sin(ph) * Math.exp(-tt / tau); }
    t += r.chance(0.2) ? r.f(0.06, 0.15) : r.f(0.012, 0.04);
  }
  const s = o.createBufferSource(); s.buffer = b; s.start(t0);
  const lp = X.filt('lowpass', 1400, 0.7), gg = o.createGain(); gg.gain.value = g; s.connect(lp); lp.connect(gg); gg.connect(dest);
}
const gunshot = (X, P) => {
  const r = X.r;
  // the crack, the blast through a little drive, the thump, the action, a rolling tail and echoes
  X.burst(0, 'white', 'highpass', 2500 * r.f(0.9, 1.1), 0.7, P.crack, 0.0003, 0.005);
  const s = X.nsrc('white', 0, 0.6), lp = X.filt('lowpass', P.bodyF * r.f(0.9, 1.1), 0.8); lp.frequency.setTargetAtTime(P.bodyF * 0.35, 0.01, P.body);
  X.chain([s, lp, X.env(0, 0.0008, 1, P.body), X.shaper(2.2), X.filt('highshelf', 3000, 0)], 0.6);
  X.tone(0, 'sine', P.th0, 38, P.thump, 0.001, P.thd, { glide: P.thd * 2 });
  X.tone(0, 'triangle', P.th0 * 2.2, 70, P.thump * 0.25, 0.001, P.thd * 0.5);
  if (P.mech) { X.burst(0.035, 'white', 'bandpass', 3200, 4, 0.12, 0.0005, 0.008); X.burst(0.06, 'white', 'bandpass', 2600, 4, 0.08, 0.0005, 0.01); }
  X.burst(0.02, 'brown', 'lowpass', P.tailF, 0.7, P.tail, 0.03, P.tailT, { send: 0.3 });
  for (const [d, g] of P.echo) X.burst(d + r.f(0, 0.03), 'pink', 'lowpass', P.tailF * 1.6, 0.7, g * P.tail, 0.004, 0.06, { send: 0.4, pan: r.f(-0.4, 0.4) });
};
const step = (X, s, v) => {
  const r = X.r, L = r.f(0.8, 1.1);
  const heel = (t, g) => {
    if (s === 'grass') { X.burst(t, 'white', 'bandpass', r.f(2200, 3600), 0.9, 0.35 * g, 0.006, 0.03); X.grains(t, 0.06, 12, 'bandpass', 1800, 5000, 1.5, 0.12 * g, 0.006); X.tone(t, 'sine', 90, 55, 0.25 * g, 0.002, 0.02); }
    else if (s === 'gravel') { X.grains(t, 0.09, 26, 'highpass', 1500, 4500, 1, 0.35 * g, 0.004); X.burst(t, 'pink', 'lowpass', 900, 0.8, 0.4 * g, 0.002, 0.025); }
    else if (s === 'wood') { X.burst(t, 'white', 'lowpass', 1400, 0.8, 0.5 * g, 0.001, 0.012); X.ring(t, [[r.f(160, 200), 0.6, 0.05], [r.f(330, 420), 0.35, 0.035], [r.f(820, 980), 0.12, 0.02]], g); }
    else if (s === 'carpet') { X.burst(t, 'pink', 'lowpass', 520, 0.7, 0.55 * g, 0.004, 0.025); X.tone(t, 'sine', 70, 45, 0.2 * g, 0.003, 0.02); }
    else if (s === 'snow') { X.grains(t, 0.12, 30, 'bandpass', 1200, 3200, 2, 0.3 * g, 0.006); X.burst(t, 'pink', 'lowpass', 700, 0.7, 0.3 * g, 0.01, 0.05); }
    else { X.burst(t, 'white', 'bandpass', r.f(2600, 3600), 1.4, 0.45 * g, 0.0005, 0.008); X.burst(t, 'pink', 'lowpass', 1100, 0.7, 0.45 * g, 0.001, 0.018); X.tone(t, 'sine', 110, 60, 0.2 * g, 0.001, 0.015); }
  };
  heel(0.005, L); heel(0.045 + r.f(0, 0.02), 0.45 * L);
  if (s === 'wood' && v % 3 === 2) creak(X, r, 0.2, false, 0.05, r.f(90, 140));
  // the sole scuffing as it rolls off (hard floors)
  if (s === 'hard' || s === 'wood') X.burst(0.05, 'pink', 'bandpass', r.f(1800, 3000), 0.9, 0.06 * L, 0.02, 0.025);
};

// name: [variations, seconds, reverb, (X, r, v) => ...]. Names are what the game plays (Sfx.play and friends).
const RECIPES = {
  // ---- guns
  pistol: [4, 1.6, 'outdoor', (X) => gunshot(X, { crack: 0.9, bodyF: 4200, body: 0.035, th0: 170, thump: 0.8, thd: 0.05, tailF: 800, tail: 0.32, tailT: 0.35, echo: [[0.12, 0.6], [0.29, 0.35]], mech: 1 })],
  pistol45: [3, 1.7, 'outdoor', (X) => gunshot(X, { crack: 0.85, bodyF: 3500, body: 0.045, th0: 150, thump: 0.9, thd: 0.06, tailF: 700, tail: 0.38, tailT: 0.4, echo: [[0.13, 0.6], [0.31, 0.35]], mech: 1 })],
  magnum: [3, 1.9, 'outdoor', (X) => gunshot(X, { crack: 1, bodyF: 4000, body: 0.055, th0: 140, thump: 1, thd: 0.08, tailF: 760, tail: 0.45, tailT: 0.55, echo: [[0.14, 0.6], [0.34, 0.4]] })],
  rifle: [4, 2.3, 'outdoor', (X) => gunshot(X, { crack: 1, bodyF: 5200, body: 0.05, th0: 130, thump: 1, thd: 0.08, tailF: 650, tail: 0.5, tailT: 0.75, echo: [[0.16, 0.65], [0.42, 0.4], [0.7, 0.2]] })],
  shotgun: [3, 2.3, 'outdoor', (X) => gunshot(X, { crack: 0.8, bodyF: 2600, body: 0.08, th0: 105, thump: 1, thd: 0.11, tailF: 520, tail: 0.6, tailT: 0.75, echo: [[0.17, 0.7], [0.44, 0.45], [0.72, 0.22]] })],
  dryfire: [2, 0.2, 'small', (X, r) => { X.burst(0, 'white', 'bandpass', 3000, 5, 0.6, 0.0003, 0.006); X.ring(0.002, [[r.f(2200, 2600), 0.3, 0.02], [r.f(4300, 5000), 0.15, 0.01]], 1); }],
  reload: [3, 0.7, 'small', (X, r) => { for (const [t, f] of [[0, 1800], [0.18, 1300], [0.42, 2400]]) { X.burst(t + r.f(0, 0.03), 'white', 'bandpass', f, 4, 0.55, 0.0005, 0.012); X.ring(t + 0.002, [[f * 1.7, 0.2, 0.03]], 1); } X.burst(0.05, 'pink', 'bandpass', 900, 1, 0.12, 0.02, 0.06); }],
  shellin: [3, 0.25, 'small', (X, r) => { X.burst(0, 'white', 'bandpass', r.f(1500, 1900), 3, 0.5, 0.001, 0.015); X.burst(0.05, 'white', 'bandpass', 2600, 4, 0.35, 0.0005, 0.01); }],
  casing: [5, 0.5, 'small', (X, r) => { let t = 0; for (let k = 0; k < 4; k++) { X.ring(t, [[r.f(4200, 5600), 0.5, 0.05 / (k + 1)], [r.f(7600, 9000), 0.25, 0.025 / (k + 1)]], 0.6 / (k + 1)); t += r.f(0.05, 0.12) / (k * 0.5 + 1); } }],
  shellDrop: [3, 0.4, 'small', (X, r) => { X.burst(0, 'white', 'bandpass', 1400, 2, 0.4, 0.0005, 0.015); X.burst(r.f(0.08, 0.13), 'white', 'bandpass', 1100, 2, 0.2, 0.0005, 0.012); X.ring(0, [[r.f(700, 900), 0.2, 0.03]], 1); }],
  pump: [2, 0.6, 'small', (X, r) => { X.burst(0, 'white', 'bandpass', 900, 1.5, 0.5, 0.01, 0.03, { f1: 1600, ft: 0.05 }); X.burst(0.05, 'white', 'bandpass', 2400, 5, 0.4, 0.0005, 0.01); X.burst(0.2, 'white', 'bandpass', 1700, 1.5, 0.6, 0.01, 0.03, { f1: 900, ft: 0.05 }); X.burst(0.25, 'white', 'bandpass', 3000, 5, 0.5, 0.0005, 0.012); }],
  bolt: [2, 0.7, 'small', (X, r) => { X.burst(0, 'white', 'bandpass', 2500, 5, 0.5, 0.0005, 0.01); X.burst(0.09, 'white', 'bandpass', 1200, 1.5, 0.35, 0.01, 0.04, { f1: 2200 }); X.burst(0.3, 'white', 'bandpass', 1500, 1.5, 0.35, 0.01, 0.04, { f1: 900 }); X.burst(0.42, 'white', 'bandpass', 2800, 5, 0.55, 0.0005, 0.012); }],
  // ---- melee
  swing: [3, 0.35, 'none', (X, r) => X.burst(0.01, 'pink', 'bandpass', 500, 1.6, 0.6, 0.08, 0.05, { f1: 1600, ft: 0.06, pan: r.f(-0.2, 0.2) })],
  swingLight: [3, 0.3, 'none', (X) => X.burst(0.01, 'pink', 'bandpass', 900, 1.8, 0.45, 0.05, 0.035, { f1: 2400, ft: 0.04 })],
  swingHeavy: [3, 0.5, 'none', (X) => X.burst(0.01, 'pink', 'bandpass', 280, 1.3, 0.8, 0.14, 0.08, { f1: 900, ft: 0.1 })],
  hitBlunt: [5, 0.5, 'small', (X, r) => { X.tone(0, 'sine', r.f(110, 140), 45, 0.85, 0.001, 0.055); X.burst(0, 'pink', 'lowpass', 1500, 0.8, 0.7, 0.0008, 0.03); X.modal(0, [[r.f(160, 210), 5, 1], [r.f(380, 470), 6, 0.5], [r.f(900, 1100), 7, 0.2]], 0.45, { kind: 'pink', exc: 0.004 }); X.burst(0, 'white', 'bandpass', 2200, 2, 0.3, 0.0005, 0.008); X.burst(0.015, 'brown', 'lowpass', 400, 0.7, 0.45, 0.004, 0.06); }],
  hitBlade: [4, 0.5, 'small', (X, r) => { X.burst(0, 'white', 'highpass', 3500, 0.7, 0.45, 0.0005, 0.018); X.burst(0.004, 'pink', 'bandpass', 1100, 1.4, 0.6, 0.002, 0.05, { f1: 380 }); X.tone(0, 'sine', 100, 50, 0.45, 0.001, 0.05); X.modal(0, [[r.f(250, 320), 5, 1], [r.f(620, 760), 6, 0.4]], 0.3, { kind: 'pink', exc: 0.01 }); for (let k = 0; k < 4; k++) X.bubble(0.03 + r.f(0, 0.12), r.f(400, 1000), 0.03); }],
  hitFlesh: [5, 0.45, 'small', (X, r) => { X.burst(0, 'pink', 'lowpass', 1000, 0.8, 0.8, 0.0015, 0.035); X.tone(0, 'sine', r.f(85, 105), 45, 0.55, 0.001, 0.045); X.burst(0.006, 'pink', 'bandpass', 1300, 2.5, 0.4, 0.004, 0.04, { f1: 380, ft: 0.03 }); X.modal(0, [[r.f(220, 300), 4, 1], [r.f(500, 650), 5, 0.5]], 0.35, { kind: 'pink', exc: 0.008 }); for (let k = 0; k < 5; k++) X.bubble(0.02 + r.f(0, 0.12), r.f(350, 900), 0.035); }],
  shove: [3, 0.4, 'small', (X, r) => { X.burst(0, 'pink', 'lowpass', 700, 0.7, 0.7, 0.01, 0.05); X.tone(0, 'sine', 90, 45, 0.5, 0.002, 0.05); X.burst(0, 'white', 'bandpass', 2500, 1, 0.12, 0.02, 0.05); }],
  stomp: [3, 0.55, 'small', (X, r) => { X.tone(0, 'sine', 80, 32, 1, 0.001, 0.08); X.burst(0, 'pink', 'lowpass', 1300, 0.8, 0.7, 0.001, 0.04); X.grains(0.01, 0.06, 14, 'bandpass', 900, 3000, 2, 0.3, 0.006); X.burst(0.02, 'pink', 'bandpass', 700, 3, 0.3, 0.01, 0.06, { f1: 300 }); }],
  thud: [3, 0.45, 'small', (X, r) => { X.tone(0, 'sine', 90, 38, 0.9, 0.002, 0.07); X.burst(0, 'brown', 'lowpass', 500, 0.7, 0.7, 0.003, 0.06); }],
  zfall: [4, 0.8, 'small', (X, r) => { X.tone(0, 'sine', 75, 30, 1, 0.003, 0.09); X.burst(0, 'brown', 'lowpass', 600, 0.7, 0.8, 0.004, 0.08); X.burst(0.02, 'pink', 'bandpass', 2400, 0.8, 0.2, 0.05, 0.1); const t2 = r.f(0.18, 0.28); X.tone(t2, 'sine', 70, 35, 0.35, 0.002, 0.05); X.burst(t2, 'brown', 'lowpass', 500, 0.7, 0.3, 0.003, 0.04); }],
  // ---- the dead
  groanM: [8, 2.6, 'room', (X, r) => voiceAt(X, 0.05, r.f(1.4, 2.3), { gurgle: r.f(0.15, 0.4), breath: 0.2, f0: r.f(68, 92), peak: 0.7, formants: [[r.f(450, 650), 7, 1], [r.f(850, 1150), 9, 0.55], [2400, 10, 0.2]], formEnd: r.f(0.75, 1.1), contour: [[0.25, r.f(1, 1.1)], [0.6, r.f(0.85, 1)], [1, r.f(0.65, 0.8)]], drive: 2.2, jitter: 0.1 })],
  groanF: [8, 2.6, 'room', (X, r) => voiceAt(X, 0.05, r.f(1.2, 2.1), { gurgle: r.f(0.15, 0.4), breath: 0.2, f0: r.f(118, 150), peak: 0.6, formants: [[r.f(550, 750), 7, 1], [r.f(1100, 1500), 9, 0.55], [2800, 10, 0.2]], formEnd: r.f(0.8, 1.15), contour: [[0.25, r.f(1, 1.12)], [0.6, r.f(0.85, 1)], [1, r.f(0.7, 0.85)]], drive: 2, jitter: 0.1 })],
  snarlM: [6, 1.3, 'room', (X, r) => voiceAt(X, 0.02, r.f(0.6, 1.0), { gurgle: r.f(0.1, 0.25), f0: r.f(110, 150), start: 0.8, peak: 0.9, formants: [[r.f(700, 900), 6, 1], [r.f(1300, 1700), 8, 0.7], [2700, 9, 0.35]], contour: [[0.2, 1.25], [0.5, 1.1], [1, 0.75]], drive: 5, fry: r.f(60, 85), fryDepth: 0.7, breath: 0.35, breathF: 2600, jitter: 0.18 })],
  snarlF: [6, 1.3, 'room', (X, r) => voiceAt(X, 0.02, r.f(0.55, 0.95), { gurgle: r.f(0.1, 0.25), f0: r.f(160, 210), start: 0.8, peak: 0.85, formants: [[r.f(800, 1000), 6, 1], [r.f(1500, 1900), 8, 0.7], [3000, 9, 0.35]], contour: [[0.2, 1.25], [0.5, 1.1], [1, 0.78]], drive: 4.5, fry: r.f(65, 90), fryDepth: 0.7, breath: 0.35, breathF: 3000, jitter: 0.18 })],
  zhit: [3, 0.9, 'room', (X, r) => { X.burst(0, 'pink', 'lowpass', 1200, 0.8, 0.5, 0.002, 0.04); voiceAt(X, 0.03, r.f(0.35, 0.5), { gurgle: 0.3, f0: r.f(100, 130), peak: 0.6, start: 1.2, drive: 3, contour: [[0.3, 1.1], [1, 0.7]] }); }],
  zdie: [4, 1.6, 'room', (X, r) => { X.tone(0, 'sine', 80, 32, 0.7, 0.002, 0.1); voiceAt(X, 0.05, r.f(0.8, 1.2), { gurgle: 0.45, f0: r.f(70, 100), peak: 0.6, drive: 2.5, contour: [[0.2, 1.05], [1, 0.5]], fryDepth: 0.6 }); }],
  scream: [3, 1.8, 'hall', (X, r) => voiceAt(X, 0.02, r.f(1.1, 1.5), { f0: r.f(520, 700), peak: 0.7, formants: [[900, 5, 1], [1700, 7, 0.6], [3000, 8, 0.4]], contour: [[0.1, 1.15], [0.6, 1.05], [1, 0.75]], drive: 3, fryDepth: 0.15, jitter: 0.04, send: 0.4 })],
  // ---- the survivor
  hurtM: [4, 0.6, 'small', (X, r) => voiceAt(X, 0.01, r.f(0.22, 0.35), { f0: r.f(140, 175), start: 1.15, peak: 0.7, formants: [[650, 7, 1], [1150, 9, 0.5], [2500, 10, 0.2]], contour: [[0.3, 1.05], [1, 0.8]], drive: 2, fryDepth: 0.25, breath: 0.25 })],
  hurtF: [4, 0.6, 'small', (X, r) => voiceAt(X, 0.01, r.f(0.2, 0.32), { f0: r.f(250, 310), start: 1.15, peak: 0.65, formants: [[800, 7, 1], [1500, 9, 0.5], [2900, 10, 0.2]], contour: [[0.3, 1.05], [1, 0.8]], drive: 1.8, fryDepth: 0.2, breath: 0.25 })],
  shoutM: [3, 0.8, 'outdoor', (X, r) => voiceAt(X, 0.01, 0.42, { f0: r.f(165, 190), start: 1.3, peak: 0.85, formants: [[720, 6, 1], [1250, 8, 0.6], [2600, 9, 0.3]], contour: [[0.15, 1.2], [1, 0.95]], drive: 2.2, fryDepth: 0.1, jitter: 0.03, send: 0.3 })],
  shoutF: [3, 0.8, 'outdoor', (X, r) => voiceAt(X, 0.01, 0.4, { f0: r.f(290, 340), start: 1.3, peak: 0.8, formants: [[850, 6, 1], [1600, 8, 0.6], [3000, 9, 0.3]], contour: [[0.15, 1.2], [1, 0.95]], drive: 2, fryDepth: 0.1, jitter: 0.03, send: 0.3 })],
  cough: [4, 1.0, 'small', (X, r) => { const n = r.int(2, 3); for (let k = 0; k < n; k++) { const t = k * r.f(0.24, 0.32); X.burst(t, 'pink', 'bandpass', r.f(600, 900), 0.9, 0.6, 0.004, 0.07); X.burst(t, 'white', 'bandpass', 2400, 1, 0.2, 0.004, 0.05); voiceAt(X, t, r.f(0.1, 0.16), { f0: r.f(120, 170), start: 1.1, peak: 0.35, drive: 2.5, breath: 1.2, fryDepth: 0.6, contour: [[1, 0.8]] }); } }],
  death: [1, 5, 'hall', (X) => { for (const [f, g] of [[55, 0.5], [82.4, 0.3], [110, 0.25], [130.8, 0.15]]) X.tone(0, 'sawtooth', f, f * 0.98, g * 0.4, 1.2, 1.4, { lp: 500, send: 0.6, h: 0.8 }); X.burst(0, 'brown', 'lowpass', 120, 0.7, 0.6, 1, 1.4, { send: 0.5 }); }],
  heartbeat: [1, 0.6, 'none', (X) => { X.tone(0, 'sine', 62, 40, 1, 0.005, 0.05); X.burst(0, 'brown', 'lowpass', 150, 0.7, 0.4, 0.005, 0.04); X.tone(0.22, 'sine', 56, 38, 0.7, 0.005, 0.05); }],
  eat: [3, 0.9, 'none', (X, r) => { for (let k = 0; k < 4; k++) { const t = k * r.f(0.18, 0.24); X.grains(t, 0.05, 8, 'bandpass', 1500, 3800, 2, 0.4, 0.006); X.burst(t, 'pink', 'lowpass', 500, 0.7, 0.2, 0.005, 0.03); } }],
  drink: [3, 1.4, 'none', (X, r) => { for (let k = 0; k < 3; k++) { const t = 0.08 + k * r.f(0.38, 0.46); X.burst(t, 'pink', 'bandpass', r.f(260, 340), 3, 0.5, 0.008, 0.025); X.tone(t, 'sine', r.f(140, 170), 80, 0.25, 0.004, 0.03); X.burst(t + 0.03, 'pink', 'bandpass', 900, 1.5, 0.12, 0.03, 0.06); for (let j = 0; j < 4; j++) X.bubble(t + r.f(0.02, 0.14), r.f(500, 1100), 0.05); } X.burst(1.15, 'white', 'bandpass', 1500, 0.8, 0.12, 0.05, 0.08); }],
  pills: [2, 0.6, 'none', (X) => X.grains(0, 0.35, 22, 'bandpass', 3000, 6500, 3, 0.5, 0.004)],
  bandage: [2, 0.8, 'none', (X, r) => { X.burst(0, 'white', 'bandpass', 2500, 0.8, 0.4, 0.02, 0.12, { h: 0.25 }); X.grains(0, 0.4, 40, 'highpass', 2500, 6000, 1, 0.25, 0.003); }],
  rip: [2, 0.6, 'none', (X) => { X.burst(0, 'white', 'bandpass', 2000, 0.8, 0.6, 0.01, 0.08, { h: 0.15, f1: 3200 }); X.grains(0, 0.25, 30, 'highpass', 2000, 5000, 1, 0.3, 0.003); }],
  page: [3, 0.5, 'none', (X, r) => { X.burst(0, 'white', 'highpass', 3000, 0.7, 0.35, 0.03, 0.06, { h: 0.08 }); X.burst(0.04, 'pink', 'bandpass', 1800, 1, 0.15, 0.02, 0.05); }],
  cloth: [3, 0.6, 'none', (X) => { X.burst(0, 'pink', 'bandpass', 2400, 0.8, 0.35, 0.05, 0.1, { h: 0.12 }); X.grains(0.02, 0.3, 14, 'bandpass', 1500, 4000, 1.5, 0.1, 0.01); }],
  pickup: [3, 0.35, 'none', (X, r) => { X.burst(0, 'pink', 'bandpass', 2600, 1.2, 0.35, 0.01, 0.04); X.burst(0.05, 'white', 'bandpass', 1500, 3, 0.15, 0.002, 0.02); }],
  equip: [3, 0.4, 'none', (X, r) => { X.burst(0, 'pink', 'bandpass', 1500, 1.5, 0.35, 0.01, 0.04); X.ring(0.04, [[r.f(900, 1200), 0.3, 0.05], [r.f(2400, 2900), 0.15, 0.03]], 1); }],
  craft: [2, 0.6, 'none', (X, r) => { X.burst(0, 'pink', 'bandpass', 1200, 2, 0.4, 0.01, 0.05); X.ring(0.12, [[r.f(700, 900), 0.3, 0.06]], 1); X.burst(0.25, 'white', 'bandpass', 2000, 2, 0.2, 0.005, 0.03); }],
  levelup: [1, 1.8, 'hall', (X) => [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => X.ring(k * 0.11, [[f, 0.5, 0.5], [f * 2, 0.15, 0.25], [f * 3.01, 0.06, 0.15]], 0.5, { send: 0.4 }))],
  switch: [2, 0.15, 'none', (X, r) => { X.burst(0, 'white', 'bandpass', r.f(2600, 3200), 4, 0.6, 0.0003, 0.006); X.ring(0.001, [[r.f(1800, 2200), 0.2, 0.01]], 1); }],
  beep: [1, 1.1, 'none', (X) => { for (let k = 0; k < 4; k++) X.tone(k * 0.25, 'square', 2000, 2000, 0.2, 0.002, 0.03, { lp: 4000, h: 0.08 }); }],
  // ---- doors, windows, building
  // (opening: the handle, the latch letting go, the swing; now and then the hinge rasps a little)
  doorOpen: [5, 1.1, 'room', (X, r, v) => { doorHandle(X, r, 0); doorSwing(X, r, 0.1, r.f(0.45, 0.65), 1); if (v % 2 === 1) creak(X, r, r.f(0.25, 0.4), false, r.f(0.12, 0.2)); }],
  // (closing: the swing, the slab hitting the frame, the latch catching, the panel ringing low)
  doorClose: [5, 0.9, 'room', (X, r) => {
    doorSwing(X, r, 0, 0.22, 0.8); const t = r.f(0.16, 0.22);
    X.tone(t, 'sine', r.f(85, 105), 45, 1, 0.001, 0.06); X.burst(t, 'pink', 'lowpass', 1100, 0.8, 0.75, 0.001, 0.04, { send: 0.3 });
    X.modal(t, [[r.f(140, 180), 10, 1], [r.f(310, 380), 12, 0.55], [r.f(700, 820), 14, 0.22]], 0.6, { kind: 'pink', exc: 0.005, send: 0.25 });
    X.burst(t + 0.004, 'white', 'bandpass', r.f(2600, 3200), 6, 0.3, 0.0004, 0.008); X.burst(t + 0.02, 'white', 'bandpass', 600, 3, 0.1, 0.004, 0.05);
  }],
  garage: [1, 2.2, 'room', (X, r) => { X.burst(0, 'pink', 'bandpass', 450, 2, 0.5, 0.25, 0.6, { h: 0.9 }); for (let k = 0; k < 10; k++) X.burst(k * 0.15 + r.f(0, 0.05), 'white', 'bandpass', r.f(800, 1400), 3, 0.15, 0.002, 0.03); }],
  lock: [2, 0.3, 'small', (X, r) => { X.burst(0, 'white', 'bandpass', 2400, 5, 0.6, 0.0004, 0.008); X.burst(0.08, 'white', 'bandpass', 1800, 4, 0.5, 0.0004, 0.01); X.ring(0.081, [[r.f(1200, 1500), 0.2, 0.04]], 1); }],
  locked: [2, 0.4, 'small', (X, r) => { for (let k = 0; k < 3; k++) { X.burst(k * 0.07, 'white', 'bandpass', r.f(1600, 2000), 4, 0.5, 0.001, 0.015); X.tone(k * 0.07, 'sine', 140, 90, 0.2, 0.001, 0.02); } }],
  window: [3, 0.9, 'small', (X, r) => { X.burst(0, 'white', 'bandpass', 700, 1.5, 0.45, 0.08, 0.15, { h: 0.3, f1: 1100 }); X.burst(0.5, 'white', 'bandpass', 2400, 4, 0.3, 0.001, 0.015); }],
  climb: [3, 0.7, 'none', (X, r) => { X.burst(0, 'pink', 'bandpass', 900, 1, 0.4, 0.03, 0.08, { h: 0.12 }); X.burst(0.05, 'pink', 'bandpass', 2600, 1, 0.18, 0.05, 0.08); X.modal(0.02, [[r.f(160, 200), 8, 1], [r.f(380, 450), 10, 0.4]], 0.3, { kind: 'pink' }); X.tone(0.25, 'sine', 90, 50, 0.35, 0.003, 0.04); X.burst(0.25, 'pink', 'lowpass', 600, 0.7, 0.35, 0.003, 0.03); }],
  thump: [5, 0.6, 'room', (X, r) => { X.tone(0, 'sine', r.f(65, 85), 36, 0.9, 0.002, 0.07); X.burst(0, 'brown', 'lowpass', 380, 0.7, 0.7, 0.003, 0.05, { send: 0.3 }); X.modal(0, [[r.f(95, 120), 8, 1], [r.f(180, 230), 10, 0.6], [r.f(390, 470), 12, 0.35], [r.f(800, 950), 14, 0.15]], 0.5, { kind: 'pink', exc: 0.006, send: 0.3 }); for (let k = 0; k < r.int(1, 3); k++) X.burst(r.f(0.02, 0.07), 'white', 'bandpass', r.f(1800, 2600), 5, 0.12, 0.0005, 0.006); }],
  thumpGlass: [3, 0.45, 'small', (X, r) => { X.tone(0, 'sine', 90, 50, 0.5, 0.002, 0.05); X.ring(0, [[r.f(1800, 2200), 0.2, 0.08], [r.f(3300, 3900), 0.1, 0.06]], 1); X.burst(0, 'white', 'bandpass', 3000, 2, 0.15, 0.002, 0.03); }],
  thumpMetal: [3, 0.7, 'small', (X, r) => { X.tone(0, 'sine', 85, 42, 0.7, 0.002, 0.06); X.ring(0, [[r.f(230, 280), 0.4, 0.2], [r.f(610, 700), 0.25, 0.15], [r.f(1300, 1500), 0.12, 0.1]], 0.6); }],
  woodbreak: [3, 0.9, 'room', (X, r) => { X.burst(0, 'pink', 'lowpass', 2400, 0.8, 0.8, 0.002, 0.07, { send: 0.3 }); X.grains(0, 0.3, 26, 'bandpass', 1500, 5000, 2, 0.5, 0.008); X.tone(0, 'sine', 85, 40, 0.6, 0.002, 0.06); X.modal(0, [[r.f(380, 460), 10, 1], [r.f(900, 1100), 12, 0.5], [r.f(170, 210), 8, 0.6]], 0.6, { kind: 'pink' }); X.modal(r.f(0.08, 0.16), [[r.f(500, 700), 10, 1], [r.f(1300, 1600), 12, 0.4]], 0.25); }],
  wood: [3, 0.4, 'small', (X, r) => { X.burst(0, 'pink', 'bandpass', 900, 2, 0.4, 0.001, 0.025); X.modal(0, [[r.f(190, 230), 12, 1], [r.f(480, 560), 14, 0.5], [r.f(1100, 1300), 16, 0.2]], 0.6); }],
  hammer: [4, 0.45, 'small', (X, r) => { X.ring(0, [[r.f(1050, 1250), 0.5, 0.06], [r.f(2900, 3300), 0.25, 0.04], [r.f(5200, 5800), 0.1, 0.02]], 0.7); X.burst(0, 'white', 'highpass', 2500, 0.7, 0.4, 0.0005, 0.01); X.ring(0.002, [[r.f(160, 200), 0.4, 0.05]], 1); }],
  chop: [4, 0.5, 'small', (X, r) => { X.burst(0, 'pink', 'bandpass', 1300, 1.2, 0.7, 0.001, 0.03); X.modal(0, [[r.f(300, 380), 10, 1], [r.f(700, 850), 12, 0.45], [r.f(1500, 1800), 14, 0.15]], 0.6); X.tone(0, 'sine', 110, 55, 0.5, 0.001, 0.04); X.grains(0.01, 0.06, 8, 'bandpass', 2000, 5000, 2, 0.2, 0.006); }],
  treefall: [2, 3.4, 'outdoor', (X, r) => { creak(X, r, 1.1, false, 0.6, 140); X.burst(1.25, 'brown', 'lowpass', 500, 0.7, 1, 0.05, 0.5, { send: 0.4 }); X.grains(1.25, 0.6, 50, 'bandpass', 900, 4000, 1.5, 0.4, 0.02); X.tone(1.3, 'sine', 70, 28, 1, 0.01, 0.25); }],
  glass: [4, 1.6, 'room', (X, r) => { X.burst(0, 'white', 'highpass', 2800, 0.7, 0.9, 0.0005, 0.06, { send: 0.3 }); for (let k = 0; k < 28; k++) X.ring(r.f(0, 0.5) * (k / 28), [[r.f(2200, 9000), 0.5, r.f(0.03, 0.15)]], r.f(0.1, 0.35), { pan: r.f(-0.5, 0.5) }); X.grains(0.15, 0.6, 30, 'highpass', 4000, 9000, 2, 0.2, 0.004); }],
  lightBreak: [2, 0.6, 'small', (X, r) => { X.burst(0, 'white', 'highpass', 3500, 0.7, 0.7, 0.0005, 0.03); for (let k = 0; k < 10; k++) X.ring(r.f(0, 0.2), [[r.f(3000, 8000), 0.4, r.f(0.02, 0.06)]], 0.2); }],
  break: [2, 0.4, 'small', (X, r) => { X.burst(0, 'white', 'highpass', 1500, 0.7, 0.6, 0.001, 0.04); X.ring(0, [[r.f(600, 800), 0.3, 0.04]], 1); X.grains(0.01, 0.1, 10, 'bandpass', 1500, 4000, 2, 0.3, 0.005); }],
  clunk: [2, 0.4, 'small', (X, r) => { X.tone(0, 'sine', 160, 70, 0.7, 0.001, 0.05); X.ring(0, [[r.f(480, 560), 0.3, 0.08]], 0.5); }],
  ratchet: [1, 0.6, 'small', (X, r) => { for (let k = 0; k < 7; k++) X.burst(k * 0.06, 'white', 'bandpass', 2600, 5, 0.4, 0.0003, 0.006); }],
  fill: [2, 1.6, 'small', (X, r) => { X.burst(0, 'pink', 'bandpass', 1100, 1.2, 0.35, 0.1, 0.3, { h: 0.9 }); X.burst(0, 'white', 'highpass', 3000, 0.7, 0.08, 0.1, 0.3, { h: 0.9 }); for (let k = 0; k < 60; k++) X.bubble(r.f(0.05, 1.2), r.f(500, 1300) * (1 + k / 60), 0.03 * r.f(0.4, 1)); }],
  spray: [1, 2.0, 'none', (X) => X.burst(0, 'white', 'highpass', 3500, 0.7, 0.4, 0.04, 0.2, { h: 1.4 })],
  splash: [3, 1.0, 'small', (X, r) => { X.burst(0, 'pink', 'bandpass', 700, 0.8, 0.7, 0.005, 0.12); X.burst(0.03, 'white', 'highpass', 2500, 0.7, 0.3, 0.02, 0.18); for (let k = 0; k < 30; k++) X.bubble(r.f(0.02, 0.6) * (0.3 + k / 40), r.f(600, 2200), 0.05 * r.f(0.4, 1)); }],
  dig: [3, 0.6, 'none', (X, r) => { X.burst(0, 'brown', 'lowpass', 700, 0.7, 0.8, 0.005, 0.06); X.grains(0, 0.15, 20, 'bandpass', 800, 3000, 1.5, 0.35, 0.008); X.burst(0.02, 'white', 'bandpass', 1500, 2, 0.2, 0.02, 0.05, { f1: 2500 }); }],
  fire: [2, 2.0, 'small', (X, r) => { X.burst(0, 'pink', 'lowpass', 500, 0.7, 0.6, 0.15, 0.4, { h: 0.6 }); X.grains(0, 1.4, 30, 'highpass', 2000, 6000, 1, 0.4, 0.004); }],
  thunder: [4, 6, 'hall', (X, r) => { const t0 = r.f(0, 0.3); X.burst(t0, 'white', 'lowpass', 3500, 0.7, 0.7, 0.002, 0.05, { send: 0.4 }); for (let k = 0; k < 5; k++) X.burst(t0 + k * r.f(0.25, 0.6), 'brown', 'lowpass', r.f(160, 300), 0.7, r.f(0.6, 1), r.f(0.05, 0.3), r.f(0.4, 1.2), { send: 0.5, pan: r.f(-0.5, 0.5) }); }],
  powerdown: [1, 2.2, 'room', (X) => { X.tone(0, 'sawtooth', 120, 28, 0.4, 0.01, 0.7, { lp: 700, glide: 1.6 }); X.tone(0, 'sine', 60, 15, 0.4, 0.01, 0.6, { glide: 1.6 }); X.burst(0, 'white', 'bandpass', 2200, 4, 0.2, 0.001, 0.02); }],
  alarm: [1, 2.1, 'outdoor', (X) => { for (let k = 0; k < 4; k++) X.tone(k * 0.5, 'square', k & 1 ? 760 : 960, k & 1 ? 760 : 960, 0.35, 0.005, 0.02, { lp: 2600, h: 0.45, send: 0.2 }); }],
  tireBurst: [1, 1.8, 'outdoor', (X) => { X.burst(0, 'white', 'lowpass', 3500, 0.7, 1, 0.001, 0.05, { send: 0.4 }); X.tone(0, 'sine', 120, 38, 0.8, 0.001, 0.07); X.burst(0.08, 'white', 'bandpass', 700, 1, 0.3, 0.05, 0.4, { h: 0.4 }); }],
  // ---- vehicles
  engineStart: [2, 2.0, 'small', (X, r) => { starter(X, r, 0, 0.55); engineBurst(X, r, 0.5, 1.4, 0.25, 0.6); }],
  crank: [2, 1.4, 'small', (X, r) => starter(X, r, 0, 1.2)],
  crankFail: [2, 1.0, 'small', (X, r) => { starter(X, r, 0, 0.6); X.burst(0.6, 'brown', 'lowpass', 400, 0.7, 0.5, 0.005, 0.08); X.tone(0.6, 'sine', 70, 35, 0.4, 0.003, 0.06); }],
  crankDead: [1, 1.1, 'small', (X) => { for (let k = 0; k < 3; k++) X.burst(k * 0.32, 'white', 'bandpass', 1500, 5, 0.5, 0.0005, 0.008); }],
  stall: [2, 1.2, 'small', (X, r) => engineBurst(X, r, 0, 0.9, 0.4, 0.1, true)],
  engineOff: [2, 1.0, 'small', (X, r) => engineBurst(X, r, 0, 0.7, 0.3, 0.05, true)],
  horn: [1, 0.8, 'outdoor', (X) => horn(X, [410, 520], 0.6, 1600)],
  hornSmall: [1, 0.7, 'outdoor', (X) => horn(X, [560, 690], 0.45, 2200)],
  hornTruck: [1, 1.0, 'outdoor', (X) => horn(X, [290, 365], 0.75, 1300)],
  hornBus: [1, 1.3, 'outdoor', (X) => horn(X, [220, 277, 330], 1.0, 1000)],
  crash: [3, 1.6, 'outdoor', (X, r) => { metal(X, r, 0, 0.9); X.burst(0, 'pink', 'lowpass', 2200, 0.7, 0.9, 0.001, 0.12, { send: 0.3 }); X.tone(0, 'sine', 70, 30, 0.9, 0.001, 0.1); }],
  crunch: [3, 1.9, 'outdoor', (X, r) => { metal(X, r, 0, 1); metal(X, r, 0.08, 0.6); X.burst(0, 'pink', 'lowpass', 2600, 0.7, 1, 0.001, 0.2, { send: 0.3 }); X.tone(0, 'sine', 60, 25, 1, 0.001, 0.14); for (let k = 0; k < 14; k++) X.ring(r.f(0.05, 0.5), [[r.f(2500, 8000), 0.3, r.f(0.02, 0.08)]], 0.2); }],
  carHit: [3, 0.6, 'small', (X, r) => { X.tone(0, 'sine', 90, 40, 0.9, 0.001, 0.06); X.burst(0, 'pink', 'lowpass', 900, 0.7, 0.7, 0.002, 0.05); metal(X, r, 0, 0.25); }],
  carDoorOpen: [2, 0.5, 'small', (X, r) => { X.burst(0, 'white', 'bandpass', 1400, 4, 0.5, 0.0005, 0.012); X.burst(0.03, 'pink', 'bandpass', 900, 1.5, 0.3, 0.02, 0.06); }],
  carDoorClose: [3, 0.6, 'small', (X, r) => { X.tone(0, 'sine', 120, 50, 1, 0.001, 0.05); X.burst(0, 'pink', 'lowpass', 900, 0.7, 0.7, 0.001, 0.04); X.burst(0.008, 'white', 'bandpass', 2600, 4, 0.3, 0.0005, 0.01); metal(X, r, 0, 0.12); }],
  hoodOpen: [1, 0.8, 'small', (X, r) => { X.burst(0, 'white', 'bandpass', 1300, 4, 0.4, 0.0005, 0.012); creak(X, r, 0.45, false, 0.12, 200); }],
  hoodClose: [1, 0.6, 'small', (X, r) => { X.tone(0, 'sine', 100, 42, 1, 0.001, 0.07); X.burst(0, 'pink', 'lowpass', 1200, 0.7, 0.7, 0.001, 0.05); metal(X, r, 0, 0.2); }],
  // ---- far off
  distantGun: [3, 3, 'outdoor', (X, r) => { const n = r.int(2, 5); for (let k = 0; k < n; k++) { const t = k * r.f(0.2, 0.6); X.burst(t, 'pink', 'lowpass', 500, 0.7, 0.8, 0.003, 0.15, { send: 0.7 }); X.tone(t, 'sine', 90, 40, 0.5, 0.002, 0.08); } }],
  distantScream: [2, 2.5, 'outdoor', (X, r) => voiceAt(X, 0.02, 1.2, { f0: r.f(500, 650), peak: 0.4, formants: [[850, 5, 1], [1600, 7, 0.5]], contour: [[0.1, 1.15], [1, 0.7]], drive: 2, send: 0.8 })],
  distantCrash: [1, 2.5, 'outdoor', (X, r) => { metal(X, r, 0, 0.4); X.burst(0, 'pink', 'lowpass', 700, 0.7, 0.8, 0.003, 0.3, { send: 0.8 }); }],
  distantDog: [3, 2, 'outdoor', (X, r) => { for (let k = 0; k < r.int(2, 4); k++) voiceAt(X, k * r.f(0.3, 0.45), 0.12, { f0: r.f(380, 520), start: 1.2, peak: 0.6, formants: [[800, 4, 1], [1800, 6, 0.5]], contour: [[0.3, 1.1], [1, 0.75]], drive: 4, fryDepth: 0.2, send: 0.7 }); }],
};
for (const s of ['hard', 'grass', 'gravel', 'wood', 'carpet', 'snow']) RECIPES['st_' + s] = [6, 0.3, 'none', (X, r, v) => step(X, s, v)];

function creak(X, r, dur, sash, gain, base) {
  // a hinge's stick-slip: not a tone but a rasp - impulses at an uneven, slowly drifting rate (each period jittered),
  // through narrow high resonances, quiet, swelling and fading
  const { o } = X, n = Math.ceil((dur + 0.05) * SR), b = o.createBuffer(1, n, SR), a = b.getChannelData(0);
  let rate = (base || r.f(70, 120)), ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    rate += (r.next() - 0.5) * 0.6; rate = Math.max(35, Math.min(220, rate + (Math.sin(t * 6.3 + 1) * 0.02)));
    ph += rate / SR;
    if (ph >= 1) { ph -= 1 + (r.next() - 0.5) * 0.3; a[i] = (0.6 + r.next() * 0.4) * (r.chance(0.08) ? 0.2 : 1); }
  }
  const src = o.createBufferSource(); src.buffer = b; src.start(0);
  const amp = X.curve([[0, 0], [dur * 0.25, gain || 0.35], [dur * 0.7, (gain || 0.35) * 0.7], [dur, 0]]);
  for (const [f, q, g] of sash ? [[900, 3, 0.8], [2200, 4, 0.5]] : [[r.f(1100, 1500), 14, 1], [r.f(2300, 2900), 16, 0.6], [r.f(3600, 4200), 18, 0.3]]) {
    const bp = X.filt('bandpass', f, q), gg = o.createGain(); gg.gain.value = g * 6; src.connect(bp); bp.connect(gg); gg.connect(amp);
  }
  X.chain([amp, X.pan(r.f(-0.2, 0.2))], 0.25);
}
// a wooden door: the handle and latch (small metal clicks), the swing (air and the door's weight, low and soft), and
// on a closing door the slab meeting the frame - a thud with the panel's wooden ring and a little rattle
function doorHandle(X, r, t0) { X.burst(t0, 'white', 'bandpass', r.f(2600, 3200), 6, 0.35, 0.0004, 0.008); X.ring(t0 + 0.001, [[r.f(1900, 2300), 0.12, 0.025]], 1); X.burst(t0 + r.f(0.05, 0.09), 'white', 'bandpass', r.f(1800, 2300), 5, 0.28, 0.0005, 0.012); }
function doorSwing(X, r, t0, dur, g) { X.burst(t0, 'pink', 'lowpass', r.f(350, 500), 0.7, 0.3 * g, dur * 0.4, dur * 0.35, { h: dur * 0.2 }); X.burst(t0, 'brown', 'lowpass', 160, 0.7, 0.25 * g, dur * 0.3, dur * 0.3); }
function starter(X, r, t0, dur) {
  // the starter motor whining, the engine turning over in lumps
  X.tone(t0, 'sawtooth', 380, 420, 0.1, 0.02, dur, { lp: 1200, h: dur * 0.6 });
  for (let t = t0; t < t0 + dur; t += 0.14) { X.tone(t, 'sawtooth', 60, 48, 0.3, 0.005, 0.05, { lp: 380 }); X.burst(t, 'pink', 'bandpass', 700, 2, 0.12, 0.005, 0.04); }
}
function engineBurst(X, r, t0, dur, tau, idle, dying) {
  // firing pulses: a pulse train at the firing rate through the exhaust, revving up then settling (or dying away)
  const { o } = X, s = o.createOscillator(); s.type = 'square';
  const f1 = dying ? 30 : 45;
  s.frequency.setValueAtTime(dying ? 40 : 22, t0); s.frequency.linearRampToValueAtTime(dying ? 18 : 70, t0 + dur * 0.35); s.frequency.linearRampToValueAtTime(f1, t0 + dur);
  s.start(t0); s.stop(t0 + dur + 0.2);
  const lp = X.filt('lowpass', 420, 1.5), amp = X.curve([[t0, 0], [t0 + 0.06, 0.6], [t0 + dur * 0.5, 0.5], [t0 + dur, dying ? 0 : idle]]);
  X.chain([s, lp, X.shaper(2), amp]);
  X.burst(t0, 'brown', 'lowpass', 260, 0.7, 0.4, 0.05, dur * 0.4, { h: dur * 0.3 });
}
function horn(X, fs, dur, lp) { for (const f of fs) { X.tone(0, 'square', f, f, 0.25, 0.015, 0.02, { lp, h: dur, send: 0.25 }); X.tone(0, 'sawtooth', f * 1.004, f * 1.004, 0.1, 0.015, 0.02, { lp, h: dur }); } }
function metal(X, r, t0, g) { for (let k = 0; k < 9; k++) X.ring(t0 + r.f(0, 0.06), [[r.f(180, 2400), 0.4, r.f(0.05, 0.35)]], g * r.f(0.2, 0.5), { pan: r.f(-0.4, 0.4) }); X.grains(t0, 0.2, 20, 'bandpass', 1500, 6000, 2, g * 0.4, 0.01); }

// ---- ambience loops: [seconds, reverb, (X, r) => ...]; rendered long and cross-faded so they loop without a seam
const LOOPS = {
  rain: [20, 'none', (X, r) => { X.burst(0, 'pink', 'highpass', 900, 0.5, 0.35, 0.5, 30, { h: 22 }); X.burst(0, 'white', 'bandpass', 4500, 0.6, 0.12, 0.5, 30, { h: 22 }); for (let k = 0; k < 900; k++) X.burst(r.f(0, 21), 'white', 'bandpass', r.f(1800, 7000), 3, r.f(0.03, 0.12), 0.0003, 0.004, { pan: r.f(-0.9, 0.9) }); }],
  wind: [24, 'none', (X, r) => { const s = X.nsrc('brown', 0, 26), bp = X.filt('bandpass', 400, 0.8), amp = X.o.createGain(); amp.gain.setValueAtTime(0.3, 0); for (let t = 0; t < 25; t += r.f(1.5, 3)) { amp.gain.linearRampToValueAtTime(r.f(0.25, 0.9), t); bp.frequency.linearRampToValueAtTime(r.f(250, 900), t); } X.chain([s, bp, amp, X.pan(0)]); X.burst(0, 'pink', 'highpass', 2500, 0.5, 0.05, 1, 30, { h: 24 }); }],
  fire: [12, 'none', (X, r) => { X.burst(0, 'brown', 'lowpass', 700, 0.7, 0.5, 0.3, 30, { h: 13 }); X.burst(0, 'pink', 'bandpass', 1200, 0.6, 0.1, 0.3, 30, { h: 13 }); for (let k = 0; k < 160; k++) X.burst(r.f(0, 13), 'white', 'highpass', r.f(1800, 6000), 1, r.f(0.1, 0.5), 0.0003, r.f(0.003, 0.012), { pan: r.f(-0.6, 0.6) }); }],
  flies: [8, 'none', (X, r) => { for (let k = 0; k < 4; k++) { const s = X.osc('sawtooth', r.f(190, 240), 0, 9), lfo = X.osc('sine', r.f(3, 8), 0, 9), lg = X.o.createGain(); lg.gain.value = r.f(10, 25); lfo.connect(lg); lg.connect(s.frequency); const amp = X.o.createGain(); amp.gain.setValueAtTime(0.0, 0); for (let t = 0; t < 9; t += r.f(0.5, 1.5)) amp.gain.linearRampToValueAtTime(r.f(0, 0.12), t); X.chain([s, X.filt('bandpass', r.f(450, 650), 4), amp, X.pan(r.f(-0.7, 0.7))]); } }],
  night: [30, 'outdoor', (X, r) => { for (let c = 0; c < 6; c++) { const f = r.f(4200, 5200), per = r.f(0.5, 1.1), pan = r.f(-0.9, 0.9), g = r.f(0.04, 0.1); for (let t = r.f(0, 1); t < 31; t += per * r.f(0.9, 1.1)) for (let k = 0; k < 3; k++) X.tone(t + k * 0.03, 'sine', f, f * 0.98, g, 0.002, 0.008, { pan }); } for (let k = 0; k < 8; k++) { const t = r.f(0, 29), f = r.f(140, 220); X.tone(t, 'sawtooth', f, f * 0.9, 0.05, 0.02, 0.06, { lp: 700, pan: r.f(-0.8, 0.8), h: 0.1, send: 0.3 }); } X.burst(0, 'pink', 'lowpass', 300, 0.5, 0.06, 1, 40, { h: 31 }); }],
  day: [30, 'outdoor', (X, r) => { for (let k = 0; k < 26; k++) { const t = r.f(0, 29), f = r.f(2400, 4800), pan = r.f(-0.9, 0.9), n = r.int(2, 6); for (let j = 0; j < n; j++) X.tone(t + j * r.f(0.08, 0.16), 'sine', f * r.f(0.9, 1.1), f * r.f(1.1, 1.5), r.f(0.04, 0.1), 0.004, 0.025, { pan, send: 0.2 }); } X.burst(0, 'pink', 'bandpass', 600, 0.4, 0.06, 1, 40, { h: 31 }); }],
  engine: [4, 'none', (X, r) => { const { o } = X; for (const [f, g, type] of [[32, 0.6, 'square'], [64, 0.3, 'sawtooth'], [16, 0.25, 'sine']]) { const s = X.osc(type, f, 0, 5); X.chain([s, X.filt('lowpass', 420, 1.2), X.curve([[0, g], [5, g]])]); } const lfo = X.osc('sine', 8, 0, 5); X.burst(0, 'brown', 'lowpass', 300, 0.7, 0.3, 0.05, 30, { h: 5 }); void lfo; }],
  siren: [8, 'outdoor', (X) => { const s = X.osc('sawtooth', 900, 0, 9), lfo = X.osc('sine', 0.25, 0, 9), lg = X.o.createGain(); lg.gain.value = 330; lfo.connect(lg); lg.connect(s.frequency); X.chain([s, X.filt('lowpass', 2400, 1), X.curve([[0, 0.3], [9, 0.3]])], 0.2); }],
  heli: [4, 'outdoor', (X) => { const s = X.nsrc('brown', 0, 5), lp = X.filt('lowpass', 260, 1), am = X.o.createGain(); am.gain.value = 0.5; const lfo = X.osc('sine', 11, 0, 5), lg = X.o.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain); X.chain([s, lp, am], 0.2); X.tone(0, 'sawtooth', 1400, 1400, 0.03, 0.1, 0.1, { lp: 3000, h: 5 }); }],
  screech: [3, 'none', (X) => { const s = X.nsrc('white', 0, 4), bp = X.filt('bandpass', 1700, 9), lfo = X.osc('sine', 7, 0, 4), lg = X.o.createGain(); lg.gain.value = 220; lfo.connect(lg); lg.connect(bp.frequency); X.chain([s, bp, X.curve([[0, 0.6], [4, 0.6]])]); }],
};
// stereo loop: render len + 2 s, cross-fade the last 2 s into the start, keep len + 0.5 s (the extra half second repeats
// the start, so a player can loop any window of len seconds)
async function renderLoop(name, seed) {
  const [len, ir, fn] = LOOPS[name], r = rng(seed), X = Render(len + 2.5, ir, r);
  fn(X, r);
  const buf = await X.o.startRendering(), xf = Math.floor(2 * SR), L = Math.floor(len * SR), out = [];
  for (let ch = 0; ch < 2; ch++) {
    const a = buf.getChannelData(ch), b = new Float32Array(L + Math.floor(0.5 * SR));
    for (let i = 0; i < L; i++) b[i] = a[i + Math.floor(0.25 * SR)];
    for (let i = 0; i < xf; i++) { const k = i / xf; b[i] = b[i] * k + a[i + Math.floor(0.25 * SR) + L] * (1 - k); }
    for (let i = L; i < b.length; i++) b[i] = b[i - L];
    out.push(b);
  }
  return normalize(out, 0.8);
}
async function renderSfx(name, v, seed) {
  const [, len, ir, fn] = RECIPES[name], r = rng(seed + v * 7919), X = Render(len, ir, r);
  fn(X, r, v);
  const buf = await X.o.startRendering();
  // mono (the game pans it), faded at the end
  const a = buf.getChannelData(0), b = buf.getChannelData(1), m = new Float32Array(a.length);
  for (let i = 0; i < m.length; i++) m[i] = (a[i] + b[i]) * 0.5;
  const f = Math.min(m.length, 2048); for (let i = 0; i < f; i++) m[m.length - 1 - i] *= i / f;
  return normalize([m], 0.89);
}
function normalize(chs, peak) { let p = 0; for (const c of chs) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i])); const k = p > 1e-6 ? peak / p : 1; for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= k; return chs; }
// 16-bit PCM, interleaved, base64 (for the page -> node hand-over)
function pcm16(chs) {
  const n = chs[0].length, nc = chs.length, b = new Int16Array(n * nc);
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) b[i * nc + c] = Math.max(-32767, Math.min(32767, Math.round(chs[c][i] * 32767)));
  const u = new Uint8Array(b.buffer); let s = ''; const CH = 0x8000;
  for (let i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
  return { nc, sr: SR, data: btoa(s) };
}
