'use strict';
// ---------------------------------------------------------------------------
// Game state, loop, time, events, weather, save/load
// ---------------------------------------------------------------------------
const G = {
  mode: 'menu', player: null, zombies: [], cars: [], time: 0, speed: 1, paused: false,
  events: {}, weather: { rain: 0, target: 0, fog: 0, temp: 24, next: 0, storm: false }, light: { amb: 1, flash: 0 },
  alarms: [], chasing: 0, build: null, hover: null, conts: new Set(), seed: 0,
};
// sandbox settings (PZ-style)
const SANDBOX_OPTS = {
  pop: { n: 'Zombie population', opts: [['None', 0], ['Low', 0.5], ['Normal', 1], ['High', 1.6], ['Insane', 2.5]], def: 2 },
  speed: { n: 'Zombie speed', opts: [['Shamblers', 'shambler'], ['Fast Shamblers', 'fast'], ['Sprinters', 'sprinter'], ['Random mix', 'random']], def: 0 },
  day: { n: 'Day length', opts: [['30 minutes', 0.5], ['1 hour', 1], ['2 hours', 2], ['4 hours', 4]], def: 1 },
  loot: { n: 'Loot', opts: [['Extremely rare', 0.4], ['Rare', 0.7], ['Normal', 1], ['Common', 1.4], ['Abundant', 2]], def: 2 },
  utilities: { n: 'Power & water shutoff', opts: [['Instant', 0], ['Within a week', 1], ['Within two weeks', 2], ['Within a month', 3], ['Never', 4]], def: 2 },
  start: { n: 'Start time', opts: [['7 AM', 7], ['9 AM', 9], ['Noon', 12], ['5 PM', 17], ['9 PM', 21], ['2 AM', 2]], def: 1 },
  fire: { n: 'Fire spread', opts: [['On', 1], ['Off', 0]], def: 0 },
  trans: { n: 'Infection', opts: [['Bites & scratches', 0], ['Bites only', 1], ['None', 2]], def: 0 },
  tough: { n: 'Zombie toughness', opts: [['Fragile', 0.6], ['Normal', 1], ['Tough', 1.6]], def: 1 },
  smart: { n: 'Zombie cognition', opts: [['Bash doors', 0], ['Open doors', 1]], def: 0 },
  month: { n: 'Start month', opts: [['July (summer)', 7], ['September', 9], ['October (autumn)', 10], ['November', 11], ['December (winter)', 12], ['January', 1], ['April (spring)', 4]], def: 0 },
  alarms: { n: 'House alarms', opts: [['Never', 0], ['Extremely rare', 0.01], ['Rare', 0.03], ['Sometimes', 0.07], ['Often', 0.15]], def: 2 },
  carAlarms: { n: 'Car alarms', opts: [['Never', 0], ['Extremely rare', 0.01], ['Rare', 0.03], ['Sometimes', 0.08], ['Often', 0.2]], def: 2 },
};
// world objects that change over time (see Game.worldTick)
const TICK_OBJ = { campfire: 1, bbq: 1, crop: 1, barrel: 1, trap: 1 };
const SANDBOX_PRESETS = {
  Apocalypse: { pop: 2, speed: 0, day: 1, loot: 2, utilities: 2, start: 1 },
  Survivor: { pop: 1, speed: 0, day: 2, loot: 3, utilities: 3, start: 1 },
  Builder: { pop: 1, speed: 0, day: 2, loot: 4, utilities: 4, start: 1 },
  'Sprinter Hell': { pop: 2, speed: 2, day: 1, loot: 2, utilities: 1, start: 4 },
};
function sandboxValues(sel) {
  const o = {};
  for (const k in SANDBOX_OPTS) o[k] = SANDBOX_OPTS[k].opts[sel[k] === undefined ? SANDBOX_OPTS[k].def : sel[k]][1];
  return o;
}
const BROADCASTS = [
  [0, 'Authorities urge residents of Hollow Creek to stay indoors following reports of violent attacks.'],
  [0, 'Symptoms reportedly include high fever and extreme aggression. Avoid contact with anyone who appears ill.'],
  [0, 'Officials insist the situation is contained and ask the public not to panic.'],
  [1, 'A quarantine has been declared for Hollow Creek. Military units are establishing a perimeter.'],
  [1, 'Do not attempt to leave the exclusion zone. Barricade your doors and windows.'],
  [1, 'Hospitals are no longer accepting patients. Bites appear to be... always fatal.'],
  [2, 'This is the Emergency Broadcast System. Remain in your homes. Ration food and water.'],
  [2, 'Reports confirm the dead are getting back up. If you must fight, aim for the head.'],
  [3, 'Power and water services may be interrupted. Fill every container you have with water.'],
  [3, 'The evacuation of Hollow Creek has been suspended until further notice.'],
  [4, '...if anyone can hear this... the checkpoint on the west highway has been overrun...'],
  [5, 'Emergency Broadcast: Stay indoors. Await further instructions.'],
  [6, '*static*'],
];
const SHOWS = [
  ['Home Handy Hour', 'Carpentry', ['Always pre-drill your planks, folks.', 'Two nails per plank keeps a window shut tight.', 'A good saw makes short work of a log.', "Measure twice, cut once — that's the rule."]],
  ['Kitchen Corner', 'Cooking', ['Boil your water before you drink it.', 'A hearty stew stretches what little you have.', "Don't let that meat sit out — cook it while it's fresh.", 'A clean kitchen is a safe kitchen.']],
];
const Game = {
  day() { return Math.floor(G.time / 1440); },
  hour() { return (G.time % 1440) / 60; },
  dateStr() { return Season.dateStr(); },
  timeStr() {
    const h = Math.floor(this.hour()), mi = Math.floor(G.time % 60);
    return U.pad2(h) + ':' + U.pad2(mi);
  },
  fuzzyTime() {
    const h = this.hour();
    if (h < 5) return 'Night'; if (h < 8) return 'Dawn'; if (h < 12) return 'Morning'; if (h < 17) return 'Afternoon'; if (h < 21) return 'Evening'; return 'Night';
  },
  trackCont(c) { if (c && c.items) G.conts.add(c); },

  // ------------------------------------------------------------------ new game
  newGame(cfg) {
    G.sb = cfg.sb || sandboxValues({});
    MIN_PER_SEC = 24 * 60 / (G.sb.day * 3600);
    G.seed = cfg.world ? cfg.seed : (Math.random() * 1e9) | 0;
    G.time = 0; G.weather = { rain: 0, snow: 0, temp: 20 };
    Season.update();
    // a world pre-generated while the player was on the character screen saves the wait
    const w = cfg.world || MapGen.generate(G.seed);
    delete cfg.world;
    World.use(w);
    G.conts = new Set();
    G.corpse = false; G.chasing = 0;
    G.alarms = []; Combat.projs = []; Combat.sources = []; Fx.parts = []; Fx.fires = []; Fx.floats = [];
    // spawn house
    const homes = w.spawnHouses.map(id => w.buildings[id]).filter(b => b.type === 'house' && b.rooms.length >= 3);
    const ranked = homes.map(b => ({ b, d: U.dist((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 120, 120) })).filter(o => o.d > 25 && o.d < 75);
    const home = (ranked.length ? R.pick(ranked).b : R.pick(homes));
    home.isHome = true;
    home.alarm = false;
    const rooms = home.rooms.map(r => w.rooms[r]);
    const start = rooms.find(r => r.type === 'bedroom') || rooms[0];
    let sx = (start.x0 + start.x1) / 2 + 0.5, sy = (start.y0 + start.y1) / 2 + 0.5;
    for (let y = start.y0; y <= start.y1; y++) for (let x = start.x0; x <= start.x1; x++) if (!World.tileSolid(x, y) && !w.obj[y * w.w + x]) { sx = x + 0.5; sy = y + 0.5; }
    // lock home exterior doors
    for (const [k, f] of w.feat) if (f.k === 'door' && f.b === home.id && f.ext) { f.locked = true; f.open = false; }
    for (const [k, f] of w.feat) if (f.k === 'window' && f.b === home.id) { f.locked = true; void k; }
    const p = Player.create({ x: sx, y: sy, name: cfg.name, occ: cfg.occ, traits: cfg.traits, look: cfg.look });
    G.player = p;
    // starting clothes
    const occ = OCCUPATIONS.find(o => o.id === cfg.occ);
    const gear = (occ && occ.gear) ? occ.gear.slice() : [];
    const addWear = (id, col) => { const it = Items.make(id); if (col) it.col = col; p.inv.push(it); Player.wear(it); };
    if (!gear.some(g => ITEMS[g].slot === 'shirt')) addWear(cfg.look.female ? R.pick(['TShirt', 'Shirt', 'TankTop']) : R.pick(['TShirt', 'Shirt']), cfg.look.shirtCol);
    if (!gear.some(g => ITEMS[g].slot === 'pants')) addWear(R.pick(['Jeans', 'Trousers', 'Jeans']), cfg.look.pantsCol);
    if (!gear.some(g => ITEMS[g].slot === 'shoes')) addWear('Sneakers');
    for (const g of gear) addWear(g);
    const coldStart = Season.tree === 'b' || Season.tree === 's';
    if (coldStart) addWear(R.pick(['WinterCoat', 'Hoodie', 'Sweater'])); else if (R.chance(0.4)) addWear('Hoodie');
    addWear('DigitalWatch');
    if (Player.hasTrait('shortsighted')) addWear('Glasses');
    const key = Items.make('HouseKey', { set: { keyId: home.keyId, keyName: 'Key to your house' } });
    p.inv.push(key);
    if (Player.hasTrait('smoker')) { p.inv.push(Items.make('Cigarettes')); p.inv.push(Items.make('Lighter')); }
    // guarantee some supplies in the home kitchen
    const kit = rooms.find(r => r.type === 'kitchen');
    if (kit) for (let y = kit.y0; y <= kit.y1; y++) for (let x = kit.x0; x <= kit.x1; x++) {
      const o = w.obj[y * w.w + x];
      if (o && o.t === 'counter' && o.c && !o.c.items) { World.contItems(o, x, y); o.c.items.push(Items.make('CanOpener'), Items.make('WaterBottle'), Items.make('CannedBeans')); break; }
    }
    // world population
    Zombie.spawnAll(sx, sy);
    Zombie.rebuildGrid();
    G.zombies = G.zombies.filter(z => !(World.building(z.x | 0, z.y | 0) === home));
    Zombie.rebuildGrid();
    if (typeof CarArt !== 'undefined' && CarArt.flush) CarArt.flush();
    Vehicles.spawnAll();
    this.atmosphere(home, sx, sy);
    G.time = G.sb.start * 60;
    const util = [[0, 1], [3, 7], [6, 13], [10, 30], [1e5, 1e5]][G.sb.utilities];
    G.events = { powerOff: false, waterOff: false, powerAt: (R.int(util[0], util[1]) * 1440 + R.int(6, 20) * 60), waterAt: (R.int(Math.max(0, util[0] - 1), Math.max(0, util[1] - 2)) * 1440 + R.int(6, 20) * 60), heliAt: (R.int(5, 8) * 1440 + R.int(9, 15) * 60), heli: null, metaAt: G.time + R.int(30, 120), heliDone: false };
    if (G.sb.utilities === 0) { G.events.powerAt = G.time + R.int(60, 600); G.events.waterAt = G.time + R.int(60, 600); }
    G.weather = { rain: 0, target: 0, fog: 0, fogT: 0, temp: 24, next: G.time + R.int(180, 600), storm: false, thunderT: 0, snow: 0, tOff: 0 };
    // the season we start in shapes the world: snow cover, frozen fields, berries
    const mo = G.sb.month || 7;
    if (mo === 12 || mo === 1 || mo === 2) G.weather.snow = R.f(0.55, 0.9);
    for (const o of w.obj) {
      if (!o) continue;
      if (o.t === 'crop' && o.crop) { if (mo >= 11 || mo <= 3) o.dead = true; else if (mo >= 9) { o.stage = 4; o.grow = 1.05; } else if (mo <= 5) { o.stage = 1; o.grow = 0.1; } }
      if (o.t === 'bush' && (mo >= 11 || mo <= 5)) o.berries = false;
    }
    G.speed = 1; G.paused = false;
    Render.cam.x = vxOf(sx); Render.cam.y = sy; Render.cam.z = sx >= LV.W0 ? WALL_H : 0;
    for (const it of p.inv) void it;
    Player.fov(1);
    this.lastSave = G.time;
    G.mode = 'play';
  },

  // signs of the outbreak: corpses, blood, broken-into houses, lights left on
  atmosphere(home, sx, sy) {
    const w = Wd;
    const RP = MapGen.RP;
    const townTile = () => { for (let k = 0; k < 40; k++) { const x = R.int(RP[0], RP[5] + 3), y = R.int(RP[0], RP[5] + 3); if (!World.tileSolid(x, y) && !World.isWater(x, y) && U.dist(x, y, sx, sy) > 14) return [x, y]; } return null; };
    // corpses with blood pools
    for (let k = 0; k < 45; k++) {
      const t = townTile(); if (!t) continue;
      const z = Zombie.create(t[0] + R.f(0.2, 0.8), t[1] + R.f(0.2, 0.8));
      z.lie = 1; z.dead = true; z.st = 'dead'; z.lieDir = R.chance(0.5) ? 1 : -1; z.diedAt = -R.f(0, 2000);
      z.loot = z.wear.concat(Loot.zombiePockets());
      for (const it of z.loot) if (it.worn && ITEMS[it.id].cat === 'Clothing') delete it.worn;
      z.blood = 1; z.look.blood = 1;
      G.zombies.push(z);
      w.decals.push({ x: z.x - 0.5, y: z.y - 0.5, v: R.int(0, 7), age: 0, s: R.f(1, 1.5) });
    }
    // some people died at home
    for (const b of w.buildings) {
      if (b.id === home.id || b.type !== 'house' || !R.chance(0.12)) continue;
      const rm = w.rooms[R.pick(b.rooms)];
      for (let t = 0; t < 8; t++) {
        const x = R.int(rm.x0, rm.x1), y = R.int(rm.y0, rm.y1);
        if (World.tileSolid(x, y)) continue;
        const z = Zombie.create(x + 0.5, y + 0.5);
        z.lie = 1; z.dead = true; z.st = 'dead'; z.lieDir = R.chance(0.5) ? 1 : -1; z.diedAt = -R.f(0, 3000);
        z.loot = z.wear.concat(Loot.zombiePockets());
        for (const it of z.loot) if (it.worn && ITEMS[it.id].cat === 'Clothing') delete it.worn;
        z.blood = 1; z.look.blood = 1;
        G.zombies.push(z);
        w.decals.push({ x: x, y: y, v: R.int(0, 7), age: 0, s: 1.3 });
        break;
      }
    }
    for (let k = 0; k < 90; k++) { const t = townTile(); if (t) w.decals.push({ x: t[0] + R.f(0, 1) - 0.5, y: t[1] + R.f(0, 1) - 0.5, v: R.int(0, 7), age: 0, s: R.f(0.5, 1.2) }); }
    // fake-dead zombies: look like corpses until you get close
    for (let k = 0; k < 14; k++) {
      const t = townTile(); if (!t) continue;
      const z = Zombie.create(t[0] + 0.5, t[1] + 0.5);
      z.st = 'down'; z.lie = 1; z.downT = 1e9; z.fake = true; z.lieDir = 1; z.blood = 1; z.look.blood = 1;
      G.zombies.push(z);
    }
    // street debris
    const junk = ['Newspaper', 'EmptyBottle', 'Crisps', 'PlasticBag', 'Magazine', 'RippedSheets', 'Pop', 'Bandage', 'Battery', 'Bullets9mm'];
    for (let k = 0; k < 70; k++) { const t = townTile(); if (t && World.room(t[0], t[1]) < 0) World.dropItem(t[0] + 0.5, t[1] + 0.5, Items.make(R.pick(junk), { loot: true })); }
    // broken-into houses
    for (const [k, f] of w.feat) {
      if (f.b === undefined || f.b === home.id) continue;
      if (f.k === 'door' && f.ext && R.chance(0.1)) { if (R.chance(0.4)) f.broken = true; else { f.open = true; f.locked = false; } }
      if (f.k === 'window' && R.chance(0.07)) { f.smashed = true; f.locked = false; }
      void k;
    }
    // some lights were left on
    for (const rm of w.rooms) if (rm.b !== home.id && R.chance(0.12)) rm.lights = true;
  },

  // ------------------------------------------------------------------ main loop
  last: 0, acc: 0, fpsN: 0, fpsT: 0,
  pf: { sim: 0, steps: 0, rend: 0, ui: 0, uiMs: 0, frame: 0 },
  loop(ts) {
    requestAnimationFrame((t) => this.loop(t));
    // frame rate cap (settings): skip this display refresh if the last frame was too recent
    const cap = Settings.v.fps;
    if (cap && this.last && ts - this.last < 1000 / cap - 2.5) return;
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.1);
    if (G.mode === 'play' || G.mode === 'dead') {
      if (G.mode === 'play' && !G.paused && !UI.modalPause()) {
        const sim = dt * G.speed;
        const steps = Math.min(60, Math.max(1, Math.ceil(sim / (1 / 30))));
        const t0 = performance.now();
        for (let i = 0; i < steps; i++) this.step(sim / steps);
        this.pf.sim += performance.now() - t0; this.pf.steps += steps;
        Input.handleGameKeys();
      } else if (G.mode === 'dead') {
        this.step(dt);
      }
      Fx.update(dt);
      this.updateLight(dt);
      const t1 = performance.now();
      Render.frame(dt);
      const t2 = performance.now();
      this.pf.rend += t2 - t1;
      // HUD and panels refresh at the configured rate
      this.uiAcc = (this.uiAcc || 0) + dt;
      if (this.uiAcc >= 1 / (Settings.v.uiHz || 30) - 0.002) { UI.update(this.uiAcc); Dash.update(); this.uiAcc = 0; this.pf.ui++; this.pf.uiMs += performance.now() - t2; }
      Music.update(dt);
    } else if (G.mode === 'menu' || G.mode === 'create') {
      Menu.drawBackground(dt);
    }
    Input.endFrame();
    this.fpsMeter(ts);
  },
  // frame rate counter (settings: off / FPS / detailed)
  fpsMeter(ts) {
    this.fpsN++;
    if (ts - this.fpsT < 500) return;
    const sec = (ts - this.fpsT) / 1000, n = this.fpsN, pf = this.pf;
    const fps = n / sec;
    this.fpsN = 0; this.fpsT = ts;
    let el = document.getElementById('fps');
    const mode = Settings.v.fpsShow;
    if (!mode) { if (el) el.style.display = 'none'; Render.lightN = 0; return; }
    if (!el) { el = document.createElement('div'); el.id = 'fps'; el.style.cssText = 'position:fixed;left:8px;top:6px;z-index:30;font:11px/1.45 Verdana,sans-serif;color:#e8e0c0;background:rgba(0,0,0,0.55);padding:2px 7px;border-radius:3px;pointer-events:none;white-space:pre'; document.body.appendChild(el); }
    el.style.display = 'block';
    const col = fps >= 50 ? '#9be08a' : fps >= 28 ? '#e8d070' : '#f08a6a';
    let txt = '<b style="color:' + col + '">' + Math.round(fps) + ' FPS</b>';
    if (mode === 2) {
      const zs = G.zombies || [];
      txt += '\nframe ' + (1000 / Math.max(1, fps)).toFixed(1) + ' ms · render ' + (pf.rend / n).toFixed(1) + ' ms\nsim ' + (pf.sim / n).toFixed(1) + ' ms · ' + Math.round(pf.steps / sec) + ' steps/s'
        + '\nlight ' + Math.round((Render.lightN || 0) / sec) + '/s · UI ' + Math.round(pf.ui / sec) + '/s (' + (pf.uiMs / Math.max(1, pf.ui)).toFixed(1) + ' ms)'
        + '\nzombies ' + zs.length + ' · near ' + (Zombie.nearN || 0) + ' · updated ' + (Zombie.updN || 0)
        + '\nground chunks ' + Render.chunks.size + ' · sprites ' + Spr.cache.size;
    }
    el.innerHTML = txt;
    pf.sim = pf.steps = pf.rend = pf.ui = pf.uiMs = 0; Render.lightN = 0;
  },
  step(dt) {
    const gm = dt * MIN_PER_SEC;
    G.time += gm;
    const p = G.player;
    Player.update(dt);
    if (p.dead && p.reanimate && p.deadT > 6 && !p.risen) {
      p.risen = true;
      const z = Zombie.create(p.x, p.y);
      z.wear = p.inv.filter(it => it.worn);
      z.look = Object.assign(Player.look(), { zombie: true, skin: Col.mix(p.look.skin, ZSKIN, 0.5), blood: 0.8, hair: p.look.hair, hairStyle: p.look.hairStyle });
      z.keepLook = true;
      z.lie = 1; z.st = 'getup'; z.va = 1;
      G.zombies.push(z);
      G.corpse = false;
    }
    Actions.update(dt);
    Zombie.updateAll(dt);
    Vehicles.update(dt);
    Combat.update(dt);
    Fire.update(dt);
    this.updateEvents(dt, gm);
    Weather.update(dt, gm);
    this.tickAcc = (this.tickAcc || 0) + gm;
    if (this.tickAcc >= 1) { this.worldTick(this.tickAcc); this.tickAcc = 0; }
    if (!p.dead && G.time - this.lastSave > 30 && !p.asleep && G.mode === 'play') { this.lastSave = G.time; Save.save(true); }
  },
  updateLight(dt) {
    const h = this.hour();
    Season.update();
    const sr = Season.sunrise(), ss = Season.sunset();
    let a;
    if (h < sr - 0.8 || h >= ss + 1.2) a = 0; else if (h < sr + 0.9) a = (h - (sr - 0.8)) / 1.7; else if (h < ss - 0.4) a = 1; else a = 1 - (h - (ss - 0.4)) / 1.6;
    let amb = 0.07 + 0.93 * U.smooth(U.clamp(a, 0, 1));
    amb *= 1 - G.weather.rain * 0.28 - G.weather.fog * 0.1;
    G.light.flash = Math.max(0, G.light.flash - dt * 3);
    G.light.amb = Math.max(amb, G.light.flash * 0.9);
    G.light.night = a < 0.5;
  },

  // ------------------------------------------------------------------ events
  updateEvents(dt, gm) {
    const ev = G.events, p = G.player;
    if (!ev.powerOff && G.time >= ev.powerAt) {
      ev.powerOff = true;
      Sfx.play('powerdown');
      if (!p.dead) Player.say('The power just went out...', '#f99');
      for (const rm of Wd.rooms) rm.lights = false;
      for (let i = 0; i < Wd.obj.length; i++) { const o = Wd.obj[i]; if (o && (o.t === 'tv' || o.t === 'stove') && o.on) o.on = false; }
      UI.flashPower = 1.5;
    }
    if (!ev.waterOff && G.time >= ev.waterAt) ev.waterOff = true;
    // helicopter
    if (!ev.heliDone && !ev.heli && G.time >= ev.heliAt) {
      const a = R.f(0, Math.PI * 2);
      ev.heli = { x: vxOf(p.x) + Math.cos(a) * 80, y: p.y + Math.sin(a) * 80, end: G.time + R.int(90, 150), pulse: 0, leaving: false, la: a };
      Player.say('Is that... a helicopter?', '#ccc');
    }
    if (ev.heli) {
      const hl = ev.heli;
      let tx = vxOf(p.x) + Math.cos(G.time / 25) * 6, ty = p.y + Math.sin(G.time / 25) * 6;
      if (G.time > hl.end) { hl.leaving = true; tx = hl.x + Math.cos(hl.la) * 100; ty = hl.y + Math.sin(hl.la) * 100; }
      const dx = tx - hl.x, dy = ty - hl.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const sp = Math.min(d, (hl.leaving ? 10 : 5) * dt);
      hl.x += dx / d * sp; hl.y += dy / d * sp;
      hl.pulse -= dt;
      if (hl.pulse <= 0) { hl.pulse = 4; Noise.emit(hl.x, hl.y, 45, 'heli'); }
      Sfx.heli(hl);
      if (hl.leaving && U.dist(hl.x, hl.y, vxOf(p.x), p.y) > 90) { ev.heli = null; ev.heliDone = true; Sfx.heli(null); }
    }
    // meta events: distant noises that move hordes
    if (G.time >= ev.metaAt) {
      ev.metaAt = G.time + R.int(40, 140);
      const a = R.f(0, Math.PI * 2), d = R.f(35, 70);
      const mx = U.clamp(vxOf(p.x) + Math.cos(a) * d, 2, (Wd.gw || Wd.w) - 2), my = U.clamp(p.y + Math.sin(a) * d, 2, Wd.h - 2);
      Noise.emit(mx, my, 28, 'meta');
      if (!p.asleep) Sfx.distant(R.pick(['gunshots', 'scream', 'crash', 'dog']), mx, my);
    }
    // alarms
    for (let i = G.alarms.length - 1; i >= 0; i--) {
      const al = G.alarms[i];
      al.t -= gm;
      al.pulse -= dt;
      if (al.pulse <= 0) { al.pulse = 2; Noise.emit(al.x, al.y, al.car ? 32 : 45, 'alarm'); Sfx.play('alarm', al.x, al.y); }
      if (al.t <= 0) G.alarms.splice(i, 1);
    }
  },
  // ------------------------------------------------------------------ world tick (game minutes)
  // 0 within 6 chunks (16x16 tiles) of the player, 1 within 12, 2 beyond
  chunkTier(x, y) {
    const p = G.player;
    if (!p) return 0;
    const q = p.inCar || p;
    const cd = Math.max(Math.abs(Math.floor(vxOf(x) / 16) - Math.floor(vxOf(q.x) / 16)), Math.abs(Math.floor(y / 16) - Math.floor(q.y / 16)));
    return cd >= 12 ? 2 : cd >= 6 ? 1 : 0;
  },
  worldTick(gm) {
    const p = G.player;
    const powered = !G.events.powerOff;
    // containers: spoilage & cooking
    const lazy = Settings.v.chunkLazy;
    this.wtick = (this.wtick || 0) + 1;
    for (const c of G.conts) {
      if (!c.items || !c.items.length) continue;
      // lazy chunks: far containers age at half rate / not at all, catching up when the player comes back
      let g = gm;
      if (lazy && c.px !== undefined) {
        const tier = this.chunkTier(c.px, c.py);
        if (tier) { c.ag = (c.ag || 0) + gm; if (tier === 2 || (this.wtick & 1)) continue; g = c.ag; c.ag = 0; }
        else if (c.ag) { g += c.ag; c.ag = 0; }
      }
      let cold = false, heat = false;
      const o = (c.px !== undefined) ? World.obj(c.px, c.py) : null;
      if (o && OBJ[o.t].cold && (powered || World.hasPower(c.px, c.py))) cold = true;
      if (o && ((o.t === 'stove' && o.on && (powered || World.hasPower(c.px, c.py))) || ((o.t === 'campfire' || o.t === 'bbq') && o.lit))) heat = true;
      for (const it of c.items) this.ageItem(it, g, cold, heat, c);
    }
    for (const it of p.inv) { this.ageItem(it, gm, false, false); if (it.items) for (const s of it.items) this.ageItem(s, gm, false, false); }
    // fires & generators
    this.slowAcc = (this.slowAcc || 0) + gm;
    if (this.slowAcc >= 5) {
      const sg0 = this.slowAcc; this.slowAcc = 0;
      const rain = G.weather.rain;
      this.stick = (this.stick || 0) + 1;
      // ticking objects (fires, crops, barrels, traps, regrowing bushes) are indexed every 20 game minutes
      if (!this.tickList || this.tickWorld !== Wd || this.stick % 4 === 0) {
        const L = [];
        for (let i = 0; i < Wd.obj.length; i++) { const o = Wd.obj[i]; if (o && (TICK_OBJ[o.t] || (o.t === 'bush' && o.berryDay !== undefined))) L.push(i); }
        this.tickList = L; this.tickWorld = Wd;
      }
      for (const i of this.tickList) {
        const o = Wd.obj[i];
        if (!o) continue;
        let sg = sg0;
        if (lazy) {
          const tier = this.chunkTier(i % Wd.w, (i / Wd.w) | 0);
          if (tier) { o.tg = (o.tg || 0) + sg0; if (tier === 2 || (this.stick & 1)) continue; sg = o.tg; o.tg = 0; }
          else if (o.tg) { sg += o.tg; o.tg = 0; }
        }
        if ((o.t === 'campfire' || o.t === 'bbq') && o.lit) {
          o.fuel -= sg;
          if (o.fuel <= 0 || (rain > 0.6 && o.t === 'campfire' && R.chance(0.1))) { o.fuel = Math.max(0, o.fuel); o.lit = false; }
          else if (o.t === 'campfire' && rain < 0.05 && R.chance(0.012 * sg / 5)) { const [dx, dy] = R.pick(DIR4); Fire.ignite(i % Wd.w + dx, ((i / Wd.w) | 0) + dy, 0.3); }
        }
        else if (o.t === 'crop' && o.crop && !o.dead) {
          const cd = CROPS[o.crop];
          const outside = World.room(i % Wd.w, (i / Wd.w) | 0) < 0;
          if (outside && G.weather.temp < -1 && R.chance(0.5)) { o.dead = true; continue; }
          if (World.room(i % Wd.w, (i / Wd.w) | 0) < 0 && rain > 0.1) o.water = Math.min(1, (o.water || 0) + rain * sg / 60 * 0.5);
          o.water = Math.max(0, (o.water || 0) - sg / 1440 * 0.45);
          o.grow = (o.grow || 0) + sg / (cd.days * 1440) * (o.water > 0.12 ? 1 : 0.1) * (G.weather.temp < 8 ? 0.3 : 1);
          o.stage = o.grow < 0.25 ? 1 : o.grow < 0.5 ? 2 : o.grow < 0.8 ? 3 : 4;
          if (o.grow > 1.7) o.dead = true;
        } else if (o.t === 'barrel' && rain > 0.05 && World.room(i % Wd.w, (i / Wd.w) | 0) < 0) o.water = Math.min(1, (o.water || 0) + rain * sg / 60 * 0.12);
        else if (o.t === 'trap') this.trapTick(o, i, sg);
        else if (o.t === 'bush' && o.berryDay !== undefined && this.day() - o.berryDay >= 3 && Season.doy >= 150 && Season.doy < 300) { o.berries = true; delete o.berryDay; }
      }
      for (const g of Wd.powerGens) if (g.on) { g.fuel -= sg0 / (60 * 14); if (g.fuel <= 0) { g.fuel = 0; g.on = false; } else Noise.emit(g.x + 0.5, g.y + 0.5, 16, 'gen'); }
    }
    // TV / radio broadcasts
    this.bcAcc = (this.bcAcc || 0) + gm;
    if (this.bcAcc >= 6 && !p.dead && !p.asleep) {
      this.bcAcc = 0;
      let src = null;
      const cx = Math.floor(p.x), cy = Math.floor(p.y);
      for (let y = cy - 5; y <= cy + 5 && !src; y++) for (let x = cx - 5; x <= cx + 5 && !src; x++) { const o = World.obj(x, y); if (o && o.t === 'tv' && o.on) src = { x: x + 0.5, y: y + 0.5, tv: true }; }
      const radio = Player.find(it => ITEMS[it.id].radio && it.on && it.pow > 0);
      if (!src && radio) src = { x: p.x, y: p.y, radio: true };
      if (src) this.broadcast(src);
    }
  },
  // small game wanders into baited traps, mostly at dawn and dusk, away from people
  trapTick(o, i, sg) {
    if (!o.bait || o.caught) return;
    const x = i % Wd.w, y = (i / Wd.w) | 0, p = G.player;
    const h = this.hour();
    let rate = o.kind === 'snare' ? 0.017 : 0.014; // per hour
    if (World.floor(x, y) === FL.FOREST) rate *= 1.7;
    let nearHouse = false;
    for (let yy = y - 4; yy <= y + 4 && !nearHouse; yy += 2) for (let xx = x - 4; xx <= x + 4; xx += 2) if (World.room(xx, yy) >= 0) { nearHouse = true; break; }
    if (nearHouse) rate *= 0.35;
    rate *= (h > 5 && h < 8) || (h > 17 && h < 20.5) ? 1.6 : (h > 10 && h < 16) ? 0.6 : 1;
    if (p && !p.dead && World.lvDist(p.x, p.y, x + 0.5, y + 0.5) < 14) rate *= 0.1;
    rate *= 1 + Player.skill('Trapping') * 0.12;
    if (Season.tree === 'b' || Season.snow > 0.3) rate *= 0.5;
    const bq = { Worms: 1.2, PeanutButter: 1.4, Carrots: 1.3, Cabbage: 1.2, Lettuce: 1.1, Apple: 1.1, Corn: 1.2, Insects: 1.1 }[o.bait] || 1;
    rate *= bq;
    // the bait itself goes off after a couple of days
    if (G.time - (o.baitT || G.time) > 2880 && R.chance(sg / 600)) { o.bait = null; return; }
    if (!R.chance(Math.min(0.5, rate * sg / 60))) return;
    const tbl = o.kind === 'snare' ? [['rabbit', 45], ['squirrel', 25], ['bird', 15], ['mouse', 15]] : [['rabbit', 40], ['squirrel', 30], ['mouse', 20], ['bird', 10]];
    o.caught = R.weighted(tbl); o.caughtT = G.time; o.bait = null;
  },
  broadcast(src) {
    const d = this.day(), h = this.hour();
    const p = G.player;
    let msg, show = null;
    if (src.tv && d <= 6 && h >= 8 && h < 13 && !G.events.powerOff) {
      show = SHOWS[Math.floor(d + h) % SHOWS.length];
      msg = show[0] + ': "' + R.pick(show[2]) + '"';
    } else {
      const pool = BROADCASTS.filter(b => b[0] <= d && b[0] >= d - 1);
      msg = pool.length ? R.pick(pool)[1] : '*static*';
      if (d > 7) msg = '*static*';
    }
    Fx.text(src.x, src.y, msg.length > 70 ? msg.slice(0, 68) + '…' : msg, src.tv ? '#bfe0ff' : '#e0ffbf', 6);
    UI.log((src.tv ? '[TV] ' : '[Radio] ') + msg);
    p.st.boredom = Math.max(0, p.st.boredom - 4);
    if (show) Player.xp(show[1], 6);
  },
  ageItem(it, gm, cold, heat, c) {
    const d = ITEMS[it.id];
    if (d.fresh !== undefined && it.age !== undefined && !it.frozen) it.age += gm / 60 * (cold ? 0.22 : 1);
    if (heat) {
      if (d.cook && !it.burnt) {
        it.cookT = (it.cookT || 0) + gm;
        if (!it.cooked && it.cookT >= d.cook) { it.cooked = true; if (G.player && c && c.px !== undefined && U.dist(G.player.x, G.player.y, c.px, c.py) < 8) { Player.say(ITEMS[it.id].n + ' is cooked.', '#8f8'); Player.xp('Cooking', 3); } }
        if (it.cookT >= d.cook * 2.6) {
          it.burnt = true;
          if (G.player && c && c.px !== undefined && U.dist(G.player.x, G.player.y, c.px, c.py) < 8) Player.say('Something is burning!', '#f99');
          // forgotten food on a hot stove can start a kitchen fire
          if (c && c.px !== undefined && R.chance(0.3)) { const o = World.obj(c.px, c.py); if (o && o.t === 'stove') Fire.ignite(c.px, c.py, 0.5, 10); }
        }
      }
      if (d.fluid && it.fl > 0 && it.taint) { it.boilT = (it.boilT || 0) + gm; if (it.boilT >= 6) { it.taint = false; it.boilT = 0; } }
    }
  },
};

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------
const Weather = {
  drops: [],
  update(dt, gm) {
    const w = G.weather;
    if (G.time >= w.next) {
      const r = R.next();
      if (r < 0.6) { w.target = 0; w.storm = false; }
      else if (r < 0.88) { w.target = R.f(0.25, 0.6); w.storm = false; }
      else { w.target = R.f(0.75, 1); w.storm = true; }
      w.next = G.time + R.int(90, 480);
      w.tOff = R.f(-3.5, 3.5);
      const h = Game.hour();
      if (h > 4 && h < 9 && R.chance(0.35)) w.fogT = R.f(0.3, 0.8); else w.fogT = 0;
    }
    w.rain += (w.target - w.rain) * Math.min(1, gm * 0.03);
    w.fog += (w.fogT - w.fog) * Math.min(1, gm * 0.02);
    if (Game.hour() > 10) w.fogT = 0;
    const h = Game.hour();
    Season.doy = Season.date().doy;
    w.temp = Season.temp(h) + (w.tOff || 0) - w.rain * 4;
    // snow cover builds while it snows and melts above freezing
    if (w.snow === undefined) w.snow = 0;
    if (w.rain > 0.03 && w.temp < 1) w.snow = Math.min(1, w.snow + w.rain * gm * 0.005);
    else if (w.snow > 0 && w.temp > 1) w.snow = Math.max(0, w.snow - ((w.temp - 1) * 0.0007 + w.rain * 0.004) * gm);
    if (w.storm && w.rain > 0.6) {
      w.thunderT -= dt;
      if (w.thunderT <= 0) {
        w.thunderT = R.f(8, 30);
        G.light.flash = 1;
        setTimeout(() => Sfx.play('thunder'), R.f(300, 2500) / Math.max(1, G.speed));
      }
    }
    Sfx.rain(w.temp < 1 ? w.rain * 0.15 : w.rain, G.player && !World.outdoor(G.player.x, G.player.y));
    this.fireT = (this.fireT || 0) - dt;
    if (this.fireT <= 0) {
      this.fireT = 0.25; const p = G.player;
      Sfx.fire(p && !p.dead && Wd.fire && Wd.fire.size ? Fire.near(p.x, p.y, 7) : 0);
      let flies = 0;
      if (p && !p.dead) for (const z of Zombie.near(p.x, p.y, 6)) if (z.dead) flies += Zombie.rot(z) * (1 - U.dist(z.x, z.y, p.x, p.y) / 6);
      Sfx.flies(flies); G.stench = flies;
    }
  },
  drawScreen(ctx, W, H, dt) {
    const w = G.weather;
    const p = G.player;
    if (w.fog > 0.02) { ctx.fillStyle = 'rgba(170,178,186,' + (w.fog * 0.35 * Math.max(0.3, G.light.amb)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    const indoor = p && !World.outdoor(p.x, p.y) && !p.inCar;
    const sp = Math.min(dt, 0.05);
    if (w.rain < 0.03) this.drops.length = 0;
    else if (w.temp < 1) {
      // snowfall: slow drifting flakes
      const n = Math.floor(w.rain * 320 * Settings.v.weather);
      while (this.drops.length < n) this.drops.push({ x: Math.random() * W, y: Math.random() * H, l: R.f(1.2, 2.8), v: R.f(40, 90), ph: R.f(0, 6) });
      if (this.drops.length > n) this.drops.length = n;
      ctx.fillStyle = 'rgba(240,244,250,' + ((indoor ? 0.25 : 0.8) * (0.45 + G.light.amb * 0.55)).toFixed(3) + ')';
      const t = performance.now() / 1000;
      for (const d of this.drops) {
        if (d.ph === undefined) d.ph = R.f(0, 6);
        d.y += d.v * sp * 0.6; d.x += Math.sin(t * 1.3 + d.ph) * 18 * sp - 12 * sp;
        if (d.y > H) { d.y = -5; d.x = Math.random() * (W + 60); }
        if (d.x < -10) d.x = W + 5;
        ctx.fillRect(d.x, d.y, d.l, d.l);
      }
    } else {
      const n = Math.floor(w.rain * 260 * Settings.v.weather);
      while (this.drops.length < n) this.drops.push({ x: Math.random() * W, y: Math.random() * H, l: R.f(10, 22), v: R.f(700, 1000) });
      if (this.drops.length > n) this.drops.length = n;
      ctx.strokeStyle = 'rgba(170,190,215,' + ((indoor ? 0.12 : 0.32) * (0.4 + G.light.amb * 0.6)).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this.drops) {
        if (d.l < 5) d.l = R.f(10, 22), d.v = R.f(700, 1000);
        d.y += d.v * sp; d.x -= d.v * sp * 0.18;
        if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 100); }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.18, d.y - d.l);
      }
      ctx.stroke();
    }
    // helicopter shadow & searchlight
    const hl = G.events.heli;
    if (hl) {
      const [sx, sy] = Render.toScreen(hl.x, hl.y, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 60 * Render.cam.zoom, 25 * Render.cam.zoom, 0, 0, 7); ctx.fill();
      if (G.light.amb < 0.5) { const g = ctx.createRadialGradient(sx, sy, 5, sx, sy, 90); g.addColorStop(0, 'rgba(255,255,230,0.35)'); g.addColorStop(1, 'rgba(255,255,230,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 90, 0, 7); ctx.fill(); }
    }
  },
};

