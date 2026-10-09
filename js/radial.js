'use strict';
// ---------------------------------------------------------------------------
// Radial menu (V): vehicle controls inside or next to a car, quick actions otherwise.
// Other modules add entries through RADIAL_PROVIDERS: fn(ctx) -> [{ label, icon, enabled, fn }]
// with ctx = { player, car (the car the player is in, or the nearest one within 2.2 tiles), inside }.
// When a provider returns entries for a car, the built-in vehicle entries are left out.
// ---------------------------------------------------------------------------
const RADIAL_PROVIDERS = [];
// simple line glyphs (24x24 viewBox) for the wedges
const RADIAL_ICONS = {
  engine: 'M5 9h3l2-2h5v3h2l2-2v8l-2-2h-2v3h-7l-3-3H5z',
  key: 'M8 14a3 3 0 1 1 0-.1M11 14h9M17 14v3M20 14v2',
  light: 'M4 9c4 0 6 1 6 3s-2 3-6 3zM13 9l7-2M13 12h8M13 15l7 2',
  horn: 'M4 10h3l7-4v12l-7-4H4zM17 9c1.5 1.5 1.5 4.5 0 6M19.5 7c3 3 3 7 0 10',
  siren: 'M6 18v-6a6 6 0 0 1 12 0v6zM4 18h16M12 3v2M4.5 6l1.5 1.5M19.5 6L18 7.5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5zM12 14v3',
  unlock: 'M7 11V8a5 5 0 0 1 9.5-2M5 11h14v9H5zM12 14v3',
  door: 'M6 4h10v16H6zM16 7l3 1v10l-3 1M13 12h1',
  trunk: 'M3 13l3-5h12l3 5v5H3zM3 13h18M10 16h4',
  box: 'M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9',
  exit: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  enter: 'M14 4h5v16h-5M9 8l4 4-4 4M13 12H4',
  window: 'M5 5h14v14H5zM5 12h14M12 5v14M9 9l2 2M14 15l2 2',
  fuel: 'M5 20V5h8v15M5 10h8M13 8l3 2v7a1.5 1.5 0 0 0 3 0V9l-3-3',
  flashlight: 'M4 10h8v4H4zM12 9l5-3v12l-5-3M19 8l2-1M19 12h3M19 16l2 1',
  sneak: 'M9 5a2 2 0 1 0 0 .1M8 9l-3 5h4l2 6M11 9l4 2 3-1M9 14l5 1 2 5',
  sit: 'M10 4a2 2 0 1 0 0 .1M9 8v6h6l2 6M9 11h5M6 20h4',
  shout: 'M5 9h4l6-4v14l-6-4H5zM18 8l3-2M18 12h3M18 16l3 2',
  bag: 'M6 8h12l1 12H5zM9 8a3 3 0 0 1 6 0',
  health: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
  craft: 'M14 4l6 6-3 3-6-6zM12 9l-8 8 3 3 8-8',
  book: 'M4 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-7M20 5v13h-7',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  wrench: 'M14 3a5 5 0 0 0-4 7l-7 7 3 3 7-7a5 5 0 0 0 7-4l-3 2-3-3z',
  hood: 'M3 15l4-7h10l4 7M3 15h18v3H3zM7 8l3 7M17 8l-3 7',
  stop: 'M8 4h8l4 4v8l-4 4H8l-4-4V8zM9 12h6',
};
const Radial = {
  el: null, open: false, items: [], hover: -1, cx: 0, cy: 0, title: '', sub: '',
  R0: 52, R1: 158,
  context() {
    const p = G.player;
    let car = p.inCar || null;
    if (!car) {
      let best = 2.2;
      for (const c of G.cars) { const d = U.dist(p.x, p.y, c.x, c.y); if (d < best) { best = d; car = c; } }
    }
    return { player: p, car, inside: !!p.inCar };
  },
  // built-in entries using the existing vehicle functions
  vehicleItems(ctx) {
    const c = ctx.car, T = CAR_TYPES[c.type] || {}, it = [];
    const key = Vehicles.hasKey(c);
    if (ctx.inside) {
      if (c.engine) it.push({ label: 'Stop engine', icon: 'stop', fn: () => { c.engine = false; Sfx.play('switch'); } });
      else it.push({ label: key ? 'Start engine' : 'Hotwire', icon: key ? 'key' : 'engine', enabled: key || Vehicles.canHotwire(), fn: () => Vehicles.tryStart(c) });
      it.push({ label: c.lightsOn ? 'Headlights off' : 'Headlights on', icon: 'light', fn: () => { c.lightsOn = !c.lightsOn; Sfx.play('switch'); } });
      it.push({ label: 'Horn', icon: 'horn', fn: () => { Noise.emit(c.x, c.y, 40, 'horn'); Sfx.play('horn', c.x, c.y); } });
      if (T.lightbar) it.push({ label: c.siren ? 'Siren off' : 'Siren on', icon: 'siren', enabled: !!c.engine, fn: () => { c.siren = !c.siren; } });
      it.push({ label: c.locked ? 'Unlock doors' : 'Lock doors', icon: c.locked ? 'unlock' : 'lock', fn: () => { c.locked = !c.locked; Sfx.play('lock'); } });
      it.push({ label: 'Glove box', icon: 'box', fn: () => UI.openLoot() });
      it.push({ label: 'Exit vehicle', icon: 'exit', fn: () => Vehicles.exit(c) });
    } else {
      it.push({ label: 'Enter vehicle', icon: 'enter', fn: () => Vehicles.enter(c) });
      it.push({ label: c.trunkOpen ? 'Close trunk' : 'Open trunk', icon: 'trunk', fn: () => {
        if (c.locked && !key) { Player.say("It's locked.", '#ccc'); return; }
        c.trunkOpen = !c.trunkOpen; Sfx.play(c.trunkOpen ? 'doorOpen' : 'doorClose'); if (c.trunkOpen) UI.openLoot('car' + c.id + 'trunk');
      } });
      if (key) it.push({ label: c.locked ? 'Unlock doors' : 'Lock doors', icon: c.locked ? 'unlock' : 'lock', fn: () => { c.locked = !c.locked; Sfx.play('lock'); } });
      if (c.locked && !c.winBroken) it.push({ label: 'Smash window', icon: 'window', fn: () => Vehicles.smashWindow(c) });
      const can = Player.find(i => i.id === 'GasCan' && i.fl > 0.05);
      if (can) it.push({ label: 'Refuel with gas can', icon: 'fuel', fn: () => Actions.queue(Actions.refuelCar(c, can)) });
      const can2 = Player.find(i => i.id === 'GasCan' && i.fl < 0.95);
      if (can2 && c.gas > 0.02) it.push({ label: 'Siphon gas', icon: 'fuel', fn: () => Actions.queue(Actions.siphon(c, can2)) });
    }
    return it;
  },
  quickItems(ctx) {
    const p = ctx.player, it = [];
    const fl = [Player.primary(), Player.secondary()].find(i => i && ITEMS[i.id].light) || Player.find(i => ITEMS[i.id].light && i.pow > 0);
    it.push({ label: fl && fl.on ? 'Flashlight off' : 'Flashlight on', icon: 'flashlight', enabled: !!fl, fn: () => {
      if (!fl) return;
      if (!Player.primary() || Player.primary() !== fl) { if (Player.secondary() !== fl) Player.equip(fl, 'secondary'); }
      if (fl.pow <= 0) Player.say('The batteries are dead.', '#ccc'); else { fl.on = !fl.on; Sfx.play('switch'); UI.refresh(); }
    } });
    it.push({ label: p.sneak ? 'Stop sneaking' : 'Sneak', icon: 'sneak', fn: () => { p.sneak = !p.sneak; Player.say(p.sneak ? 'Sneaking' : 'Walking', '#ccc'); } });
    it.push({ label: p.sitting ? 'Stand up' : 'Sit on ground', icon: 'sit', fn: () => { p.sitting = !p.sitting; if (p.sitting) Actions.cancel(); } });
    it.push({ label: 'Shout', icon: 'shout', fn: () => { Player.say(R.pick(['Hey!', 'Over here!', 'HEY!']), '#fff'); Noise.emit(p.x, p.y, 20, 'shout'); Sfx.play('shout'); } });
    it.push({ label: 'Inventory', icon: 'bag', fn: () => UI.toggle('inv') });
    it.push({ label: 'Health', icon: 'health', fn: () => UI.toggle('health') });
    it.push({ label: 'Crafting', icon: 'craft', fn: () => UI.toggle('craft') });
    it.push({ label: 'Skills', icon: 'book', fn: () => UI.toggle('skills') });
    it.push({ label: 'Map', icon: 'map', fn: () => UI.toggle('map') });
    return it;
  },
  build(ctx) {
    let ext = [];
    for (const fn of RADIAL_PROVIDERS) { try { const r = fn(ctx); if (r && r.length) ext = ext.concat(r); } catch (e) { console.warn('radial provider', e); } }
    let items = ext;
    if (ctx.car && !ext.length) items = this.vehicleItems(ctx);
    if (!ctx.car && !ext.length) items = this.quickItems(ctx);
    else if (!ctx.car) items = ext.concat(this.quickItems(ctx));
    return items.slice(0, 12).map(i => Object.assign({ enabled: true, icon: 'box' }, i));
  },
  toggle() { if (this.open) this.hide(); else this.show(); },
  show() {
    const p = G.player;
    if (!p || p.dead || p.asleep || G.mode !== 'play') return;
    const ctx = this.context();
    this.items = this.build(ctx);
    if (!this.items.length) return;
    this.ctxCar = ctx.car; this.ctxInside = ctx.inside;
    if (ctx.car) {
      const c = ctx.car;
      this.title = Vehicles.typeName(c);
      this.sub = 'Gas ' + Math.round(c.gas * 100) + '% · Cond. ' + Math.round(c.hp) + '%';
    } else { this.title = 'Quick actions'; this.sub = ''; }
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'radial';
      this.el.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:40;cursor:default;';
      this.el.addEventListener('mousemove', (e) => this.onMove(e));
      this.el.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); if (e.button === 0) this.pick(); else this.hide(); });
      this.el.addEventListener('contextmenu', (e) => e.preventDefault());
      this.el.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
      ($('#ui') || document.body).appendChild(this.el);
    }
    this.cx = Math.round(window.innerWidth / 2); this.cy = Math.round(window.innerHeight / 2);
    this.hover = -1;
    this.open = true;
    this.el.style.display = 'block';
    this.onMove({ clientX: Input.mx, clientY: Input.my });
    Sfx.play('switch');
  },
  hide() { this.open = false; if (this.el) this.el.style.display = 'none'; },
  // keys while open: V or Escape closes, 1-9 picks
  keys() {
    if (Input.hit('v') || Input.hit('Escape')) { this.hide(); return; }
    for (let i = 0; i < 9; i++) if (Input.hit(String(i + 1)) && this.items[i]) { this.hover = i; this.pick(); return; }
    // the context went away (got out, drove off, died)
    const p = G.player;
    if (!p || p.dead || p.asleep || !!p.inCar !== this.ctxInside || (this.ctxCar && !p.inCar && U.dist(p.x, p.y, this.ctxCar.x, this.ctxCar.y) > 3)) this.hide();
  },
  onMove(e) {
    const dx = e.clientX - this.cx, dy = e.clientY - this.cy, d = Math.hypot(dx, dy), n = this.items.length;
    let h = -1;
    if (d > this.R0 * 0.6 && d < this.R1 + 60 && n) {
      const a = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2 + Math.PI / n) % (Math.PI * 2);
      h = Math.floor(a / (Math.PI * 2 / n)) % n;
    }
    if (h !== this.hover || !this.el.firstChild) { this.hover = h; this.render(); }
  },
  pick() {
    const it = this.items[this.hover];
    this.hide();
    if (!it || it.enabled === false || !it.fn) return;
    try { it.fn(); } catch (e) { console.error(e); }
    UI.refresh && UI.refresh();
  },
  render() {
    const n = this.items.length, R0 = this.R0, R1 = this.R1, cx = this.cx, cy = this.cy, step = Math.PI * 2 / n, gap = 0.012;
    const pt = (r, a) => (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1);
    let svg = '<svg width="100%" height="100%" style="position:absolute;left:0;top:0">';
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R1 + 6) + '" fill="rgba(10,9,8,0.35)"/>';
    // wedges first, then icons and labels on top so long labels may overhang their wedge
    let txt = '';
    const fs = n > 8 ? 9.5 : 10.5;
    for (let i = 0; i < n; i++) {
      const it = this.items[i], am = -Math.PI / 2 + i * step, a0 = am - step / 2 + gap, a1 = am + step / 2 - gap, lg = step > Math.PI ? 1 : 0;
      const hov = i === this.hover, dis = it.enabled === false;
      const fill = hov && !dis ? 'rgba(196,170,96,0.55)' : 'rgba(26,23,20,0.86)';
      svg += '<path d="M' + pt(R1, a0) + ' A' + R1 + ' ' + R1 + ' 0 ' + lg + ' 1 ' + pt(R1, a1) + ' L' + pt(R0, a1) + ' A' + R0 + ' ' + R0 + ' 0 ' + lg + ' 0 ' + pt(R0, a0) + ' Z" fill="' + fill + '" stroke="rgba(230,215,170,' + (hov ? 0.7 : 0.18) + ')" stroke-width="1.2"/>';
      const rm = (R0 + R1) / 2 - 8, ix = cx + Math.cos(am) * rm, iy = cy + Math.sin(am) * rm;
      const col = dis ? 'rgba(200,190,170,0.35)' : hov ? '#fff8e0' : '#d8ccb0';
      txt += '<g transform="translate(' + (ix - 13).toFixed(1) + ' ' + (iy - 15).toFixed(1) + ') scale(1.08)"><path d="' + (RADIAL_ICONS[it.icon] || RADIAL_ICONS.box) + '" fill="none" stroke="' + col + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></g>';
      txt += '<text x="' + ix.toFixed(1) + '" y="' + (iy + 22).toFixed(1) + '" fill="' + col + '" font-size="' + fs + '" font-family="Verdana, sans-serif" text-anchor="middle" paint-order="stroke" stroke="rgba(16,14,12,0.85)" stroke-width="2.5">' + (i < 9 ? (i + 1) + ' ' : '') + this.esc(this.short(it.label, 18)) + '</text>';
    }
    svg += txt;
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R0 - 6) + '" fill="rgba(16,14,12,0.92)" stroke="rgba(230,215,170,0.25)"/>';
    const h = this.items[this.hover];
    const t1 = h ? h.label : this.title, t2 = h ? (h.enabled === false ? 'Not available' : 'Click to use') : this.sub;
    svg += '<text x="' + cx + '" y="' + (cy - 2) + '" fill="#f0e6c8" font-size="11" font-weight="bold" font-family="Verdana, sans-serif" text-anchor="middle">' + this.esc(this.short(t1, 15)) + '</text>';
    svg += '<text x="' + cx + '" y="' + (cy + 13) + '" fill="#a89c80" font-size="8.5" font-family="Verdana, sans-serif" text-anchor="middle">' + this.esc(this.short(t2 || 'V or Esc to close', 21)) + '</text>';
    svg += '</svg>';
    this.el.innerHTML = svg;
  },
  short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; },
  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
};
