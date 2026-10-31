'use strict';
// ---------------------------------------------------------------------------
// The loading screen before play (a new game, a save): what would otherwise be made the first time it is needed -
// a hitch in the middle of play - is made up front: the sound clips, every item's icon, the 3D renderer, and the
// pictures of the town for a few screens round the survivor (walls, roofs, ground, furniture, trees, the dead and
// the living), out-of-view furniture included, by day, by night and in the rain; then the effects are sprayed behind
// the screen (blood, gore, shots, flashes, smoke, casings) and taken away again, and the zombies think a few times
// with no time passing - so the browser has the game's code compiled, not just its pictures made. From a file, every
// sound is played once at no volume (at 16x) and kept loaded. Not the whole map: it would not fit in the picture
// caches, which would only throw the first of it away again.
// ---------------------------------------------------------------------------
const Preload = {
  busy: false,
  wait: (ms) => new Promise(r => setTimeout(r, ms)),
  // show(title, step, fraction) draws the loading screen
  async run(show) {
    this.busy = true;
    const mode0 = G.mode, on0 = typeof Sfx !== 'undefined' && Sfx.on;
    // (nothing moves meanwhile: the main loop runs neither the game nor its drawing while the mode is 'loading'; and
    // nothing is heard - a casing bouncing, a groan - while the effects and the zombies are run behind the screen)
    G.mode = 'loading';
    if (on0) Sfx.on = false;
    try {
      const steps = [['Sounds', (f) => this.sounds(f)], ['Item pictures', () => this.icons()], ['Characters', () => this.chars()], ['The town around you', (f) => this.town(f)], ['Effects', () => this.effects()], ['Zombies', () => this.zombies()]];
      for (let s = 0; s < steps.length; s++) {
        const [name, fn] = steps[s];
        show(name, s / steps.length);
        await this.wait(20);
        await fn((f) => show(name, (s + f) / steps.length));
      }
      show('Ready', 1);
      await this.wait(20);
    } catch (e) { console.warn('preload', e); }
    G.mode = mode0;
    if (on0) Sfx.on = true;
    this.busy = false;
  },
  // the clips rendered at start-up (and, served over the web, the sound files) - waited for, up to a few seconds
  async sounds(step) {
    if (typeof AudioFiles !== 'undefined' && AudioFiles.mode === 'el' && AudioFiles.warm) await AudioFiles.warm(step);
    const t0 = performance.now(), done = () => (typeof SfxBank === 'undefined' || SfxBank.ready || !SfxBank.busy) && (typeof AudioFiles === 'undefined' || AudioFiles.mode !== 'buf' || AudioFiles.ok);
    while (!done() && performance.now() - t0 < 8000) await this.wait(100);
  },
  async icons() {
    const ids = Object.keys(ITEMS);
    for (let i = 0; i < ids.length; i++) {
      try { Icons.canvas({ id: ids[i] }); FloorItems.metaOf({ id: ids[i] }); } catch (e) { /* an item without an icon */ }
      if (i % 40 === 39) await this.wait(0);
    }
  },
  async chars() { if (typeof GL3D !== 'undefined') GL3D.ok(); },
  // a 3 x 3 block of screens round the survivor, drawn a few frames each (roofs are painted a few a frame)
  async town(step) {
    const p = G.player, cam = Render.cam;
    if (!p || !Wd) return;
    const cx = p.inCar ? p.inCar.x : p.x, cy = p.inCar ? p.inCar.y : p.y, D = 16, spots = [[0, 0]];
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (dx || dy) spots.push([dx, dy]);
    const keep = { x: cam.x, y: cam.y, z: cam.z };
    Render.warming = true;
    // (out from the middle until the picture caches are 70% full: past that the first of it would be thrown away)
    const full = () => Spr.wcache.size > Spr.WCAP * CACHE_K() * 0.7 || Spr.cache.size > Spr.CAP * CACHE_K() * 0.7;
    for (let k = 0; k < spots.length; k++) {
      if (k && full()) break;
      cam.x = cx + spots[k][0] * D; cam.y = cy + spots[k][1] * D;
      for (let f = 0; f < 3; f++) Render.frame(0.016);
      step((k + 1) / spots.length);
      await this.wait(0);
    }
    // where the survivor is, at night and in the rain too (the light and the weather put back after)
    cam.x = cx; cam.y = cy;
    const L0 = Object.assign({}, G.light), W0 = Object.assign({}, G.weather);
    for (const [amb, rain] of [[0.3, 0], [0.62, 1], [1, 1]]) { G.light.amb = amb; G.weather.rain = rain; for (let f = 0; f < 3; f++) Render.frame(0.016); await this.wait(0); }
    Object.assign(G.light, L0); Object.assign(G.weather, W0);
    Render.warming = false;
    cam.x = keep.x; cam.y = keep.y; cam.z = keep.z;
    Render.frame(0.016);
  },
  // blood, gore, shots, flashes, smoke and casings sprayed round the survivor behind the screen, drawn and moved for a
  // dozen frames, then all of it taken away again (the decals as they were, the particle lists emptied)
  async effects() {
    const p = G.player;
    if (!p || !Wd) return;
    const x = p.inCar ? p.inCar.x : p.x, y = p.inCar ? p.inCar.y : p.y;
    // (put back by name: some of these lists are replaced by new ones as they update)
    const keep = [];
    for (const o of [Fx, typeof Gore !== 'undefined' ? Gore : null]) if (o) for (const k in o) if (Array.isArray(o[k])) keep.push([o, k, o[k].slice()]);
    const dec0 = Wd.decals.slice();
    try {
      for (let k = 0; k < 4; k++) Fx.blood(x + k - 1.5, y + 1, 8, k);
      if (typeof Gore !== 'undefined') {
        Gore.burst(x + 1, y, 1.1, 12, 0, Math.PI, 0.5, 2.5, 0, 2); Gore.mist(x, y + 1, 1.2, 1, 6); Gore.gibs(x - 1, y, 0.8, 4, 2);
        for (const [t, s] of [['drops', 0.5], ['pool', 0.9], ['splat', 0.7], ['streak', 0.8]]) Gore.dec(t, x + Math.random() * 3 - 1.5, y + Math.random() * 3 - 1.5, Math.random() * 6.28, s);
      }
      Fx.shards(x + 1, y + 1, 1, 6, '#a8c8d8'); Fx.smoke(x, y, 1, false); Fx.smoke(x + 1, y, 1, true);
      Fx.tracer(x, y, 1.2, x + 6, y + 3, 1.1); Fx.flash(x, y, 6, 0.8, 0.1);
      Fx.casing(x, y, 1.2, 0, 1, 0.5, 1.5, 'brass'); Fx.casing(x, y, 1.2, 0, -1, 0.5, 1.5, 'shell');
      Fx.scorch(x + 2, y - 1);
      for (let f = 0; f < 12; f++) { Fx.update(0.03); Render.frame(0.016); if (f % 4 === 3) await this.wait(0); }
    } finally {
      for (const [o, k, c] of keep) o[k] = c;
      Wd.decals = dec0;
    }
  },
  // the zombies think a few times with no time to speak of passing (the browser compiles the code they run)
  async zombies() {
    if (!G.zombies || !G.player) return;
    for (let k = 0; k < 4; k++) { Zombie.updateAll(0.001); await this.wait(0); }
  },
};
