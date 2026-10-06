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
    if (c.items === null) c.items = car.burnt ? [] : Loot.roll(slot === 'trunk' && car.loot ? car.loot : 'car', c.type, 0);
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
    if (it.id === 'Corpse') { if (!G.player.inv.includes(it)) G.player.inv.push(it); Interact.dropCorpse(it); return; }
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
    if (it.id === 'Corpse' && c.kind !== 'floor' && c.kind !== 'inv') return false;
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
      const T = CAR_TYPES[car.type] || CAR_TYPES.sedan, rb = T.len / 2 + 0.25;
      const rx = car.x - Math.cos(car.a) * rb, ry = car.y - Math.sin(car.a) * rb;
      if (U.dist(p.x, p.y, rx, ry) < 1.5 && (car.trunkOpen || (car.parts && car.parts.trunkLid < 0))) out.push(Cont.car(car, 'trunk'));
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
    const lv = Render.plv();
    const [wx, wy] = Render.toWorldL(sx, sy, lv);
    const fx = Math.floor(wx), fy = Math.floor(wy);
    let best = null, bestD = -Infinity;
    const z = Render.cam.zoom;
    // edges
    for (let y = fy - 1; y <= fy + 4; y++) for (let x = fx - 1; x <= fx + 4; x++) {
      for (const d of [0, 1]) {
        const t = World.wall(x, y, d);
        if (!t || t === WT.BOUND) continue;
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
    if (!lv) for (const car of G.cars) {
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
      Mechanics.menu(p.inCar, add, true);
      UI.showContext(sx, sy, opts, t);
      return;
    }
    const [tx, ty] = t.tile;
    this.fireOptions(tx, ty, add);
    if (t.edge) this.edgeOptions(t.edge, add);
    if (t.car) this.carOptions(t.car, add);
    if (t.corpse) {
      add('Loot corpse', () => this.goDo(t.corpse.x, t.corpse.y, () => UI.openLoot(), 1.4));
      const cz = t.corpse;
      if (!p.inv.some(i => i.id === 'Corpse')) add('Pick up corpse', () => this.goDo(cz.x, cz.y, () => Actions.queue(Actions.mk('Lifting the body', 2.5, () => Interact.liftCorpse(cz), { anim: 'work' })), 1.3));
    }
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
      const upOut = this.upperOutside(e);
      if ((f.open || f.smashed) && !f.barricade) add(upOut ? (f.rope ? 'Climb down sheet rope' : 'Jump out of window') : 'Climb through window', () => go(() => this.climb(e)));
      if (upOut && !f.rope && !f.barricade) add('Tie sheet rope (rope + nail)', () => go(() => {
        const rope = Player.findId('SheetRope');
        if (!rope || Player.count('Nails') < 1) return;
        Actions.queue(Actions.mk('Tying sheet rope', 3, () => { if (!Player.findId('SheetRope') || Player.count('Nails') < 1) return; Player.removeItem(Player.findId('SheetRope')); Player.removeItem(Player.findId('Nails')); f.rope = true; Sfx.play('cloth'); UI.refresh(); }, { anim: 'work' }));
      }), { disabled: !(Player.findId('SheetRope') && Player.count('Nails') >= 1) });
      if (upOut && f.rope) add('Untie sheet rope', () => go(() => Actions.queue(Actions.mk('Untying sheet rope', 2, () => { if (!f.rope) return; f.rope = false; Player.addItem(Items.make('SheetRope')); Sfx.play('cloth'); UI.refresh(); }, { anim: 'work' }))));
      if (!f.smashed && !f.barricade) add('Smash window', () => go(() => this.smashWindow(e)));
      if (f.smashed && !f.glassOut) add('Remove broken glass', () => go(() => Actions.queue(Actions.removeWinGlass(e))));
      if (f.curtains && !f.smashed) add(f.curtainsClosed ? 'Open curtains' : 'Close curtains', () => go(() => { f.curtainsClosed = !f.curtainsClosed; Sfx.play('cloth'); }));
      if (!f.curtains && Player.findId('Sheet')) add('Hang sheet as curtain', () => go(() => Actions.queue(Actions.addSheet(e))));
      if ((f.barricade || 0) < 4) add('Barricade (plank + 2 nails)', () => go(() => Actions.queue(Actions.barricade(e))), { disabled: !(Player.findTag('hammer') && Player.findId('Plank') && Player.count('Nails') >= 2) });
      if (f.barricade) add('Remove barricade', () => go(() => Actions.queue(Actions.unbarricade(e))));
    } else if (t && WALL_INFO[t].climb) {
      add('Climb over ' + WALL_INFO[t].n.toLowerCase(), () => go(() => this.climb(e)));
    }
    // a sheet rope hanging from the window above
    if (x < LV.W0) {
      const f2 = World.feat(x + LV.W0, y, d);
      if (f2 && f2.k === 'window' && f2.rope) add('Climb sheet rope', () => this.climbRope([x + LV.W0, y, d]));
    }
    if (t && this.hasSledge()) add('Destroy with sledgehammer', () => go(() => Actions.queue(Actions.demolishEdge(e))));
  },
  dropOut(e, f, from, to, mx, my) {
    const p = G.player;
    const d = e[2];
    const rope = !!(f && f.rope);
    const dur = rope ? 2.6 : 1.0;
    const sx = p.x, sy = p.y;
    const ex = to[0] + 0.5 + (d ? 0 : (p.x - (from[0] + 0.5)) * 0.3), ey = to[1] + 0.5 + (d ? (p.y - (from[1] + 0.5)) * 0.3 : 0);
    const tx = U.lerp(ex, mx, 0.35), ty = U.lerp(ey, my, 0.35);
    p.angle = Math.atan2(ty - sy, tx - sx);
    const a = Actions.mk(rope ? 'Climbing down sheet rope' : 'Jumping out', dur, () => {
      p.climb = null;
      p.x = tx - LV.W0; p.y = ty;
      World.resolve(p, p.r);
      if (f && f.smashed && !f.glassOut && R.chance(0.5)) Player.addWound(R.pick(['HandL', 'HandR', 'ForeArmL', 'ForeArmR']), 'cut', { isZombie: false });
      if (!rope) {
        Sfx.play('thud'); Noise.emit(p.x, p.y, 9, 'thud');
        const legs = LEG_PARTS;
        if (R.chance(0.35 - Player.skill('Nimble') * 0.02)) Player.fracture(legs);
        else { const n = R.chance(0.45) ? 2 : 1; for (let k = 0; k < n; k++) Player.addWound(R.pick(legs), R.chance(0.3) ? 'deep' : 'scratch', { isZombie: false }); }
        p.hurtFlash = 1;
        p.st.endurance = Math.max(0, p.st.endurance - 0.2);
      } else Player.xp('Nimble', 1);
    }, {
      anim: 'climb',
      begin: () => { p.climb = { t: 0 }; },
      tick: () => { const k = a.t / dur; p.climb.t = k; p.x = U.lerp(sx, tx, Math.min(1, k * 1.4)); p.y = U.lerp(sy, ty, Math.min(1, k * 1.4)); },
      onCancel: () => { p.climb = null; p.x = sx; p.y = sy; },
    });
    Actions.queue(a);
  },
  trapOptions(o, x, y, add, go) {
    const ANIMAL = { rabbit: 'DeadRabbit', squirrel: 'DeadSquirrel', bird: 'DeadBird', mouse: 'DeadMouse' };
    if (o.caught) {
      add('Collect ' + ITEMS[ANIMAL[o.caught]].n.toLowerCase(), () => go(() => {
        if (!o.caught) return;
        const it = Items.make(ANIMAL[o.caught]);
        it.age = Math.max(0, (G.time - (o.caughtT || G.time)) / 60);
        Player.addItem(it); o.caught = null; o.caughtT = null;
        Player.xp('Trapping', 5); Player.say('Got a ' + ITEMS[it.id].n.replace('Dead ', '').toLowerCase() + '!', '#8f8'); Sfx.play('pickup'); UI.refresh();
      }));
    } else if (!o.bait) {
      const baits = Player.findAll(i => ['Carrots', 'Cabbage', 'Lettuce', 'Apple', 'Banana', 'Bread', 'PeanutButter', 'Berries', 'Worms', 'Potato', 'Corn', 'Tomato', 'Insects', 'Cheese'].includes(i.id));
      const seen = new Set();
      for (const b of baits) {
        if (seen.has(b.id)) continue; seen.add(b.id);
        add('Bait with ' + Items.name(b), () => go(() => {
          if (!Player.find(i => i === b)) return;
          if (ITEMS[b.id].uses) { b.uses--; if (b.uses <= 0) Player.removeItem(b); } else Player.removeItem(b);
          o.bait = b.id; o.baitT = G.time; Sfx.play('pickup'); UI.refresh();
        }));
      }
      if (!baits.length) add('Needs bait (vegetables, fruit, bread, worms...)', null, { info: true });
    } else add('Baited with ' + ITEMS[o.bait].n.toLowerCase() + ' - check back later', null, { info: true });
    add('Dismantle trap', () => go(() => {
      World.setObj(x, y, null);
      if (o.kind === 'box') { Player.addItem(Items.make('Plank')); if (R.chance(0.6)) Player.addItem(Items.make('Nails')); } else Player.addItem(Items.make('Twigs'));
      Sfx.play('wood'); UI.refresh();
    }));
  },
  liftCorpse(z) {
    const i = G.zombies.indexOf(z);
    if (i < 0 || !z.dead) return;
    G.zombies.splice(i, 1);
    Zombie.rebuildGrid();
    const it = Items.make('Corpse');
    it.z = z; it.mw = 40;
    G.player.inv.push(it);
    Player.say("Ugh. It's heavy.", '#ccc');
    UI.refresh();
  },
  dropCorpse(it) {
    const p = G.player;
    if (!Player.find(i => i === it)) return;
    Player.removeItem(it);
    const z = it.z;
    z.x = p.x + Math.cos(p.angle) * 0.6; z.y = p.y + Math.sin(p.angle) * 0.6;
    if (World.tileSolid(Math.floor(z.x), Math.floor(z.y))) { z.x = p.x; z.y = p.y; }
    z.lie = 1; z.dead = true; z.va = 1;
    G.zombies.push(z);
    Zombie.rebuildGrid();
    Sfx.play('thud', z.x, z.y);
    UI.refresh();
  },
  // an upstairs window/edge whose far side is open air
  upperOutside(e) {
    const [x, y, d] = e;
    if (x < LV.W0) return false;
    const [a, b] = World.edgeSides(x, y, d);
    return (World.inb(a[0], a[1]) && Wd.floor[a[1] * Wd.w + a[0]] === FL.VOID) || (World.inb(b[0], b[1]) && Wd.floor[b[1] * Wd.w + b[0]] === FL.VOID);
  },
  // climb up a sheet rope from the ground into the upstairs window
  climbRope(e) {
    const p = G.player;
    const [x, y, d] = e;
    const f = World.feat(x, y, d);
    if (!f || !f.rope) return;
    const [a, b] = World.edgeSides(x, y, d);
    const out = Wd.floor[a[1] * Wd.w + a[0]] === FL.VOID ? a : b, inn = out === a ? b : a;
    const gx = out[0] - LV.W0 + 0.5, gy = out[1] + 0.5;
    const mx = d ? x - LV.W0 : x - LV.W0 + 0.5, my = d ? y + 0.5 : y;
    const bx = U.lerp(gx, mx, 0.55), by = U.lerp(gy, my, 0.55);
    if (U.dist(p.x, p.y, bx, by) > 0.9) { this.goDo(bx, by, () => this.climbRope(e), 0.6); return; }
    if (f.barricade || !(f.open || f.smashed)) { Player.say("The window up there is closed.", '#ccc'); return; }
    if (World.tileSolid(inn[0], inn[1])) { Player.say("Something is blocking the window.", '#ccc'); return; }
    if (Player.heavyRatio() > 1.25) { Player.say("I'm carrying too much to climb.", '#ccc'); return; }
    const dur = 4.2 - Player.skill('Strength') * 0.15 - Player.skill('Nimble') * 0.1;
    const sx = p.x, sy = p.y;
    p.angle = Math.atan2(my - sy, mx - sx);
    const a2 = Actions.mk('Climbing sheet rope', dur, () => {
      p.climb = null;
      p.x = U.lerp(inn[0] + 0.5, d ? x : x + 0.5, 0.3); p.y = U.lerp(inn[1] + 0.5, d ? y + 0.5 : y, 0.3);
      World.resolve(p, p.r);
      p.st.endurance = Math.max(0, p.st.endurance - 0.12);
      Player.xp('Strength', 2); Player.xp('Nimble', 1);
    }, {
      anim: 'climb',
      begin: () => { p.climb = { t: 0 }; },
      tick: () => { p.climb.t = (a2.t / dur * 4) % 1; p.x = U.lerp(sx, mx, Math.min(1, a2.t / dur * 2) * 0.7); p.y = U.lerp(sy, my, Math.min(1, a2.t / dur * 2) * 0.7); },
      onCancel: () => { p.climb = null; p.x = sx; p.y = sy; },
    });
    Actions.queue(a2);
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
    if (o.t === 'trap') this.trapOptions(o, x, y, add, go);
    if (MOVEABLE[o.t] && !o.fixed) add('Pick up ' + def.n.toLowerCase() + ' (' + MOVEABLE[o.t] + ' kg)', () => go(() => Actions.queue(Actions.mk('Picking up ' + def.n.toLowerCase(), 2.5, () => { if (World.obj(x, y) === o) Build.pickUp(o, x, y); }, { anim: 'work', begin: () => Actions.face(x, y) }))));
    if (o.sx !== undefined) {
      const st = Wd.stairs.find(q => q.x === o.sx && q.y === o.sy);
      if (st) {
        if (p.x < LV.W0) add('Go upstairs', () => this.goDo(st.x + st.dx + LV.W0 + 0.5, st.y + st.dy + 0.5, () => {}, 0.6));
        else {
          const bx = st.x - st.dx * 3, by = st.y - st.dy * 3;
          const ok = !World.tileSolid(bx, by) && World.room(bx, by) === World.room(st.x, st.y);
          add('Go downstairs', () => this.goDo((ok ? bx : st.x - st.dx * 2) + 0.5, (ok ? by : st.y - st.dy * 2) + 0.5, () => {}, 0.6));
        }
      }
    }
    if (this.hasSledge() && o.t !== 'tree' && o.t !== 'crop') add(o.sx !== undefined ? 'Destroy stairs with sledgehammer' : 'Destroy with sledgehammer', () => go(() => Actions.queue(Actions.demolishObj(x, y))));
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
  fireOptions(tx, ty, add) {
    if (!World.inb(tx, ty)) return;
    const e = Fire.at(tx, ty);
    const go = (fn) => this.goDo(tx + 0.5, ty + 0.5, fn, 1.7);
    if (e) {
      const ext = Player.find(i => i.id === 'FireExtinguisher' && i.uses > 0);
      if (ext) add('Use fire extinguisher', () => go(() => Actions.queue(Actions.extinguish(tx, ty, ext))));
      const wat = Player.find(i => ITEMS[i.id].fluid && i.fl >= 0.2);
      add('Throw water on the fire', () => go(() => Actions.queue(Actions.douse(tx, ty, wat))), { disabled: !wat });
      add('Fire! (' + Math.round(e.i * 100) + '%)', null, { info: true });
      return;
    }
    const can = Player.find(i => i.id === 'GasCan' && i.fl >= 0.15);
    if (can && Player.findTag('lighter') && !World.isWater(tx, ty) && World.floor(tx, ty) !== FL.VOID) add('Pour gas and light it', () => go(() => Actions.queue(Actions.setFire(tx, ty, can))));
  },
  carOptions(car, add) {
    Mechanics.menu(car, add, false);
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
    // out of an upstairs window: down a sheet rope, or a painful drop
    const drop = to[0] >= LV.W0 && Wd.floor[to[1] * Wd.w + to[0]] === FL.VOID;
    if (drop && World.tileSolid(to[0] - LV.W0, to[1])) { Player.say("Something is in the way down there.", '#ccc'); return; }
    if (!drop && World.tileSolid(to[0], to[1])) { Player.say("Something is blocking the way.", '#ccc'); return; }
    const [mx, my] = this.edgeMid(e);
    const dist = U.dist(p.x, p.y, mx, my);
    if (dist > 1.4) { this.goDo(mx, my, () => this.climb(e), 1.2); return; }
    const isWin = f && f.k === 'window';
    if (drop) { this.dropOut(e, f, from, to, mx, my); return; }
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
