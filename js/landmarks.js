'use strict';
// ---------------------------------------------------------------------------
// Landmarks of the Expanded map's open country (extends MapGen): a drive-in and a cemetery south of Riverton, a
// sawmill on Route 9, a rest area on Interstate 71 and a salvage yard down County Rd 14 - places in the long empty
// stretches between the towns. Each draws from its own random numbers and is only built where its ground is clear,
// so the rest of the map comes out as before.
// ---------------------------------------------------------------------------
Object.assign(MapGen, {
  bigLandmarks() {
    const P = this.big, S = this.GW, W = this.W, F = this.w.floor;
    if (!P || !P.ix) return;
    const hard = (x, y) => { const f = F[y * W + x]; return f === FL.ASPHALT || f === FL.SIDEWALK || f === FL.WATER || f === FL.DEEPWATER || f === FL.SAND; };
    // ground that is clear: inside the map, off the county, away from every planned place, no road, water or building
    const clear = (x0, y0, x1, y1) => {
      if (x0 < 4 || y0 < 4 || x1 >= S - 4 || y1 >= S - 4 || (x0 < 406 && y0 < 406)) return false;
      if (P.boxes.some(q => x1 >= q.x0 - 3 && x0 <= q.x1 + 3 && y1 >= q.y0 - 3 && y0 <= q.y1 + 3)) return false;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (hard(x, y) || this.w.room[y * W + x] >= 0) return false;
      return true;
    };
    // the nearest place to (x0, y0) (w x h) that is clear, within 45 tiles; (dx, dy): the way it prefers to move
    // (off its road), a step that way counting as half
    const spot = (x0, y0, w, h, dx, dy) => {
      let best = null, bd = 1e9;
      for (let oy = -45; oy <= 45; oy += 3) for (let ox = -45; ox <= 45; ox += 3) {
        const d = Math.hypot(ox, oy) - (ox * dx + oy * dy) * 0.5;
        if (d >= bd || !clear(x0 + ox, y0 + oy, x0 + ox + w - 1, y0 + oy + h - 1)) continue;
        best = [x0 + ox, y0 + oy]; bd = d;
      }
      return best;
    };
    const take = (kind, name, x0, y0, x1, y1) => {
      this.clearObj(x0, y0, x1, y1); this.mark(x0 - 1, y0 - 1, x1 + 1, y1 + 1, 1);
      P.boxes.push({ kind, name, x0, y0, x1, y1 });
    };
    const { ex, sy, ix } = P, riv = P.towns.find(T => T.name === 'Riverton');
    const south = riv ? riv.y1 + 14 : sy + 60;
    let at;
    // (each a place of its own, from a stream of its own)
    if ((at = spot(ex - 98, south, 84, 66, 0, 1))) this.withRng(at[0] * 7 + at[1], () => this.driveIn(at[0], at[1], 84, 66, ex, take));
    if ((at = spot(ex + 10, south + 8, 50, 40, 0, 1))) this.withRng(at[0] * 11 + at[1], () => this.cemetery(at[0], at[1], 50, 40, ex + 4, take));
    if ((at = spot(424, 116, 52, 40, 1, 0))) this.withRng(at[0] * 13 + at[1], () => this.sawmill(at[0], at[1], 52, 40, take));
    if ((at = spot(ix - 26, Math.round(S * 0.52), 24, 28, 0, 1))) this.withRng(at[0] * 17 + at[1], () => this.restArea(at[0], at[1], 24, 28, ix, take));
    if ((at = spot(ex + 10, S - 98, 60, 48, 0, -1))) this.withRng(at[0] * 19 + at[1], () => this.salvage(at[0], at[1], 60, 48, ex + 4, take));
  },
  // a gravel drive along y from x0 to x1 (wd wide), clearing what stands in the way
  laneX(x0, x1, y, wd, f) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let j = 0; j < wd; j++) {
      if (!World.inb(x, y + j) || this.w.room[(y + j) * this.W + x] >= 0 || this.w.floor[(y + j) * this.W + x] === FL.ASPHALT) continue;
      this.sf(x, y + j, f || FL.GRAVEL, this.rng.int(0, 3)); this.w.obj[(y + j) * this.W + x] = null; this.mark(x, y + j, x, y + j, 1);
    }
  },
  laneY(y0, y1, x, wd, f) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let j = 0; j < wd; j++) {
      if (!World.inb(x + j, y) || this.w.room[y * this.W + x + j] >= 0 || this.w.floor[y * this.W + x + j] === FL.ASPHALT) continue;
      this.sf(x + j, y, f || FL.GRAVEL, this.rng.int(0, 3)); this.w.obj[y * this.W + x + j] = null; this.mark(x + j, y, x + j, y, 1);
    }
  },
  // a fence round x0..x1, y0..y1 (wall type t) with a gate (gw tiles) on side d at offset g
  fenceRing(x0, y0, x1, y1, t, d, g, gw) {
    for (let x = x0; x <= x1; x++) {
      if (!(d === 'N' && x >= g && x < g + gw)) World.setWall(x, y0, 0, t);
      if (!(d === 'S' && x >= g && x < g + gw)) World.setWall(x, y1 + 1, 0, t);
    }
    for (let y = y0; y <= y1; y++) {
      if (!(d === 'W' && y >= g && y < g + gw)) World.setWall(x0, y, 1, t);
      if (!(d === 'E' && y >= g && y < g + gw)) World.setWall(x1 + 1, y, 1, t);
    }
  },
  // The Starlite Drive-In: the screen at the north end, rows of speaker posts facing it, the cars of the last show
  // still parked, a snack bar with the projection booth in the middle, a ticket booth at the gate on County Rd 14
  driveIn(x0, y0, w, h, road, take) {
    const r = this.rng, x1 = x0 + w - 1, y1 = y0 + h - 1, name = 'Starlite Drive-In';
    take('drivein', name, x0, y0, x1, y1);
    this.fill(x0, y0, x1, y1, FL.GRAVEL, 1);
    this.fenceRing(x0, y0, x1, y1, WT.WOODFENCE, 'E', y0 + 30, 4);
    // the screen: a billboard frame wide across the north end, lights either side
    for (let x = x0 + 10; x <= x1 - 10; x += 8) this.put(x, y0 + 2, 'st_billboard', 'S', {});
    for (const x of [x0 + 4, x1 - 4]) this.put(x, y0 + 3, 'st_lotlight', 'S', {});
    // rows of speaker posts and parked cars, nose to the screen
    for (let y = y0 + 12, row = 0; y <= y1 - 6; y += 7, row++) {
      if (y >= y0 + 26 && y <= y0 + 38) continue;
      for (let x = x0 + 4; x <= x1 - 4; x += 4) {
        if (this.free(x, y)) this.put(x, y, 'st_meter', 'S', {});
        if (r.chance(0.22)) this.w.carSpots.push({ x: x + 2, y: y + 2.5, a: -Math.PI / 2, kind: r.pick(['sedan', 'wagon', 'pickup', 'hatchback', 'suv']) });
      }
    }
    // the snack bar (and the projection booth behind it, facing the screen)
    const sx = x0 + ((w - 14) >> 1), sy = y0 + 27;
    const b = this.newBuilding('restaurant', sx, sy, sx + 13, sy + 9, { wallType: WT.EXT, extCol: '#e8dcc0', roof: 'flat', roofCol: '#8a3a30', name: 'Starlite Snack Bar', front: 'S' });
    const bar = this.addRoom(b, 'restaurant', sx, sy + 4, sx + 13, sy + 9, FL.TILE, 3);
    const booth = this.addRoom(b, 'office', sx, sy, sx + 13, sy + 3, FL.CONCRETE, 1);
    this.buildWalls(b);
    this.doorBetween(bar, booth);
    this.exteriorDoor(bar, 'S', { style: 'glass', locked: r.chance(0.4), b: b.id, ext: true });
    this.exteriorDoor(booth, 'E', { style: 'metal', locked: true, b: b.id, ext: true });
    this.windows(bar, { p: 0.6, win: { b: b.id, curtains: false } });
    this.windows(booth, { p: 0.5, win: { b: b.id, curtains: false } });
    this.counterRun(bar, 8, true);
    this.place(bar, 'register'); this.place(bar, 'fridge'); this.place(bar, 'cooler');
    for (let k = 0; k < 3; k++) this.placeCenter(bar, 'table', true);
    this.place(booth, 'machine'); this.place(booth, 'shelf'); this.place(booth, 'desk'); this.place(booth, 'crate');
    for (const [x, y] of [[sx - 2, sy + 10], [sx + 15, sy + 10]]) if (this.free(x, y)) this.put(x, y, 'st_bin', 'S', {});
    // the gate: a lane from the road, the ticket booth beside it, the sign
    const gy = y0 + 30;
    this.laneX(x1 + 1, road - 1, gy, 4);
    if (this.free(x1 - 3, gy - 2)) this.put(x1 - 3, gy - 2, 'st_booth', 'E', {});
    if (this.free(x1 + 3, gy - 2)) this.put(x1 + 3, gy - 2, 'st_billboard', 'E', {});
    this.w.zones.push({ x0, y0, x1, y1, n: 14 });
    this.w.labels.push({ x: (x0 + x1) / 2, y: y0 + 8, text: name });
  },
  // Riverton Cemetery: rows of graves behind a picket fence, old trees, a gravel path through the middle, the
  // groundskeeper's shed in the corner
  cemetery(x0, y0, w, h, road, take) {
    const r = this.rng, x1 = x0 + w - 1, y1 = y0 + h - 1, name = 'Riverton Cemetery';
    take('cemetery', name, x0, y0, x1, y1);
    this.fill(x0, y0, x1, y1, FL.GRASS, 0);
    const my = (y0 + y1) >> 1;
    this.laneX(x0, x1, my, 2);
    this.laneX(road + 4, x0 - 1, my, 2);
    this.fenceRing(x0, y0, x1, y1, WT.PICKET, 'W', my, 2);
    for (let y = y0 + 2; y <= y1 - 2; y += 2) {
      if (y >= my - 1 && y <= my + 2) continue;
      for (let x = x0 + 3; x <= x1 - 10; x += 2) if (this.free(x, y) && r.chance(0.82)) this.put(x, y, 'grave', 'S', { v: r.int(0, 2) });
    }
    for (let k = 0; k < 9; k++) { const x = r.int(x0 + 1, x1 - 1), y = r.int(y0 + 1, y1 - 1); if (this.free(x, y) && Math.abs(y - my) > 2) this.put(x, y, 'tree', 'S', this.tree(x, y, r.f(1.1, 1.5), 0, r.pick(['cedar', 'oak', 'oak']))); }
    for (const x of [x0 + 8, x0 + 20, x0 + 32]) { if (this.free(x, my - 2)) this.put(x, my - 2, 'bench', 'S', {}); }
    const s = this.shed('warehouse', x1 - 8, y0 + 2, x1 - 2, y0 + 7, 'S', { name: null, extCol: '#7a6a58', roofCol: '#4a4038', doorW: 1 });
    this.place(s.rm, 'toolcab'); this.place(s.rm, 'shelf'); this.place(s.rm, 'crate');
    if (this.free(x1 - 4, y0 + 9)) this.put(x1 - 4, y0 + 9, 'yd_wheelbarrow', 'S', {});
    this.w.zones.push({ x0, y0, x1, y1, n: 6, kept: true });
    this.w.labels.push({ x: (x0 + x1) / 2, y: y0 + 4, text: name });
  },
  // Wildwood Lumber Co.: the mill (the factory's plan: saws in rows, office, lockers, break room), the log yard and
  // the stacked lumber beside it, a road in from Route 9
  sawmill(x0, y0, w, h, take) {
    const r = this.rng, x1 = x0 + w - 1, y1 = y0 + h - 1, name = 'Wildwood Lumber Co.';
    take('sawmill', name, x0, y0, x1, y1);
    this.fill(x0, y0, x1, y1, FL.DIRT, 2);
    this.factory(x0, y0, x0 + 34, y1, name);
    // the road in from Route 9
    this.laneY(109, y0 - 1, x0 + 6, 3);
    // the log yard: long piles of logs, the sawn lumber stacked on pallets, a woodpile of offcuts
    for (let y = y0 + 3; y <= y1 - 3; y += 4) for (let x = x0 + 38; x <= x1 - 3; x += 4) {
      if (!this.free(x, y)) continue;
      this.put(x, y, r.chance(0.65) ? 'tlog' : 'st_pallet', r.pick(['N', 'E']), r.chance(0.65) ? { sz: r.f(0.9, 1.3) } : {});
    }
    for (let k = 0; k < 4; k++) { const x = r.int(x0 + 36, x1 - 1), y = r.int(y0 + 1, y1 - 1); if (this.free(x, y)) this.put(x, y, 'yd_woodpile', 'S', {}); }
    this.fenceRing(x0, y0, x1, y1, WT.CHAIN, 'N', x0 + 5, 5);
    if (r.chance(0.8)) this.w.carSpots.push({ x: x0 + 41.5, y: y1 - 3.5, a: 0, kind: 'pickup' });
    this.w.zones.push({ x0, y0, x1, y1, n: 6 });
  },
  // I-71 Rest Area: restrooms and a vending lobby off a parking lot beside the southbound lanes, picnic tables under
  // the trees
  restArea(x0, y0, w, h, ix, take) {
    const r = this.rng, x1 = x0 + w - 1, y1 = y0 + h - 1, name = 'I-71 Rest Area';
    take('rest', name, x0, y0, ix - 1, y1);
    // the lot runs up to the interstate (on and off at either end)
    this.fill(x0 + 10, y0, ix - 1, y1, FL.PARKING, 0);
    for (let y = y0 + 2; y + 2 <= y1 - 1; y += 3) if (r.chance(0.35)) this.w.carSpots.push({ x: ix - 3.5, y: y + 0.5, a: r.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, kind: r.pick(['sedan', 'suv', 'van', 'wagon', 'pickup']) });
    for (const y of [y0 + 1, y1 - 1]) if (this.free(x0 + 11, y)) this.put(x0 + 11, y, 'st_lotlight', 'S', {});
    // the building: two restrooms either side of the lobby
    const bx = x0 + 1, by = y0 + ((h - 12) >> 1);
    const b = this.newBuilding('office', bx, by, bx + 7, by + 11, { wallType: WT.BRICK, roof: 'flat', roofCol: '#6a5a4a', name, front: 'E' });
    const men = this.addRoom(b, 'bathroom', bx, by, bx + 7, by + 3, FL.TILE, 1);
    const lobby = this.addRoom(b, 'office', bx, by + 4, bx + 7, by + 7, FL.LINO, 2);
    const wom = this.addRoom(b, 'bathroom', bx, by + 8, bx + 7, by + 11, FL.TILE, 1);
    this.buildWalls(b);
    this.doorBetween(men, lobby); this.doorBetween(wom, lobby);
    this.exteriorDoor(lobby, 'E', { style: 'glass', locked: false, b: b.id, ext: true });
    this.windows(lobby, { p: 0.5, win: { b: b.id, curtains: false } });
    for (const rm of [men, wom]) { this.place(rm, 'toilet'); this.place(rm, 'toilet'); this.place(rm, 'sink'); this.place(rm, 'sink'); }
    this.place(lobby, 'st_vending'); this.place(lobby, 'st_vending'); this.place(lobby, 'bench');
    // the picnic ground behind and beside it
    for (let k = 0; k < 6; k++) {
      const x = r.int(x0, x0 + 9), y = r.int(y0, y1);
      if (World.room(x, y) >= 0 || !this.free(x, y)) continue;
      if (k < 4) { this.put(x, y, 'st_table', 'S', {}); if (this.free(x, y + 1)) this.put(x, y + 1, 'bench', 'N', {}); }
      else this.put(x, y, 'tree', 'S', this.tree(x, y, 1.3, 0, 'oak'));
    }
    for (const [x, y] of [[x0 + 9, y0 + 2], [x0 + 9, y1 - 2]]) if (this.free(x, y)) this.put(x, y, 'st_bin', 'S', {});
    this.w.zones.push({ x0, y0, x1: ix - 1, y1, n: 7, kept: true });
    this.w.labels.push({ x: (x0 + ix) / 2, y: y0 - 2, text: name });
  },
  // Pruitt Salvage: rows of stripped, rusting cars inside a chain fence, tyres and parts in heaps, the yard office by
  // the gate
  salvage(x0, y0, w, h, road, take) {
    const r = this.rng, x1 = x0 + w - 1, y1 = y0 + h - 1, name = 'Pruitt Salvage';
    take('salvage', name, x0, y0, x1, y1);
    this.fill(x0, y0, x1, y1, FL.GRAVEL, 2);
    const gy = y0 + 4;
    this.fenceRing(x0, y0, x1, y1, WT.CHAIN, 'W', gy, 4);
    this.laneX(road + 4, x0 - 1, gy, 4);
    const ob = this.newBuilding('office', x0 + 2, y0 + 10, x0 + 9, y0 + 15, { wallType: WT.EXT, extCol: '#9a9a8a', roof: 'flat', roofCol: '#5a5a52', name, front: 'N' });
    const off = this.addRoom(ob, 'office', x0 + 2, y0 + 10, x0 + 9, y0 + 15, FL.CONCRETE, 1);
    this.buildWalls(ob);
    this.exteriorDoor(off, 'N', { locked: r.chance(0.5), b: ob.id, ext: true });
    this.windows(off, { p: 0.5, win: { b: ob.id, curtains: false } });
    this.place(off, 'desk'); this.place(off, 'chair'); this.place(off, 'toolcab'); this.place(off, 'shelf'); this.place(off, 'register');
    // the dead cars, in rows with lanes between (a burnt one now and then)
    const kinds = ['sedan', 'wagon', 'pickup', 'van', 'hatchback', 'suv', 'sedan', 'pickup'];
    for (let y = y0 + 5; y <= y1 - 4; y += 6) for (let x = x0 + 16; x <= x1 - 4; x += 6) {
      if (r.chance(0.2)) continue;
      if (r.chance(0.12)) { if (this.free(x, y)) this.put(x, y, 'car_wreck', 'E', { col: '#3a3430', kind: r.pick(kinds) }); continue; }
      this.w.carSpots.push({ x: x + 0.5, y: y + 0.5, a: r.chance(0.5) ? 0 : Math.PI, kind: r.pick(kinds), junk: true });
    }
    for (let k = 0; k < 14; k++) {
      const x = r.int(x0 + 1, x1 - 1), y = r.int(y0 + 1, y1 - 1);
      if (World.room(x, y) >= 0 || !this.free(x, y)) continue;
      this.put(x, y, r.pick(['yd_tires', 'st_tires', 'yd_carparts', 'yd_carparts', 'yd_junk', 'st_pallet']), r.pick(['N', 'E', 'S', 'W']), {});
    }
    this.w.carSpots.push({ x: x0 + 5.5, y: y0 + 7.5, a: 0, kind: 'pickup' });
    this.w.zones.push({ x0, y0, x1, y1, n: 5 });
    this.w.labels.push({ x: (x0 + x1) / 2, y: y0 - 2, text: name });
  },
});
