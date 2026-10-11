'use strict';
// ---------------------------------------------------------------------------
// Procedural town generator: "Hollow Creek"
// ---------------------------------------------------------------------------
const PAL = {
  ext: ['#c8c0b0', '#a8b8c8', '#d8d0b8', '#b0a890', '#c8a890', '#8aa0a8', '#d8d8d0', '#b8c0a8', '#a89888', '#c0b8d0', '#d0c0a0'],
  brick: ['#9a5a4a', '#8a4a3a', '#a86a5a', '#7a5048'],
  int: ['#d8d0c0', '#c8d8c8', '#d8c8b8', '#c0c8d8', '#e0d8c8', '#d0b8b8', '#b8c8b0', '#e8e0d0', '#c8b8a0', '#d8d8e8'],
  roof: ['#5a4038', '#4a4a50', '#6a3a30', '#3a4048', '#5a5a48', '#704a3a', '#404a40', '#5a3a3a'],
  roofFlat: ['#6a6a68', '#5a5a5c', '#707068', '#606058'],
};
const DIRV = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
function vecDir(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N'); }

const MapGen = {
  W: 800, GW: 400, H: 400,
  RP: [45, 75, 105, 135, 165, 195],
  // second town: Millbrook, to the south-east
  RX2: [270, 300, 330, 360], RY2: [255, 285, 315, 345],

  generate(seed) {
    const W = this.W, H = this.H;
    this.rng = new RNG(seed);
    const w = this.w = World.create(W, H, this.GW);
    World.use(w);
    w.seed = seed;
    w.carSpots = [];
    w.zones = [];
    w.spawnHouses = [];
    this.used = new Uint8Array(W * H);
    this.resv = new Set();
    this.roadCnt = new Uint8Array(W * H);
    this.nA = makeNoise(seed + 11); this.nB = makeNoise(seed + 23); this.nC = makeNoise(seed + 37);
    this.terrain();
    this.lake(212, 30, 16);
    this.roads();
    this.town();
    this.town2();
    this.outskirts();
    this.outskirts2();
    // detail passes (street furniture, yards) - defined in street.js / yard.js
    if (this.streetPass) this.streetPass();
    if (this.yardPass) this.yardPass();
    this.forest();
    this.finalize();
    // keep saves compact
    for (const o of w.obj) if (o && o.sz) o.sz = Math.round(o.sz * 100) / 100;
    return w;
  },

  // ---------------------------------------------------------------- helpers
  sf(x, y, f, v) {
    if (!World.inb(x, y)) return;
    const i = y * this.W + x;
    this.w.floor[i] = f;
    if (v !== undefined) this.w.fvar[i] = v;
  },
  mark(x0, y0, x1, y1, v) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (World.inb(x, y)) { const i = y * this.W + x; if (this.used[i] < v) this.used[i] = v; }
  },
  fill(x0, y0, x1, y1, f, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.sf(x, y, f, v); },
  clearObj(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (World.inb(x, y)) this.w.obj[y * this.W + x] = null; },
  mkObj(t, dir, extra) {
    const d = OBJ[t];
    const o = { t, dir: dir || 'S' };
    if (d.cont) o.c = { type: d.cont.type, cap: d.cont.cap, items: null };
    if (extra) Object.assign(o, extra);
    return o;
  },
  put(x, y, t, dir, extra) {
    if (!World.inb(x, y)) return null;
    const o = this.mkObj(t, dir, extra);
    this.w.obj[y * this.W + x] = o;
    return o;
  },
  free(x, y) { return World.inb(x, y) && !this.w.obj[y * this.W + x] && this.w.room[y * this.W + x] < 0 && !World.isWater(x, y); },

  // ---------------------------------------------------------------- terrain
  terrain() {
    const W = this.W, GW = this.GW, H = this.H, r = this.rng;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x >= GW) { this.sf(x, y, FL.VOID, 0); continue; }
      const n = this.nA(x / 14, y / 14, 3);
      this.sf(x, y, n > 0.58 ? FL.GRASS2 : FL.GRASS, r.int(0, 3));
    }
    // invisible barrier between the ground map and the upper-floor layer
    for (let y = 0; y < H; y++) World.setWall(GW, y, 1, WT.BOUND);
    this.mark(GW, 0, W - 1, H - 1, 2);
  },
  lake(cx, cy, rad) {
    const r = this.rng;
    for (let y = cy - rad - 6; y <= cy + rad + 6; y++) for (let x = cx - rad - 8; x <= cx + rad + 8; x++) {
      if (!World.inb(x, y)) continue;
      const dx = (x - cx) / 1.25, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const edge = rad * (0.78 + 0.45 * this.nB(x / 7, y / 7, 2));
      if (d < edge * 0.55) this.sf(x, y, FL.DEEPWATER, r.int(0, 3));
      else if (d < edge) this.sf(x, y, FL.WATER, r.int(0, 3));
      else if (d < edge + 1.6) this.sf(x, y, FL.SAND, r.int(0, 3));
      if (d < edge + 2) this.mark(x, y, x, y, 1);
    }
    this.w.labels.push({ x: cx, y: cy, text: 'Hollow Lake' });
  },

  // ---------------------------------------------------------------- roads
  roads() {
    const RP = this.RP, W = this.W, H = this.H;
    const a = RP[0], b = RP[5] + 3;
    const RX2 = this.RX2, RY2 = this.RY2;
    const a2x = RX2[0], b2x = RX2[RX2.length - 1] + 3, a2y = RY2[0], b2y = RY2[RY2.length - 1] + 3;
    const rects = [];
    for (const y of RP) rects.push({ h: true, p: y, s: (y === 105 ? 0 : a), e: (y === 105 ? this.GW - 1 : b), side: true });
    for (const x of RP) rects.push({ h: false, p: x, s: (x === 135 ? 0 : a), e: (x === 135 ? H - 1 : b), side: true });
    // Millbrook grid; one street runs west to Main Street, one north to the highway
    for (const y of RY2) rects.push({ h: true, p: y, s: (y === 315 ? 135 : a2x), e: b2x, side: true });
    for (const x of RX2) rects.push({ h: false, p: x, s: (x === 300 ? 105 : a2y), e: b2y, side: true });
    const inTown = (x, y) => (x >= a - 1 && x <= b + 1 && y >= a - 1 && y <= b + 1) || (x >= a2x - 1 && x <= b2x + 1 && y >= a2y - 1 && y <= b2y + 1);
    // pass 1: sidewalks
    for (const R_ of rects) {
      for (let t = R_.s; t <= R_.e; t++) {
        for (const off of [-1, 4]) {
          const x = R_.h ? t : R_.p + off, y = R_.h ? R_.p + off : t;
          if (inTown(x, y) && World.inb(x, y)) { this.sf(x, y, FL.SIDEWALK, this.rng.int(0, 3)); this.mark(x, y, x, y, 1); }
        }
      }
    }
    // pass 2: asphalt
    for (const R_ of rects) {
      for (let t = R_.s; t <= R_.e; t++) for (let k = 0; k < 4; k++) {
        const x = R_.h ? t : R_.p + k, y = R_.h ? R_.p + k : t;
        if (!World.inb(x, y)) continue;
        this.sf(x, y, FL.ASPHALT, this.rng.int(0, 3));
        this.roadCnt[y * W + x]++;
        this.mark(x, y, x, y, 1);
      }
    }
    // pass 3: markings (1 = dash on S edge, 2 = dash on E edge, 3/4 crosswalk)
    for (const R_ of rects) {
      for (let t = R_.s; t <= R_.e; t++) {
        const x = R_.h ? t : R_.p + 1, y = R_.h ? R_.p + 1 : t;
        if (!World.inb(x, y)) continue;
        // skip intersections
        let inter = false;
        for (let k = 0; k < 4; k++) { const xx = R_.h ? t : R_.p + k, yy = R_.h ? R_.p + k : t; if (this.roadCnt[yy * W + xx] > 1) inter = true; }
        if (inter) continue;
        // crosswalk next to intersection
        const nb1 = R_.h ? this.roadCnt[(R_.p + 1) * W + t - 1] > 1 : this.roadCnt[(t - 1) * W + R_.p + 1] > 1;
        const nb2 = R_.h ? this.roadCnt[(R_.p + 1) * W + t + 1] > 1 : this.roadCnt[(t + 1) * W + R_.p + 1] > 1;
        if ((nb1 || nb2) && inTown(x, y)) {
          for (let k = 0; k < 4; k++) { const xx = R_.h ? t : R_.p + k, yy = R_.h ? R_.p + k : t; this.w.deco[yy * W + xx] = R_.h ? 3 : 4; }
          continue;
        }
        if ((t >> 1) & 1) this.w.deco[y * W + x] = R_.h ? 1 : 2;
      }
      // parked cars along curb
      for (let t = R_.s + 6; t <= R_.e - 6; t += 1) {
        if (this.rng.next() > (inTown(R_.h ? t : R_.p, R_.h ? R_.p : t) ? 0.035 : 0.012)) continue;
        const lane = this.rng.chance(0.5) ? 0 : 3;
        const x = R_.h ? t : R_.p + lane, y = R_.h ? R_.p + lane : t;
        let ok = true;
        for (let k = -3; k <= 3; k++) { const xx = R_.h ? t + k : R_.p + 1, yy = R_.h ? R_.p + 1 : t + k; if (!World.inb(xx, yy) || this.roadCnt[yy * W + xx] !== 1) ok = false; }
        if (!ok) continue;
        const crashed = this.rng.chance(0.25);
        let ang = R_.h ? (lane === 0 ? Math.PI : 0) : (lane === 0 ? Math.PI / 2 : -Math.PI / 2);
        if (crashed) ang += this.rng.f(-0.8, 0.8);
        this.w.carSpots.push({ x: x + 0.5 + (R_.h ? 0 : (lane === 0 ? 0.3 : -0.3)), y: y + 0.5 + (R_.h ? (lane === 0 ? 0.3 : -0.3) : 0), a: ang, crashed });
        t += 7;
      }
    }
    // dirt roads: farm + cabin trails
    this.dirtPath([[28, 109], [28, 232]], 3);
    this.dirtPath([[44, 47], [17, 47], [17, 26]], 2);
    this.dirtPath([[199, 58], [212, 58]], 2);
    this.dirtPath([[109, 253], [134, 253]], 2);
    this.dirtPath([[364, 120], [364, 40]], 2);
    this.dirtPath([[138, 372], [196, 372]], 2);
  },
  dirtPath(pts, wd) {
    for (let i = 0; i < pts.length - 1; i++) {
      let [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
      const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
      for (;;) {
        for (let a = 0; a < wd; a++) for (let b = 0; b < wd; b++) {
          const x = x0 + (sy ? a : 0) - (sy ? 0 : 0), y = y0 + (sx ? b : 0);
          if (World.inb(x, y) && this.w.floor[y * this.W + x] !== FL.ASPHALT) { this.sf(x, y, FL.DIRT, this.rng.int(0, 3)); this.mark(x, y, x, y, 1); }
        }
        if (x0 === x1 && y0 === y1) break;
        x0 += sx; y0 += sy;
      }
    }
  },

  // ---------------------------------------------------------------- buildings
  // chance that a house has a burglar alarm (sandbox option; stores are a few times likelier)
  alarmP() { const v = G.sb && G.sb.alarms; return v === undefined ? 0.03 : v; },
  newBuilding(type, x0, y0, x1, y1, o) {
    const r = this.rng;
    const b = Object.assign({
      id: this.w.buildings.length, type, x0, y0, x1, y1, rooms: [],
      wallType: WT.EXT, extCol: r.pick(PAL.ext), roofCol: r.pick(PAL.roof), roof: 'gable',
      alarm: r.chance(this.alarmP()), name: null,
    }, o || {});
    if (b.wallType === WT.BRICK && !(o && o.extCol)) b.extCol = r.pick(PAL.brick);
    this.w.buildings.push(b);
    this.mark(x0 - 1, y0 - 1, x1 + 1, y1 + 1, 2);
    this.clearObj(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    return b;
  },
  addRoom(b, type, x0, y0, x1, y1, floor, fvar) {
    const r = this.rng;
    const room = { id: this.w.rooms.length, b: b.id, type, x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), intCol: r.pick(PAL.int), lights: false };
    this.w.rooms.push(room);
    b.rooms.push(room.id);
    if (fvar === undefined) fvar = r.int(0, 7);
    for (let y = room.y0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) {
      const i = y * this.W + x;
      this.w.room[i] = room.id;
      this.w.floor[i] = floor;
      this.w.fvar[i] = fvar;
      this.w.obj[i] = null;
    }
    return room;
  },
  bOfRoom(rid) { return rid < 0 ? -1 : this.w.rooms[rid].b; },
  buildWalls(b, ox) {
    ox = ox || 0;
    for (let y = b.y0; y <= b.y1 + 1; y++) for (let x = b.x0 + ox; x <= b.x1 + 1 + ox; x++) {
      if (!World.inb(x, y)) continue;
      // N edge
      let ra = World.room(x, y - 1), rb = World.room(x, y);
      if (ra !== rb && (this.bOfRoom(ra) === b.id || this.bOfRoom(rb) === b.id)) {
        World.setWall(x, y, 0, (ra >= 0 && rb >= 0 && this.bOfRoom(ra) === this.bOfRoom(rb)) ? WT.INT : b.wallType);
      }
      ra = World.room(x - 1, y);
      if (ra !== rb && (this.bOfRoom(ra) === b.id || this.bOfRoom(rb) === b.id)) {
        World.setWall(x, y, 1, (ra >= 0 && rb >= 0 && this.bOfRoom(ra) === this.bOfRoom(rb)) ? WT.INT : b.wallType);
      }
    }
  },
  roomTiles(rm) { const a = []; for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) a.push([x, y]); return a; },
  // edges between room A tiles and tiles satisfying pred(nx,ny); returns [{x,y,ex,ey,ed,nx,ny,dir,corner}]
  borderEdges(rm, pred) {
    const out = [];
    for (const [x, y] of this.roomTiles(rm)) {
      for (const dn of ['N', 'S', 'W', 'E']) {
        const [dx, dy] = DIRV[dn];
        const nx = x + dx, ny = y + dy;
        if (!pred(nx, ny)) continue;
        const e = World.edgeBetween(x, y, nx, ny);
        // corner check: perpendicular neighbours on both sides in same rooms
        const px = dy !== 0 ? 1 : 0, py = dx !== 0 ? 1 : 0;
        const rA = World.room(x, y), rB = World.room(nx, ny);
        const corner = !(World.room(x + px, y + py) === rA && World.room(x - px, y - py) === rA && World.room(nx + px, ny + py) === rB && World.room(nx - px, ny - py) === rB);
        out.push({ x, y, ex: e[0], ey: e[1], ed: e[2], nx, ny, dir: dn, corner });
      }
    }
    return out;
  },
  setDoor(e, o) {
    const f = Object.assign({ k: 'door', open: false, locked: false, broken: false, hp: 100, maxhp: 100, barricade: 0, bhp: [], glass: false, style: 'wood', col: this.rng.pick(['#7a5a3a', '#f0f0f0', '#8a3a2a', '#3a4a6a', '#5a4030', '#e8e0d0']) }, o || {});
    if (f.style === 'glass') { f.glass = true; f.hp = 40; f.maxhp = 40; }
    if (f.style === 'garage') { f.hp = 160; f.maxhp = 160; f.col = '#d8d8d0'; }
    if (f.style === 'metal') { f.hp = 300; f.maxhp = 300; f.col = '#707880'; }
    World.setFeat(e.ex, e.ey, e.ed, f);
    return f;
  },
  setWindow(e, o) {
    const f = Object.assign({ k: 'window', open: false, smashed: false, glassOut: false, locked: this.rng.chance(0.3), barricade: 0, bhp: [], curtains: this.rng.chance(0.7), curtainsClosed: false, hp: 8, curtCol: this.rng.pick(['#c8b890', '#a04040', '#5a7aa0', '#e0e0d0', '#7a9a6a']) }, o || {});
    if (f.curtains) f.curtainsClosed = this.rng.chance(0.25);
    World.setFeat(e.ex, e.ey, e.ed, f);
    return f;
  },
  doorBetween(rA, rB, style, doorway) {
    let cands = this.borderEdges(rA, (x, y) => World.room(x, y) === rB.id);
    if (!cands.length) return null;
    const good = cands.filter(c => !c.corner);
    if (good.length) cands = good;
    const c = cands[Math.floor(cands.length / 2 + this.rng.int(-Math.floor(cands.length / 4), Math.floor(cands.length / 4)))] || cands[0];
    if (doorway) World.setFeat(c.ex, c.ey, c.ed, { k: 'doorway' });
    else this.setDoor(c, { style: style || 'wood', col: '#c8b8a0' });
    return c;
  },
  exteriorDoor(rm, dirPref, opts) {
    let cands = this.borderEdges(rm, (x, y) => World.room(x, y) < 0).filter(c => !c.corner && !World.feat(c.ex, c.ey, c.ed));
    if (dirPref) { const p = cands.filter(c => c.dir === dirPref); if (p.length) cands = p; else if (opts && opts.strict) return null; }
    if (!cands.length) return null;
    const c = cands[Math.floor(cands.length / 2)];
    this.setDoor(c, opts);
    return c;
  },
  windows(rm, opts) {
    opts = opts || {};
    const cands = this.borderEdges(rm, (x, y) => World.room(x, y) < 0).filter(c => !c.corner);
    let placed = 0;
    for (const c of cands) {
      if (World.feat(c.ex, c.ey, c.ed)) continue;
      const so = this.w.obj[c.y * this.W + c.x];
      if (so && so.sx !== undefined) continue;
      if (this.resv.has(c.y * this.W + c.x) && c.x >= LV.W0) continue;
      // keep distance from other features on the same wall line
      let near = false;
      for (const dd of [-1, 1]) {
        const ax = c.ed ? c.ex : c.ex + dd, ay = c.ed ? c.ey + dd : c.ey;
        const f = World.feat(ax, ay, c.ed);
        if (f && (f.k !== 'window' || !opts.dense)) near = true;
      }
      if (near) continue;
      if (opts.dense || this.rng.chance(opts.p || 0.45)) { this.setWindow(c, opts.win); placed++; }
    }
    if (!placed && !opts.none) {
      const c = cands.find(c => !World.feat(c.ex, c.ey, c.ed) && !(this.w.obj[c.y * this.W + c.x] && this.w.obj[c.y * this.W + c.x].sx !== undefined));
      if (c) this.setWindow(c, opts.win);
    }
  },
  // ---------------------------------------------------------------- furniture placement
  wallKind(x, y, side) {
    let e;
    if (side === 'N') e = [x, y, 0]; else if (side === 'S') e = [x, y + 1, 0]; else if (side === 'W') e = [x, y, 1]; else e = [x + 1, y, 1];
    if (!World.wall(e[0], e[1], e[2])) return 0;
    const f = World.feat(e[0], e[1], e[2]);
    if (!f) return 1;
    if (f.k === 'window') return 2;
    return 3;
  },
  reserved(x, y) {
    if (this.resv.has(y * this.W + x)) return true;
    for (const s of ['N', 'S', 'W', 'E']) if (this.wallKind(x, y, s) === 3) return true;
    return false;
  },
  connected(rm) {
    const tiles = this.roomTiles(rm).filter(([x, y]) => !World.tileSolid(x, y));
    if (!tiles.length) return false;
    let start = tiles.find(([x, y]) => this.reserved(x, y)) || tiles[0];
    const key = (x, y) => y * this.W + x;
    const seen = new Set([key(start[0], start[1])]);
    const q = [start];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of DIR4) {
        const nx = x + dx, ny = y + dy;
        if (nx < rm.x0 || nx > rm.x1 || ny < rm.y0 || ny > rm.y1) continue;
        const k = key(nx, ny);
        if (seen.has(k) || World.tileSolid(nx, ny)) continue;
        if (World.edgeBlocksMove(...World.edgeBetween(x, y, nx, ny))) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen.size === tiles.length;
  },
  inRoom(rm, x, y) { return x >= rm.x0 && x <= rm.x1 && y >= rm.y0 && y <= rm.y1; },
  // place furniture of type t against a wall. two: 'perp' (bed) | 'along' (sofa)
  place(rm, t, o) {
    o = o || {};
    const tall = OBJ[t].h > 1.3;
    const cands = [];
    for (const [x, y] of this.roomTiles(rm)) {
      if (this.w.obj[y * this.W + x] || this.reserved(x, y)) continue;
      for (const s of (o.sides || ['N', 'S', 'W', 'E'])) {
        const k = this.wallKind(x, y, s);
        if (k === 1 || (k === 2 && !tall && !o.noWindow)) cands.push([x, y, s]);
      }
    }
    this.rng.shuffle(cands);
    for (const [x, y, s] of cands) {
      const dir = OPP[s];
      const placed = [[x, y]];
      let ok = true;
      if (o.two === 'perp') {
        const [dx, dy] = DIRV[dir];
        const x2 = x + dx, y2 = y + dy;
        if (!this.inRoom(rm, x2, y2) || this.w.obj[y2 * this.W + x2] || this.reserved(x2, y2)) ok = false;
        else placed.push([x2, y2]);
      } else if (o.two === 'along') {
        const [dx, dy] = DIRV[dir];
        const opts = this.rng.chance(0.5) ? [[-dy, dx], [dy, -dx]] : [[dy, -dx], [-dy, dx]];
        ok = false;
        for (const [px, py] of opts) {
          const x2 = x + px, y2 = y + py;
          if (this.inRoom(rm, x2, y2) && !this.w.obj[y2 * this.W + x2] && !this.reserved(x2, y2) && this.wallKind(x2, y2, s) === this.wallKind(x, y, s)) { placed.push([x2, y2]); ok = true; break; }
        }
      }
      if (!ok) continue;
      const objs = placed.map(([px, py], i) => {
        const ob = this.mkObj(t, dir, placed.length > 1 ? { part: i } : null);
        if (o.extra) Object.assign(ob, o.extra);
        if (i > 0) delete ob.c;
        this.w.obj[py * this.W + px] = ob;
        return ob;
      });
      if (this.connected(rm)) return objs[0];
      for (const [px, py] of placed) this.w.obj[py * this.W + px] = null;
    }
    return null;
  },
  placeCenter(rm, t, chairs) {
    const cands = this.roomTiles(rm).filter(([x, y]) => !this.w.obj[y * this.W + x] && !this.reserved(x, y) &&
      ['N', 'S', 'W', 'E'].every(s => this.wallKind(x, y, s) === 0));
    this.rng.shuffle(cands);
    for (const [x, y] of cands) {
      this.w.obj[y * this.W + x] = this.mkObj(t, 'S');
      if (!this.connected(rm)) { this.w.obj[y * this.W + x] = null; continue; }
      if (chairs) {
        for (const s of ['N', 'S', 'W', 'E']) {
          const [dx, dy] = DIRV[s];
          const cx = x + dx, cy = y + dy;
          if (this.inRoom(rm, cx, cy) && !this.w.obj[cy * this.W + cx] && !this.reserved(cx, cy) && this.rng.chance(0.75)) this.w.obj[cy * this.W + cx] = this.mkObj('chair', OPP[s]);
        }
      }
      return true;
    }
    return false;
  },
  counterRun(rm, maxLen, withAppliances) {
    // longest run of wall-backed free tiles along one side
    let best = null;
    for (const s of ['N', 'S', 'W', 'E']) {
      const horiz = s === 'N' || s === 'S';
      const lines = horiz ? [s === 'N' ? rm.y0 : rm.y1] : [s === 'W' ? rm.x0 : rm.x1];
      for (const ln of lines) {
        let run = [];
        const len = horiz ? rm.x1 - rm.x0 + 1 : rm.y1 - rm.y0 + 1;
        for (let k = 0; k <= len; k++) {
          const x = horiz ? rm.x0 + k : ln, y = horiz ? ln : rm.y0 + k;
          const ok = k < len && !this.w.obj[y * this.W + x] && !this.reserved(x, y) && this.wallKind(x, y, s) >= 1 && this.wallKind(x, y, s) <= 2;
          if (ok) run.push([x, y]);
          else { if (run.length && (!best || run.length > best.run.length)) best = { run: run.slice(), s }; run = []; }
        }
      }
    }
    if (!best || best.run.length < 2) return 0;
    const run = best.run.slice(0, maxLen);
    const dir = OPP[best.s];
    const sinkAt = Math.floor(run.length / 2), stoveAt = run.length >= 3 ? (sinkAt + 2 < run.length ? sinkAt + 2 : 0) : -1;
    let n = 0;
    run.forEach(([x, y], i) => {
      let t = 'counter';
      if (withAppliances) { if (i === sinkAt) t = 'sink'; else if (i === stoveAt) t = 'stove'; }
      this.w.obj[y * this.W + x] = this.mkObj(t, dir);
      if (!this.connected(rm)) this.w.obj[y * this.W + x] = null; else n++;
    });
    return n;
  },
  furnishRoom(rm) {
    const r = this.rng;
    switch (rm.type) {
      case 'kitchen':
        this.place(rm, 'fridge');
        this.counterRun(rm, 6, true);
        if (r.chance(0.5)) this.counterRun(rm, 3, false);
        if (rm.x1 - rm.x0 >= 3 && rm.y1 - rm.y0 >= 3) this.placeCenter(rm, 'table', true);
        if (r.chance(0.4)) this.place(rm, 'trash');
        break;
      case 'bathroom':
        this.place(rm, 'toilet');
        this.place(rm, 'sink', { extra: {} });
        if ((rm.x1 - rm.x0 + 1) * (rm.y1 - rm.y0 + 1) >= 6) this.place(rm, 'bathtub', { two: 'along' });
        this.place(rm, 'medcab');
        break;
      case 'bedroom':
        this.place(rm, 'bed', { two: 'perp', extra: { col: r.pick(['#c84040', '#4060a0', '#e0e0e0', '#609060', '#c0a060', '#8060a0']) } });
        this.place(rm, 'nightstand');
        this.place(rm, 'wardrobe');
        this.place(rm, 'dresser');
        if (r.chance(0.5)) this.place(rm, 'lamp');
        break;
      case 'living': {
        const sofa = this.place(rm, 'sofa', { two: 'along', extra: { col: r.pick(['#7a3a30', '#3a5a7a', '#5a6a3a', '#7a6a50', '#4a4a4a', '#8a6a8a']) } });
        if (sofa) {
          // TV on opposite wall
          const opp = sofa.dir;
          this.place(rm, 'tv', { sides: [opp] }) || this.place(rm, 'tv');
        } else this.place(rm, 'tv');
        this.place(rm, 'armchair', { extra: { col: r.pick(['#7a3a30', '#3a5a7a', '#6a5a40']) } });
        this.place(rm, 'bookshelf');
        if (r.chance(0.6)) this.place(rm, 'dresser');
        this.place(rm, 'lamp');
        break;
      }
      case 'hall':
        if (r.chance(0.5)) this.place(rm, 'dresser');
        if (r.chance(0.35)) this.place(rm, 'bookshelf');
        if (r.chance(0.5)) this.place(rm, 'lamp');
        break;
      case 'garage':
        this.place(rm, 'toolcab');
        this.place(rm, 'toolcab');
        this.place(rm, 'crate');
        if (r.chance(0.5)) this.place(rm, 'washer');
        break;
      case 'office':
        break;
    }
  },

  // ---------------------------------------------------------------- house
  mapper(hx, hy, hw, hh, f) {
    let Wd_, D, m;
    if (f === 'N') { Wd_ = hw; D = hh; m = (u, v) => [hx + u, hy + v]; }
    else if (f === 'S') { Wd_ = hw; D = hh; m = (u, v) => [hx + hw - 1 - u, hy + hh - 1 - v]; }
    else if (f === 'W') { Wd_ = hh; D = hw; m = (u, v) => [hx + v, hy + hh - 1 - u]; }
    else { Wd_ = hh; D = hw; m = (u, v) => [hx + hw - 1 - v, hy + u]; }
    const rect = (u0, v0, u1, v1) => { const a = m(u0, v0), b = m(u1, v1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; };
    const dir = (local) => { // local: 'F' toward front, 'B' back, 'L' -u, 'R' +u
      const o = m(0, 0);
      let p;
      if (local === 'F') p = m(0, -1); else if (local === 'B') p = m(0, 1); else if (local === 'L') p = m(-1, 0); else p = m(1, 0);
      return vecDir(p[0] - o[0], p[1] - o[1]);
    };
    return { W: Wd_, D, m, rect, dir };
  },
  house(hx, hy, hw, hh, f, opts) {
    opts = opts || {};
    const r = this.rng;
    const b = this.newBuilding(opts.type || 'house', hx, hy, hx + hw - 1, hy + hh - 1, { wallType: r.chance(0.2) ? WT.BRICK : WT.EXT, front: f });
    const M = this.mapper(hx, hy, hw, hh, f);
    let u0 = 0, u1 = M.W - 1;
    let garage = null;
    if (!opts.noGarage && M.W >= 10 && r.chance(0.4)) {
      const left = r.chance(0.5);
      const gw = 4;
      const rc = left ? M.rect(0, 0, gw - 1, M.D - 1) : M.rect(M.W - gw, 0, M.W - 1, M.D - 1);
      garage = this.addRoom(b, 'garage', ...rc, FL.CONCRETE, 0);
      if (left) u0 = gw; else u1 = M.W - gw - 1;
      garage.left = left;
    }
    const mw = u1 - u0 + 1;
    const fd = M.D >= 8 ? r.int(4, M.D - 3) : Math.max(3, M.D - 3);
    const rooms = {};
    // front zone
    const woodOrCarpet = () => r.chance(0.55) ? FL.WOOD : FL.CARPET;
    if (mw >= 6) {
      const lw = Math.max(3, Math.min(mw - 3, Math.round(mw * r.f(0.5, 0.62))));
      const kitLeft = r.chance(0.5);
      if (kitLeft) {
        rooms.kitchen = this.addRoom(b, 'kitchen', ...M.rect(u0, 0, u0 + (mw - lw) - 1, fd - 1), r.chance(0.5) ? FL.TILE : FL.LINO);
        rooms.living = this.addRoom(b, 'living', ...M.rect(u0 + (mw - lw), 0, u1, fd - 1), woodOrCarpet());
      } else {
        rooms.living = this.addRoom(b, 'living', ...M.rect(u0, 0, u0 + lw - 1, fd - 1), woodOrCarpet());
        rooms.kitchen = this.addRoom(b, 'kitchen', ...M.rect(u0 + lw, 0, u1, fd - 1), r.chance(0.5) ? FL.TILE : FL.LINO);
      }
    } else {
      rooms.living = this.addRoom(b, 'kitchen', ...M.rect(u0, 0, u1, fd - 1), FL.WOOD);
    }
    // back zone
    const bd0 = fd, bd1 = M.D - 1;
    const backRooms = [];
    if (bd1 - bd0 + 1 >= 2) {
      if (mw >= 10) {
        const bw = r.int(2, 3);
        const aW = Math.floor((mw - bw) / 2);
        backRooms.push(this.addRoom(b, 'bedroom', ...M.rect(u0, bd0, u0 + aW - 1, bd1), woodOrCarpet()));
        backRooms.push(this.addRoom(b, 'bathroom', ...M.rect(u0 + aW, bd0, u0 + aW + bw - 1, bd1), FL.TILE));
        backRooms.push(this.addRoom(b, 'bedroom', ...M.rect(u0 + aW + bw, bd0, u1, bd1), woodOrCarpet()));
      } else if (mw >= 5) {
        const bw = mw >= 7 ? 3 : 2;
        const bathLeft = r.chance(0.5);
        if (bathLeft) {
          backRooms.push(this.addRoom(b, 'bathroom', ...M.rect(u0, bd0, u0 + bw - 1, bd1), FL.TILE));
          backRooms.push(this.addRoom(b, 'bedroom', ...M.rect(u0 + bw, bd0, u1, bd1), woodOrCarpet()));
        } else {
          backRooms.push(this.addRoom(b, 'bedroom', ...M.rect(u0, bd0, u1 - bw, bd1), woodOrCarpet()));
          backRooms.push(this.addRoom(b, 'bathroom', ...M.rect(u1 - bw + 1, bd0, u1, bd1), FL.TILE));
        }
      } else {
        backRooms.push(this.addRoom(b, 'bedroom', ...M.rect(u0, bd0, u1, bd1), woodOrCarpet()));
      }
    }
    this.buildWalls(b);
    // interior connections
    if (rooms.kitchen && rooms.living) this.doorBetween(rooms.living, rooms.kitchen, null, r.chance(0.7));
    for (const br of backRooms) {
      const fronts = [rooms.living, rooms.kitchen].filter(Boolean);
      let target = null;
      if (br.type === 'bathroom') {
        // prefer a bedroom neighbour sometimes, else front
        const nb = backRooms.find(o => o !== br && o.type === 'bedroom' && this.borderEdges(br, (x, y) => World.room(x, y) === o.id).length);
        if (nb && r.chance(0.3)) target = nb;
      }
      if (!target) {
        let bestN = 0;
        for (const fr of fronts) {
          const n = this.borderEdges(br, (x, y) => World.room(x, y) === fr.id).filter(c => !c.corner).length;
          if (n > bestN || (n === bestN && fr === rooms.living && n > 0)) { bestN = n; target = fr; }
        }
      }
      if (target) this.doorBetween(br, target);
    }
    if (garage) {
      const fr = [rooms.kitchen, rooms.living].filter(Boolean);
      let ok = false;
      for (const x of fr) if (this.borderEdges(garage, (a, c) => World.room(a, c) === x.id).filter(c => !c.corner).length) { this.doorBetween(garage, x); ok = true; break; }
      if (!ok) for (const br of backRooms) if (this.borderEdges(garage, (a, c) => World.room(a, c) === br.id).filter(c => !c.corner).length) { this.doorBetween(garage, br); break; }
      // garage doors on front wall
      const fdir = M.dir('F');
      const gc = this.borderEdges(garage, (x, y) => World.room(x, y) < 0).filter(c => c.dir === fdir && !c.corner);
      const mid = Math.floor(gc.length / 2) - 1;
      for (let k = Math.max(0, mid); k < Math.min(gc.length, mid + 2); k++) this.setDoor(gc[k], { style: 'garage', locked: r.chance(0.6), b: b.id });
      b.garage = { room: garage.id, door: gc.length ? gc[Math.max(0, mid)] : null };
    }
    // exterior doors
    const locked = r.chance(0.65);
    const fdoor = this.exteriorDoor(rooms.living, M.dir('F'), { locked, b: b.id, ext: true });
    b.frontDoor = fdoor;
    if (rooms.kitchen) {
      const sideDir = this.borderEdges(rooms.kitchen, (x, y) => World.room(x, y) < 0).filter(c => c.dir !== M.dir('F') && !c.corner);
      if (sideDir.length && r.chance(0.85)) {
        const c = sideDir[Math.floor(sideDir.length / 2)];
        this.setDoor(c, { locked: locked && r.chance(0.8), b: b.id, ext: true });
        b.backDoor = c;
      }
    }
    // some bigger houses get an upstairs
    if (!opts.oneStorey && b.type === 'house' && rooms.living && rooms.living.type === 'living' && hw >= 7 && hh >= 7 && r.chance(0.42)) this.secondFloor(b, rooms.living);
    // windows
    for (const rid of b.rooms) {
      const rm = this.w.rooms[rid];
      if (rm.type === 'garage') continue;
      this.windows(rm, { p: rm.type === 'bathroom' ? 0.2 : 0.45, win: { b: b.id } });
    }
    for (const rid of b.rooms) this.furnishRoom(this.w.rooms[rid]);
    b.keyId = b.id;
    return b;
  },
  // ---------------------------------------------------------------- upstairs
  // Upper floors live at x + LV.W0. A staircase of 3 steps runs along a plain wall of the living
  // room; the tile past the top step is the landing (solid downstairs, floor upstairs).
  secondFloor(b, liv) {
    const r = this.rng, W = this.W;
    const cands = [];
    for (const s of ['N', 'S', 'W', 'E']) {
      const horiz = s === 'N' || s === 'S';
      const line = s === 'N' ? liv.y0 : s === 'S' ? liv.y1 : s === 'W' ? liv.x0 : liv.x1;
      const a0 = horiz ? liv.x0 : liv.y0, a1 = horiz ? liv.x1 : liv.y1;
      for (let a = a0; a + 3 <= a1; a++) {
        let ok = true;
        for (let k = 0; k < 4 && ok; k++) {
          const x = horiz ? a + k : line, y = horiz ? line : a + k;
          if (this.w.obj[y * W + x] || this.reserved(x, y) || this.wallKind(x, y, s) !== 1) ok = false;
          // keep the walkway along the open side free of doors too
          const [ox, oy] = DIRV[OPP[s]];
          if (ok && this.reserved(x + ox, y + oy) && k < 3) ok = false;
        }
        if (ok) for (const sgn of [1, -1]) cands.push({ s, horiz, line, a, sgn });
      }
    }
    r.shuffle(cands);
    for (const c of cands) if (this.tryStairs(b, liv, c)) return true;
    return false;
  },
  tryStairs(b, liv, c) {
    const W = this.W, W0 = LV.W0;
    const dx = c.horiz ? c.sgn : 0, dy = c.horiz ? 0 : c.sgn;
    const at = (k) => {
      const a = c.sgn > 0 ? c.a + k : c.a + 3 - k;
      return c.horiz ? [a, c.line] : [c.line, a];
    };
    const T = [at(0), at(1), at(2), at(3)];
    const [ox, oy] = DIRV[OPP[c.s]];
    // entry: the tile before the bottom step, or beside it
    const [ex, ey] = [T[0][0] - dx, T[0][1] - dy];
    const dir = vecDir(dx, dy);
    const top = T[2];
    const base = { dir, ws: c.s, sx: top[0], sy: top[1], ddx: dx, ddy: dy };
    for (let k = 0; k < 3; k++) this.w.obj[T[k][1] * W + T[k][0]] = Object.assign({ t: 'stairs', part: k }, base);
    this.w.obj[T[3][1] * W + T[3][0]] = Object.assign({ t: 'landing' }, base);
    if (!this.connected(liv)) { for (const [x, y] of T) this.w.obj[y * W + x] = null; return false; }
    if (this.inRoom(liv, ex, ey)) this.resv.add(ey * W + ex);
    for (const [x, y] of T) if (this.inRoom(liv, x + ox, y + oy)) this.resv.add((y + oy) * W + x + ox);
    this.w.stairs.push({ x: top[0], y: top[1], dx, dy });
    // ---- upper floor layout: a 2-wide hall band through the stairwell, rooms on either side
    let ya, yc, xa, xc;
    if (c.horiz) { ya = Math.min(c.line, c.line + oy); yc = Math.max(c.line, c.line + oy); if (ya - b.y0 === 1) ya = b.y0; if (b.y1 - yc === 1) yc = b.y1; }
    else { xa = Math.min(c.line, c.line + ox); xc = Math.max(c.line, c.line + ox); if (xa - b.x0 === 1) xa = b.x0; if (b.x1 - xc === 1) xc = b.x1; }
    const hallR = c.horiz ? [b.x0, ya, b.x1, yc] : [xa, b.y0, xc, b.y1];
    const zones = [];
    if (c.horiz) { if (ya > b.y0) zones.push([b.x0, b.y0, b.x1, ya - 1]); if (yc < b.y1) zones.push([b.x0, yc + 1, b.x1, b.y1]); }
    else { if (xa > b.x0) zones.push([b.x0, b.y0, xa - 1, b.y1]); if (xc < b.x1) zones.push([xc + 1, b.y0, b.x1, b.y1]); }
    const rects = [];
    for (const z of zones) {
      const L = c.horiz ? z[2] - z[0] + 1 : z[3] - z[1] + 1;
      let parts;
      if (L >= 11) { const a = Math.floor((L - 3) / 2); parts = [[a, false], [3, true], [L - a - 3, false]]; }
      else if (L >= 7) parts = this.rng.chance(0.5) ? [[L - 3, false], [3, true]] : [[3, true], [L - 3, false]];
      else parts = [[L, false]];
      let o = 0;
      for (const [len, small] of parts) {
        const rc = c.horiz ? [z[0] + o, z[1], z[0] + o + len - 1, z[3]] : [z[0], z[1] + o, z[2], z[1] + o + len - 1];
        rects.push({ rc, small, area: (rc[2] - rc[0] + 1) * (rc[3] - rc[1] + 1) });
        o += len;
      }
    }
    let bath = rects.find(q => q.small);
    if (!bath && rects.length >= 2) bath = rects.reduce((m, q) => (q.area < m.area ? q : m));
    const fl = () => this.rng.chance(0.55) ? FL.WOOD : FL.CARPET;
    const up = (rc) => [rc[0] + W0, rc[1], rc[2] + W0, rc[3]];
    const hall = this.addRoom(b, 'hall', ...up(hallR), FL.WOOD);
    const upRooms = [];
    for (const q of rects) upRooms.push(this.addRoom(b, q === bath ? 'bathroom' : 'bedroom', ...up(q.rc), q === bath ? FL.TILE : fl()));
    // the open stairwell and the landing upstairs
    const hole = new Set();
    for (let k = 0; k < 3; k++) {
      const [x, y] = T[k];
      this.w.obj[y * W + x + W0] = Object.assign({ t: k < 2 ? 'railing' : 'stairtop', part: k }, base);
      hole.add(y * W + x + W0);
    }
    this.resv.add(T[3][1] * W + T[3][0] + W0);
    for (const [x, y] of T) if (World.inb(x + ox + W0, y + oy)) this.resv.add((y + oy) * W + x + ox + W0);
    this.buildWalls(b, W0);
    for (const rm of upRooms) {
      let cs = this.borderEdges(rm, (x, y) => World.room(x, y) === hall.id && !hole.has(y * W + x) && !this.w.obj[y * W + x]);
      const good = cs.filter(q => !q.corner);
      if (good.length) cs = good;
      if (!cs.length) continue;
      const q = cs[Math.floor(cs.length / 2)];
      this.setDoor(q, { style: 'wood', col: '#c8b8a0' });
      this.resv.add(q.ny * W + q.nx);
    }
    b.floors = 2;
    b.stair = this.w.stairs[this.w.stairs.length - 1];
    return true;
  },
  // simple one/two-room cabin
  cabin(hx, hy, hw, hh, f) {
    const r = this.rng;
    const b = this.newBuilding('cabin', hx, hy, hx + hw - 1, hy + hh - 1, { extCol: r.pick(['#7a5a3a', '#6a4a30', '#8a6a48']), roofCol: '#4a4038', front: f });
    const M = this.mapper(hx, hy, hw, hh, f);
    const main = this.addRoom(b, 'cabin', ...M.rect(0, 0, M.W - 1, M.D - 3), FL.WOOD, 2);
    const bed = this.addRoom(b, 'bedroom', ...M.rect(0, M.D - 2, M.W - 1, M.D - 1), FL.WOOD, 2);
    bed.type = 'cabin';
    this.buildWalls(b);
    this.doorBetween(main, bed);
    this.exteriorDoor(main, M.dir('F'), { locked: r.chance(0.3), b: b.id, ext: true });
    this.windows(main, { p: 0.4, win: { b: b.id } });
    this.windows(bed, { p: 0.3, win: { b: b.id } });
    this.place(main, 'counter'); this.place(main, 'stove'); this.place(main, 'crate'); this.place(main, 'crate');
    this.place(main, 'armchair', { extra: { col: '#6a4a30' } });
    this.place(bed, 'bed', { two: 'along', extra: { col: '#8a3a2a' } }) || this.place(bed, 'bed', { two: 'perp', extra: { col: '#8a3a2a' } });
    this.place(bed, 'nightstand'); this.place(bed, 'crate');
    b.keyId = b.id;
    return b;
  },

  // ---------------------------------------------------------------- lots
  residentialLot(lx, ly, lw, lh, f, opts) {
    // f = side where street is
    const r = this.rng;
    opts = opts || {};
    const yard = r.int(2, 3);
    let hw, hh;
    if (f === 'N' || f === 'S') { hw = U.clamp(r.int(7, lw - 2), 6, lw - 2); hh = U.clamp(r.int(6, lh - yard - 2), 5, lh - yard - 1); }
    else { hh = U.clamp(r.int(7, lh - 2), 6, lh - 2); hw = U.clamp(r.int(6, lw - yard - 2), 5, lw - yard - 1); }
    let hx, hy;
    if (f === 'N') { hx = lx + r.int(1, Math.max(1, lw - hw - 1)); hy = ly + yard; }
    else if (f === 'S') { hx = lx + r.int(1, Math.max(1, lw - hw - 1)); hy = ly + lh - yard - hh; }
    else if (f === 'W') { hy = ly + r.int(1, Math.max(1, lh - hh - 1)); hx = lx + yard; }
    else { hy = ly + r.int(1, Math.max(1, lh - hh - 1)); hx = lx + lw - yard - hw; }
    this.mark(lx, ly, lx + lw - 1, ly + lh - 1, 1);
    const b = this.house(hx, hy, hw, hh, f);
    b.lot = { x0: lx, y0: ly, x1: lx + lw - 1, y1: ly + lh - 1 };
    const [fdx, fdy] = DIRV[f];
    // front path from door to lot edge
    if (b.frontDoor) {
      let x = b.frontDoor.nx, y = b.frontDoor.ny;
      for (let k = 0; k < 6 && World.inb(x, y) && World.room(x, y) < 0; k++) {
        if (x < lx || x >= lx + lw || y < ly || y >= ly + lh) break;
        this.sf(x, y, FL.SIDEWALK, 1);
        x += fdx; y += fdy;
      }
    }
    // driveway & car
    if (b.garage && b.garage.door) {
      const gd = b.garage.door;
      let x = gd.nx, y = gd.ny;
      const px = fdy !== 0 ? 1 : 0, py = fdx !== 0 ? 1 : 0;
      const tiles = [];
      for (let k = 0; k < 6 && World.inb(x, y) && World.room(x, y) < 0; k++) {
        if (x < lx || x >= lx + lw || y < ly || y >= ly + lh) break;
        this.sf(x, y, FL.CONCRETE, 2); this.sf(x + px, y + py, FL.CONCRETE, 2);
        tiles.push([x, y]);
        x += fdx; y += fdy;
      }
      if (tiles.length >= 3 && r.chance(0.55)) {
        const t = tiles[Math.min(tiles.length - 1, 1)];
        this.w.carSpots.push({ x: t[0] + 0.5 + px * 0.5 + fdx * 0.5, y: t[1] + 0.5 + py * 0.5 + fdy * 0.5, a: Math.atan2(fdy, fdx), driveway: b.id });
      }
    }
    // mailbox near street
    {
      let mx, my;
      if (f === 'N') { mx = lx + 1; my = ly; } else if (f === 'S') { mx = lx + lw - 2; my = ly + lh - 1; } else if (f === 'W') { mx = lx; my = ly + 1; } else { mx = lx + lw - 1; my = ly + lh - 2; }
      if (this.free(mx, my) && this.w.floor[my * this.W + mx] !== FL.SIDEWALK && this.w.floor[my * this.W + mx] !== FL.CONCRETE) this.put(mx, my, 'mailbox', OPP[f]);
    }
    // yard decoration
    const yardTiles = [];
    for (let y = ly; y < ly + lh; y++) for (let x = lx; x < lx + lw; x++) {
      if (!this.free(x, y)) continue;
      const fl = this.w.floor[y * this.W + x];
      if (fl === FL.SIDEWALK || fl === FL.CONCRETE) continue;
      // keep tiles adjacent to doors free
      let nearDoor = false;
      for (const [dx, dy] of DIR8) { const rr = World.room(x + dx, y + dy); if (rr >= 0) { nearDoor = nearDoor || this.reservedOutside(x, y); } }
      if (!nearDoor) yardTiles.push([x, y]);
    }
    r.shuffle(yardTiles);
    let trees = r.int(0, 2), bushes = r.int(1, 4), bins = 1;
    for (const [x, y] of yardTiles) {
      const nearHouse = DIR8.some(([dx, dy]) => World.room(x + dx, y + dy) >= 0);
      if (bins && nearHouse && this.w.floor[y * this.W + x] !== FL.SIDEWALK) { this.put(x, y, 'trash', 'S'); bins--; continue; }
      if (trees && !nearHouse && r.chance(0.5)) { this.put(x, y, 'tree', 'S', { kind: r.pick(['oak', 'maple', 'birch', 'pine']), sz: r.f(0.8, 1.15) }); trees--; continue; }
      if (bushes && nearHouse && r.chance(0.4)) { this.put(x, y, 'bush', 'S', { v: r.int(0, 2) }); bushes--; continue; }
    }
    // occasional BBQ / garden plots in back yards
    if (r.chance(0.15)) {
      const t = yardTiles.find(([x, y]) => this.free(x, y));
      if (t) this.put(t[0], t[1], 'bbq', 'S');
    }
    // front picket fence
    if (r.chance(opts.fenceChance || 0.3)) this.lotFrontFence(lx, ly, lw, lh, f);
    this.w.spawnHouses.push(b.id);
    return b;
  },
  reservedOutside(x, y) {
    for (const [dx, dy] of DIR4) {
      const e = World.edgeBetween(x, y, x + dx, y + dy);
      const f = World.feat(e[0], e[1], e[2]);
      if (f && (f.k === 'door' || f.k === 'doorway')) return true;
    }
    return false;
  },
  lotFrontFence(lx, ly, lw, lh, f) {
    const horiz = f === 'N' || f === 'S';
    const n = horiz ? lw : lh;
    for (let k = 0; k < n; k++) {
      const x = horiz ? lx + k : (f === 'W' ? lx : lx + lw), y = horiz ? (f === 'N' ? ly : ly + lh) : ly + k;
      const tx = horiz ? x : (f === 'W' ? lx : lx + lw - 1), ty = horiz ? (f === 'N' ? ly : ly + lh - 1) : y;
      const fl = this.w.floor[ty * this.W + tx];
      if (fl === FL.SIDEWALK || fl === FL.CONCRETE || this.w.obj[ty * this.W + tx]) continue;
      World.setWall(x, y, horiz ? 0 : 1, WT.PICKET);
    }
  },
  fenceLine(x0, y0, len, d, type, gapP) {
    for (let k = 0; k < len; k++) {
      const x = d ? x0 : x0 + k, y = d ? y0 + k : y0;
      if (!World.inb(x, y)) continue;
      if (this.rng.chance(gapP || 0)) continue;
      // don't wall off tiles that are doors/buildings
      const [[ax, ay], [bx, by]] = World.edgeSides(x, y, d);
      if (World.room(ax, ay) >= 0 || World.room(bx, by) >= 0) continue;
      if (World.wall(x, y, d)) continue;
      World.setWall(x, y, d, type);
      // remove objects that would sit on a fence
    }
  },

  // ---------------------------------------------------------------- stores
  store(type, x0, y0, w, h, f, name) {
    const r = this.rng;
    const brick = ['police', 'firestation', 'bank', 'warehouse', 'school', 'church'].includes(type) || r.chance(0.5);
    const b = this.newBuilding(type, x0, y0, x0 + w - 1, y0 + h - 1, { wallType: brick ? WT.BRICK : WT.EXT, roof: 'flat', roofCol: r.pick(PAL.roofFlat), name, alarm: r.chance(Math.min(0.9, this.alarmP() * 4)), front: f });
    const M = this.mapper(x0, y0, w, h, f);
    const fl = { clinic: FL.TILE, grocery: FL.LINO, hardware: FL.CONCRETE, gunstore: FL.WOOD, pharmacy: FL.LINO, restaurant: FL.TILE, bar: FL.WOOD, clothing: FL.CARPET, bookstore: FL.WOOD, office: FL.CARPET, firestation: FL.CONCRETE, police: FL.LINO, laundromat: FL.TILE, gasstation: FL.LINO, warehouse: FL.CONCRETE }[type] || FL.LINO;
    const sd = M.D >= 9 ? 3 : 0;
    const sales = this.addRoom(b, type, ...M.rect(0, 0, M.W - 1, M.D - 1 - sd), fl, r.int(0, 7));
    let back = null;
    if (sd) back = this.addRoom(b, type, ...M.rect(0, M.D - sd, M.W - 1, M.D - 1), type === 'restaurant' ? FL.TILE : FL.CONCRETE, 1);
    this.buildWalls(b);
    const fdir = M.dir('F');
    // glass front: double doors at centre + big windows
    const fe = this.borderEdges(sales, (x, y) => World.room(x, y) < 0).filter(c => c.dir === fdir);
    fe.sort((a, c) => (a.x + a.y) - (c.x + c.y));
    const mid = Math.floor(fe.length / 2);
    const locked = r.chance(0.45);
    fe.forEach((c, i) => {
      if (c.corner) return;
      if (i === mid || i === mid - 1) this.setDoor(c, { style: type === 'firestation' ? 'garage' : 'glass', locked, b: b.id, ext: true });
      else if (type !== 'firestation' || i % 3 === 0) this.setWindow(c, { big: true, fixed: true, locked: true, curtains: false, b: b.id, hp: 12 });
    });
    if (back) {
      this.doorBetween(sales, back);
      this.exteriorDoor(back, M.dir('B'), { locked: true, b: b.id, style: 'metal', ext: true });
      this.windows(back, { p: 0.15, none: true, win: { b: b.id, curtains: false } });
    }
    this.windows(sales, { p: 0.2, none: true, win: { b: b.id, curtains: false } });
    // furniture in local coords
    const P = (u, v, t, ld, extra) => {
      const [x, y] = M.m(u, v);
      if (!World.inb(x, y) || World.room(x, y) < 0 || this.w.obj[y * this.W + x] || this.reserved(x, y)) return null;
      const o = this.mkObj(t, M.dir(ld || 'F'), extra);
      this.w.obj[y * this.W + x] = o;
      const rm = this.w.rooms[World.room(x, y)];
      if (!this.connected(rm)) { this.w.obj[y * this.W + x] = null; return null; }
      return o;
    };
    const sv = M.D - 1 - sd; // last sales row
    const W_ = M.W;
    const rows = (t, v0, step, ld) => {
      for (let v = v0; v < sv; v += step) {
        for (let u = 2; u < W_ - 2; u++) {
          if (u === Math.floor(W_ / 2) || u === Math.floor(W_ / 2) - 1) continue;
          P(u, v, t, ld);
        }
      }
    };
    switch (type) {
      case 'grocery':
        rows('shelf', 3, 3, 'F');
        for (let v = 1; v < sv; v++) P(W_ - 1, v, 'cooler', 'L');
        for (let u = 2; u < W_ - 1; u++) P(u, sv, 'fridge', 'F');
        P(1, 1, 'register', 'R'); P(1, 3, 'register', 'R');
        if (back) for (const [x, y] of this.roomTiles(back)) if (r.chance(0.35)) { const rm = back; if (!this.reserved(x, y)) { this.w.obj[y * this.W + x] = this.mkObj('crate', 'S'); if (!this.connected(rm)) this.w.obj[y * this.W + x] = null; } }
        break;
      case 'hardware': case 'pharmacy': case 'clothing': case 'gasstation':
        rows(type === 'clothing' && r.chance(0.5) ? 'wardrobe' : 'shelf', 2, 3, 'F');
        for (let v = 1; v < sv; v++) P(0, v, 'shelf', 'R');
        if (type === 'gasstation') for (let v = 1; v < sv; v++) P(W_ - 1, v, 'cooler', 'L');
        P(W_ - 2, 1, 'register', 'L');
        if (back) for (let k = 0; k < 6; k++) this.place(back, 'crate');
        break;
      case 'gunstore':
        for (let v = 1; v < sv; v++) { P(0, v, 'shelf', 'R'); P(W_ - 1, v, 'shelf', 'L'); }
        for (let u = 2; u < W_ - 2; u++) if (u !== Math.floor(W_ / 2)) P(u, sv - 1, 'register', 'F');
        if (back) for (let k = 0; k < 5; k++) this.place(back, 'crate');
        break;
      case 'bookstore':
        rows('bookshelf', 2, 2, 'F');
        for (let v = 1; v < sv; v++) P(0, v, 'bookshelf', 'R');
        P(W_ - 2, 1, 'register', 'L');
        if (back) for (let k = 0; k < 4; k++) this.place(back, 'crate');
        break;
      case 'restaurant': case 'diner':
        for (let v = 2; v < sv - 1; v += 3) for (let u = 2; u < W_ - 2; u += 3) {
          const [x, y] = M.m(u, v);
          if (P(u, v, 'table', 'F')) for (const s of ['N', 'S', 'W', 'E']) { const [dx, dy] = DIRV[s]; if (!this.w.obj[(y + dy) * this.W + x + dx] && World.room(x + dx, y + dy) === sales.id && !this.reserved(x + dx, y + dy)) this.w.obj[(y + dy) * this.W + x + dx] = this.mkObj('chair', OPP[s]); }
        }
        for (let u = 1; u < W_ - 1; u++) if (u !== 1) P(u, sv, 'counter', 'F');
        P(1, sv, 'register', 'F');
        if (back) {
          back.type = 'restaurant';
          for (let k = 0; k < 2; k++) this.place(back, 'fridge');
          for (let k = 0; k < 2; k++) this.place(back, 'stove');
          for (let k = 0; k < 4; k++) this.place(back, 'counter');
          this.place(back, 'sink');
        }
        break;
      case 'bar':
        for (let v = 1; v < sv - 1; v++) P(W_ - 3, v, 'counterbar', 'L');
        for (let v = 1; v < sv - 1; v++) P(W_ - 1, v, 'shelf', 'L');
        for (let v = 1; v < sv - 1; v++) P(W_ - 4, v, 'chair', 'R');
        for (let v = 2; v < sv; v += 3) for (let u = 2; u < W_ - 6; u += 3) {
          const [x, y] = M.m(u, v);
          if (P(u, v, 'table', 'F')) for (const s of ['N', 'S']) { const [dx, dy] = DIRV[s]; if (!this.w.obj[(y + dy) * this.W + x + dx] && World.room(x + dx, y + dy) === sales.id && !this.reserved(x + dx, y + dy)) this.w.obj[(y + dy) * this.W + x + dx] = this.mkObj('chair', OPP[s]); }
        }
        if (back) { this.place(back, 'fridge'); this.place(back, 'fridge'); this.place(back, 'crate'); this.place(back, 'crate'); this.place(back, 'toilet'); }
        break;
      case 'office':
        for (let v = 2; v < sv; v += 2) for (let u = 2; u < W_ - 2; u += 2) { P(u, v, 'desk', 'F'); P(u, v - 1, 'chair', 'B'); }
        for (let v = 1; v < sv; v++) P(0, v, 'shelf', 'R');
        if (back) { this.place(back, 'toilet'); this.place(back, 'sink'); this.place(back, 'crate'); this.place(back, 'crate'); back.type = 'office'; }
        break;
      case 'laundromat':
        for (let u = 1; u < W_ - 1; u++) P(u, sv, 'washer', 'F');
        for (let u = 2; u < W_ - 2; u++) if (u !== Math.floor(W_ / 2)) P(u, 3, 'washer', 'F');
        P(1, 1, 'register', 'R');
        for (let v = 1; v < sv - 1; v++) P(W_ - 1, v, 'chair', 'L');
        if (back) { this.place(back, 'crate'); this.place(back, 'crate'); this.place(back, 'toilet'); }
        break;
      case 'firestation':
        for (let v = 1; v < sv; v++) P(W_ - 1, v, 'locker', 'L');
        for (let v = 1; v < sv; v++) P(0, v, 'toolcab', 'R');
        if (back) { back.type = 'firestation'; this.place(back, 'bed', { two: 'along', extra: { col: '#4060a0' } }); this.place(back, 'bed', { two: 'along', extra: { col: '#4060a0' } }); this.place(back, 'fridge'); this.place(back, 'counter'); this.place(back, 'stove'); this.place(back, 'table'); }
        this.w.carSpots.push({ x: (M.m(Math.floor(W_ / 2), 3)[0]) + 0.5, y: M.m(Math.floor(W_ / 2), 3)[1] + 0.5, a: Math.atan2(DIRV[M.dir('F')][1], DIRV[M.dir('F')][0]), kind: 'firetruck' });
        break;
      case 'warehouse':
        for (let v = 2; v < sv; v += 3) for (let u = 1; u < W_ - 1; u++) if (u % 5 !== 0) P(u, v, r.chance(0.5) ? 'shelf' : 'crate', 'F');
        break;
      case 'clinic':
        // waiting room up front, treatment beds and supply cabinets at the back
        for (let u = 2; u < W_ - 2; u++) if (u !== Math.floor(W_ / 2) && u !== Math.floor(W_ / 2) - 1) P(u, 1, 'chair', 'F');
        P(W_ - 2, sv - 1, 'desk', 'F'); P(W_ - 2, sv - 2, 'chair', 'B');
        P(1, sv, 'shelf', 'F'); P(2, sv, 'medcab', 'F'); P(3, sv, 'shelf', 'F');
        for (let v = 3; v < sv - 1; v++) P(0, v, 'medcab', 'R');
        if (back) {
          back.type = 'clinic';
          for (let k = 0; k < 3; k++) this.place(back, 'bed', { two: 'perp', extra: { col: '#e8e8f0' } });
          for (let k = 0; k < 3; k++) this.place(back, 'medcab');
          this.place(back, 'sink'); this.place(back, 'counter');
        }
        break;
    }
    if (name) this.w.labels.push({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, text: name });
    b.keyId = b.id;
    return b;
  },
  police(x0, y0, w, h, f) {
    const r = this.rng;
    const b = this.newBuilding('police', x0, y0, x0 + w - 1, y0 + h - 1, { wallType: WT.BRICK, roof: 'flat', roofCol: '#5a5a60', name: 'Police Station', alarm: this.alarmP() > 0, front: f });
    const M = this.mapper(x0, y0, w, h, f);
    const fd = Math.floor(M.D / 2);
    const lobby = this.addRoom(b, 'police', ...M.rect(0, 0, 7, fd - 1), FL.LINO, 3);
    const office = this.addRoom(b, 'police', ...M.rect(8, 0, M.W - 1, fd - 1), FL.CARPET, 5);
    const lockers = this.addRoom(b, 'police', ...M.rect(0, fd, 7, M.D - 1), FL.LINO, 3);
    const hall = this.addRoom(b, 'police', ...M.rect(8, fd, M.W - 1, fd + 1), FL.LINO, 3);
    const cells = [];
    const nCells = Math.max(1, Math.floor((M.W - 8) / 4));
    for (let k = 0; k < nCells; k++) {
      const u = 8 + k * 4, ue = k === nCells - 1 ? M.W - 1 : u + 3;
      cells.push(this.addRoom(b, 'police', ...M.rect(u, fd + 2, ue, M.D - 1), FL.CONCRETE, 1));
    }
    this.buildWalls(b);
    this.exteriorDoor(lobby, M.dir('F'), { style: 'glass', locked: false, b: b.id, ext: true });
    this.doorBetween(lobby, office);
    this.doorBetween(lobby, lockers);
    this.doorBetween(office, hall);
    for (const c of cells) this.doorBetween(c, hall, 'metal');
    this.exteriorDoor(lockers, M.dir('B'), { style: 'metal', locked: true, b: b.id, ext: true });
    for (const rm of [lobby, office]) this.windows(rm, { p: 0.5, win: { b: b.id, curtains: false } });
    for (let k = 0; k < 2; k++) this.place(lobby, 'register');
    this.place(lobby, 'chair'); this.place(lobby, 'chair');
    for (let k = 0; k < 6; k++) this.place(office, 'desk');
    for (let k = 0; k < 7; k++) this.place(lockers, 'locker');
    for (const c of cells) { this.place(c, 'bed', { two: 'along', extra: { col: '#707070' } }); this.place(c, 'toilet'); }
    this.w.labels.push({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, text: 'Police Station' });
    b.keyId = b.id;
    return b;
  },

  // ---------------------------------------------------------------- town
  town() {
    const RP = this.RP, r = this.rng;
    // commercial slot plan (10 rows x 2 slots of 12)
    const shops = ['hardware', 'gunstore', 'pharmacy', 'restaurant', 'bar', 'clothing', 'bookstore', 'office', 'firestation', 'laundromat', 'diner', 'office'];
    const names = {
      grocery: 'Fresh Mart', hardware: 'Hollow Hardware', gunstore: 'Ridgeline Guns & Ammo', pharmacy: 'Corner Pharmacy', restaurant: "Pip's Burgers",
      bar: 'The Rusty Nail', clothing: 'Threads Clothing', bookstore: 'Page Turner Books', office: 'Valley Insurance', firestation: 'Fire Station', laundromat: 'Suds Laundromat', diner: 'Lucky Star Diner',
    };
    r.shuffle(shops);
    const commercialRows = [];
    for (let bi = 0; bi < 5; bi++) { commercialRows.push([bi, 1, 'S']); commercialRows.push([bi, 2, 'N']); }
    r.shuffle(commercialRows);
    const rowPlan = new Map();
    rowPlan.set(commercialRows[0].join(), [['grocery', 24]]);
    rowPlan.set(commercialRows[1].join(), [['police', 24]]);
    let si = 0;
    for (let k = 2; k < commercialRows.length; k++) {
      const plan = [];
      for (let s = 0; s < 2; s++) plan.push(si < shops.length && r.chance(0.85) ? [shops[si++], 12] : ['house', 12]);
      rowPlan.set(commercialRows[k].join(), plan);
    }
    for (let bi = 0; bi < 5; bi++) for (let bj = 0; bj < 5; bj++) {
      const x0 = RP[bi] + 5, x1 = RP[bi + 1] - 2, y0 = RP[bj] + 5, y1 = RP[bj + 1] - 2;
      this.mark(x0, y0, x1, y1, 1);
      if (bi === 1 && bj === 3) { this.park(x0, y0, x1, y1); continue; }
      if (bi === 3 && bj === 4) { this.school(x0, y0, x1, y1); continue; }
      if (bi === 4 && bj === 4) { this.industrial(x0, y0, x1, y1); continue; }
      if (bi === 0 && bj === 3) { this.church(x0, y0, x1, y0 + 11); this.houseRow(x0, y0 + 12, x1, y1, 'S'); continue; }
      // north row
      const nk = [bi, bj, 'N'].join(), sk = [bi, bj, 'S'].join();
      if (rowPlan.has(nk)) this.commercialRow(x0, y0, x1, y0 + 11, 'N', rowPlan.get(nk), names); else this.houseRow(x0, y0, x1, y0 + 11, 'N');
      if (rowPlan.has(sk)) this.commercialRow(x0, y0 + 12, x1, y1, 'S', rowPlan.get(sk), names); else this.houseRow(x0, y0 + 12, x1, y1, 'S');
      // back fence between rows
      const ft = r.weighted([[WT.WOODFENCE, 5], [WT.CHAIN, 2], [WT.PICKET, 1], [0, 2]]);
      if (ft) this.fenceLine(x0, y0 + 12, x1 - x0 + 1, 0, ft, 0.06);
    }
    // street lights
    for (const p of RP) {
      for (let t = RP[0]; t <= RP[5] + 3; t += 9) {
        for (const [x, y] of [[t, p - 1], [t + 4, p + 4], [p - 1, t + 2], [p + 4, t + 6]]) {
          if (World.inb(x, y) && this.w.floor[y * this.W + x] === FL.SIDEWALK && !this.w.obj[y * this.W + x] && this.roadCnt[y * this.W + x] === 0) this.put(x, y, 'lamppost', 'S');
        }
      }
    }
    this.w.labels.push({ x: 120, y: 120, text: 'Hollow Creek' });
  },
  // ---------------------------------------------------------------- Millbrook
  town2() {
    const RX = this.RX2, RY = this.RY2, r = this.rng;
    const names = { grocery: 'Millbrook Market', clinic: 'Millbrook Clinic', diner: "Dot's Diner", hardware: 'Feed & Supply', bar: 'The Last Stop', pharmacy: 'Millbrook Drugs', office: 'County Records', laundromat: 'Wash World' };
    const plans = new Map();
    plans.set('0,0,N', [['grocery', 24]]);
    plans.set('1,0,N', [['clinic', 12], ['diner', 12]]);
    plans.set('2,1,N', [[r.pick(['hardware', 'pharmacy']), 12], [r.pick(['bar', 'laundromat', 'office']), 12]]);
    plans.set('1,2,S', [['house', 12], [r.pick(['pharmacy', 'bar', 'office']), 12]]);
    for (let bi = 0; bi < RX.length - 1; bi++) for (let bj = 0; bj < RY.length - 1; bj++) {
      const x0 = RX[bi] + 5, x1 = RX[bi + 1] - 2, y0 = RY[bj] + 5, y1 = RY[bj + 1] - 2;
      this.mark(x0, y0, x1, y1, 1);
      if (bi === 1 && bj === 1) { this.park(x0, y0, x1, y1, 'Millbrook Green'); continue; }
      if (bi === 0 && bj === 1) { this.church(x0, y0, x1, y0 + 11, 'Grace Baptist Church'); this.houseRow(x0, y0 + 12, x1, y1, 'S'); continue; }
      const nk = bi + ',' + bj + ',N', sk = bi + ',' + bj + ',S';
      if (plans.has(nk)) this.commercialRow(x0, y0, x1, y0 + 11, 'N', plans.get(nk), names); else this.houseRow(x0, y0, x1, y0 + 11, 'N');
      if (plans.has(sk)) this.commercialRow(x0, y0 + 12, x1, y1, 'S', plans.get(sk), names); else this.houseRow(x0, y0 + 12, x1, y1, 'S');
      const ft = r.weighted([[WT.WOODFENCE, 5], [WT.CHAIN, 2], [WT.PICKET, 1], [0, 2]]);
      if (ft) this.fenceLine(x0, y0 + 12, x1 - x0 + 1, 0, ft, 0.06);
    }
    const a2x = RX[0], b2x = RX[RX.length - 1] + 3, a2y = RY[0], b2y = RY[RY.length - 1] + 3;
    for (const p of RY) for (let t = a2x; t <= b2x; t += 9) for (const [x, y] of [[t, p - 1], [t + 4, p + 4]]) this.lamp(x, y);
    for (const p of RX) for (let t = a2y; t <= b2y; t += 9) for (const [x, y] of [[p - 1, t + 2], [p + 4, t + 6]]) this.lamp(x, y);
    this.w.labels.push({ x: (a2x + b2x) / 2, y: (a2y + b2y) / 2 - 12, text: 'Millbrook' });
  },
  lamp(x, y) { if (World.inb(x, y) && this.w.floor[y * this.W + x] === FL.SIDEWALK && !this.w.obj[y * this.W + x] && this.roadCnt[y * this.W + x] === 0) this.put(x, y, 'lamppost', 'S'); },
  // single-wide mobile home
  trailer(hx, hy, f) {
    const r = this.rng;
    const horiz = f === 'N' || f === 'S';
    const hw = horiz ? 8 : 4, hh = horiz ? 4 : 8;
    const b = this.newBuilding('trailer', hx, hy, hx + hw - 1, hy + hh - 1, { wallType: WT.EXT, extCol: r.pick(['#d8d8d0', '#c8d0d8', '#e0d8c0', '#a8b8a8', '#d0c0b0']), roofCol: '#8a8a88', roof: 'flat', front: f });
    const M = this.mapper(hx, hy, hw, hh, f);
    const main = this.addRoom(b, 'living', ...M.rect(0, 0, 4, M.D - 1), FL.LINO, r.int(0, 7));
    const bath = this.addRoom(b, 'bathroom', ...M.rect(5, 0, 5, M.D - 1), FL.LINO, 2);
    const bed = this.addRoom(b, 'bedroom', ...M.rect(6, 0, 7, M.D - 1), FL.CARPET, r.int(0, 7));
    this.buildWalls(b);
    this.doorBetween(main, bath); this.doorBetween(main, bed);
    this.exteriorDoor(main, M.dir('F'), { locked: r.chance(0.5), b: b.id, ext: true });
    this.windows(main, { p: 0.5, win: { b: b.id } }); this.windows(bed, { p: 0.5, win: { b: b.id } });
    this.place(main, 'counter'); this.place(main, 'stove'); this.place(main, 'fridge'); this.place(main, 'sofa', { two: 'along', extra: { col: r.pick(['#7a6a50', '#5a4a3a', '#6a7a5a']) } }) || this.place(main, 'armchair');
    this.place(main, 'tv');
    this.place(bath, 'toilet'); this.place(bath, 'sink');
    this.place(bed, 'bed', { two: 'along', extra: { col: r.pick(['#a05050', '#5060a0', '#d0c0a0']) } }); this.place(bed, 'dresser');
    b.keyId = b.id;
    return b;
  },
  houseRow(x0, y0, x1, y1, f) {
    const r = this.rng;
    const width = x1 - x0 + 1;
    const plan = r.chance(0.6) ? [12, 12] : [8, 8, 8];
    let x = x0;
    for (let i = 0; i < plan.length; i++) {
      const lw = i === plan.length - 1 ? x1 - x + 1 : plan[i];
      this.residentialLot(x, y0, lw, y1 - y0 + 1, f);
      // side fence between lots (back part)
      if (i > 0 && r.chance(0.5)) {
        const t = r.chance(0.6) ? WT.WOODFENCE : WT.PICKET;
        if (f === 'N') this.fenceLine(x, y0 + 5, y1 - y0 - 4, 1, t, 0.05);
        else this.fenceLine(x, y0, y1 - y0 - 4, 1, t, 0.05);
      }
      x += lw;
    }
    void width;
  },
  commercialRow(x0, y0, x1, y1, f, plan, names) {
    let x = x0;
    for (const [type, lw] of plan) {
      const w = Math.min(lw, x1 - x + 1);
      if (type === 'house') this.residentialLot(x, y0, w, y1 - y0 + 1, f, { fenceChance: 0.1 });
      else {
        const sh = 10, sw = w - 2;
        const sy = f === 'N' ? y0 + 1 : y1 - sh;
        // concrete apron
        if (f === 'N') this.fill(x, y0, x + w - 1, y0, FL.CONCRETE, 0); else this.fill(x, y1, x + w - 1, y1, FL.CONCRETE, 0);
        if (type === 'police') this.police(x + 1, sy, sw, sh, f);
        else this.store(type, x + 1, sy, sw, sh, f, names[type]);
        // trash & lamps around
        const bx = x, by = f === 'N' ? y0 + 11 : y0;
        if (this.free(bx, by)) this.put(bx, by, 'trash', 'S');
        this.mark(x, y0, x + w - 1, y1, 1);
      }
      x += w;
    }
  },
  park(x0, y0, x1, y1, label) {
    const r = this.rng;
    const cx = Math.floor((x0 + x1) / 2), cy = Math.floor((y0 + y1) / 2);
    this.fill(x0, cy, x1, cy + 1, FL.SIDEWALK, 1);
    this.fill(cx, y0, cx + 1, y1, FL.SIDEWALK, 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - (cx - 6), dy = y - (cy + 6);
      if (dx * dx / 9 + dy * dy / 5 < 1) this.sf(x, y, FL.WATER, r.int(0, 3));
      else if (dx * dx / 16 + dy * dy / 9 < 1) this.sf(x, y, FL.SAND, 0);
    }
    for (let k = 0; k < 40; k++) {
      const x = r.int(x0, x1), y = r.int(y0, y1);
      if (!this.free(x, y) || this.w.floor[y * this.W + x] !== FL.GRASS && this.w.floor[y * this.W + x] !== FL.GRASS2) continue;
      if (r.chance(0.6)) this.put(x, y, 'tree', 'S', { kind: r.pick(['oak', 'maple', 'birch', 'pine']), sz: r.f(0.9, 1.3) });
      else this.put(x, y, 'bush', 'S', { v: r.int(0, 2) });
    }
    for (let t = x0 + 2; t <= x1 - 2; t += 4) { if (this.free(t, cy - 1)) this.put(t, cy - 1, 'bench', 'S'); if (this.free(t, cy + 2)) this.put(t, cy + 2, 'bench', 'N'); }
    for (let t = y0 + 2; t <= y1 - 2; t += 4) { if (this.free(cx - 1, t)) this.put(cx - 1, t, 'bench', 'E'); if (this.free(cx + 2, t)) this.put(cx + 2, t, 'bench', 'W'); }
    this.put(cx - 1, cy - 1, 'lamppost', 'S'); this.put(cx + 2, cy + 2, 'lamppost', 'S');
    this.put(cx + 2, cy - 1, 'trash', 'S');
    this.w.labels.push({ x: cx, y: cy, text: label || 'Town Park' });
  },
  school(x0, y0, x1, y1) {
    const r = this.rng;
    const b = this.newBuilding('school', x0 + 1, y0 + 2, x1 - 1, y0 + 15, { wallType: WT.BRICK, roof: 'flat', roofCol: '#606060', name: 'Hollow Creek Elementary', alarm: this.alarmP() > 0, front: 'N' });
    const bw = x1 - x0 - 1;
    const hallY0 = y0 + 8, hallY1 = y0 + 9;
    const hall = this.addRoom(b, 'school', x0 + 1, hallY0, x1 - 1, hallY1, FL.LINO, 4);
    const rooms = [];
    const nR = Math.max(1, Math.floor(bw / 7));
    for (let k = 0; k < nR; k++) {
      const x = x0 + 1 + k * 7, xe = k === nR - 1 ? x1 - 1 : x + 6;
      rooms.push(this.addRoom(b, 'school', x, y0 + 2, xe, hallY0 - 1, FL.LINO, 2));
      rooms.push(this.addRoom(b, 'school', x, hallY1 + 1, xe, y0 + 15, FL.LINO, 2));
    }
    this.buildWalls(b);
    for (const rm of rooms) { this.doorBetween(rm, hall); }
    // entrance on north side via first room? Put entrance in hall's west/east ends
    this.exteriorDoor(hall, 'W', { style: 'glass', locked: false, b: b.id, ext: true });
    this.exteriorDoor(hall, 'E', { style: 'glass', locked: true, b: b.id, ext: true });
    for (const rm of rooms) {
      this.windows(rm, { p: 0.6, win: { b: b.id, curtains: false } });
      for (let y = rm.y0 + 1; y <= rm.y1 - 1; y += 2) for (let x = rm.x0 + 1; x <= rm.x1 - 1; x += 2) {
        if (this.reserved(x, y)) continue;
        this.w.obj[y * this.W + x] = this.mkObj('desk', 'N');
        if (!this.connected(rm)) this.w.obj[y * this.W + x] = null;
      }
      this.place(rm, 'bookshelf');
    }
    for (let x = x0 + 2; x < x1 - 1; x += 2) { const y = hallY0; if (!this.reserved(x, y)) { this.w.obj[y * this.W + x] = this.mkObj('locker', 'S'); if (!this.connected(hall)) this.w.obj[y * this.W + x] = null; } }
    // playground / field
    this.fill(x0, y0 + 17, x1, y1, FL.GRASS2, 1);
    this.fenceLine(x0, y0 + 17, bw + 2, 0, WT.CHAIN, 0.1);
    for (let k = 0; k < 5; k++) { const x = r.int(x0, x1), y = r.int(y0 + 18, y1); if (this.free(x, y)) this.put(x, y, 'tree', 'S', { kind: 'oak', sz: 1.1 }); }
    this.fill(x0, y0, x1, y0 + 1, FL.CONCRETE, 0);
    this.w.labels.push({ x: (x0 + x1) / 2, y: y0 + 8, text: 'Elementary School' });
  },
  industrial(x0, y0, x1, y1) {
    const r = this.rng;
    this.fill(x0, y0, x1, y1, FL.CONCRETE, 3);
    this.store('warehouse', x0 + 1, y0 + 2, 10, 20, 'W', 'Kessler Warehouse');
    this.store('warehouse', x0 + 13, y0 + 2, 10, 20, 'E', 'Kessler Storage');
    this.fenceLine(x0, y0, x1 - x0 + 1, 0, WT.CHAIN, 0.08);
    for (let k = 0; k < 6; k++) { const x = r.int(x0, x1), y = r.int(y0, y1); if (this.free(x, y)) this.put(x, y, 'crate', 'S', {}); }
  },
  church(x0, y0, x1, y1, name) {
    const r = this.rng;
    const b = this.newBuilding('church', x0 + 1, y0 + 1, x0 + 10, y1 - 1, { wallType: WT.EXT, extCol: '#e8e4dc', roofCol: '#4a3a3a', name: name || "St. Agnes Church", front: 'N' });
    const nave = this.addRoom(b, 'church', x0 + 1, y0 + 1, x0 + 10, y1 - 1, FL.WOOD, 5);
    this.buildWalls(b);
    this.exteriorDoor(nave, 'N', { locked: false, b: b.id, ext: true });
    this.windows(nave, { p: 0.5, win: { b: b.id, curtains: false } });
    for (let y = y0 + 3; y <= y1 - 3; y += 2) for (const x of [x0 + 2, x0 + 3, x0 + 4, x0 + 7, x0 + 8, x0 + 9]) { this.w.obj[y * this.W + x] = this.mkObj('pew', 'N'); if (!this.connected(nave)) this.w.obj[y * this.W + x] = null; }
    this.place(nave, 'shelf');
    // graveyard
    for (let y = y0 + 2; y <= y1 - 1; y += 2) for (let x = x0 + 13; x <= x1 - 1; x += 2) if (this.free(x, y) && r.chance(0.8)) this.put(x, y, 'grave', 'S', { v: r.int(0, 2) });
    for (let k = 0; k < 3; k++) { const x = r.int(x0 + 12, x1), y = r.int(y0, y1); if (this.free(x, y)) this.put(x, y, 'tree', 'S', { kind: 'pine', sz: 1.2 }); }
    this.fenceLine(x0 + 12, y0, x1 - x0 - 11, 0, WT.PICKET, 0.1);
    this.w.labels.push({ x: x0 + 6, y: y0 + 6, text: 'Church' });
  },

  // ---------------------------------------------------------------- outskirts
  outskirts() {
    const r = this.rng;
    // --- gas station (north of highway, east of town)
    this.fill(204, 95, 226, 104, FL.CONCRETE, 1);
    this.mark(202, 92, 228, 104, 1);
    this.store('gasstation', 209, 93, 10, 6, 'S', 'Gas-N-Go');
    for (const x of [208, 212, 216, 220]) { this.put(x, 102, 'pump', 'S'); }
    this.w.carSpots.push({ x: 210.5, y: 101.6, a: 0 }, { x: 218.6, y: 101.5, a: Math.PI });
    this.put(205, 97, 'trash', 'S'); this.put(225, 97, 'lamppost', 'S'); this.put(205, 103, 'lamppost', 'S');
    // --- motel (south of highway)
    this.fill(203, 110, 230, 113, FL.ASPHALT, 0);
    this.mark(202, 110, 231, 124, 1);
    const mb = this.newBuilding('motel', 204, 114, 229, 119, { wallType: WT.EXT, extCol: '#d8c8a0', roofCol: '#7a4a3a', name: 'Sunset Motel', front: 'N' });
    const units = [];
    for (let k = 0; k < 6; k++) {
      const ux = 204 + k * 4;
      const rm = this.addRoom(mb, 'motel', ux, 114, ux + 3, 119, FL.CARPET, 6);
      units.push(rm);
    }
    const office = this.addRoom(mb, 'motel', 228, 114, 229, 119, FL.LINO, 2);
    this.buildWalls(mb);
    for (const rm of units) {
      this.exteriorDoor(rm, 'N', { locked: r.chance(0.6), b: mb.id, ext: true });
      this.windows(rm, { p: 0.6, win: { b: mb.id } });
      this.place(rm, 'bed', { two: 'perp', extra: { col: '#a05050' } });
      this.place(rm, 'nightstand'); this.place(rm, 'dresser'); this.place(rm, 'tv');
      this.place(rm, 'toilet');
    }
    this.exteriorDoor(office, 'N', { locked: false, b: mb.id, style: 'glass', ext: true });
    this.place(office, 'register'); this.place(office, 'desk');
    for (let k = 0; k < 4; k++) if (r.chance(0.6)) this.w.carSpots.push({ x: 206 + k * 6 + 0.5, y: 111.5, a: Math.PI / 2 });
    this.w.labels.push({ x: 216, y: 116, text: 'Sunset Motel' });
    // --- farm (south-west)
    this.mark(2, 140, 44, 238, 1);
    const fh = this.house(32, 150, 10, 8, 'W', { noGarage: true, type: 'farmhouse' });
    fh.name = 'Farmhouse';
    this.w.spawnHouses.push(fh.id);
    const barn = this.newBuilding('barn', 32, 166, 42, 178, { wallType: WT.EXT, extCol: '#8a2a20', roofCol: '#5a4a40', front: 'W' });
    const bRoom = this.addRoom(barn, 'barn', 32, 166, 42, 178, FL.DIRT, 0);
    this.buildWalls(barn);
    const be = this.borderEdges(bRoom, (x, y) => World.room(x, y) < 0).filter(c => c.dir === 'W' && !c.corner);
    const bm = Math.floor(be.length / 2);
    for (let k = bm - 1; k <= bm; k++) if (be[k]) this.setDoor(be[k], { style: 'garage', col: '#7a2a20', b: barn.id });
    this.exteriorDoor(bRoom, 'E', { b: barn.id, ext: true });
    for (let k = 0; k < 8; k++) this.place(bRoom, 'hay');
    for (let k = 0; k < 4; k++) this.place(bRoom, 'crate');
    for (let k = 0; k < 2; k++) this.place(bRoom, 'toolcab');
    this.w.carSpots.push({ x: 37.5, y: 172.5, a: Math.PI, kind: 'pickup' });
    this.w.labels.push({ x: 37, y: 172, text: 'Barn' });
    // fields
    const field = (fx0, fy0, fx1, fy1) => {
      const crop = r.pick(Object.keys(CROPS));
      for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
        if (!World.inb(x, y) || World.room(x, y) >= 0) continue;
        this.w.obj[y * this.W + x] = null;
        if ((x - fx0) % 3 === 2) { this.sf(x, y, FL.DIRT, 1); continue; }
        this.sf(x, y, FL.FURROW, 0);
        if (r.chance(0.85)) this.w.obj[y * this.W + x] = { t: 'crop', dir: 'S', crop, stage: r.int(2, 4), water: 0.5, grow: r.f(0, 1), dead: r.chance(0.1) };
      }
      this.fenceLine(fx0 - 1, fy0 - 1, fx1 - fx0 + 3, 0, WT.PICKET, 0.04);
      this.fenceLine(fx0 - 1, fy1 + 1, fx1 - fx0 + 3, 0, WT.PICKET, 0.04);
    };
    field(6, 152, 22, 168); field(6, 176, 22, 196); field(6, 204, 22, 228); field(33, 186, 41, 214);
    this.w.labels.push({ x: 14, y: 180, text: 'Farmland' });
    // --- cabins
    this.cabin(13, 18, 7, 6, 'S');
    this.cabin(213, 56, 7, 6, 'W');
    this.cabin(60, 222, 7, 6, 'N');
    this.dirtPath([[64, 199], [64, 221]], 2);
    // --- military checkpoint at west end of highway
    for (let y = 98; y <= 114; y++) if (y < 104 || y > 109) World.setWall(8, y, 1, WT.CHAIN);
    for (const [x, y] of [[4, 100], [5, 100], [4, 112], [6, 112], [3, 101]]) this.put(x, y, 'crate', 'S', { c: { type: 'crate', cap: 40, items: null, loot: 'military' } });
    for (const [x, y] of [[9, 104], [9, 109], [10, 104], [10, 109]]) this.put(x, y, 'hay', 'S', { sandbag: true });
    this.w.zones.push({ x0: 0, y0: 96, x1: 14, y1: 116, n: 10, outfit: 'military' });
    this.w.labels.push({ x: 6, y: 106, text: 'Military Checkpoint' });
    // burnt wrecks on highway
    for (let k = 0; k < 6; k++) {
      const onH = r.chance(0.5);
      const x = onH ? r.pick([r.int(12, 38), r.int(200, 236)]) : 135 + r.int(0, 3);
      const y = onH ? 105 + r.int(0, 3) : r.pick([r.int(4, 38), r.int(202, 236)]);
      if (this.free(x, y)) this.put(x, y, 'car_wreck', r.pick(['N', 'E']), { col: '#3a3430', kind: ['sedan', 'wagon', 'pickup', 'van', 'hatchback', 'suv'][(x * 7 + y * 13) % 6] });
    }
  },
  outskirts2() {
    const r = this.rng;
    // --- trailer park on the road to Millbrook
    this.mark(196, 296, 252, 312, 1);
    this.fill(196, 304, 250, 305, FL.GRAVEL, 0);
    this.fill(196, 306, 197, 314, FL.GRAVEL, 0);
    for (let k = 0; k < 6; k++) { const hx = 199 + k * 9; this.trailer(hx, 297, 'S'); if (r.chance(0.5)) this.w.carSpots.push({ x: hx + 4.5, y: 307.6, a: 0 }); }
    for (let k = 0; k < 5; k++) { const hx = 199 + k * 10; this.trailer(hx, 308, 'N'); }
    this.w.labels.push({ x: 224, y: 304, text: 'Pine Rest Trailer Park' });
    // --- second farm off Main Street, south of town
    this.mark(84, 236, 131, 300, 1);
    const fh = this.house(112, 240, 10, 8, 'E', { noGarage: true, type: 'farmhouse' });
    fh.name = 'Farmhouse';
    const barn = this.newBuilding('barn', 98, 240, 108, 250, { wallType: WT.EXT, extCol: '#7a2a20', roofCol: '#4a4038', front: 'E' });
    const bRoom = this.addRoom(barn, 'barn', 98, 240, 108, 250, FL.DIRT, 0);
    this.buildWalls(barn);
    const be = this.borderEdges(bRoom, (x, y) => World.room(x, y) < 0).filter(c => c.dir === 'E' && !c.corner);
    const bm = Math.floor(be.length / 2);
    for (let k = bm - 1; k <= bm; k++) if (be[k]) this.setDoor(be[k], { style: 'garage', col: '#7a2a20', b: barn.id });
    for (let k = 0; k < 6; k++) this.place(bRoom, 'hay');
    for (let k = 0; k < 3; k++) this.place(bRoom, 'crate');
    this.place(bRoom, 'toolcab');
    this.w.carSpots.push({ x: 110.5, y: 254.5, a: 0, kind: 'pickup' });
    const crop = r.pick(Object.keys(CROPS));
    for (let y = 258; y <= 296; y++) for (let x = 88; x <= 128; x++) {
      if (World.room(x, y) >= 0) continue;
      this.w.obj[y * this.W + x] = null;
      if ((x - 88) % 3 === 2) { this.sf(x, y, FL.DIRT, 1); continue; }
      this.sf(x, y, FL.FURROW, 0);
      if (r.chance(0.8)) this.w.obj[y * this.W + x] = { t: 'crop', dir: 'S', crop, stage: r.int(2, 4), water: 0.5, grow: r.f(0, 1), dead: r.chance(0.1) };
    }
    this.fenceLine(87, 257, 43, 0, WT.PICKET, 0.04); this.fenceLine(87, 297, 43, 0, WT.PICKET, 0.04);
    this.w.labels.push({ x: 108, y: 276, text: 'McCoy Farm' });
    this.w.zones.push({ x0: 84, y0: 236, x1: 131, y1: 300, n: 12 });
    // --- gas station where the Millbrook road meets the highway
    this.fill(304, 92, 326, 101, FL.CONCRETE, 1);
    this.mark(302, 90, 328, 102, 1);
    this.store('gasstation', 308, 91, 10, 6, 'S', 'Gulf Stop');
    for (const x of [308, 312, 316, 320]) this.put(x, 99, 'pump', 'S');
    this.w.carSpots.push({ x: 314.5, y: 98.6, a: 0 });
    // --- remote cabins
    this.cabin(356, 34, 7, 6, 'S');
    this.cabin(306, 190, 7, 6, 'W');
    this.cabin(40, 330, 7, 6, 'E');
    this.cabin(196, 365, 7, 6, 'S');
    this.cabin(250, 150, 7, 6, 'N');
    // --- east roadblock where the highway leaves the county
    for (let y = 98; y <= 114; y++) if (y < 104 || y > 109) World.setWall(392, y, 1, WT.CHAIN);
    for (const [x, y] of [[394, 100], [395, 100], [394, 112], [396, 112], [396, 101]]) this.put(x, y, 'crate', 'S', { c: { type: 'crate', cap: 40, items: null, loot: 'military' } });
    for (const [x, y] of [[390, 104], [390, 109], [389, 104], [389, 109]]) this.put(x, y, 'hay', 'S', { sandbag: true });
    this.w.labels.push({ x: 394, y: 106, text: 'Roadblock' });
    // wrecks on the long roads
    for (let k = 0; k < 10; k++) {
      const pick = r.int(0, 2);
      const x = pick === 0 ? r.int(240, 380) : pick === 1 ? 300 + r.int(0, 3) : r.int(150, 260);
      const y = pick === 0 ? 105 + r.int(0, 3) : pick === 1 ? r.int(120, 240) : 315 + r.int(0, 3);
      if (this.free(x, y)) this.put(x, y, 'car_wreck', r.pick(['N', 'E']), { col: '#3a3430', kind: ['sedan', 'wagon', 'pickup', 'van', 'hatchback', 'suv'][(x * 7 + y * 13) % 6] });
    }
  },
  forest() {
    const r = this.rng, W = this.W, H = this.H;
    const a = this.RP[0] - 4, b = this.RP[5] + 8;
    const c0x = this.RX2[0] - 4, c1x = this.RX2[this.RX2.length - 1] + 8, c0y = this.RY2[0] - 4, c1y = this.RY2[this.RY2.length - 1] + 8;
    for (let y = 0; y < H; y++) for (let x = 0; x < this.GW; x++) {
      const i = y * W + x;
      if (this.used[i] || this.w.obj[i] || this.w.room[i] >= 0) continue;
      const f = this.w.floor[i];
      if (f !== FL.GRASS && f !== FL.GRASS2) continue;
      const dx = x < a ? a - x : x > b ? x - b : 0, dy = y < a ? a - y : y > b ? y - b : 0;
      const ex = x < c0x ? c0x - x : x > c1x ? x - c1x : 0, ey = y < c0y ? c0y - y : y > c1y ? y - c1y : 0;
      const td = Math.min(Math.max(dx, dy), Math.max(ex, ey));
      const wild = U.clamp((td - 2) / 10, 0, 1);
      const n = this.nC(x / 22, y / 22, 3);
      const dens = wild * U.clamp((n - 0.32) * 2.6, 0, 1);
      if (dens > 0.35) this.sf(x, y, FL.FOREST, r.int(0, 3));
      if (r.next() < dens * 0.45) {
        const pine = this.nB(x / 40 + 9, y / 40, 2) > 0.5;
        this.w.obj[i] = { t: 'tree', dir: 'S', kind: pine ? 'pine' : r.pick(['oak', 'maple', 'birch', 'oak']), sz: r.f(0.85, 1.35) };
      } else if (r.next() < dens * 0.12 + 0.004) {
        this.w.obj[i] = { t: 'bush', dir: 'S', v: r.int(0, 2), berries: r.chance(0.25) };
      }
    }
  },
  finalize() {
    // zombie zones
    const RP = this.RP;
    this.w.zones.push({ x0: RP[0], y0: RP[0], x1: RP[5] + 3, y1: RP[5] + 3, n: 300 });
    this.w.zones.push({ x0: RP[0], y0: 100, x1: RP[5] + 3, y1: 140, n: 90 });
    this.w.zones.push({ x0: 200, y0: 90, x1: 232, y1: 125, n: 22 });
    this.w.zones.push({ x0: 0, y0: 0, x1: this.GW - 1, y1: this.H - 1, n: 170 });
    this.w.zones.push({ x0: this.RX2[0], y0: this.RY2[0], x1: this.RX2[3] + 3, y1: this.RY2[3] + 3, n: 150 });
    this.w.zones.push({ x0: 196, y0: 296, x1: 252, y1: 330, n: 16 });
    this.w.zones.push({ x0: 380, y0: 96, x1: 399, y1: 116, n: 10, outfit: 'military' });
    this.w.zones.push({ x0: 2, y0: 145, x1: 44, y1: 232, n: 18 });
    // indoor zombies per building
    for (const b of this.w.buildings) {
      const n = { house: 1, farmhouse: 1, cabin: 0.5, trailer: 0.6, clinic: 5, grocery: 5, police: 6, school: 8, warehouse: 3, motel: 4, church: 3, restaurant: 3, diner: 3, bar: 4, gasstation: 2, firestation: 3, office: 2 }[b.type];
      if (b.zIndoor === undefined) b.zIndoor = n === undefined ? 2 : n;
    }
  },
};
