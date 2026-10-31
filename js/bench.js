'use strict';
// ---------------------------------------------------------------------------
// Benchmark (Settings > Optimization > Benchmark, from the title screen): the real game renderer and zombie AI on a
// fixed town, run through each quality preset at four loads from light to ultra heavy. Each stage settles for a
// moment, then frame times are measured; the results table recommends the highest preset that stays smooth under a
// heavy load. The player's settings are put back afterwards; Esc stops it.
// ---------------------------------------------------------------------------
const Bench = {
  SEED: 4242, SETTLE: 1, MEASURE: 3,
  PRESETS: ['Potato', 'Low', 'Medium', 'High', 'Ultra'],
  // zombies about the camera, dead ones lying about, the hour, rain (0..1), a thunderstorm
  LOADS: [
    { n: 'Light', z: 25, dead: 0, hour: 13, rain: 0 },
    { n: 'Medium', z: 120, dead: 20, hour: 18.8, rain: 0 },
    { n: 'Heavy', z: 350, dead: 80, hour: 22, rain: 0.6 },
    { n: 'Ultra heavy', z: 900, dead: 200, hour: 23.5, rain: 1, storm: true },
  ],
  run: null, world: null,
  start() {
    if (G.mode !== 'menu') return;
    const keep = { v: Object.assign({}, Settings.v), zombies: G.zombies, cars: G.cars, wd: Wd, weather: G.weather, time: G.time, player: G.player };
    const stages = [];
    for (const p of this.PRESETS) for (const l of this.LOADS) stages.push({ p, l, iv: [], work: [] });
    this.run = { keep, stages, i: -1, t: 0, hz: 1000 / (Game.rIv || 16.7) };
    $('#menu').innerHTML = `<div class="benchbar" style="position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:8px 16px;background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.2);border-radius:3px;font:12px/1.5 Verdana,sans-serif;color:#ddd;text-align:center;pointer-events:auto;white-space:nowrap">
      <b>Benchmark</b> <span id="benchStage">preparing the town...</span><div style="height:4px;margin-top:6px;background:rgba(255,255,255,0.12)"><div id="benchBar" style="height:4px;width:0;background:#c8945a"></div></div>
      <div style="color:#999;font-size:11px;margin-top:4px">Esc to stop</div></div>`;
    this.key = (e) => { if (e.key === 'Escape' && this.run) { e.preventDefault(); e.stopImmediatePropagation(); this.finish(false); } };
    window.addEventListener('keydown', this.key, true);
    // the town is built after the bar is up
    setTimeout(() => {
      if (!this.run) return;
      if (!this.world) this.world = MapGen.generate(this.SEED);
      World.use(this.world);
      G.cars = []; Vehicles.spawnAll();
      G.player = { x: 100, y: 110, dead: true, inCar: null, st: { panic: 0 }, look: { skin: '#ccc' }, angle: 0, halo: [], deadT: 0 };
      G.events.heli = null; G.alarms = [];
      G.mode = 'bench';
      this.next();
    }, 30);
  },
  // the next stage: its preset, its crowd and weather
  next() {
    const r = this.run;
    r.i++; r.t = 0;
    if (r.i >= r.stages.length) { this.finish(true); return; }
    const st = r.stages[r.i], L = st.l;
    if (r.i === 0 || r.stages[r.i - 1].p !== st.p) Settings.usePreset(st.p);
    // the same crowd in the same places for every preset
    let q = this.SEED + r.i % this.LOADS.length;
    const rnd = () => { q = (q + 0x6d2b79f5) | 0; let t = Math.imul(q ^ (q >>> 15), 1 | q); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    G.zombies = [];
    let tries = 0;
    for (let k = 0; k < L.z + L.dead && tries < 20000; tries++) {
      const x = 75 + rnd() * 70, y = 92 + rnd() * 52;
      if (World.tileSolid(x | 0, y | 0) || World.isWater(x | 0, y | 0)) continue;
      const z = Zombie.create(x, y);
      z.va = 1; z.st = 'wander'; z.idleT = 0;
      if (k >= L.z) { z.dead = true; z.st = 'dead'; z.lie = 1; z.hp = 0; z.diedAt = G.time - 60; }
      G.zombies.push(z);
      k++;
    }
    Zombie.rebuildGrid();
    G.time = L.hour * 60;
    G.weather = { rain: L.rain, target: L.rain, fog: L.storm ? 0.3 : 0.1, temp: 18, next: 1e12, storm: !!L.storm };
    const el = $('#benchStage');
    if (el) el.textContent = `${st.p} · ${L.n} (${L.z} zombies) · stage ${r.i + 1} of ${r.stages.length}`;
  },
  // one frame (Game.loop, uncapped): the crowd, the effects and the world drawn as in play; iv = ms since the last
  frame(dt, iv) {
    const r = this.run;
    if (!r || G.mode !== 'bench') return;
    const t0 = performance.now(), st = r.stages[r.i], L = st.l;
    r.t += dt;
    // the camera drifts the same way through the town every stage
    const k = Math.min(1, r.t / (this.SETTLE + this.MEASURE + (r.i === 0 ? 2 : 0)));
    Render.cam.x = G.player.x = 85 + k * 40; Render.cam.y = G.player.y = 105 + k * 22; Render.cam.z = 0;
    Render.cam.zoom = Render.cam.tz = 1;
    G.light.amb = L.hour > 20 || L.hour < 6 ? 0.3 : L.hour > 18 ? 0.62 : 1;
    G.light.flash = L.storm && Math.random() < dt * 0.25 ? 1 : Math.max(0, G.light.flash - dt * 3);
    Zombie.updateAll(dt);
    for (const z of G.zombies) if (!z.dead && z.st === 'idle') z.idleT = 0;
    Fx.update(dt);
    Render.frame(dt);
    // (the first stage also waits out the town's first drawing)
    const settle = this.SETTLE + (r.i === 0 ? 2 : 0);
    if (r.t > settle) { st.iv.push(iv); st.work.push(performance.now() - t0); }
    const bar = $('#benchBar');
    if (bar) bar.style.width = ((r.i + Math.min(1, r.t / (this.SETTLE + this.MEASURE))) / r.stages.length * 100).toFixed(1) + '%';
    if (r.t >= settle + this.MEASURE) this.next();
  },
  // average frames a second, the 1% low (the slowest frames), the work per frame in ms
  stats(st) {
    const n = st.iv.length;
    if (!n) return null;
    const sum = st.iv.reduce((a, b) => a + b, 0), srt = st.iv.slice().sort((a, b) => b - a);
    const p99 = srt[Math.min(n - 1, Math.floor(n * 0.01))];
    return { fps: 1000 * n / sum, low: 1000 / p99, ms: st.work.reduce((a, b) => a + b, 0) / n };
  },
  finish(done) {
    const r = this.run;
    if (!r) return;
    this.run = null;
    window.removeEventListener('keydown', this.key, true);
    const K = r.keep;
    Object.assign(Settings.v, K.v); Settings.save(); Settings.apply();
    G.zombies = K.zombies; G.cars = K.cars; G.weather = K.weather; G.time = K.time; G.player = K.player;
    if (K.wd) World.use(K.wd);
    Zombie.rebuildGrid();
    G.mode = 'menu';
    Menu.show();
    if (done) this.results(r);
  },
  // the results table and the recommended preset (smooth: at least 50 fps, or nearly the screen's refresh rate,
  // with the slowest frames above 30 under the heavy load)
  results(r) {
    const S = {};
    for (const st of r.stages) (S[st.p] = S[st.p] || {})[st.l.n] = this.stats(st);
    const bar = Math.min(50, r.hz * 0.9);
    let rec = this.PRESETS[0];
    for (const p of this.PRESETS) { const h = S[p] && S[p].Heavy; if (h && h.fps >= bar && h.low >= 30) rec = p; }
    const cell = (s) => s ? `<b>${Math.round(s.fps)}</b> fps<div style="font-size:10px;color:#999">1% low ${Math.round(s.low)} · ${s.ms.toFixed(1)} ms</div>` : '-';
    const head = this.LOADS.map(l => `<th style="padding:4px 8px;font-weight:normal;color:#aaa">${l.n}<div style="font-size:10px">${l.z} zombies</div></th>`).join('');
    const rows = this.PRESETS.map(p => `<tr${p === rec ? ' style="background:rgba(200,148,90,0.15)"' : ''}><td style="padding:4px 8px">${p}${p === rec ? ' ✓' : ''}</td>${this.LOADS.map(l => `<td style="padding:4px 8px;text-align:center">${cell(S[p][l.n])}</td>`).join('')}</tr>`).join('');
    $('#menu').innerHTML = `<div class="modal"><div class="mbox wide"><h2>Benchmark results</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th></th>${head}</tr>${rows}</table>
      <div class="sml" style="margin:10px 0">Frames a second (screen refresh about ${Math.round(r.hz)} Hz), the slowest 1% of frames, and the time the game worked on each frame.
      Recommended: <b>${rec}</b> - the highest preset that stays smooth with a heavy crowd.</div>
      <div class="btn big" data-bres="use">Use ${rec}</div><div class="btn big" data-bres="back">Back</div></div></div>`;
    $('#menu').onclick = (e) => {
      const b = e.target.closest('[data-bres]');
      if (!b) return;
      if (b.dataset.bres === 'use') Settings.usePreset(rec);
      Menu.setTab = 'opt'; Menu.options(false);
    };
  },
};
