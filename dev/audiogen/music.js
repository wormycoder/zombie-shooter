'use strict';
// ---------------------------------------------------------------------------
// The music: pieces composed from a few rules (a key and mode, a chord progression, a motif) and rendered offline with
// a piano (inharmonic partials, two strings a note, hammer noise), string ensembles, a bass, pads, soft percussion and a
// concert-hall reverb. TRACKS lists them; renderTrack(name) returns stereo Float32 channels.
// ---------------------------------------------------------------------------
const MODES = { aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
// root (midi), mode, tempo, progression (scale degrees, a chord a bar), the parts; len in bars of the A section
const TRACKS = {
  title: { root: 50, mode: 'aeolian', bpm: 66, prog: [0, 5, 2, 6], parts: { piano: 1, strings: 0.9, bass: 0.6, pad: 0.4 }, lh: 'arp8', seed: 11 },
  day1: { root: 48, mode: 'ionian', bpm: 80, prog: [0, 4, 5, 3], parts: { piano: 1, strings: 0.5, bass: 0.5 }, lh: 'broken', seed: 23 },
  day2: { root: 55, mode: 'mixolydian', bpm: 74, prog: [0, 3, 0, 4, 5, 3, 4, 4], parts: { piano: 1, strings: 0.6, bass: 0.5, pad: 0.2 }, lh: 'arp8', seed: 31 },
  dusk: { root: 57, mode: 'aeolian', bpm: 62, prog: [0, 3, 5, 4], parts: { piano: 1, strings: 1, bass: 0.6, pad: 0.4 }, lh: 'broken', seed: 47 },
  night1: { root: 52, mode: 'aeolian', bpm: 54, prog: [0, 5, 3, 6], parts: { piano: 0.8, pad: 0.8, drone: 0.6, strings: 0.4 }, lh: 'sparse', seed: 59, sparse: true },
  night2: { root: 54, mode: 'dorian', bpm: 58, prog: [0, 3, 0, 6], parts: { piano: 0.7, pad: 1, drone: 0.7 }, lh: 'sparse', seed: 67, sparse: true },
  rain: { root: 58, mode: 'lydian', bpm: 70, prog: [0, 1, 5, 4], parts: { piano: 1, pad: 0.5, strings: 0.4 }, lh: 'arp8', seed: 73, rain: true },
  tension: { root: 48, mode: 'phrygian', bpm: 104, prog: [0, 1, 0, 6], parts: { strings: 1, bass: 1, perc: 1, drone: 0.6 }, lh: 'none', seed: 83, loop: 16 },
  death: { root: 45, mode: 'aeolian', bpm: 50, prog: [0], parts: {}, seed: 97, sting: true },
  // (more pieces: lead picks the melody's instrument, lhInst the accompaniment's)
  title2: { root: 50, mode: 'dorian', bpm: 60, prog: [0, 6, 5, 3], parts: { piano: 1, cello: 1, strings: 0.6, bass: 0.5, pad: 0.3 }, lh: 'broken', lead: 'cello', seed: 113 },
  day3: { root: 50, mode: 'ionian', bpm: 92, prog: [0, 4, 5, 3], parts: { guitar: 1, strings: 0.4, bass: 0.5, piano: 0.6 }, lh: 'pick', lhInst: 'guitar', lead: 'piano', seed: 127 },
  day4: { root: 52, mode: 'mixolydian', bpm: 84, prog: [0, 6, 3, 0], parts: { guitar: 1, cello: 0.8, bass: 0.5, pad: 0.2, brush: 0.6 }, lh: 'strum', lhInst: 'guitar', lead: 'cello', seed: 139 },
  dusk2: { root: 53, mode: 'aeolian', bpm: 58, prog: [0, 5, 6, 4], parts: { piano: 1, cello: 1, strings: 0.7, bass: 0.6, pad: 0.4 }, lh: 'arp8', lead: 'cello', seed: 149 },
  night3: { root: 56, mode: 'dorian', bpm: 52, prog: [0, 3, 6, 3], parts: { celesta: 0.9, pad: 0.9, drone: 0.7, strings: 0.3 }, lh: 'none', lead: 'celesta', seed: 157, sparse: true },
  night4: { root: 49, mode: 'phrygian', bpm: 48, prog: [0, 1, 0, 5], parts: { piano: 0.6, pad: 1, drone: 0.9, cello: 0.5 }, lh: 'sparse', lead: 'cello', seed: 163, sparse: true },
  rain2: { root: 55, mode: 'dorian', bpm: 66, prog: [0, 3, 6, 4], parts: { guitar: 1, pad: 0.6, strings: 0.3, piano: 0.5 }, lh: 'pick', lhInst: 'guitar', lead: 'piano', seed: 173, rain: true },
  winter1: { root: 57, mode: 'aeolian', bpm: 60, prog: [0, 5, 3, 4], parts: { celesta: 0.8, strings: 0.9, pad: 0.5, bass: 0.4, piano: 0.6 }, lh: 'sparse', lead: 'celesta', seed: 181 },
  winter2: { root: 51, mode: 'dorian', bpm: 56, prog: [0, 3, 0, 4], parts: { piano: 1, cello: 0.9, pad: 0.5, drone: 0.4 }, lh: 'broken', lead: 'piano', seed: 191 },
  tension2: { root: 45, mode: 'aeolian', bpm: 120, prog: [0, 0, 5, 1], parts: { strings: 1, bass: 1, taiko: 1, drone: 0.7, cello: 0.8 }, lh: 'none', seed: 197, loop: 16 },
};

const mhz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const pianoCache = {};
// one piano note: partials above an inharmonic string, two strings slightly detuned, the hammer's knock
async function pianoNote(m, vel) {
  const key = m + ':' + vel;
  if (pianoCache[key]) return pianoCache[key];
  const len = m < 50 ? 6 : m < 70 ? 4.5 : 3, o = new OfflineAudioContext(2, Math.ceil(len * SR), SR), f0 = mhz(m), B = 0.0002 + 0.00002 * Math.max(0, m - 40);
  const pan = o.createStereoPanner(); pan.pan.value = Math.max(-0.6, Math.min(0.6, (m - 62) / 40)); pan.connect(o.destination);
  const bright = 0.35 + vel * 0.45, T0 = 3.2 * Math.pow(60 / m, 1.1);
  for (let n = 1; n <= 16; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n);
    if (fn > 16000) break;
    const amp = Math.pow(bright, n - 1) / Math.pow(n, 0.9) * (n === 1 ? 0.7 : 1) * 0.16 * vel;
    for (const det of [-0.9, 0.9]) {
      const osc = o.createOscillator(); osc.frequency.value = fn * Math.pow(2, det / 1200);
      const g = o.createGain(), tau = T0 / (1 + 0.35 * n);
      g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(amp, 0.004); g.gain.setTargetAtTime(amp * 0.35, 0.004, tau * 0.25); g.gain.setTargetAtTime(0, 0.05, tau);
      osc.connect(g); g.connect(pan); osc.start(0); osc.stop(len);
    }
  }
  // hammer
  const nb = o.createBuffer(1, 2048, SR), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 180);
  const hs = o.createBufferSource(); hs.buffer = nb; const hf = o.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = Math.min(4000, f0 * 4); hf.Q.value = 1.2;
  const hg = o.createGain(); hg.gain.value = 0.08 * vel; hs.connect(hf); hf.connect(hg); hg.connect(pan); hs.start(0);
  const buf = await o.startRendering();
  return (pianoCache[key] = buf);
}

