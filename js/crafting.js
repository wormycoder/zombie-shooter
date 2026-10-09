'use strict';
// ---------------------------------------------------------------------------
// Crafting recipes & building
// ---------------------------------------------------------------------------
const RECIPES = [
  { id: 'bandage', n: 'Bandage', cat: 'Medical', in: [['RippedSheets', 2]], out: [['Bandage', 1]], time: 3, xp: { FirstAid: 2 } },
  { id: 'sterile', n: 'Sterilized Bandage', cat: 'Medical', in: [['Bandage', 1], ['@uses:Disinfectant', 1]], out: [['SterileBandage', 1]], time: 3, xp: { FirstAid: 2 } },
  { id: 'splint', n: 'Splint', cat: 'Medical', in: [['@any:Plank|TreeBranch', 1], ['RippedSheets', 2]], out: [['Splint', 1]], time: 4, xp: { FirstAid: 2 } },
  { id: 'rags', n: 'Ripped Sheets (from Sheet)', cat: 'Medical', in: [['Sheet', 1]], out: [['RippedSheets', 4]], time: 3 },
  { id: 'sheetrope', n: 'Sheet Rope', cat: 'Survival', in: [['Sheet', 2]], out: [['SheetRope', 1]], time: 5 },
  { id: 'planks', n: 'Saw Log into Planks', cat: 'Carpentry', in: [['Log', 1]], tools: ['saw'], out: [['Plank', 3]], time: 8, xp: { Carpentry: 3 } },
  { id: 'spear', n: 'Crafted Spear', cat: 'Weapons', in: [['@any:Plank|TreeBranch', 1]], tools: ['cut'], out: [['Spear', 1]], time: 6, xp: { Carpentry: 2, Spear: 2 } },
  { id: 'spikedbat', n: 'Spiked Baseball Bat', cat: 'Weapons', in: [['BaseballBat', 1], ['Nails', 5]], tools: ['hammer'], out: [['SpikedBat', 1]], time: 6, xp: { Carpentry: 2 } },
  { id: 'molotov', n: 'Molotov Cocktail', cat: 'Weapons', in: [['@emptybottle', 1], ['@gas:0.15', 1], ['RippedSheets', 1]], out: [['Molotov', 1]], time: 4 },
  { id: 'rod', n: 'Crafted Fishing Rod', cat: 'Survival', in: [['TreeBranch', 1], ['RippedSheets', 2], ['Nails', 1]], out: [['FishingRod', 1]], time: 6, xp: { Fishing: 3 } },
  { id: 'trapbox', n: 'Trap Box', cat: 'Survival', build: 'obj', obj: 'trap', trapKind: 'box', in: [['Plank', 2], ['Nails', 3]], tools: ['hammer'], time: 8, xp: { Carpentry: 2, Trapping: 3 } },
  { id: 'snare', n: 'Snare Trap', cat: 'Survival', build: 'obj', obj: 'trap', trapKind: 'snare', in: [['Twigs', 2], ['@any:RippedSheets|Sheet', 1]], time: 5, xp: { Trapping: 3 } },
  { id: 'twigs', n: 'Break Branch into Twigs', cat: 'Survival', in: [['TreeBranch', 1]], out: [['Twigs', 3]], time: 3 },
  { id: 'salad', n: 'Salad', cat: 'Cooking', in: [['Lettuce', 1], ['@any:Tomato|Carrots|Cabbage', 1]], tools: ['cut'], out: [['Salad', 1]], time: 4, xp: { Cooking: 3 } },
  { id: 'sandwich', n: 'Sandwich', cat: 'Cooking', in: [['Bread', 1], ['@any:Cheese|PeanutButter|Lettuce|Tomato', 1]], out: [['Sandwich', 1]], time: 3, xp: { Cooking: 2 } },
  { id: 'stew', n: 'Stew (2 bowls)', cat: 'Cooking', in: [['@water:1', 1], ['@any:Carrots|Potato|Cabbage|Tomato|Lettuce', 2], ['@any:Steak|Chicken|GroundBeef|Fish|Sausage|CannedBeans|CannedCorn|CannedPeas|CannedCarrots|CannedChili', 1]], heat: true, out: [['Stew', 2]], time: 10, xp: { Cooking: 6 }, opener: true },
  { id: 'campfire', n: 'Campfire', cat: 'Build', build: 'obj', obj: 'campfire', in: [['@any:TreeBranch|Plank|Log|Twigs', 2], ['@any:Stone|TreeBranch|Twigs|Plank', 1]], time: 5, xp: { Foraging: 2 } },
  { id: 'woodcrate', n: 'Wooden Crate', cat: 'Build', build: 'obj', obj: 'woodcrate', in: [['Plank', 3], ['Nails', 4]], tools: ['hammer'], skill: { Carpentry: 1 }, time: 10, xp: { Carpentry: 6 } },
  { id: 'barrel', n: 'Rain Collector Barrel', cat: 'Build', build: 'obj', obj: 'barrel', in: [['Plank', 4], ['Nails', 4], ['GarbageBag', 1]], tools: ['hammer'], skill: { Carpentry: 3 }, time: 14, xp: { Carpentry: 8 } },
  { id: 'woodwall', n: 'Wooden Wall', cat: 'Build', build: 'wall', wall: WT.BUILT, in: [['Plank', 3], ['Nails', 6]], tools: ['hammer'], skill: { Carpentry: 2 }, time: 14, xp: { Carpentry: 8 } },
  { id: 'woodfence', n: 'Tall Wooden Fence', cat: 'Build', build: 'wall', wall: WT.WOODFENCE, in: [['Plank', 2], ['Nails', 4]], tools: ['hammer'], skill: { Carpentry: 1 }, time: 10, xp: { Carpentry: 5 } },
  { id: 'logwall', n: 'Log Wall', cat: 'Build', build: 'wall', wall: WT.LOG, in: [['Log', 3], ['@any:RippedSheets|Sheet', 2]], time: 12, xp: { Carpentry: 5 } },
];

