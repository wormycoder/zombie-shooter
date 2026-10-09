'use strict';
// ---------------------------------------------------------------------------
// Debug mode in the spirit of Project Zomboid's: cheats, item/zombie/vehicle spawners, world and player
// editors, overlays and performance graphs in one draggable window.
// Switch it on with ?debug, F2 or the ` key, or the switch on the title screen and in the pause menu.
// While it is off nothing here runs except two input listeners; turning it off clears every cheat.
// Gameplay code checks the cheat flags below (god, invisible, ghost, instant, build, noTire, speed).
// ---------------------------------------------------------------------------
const DBG_FLAGS = [
  ['god', 'God mode', 'No damage, no wounds, no death'],
  ['invisible', 'Invisible', 'Zombies cannot see you (they still hear noise)'],
  ['ghost', 'Ghost (no-clip)', 'Walk through walls, furniture and water'],
  ['noTire', 'Unlimited endurance', 'Running and fighting never tire you'],
  ['noNeeds', 'No hunger, thirst or tiredness', 'Needs stay at zero'],
  ['infAmmo', 'Infinite ammo', 'Guns in your hands stay loaded'],
  ['instant', 'Instant actions', 'Timed actions finish at once'],
  ['build', 'Free building', 'Build without materials or skills'],
  ['bright', 'Full bright', 'Light everything as at noon'],
  ['freeze', 'Freeze zombies', 'Zombie AI stops (they stand still)'],
];
const DBG_OVERLAYS = [
  ['chunks', 'Chunk grid', '8x8-tile chunks tinted by update tier: full rate, half-rate zombies (3+), half-rate world (6+), frozen (12+)'],
  ['cursor', 'Tile info', 'Floor, object, walls, room, light and chunk of the tile under the cursor'],
  ['rooms', 'Rooms and buildings', 'Room areas with their type and id, building outlines'],
  ['solid', 'Collision', 'Solid tiles and blocking walls; doors and windows by state'],
  ['ai', 'Zombie AI', 'States, targets, paths and lines of sight'],
  ['noise', 'Noise events', 'Sounds zombies can hear, with their radius'],
  ['light', 'Light levels', 'Raw light per tile (numbers when zoomed in)'],
  ['vis', 'Vision', 'Tiles in view (blue) and remembered tiles'],
];
const DBG_TABS = [['cheats', 'Cheats'], ['items', 'Items'], ['zombies', 'Zombies'], ['cars', 'Vehicles'], ['world', 'World'], ['player', 'Player'], ['overlays', 'Overlays'], ['perf', 'Stats']];
const DBG_KITS = [
  ['Melee', ['BaseballBat', 'Crowbar', 'Axe', 'KitchenKnife', 'Machete', 'Sledgehammer']],
  ['Guns', ['Pistol', 'Bullets9mm', 'Bullets9mm', 'Shotgun', 'ShotgunShells', 'ShotgunShells', 'HuntingRifle', 'Bullets308']],
  ['Medical', ['Bandage', 'Bandage', 'Bandage', 'Disinfectant', 'Painkillers', 'Antibiotics', 'SutureNeedle', 'Tweezers']],
  ['Food', ['CannedBeans', 'CannedBeans', 'CannedSoup', 'CanOpener', 'WaterBottle', 'WaterBottle', 'Chips', 'Apple']],
  ['Tools', ['Hammer', 'Nails', 'Nails', 'Saw', 'Screwdriver', 'Wrench', 'Plank', 'Plank', 'Plank', 'Flashlight', 'Lighter']],
  ['Bags', ['HikingBag', 'DuffelBag', 'SchoolBag']],
];
const DBG_STATS = [['hunger', 1], ['thirst', 1], ['fatigue', 1], ['endurance', 1], ['panic', 100], ['stress', 1], ['boredom', 1], ['unhappy', 1], ['wet', 1], ['drunk', 1], ['foodSick', 1]];
const DBG_ZCOL = { idle: '#a8a8a8', wander: '#e8e8e8', investigate: '#f0d050', chase: '#ff5a4a', attack: '#ff4ad0', thump: '#ff9a3a', climb: '#5ad8ff', down: '#6a8aff', getup: '#6a8aff', dead: '#555' };

