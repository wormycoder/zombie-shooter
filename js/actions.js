'use strict';
// ---------------------------------------------------------------------------
// Timed actions
// ---------------------------------------------------------------------------
const Actions = {
  start(a) {
    const p = G.player;
    if (!a) return;
    p.action = a; a.t = 0;
    p.sitting = false;
    if (a.begin) a.begin();
  },
  queue(a) {
    const p = G.player;
    if (!a) return;
    if (!p.action) this.start(a); else p.queue.push(a);
  },
  cancel(silent) {
    const p = G.player;
    if (p.action && p.action.onCancel) p.action.onCancel();
    p.action = null; p.queue = [];
    p.climb = null;
    void silent;
  },
  update(dt) {
    const p = G.player;
    const a = p.action;
    if (!a || p.dead) return;
    if (a.check && !a.check()) { this.cancel(); return; }
    a.t += dt * (a.rate || 1);
    if (a.tick) a.tick(dt);
    if (a.t >= a.dur) {
      p.action = null;
      try { a.done(); } catch (e) { console.error(e); }
      const nx = p.queue.shift();
      if (nx) this.start(nx);
    }
  },
  mk(name, dur, done, o) { return Object.assign({ name, dur, done, anim: 'work' }, o || {}); },
  dexMult() { return Player.hasTrait('dextrous') ? 0.5 : Player.hasTrait('allthumbs') ? 1.6 : 1; },

  // ------------------------------------------------------------------ inventory transfers
  transfer(it, from, to) {
    const w = Items.weight(it);
    const dur = (0.2 + w * 0.12) * this.dexMult();
    return this.mk('Transferring ' + Items.name(it), dur, () => {
      if (!Cont.has(from, it)) return;
      if (!Cont.canFit(to, it)) { Player.say("It won't fit.", '#f99'); G.player.queue = []; return; }
      Cont.remove(from, it);
      Cont.add(to, it);
      Sfx.play('pickup');
      UI.refresh();
    }, { anim: 'loot', check: () => Cont.inReach(from) && Cont.inReach(to) });
  },
  // ensure item is in player main inventory first, then run action
  withItem(it, actFn) {
    const src = UI.containerOfItem(it);
    if (src && src.kind !== 'inv' && src.kind !== 'bag') {
      this.queue(this.transfer(it, src, Cont.inv()));
    }
    this.queue({ name: '', dur: 0, done: () => this.queue(actFn()), anim: 'work' });
  },

  // ------------------------------------------------------------------ consumption
  eat(it, portion) {
    const d = ITEMS[it.id];
    portion = portion || 1;
    if (d.open && !it.opened && !Player.findTag('canopener')) { Player.say('I need a can opener.', '#ccc'); return null; }
    const dur = d.drink ? 3 : (2.5 + (d.hunger || 0.1) * 14) * portion;
    return this.mk((d.drink ? 'Drinking ' : 'Eating ') + Items.name(it), dur, () => {
      const p = G.player, st = p.st;
      if (!Player.find(x => x === it)) return;
      const fs = Items.freshState(it);
      st.hunger = Math.max(-0.25, st.hunger - Items.foodVal(it, 'hunger') * portion);
      st.thirst = U.clamp(st.thirst - (d.thirst || 0) * portion, 0, 1);
      st.unhappy = U.clamp(st.unhappy + (d.unhappy || 0) * portion + (fs === 1 ? 5 : 0) + (it.burnt ? 10 : 0), 0, 100);
      st.boredom = U.clamp(st.boredom + (d.bored || 0) * portion, 0, 100);
      if (d.alc) st.drunk = Math.min(1, st.drunk + d.alc * portion);
      if (d.fatigue) st.fatigue = U.clamp(st.fatigue + d.fatigue, 0, 1);
      if (d.stress) st.stress = U.clamp(st.stress + d.stress, 0, 1);
      let sick = 0;
      const gut = Player.hasTrait('irongut') ? 0.5 : Player.hasTrait('weakstomach') ? 1.6 : 1;
      if (fs === 2) { sick += 0.5; st.unhappy = Math.min(100, st.unhappy + 20); Player.say('That tasted rotten...', '#cc9'); }
      if (d.raw && !it.cooked && R.chance(0.6)) sick += 0.35;
      if (d.poison) st.poison = Math.min(1, st.poison + d.poison);
      st.foodSick = Math.min(1, st.foodSick + sick * gut);
      if (portion >= 1 || (it.portion !== undefined && it.portion - portion <= 0.01)) {
        Player.removeItem(it);
        if (d.empty) Player.addItem(Items.make(d.empty));
      } else it.portion = (it.portion === undefined ? 1 : it.portion) - portion;
      if (d.open) it.opened = true;
      Sfx.play(d.drink ? 'drink' : 'eat');
      UI.refresh();
    }, { anim: 'eat' });
  },
  drink(it) {
    const p = G.player;
    if (it.fl <= 0.001) { Player.say("It's empty.", '#ccc'); return null; }
    const amt = Math.min(it.fl, Math.max(0.08, p.st.thirst + 0.02));
    return this.mk('Drinking', 1.5 + amt * 7, () => {
      const st = p.st;
      if (!Player.find(x => x === it)) return;
      st.thirst = Math.max(0, st.thirst - amt);
      it.fl = Math.max(0, it.fl - amt);
      if (it.taint && R.chance(0.45)) { st.foodSick = Math.min(1, st.foodSick + 0.3 * (Player.hasTrait('irongut') ? 0.5 : 1)); Player.say('That water tasted foul...', '#cc9'); }
      if (it.fl <= 0.001) { it.fl = 0; it.taint = false; }
      Sfx.play('drink');
      UI.refresh();
    }, { anim: 'eat' });
  },
  drinkSource(src) {
    const p = G.player;
    return this.mk('Drinking', 2 + p.st.thirst * 8, () => {
      const avail = Water.take(src, p.st.thirst + 0.05);
      if (avail <= 0) { Player.say('No water left.', '#ccc'); return; }
      p.st.thirst = Math.max(0, p.st.thirst - avail);
      if (Water.tainted(src) && R.chance(0.5)) { p.st.foodSick = Math.min(1, p.st.foodSick + 0.3 * (Player.hasTrait('irongut') ? 0.5 : 1)); Player.say('That water tasted foul...', '#cc9'); }
      Sfx.play('drink');
    }, { anim: 'eat', check: () => Water.near(src) });
  },
  fill(it, src) {
    const d = ITEMS[it.id];
    const need = d.fluid - it.fl;
    if (need <= 0.01) { Player.say("It's already full.", '#ccc'); return null; }
    return this.mk('Filling ' + Items.name(it), 1 + need * 2.5, () => {
      const got = Water.take(src, need);
      if (got <= 0) { Player.say('No water.', '#ccc'); return; }
      const t = Water.tainted(src);
      it.taint = (it.fl > 0.01 && it.taint) || t;
      it.fl += got;
      Sfx.play('fill');
      UI.refresh();
    }, { anim: 'work', check: () => Water.near(src) });
  },
  pour(it) {
    return this.mk('Emptying', 1.5, () => { it.fl = 0; it.taint = false; UI.refresh(); Sfx.play('fill'); });
  },
  pills(it) {
    const d = ITEMS[it.id];
    return this.mk('Taking ' + d.n, 2, () => {
      const st = G.player.st;
      if (d.pill === 'pain') st.painkill = 4;
      if (d.pill === 'antibiotic') st.antibio = 24;
      if (d.pill === 'beta') { st.beta = 4; st.panic *= 0.3; }
      if (d.pill === 'antidep') st.antidep = 12;
      if (d.pill === 'sleep') { st.fatigue = Math.min(1, st.fatigue + 0.35); G.player.sleepPill = true; }
      if (d.pill === 'vitamin') st.fatigue = Math.max(0, st.fatigue - 0.1);
      it.uses--;
      if (it.uses <= 0) Player.removeItem(it);
      Sfx.play('pills'); UI.refresh();
    }, { anim: 'eat' });
  },
  smoke(it) {
    if (!Player.findTag('lighter')) { Player.say('I need a lighter.', '#ccc'); return null; }
    return this.mk('Smoking', 6, () => {
      const st = G.player.st;
      st.stress = Math.max(0, st.stress - 0.3); st.unhappy = Math.max(0, st.unhappy - 6); st.smokeT = 0;
      if (!Player.hasTrait('smoker')) st.foodSick = Math.min(1, st.foodSick + 0.1);
      it.uses--; if (it.uses <= 0) Player.removeItem(it);
      const l = Player.findTag('lighter'); if (l) { l.uses--; if (l.uses <= 0) Player.removeItem(l); }
      UI.refresh();
    }, { anim: 'eat' });
  },
  read(it) {
    const d = ITEMS[it.id];
    const p = G.player;
    if (Player.hasTrait('illiterate')) { Player.say("I can't read.", '#ccc'); return null; }
    if (Render.lightAt(p.x, p.y) < 0.25) { Player.say("It's too dark to read.", '#ccc'); return null; }
    if (d.skillBook) {
      const s = p.skills[d.skillBook.sk];
      if (s.lv < d.skillBook.min) { Player.say("This book is too advanced for me.", '#ccc'); return null; }
      if (s.lv > d.skillBook.max) { Player.say("I won't learn anything from this.", '#ccc'); return null; }
    }
    const total = d.read / MIN_PER_SEC;
    const a = this.mk('Reading ' + d.n, total, () => {
      it.readP = 0;
      if (d.skillBook) {
        p.bookMult[d.skillBook.sk] = { mult: d.skillBook.mult, min: d.skillBook.min, max: d.skillBook.max };
        Player.say('Finished reading! ' + SKILL_NAMES[d.skillBook.sk] + ' XP x' + d.skillBook.mult, '#8f8');
      } else {
        Player.say('Finished reading.', '#ccc');
      }
      if (d.unhappy) p.st.unhappy = Math.max(0, p.st.unhappy + d.unhappy);
      UI.refresh();
    }, { anim: 'eat', fun: 22, check: () => Render.lightAt(p.x, p.y) >= 0.2 && !!Player.find(x => x === it) });
    a.t0 = (it.readP || 0) * total;
    a.begin = () => { a.t = a.t0; Sfx.play('page'); };
    a.tick = () => { it.readP = a.t / total; };
    return a;
  },

  // ------------------------------------------------------------------ medical
  bandage(part, it) {
    const p = G.player, d = ITEMS[it.id];
    const fa = Player.skill('FirstAid');
    const dur = 3.5 * (1 - fa * 0.05) * (Player.hasTrait('hemophobic') ? 1.5 : 1);
    return this.mk('Bandaging ' + PART_NAMES[part], dur, () => {
      if (!Player.find(x => x === it)) return;
      const b = p.body[part];
      b.bandage = { q: d.bandage, dirt: d.bandage === 0 ? 0.45 : d.bandage === 1 ? 0.08 : 0 };
      if (d.bandage === 2) b.disinf = Math.max(b.disinf, 6);
      Player.removeItem(it);
      Player.xp('FirstAid', 5);
      Sfx.play('bandage'); UI.refresh();
    }, { anim: 'work' });
  },
  removeBandage(part) {
    return this.mk('Removing bandage', 1.5, () => { G.player.body[part].bandage = null; Sfx.play('bandage'); UI.refresh(); });
  },
  disinfect(part, it) {
    return this.mk('Disinfecting', 2.5, () => {
      const b = G.player.body[part];
      b.disinf = 30; b.infect = Math.max(0, b.infect - 0.5);
      G.player.st.pain = Math.min(100, G.player.st.pain + 10);
      if (it.uses !== undefined) { it.uses--; if (it.uses <= 0) Player.removeItem(it); } else Player.removeItem(it);
      Player.xp('FirstAid', 3);
      Sfx.play('pills'); UI.refresh();
    }, { anim: 'work' });
  },
  stitch(part, it) {
    return this.mk('Stitching wound', 7 * (1 - Player.skill('FirstAid') * 0.05), () => {
      const b = G.player.body[part];
      b.stitched = true;
      Player.removeItem(it);
      Player.xp('FirstAid', 8);
      if (Player.skill('FirstAid') < 3) G.player.st.pain = Math.min(100, G.player.st.pain + 25);
      Sfx.play('bandage'); UI.refresh();
    }, { anim: 'work' });
  },
  removeGlass(part) {
    const tw = Player.findTag('tweezers');
    return this.mk('Removing glass', tw ? 3 : 5, () => {
      const b = G.player.body[part];
      b.glass = false;
      if (!tw && R.chance(0.4)) { Player.say('Ouch!', '#f99'); b.w.cut = Math.max(b.w.cut || 0, 10); }
      Player.xp('FirstAid', 5);
      UI.refresh();
    }, { anim: 'work' });
  },

  // ------------------------------------------------------------------ gear
  wear(it) {
    return this.mk('Putting on ' + Items.name(it), ITEMS[it.id].bag ? 0.8 : 1.6, () => { if (Player.find(x => x === it)) { Player.wear(it); UI.refresh(); } }, { anim: 'work' });
  },
  unwear(it) {
    return this.mk('Taking off ' + Items.name(it), 1.2, () => { Player.unwear(it); UI.refresh(); }, { anim: 'work' });
  },
  equip(it, slot) {
    return this.mk('Equipping', 0.5, () => { if (Player.find(x => x === it)) { Player.equip(it, slot); UI.refresh(); } }, { walkOk: true });
  },
  reload() {
    const p = G.player;
    const it = Player.primary();
    if (!it || !ITEMS[it.id].gun) return;
    const g = ITEMS[it.id].gun;
    if (it.ammo >= g.cap) { Player.say('Fully loaded.', '#ccc'); return; }
    let rounds = Player.findAll(x => x.id === g.ammo);
    if (!rounds.length) {
      const box = Player.find(x => ITEMS[x.id].boxOf === g.ammo);
      if (box) { this.queue(this.openBox(box)); this.queue({ name: '', dur: 0, done: () => this.reload() }); return; }
      Player.say('No ammo!', '#f99'); return;
    }
    const mag = g.model === 'pistol' && it.id === 'Pistol' || it.id === 'AssaultRifle';
    const rl = Player.skill('Reloading');
    if (mag) {
      this.queue(this.mk('Reloading', 2.4 * (1 - rl * 0.06), () => {
        const need = g.cap - it.ammo;
        const avail = Player.findAll(x => x.id === g.ammo).slice(0, need);
        for (const r2 of avail) { Player.removeItem(r2); it.ammo++; }
        Player.xp('Reloading', 3);
        Sfx.play('reload'); UI.refresh();
      }, { anim: 'work', walkOk: true }));
    } else {
      const one = this.mk('Reloading', g.reload * (1 - rl * 0.06) + 0.25, () => {
        const r2 = Player.find(x => x.id === g.ammo);
        if (!r2 || it.ammo >= g.cap) return;
        Player.removeItem(r2); it.ammo++;
        Player.xp('Reloading', 1);
        Sfx.play('shellin');
        if (it.ammo < g.cap && Player.find(x => x.id === g.ammo)) p.queue.unshift(this.mk('Reloading', one.dur, one.done, { anim: 'work', walkOk: true }));
        UI.refresh();
      }, { anim: 'work', walkOk: true });
      this.queue(one);
    }
  },
  unload(it) {
    const g = ITEMS[it.id].gun;
    return this.mk('Unloading', 1.5, () => { for (let k = 0; k < it.ammo; k++) Player.addItem(Items.make(g.ammo)); it.ammo = 0; UI.refresh(); }, { anim: 'work' });
  },
  openBox(it) {
    const d = ITEMS[it.id];
    return this.mk('Opening ' + d.n, 1.5, () => {
      if (!Player.find(x => x === it)) return;
      const c = UI.containerOfItem(it);
      Player.removeItem(it);
      for (let k = 0; k < d.boxN; k++) (c && c.items ? c.items : G.player.inv).push(Items.make(d.boxOf));
      Sfx.play('pickup'); UI.refresh();
    }, { anim: 'work' });
  },
  rip(it) {
    const d = ITEMS[it.id];
    const n = d.id === 'Sheet' ? 4 : (d.slot === 'jacket' || d.slot === 'pants') ? 3 : 2;
    return this.mk('Ripping ' + d.n, Player.findTag('scissors') ? 2 : 4, () => {
      if (!Player.find(x => x === it)) return;
      Player.removeItem(it);
      for (let k = 0; k < n; k++) Player.addItem(Items.make('RippedSheets'));
      Sfx.play('rip'); UI.refresh();
    }, { anim: 'work' });
  },
  repair(it, tool) {
    const d = ITEMS[it.id], td = ITEMS[tool.id];
    return this.mk('Repairing ' + d.n, 4, () => {
      const max = (d.wpn || d.gun).cond;
      it.cond = Math.min(max, it.cond + Math.ceil(max * td.repair * (1 + Player.skill('Maintenance') * 0.1)));
      tool.uses--; if (tool.uses <= 0) Player.removeItem(tool);
      Player.xp('Maintenance', 4);
      UI.refresh();
    }, { anim: 'work' });
  },
  battery(it) {
    const bat = Player.findId('Battery');
    if (!bat) { Player.say('I need a battery.', '#ccc'); return null; }
    return this.mk('Replacing battery', 1.5, () => { Player.removeItem(bat); it.pow = 1; UI.refresh(); }, { anim: 'work' });
  },

  // ------------------------------------------------------------------ world
  barricade(e) {
    const [x, y, d] = e;
    const f = World.feat(x, y, d);
    const hammer = Player.findTag('hammer');
    const plank = Player.findId('Plank');
    if (!hammer || !plank || Player.count('Nails') < 2) { Player.say('I need a hammer, a plank and 2 nails.', '#ccc'); return null; }
    if (f.barricade >= 4) { Player.say("Can't add more.", '#ccc'); return null; }
    const carp = Player.skill('Carpentry');
    const dur = 6 * (1 - carp * 0.05) * (Player.hasTrait('handy') ? 0.8 : 1);
    let noiseT = 0;
    return this.mk('Barricading', dur, () => {
      const pl = Player.findId('Plank');
      if (!pl || Player.count('Nails') < 2) return;
      Player.removeItem(pl);
      for (let k = 0; k < 2; k++) Player.removeItem(Player.findId('Nails'));
      f.barricade = (f.barricade || 0) + 1;
      f.bhp = f.bhp || [];
      f.bhp.push(Math.round(120 * (1 + carp * 0.08) * (Player.hasTrait('handy') ? 1.2 : 1)));
      if (f.k === 'door') f.open = false;
      Player.xp('Carpentry', 3);
      UI.refresh();
    }, {
      anim: 'hammer', check: () => Interact.nearEdge(e, 1.6),
      tick: (dt) => { noiseT -= dt; if (noiseT <= 0) { noiseT = 1.1; Noise.emit(G.player.x, G.player.y, 14, 'hammer'); Sfx.play('hammer'); } },
    });
  },
  unbarricade(e) {
    const [x, y, d] = e;
    const f = World.feat(x, y, d);
    if (!Player.findTag('hammer') && !Player.findTag('crowbar')) { Player.say('I need a hammer or crowbar.', '#ccc'); return null; }
    return this.mk('Removing barricade', 4, () => {
      if (!f.barricade) return;
      f.barricade--; if (f.bhp) f.bhp.pop();
      Player.addItem(Items.make('Plank'));
      if (R.chance(0.5)) Player.addItem(Items.make('Nails'));
      Noise.emit(G.player.x, G.player.y, 9, 'hammer');
      Sfx.play('wood'); UI.refresh();
    }, { anim: 'hammer', check: () => Interact.nearEdge(e, 1.6) });
  },
  addSheet(e) {
    const f = World.feat(...e);
    const sh = Player.findId('Sheet');
    if (!sh) return null;
    return this.mk('Hanging sheet', 2.5, () => { Player.removeItem(sh); f.curtains = true; f.curtainsClosed = true; f.curtCol = '#e8e8f0'; UI.refresh(); }, { anim: 'work', check: () => Interact.nearEdge(e, 1.6) });
  },
  removeWinGlass(e) {
    const f = World.feat(...e);
    return this.mk('Removing broken glass', 2.5, () => {
      f.glassOut = true;
      if (!Player.worn('gloves') && R.chance(0.3)) Player.addWound(R.pick(['HandL', 'HandR']), 'scratch', { isZombie: false });
      Sfx.play('glass');
    }, { anim: 'work', check: () => Interact.nearEdge(e, 1.6) });
  },
  chop(x, y) {
    const axe = Player.findTag('chop');
    if (!axe) { Player.say('I need an axe.', '#ccc'); return null; }
    const o = World.obj(x, y);
    const sk = Player.skill('Axe');
    const dur = 14 * (1 - sk * 0.05) * (Player.hasTrait('axeman') ? 0.65 : 1) * (o.sz || 1);
    let nt = 0;
    return this.mk('Chopping tree', dur, () => {
      World.setObj(x, y, null);
      for (let k = 0; k < 2; k++) World.dropItem(x + 0.5, y + 0.5, Items.make('Log'));
      for (let k = 0; k < R.int(1, 3); k++) World.dropItem(x + 0.5, y + 0.5, Items.make('TreeBranch'));
      World.dropItem(x + 0.5, y + 0.5, Items.make('Twigs'));
      Player.xp('Axe', 5); Player.xp('Strength', 2);
      Sfx.play('treefall');
      Noise.emit(x, y, 18, 'chop');
    }, {
      anim: 'hammer', check: () => U.dist(G.player.x, G.player.y, x + 0.5, y + 0.5) < 1.8 && !!World.obj(x, y),
      tick: (dt) => { nt -= dt; G.player.st.endurance = Math.max(0, G.player.st.endurance - dt * 0.006); if (nt <= 0) { nt = 1.2; Sfx.play('chop'); Noise.emit(x, y, 13, 'chop'); } },
      begin: () => { G.player.angle = Math.atan2(y + 0.5 - G.player.y, x + 0.5 - G.player.x); Player.equip(axe, 'primary'); },
    });
  },
  forage(x, y) {
    const p = G.player;
    return this.mk('Foraging', 14, () => {
      const zk = Math.floor(x / 10) + ',' + Math.floor(y / 10);
      const z = Wd.forage.get(zk) || { n: 0, day: Game.day() };
      if (z.day !== Game.day()) { z.n = 0; z.day = Game.day(); }
      Wd.forage.set(zk, z);
      const sk = Player.skill('Foraging') + (Player.hasTrait('outdoorsman') ? 1 : 0) + (p.occ === 'ranger' ? 1 : 0);
      if (z.n >= 6 || !R.chance(0.3 + sk * 0.06)) { Player.say("Didn't find anything.", '#ccc'); Player.xp('Foraging', 1); return; }
      z.n++;
      const forest = World.floor(x, y) === FL.FOREST;
      const tbl = forest ? [['Mushrooms', 3], ['StrangeMushrooms', 2], ['Berries', 3], ['Worms', 3], ['Insects', 2], ['Twigs', 4], ['TreeBranch', 3], ['Stone', 2]] : [['Worms', 4], ['Insects', 3], ['Twigs', 3], ['Stone', 3], ['Berries', 1], ['TreeBranch', 1]];
      const n = R.int(1, sk >= 4 ? 3 : 2);
      const found = [];
      for (let k = 0; k < n; k++) { const id = R.weighted(tbl); Player.addItem(Items.make(id)); found.push(ITEMS[id].n); }
      Player.say('Found: ' + found.join(', '), '#8f8');
      Player.xp('Foraging', 4);
      UI.refresh();
    }, { anim: 'kneel', fun: 8, check: () => U.dist(p.x, p.y, x + 0.5, y + 0.5) < 2.5 });
  },
  pickBerries(x, y) {
    const o = World.obj(x, y);
    return this.mk('Picking berries', 4, () => {
      if (!o.berries) return;
      o.berries = false; o.berryDay = Game.day();
      for (let k = 0; k < R.int(2, 5); k++) Player.addItem(Items.make('Berries'));
      Player.xp('Foraging', 3); UI.refresh();
    }, { anim: 'work' });
  },
  fish(x, y) {
    const rod = Player.findTag('fishing');
    if (!rod) { Player.say('I need a fishing rod.', '#ccc'); return null; }
    return this.mk('Fishing', 22, () => {
      const bait = Player.find(it => ITEMS[it.id].bait);
      const ch = 0.22 + Player.skill('Fishing') * 0.05 + (bait ? 0.22 : 0);
      if (bait) Player.removeItem(bait);
      if (R.chance(ch)) {
        const n = R.chance(0.3) ? 2 : 1;
        for (let k = 0; k < n; k++) Player.addItem(Items.make('Fish'));
        Player.say('Caught a fish!', '#8f8'); Player.xp('Fishing', 8); Sfx.play('splash');
      } else { Player.say('Nothing is biting.', '#ccc'); Player.xp('Fishing', 1); }
      UI.refresh();
    }, { anim: 'work', fun: 12, begin: () => { G.player.angle = Math.atan2(y + 0.5 - G.player.y, x + 0.5 - G.player.x); } });
  },
  dig(x, y) {
    const tool = Player.findTag('dig');
    if (!tool) { Player.say('I need a shovel or trowel.', '#ccc'); return null; }
    return this.mk('Digging furrow', tool.id === 'Shovel' ? 5 : 8, () => {
      if (World.obj(x, y)) return;
      Wd.floor[y * Wd.w + x] = FL.FURROW;
      World.setObj(x, y, { t: 'crop', dir: 'S', crop: null, stage: undefined, water: 0.3, grow: 0 });
      Player.xp('Farming', 2); Sfx.play('dig');
    }, { anim: 'kneel', check: () => U.dist(G.player.x, G.player.y, x + 0.5, y + 0.5) < 2 });
  },
  plant(x, y, seeds) {
    return this.mk('Planting', 3, () => {
      const o = World.obj(x, y);
      if (!o || o.t !== 'crop' || o.crop) return;
      o.crop = ITEMS[seeds.id].seeds; o.stage = 0; o.grow = 0; o.seed = true; o.dead = false;
      seeds.uses--; if (seeds.uses <= 0) Player.removeItem(seeds);
      Player.xp('Farming', 3); UI.refresh();
    }, { anim: 'kneel' });
  },
  water(x, y, can) {
    return this.mk('Watering', 2.5, () => {
      const o = World.obj(x, y);
      const amt = Math.min(can.fl, 0.5);
      can.fl -= amt; o.water = Math.min(1, (o.water || 0) + amt * 1.6);
      Player.xp('Farming', 1); Sfx.play('fill'); UI.refresh();
    }, { anim: 'work' });
  },
  harvest(x, y) {
    return this.mk('Harvesting', 4, () => {
      const o = World.obj(x, y);
      if (!o || o.stage < 4 || o.dead) return;
      const cd = CROPS[o.crop];
      const n = R.int(cd.yield[0], cd.yield[1]) + Math.floor(Player.skill('Farming') / 3);
      for (let k = 0; k < n; k++) Player.addItem(Items.make(cd.item));
      o.crop = null; o.stage = undefined; o.grow = 0; o.seed = false;
      Player.say('Harvested ' + n + ' ' + cd.n, '#8f8');
      Player.xp('Farming', 6); UI.refresh();
    }, { anim: 'kneel' });
  },
  disassemble(x, y) {
    const o = World.obj(x, y);
    const wood = ['bed', 'table', 'chair', 'wardrobe', 'dresser', 'nightstand', 'bookshelf', 'crate', 'woodcrate', 'desk', 'counter', 'pew', 'bench', 'sofa', 'armchair', 'barrel', 'toolcab'];
    if (!wood.includes(o.t)) return null;
    if (!Player.findTag('hammer') && !Player.findTag('saw') && !Player.findTag('screwdriver')) { Player.say('I need a hammer, saw or screwdriver.', '#ccc'); return null; }
    return this.mk('Disassembling ' + OBJ[o.t].n, 9, () => {
      if (World.obj(x, y) !== o) return;
      if (o.c && o.c.items) for (const it of o.c.items) World.dropItem(x + 0.5, y + 0.5, it);
      // remove multi-tile partner
      if (o.part !== undefined) for (const [dx, dy] of DIR4) { const n = World.obj(x + dx, y + dy); if (n && n.t === o.t && n.part !== undefined && n.part !== o.part) { World.setObj(x + dx, y + dy, null); break; } }
      World.setObj(x, y, null);
      const n = R.int(1, 3);
      for (let k = 0; k < n; k++) World.dropItem(x + 0.5, y + 0.5, Items.make('Plank'));
      for (let k = 0; k < R.int(0, 4); k++) World.dropItem(x + 0.5, y + 0.5, Items.make('Nails'));
      if (o.t === 'bed' && R.chance(0.7)) World.dropItem(x + 0.5, y + 0.5, Items.make('Sheet'));
      Player.xp('Carpentry', 3);
      Noise.emit(x, y, 12, 'hammer'); Sfx.play('wood'); UI.refresh();
    }, { anim: 'hammer', check: () => U.dist(G.player.x, G.player.y, x + 0.5, y + 0.5) < 2 });
  },
  addFuel(o, it) {
    const fv = { Plank: 60, Log: 120, TreeBranch: 40, Twigs: 15, Newspaper: 8, Magazine: 8, Novel: 15, RippedSheets: 6, Sheet: 15, ComicBook: 8 }[it.id] || 10;
    return this.mk('Adding fuel', 1.5, () => { Player.removeItem(it); o.fuel = (o.fuel || 0) + fv; UI.refresh(); Sfx.play('wood'); }, { anim: 'work' });
  },
  lightFire(o) {
    const l = Player.findTag('lighter');
    if (!l) { Player.say('I need a lighter or matches.', '#ccc'); return null; }
    if (!(o.fuel > 0)) { Player.say('It needs fuel first.', '#ccc'); return null; }
    return this.mk('Lighting fire', 3, () => { o.lit = true; l.uses--; if (l.uses <= 0) Player.removeItem(l); Sfx.play('fire'); UI.refresh(); }, { anim: 'kneel' });
  },
  hotwire(car) {
    return this.mk('Hotwiring', 9 * (1 - Player.skill('Electrical') * 0.06), () => {
      if (R.chance(0.65 + Player.skill('Electrical') * 0.05 + Player.skill('Mechanics') * 0.03)) { car.hotwired = true; Player.say('Got it!', '#8f8'); Player.xp('Electrical', 5); Player.xp('Mechanics', 3); Vehicles.startEngine(car); }
      else { Player.say("It didn't work.", '#ccc'); Player.xp('Electrical', 1); }
    }, { anim: 'work', walkOk: false, inCar: true });
  },
  refuelCar(car, can) {
    return this.mk('Refueling', 4 + can.fl * 4, () => {
      const room = 1 - car.gas;
      const amt = Math.min(room * 2.5, can.fl);
      car.gas = Math.min(1, car.gas + amt / 2.5);
      can.fl -= amt;
      Player.xp('Mechanics', 1); Sfx.play('fill'); UI.refresh();
    }, { anim: 'work', check: () => U.dist(G.player.x, G.player.y, car.x, car.y) < 3 });
  },
  siphon(car, can) {
    return this.mk('Siphoning gas', 5, () => {
      const room = 1 - can.fl;
      const amt = Math.min(room, car.gas * 2.5);
      can.fl += amt; car.gas -= amt / 2.5;
      UI.refresh(); Sfx.play('fill');
    }, { anim: 'work', check: () => U.dist(G.player.x, G.player.y, car.x, car.y) < 3 });
  },
  pumpGas(can) {
    return this.mk('Filling gas can', 5, () => {
      if (G.events.powerOff) { Player.say('The pump has no power.', '#ccc'); return; }
      can.fl = 1; Sfx.play('fill'); UI.refresh();
    }, { anim: 'work' });
  },
  genFuel(o, can) {
    return this.mk('Refueling generator', 4, () => { const amt = Math.min(can.fl, 1 - (o.fuel || 0)); o.fuel = (o.fuel || 0) + amt; can.fl -= amt; UI.refresh(); }, { anim: 'work' });
  },
  build(rec, tx, ty, d) {
    const carp = Player.skill('Carpentry');
    let nt = 0;
    return this.mk('Building ' + rec.n, rec.time * (1 - carp * 0.04) * (Player.hasTrait('handy') ? 0.8 : 1), () => {
      if (!Crafting.has(rec)) { Player.say("I'm missing materials.", '#ccc'); return; }
      if (!Build.valid(rec, tx, ty, d)) { Player.say("Can't build there.", '#ccc'); return; }
      Crafting.consume(rec);
      Build.place(rec, tx, ty, d);
      if (rec.xp) for (const sk in rec.xp) Player.xp(sk, rec.xp[sk]);
      UI.refresh();
    }, {
      anim: 'hammer', check: () => U.dist(G.player.x, G.player.y, tx + 0.5, ty + 0.5) < 2.4,
      tick: (dt) => { nt -= dt; if (nt <= 0) { nt = 1.1; Noise.emit(G.player.x, G.player.y, 13, 'hammer'); Sfx.play('hammer'); } },
      begin: () => { G.player.angle = Math.atan2(ty + 0.5 - G.player.y, tx + 0.5 - G.player.x); },
    });
  },
};

