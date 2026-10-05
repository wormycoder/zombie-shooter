'use strict';
// ---------------------------------------------------------------------------
// Containers abstraction
// ---------------------------------------------------------------------------
const Cont = {
  inv() { return { kind: 'inv', items: G.player.inv, name: 'Inventory', key: 'inv' }; },
  bag(b) { if (!b.items) b.items = []; return { kind: 'bag', bag: b, items: b.items, name: Items.name(b), key: 'bag' + b.uid }; },
  obj(o, x, y) { World.contItems(o, x, y); o.c.px = x; o.c.py = y; if (o.c.items !== null) Game.trackCont(o.c); return { kind: 'obj', obj: o, x, y, items: o.c.items, name: OBJ[o.t].n, key: 'o' + x + ',' + y }; },
  floor(cx, cy) {
    const items = [];
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) { const a = World.inb(x, y) ? World.floorItems(x, y) : null; if (a) for (const it of a) items.push(it); }
    return { kind: 'floor', x: cx, y: cy, items, name: 'Floor', key: 'floor' };
  },
  corpse(z) { if (!z.loot) z.loot = []; return { kind: 'corpse', z, items: z.loot, name: 'Corpse', key: 'z' + z.id }; },
  car(car, slot) {
    const c = car[slot];
    if (c.items === null) c.items = Loot.roll('car', c.type, 0);
    return { kind: 'car', car, slot, items: c.items, name: slot === 'trunk' ? 'Trunk' : 'Glove Box', key: 'car' + car.id + slot, cap: c.cap };
  },
  has(c, it) {
    if (c.kind === 'floor') return !!this.floorTile(c, it);
    return c.items.includes(it);
  },
  floorTile(c, it) {
    for (let y = c.y - 1; y <= c.y + 1; y++) for (let x = c.x - 1; x <= c.x + 1; x++) { const a = World.inb(x, y) ? World.floorItems(x, y) : null; if (a && a.includes(it)) return [x, y]; }
    return null;
  },
  remove(c, it) {
    if (c.kind === 'inv' || c.kind === 'bag') { Player.removeItem(it); return; }
    if (c.kind === 'floor') { const t = this.floorTile(c, it); if (t) World.removeFloorItem(t[0], t[1], it); delete it.fx; delete it.fy; return; }
    const k = c.items.indexOf(it);
    if (k >= 0) c.items.splice(k, 1);
    if (c.kind === 'obj') Game.trackCont(c.obj.c);
  },
  add(c, it) {
    if (c.kind === 'floor') { const p = G.player; World.dropItem(p.x, p.y, it); c.items.push(it); return; }
    if (c.kind === 'inv' || c.kind === 'bag') { delete it.fx; delete it.fy; }
    c.items.push(it);
    if (c.kind === 'obj') Game.trackCont(c.obj.c);
  },
  cap(c) {
    if (c.kind === 'inv') return 50;
    if (c.kind === 'bag') return Player.bagCap(c.bag);
    if (c.kind === 'obj') return c.obj.c.cap;
    if (c.kind === 'car') return c.cap;
    return 9999;
  },
  weight(c) { if (c.kind === 'inv') return Player.weight(); return Items.contentWeight(c.items); },
  canFit(c, it) {
    if (c.kind === 'bag' && (it === c.bag || (ITEMS[it.id].bag && c.bag))) { if (it === c.bag) return false; }
    if (c.kind === 'floor' || c.kind === 'corpse') return true;
    return this.weight(c) + Items.weight(it) <= this.cap(c) + 0.001;
  },
  inReach(c) {
    const p = G.player;
    if (!c || c.kind === 'inv' || c.kind === 'bag') return true;
    if (c.kind === 'obj') return U.dist(p.x, p.y, c.x + 0.5, c.y + 0.5) < 2.0 || (p.inCar && false);
    if (c.kind === 'floor') return U.dist(p.x, p.y, c.x + 0.5, c.y + 0.5) < 2.2;
    if (c.kind === 'corpse') return U.dist(p.x, p.y, c.z.x, c.z.y) < 2.2;
    if (c.kind === 'car') return p.inCar === c.car || U.dist(p.x, p.y, c.car.x, c.car.y) < 3.2;
    return true;
  },
};

