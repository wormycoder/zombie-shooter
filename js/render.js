'use strict';
// ---------------------------------------------------------------------------
// Isometric renderer
// ---------------------------------------------------------------------------
// extension registries: DECAL_ART[kind] = (ctx, d, X, Y) draws a decal with string kind d.k;
// FLOOR_HOOKS functions (ctx, minX, minY, maxX, maxY) draw on the ground after decals.
const DECAL_ART = {};
const FLOOR_HOOKS = [];
const Render = {
  cam: { x: 120, y: 120, z: 0, zoom: 1.25, tz: 1.25 },
  init(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.lcv = mkCanvas(64, 64);
    this.lctx = this.lcv.getContext('2d');
    this.lcv1 = mkCanvas(64, 64);
    this.lctx1 = this.lcv1.getContext('2d');
    this.lightB = new Float32Array(1);
    this.shadeB = new Float32Array(1);
    this.lightB1 = new Float32Array(1);
    this.shadeB1 = new Float32Array(1);
    window.addEventListener('resize', () => this.resize());
    Settings.onChange(() => { this.resize(); this.chunks.clear(); });
    this.resize();
  },
  resize() {
    this.dpr = Settings.dpr();
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = Math.floor(this.W * this.dpr); this.cv.height = Math.floor(this.H * this.dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
  },
  camIX: 0, camIY: 0,
  // world -> screen. Tiles of the upper floor (x >= LV.W0) are drawn one storey up.
  toScreen(x, y, z) {
    if (x >= LV.W0) { x -= LV.W0; z = (z || 0) + WALL_H; }
    const z0 = this.cam.zoom;
    return [((x - y) * HTW - this.camIX) * z0 + this.W / 2, ((x + y) * HTH - (z || 0) * ZU - this.camIY) * z0 + this.H / 2];
  },
  // screen -> ground-plane world coords
  toWorld(sx, sy) {
    const z0 = this.cam.zoom;
    const X = (sx - this.W / 2) / z0 + this.camIX, Y = (sy - this.H / 2) / z0 + this.camIY;
    return [(X / HTW + Y / HTH) / 2, (Y / HTH - X / HTW) / 2];
  },
  // screen -> world coords on the floor of level lv
  toWorldL(sx, sy, lv) {
    if (!lv) return this.toWorld(sx, sy);
    const w = this.toWorld(sx, sy + WALL_H * ZU * this.cam.zoom);
    return [w[0] + LV.W0, w[1]];
  },
  plv() { const p = G.player; return p && !p.dead && !p.inCar && p.x >= LV.W0 ? 1 : 0; },
  mouseWorld() {
    const p = G.player, lv = this.plv();
    if (!lv && p && !p.dead && !p.inCar) { const zf = World.stairZ(p); if (zf > 0) return this.toWorld(Input.mx, Input.my + zf * ZU * this.cam.zoom); }
    return this.toWorldL(Input.mx, Input.my, lv);
  },
  // world-pixel position of a point (level aware)
  P(x, y, z) {
    if (x >= LV.W0) { x -= LV.W0; z = (z || 0) + WALL_H; }
    return [(x - y) * HTW, (x + y) * HTH - (z || 0) * ZU];
  },
  // visual height of an entity's feet (upstairs or part way up a staircase)
  entZ(e) { return e.x >= LV.W0 ? WALL_H : World.stairZ(e); },
  epos(e, zo) {
    const up = e.x >= LV.W0, x = up ? e.x - LV.W0 : e.x;
    const z = (up ? WALL_H : World.stairZ(e)) + (zo || 0);
    return [(x - e.y) * HTW, (x + e.y) * HTH - z * ZU];
  },
  shadeAt(x, y) {
    let B = this.shadeB;
    if (x >= LV.W0) { x -= LV.W0; B = this.shadeB1; if (!this.has1) return 0.3; }
    const i = Math.floor(x) - this.vx0, j = Math.floor(y) - this.vy0;
    if (i < 0 || j < 0 || i >= this.vw || j >= this.vh) return 0.3;
    return B[j * this.vw + i];
  },
  shadeSmooth(x, y) {
    const fx = x - 0.5, fy = y - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const a = this.shadeAt(x0, y0), b = this.shadeAt(x0 + 1, y0), c = this.shadeAt(x0, y0 + 1), d = this.shadeAt(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  },
  lightAt(x, y) {
    let B = this.lightB;
    if (x >= LV.W0) { x -= LV.W0; B = this.lightB1; if (!this.has1) return 0.3; }
    const i = Math.floor(x) - this.vx0, j = Math.floor(y) - this.vy0;
    if (i < 0 || j < 0 || i >= this.vw || j >= this.vh) return 0.3;
    return B[j * this.vw + i];
  },
  // building id an upstairs wall edge belongs to, and whether it is an outside wall
  edgeB(x, y, d) {
    const w = Wd;
    const ra = World.room(x, y), rb = d ? World.room(x - 1, y) : World.room(x, y - 1);
    const ba = ra >= 0 ? w.rooms[ra].b : -1, bb = rb >= 0 ? w.rooms[rb].b : -1;
    this._ext = ba !== bb;
    return ba >= 0 ? ba : bb;
  },

  // ------------------------------------------------------------------ frame
  frame(dt) {
    const w = Wd, ctx = this.ctx, cam = this.cam, p = G.player;
    if (!w) return;
    const W0 = LV.W0, HH = WALL_H;
    cam.zoom += (cam.tz - cam.zoom) * Math.min(1, dt * 10);
    const z = cam.zoom, dpr = this.dpr;
    this.camIX = (cam.x - cam.y) * HTW;
    this.camIY = (cam.x + cam.y) * HTH - 0.8 * ZU - (cam.z || 0) * ZU;
    if (p && !p.dead && p.st && p.st.drunk > 0.25) {
      const t2 = performance.now() / 1000, k = (p.st.drunk - 0.25) * 28;
      this.camIX += Math.sin(t2 * 0.9) * k; this.camIY += Math.sin(t2 * 0.7 + 1) * k * 0.6;
    }
    const ox = this.W / 2 - this.camIX * z, oy = this.H / 2 - this.camIY * z;
    this.ox = ox; this.oy = oy;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.imageSmoothingEnabled = true;
    // iso-pixel bounds of screen
    const L = (0 - ox) / z, Rr = (this.W - ox) / z, T = (0 - oy) / z, B = (this.H - oy) / z;
    this.scr = { L, R: Rr, T, B };
    // tile bounds (ground map only; the upper floors are looked up at x + W0)
    const cs = [this.toWorld(0, 0), this.toWorld(this.W, 0), this.toWorld(0, this.H), this.toWorld(this.W, this.H)];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cs) { minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]); maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1]); }
    const GW = w.gw || w.w;
    minX = Math.max(0, Math.floor(minX) - 2); minY = Math.max(0, Math.floor(minY) - 2);
    maxX = Math.min(GW - 1, Math.ceil(maxX) + 8); maxY = Math.min(w.h - 1, Math.ceil(maxY) + 8);
    this.vx0 = minX; this.vy0 = minY; this.vw = maxX - minX + 1; this.vh = maxY - minY + 1;
    // which buildings show an upper floor, and how
    const live = p && (!p.dead || G.corpse);
    const plv = live && p.x >= W0 ? 1 : 0;
    this.plv_ = plv;
    const pb = live ? World.building(Math.floor(p.x), Math.floor(p.y)) : null;
    this.pb = pb;
    const openB = plv && pb && pb.floors === 2 ? pb : null;
    const hiddenId = !plv && pb && pb.floors === 2 ? pb.id : -1;
    let any2 = false;
    for (const b of w.buildings) if (b.floors === 2 && !(b.x1 < minX - 2 || b.x0 > maxX || b.y1 < minY - 2 || b.y0 > maxY)) { any2 = true; break; }
    this.has1 = any2;
    this.computeLight();
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
    // ---------------- floor pass (cached 8x8-tile ground chunks; water animates live)
    const W_ = w.w;
    const t = performance.now() / 1000;
    const gs = Season.grass === 'g' ? '' : Season.grass;
    const snowA = Math.round(Math.min(1, Season.snow * 1.15) * 0.94 * 20) / 20;
    this.drawGround(ctx, minX, minY, maxX, maxY, L, Rr, T, B, t, gs, snowA);
    // decals
    const dec1 = new Map();
    for (const d of w.decals) {
      if (d.x >= W0 - 0.5) {
        if (openB) { const k = Math.floor(d.y + 0.5) * W_ + Math.floor(d.x + 0.5); let a = dec1.get(k); if (!a) { a = []; dec1.set(k, a); } a.push(d); }
        continue;
      }
      if (d.x < minX || d.x > maxX + 1 || d.y < minY || d.y > maxY + 1) continue;
      this.drawDecal(ctx, d, 0);
    }
    ctx.globalAlpha = 1;
    // ground-level overlays from other modules (tyre marks etc.), drawn under entities
    for (const fn of FLOOR_HOOKS) fn(ctx, minX, minY, maxX, maxY);
    // floor items
    for (const [i, arr] of w.items) {
      const x = i % W_, y = (i / W_) | 0;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      this.drawItems(ctx, x, y, arr, 0);
    }
    // corpses & downed bodies (flat things)
    const flat1 = new Map();
    for (const zb of G.zombies) {
      if (!(zb.dead && (zb.lie || 0) >= 0.99)) continue;
      if (zb.x >= W0) {
        if (openB) { const k = Math.floor(zb.y) * W_ + Math.floor(zb.x); let a = flat1.get(k); if (!a) { a = []; flat1.set(k, a); } a.push(zb); }
        continue;
      }
      if (zb.x < minX - 2 || zb.x > maxX + 2 || zb.y < minY - 2 || zb.y > maxY + 2) continue;
      Zombie.draw(ctx, zb, true);
    }
    if (G.corpse && p && p.dead && p.x < W0) Player.draw(ctx);
    // ---------------- light overlay on floors
    this.drawLightOverlay();
    // ---------------- main pass
    const buckets = new Map();
    const addB = (x, y, e, k) => { const key = Math.floor(y) * W_ + Math.floor(x); let a = buckets.get(key); if (!a) { a = []; buckets.set(key, a); } a.push([k, e]); };
    if (p && !p.dead && !p.inCar) addB(p.x, p.y, p, 'p');
    if (G.corpse && p && p.dead && p.x >= W0) addB(p.x, p.y, p, 'p');
    for (const zb of G.zombies) {
      if (zb.dead && (zb.lie || 0) >= 0.99) continue;
      const ex = zb.x >= W0 ? zb.x - W0 : zb.x;
      if (ex < minX - 2 || ex > maxX + 2 || zb.y < minY - 2 || zb.y > maxY + 2) continue;
      addB(zb.x, zb.y, zb, 'z');
    }
    for (const c of G.cars) {
      if (c.x < minX - 3 || c.x > maxX + 3 || c.y < minY - 3 || c.y > maxY + 3) continue;
      addB(c.x, c.y, c, 'c');
    }
    // buildings roofs by diagonal
    const roofs = new Map();
    for (const b of w.buildings) {
      if (b.x1 < minX - 2 || b.x0 > maxX || b.y1 < minY - 2 || b.y0 > maxY) continue;
      if (pb && b.id === pb.id) continue;
      const d = b.x1 + b.y1;
      let a = roofs.get(d); if (!a) { a = []; roofs.set(d, a); } a.push(b);
    }
    const pp = live ? this.epos(p) : [0, 0];
    const PX = pp[0], PY = pp[1];
    this.PX = PX; this.PY = PY;
    // stairwell opening of the floor the player stands on: ground floor stuff is only seen through it
    let openPath = null, see = null;
    if (openB) {
      openPath = new Path2D(); see = new Set();
      for (let y = openB.y0; y <= openB.y1; y++) for (let x = openB.x0; x <= openB.x1; x++) {
        const o = w.obj[y * W_ + x + W0];
        if (!o || (o.t !== 'railing' && o.t !== 'stairtop')) continue;
        const X = (x - y) * HTW, Y = (x + y) * HTH - HH * ZU;
        openPath.moveTo(X, Y); openPath.lineTo(X + HTW, Y + HTH); openPath.lineTo(X, Y + TH); openPath.lineTo(X - HTW, Y + HTH); openPath.closePath();
        for (let yy = y - 4; yy <= y + 1; yy++) for (let xx = x - 4; xx <= x + 1; xx++) see.add(yy * W_ + xx);
      }
    }
    const pl = live ? p : null;
    const upReady = openB ? this.prepUpFloor(openB, dec1) : false;
    const FM = w.fire && w.fire.size ? w.fire : null;
    // fires inside closed-up buildings show as flames breaking through the roof
    const roofFire = new Map();
    if (FM) for (const [i, e] of FM) {
      if (e.i < 0.45) continue;
      const r = w.room[i];
      if (r < 0) continue;
      const bid = w.rooms[r].b;
      let a = roofFire.get(bid); if (!a) { a = []; roofFire.set(bid, a); }
      if (a.length < 24) a.push([i % W_ >= W0 ? i % W_ - W0 : i % W_, (i / W_) | 0, e, i]);
    }
    const dMin = minX + minY, dMax = maxX + maxY;
    for (let d = dMin; d <= dMax; d++) {
      const xa = Math.max(minX, d - maxY), xb = Math.min(maxX, d - minY);
      // ---- ground level
      for (let x = xa; x <= xb; x++) {
        const y = d - x;
        const X = (x - y) * HTW, Y = (x + y) * HTH;
        if (X < L - 110 || X > Rr + 110 || Y < T - 40 || Y > B + 280) continue;
        const i = y * W_ + x;
        const inOpen = openB && x >= openB.x0 && x <= openB.x1 && y >= openB.y0 && y <= openB.y1;
        const bk = buckets.get(i);
        if (inOpen) {
          if (!see.has(i)) continue;
          if (w.wallN[i] || w.wallW[i] || w.obj[i] || (FM && FM.has(i))) {
            ctx.save(); ctx.clip(openPath);
            if (w.wallN[i]) this.drawWall(x, y, 0, X, Y, pb, pl, 0);
            if (w.wallW[i]) this.drawWall(x, y, 1, X, Y, pb, pl, 0);
            if (w.obj[i]) this.drawObj(w.obj[i], x, y, X, Y, pl, t, x);
            if (FM && FM.has(i)) Fire.drawFlames(ctx, X, Y, FM.get(i), t, i * 0.37);
            ctx.restore();
          }
          if (bk) for (const [k, e] of bk) {
            // whatever rises above the upper floor (someone on the stairs) shows outside the opening too
            const cp = new Path2D(openPath);
            const yl = (e.x + e.y) * HTH - HH * ZU;
            cp.rect(L - 200, T - 600, (Rr - L) + 400, yl - (T - 600));
            ctx.save(); ctx.clip(cp);
            this.drawEnt(ctx, k, e);
            ctx.restore();
          }
          continue;
        }
        if (w.wallN[i]) this.drawWall(x, y, 0, X, Y, pb, pl, 0);
        if (w.wallW[i]) this.drawWall(x, y, 1, X, Y, pb, pl, 0);
        const o = w.obj[i];
        if (o) this.drawObj(o, x, y, X, Y, pl, t, x);
        if (FM) { const fe = FM.get(i); if (fe) Fire.drawFlames(ctx, X, Y, fe, t, i * 0.37); }
        if (bk) {
          if (bk.length > 1) bk.sort((a, b) => (a[1].x + a[1].y) - (b[1].x + b[1].y));
          for (const [k, e] of bk) this.drawEnt(ctx, k, e);
        }
      }
      // ---- upper floors
      if (any2) {
        if (upReady) {
          if (d === dMin) this.drawUpFloor(ctx, openB, d, flat1);
          this.drawUpFloor(ctx, openB, d + 1, flat1);
        }
        for (let x = xa; x <= xb; x++) {
          const y = d - x;
          const i1 = y * W_ + x + W0;
          const wn = w.wallN[i1], ww = w.wallW[i1], o = w.obj[i1], bk = buckets.get(i1);
          if (!wn && !ww && !o && !bk && !(FM && FM.has(i1))) continue;
          const X = (x - y) * HTW, Y = (x + y) * HTH - HH * ZU;
          if (X < L - 110 || X > Rr + 110 || Y < T - 40 || Y > B + 200) continue;
          if (wn && wn !== WT.BOUND) {
            const bid = this.edgeB(x + W0, y, 0);
            if (bid >= 0 && bid !== hiddenId && ((openB && bid === openB.id) || this._ext)) this.drawWall(x + W0, y, 0, X, Y, pb, pl, 1);
          }
          if (ww && ww !== WT.BOUND) {
            const bid = this.edgeB(x + W0, y, 1);
            if (bid >= 0 && bid !== hiddenId && ((openB && bid === openB.id) || this._ext)) this.drawWall(x + W0, y, 1, X, Y, pb, pl, 1);
          }
          if (!openB || x < openB.x0 || x > openB.x1 || y < openB.y0 || y > openB.y1) continue;
          if (o) this.drawObj(o, x + W0, y, X, Y, pl, t, x);
          if (FM) { const fe = FM.get(i1); if (fe) Fire.drawFlames(ctx, X, Y, fe, t, i1 * 0.37); }
          if (bk) {
            if (bk.length > 1) bk.sort((a, b) => (a[1].x + a[1].y) - (b[1].x + b[1].y));
            for (const [k, e] of bk) this.drawEnt(ctx, k, e);
          }
        }
      }
      const rl = roofs.get(d);
      if (rl) for (const b of rl) {
        if (!b.roofGone) this.drawRoof(b, p);
        const rf = roofFire.get(b.id);
        if (rf) for (const [fx, fy, fe, fi] of rf) {
          if (b.roofGone && fi % W_ < W0) continue;
          const zz = b.roofGone ? WALL_H : WALL_H * (b.floors || 1) + 0.6;
          Fire.drawFlames(ctx, (fx - fy) * HTW, (fx + fy) * HTH - zz * ZU, fe, t, fi * 0.37);
          if (R.chance(0.08)) Fx.smoke(fx + 0.5, fy + 0.5, zz + 0.3, true);
        }
      }
    }
    // ---------------- overlays in world space
    Fx.draw(ctx);
    if (G.build) Build.drawGhost(ctx);
    if (G.hover) this.drawHover(ctx, G.hover);
    if (p && !p.dead) Player.drawOverlay(ctx);
    // ---------------- screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Weather.drawScreen(ctx, this.W, this.H, dt);
    this.drawVignette(ctx);
  },
  drawEnt(ctx, k, e) {
    if (k === 'p') Player.draw(ctx);
    else if (k === 'z') Zombie.draw(ctx, e, false);
    else if (k === 'c') Vehicles.draw(ctx, e);
  },
  // one ground tile: floor, markings, grass creeping over hard edges, snow. water: animate (else skipped)
  groundTile(g, x, y, X, Y, t, gs, snowA, detail, water) {
    const w = Wd, W_ = w.w, GW = w.gw, i = y * W_ + x, f = w.floor[i];
    let vx = (x * 7 + y * 13) & 3;
    const wet = f === FL.WATER || f === FL.DEEPWATER;
    if (wet) { if (!water) return; vx = (vx + Math.floor(t * 1.5 + (x + y) * 0.3)) & 3; }
    const rec = Spr.floor(f, w.fvar[i], vx, gs && (f === FL.GRASS || f === FL.GRASS2 || f === FL.FOREST) ? gs : '');
    g.drawImage(rec.c, X - rec.ax, Y - rec.ay);
    if (!detail) return;
    const dc = w.deco[i];
    if (dc) { const r2 = Spr.deco(dc); g.drawImage(r2.c, X - r2.ax, Y - r2.ay); }
    if (HARD_FLOORS[f] && w.room[i] < 0) {
      for (let dn = 0; dn < 4; dn++) {
        const nx = x + FR_DX[dn], ny = y + FR_DY[dn];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= w.h) continue;
        const nf = w.floor[ny * W_ + nx];
        if (nf === FL.GRASS || nf === FL.GRASS2 || nf === FL.FOREST) { const r3 = Spr.fringe(dn, nf, vx, gs); g.drawImage(r3.c, X - r3.ax, Y - r3.ay); }
      }
    }
    if (snowA > 0.02 && w.room[i] < 0 && !wet) {
      g.globalAlpha = f === FL.ASPHALT || f === FL.PARKING ? snowA * 0.68 : f === FL.SIDEWALK ? snowA * 0.85 : snowA;
      const rs = Spr.snow(vx); g.drawImage(rs.c, X - rs.ax, Y - rs.ay);
      g.globalAlpha = 1;
    }
  },
  // signature of everything a chunk's pixels depend on (its tiles plus a 1-tile border for grass edges)
  chunkSig(x0, y0, gs, snowA, detail) {
    const w = Wd, W_ = w.w, GW = w.gw, CH = 8;
    let h = (snowA * 100) | 0, wet = 0;
    h = (h * 31 + (gs ? gs.charCodeAt(0) : 0)) | 0; h = (h * 31 + detail) | 0;
    for (let y = Math.max(0, y0 - 1); y <= Math.min(w.h - 1, y0 + CH); y++) {
      let i = y * W_ + Math.max(0, x0 - 1);
      for (let x = Math.max(0, x0 - 1), x1 = Math.min(GW - 1, x0 + CH); x <= x1; x++, i++) {
        const f = w.floor[i];
        h = (Math.imul(h, 31) + f * 7919 + w.fvar[i] * 131 + w.deco[i] * 17 + (w.room[i] < 0 ? 1 : 2)) | 0;
        if ((f === FL.WATER || f === FL.DEEPWATER) && x >= x0 && x < x0 + CH && y >= y0 && y < y0 + CH) wet = 1;
      }
    }
    return [h, wet];
  },
  chunks: new Map(), chunkWorld: null, chunkTick: 0,
  drawGround(ctx, minX, minY, maxX, maxY, L, Rr, T, B, t, gs, snowA) {
    const w = Wd, CH = 8, detail = Settings.v.detail;
    if (this.noChunks) {
      // reference path (debug): every tile drawn directly
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const X = (x - y) * HTW, Y = (x + y) * HTH;
        if (X < L - 40 || X > Rr + 40 || Y < T - 40 || Y > B + 10) continue;
        this.groundTile(ctx, x, y, X, Y, t, gs, snowA, detail, true);
      }
      return;
    }
    if (this.chunkWorld !== w) { this.chunks.clear(); this.chunkWorld = w; }
    const tick = ++this.chunkTick;
    let budget = 6;
    const cx0 = Math.floor(minX / CH), cy0 = Math.floor(minY / CH), cx1 = Math.floor(maxX / CH), cy1 = Math.floor(maxY / CH);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const x0 = cx * CH, y0 = cy * CH;
      if (x0 >= w.gw || y0 >= w.h) continue;
      const ox = (x0 - y0 - CH) * HTW - 1, oy = (x0 + y0) * HTH - 1;
      if (ox + 2 * CH * HTW + 2 < L - 40 || ox > Rr + 40 || oy + 2 * CH * HTH + 2 < T - 40 || oy > B + 10) continue;
      const key = cy * 4096 + cx;
      const [sig, wet] = this.chunkSig(x0, y0, gs, snowA, detail);
      let ch = this.chunks.get(key);
      if (!ch || ch.sig !== sig) {
        if (budget > 0) {
          budget--;
          if (!ch) { ch = { c: mkCanvas(2 * CH * HTW + 2, 2 * CH * HTH + 2), sig: 0, used: 0, wet: 0 }; this.chunks.set(key, ch); }
          const g = ch.c.getContext('2d');
          g.clearRect(0, 0, ch.c.width, ch.c.height);
          for (let y = y0; y < y0 + CH && y < w.h; y++) for (let x = x0; x < x0 + CH && x < w.gw; x++) this.groundTile(g, x, y, (x - y) * HTW - ox, (x + y) * HTH - oy, t, gs, snowA, detail, false);
          ch.sig = sig; ch.wet = wet;
        } else {
          // over this frame's build budget: draw the tiles directly
          for (let y = y0; y < y0 + CH && y < w.h; y++) for (let x = x0; x < x0 + CH && x < w.gw; x++) this.groundTile(ctx, x, y, (x - y) * HTW, (x + y) * HTH, t, gs, snowA, detail, true);
          continue;
        }
      }
      ch.used = tick;
      ctx.drawImage(ch.c, ox, oy);
      if (ch.wet) for (let y = y0; y < y0 + CH && y < w.h; y++) for (let x = x0; x < x0 + CH && x < w.gw; x++) {
        const f = w.floor[y * w.w + x];
        if (f === FL.WATER || f === FL.DEEPWATER) this.groundTile(ctx, x, y, (x - y) * HTW, (x + y) * HTH, t, gs, snowA, detail, true);
      }
    }
    // keep the cache bounded (least recently drawn chunks go first)
    if (this.chunks.size > 140) {
      const arr = [...this.chunks.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let k = 0; k < arr.length - 110; k++) this.chunks.delete(arr[k][0]);
    }
  },
  drawDecal(ctx, d, lv) {
    const dx = lv ? d.x - LV.W0 : d.x;
    const X = (dx - d.y) * HTW, Y = (dx + d.y) * HTH - (lv ? WALL_H * ZU : 0);
    // custom decal kinds (string d.k) registered by other modules
    const da = typeof d.k === 'string' && DECAL_ART[d.k];
    if (da) { da(ctx, d, X, Y); ctx.globalAlpha = 1; return; }
    const rec = d.k ? Spr.scorch(d.v) : Spr.blood(d.v);
    ctx.globalAlpha = U.clamp(1 - d.age / 400, 0.25, 1) * (d.a || 1);
    const s = d.s || 1;
    ctx.drawImage(rec.c, X - rec.ax * s, Y - (rec.ay + 16) * s, rec.c.width * s, rec.c.height * s);
  },
  drawItems(ctx, x, y, arr, lv) {
    const vx = lv ? x - LV.W0 : x, zo = lv ? WALL_H * ZU : 0;
    for (const it of arr) {
      const X = (vx + it.fx - y - it.fy) * HTW, Y = (vx + it.fx + y + it.fy) * HTH - zo;
      ctx.drawImage(Icons.canvas(it), X - 9, Y - 12, 18, 18);
    }
  },
  // The floor of the storey the player is on is composited (tiles, decals, items, light) on an
  // offscreen layer once per frame, then copied in one diagonal at a time during the painter sweep.
  prepUpFloor(b, dec1) {
    const w = Wd, W_ = w.w, W0 = LV.W0, HH = WALL_H;
    const cw = this.cv.width, ch = this.cv.height;
    if (!this.ucv) { this.ucv = mkCanvas(cw, ch); this.uctx = this.ucv.getContext('2d'); }
    if (this.ucv.width !== cw || this.ucv.height !== ch) { this.ucv.width = cw; this.ucv.height = ch; }
    const g = this.uctx, z = this.cam.zoom, dpr = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * this.ox, dpr * this.oy);
    g.imageSmoothingEnabled = true;
    const clip = new Path2D();
    let n = 0;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i1 = y * W_ + x + W0;
      const f = w.floor[i1];
      if (f === FL.VOID) continue;
      const o = w.obj[i1];
      if (o && (o.t === 'railing' || o.t === 'stairtop')) continue;
      const X = (x - y) * HTW, Y = (x + y) * HTH - HH * ZU;
      const rec = Spr.floor(f, w.fvar[i1], (x * 7 + y * 13) & 3);
      g.drawImage(rec.c, X - rec.ax, Y - rec.ay);
      clip.moveTo(X, Y); clip.lineTo(X + HTW, Y + HTH); clip.lineTo(X, Y + TH); clip.lineTo(X - HTW, Y + HTH); clip.closePath();
      n++;
    }
    if (!n) return false;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i1 = y * W_ + x + W0;
      const dl = dec1.get(i1);
      if (dl) { for (const d of dl) this.drawDecal(g, d, 1); g.globalAlpha = 1; }
      const arr = w.items.get(i1);
      if (arr) this.drawItems(g, x + W0, y, arr, 1);
    }
    g.save();
    g.clip(clip);
    const s = dpr * z;
    g.setTransform(s * HTW, s * HTH, -s * HTW, s * HTH, dpr * (this.ox + z * (this.vx0 - this.vy0) * HTW), dpr * (this.oy + z * ((this.vx0 + this.vy0) * HTH - HH * ZU)));
    g.drawImage(this.lcv1, 0, 0);
    g.restore();
    return true;
  },
  drawUpFloor(ctx, b, dd, flat1) {
    const w = Wd, W_ = w.w, W0 = LV.W0, HH = WALL_H;
    const xa = Math.max(b.x0, dd - b.y1), xb = Math.min(b.x1, dd - b.y0);
    if (xa > xb) return;
    ctx.save();
    ctx.beginPath();
    let n = 0, minX = Infinity, maxX = -Infinity;
    const e = 1.2; // overlap neighbouring diagonals so antialiased clip edges leave no seams
    for (let x = xa; x <= xb; x++) {
      const y = dd - x, i1 = y * W_ + x + W0;
      if (w.floor[i1] === FL.VOID) continue;
      const o = w.obj[i1];
      if (o && (o.t === 'railing' || o.t === 'stairtop')) continue;
      const X = (x - y) * HTW, Y = (x + y) * HTH - HH * ZU;
      ctx.moveTo(X, Y - e); ctx.lineTo(X + HTW + e * 2, Y + HTH); ctx.lineTo(X, Y + TH + e); ctx.lineTo(X - HTW - e * 2, Y + HTH); ctx.closePath();
      n++; minX = Math.min(minX, X - HTW - 4); maxX = Math.max(maxX, X + HTW + 4);
    }
    if (n) {
      ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.ucv, 0, 0);
    }
    ctx.restore();
    for (let x = xa; x <= xb; x++) {
      const fl = flat1.get((dd - x) * W_ + x + W0);
      if (fl) for (const zb of fl) Zombie.draw(ctx, zb, true);
    }
  },

  // ------------------------------------------------------------------ lighting
  computeLight() {
    const w = Wd, p = G.player;
    const n = this.vw * this.vh;
    if (this.lightB.length < n) {
      const m = n * 1.3 | 0;
      this.lightB = new Float32Array(m); this.shadeB = new Float32Array(m);
      this.lightB1 = new Float32Array(m); this.shadeB1 = new Float32Array(m);
    }
    const amb = G.light.amb;
    const vx0 = this.vx0, vy0 = this.vy0, vw = this.vw, vh = this.vh, W_ = w.w, W0 = LV.W0;
    const powered = !G.events.powerOff;
    const lights = [];
    const layers = this.has1 ? 2 : 1;
    for (let lv = 0; lv < layers; lv++) {
      const LB = lv ? this.lightB1 : this.lightB, off = lv ? W0 : 0;
      for (let j = 0; j < vh; j++) {
        const y = vy0 + j;
        for (let i = 0; i < vw; i++) {
          const x = vx0 + i + off;
          const idx = y * W_ + x, k = j * vw + i;
          const r = w.room[idx];
          let l;
          if (r < 0) l = amb;
          else {
            l = amb * 0.74;
            const rm = w.rooms[r];
            if (rm.lights && (powered || World.hasPower(x, y))) l = Math.max(l, 0.9);
          }
          LB[k] = l;
          const o = w.obj[idx];
          if (o) {
            if (o.t === 'lamppost' && amb < 0.6 && powered) lights.push({ x: x + 0.5, y: y + 1, r: 7.5, p: 0.75, out: true });
            else if (o.t === 'lamp' && r >= 0 && w.rooms[r].lights && (powered || World.hasPower(x, y))) lights.push({ x: x + 0.5, y: y + 0.5, r: 4, p: 0.4, room: r });
            else if ((o.t === 'campfire' && o.lit) || (o.t === 'bbq' && o.lit)) lights.push({ x: x + 0.5, y: y + 0.5, r: 6, p: 0.85 + Math.sin(performance.now() / 90) * 0.06, warm: true });
            else if (o.t === 'tv' && o.on) lights.push({ x: x + 0.5, y: y + 0.5, r: 3, p: 0.3 });
            else {
              // generic emitters: OBJ[t].emit(o, x, y, amb, powered, room) -> light | null
              const em = OBJ[o.t] && OBJ[o.t].emit;
              if (em) { const lt = em(o, x, y, amb, powered, r); if (lt) lights.push(lt); }
            }
          }
        }
      }
    }
    for (const f of Fx.fires) lights.push({ x: f.x, y: f.y, r: 6, p: 0.9 });
    // facade sprite caches age by frame; a few roofs may be painted per frame
    Facade.tick++; Facade.rbudget = 3;
    // porch lanterns beside house doors, on after dark while the grid is up
    if (amb < 0.6 && powered) for (const L of Facade.lamps()) {
      if (L.x < vx0 - 4 || L.x > vx0 + vw + 4 || L.y < vy0 - 4 || L.y > vy0 + vh + 4 || L.b.roofGone) continue;
      lights.push({ x: L.x, y: L.y, r: 3.6, p: 0.5, out: true, warm: true });
    }
    if (amb < 0.6) {
      for (const rm of w.rooms) {
        if (!rm.lights) continue;
        const rx0 = rm.x0 >= W0 ? rm.x0 - W0 : rm.x0, rx1 = rm.x1 >= W0 ? rm.x1 - W0 : rm.x1;
        if (rx1 < vx0 - 4 || rx0 > vx0 + vw + 4 || rm.y1 < vy0 - 4 || rm.y0 > vy0 + vh + 4) continue;
        if (!powered && !World.hasPower(rm.x0, rm.y0)) continue;
        const spill = (ex, ey, d, ox, oy) => {
          const f = World.feat(ex, ey, d);
          if (!f || f.k !== 'window' || (f.barricade || 0) >= 2) return;
          if (World.room(ox, oy) >= 0) return;
          // light from an upstairs window falls on the ground below
          const up = ox >= W0, gx = up ? ox - W0 : ox;
          lights.push({ x: gx + 0.5 - (d ? (ox < ex ? -0.35 : 0.35) : 0) + (up ? 0.6 : 0), y: oy + 0.5 - (d ? 0 : (oy < ey ? -0.35 : 0.35)) + (up ? 0.6 : 0), r: up ? 4.2 : 3.6, p: (f.curtainsClosed && !f.smashed ? 0.16 : 0.34) * (up ? 0.6 : 1), out: true, warm: true });
        };
        for (let x = rm.x0; x <= rm.x1; x++) { spill(x, rm.y0, 0, x, rm.y0 - 1); spill(x, rm.y1 + 1, 0, x, rm.y1 + 1); }
        for (let y = rm.y0; y <= rm.y1; y++) { spill(rm.x0, y, 1, rm.x0 - 1, y); spill(rm.x1 + 1, y, 1, rm.x1 + 1, y); }
      }
    }
    if (w.fire && w.fire.size) {
      const fl = [];
      for (const [i, e] of w.fire) {
        const fx = i % W_, fy = (i / W_) | 0, vx = fx >= W0 ? fx - W0 : fx;
        if (vx < vx0 - 4 || vx > vx0 + vw + 4 || fy < vy0 - 4 || fy > vy0 + vh + 4) continue;
        fl.push([e.i, fx, fy]);
      }
      if (fl.length > 48) { fl.sort((a, b) => b[0] - a[0]); fl.length = 48; }
      const fk = 0.9 + Math.sin(performance.now() / 70) * 0.06;
      for (const [fi, fx, fy] of fl) lights.push({ x: fx + 0.5, y: fy + 0.5, r: 3.5 + fi * 3.5, p: (0.35 + fi * 0.55) * fk, fire: true });
    }
    for (const z of G.zombies) if (z.fire > 0 && Math.abs(vxOf(z.x) - (vx0 + vw / 2)) < vw && Math.abs(z.y - (vy0 + vh / 2)) < vh) lights.push({ x: z.x, y: z.y, r: 4, p: 0.6, fire: true });
    for (const fl of Fx.flashes) lights.push({ x: fl.x, y: fl.y, r: fl.r, p: fl.p * (fl.t / fl.max) });
    for (const c of G.cars) if (c.siren && c.engine && Math.floor(performance.now() / 200) % 2) lights.push({ x: c.x, y: c.y, r: 6, p: 0.45, out: true });
    for (const c of G.cars) if (c.lightsOn && c.engine && !c.burnt) {
      // no beam when both headlamps are broken or missing
      const pt = c.parts, lamp = (k) => !pt || typeof pt[k] !== 'number' || pt[k] >= 10;
      if (!lamp('lightFL') && !lamp('lightFR')) continue;
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      lights.push({ x: c.x + ca * 1.6, y: c.y + sa * 1.6, r: 11, p: 0.9, cone: c.a, cw: 0.5, ox: c.x + ca * 1.2, oy: c.y + sa * 1.2 });
    }
    if (p && !p.dead) {
      const fl = Player.flashlight();
      if (fl) lights.push({ x: p.x, y: p.y, r: 13, p: 0.95, cone: p.angle, cw: 0.42, vis: true });
      if (fl) lights.push({ x: p.x, y: p.y, r: 2.6, p: 0.35 });
    }
    for (const lt of lights) {
      const lv = lt.x >= W0 ? 1 : 0;
      if (lv >= layers) continue;
      const LB = lv ? this.lightB1 : this.lightB, off = lv ? W0 : 0;
      const lx = lt.x - off, r = lt.r;
      const ix0 = Math.max(vx0, Math.floor(lx - r)), ix1 = Math.min(vx0 + vw - 1, Math.ceil(lx + r));
      const iy0 = Math.max(vy0, Math.floor(lt.y - r)), iy1 = Math.min(vy0 + vh - 1, Math.ceil(lt.y + r));
      for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) {
        const dx = x + 0.5 - lx, dy = y + 0.5 - lt.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= r) continue;
        const ax = x + off, idx = y * W_ + ax;
        const rm = w.room[idx];
        if (lt.out && rm >= 0) continue;
        if (lt.room !== undefined && rm !== lt.room) continue;
        let f = lt.p * Math.pow(1 - d / r, 1.4);
        if (lt.cone !== undefined) {
          const a = Math.atan2(dy, dx);
          const ad = Math.abs(U.angDiff(lt.cone, a));
          if (d > 1.2) { if (ad > lt.cw) continue; f *= 1 - Math.pow(ad / lt.cw, 2) * 0.6; }
          if (lt.vis && World.visGen[idx] !== World.gen) continue;
          if (lt.ox !== undefined && !World.lineClear(lt.ox, lt.oy, ax + 0.5, y + 0.5, 'sight')) continue;
        } else if (!lt.out && lt.room === undefined && d > 1.5 && !(lt.fire && d < 2.6) && !World.lineClear(lt.x, lt.y, ax + 0.5, y + 0.5, 'sight')) continue;
        const k = (y - vy0) * vw + (x - vx0);
        LB[k] = Math.min(1.15, LB[k] + f);
      }
    }
    // visibility
    const gen = World.gen, VG = World.visGen;
    const plv = p && !p.dead && p.x >= W0 ? 1 : 0;
    const px = p ? (plv ? p.x - W0 : p.x) : 0, py = p ? p.y : 0;
    const nightMin = p && Player.hasTrait('catseyes') ? 0.22 : 0.15;
    const dead = !p || p.dead;
    for (let lv = 0; lv < layers; lv++) {
      const LB = lv ? this.lightB1 : this.lightB, SB = lv ? this.shadeB1 : this.shadeB, off = lv ? W0 : 0;
      const S0 = this.shadeB;
      for (let j = 0; j < vh; j++) {
        const y = vy0 + j;
        for (let i = 0; i < vw; i++) {
          const x = vx0 + i;
          const idx = y * W_ + x + off, k = j * vw + i;
          // open air upstairs takes the light of the ground below it
          if (lv && w.floor[idx] === FL.VOID) { SB[k] = S0[k]; continue; }
          let l = LB[k];
          let vf;
          // from upstairs the ground is seen through the air above it
          const vidx = (!lv && plv) ? idx + W0 : idx;
          if (dead) vf = 0.6;
          else if (VG[vidx] === gen) {
            vf = 1;
            if (lv === plv) {
              const dx = x + 0.5 - px, dy = y + 0.5 - py;
              const d2 = dx * dx + dy * dy;
              const nm = nightMin + (d2 < 16 ? (1 - Math.sqrt(d2) / 4) * 0.22 : 0);
              if (l < nm) l = nm;
            }
          } else {
            const out = w.room[idx] < 0;
            vf = out ? 0.56 : (w.seen[idx] ? 0.45 : 0.1);
            if (l < 0.1) l = 0.1;
          }
          SB[k] = Math.min(1, l * vf);
        }
      }
    }
  },
  drawLightOverlay() {
    const vw = this.vw, vh = this.vh;
    for (let lv = 0; lv < (this.has1 ? 2 : 1); lv++) {
      const cv = lv ? this.lcv1 : this.lcv, cx = lv ? this.lctx1 : this.lctx, key = lv ? 'limg1' : 'limg';
      if (cv.width !== vw || cv.height !== vh) { cv.width = vw; cv.height = vh; this[key] = null; }
      if (!this[key]) this[key] = cx.createImageData(vw, vh);
      const d = this[key].data, SB = lv ? this.shadeB1 : this.shadeB;
      for (let k = 0, n = vw * vh; k < n; k++) {
        const o = k * 4;
        d[o] = 3; d[o + 1] = 5; d[o + 2] = 14;
        d[o + 3] = (1 - SB[k]) * 255;
      }
      cx.putImageData(this[key], 0, 0);
    }
    const z = this.cam.zoom, dpr = this.dpr;
    const ctx = this.ctx;
    ctx.save();
    const s = dpr * z;
    ctx.setTransform(s * HTW, s * HTH, -s * HTW, s * HTH, dpr * (this.ox + z * (this.vx0 - this.vy0) * HTW), dpr * (this.oy + z * (this.vx0 + this.vy0) * HTH));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.lcv, 0, 0);
    ctx.restore();
  },

  // ------------------------------------------------------------------ walls
  wallColor(x, y, d, t) {
    if (Wd.charred && Wd.charred.size && Wd.charred.has(World.ek(x, y, d))) return '#3a322e';
    if (t === WT.BUILT) return '#b89a6a';
    if (WALL_INFO[t].fence) return '#888888';
    const r = World.room(x, y);
    if (r >= 0) return Wd.rooms[r].intCol;
    const ro = d ? World.room(x - 1, y) : World.room(x, y - 1);
    if (ro >= 0) return Wd.buildings[Wd.rooms[ro].b].extCol;
    return '#a0a0a0';
  },
  drawWall(x, y, d, X, Y, pb, p, lv) {
    const w = Wd;
    const t = d ? w.wallW[y * w.w + x] : w.wallN[y * w.w + x];
    if (t === WT.BOUND) return;
    const f = World.feat(x, y, d);
    const col = this.wallColor(x, y, d, t);
    let cut = false, alpha = 1;
    const lw = lv || 0, same = lw === this.plv_;
    // an upper storey can also hide a player standing behind the building on the ground
    const front = p && (same ? (d ? x > p.x : y > p.y) : (lw > this.plv_ && (d ? vxOf(x) > vxOf(p.x) : y > p.y)));
    if (p && front && !same) {
      const bx = d ? X - HTW * 0.5 : X + HTW * 0.5, by = Y + HTH * 0.5;
      if (by - WALL_INFO[t].h * ZU < this.PY - 30 && by > this.PY - 75 && Math.abs(bx - this.PX) < 40) alpha = 0.3;
    } else if (p && front) {
      if (pb) {
        const ra = World.room(x, y), rb = d ? World.room(x - 1, y) : World.room(x, y - 1);
        const ba = ra >= 0 ? w.rooms[ra].b : -1, bb = rb >= 0 ? w.rooms[rb].b : -1;
        if ((ba === pb.id || bb === pb.id) && Math.abs(x - p.x) + Math.abs(y - p.y) < 30) cut = true;
      }
      if (!cut) {
        const info = WALL_INFO[t];
        const bx = d ? X - HTW * 0.5 : X + HTW * 0.5, by = Y + HTH * 0.5;
        if (by - info.h * ZU < this.PY - 8 && by > this.PY - 10 && Math.abs(bx - this.PX) < 34) alpha = info.see ? 0.6 : 0.3;
      }
    }
    if (cut && WALL_INFO[t].fence) { cut = false; }
    // facade descriptor (material, trim, fixtures); a shared scratch record, so read what we need now
    const st = Facade.edge(x, y, d, t, f, col);
    const rec = Spr.wall(t, d, col, f, cut, st);
    const fx0 = cut ? '' : st.fx.charAt(0), lampB = st.b, neon = st.pst === 9;
    // shading: the face tile, but walls bordering visible tiles stay readable
    let s = this.shadeAt(x, y);
    const so = d ? this.shadeAt(x - 1, y) : this.shadeAt(x, y - 1);
    if (World.room(x, y) < 0 && so > s) s = Math.max(s, so * 0.85);
    // a sheet rope from an upstairs window: lower half drawn with the ground floor wall, upper half with the upstairs wall
    const up = x >= LV.W0, rf = up ? f : World.feat(x + LV.W0, y, d);
    let rope = 0;
    if (rf && rf.k === 'window' && rf.rope) {
      const ux = up ? x : x + LV.W0;
      const [a, b] = World.edgeSides(ux, y, d);
      const out = Wd.floor[a[1] * Wd.w + a[0]] === FL.VOID ? a : b;
      rope = out[0] === ux && out[1] === y ? 2 : 1; // 2: hangs on the face toward the camera
      if (rope === 1) this.drawRope(ux, y, d, s, up ? WALL_H : 0.05, up ? WALL_H + 0.85 : WALL_H);
    }
    Spr.drawShaded(this.ctx, rec, X - rec.ax, Y - rec.ay, s, alpha);
    if (f && f.k === 'window' && !cut && G.light.amb < 0.55 && (f.barricade || 0) < 3) this.windowGlow(x, y, d, f, alpha);
    // porch lantern and neon OPEN signs light up after dark while the grid is up
    if (G.light.amb < 0.6 && !G.events.powerOff) {
      if ((fx0 === 'L' || fx0 === 'J') && lampB && !lampB.roofGone) this.lanternGlow(x, y, d, fx0 === 'L' ? 0.8 : 0.2, alpha);
      else if (neon && !cut && f && !f.smashed && (f.barricade || 0) < 2) this.neonGlow(x, y, d, alpha);
    }
    if (rope === 2) this.drawRope(up ? x : x + LV.W0, y, d, s, up ? WALL_H : 0.05, up ? WALL_H + 0.85 : WALL_H);
  },
  // warm light in the windows of lit rooms after dark
  windowGlow(x, y, d, f, alpha) {
    const ra = World.room(x, y), rb = d ? World.room(x - 1, y) : World.room(x, y - 1);
    const lit = (r) => r >= 0 && Wd.rooms[r].lights && (!G.events.powerOff || World.hasPower(x, y));
    if (!lit(ra) && !lit(rb)) return;
    const k = (1 - G.light.amb) * (f.curtainsClosed && !f.smashed ? 0.55 : 1) * (f.barricade ? 0.5 : 1) * (alpha === undefined ? 1 : alpha);
    const [a0, a1, z0, z1] = f.big ? [0.05, 0.95, 0.3, 2.1] : [0.22, 0.78, 0.95, 2.0];
    const Pt = (a, z) => d ? this.P(x, y + a, z) : this.P(x + a, y, z);
    const ctx = this.ctx, op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    poly(ctx, [Pt(a0, z0), Pt(a1, z0), Pt(a1, z1), Pt(a0, z1)], 'rgba(255,190,100,' + (0.42 * k).toFixed(3) + ')');
    ctx.globalCompositeOperation = op;
  },
  // warm halo of a porch lantern (a on the wall edge, lantern 0.1 out from the face)
  lanternGlow(x, y, d, a, alpha) {
    const ctx = this.ctx, p = d ? this.P(x + 0.12, y + a, 1.78) : this.P(x + a, y + 0.12, 1.78);
    if (!this.lglow) {
      const c = mkCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,214,140,0.85)'); gr.addColorStop(0.25, 'rgba(255,190,110,0.32)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      this.lglow = c;
    }
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * Math.min(1, (0.6 - G.light.amb) * 2.5);
    ctx.drawImage(this.lglow, p[0] - 24, p[1] - 22, 48, 44);
    ctx.fillStyle = 'rgba(255,236,170,0.95)'; ctx.fillRect(p[0] - 1.5, p[1] - 2.5, 3, 5);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = op;
  },
  // red neon OPEN sign in a store window
  neonGlow(x, y, d, alpha) {
    const ctx = this.ctx, p = d ? this.P(x, y + 0.5, 1.24) : this.P(x + 0.5, y, 1.24);
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * Math.min(1, (0.6 - G.light.amb) * 2.5) * (0.85 + Math.sin(performance.now() / 160) * 0.08);
    ctx.fillStyle = 'rgba(255,70,50,0.35)'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 11, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,90,0.5)'; ctx.fillRect(p[0] - 5, p[1] - 1.5, 10, 3);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = op;
  },
  // knotted sheet rope hanging from an upstairs window (edge x,y,d upstairs), the part between heights z0..z1
  drawRope(x, y, d, s, z0, z1) {
    const ctx = this.ctx;
    const [a, b] = World.edgeSides(x, y, d);
    const out = Wd.floor[a[1] * Wd.w + a[0]] === FL.VOID ? a : b;
    const gx = x + (d ? (out[0] < x ? -0.12 : 0.12) : 0.5) - LV.W0, gy = y + (d ? 0.5 : (out[1] < y ? -0.12 : 0.12));
    const TOP = WALL_H + 0.85, n = 10;
    const pt = (k) => { const z = TOP * (1 - k / n) + 0.05 * (k / n); const q = this.P(gx, gy, z); return [q[0] + Math.sin(k * 1.7) * 1.5, q[1], z]; };
    ctx.strokeStyle = Col.shade('#e8e4d8', Math.max(0.3, s)); ctx.lineWidth = 3;
    ctx.beginPath();
    let started = false;
    for (let k = 0; k <= n; k++) {
      const q = pt(k);
      if (q[2] > z1 + 0.01 || q[2] < z0 - 0.3) continue;
      if (!started) { ctx.moveTo(q[0], q[1]); started = true; } else ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    ctx.fillStyle = Col.shade('#d8d0c0', Math.max(0.3, s));
    for (let k = 1; k < n; k += 2) { const q = pt(k); if (q[2] > z1 || q[2] < z0) continue; ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, 7); ctx.fill(); }
  },
  drawObj(o, x, y, X, Y, p, t, vx) {
    const def = OBJ[o.t];
    const rec = Spr.obj(o);
    let alpha = 1;
    if (p && def.h > 1.1 && o.t !== 'stairs' && o.t !== 'landing') {
      const by = Y + HTH;
      const top = by - def.h * ZU - (o.t === 'tree' ? 40 : 6);
      const wdt = o.t === 'tree' ? 56 : 30;
      const pvx = p.x >= LV.W0 ? p.x - LV.W0 : p.x;
      if (by > this.PY - 6 && top < this.PY - 10 && Math.abs(X - this.PX) < wdt && ((vx === undefined ? x : vx) + y + 1 > pvx + p.y)) alpha = o.t === 'tree' ? 0.35 : 0.45;
    }
    const s = this.shadeAt(x, y);
    const ctx = this.ctx;
    Spr.drawShaded(ctx, rec, X - rec.ax, Y - rec.ay, s, alpha);
    // animated extras
    if ((o.t === 'campfire' || o.t === 'bbq') && o.lit) Fx.drawFlame(ctx, X, Y + HTH - (o.t === 'bbq' ? 30 : 4), t + x * 0.37);
    if (o.t === 'tv' && o.on) {
      const c = isoP(X, Y, 0.5, 0.5, 0.8);
      ctx.fillStyle = 'rgba(150,190,255,' + (0.25 + Math.random() * 0.15) + ')';
      ctx.beginPath(); ctx.arc(c[0], c[1], 9, 0, 7); ctx.fill();
    }
    if (o.t === 'lamppost' && G.light.amb < 0.6 && !G.events.powerOff) {
      const h = isoP(X, Y, 0.5, 1.0, 3.9);
      const gr = ctx.createRadialGradient(h[0], h[1], 1, h[0], h[1], 16);
      gr.addColorStop(0, 'rgba(255,240,190,0.9)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(h[0], h[1], 16, 0, 7); ctx.fill();
    }
    // per-type animated overlay: ObjArt.a_<type>(ctx, o, X, Y, t, shade, x, y)
    const an = ObjArt['a_' + o.t];
    if (an) an.call(ObjArt, ctx, o, X, Y, t, s, x, y);
    if (o.t === 'generator' && o.on && o.fuel > 0) { const c = isoP(X, Y, 0.3, 0.3, 0.9); ctx.fillStyle = 'rgba(120,120,120,0.4)'; ctx.beginPath(); ctx.arc(c[0] + Math.sin(t * 9) * 2, c[1] - (t * 20 % 12), 3, 0, 7); ctx.fill(); }
  },

  // ------------------------------------------------------------------ roofs
  // Roofs are pre-rendered per building (Facade.roof: shingles, gables, chimneys, snow...) and darkened
  // through their outline path. Over the per-frame build budget a roof falls back to plain polygons.
  drawRoof(b, p) {
    const ctx = this.ctx;
    const H = WALL_H * (b.floors || 1);
    const P = (x, y, z) => [(x - y) * HTW, (x + y) * HTH - z * ZU];
    // brightness: daylight / moonlight, raised by lit and visible ground around the building (lamps light
    // a roof far less than the street below it), never pitch black
    const amb = G.light.amb, cap = amb + 0.32;
    let s = Math.max(0.12, amb * 0.8);
    const vw = this.vw, vh = this.vh, SB = this.shadeB, vx0 = this.vx0, vy0 = this.vy0;
    const smp = (sx, sy) => { const i = sx - vx0, j = sy - vy0; if (i >= 0 && j >= 0 && i < vw && j < vh) { const l = Math.min(cap, SB[j * vw + i]); if (l > s) s = l; } };
    smp(b.x1 + 1, b.y1 + 1); smp(b.x0 - 1, b.y1 + 1); smp(b.x1 + 1, b.y0 - 1); smp((b.x0 + b.x1) >> 1, b.y1 + 1); smp(b.x1 + 1, (b.y0 + b.y1) >> 1);
    if (s > 1) s = 1;
    // translucency if player hidden beneath
    let alpha = 1;
    if (p && !p.dead) {
      const q = [this.PX, this.PY - 26];
      const quad = [P(b.x0, b.y0, H), P(b.x1 + 1, b.y0, H), P(b.x1 + 1, b.y1 + 1, H), P(b.x0, b.y1 + 1, H)];
      const quad2 = [P(b.x0, b.y0, 0), P(b.x1 + 1, b.y0, 0), P(b.x1 + 1, b.y0, H + 1.2), P(b.x0, b.y0, H + 1.2)];
      if (pointInPoly(q, quad) || (pointInPoly(q, quad2))) alpha = 0.28;
    }
    const rr = Facade.roof(b, Math.round(Season.snow * 4) / 4);
    if (alpha < 1) ctx.globalAlpha = alpha;
    if (rr) {
      ctx.drawImage(rr.c, rr.x, rr.y);
      if (s < 0.98) { ctx.globalAlpha = alpha * (1 - s); ctx.fillStyle = 'rgb(3,5,14)'; ctx.fill(rr.path); }
    } else this.drawRoofPlain(b, s, H, P);
    ctx.globalAlpha = 1;
  },
  drawRoofPlain(b, s, H, P) {
    const ctx = this.ctx, ov = 0.18;
    const x0 = b.x0 - ov, y0 = b.y0 - ov, x1 = b.x1 + 1 + ov, y1 = b.y1 + 1 + ov;
    const sq = Math.round(Season.snow * 8) / 8;
    const rc = sq > 0 ? Col.mix(b.roofCol, '#e4eaf0', Math.min(0.85, sq * 1.1)) : b.roofCol;
    if (b.roof === 'flat') {
      poly(ctx, [P(b.x0, b.y0, H), P(b.x1 + 1, b.y0, H), P(b.x1 + 1, b.y1 + 1, H), P(b.x0, b.y1 + 1, H)], Col.shade(rc, s));
      // parapet
      const ins = 0.18;
      poly(ctx, [P(b.x0 + ins, b.y0 + ins, H), P(b.x1 + 1 - ins, b.y0 + ins, H), P(b.x1 + 1 - ins, b.y1 + 1 - ins, H), P(b.x0 + ins, b.y1 + 1 - ins, H)], null, Col.shade(rc, s * 0.7), 2);
      // vents
      const rng = new RNG(b.id * 31 + 7);
      for (let k = 0; k < 2 + (b.id % 3); k++) {
        const ux = rng.f(b.x0 + 1, b.x1 - 0.5), uy = rng.f(b.y0 + 1, b.y1 - 0.5);
        const bx = [P(ux, uy + 0.6, H), P(ux + 0.6, uy + 0.6, H), P(ux + 0.6, uy + 0.6, H + 0.3), P(ux, uy + 0.6, H + 0.3)];
        poly(ctx, bx, Col.shade('#8a8a8a', s * FACE_S));
        poly(ctx, [P(ux + 0.6, uy + 0.6, H), P(ux + 0.6, uy, H), P(ux + 0.6, uy, H + 0.3), P(ux + 0.6, uy + 0.6, H + 0.3)], Col.shade('#8a8a8a', s * FACE_E));
        poly(ctx, [P(ux, uy, H + 0.3), P(ux + 0.6, uy, H + 0.3), P(ux + 0.6, uy + 0.6, H + 0.3), P(ux, uy + 0.6, H + 0.3)], Col.shade('#9a9a9a', s));
      }
      if (b.name) {
        ctx.save();
        const alongX = (b.x1 - b.x0) >= (b.y1 - b.y0);
        const cx = (b.x0 + b.x1 + 1) / 2, cy = (b.y0 + b.y1 + 1) / 2;
        const c = P(cx, cy, H);
        if (alongX) ctx.setTransform(this.dpr * this.cam.zoom * 1, this.dpr * this.cam.zoom * 0.5, -this.dpr * this.cam.zoom * 1, this.dpr * this.cam.zoom * 0.5, this.dpr * (this.ox + c[0] * this.cam.zoom), this.dpr * (this.oy + c[1] * this.cam.zoom));
        else ctx.setTransform(this.dpr * this.cam.zoom * 1, -this.dpr * this.cam.zoom * 0.5, this.dpr * this.cam.zoom * 1, this.dpr * this.cam.zoom * 0.5, this.dpr * (this.ox + c[0] * this.cam.zoom), this.dpr * (this.oy + c[1] * this.cam.zoom));
        ctx.font = 'bold 15px Verdana, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = Col.shade('#e8e0c0', s * 0.9);
        ctx.fillText(b.name.toUpperCase(), 0, 0);
        ctx.restore();
      }
    } else {
      const alongX = (b.x1 - b.x0) >= (b.y1 - b.y0);
      if (alongX) {
        const vm = (b.y0 + b.y1 + 1) / 2, zr = H + Math.min(1.7, (b.y1 - b.y0 + 1) * 0.3);
        poly(ctx, [P(x0, y0, H), P(x1, y0, H), P(x1, vm, zr), P(x0, vm, zr)], Col.shade(rc, s * 1.0));
        poly(ctx, [P(x0, vm, zr), P(x1, vm, zr), P(x1, y1, H), P(x0, y1, H)], Col.shade(rc, s * 0.78));
        for (let k = 1; k < 4; k++) { const v = U.lerp(vm, y1, k / 4), zz = U.lerp(zr, H, k / 4); line(ctx, P(x0, v, zz), P(x1, v, zz), Col.shade(rc, s * 0.62), 1); }
        poly(ctx, [P(b.x1 + 1, b.y0, H), P(b.x1 + 1, b.y1 + 1, H), P(b.x1 + 1, vm, zr)], Col.shade(b.extCol, s * FACE_E));
        line(ctx, P(x0, vm, zr), P(x1, vm, zr), Col.shade(rc, s * 0.6), 2);
        if (b.type !== 'barn' && b.type !== 'cabin') { const cx = b.x0 + 1.2 + (b.id % 3), cy = vm - 0.6; this.chimney(ctx, P, cx, cy, zr - 0.2, s); }
      } else {
        const um = (b.x0 + b.x1 + 1) / 2, zr = H + Math.min(1.7, (b.x1 - b.x0 + 1) * 0.3);
        poly(ctx, [P(x0, y0, H), P(um, y0, zr), P(um, y1, zr), P(x0, y1, H)], Col.shade(rc, s * 0.95));
        poly(ctx, [P(um, y0, zr), P(x1, y0, H), P(x1, y1, H), P(um, y1, zr)], Col.shade(rc, s * 0.7));
        for (let k = 1; k < 4; k++) { const u = U.lerp(um, x1, k / 4), zz = U.lerp(zr, H, k / 4); line(ctx, P(u, y0, zz), P(u, y1, zz), Col.shade(rc, s * 0.55), 1); }
        poly(ctx, [P(b.x0, b.y1 + 1, H), P(b.x1 + 1, b.y1 + 1, H), P(um, b.y1 + 1, zr)], Col.shade(b.extCol, s * FACE_S));
        line(ctx, P(um, y0, zr), P(um, y1, zr), Col.shade(rc, s * 0.6), 2);
        if (b.type !== 'barn' && b.type !== 'cabin') { const cx = um - 0.7, cy = b.y0 + 1.2 + (b.id % 3); this.chimney(ctx, P, cx, cy, zr - 0.2, s); }
      }
    }
  },
  chimney(ctx, P, x, y, z, s) {
    const c = '#8a4a3a', h = 0.9;
    poly(ctx, [P(x, y + 0.5, z - 0.5), P(x + 0.5, y + 0.5, z - 0.5), P(x + 0.5, y + 0.5, z + h), P(x, y + 0.5, z + h)], Col.shade(c, s * FACE_S));
    poly(ctx, [P(x + 0.5, y + 0.5, z - 0.5), P(x + 0.5, y, z - 0.5), P(x + 0.5, y, z + h), P(x + 0.5, y + 0.5, z + h)], Col.shade(c, s * FACE_E));
    poly(ctx, [P(x, y, z + h), P(x + 0.5, y, z + h), P(x + 0.5, y + 0.5, z + h), P(x, y + 0.5, z + h)], Col.shade('#3a2a24', s));
  },

  // ------------------------------------------------------------------ hover highlight
  drawHover(ctx, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,120,0.85)'; ctx.lineWidth = 1.5;
    const P = (x, y, z) => this.P(x, y, z);
    if (h.edge) {
      const [x, y, d] = h.edge;
      const ht = WALL_INFO[World.wall(x, y, d)] ? WALL_INFO[World.wall(x, y, d)].h : 1;
      const a = P(x, y, 0), b = d ? P(x, y + 1, 0) : P(x + 1, y, 0);
      poly(ctx, [a, b, [b[0], b[1] - ht * ZU], [a[0], a[1] - ht * ZU]], 'rgba(255,230,120,0.12)', 'rgba(255,230,120,0.8)', 1.5);
    } else if (h.tile) {
      const [x, y] = h.tile;
      const o = World.obj(x, y);
      const hz = o ? Math.min(OBJ[o.t].h, 2.2) : 0;
      poly(ctx, [P(x, y, 0), P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x, y + 1, 0)], 'rgba(255,230,120,0.1)', 'rgba(255,230,120,0.8)', 1.5);
      if (hz > 0.1) poly(ctx, [P(x, y, hz), P(x + 1, y, hz), P(x + 1, y + 1, hz), P(x, y + 1, hz)], null, 'rgba(255,230,120,0.5)', 1);
    }
    ctx.restore();
  },
  drawVignette(ctx) {
    const p = G.player;
    const W = this.W, H = this.H;
    if (!this.vig || this.vigW !== W || this.vigH !== H) {
      this.vigW = W; this.vigH = H;
      this.vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      this.vig.addColorStop(0, 'rgba(0,0,0,0)'); this.vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    }
    ctx.fillStyle = this.vig; ctx.fillRect(0, 0, W, H);
    if (!p) return;
    // injury / panic tint
    const hurt = p.dead ? 0 : U.clamp((60 - p.health) / 60, 0, 1);
    const flash = p.hurtFlash || 0;
    if (hurt > 0 || flash > 0) {
      const a = hurt * (0.25 + 0.1 * Math.sin(performance.now() / 300)) + flash * 0.45;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, 'rgba(140,0,0,' + a.toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (p.sleepFade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, p.sleepFade).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    // drowsy blinks when exhausted
    if (!p.dead && !p.asleep && p.st && p.st.fatigue > 0.8) {
      this.blinkT = (this.blinkT || 0) - 1 / 60;
      if (this.blinkT <= 0) { this.blinkT = R.f(4, 12) * (1.2 - p.st.fatigue); this.blink = 0.45; }
    }
    if (this.blink > 0) { this.blink -= 1 / 60; ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.92, Math.sin(Math.max(0, this.blink) / 0.45 * Math.PI) * 1.1).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.light.flash > 0) { ctx.fillStyle = 'rgba(220,230,255,' + (G.light.flash * 0.5).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  },
};
const HARD_FLOORS = []; for (const f of [FL.ASPHALT, FL.SIDEWALK, FL.CONCRETE, FL.DIRT, FL.SAND, FL.GRAVEL, FL.PARKING]) HARD_FLOORS[f] = true;
const FR_DX = [0, -1, 0, 1], FR_DY = [-1, 0, 1, 0];
function pointInPoly(pt, vs) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
    if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Effects / particles