// ---------------------------------------------------------------------------
// Save / Load (localStorage, gzip-compressed when available)
// ---------------------------------------------------------------------------
const Save = {
  KEY: 'hollowcreek_save_v1',
  exists() { try { return !!localStorage.getItem(this.KEY); } catch (e) { return false; } },
  meta() { try { const m = localStorage.getItem(this.KEY + '_meta'); return m ? JSON.parse(m) : null; } catch (e) { return null; } },
  wipe() { try { localStorage.removeItem(this.KEY); localStorage.removeItem(this.KEY + '_meta'); } catch (e) { /* ignore */ } },
  serialize() {
    const w = Wd, p = G.player;
    const objs = [];
    for (let i = 0; i < w.obj.length; i++) if (w.obj[i]) objs.push([i, w.obj[i]]);
    const u8 = (a) => Bin.toB64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    const pl = Object.assign({}, p, { action: null, queue: [], path: null, onArrive: null, swing: null, climb: null, inCar: p.inCar ? p.inCar.id : null, lastFov: null, sleepBed: null });
    const rd = (v) => Math.round(v * 100) / 100;
    const zs = G.zombies.map(z => {
      const o = Object.assign({}, z);
      delete o.path; delete o.obE; delete o.obTo; delete o.cFrom; delete o.dcOk;
      if (!o.keepLook) delete o.look; // rebuilt from clothes on load
      o.x = rd(o.x); o.y = rd(o.y); o.tx = rd(o.tx); o.ty = rd(o.ty); o.a = rd(o.a); o.ph = rd(o.ph || 0); o.hp = rd(o.hp);
      return o;
    });
    return {
      v: 1, time: G.time, seed: G.seed, events: G.events, weather: G.weather, alarms: G.alarms, sb: G.sb,
      uid: _uid, zid: _zid, cid: _carId, kills: p.kills,
      world: {
        w: w.w, h: w.h, gw: w.gw, stairs: w.stairs, floor: u8(w.floor), fvar: u8(w.fvar), deco: u8(w.deco), wallN: u8(w.wallN), wallW: u8(w.wallW), room: u8(w.room), seen: u8(w.seen),
        objs, items: [...w.items.entries()], feat: [...w.feat.entries()], edgeHp: [...w.edgeHp.entries()],
        fire: w.fire ? [...w.fire.entries()] : [], charred: w.charred ? [...w.charred] : [],
        buildings: w.buildings, rooms: w.rooms, decals: w.decals.slice(-200), forage: [...w.forage.entries()], labels: w.labels, zones: w.zones,
      },
      player: pl, zombies: zs, cars: G.cars,
    };
  },
  async save(auto) {
    if (!G.player || G.player.dead) return false;
    try {
      const json = JSON.stringify(this.serialize());
      let data = 'J' + json;
      if (window.CompressionStream) {
        const cs = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
        const buf = new Uint8Array(await new Response(cs).arrayBuffer());
        data = 'Z' + Bin.toB64(buf);
      }
      localStorage.setItem(this.KEY, data);
      localStorage.setItem(this.KEY + '_meta', JSON.stringify({ name: G.player.name, day: Game.day() + 1, time: Game.timeStr(), date: Game.dateStr(), kills: G.player.kills, saved: Date.now() }));
      if (!auto) UI.toast('Game saved');
      return true;
    } catch (e) {
      console.error(e);
      if (!auto) UI.toast('Save failed: ' + e.message);
      return false;
    }
  },
  async load() {
    const raw = localStorage.getItem(this.KEY);
    if (!raw) return false;
    let json;
    if (raw[0] === 'Z') {
      const buf = Bin.fromB64(raw.slice(1));
      const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
      json = await new Response(ds).text();
    } else json = raw.slice(1);
    const s = JSON.parse(json);
    const sw = s.world;
    const w = World.create(sw.w, sw.h, sw.gw);
    w.stairs = sw.stairs || [];
    const into = (arr, b64) => { const b = Bin.fromB64(b64); new Uint8Array(arr.buffer).set(b); };
    into(w.floor, sw.floor); into(w.fvar, sw.fvar); into(w.deco, sw.deco); into(w.wallN, sw.wallN); into(w.wallW, sw.wallW); into(w.room, sw.room); into(w.seen, sw.seen);
    for (const [i, o] of sw.objs) w.obj[i] = o;
    w.items = new Map(sw.items); w.feat = new Map(sw.feat); w.edgeHp = new Map(sw.edgeHp);
    w.buildings = sw.buildings; w.rooms = sw.rooms; w.decals = sw.decals; w.forage = new Map(sw.forage); w.labels = sw.labels; w.zones = sw.zones;
    w.powerGens = [];
    w.fire = new Map(sw.fire || []); w.charred = new Set(sw.charred || []);
    World.use(w);
    G.conts = new Set();
    for (let i = 0; i < w.obj.length; i++) {
      const o = w.obj[i];
      if (!o) continue;
      if (o.t === 'generator') { o.x = i % w.w; o.y = (i / w.w) | 0; w.powerGens.push(o); }
      if (o.c && o.c.items) { o.c.px = i % w.w; o.c.py = (i / w.w) | 0; G.conts.add(o.c); }
    }
    G.time = s.time; G.seed = s.seed; G.events = s.events; G.weather = s.weather; G.alarms = s.alarms || [];
    G.sb = s.sb || sandboxValues({});
    MIN_PER_SEC = 24 * 60 / (G.sb.day * 3600);
    Items.setUidBase(s.uid); _zid = s.zid; _carId = s.cid;
    G.cars = s.cars;
    Vehicles.active = null;
    if (typeof CarArt !== 'undefined' && CarArt.flush) CarArt.flush();
    G.zombies = s.zombies;
    for (const z of G.zombies) { if (z.st === 'thump' || z.st === 'climb') z.st = 'idle'; z.path = null; if (!z.look) z.look = Zombie.computeLook(z); }
    const p = s.player;
    p.inCar = p.inCar ? G.cars.find(c => c.id === p.inCar) || null : null;
    p.action = null; p.queue = []; p.halo = []; p.fovT = 0;
    for (const sk in SKILL_NAMES) if (!p.skills[sk]) p.skills[sk] = { lv: 0, xp: 0 };
    G.player = p;
    G.speed = 1; G.paused = false; G.corpse = false; G.build = null; G.hover = null;
    Combat.projs = []; Combat.sources = []; Fx.parts = []; Fx.fires = []; Fx.floats = [];
    Render.cam.x = vxOf(p.x); Render.cam.y = p.y; Render.cam.z = p.x >= LV.W0 && !p.inCar ? WALL_H : 0;
    Zombie.rebuildGrid();
    Player.fov(1);
    Game.lastSave = G.time;
    G.mode = 'play';
    return true;
  },
};