// one guitar note: a plucked string (Karplus-Strong: a burst of noise circulating in a delay the string's length, losing
// its highs each pass, a fractional all-pass for the tuning), softened by the pluck, coloured by the body afterwards
const guitarCache = {};
function guitarNote(m, vel) {
  const key = m + ':' + vel;
  if (guitarCache[key]) return guitarCache[key];
  const f = mhz(m), D = SR / f + 0.5, N = Math.floor(D - 0.1), fr = D - N, C = (1 - fr) / (1 + fr), len = Math.ceil(3.2 * SR), out = new Float32Array(len), buf = new Float32Array(N);
  let s = (m * 7919 + 13) >>> 0; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6 * 2 - 1; };
  for (let i = 0; i < N; i++) buf[i] = rnd();
  // the pluck: smooth the burst (a soft finger), and a comb for where on the string it was plucked
  for (let p = 0; p < (vel > 0.7 ? 1 : 2); p++) for (let i = 1; i < N; i++) buf[i] = (buf[i] + buf[i - 1]) * 0.5;
  const pp = Math.max(1, Math.floor(N * 0.18)), b2 = buf.slice(); for (let i = 0; i < N; i++) buf[i] = b2[i] - 0.6 * b2[(i + pp) % N];
  const T60 = Math.max(1.2, 4.5 - (m - 40) * 0.07), rho = Math.pow(0.001, 1 / (T60 * f));
  let idx = 0, xp = 0, yp = 0;
  for (let i = 0; i < len; i++) {
    const a = buf[idx], b = buf[(idx + 1) % N], lp = (a + b) * 0.5 * rho, y = C * lp + xp - C * yp; xp = lp; yp = y;
    out[i] = a; buf[idx] = y; idx = (idx + 1) % N;
  }
  let pk = 0; for (let i = 0; i < 4000; i++) pk = Math.max(pk, Math.abs(out[i]));
  const g = 0.5 * vel / (pk || 1); for (let i = 0; i < len; i++) out[i] *= g * (i < 30 ? i / 30 : 1);
  const ab = new AudioBuffer({ length: len, sampleRate: SR, numberOfChannels: 1 }); ab.copyToChannel(out, 0);
  return (guitarCache[key] = ab);
}