const Crafting = {
  // returns list of {need, have, label, items(to consume)}
  check(rec) {
    const res = [];
    const used = new Set();
    for (const [spec, n] of rec.in) {
      let label, pool;
      if (spec.startsWith('@any:')) {
        const ids = spec.slice(5).split('|');
        label = ids.map(i => ITEMS[i].n).join(' / ');
        pool = Player.findAll(it => ids.includes(it.id) && !used.has(it) && !it.equipped && !it.worn);
      } else if (spec.startsWith('@uses:')) {
        const id = spec.slice(6);
        label = ITEMS[id].n + ' (' + n + ' use)';
        pool = Player.findAll(it => it.id === id && (it.uses || 0) >= n);
        res.push({ label, have: pool.length ? n : 0, need: n, uses: pool[0], n });
        continue;
      } else if (spec.startsWith('@water:')) {
        const amt = +spec.slice(7);
        label = 'Water container (' + amt + ' units, e.g. Cooking Pot)';
        pool = Player.findAll(it => ITEMS[it.id].fluid && it.fl >= amt - 0.001);
        res.push({ label, have: pool.length ? 1 : 0, need: 1, water: pool[0], amt });
        continue;
      } else if (spec.startsWith('@gas:')) {
        const amt = +spec.slice(5);
        label = 'Gas Can with fuel';
        pool = Player.findAll(it => it.id === 'GasCan' && it.fl >= amt);
        res.push({ label, have: pool.length ? 1 : 0, need: 1, gas: pool[0], amt });
        continue;
      } else if (spec === '@emptybottle') {
        label = 'Empty Glass Bottle';
        pool = Player.findAll(it => it.id === 'EmptyBottle' && it.fl <= 0.01 && !used.has(it));
      } else {
        label = ITEMS[spec].n;
        pool = Player.findAll(it => it.id === spec && !used.has(it) && !(it.equipped && ITEMS[it.id].cat !== 'Weapon') && !it.worn);
      }
      const take = pool.slice(0, n);
      for (const t of take) used.add(t);
      res.push({ label, have: take.length, need: n, items: take });
    }
    for (const tag of rec.tools || []) {
      const t = Player.findTag(tag);
      res.push({ label: { saw: 'Saw', hammer: 'Hammer', cut: 'Knife or blade', dig: 'Shovel/Trowel' }[tag] || tag, have: t ? 1 : 0, need: 1, tool: true });
    }
    if (rec.skill) for (const sk in rec.skill) res.push({ label: SKILL_NAMES[sk] + ' level ' + rec.skill[sk], have: Player.skill(sk) >= rec.skill[sk] ? 1 : 0, need: 1, skill: true });
    if (rec.heat) res.push({ label: 'Heat source nearby (lit fire or stove on)', have: this.nearHeat() ? 1 : 0, need: 1 });
    if (rec.opener) {
      const r2 = res.find(r => r.items && r.items.some(it => ITEMS[it.id].open));
      if (r2) res.push({ label: 'Can opener', have: Player.findTag('canopener') ? 1 : 0, need: 1, tool: true });
    }
    return res;
  },
  has(rec) { return Debug.build || this.check(rec).every(r => r.have >= r.need); },
  nearHeat() {
    const p = G.player;
    for (let y = Math.floor(p.y) - 2; y <= Math.floor(p.y) + 2; y++) for (let x = Math.floor(p.x) - 2; x <= Math.floor(p.x) + 2; x++) {
      const o = World.obj(x, y);
      if (!o) continue;
      if ((o.t === 'campfire' || o.t === 'bbq') && o.lit) return true;
      if (o.t === 'stove' && o.on && World.hasPower(x, y)) return true;
    }
    return false;
  },
  consume(rec) {
    for (const r of this.check(rec)) {
      if (r.items) for (const it of r.items) Player.removeItem(it);
      if (r.uses) { r.uses.uses -= r.n; if (r.uses.uses <= 0) Player.removeItem(r.uses); }
      if (r.water) { r.water.fl -= r.amt; if (r.water.fl < 0.001) { r.water.fl = 0; r.water.taint = false; } }
      if (r.gas) r.gas.fl -= r.amt;
    }
  },
  craft(rec, times) {
    if (rec.build) { Build.start(rec); return; }
    times = times || 1;
    for (let k = 0; k < times; k++) {
      Actions.queue(Actions.mk('Crafting ' + rec.n, rec.time * (1 - Player.skill(Object.keys(rec.xp || { Carpentry: 1 })[0]) * 0.03), () => {
        if (!this.has(rec)) { Player.say("I'm missing something.", '#ccc'); G.player.queue = []; return; }
        this.consume(rec);
        for (const [id, n] of rec.out) for (let i = 0; i < n; i++) Player.addItem(Items.make(id));
        if (rec.xp) for (const sk in rec.xp) Player.xp(sk, rec.xp[sk]);
        Sfx.play('craft');
        UI.refresh();
      }, { anim: 'craft' }));
    }
  },
};

