'use strict';
// ---------------------------------------------------------------------------
// Vehicles: types, spawning & condition, driving physics, part damage, tyre marks, exhaust & dust
// ---------------------------------------------------------------------------
// Geometry (len, wid, h, cab, cabH, cols, lightbar, red, bed) is shared with the car art. Physics: maxV top speed
// (tiles/s), acc launch acceleration, m mass (t), br brake deceleration, grip tyre grip, st max steering angle (rad),
// rev reverse speed, drv driven wheels (f/r/4), hd heavy-duty parts, horn class, doors, pitch engine note, fuel use.
const CAR_TYPES = {
  sedan: { n: 'Sedan', len: 2.3, wid: 1.05, h: 0.72, cab: [-0.32, 0.22], cabH: 0.52, maxV: 15, acc: 4.5, trunk: 35, cols: ['#8a2a2a', '#2a4a7a', '#d8d8d0', '#3a3a3a', '#5a6a4a', '#a08a5a', '#6a7a8a', '#7a2a5a'], m: 1.4, br: 7.5, grip: 1, st: 0.6, rev: 4.5, drv: 'f', horn: 'car', doors: 4, pitch: 1, fuel: 1 },
  pickup: { n: 'Pickup Truck', len: 2.5, wid: 1.1, h: 0.82, cab: [-0.05, 0.3], cabH: 0.58, bed: true, maxV: 14, acc: 4.2, trunk: 50, cols: ['#3a5a3a', '#7a3a2a', '#2a3a5a', '#c8c0a8', '#4a4a4a'], m: 1.9, br: 7, grip: 0.95, st: 0.55, rev: 4.5, drv: 'r', horn: 'truck', doors: 2, pitch: 0.85, fuel: 1.25 },
  van: { n: 'Van', len: 2.5, wid: 1.15, h: 0.85, cab: [-0.48, 0.36], cabH: 0.75, maxV: 12, acc: 3.5, trunk: 70, cols: ['#e0e0d8', '#3a4a6a', '#8a8a7a', '#5a3a2a'], m: 2.1, br: 6.5, grip: 0.9, st: 0.55, rev: 4, drv: 'r', horn: 'truck', doors: 4, pitch: 0.85, fuel: 1.3 },
  police: { n: 'Police Car', len: 2.35, wid: 1.05, h: 0.72, cab: [-0.32, 0.22], cabH: 0.52, maxV: 16, acc: 5, trunk: 35, cols: ['#f0f0f0'], lightbar: true, m: 1.6, br: 8, grip: 1.05, st: 0.6, rev: 5, drv: 'r', horn: 'car', doors: 4, pitch: 0.95, fuel: 1.15 },
  firetruck: { n: 'Fire Truck', len: 3.4, wid: 1.25, h: 1.05, cab: [0.18, 0.48], cabH: 0.6, maxV: 10, acc: 2.6, trunk: 60, cols: ['#c02020'], lightbar: true, red: true, m: 9, br: 5.5, grip: 0.85, st: 0.5, rev: 3.5, drv: 'r', hd: true, horn: 'bus', doors: 4, pitch: 0.6, fuel: 2 },
  hatchback: { n: 'Hatchback', len: 2.0, wid: 1.0, h: 0.7, cab: [-0.42, 0.2], cabH: 0.5, maxV: 14, acc: 4.6, trunk: 25, cols: ['#b03a2a', '#e0d8c8', '#3a5a8a', '#6a8a5a', '#d0a030', '#4a4a50', '#8a8a90'], m: 1.1, br: 7.5, grip: 1, st: 0.65, rev: 4.5, drv: 'f', horn: 'small', doors: 4, pitch: 1.2, fuel: 0.8 },
  wagon: { n: 'Station Wagon', len: 2.5, wid: 1.05, h: 0.72, cab: [-0.44, 0.22], cabH: 0.52, maxV: 14, acc: 4.0, trunk: 55, cols: ['#7a5a3a', '#4a5a4a', '#c8c0a8', '#5a2a2a', '#3a4a6a'], m: 1.6, br: 7, grip: 0.95, st: 0.58, rev: 4.5, drv: 'r', horn: 'car', doors: 4, pitch: 0.95, fuel: 1.05 },
  sports: { n: 'Sports Car', len: 2.25, wid: 1.05, h: 0.56, cab: [-0.28, 0.1], cabH: 0.4, maxV: 21, acc: 7.0, trunk: 12, cols: ['#c01818', '#e8e8e8', '#1a1a1a', '#e0b010', '#1a4ab0'], m: 1.3, br: 9, grip: 1.15, st: 0.6, rev: 5, drv: 'r', horn: 'car', doors: 2, pitch: 1.3, fuel: 1.4 },
  suv: { n: 'SUV', len: 2.45, wid: 1.12, h: 0.86, cab: [-0.46, 0.24], cabH: 0.6, maxV: 14, acc: 4.3, trunk: 55, cols: ['#2a2a2a', '#5a6a5a', '#8a2a2a', '#c8c8c0', '#2a3a5a', '#6a5a4a'], m: 2.0, br: 7, grip: 0.95, st: 0.55, rev: 4.5, drv: '4', horn: 'truck', doors: 4, pitch: 0.85, fuel: 1.3 },
  taxi: { n: 'Taxi', len: 2.35, wid: 1.05, h: 0.72, cab: [-0.32, 0.22], cabH: 0.52, maxV: 15, acc: 4.5, trunk: 35, cols: ['#e8c020'], m: 1.5, br: 7.5, grip: 1, st: 0.6, rev: 4.5, drv: 'r', horn: 'car', doors: 4, pitch: 1, fuel: 1.05 },
  ambulance: { n: 'Ambulance', len: 2.9, wid: 1.2, h: 1.0, cab: [0.12, 0.44], cabH: 0.5, maxV: 13, acc: 3.4, trunk: 45, cols: ['#f0f0ec'], lightbar: true, m: 3.2, br: 6.5, grip: 0.9, st: 0.52, rev: 4, drv: 'r', hd: true, horn: 'truck', doors: 4, pitch: 0.75, fuel: 1.6 },
  bus: { n: 'School Bus', len: 4.6, wid: 1.25, h: 1.15, cab: [-0.48, 0.46], cabH: 0.45, maxV: 9, acc: 2.0, trunk: 30, cols: ['#e8b020'], m: 10, br: 5, grip: 0.85, st: 0.5, rev: 3, drv: 'r', hd: true, horn: 'bus', doors: 4, pitch: 0.55, fuel: 1.8 },
  army: { n: 'Military Truck', len: 3.1, wid: 1.25, h: 1.0, cab: [0.2, 0.48], cabH: 0.55, maxV: 12, acc: 3.0, trunk: 80, cols: ['#4a5a3a'], m: 6, br: 6, grip: 0.95, st: 0.5, rev: 4, drv: '4', hd: true, horn: 'truck', doors: 2, pitch: 0.65, fuel: 1.7 },
};
// Vehicle parts. grp: mechanics window group; item: part item (heavy-duty vehicles use item + 'HD' unless noHD);
// tools/sk/t: tools, Mechanics level and seconds to (un)install; bay: needs the hood open; under: needs a jack;
// w: weight in the overall condition; f/s: where on the car it sits (front/back, left/right) for the mechanic.
// Conditions are 0-100, -1 when the part is missing. The driver sits front-left (local s < 0).
const CAR_PARTS = {
  engine: { n: 'Engine', grp: 'Engine bay', bay: true, w: 4, fixed: true, f: 0.9 },
  battery: { n: 'Battery', grp: 'Engine bay', item: 'CarBattery', tools: ['wrench'], sk: 0, t: 5, bay: true, w: 0.5, f: 0.9, s: 0.4 },
  muffler: { n: 'Muffler', grp: 'Engine bay', item: 'Muffler', tools: ['wrench', 'jack'], sk: 2, t: 10, under: true, w: 0.4, f: -0.9, s: 0.5 },
  brakes: { n: 'Brakes', grp: 'Wheels and brakes', item: 'BrakePads', tools: ['wrench', 'jack'], sk: 2, t: 10, under: true, w: 1, f: 0.6, s: -1 },
  suspension: { n: 'Suspension', grp: 'Wheels and brakes', item: 'Suspension', tools: ['wrench', 'jack'], sk: 3, t: 14, under: true, w: 1, f: -0.6, s: -1 },
  tireFL: { n: 'Front-left tire', grp: 'Wheels and brakes', item: 'Tire', tools: ['lugwrench', 'jack'], sk: 0, t: 7, w: 0.4, tire: true, f: 0.66, s: -1 },
  tireFR: { n: 'Front-right tire', grp: 'Wheels and brakes', item: 'Tire', tools: ['lugwrench', 'jack'], sk: 0, t: 7, w: 0.4, tire: true, f: 0.66, s: 1 },
  tireRL: { n: 'Rear-left tire', grp: 'Wheels and brakes', item: 'Tire', tools: ['lugwrench', 'jack'], sk: 0, t: 7, w: 0.4, tire: true, f: -0.6, s: -1 },
  tireRR: { n: 'Rear-right tire', grp: 'Wheels and brakes', item: 'Tire', tools: ['lugwrench', 'jack'], sk: 0, t: 7, w: 0.4, tire: true, f: -0.6, s: 1 },
  hood: { n: 'Hood', grp: 'Body', item: 'CarHood', tools: ['wrench'], sk: 2, t: 8, w: 0.6, f: 1 },
  trunkLid: { n: 'Trunk lid', grp: 'Body', item: 'TrunkLid', tools: ['wrench'], sk: 2, t: 8, w: 0.5, f: -1 },
  doorFL: { n: 'Driver door', grp: 'Body', item: 'CarDoor', tools: ['wrench'], sk: 2, t: 10, w: 0.5, door: 1, f: 0.25, s: -1 },
  doorFR: { n: 'Passenger door', grp: 'Body', item: 'CarDoor', tools: ['wrench'], sk: 2, t: 10, w: 0.5, door: 2, f: 0.25, s: 1 },
  doorRL: { n: 'Rear-left door', grp: 'Body', item: 'CarDoor', tools: ['wrench'], sk: 2, t: 10, w: 0.5, door: 4, rear: true, f: -0.3, s: -1 },
  doorRR: { n: 'Rear-right door', grp: 'Body', item: 'CarDoor', tools: ['wrench'], sk: 2, t: 10, w: 0.5, door: 8, rear: true, f: -0.3, s: 1 },
  gasTank: { n: 'Gas tank', grp: 'Body', item: 'GasTank', tools: ['wrench', 'jack'], sk: 3, t: 12, under: true, w: 0.8, f: -0.6, s: 1 },
  windshield: { n: 'Windshield', grp: 'Windows', item: 'Windshield', tools: ['screwdriver'], sk: 2, t: 10, w: 0.3, glass: true, f: 0.8 },
  rearWindow: { n: 'Rear window', grp: 'Windows', item: 'Windshield', tools: ['screwdriver'], sk: 2, t: 10, w: 0.2, glass: true, f: -0.8 },
  winFL: { n: 'Driver window', grp: 'Windows', item: 'CarWindow', tools: ['screwdriver'], sk: 1, t: 6, w: 0.15, glass: true, f: 0.25, s: -1 },
  winFR: { n: 'Passenger window', grp: 'Windows', item: 'CarWindow', tools: ['screwdriver'], sk: 1, t: 6, w: 0.15, glass: true, f: 0.25, s: 1 },
  winRL: { n: 'Rear-left window', grp: 'Windows', item: 'CarWindow', tools: ['screwdriver'], sk: 1, t: 6, w: 0.15, glass: true, f: -0.3, s: -1 },
  winRR: { n: 'Rear-right window', grp: 'Windows', item: 'CarWindow', tools: ['screwdriver'], sk: 1, t: 6, w: 0.15, glass: true, f: -0.3, s: 1 },
  lightFL: { n: 'Left headlight', grp: 'Lights', item: 'Headlight', tools: ['screwdriver'], sk: 0, t: 4, w: 0.1, light: true, noHD: true, f: 1, s: -0.7 },
  lightFR: { n: 'Right headlight', grp: 'Lights', item: 'Headlight', tools: ['screwdriver'], sk: 0, t: 4, w: 0.1, light: true, noHD: true, f: 1, s: 0.7 },
  lightRL: { n: 'Left taillight', grp: 'Lights', item: 'Taillight', tools: ['screwdriver'], sk: 0, t: 4, w: 0.1, light: true, noHD: true, f: -1, s: -0.7 },
  lightRR: { n: 'Right taillight', grp: 'Lights', item: 'Taillight', tools: ['screwdriver'], sk: 0, t: 4, w: 0.1, light: true, noHD: true, f: -1, s: 0.7 },
};
const PART_KEYS = Object.keys(CAR_PARTS);
const CAR_TIRES = ['tireFL', 'tireFR', 'tireRL', 'tireRR'];
const CAR_GLASS = ['windshield', 'rearWindow', 'winFL', 'winFR', 'winRL', 'winRR'];
// parts a crash into each side of the car hurts, with relative weight
const ZONE_PARTS = {
  front: [['hood', 1], ['lightFL', 0.9], ['lightFR', 0.9], ['engine', 0.55], ['windshield', 0.45], ['battery', 0.35], ['suspension', 0.3], ['tireFL', 0.25], ['tireFR', 0.25], ['brakes', 0.15]],
  rear: [['trunkLid', 1], ['lightRL', 0.9], ['lightRR', 0.9], ['muffler', 0.7], ['gasTank', 0.55], ['rearWindow', 0.45], ['tireRL', 0.25], ['tireRR', 0.25], ['suspension', 0.2]],
  left: [['doorFL', 1], ['doorRL', 1], ['winFL', 0.75], ['winRL', 0.75], ['tireFL', 0.45], ['tireRL', 0.45], ['suspension', 0.25]],
  right: [['doorFR', 1], ['doorRR', 1], ['winFR', 0.75], ['winRR', 0.75], ['tireFR', 0.45], ['tireRR', 0.45], ['suspension', 0.25]],
};
// what a zombie bounced off each side of a moving car damages
const ZHIT_PARTS = {
  front: [['hood', 1], ['lightFL', 0.35], ['lightFR', 0.35], ['windshield', 0.3], ['engine', 0.05]],
  rear: [['trunkLid', 1], ['lightRL', 0.35], ['lightRR', 0.35], ['rearWindow', 0.2]],
  left: [['doorFL', 1], ['doorRL', 0.8], ['winFL', 0.25], ['winRL', 0.25]],
  right: [['doorFR', 1], ['doorRR', 0.8], ['winFR', 0.25], ['winRR', 0.25]],
};
const GRIP_G = 13;                         // sideways tyre force on dry asphalt, tiles/s²
const CAR_GEARS = [0.24, 0.46, 0.72, 1.01]; // top of each gear as a fraction of top speed
const MARK_N = 4096;                        // tyre mark ring buffer size (segments)
const MK_SKID = 0, MK_SNOW = 1, MK_MUD = 2;
let _carId = 1;
const Vehicles = {
  typeName(c) { return (CAR_TYPES[c.type] || CAR_TYPES.sedan).n; },
  // transient per-car state (wheel mark points, timers) kept off the car so saves stay compact
  _tmp: new WeakMap(),
  tmp(c) {
    let t = this._tmp.get(c);
    if (!t) { t = { wp: new Float32Array(8), wk: [-1, -1, -1, -1], puff: 0, dust: 0, steam: 0, crank: 0, door: 0, smokeT: 0, slip: 0, rpm: 0.15, th: 0, leakT: 0, stallT: 0 }; this._tmp.set(c, t); }
    return t;
  },
  // rear doors of two-door vehicles don't exist: they are never damaged, removed or shown
  hasSlot(c, k) { return !(CAR_PARTS[k].rear && (CAR_TYPES[c.type] || CAR_TYPES.sedan).doors === 2); },
  partItem(c, k) { const d = CAR_PARTS[k]; return d.item ? d.item + ((CAR_TYPES[c.type] || {}).hd && ITEMS[d.item + 'HD'] ? 'HD' : '') : null; },
  // ------------------------------------------------------------------ normalising (old saves, spawning)
  ensure(c) {
    if (c.parts && c.dmg && c.charge !== undefined && c.doorOpen !== undefined && c.eq !== undefined) return c;
    if (!CAR_TYPES[c.type]) c.type = 'sedan';
    const T = CAR_TYPES[c.type];
    if (!c.parts) {
      // older saves only knew a single hp value: spread it over the parts
      const hp = c.hp === undefined ? 70 : c.hp, rng = new RNG((c.id || 1) * 7919 + 13);
      c.parts = {};
      for (const k of PART_KEYS) c.parts[k] = Math.round(U.clamp(hp + rng.f(-15, 10), 0, 100));
      if (c.winBroken) c.parts.winFL = 0;
      c.dmg = { front: U.clamp((55 - hp) / 70, 0, 0.75), rear: 0, left: 0, right: 0 };
      // old saves rolled alarms far too often (1 in 5): thin them out to the sandbox rate
      if (c.alarm && !c.alarmDone) c.alarm = rng.f(0, 1) < this.alarmChance() / 0.2;
    }
    for (const k of PART_KEYS) if (typeof c.parts[k] !== 'number') c.parts[k] = 80;
    if (!c.dmg) c.dmg = { front: 0, rear: 0, left: 0, right: 0 };
    if (c.doorOpen === undefined) c.doorOpen = 0;
    if (c.hoodOpen === undefined) c.hoodOpen = false;
    if (c.trunkOpen === undefined) c.trunkOpen = false;
    if (c.charge === undefined) c.charge = 0.9;
    // engine quality (0-100, fixed per vehicle): power, top speed, how readily it starts, how loud it runs
    if (c.eq === undefined) { const base = { sports: 84, police: 80, army: 80, ambulance: 74, firetruck: 74, suv: 70, pickup: 70, taxi: 60, van: 60, bus: 55 }[c.type] || 64; c.eq = Math.round(U.clamp(base + new RNG((c.id || 1) * 104729 + 7).f(-24, 18), 15, 100)); }
    if (typeof c.v !== 'number') c.v = 0;
    if (typeof c.vs !== 'number') c.vs = 0;
    if (typeof c.steer !== 'number') c.steer = 0;
    c.steer = U.clamp(c.steer, -1, 1);
    if (c.lightSw === undefined) c.lightSw = !!c.lightsOn;
    if (c.burnt === undefined) c.burnt = false;
    c.braking = !!c.braking; c.rev = !!c.rev;
    if (typeof c.gas !== 'number') c.gas = 0.3;
    if (!c.trunk) c.trunk = { type: 'trunk', cap: T.trunk, items: null };
    if (!c.glove) c.glove = { type: 'glovebox', cap: 5, items: null };
    this.recalc(c);
    return c;
  },
  ensureAll() { if (this._ens !== G.cars) { for (const c of G.cars) this.ensure(c); this._ens = G.cars; } },
  // overall condition (c.hp) and the derived flags other modules read
  recalc(c) {
    const P = c.parts;
    let s = 0, ws = 0;
    for (const k of PART_KEYS) { if (!this.hasSlot(c, k)) continue; const w = CAR_PARTS[k].w; s += Math.max(0, P[k]) * w; ws += w; }
    c.hp = Math.round(s / ws);
    c.winBroken = CAR_GLASS.some(k => P[k] <= 0);
    c.lightK = this.lightLevel(c);
    c.lightsOn = c.lightK > 0.05;
  },
  // headlight output 0..1: switch, bulbs, and battery when the engine is off
  lightLevel(c) {
    if (!c.lightSw || c.burnt) return 0;
    const P = c.parts, n = (P.lightFL > 0 ? 1 : 0) + (P.lightFR > 0 ? 1 : 0);
    if (!n || P.battery < 0) return 0;
    const pow = c.engine ? 1 : U.clamp((c.charge - 0.02) * 5, 0, 1);
    return pow * (n === 2 ? 1 : 0.6);
  },
  hurtPart(c, k, d) {
    const P = c.parts, b = P[k];
    if (b === undefined || b <= 0 || d <= 0 || !this.hasSlot(c, k)) return;
    const v = Math.max(0, b - d);
    P[k] = Math.round(v * 10) / 10;
    const def = CAR_PARTS[k];
    if (def.glass && v <= 0) this.glassBreak(c, k);
    else if (def.light && v <= 0) { const [x, y] = this.partPos(c, k); Fx.shards(x, y, 0.5, 5, def.f > 0 ? 'rgba(240,240,220,0.9)' : 'rgba(220,40,30,0.9)'); Sfx.play('lightBreak', x, y); }
    else if (def.tire && b > 10 && v <= 10) { const [x, y] = this.partPos(c, k); Sfx.play('tireBurst', x, y); Noise.emit(x, y, 12, 'crash'); if (G.player && G.player.inCar === c) Player.say('A tire blew out!', '#f99'); }
  },
  glassBreak(c, k) {
    const [x, y] = this.partPos(c, k);
    Sfx.play('glass', x, y);
    Noise.emit(x, y, 18, 'glass');
    Fx.shards(x, y, 0.9, 10, 'rgba(180,220,240,0.9)');
    this.soundAlarm(c);
    c.winBroken = true;
  },
  damageZone(c, zone, amt, tbl) {
    for (const [k, w] of (tbl || ZONE_PARTS)[zone]) this.hurtPart(c, k, amt * w * R.f(0.55, 1.25));
    if (!tbl) c.dmg[zone] = Math.min(1, Math.round((c.dmg[zone] + amt / 110) * 100) / 100);
    this.recalc(c);
    if (c.engine && c.parts.engine <= 0) this.stall(c, 'The engine died.');
  },
  // world position of a part (where a mechanic would stand next to it is one step further out)
  partPos(c, k, out) {
    const T = CAR_TYPES[c.type], d = CAR_PARTS[k];
    const f = (d.f || 0) * T.len / 2 + (out ? Math.sign(d.f || 0) * (d.s ? 0 : 0.7) : 0);
    const s = (d.s || 0) * T.wid / 2 + (out ? Math.sign(d.s || 0) * 0.65 : 0);
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    return [c.x + f * ca - s * sa, c.y + f * sa + s * ca];
  },
  // ------------------------------------------------------------------ spawning
  spawnAll() {
    G.cars = [];
    this.active = null;
    this._ens = G.cars;
    this.marksReset();
    const spots = Wd.carSpots.slice();
    this.commercial = this.commerceGrid();
    for (const sp of this.specialSpots()) spots.unshift(sp);
    for (const sp of spots) {
      const type = sp.kind && CAR_TYPES[sp.kind] ? sp.kind : this.pickType(sp);
      const c = this.mk(type, sp.x, sp.y, sp.a);
      if (this.overlapsCar(c, 0.35)) continue;
      this.condition(c, sp);
      G.cars.push(c);
      this.placeKey(c, sp);
    }
  },
  mk(type, x, y, a) {
    const T = CAR_TYPES[type];
    const c = {
      id: _carId++, type, x, y, a, v: 0, vs: 0, steer: 0,
      col: R.pick(T.cols), gas: R.f(0.05, 0.75), hp: 100,
      locked: R.chance(0.65), keyIn: R.chance(0.08), engine: false, lightsOn: false, lightSw: false, winBroken: false,
      alarm: R.chance(this.alarmChance()), trunkOpen: false, hoodOpen: false, doorOpen: 0, braking: false, rev: false, burnt: false, charge: R.f(0.55, 1),
      parts: {}, dmg: { front: 0, rear: 0, left: 0, right: 0 },
      trunk: { type: 'trunk', cap: T.trunk, items: null }, glove: { type: 'glovebox', cap: 5, items: null },
    };
    for (const k of PART_KEYS) c.parts[k] = 100;
    return c;
  },
  // sandbox 'Car alarms' setting (probability a parked car has one)
  alarmChance() { const v = G.sb && G.sb.carAlarms; return typeof v === 'number' ? U.clamp(v, 0, 1) : 0.03; },
  soundAlarm(c) {
    if (!c.alarm || c.alarmDone || c.engine || c.burnt || !G.alarms) return;
    c.alarmDone = true;
    G.alarms.push({ x: c.x, y: c.y, t: 25, pulse: 0, car: true });
    if (G.player && U.dist(G.player.x, G.player.y, c.x, c.y) < 12) Player.say('Car alarm!', '#f99');
  },
  // which kind of car is parked here
  pickType(sp) {
    if (sp.driveway !== undefined) return R.weighted([['sedan', 5], ['hatchback', 3], ['wagon', 2.5], ['suv', 3], ['pickup', 2.5], ['van', 1.2], ['sports', 0.35]]);
    if (sp.jam) return R.weighted([['sedan', 5], ['hatchback', 2.5], ['wagon', 3], ['suv', 3.5], ['pickup', 3], ['van', 2.5], ['sports', 0.5], ['taxi', 0.4], ['police', 0.3]]);
    if (this.downtown(sp.x, sp.y)) return R.weighted([['sedan', 5], ['hatchback', 3.5], ['taxi', 2.2], ['suv', 2], ['van', 2], ['pickup', 1.5], ['wagon', 1.2], ['sports', 0.6], ['police', 0.35]]);
    return R.weighted([['sedan', 5], ['pickup', 3.5], ['suv', 2.5], ['hatchback', 2.2], ['wagon', 1.8], ['van', 1.6], ['sports', 0.45], ['police', 0.25]]);
  },
  // coarse 8x8-tile grid of where shops and offices are (downtown gets taxis)
  commerceGrid() {
    const gw = Math.ceil((Wd.gw || Wd.w) / 8), gh = Math.ceil(Wd.h / 8), g = new Uint8Array(gw * gh);
    const shop = { grocery: 1, hardware: 1, pharmacy: 1, diner: 1, restaurant: 1, laundromat: 1, bookstore: 1, office: 1, clothing: 1, bar: 1, gunstore: 1, clinic: 1, police: 1, bank: 1 };
    for (const b of Wd.buildings) {
      if (!shop[b.type]) continue;
      for (let y = Math.max(0, ((b.y0 - 12) >> 3)); y <= Math.min(gh - 1, (b.y1 + 12) >> 3); y++) for (let x = Math.max(0, (b.x0 - 12) >> 3); x <= Math.min(gw - 1, (b.x1 + 12) >> 3); x++) g[y * gw + x] = 1;
    }
    return { g, gw };
  },
  downtown(x, y) { const C = this.commercial; return !!(C && x >= 0 && y >= 0 && C.g[(y >> 3) * C.gw + (x >> 3)]); },
  // story vehicles: an ambulance at the clinic, the school bus, cruisers at the station, army trucks at the roadblocks
  specialSpots() {
    const out = [];
    // the street pass may already have put one there
    const near = (kind, b, d) => Wd.carSpots.some(sp => sp.kind === kind && sp.x > b.x0 - d && sp.x < b.x1 + d && sp.y > b.y0 - d && sp.y < b.y1 + d);
    for (const b of Wd.buildings) {
      if (b.type === 'clinic' || b.type === 'hospital') { if (!near('ambulance', b, 14)) { const s = this.curbSpot(b, 'ambulance', out); if (s) out.push(s); } }
      else if (b.type === 'school') { if (!near('bus', b, 16)) { const s = this.curbSpot(b, 'bus', out); if (s) out.push(s); } }
      else if (b.type === 'police') { for (let k = near('police', b, 12) ? 1 : R.int(1, 2); k > 0; k--) { const s = this.curbSpot(b, 'police', out); if (s) out.push(s); } }
    }
    for (const z of Wd.zones || []) {
      if (z.outfit !== 'military') continue;
      const have = Wd.carSpots.filter(sp => sp.kind === 'army' && sp.x >= z.x0 - 6 && sp.x <= z.x1 + 6 && sp.y >= z.y0 - 6 && sp.y <= z.y1 + 6).length;
      const want = (z.x0 > 200 ? 2 : 1) - have;
      if (want > 0) for (const s of this.laneSpots(z, 'army', want, out)) out.push(s);
    }
    return out;
  },
  // first road lane in front of a building, parked at the curb on the right-hand side
  curbSpot(b, kind, taken) {
    const T = CAR_TYPES[kind], W_ = Wd.w;
    const fronts = [b.front || 'S'].concat(['N', 'S', 'E', 'W'].filter(f => f !== b.front));
    for (const fr of fronts) {
      const D = DIRV[fr];
      if (!D) continue;
      const horiz = D[0] === 0;
      for (let dist = 1; dist <= 9; dist++) {
        const line = horiz ? (D[1] < 0 ? b.y0 - dist : b.y1 + dist) : (D[0] < 0 ? b.x0 - dist : b.x1 + dist);
        const a0 = horiz ? b.x0 - 6 : b.y0 - 6, a1 = horiz ? b.x1 + 6 : b.y1 + 6;
        let n = 0;
        for (let t = a0; t <= a1; t++) { const x = horiz ? t : line, y = horiz ? line : t; if (World.inb(x, y) && Wd.floor[y * W_ + x] === FL.ASPHALT) n++; }
        if (n < T.len + 2) { if (n) break; continue; }
        // a run along the lane, nearest the middle of the building first
        const mid = horiz ? (b.x0 + b.x1) / 2 : (b.y0 + b.y1) / 2;
        const cand = [];
        for (let t = a0; t <= a1; t++) cand.push(t);
        cand.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
        const ang = Math.atan2(D[0], -D[1]); // curb on the right
        const off = 0.5 - D[horiz ? 1 : 0] * Math.max(0.2, (T.wid - 1) / 2 + 0.12);
        for (const t of cand) {
          const sp = horiz ? { x: t + 0.5, y: line + off, a: ang, kind } : { x: line + off, y: t + 0.5, a: ang, kind };
          if (this.canPlace(sp, T, taken, true)) return sp;
        }
        break;
      }
    }
    return null;
  },
  // vehicles on the outer lanes of a road crossing a zone (keeps the middle lanes open)
  laneSpots(z, kind, n, taken) {
    const T = CAR_TYPES[kind], out = [];
    const cand = [];
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) {
      if (!World.inb(x, y) || Wd.floor[y * Wd.w + x] !== FL.ASPHALT) continue;
      // horizontal road: outer lane rows face grass/forest on one side
      const up = World.floor(x, y - 1) === FL.ASPHALT, dn = World.floor(x, y + 1) === FL.ASPHALT;
      if (up !== dn) cand.push({ x: x + 0.5, y: y + (up ? 0.25 : 0.75), a: up ? 0 : Math.PI, kind });
    }
    R.shuffle(cand);
    for (const sp of cand) {
      if (out.length >= n) break;
      if (out.some(o => Math.abs(o.x - sp.x) < 5)) continue;
      if (this.canPlace(sp, T, taken.concat(out), true)) out.push(sp);
    }
    return out;
  },
  // footprint of a vehicle at spot sp is clear ground, outdoors, away from walls, doors and other vehicles
  canPlace(sp, T, taken, hard) {
    const ca = Math.cos(sp.a), sa = Math.sin(sp.a);
    const hl = T.len / 2 + 0.2, hw = T.wid / 2 + 0.15;
    for (let f = -hl; f <= hl + 0.01; f += 0.45) for (let s = -hw; s <= hw + 0.01; s += 0.45) {
      const x = sp.x + f * ca - s * sa, y = sp.y + f * sa + s * ca, tx = Math.floor(x), ty = Math.floor(y);
      if (!World.inb(tx, ty) || tx >= (Wd.gw || Wd.w) || World.tileSolid(tx, ty) || World.room(tx, ty) >= 0 || World.obj(tx, ty)) return false;
      const fl = Wd.floor[ty * Wd.w + tx];
      if (hard && fl !== FL.ASPHALT && fl !== FL.PARKING && fl !== FL.CONCRETE) return false;
      if (Wd.deco[ty * Wd.w + tx] === 3 || Wd.deco[ty * Wd.w + tx] === 4) return false; // crosswalks
      for (const [dx, dy] of DIR4) if (World.room(tx + dx, ty + dy) >= 0) return false;
      if (Math.abs(f) > 0.3 && !World.lineClear(sp.x, sp.y, x, y, 'move')) return false;
    }
    const probe = { type: null, x: sp.x, y: sp.y, a: sp.a };
    for (const o of taken) if (U.dist(o.x, o.y, sp.x, sp.y) < (T.len + CAR_TYPES[o.kind || 'sedan'].len) / 2 + 0.8) return false;
    for (const o of Wd.carSpots) if (U.dist(o.x, o.y, sp.x, sp.y) < T.len / 2 + 2) return false;
    void probe;
    return true;
  },
  // oriented boxes overlap (pad grows both)
  obbHit(a, b, pad) {
    const Ta = CAR_TYPES[a.type], Tb = CAR_TYPES[b.type];
    const ax = [Math.cos(a.a), Math.sin(a.a)], ay = [-ax[1], ax[0]], bx = [Math.cos(b.a), Math.sin(b.a)], by = [-bx[1], bx[0]];
    const ea = [Ta.len / 2 + pad, Ta.wid / 2 + pad], eb = [Tb.len / 2 + pad, Tb.wid / 2 + pad];
    const d = [b.x - a.x, b.y - a.y];
    for (const n of [ax, ay, bx, by]) {
      const ra = ea[0] * Math.abs(ax[0] * n[0] + ax[1] * n[1]) + ea[1] * Math.abs(ay[0] * n[0] + ay[1] * n[1]);
      const rb = eb[0] * Math.abs(bx[0] * n[0] + bx[1] * n[1]) + eb[1] * Math.abs(by[0] * n[0] + by[1] * n[1]);
      if (Math.abs(d[0] * n[0] + d[1] * n[1]) > ra + rb) return false;
    }
    return true;
  },
  overlapsCar(c, pad) { for (const o of G.cars) if (o !== c && Math.abs(o.x - c.x) < 7 && Math.abs(o.y - c.y) < 7 && this.obbHit(c, o, pad)) return true; return false; },
  // state of a freshly spawned car: wear, defects, crash damage, abandoned in a jam, burnt out
  condition(c, sp) {
    const P = c.parts, T = CAR_TYPES[c.type];
    const spread = (base, lo, hi) => { for (const k of PART_KEYS) P[k] = Math.round(U.clamp(base + R.f(lo, hi), 1, 100)); };
    if (sp.burnt) {
      c.burnt = true; c.col = Col.mix(c.col, '#2a2624', 0.82);
      for (const k of PART_KEYS) P[k] = (CAR_PARTS[k].glass || CAR_PARTS[k].tire || CAR_PARTS[k].light) ? -1 : 0;
      c.gas = 0; c.charge = 0; c.locked = false; c.keyIn = false; c.alarm = false;
      c.dmg = { front: R.f(0.2, 0.6), rear: R.f(0.1, 0.4), left: R.f(0, 0.3), right: R.f(0, 0.3) };
      c.doorOpen = R.chance(0.5) ? 1 : 0;
      c.trunk.items = [];
      this.recalc(c);
      return;
    }
    const special = sp.kind && ['ambulance', 'bus', 'army', 'police', 'firetruck'].includes(sp.kind);
    if (sp.crashed) {
      spread(R.f(30, 60), -15, 10);
      const zone = R.chance(0.7) ? 'front' : R.pick(['rear', 'left', 'right']);
      this.damageZone(c, zone, R.f(35, 75));
      if (R.chance(0.35)) this.damageZone(c, R.pick(['left', 'right']), R.f(10, 35));
      c.gas = R.f(0, 0.2); c.keyIn = R.chance(0.3); c.locked = R.chance(0.3);
      if (R.chance(0.3)) c.doorOpen = 1;
      c.charge = R.f(0, 0.6);
      if (zone === 'front') Wd.decals.push({ x: c.x + Math.cos(c.a) * T.len * 0.3 - 0.5, y: c.y + Math.sin(c.a) * T.len * 0.3 - 0.5, k: 'oil', v: R.int(0, 3), age: 0, s: R.f(0.8, 1.3) });
    } else if (sp.jam) {
      spread(R.f(55, 90), -15, 10);
      if (R.chance(0.3)) this.damageZone(c, R.chance(0.6) ? 'rear' : 'front', R.f(8, 30));
      c.gas = R.f(0.05, 0.5); c.keyIn = R.chance(0.45); c.locked = !c.keyIn && R.chance(0.25);
      if (R.chance(0.35)) c.doorOpen |= 1;
      if (R.chance(0.15)) c.doorOpen |= R.pick([2, 4, 8]);
      if (R.chance(0.2)) c.trunkOpen = true;
      c.loot = 'car_jam';
    } else if (sp.driveway !== undefined) {
      spread(R.f(60, 100), -12, 8);
      c.gas = R.f(0.12, 0.9); c.locked = R.chance(0.75);
    } else if (special) {
      spread(R.f(55, 95), -10, 8);
      c.gas = R.f(0.25, 0.95); c.keyIn = R.chance(sp.kind === 'army' ? 0.5 : sp.kind === 'ambulance' ? 0.4 : 0.2); c.locked = !c.keyIn && R.chance(0.5);
    } else {
      spread(R.f(45, 100), -15, 10);
    }
    // the odd defect anywhere: flats, smashed glass, dead or missing batteries, scavenged wheels
    if (R.chance(0.08)) P[R.pick(CAR_TIRES)] = R.int(0, 10);
    if (R.chance(0.025)) P[R.pick(CAR_TIRES)] = -1;
    if (R.chance(0.06)) P[R.pick(['winFL', 'winFR', 'winRL', 'winRR'])] = 0;
    if (R.chance(0.05)) P[R.pick(['lightFL', 'lightFR', 'lightRL', 'lightRR'])] = 0;
    if (R.chance(0.16)) c.charge = R.f(0, 0.05);
    if (R.chance(0.03)) P.battery = -1;
    if (R.chance(0.3)) c.gas = Math.min(c.gas, R.f(0.01, 0.12));
    if (!this.hasSlot(c, 'doorRL')) { P.doorRL = 100; P.doorRR = 100; c.doorOpen &= 3; }
    if (c.keyIn) c.locked = false;
    if (sp.kind && (sp.kind === 'police' || sp.kind === 'ambulance' || sp.kind === 'army' || sp.kind === 'firetruck' || sp.kind === 'bus')) c.loot = 'car_' + sp.kind;
    this.recalc(c);
  },
  placeKey(c, sp) {
    if (c.keyIn || c.burnt) return;
    const T = CAR_TYPES[c.type];
    const key = Items.make('CarKey', { set: { keyId: c.id, keyName: 'Key for a ' + T.n.toLowerCase() + ' (' + this.colName(c.col) + ')' } });
    if (sp.driveway !== undefined) {
      const b = Wd.buildings[sp.driveway];
      const rm = b && b.rooms.map(r => Wd.rooms[r]).find(r => r.type === 'kitchen' || r.type === 'living');
      let placed = false;
      if (rm) for (let y = rm.y0; y <= rm.y1 && !placed; y++) for (let x = rm.x0; x <= rm.x1 && !placed; x++) {
        const o = World.obj(x, y);
        if (o && o.c && (o.t === 'counter' || o.t === 'dresser')) { World.contItems(o, x, y); o.c.items.push(key); placed = true; }
      }
    } else if (R.chance(sp.jam ? 0.65 : 0.5)) {
      const zs = Zombie.near(c.x, c.y, 25).filter(z => !z.carKey);
      if (zs.length) R.pick(zs).carKey = key;
    }
  },
  // name of any paint colour, by hue / lightness
  colName(hex) {
    const c = Col.rgb(hex || '#808080');
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (s < 0.14 || d < 0.06) return l > 0.82 ? 'white' : l > 0.62 ? 'silver' : l > 0.36 ? 'grey' : l > 0.17 ? 'dark grey' : 'black';
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    if (h < 14 || h >= 340) return l < 0.3 ? 'maroon' : 'red';
    if (h < 42) return l < 0.38 ? 'brown' : s < 0.45 && l > 0.5 ? 'beige' : 'orange';
    if (h < 66) return l < 0.32 ? 'olive' : s < 0.4 ? 'tan' : 'yellow';
    if (h < 160) return l < 0.25 ? 'dark green' : 'green';
    if (h < 195) return 'teal';
    if (h < 255) return l < 0.28 ? 'navy' : 'blue';
    if (h < 290) return 'purple';
    return l < 0.35 ? 'plum' : 'pink';
  },
  hasKey(c) { return c.keyIn || c.hotwired || !!Player.find(it => it.id === 'CarKey' && it.keyId === c.id); },
  canHotwire() { return Player.hasTrait('burglar') || (Player.skill('Electrical') >= 1 && Player.skill('Mechanics') >= 2); },
  // can the player get at the inside of a locked car (smashed glass or a door gone)
  reachIn(c) { return !c.locked || this.hasKey(c) || c.winBroken || ['doorFL', 'doorFR', 'doorRL', 'doorRR'].some(k => this.hasSlot(c, k) && c.parts[k] < 0); },
  // local coordinates of point relative to car
  local(c, x, y) { const dx = x - c.x, dy = y - c.y, ca = Math.cos(c.a), sa = Math.sin(c.a); return [dx * ca + dy * sa, -dx * sa + dy * ca]; },
  pushOut(e, r) {
    const cars = this.active || G.cars, inCar = G.player && e === G.player ? G.player.inCar : null;
    for (let k = 0; k < cars.length; k++) {
      const c = cars[k];
      if (inCar === c) continue;
      const dx = e.x - c.x, dy = e.y - c.y;
      if (dx > 3 || dx < -3 || dy > 3 || dy < -3) continue;
      const T = CAR_TYPES[c.type];
      // this.local() inlined (runs for every walker every step)
      const ca = Math.cos(c.a), sa = Math.sin(c.a), f = dx * ca + dy * sa, s = -dx * sa + dy * ca;
      const hl = T.len / 2 + r, hw = T.wid / 2 + r;
      if (Math.abs(f) < hl && Math.abs(s) < hw) {
        const pf = hl - Math.abs(f), ps = hw - Math.abs(s);
        let nf = f, ns = s;
        if (pf < ps) nf = Math.sign(f || 1) * hl; else ns = Math.sign(s || 1) * hw;
        e.x = c.x + nf * ca - ns * sa; e.y = c.y + nf * sa + ns * ca;
        World.resolve(e, r);
      }
    }
  },
  // ------------------------------------------------------------------ getting in & out, doors, engine
  enter(c) {
    const p = G.player;
    this.ensure(c);
    if (c.burnt) { Player.say("It's a burnt-out wreck.", '#ccc'); return; }
    if (c.locked && !this.reachIn(c)) { Player.say("It's locked.", '#ccc'); Sfx.play('locked'); return; }
    if (this.hasKey(c)) c.locked = false;
    Actions.cancel();
    p.inCar = c; p.path = null;
    p.x = c.x; p.y = c.y;
    this.doorAnim(c, 1);
    Sfx.play('carDoorOpen', c.x, c.y);
    if (this.hasKey(c)) UI.hint('W/S: accelerate/brake · A/D: steer · Space: handbrake · Q: horn · F: headlights · E: exit');
    else UI.hint(this.canHotwire() ? 'No key. Right-click > Hotwire to start the engine.' : 'No key for this car. Find it, or learn to hotwire (Electrical 1 + Mechanics 2, or Burglar).');
    if (c.parts.battery > 0 && c.charge < 0.06) UI.hint('The battery is dead. A charged battery, or a running engine, is needed.');
    this.tryStart(c, true);
  },
  exit(c, force) {
    const p = G.player;
    if (Math.abs(c.v) > 2 && !force) { Player.say('Too fast to get out!', '#ccc'); return; }
    const T = CAR_TYPES[c.type];
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    for (const side of [-1, 1]) {
      const s = side * (T.wid / 2 + 0.45), f = 0.2;
      const x = c.x + f * ca - s * sa, y = c.y + f * sa + s * ca;
      if (World.inb(x | 0, y | 0) && !World.tileSolid(x | 0, y | 0) && World.lineClear(c.x, c.y, x, y, 'move')) { p.x = x; p.y = y; break; }
      p.x = x; p.y = y;
    }
    p.inCar = null;
    c.v = force ? c.v : 0;
    if (!force) c.vs = 0;
    c.braking = false; c.rev = false; c.steer *= 0.5;
    World.resolve(p, p.r);
    this.doorAnim(c, 1);
    Sfx.play('carDoorClose', c.x, c.y);
    Sfx.screech(0); Sfx.engine(null);
  },
  // a door swings open briefly as someone climbs in or out
  doorAnim(c, bit) { const tm = this.tmp(c); if (!(c.doorOpen & bit)) { c.doorOpen |= bit; tm.door = 0.65; tm.doorBit = bit; } },
  toggleDoor(c, k) {
    this.ensure(c);
    const d = CAR_PARTS[k];
    if (!d || !d.door || c.parts[k] < 0) return;
    if (!(c.doorOpen & d.door)) {
      if (c.locked && !this.reachIn(c)) { Player.say("It's locked.", '#ccc'); Sfx.play('locked', c.x, c.y); return; }
      if (this.hasKey(c)) c.locked = false;
      c.doorOpen |= d.door; Sfx.play('carDoorOpen', c.x, c.y);
    } else { c.doorOpen &= ~d.door; Sfx.play('carDoorClose', c.x, c.y); }
    const tm = this.tmp(c); if (tm.doorBit === d.door) tm.door = 0;
    Noise.emit(c.x, c.y, 5, 'door');
  },
  toggleHood(c) {
    this.ensure(c);
    if (c.parts.hood < 0) return;
    if (!c.hoodOpen && c.locked && !this.reachIn(c)) { Player.say('The hood release is inside the car.', '#ccc'); return; }
    c.hoodOpen = !c.hoodOpen;
    Sfx.play(c.hoodOpen ? 'hoodOpen' : 'hoodClose', c.x, c.y);
    Noise.emit(c.x, c.y, 5, 'door');
  },
  toggleLights(c) { this.ensure(c); c.lightSw = !c.lightSw; Sfx.play('switch'); this.recalc(c); },
  horn(c) {
    this.ensure(c);
    if (c.parts.battery <= 0 || c.charge < 0.02) { Sfx.play('switch'); return; }
    Noise.emit(c.x, c.y, 40, 'horn');
    Sfx.play({ small: 'hornSmall', truck: 'hornTruck', bus: 'hornBus' }[CAR_TYPES[c.type].horn] || 'horn', c.x, c.y);
    c.charge = Math.max(0, c.charge - 0.002);
  },
  tryStart(c, quiet) {
    this.ensure(c);
    if (c.engine || this.tmp(c).crank > 0) return;
    if (c.burnt) { if (!quiet) Player.say("It's a burnt-out wreck. Nothing works.", '#ccc'); return; }
    if (this.hasKey(c)) { this.startEngine(c); return; }
    if (quiet) return;
    if (this.canHotwire()) Actions.queue(Actions.hotwire(c));
    else Player.say("I don't have the key and can't hotwire it.", '#ccc');
  },
  // turn the starter: needs a battery with charge; whether it catches depends on the engine, fuel and cold
  startEngine(c) {
    this.ensure(c);
    const P = c.parts, tm = this.tmp(c);
    if (c.engine || tm.crank > 0) return;
    if (c.burnt) return;
    if (P.battery <= 0 || c.charge < 0.06) {
      Sfx.play('crankDead', c.x, c.y);
      if (G.player && G.player.inCar === c) Player.say(P.battery < 0 ? 'There is no battery.' : P.battery === 0 ? 'The battery is ruined.' : 'Click... click... The battery is dead.', '#ccc');
      return;
    }
    tm.crank = R.f(0.6, 1.1) + (P.engine < 40 ? R.f(0.3, 0.9) : 0) + (G.weather && G.weather.temp < 0 ? 0.4 : 0);
    c.charge = Math.max(0, c.charge - 0.025);
    Sfx.play('crank', c.x, c.y);
    Noise.emit(c.x, c.y, 10, 'engine');
  },
  finishCrank(c) {
    const P = c.parts;
    let p = P.engine <= 0 ? 0 : P.engine >= 65 ? 0.97 : 0.2 + P.engine / 100 * 1.15;
    p -= (1 - (c.eq === undefined ? 64 : c.eq) / 100) * 0.18;   // a poor engine is fussier to start
    if (G.weather && G.weather.temp < 0) p -= 0.15;
    if (c.charge < 0.25) p -= 0.25;
    const noGas = c.gas <= 0.001 || P.gasTank < 0;
    if (noGas) p = 0;
    if (R.chance(p)) {
      c.engine = true; this.tmp(c).stallT = 0;
      Sfx.play('engineStart', c.x, c.y);
      Noise.emit(c.x, c.y, 20, 'engine');
      this.recalc(c);
    } else {
      Sfx.play('crankFail', c.x, c.y);
      if (G.player && G.player.inCar === c) Player.say(noGas ? (P.gasTank < 0 ? 'There is no gas tank.' : 'Out of gas.') : P.engine <= 0 ? 'The engine is wrecked.' : "It won't start...", '#ccc');
    }
  },
  stall(c, msg) {
    if (!c.engine) return;
    c.engine = false; c.siren = false;
    Sfx.play('stall', c.x, c.y);
    if (msg && G.player && G.player.inCar === c) Player.say(msg, '#f99');
    this.recalc(c);
  },
  stopEngine(c) { if (!c.engine) return; c.engine = false; c.siren = false; Sfx.play('engineOff', c.x, c.y); this.recalc(c); },
  smashWindow(c, k) {
    this.ensure(c);
    if (!k) {
      // the intact window nearest to the player
      const p = G.player;
      let best = null, bd = 1e9;
      for (const w of CAR_GLASS) { if (c.parts[w] <= 0) continue; const [x, y] = this.partPos(c, w); const d = U.dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = w; } }
      k = best;
    }
    if (!k || c.parts[k] <= 0) return;
    c.parts[k] = 0;
    c.locked = false;
    this.glassBreak(c, k);
    this.recalc(c);
    const p = G.player;
    if (p && !Player.weaponDef() && !Player.worn('gloves') && R.chance(0.45)) Player.addWound(R.pick(['HandL', 'HandR']), 'cut', { isZombie: false });
  },
  // a zombie beats on the car: glass on that side gives way, and through an open side it reaches the driver
  zombieHit(c, z) {
    this.ensure(c);
    const T = CAR_TYPES[c.type], P = c.parts;
    const [f, s] = this.local(c, z.x, z.y);
    let win, door = null;
    if (f > T.len * 0.4) win = 'windshield';
    else if (f < -T.len * 0.4) win = 'rearWindow';
    else {
      const front = f > -T.len * 0.05 || !this.hasSlot(c, 'doorRL');
      win = s < 0 ? (front ? 'winFL' : 'winRL') : (front ? 'winFR' : 'winRR');
      door = s < 0 ? (front ? 'doorFL' : 'doorRL') : (front ? 'doorFR' : 'doorRR');
    }
    Sfx.play('thumpMetal', c.x, c.y);
    if (P[win] > 0) this.hurtPart(c, win, R.f(1.5, 5));
    else if (door) this.hurtPart(c, door, R.f(0.2, 0.8));
    this.recalc(c);
    const open = P[win] <= 0 || (door && (P[door] < 0 || (c.doorOpen & CAR_PARTS[door].door)));
    if (!open || !G.player || G.player.inCar !== c) return;
    const reach = { winFL: 0.4, doorFL: 0.4, windshield: 0.22, winFR: 0.15, winRL: 0.15 }[win] || 0.06;
    if (R.chance(door && (c.doorOpen & CAR_PARTS[door].door) ? Math.max(reach, 0.3) : reach)) Player.zombieAttack(z);
  },
  // ------------------------------------------------------------------ driving
  driveInput(c, dt) {
    const p = G.player;
    this.ensure(c);
    const tm = this.tmp(c);
    if (Input.hit('e')) { this.exit(c); return; }
    if (Input.hit('f')) this.toggleLights(c);
    if (Input.hit('q')) this.horn(c);
    const typing = typeof UI !== 'undefined' && UI.typing;
    const W = !typing && Input.down('w'), S = !typing && Input.down('s'), A = !typing && Input.down('a'), D = !typing && Input.down('d'), HB = !typing && Input.down(' ');
    if ((W || S) && !c.engine) { if (!c.triedStart) { c.triedStart = true; this.tryStart(c); } }
    else c.triedStart = false;
    // steering wheel: slower at speed, self-centring when let go
    const st = (D ? 1 : 0) - (A ? 1 : 0), sp = Math.abs(c.v);
    const rate = st ? Math.max(1.3, 3.4 - sp * 0.13) : 4.5;
    c.steer += U.clamp(st - c.steer, -rate * dt, rate * dt);
    if (c.doorOpen && sp > 4) { c.doorOpen = 0; Sfx.play('carDoorClose', c.x, c.y); }
    this.sim(c, dt, { th: W ? 1 : 0, br: S ? 1 : 0, hb: HB });
    tm.th = W ? 1 : 0;
    p.x = c.x; p.y = c.y; p.angle = c.a;
    // fuel
    if (c.engine) {
      const T = CAR_TYPES[c.type];
      c.gas -= (Math.abs(c.v) * 0.00011 * (W ? 1.15 : 0.7) + 0.000012) * T.fuel * dt;
      if (c.gas <= 0) { c.gas = 0; this.stall(c, 'Out of gas!'); }
      c.noiseT = (c.noiseT || 0) - dt;
      if (c.noiseT <= 0) { c.noiseT = 1; Noise.emit(c.x, c.y, (12 + Math.abs(c.v) * 0.8) * (c.parts.muffler < 0 ? 1.8 : c.parts.muffler < 25 ? 1.35 : 1) * (1.2 - 0.25 * (c.eq === undefined ? 64 : c.eq) / 100), 'engine'); }
    }
  },
  // physics step for one car. inp {th, br, hb} from the driver, or null for a car nobody drives (handbrake on)
  sim(c, dt, inp) {
    const T = CAR_TYPES[c.type], P = c.parts, tm = this.tmp(c);
    const sf = this.surface(c.x, c.y);
    // tyres: worn, flat (pulls to its side and drags) or bare rims
    let tg = 0, flat = 0, pull = 0;
    for (const k of CAR_TIRES) {
      const v = P[k];
      tg += v < 0 ? 0.35 : v <= 10 ? 0.55 : 0.85 + v * 0.0015;
      if (v <= 10) { flat++; pull += CAR_PARTS[k].s * (v < 0 ? 1.4 : 1); }
    }
    tg /= 4;
    const susp = P.suspension > 0 ? P.suspension / 100 : 0;
    const grip = GRIP_G * T.grip * sf.grip * tg * (0.72 + 0.28 * susp) * (T.drv === '4' && sf.soft ? 1.15 : 1);
    const eng = c.engine && c.gas > 0;
    const ek = Math.max(0, P.engine) / 100;
    const eq = (c.eq === undefined ? 64 : c.eq) / 100;
    const engK = eng ? (0.3 + 0.7 * Math.pow(ek, 0.7)) * (0.78 + 0.32 * eq) : 0;
    const vmax = T.maxV * (0.6 + 0.4 * ek) * (1 - flat * 0.12) * (0.9 + 0.15 * eq);
    const brK = P.brakes < 0 ? 0.12 : 0.25 + 0.75 * Math.max(0, P.brakes) / 100;
    const L = T.len * 0.62, rb = T.len * 0.3;          // wheelbase; centre ahead of the rear axle
    const th = inp ? inp.th : 0, bk = inp ? inp.br : 0, hb = inp ? !!inp.hb : true;
    const inert = 1 / Math.sqrt(T.m);                    // heavier vehicles answer the wheel slower
    let vf = c.v, vr = c.vs || 0, w = tm.w || 0;
    const speed = Math.sqrt(vf * vf + vr * vr);
    const steps = Math.max(1, Math.ceil((speed + Math.abs(w) * T.len * 0.5) * dt / 0.15));
    const h = dt / steps;
    // gear changes: a short dip in drive while the clutch is in
    if (eng && th > 0 && vf > 0) {
      const r = vf / T.maxV;
      let g = 0; while (g < 3 && r > CAR_GEARS[g]) g++;
      if (g > (tm.gear || 0)) tm.shiftT = T.m > 3 ? 0.32 : c.type === 'sports' ? 0.12 : 0.2;
      tm.gear = g;
    } else if (vf < 1) tm.gear = 0;
    if (tm.shiftT > 0) tm.shiftT -= dt;
    let braking = false, locked = false, spin = false, slide = 0, brUse = 0;
    for (let k = 0; k < steps; k++) {
      const ox = c.x, oy = c.y, oa = c.a;
      // ---- along the car: engine, brakes, rolling resistance, air drag
      const drag = 0.004 * vf * vf;
      let acc = 0, dec = sf.roll * (1 + flat * 0.7) + drag;
      if (eng && th > 0 && vf > -0.4) {
        // engine force tapers toward top speed; it also covers road-and-air losses so top speed is reached on asphalt
        const r = Math.max(0, vf) / vmax;
        let a = (T.acc * engK * Math.max(0, 1 - Math.pow(r, 2.2)) + (r < 1 ? (0.3 + drag) * Math.min(1, (1 - r) * 40) : 0)) * th;
        if (tm.shiftT > 0) a *= 0.3;
        const tract = grip * (T.drv === '4' ? 0.95 : 0.6);
        if (a > tract) { spin = true; a = tract + (a - tract) * 0.25; }
        acc += a;
      } else if (eng && bk > 0 && vf < 0.4) acc -= (T.acc * 0.55 * engK * Math.max(0, 1 - Math.pow(Math.max(0, -vf) / T.rev, 2)) + (vf < 0 ? 0.3 : 0)) * bk;
      let bd = 0;
      if (bk > 0 && (vf > 0.4 || !eng)) bd = T.br * brK * bk;
      if (th > 0 && vf < -0.4) bd = Math.max(bd, T.br * brK * th);
      if (bd > 0) { braking = true; if (bd > grip * 1.05) { locked = true; bd = grip * 0.85; } dec += bd; brUse = Math.max(brUse, Math.min(1, bd / grip)); }
      if (hb) dec += grip * 0.42 + (inp ? 0 : 4);
      else if (eng && !th && !bk) dec += 0.7 * engK;      // engine braking
      vf += acc * h;
      const dd = dec * h;
      if (Math.abs(vf) <= dd) vf = 0; else vf -= Math.sign(vf) * dd;
      // ---- yaw: bicycle model about the rear axle. Front tyres can only turn the car as hard as their grip allows
      // (braking uses up part of it: understeer); a locked front axle hardly steers at all.
      const sMax = T.st * (1 / (1 + Math.abs(vf) * 0.045));
      let wt = vf / L * Math.tan(c.steer * sMax);
      const ice = sf.kind === 'snow' || sf.grip < 0.45;
      const gF = grip * (locked && !hb ? 0.25 : Math.sqrt(Math.max(0.12, 1 - brUse * brUse * 0.75))) * (ice ? 1.3 : 1);
      const av = Math.max(0.5, Math.abs(vf));
      if (Math.abs(wt) * av > gF) wt = Math.sign(wt) * gF / av;
      if (hb && inp && Math.abs(vf) > 2) wt += c.steer * Math.min(Math.abs(vf), 10) * 0.16 * Math.sign(vf);
      if (flat) wt += pull * vf * 0.018;
      w += (wt - w) * Math.min(1, h * 14 * inert);
      const da = w * h;
      c.a = U.normAng(c.a + da);
      // the velocity keeps its world direction while the body turns; the rear tyres then pull it round
      const cs = Math.cos(da), sn = Math.sin(da);
      const nf = vf * cs + vr * sn; vr = -vf * sn + vr * cs; vf = nf;
      // rear grip: lighter under braking, gone with the handbrake, broken loose by too much power (RWD)
      let gR = grip * (hb ? 0.32 : 1) * (locked ? 0.7 : 1) * (1 - brUse * 0.18);
      if (spin && T.drv === 'r') gR *= 0.65;
      if (ice) gR *= 0.62;
      const lat = gR * h;
      if (Math.abs(vr) <= lat) vr = 0; else vr -= Math.sign(vr) * lat;
      // sliding also scrubs speed
      if (Math.abs(vr) > 0.5) vf -= Math.sign(vf) * Math.min(Math.abs(vf), Math.abs(vr) * 0.6 * h);
      if (Math.abs(vr) > slide) slide = Math.abs(vr);
      // ---- move & collide (the centre also swings sideways as the body yaws about the rear axle)
      const ca = Math.cos(c.a), sa = Math.sin(c.a), vs = vr + w * rb;
      c.x += (vf * ca - vs * sa) * h; c.y += (vf * sa + vs * ca) * h;
      const hit = this.collides(c, ox, oy, oa);
      if (hit) {
        c.x = ox; c.y = oy; c.a = oa;
        const r = this.impact(c, hit, vf, vr);
        vf = r[0]; vr = r[1]; w *= 0.3;
        break;
      }
      // zombies in the way
      const zsp = Math.sqrt(vf * vf + vr * vr);
      if (zsp > 0.3) {
        for (const z of Zombie.near(c.x, c.y, T.len / 2 + 0.6)) {
          if (z.dead) continue;
          const [f, s] = this.local(c, z.x, z.y);
          if (Math.abs(f) < T.len / 2 + z.r && Math.abs(s) < T.wid / 2 + z.r) {
            if (zsp > 2.5) {
              Zombie.hit(z, zsp * 0.22, Math.atan2(vf * sa + vr * ca, vf * ca - vr * sa), { knock: true });
              const zone = f > T.len * 0.25 ? 'front' : f < -T.len * 0.25 ? 'rear' : (s < 0 ? 'left' : 'right');
              this.damageZone(c, zone, zsp * 0.2, ZHIT_PARTS);
              if (zone === 'front') c.dmg.front = Math.min(1, Math.round((c.dmg.front + zsp * 0.0015) * 1000) / 1000);
              if (zone === 'front' && zsp > 9 && R.chance(0.35)) this.hurtPart(c, 'windshield', R.f(8, 30));
              const k2 = 1 - 0.12 * Math.min(1, 1.4 / T.m);
              vf *= k2; vr *= k2;
              Sfx.play('carHit', z.x, z.y);
              if (zone === 'front' && zsp > 5) Fx.blood(z.x, z.y, 6, c.a);
            }
            this.pushOut(z, z.r);
          }
        }
      }
    }
    if (Math.abs(vf) < 0.02 && Math.abs(vr) < 0.02) w = 0;
    c.v = vf; c.vs = vr; tm.w = w;
    c.braking = !!inp && braking && Math.abs(vf) > 0.05;
    c.rev = vf < -0.2 || (!!inp && bk > 0 && vf < 0.4 && eng);
    tm.slip = slide; tm.locked = locked && Math.abs(vf) > 1.5; tm.spin = spin; tm.hb = hb && !!inp && Math.abs(vf) > 1.5; tm.sf = sf; tm.inp = !!inp;
  },
  // ground under a point: grip and rolling resistance, with rain and snow
  surface(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    const fl = World.inb(tx, ty) ? Wd.floor[ty * Wd.w + tx] : FL.GRASS;
    let grip = 1, roll = 0.3, soft = false, hard = true, kind = 'road';
    switch (fl) {
      case FL.GRAVEL: grip = 0.75; roll = 0.7; soft = true; hard = false; kind = 'gravel'; break;
      case FL.DIRT: grip = 0.7; roll = 0.9; soft = true; hard = false; kind = 'dirt'; break;
      case FL.SAND: grip = 0.55; roll = 2.2; soft = true; hard = false; kind = 'sand'; break;
      case FL.GRASS: case FL.GRASS2: grip = 0.62; roll = 1.3; soft = true; hard = false; kind = 'grass'; break;
      case FL.FOREST: grip = 0.55; roll = 1.8; soft = true; hard = false; kind = 'grass'; break;
      case FL.FURROW: grip = 0.5; roll = 2.6; soft = true; hard = false; kind = 'dirt'; break;
      case FL.BURNT: grip = 0.8; roll = 0.8; hard = false; kind = 'dirt'; break;
      default: break;
    }
    const w = G.weather || {}, out = World.room(tx, ty) < 0;
    let wet = 0;
    if (out && (w.rain || 0) > 0.08 && (w.temp === undefined || w.temp > 1)) { wet = w.rain; grip *= soft ? 1 - 0.3 * wet : 1 - 0.22 * wet; }
    const snow = out ? (Season.snow || 0) : 0;
    if (snow > 0.3) { grip = Math.min(grip, 0.17 + (1 - snow) * 0.45); roll += snow * 0.35; kind = 'snow'; }
    else if (out && (w.temp !== undefined && w.temp < 0) && wet > 0.05) grip = Math.min(grip, 0.3);
    return { grip, roll, soft, hard, kind, wet, fl };
  },
  // sample points on the outline of a vehicle type (spaced under a tile so nothing slips between them)
  samples(T) {
    if (T._cs) return T._cs;
    const nf = Math.max(3, Math.ceil(T.len / 0.9) + 1), out = [];
    for (let i = 0; i < nf; i++) { const f = -T.len / 2 + T.len * i / (nf - 1); out.push([f, -T.wid / 2], [f, T.wid / 2]); }
    out.push([T.len / 2, 0], [-T.len / 2, 0]);
    T._cs = out;
    return out;
  },
  corners(c) {
    const T = CAR_TYPES[c.type];
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    return this.samples(T).map(([f, s]) => [c.x + f * ca - s * sa, c.y + f * sa + s * ca]);
  },
  // first contact after a move from (ox, oy, oa): {f, s} local point on this car, o the other car; or null
  collides(c, ox, oy, oa) {
    const T = CAR_TYPES[c.type], S = this.samples(T);
    const ca = Math.cos(c.a), sa = Math.sin(c.a), cb = Math.cos(oa), sb = Math.sin(oa);
    const n = S.length;
    for (let i = 0; i < n; i++) {
      const f = S[i][0], s = S[i][1];
      const x = c.x + f * ca - s * sa, y = c.y + f * sa + s * ca;
      const tx = Math.floor(x), ty = Math.floor(y);
      if (!World.inb(tx, ty) || tx >= (Wd.gw || Wd.w)) return { f, s };
      if (World.tileSolid(tx, ty)) {
        const o = World.obj(tx, ty);
        if (!(o && (o.t === 'bush' || o.t === 'crop'))) return { f, s };
      }
      if (!World.lineClear(ox + f * cb - s * sb, oy + f * sb + s * cb, x, y, 'move')) return { f, s };
    }
    // walls crossing the body between the sample points
    const p = (f, s) => [c.x + f * ca - s * sa, c.y + f * sa + s * ca];
    const a0 = p(-T.len / 2, -T.wid / 2), a1 = p(T.len / 2, T.wid / 2), b0 = p(-T.len / 2, T.wid / 2), b1 = p(T.len / 2, -T.wid / 2);
    if (!World.lineClear(a0[0], a0[1], a1[0], a1[1], 'move') || !World.lineClear(b0[0], b0[1], b1[0], b1[1], 'move')) {
      const mv = this.local(c, c.x + (c.x - ox), c.y + (c.y - oy));
      return Math.abs(mv[0]) >= Math.abs(mv[1]) ? { f: Math.sign(mv[0] || 1) * T.len / 2, s: 0 } : { f: 0, s: Math.sign(mv[1] || 1) * T.wid / 2 };
    }
    for (const o of G.cars) {
      if (o === c) continue;
      const To = CAR_TYPES[o.type];
      if (Math.abs(o.x - c.x) > (T.len + To.len) / 2 + 0.5 || Math.abs(o.y - c.y) > (T.len + To.len) / 2 + 0.5) continue;
      for (let i = 0; i < n; i++) {
        const f = S[i][0], s = S[i][1];
        const [lf, ls] = this.local(o, c.x + f * ca - s * sa, c.y + f * sa + s * ca);
        if (Math.abs(lf) < To.len / 2 && Math.abs(ls) < To.wid / 2) return { f, s, o };
      }
      // the other car's corner poking into this one's side
      const So = this.samples(To), co = Math.cos(o.a), so = Math.sin(o.a);
      for (const [f, s] of So) {
        const [lf, ls] = this.local(c, o.x + f * co - s * so, o.y + f * so + s * co);
        if (Math.abs(lf) < T.len / 2 && Math.abs(ls) < T.wid / 2) return { f: lf, s: ls, o };
      }
    }
    return null;
  },
  // bounce off whatever was hit; returns the new [forward, sideways] speed
  impact(c, hit, vf, vr) {
    const T = CAR_TYPES[c.type];
    const fr = hit.f / (T.len / 2);
    let zone, imp;
    if (fr > 0.55) { zone = 'front'; imp = Math.max(0, vf); }
    else if (fr < -0.55) { zone = 'rear'; imp = Math.max(0, -vf); }
    else { zone = hit.s < 0 ? 'left' : 'right'; imp = Math.abs(vr) + Math.abs(vf) * 0.25; }
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    const Vx = vf * ca - vr * sa, Vy = vf * sa + vr * ca;
    if (hit.o) {
      // momentum shared between the two (restitution 0.2), both take damage at the contact point
      const o = hit.o, To = CAR_TYPES[o.type];
      this.ensure(o);
      const m1 = T.m, m2 = To.m, k1 = (m1 - 0.2 * m2) / (m1 + m2), k2 = m1 * 1.2 / (m1 + m2);
      const co = Math.cos(o.a), so = Math.sin(o.a);
      const ovx = o.v * co - (o.vs || 0) * so, ovy = o.v * so + (o.vs || 0) * co;
      const rel = Math.sqrt((Vx - ovx) * (Vx - ovx) + (Vy - ovy) * (Vy - ovy));
      o.v += (Vx * co + Vy * so) * k2; o.vs = (o.vs || 0) + (-Vx * so + Vy * co) * k2;
      if (zone === 'front' || zone === 'rear') { vf *= k1; vr *= 0.7; } else { vr *= k1; vf *= 0.8; }
      imp = Math.min(imp, rel);
      if (imp > 2.4) {
        const cx = c.x + hit.f * ca - hit.s * sa, cy = c.y + hit.f * sa + hit.s * ca;
        const [lf, ls] = this.local(o, cx, cy), fo = lf / (To.len / 2);
        const oz = fo > 0.55 ? 'front' : fo < -0.55 ? 'rear' : (ls < 0 ? 'left' : 'right');
        this.crash(o, oz, imp * Math.min(1.5, Math.sqrt(m1 / m2)), true);
        this.soundAlarm(o);
      }
    } else if (zone === 'front' || zone === 'rear') { vf = -vf * 0.18; vr *= 0.6; } else { vr = -vr * 0.2; vf *= 0.75; }
    if (imp > 2.4) this.crash(c, zone, imp * (hit.o ? Math.min(1.5, Math.sqrt(CAR_TYPES[hit.o.type].m / T.m)) : 1), false);
    else if (imp > 1.2) Sfx.play('thumpMetal', c.x, c.y);
    return [vf, vr];
  },
  crash(c, zone, imp, passive) {
    const T = CAR_TYPES[c.type];
    this.damageZone(c, zone, (imp - 2.2) * 5);
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    const zf = { front: [T.len / 2, 0], rear: [-T.len / 2, 0], left: [0, -T.wid / 2], right: [0, T.wid / 2] }[zone];
    const x = c.x + zf[0] * ca - zf[1] * sa, y = c.y + zf[0] * sa + zf[1] * ca;
    if (!passive) {
      Sfx.play(imp > 7 ? 'crunch' : 'crash', x, y);
      Noise.emit(x, y, 15 + imp, 'crash');
    }
    Fx.shards(x, y, 0.5, Math.min(14, 3 + imp | 0), '#ffd060');
    if (imp > 5) Fx.shards(x, y, 0.6, 6, Col.shade(c.col, 0.8));
    if (imp > 8) this.tmp(c).smokeT = 20;
    const p = G.player;
    if (p && p.inCar === c && !p.dead) {
      // heavier vehicles protect their driver better
      const ip = imp * Math.sqrt(1.4 / Math.max(1.4, T.m));
      if (ip > 9) {
        Player.addWound(R.pick(['Head', 'TorsoUpper', 'ForeArmL', 'ForeArmR']), ip > 13 ? 'cut' : 'scratch', { isZombie: false });
        if (ip > 13 && R.chance(0.3)) Player.fracture(R.chance(0.5) ? ARM_PARTS : LEG_PARTS);
      }
      if (ip > 5) p.hurtFlash = Math.max(p.hurtFlash || 0, 0.5);
    }
  },
  // ------------------------------------------------------------------ per-step systems for every car
  update(dt) {
    const p = G.player;
    this.ensureAll();
    // cars near the player are the only ones that can matter for collisions this step
    this.activeT = (this.activeT || 0) - dt;
    if (this.activeT <= 0 || !this.active) {
      this.activeT = 1;
      const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
      this.active = G.cars.filter(c => Math.abs(c.x - px) < 75 && Math.abs(c.y - py) < 75);
    }
    // sirens wail for miles and pull every zombie that hears them
    let siren = null, sd = 1e9;
    for (const c of G.cars) {
      if (!c.siren) continue;
      if (!c.engine || c.gas <= 0) { c.siren = false; continue; }
      c.sirenT = (c.sirenT || 0) - dt;
      if (c.sirenT <= 0) { c.sirenT = 2; Noise.emit(c.x, c.y, 60, 'alarm'); }
      const d = U.dist(c.x, c.y, p.inCar ? p.inCar.x : vxOf(p.x), p.inCar ? p.inCar.y : p.y);
      if (d < sd) { sd = d; siren = c; }
    }
    Sfx.siren(siren);
    const gm = dt * MIN_PER_SEC;
    const w = G.weather || {};
    // rain washes marks away, falling snow covers them
    if ((w.rain || 0) > 0.05) { if ((w.temp || 10) > 1) this.wash += w.rain * gm; else this.cover += w.rain * gm; }
    const rdt = dt / Math.max(1, G.speed);
    this.updatePuffs(rdt);
    let screech = 0, sx = 0, sy = 0;
    for (const c of G.cars) {
      const tm = this.tmp(c);
      const mine = p && p.inCar === c;
      if (!mine) {
        if (Math.abs(c.v) > 0.01 || Math.abs(c.vs || 0) > 0.01) this.sim(c, dt, null);
        else { c.braking = false; c.rev = false; }
        if (c.engine && c.gas > 0) { c.gas -= 0.00001 * dt; c.noiseT = (c.noiseT || 0) - dt; if (c.noiseT <= 0) { c.noiseT = 1.5; Noise.emit(c.x, c.y, 10, 'engine'); } }
        if (c.engine && c.gas <= 0) this.stall(c);
      }
      this.systems(c, dt, gm, tm, mine);
      // effects only where someone can see them
      if (Math.abs(c.x - Render.cam.x) < 40 && Math.abs(c.y - Render.cam.y) < 40) {
        this.effects(c, tm, dt, rdt);
        if (tm.scr > screech) { screech = tm.scr; sx = c.x; sy = c.y; }
      }
    }
    Sfx.screech(screech, sx, sy);
    if (p && p.inCar) { const c = p.inCar, tm = this.tmp(c); Sfx.engine(c.engine || tm.crank > 0 ? c : null, tm.rpm, tm.th); }
    else Sfx.engine(null);
    if (typeof Mechanics !== 'undefined' && Mechanics.tick) Mechanics.tick(rdt);
  },
  // battery, lights, leaks, stalling, starter, door swings
  systems(c, dt, gm, tm, mine) {
    const P = c.parts, T = CAR_TYPES[c.type];
    if (tm.crank > 0) { tm.crank -= dt; if (tm.crank <= 0) { tm.crank = 0; this.finishCrank(c); } }
    if (tm.door > 0) { tm.door -= dt; if (tm.door <= 0) { c.doorOpen &= ~tm.doorBit; Sfx.play('carDoorClose', c.x, c.y); } }
    if (c.engine) {
      // alternator charges the battery up to what the battery's condition can hold
      const cap = P.battery > 0 ? 0.35 + 0.65 * P.battery / 100 : 0;
      if (c.charge < cap) c.charge = Math.min(cap, c.charge + 0.012 * gm);
      if (P.engine <= 0) this.stall(c, 'The engine died.');
      else if (P.engine < 30 && Math.abs(c.v) < 3) {
        // a worn-out engine stalls at idle
        tm.stallT += dt;
        if (tm.stallT > 1) { tm.stallT = 0; if (R.chance(0.004 + (30 - P.engine) / 30 * 0.03)) this.stall(c, 'The engine stalled.'); }
      }
      if (c.parts.gasTank < 0) this.stall(c, 'The engine sputtered out.');
    } else if (c.lightSw && c.charge > 0) {
      c.charge = Math.max(0, c.charge - 0.0012 * gm);
    }
    // a holed gas tank leaks
    if (P.gasTank >= 0 && P.gasTank < 30 && c.gas > 0) {
      c.gas = Math.max(0, c.gas - (30 - P.gasTank) / 30 * 0.0016 * gm);
      tm.leakT += gm;
      if (tm.leakT > 40 && G.player && U.dist(G.player.x, G.player.y, c.x, c.y) < 30) { tm.leakT = 0; this.puddle(c, 'fuel'); }
    } else if (P.gasTank < 0 && c.gas > 0) { c.gas = 0; this.puddle(c, 'fuel'); }
    // a smashed-up engine drips oil
    if (c.engine && P.engine < 25) { tm.oilT = (tm.oilT || 0) + gm; if (tm.oilT > 25) { tm.oilT = 0; this.puddle(c, 'oil'); } }
    if (tm.smokeT > 0) tm.smokeT -= dt;
    // gears for the engine note
    const r = Math.abs(c.v) / T.maxV;
    let g = 0; while (g < 3 && r > CAR_GEARS[g]) g++;
    const lo = g ? CAR_GEARS[g - 1] : 0, inG = U.clamp((r - lo) / (CAR_GEARS[g] - lo), 0, 1);
    const want = !c.engine ? 0 : (mine && tm.th && (tm.spin || r < 0.05)) ? 0.75 : 0.16 + 0.8 * (0.25 + 0.75 * inG) * (mine && tm.th ? 1 : 0.8) * (r > 0.02 ? 1 : 0);
    tm.rpm += (Math.max(0.15, want) - tm.rpm) * Math.min(1, dt * 6);
    const lk = this.lightLevel(c);
    if (Math.abs(lk - (c.lightK || 0)) > 0.02 || (lk > 0.05) !== c.lightsOn) this.recalc(c);
  },
  puddle(c, kind) {
    const T = CAR_TYPES[c.type], k = kind === 'oil' ? 0.3 : -0.25;
    Wd.decals.push({ x: c.x + Math.cos(c.a) * T.len * k + R.f(-0.2, 0.2) - 0.5, y: c.y + Math.sin(c.a) * T.len * k + R.f(-0.2, 0.2) - 0.5, k: kind, v: R.int(0, 3), age: 0, s: R.f(0.5, 0.9) });
    if (Wd.decals.length > 450) Wd.decals.shift();
  },
  // ------------------------------------------------------------------ exhaust, dust, spray, tyre smoke, marks
  effects(c, tm, dt, rdt) {
    const T = CAR_TYPES[c.type], P = c.parts;
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    const at = (f, s) => [c.x + f * ca - s * sa, c.y + f * sa + s * ca];
    const vx = c.v * ca - (c.vs || 0) * sa, vy = c.v * sa + (c.vs || 0) * ca;
    const sp = Math.sqrt(c.v * c.v + (c.vs || 0) * (c.vs || 0));
    const sf = tm.sf || this.surface(c.x, c.y);
    const full = Fx.parts.length > 1100 || this.pfx.length > 420;
    tm.scr = 0;
    if (c.engine && !full) {
      // exhaust puffs from the tailpipe, thicker when revving; black when the engine is shot
      tm.puff -= rdt * (3 + tm.rpm * 9) * (P.muffler < 0 ? 1.6 : 1);
      if (tm.puff <= 0) {
        tm.puff = 1;
        const [x, y] = at(-T.len / 2 - 0.08, T.wid * 0.3);
        const dark = P.engine < 30 && R.chance(P.engine < 12 ? 0.8 : 0.4);
        const cold = (G.weather && G.weather.temp < 6) ? 1.4 : 1;
        this.puff({ x, y, z: 0.22, vx: vx * 0.4 - ca * 0.6 + R.f(-0.15, 0.15), vy: vy * 0.4 - sa * 0.6 + R.f(-0.15, 0.15), vz: R.f(0.15, 0.45), life: R.f(0.6, 1.0) * cold, max: 1.1 * cold, col: '#909090', size: R.f(1.2, 2.2) + tm.rpm, smoke: true, dark, rgb: dark ? null : '205,205,210' });
      }
    }
    // steam, then smoke, from a badly hurt engine (and for a while after a hard crash)
    if (!full && (tm.smokeT > 0 || (c.engine && P.engine < 25) || (P.engine <= 5 && P.engine >= 0 && c.hp < 30 && !c.burnt))) {
      tm.steam -= rdt * (c.engine ? 4 : 2);
      if (tm.steam <= 0) {
        tm.steam = 1;
        const [x, y] = at(T.len * 0.34, R.f(-0.25, 0.25));
        const dark = P.engine < 12;
        this.puff({ x, y, z: T.h + 0.05, vx: vx * 0.3 + R.f(-0.2, 0.2), vy: vy * 0.3 + R.f(-0.2, 0.2), vz: R.f(0.7, 1.1), life: R.f(1.3, 2.2), max: 2.2, col: '#909090', size: R.f(2.5, 4), smoke: true, dark, rgb: dark ? null : '235,235,235' });
      }
    }
    if (sp < 0.3 || c.burnt) { tm.wk[0] = tm.wk[1] = tm.wk[2] = tm.wk[3] = -1; return; }
    // wheels: tyre marks, dust, spray and tyre smoke
    const slip = tm.slip || 0;
    const skidAll = tm.locked || slip > 1.3, skidRear = tm.hb, spinW = tm.spin && tm.inp;
    const snowOn = (Season.snow || 0) > 0.3;
    let screech = 0;
    for (let i = 0; i < 4; i++) {
      const f = i < 2 ? T.len * 0.33 : -T.len * 0.3, s = (i & 1 ? 1 : -1) * T.wid * 0.42;
      const [wx, wy] = at(f, s);
      const tx = Math.floor(wx), ty = Math.floor(wy);
      if (!World.inb(tx, ty)) continue;
      const fl = Wd.floor[ty * Wd.w + tx], out = Wd.room[ty * Wd.w + tx] < 0;
      const rear = i >= 2, driven = T.drv === '4' || (T.drv === 'r') === rear;
      const sliding = skidAll || (skidRear && rear) || (spinW && driven);
      let k = -1, a = 0;
      if (out && snowOn && fl !== FL.WATER && fl !== FL.DEEPWATER) { k = MK_SNOW; a = 0.5 + Math.min(0.3, slip * 0.1); }
      else if (HARD_FLOORS[fl] && fl !== FL.DIRT && fl !== FL.SAND && fl !== FL.GRAVEL) {
        if (sliding) { k = MK_SKID; a = Math.min(0.6, 0.22 + slip * 0.06 + (tm.locked ? 0.15 : 0) + (spinW && driven ? 0.2 : 0)); screech = Math.max(screech, Math.min(1, 0.35 + slip * 0.12 + (tm.locked ? 0.3 : 0))); }
      } else if (out) {
        const wet = (sf.wet || 0) > 0.15 || (G.weather && G.weather.snow > 0.05);
        if (fl === FL.DIRT || fl === FL.FURROW || fl === FL.SAND) { k = MK_MUD; a = wet ? 0.45 : 0.22; }
        else if (fl === FL.GRAVEL) { k = MK_MUD; a = 0.16; }
        else if (wet || sliding) { k = MK_MUD; a = sliding ? 0.38 : 0.3; }
        if (sliding) a = Math.min(0.6, a + 0.12);
      }
      this.wheelMark(tm, i, wx, wy, k, a);
      if (full) continue;
      // particles behind the wheels
      if (rear || sliding) {
        const rate = sp * rdt;
        if (out && snowOn && sp > 2 && R.chance(rate * 0.5)) Fx.parts.push({ x: wx, y: wy, z: 0.1, vx: vx * 0.3 + R.f(-0.6, 0.6), vy: vy * 0.3 + R.f(-0.6, 0.6), vz: R.f(0.8, 1.8), life: 0.6, max: 0.6, col: 'rgba(240,244,250,0.9)', size: R.f(1.2, 2.2), g: true });
        else if (out && (fl === FL.DIRT || fl === FL.GRAVEL || fl === FL.SAND || fl === FL.FURROW) && !(sf.wet > 0.15) && sp > 3 && R.chance(rate * 0.22)) this.puff({ x: wx - vx * 0.05, y: wy - vy * 0.05, z: 0.15, vx: vx * 0.15 + R.f(-0.3, 0.3), vy: vy * 0.15 + R.f(-0.3, 0.3), vz: R.f(0.2, 0.5), life: R.f(1.0, 1.8), max: 1.8, col: '#909090', size: R.f(2.5, 4.5), smoke: true, rgb: fl === FL.GRAVEL ? '165,160,150' : '160,138,105' });
        else if (out && (sf.wet || 0) > 0.25 && HARD_FLOORS[fl] && sp > 4 && R.chance(rate * 0.45)) {
          Fx.parts.push({ x: wx, y: wy, z: 0.08, vx: vx * 0.25 + R.f(-0.5, 0.5), vy: vy * 0.25 + R.f(-0.5, 0.5), vz: R.f(0.6, 1.4), life: 0.45, max: 0.45, col: 'rgba(200,215,230,0.75)', size: R.f(1, 1.8), g: true });
          if (R.chance(0.3)) this.puff({ x: wx, y: wy, z: 0.12, vx: vx * 0.2, vy: vy * 0.2, vz: 0.25, life: 0.7, max: 0.7, col: '#909090', size: R.f(2, 3), smoke: true, rgb: '190,200,210' });
        }
        if (sliding && HARD_FLOORS[fl] && !snowOn && R.chance(rdt * (4 + slip * 3))) this.puff({ x: wx, y: wy, z: 0.12, vx: vx * 0.2 + R.f(-0.3, 0.3), vy: vy * 0.2 + R.f(-0.3, 0.3), vz: R.f(0.2, 0.5), life: R.f(1.0, 1.6), max: 1.6, col: '#909090', size: R.f(2.5, 4.5), smoke: true, rgb: '215,215,215' });
      }
    }
    tm.scr = screech;
  },
  // ------------------------------------------------------------------ tyre marks (ring buffer drawn under everything)
  marks: null, wash: 0, cover: 0,
  marksReset() {
    if (!this.marks) this.marks = { f: new Float32Array(MARK_N * 8), k: new Uint8Array(MARK_N), n: 0, i: 0 };
    this.marks.n = 0; this.marks.i = 0; this.wash = 0; this.cover = 0;
  },
  wheelMark(tm, i, x, y, k, a) {
    const lx = tm.wp[i * 2], ly = tm.wp[i * 2 + 1];
    if (k < 0 || tm.wk[i] !== k) { tm.wp[i * 2] = x; tm.wp[i * 2 + 1] = y; tm.wk[i] = k; return; }
    const dx = x - lx, dy = y - ly, d2 = dx * dx + dy * dy;
    if (d2 < 0.06) return;
    if (d2 < 4 && x < LV.W0) this.addMark(lx, ly, x, y, k, a);
    tm.wp[i * 2] = x; tm.wp[i * 2 + 1] = y;
  },
  addMark(x0, y0, x1, y1, k, a) {
    if (!this.marks) this.marksReset();
    const M = this.marks, j = M.i, o = j * 8;
    M.f[o] = x0; M.f[o + 1] = y0; M.f[o + 2] = x1; M.f[o + 3] = y1; M.f[o + 4] = G.time; M.f[o + 5] = this.wash; M.f[o + 6] = this.cover; M.f[o + 7] = a;
    M.k[j] = k;
    M.i = (j + 1) % MARK_N;
    if (M.n < MARK_N) M.n++;
  },
  MARK_STYLE: [['#121212', 2.6, 1440, 70], ['#7d8b9c', 4.2, 600, 30], ['#3e2c1c', 3.4, 900, 45]],
  drawMarks(ctx, minX, minY, maxX, maxY) {
    this.ensureAll();
    const M = this.marks;
    if (!M || !M.n) return;
    if (!this._mb) { this._mb = []; for (let b = 0; b < 18; b++) this._mb.push([]); }
    const B = this._mb;
    for (const a of B) a.length = 0;
    const now = G.time, snowK = U.clamp((Season.snow - 0.12) * 4, 0, 1);
    for (let j = 0; j < M.n; j++) {
      const o = j * 8, x = M.f[o], y = M.f[o + 1];
      if (x < minX - 1 || x > maxX + 1 || y < minY - 1 || y > maxY + 1) continue;
      const k = M.k[j], st = this.MARK_STYLE[k];
      let al = M.f[o + 7] * (1 - (now - M.f[o + 4]) / st[2]);
      al *= k === MK_SNOW ? (1 - (this.cover - M.f[o + 6]) / st[3]) * snowK : 1 - (this.wash - M.f[o + 5]) / st[3];
      if (al < 0.03) continue;
      B[k * 6 + Math.min(5, (al * 10) | 0)].push(o);
    }
    ctx.save();
    ctx.lineCap = 'round';
    for (let b = 0; b < 18; b++) {
      const L = B[b];
      if (!L.length) continue;
      const st = this.MARK_STYLE[(b / 6) | 0];
      ctx.strokeStyle = st[0]; ctx.lineWidth = st[1];
      ctx.globalAlpha = Math.min(0.62, (b % 6) / 10 + 0.06);
      ctx.beginPath();
      for (const o of L) {
        const x0 = M.f[o], y0 = M.f[o + 1], x1 = M.f[o + 2], y1 = M.f[o + 3];
        ctx.moveTo((x0 - y0) * HTW, (x0 + y0) * HTH); ctx.lineTo((x1 - y1) * HTW, (x1 + y1) * HTH);
      }
      ctx.stroke();
    }
    ctx.restore();
  },
  // ------------------------------------------------------------------ coloured smoke (exhaust, steam, dust, spray)
  pfx: [],
  puff(o) {
    if (this.pfx.length > 480) return;
    o.rgb = o.rgb || (o.dark ? '38,36,34' : '150,150,150');
    o.al = o.dark ? 0.5 : o.al || 0.38;
    this.pfx.push(o);
  },
  updatePuffs(dt) {
    const A = this.pfx;
    let j = 0;
    for (let i = 0; i < A.length; i++) {
      const p = A[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= 1 - dt * 0.8; p.vy *= 1 - dt * 0.8;
      p.size += dt * (p.dark ? 3.2 : 2.4);
      A[j++] = p;
    }
    A.length = j;
  },
  drawPuffs(ctx) {
    const A = this.pfx;
    if (!A.length) return;
    const cam = Render.cam;
    for (const p of A) {
      if (Math.abs(p.x - cam.x) > 45 || Math.abs(p.y - cam.y) > 45) continue;
      const s = Render.P(p.x, p.y, p.z), k = p.life / p.max;
      ctx.fillStyle = 'rgba(' + p.rgb + ',' + (p.al * Math.min(1, k * 1.6) * Math.min(1, (p.max - p.life) * 8 + 0.3)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s[0], s[1], p.size, 0, 7); ctx.fill();
    }
  },
  // ------------------------------------------------------------------ drawing
  draw(ctx, c) {
    // detailed renderer lives in carart.js
    if (typeof CarArt !== 'undefined' && CarArt.draw) { CarArt.draw(ctx, c); return; }
    const T = CAR_TYPES[c.type];
    const s = Math.max(0.12, Render.shadeSmooth(c.x, c.y));
    if (!World.isVis(c.x | 0, c.y | 0) && !World.isVis((c.x + Math.cos(c.a)) | 0, (c.y + Math.sin(c.a)) | 0) && G.player && !G.player.inCar && Render.shadeAt(c.x, c.y) < 0.05) return;
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    const P = (f, sd, z) => { const wx = c.x + f * ca - sd * sa, wy = c.y + f * sa + sd * ca; return [(wx - wy) * HTW, (wx + wy) * HTH - z * ZU]; };
    const L = T.len, W = T.wid;
    poly(ctx, [P(-L / 2 - 0.08, -W / 2 - 0.1, 0), P(L / 2 + 0.08, -W / 2 - 0.1, 0), P(L / 2 + 0.12, W / 2 + 0.12, 0), P(-L / 2 - 0.06, W / 2 + 0.12, 0)], 'rgba(0,0,0,' + (0.35 * s).toFixed(2) + ')');
    // wheels
    for (const f of [-L * 0.32, L * 0.32]) for (const sd of [-W / 2, W / 2]) {
      const a = P(f - 0.22, sd, 0.02), b = P(f + 0.22, sd, 0.02), q = P(f + 0.22, sd, 0.38), d = P(f - 0.22, sd, 0.38);
      poly(ctx, [a, b, q, d], Col.shade('#151515', s));
    }
    const col = c.hp < 30 ? Col.mix(c.col, '#3a3028', 0.35) : c.col;
    const box = (f0, f1, s0, s1, z0, z1, side, top, isCab) => {
      const faces = [
        { n: [ca, sa], pts: [P(f1, s0, z0), P(f1, s1, z0), P(f1, s1, z1), P(f1, s0, z1)], k: 'front' },
        { n: [-ca, -sa], pts: [P(f0, s1, z0), P(f0, s0, z0), P(f0, s0, z1), P(f0, s1, z1)], k: 'back' },
        { n: [-sa, ca], pts: [P(f0, s1, z0), P(f1, s1, z0), P(f1, s1, z1), P(f0, s1, z1)], k: 'side' },
        { n: [sa, -ca], pts: [P(f1, s0, z0), P(f0, s0, z0), P(f0, s0, z1), P(f1, s0, z1)], k: 'side' },
      ];
      for (const fc of faces) {
        if (fc.n[0] + fc.n[1] <= 0) continue;
        const lt = FACE_E + (FACE_S - FACE_E) * U.clamp((fc.n[1] - fc.n[0] + 1) / 2, 0, 1);
        poly(ctx, fc.pts, Col.shade(side, s * lt), Col.shade('#000000', 0), 0);
        if (isCab) {
          // window glass inset
          const g = fc.pts;
          const ins = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t)];
          const p0 = ins(g[0], g[2], 0.12), p1 = ins(g[1], g[3], 0.12), p2 = ins(g[2], g[0], 0.15), p3 = ins(g[3], g[1], 0.15);
          poly(ctx, [p0, p1, p2, p3], Col.shade(c.winBroken && fc.k === 'side' ? '#101418' : '#2a3a48', s * (0.8 + lt * 0.3)));
          if (!c.winBroken) line(ctx, ins(p0, p3, 0.3), ins(p1, p2, 0.6), 'rgba(255,255,255,' + (0.15 * s).toFixed(2) + ')', 1);
        }
        if (fc.k === 'front' && !isCab) {
          const hl = c.lightsOn && c.engine ? '#fffbe0' : '#d8d0a0';
          poly(ctx, [P(f1 + 0.001, s0 + 0.08, z1 - 0.2), P(f1 + 0.001, s0 + 0.28, z1 - 0.2), P(f1 + 0.001, s0 + 0.28, z1 - 0.08), P(f1 + 0.001, s0 + 0.08, z1 - 0.08)], Col.shade(hl, Math.max(s, c.lightsOn ? 1 : 0)));
          poly(ctx, [P(f1 + 0.001, s1 - 0.28, z1 - 0.2), P(f1 + 0.001, s1 - 0.08, z1 - 0.2), P(f1 + 0.001, s1 - 0.08, z1 - 0.08), P(f1 + 0.001, s1 - 0.28, z1 - 0.08)], Col.shade(hl, Math.max(s, c.lightsOn ? 1 : 0)));
        }
        if (fc.k === 'back' && !isCab) {
          poly(ctx, [P(f0 - 0.001, s1 - 0.08, z1 - 0.2), P(f0 - 0.001, s1 - 0.26, z1 - 0.2), P(f0 - 0.001, s1 - 0.26, z1 - 0.1), P(f0 - 0.001, s1 - 0.08, z1 - 0.1)], Col.shade('#a01010', s));
          poly(ctx, [P(f0 - 0.001, s0 + 0.26, z1 - 0.2), P(f0 - 0.001, s0 + 0.08, z1 - 0.2), P(f0 - 0.001, s0 + 0.08, z1 - 0.1), P(f0 - 0.001, s0 + 0.26, z1 - 0.1)], Col.shade('#a01010', s));
        }
      }
      poly(ctx, [P(f0, s0, z1), P(f1, s0, z1), P(f1, s1, z1), P(f0, s1, z1)], Col.shade(top, s));
    };
    box(-L / 2, L / 2, -W / 2, W / 2, 0.2, T.h, col, Col.mix(col, '#ffffff', 0.08));
    if (T.bed) {
      poly(ctx, [P(-L / 2 + 0.08, -W / 2 + 0.08, T.h), P(L * T.cab[0] - 0.02, -W / 2 + 0.08, T.h), P(L * T.cab[0] - 0.02, W / 2 - 0.08, T.h), P(-L / 2 + 0.08, W / 2 - 0.08, T.h)], Col.shade('#2a2a2a', s));
    }
    box(L * T.cab[0], L * T.cab[1], -W / 2 + 0.07, W / 2 - 0.07, T.h, T.h + T.cabH, col, col, true);
    if (T.lightbar) {
      const t = performance.now() / 200;
      const lb = T.red ? ((Math.floor(t) & 1) ? '#ff2020' : '#ff9030') : (Math.floor(t) & 1) ? '#ff2020' : '#2040ff';
      const on = c.siren && c.engine;
      const lz = T.h + T.cabH;
      if (T.red) box(L * T.cab[0] + 0.05, L * T.cab[0] + 0.25, -W / 2 + 0.15, W / 2 - 0.15, lz, lz + 0.1, on ? lb : '#802020', on ? lb : '#902020');
      else box(-0.12, 0.12, -W / 2 + 0.15, W / 2 - 0.15, lz, lz + 0.1, on ? lb : '#606060', on ? lb : '#707070');
      if (on) {
        const gp = P(T.red ? L * T.cab[0] + 0.15 : 0, 0, lz + 0.1);
        const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(gp[0], gp[1], 1, gp[0], gp[1], 40);
        gr.addColorStop(0, (Math.floor(t) & 1) || T.red ? 'rgba(255,40,40,0.5)' : 'rgba(50,80,255,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gp[0], gp[1], 40, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = op;
      }
    }
    if (c.type === 'firetruck') box(-L / 2 + 0.1, L * T.cab[0] - 0.1, -W / 2 + 0.15, W / 2 - 0.15, T.h, T.h + 0.15, '#c0c0c0', '#d0d0d0');
    // driver head
    if (G.player && G.player.inCar === c) {
      const hp = P(L * (T.cab[0] + T.cab[1]) / 2 + 0.05, -W * 0.2, T.h + T.cabH * 0.55);
      ctx.fillStyle = Col.shade(G.player.look.skin, s); ctx.beginPath(); ctx.arc(hp[0], hp[1], 4, 0, 7); ctx.fill();
    }
  },
};
// tyre marks under everything, puddles of oil and fuel, coloured smoke over the scene
if (typeof FLOOR_HOOKS !== 'undefined') FLOOR_HOOKS.push((ctx, a, b, c, d) => Vehicles.drawMarks(ctx, a, b, c, d));
if (typeof DECAL_ART !== 'undefined') {
  const puddle = (rgb, sh) => (ctx, d, X, Y) => {
    const s = (d.s || 1) * 15, al = U.clamp(1 - d.age / 900, 0.2, 1) * 0.55;
    ctx.save(); ctx.translate(X, Y + HTH); ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, s);
    g.addColorStop(0, 'rgba(' + rgb + ',' + al.toFixed(2) + ')'); g.addColorStop(0.7, 'rgba(' + rgb + ',' + (al * 0.8).toFixed(2) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g; ctx.beginPath();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = s * (0.75 + 0.25 * Math.sin(i * 2.7 + (d.v || 0) * 1.9)); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    if (sh) { ctx.fillStyle = 'rgba(' + sh + ',' + (al * 0.5).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(-s * 0.2, -s * 0.15, s * 0.35, s * 0.18, 0.3, 0, 7); ctx.fill(); }
    ctx.restore();
  };
  DECAL_ART.oil = puddle('14,12,10', '120,90,160');
  DECAL_ART.fuel = puddle('60,52,30', '150,170,120');
}
if (typeof Fx !== 'undefined' && !Fx._carPuffs) {
  const d0 = Fx.draw;
  Fx._carPuffs = true;
  Fx.draw = function (ctx) { d0.call(this, ctx); Vehicles.drawPuffs(ctx); };
}
