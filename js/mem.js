'use strict';
// ---------------------------------------------------------------------------
// Memory budget (Settings > Experimental > Memory budget, 1 GB by default). Most of the game's memory is pictures
// painted once and kept: wall faces, furniture, ground chunks, roofs, trees, cars and their darkened twins. Once a
// second the total is estimated; over the budget, the caches are trimmed (least recently drawn first) and their caps
// lowered (Mem.k scales CACHE_K) until it fits, and let out again slowly when there is room. What is on screen is
// never dropped, so a budget too small for the view costs repainting, not missing pictures.
// The estimate is of the game's tab and the browser's graphics process together. Measured in Chromium: a kept picture
// costs about 2.4 times its pixels' bytes (the canvas and its copy on the graphics side), and the two processes
// need about 280 MB before any (the browser's own share, fonts, the GL atlases); plus the JavaScript heap.
// ---------------------------------------------------------------------------
const Mem = {
  k: 1, t: 0, est: null,
  BASE_MB: 280, PIC_K: 2.4,
  budgetMB() { return Settings.v.memBudget || 1024; },
  // bytes held by each cache
  measure() {
    const px = (c) => (c ? c.width * c.height : 0);
    let spr = 0, sil = 0, wall = 0, chunks = 0;
    for (const r of Spr.cache.values()) { spr += px(r.c); sil += px(r.sil); }
    for (const r of Spr.wcache.values()) { wall += px(r.c); sil += px(r.sil); }
    for (const ch of Render.chunks.values()) chunks += px(ch.c);
    const B = {
      sprites: spr * 4, walls: wall * 4, shading: sil * 4, ground: chunks * 4, roofs: (Facade.rpx || 0) * 4,
      trees: (Trees.px || 0) * 4, cars: CarArt.bytes || 0,
      characters: (C3Imp.cv ? C3Imp.W * C3Imp.H * 4 : 0) + px(GL3D.cv) * 8 + px(GL3D.c2) * 4,
    };
    let caches = 0;
    for (const n in B) caches += B[n];
    const heap = performance.memory ? performance.memory.usedJSHeapSize : 120 * 1048576;
    return { B, caches, heap, totalMB: Math.round((caches * this.PIC_K + heap) / 1048576 + this.BASE_MB) };
  },
  // once a second, from the main loop (any screen)
  tick(dt) {
    this.t += dt;
    if (this.t < 1) return;
    this.t = 0;
    const m = this.est = this.measure(), budget = this.budgetMB();
    if (m.totalMB > budget) {
      this.k = Math.max(0.2, this.k * 0.8);
      this.trim(budget);
      this.est = this.measure();
    } else if (m.totalMB < budget * 0.75 && this.k < 1) this.k = Math.min(1, this.k * 1.08);
  },
  // drop what has not been drawn lately until the estimate fits: first the darkened twins (cheap to make again),
  // then whole pictures, oldest first
  trim(budget) {
    const ft = Facade.tick, old = ft - 60;
    const over = () => this.measure().totalMB > budget;
    for (const r of Spr.cache.values()) if (r.sil && r.u < old) r.sil = null;
    for (const r of Spr.wcache.values()) if (r.sil && r.u < old) r.sil = null;
    if (Trees.cache) for (const r of Trees.cache.values()) if (r.sil && r.u < Trees.tick - 60) { Trees.px -= r.spx || 0; r.sil = null; }
    if (!over()) return;
    const lru = (map, keep, size) => {
      const arr = [];
      for (const [key, r] of map) if (r.u < keep) arr.push([key, r]);
      arr.sort((a, b) => a[1].u - b[1].u);
      const cut = Math.ceil(arr.length * 0.5);
      for (let i = 0; i < cut; i++) { map.delete(arr[i][0]); if (size) size(arr[i][1]); }
    };
    lru(Spr.cache, ft - 120, (r) => Spr.drop(r));
    lru(Spr.wcache, ft - 2, (r) => Spr.drop(r));
    lru(Facade.rcache, ft - 2, (r) => { Facade.rpx -= r.c.width * r.c.height; });
    // ground chunks off screen (the cap follows CACHE_K; drawGround trims to it)
    const tick = Render.chunkTick || 0, ch = [...Render.chunks].filter(e => e[1].used < tick).sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < Math.ceil(ch.length * 0.5); i++) Render.chunks.delete(ch[i][0]);
    if (Trees.evict) { const p0 = Trees.PXCAP; Trees.PXCAP = p0 * this.k; Trees.evict(); Trees.PXCAP = p0; }
    if (CarArt.cache) while (CarArt.bytes > CarArt.cap * CACHE_K() && CarArt.cache.size > 12) {
      const k0 = CarArt.cache.keys().next().value, r0 = CarArt.cache.get(k0);
      CarArt.bytes -= r0.bytes * (r0.sil ? 2 : 1); CarArt.cache.delete(k0);
    }
  },
  // one line for the frame counter and the performance report
  text() {
    const m = this.est || this.measure(), B = m.B, MB = (b) => Math.round(b / 1048576);
    return `memory ~${m.totalMB} / ${this.budgetMB()} MB (pictures ${MB(m.caches)}: walls ${MB(B.walls)}, shading ${MB(B.shading)}, ground ${MB(B.ground)}, other ${MB(m.caches - B.walls - B.shading - B.ground)}; heap ${MB(m.heap)})${this.k < 1 ? ' · caches at ' + Math.round(this.k * 100) + '%' : ''}`;
  },
};
