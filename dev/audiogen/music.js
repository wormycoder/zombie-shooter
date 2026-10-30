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
    if (kind === 'arp8') [a, c, a + 12, b + 12, c, a + 12, b + 12, c].forEach((m, k) => jobs.push(piano(m, t + k * beat / 2, lvl * (k % 4 ? 0.45 : 0.6))));
    else if (kind === 'broken') { jobs.push(piano(a - 12, t, lvl * 0.6)); [b, c, a + 12].forEach((m, k) => jobs.push(piano(m, t + (k + 1) * beat, lvl * 0.42))); }
    else if (kind === 'sparse') { jobs.push(piano(a - 12, t, lvl * 0.5)); if (r.chance(0.6)) jobs.push(piano(c, t + beat * 2, lvl * 0.35)); }
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
          if (!(T.sparse && r.chance(0.35))) jobs.push(piano(n, tt + (o2.swing ? r.f(0, 0.04) : 0), o2.mel * r.f(0.85, 1)));
          tt += du * beat;
        });
      }
      if (P.perc) { for (let k = 0; k < 4; k++) { tom(t + k * beat, k % 2 ? 70 : 95, k === 0 ? 1 : 0.6); tick(t + k * beat + beat / 2, 0.8); } if (b % 2) tom(t + 3.5 * beat, 120, 0.5); }
    }
  };
  if (T.loop) {
    section(0, T.loop, { lvl: 0.8, strings: 1 });
    drone(T.root - 24, 0, sec + 4);
    // short ostinato in the strings, a stab each bar
    for (let b = 0; b < T.loop; b++) for (let k = 0; k < 8; k++) strings([deg(T.prog[b % 4], -1) + (k % 4 === 3 ? 1 : 0)], b * bar + k * beat / 2, beat * 0.4, 0.8);
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