const Debug = {
  on: false,
  // cheats read by player.js / zombie.js / actions.js / crafting.js
  god: false, invisible: false, ghost: false, instant: false, build: false, noTire: false, speed: 1,
  // cheats applied here
  noNeeds: false, infAmmo: false, bright: false, freeze: false,
  ov: { chunks: true, cursor: true, rooms: false, solid: false, ai: false, noise: false, light: false, vis: false },
  tab: 'cheats', shown: false, pos: null, place: null, hooked: false, orig: [],
  q: { items: '', cat: '', qty: 1, zn: 10, zOutfit: '', zState: 'idle', zSpeed: '', zCrawl: false, zr: 15, car: 'sedan', col: '', fuel: 0.8, cond: 'new', head: 'auto', alarm: false, part: 'ForeArmL', wound: 'scratch', tx: '', ty: '' },
  noises: [], hist: [], simAcc: 0, rendAcc: 0, uiAcc: 0, lastT: 0,

  // ------------------------------------------------------------------ boot & persistence
  init() {
    try { const s = JSON.parse(localStorage.getItem('hc_debug') || 'null'); if (s) { this.on = !!s.on; this.shown = !!s.shown; this.tab = s.tab || 'cheats'; this.pos = s.pos || null; Object.assign(this.ov, s.ov || {}); } } catch (e) { /* ignore */ }
    if (/[?&]debug\b/.test(location.search)) { this.on = true; this.shown = true; }
    window.addEventListener('keydown', (e) => this.key(e), true);
    window.addEventListener('mousedown', (e) => this.mouse(e), true);
    // switches on the title screen and in the pause menu
    const show = Menu.show, pause = UI.togglePause;
    Menu.show = function () { const r = show.apply(this, arguments); Debug.mountTitle(); return r; };
    UI.togglePause = function () { const r = pause.apply(this, arguments); Debug.mountPause(); return r; };
    if (this.on) this.hook();
    this.render();
  },
  save() { try { localStorage.setItem('hc_debug', JSON.stringify({ on: this.on, shown: this.shown, tab: this.tab, pos: this.pos, ov: this.ov })); } catch (e) { /* ignore */ } },
  enable(v) {
    this.on = v;
    if (v) { this.hook(); this.shown = true; }
    else { this.unhook(); for (const [k] of DBG_FLAGS) this[k] = false; this.speed = 1; this.place = null; this.shown = false; }
    this.save(); this.render(); this.mountTitle(); this.mountPause();
  },
  // timing and cheat hooks, installed only while debug mode is on
  hook() {
    if (this.hooked) return;
    this.hooked = true;
    const D = this, wrap = (obj, name, mk) => { const f = obj[name]; D.orig.push([obj, name, f]); obj[name] = mk(f); };
    wrap(Game, 'step', (f) => function (dt) { const t = performance.now(); f.call(this, dt); D.afterStep(); D.simAcc += performance.now() - t; });
    wrap(Render, 'frame', (f) => function (dt) { const t = performance.now(); f.call(this, dt); D.rendAcc += performance.now() - t; });
    wrap(UI, 'update', (f) => function () { const t = performance.now(); const r = f.apply(this, arguments); D.uiAcc += performance.now() - t; return r; });
    wrap(Zombie, 'updateAll', (f) => function (dt) { if (D.freeze) { this.rebuildGrid(); return; } return f.call(this, dt); });
    wrap(Game, 'updateLight', (f) => function (dt) { f.call(this, dt); if (D.bright) { G.light.amb = 1; G.light.night = false; } });
    wrap(Noise, 'emit', (f) => function (x, y, r, kind) { if (D.ov.noise) { D.noises.push({ x, y, r, kind, t: performance.now() }); if (D.noises.length > 80) D.noises.shift(); } return f.apply(this, arguments); });
    clearInterval(this.liveT);
    this.liveT = setInterval(() => this.live(), 250);
  },
  unhook() {
    for (let i = this.orig.length - 1; i >= 0; i--) { const [o, n, f] = this.orig[i]; o[n] = f; }
    this.orig = []; this.hooked = false;
    clearInterval(this.liveT); this.liveT = 0;
  },
  afterStep() {
    const p = G.player;
    if (!p || p.dead) return;
    if (this.noNeeds) { const st = p.st; if (st.hunger > 0.02) st.hunger = 0.02; if (st.thirst > 0.02) st.thirst = 0.02; if (st.fatigue > 0.02) st.fatigue = 0.02; }
    if (this.infAmmo) for (const it of [Player.primary(), Player.secondary()]) { const g = it && ITEMS[it.id].gun; if (g && it.ammo < g.cap) it.ammo = g.cap; }
    if (this.god && p.health < 100) p.health = 100;
  },

  // ------------------------------------------------------------------ input
  key(e) {
    const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    if (e.key === 'F2' || (e.code === 'Backquote' && !typing)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!this.on) this.enable(true); else { this.shown = !this.shown; this.save(); this.render(); }
      return;
    }
    if (this.place && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.place = null; this.render(); }
  },
  mouse(e) {
    if (!this.on || G.mode !== 'play' || !G.player) return;
    const onWorld = e.target === Render.cv, onMap = !!(e.target.classList && e.target.classList.contains('mapc'));
    if (!onWorld && !onMap) return;
    if (this.place && (onWorld || this.place.map)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.button === 2) { this.place = null; this.render(); return; }
      if (e.button !== 0) return;
      const t = onMap ? this.mapTile(e) : this.worldAt(e.clientX, e.clientY);
      if (t) this.place.fn(t[0], t[1]);
      // Shift keeps placing
      if (!e.shiftKey) this.place = null;
      this.render();
      return;
    }
    if (e.button === 0 && e.ctrlKey) {
      e.preventDefault(); e.stopImmediatePropagation();
      const t = onMap ? this.mapTile(e) : this.worldAt(e.clientX, e.clientY);
      if (t) this.teleport(t[0], t[1]);
    }
  },
  worldAt(sx, sy) { Input.mx = sx; Input.my = sy; return Render.mouseWorld(); },
  mapTile(e) {
    const r = e.target.getBoundingClientRect();
    return [(e.clientX - r.left - r.width / 2) / MapView.zoom + MapView.cx, (e.clientY - r.top - r.height / 2) / MapView.zoom + MapView.cy];
  },
  startPlace(label, fn, map) { this.place = { label, fn, map: !!map }; UI.hint && UI.hint(label + ' — click to place, Shift+click for more, right-click or Esc to stop', 4); },

  // ------------------------------------------------------------------ actions
  free(x, y) {
    let tx = Math.floor(x), ty = Math.floor(y);
    const ok = (a, b) => World.inb(a, b) && !World.tileSolid(a, b) && !World.isWater(a, b) && World.floor(a, b) !== FL.VOID;
    if (ok(tx, ty)) return [tx, ty];
    for (let r = 1; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(tx + dx, ty + dy)) return [tx + dx, ty + dy];
    return null;
  },
  teleport(x, y) {
    const p = G.player; if (!p || p.dead) return;
    const t = this.free(x, y); if (!t) { Player.say("Can't go there.", '#ccc'); return; }
    if (p.inCar) { const c = p.inCar; c.x = t[0] + 0.5; c.y = t[1] + 0.5; c.v = 0; c.vs = 0; }
    if (p.asleep) Player.wakeUp();
    Actions.cancel(true);
    p.x = t[0] + 0.5; p.y = t[1] + 0.5; p.path = null;
    Render.cam.x = p.inCar ? p.x : vxOf(p.x); Render.cam.y = p.y;
    Vehicles.active = null;
    Player.fov(1);
  },
  near(r, alive) { const p = G.player; return G.zombies.filter(z => (alive ? !z.dead : true) && World.lvDist(z.x, z.y, p.x, p.y) <= r); },
  spawnZombie(x, y) {
    const q = this.q, t = this.free(x, y); if (!t) return null;
    const z = Zombie.create(t[0] + R.f(0.2, 0.8), t[1] + R.f(0.2, 0.8), q.zOutfit || undefined);
    if (q.zSpeed === 'shambler') z.speed = R.f(0.62, 0.95); else if (q.zSpeed === 'fast') z.speed = R.f(1.25, 1.65); else if (q.zSpeed === 'sprinter') z.speed = R.f(2.7, 3.3);
    if (q.zCrawl) z.crawl = true;
    const p = G.player;
    if (q.zState === 'chase') { z.st = 'chase'; z.tx = p.x; z.ty = p.y; z.mem = 12; z.canSee = true; }
    else if (q.zState === 'wander') { z.st = 'wander'; z.tx = z.x + R.f(-5, 5); z.ty = z.y + R.f(-5, 5); }
    G.zombies.push(z);
    return z;
  },
  horde(x, y, n) {
    let k = 0;
    const rad = 0.6 + Math.sqrt(n) * 0.55;
    for (let i = 0; i < n * 3 && k < n; i++) { const a = R.f(0, Math.PI * 2), d = Math.sqrt(R.next()) * rad; if (this.spawnZombie(x + Math.cos(a) * d, y + Math.sin(a) * d)) k++; }
    return k;
  },
  spawnCar(x, y) {
    const q = this.q, p = G.player, T = CAR_TYPES[q.car]; if (!T) return;
    const a = q.head === 'auto' ? Math.atan2(y - p.y, vxOf(x) - vxOf(p.x)) : +q.head * Math.PI / 180;
    const c = Vehicles.mk(q.car, vxOf(x), y, a);
    if (q.col) c.col = q.col;
    if (q.cond === 'used') Vehicles.condition(c, {});
    else if (q.cond === 'wreck') Vehicles.condition(c, { crashed: true });
    else if (q.cond === 'burnt') Vehicles.condition(c, { burnt: true });
    if (q.cond !== 'burnt') { c.gas = +q.fuel; c.locked = false; c.keyIn = true; c.alarm = !!q.alarm; c.charge = 1; }
    Vehicles.recalc(c);
    G.cars.push(c);
    Vehicles.active = null;
    if (Vehicles.overlapsCar(c, 0.1)) UI.hint('Placed overlapping another car', 2);
  },
  nearCar() {
    const p = G.player; if (!p) return null;
    if (p.inCar) return p.inCar;
    let best = null, bd = 7;
    for (const c of G.cars) { const d = U.dist(c.x, c.y, vxOf(p.x), p.y); if (d < bd) { bd = d; best = c; } }
    if (!best) UI.hint('No car within 7 tiles', 2);
    return best;
  },
  weather(kind) {
    const w = G.weather;
    w.next = G.time + 720;
    w.storm = false; w.tOff = 0; w.fogT = 0;
    if (kind === 'clear') { w.target = 0; w.rain = 0; w.fog = 0; }
    else if (kind === 'rain') { w.target = 0.5; w.rain = 0.5; }
    else if (kind === 'storm') { w.target = 0.95; w.rain = 0.95; w.storm = true; w.thunderT = 1; }
    else if (kind === 'snow') { w.target = 0.6; w.rain = 0.6; w.tOff = -(Season.temp(Game.hour()) + 5); w.snow = Math.max(w.snow || 0, 0.5); }
    else if (kind === 'fog') { w.target = 0; w.rain = 0; w.fogT = 0.85; w.fog = 0.85; }
    Render.chunks.clear();
  },
  healAll() {
    const p = G.player;
    for (const pt of PARTS) p.body[pt] = { w: {}, bandage: null, infect: 0, disinf: 0, glass: false, stitched: false };
    p.health = 100; p.infection = null;
    Object.assign(p.st, { hunger: 0, thirst: 0, fatigue: 0, endurance: 1, panic: 0, stress: 0, boredom: 0, unhappy: 0, foodSick: 0, wet: 0, temp: 37, drunk: 0, cold: 0, coldT: 0, poison: 0 });
  },
  act(a, d) {
    const p = G.player, q = this.q;
    if (a === 'col') { q.col = d.v; return; }
    if (!p || G.mode !== 'play') return;
    const give = (id, n) => { for (let i = 0; i < n; i++) { const it = Items.make(id); if (it) p.inv.push(it); } };
    switch (a) {
      case 'speed': this.speed = +d.v; break;
      case 'time': G.speed = +d.v; G.paused = false; break;
      case 'give': give(d.id, Math.max(1, Math.min(50, q.qty | 0))); UI.hint('Added ' + ITEMS[d.id].n + (q.qty > 1 ? ' x' + q.qty : ''), 1.5); break;
      case 'drop': for (let i = 0; i < Math.max(1, Math.min(50, q.qty | 0)); i++) { const it = Items.make(d.id); if (it) World.dropItem(p.x, p.y, it); } break;
      case 'kit': { const k = DBG_KITS.find(x => x[0] === d.k); for (const id of k[1]) if (ITEMS[id]) give(id, 1); UI.hint(k[0] + ' kit added', 1.5); break; }
      case 'zplace': this.startPlace('Spawn ' + q.zn + ' zombie' + (q.zn > 1 ? 's' : ''), (x, y) => this.horde(x, y, q.zn | 0 || 1)); break;
      case 'zring': { let k = 0; for (let i = 0; i < (q.zn | 0 || 1) * 3 && k < (q.zn | 0 || 1); i++) { const a2 = R.f(0, Math.PI * 2), r = R.f(9, 14); if (this.spawnZombie(p.x + Math.cos(a2) * r, p.y + Math.sin(a2) * r)) k++; } UI.hint(k + ' zombies around you', 1.5); break; }
      case 'zkill': for (const z of this.near(+q.zr, true)) Zombie.kill(z, undefined, { noKill: true }); break;
      case 'zremove': { const s = new Set(this.near(+q.zr, false)); G.zombies = G.zombies.filter(z => !s.has(z)); break; }
      case 'zdown': for (const z of this.near(+q.zr, true)) Zombie.hit(z, 0, Math.atan2(z.y - p.y, z.x - p.x), { knock: true }); break;
      case 'zaggro': for (const z of this.near(60, true)) { z.st = 'chase'; z.tx = p.x; z.ty = p.y; z.mem = 12; z.canSee = true; z.path = null; } break;
      case 'zcalm': for (const z of G.zombies) if (!z.dead && (z.st === 'chase' || z.st === 'investigate' || z.st === 'attack')) { z.st = 'idle'; z.canSee = false; z.path = null; z.mem = 0; } break;
      case 'corpses': G.zombies = G.zombies.filter(z => !z.dead); break;
      case 'carplace': this.startPlace('Place ' + CAR_TYPES[q.car].n, (x, y) => this.spawnCar(x, y)); break;
      case 'carfix': { const c = this.nearCar(); if (!c) return; for (const k of PART_KEYS) c.parts[k] = 100; c.dmg = { front: 0, rear: 0, left: 0, right: 0 }; c.burnt = false; c.charge = 1; Vehicles.recalc(c); break; }
      case 'carfuel': { const c = this.nearCar(); if (c) c.gas = 1; break; }
      case 'carkey': { const c = this.nearCar(); if (c) { c.locked = false; c.keyIn = true; c.alarm = false; } break; }
      case 'carremove': { const c = this.nearCar(); if (!c) return; if (p.inCar === c) Vehicles.exit(c, true); G.cars = G.cars.filter(o => o !== c); Vehicles.active = null; break; }
      case 'carenter': { const c = this.nearCar(); if (c && !p.inCar) { c.locked = false; Vehicles.enter(c); } break; }
      case 'skip': G.time += +d.v; break;
      case 'hour': { const h = +d.v; let t = Math.floor(G.time / 1440) * 1440 + h * 60; if (t <= G.time) t += 1440; G.time = t; break; }
      case 'weather': this.weather(d.v); break;
      case 'power': G.events.powerOff = !G.events.powerOff; if (!G.events.powerOff) G.events.powerAt = 1e12; break;
      case 'water': G.events.waterOff = !G.events.waterOff; if (!G.events.waterOff) G.events.waterAt = 1e12; break;
      case 'reveal': Wd.seen.fill(1); MapView.revealed = true; MapView.base = null; break;
      case 'fire': this.startPlace('Start a fire', (x, y) => Fire.ignite(Math.floor(x), Math.floor(y), 1)); break;
      case 'douse': if (Wd.fire) Wd.fire.clear(); Fx.fires.length = 0; break;
      case 'blood': Wd.decals.length = 0; break;
      case 'noise': this.startPlace('Make a loud noise', (x, y) => { Noise.emit(x, y, 45, 'gun'); Sfx.play('fire', x, y); }); break;
      case 'heli': G.events.heliDone = false; G.events.heli = null; G.events.heliAt = G.time; break;
      case 'tp': this.startPlace('Teleport', (x, y) => this.teleport(x, y), true); break;
      case 'tpxy': if (q.tx !== '' && q.ty !== '') this.teleport(+q.tx, +q.ty); break;
      case 'tplabel': { const l = Wd.labels[+d.v]; if (l) this.teleport(l.x, l.y + 2); break; }
      case 'heal': this.healAll(); break;
      case 'kill': { const g = this.god; this.god = false; p.health = 0; Player.die('Debug'); this.god = g; break; }
      case 'infect': p.infection = { t: 0, sym: R.f(8, 16), death: R.f(48, 72) }; break;
      case 'cure': p.infection = null; for (const pt of PARTS) p.body[pt].infect = 0; break;
      case 'wound': { const g = this.god; this.god = false; Player.addWound(q.part, q.wound, null); this.god = g; break; }
      case 'skill': { const s = p.skills[d.sk]; s.lv = U.clamp(s.lv + +d.v, 0, 10); s.xp = 0; break; }
      case 'traitdel': p.traits = p.traits.filter(t => t !== d.t); break;
      case 'traitadd': { const sel = document.querySelector('#dbgwin [data-q="trait"]'); const t = sel && sel.value; if (t && !p.traits.includes(t)) p.traits.push(t); break; }
      default: return;
    }
    UI.refresh && UI.refresh();
  },

  // ------------------------------------------------------------------ window
  chip() {
    let c = document.getElementById('dbgchip');
    const want = this.on && !this.shown;
    if (!want) { if (c) c.remove(); return; }
    if (!c) { c = document.createElement('div'); c.id = 'dbgchip'; c.title = 'Debug mode is on — F2 opens the debug window'; c.textContent = 'DEBUG · F2'; c.onclick = () => { this.shown = true; this.save(); this.render(); }; document.body.appendChild(c); }
  },
  render() {
    let el = document.getElementById('dbgwin');
    this.chip();
    if (!this.on || !this.shown) { if (el) el.remove(); return; }
    if (!el) el = this.create();
    el.querySelector('.dbg-tabs').innerHTML = DBG_TABS.map(([k, n]) => `<span class="dbg-tab ${k === this.tab ? 'on' : ''}" data-tab="${k}">${n}</span>`).join('');
    const game = G.mode === 'play' && G.player;
    const body = el.querySelector('.dbg-body');
    const st = body.scrollTop;
    body.innerHTML = (this.place ? `<div class="dbg-place">Placing: <b>${U.esc(this.place.label)}</b> — click ${this.place.map ? 'the world or the map' : 'the world'} · Shift+click for more · <span class="dbg-btn" data-act="stopplace">Stop</span></div>` : '')
      + (game || this.tab === 'overlays' ? this['tab_' + this.tab]() : '<div class="dbg-note">Start or load a game to use this tab.</div>');
    body.scrollTop = st;
    if (this.tab === 'items') this.itemList();
    this.wasGame = !!game;
    this.live();
  },
  create() {
    const el = document.createElement('div');
    el.id = 'dbgwin';
    el.innerHTML = `<div class="dbg-head"><span class="dbg-title">Debug</span><span class="dbg-hint">F2 hide · Ctrl+click world/map: teleport</span><span class="dbg-off" title="Turn debug mode off (clears all cheats)">Off</span><span class="dbg-x" title="Hide (F2)">×</span></div><div class="dbg-tabs"></div><div class="dbg-body"></div>`;
    document.body.appendChild(el);
    const P = this.pos;
    if (P) { el.style.left = U.clamp(P[0], 0, innerWidth - 120) + 'px'; el.style.top = U.clamp(P[1], 0, innerHeight - 60) + 'px'; }
    // drag by the title bar
    el.querySelector('.dbg-head').addEventListener('mousedown', (e) => {
      if (e.target.closest('.dbg-x, .dbg-off')) return;
      const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mv = (ev) => { el.style.left = U.clamp(ev.clientX - ox, 0, innerWidth - 120) + 'px'; el.style.top = U.clamp(ev.clientY - oy, 0, innerHeight - 40) + 'px'; el.style.right = 'auto'; };
      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); const r2 = el.getBoundingClientRect(); this.pos = [r2.left, r2.top]; this.save(); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      e.preventDefault();
    });
    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('.dbg-x')) { this.shown = false; this.save(); this.render(); return; }
      if (t.closest('.dbg-off')) { this.enable(false); return; }
      const tab = t.closest('[data-tab]');
      if (tab) { this.tab = tab.dataset.tab; this.save(); this.render(); return; }
      const b = t.closest('[data-act]');
      if (b) {
        if (b.dataset.act === 'stopplace') { this.place = null; this.render(); return; }
        this.act(b.dataset.act, b.dataset);
        this.render();
      }
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.flag) { this[t.dataset.flag] = t.checked; if (t.dataset.flag === 'bright' || t.dataset.flag === 'ghost') Render.chunks.clear(); }
      else if (t.dataset.ov) { this.ov[t.dataset.ov] = t.checked; this.save(); }
      else if (t.dataset.q) { this.q[t.dataset.q] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.q === 'car') { this.q.col = ''; this.render(); } if (t.dataset.q === 'cat') this.itemList(); }
    });
    el.addEventListener('input', (e) => {
      const t = e.target, p = G.player;
      if (t.dataset.q) { this.q[t.dataset.q] = t.value; if (t.dataset.q === 'items') this.itemList(); const o = t.parentNode.querySelector('.dbg-val'); if (o && t.type === 'range') o.textContent = Math.round(t.value * 100) + '%'; }
      if (t.dataset.stat && p) { p.st[t.dataset.stat] = +t.value; }
    });
    // keep game hotkeys and clicks off the window
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('wheel', (e) => e.stopPropagation());
    return el;
  },
  // rows and helpers for tab markup
  sw(attr, k, label, tip, on) { return `<label class="dbg-sw" title="${U.esc(tip || '')}"><input type="checkbox" ${attr}="${k}" ${on ? 'checked' : ''}><span class="dbg-knob"></span><span>${label}</span></label>`; },
  btn(act, label, extra, tip) { return `<span class="dbg-btn" data-act="${act}" ${extra || ''} ${tip ? `title="${U.esc(tip)}"` : ''}>${label}</span>`; },
  sec(t) { return `<div class="dbg-sec">${t}</div>`; },
  sel(k, opts, v) { return `<select data-q="${k}">${opts.map(([val, n]) => `<option value="${U.esc(String(val))}" ${String(val) === String(v) ? 'selected' : ''}>${U.esc(n)}</option>`).join('')}</select>`; },

  tab_cheats() {
    let h = this.sec('Cheats') + '<div class="dbg-grid">' + DBG_FLAGS.map(([k, n, tip]) => this.sw('data-flag', k, n, tip, this[k])).join('') + '</div>';
    h += this.sec('Movement speed') + '<div class="dbg-row">' + [1, 2, 4, 8].map(s => `<span class="dbg-btn ${this.speed === s ? 'on' : ''}" data-act="speed" data-v="${s}">×${s}</span>`).join('') + '</div>';
    h += this.sec('Time speed') + '<div class="dbg-row">' + [1, 3, 8, 20, 50].map(s => `<span class="dbg-btn ${G.speed === s && !G.paused ? 'on' : ''}" data-act="time" data-v="${s}">×${s}</span>`).join('') + '</div>';
    return h;
  },
  tab_items() {
    const cats = [...new Set(Object.values(ITEMS).map(d => d.cat))].sort();
    return this.sec('Starter kits') + '<div class="dbg-row">' + DBG_KITS.map(([k]) => this.btn('kit', k, `data-k="${k}"`)).join('') + '</div>'
      + this.sec('Item spawner') + `<div class="dbg-row"><input type="text" data-q="items" placeholder="Search ${Object.keys(ITEMS).length} items…" value="${U.esc(this.q.items)}" class="dbg-grow">`
      + this.sel('cat', [['', 'All categories'], ...cats.map(c => [c, c])], this.q.cat) + `<label class="dbg-lbl">Qty <input type="number" min="1" max="50" data-q="qty" value="${this.q.qty}" class="dbg-num"></label></div><div class="dbg-list" id="dbgitems"></div>`;
  },
  itemList() {
    const box = document.getElementById('dbgitems'); if (!box) return;
    const s = String(this.q.items || '').toLowerCase(), cat = this.q.cat;
    const all = Object.keys(ITEMS).filter(id => { const d = ITEMS[id]; return (!cat || d.cat === cat) && (!s || d.n.toLowerCase().includes(s) || id.toLowerCase().includes(s)); }).sort((a, b) => ITEMS[a].n.localeCompare(ITEMS[b].n));
    const L = all.slice(0, 160);
    box.innerHTML = L.map(id => `<div class="dbg-item"><img src="${Icons.url({ id })}"><span class="dbg-in">${U.esc(ITEMS[id].n)}</span><span class="dbg-ic">${U.esc(ITEMS[id].cat)}</span>${this.btn('give', 'Add', `data-id="${id}"`, 'Add to inventory')}${this.btn('drop', 'Drop', `data-id="${id}"`, 'Drop at your feet')}</div>`).join('')
      + (all.length > L.length ? `<div class="dbg-note">${all.length - L.length} more — refine the search</div>` : '') + (!all.length ? '<div class="dbg-note">No items match.</div>' : '');
  },
  tab_zombies() {
    const q = this.q;
    return this.sec('Spawn')
      + `<div class="dbg-row"><label class="dbg-lbl">Count <input type="number" min="1" max="300" data-q="zn" value="${q.zn}" class="dbg-num"></label>`
      + this.sel('zOutfit', [['', 'Civilian'], ['police', 'Police'], ['military', 'Military'], ['medic', 'Medic']], q.zOutfit)
      + this.sel('zSpeed', [['', 'Sandbox speed'], ['shambler', 'Shambler'], ['fast', 'Fast shambler'], ['sprinter', 'Sprinter']], q.zSpeed)
      + this.sel('zState', [['idle', 'Idle'], ['wander', 'Wandering'], ['chase', 'Hunting you']], q.zState)
      + `<label class="dbg-lbl"><input type="checkbox" data-q="zCrawl" ${q.zCrawl ? 'checked' : ''}> Crawlers</label></div>`
      + '<div class="dbg-row">' + this.btn('zplace', 'Place at cursor…', '', 'Click the world to drop them there') + this.btn('zring', 'Ring around me', '', '9-14 tiles away') + '</div>'
      + this.sec('Nearby') + `<div class="dbg-row"><label class="dbg-lbl">Radius <input type="number" min="1" max="200" data-q="zr" value="${q.zr}" class="dbg-num"></label>`
      + this.btn('zkill', 'Kill') + this.btn('zdown', 'Knock down') + this.btn('zremove', 'Remove', '', 'Delete alive and dead') + '</div>'
      + '<div class="dbg-row">' + this.btn('zaggro', 'All hunt me', '', 'Every zombie within 60 tiles') + this.btn('zcalm', 'Calm everyone') + this.btn('corpses', 'Clear corpses') + this.sw('data-flag', 'freeze', 'Freeze AI', '', this.freeze) + '</div>'
      + this.sec('Population') + '<div class="dbg-kv"><span>Alive</span><b data-live="zalive"></b><span>Corpses</span><b data-live="zdead"></b><span>Within 32 tiles</span><b data-live="znear"></b><span>Updated last step</span><b data-live="zupd"></b><span>Hunting you</span><b data-live="zchase"></b></div>';
  },
  tab_cars() {
    const q = this.q, T = CAR_TYPES[q.car] || CAR_TYPES.sedan;
    return this.sec('Vehicle spawner')
      + '<div class="dbg-row">' + this.sel('car', Object.keys(CAR_TYPES).map(k => [k, CAR_TYPES[k].n]), q.car)
      + this.sel('cond', [['new', 'Like new'], ['used', 'Used'], ['wreck', 'Crashed'], ['burnt', 'Burnt-out']], q.cond)
      + this.sel('head', [['auto', 'Facing away from me'], ['0', 'Heading 0°'], ['90', 'Heading 90°'], ['180', 'Heading 180°'], ['270', 'Heading 270°']], q.head) + '</div>'
      + '<div class="dbg-row dbg-cols">' + `<span class="dbg-col ${!q.col ? 'on' : ''}" data-act="col" data-v="" title="Random">?</span>` + T.cols.map(c => `<span class="dbg-col ${q.col === c ? 'on' : ''}" data-act="col" data-v="${c}" style="background:${c}"></span>`).join('') + '</div>'
      + `<div class="dbg-row"><label class="dbg-lbl">Fuel <input type="range" min="0" max="1" step="0.05" data-q="fuel" value="${q.fuel}"><span class="dbg-val">${Math.round(q.fuel * 100)}%</span></label><label class="dbg-lbl"><input type="checkbox" data-q="alarm" ${q.alarm ? 'checked' : ''}> Alarm</label></div>`
      + '<div class="dbg-row">' + this.btn('carplace', 'Place at cursor…', '', 'Unlocked, key in the ignition') + '</div>'
      + this.sec('Nearest car (or the one you are in)') + '<div class="dbg-row">' + this.btn('carfix', 'Repair') + this.btn('carfuel', 'Fill tank') + this.btn('carkey', 'Unlock + key') + this.btn('carenter', 'Get in') + this.btn('carremove', 'Remove') + '</div>'
      + '<div class="dbg-kv"><span>Cars</span><b data-live="cars"></b><span>Active (near you)</span><b data-live="carsact"></b><span>Nearest</span><b data-live="carnear"></b></div>';
  },
  tab_world() {
    const ev = G.events || {};
    const labels = (Wd.labels || []).map((l, i) => [i, l.text]).sort((a, b) => a[1].localeCompare(b[1]));
    return this.sec('Time') + '<div class="dbg-kv"><span>Now</span><b data-live="date"></b></div>'
      + '<div class="dbg-row">' + [6, 9, 12, 15, 18, 21, 0, 3].map(h => this.btn('hour', String(h).padStart(2, '0') + ':00', `data-v="${h}"`, 'Jump forward to this hour')).join('') + '</div>'
      + '<div class="dbg-row">' + [['+1 h', 60], ['+6 h', 360], ['+1 day', 1440], ['+1 week', 10080], ['+1 month', 43200]].map(([n, v]) => this.btn('skip', n, `data-v="${v}"`)).join('') + '</div>'
      + this.sec('Weather') + '<div class="dbg-row">' + [['clear', 'Clear'], ['rain', 'Rain'], ['storm', 'Storm'], ['snow', 'Snow'], ['fog', 'Fog']].map(([k, n]) => this.btn('weather', n, `data-v="${k}"`)).join('') + '<span class="dbg-sml" data-live="wx"></span></div>'
      + this.sec('Utilities and events') + '<div class="dbg-row">' + this.btn('power', ev.powerOff ? 'Power: OFF' : 'Power: ON', `class="${ev.powerOff ? '' : 'on'}"`) + this.btn('water', ev.waterOff ? 'Water: OFF' : 'Water: ON') + this.btn('heli', 'Helicopter now') + this.btn('noise', 'Loud noise at cursor…') + '</div>'
      + this.sec('Map and cleanup') + '<div class="dbg-row">' + this.btn('reveal', 'Reveal map') + this.btn('fire', 'Fire at cursor…') + this.btn('douse', 'Put out all fires') + this.btn('corpses', 'Clear corpses') + this.btn('blood', 'Clear blood') + '</div>'
      + this.sec('Teleport') + '<div class="dbg-row">' + this.btn('tp', 'Click world or map…', '', 'Ctrl+click also teleports at any time') + `<input type="number" data-q="tx" placeholder="x" value="${this.q.tx}" class="dbg-num"><input type="number" data-q="ty" placeholder="y" value="${this.q.ty}" class="dbg-num">` + this.btn('tpxy', 'Go') + '</div>'
      + (labels.length ? '<div class="dbg-row dbg-places">' + labels.map(([i, t]) => this.btn('tplabel', U.esc(t), `data-v="${i}"`)).join('') + '</div>' : '');
  },
  tab_player() {
    const p = G.player, q = this.q;
    let h = this.sec('Health') + '<div class="dbg-kv"><span>Health</span><b data-live="hp"></b><span>Infection</span><b data-live="inf"></b><span>Position</span><b data-live="pos"></b></div>'
      + '<div class="dbg-row">' + this.btn('heal', 'Heal everything') + this.btn('infect', 'Infect') + this.btn('cure', 'Cure infection') + this.btn('kill', 'Kill player') + '</div>'
      + '<div class="dbg-row">' + this.sel('part', PARTS.map(k => [k, PART_NAMES[k]]), q.part) + this.sel('wound', Object.keys(WOUND).map(k => [k, WOUND[k].n]), q.wound) + this.btn('wound', 'Inflict') + '</div>';
    h += this.sec('Stats') + '<div class="dbg-stats">' + DBG_STATS.map(([k, mx]) => `<label class="dbg-stat"><span>${k}</span><input type="range" min="0" max="${mx}" step="${mx / 100}" data-stat="${k}" value="${p.st[k] || 0}"><b data-live="st_${k}"></b></label>`).join('') + '</div>';
    h += this.sec('Skills') + '<div class="dbg-skills">' + Object.keys(SKILL_NAMES).map(sk => `<div class="dbg-skill"><span>${SKILL_NAMES[sk]}</span>${this.btn('skill', '−', `data-sk="${sk}" data-v="-1"`)}<b>${p.skills[sk] ? p.skills[sk].lv : 0}</b>${this.btn('skill', '+', `data-sk="${sk}" data-v="1"`)}</div>`).join('') + '</div>';
    const has = p.traits.map(t => { const d = traitDef(t); return `<span class="dbg-chip">${U.esc(d ? d.n : t)}<span class="dbg-chipx" data-act="traitdel" data-t="${t}">×</span></span>`; }).join('');
    h += this.sec('Traits') + `<div class="dbg-row">${has || '<span class="dbg-sml">none</span>'}</div><div class="dbg-row"><select data-q="trait">${TRAITS.filter(t => !p.traits.includes(t.id)).map(t => `<option value="${t.id}">${U.esc(t.n)}</option>`).join('')}</select>${this.btn('traitadd', 'Add trait')}</div>`;
    return h;
  },
  tab_overlays() {
    return this.sec('World overlays') + '<div class="dbg-grid1">' + DBG_OVERLAYS.map(([k, n, tip]) => this.sw('data-ov', k, `${n}<small>${tip}</small>`, '', this.ov[k])).join('') + '</div>'
      + '<div class="dbg-note">Overlays draw while the debug window is open or hidden, as long as debug mode is on.</div>';
  },
  tab_perf() {
    return this.sec('Frame time (last 240 frames)') + '<canvas id="dbggraph" width="400" height="120"></canvas>'
      + '<div class="dbg-legend"><i style="background:#e8e8e8"></i>frame <i style="background:#ffa040"></i>render <i style="background:#60d070"></i>simulation <i style="background:#60a8ff"></i>UI</div>'
      + '<div class="dbg-kv dbg-kv3"><span>FPS</span><b data-live="fps"></b><span>Frame avg / worst</span><b data-live="ft"></b><span>Render avg</span><b data-live="rt"></b><span>Sim avg</span><b data-live="simt"></b><span>UI avg</span><b data-live="uit"></b>'
      + '<span>Zombies (alive/updated)</span><b data-live="zs"></b><span>Cars (all/active)</span><b data-live="cs"></b><span>Fires</span><b data-live="fires"></b><span>Blood decals</span><b data-live="decals"></b><span>Floor item piles</span><b data-live="piles"></b>'
      + '<span>Sprite cache</span><b data-live="spr"></b><span>Ground chunks</span><b data-live="gch"></b><span>Light grid</span><b data-live="lgrid"></b><span>3D characters</span><b data-live="gl"></b><span>JS heap</span><b data-live="heap"></b></div>';
  },
  // refresh live values without rebuilding the tab (keeps sliders and inputs usable)
  live() {
    const el = document.getElementById('dbgwin');
    if (!el || !this.on) return;
    const p = G.player, ok = !!(G.mode === 'play' && p);
    // a game was started or left since the tab was drawn
    if (ok !== this.wasGame) { this.wasGame = ok; this.render(); return; }
    const set = (k, v) => { const e = el.querySelector(`[data-live="${k}"]`); if (e) e.textContent = v; };
    if (!ok) return;
    if (this.tab === 'zombies') {
      let a = 0, d = 0; for (const z of G.zombies) if (z.dead) d++; else a++;
      set('zalive', a); set('zdead', d); set('znear', Zombie.nearN || 0); set('zupd', Zombie.updN || 0); set('zchase', G.chasing || 0);
    } else if (this.tab === 'cars') {
      set('cars', G.cars.length); set('carsact', Vehicles.active ? Vehicles.active.length : '-');
      let best = null, bd = 1e9; for (const c of G.cars) { const dd = U.dist(c.x, c.y, vxOf(p.x), p.y); if (dd < bd) { bd = dd; best = c; } }
      set('carnear', best ? `${CAR_TYPES[best.type].n} · ${bd.toFixed(1)} tiles · ${best.hp}% · fuel ${Math.round(best.gas * 100)}%${best.locked ? ' · locked' : ''}` : '-');
    } else if (this.tab === 'world') {
      set('date', Season.dateStr() + ' · ' + Game.timeStr() + (G.paused ? ' (paused)' : ' · ×' + G.speed));
      const w = G.weather; set('wx', `rain ${Math.round(w.rain * 100)}% · fog ${Math.round(w.fog * 100)}% · ${w.temp.toFixed(1)}°C · snow ${Math.round((w.snow || 0) * 100)}%`);
    } else if (this.tab === 'player') {
      set('hp', Math.round(p.health) + ' / 100'); set('inf', p.infection ? `infected ${p.infection.t.toFixed(1)} h (symptoms ${p.infection.sym.toFixed(0)} h, death ${p.infection.death.toFixed(0)} h)` : 'none');
      set('pos', `${p.x.toFixed(1)}, ${p.y.toFixed(1)}${p.x >= LV.W0 ? ' (upstairs)' : ''}`);
      for (const [k, mx] of DBG_STATS) { set('st_' + k, mx > 1 ? Math.round(p.st[k] || 0) : Math.round((p.st[k] || 0) * 100) + '%'); const r = el.querySelector(`[data-stat="${k}"]`); if (r && document.activeElement !== r) r.value = p.st[k] || 0; }
    } else if (this.tab === 'perf') {
      const H = this.hist; if (!H.length) return;
      let f = 0, fw = 0, r = 0, s = 0, u = 0;
      for (const e of H) { f += e[0]; fw = Math.max(fw, e[0]); r += e[1]; s += e[2]; u += e[3]; }
      const n = H.length;
      set('fps', Math.round(1000 / (f / n))); set('ft', (f / n).toFixed(1) + ' / ' + fw.toFixed(1) + ' ms'); set('rt', (r / n).toFixed(2) + ' ms'); set('simt', (s / n).toFixed(2) + ' ms'); set('uit', (u / n).toFixed(2) + ' ms');
      let a = 0; for (const z of G.zombies) if (!z.dead) a++;
      set('zs', a + ' / ' + (Zombie.updN || 0)); set('cs', G.cars.length + ' / ' + (Vehicles.active ? Vehicles.active.length : '-'));
      set('fires', Wd.fire ? Wd.fire.size : 0); set('decals', Wd.decals.length); set('piles', Wd.items.size);
      set('spr', Spr.cache.size); set('gch', Render.chunks.size); set('lgrid', (Render.lw || 0) + ' × ' + (Render.lh || 0));
      set('gl', !Settings.v.chars3d ? 'off (setting)' : GL3D.failed ? 'unavailable' : GL3D.gl ? `WebGL${GL3D.soft ? ' (software' + (GL3D.allowSoft ? ')' : ', 2D fallback)') : ''} · atlas ${GL3D.AW}×${GL3D.AH}` : 'not started');
      set('heap', performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : 'n/a');
    }
  },
  graph() {
    const cv = document.getElementById('dbggraph'); if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, h = this.hist;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
    const sc = H / 50;
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.fillStyle = 'rgba(255,255,255,0.4)'; g.font = '9px Verdana, Arial, sans-serif'; g.lineWidth = 1;
    for (const ms of [16.7, 33.3]) { const y = H - ms * sc; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.fillText(ms === 16.7 ? '60 fps' : '30 fps', 3, y - 2); }
    const bw = W / 240;
    for (let i = 0; i < h.length; i++) {
      const e = h[i], x = W - (h.length - i) * bw;
      let y = H;
      for (const [v, c] of [[e[2], '#60d070'], [e[1], '#ffa040'], [e[3], '#60a8ff']]) { const hh = v * sc; g.fillStyle = c; g.fillRect(x, y - hh, bw + 0.3, hh); y -= hh; }
      g.fillStyle = '#e8e8e8'; g.fillRect(x, H - Math.min(H, e[0] * sc) - 1, bw + 0.3, 1.5);
    }
  },

  // ------------------------------------------------------------------ title screen & pause menu switches
  mountTitle() {
    const m = document.getElementById('menu');
    const box = m && m.querySelector('.modal.title');
    if (!box) return;
    let s = box.querySelector('.dbg-titlesw');
    if (!s) { s = document.createElement('div'); s.className = 'dbg-titlesw'; s.title = 'Debug mode: cheats, spawners and overlays (F2 in game)'; s.addEventListener('click', (e) => { e.stopPropagation(); this.enable(!this.on); }); box.appendChild(s); }
    s.innerHTML = `<span class="dbg-knob ${this.on ? 'on' : ''}"></span>Debug mode ${this.on ? 'ON' : 'OFF'}`;
  },
  mountPause() {
    const box = document.querySelector('#menu .pausing .mbox');
    if (!box) return;
    let b = box.querySelector('.dbg-pausebtn');
    if (!b) { b = document.createElement('div'); b.className = 'btn big dbg-pausebtn'; b.addEventListener('click', (e) => { e.stopPropagation(); if (!this.on) this.enable(true); else { this.shown = true; this.save(); this.render(); } this.mountPause(); }); box.appendChild(b); }
    b.textContent = this.on ? 'Debug window' : 'Enable debug mode';
  },

  // ------------------------------------------------------------------ overlays (render hooks)
  // world space: the renderer's iso transform is set; one tile is 64x32 iso pixels at zoom 1
  drawWorld(ctx, minX, minY, maxX, maxY) {
    const p = G.player;
    if (!p) return;
    const z = Render.cam.zoom, lv = p.x >= LV.W0 && !p.inCar ? 1 : 0, lift = lv ? WALL_H : 0, off = lv ? LV.W0 : 0;
    const P = (x, y, h) => [(x - y) * HTW, (x + y) * HTH - ((h || 0) + lift) * ZU];
    const quad = (x0, y0, x1, y1) => { const a = P(x0, y0), b = P(x1, y0), c = P(x1, y1), d = P(x0, y1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); };
    const text = (s, x, y, col, px) => { ctx.font = `bold ${(px || 11) / z}px Verdana, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3 / z; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); };
    const W_ = Wd.w;
    ctx.save();
    ctx.lineJoin = 'round';
    if (this.ov.vis || this.ov.light) {
      const LB = lv ? Render.lightB1 : Render.lightB, nums = z >= 1.35;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const i = y * W_ + x + off;
        if (this.ov.vis) {
          const v = World.visGen[i] === World.gen;
          if (v || Wd.seen[i]) { quad(x, y, x + 1, y + 1); ctx.fillStyle = v ? 'rgba(70,180,255,0.20)' : 'rgba(255,255,255,0.06)'; ctx.fill(); }
        }
        if (this.ov.light && LB && x >= Render.lx0 && y >= Render.ly0 && x < Render.lx0 + Render.lw && y < Render.ly0 + Render.lh) {
          const l = LB[(y - Render.ly0) * Render.lw + (x - Render.lx0)];
          if (nums) { const c = P(x + 0.5, y + 0.5); text(l.toFixed(2), c[0], c[1] + 4 / z, l > 0.6 ? '#ffe680' : l > 0.25 ? '#c8b070' : '#7088c0', 9); }
          else { quad(x, y, x + 1, y + 1); ctx.fillStyle = `rgba(255,${180 + l * 60 | 0},60,${Math.min(0.45, l * 0.4)})`; ctx.fill(); }
        }
      }
    }
    if (this.ov.chunks) {
      const C = CHUNK, q = p.inCar || p, pcx = Math.floor(vxOf(q.x) / C), pcy = Math.floor(q.y / C);
      ctx.lineWidth = 1.5 / z;
      for (let cy = Math.floor(minY / C); cy <= Math.floor(maxY / C); cy++) for (let cx = Math.floor(minX / C); cx <= Math.floor(maxX / C); cx++) {
        const cd = Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy));
        quad(cx * C, cy * C, cx * C + C, cy * C + C);
        ctx.fillStyle = cd >= 12 ? 'rgba(230,60,50,0.20)' : cd >= 6 ? 'rgba(240,180,50,0.16)' : cd >= 3 ? 'rgba(80,190,230,0.10)' : 'rgba(90,220,120,0.07)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
        if (z > 0.6) { const c = P(cx * C + C / 2, cy * C + C / 2); text(`${cx},${cy}  d${cd}`, c[0], c[1], cd >= 12 ? '#ff8070' : cd >= 6 ? '#ffd060' : cd >= 3 ? '#90d8ff' : '#a0f0b0', 10); }
      }
    }
    if (this.ov.rooms) {
      ctx.lineWidth = 2 / z;
      for (const rm of Wd.rooms) {
        const up = rm.x0 >= LV.W0 ? 1 : 0;
        if (up !== lv) continue;
        const x0 = rm.x0 - off, x1 = rm.x1 - off;
        if (x1 < minX - 1 || x0 > maxX || rm.y1 < minY - 1 || rm.y0 > maxY) continue;
        const hue = (rm.id * 67) % 360;
        quad(x0, rm.y0, x1 + 1, rm.y1 + 1); ctx.fillStyle = `hsla(${hue},70%,55%,0.16)`; ctx.fill(); ctx.strokeStyle = `hsla(${hue},70%,65%,0.7)`; ctx.stroke();
        const c = P((x0 + x1 + 1) / 2, (rm.y0 + rm.y1 + 1) / 2); text(`${rm.type} #${rm.id}`, c[0], c[1], `hsl(${hue},80%,78%)`, 10);
      }
      for (const b of Wd.buildings) {
        if (b.x1 < minX - 1 || b.x0 > maxX || b.y1 < minY - 1 || b.y0 > maxY) continue;
        quad(b.x0, b.y0, b.x1 + 1, b.y1 + 1); ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.setLineDash([6 / z, 4 / z]); ctx.stroke(); ctx.setLineDash([]);
        const c = P(b.x0, b.y1 + 1); text(`${b.type}${b.name ? ' "' + b.name + '"' : ''} #${b.id}${b.floors === 2 ? ' · 2F' : ''}`, c[0], c[1] + 14 / z, '#fff0c8', 10);
      }
    }
    if (this.ov.solid) {
      ctx.lineWidth = 3 / z;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const ax = x + off, i = y * W_ + ax;
        if (World.tileSolid(ax, y)) { quad(x + 0.12, y + 0.12, x + 0.88, y + 0.88); ctx.strokeStyle = 'rgba(255,70,60,0.85)'; ctx.stroke(); }
        for (let d = 0; d < 2; d++) {
          const t = d ? Wd.wallW[i] : Wd.wallN[i];
          if (!t) continue;
          const f = World.feat(ax, y, d), blk = World.edgeBlocksMove(ax, y, d);
          ctx.strokeStyle = f && f.k === 'window' ? (blk ? '#ffd040' : '#a0ff80') : f && f.k === 'door' ? (blk ? (f.locked ? '#ff40ff' : '#ff9a30') : '#40ff90') : blk ? '#ff4030' : '#40ff90';
          const a = P(x, y), b = d ? P(x, y + 1) : P(x + 1, y);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      }
    }
    if (this.ov.ai) {
      ctx.lineWidth = 1.5 / z;
      const line = (x0, y0, x1, y1, col, dash) => { const a = P(x0, y0, 0.05), b = P(x1, y1, 0.05); ctx.strokeStyle = col; ctx.setLineDash(dash ? [5 / z, 4 / z] : []); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); };
      for (const zb of G.zombies) {
        if (zb.dead) continue;
        const zl = zb.x >= LV.W0 ? 1 : 0, zx = zb.x - (zl ? LV.W0 : 0);
        if (zl !== lv || zx < minX - 2 || zx > maxX + 2 || zb.y < minY - 2 || zb.y > maxY + 2) continue;
        const col = DBG_ZCOL[zb.st] || '#fff';
        if (zb.path && zb.pi < zb.path.length) {
          ctx.strokeStyle = col; ctx.globalAlpha = 0.6; ctx.beginPath();
          let a = P(zx, zb.y, 0.05); ctx.moveTo(a[0], a[1]);
          for (let k = zb.pi; k < zb.path.length; k++) { const wp = zb.path[k]; a = P(vxOf(wp[0]) + 0.5, wp[1] + 0.5, 0.05); ctx.lineTo(a[0], a[1]); }
          ctx.stroke(); ctx.globalAlpha = 1;
        } else if (zb.st === 'chase' || zb.st === 'investigate' || zb.st === 'wander') line(zx, zb.y, vxOf(zb.tx), zb.ty, col, true);
        if (zb.canSee && !p.dead) line(zx, zb.y, vxOf(p.x), p.y, 'rgba(255,40,40,0.9)');
        // facing
        line(zx, zb.y, zx + Math.cos(zb.a) * 0.6, zb.y + Math.sin(zb.a) * 0.6, col);
        const c = P(zx, zb.y, 2.1);
        text(zb.st + (zb.crawl ? ' crawl' : '') + (zb.stag > 0 ? ' stagger' : ''), c[0], c[1], col, 10);
        if (z > 1.2) text(`#${zb.id} hp ${zb.hp.toFixed(1)} v ${zb.speed.toFixed(2)}`, c[0], c[1] + 11 / z, '#ccc', 9);
      }
      if (p.path && p.path.length) { ctx.strokeStyle = '#60ff80'; ctx.beginPath(); let a = P(vxOf(p.x), p.y, 0.05); ctx.moveTo(a[0], a[1]); for (const wp of p.path) { a = P(vxOf(wp[0]) + 0.5, wp[1] + 0.5, 0.05); ctx.lineTo(a[0], a[1]); } ctx.stroke(); }
    }
    if (this.ov.noise && this.noises.length) {
      const now = performance.now();
      this.noises = this.noises.filter(n => now - n.t < 2500);
      ctx.lineWidth = 2 / z;
      for (const n of this.noises) {
        const age = (now - n.t) / 2500, c = P(vxOf(n.x), n.y), r = n.r * Math.min(1, 0.25 + age * 1.5);
        ctx.globalAlpha = 1 - age;
        ctx.strokeStyle = n.kind === 'gun' || n.kind === 'alarm' ? '#ff6040' : n.kind === 'step' ? '#a0c8ff' : '#ffd060';
        ctx.beginPath(); ctx.ellipse(c[0], c[1], r * HTW * Math.SQRT2, r * HTH * Math.SQRT2, 0, 0, Math.PI * 2); ctx.stroke();
        text(`${n.kind} r${n.r.toFixed(0)}`, c[0], c[1], ctx.strokeStyle, 10);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },
  // screen space: cursor info, placement marker, frame history and the graph
  drawScreen(ctx, W, H) {
    const now = performance.now();
    if (this.lastT) { this.hist.push([now - this.lastT, this.rendAcc, this.simAcc, this.uiAcc]); if (this.hist.length > 240) this.hist.shift(); }
    this.lastT = now; this.rendAcc = 0; this.simAcc = 0; this.uiAcc = 0;
    if (this.shown && this.tab === 'perf') this.graph();
    const p = G.player;
    if (!p || Input.overUI) return;
    const lines = [];
    if (this.place) lines.push(['+ ' + this.place.label, '#ffd060']);
    if (this.ov.cursor) {
      const t = Render.mouseWorld(), x = Math.floor(t[0]), y = Math.floor(t[1]);
      if (World.inb(x, y)) {
        const i = y * Wd.w + x, gx = vxOf(x), f = Wd.floor[i], o = Wd.obj[i];
        const fl = Object.keys(FL).find(k => FL[k] === f) || f, wt = (v) => v ? (Object.keys(WT).find(k => WT[k] === v) || v) : '-';
        lines.push([`tile ${x}, ${y}${x >= LV.W0 ? ' (upstairs, ' + gx + ')' : ''}`, '#fff']);
        lines.push([`floor ${fl}${o ? ' · ' + o.t + (o.items ? ' (' + o.items.length + ' items)' : '') : ''}${World.tileSolid(x, y) ? ' · solid' : ''}`, '#ddd']);
        const fN = World.feat(x, y, 0), fW = World.feat(x, y, 1);
        lines.push([`walls N ${wt(Wd.wallN[i])}${fN ? ' ' + fN.k + (fN.open ? ' open' : '') + (fN.locked ? ' locked' : '') : ''} · W ${wt(Wd.wallW[i])}${fW ? ' ' + fW.k + (fW.open ? ' open' : '') + (fW.locked ? ' locked' : '') : ''}`, '#ddd']);
        const r = Wd.room[i];
        if (r >= 0) { const rm = Wd.rooms[r], b = Wd.buildings[rm.b]; lines.push([`room #${r} ${rm.type}${rm.lights ? ' (lights on)' : ''} · building #${b.id} ${b.type}${b.name ? ' "' + b.name + '"' : ''}`, '#c8e0ff']); }
        else lines.push(['outdoors', '#c8e0ff']);
        const L = x >= LV.W0 ? Render.lightB1 : Render.lightB;
        const li = gx >= Render.lx0 && y >= Render.ly0 && gx < Render.lx0 + Render.lw && y < Render.ly0 + Render.lh ? L[(y - Render.ly0) * Render.lw + (gx - Render.lx0)] : NaN;
        lines.push([`light ${isNaN(li) ? '-' : li.toFixed(2)} · ${World.visGen[i] === World.gen ? 'in view' : Wd.seen[i] ? 'remembered' : 'unseen'} · tier ${Game.chunkTier(x, y)}`, '#ffe8a0']);
        const q = p.inCar || p, cx = Math.floor(gx / CHUNK), cy = Math.floor(y / CHUNK), cd = Math.max(Math.abs(cx - Math.floor(vxOf(q.x) / CHUNK)), Math.abs(cy - Math.floor(q.y / CHUNK)));
        lines.push([`chunk ${cx}, ${cy} · ${cd} away · ${cd >= 12 ? 'frozen' : cd >= 6 ? 'half-rate world, coarse zombies' : cd >= 3 ? 'half-rate idle zombies' : 'full rate'}`, '#a0f0b0']);
        let zn = null, zd = 0.7;
        for (const zb of Zombie.near(t[0], t[1], 0.7)) { const d = U.dist(zb.x, zb.y, t[0], t[1]); if (d < zd) { zd = d; zn = zb; } }
        if (zn) lines.push([`zombie #${zn.id} ${zn.st}${zn.dead ? '' : ` · hp ${zn.hp.toFixed(1)}/${(zn.maxhp || 0).toFixed(1)} · speed ${zn.speed.toFixed(2)}${zn.crawl ? ' · crawler' : ''}${zn.canSee ? ' · sees you' : ''}`}`, '#ff9a8a']);
        const its = Wd.items.get(i); if (its && its.length) lines.push([`${its.length} item${its.length > 1 ? 's' : ''} on the floor`, '#ddd']);
      }
    }
    if (!lines.length) return;
    ctx.save();
    ctx.font = '11px Verdana, Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let bw = 0; for (const [s] of lines) bw = Math.max(bw, ctx.measureText(s).width);
    let bx = Input.mx + 18, by = Input.my + 18;
    const bh = lines.length * 15 + 8;
    if (bx + bw + 14 > W) bx = Input.mx - bw - 24; if (by + bh > H) by = Input.my - bh - 10;
    ctx.fillStyle = 'rgba(10,12,14,0.82)'; ctx.fillRect(bx, by, bw + 14, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw + 13, bh - 1);
    lines.forEach(([s, c], k) => { ctx.fillStyle = c; ctx.fillText(s, bx + 7, by + 5 + k * 15); });
    ctx.restore();
  },
};
window.addEventListener('load', () => Debug.init());