// ---------------------------------------------------------------------------
// Interaction with the world
// ---------------------------------------------------------------------------
const Interact = {
  // all containers within reach of the player (for the loot window)
  nearby() {
    const p = G.player;
    const out = [];
    const cx = Math.floor(p.x), cy = Math.floor(p.y);
    if (p.inCar) { out.push(Cont.car(p.inCar, 'glove')); return out; }
    out.push(Cont.floor(cx, cy));
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      const o = World.obj(x, y);
      if (!o || !o.c) continue;
      if (U.dist(p.x, p.y, x + 0.5, y + 0.5) > 1.75) continue;
      // don't loot through walls
      if (!World.adjacentReach(cx, cy, x, y)) continue;
      out.push(Cont.obj(o, x, y));
    }
    for (const z of Zombie.near(p.x, p.y, 1.6)) if (z.dead) out.push(Cont.corpse(z));
    for (const car of G.cars) {
      const rx = car.x - Math.cos(car.a) * 1.4, ry = car.y - Math.sin(car.a) * 1.4;
      if (U.dist(p.x, p.y, rx, ry) < 1.3 && car.trunkOpen) out.push(Cont.car(car, 'trunk'));
    }
    return out;
  },
  nearEdge(e, d) {
    const [x, y, dd] = e;
    const ex = dd ? x : x + 0.5, ey = dd ? y + 0.5 : y;
    return U.dist(G.player.x, G.player.y, ex, ey) < d;
  },
  edgeMid(e) { return e[2] ? [e[0], e[1] + 0.5] : [e[0] + 0.5, e[1]]; },
  // ---------------------------------------------------------------- picking under the mouse
  pick(sx, sy) {
    const [wx, wy] = Render.toWorld(sx, sy);
    const fx = Math.floor(wx), fy = Math.floor(wy);
    let best = null, bestD = -Infinity;
    const z = Render.cam.zoom;
    // edges
    for (let y = fy - 1; y <= fy + 4; y++) for (let x = fx - 1; x <= fx + 4; x++) {
      for (const d of [0, 1]) {
        const t = World.wall(x, y, d);
        if (!t) continue;
        const h = WALL_INFO[t].h;
        const a = Render.toScreen(x, y, 0), b = d ? Render.toScreen(x, y + 1, 0) : Render.toScreen(x + 1, y, 0);
        const quad = [a, b, [b[0], b[1] - h * ZU * z], [a[0], a[1] - h * ZU * z]];
        if (pointInPoly([sx, sy], quad)) {
          const depth = x + y + 0.5 + (World.feat(x, y, d) ? 0.3 : 0);
          // prefer features and closer to camera
          if (depth > bestD) { bestD = depth; best = { edge: [x, y, d], tile: [x, y] }; }
        }
      }
      const o = World.obj(x, y);
      if (o) {
        const h = Math.min(OBJ[o.t].h, o.t === 'tree' ? 3.5 : 2.2);
        const pts = [Render.toScreen(x, y, 0), Render.toScreen(x + 1, y, 0), Render.toScreen(x + 1, y + 1, 0), Render.toScreen(x, y + 1, 0), Render.toScreen(x, y, h), Render.toScreen(x + 1, y, h), Render.toScreen(x + 1, y + 1, h), Render.toScreen(x, y + 1, h)];
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const shrink = o.t === 'tree' ? 0.25 : 0.1;
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const mxp = (x1 - x0) * shrink;
        if (sx >= x0 + mxp && sx <= x1 - mxp && sy >= y0 && sy <= y1) {
          const depth = x + y + 1 + (o.c ? 0.2 : 0);
          if (depth > bestD) { bestD = depth; best = { obj: o, tile: [x, y] }; }
        }
      }
    }
    // cars
    for (const car of G.cars) {
      const [cx, cy] = Render.toScreen(car.x, car.y, 0.6);
      if (Math.abs(sx - cx) < 44 * z && Math.abs(sy - cy) < 26 * z) { const depth = car.x + car.y + 1.5; if (depth > bestD - 0.5) { best = { car, tile: [Math.floor(car.x), Math.floor(car.y)] }; bestD = depth; } }
    }
    if (!best) best = { tile: [fx, fy] };
    best.wx = wx; best.wy = wy;
    // corpses on that tile
    best.corpse = G.zombies.find(zz => zz.dead && U.dist(zz.x, zz.y, wx, wy) < 0.8) || null;
    return best;
  },
  // walk next to target, then run fn
  goDo(tx, ty, fn, reach) {
    const p = G.player;
    reach = reach || 1.5;
    if (U.dist(p.x, p.y, tx, ty) <= reach && (World.lineClear(p.x, p.y, tx, ty, 'move') || U.dist(p.x, p.y, tx, ty) < 1.1)) { fn(); return; }
    // path to tile adjacent
    let path = World.findPath(p.x, p.y, tx, ty, 'p', 3000);
    if (!path) { Player.say("I can't get there.", '#ccc'); return; }
    if (World.tileSolid(Math.floor(tx), Math.floor(ty))) path.pop();
    p.path = path.length ? path : null;
    p.pathStop = reach * 0.8;
    p.onArrive = () => { if (U.dist(p.x, p.y, tx, ty) <= reach + 0.6) fn(); else Player.say("I can't reach it.", '#ccc'); };
    if (!p.path) p.onArrive();
    if (p.action) Actions.cancel();
  },
  // ---------------------------------------------------------------- context menu
  contextMenu(sx, sy) {
    const p = G.player;
    if (!p || p.dead) return;
    const t = this.pick(sx, sy);
    const opts = [];
    const add = (label, fn, o) => opts.push(Object.assign({ label, fn }, o || {}));
    if (p.inCar) {
      add('Exit vehicle', () => Vehicles.exit(p.inCar));
      add('Open glove box', () => UI.openLoot());
      if (!p.inCar.engine) add(Vehicles.hasKey(p.inCar) ? 'Start engine' : 'Hotwire', () => Vehicles.tryStart(p.inCar));
      else add('Turn off engine', () => { p.inCar.engine = false; });
      add((p.inCar.lightsOn ? 'Headlights off' : 'Headlights on'), () => { p.inCar.lightsOn = !p.inCar.lightsOn; });
      UI.showContext(sx, sy, opts, t);
      return;
    }
    const [tx, ty] = t.tile;
    if (t.edge) this.edgeOptions(t.edge, add);
    if (t.car) this.carOptions(t.car, add);
    if (t.corpse) add('Loot corpse', () => this.goDo(t.corpse.x, t.corpse.y, () => UI.openLoot(), 1.4));
    if (t.obj) this.objOptions(t.obj, tx, ty, add);
    if (!t.edge && !t.car) this.groundOptions(tx, ty, add, t);
    // room lights
    const rm = World.roomObj(Math.floor(p.x), Math.floor(p.y));
    if (rm && World.hasPower(Math.floor(p.x), Math.floor(p.y))) add(rm.lights ? 'Turn off lights' : 'Turn on lights', () => { rm.lights = !rm.lights; Sfx.play('switch'); });
    // holding generator
    const prim = Player.primary();
    if (prim && ITEMS[prim.id].generator && !t.obj && !World.tileSolid(tx, ty)) add('Place generator', () => this.goDo(tx + 0.5, ty + 0.5, () => { if (World.obj(tx, ty)) return; Player.removeItem(prim); const g = { t: 'generator', dir: 'S', fuel: prim.fuel || 0, on: false, x: tx, y: ty }; World.setObj(tx, ty, g); Wd.powerGens.push(g); Sfx.play('thud'); UI.refresh(); }));
    if (!opts.length) return;
    UI.showContext(sx, sy, opts, t);
  },
  edgeOptions(e, add) {
    const [x, y, d] = e;
    const f = World.feat(x, y, d);
    const t = World.wall(x, y, d);
    const [mx, my] = this.edgeMid(e);
    const go = (fn) => this.goDo(mx, my, fn, 1.3);
    if (f && f.k === 'door') {
      if (!f.broken && !f.barricade) add(f.open ? 'Close door' : 'Open door', () => go(() => this.toggleDoor(f, e)));
      if (!f.broken && !f.open && f.style !== 'garage') {
        const inside = this.insideOf(f);
        if (f.locked && (inside || Player.hasKeyFor(f))) add('Unlock door', () => go(() => { f.locked = false; Sfx.play('lock'); }));
        if (!f.locked && (inside || Player.hasKeyFor(f)) && f.b !== undefined) add('Lock door', () => go(() => { f.locked = true; Sfx.play('lock'); }));
      }
      if (!f.broken && (f.barricade || 0) < 4 && !f.open) add('Barricade (plank + 2 nails)', () => go(() => Actions.queue(Actions.barricade(e))), { disabled: !(Player.findTag('hammer') && Player.findId('Plank') && Player.count('Nails') >= 2) });
      if (f.barricade) add('Remove barricade', () => go(() => Actions.queue(Actions.unbarricade(e))));
      add('Door: ' + (f.broken ? 'broken' : f.locked ? 'locked' : f.open ? 'open' : 'closed') + (f.barricade ? ', ' + f.barricade + ' planks' : '') + ' (' + Math.max(0, Math.round(f.hp)) + '%)', null, { info: true });
    } else if (f && f.k === 'window') {
      if (!f.smashed && !f.fixed && !f.barricade) {
        if (f.locked && this.insideOf(f)) add('Unlock window', () => go(() => { f.locked = false; Sfx.play('lock'); }));
        add(f.open ? 'Close window' : 'Open window', () => go(() => this.toggleWindow(f, e)));
      }
      if ((f.open || f.smashed) && !f.barricade) add('Climb through window', () => go(() => this.climb(e)));
      if (!f.smashed && !f.barricade) add('Smash window', () => go(() => this.smashWindow(e)));
      if (f.smashed && !f.glassOut) add('Remove broken glass', () => go(() => Actions.queue(Actions.removeWinGlass(e))));
      if (f.curtains && !f.smashed) add(f.curtainsClosed ? 'Open curtains' : 'Close curtains', () => go(() => { f.curtainsClosed = !f.curtainsClosed; Sfx.play('cloth'); }));
      if (!f.curtains && Player.findId('Sheet')) add('Hang sheet as curtain', () => go(() => Actions.queue(Actions.addSheet(e))));
      if ((f.barricade || 0) < 4) add('Barricade (plank + 2 nails)', () => go(() => Actions.queue(Actions.barricade(e))), { disabled: !(Player.findTag('hammer') && Player.findId('Plank') && Player.count('Nails') >= 2) });
      if (f.barricade) add('Remove barricade', () => go(() => Actions.queue(Actions.unbarricade(e))));
    } else if (t && WALL_INFO[t].climb) {
      add('Climb over ' + WALL_INFO[t].n.toLowerCase(), () => go(() => this.climb(e)));
    }
    if (t && this.hasSledge()) add('Destroy with sledgehammer', () => go(() => Actions.queue(Actions.demolishEdge(e))));
  },
  hasSledge() { const it = Player.primary(); return !!(it && Items.has(it, 'sledge') && it.cond > 0); },
  insideOf(f) {
    const p = G.player;
    const b = World.building(Math.floor(p.x), Math.floor(p.y));
    return b && f.b === b.id;
  },
  objOptions(o, x, y, add) {
    const def = OBJ[o.t];
    const p = G.player;
    const go = (fn, r) => this.goDo(x + 0.5, y + 0.5, fn, r || 1.5);
    if (o.c) add('Loot ' + def.n.toLowerCase(), () => go(() => UI.openLoot('o' + x + ',' + y)));
    if (def.water) {
      const src = { kind: 'obj', x, y };
      const ok = Water.available(src);
      add('Drink', () => go(() => Actions.queue(Actions.drinkSource(src))), { disabled: !ok });
      for (const it of Player.findAll(i => ITEMS[i.id].fluid && i.fl < ITEMS[i.id].fluid - 0.01)) add('Fill ' + Items.name(it), () => go(() => Actions.queue(Actions.fill(it, src))), { disabled: !ok });
      if (o.t === 'barrel') add('Barrel: ' + Math.round((o.water || 0) * 100) + '% full', null, { info: true });
    }
    if (def.stove === 'electric') add(o.on ? 'Turn off stove' : 'Turn on stove', () => go(() => { if (!World.hasPower(x, y)) { Player.say('No power.', '#ccc'); return; } o.on = !o.on; Sfx.play('switch'); }));
    if (def.stove === 'fire') {
      if (!o.lit) add('Light fire', () => go(() => Actions.queue(Actions.lightFire(o))), { disabled: !(o.fuel > 0 && Player.findTag('lighter')) });
      else add('Put out fire', () => go(() => { o.lit = false; Sfx.play('fill'); }));
      for (const it of Player.findAll(i => ['Plank', 'Log', 'TreeBranch', 'Twigs', 'Newspaper', 'Magazine', 'RippedSheets', 'Novel', 'Sheet', 'ComicBook'].includes(i.id)).slice(0, 6)) add('Add fuel: ' + Items.name(it), () => go(() => Actions.queue(Actions.addFuel(o, it))));
      add('Fuel: ' + Math.round(o.fuel || 0) + ' min', null, { info: true });
    }
    if (def.sleep) add('Sleep', () => go(() => { p.x = x + 0.5; p.y = y + 0.5; p.sleepAng = { S: -Math.PI / 2 - Math.PI / 4, N: Math.PI / 4, E: Math.PI - Math.PI / 4, W: -Math.PI / 4 }[o.dir] || 0; Player.sleep(def.sleep, o); }, 1.6));
    if (def.sit) add('Sit / Rest', () => go(() => { p.sitting = true; }));
    if (def.tv) add(o.on ? 'Turn off TV' : 'Turn on TV', () => go(() => { if (!World.hasPower(x, y)) { Player.say('No power.', '#ccc'); return; } o.on = !o.on; Sfx.play('switch'); }));
    if (o.t === 'lamp') { const rm = World.roomObj(x, y); if (rm) add(rm.lights ? 'Turn off lamp' : 'Turn on lamp', () => go(() => { if (!World.hasPower(x, y)) { Player.say('No power.', '#ccc'); return; } rm.lights = !rm.lights; Sfx.play('switch'); })); }
    if (o.t === 'tree') add('Chop down tree', () => go(() => Actions.queue(Actions.chop(x, y)), 1.4), { disabled: !Player.findTag('chop') });
    if (o.t === 'bush' && o.berries) add('Pick berries', () => go(() => Actions.queue(Actions.pickBerries(x, y))));
    if (o.t === 'crop') {
      if (!o.crop) {
        for (const s of Player.findAll(i => ITEMS[i.id].seeds)) add('Plant ' + ITEMS[s.id].n.replace(' Seeds', ''), () => go(() => Actions.queue(Actions.plant(x, y, s))));
      } else {
        const cd = CROPS[o.crop];
        const st = o.dead ? 'Dead' : ['Seedling', 'Sprouting', 'Growing', 'Nearly ripe', 'Ripe'][Math.min(4, o.stage || 0)];
        add(cd.n + ': ' + st + ', water ' + Math.round((o.water || 0) * 100) + '%', null, { info: true });
        if (o.stage >= 4 && !o.dead) add('Harvest', () => go(() => Actions.queue(Actions.harvest(x, y))));
      }
      const can = Player.find(i => ITEMS[i.id].fluid && i.fl > 0.05 && (i.id === 'WateringCan' || i.id === 'Bucket' || i.id === 'WaterBottle' || i.id === 'Pot'));
      if (can) add('Water with ' + Items.name(can), () => go(() => Actions.queue(Actions.water(x, y, can))));
      add('Remove plot', () => go(() => { World.setObj(x, y, null); Wd.floor[y * Wd.w + x] = FL.DIRT; }));
    }
    if (o.t === 'generator') {
      add(o.on ? 'Turn off generator' : 'Turn on generator', () => go(() => this.toggleGen(o, x, y)));
      const can = Player.find(i => i.id === 'GasCan' && i.fl > 0.05);
      if (can) add('Add fuel', () => go(() => Actions.queue(Actions.genFuel(o, can))));
      add('Fuel: ' + Math.round((o.fuel || 0) * 100) + '%', null, { info: true });
      add('Pick up generator', () => go(() => { World.setObj(x, y, null); Wd.powerGens = Wd.powerGens.filter(g => g !== o); const it = Items.make('Generator'); it.fuel = o.fuel; Player.addItem(it); Player.equip(it, 'both'); UI.refresh(); }));
    }
    if (o.t === 'pump') { const can = Player.find(i => i.id === 'GasCan' && i.fl < 0.99); if (can) add('Fill gas can', () => go(() => Actions.queue(Actions.pumpGas(can)))); }
    const wood = ['bed', 'table', 'chair', 'wardrobe', 'dresser', 'nightstand', 'bookshelf', 'crate', 'woodcrate', 'desk', 'counter', 'pew', 'bench', 'sofa', 'armchair', 'toolcab'];
    if (wood.includes(o.t)) add('Disassemble', () => go(() => Actions.queue(Actions.disassemble(x, y))), { disabled: !(Player.findTag('hammer') || Player.findTag('saw') || Player.findTag('screwdriver')) });
    if (this.hasSledge() && o.t !== 'tree' && o.t !== 'crop') add('Destroy with sledgehammer', () => go(() => Actions.queue(Actions.demolishObj(x, y))));
  },
  groundOptions(tx, ty, add, t) {
    const p = G.player;
    if (!World.inb(tx, ty)) return;
    const fl = World.floor(tx, ty);
    const outdoor = World.room(tx, ty) < 0;
    if (!World.tileSolid(tx, ty)) add('Walk here', () => { const path = World.findPath(p.x, p.y, tx, ty, 'p', 4000); if (path) { p.path = path; p.pathStop = 0; p.onArrive = null; } else Player.say("I can't get there.", '#ccc'); });
    // water
    let water = World.isWater(tx, ty) ? [tx, ty] : null;
    if (water) {
      const src = { kind: 'lake', x: tx, y: ty };
      const go = (fn) => this.goDo(tx + 0.5, ty + 0.5, fn, 1.6);
      add('Drink from lake (unsafe)', () => go(() => Actions.queue(Actions.drinkSource(src))));
      for (const it of Player.findAll(i => ITEMS[i.id].fluid && i.fl < ITEMS[i.id].fluid - 0.01)) add('Fill ' + Items.name(it), () => go(() => Actions.queue(Actions.fill(it, src))));
      add('Fish', () => go(() => Actions.queue(Actions.fish(tx, ty))), { disabled: !Player.findTag('fishing') });
    }
    if (outdoor && !water && !World.obj(tx, ty) && [FL.GRASS, FL.GRASS2, FL.FOREST, FL.DIRT].includes(fl)) {
      add('Forage', () => this.goDo(tx + 0.5, ty + 0.5, () => Actions.queue(Actions.forage(tx, ty)), 1.6));
      add('Dig furrow', () => this.goDo(tx + 0.5, ty + 0.5, () => Actions.queue(Actions.dig(tx, ty)), 1.5), { disabled: !Player.findTag('dig') });
    }
    if (!water && !World.obj(tx, ty) && !t.corpse && World.floorItems(tx, ty)) add('Pick up items here', () => this.goDo(tx + 0.5, ty + 0.5, () => UI.openLoot('floor'), 1.4));
  },
  carOptions(car, add) {
    const p = G.player;
    const go = (fn) => this.goDo(car.x, car.y, fn, 2.4);
    add('Enter vehicle', () => go(() => Vehicles.enter(car)));
    add(car.trunkOpen ? 'Close trunk' : 'Open trunk', () => go(() => { if (car.locked && !Vehicles.hasKey(car)) { Player.say("It's locked.", '#ccc'); return; } car.trunkOpen = !car.trunkOpen; Sfx.play('door'); if (car.trunkOpen) UI.openLoot('car' + car.id + 'trunk'); }));
    if (car.locked && !car.winBroken) add('Smash window', () => go(() => Vehicles.smashWindow(car)));
    const can = Player.find(i => i.id === 'GasCan' && i.fl > 0.05);
    if (can) add('Refuel with gas can', () => go(() => Actions.queue(Actions.refuelCar(car, can))));
    const can2 = Player.find(i => i.id === 'GasCan' && i.fl < 0.95);
    if (can2 && car.gas > 0.02) add('Siphon gas', () => go(() => Actions.queue(Actions.siphon(car, can2))));
    add(Vehicles.typeName(car) + ' — Gas ' + Math.round(car.gas * 100) + '%, Condition ' + Math.round(car.hp) + '%', null, { info: true });
    void p;
  },
  // ---------------------------------------------------------------- E key
  interactFront() {
    const p = G.player;
    if (p.inCar) { Vehicles.exit(p.inCar); return; }
    // car
    for (const car of G.cars) if (U.dist(p.x, p.y, car.x, car.y) < 2.1) { Vehicles.enter(car); return; }
    // edges in front
    const fx = p.x + Math.cos(p.angle) * 0.85, fy = p.y + Math.sin(p.angle) * 0.85;
    let e = World.firstEdgeHit(p.x, p.y, fx, fy);
    let eArr = e ? [e.x, e.y, e.d] : null;
    if (!eArr || !World.wall(...eArr)) {
      // nearest door/window within 1.2
      let best = null, bd = 1.3;
      const cx = Math.floor(p.x), cy = Math.floor(p.y);
      for (let y = cy - 1; y <= cy + 2; y++) for (let x = cx - 1; x <= cx + 2; x++) for (const d of [0, 1]) {
        const f = World.feat(x, y, d);
        if (!f || f.k === 'doorway') continue;
        const [mx, my] = this.edgeMid([x, y, d]);
        const dd = U.dist(p.x, p.y, mx, my);
        if (dd < bd) { bd = dd; best = [x, y, d]; }
      }
      eArr = best;
    }
    if (eArr) {
      const f = World.feat(...eArr);
      const t = World.wall(...eArr);
      if (f && f.k === 'door') { this.toggleDoor(f, eArr); return; }
      if (f && f.k === 'window') {
        if ((f.open || f.smashed) && !f.barricade) { this.climb(eArr); return; }
        if (!f.barricade) { this.toggleWindow(f, eArr); return; }
        Player.say("It's barricaded.", '#ccc'); return;
      }
      if (t && WALL_INFO[t].climb) { this.climb(eArr); return; }
    }
    // containers -> loot
    if (this.nearby().some(c => c.items.length || c.kind !== 'floor')) UI.openLoot();
  },
  toggleDoor(f, e) {
    const p = G.player;
    if (f.broken) return;
    if (f.barricade) { Player.say("It's barricaded.", '#ccc'); return; }
    if (!f.open && f.locked) {
      if (Player.hasKeyFor(f) || this.insideOf(f)) { f.locked = false; Sfx.play('lock'); }
      else { Player.say("It's locked.", '#ccc'); Sfx.play('locked'); return; }
    }
    // can't close on someone standing in the doorway
    if (f.open) {
      const [mx, my] = this.edgeMid(e);
      if (U.dist(p.x, p.y, mx, my) < 0.3) return;
      for (const z of Zombie.near(mx, my, 0.45)) if (!z.dead) return;
    }
    f.open = !f.open;
    Sfx.play(f.style === 'garage' ? 'garage' : f.open ? 'doorOpen' : 'doorClose', e[0], e[1]);
    Noise.emit(e[0], e[1], 5, 'door');
    World.resolve(p, p.r);
  },
  toggleWindow(f, e) {
    if (f.fixed) { Player.say("This window doesn't open.", '#ccc'); return; }
    if (f.locked && !f.open) {
      if (this.insideOf(f)) { f.locked = false; Sfx.play('lock'); }
      else { Player.say("It's locked. Maybe I could smash it...", '#ccc'); return; }
    }
    f.open = !f.open;
    Sfx.play('window', e[0], e[1]);
    Noise.emit(e[0], e[1], 4, 'window');
  },
  climb(e) {
    const p = G.player;
    const [x, y, d] = e;
    const f = World.feat(x, y, d);
    if (f && f.k === 'window' && (!(f.open || f.smashed) || f.barricade)) return;
    const t = World.wall(x, y, d);
    const sides = World.edgeSides(x, y, d);
    const ptx = Math.floor(p.x), pty = Math.floor(p.y);
    let from = sides[0], to = sides[1];
    if (ptx === to[0] && pty === to[1]) { from = sides[1]; to = sides[0]; }
    else if (!(ptx === from[0] && pty === from[1])) {
      // pick side closest to the player as 'from'
      if (U.dist(p.x, p.y, to[0] + 0.5, to[1] + 0.5) < U.dist(p.x, p.y, from[0] + 0.5, from[1] + 0.5)) { const tmp = from; from = to; to = tmp; }
    }
    if (World.tileSolid(to[0], to[1])) { Player.say("Something is blocking the way.", '#ccc'); return; }
    const [mx, my] = this.edgeMid(e);
    const dist = U.dist(p.x, p.y, mx, my);
    if (dist > 1.4) { this.goDo(mx, my, () => this.climb(e), 1.2); return; }
    const isWin = f && f.k === 'window';
    const dur = isWin ? 1.6 : (WALL_INFO[t].climb || 1.5) * (1 - Player.skill('Nimble') * 0.04);
    const sx = p.x, sy = p.y;
    const ex = to[0] + 0.5 + (d ? 0 : (p.x - (from[0] + 0.5)) * 0.3), ey = to[1] + 0.5 + (d ? (p.y - (from[1] + 0.5)) * 0.3 : 0);
    const tx = U.lerp(ex, mx, 0.35), ty = U.lerp(ey, my, 0.35);
    p.angle = Math.atan2(ty - sy, tx - sx);
    const a = Actions.mk(isWin ? 'Climbing through window' : 'Climbing', dur, () => {
      p.x = tx; p.y = ty; p.climb = null;
      World.resolve(p, p.r);
      if (isWin && f.smashed && !f.glassOut && R.chance(0.6)) {
        const part = R.pick(['HandL', 'HandR', 'ForeArmL', 'ForeArmR', 'TorsoUpper', 'UpperLegL', 'UpperLegR']);
        Player.addWound(part, 'cut', { isZombie: false });
        p.body[part].glass = R.chance(0.6);
        if (p.body[part].glass) Player.say('There is glass in my wound!', '#f99');
      }
      if (!isWin && WALL_INFO[t].h > 1.2) p.st.endurance = Math.max(0, p.st.endurance - 0.08);
      Player.xp('Nimble', 1);
    }, {
      anim: 'climb',
      begin: () => { p.climb = { t: 0 }; },
      tick: () => { const k = a.t / dur; p.climb.t = k; p.x = U.lerp(sx, tx, k); p.y = U.lerp(sy, ty, k); },
      onCancel: () => { p.climb = null; p.x = sx; p.y = sy; },
    });
    Actions.cancel(); Actions.start(a);
    Noise.emit(mx, my, 4, 'climb');
    Sfx.play('climb');
  },
  smashWindow(e, byBullet) {
    const f = World.feat(...e);
    if (!f || f.smashed) return;
    f.smashed = true; f.open = false; f.locked = false;
    const [mx, my] = this.edgeMid(e);
    Sfx.play('glass', mx, my);
    Noise.emit(mx, my, 20, 'glass');
    Fx.shards(mx, my, 1.4, 12, 'rgba(180,220,240,0.9)');
    if (f.b !== undefined) this.alarmCheck(Wd.buildings[f.b]);
    if (!byBullet && G.player && this.nearEdge(e, 2)) {
      const p = G.player;
      p.angle = Math.atan2(my - p.y, mx - p.x);
      p.swing = { t: 0, dur: 0.45, kind: 'melee', w: FISTS, done: true };
      if (!Player.weaponDef() && !Player.worn('gloves') && R.chance(0.5)) Player.addWound(R.pick(['HandL', 'HandR']), 'cut', { isZombie: false });
    }
  },
  alarmCheck(b) {
    if (!b || !b.alarm || b.alarmDone || G.events.powerOff) return;
    b.alarmDone = true;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    G.alarms.push({ x: cx, y: cy, t: 90, pulse: 0 });
    Player.say('An alarm went off!', '#f99');
  },
  damageEdge(x, y, d, dmg, src) {
    const f = World.feat(x, y, d);
    const [mx, my] = this.edgeMid([x, y, d]);
    if (f) {
      if (f.barricade > 0) {
        f.bhp = f.bhp || [];
        if (!f.bhp.length) f.bhp.push(100);
        f.bhp[f.bhp.length - 1] -= dmg;
        Sfx.play('thump', mx, my);
        if (f.bhp[f.bhp.length - 1] <= 0) { f.bhp.pop(); f.barricade--; Sfx.play('woodbreak', mx, my); Fx.shards(mx, my, 1.0, 8, '#a08050'); }
      } else if (f.k === 'door') {
        if (f.broken) return;
        f.hp -= dmg;
        Sfx.play(f.glass ? 'thumpGlass' : 'thump', mx, my);
        if (f.hp <= 0) {
          f.broken = true; f.open = false;
          Sfx.play(f.glass ? 'glass' : 'woodbreak', mx, my);
          Fx.shards(mx, my, 1.0, 12, f.glass ? 'rgba(180,220,240,0.9)' : '#7a5a3a');
          Noise.emit(mx, my, 18, 'door');
          if (f.b !== undefined) this.alarmCheck(Wd.buildings[f.b]);
        }
      } else if (f.k === 'window') {
        if (!f.smashed) { f.hp -= dmg; Sfx.play('thumpGlass', mx, my); if (f.hp <= 0 || src === 'player') this.smashWindow([x, y, d], true); }
      }
      if (src && src !== 'player' && src !== 'bullet') Noise.emit(mx, my, 12, 'thump');
      return;
    }
    const t = World.wall(x, y, d);
    if (!t || !WALL_INFO[t].hp) return;
    const k = World.ek(x, y, d);
    const hp = (Wd.edgeHp.get(k) ?? WALL_INFO[t].hp) - dmg;
    Sfx.play('thump', mx, my);
    if (src && src !== 'player') Noise.emit(mx, my, 10, 'thump');
    if (hp <= 0) { World.setWall(x, y, d, 0); Wd.edgeHp.delete(k); Sfx.play('woodbreak', mx, my); Fx.shards(mx, my, 0.8, 10, '#8a6a48'); }
    else Wd.edgeHp.set(k, hp);
  },
  toggleGen(o, x, y) {
    if (!o.on && !(o.fuel > 0)) { Player.say('It has no fuel.', '#ccc'); return; }
    if (!o.on && Player.skill('Electrical') < 1 && !Player.hasTrait('handy')) { Player.say("I don't know how to hook this up. (Electrical 1)", '#ccc'); return; }
    o.on = !o.on;
    o.x = x; o.y = y;
    if (!Wd.powerGens.includes(o)) Wd.powerGens.push(o);
    Sfx.play('switch');
    if (o.on) { Player.xp('Electrical', 4); Player.say('The generator rumbles to life.', '#8f8'); }
  },
};
