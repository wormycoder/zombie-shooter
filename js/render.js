'use strict';
// ---------------------------------------------------------------------------
// Isometric renderer
// ---------------------------------------------------------------------------
const Render = {
  cam: { x: 120, y: 120, zoom: 1.25, tz: 1.25 },
  init(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.lcv = mkCanvas(64, 64);
    this.lctx = this.lcv.getContext('2d');
    this.lightB = new Float32Array(1);
    this.shadeB = new Float32Array(1);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = Math.floor(this.W * this.dpr); this.cv.height = Math.floor(this.H * this.dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
  },
  camIX: 0, camIY: 0,
  toScreen(x, y, z) {
    const z0 = this.cam.zoom;
    return [((x - y) * HTW - this.camIX) * z0 + this.W / 2, ((x + y) * HTH - (z || 0) * ZU - this.camIY) * z0 + this.H / 2];
  },
  toWorld(sx, sy) {
    const z0 = this.cam.zoom;
    const X = (sx - this.W / 2) / z0 + this.camIX, Y = (sy - this.H / 2) / z0 + this.camIY;
    return [(X / HTW + Y / HTH) / 2, (Y / HTH - X / HTW) / 2];
  },
  shadeAt(x, y) {
    const i = Math.floor(x) - this.vx0, j = Math.floor(y) - this.vy0;
    if (i < 0 || j < 0 || i >= this.vw || j >= this.vh) return 0.3;
    return this.shadeB[j * this.vw + i];
  },
  shadeSmooth(x, y) {
    const fx = x - 0.5, fy = y - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const a = this.shadeAt(x0, y0), b = this.shadeAt(x0 + 1, y0), c = this.shadeAt(x0, y0 + 1), d = this.shadeAt(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  },
  lightAt(x, y) {
    const i = Math.floor(x) - this.vx0, j = Math.floor(y) - this.vy0;
    if (i < 0 || j < 0 || i >= this.vw || j >= this.vh) return 0.3;
    return this.lightB[j * this.vw + i];
  },

  // ------------------------------------------------------------------ frame
  frame(dt) {
    const w = Wd, ctx = this.ctx, cam = this.cam, p = G.player;
    if (!w) return;
    cam.zoom += (cam.tz - cam.zoom) * Math.min(1, dt * 10);
    const z = cam.zoom, dpr = this.dpr;
    this.camIX = (cam.x - cam.y) * HTW;
    this.camIY = (cam.x + cam.y) * HTH - 0.8 * ZU;
    const ox = this.W / 2 - this.camIX * z, oy = this.H / 2 - this.camIY * z;
    this.ox = ox; this.oy = oy;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.imageSmoothingEnabled = true;
    // iso-pixel bounds of screen
    const L = (0 - ox) / z, Rr = (this.W - ox) / z, T = (0 - oy) / z, B = (this.H - oy) / z;
    this.scr = { L, R: Rr, T, B };
    // tile bounds
    const cs = [this.toWorld(0, 0), this.toWorld(this.W, 0), this.toWorld(0, this.H), this.toWorld(this.W, this.H)];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cs) { minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]); maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1]); }
    minX = Math.max(0, Math.floor(minX) - 2); minY = Math.max(0, Math.floor(minY) - 2);
    maxX = Math.min(w.w - 1, Math.ceil(maxX) + 8); maxY = Math.min(w.h - 1, Math.ceil(maxY) + 8);
    this.vx0 = minX; this.vy0 = minY; this.vw = maxX - minX + 1; this.vh = maxY - minY + 1;
    this.computeLight();
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
    // ---------------- floor pass
    const W_ = w.w;
    const t = performance.now() / 1000;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const X = (x - y) * HTW, Y = (x + y) * HTH;
        if (X < L - 40 || X > Rr + 40 || Y < T - 40 || Y > B + 10) continue;
        const i = y * W_ + x;
        const f = w.floor[i];
        let vx = (x * 7 + y * 13) & 3;
        if (f === FL.WATER || f === FL.DEEPWATER) vx = (vx + Math.floor(t * 1.5 + (x + y) * 0.3)) & 3;
        const rec = Spr.floor(f, w.fvar[i], vx);
        ctx.drawImage(rec.c, X - rec.ax, Y - rec.ay);
        const dc = w.deco[i];
        if (dc) { const r2 = Spr.deco(dc); ctx.drawImage(r2.c, X - r2.ax, Y - r2.ay); }
      }
    }
    // decals
    for (const d of w.decals) {
      if (d.x < minX || d.x > maxX + 1 || d.y < minY || d.y > maxY + 1) continue;
      const X = (d.x - d.y) * HTW, Y = (d.x + d.y) * HTH;
      const rec = Spr.blood(d.v);
      ctx.globalAlpha = U.clamp(1 - d.age / 400, 0.25, 1) * (d.a || 1);
      const s = d.s || 1;
      ctx.drawImage(rec.c, X - rec.ax * s, Y - (rec.ay + 16) * s, rec.c.width * s, rec.c.height * s);
    }
    ctx.globalAlpha = 1;
    // floor items
    for (const [i, arr] of w.items) {
      const x = i % W_, y = (i / W_) | 0;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      for (const it of arr) {
        const X = (x + it.fx - y - it.fy) * HTW, Y = (x + it.fx + y + it.fy) * HTH;
        const ic = Icons.canvas(it);
        ctx.drawImage(ic, X - 9, Y - 12, 18, 18);
      }
    }
    // corpses & downed bodies (flat things)
    this.flatEnts = [];
    for (const zb of G.zombies) {
      if (zb.x < minX - 2 || zb.x > maxX + 2 || zb.y < minY - 2 || zb.y > maxY + 2) continue;
      if (zb.dead && (zb.lie || 0) >= 0.99) Zombie.draw(ctx, zb, true);
    }
    if (G.corpse && p && p.dead) Player.draw(ctx);
    // ---------------- light overlay on floors
    this.drawLightOverlay();
    // ---------------- main pass
    const buckets = new Map();
    const addB = (x, y, e, k) => { const key = Math.floor(y) * W_ + Math.floor(x); let a = buckets.get(key); if (!a) { a = []; buckets.set(key, a); } a.push([k, e]); };
    if (p && !p.dead && !p.inCar) addB(p.x, p.y, p, 'p');
    for (const zb of G.zombies) {
      if (zb.dead && (zb.lie || 0) >= 0.99) continue;
      if (zb.x < minX - 2 || zb.x > maxX + 2 || zb.y < minY - 2 || zb.y > maxY + 2) continue;
      addB(zb.x, zb.y, zb, 'z');
    }
    for (const c of G.cars) {
      if (c.x < minX - 3 || c.x > maxX + 3 || c.y < minY - 3 || c.y > maxY + 3) continue;
      addB(c.x, c.y, c, 'c');
    }
    // buildings roofs by diagonal
    const roofs = new Map();
    const live = p && (!p.dead || G.corpse);
    const pb = live ? World.building(Math.floor(p.x), Math.floor(p.y)) : null;
    this.pb = pb;
    for (const b of w.buildings) {
      if (b.x1 < minX - 2 || b.x0 > maxX || b.y1 < minY - 2 || b.y0 > maxY) continue;
      if (pb && b.id === pb.id) continue;
      const d = b.x1 + b.y1;
      let a = roofs.get(d); if (!a) { a = []; roofs.set(d, a); } a.push(b);
    }
    const PX = p ? (p.x - p.y) * HTW : 0, PY = p ? (p.x + p.y) * HTH : 0;
    this.PX = PX; this.PY = PY;
    const dMin = minX + minY, dMax = maxX + maxY;
    for (let d = dMin; d <= dMax; d++) {
      const xa = Math.max(minX, d - maxY), xb = Math.min(maxX, d - minY);
      for (let x = xa; x <= xb; x++) {
        const y = d - x;
        const X = (x - y) * HTW, Y = (x + y) * HTH;
        if (X < L - 110 || X > Rr + 110 || Y < T - 40 || Y > B + 280) continue;
        const i = y * W_ + x;
        if (w.wallN[i]) this.drawWall(x, y, 0, X, Y, pb, live ? p : null);
        if (w.wallW[i]) this.drawWall(x, y, 1, X, Y, pb, live ? p : null);
        const o = w.obj[i];
        if (o) this.drawObj(o, x, y, X, Y, live ? p : null, t);
        const bk = buckets.get(i);
        if (bk) {
          if (bk.length > 1) bk.sort((a, b) => (a[1].x + a[1].y) - (b[1].x + b[1].y));
          for (const [k, e] of bk) {
            if (k === 'p') Player.draw(ctx);
            else if (k === 'z') Zombie.draw(ctx, e, false);
            else if (k === 'c') Vehicles.draw(ctx, e);
          }
        }
      }
      const rl = roofs.get(d);
      if (rl) for (const b of rl) this.drawRoof(b, p);
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

  // ------------------------------------------------------------------ lighting
  computeLight() {
    const w = Wd, p = G.player;
    const n = this.vw * this.vh;
    if (this.lightB.length < n) { this.lightB = new Float32Array(n * 1.3 | 0); this.shadeB = new Float32Array(n * 1.3 | 0); }
    const LB = this.lightB, SB = this.shadeB;
    const amb = G.light.amb;
    const vx0 = this.vx0, vy0 = this.vy0, vw = this.vw, vh = this.vh, W_ = w.w;
    const powered = !G.events.powerOff;
    const lights = [];
    for (let j = 0; j < vh; j++) {
      const y = vy0 + j;
      for (let i = 0; i < vw; i++) {
        const x = vx0 + i;
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
        }
      }
    }
    for (const f of Fx.fires) lights.push({ x: f.x, y: f.y, r: 6, p: 0.9 });
    for (const fl of Fx.flashes) lights.push({ x: fl.x, y: fl.y, r: fl.r, p: fl.p * (fl.t / fl.max) });
    for (const c of G.cars) if (c.lightsOn && c.engine) {
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      lights.push({ x: c.x + ca * 1.6, y: c.y + sa * 1.6, r: 11, p: 0.9, cone: c.a, cw: 0.5, ox: c.x + ca * 1.2, oy: c.y + sa * 1.2 });
    }
    if (p && !p.dead) {
      const fl = Player.flashlight();
      if (fl) lights.push({ x: p.x, y: p.y, r: 13, p: 0.95, cone: p.angle, cw: 0.42, vis: true });
      if (fl) lights.push({ x: p.x, y: p.y, r: 2.6, p: 0.35 });
    }
    for (const lt of lights) {
      const r = lt.r;
      const ix0 = Math.max(vx0, Math.floor(lt.x - r)), ix1 = Math.min(vx0 + vw - 1, Math.ceil(lt.x + r));
      const iy0 = Math.max(vy0, Math.floor(lt.y - r)), iy1 = Math.min(vy0 + vh - 1, Math.ceil(lt.y + r));
      for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) {
        const dx = x + 0.5 - lt.x, dy = y + 0.5 - lt.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= r) continue;
        const idx = y * W_ + x;
        const rm = w.room[idx];
        if (lt.out && rm >= 0) continue;
        if (lt.room !== undefined && rm !== lt.room) continue;
        let f = lt.p * Math.pow(1 - d / r, 1.4);
        if (lt.cone !== undefined) {
          const a = Math.atan2(dy, dx);
          const ad = Math.abs(U.angDiff(lt.cone, a));
          if (d > 1.2) { if (ad > lt.cw) continue; f *= 1 - Math.pow(ad / lt.cw, 2) * 0.6; }
          if (lt.vis && !World.isVis(x, y)) continue;
          if (lt.ox !== undefined && !World.lineClear(lt.ox, lt.oy, x + 0.5, y + 0.5, 'sight')) continue;
        } else if (!lt.out && lt.room === undefined && d > 1.5 && !World.lineClear(lt.x, lt.y, x + 0.5, y + 0.5, 'sight')) continue;
        const k = (y - vy0) * vw + (x - vx0);
        LB[k] = Math.min(1.15, LB[k] + f);
      }
    }
    // visibility
    const gen = World.gen, VG = World.visGen;
    const px = p ? p.x : 0, py = p ? p.y : 0;
    const nightMin = p && Player.hasTrait('catseyes') ? 0.22 : 0.15;
    const dead = !p || p.dead;
    for (let j = 0; j < vh; j++) {
      const y = vy0 + j;
      for (let i = 0; i < vw; i++) {
        const x = vx0 + i;
        const idx = y * W_ + x, k = j * vw + i;
        let l = LB[k];
        let vf;
        if (dead) vf = 0.6;
        else if (VG[idx] === gen) {
          vf = 1;
          const dx = x + 0.5 - px, dy = y + 0.5 - py;
          const d2 = dx * dx + dy * dy;
          const nm = nightMin + (d2 < 16 ? (1 - Math.sqrt(d2) / 4) * 0.22 : 0);
          if (l < nm) l = nm;
        } else {
          const out = w.room[idx] < 0;
          vf = out ? 0.56 : (w.seen[idx] ? 0.45 : 0.1);
          if (l < 0.1) l = 0.1;
        }
        SB[k] = Math.min(1, l * vf);
      }
    }
  },
  drawLightOverlay() {
    const vw = this.vw, vh = this.vh;
    if (this.lcv.width !== vw || this.lcv.height !== vh) { this.lcv.width = vw; this.lcv.height = vh; this.limg = null; }
    if (!this.limg) this.limg = this.lctx.createImageData(vw, vh);
    const d = this.limg.data, SB = this.shadeB;
    for (let k = 0, n = vw * vh; k < n; k++) {
      const o = k * 4;
      d[o] = 3; d[o + 1] = 5; d[o + 2] = 14;
      d[o + 3] = (1 - SB[k]) * 255;
    }
    this.lctx.putImageData(this.limg, 0, 0);
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
    if (t === WT.BUILT) return '#b89a6a';
    if (WALL_INFO[t].fence) return '#888888';
    const r = World.room(x, y);
    if (r >= 0) return Wd.rooms[r].intCol;
    const ro = d ? World.room(x - 1, y) : World.room(x, y - 1);
    if (ro >= 0) return Wd.buildings[Wd.rooms[ro].b].extCol;
    return '#a0a0a0';
  },
  drawWall(x, y, d, X, Y, pb, p) {
    const w = Wd;
    const t = d ? w.wallW[y * w.w + x] : w.wallN[y * w.w + x];
    const f = World.feat(x, y, d);
    const col = this.wallColor(x, y, d, t);
    let cut = false, alpha = 1;
    const front = p && (d ? x > p.x : y > p.y);
    if (p && front) {
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
    const rec = Spr.wall(t, d, col, f, cut);
    // shading: the face tile, but walls bordering visible tiles stay readable
    let s = this.shadeAt(x, y);
    const so = d ? this.shadeAt(x - 1, y) : this.shadeAt(x, y - 1);
    if (World.room(x, y) < 0 && so > s) s = Math.max(s, so * 0.85);
    if (alpha < 1) this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(Spr.shaded(rec, s), X - rec.ax, Y - rec.ay);
    if (alpha < 1) this.ctx.globalAlpha = 1;
  },
  drawObj(o, x, y, X, Y, p, t) {
    const def = OBJ[o.t];
    const rec = Spr.obj(o);
    let alpha = 1;
    if (p && def.h > 1.1) {
      const by = Y + HTH;
      const top = by - def.h * ZU - (o.t === 'tree' ? 40 : 6);
      const wdt = o.t === 'tree' ? 56 : 30;
      if (by > this.PY - 6 && top < this.PY - 10 && Math.abs(X - this.PX) < wdt && (x + y + 1 > p.x + p.y)) alpha = o.t === 'tree' ? 0.35 : 0.45;
    }
    const s = this.shadeAt(x, y);
    const ctx = this.ctx;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(Spr.shaded(rec, s), X - rec.ax, Y - rec.ay);
    if (alpha < 1) ctx.globalAlpha = 1;
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
    if (o.t === 'generator' && o.on && o.fuel > 0) { const c = isoP(X, Y, 0.3, 0.3, 0.9); ctx.fillStyle = 'rgba(120,120,120,0.4)'; ctx.beginPath(); ctx.arc(c[0] + Math.sin(t * 9) * 2, c[1] - (t * 20 % 12), 3, 0, 7); ctx.fill(); }
  },

  // ------------------------------------------------------------------ roofs
  drawRoof(b, p) {
    const ctx = this.ctx;
    const H = WALL_H, ov = 0.18;
    const x0 = b.x0 - ov, y0 = b.y0 - ov, x1 = b.x1 + 1 + ov, y1 = b.y1 + 1 + ov;
    const P = (x, y, z) => [(x - y) * HTW, (x + y) * HTH - z * ZU];
    let s = Math.max(this.shadeAt(b.x1 + 1, b.y1 + 1), this.shadeAt(b.x0 - 1, b.y1 + 1), this.shadeAt(b.x1 + 1, b.y0 - 1));
    s = Math.max(s, G.light.amb * 0.42);
    // translucency if player hidden beneath
    let alpha = 1;
    if (p && !p.dead) {
      const q = [this.PX, this.PY - 26];
      const quad = [P(b.x0, b.y0, H), P(b.x1 + 1, b.y0, H), P(b.x1 + 1, b.y1 + 1, H), P(b.x0, b.y1 + 1, H)];
      const quad2 = [P(b.x0, b.y0, 0), P(b.x1 + 1, b.y0, 0), P(b.x1 + 1, b.y0, H + 1.2), P(b.x0, b.y0, H + 1.2)];
      if (pointInPoly(q, quad) || (pointInPoly(q, quad2))) alpha = 0.28;
    }
    if (alpha < 1) ctx.globalAlpha = alpha;
    const rc = b.roofCol;
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
    if (alpha < 1) ctx.globalAlpha = 1;
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
    const P = (x, y, z) => [(x - y) * HTW, (x + y) * HTH - (z || 0) * ZU];
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
    if (G.light.flash > 0) { ctx.fillStyle = 'rgba(220,230,255,' + (G.light.flash * 0.5).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  },
};
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
    for (let i = 0; i < n; i++) {
      const a = (dirA !== undefined ? dirA + R.f(-0.8, 0.8) : R.f(0, Math.PI * 2));
      const sp = R.f(0.5, 2.5);
      this.parts.push({ x, y, z: R.f(0.9, 1.4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.f(0, 2), life: 1.2, max: 1.2, col: R.chance(0.5) ? '#8a0a0a' : '#6a0505', size: R.f(1.5, 3), g: true, kind: 'blood' });
    }
    if (G.world && R.chance(0.7)) this.decal(x + R.f(-0.4, 0.4), y + R.f(-0.4, 0.4));
  },
  decal(x, y, s) {
    const w = Wd;
    w.decals.push({ x: x - 0.5, y: y - 0.5, v: R.int(0, 7), age: 0, s: s || R.f(0.6, 1.1) });
    if (w.decals.length > 450) w.decals.shift();
  },
  shards(x, y, z, n, col) {
    for (let i = 0; i < n; i++) {
      const a = R.f(0, Math.PI * 2), sp = R.f(0.5, 2.2);
      this.parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R.f(0.5, 2.5), life: 1.0, max: 1.0, col, size: R.f(1.5, 2.5), g: true });
    }
  },
  smoke(x, y, z) { this.parts.push({ x, y, z, vx: R.f(-0.1, 0.1), vy: R.f(-0.1, 0.1), vz: 0.6, life: 1.6, max: 1.6, col: '#909090', size: R.f(3, 6), smoke: true }); },
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
    const P = (x, y, z) => [(x - y) * HTW, (x + y) * HTH - z * ZU];
    for (const p of this.parts) {
      const s = P(p.x, p.y, p.z);
      const a = Math.min(1, p.life / p.max * 2);
      if (p.smoke) { ctx.fillStyle = 'rgba(140,140,140,' + (0.35 * p.life / p.max).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(s[0], s[1], p.size, 0, 7); ctx.fill(); continue; }
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
  drawFlame(ctx, x, y, t, sc) {
    sc = sc || 1;
    for (let k = 0; k < 5; k++) {
      const ph = t * 7 + k * 1.7;
      const h = (14 + Math.sin(ph) * 5) * sc, wdt = (6 - k * 0.6) * sc;
      const ox = Math.sin(ph * 1.3 + k) * 3 * sc + (k - 2) * 3 * sc;
      ctx.fillStyle = k < 2 ? 'rgba(255,120,30,0.75)' : k < 4 ? 'rgba(255,190,60,0.8)' : 'rgba(255,240,170,0.9)';
      ctx.beginPath(); ctx.moveTo(x + ox - wdt, y); ctx.quadraticCurveTo(x + ox - wdt * 0.5, y - h * 0.6, x + ox, y - h); ctx.quadraticCurveTo(x + ox + wdt * 0.5, y - h * 0.6, x + ox + wdt, y); ctx.closePath(); ctx.fill();
    }
  },
};