// ---------------------------------------------------------------------------
const Fx = {
  parts: [], tracers: [], floats: [], flashes: [], fires: [],
  blood(x, y, n, dirA) {
    n = Math.max(1, Math.round(n * Settings.v.particles));
    for (let i = 0; i < n; i++) {
      const a = (dirA !== undefined ? dirA + R.f(-0.8, 0.8) : R.f(0, Math.PI * 2));
      const sp = R.f(0.5, 2.5);
      this.parts.push({ x, y, z: R.f(0.9, 1.4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.f(0, 2), life: 1.2, max: 1.2, col: R.chance(0.5) ? '#8a0a0a' : '#6a0505', size: R.f(1.5, 3), g: true, kind: 'blood' });
    }
    if (G.world && R.chance(0.7)) this.decal(x + R.f(-0.4, 0.4), y + R.f(-0.4, 0.4));
  },
  scorch(x, y, s) {
    const w = Wd;
    w.decals.push({ x: x - 0.5, y: y - 0.5, v: R.int(0, 5), age: -2000, s: s || R.f(0.8, 1.3), k: 1 });
    if (w.decals.length > 450) w.decals.shift();
  },
  decal(x, y, s) {
    const w = Wd;
    w.decals.push({ x: x - 0.5, y: y - 0.5, v: R.int(0, 7), age: 0, s: s || R.f(0.6, 1.1) });
    if (w.decals.length > 450) w.decals.shift();
  },
  shards(x, y, z, n, col) {
    n = Math.max(1, Math.round(n * Settings.v.particles));
    for (let i = 0; i < n; i++) {
      const a = R.f(0, Math.PI * 2), sp = R.f(0.5, 2.2);
      this.parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.f(0.5, 2.5), life: 1.0, max: 1.0, col, size: R.f(1.5, 2.5), g: true });
    }
  },
  smoke(x, y, z, dark) {
    const pq = Settings.v.particles;
    if (this.parts.length > 1400 * pq || (pq < 1 && Math.random() > pq)) return;
    if (dark) this.parts.push({ x, y, z, vx: R.f(-0.15, 0.25), vy: R.f(-0.25, 0.15), vz: R.f(0.8, 1.3), life: R.f(2.5, 4), max: 4, col: '#303030', size: R.f(5, 9), smoke: true, dark: true });
    else this.parts.push({ x, y, z, vx: R.f(-0.1, 0.1), vy: R.f(-0.1, 0.1), vz: 0.6, life: 1.6, max: 1.6, col: '#909090', size: R.f(3, 6), smoke: true });
  },
  tracer(x0, y0, z0, x1, y1, z1) { this.tracers.push({ x0, y0, z0, x1, y1, z1, t: 0.07 }); },
  flash(x, y, r, p, t) { this.flashes.push({ x, y, r: r || 6, p: p || 0.8, t: t || 0.08, max: t || 0.08 }); },
  text(x, y, txt, col, dur) { this.floats.push({ x, y, z: 2.0, txt, col: col || '#fff', t: dur || 1.5, max: dur || 1.5 }); },
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.g) {
        p.vz -= 9 * dt;
        if (p.z <= 0) { p.z = 0; p.vx *= 0.3; p.vy *= 0.3; p.vz = 0; if (p.kind === 'blood' && !p.landed) { p.landed = true; } }
      }
      if (p.smoke) { p.size += dt * 3; }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) { this.tracers[i].t -= dt; if (this.tracers[i].t <= 0) this.tracers.splice(i, 1); }
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.t -= dt; f.z += dt * 0.5; if (f.t <= 0) this.floats.splice(i, 1); }
    for (let i = this.flashes.length - 1; i >= 0; i--) { this.flashes[i].t -= dt; if (this.flashes[i].t <= 0) this.flashes.splice(i, 1); }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t -= dt;
      if (R.chance(dt * 8)) this.smoke(f.x + R.f(-0.4, 0.4), f.y + R.f(-0.4, 0.4), 0.8);
      if (f.t <= 0) this.fires.splice(i, 1);
    }
    for (const d of Wd ? Wd.decals : []) d.age += dt * G.speed * MIN_PER_SEC / 60;
  },
  draw(ctx) {
    const P = (x, y, z) => Render.P(x, y, z);
    for (const p of this.parts) {
      const s = P(p.x, p.y, p.z);
      const a = Math.min(1, p.life / p.max * 2);
      if (p.smoke) { const sa = (p.dark ? 0.42 : 0.35) * p.life / p.max; ctx.fillStyle = (p.dark ? 'rgba(40,38,36,' : 'rgba(140,140,140,') + sa.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(s[0], s[1], p.size, 0, 7); ctx.fill(); continue; }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col; ctx.fillRect(s[0] - p.size / 2, s[1] - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const t of this.tracers) {
      const a = P(t.x0, t.y0, t.z0), b = P(t.x1, t.y1, t.z1);
      ctx.strokeStyle = 'rgba(255,240,180,' + (t.t / 0.07).toFixed(2) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (const f of this.fires) {
      const s = P(f.x, f.y, 0);
      this.drawFlame(ctx, s[0], s[1], performance.now() / 1000 + f.x, 1.6);
    }
    ctx.font = 'bold 12px Verdana, sans-serif'; ctx.textAlign = 'center';
    for (const f of this.floats) {
      const s = P(f.x, f.y, f.z);
      ctx.globalAlpha = Math.min(1, f.t / f.max * 2);
      ctx.fillStyle = '#000'; ctx.fillText(f.txt, s[0] + 1, s[1] + 1);
      ctx.fillStyle = f.col; ctx.fillText(f.txt, s[0], s[1]);
    }
    ctx.globalAlpha = 1;
  },
  // flames: a few pre-rendered flickering frames plus an additive glow
  flameFrames: null, glow: null,
  initFlames() {
    this.flameFrames = [];
    for (let f = 0; f < 10; f++) {
      const c = mkCanvas(48, 64), g = c.getContext('2d');
      const x = 24, y = 60, t = f * 0.63;
      const tongue = (ox, h, wdt, c0, c1) => {
        const gr = g.createLinearGradient(0, y, 0, y - h);
        gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x + ox - wdt, y); g.bezierCurveTo(x + ox - wdt * 1.1, y - h * 0.45, x + ox - wdt * 0.2, y - h * 0.7, x + ox + Math.sin(t * 3 + ox) * 2, y - h);
        g.bezierCurveTo(x + ox + wdt * 0.3, y - h * 0.65, x + ox + wdt * 1.1, y - h * 0.4, x + ox + wdt, y); g.closePath(); g.fill();
      };
      for (let k = 0; k < 5; k++) {
        const ph = t * 7 + k * 1.7;
        tongue(Math.sin(ph * 1.3 + k) * 3 + (k - 2) * 3.2, 26 + Math.sin(ph) * 9 - Math.abs(k - 2) * 4, 7 - Math.abs(k - 2) * 1.2, 'rgba(255,90,20,0.85)', 'rgba(255,50,10,0)');
      }
      for (let k = 0; k < 3; k++) {
        const ph = t * 9 + k * 2.3;
        tongue(Math.sin(ph) * 2.5 + (k - 1) * 3, 17 + Math.sin(ph * 1.7) * 5, 4.5, 'rgba(255,215,90,0.95)', 'rgba(255,150,40,0)');
      }
      tongue(Math.sin(t * 5) * 1.5, 9 + Math.sin(t * 11) * 2, 3.2, 'rgba(255,250,220,0.95)', 'rgba(255,230,150,0)');
      this.flameFrames.push(c);
    }
    const c = mkCanvas(64, 64), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,150,50,0.5)'); gr.addColorStop(0.5, 'rgba(255,100,30,0.16)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.glow = c;
  },
  drawFlame(ctx, x, y, t, sc) {
    sc = sc || 1;
    if (!this.flameFrames) this.initFlames();
    const fr = this.flameFrames[Math.floor(t * 13) % 10 < 0 ? 0 : Math.floor(t * 13) % 10];
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    const gs = 44 * sc * (0.9 + Math.sin(t * 17) * 0.08);
    ctx.drawImage(this.glow, x - gs, y - 10 * sc - gs * 0.75, gs * 2, gs * 1.5);
    ctx.globalCompositeOperation = op;
    const w = 24 * sc, h = 32 * sc;
    ctx.drawImage(fr, x - w, y - h * 1.88, w * 2, h * 2);
  },
};
