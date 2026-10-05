'use strict';
// ---------------------------------------------------------------------------
// World: tile grid with edge walls, objects, items, queries, collision, LOS, pathing
// ---------------------------------------------------------------------------
let Wd = null; // current world
const World = {
  create(w, h) {
    return {
      w, h,
      floor: new Uint8Array(w * h),
      fvar: new Uint8Array(w * h),
      deco: new Uint8Array(w * h),
      wallN: new Uint8Array(w * h),
      wallW: new Uint8Array(w * h),
      room: new Int16Array(w * h).fill(-1),
      seen: new Uint8Array(w * h),
      obj: new Array(w * h).fill(null),
      items: new Map(),
      feat: new Map(),
      edgeHp: new Map(),
      buildings: [],
      rooms: [],
      decals: [],
      forage: new Map(),
      powerGens: [],
      labels: [],
    };
  },
  use(w) { Wd = w; this._initScratch(); },
  inb(x, y) { return x >= 0 && y >= 0 && x < Wd.w && y < Wd.h; },
  idx(x, y) { return y * Wd.w + x; },
  ek(x, y, d) { return ((y * Wd.w + x) << 1) | d; },
  wall(x, y, d) {
    if (x < 0 || y < 0 || x >= Wd.w || y >= Wd.h) return 0;
    return d ? Wd.wallW[y * Wd.w + x] : Wd.wallN[y * Wd.w + x];
  },
  setWall(x, y, d, t) {
    if (!this.inb(x, y)) return;
    if (d) Wd.wallW[y * Wd.w + x] = t; else Wd.wallN[y * Wd.w + x] = t;
  },
  feat(x, y, d) {
    if (x < 0 || y < 0 || x >= Wd.w || y >= Wd.h) return undefined;
    return Wd.feat.get(((y * Wd.w + x) << 1) | d);
  },
  setFeat(x, y, d, f) {
    const k = this.ek(x, y, d);
    if (f) Wd.feat.set(k, f); else Wd.feat.delete(k);
  },
  // edge between two 4-adjacent tiles -> [x,y,d]
  edgeBetween(ax, ay, bx, by) {
    if (bx === ax + 1) return [bx, by, 1];
    if (bx === ax - 1) return [ax, ay, 1];
    if (by === ay + 1) return [bx, by, 0];
    if (by === ay - 1) return [ax, ay, 0];
    return null;
  },
  // the two tiles separated by an edge
  edgeSides(x, y, d) { return d ? [[x - 1, y], [x, y]] : [[x, y - 1], [x, y]]; },
  floor(x, y) { return this.inb(x, y) ? Wd.floor[y * Wd.w + x] : FL.GRASS; },
  room(x, y) { return this.inb(x, y) ? Wd.room[y * Wd.w + x] : -1; },
  roomObj(x, y) { const r = this.room(x, y); return r >= 0 ? Wd.rooms[r] : null; },
  building(x, y) { const r = this.room(x, y); return r >= 0 ? Wd.buildings[Wd.rooms[r].b] : null; },
  outdoor(x, y) { return this.room(x | 0, y | 0) < 0; },
  isWater(x, y) { const f = this.floor(x, y); return f === FL.WATER || f === FL.DEEPWATER; },
  obj(x, y) { return this.inb(x, y) ? Wd.obj[y * Wd.w + x] : null; },
  setObj(x, y, o) { if (this.inb(x, y)) Wd.obj[y * Wd.w + x] = o; },
  odef(o) { return o ? OBJ[o.t] : null; },

  // ------------------------------------------------------------------ blocking
  edgeBlocksMove(x, y, d) {
    const t = this.wall(x, y, d);
    if (!t) return false;
    const f = this.feat(x, y, d);
    if (f) {
      if (f.k === 'door') return f.barricade > 0 || !(f.open || f.broken);
      if (f.k === 'doorway') return false;
      if (f.k === 'gap') return false;
      return true; // window
    }
    return true;
  },
  edgeBlocksSight(x, y, d) {
    const t = this.wall(x, y, d);
    if (!t) return false;
    const f = this.feat(x, y, d);
    if (f) {
      if (f.k === 'door') return (f.barricade >= 3) || (!f.open && !f.broken && !f.glass);
      if (f.k === 'window') return f.curtainsClosed || f.barricade >= 3;
      return false;
    }
    return !WALL_INFO[t].see;
  },
  // edge can be climbed over (window open/smashed, fence)
  edgeClimbable(x, y, d) {
    const t = this.wall(x, y, d);
    if (!t) return false;
    const f = this.feat(x, y, d);
    if (f) {
      if (f.k === 'window') return (f.open || f.smashed) && !f.barricade;
      return false;
    }
    return !!WALL_INFO[t].climb;
  },
  tileSolid(x, y) {
    if (!this.inb(x, y)) return true;
    const fl = Wd.floor[y * Wd.w + x];
    if (fl === FL.WATER || fl === FL.DEEPWATER) return true;
    const o = Wd.obj[y * Wd.w + x];
    if (!o) return false;
    const s = OBJ[o.t].solid;
    return s === true || (s === 'circle' && o.t === 'tree');
  },

  // ------------------------------------------------------------------ collision
  // circle entity e {x,y}; moves by dx,dy, resolves against walls/solids
  move(e, dx, dy, r) {
    const len = Math.max(Math.abs(dx), Math.abs(dy));
    const steps = Math.max(1, Math.ceil(len / 0.12));
    let hit = false;
    for (let s = 0; s < steps; s++) {
      e.x += dx / steps; e.y += dy / steps;
      if (this.resolve(e, r)) hit = true;
    }
    return hit;
  },
  resolve(e, r) {
    let hit = false;
    for (let it = 0; it < 2; it++) {
      const tx = Math.floor(e.x), ty = Math.floor(e.y);
      for (let y = ty - 1; y <= ty + 1; y++) {
        for (let x = tx - 1; x <= tx + 1; x++) {
          if (!this.inb(x, y)) continue;
          const i = y * Wd.w + x;
          if (Wd.wallN[i] && this.edgeBlocksMove(x, y, 0)) { if (this._pushSeg(e, x, y, x + 1, y, r)) hit = true; }
          if (Wd.wallW[i] && this.edgeBlocksMove(x, y, 1)) { if (this._pushSeg(e, x, y, x, y + 1, r)) hit = true; }
          const fl = Wd.floor[i];
          if (fl === FL.WATER || fl === FL.DEEPWATER) { if (this._pushBox(e, x, y, x + 1, y + 1, r)) hit = true; continue; }
          const o = Wd.obj[i];
          if (o) {
            const s = OBJ[o.t].solid;
            if (s === true) { if (this._pushBox(e, x + 0.06, y + 0.06, x + 0.94, y + 0.94, r)) hit = true; }
            else if (s === 'circle') { if (this._pushCircle(e, x + 0.5, y + 0.5, OBJ[o.t].rad + r)) hit = true; }
          }
        }
      }
      // map bounds
      if (e.x < r) e.x = r; if (e.y < r) e.y = r;
      if (e.x > Wd.w - r) e.x = Wd.w - r; if (e.y > Wd.h - r) e.y = Wd.h - r;
    }
    return hit;
  },
  _pushSeg(e, ax, ay, bx, by, r) {
    const dx = bx - ax, dy = by - ay;
    let t = ((e.x - ax) * dx + (e.y - ay) * dy) / (dx * dx + dy * dy);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cy = ay + dy * t;
    let ox = e.x - cx, oy = e.y - cy;
    const d2 = ox * ox + oy * oy;
    if (d2 >= r * r) return false;
    let d = Math.sqrt(d2);
    if (d < 1e-5) { ox = -dy; oy = dx; d = Math.sqrt(ox * ox + oy * oy); }
    const p = (r - d) / d;
    e.x += ox * p; e.y += oy * p;
    return true;
  },
  _pushBox(e, x0, y0, x1, y1, r) {
    const cx = e.x < x0 ? x0 : e.x > x1 ? x1 : e.x;
    const cy = e.y < y0 ? y0 : e.y > y1 ? y1 : e.y;
    let ox = e.x - cx, oy = e.y - cy;
    const d2 = ox * ox + oy * oy;
    if (d2 >= r * r) return false;
    if (d2 < 1e-8) { // inside: push out along min axis
      const l = e.x - x0, rr = x1 - e.x, t = e.y - y0, b = y1 - e.y;
      const m = Math.min(l, rr, t, b);
      if (m === l) e.x = x0 - r; else if (m === rr) e.x = x1 + r; else if (m === t) e.y = y0 - r; else e.y = y1 + r;
      return true;
    }
    const d = Math.sqrt(d2), p = (r - d) / d;
    e.x += ox * p; e.y += oy * p;
    return true;
  },
  _pushCircle(e, cx, cy, rr) {
    let ox = e.x - cx, oy = e.y - cy;
    const d2 = ox * ox + oy * oy;
    if (d2 >= rr * rr) return false;
    let d = Math.sqrt(d2);
    if (d < 1e-5) { ox = 1; oy = 0; d = 1; }
    const p = (rr - d) / d;
    e.x += ox * p; e.y += oy * p;
    return true;
  },

  // ------------------------------------------------------------------ line tests
  // DDA through grid; mode 'sight' or 'move'
  lineClear(x0, y0, x1, y1, mode) {
    let cx = Math.floor(x0), cy = Math.floor(y0);
    const ex = Math.floor(x1), ey = Math.floor(y1);
    const dx = x1 - x0, dy = y1 - y0;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    let tmx = dx > 0 ? (cx + 1 - x0) / dx : dx < 0 ? (x0 - cx) / -dx : Infinity;
    let tmy = dy > 0 ? (cy + 1 - y0) / dy : dy < 0 ? (y0 - cy) / -dy : Infinity;
    let n = Math.abs(ex - cx) + Math.abs(ey - cy);
    const sight = mode !== 'move';
    while (n-- > 0) {
      if (tmx < tmy) {
        const nx = cx + sx;
        const wx = sx > 0 ? nx : cx;
        if (sight ? this.edgeBlocksSight(wx, cy, 1) : this.edgeBlocksMove(wx, cy, 1)) return false;
        cx = nx; tmx += tdx;
      } else {
        const ny = cy + sy;
        const wy = sy > 0 ? ny : cy;
        if (sight ? this.edgeBlocksSight(cx, wy, 0) : this.edgeBlocksMove(cx, wy, 0)) return false;
        cy = ny; tmy += tdy;
      }
      if (!sight && this.tileSolid(cx, cy)) return false;
    }
    return true;
  },
  // can something on tile a reach tile b (same / 8-neighbour) without crossing a wall?
  adjacentReach(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    if (!dx && !dy) return true;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
    const open = (x0, y0, x1, y1) => !this.edgeBlocksMove(...this.edgeBetween(x0, y0, x1, y1));
    if (!dx || !dy) return open(ax, ay, bx, by);
    return (open(ax, ay, bx, ay) && open(bx, ay, bx, by) && !this.tileSolid(bx, ay)) || (open(ax, ay, ax, by) && open(ax, by, bx, by) && !this.tileSolid(ax, by));
  },
  // walkable straight path for a circle of radius r
  pathClear(x0, y0, x1, y1, r) {
    if (!this.lineClear(x0, y0, x1, y1, 'move')) return false;
    const dx = x1 - x0, dy = y1 - y0, l = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / l * r * 0.9, ny = dx / l * r * 0.9;
    return this.lineClear(x0 + nx, y0 + ny, x1 + nx, y1 + ny, 'move') && this.lineClear(x0 - nx, y0 - ny, x1 - nx, y1 - ny, 'move');
  },
  // first blocking edge along a segment (for bullets/attacks on doors)
  firstEdgeHit(x0, y0, x1, y1) {
    let cx = Math.floor(x0), cy = Math.floor(y0);
    const ex = Math.floor(x1), ey = Math.floor(y1);
    const dx = x1 - x0, dy = y1 - y0;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    let tmx = dx > 0 ? (cx + 1 - x0) / dx : dx < 0 ? (x0 - cx) / -dx : Infinity;
    let tmy = dy > 0 ? (cy + 1 - y0) / dy : dy < 0 ? (y0 - cy) / -dy : Infinity;
    let n = Math.abs(ex - cx) + Math.abs(ey - cy);
    while (n-- > 0) {
      if (tmx < tmy) {
        const nx = cx + sx, wx = sx > 0 ? nx : cx;
        if (this.edgeBlocksMove(wx, cy, 1)) return { x: wx, y: cy, d: 1, t: tmx };
        cx = nx; tmx += tdx;
      } else {
        const ny = cy + sy, wy = sy > 0 ? ny : cy;
        if (this.edgeBlocksMove(cx, wy, 0)) return { x: cx, y: wy, d: 0, t: tmy };
        cy = ny; tmy += tdy;
      }
    }
    return null;
  },

  // ------------------------------------------------------------------ FOV
  _initScratch() {
    const n = Wd.w * Wd.h;
    this.vis = new Uint8Array(n);     // 1 = visible this frame
    this.visGen = new Uint32Array(n);
    this.gen = 1;
    this.pfG = new Float32Array(n);
    this.pfFrom = new Int32Array(n);
    this.pfStamp = new Uint32Array(n);
    this.pfClosed = new Uint32Array(n);
    this.pfGen = 1;
  },
  isVis(x, y) { return this.inb(x, y) && this.visGen[y * Wd.w + x] === this.gen; },
  // cast rays from (px,py); tiles within cone (or close) are marked visible
  computeFOV(px, py, facing, halfCone, radius, nearR) {
    this.gen++;
    this.wallLit.clear();
    const g = this.gen, W = Wd.w, H = Wd.h;
    const N = 900;
    const pcx = Math.floor(px), pcy = Math.floor(py);
    if (this.inb(pcx, pcy)) { this.visGen[pcy * W + pcx] = g; Wd.seen[pcy * W + pcx] = 1; }
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const inCone = Math.abs(U.angDiff(facing, a)) <= halfCone;
      const maxD = inCone ? radius : nearR;
      const dx = Math.cos(a), dy = Math.sin(a);
      let cx = pcx, cy = pcy;
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
      const tdx = Math.abs(dx) > 1e-9 ? Math.abs(1 / dx) : Infinity, tdy = Math.abs(dy) > 1e-9 ? Math.abs(1 / dy) : Infinity;
      let tmx = dx > 0 ? (cx + 1 - px) / dx : dx < 0 ? (px - cx) / -dx : Infinity;
      let tmy = dy > 0 ? (cy + 1 - py) / dy : dy < 0 ? (py - cy) / -dy : Infinity;
      for (let s = 0; s < 120; s++) {
        let t, nx = cx, ny = cy, blocked;
        if (tmx < tmy) {
          t = tmx; nx = cx + sx;
          if (t > maxD) break;
          const wx = sx > 0 ? nx : cx;
          blocked = this.edgeBlocksSight(wx, cy, 1);
          tmx += tdx;
        } else {
          t = tmy; ny = cy + sy;
          if (t > maxD) break;
          const wy = sy > 0 ? ny : cy;
          blocked = this.edgeBlocksSight(cx, wy, 0);
          tmy += tdy;
        }
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
        const i = ny * W + nx;
        if (blocked) {
          // the far tile's near walls are visible; mark it as wall-lit (value 2 via seen)
          if (this.visGen[i] !== g) this.wallLit.add(i);
          break;
        }
        this.visGen[i] = g;
        Wd.seen[i] = 1;
        cx = nx; cy = ny;
      }
    }
  },
  wallLit: new Set(),

  // ------------------------------------------------------------------ A* pathfinding
  // who: 'z' zombie (doors/windows passable at cost), 'p' player
  findPath(sx, sy, tx, ty, who, maxNodes) {
    sx |= 0; sy |= 0; tx |= 0; ty |= 0;
    if (!this.inb(tx, ty) || !this.inb(sx, sy)) return null;
    if (sx === tx && sy === ty) return [[tx, ty]];
    maxNodes = maxNodes || 1500;
    const W = Wd.w;
    const gen = ++this.pfGen;
    const G_ = this.pfG, from = this.pfFrom, stamp = this.pfStamp, closed = this.pfClosed;
    const heap = [];  // [f, idx]
    const push = (f, i) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; let c = 0;
        for (;;) {
          const l = c * 2 + 1, r = l + 1; let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m;
        }
      }
      return top;
    };
    const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
    const si = sy * W + sx, ti = ty * W + tx;
    stamp[si] = gen; G_[si] = 0; from[si] = -1;
    push(h(sx, sy), si);
    let expanded = 0, best = si, bestH = h(sx, sy);
    const targetSolid = this.tileSolid(tx, ty);
    while (heap.length) {
      const [, ci] = pop();
      if (closed[ci] === gen) continue;
      closed[ci] = gen;
      if (ci === ti) { best = ti; break; }
      if (++expanded > maxNodes) break;
      const cx = ci % W, cy = (ci / W) | 0;
      const hh = h(cx, cy);
      if (hh < bestH) { bestH = hh; best = ci; }
      for (let k = 0; k < 8; k++) {
        const ddx = DIR8[k][0], ddy = DIR8[k][1];
        const nx = cx + ddx, ny = cy + ddy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= Wd.h) continue;
        const ni = ny * W + nx;
        if (closed[ni] === gen) continue;
        let cost;
        if (ddx === 0 || ddy === 0) {
          cost = this._stepCost(cx, cy, nx, ny, who);
          if (cost < 0) continue;
          if (this.tileSolid(nx, ny) && !(ni === ti && targetSolid)) continue;
        } else {
          // diagonal: both orthogonal routes must be free
          if (this.tileSolid(nx, ny) || this.tileSolid(cx + ddx, cy) || this.tileSolid(cx, cy + ddy)) continue;
          const a1 = this._stepCost(cx, cy, cx + ddx, cy, who), a2 = this._stepCost(cx + ddx, cy, nx, ny, who);
          const b1 = this._stepCost(cx, cy, cx, cy + ddy, who), b2 = this._stepCost(cx, cy + ddy, nx, ny, who);
          if (a1 !== 1 || a2 !== 1 || b1 !== 1 || b2 !== 1) continue;
          cost = 1.414;
        }
        const ng = G_[ci] + cost;
        if (stamp[ni] !== gen || ng < G_[ni]) {
          stamp[ni] = gen; G_[ni] = ng; from[ni] = ci;
          push(ng + h(nx, ny) * 1.05, ni);
        }
      }
    }
    if (best !== ti && who === 'p') return null;
    const path = [];
    let c = best;
    while (c !== -1 && c !== si) { path.push([c % W, (c / W) | 0]); c = from[c]; }
    path.reverse();
    return path.length ? path : null;
  },
  // cost of stepping between orthogonal neighbours, -1 = impassable
  _stepCost(ax, ay, bx, by, who) {
    const e = this.edgeBetween(ax, ay, bx, by);
    const t = this.wall(e[0], e[1], e[2]);
    if (!t) return 1;
    const f = this.feat(e[0], e[1], e[2]);
    if (f) {
      if (f.k === 'doorway' || f.k === 'gap') return 1;
      if (f.k === 'door') {
        if (f.broken && !f.barricade) return 1;
        if (who === 'z') return f.open && !f.barricade ? 1 : 8 + f.barricade * 6;
        if (f.barricade) return -1;
        if (f.open) return 1;
        if (f.locked && !(G.player && Player.hasKeyFor(f))) return -1;
        return 1.5;
      }
      if (f.k === 'window') {
        if (who === 'z') return 10 + (f.barricade || 0) * 6;
        if (f.barricade) return -1;
        return (f.open || f.smashed) ? 4 : (f.locked ? -1 : 5);
      }
    }
    const wi = WALL_INFO[t];
    if (wi.climb) return who === 'z' ? 7 : 4;
    return -1;
  },

  // ------------------------------------------------------------------ items & containers
  floorItems(x, y) { return Wd.items.get(y * Wd.w + x) || null; },
  dropItem(x, y, it) {
    const i = (y | 0) * Wd.w + (x | 0);
    let a = Wd.items.get(i);
    if (!a) { a = []; Wd.items.set(i, a); }
    it.fx = R.f(0.2, 0.8); it.fy = R.f(0.2, 0.8);
    delete it.equipped; delete it.worn;
    a.push(it);
  },
  removeFloorItem(x, y, it) {
    const i = (y | 0) * Wd.w + (x | 0);
    const a = Wd.items.get(i);
    if (!a) return;
    const k = a.indexOf(it);
    if (k >= 0) a.splice(k, 1);
    if (!a.length) Wd.items.delete(i);
  },
  contItems(o, x, y) {
    const c = o.c;
    if (!c) return null;
    if (!c.items) {
      const r = this.roomObj(x, y);
      const rt = c.loot || (r ? r.type : 'outside');
      let luck = 0;
      if (G.player) { if (Player.hasTrait('lucky')) luck = 1; if (Player.hasTrait('unlucky')) luck = -1; }
      c.items = Loot.roll(rt, c.type, luck);
      // fridges/coolers in stores start with cold food
    }
    return c.items;
  },

  // ------------------------------------------------------------------ power & water
  hasPower(x, y) {
    if (!G.events.powerOff) return true;
    for (const g of Wd.powerGens) {
      if (g.on && g.fuel > 0 && Math.abs(g.x - x) <= 10 && Math.abs(g.y - y) <= 10) return true;
    }
    return false;
  },
  hasWater() { return !G.events.waterOff; },
};
const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