async function renderTrack(name) {
  const T = TRACKS[name], r = rng(T.seed), S = MODES[T.mode], beat = 60 / T.bpm, bar = beat * 4;
  const sec = T.sting ? 9 : T.loop ? T.loop * bar : (2 + 8 + 8 + 8 + 4) * bar + 6;
  const o = new OfflineAudioContext(2, Math.ceil((sec + (T.loop ? 4 : 0)) * SR), SR);
  // mix: a compressor, the hall
  const comp = o.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.3; comp.connect(o.destination);
  const dry = o.createGain(); dry.gain.value = 0.9; dry.connect(comp);
  const cv = o.createConvolver(); cv.buffer = makeIR(o, 'hall', r); const wet = o.createGain(); wet.gain.value = 0.42; wet.connect(cv); const cvlp = o.createBiquadFilter(); cvlp.type = 'lowpass'; cvlp.frequency.value = 5000; cv.connect(cvlp); cvlp.connect(comp);
  const out = (node, send) => { node.connect(dry); const s = o.createGain(); s.gain.value = send; node.connect(s); s.connect(wet); };
  const deg = (d, oct) => { const q = Math.floor(d / 7), i = ((d % 7) + 7) % 7; return T.root + S[i] + 12 * (q + (oct || 0)); };
  const chordAt = (d) => [deg(d), deg(d + 2), deg(d + 4)];
  const P = T.parts;
  // ---- instruments
  const piano = async (m, t, vel, send) => { if (!P.piano) return; const b = await pianoNote(Math.round(m), Math.round(vel * 4) / 4); const s = o.createBufferSource(); s.buffer = b; const g = o.createGain(); g.gain.value = P.piano * 0.9; s.connect(g); out(g, send === undefined ? 0.35 : send); s.start(t); };
  const strings = (ms, t, dur, lvl) => {
    if (!P.strings) return;
    for (const m of ms) for (const det of [-7, 0, 7]) {
      const osc = o.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = mhz(m) * Math.pow(2, det / 1200);
      const vib = o.createOscillator(); vib.frequency.value = r.f(4.5, 5.5); const vg = o.createGain(); vg.gain.value = mhz(m) * 0.004; vib.connect(vg); vg.connect(osc.frequency);
      const lp = o.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1600 + lvl * 800, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(900, t + dur);
      const g = o.createGain(); const a = Math.min(1.6, dur * 0.35), pk = 0.018 * lvl * P.strings;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + a); g.gain.setValueAtTime(pk, t + dur - 0.2); g.gain.setTargetAtTime(0, t + dur - 0.2, 0.6);
      const pn = o.createStereoPanner(); pn.pan.value = det / 14;
      osc.connect(lp); lp.connect(g); g.connect(pn); out(pn, 0.5);
      osc.start(t); vib.start(t); osc.stop(t + dur + 3); vib.stop(t + dur + 3);
    }
  };
  const bass = (m, t, dur, lvl) => {
    if (!P.bass) return;
    const osc = o.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = mhz(m);
    const lp = o.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 1.2;
    const g = o.createGain(), pk = 0.09 * lvl * P.bass; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.25); g.gain.setTargetAtTime(pk * 0.6, t + 0.25, dur * 0.5); g.gain.setTargetAtTime(0, t + dur, 0.3);
    osc.connect(lp); lp.connect(g); out(g, 0.2); osc.start(t); osc.stop(t + dur + 2);
  };
  const pad = (ms, t, dur) => {
    if (!P.pad) return;
    for (const m of ms) for (const det of [-5, 5]) {
      const osc = o.createOscillator(); osc.type = 'triangle'; osc.frequency.value = mhz(m + 12) * Math.pow(2, det / 1200);
      const g = o.createGain(), pk = 0.02 * P.pad; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
      const pn = o.createStereoPanner(); pn.pan.value = det / 8; osc.connect(g); g.connect(pn); out(pn, 0.7); osc.start(t); osc.stop(t + dur + 2);
    }
  };
  const drone = (m, t, dur) => {
    if (!P.drone) return;
    const n = o.createBufferSource(), b = o.createBuffer(1, SR * 4, SR), a = b.getChannelData(0); let l = 0; for (let i = 0; i < a.length; i++) { l = (l + 0.02 * (r.next() * 2 - 1)) / 1.02; a[i] = l * 3; }
    n.buffer = b; n.loop = true; const bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = mhz(m) * 2; bp.Q.value = 6;
    const g = o.createGain(), pk = 0.25 * P.drone; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 4); g.gain.setValueAtTime(pk, t + dur - 4); g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp); bp.connect(g); out(g, 0.6); n.start(t); n.stop(t + dur + 0.1);
    const s = o.createOscillator(); s.frequency.value = mhz(m); const sg = o.createGain(); sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.03 * P.drone, t + 5); sg.gain.linearRampToValueAtTime(0, t + dur); s.connect(sg); out(sg, 0.3); s.start(t); s.stop(t + dur + 0.1);
  };
  const tom = (t, f, lvl) => { const s = o.createOscillator(); s.frequency.setValueAtTime(f, t); s.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.25); const g = o.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * lvl, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, 0.09); s.connect(g); out(g, 0.3); s.start(t); s.stop(t + 0.8); };
  const tick = (t, lvl) => { const n = o.createBufferSource(), b = o.createBuffer(1, 1024, SR), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = (r.next() * 2 - 1) * Math.exp(-i / 90); n.buffer = b; const hp = o.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000; const g = o.createGain(); g.gain.value = 0.12 * lvl; n.connect(hp); hp.connect(g); out(g, 0.2); n.start(t); };
  // the guitar's body: a low air resonance, the top's, a softened top end
  const gbus = o.createBiquadFilter(); gbus.type = 'peaking'; gbus.frequency.value = 110; gbus.Q.value = 1.5; gbus.gain.value = 5;
  const gtop = o.createBiquadFilter(); gtop.type = 'peaking'; gtop.frequency.value = 220; gtop.Q.value = 1.2; gtop.gain.value = 3;
  const glp = o.createBiquadFilter(); glp.type = 'lowpass'; glp.frequency.value = 4200; gbus.connect(gtop); gtop.connect(glp); out(glp, 0.3);
  const guitar = (m, t, vel) => { if (!P.guitar) return; const s = o.createBufferSource(); s.buffer = guitarNote(Math.round(m), Math.round(vel * 4) / 4); const g = o.createGain(); g.gain.value = P.guitar * 0.8; const pn = o.createStereoPanner(); pn.pan.value = Math.max(-0.4, Math.min(0.4, (m - 60) / 50)) - 0.1; s.connect(g); g.connect(pn); pn.connect(gbus); s.start(t); };
  // a solo cello: a bowed sawtooth through the body's resonances, bow noise, vibrato that comes in after the attack
  const cello = (m, t, dur, lvl) => {
    if (!P.cello) return;
    const f = mhz(m), osc = o.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f * 0.995, t); osc.frequency.linearRampToValueAtTime(f, t + 0.08);
    const vib = o.createOscillator(); vib.frequency.value = r.f(5, 5.8); const vg = o.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, dur * 0.5)); vib.connect(vg); vg.connect(osc.frequency);
    const g = o.createGain(), pk = 0.05 * lvl * P.cello, a = Math.min(0.25, dur * 0.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + a); g.gain.linearRampToValueAtTime(pk * 0.8, t + Math.max(a, dur - 0.1)); g.gain.setTargetAtTime(0, t + dur, 0.12);
    const lp = o.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.5;
    osc.connect(lp); let last = lp;
    for (const [bf, bq, bg] of [[280, 2, 6], [520, 2.5, 4], [1300, 2, 3]]) { const pf = o.createBiquadFilter(); pf.type = 'peaking'; pf.frequency.value = bf; pf.Q.value = bq; pf.gain.value = bg; last.connect(pf); last = pf; }
    last.connect(g);
    const bn = o.createBufferSource(), bb = o.createBuffer(1, Math.ceil(0.4 * SR), SR), ba = bb.getChannelData(0); for (let i = 0; i < ba.length; i++) ba[i] = r.next() * 2 - 1;
    bn.buffer = bb; bn.loop = true; const bbp = o.createBiquadFilter(); bbp.type = 'bandpass'; bbp.frequency.value = f * 4; bbp.Q.value = 2; const bgn = o.createGain(); bgn.gain.value = 0.15; bn.connect(bbp); bbp.connect(bgn); bgn.connect(g);
    const pn = o.createStereoPanner(); pn.pan.value = 0.15; g.connect(pn); out(pn, 0.45);
    osc.start(t); vib.start(t); bn.start(t); osc.stop(t + dur + 1); vib.stop(t + dur + 1); bn.stop(t + dur + 1);
  };
  // a celesta / music box: a struck bar (the fundamental, a quiet partial four times up, a click), ringing long
  const celesta = (m, t, vel) => {
    if (!P.celesta) return;
    const f = mhz(m), pn = o.createStereoPanner(); pn.pan.value = r.f(-0.3, 0.3); out(pn, 0.55);
    for (const [k, a, tau] of [[1, 1, 1.4], [4.02, 0.22, 0.35], [9.9, 0.05, 0.08]]) {
      if (f * k > 15000) continue;
      const osc = o.createOscillator(); osc.frequency.value = f * k; const g = o.createGain(), pk = 0.07 * vel * a * P.celesta;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, tau);
      osc.connect(g); g.connect(pn); osc.start(t); osc.stop(t + tau * 7);
    }
  };
  const lead = (n, t, vel, dur) => { const L = T.lead || 'piano'; if (L === 'cello') cello(n - 12, t, dur, vel * 1.1); else if (L === 'celesta') celesta(n + 12, t, vel); else if (L === 'guitar') guitar(n, t, vel); else jobs.push(piano(n, t, vel)); };
  const lhNote = (m, t, vel) => { if (T.lhInst !== 'guitar') return jobs.push(piano(m, t, vel)); while (m < 40) m += 12; while (m > 76) m -= 12; guitar(m, t, vel * 1.2); };
  const taiko = (t, lvl) => { tom(t, 58, lvl * 1.6); const n = o.createBufferSource(), b = o.createBuffer(1, 4096, SR), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = (r.next() * 2 - 1) * Math.exp(-i / 500); n.buffer = b; const lp = o.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; const g = o.createGain(); g.gain.value = 0.3 * lvl; n.connect(lp); lp.connect(g); out(g, 0.5); n.start(t); };
  const brush = (t, lvl) => { const n = o.createBufferSource(), b = o.createBuffer(1, 6000, SR), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = (r.next() * 2 - 1) * Math.min(1, i / 600) * Math.exp(-i / 1500); n.buffer = b; const bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5000; bp.Q.value = 0.7; const g = o.createGain(); g.gain.value = 0.05 * lvl * P.brush; n.connect(bp); bp.connect(g); out(g, 0.3); n.start(t); };
  const jobs = [];
  if (T.sting) {
    // the death sting: a low cluster swells, a piano falls away over it
    const sp = { strings: 1, bass: 1, pad: 1, drone: 1, piano: 1 }; Object.assign(P, sp);
    strings([deg(0, -1), deg(2, -1), deg(4, -1), deg(1, 0)], 0.2, 6, 1.2); bass(deg(0, -2), 0.2, 6, 1); drone(deg(0, -2), 0, 8.5);
    [7, 6, 4, 2, 0].forEach((d, k) => jobs.push(piano(deg(d, 1), 1.2 + k * 0.85, 0.55 - k * 0.06, 0.5)));
    await Promise.all(jobs);
    return finish(await o.startRendering(), sec);
  }
  // ---- the form: intro (2 bars), A (8), B (8, a third up, strings), A' (8), outro (4)
  const motif = []; let d = r.int(2, 4);
  const rhythms = [[1, 1, 2], [1.5, 0.5, 1, 1], [2, 1, 1], [1, 0.5, 0.5, 2], [3, 1]];
  for (let k = 0; k < 4; k++) { const rh = r.pick(rhythms); const notes = rh.map(() => { d += r.pick([-2, -1, -1, 0, 1, 1, 2]); d = Math.max(-1, Math.min(9, d)); return d; }); motif.push([rh, notes]); }
  const lhPattern = (ch, t, lvl, kind) => {
    const [a, b, c] = ch.map(m => m - 12);
    if (kind === 'arp8') [a, c, a + 12, b + 12, c, a + 12, b + 12, c].forEach((m, k) => lhNote(m, t + k * beat / 2, lvl * (k % 4 ? 0.45 : 0.6)));
    else if (kind === 'broken') { lhNote(a - 12, t, lvl * 0.6); [b, c, a + 12].forEach((m, k) => lhNote(m, t + (k + 1) * beat, lvl * 0.42)); }
    else if (kind === 'sparse') { lhNote(a - 12, t, lvl * 0.5); if (r.chance(0.6)) lhNote(c, t + beat * 2, lvl * 0.35); }
    // fingerpicking: the thumb on the beat (root, fifth), the fingers between
    else if (kind === 'pick') [a - 12, c, a + 12, b + 12, c - 12, c, a + 12, b + 12].forEach((m, k) => lhNote(m, t + k * beat / 2 + r.f(0, 0.012), lvl * (k % 2 ? 0.38 : 0.55)));
    // strumming: the chord swept low to high, down on the beats, a lighter up-strum between
    else if (kind === 'strum') [[0, 0.6, 1], [1, 0.4, 1], [1.5, 0.3, -1], [2, 0.5, 1], [2.5, 0.3, -1], [3, 0.45, 1], [3.5, 0.3, -1]].forEach(([bt, v, dir]) => { const ns = [a - 12, c - 12, a, b, c, a + 12]; (dir > 0 ? ns : ns.slice().reverse()).forEach((m, k) => lhNote(m, t + bt * beat + k * 0.012, lvl * v * 0.7)); });
  };
  const section = (t0, bars, o2) => {
    for (let b = 0; b < bars; b++) {
      const cd = T.prog[(b + (o2.shift || 0)) % T.prog.length], ch = chordAt(cd), t = t0 + b * bar;
      if (T.lh !== 'none') lhPattern(ch, t, o2.lvl, T.lh);
      if (o2.strings) strings(ch.map(m => m - 12), t, bar + 0.1, o2.strings);
      if (o2.pad && (b % 2 === 0)) pad(ch, t, bar * 2);
      bass(ch[0] - 24, t, bar, o2.lvl);
      if (o2.mel) {
        // the melody: the motif, a phrase a bar, raised for B, its last note on a chord tone
        const [rh, notes] = motif[(b + (o2.vary || 0)) % motif.length];
        let tt = t;
        rh.forEach((du, k) => {
          let n = deg(notes[k] + (o2.up || 0), 1);
          if (k === rh.length - 1) { let best = n, bd = 99; for (const cm of ch) for (const oc of [12, 24]) { const c2 = cm + oc; if (Math.abs(c2 - n) < bd) { bd = Math.abs(c2 - n); best = c2; } } n = best; }
          if (!(T.sparse && r.chance(0.35))) lead(n, tt + (o2.swing ? r.f(0, 0.04) : 0), o2.mel * r.f(0.85, 1), du * beat * 0.95);
          tt += du * beat;
        });
      }
      if (P.brush) for (let k = 0; k < 8; k++) brush(t + k * beat / 2 + (k % 2 ? beat * 0.08 : 0), k % 2 ? 0.6 : 1);
      if (P.taiko) { [0, 1.5, 2, 3, 3.5].forEach((bt, k) => taiko(t + bt * beat, k === 0 ? 1 : 0.6)); if (b % 4 === 3) [3.25, 3.5, 3.75].forEach(bt => taiko(t + bt * beat, 0.5)); }
      if (P.perc) { for (let k = 0; k < 4; k++) { tom(t + k * beat, k % 2 ? 70 : 95, k === 0 ? 1 : 0.6); tick(t + k * beat + beat / 2, 0.8); } if (b % 2) tom(t + 3.5 * beat, 120, 0.5); }
    }
  };
  if (T.loop) {
    section(0, T.loop, { lvl: 0.8, strings: 1 });
    drone(T.root - 24, 0, sec + 4);
    // short ostinato in the strings, a stab each bar
    const fig = P.taiko ? [0, 0, 2, 0, 1, 0, 2, 3] : [0, 0, 0, 1, 0, 0, 0, 1];
    for (let b = 0; b < T.loop; b++) for (let k = 0; k < 8; k++) strings([deg(T.prog[b % 4] + (P.taiko ? fig[k] : 0), -1) + (!P.taiko && fig[k] ? 1 : 0)], b * bar + k * beat / 2, beat * 0.4, 0.8);
    if (P.cello) for (let b = 0; b < T.loop; b += 2) cello(deg(T.prog[b % 4], -1), b * bar, bar * 1.9, 0.9);
    await Promise.all(jobs);
    return loopFinish(await o.startRendering(), sec);
  }
  let t = 0;
  section(t, 2, { lvl: 0.45, pad: true, strings: P.strings ? 0.4 : 0 }); t += 2 * bar;
  section(t, 8, { lvl: 0.75, mel: 0.7, pad: true }); t += 8 * bar;
  section(t, 8, { lvl: 0.8, mel: 0.78, up: 2, vary: 1, strings: 1, pad: true, shift: 2 }); t += 8 * bar;
  section(t, 8, { lvl: 0.7, mel: 0.72, vary: 2, strings: 0.5, pad: true, swing: true }); t += 8 * bar;
  section(t, 4, { lvl: 0.4, pad: true, strings: 0.4 }); t += 4 * bar;
  jobs.push(piano(deg(0, 0) - 12, t, 0.5, 0.6)); jobs.push(piano(deg(0, 1), t, 0.4, 0.6)); jobs.push(piano(deg(4, 0), t, 0.35, 0.6));
  drone(T.root - 24, 0, sec);
  // rain: a soft hiss under it all
  if (T.rain) { const n = o.createBufferSource(), b = o.createBuffer(1, SR * 3, SR), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = r.next() * 2 - 1; n.buffer = b; n.loop = true; const hp = o.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 4000; hp.Q.value = 0.4; const g = o.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.018, 4); g.gain.setValueAtTime(0.018, sec - 5); g.gain.linearRampToValueAtTime(0, sec); n.connect(hp); hp.connect(g); g.connect(dry); n.start(0); n.stop(sec); }
  await Promise.all(jobs);
  return finish(await o.startRendering(), sec);
}
function finish(buf, sec) {
  const chs = [0, 1].map(c => buf.getChannelData(c).slice(0, Math.ceil(sec * SR)));
  const f = Math.floor(2.5 * SR); for (const c of chs) for (let i = 0; i < f; i++) c[c.length - 1 - i] *= i / f;
  return normalize(chs, 0.88);
}
function loopFinish(buf, sec) {
  const L = Math.floor(sec * SR), xf = Math.floor(2 * SR), out = [];
  for (let c = 0; c < 2; c++) { const a = buf.getChannelData(c), b = new Float32Array(L + Math.floor(0.5 * SR)); for (let i = 0; i < L; i++) b[i] = a[i]; for (let i = 0; i < xf; i++) { const k = i / xf; b[i] = b[i] * k + (a[i + L] || 0) * (1 - k); } for (let i = L; i < b.length; i++) b[i] = b[i - L]; out.push(b); }
  return normalize(out, 0.85);
}
