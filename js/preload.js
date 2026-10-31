'use strict';
// ---------------------------------------------------------------------------
// The loading screen before play (a new game, a save): what would otherwise be made the first time it is needed -
// a hitch in the middle of play - is made up front: the sound clips, every item's icon, the 3D renderer, and the
// pictures of the town for a few screens round the survivor (walls, roofs, ground, furniture, trees, the dead and
// the living), out-of-view furniture included. Not the whole map: it would not fit in the picture caches, which
// would only throw the first of it away again.
// ---------------------------------------------------------------------------
const Preload = {
  busy: false,
  wait: (ms) => new Promise(r => setTimeout(r, ms)),
  // show(title, step, fraction) draws the loading screen
  async run(show) {
    this.busy = true;
    const mode0 = G.mode;
    // (nothing moves meanwhile: the main loop runs neither the game nor its drawing while the mode is 'loading')
    G.mode = 'loading';
    try {
      const steps = [['Sounds', () => this.sounds()], ['Item pictures', () => this.icons()], ['Characters', () => this.chars()], ['The town around you', (f) => this.town(f)]];
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
    this.busy = false;
  },
  // the clips rendered at start-up (and, served over the web, the sound files) - waited for, up to a few seconds
  async sounds() {
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
    for (let k = 0; k < spots.length; k++) {
      cam.x = cx + spots[k][0] * D; cam.y = cy + spots[k][1] * D;
      for (let f = 0; f < 3; f++) Render.frame(0.016);
      step((k + 1) / spots.length);
      await this.wait(0);
    }
    Render.warming = false;
    cam.x = keep.x; cam.y = keep.y; cam.z = keep.z;
    Render.frame(0.016);
  },
};