const Build = {
  start(rec) {
    if (!Crafting.has(rec)) { Player.say("I'm missing materials.", '#ccc'); return; }
    G.build = { rec, d: 0 };
    UI.closeAll();
    UI.hint('Left-click to place ' + rec.n + (rec.build === 'wall' ? ' · R to rotate' : '') + ' · Esc to cancel');
  },
  // ---- carrying furniture
  startMove(it) {
    G.build = { move: it, d: 0 };
    UI.closeAll();
    UI.hint('Left-click to place ' + Items.name(it) + ' · R to rotate · Esc to cancel');
  },
  DIRS: ['S', 'W', 'N', 'E'],
  // tiles a moveable occupies when placed at (x,y) facing dir
  moveTiles(it, x, y, dir) {
    const t = it.obj.t, two = TWO_TILE[t];
    if (!two) return [[x, y]];
    const [dx, dy] = DIRV[dir];
    return two === 'perp' ? [[x, y], [x + dx, y + dy]] : [[x, y], [x - dy, y + dx]];
  },
  validMove(it, x, y, dir) {
    const p = G.player;
    for (const [tx, ty] of this.moveTiles(it, x, y, dir)) {
      if (!World.inb(tx, ty) || World.obj(tx, ty) || World.tileSolid(tx, ty) || World.isWater(tx, ty) || World.floor(tx, ty) === FL.VOID) return false;
      if (Math.floor(p.x) === tx && Math.floor(p.y) === ty) return false;
      if (G.zombies.some(z => !z.dead && Math.floor(z.x) === tx && Math.floor(z.y) === ty)) return false;
    }
    const tl = this.moveTiles(it, x, y, dir);
    if (tl.length === 2 && World.edgeBlocksMove(...World.edgeBetween(tl[0][0], tl[0][1], tl[1][0], tl[1][1]))) return false;
    return true;
  },
  placeMove(it, x, y, dir) {
    const tl = this.moveTiles(it, x, y, dir);
    tl.forEach(([tx, ty], i) => {
      const o = Object.assign({}, it.obj, { dir });
      if (tl.length > 1) o.part = i;
      const d = OBJ[o.t];
      if (d.cont && i === 0) o.c = { type: d.cont.type, cap: d.cont.cap, items: [] };
      World.setObj(tx, ty, o);
    });
    Player.removeItem(it);
    Sfx.play('thud');
  },
  pickUp(o, x, y) {
    const p = G.player;
    if (o.c) { World.contItems(o, x, y); if (o.c.items && o.c.items.length) { Player.say('I need to empty it first.', '#ccc'); return; } }
    const it = Items.make('Moveable');
    it.label = OBJ[o.t].n; it.mw = MOVEABLE[o.t]; it.col = o.col || ({ fridge: '#e8e8e4', stove: '#d8d8d4', washer: '#e0e0dc', tv: '#303030', locker: '#707a84', cooler: '#d0d8e0', toolcab: '#a03028' }[o.t] || '#8a6a48');
    const keep = {};
    for (const k in o) if (!['c', 'part', 'dir', 'on', 'lit'].includes(k)) keep[k] = o[k];
    it.obj = keep;
    // the other half of a two-tile piece goes too
    if (o.part !== undefined) for (const [dx, dy] of DIR4) { const n = World.obj(x + dx, y + dy); if (n && n.t === o.t && n.part !== undefined && n.part !== o.part) { World.setObj(x + dx, y + dy, null); break; } }
    World.setObj(x, y, null);
    p.inv.push(it);
    Sfx.play('wood');
    if (Player.heavyRatio() > 1) Player.say("It's heavy...", '#ccc');
    UI.refresh();
  },
  target() {
    const [wx, wy] = Render.mouseWorld();
    if (G.build.move) return [Math.floor(wx), Math.floor(wy), G.build.d & 3];
    let tx = Math.floor(wx), ty = Math.floor(wy), d = G.build.d & 1;
    if (G.build.rec.build === 'wall') {
      // choose the edge nearest to the mouse
      const fx = wx - tx, fy = wy - ty;
      if (G.build.d < 2) {
        // rotate between N/W/S/E edges with R; snap to nearest by default
        const cand = [[tx, ty, 0, fy], [tx, ty, 1, fx], [tx, ty + 1, 0, 1 - fy], [tx + 1, ty, 1, 1 - fx]];
        cand.sort((a, b) => a[3] - b[3]);
        const pick = cand.find(c => (c[2] === d)) || cand[0];
        return [pick[0], pick[1], pick[2]];
      }
    }
    return [tx, ty, d];
  },
  valid(rec, x, y, d) {
    if (!World.inb(x, y)) return false;
    if (rec.build === 'obj') {
      if (rec.obj === 'trap' && (World.room(x, y) >= 0 || ![FL.GRASS, FL.GRASS2, FL.FOREST, FL.DIRT, FL.SAND].includes(World.floor(x, y)))) return false;
      return !World.obj(x, y) && !World.tileSolid(x, y) && !World.isWater(x, y) && !G.zombies.some(z => !z.dead && Math.floor(z.x) === x && Math.floor(z.y) === y);
    }
    if (World.wall(x, y, d)) return false;
    const [[ax, ay], [bx, by]] = World.edgeSides(x, y, d);
    if (!World.inb(ax, ay) || !World.inb(bx, by)) return false;
    return true;
  },
  place(rec, x, y, d) {
    if (rec.build === 'obj') {
      const o = MapGen.mkObj(rec.obj, 'S');
      if (rec.obj === 'campfire') { o.fuel = 30; o.lit = false; }
      if (rec.obj === 'barrel') o.water = 0;
      if (rec.obj === 'trap') { o.kind = rec.trapKind; o.bait = null; o.caught = null; }
      World.setObj(x, y, o);
    } else {
      World.setWall(x, y, d, rec.wall);
      Wd.edgeHp.delete(World.ek(x, y, d));
    }
    Sfx.play('wood');
  },
  click() {
    const b = G.build;
    const [x, y, d] = this.target();
    if (b.move) {
      const it = b.move, dir = this.DIRS[d];
      if (!this.validMove(it, x, y, dir)) { Player.say("It won't fit there.", '#ccc'); return; }
      G.build = null;
      Interact.goDo(x + 0.5, y + 0.5, () => Actions.queue(Actions.mk('Placing ' + Items.name(it), 2, () => {
        if (!Player.find(i => i === it)) return;
        if (!this.validMove(it, x, y, dir)) { Player.say("It won't fit there.", '#ccc'); return; }
        this.placeMove(it, x, y, dir); UI.refresh();
      }, { anim: 'work', begin: () => Actions.face(x, y) })), 1.6);
      return;
    }
    if (!this.valid(b.rec, x, y, d)) { Player.say("Can't build there.", '#ccc'); return; }
    const rec = b.rec;
    G.build = null;
    Interact.goDo(x + 0.5, y + 0.5, () => Actions.queue(Actions.build(rec, x, y, d)), 1.6);
  },
  drawGhost(ctx) {
    const b = G.build;
    const [x, y, d] = this.target();
    if (b.move) {
      const it = b.move, dir = this.DIRS[d], ok = this.validMove(it, x, y, dir);
      const tl = this.moveTiles(it, x, y, dir);
      ctx.globalAlpha = 0.6;
      tl.forEach(([tx, ty], i) => {
        const o = Object.assign({}, it.obj, { dir }); if (tl.length > 1) o.part = i;
        const rec = Spr.obj(o); const [X, Y] = Render.P(tx, ty, 0);
        ctx.drawImage(rec.c, X - rec.ax, Y - rec.ay);
      });
      ctx.globalAlpha = 1;
      for (const [tx, ty] of tl) { const [X, Y] = Render.P(tx, ty, 0); poly(ctx, [[X, Y], [X + HTW, Y + HTH], [X, Y + TH], [X - HTW, Y + HTH]], ok ? 'rgba(80,255,80,0.22)' : 'rgba(255,60,60,0.3)', ok ? '#5f5' : '#f55', 1); }
      return;
    }
    const ok = this.valid(b.rec, x, y, d) && Crafting.has(b.rec);
    const [X, Y] = Render.P(x, y, 0);
    ctx.globalAlpha = 0.55;
    if (b.rec.build === 'obj') {
      const rec = Spr.obj(MapGen.mkObj(b.rec.obj, 'S'));
      ctx.drawImage(rec.c, X - rec.ax, Y - rec.ay);
    } else {
      const rec = Spr.wall(b.rec.wall, d, '#b89a6a', null, false);
      ctx.drawImage(rec.c, X - rec.ax, Y - rec.ay);
    }
    ctx.globalAlpha = 1;
    poly(ctx, [[X, Y], [X + HTW, Y + HTH], [X, Y + TH], [X - HTW, Y + HTH]], ok ? 'rgba(80,255,80,0.25)' : 'rgba(255,60,60,0.3)', ok ? '#5f5' : '#f55', 1);
  },
};