// ---------------------------------------------------------------------------
// Water sources
// ---------------------------------------------------------------------------
const Water = {
  // src: {kind:'obj', x,y} or {kind:'lake', x,y}
  near(src) { return U.dist(G.player.x, G.player.y, src.x + 0.5, src.y + 0.5) < 2.2; },
  tainted(src) {
    if (src.kind === 'lake') return true;
    const o = World.obj(src.x, src.y);
    if (!o) return true;
    if (o.t === 'barrel') return false;
    if (o.t === 'toilet') return G.events.waterOff;
    return false;
  },
  available(src) {
    if (src.kind === 'lake') return true;
    const o = World.obj(src.x, src.y);
    if (!o) return false;
    const w = OBJ[o.t].water;
    if (w === 'barrel') return (o.water || 0) > 0.01;
    if (w === 'toilet') return !G.events.waterOff || (o.tank === undefined ? 1 : o.tank) > 0.01;
    if (w === 'tap') return !G.events.waterOff || (o.tank || 0) > 0.01;
    return false;
  },
  take(src, amt) {
    if (src.kind === 'lake') return amt;
    const o = World.obj(src.x, src.y);
    if (!o) return 0;
    const w = OBJ[o.t].water;
    if (w === 'barrel') { const got = Math.min(amt, (o.water || 0) * 4); o.water = Math.max(0, (o.water || 0) - got / 4); return got; }
    if (!G.events.waterOff) return amt;
    if (o.tank === undefined) o.tank = w === 'toilet' ? 1.0 : 0.3;
    const got = Math.min(amt, o.tank);
    o.tank -= got;
    return got;
  },
};
