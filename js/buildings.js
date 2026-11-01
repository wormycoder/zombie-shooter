'use strict';
// ---------------------------------------------------------------------------
// More buildings (extends MapGen): flats over the shops on the main streets, apartment blocks, and the post office,
// library and auto repair shop of the bigger towns.
// The flats draw from their own random numbers, so adding one never shifts the rest of the map.
// ---------------------------------------------------------------------------
const FLAT_SHOPS = { hardware: 1, gunstore: 1, pharmacy: 1, restaurant: 1, bar: 1, clothing: 1, bookstore: 1, office: 1, laundromat: 1, diner: 1, postoffice: 1 };
Object.assign(MapGen, {
  // run fn with a random stream of its own (seeded from the world and a place), the main one left where it was
  withRng(salt, fn) {
    const r0 = this.rng;
    this.rng = new RNG((Math.imul(this.w.seed | 0, 2654435761) ^ Math.imul(salt | 0, 40503) ^ 0x5bd1e995) >>> 0);
    try { return fn(); } finally { this.rng = r0; }
  },
  // runs of 4 tiles along wall side s of room rm where stairs could go (as secondFloor finds them); objects of the
  // types in clear (crates, say) count as free: they are moved off when the run is used
  stairCands(rm, sides, clear) {
    const W = this.W, out = [];
    const blocked = (x, y) => { const o = this.w.obj[y * W + x]; return o && !(clear && clear[o.t]); };
    for (const s of sides) {
      const horiz = s === 'N' || s === 'S';
      const line = s === 'N' ? rm.y0 : s === 'S' ? rm.y1 : s === 'W' ? rm.x0 : rm.x1;
      const a0 = horiz ? rm.x0 : rm.y0, a1 = horiz ? rm.x1 : rm.y1, [ox, oy] = DIRV[OPP[s]];
      for (let a = a0; a + 3 <= a1; a++) {
        let ok = true;
        for (let k = 0; k < 4 && ok; k++) {
          const x = horiz ? a + k : line, y = horiz ? line : a + k;
          if (blocked(x, y) || this.reserved(x, y) || this.wallKind(x, y, s) !== 1) ok = false;
          else if (this.inRoom(rm, x + ox, y + oy) && (blocked(x + ox, y + oy) || (k < 3 && this.reserved(x + ox, y + oy)))) ok = false;
        }
        if (ok) for (const sgn of [1, -1]) out.push({ s, horiz, line, a, sgn });
      }
    }
    return out;
  },
  // move clearable objects off a stair run, its walkway and the tile before its foot
  stairClear(rm, c, clear) {
    const W = this.W, [ox, oy] = DIRV[OPP[c.s]], dx = c.horiz ? c.sgn : 0, dy = c.horiz ? 0 : c.sgn;
    const foot = c.sgn > 0 ? c.a : c.a + 3, fx = c.horiz ? foot - dx : c.line, fy = c.horiz ? c.line : foot - dy;
    const tiles = [[fx, fy]];
    for (let k = 0; k < 4; k++) { const x = c.horiz ? c.a + k : c.line, y = c.horiz ? c.line : c.a + k; tiles.push([x, y], [x + ox, y + oy]); }
    for (const [x, y] of tiles) { const o = this.inRoom(rm, x, y) && this.w.obj[y * W + x]; if (o && clear[o.t]) this.w.obj[y * W + x] = null; }
  },
  // a door from room rm onto hall (never into the stairwell, onto the top step or onto furniture)
  hallDoor(rm, hall, hole, o) {
    const W = this.W;
    let cs = this.borderEdges(rm, (x, y) => World.room(x, y) === hall.id && !hole.has(y * W + x) && !this.w.obj[y * W + x]);
    const good = cs.filter(q => !q.corner);
    if (good.length) cs = good;
    if (!cs.length) return null;
    const q = cs[Math.floor(cs.length / 2)];
    this.setDoor(q, Object.assign({ style: 'wood', col: '#c8b8a0' }, o || {}));
    this.resv.add(q.ny * W + q.nx);
    this.resv.add(q.y * W + q.x);
    return q;
  },
  // ---------------------------------------------------------------- the flat over a shop
  // Stairs along the back wall of the stock room lead up to a flat the size of the shop: a hall along the back, the
  // living room on one side, the kitchen at the front of the other with the bedroom and bathroom behind it.
  flatAbove(b) {
    const back = b.rooms.length > 1 ? this.w.rooms[b.rooms[1]] : null, W = this.W, W0 = LV.W0;
    const M = this.mapper(b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, b.front);
    if (!back || M.W < 8 || M.W > 14 || M.D < 9) return false;
    const clear = { crate: 1 }, r = this.rng;
    const cands = r.shuffle(this.stairCands(back, [M.dir('B')], clear));
    let S = null;
    for (const c of cands) { this.stairClear(back, c, clear); if ((S = this.stairsDown(back, c))) break; }
    if (!S) return false;
    const up = (rc) => [rc[0] + W0, rc[1], rc[2] + W0, rc[3]];
    // left/right flipped at random
    const fx = r.chance(0.5), R = (u0, v0, u1, v1) => up(fx ? M.rect(M.W - 1 - u1, v0, M.W - 1 - u0, v1) : M.rect(u0, v0, u1, v1));
    const D = M.D, lw = Math.floor(M.W / 2), bw = M.W - lw >= 6 ? 3 : 2, kd = Math.floor((D - 2) / 2);
    const fl = () => r.chance(0.55) ? FL.WOOD : FL.CARPET;
    const hall = this.addRoom(b, 'hall', ...up(M.rect(0, D - 2, M.W - 1, D - 1)), FL.WOOD);
    const liv = this.addRoom(b, 'living', ...R(0, 0, lw - 1, D - 3), fl());
    const kit = this.addRoom(b, 'kitchen', ...R(lw, 0, M.W - 1, kd - 1), r.chance(0.5) ? FL.TILE : FL.LINO);
    const bed = this.addRoom(b, 'bedroom', ...R(lw, kd, M.W - 1 - bw, D - 3), fl());
    const bath = this.addRoom(b, 'bathroom', ...R(M.W - bw, kd, M.W - 1, D - 3), FL.TILE);
    const hole = this.stairsUp(S);
    this.buildWalls(b, W0);
    this.hallDoor(liv, hall, hole);
    this.hallDoor(bed, hall, hole);
    this.hallDoor(bath, hall, hole);
    this.doorBetween(liv, kit, null, r.chance(0.6));
    for (const rm of [liv, kit, bed, bath]) this.windows(rm, { p: rm === bath ? 0.2 : 0.55, win: { b: b.id } });
    this.windows(hall, { p: 0.3, none: true, win: { b: b.id } });
    for (const rm of [kit, liv, bed, bath, hall]) this.furnishRoom(rm);
    b.floors = 2;
    b.flat = true;
    b.stair = this.w.stairs[this.w.stairs.length - 1];
    return true;
  },
  // ---------------------------------------------------------------- apartment blocks
  // Two storeys of brick round a stair hall down the middle (glass door at the front, a metal one at the back), a
  // flat on either side on each floor: the living room at the front, the bedroom behind it, the kitchen and the
  // bathroom along the hall. w x h at least 16 x 12.
  apartments(x0, y0, w, h, f, name) {
    const r = this.rng, W0 = LV.W0;
    const b = this.newBuilding('apartments', x0, y0, x0 + w - 1, y0 + h - 1, { wallType: WT.BRICK, roof: 'flat', roofCol: r.pick(PAL.roofFlat), name: name || null, front: f, alarm: false });
    const M = this.mapper(x0, y0, w, h, f), D = M.D, h0 = (M.W - 4) >> 1, h1 = h0 + 3;
    const fl = () => r.chance(0.5) ? FL.WOOD : FL.CARPET;
    const storey = (lv) => {
      const R = (u0, v0, u1, v1) => { const q = M.rect(u0, v0, u1, v1); return [q[0] + lv, q[1], q[2] + lv, q[3]]; };
      const hall = this.addRoom(b, 'hall', ...R(h0, 0, h1, D - 1), FL.LINO, 3), flats = [];
      for (const side of [0, 1]) {
        const a0 = side ? h1 + 1 : 0, a1 = side ? M.W - 1 : h0 - 1, inn = side ? [a0, a0 + 2] : [a1 - 2, a1], out = side ? [a0 + 3, a1] : [a0, a1 - 3];
        flats.push({
          liv: this.addRoom(b, 'living', ...R(a0, 0, a1, 4), fl()),
          kit: this.addRoom(b, 'kitchen', ...R(inn[0], 5, inn[1], 8), FL.LINO),
          bath: this.addRoom(b, 'bathroom', ...R(inn[0], 9, inn[1], D - 1), FL.TILE),
          bed: this.addRoom(b, 'bedroom', ...R(out[0], 5, out[1], D - 1), fl()),
        });
      }
      return { hall, flats };
    };
    const doors = (S, hole) => {
      for (const q of S.flats) {
        this.hallDoor(q.liv, S.hall, hole, { locked: r.chance(0.5) });
        this.doorBetween(q.liv, q.kit, null, true);
        this.doorBetween(q.kit, q.bath);
        this.doorBetween(q.liv, q.bed);
      }
    };
    const st = [storey(0)];
    this.buildWalls(b);
    b.frontDoor = this.exteriorDoor(st[0].hall, M.dir('F'), { style: 'glass', locked: r.chance(0.3), b: b.id, ext: true });
    this.exteriorDoor(st[0].hall, M.dir('B'), { style: 'metal', locked: r.chance(0.6), b: b.id, ext: true });
    doors(st[0], new Set());
    // the stairs along a side of the hall, past the flats' doors
    let S = null;
    for (const c of r.shuffle(this.stairCands(st[0].hall, [M.dir('L'), M.dir('R')]))) if ((S = this.stairsDown(st[0].hall, c))) break;
    if (S) {
      st.push(storey(W0));
      const hole = this.stairsUp(S);
      this.buildWalls(b, W0);
      doors(st[1], hole);
      b.floors = 2;
      b.stair = this.w.stairs[this.w.stairs.length - 1];
    }
    for (const S_ of st) {
      for (const q of S_.flats) {
        for (const rm of [q.liv, q.bed, q.bath]) this.windows(rm, { p: rm === q.bath ? 0.25 : 0.6, win: { b: b.id } });
        for (const rm of [q.kit, q.liv, q.bed, q.bath]) this.furnishRoom(rm);
      }
      this.windows(S_.hall, { p: 0.5, none: true, win: { b: b.id, curtains: false } });
    }
    if (name) this.w.labels.push({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, text: name });
    b.keyId = b.id;
    return b;
  },
  // a town block of two apartment buildings (one on each street, back to back across a shared yard), each with its
  // car park beside it
  aptBlock(B, names) {
    const r = this.rng, { x0, y0, x1, y1 } = B, AW = 18, AH = 12, W = this.W;
    if (x1 - x0 + 1 < AW + 12 || y1 - y0 + 1 < 2 * AH + 8) return false;
    const blds = [];
    for (const [bx, by, f] of [[x0 + 1, y0 + 2, 'N'], [x1 - AW, y1 - AH - 1, 'S']]) {
      const b = this.apartments(bx, by, AW, AH, f, names.length ? names.shift() : null);
      blds.push(b);
      // a walk from the front door to the sidewalk, shrubs either side
      const fd = b.frontDoor, sy = f === 'N' ? y0 : y1;
      if (fd) {
        const dx = fd.nx, ya = f === 'N' ? sy : by + AH, yb = f === 'N' ? by - 1 : sy;
        for (let y = ya; y <= yb; y++) { this.sf(dx, y, FL.CONCRETE, 2); this.w.obj[y * W + dx] = null; }
        const my = f === 'N' ? by - 1 : by + AH;
        for (const ddx of [-2, 2]) if (this.free(dx + ddx, my)) this.put(dx + ddx, my, 'bush', 'S', { v: this.shrubV(dx + ddx, my, r.int(0, 3)) });
        if (this.free(dx + 1, sy)) this.put(dx + 1, sy, 'mailbox', f === 'N' ? 'N' : 'S');
        if (this.free(dx - 1, sy)) this.put(dx - 1, sy, 'mailbox', f === 'N' ? 'N' : 'S');
      }
      // the car park on the far side of the building
      const lx0 = f === 'N' ? bx + AW + 1 : x0 + 1, lx1 = f === 'N' ? x1 - 1 : bx - 2;
      const ly0 = f === 'N' ? y0 : by - 1, ly1 = f === 'N' ? by + AH : y1;
      this.clearObj(lx0, ly0, lx1, ly1);
      this.fill(lx0, ly0, lx1, ly1, FL.PARKING, 0);
      const dmx = f === 'N' ? bx + AW : bx - 1, dmy = f === 'N' ? by + AH - 2 : by + 1;
      if (this.free(dmx, dmy)) this.put(dmx, dmy, 'st_dumpster', f === 'N' ? 'E' : 'W', { v: r.int(0, 2) });
    }
    // the shared yard between their back doors: grass, trees, picnic tables, a clothesline
    const cy0 = y0 + AH + 3, cy1 = y1 - AH - 3;
    const spots = [];
    for (let y = cy0; y <= cy1; y++) for (let x = x0 + 2; x <= x1 - 2; x++) if (this.free(x, y)) spots.push([x, y]);
    r.shuffle(spots);
    let nt = 0, np = 0, nc = 0;
    for (const [x, y] of spots) {
      if (nt < 4 && (x - x0) % 7 === 3) { this.put(x, y, 'tree', 'S', this.tree(x, y, r.f(0.9, 1.2), 0, r.pick(['oak', 'maple', 'birch']))); nt++; }
      else if (np < 2 && this.free(x - 1, y) && this.free(x + 1, y)) { this.put(x, y, 'st_table', 'S', { kind: 'picnic' }); np++; }
      else if (nc < 1 && y > cy0 && y < cy1) { this.put(x, y, 'yd_clothesline', 'E', { v: r.int(0, 9) }); nc++; }
    }
    this.mark(x0, y0, x1, y1, 1);
    return blds;
  },
  // ---------------------------------------------------------------- auto repair
  // The office at the front corner (glass door to the street, the counter and the waiting chairs), the parts room
  // behind it, and the workshop beside them: roll-up doors to the street, benches and tyres along the walls, a car
  // in for repair with its hood up. w at least 14, h at least 9.
  autoRepair(x0, y0, w, h, f, name) {
    const r = this.rng, W = this.W;
    const b = this.newBuilding('autorepair', x0, y0, x0 + w - 1, y0 + h - 1, { wallType: r.chance(0.5) ? WT.BRICK : WT.EXT, roof: 'flat', roofCol: r.pick(PAL.roofFlat), name: name || null, front: f, alarm: r.chance(Math.min(0.9, this.alarmP() * 4)) });
    const M = this.mapper(x0, y0, w, h, f), ow = 5, od = Math.max(4, M.D >> 1), left = r.chance(0.5);
    const L = (u0, v0, u1, v1) => left ? M.rect(u0, v0, u1, v1) : M.rect(M.W - 1 - u1, v0, M.W - 1 - u0, v1), lu = (u) => left ? u : M.W - 1 - u;
    const office = this.addRoom(b, 'autorepair', ...L(0, 0, ow - 1, od - 1), FL.LINO, 2);
    const parts = this.addRoom(b, 'autorepair', ...L(0, od, ow - 1, M.D - 1), FL.CONCRETE, 1);
    const bay = this.addRoom(b, 'autorepair', ...L(ow, 0, M.W - 1, M.D - 1), FL.CONCRETE, 0);
    this.buildWalls(b);
    const fd = M.dir('F');
    this.exteriorDoor(office, fd, { style: 'glass', locked: r.chance(0.45), b: b.id, ext: true });
    this.doorBetween(office, bay);
    this.doorBetween(parts, bay);
    // roll-up doors: one per bay, 3 wide, along the front of the workshop
    const be = this.borderEdges(bay, (x, y) => World.room(x, y) < 0).filter(c => c.dir === fd && !c.corner);
    const at = (u) => { const [x, y] = M.m(lu(u), 0); return be.find(c => c.x === x && c.y === y); };
    const bays = [];
    for (let u = ow + 1; u + 2 <= M.W - 2; u += 5) {
      const locked = r.chance(0.5);
      for (let k = 0; k < 3; k++) { const c = at(u + k); if (c) this.setDoor(c, { style: 'garage', locked, b: b.id }); }
      bays.push(u + 1);
    }
    this.exteriorDoor(bay, OPP[fd], { style: 'metal', locked: true, b: b.id, ext: true });
    this.windows(office, { p: 0.7, win: { b: b.id, curtains: false } });
    this.windows(bay, { p: 0.2, none: true, win: { b: b.id, curtains: false } });
    // a car in the first bay, nose in; its floor kept clear
    const [bd0, bd1] = DIRV[M.dir('B')];
    if (bays.length && M.D >= 8) {
      const [cx, cy] = M.m(lu(bays[0]), M.D >> 1);
      this.w.carSpots.push({ x: cx + 0.5, y: cy + 0.5, a: Math.round(Math.atan2(bd1, bd0) * 1000) / 1000, repair: true });
      for (let v = 1; v < M.D - 1; v++) for (let du = -1; du <= 1; du++) { const [x, y] = M.m(lu(bays[0] + du), v); this.resv.add(y * W + x); }
    }
    // the walk in from each roll-up door stays clear too
    for (const u of bays) for (let du = -1; du <= 1; du++) { const [x, y] = M.m(lu(u + du), 0); this.resv.add(y * W + x); }
    this.place(office, 'register'); this.place(office, 'desk'); this.place(office, 'chair'); this.place(office, 'chair'); this.place(office, 'shelf');
    for (let k = 0; k < 3; k++) this.place(parts, 'shelf');
    this.place(parts, 'crate'); this.place(parts, 'crate');
    for (let k = 0; k < Math.max(3, bays.length * 2); k++) this.place(bay, 'toolcab', { sides: [M.dir('B'), M.dir(left ? 'R' : 'L')] }) || this.place(bay, 'toolcab');
    for (let k = 0; k < 3; k++) this.place(bay, 'crate');
    // old tyres stacked by the side wall outside
    const sd = M.dir(left ? 'R' : 'L'), [sx, sy] = DIRV[sd];
    for (let v = 2; v < M.D - 1; v += 3) { const [x, y] = M.m(lu(M.W - 1), v); if (this.free(x + sx, y + sy)) this.put(x + sx, y + sy, 'st_tires', 'S', { v: r.int(0, 5) }); }
    if (name) this.w.labels.push({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, text: name });
    b.keyId = b.id;
    return b;
  },
  // ---------------------------------------------------------------- fenced grounds
  // The bare gravel of a fenced site turned to lawn, with a tile of gravel kept along paving, buildings and walls;
  // trees on the lawn here and there (treeP a tile, kept apart). Returns the lawn's tiles.
  siteLawn(x0, y0, x1, y1, treeP) {
    const W = this.W, F = this.w.floor, r = this.rng, lawn = [];
    const soft = (i) => (F[i] === FL.GRAVEL || F[i] === FL.GRASS || F[i] === FL.GRASS2) && this.w.room[i] < 0;
    const walled = (x, y) => World.wall(x, y, 0) || World.wall(x, y + 1, 0) || World.wall(x, y, 1) || World.wall(x + 1, y, 1);
    for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {
      const i = y * W + x;
      if (F[i] !== FL.GRAVEL || this.w.room[i] >= 0 || walled(x, y)) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) if (!soft(i + dy * W + dx)) ok = false;
      if (ok) lawn.push(i);
    }
    for (const i of lawn) { F[i] = FL.GRASS; this.w.fvar[i] = r.int(0, 3); }
    if (treeP) {
      const isLawn = new Set(lawn), planted = [];
      for (const i of r.shuffle(lawn.slice())) {
        if (!r.chance(treeP * 6)) continue;
        const x = i % W, y = (i / W) | 0;
        let ok = !this.w.obj[i] && !this.reservedOutside(x, y);
        for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) if (!isLawn.has(i + dy * W + dx)) ok = false;
        if (ok && planted.some(([px, py]) => Math.abs(px - x) < 4 && Math.abs(py - y) < 4)) ok = false;
        if (!ok) continue;
        this.put(x, y, 'tree', 'S', this.tree(x, y, r.f(0.85, 1.2), 0, r.pick(['oak', 'maple', 'pine'])));
        planted.push([x, y]);
        if (planted.length >= lawn.length * treeP) break;
      }
    }
    return lawn;
  },
  // Fort Hale dressed: lawns and trees, trees along the road in, an obstacle course across the parade ground,
  // sandbagged posts in the corners, a supply dump by the motor pool. P: the base's layout from fortHale
  fortDress(q, P) {
    const r = this.rng, W = this.W, { x0, y0, x1, y1 } = q;
    const ok = (x, y) => this.free(x, y) && !this.reservedOutside(x, y) && this.w.floor[y * W + x] !== FL.ASPHALT && this.w.floor[y * W + x] !== FL.PARKING;
    for (let y = y0 + 8; y < y1 - 4; y += 6) for (const x of [P.rx - 2, P.rx + 5]) if (ok(x, y) && ok(x, y - 1) && ok(x, y + 1)) this.put(x, y, 'tree', 'S', this.tree(x, y, r.f(0.95, 1.15), 0, 'oak'));
    if (P.parade) {
      const [px0, py0, px1, py1] = P.parade, oy = py1 - 2;
      for (let x = px0 + 3, k = 0; x < px1 - 2; x += 3, k++) {
        if (!ok(x, oy)) continue;
        if (k % 3 === 0) this.put(x, oy, 'logwall', 'S');
        else if (k % 3 === 1) this.put(x, oy, 'hay', 'S', { sandbag: true, v: r.int(0, 5) });
        else this.put(x, oy, 'st_jersey', 'S', { v: 0 });
      }
    }
    for (const [cx, cy] of [[x0 + 3, y0 + 3], [x1 - 3, y0 + 3], [x0 + 3, y1 - 3], [x1 - 3, y1 - 3]]) {
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]) if (ok(cx + dx, cy + dy)) this.put(cx + dx, cy + dy, 'hay', 'S', { sandbag: true, v: r.int(0, 5) });
    }
    if (P.dump) {
      const [dx0, dy0, dx1, dy1] = P.dump;
      for (let k = 0; k < 12; k++) {
        const x = r.int(dx0, dx1), y = r.int(dy0, dy1);
        if (!ok(x, y)) continue;
        if (r.chance(0.6)) this.put(x, y, 'woodcrate', 'S', { c: { type: 'crate', cap: 50, items: null, loot: 'militarysupply' } });
        else this.put(x, y, 'st_pallet', 'S', { v: r.int(0, 3) });
      }
    }
    this.siteLawn(x0, y0, x1, y1, 0.004);
  },
  // the prison's yard as a dirt running track round a lawn with picnic tables; lawn inside the inner fence (the
  // gravel strip between the fences stays bare)
  prisonDress(q, Y) {
    const r = this.rng, W = this.W, F = this.w.floor, { x0, y0, x1, y1 } = q;
    if (Y) {
      const [yx0, yy0, yx1, yy1] = Y;
      for (let y = yy0 + 2; y <= yy1 - 2; y++) for (let x = yx0 + 2; x <= yx1 - 2; x++) { const i = y * W + x; if (F[i] === FL.DIRT && !this.w.obj[i]) { F[i] = FL.GRASS; this.w.fvar[i] = r.int(0, 3); } }
      let n = 0;
      for (let t = 0; t < 40 && n < 4; t++) {
        const x = r.int(yx0 + 4, yx1 - 14), y = r.int(yy0 + 4, yy1 - 4);
        if (F[y * W + x] === FL.GRASS && this.free(x, y) && this.free(x - 1, y) && this.free(x + 1, y) && this.free(x, y - 1) && this.free(x, y + 1)) { this.put(x, y, 'st_table', 'S', { kind: 'picnic' }); n++; }
      }
    }
    this.siteLawn(x0 + 3, y0 + 3, x1 - 2, y1 - 2, 0);
  },
});
