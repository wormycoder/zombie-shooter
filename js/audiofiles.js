'use strict';
// ---------------------------------------------------------------------------
// The game's audio files (audio/, listed in js/data/audiolist.js): sound effects, ambience loops and music.
// Served over http(s) they are decoded into Web Audio (positioned, pitched, through the reverb); opened straight from
// the disk (file://) a browser will not let a page read them, so plain audio elements play them instead. Anything with
// no file falls back to the synthesized sounds in audio.js. Replace a file with a recording of the same name and the
// game uses that.
// ---------------------------------------------------------------------------
const AudioFiles = {
  mode: null, sfx: {}, loops: {}, failed: new Set(), music: {}, ok: false,
  // play level of each sound (the files peak near full scale) and its reverb send
  LEVEL: {
    pistol: 0.85, pistol45: 0.9, magnum: 1, rifle: 1, shotgun: 1, distantGun: 0.5, distantCrash: 0.45, distantDog: 0.35, distantScream: 0.4,
    hitBlunt: 0.6, hitBlade: 0.55, hitFlesh: 0.5, stomp: 0.65, thud: 0.55, zfall: 0.5, shove: 0.45, swing: 0.3, swingLight: 0.25, swingHeavy: 0.35,
    groanM: 0.32, groanF: 0.3, snarlM: 0.4, snarlF: 0.38, zhit: 0.35, zdie: 0.4, scream: 0.4, hurtM: 0.35, hurtF: 0.33, shoutM: 0.45, shoutF: 0.42,
    st_hard: 0.24, st_grass: 0.2, st_gravel: 0.24, st_wood: 0.26, st_carpet: 0.16, st_snow: 0.24,
    doorOpen: 0.3, doorClose: 0.5, window: 0.3, glass: 0.55, lightBreak: 0.4, thump: 0.6, thumpGlass: 0.4, thumpMetal: 0.5, woodbreak: 0.6, treefall: 0.7,
    thunder: 0.8, alarm: 0.35, beep: 0.25, levelup: 0.3, switch: 0.3, pickup: 0.3, equip: 0.3, page: 0.25, cloth: 0.25, death: 0.5, heartbeat: 0.5,
    engineStart: 0.45, crank: 0.4, crankFail: 0.4, stall: 0.4, engineOff: 0.4, horn: 0.4, hornSmall: 0.4, hornTruck: 0.45, hornBus: 0.45, crash: 0.75, crunch: 0.85, carHit: 0.6,
  },
  VERB: { pistol: 0.45, pistol45: 0.45, magnum: 0.5, rifle: 0.55, shotgun: 0.55, glass: 0.25, groanM: 0.3, groanF: 0.3, snarlM: 0.25, snarlF: 0.25, doorClose: 0.2, thump: 0.25, scream: 0.4, thunder: 0.3, crash: 0.3, crunch: 0.3 },
  init(ctx) {
    if (typeof AUDIO_LIST === 'undefined' || this.mode) return;
    this.ctx = ctx;
    this.mode = location.protocol === 'file:' ? 'el' : 'buf';
    if (this.mode === 'buf') this.loadAll(); else this.ok = true;
  },
  url(kind, name) { return 'audio/' + kind + '/' + name + '.mp3'; },
  async get(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return this.ctx.decodeAudioData(await r.arrayBuffer()); },
  async loadAll() {
    const L = AUDIO_LIST, jobs = [];
    for (const n of Object.keys(L.loops)) jobs.push(['loops', n, (b) => { this.loops[n] = b; if (Sfx.useLoop) Sfx.useLoop(n, b); }]);
    for (const [n, c] of Object.entries(L.sfx)) for (let i = 1; i <= c; i++) jobs.push(['sfx', n + '_' + i, (b) => (this.sfx[n] || (this.sfx[n] = [])).push(b)]);
    let i = 0;
    const run = async () => { while (i < jobs.length) { const [k, f, done] = jobs[i++]; try { done(await this.get(this.url(k, f))); } catch (e) { this.failed.add(k + '/' + f); } } };
    await Promise.all([run(), run(), run(), run(), run(), run()]);
    this.ok = true;
  },
  has(name) { const L = typeof AUDIO_LIST !== 'undefined' && AUDIO_LIST.sfx[name]; return !!L && (this.mode === 'el' ? !this.failed.has(name) : !!this.sfx[name]); },
  // a sound effect: g level 0..1 (distance), pan -1..1, rate; false when there is no file for it (the caller synthesizes)
  play(name, g, pan, rate) {
    if (!Sfx.on || !this.has(name)) return false;
    const lvl = (this.LEVEL[name] || 0.5) * g * (0.9 + Math.random() * 0.15), r = (rate || 1) * (0.96 + Math.random() * 0.08);
    if (this.mode === 'el') {
      const n = AUDIO_LIST.sfx[name], a = new Audio(this.url('sfx', name + '_' + (1 + ((Math.random() * n) | 0))));
      a.volume = U.clamp(lvl * Sfx.vol.master * Sfx.vol.sfx, 0, 1); a.preservesPitch = false; a.playbackRate = r;
      a.onerror = () => this.failed.add(name);
      a.play().catch(() => {});
      return true;
    }
    const L = this.sfx[name], c = Sfx.ctx, s = c.createBufferSource();
    s.buffer = L[(Math.random() * L.length) | 0]; s.playbackRate.value = r;
    const gn = c.createGain(); gn.gain.value = lvl; s.connect(gn);
    let out = gn;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan || 0; gn.connect(p); out = p; }
    out.connect(Sfx.sfxG);
    const vb = this.VERB[name];
    if (vb) { const vg = c.createGain(); vg.gain.value = vb; out.connect(vg); vg.connect(Sfx.sfxVerb); }
    s.start();
    return true;
  },
  // a looping source of a loop file into dest (Web Audio); null without the file. Loops are rendered len s long plus
  // half a second that repeats their start, so any window of len s loops cleanly (a recording loops whole)
  loopSrc(name, dest) {
    const b = this.loops[name];
    if (!b) return null;
    const c = Sfx.ctx, s = c.createBufferSource(), len = AUDIO_LIST.loops[name] || 0;
    s.buffer = b; s.loop = true;
    if (len && b.duration > len + 0.1 && b.duration < len + 1) { s.loopStart = 0.08; s.loopEnd = 0.08 + len; }
    s.connect(dest); s.start(0, len ? 0.08 : 0);
    return s;
  },
  // ---- element mode: loops and music as audio elements (no filters or pan)
  el(kind, name, loop) {
    const k = kind + '/' + name;
    let a = this.els && this.els[k];
    if (!a) { this.els = this.els || {}; a = this.els[k] = new Audio(this.url(kind, name)); a.loop = !!loop; a.preservesPitch = false; a.volume = 0; a.onerror = () => this.failed.add(k); }
    return a;
  },
  elLevel(kind, name, v, rate) {
    if (this.mode !== 'el' || this.failed.has(kind + '/' + name) || !AUDIO_LIST[kind][name]) return false;
    const a = this.el(kind, name, kind === 'loops');
    const vol = U.clamp(v * Sfx.vol.master * (kind === 'music' ? Sfx.vol.music : Sfx.vol.sfx), 0, 1);
    a.volume = vol;
    if (rate) a.playbackRate = U.clamp(rate, 0.5, 3);
    if (vol > 0.001 && a.paused) a.play().catch(() => {});
    else if (vol <= 0.001 && !a.paused && kind === 'loops') a.pause();
    return true;
  },
  // ---- music: a track decoded when wanted (a few MB each; only the latest kept)
  async track(name) {
    if (this.music[name]) return this.music[name];
    const b = await this.get(this.url('music', name));
    this.music = { [name]: b };
    return b;
  },
  hasMusic(name) { return typeof AUDIO_LIST !== 'undefined' && !!AUDIO_LIST.music[name] && !this.failed.has('music/' + name); },
};
