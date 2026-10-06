'use strict';
// ---------------------------------------------------------------------------
// Vehicle mechanics: part condition, inspection window, repairs.
// Mechanics.carActions(car, inside) is the one list of vehicle commands used by the
// context menu (interact.js) and the radial menu (RADIAL_PROVIDERS).
// ---------------------------------------------------------------------------
const MECH_TOOLS = { wrench: 'Wrench', screwdriver: 'Screwdriver', lugwrench: 'Lug Wrench', jack: 'Jack' };
const MECH_GROUPS = ['Engine bay', 'Wheels and brakes', 'Body', 'Windows', 'Lights'];
const Mechanics = {
  car: null, t: 0, sig: '',
  // ------------------------------------------------------------------ helpers
  tool(tag) { return Player.findTag(tag); },
  near(c, d) { const p = G.player; return p.inCar === c || U.dist(p.x, p.y, c.x, c.y) < (d || 2.6); },
  // walk to where the work is, then run fn
  goTo(c, k, fn) {
    if (G.player.inCar) { fn(); return; }
    const [x, y] = k ? Vehicles.partPos(c, k, true) : [c.x, c.y];
    Interact.goDo(x, y, fn, k ? 1.4 : 2.4);
  },
  pumpNear(c) {
    const cx = Math.floor(c.x), cy = Math.floor(c.y);
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
      const o = World.inb(x, y) && World.obj(x, y);
      if (o && o.t === 'pump') return [x, y];
    }
    return null;
  },
  // ------------------------------------------------------------------ commands for menus
  carActions(c, inside) {
    Mechanics.register();
    Vehicles.ensure(c);
    const T = CAR_TYPES[c.type], P = c.parts, key = Vehicles.hasKey(c), out = [];
    const A = (label, icon, fn, o) => out.push(Object.assign({ label, icon, fn, enabled: true }, o || {}));
    if (c.burnt) {
      A('Search the wreck', 'trunk', () => { c.trunkOpen = true; UI.openLoot('car' + c.id + 'trunk'); }, { walk: true });
      A('Vehicle Mechanics', 'wrench', () => this.open(c), { walk: true });
      return out;
    }
    if (inside) {
      if (c.engine) A('Stop engine', 'stop', () => Vehicles.stopEngine(c));
      else A(key ? 'Start engine' : 'Hotwire', key ? 'key' : 'engine', () => Vehicles.tryStart(c), { enabled: key || Vehicles.canHotwire() });
      A(c.lightSw ? 'Headlights off' : 'Headlights on', 'light', () => Vehicles.toggleLights(c), { enabled: P.battery > 0 });
      A('Horn', 'horn', () => Vehicles.horn(c));
      if (T.lightbar) A(c.siren ? 'Siren off' : 'Siren on', 'siren', () => { c.siren = !c.siren; Sfx.play('switch'); }, { enabled: !!c.engine });
      A(c.locked ? 'Unlock doors' : 'Lock doors', c.locked ? 'unlock' : 'lock', () => { c.locked = !c.locked; Sfx.play('lock', c.x, c.y); });
      if (P.doorFL >= 0) A((c.doorOpen & 1) ? 'Close your door' : 'Open your door', 'door', () => Vehicles.toggleDoor(c, 'doorFL'));
      if (P.hood >= 0) A(c.hoodOpen ? 'Close hood' : 'Pop the hood', 'hood', () => Vehicles.toggleHood(c), { enabled: c.hoodOpen || Math.abs(c.v) < 0.5 });
      if (P.trunkLid >= 0) A(c.trunkOpen ? 'Close trunk' : 'Open trunk', 'trunk', () => { c.trunkOpen = !c.trunkOpen; Sfx.play(c.trunkOpen ? 'hoodOpen' : 'hoodClose', c.x, c.y); });
      A('Glove box', 'box', () => UI.openLoot());
      A('Vehicle Mechanics', 'wrench', () => this.open(c));
      A('Exit vehicle', 'exit', () => Vehicles.exit(c));
      return out;
    }
    A('Enter vehicle', 'enter', () => Vehicles.enter(c), { walk: true });
    const dk = this.nearDoor(c);
    if (dk) {
      const open = c.doorOpen & CAR_PARTS[dk].door;
      A((open ? 'Close ' : 'Open ') + CAR_PARTS[dk].n.toLowerCase(), 'door', () => Vehicles.toggleDoor(c, dk), { walk: dk });
    }
    if (key) A(c.locked ? 'Unlock doors' : 'Lock doors', c.locked ? 'unlock' : 'lock', () => { c.locked = !c.locked; Sfx.play('lock', c.x, c.y); if (!c.locked) c.alarmDone = c.alarmDone || false; }, { walk: true });
    A(c.trunkOpen || P.trunkLid < 0 ? (P.trunkLid < 0 ? 'Loot trunk' : 'Close trunk') : 'Open trunk', 'trunk', () => this.trunk(c), { walk: 'trunkLid' });
    if (P.hood >= 0) A(c.hoodOpen ? 'Close hood' : 'Open hood', 'hood', () => Vehicles.toggleHood(c), { walk: 'hood' });
    if (c.locked && !Vehicles.reachIn(c) && CAR_GLASS.some(k => P[k] > 0)) A('Smash window', 'window', () => Vehicles.smashWindow(c), { walk: true });
    const fill = Player.find(i => i.id === 'GasCan' && i.fl > 0.05);
    if (fill && P.gasTank >= 0) A('Refuel with gas can', 'fuel', () => Actions.queue(Actions.refuelCar(c, fill)), { walk: 'gasTank', enabled: c.gas < 0.99 });
    const pump = this.pumpNear(c);
    if (pump && P.gasTank >= 0) A('Refuel at the pump', 'fuel', () => Actions.queue(this.pumpAction(c, pump)), { walk: 'gasTank', enabled: c.gas < 0.99 });
    const empty = Player.find(i => i.id === 'GasCan' && i.fl < 0.95);
    if (empty && c.gas > 0.02 && P.gasTank >= 0) A('Siphon gas', 'fuel', () => Actions.queue(Actions.siphon(c, empty)), { walk: 'gasTank' });
    A('Vehicle Mechanics', 'wrench', () => this.open(c), { walk: true });
    return out;
  },
  // the door nearest to the player (only those that exist on this body)
  nearDoor(c) {
    const p = G.player;
    let best = null, bd = 3.2;
    for (const k of ['doorFL', 'doorFR', 'doorRL', 'doorRR']) {
      if (!Vehicles.hasSlot(c, k) || c.parts[k] < 0) continue;
      const [x, y] = Vehicles.partPos(c, k, true), d = U.dist(p.x, p.y, x, y);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  },
  trunk(c) {
    if (c.parts.trunkLid >= 0 && !c.trunkOpen && c.locked && !Vehicles.hasKey(c)) { Player.say("It's locked.", '#ccc'); Sfx.play('locked', c.x, c.y); return; }
    if (c.parts.trunkLid >= 0) { c.trunkOpen = !c.trunkOpen; Sfx.play(c.trunkOpen ? 'hoodOpen' : 'hoodClose', c.x, c.y); Noise.emit(c.x, c.y, 5, 'door'); }
    if (c.trunkOpen || c.parts.trunkLid < 0) UI.openLoot('car' + c.id + 'trunk');
  },
  pumpAction(c, pump) {
    let ft = 0;
    return Actions.mk('Refueling at the pump', 12 * (1 - c.gas) + 1.5, () => { UI.refresh(); }, {
      anim: 'work',
      check: () => U.dist(G.player.x, G.player.y, c.x, c.y) < 3.2,
      begin: () => { if (G.events.powerOff) { Player.say('The pump has no power.', '#ccc'); Actions.cancel(); } },
      tick: (dt) => { if (G.events.powerOff) return; c.gas = Math.min(1, c.gas + dt / 12); ft -= dt; if (ft <= 0) { ft = 1.2; Sfx.play('fill', c.x, c.y); } if (c.gas >= 1) { const a = G.player.action; if (a) a.t = a.dur; } },
    });
  },
  // context menu entries (walk there first)
  menu(c, add, inside) {
    const acts = this.carActions(c, inside);
    for (const a of acts) {
      const run = !inside && a.walk ? () => this.goTo(c, typeof a.walk === 'string' ? a.walk : null, a.fn) : a.fn;
      add(a.label, run, { disabled: a.enabled === false });
    }
    if (!inside && !c.burnt) {
      // every door, also from across the car
      const sub = [];
      for (const k of ['doorFL', 'doorFR', 'doorRL', 'doorRR']) {
        if (!Vehicles.hasSlot(c, k) || c.parts[k] < 0) continue;
        const open = c.doorOpen & CAR_PARTS[k].door;
        sub.push({ label: (open ? 'Close ' : 'Open ') + CAR_PARTS[k].n.toLowerCase(), fn: () => this.goTo(c, k, () => Vehicles.toggleDoor(c, k)) });
      }
      if (sub.length > 1) add('Doors', null, { sub });
    }
    add(Vehicles.typeName(c) + ' — Gas ' + Math.round(c.gas * 100) + '%, Condition ' + Math.round(c.hp) + '%', null, { info: true });
  },
  // ------------------------------------------------------------------ part work
  // can op ('u' uninstall, 'i' install, 'r' repair) be done on part k? -> { ok, why, item }
  check(c, k, op) {
    const d = CAR_PARTS[k], P = c.parts, v = P[k];
    const r = { ok: false, why: '', item: null };
    if (!Vehicles.hasSlot(c, k)) { r.why = 'Not on this vehicle'; return r; }
    if (G.player.inCar) { r.why = 'Get out of the vehicle first'; return r; }
    if (Math.abs(c.v) > 0.1) { r.why = 'The vehicle is moving'; return r; }
    if (c.burnt && op !== 'u') { r.why = 'Burnt out'; return r; }
    if (op === 'u') {
      if (d.fixed) { r.why = 'Cannot be removed'; return r; }
      if (v < 0) { r.why = 'Not installed'; return r; }
      if (v <= 0 && (d.glass || d.light)) { r.why = 'Smashed'; return r; }
      if (c.burnt) { r.why = 'Burnt out'; return r; }
    } else if (op === 'i') {
      if (d.fixed) { r.why = 'Repair it instead'; return r; }
      if (v > 0) { r.why = 'Uninstall the old one first'; return r; }
      const id = Vehicles.partItem(c, k);
      r.item = Player.findAll(it => it.id === id).sort((a, b) => (b.pc || 0) - (a.pc || 0))[0] || null;
      if (!r.item) { r.why = 'Needs ' + ITEMS[id].n; return r; }
    } else {
      if (!d.fixed) { r.why = 'Replace it instead'; return r; }
      if (v >= 100) { r.why = 'In perfect condition'; return r; }
      r.item = Player.findId('EngineParts');
      if (!r.item) { r.why = 'Needs Spare Engine Parts'; return r; }
    }
    if ((d.bay || k === 'engine') && P.hood >= 0 && !c.hoodOpen) { r.why = 'Open the hood first'; return r; }
    const sk = op === 'r' ? 2 : d.sk || 0;
    if (Player.skill('Mechanics') < sk) { r.why = 'Needs Mechanics ' + sk; return r; }
    const tools = op === 'r' ? ['wrench'] : d.tools || [];
    for (const t of tools) if (!this.tool(t)) { r.why = 'Needs a ' + MECH_TOOLS[t]; return r; }
    r.ok = true;
    return r;
  },
  dur(k, op) {
    const d = CAR_PARTS[k], base = op === 'r' ? 12 : d.t || 6;
    return base * Math.max(0.45, 1 - Player.skill('Mechanics') * 0.06) * Actions.dexMult() * (Player.hasTrait('handy') ? 0.85 : 1);
  },
  work(c, k, op) {
    const r = this.check(c, k, op);
    if (!r.ok) { Player.say(r.why + '.', '#ccc'); return; }
    this.goTo(c, k, () => Actions.queue(this.action(c, k, op, r.item)));
  },
  action(c, k, op, item) {
    const d = CAR_PARTS[k];
    let st = 0;
    const name = (op === 'u' ? 'Uninstalling ' : op === 'i' ? 'Installing ' : 'Repairing ') + d.n.toLowerCase();
    return Actions.mk(name, this.dur(k, op), () => {
      const chk = this.check(c, k, op);
      if (!chk.ok) { Player.say(chk.why + '.', '#ccc'); return; }
      const skill = Player.skill('Mechanics'), fail = Math.max(0.03, 0.28 - (skill - (d.sk || 0)) * 0.07);
      const P = c.parts;
      if (op === 'u') {
        const v = P[k];
        P[k] = -1;
        if (k === 'gasTank') { c.gas = 0; Vehicles.puddle(c, 'fuel'); }
        if (k === 'battery' && c.engine) Vehicles.stall(c);
        if ((d.glass || d.light) && R.chance(fail)) { Sfx.play('glass', c.x, c.y); Player.say('It shattered as it came out.', '#f99'); }
        else if (v <= 0) Player.say('It was ruined. I threw it away.', '#ccc');
        else {
          const it = Items.make(Vehicles.partItem(c, k), { set: { pc: Math.max(1, Math.round(v - (R.chance(fail) ? R.f(5, 15) : 0))) } });
          if (k === 'battery') it.charge = c.charge;
          Player.addItem(it);
        }
        if (k === 'battery') c.charge = 0;
        Player.xp('Mechanics', 2 + (d.sk || 0));
      } else if (op === 'i') {
        if (!Player.find(x => x === chk.item)) return;
        Player.removeItem(chk.item);
        P[k] = Math.max(1, Math.round(chk.item.pc === undefined ? 100 : chk.item.pc));
        if (k === 'battery') c.charge = chk.item.charge === undefined ? R.f(0.6, 1) : chk.item.charge;
        if (d.door) c.doorOpen &= ~d.door;
        Player.xp('Mechanics', 3 + (d.sk || 0) * 2);
      } else {
        Player.removeItem(chk.item);
        const gain = R.f(8, 14) + skill * R.f(2, 3.5);
        if (R.chance(fail * 0.6)) { Player.say("I couldn't get it to fit. The parts are wasted.", '#ccc'); Player.xp('Mechanics', 1); }
        else { P.engine = Math.min(100, Math.round(Math.max(0, P.engine) + gain)); Player.xp('Mechanics', 5); }
      }
      Vehicles.recalc(c);
      Sfx.play('clunk', c.x, c.y);
      UI.refresh(); this.sig = '';
    }, {
      anim: 'work',
      check: () => !G.player.inCar && U.dist(G.player.x, G.player.y, c.x, c.y) < CAR_TYPES[c.type].len / 2 + 2.2,
      tick: (dt) => { st -= dt; if (st <= 0) { st = R.f(0.8, 1.6); Sfx.play(R.chance(0.6) ? 'ratchet' : 'clunk', c.x, c.y); Noise.emit(c.x, c.y, 6, 'hammer'); } },
    });
  },
  // ------------------------------------------------------------------ window
  open(c) {
    Vehicles.ensure(c);
    if (!UI.panelDefs.mech) UI.panelDefs.mech = { title: 'Vehicle Mechanics', w: 500, h: 560, x: 180, y: 50 };
    this.car = c;
    const P = UI.ensurePanel('mech');
    if (!P.mechBound) {
      P.mechBound = true;
      P.body.style.overflowY = 'auto';
      P.body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mk]');
        if (!b || b.classList.contains('dis') || !this.car) return;
        const [op, k] = b.dataset.mk.split(':');
        if (op === 'hood') this.goTo(this.car, 'hood', () => Vehicles.toggleHood(this.car));
        else this.work(this.car, k, op);
        this.sig = '';
      });
    }
    UI.open('mech');
    this.sig = '';
    this.render();
  },
  isOpen() { return !!(UI.panels && UI.panels.mech && UI.panels.mech.open); },
  bar(v) {
    if (v < 0) return '<span style="color:#8a8070">— missing —</span>';
    const col = v >= 70 ? '#6aa84a' : v >= 40 ? '#c8a838' : v >= 15 ? '#d0782a' : '#c03a2a';
    return `<span class="bar" style="display:inline-block;width:110px;flex:none;vertical-align:middle"><i style="width:${Math.max(2, v)}%;background:${col}"></i></span> <span style="display:inline-block;width:34px;text-align:right">${Math.round(v)}%</span>`;
  },
  render() {
    const P = UI.panels.mech, c = this.car;
    if (!P || !c) return;
    const T = CAR_TYPES[c.type], p = G.player;
    P.el.querySelector('.pt').textContent = 'Vehicle Mechanics — ' + T.n;
    const sk = Player.skill('Mechanics');
    const tools = Object.keys(MECH_TOOLS).map(t => `<span style="color:${this.tool(t) ? '#a8d890' : '#7a7266'}">${this.tool(t) ? '✔' : '✘'} ${MECH_TOOLS[t]}</span>`).join(' · ');
    const charge = c.parts.battery > 0 ? Math.round(c.charge * 100) + '%' : '—';
    let h = `<div style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.12)">
      <div><b>${T.n}</b> <span class="sml">(${U.esc(Vehicles.colName(c.col))}${T.hd ? ', heavy-duty' : ''})</span> · Overall ${Math.round(c.hp)}%${c.burnt ? ' · <span style="color:#d06040">burnt out</span>' : ''}</div>
      <div class="sml">Engine quality ${c.eq === undefined ? '?' : Math.round(c.eq)}/100 · Gas ${Math.round(c.gas * 100)}% · Battery charge ${charge} · ${c.engine ? 'Engine running' : 'Engine off'} · ${Vehicles.hasKey(c) ? 'Key: yes' : 'Key: no'} · Mechanics ${sk}</div>
      <div class="sml">${tools}</div>
      ${c.parts.hood >= 0 ? `<span class="btn xs" data-mk="hood:">${c.hoodOpen ? 'Close hood' : 'Open hood'}</span>` : ''}${p.inCar ? ' <span class="sml" style="color:#d8b060">Get out of the vehicle to work on it.</span>' : ''}
    </div><div style="padding:2px 8px 8px">`;
    for (const g of MECH_GROUPS) {
      h += `<div class="sgrp" style="margin-top:6px">${g}</div>`;
      for (const k of PART_KEYS) {
        const d = CAR_PARTS[k];
        if (d.grp !== g || !Vehicles.hasSlot(c, k)) continue;
        const v = c.parts[k];
        const btn = (op, label) => {
          const r = this.check(c, k, op);
          if (!r.ok && (r.why === 'Cannot be removed' || r.why === 'Replace it instead' || r.why === 'Repair it instead' || r.why === 'Not installed' || r.why === 'Uninstall the old one first' || r.why === 'In perfect condition' || r.why === 'Smashed')) return '';
          return `<span class="btn xs ${r.ok ? '' : 'dis'}" style="${r.ok ? '' : 'pointer-events:auto;cursor:help'}" data-mk="${op}:${k}" title="${U.esc(r.ok ? label + ' (' + Math.round(this.dur(k, op)) + 's)' : r.why)}">${label}</span>`;
        };
        let state = '';
        if (d.glass && v >= 0 && v < 40) state = v <= 0 ? ' smashed' : ' cracked';
        else if (d.tire && v >= 0 && v < 10) state = ' flat';
        else if (d.door && v >= 0 && (c.doorOpen & d.door)) state = ' open';
        h += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
          <span style="width:130px;flex:none">${d.n}<span class="sml">${state}</span></span>${this.bar(v)}
          <span style="flex:1;text-align:right">${btn('u', 'Uninstall')}${btn('i', 'Install')}${btn('r', 'Repair')}</span></div>`;
      }
    }
    h += '<div class="sml" style="margin-top:8px">Tires need a lug wrench and a jack. Engine-bay parts need the hood open. Heavy-duty vehicles take heavy-duty tires, brakes, suspension and mufflers.</div></div>';
    const st = P.body.scrollTop;
    P.body.innerHTML = h;
    P.body.scrollTop = st;
  },
  // called every step from Vehicles.update (real seconds)
  tick(dt) {
    if (!this.isOpen()) return;
    const c = this.car, p = G.player;
    if (!c || !G.cars.includes(c) || p.dead || (!p.inCar && U.dist(p.x, p.y, c.x, c.y) > 9)) { UI.close('mech'); this.car = null; return; }
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.4;
    const sig = JSON.stringify(c.parts) + c.hoodOpen + c.doorOpen + c.engine + Math.round(c.gas * 100) + Math.round(c.charge * 100) + !!p.inCar + p.inv.length + Player.allItems().length + Player.skill('Mechanics') + (Math.abs(c.v) > 0.1);
    if (sig !== this.sig) { this.sig = sig; this.render(); }
  },
};
// ------------------------------------------------------------------ radial menu (V)
Mechanics.radial = (ctx) => {
  if (!ctx || !ctx.car) return [];
  return Mechanics.carActions(ctx.car, ctx.inside).slice(0, 12).map(a => ({
    label: a.label, icon: a.icon, enabled: a.enabled !== false,
    fn: !ctx.inside && a.walk ? () => Mechanics.goTo(ctx.car, typeof a.walk === 'string' ? a.walk : null, a.fn) : a.fn,
  }));
};
Mechanics.register = () => {
  if (Mechanics.registered || typeof RADIAL_PROVIDERS === 'undefined') return;
  Mechanics.registered = true;
  RADIAL_PROVIDERS.push(Mechanics.radial);
};
Mechanics.register();
document.addEventListener('DOMContentLoaded', () => Mechanics.register());
