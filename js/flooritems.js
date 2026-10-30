'use strict';
// ---------------------------------------------------------------------------
// Items on the floor: drawn at their own size, lying flat at their own angle (cans, bottles, jerrycans and
// buckets stand up), shadowed and darkened with the light; and placing an item where you want it
// (inventory: Place - the item follows the mouse, R or the wheel turns it, click puts it down).
// ---------------------------------------------------------------------------
const FloorItems = {
  // real size in metres (= tiles): length of what lies flat, height of what stands
  SIZE: {
    can: 0.13, tin: 0.1, chips: 0.24, bar: 0.14, box: 0.24, jar: 0.14, bread: 0.28, cheese: 0.14, fruit: 0.09, banana: 0.2, leaf: 0.12,
    carrot: 0.18, egg: 0.07, meat: 0.2, fish: 0.3, pizza: 0.3, icecream: 0.14, burger: 0.12, fries: 0.14, berries: 0.1, mushroom: 0.08,
    worm: 0.1, stew: 0.18, soda: 0.13, carton: 0.24, winebottle: 0.3, bottle: 0.26, pot: 0.2, bucket: 0.3, wateringcan: 0.32, gascan: 0.38,
    bandage: 0.12, disinfect: 0.15, wipes: 0.16, pills: 0.09, needle: 0.1, tweezers: 0.1, bat: 0.84, spikedbat: 0.84, crowbar: 0.6,
    golfclub: 0.95, sledge: 0.85, pan: 0.42, hammer: 0.32, pipe: 0.6, wrench: 0.3, rollingpin: 0.4, knife: 0.26, screwdriver: 0.2,
    machete: 0.55, katana: 0.95, axe: 0.75, handaxe: 0.35, shovel: 1.0, spear: 1.3, plank: 1.1, trowel: 0.28, pistol: 0.2, revolver: 0.25,
    shotgun: 0.95, rifle: 1.0, dbarrel: 1.0, sawnoff: 0.55, mag: 0.14, ammo: 0.05, shell: 0.06, ammobox: 0.12, saw: 0.55, canopener: 0.15, lighter: 0.07, matches: 0.06,
    flashlight: 0.22, battery: 0.06, rod: 1.4, tape: 0.1, glue: 0.1, scissors: 0.18, generator: 0.7, key: 0.06, radio: 0.25, cig: 0.09,
    molotov: 0.26, alarmclock: 0.14, map: 0.3, log: 0.9, nails: 0.1, rag: 0.3, sheet: 0.9, branch: 0.8, stone: 0.12, garbagebag: 0.6,
    seeds: 0.1, tshirt: 0.55, shirt: 0.6, jacket: 0.7, vest: 0.55, pants: 0.85, shorts: 0.45, shoes: 0.28, hat: 0.3, cap: 0.26, helmet: 0.3,
    gloves: 0.22, scarf: 0.6, glasses: 0.14, belt: 0.5, holster: 0.22, watch: 0.08, plasticbag: 0.4, backpack: 0.5, duffel: 0.7,
    fannypack: 0.32, toolbox: 0.45, firstaidkit: 0.3, magazine: 0.28, newspaper: 0.4, book: 0.22, tire: 0.6, carbattery: 0.3,
    cardoor: 1.1, windshield: 1.2, carwindow: 0.7, headlight: 0.25, brakepads: 0.16, suspension: 0.5, muffler: 0.8, hood: 1.3,
    trunklid: 1.1, gastank: 0.7, engineparts: 0.3, lugwrench: 0.45, jack: 0.4,
  },
  // drawn standing up
  UP: new Set(['can', 'soda', 'bottle', 'winebottle', 'jar', 'gascan', 'bucket', 'wateringcan', 'carton', 'pot', 'disinfect', 'glue', 'molotov', 'pills', 'carbattery']),
  // long tools painted corner to corner in their icon: their length is the diagonal
  DIAG: new Set(['needle', 'tweezers', 'bat', 'spikedbat', 'crowbar', 'golfclub', 'sledge', 'pan', 'hammer', 'pipe', 'wrench', 'rollingpin', 'knife', 'screwdriver', 'machete', 'katana', 'axe', 'handaxe', 'shovel', 'spear', 'plank', 'trowel', 'flashlight', 'rod', 'scissors', 'lugwrench', 'canopener', 'branch', 'log', 'carrot']),
  // items are drawn a third bigger than life: at life size a can is a few pixels
  K: 1.35,
  // furniture with a flat top that things can be put on: the height of the top (metres; null: the object's own)
  SURF: { table: null, counter: null, desk: null, nightstand: null, dresser: null, counterbar: null, toolcab: 0.96, crate: null, woodcrate: null, washer: null, stove: null, register: 0.95 },
  // the top a tile's furniture offers, or 0
  surfAt(x, y) { const o = World.obj(x, y); if (!o || !(o.t in this.SURF)) return 0; const h = this.SURF[o.t]; return h === null ? OBJ[o.t].h : h; },
  meta: new Map(),
  // per icon: the painted area's centre (icon px), world px per icon px (k), standing or lying, a dark silhouette
  metaOf(it) {
    const d = ITEMS[it.id], shape = d.ic ? d.ic[0] : 'box', c = Icons.canvas(it);
    let m = this.meta.get(c);
    if (m) return m;
    let x0 = 32, y0 = 32, x1 = -1, y1 = -1;
    try {
      const px = c.getContext('2d').getImageData(0, 0, 32, 32).data;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (px[(y * 32 + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    } catch (e) { /* a tainted canvas: take the whole icon */ }
    if (x1 < 0) { x0 = y0 = 4; x1 = y1 = 27; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, up = this.UP.has(shape), L = Math.max(0.12, (this.SIZE[shape] || 0.3)) * this.K;
    // lying: tiles per icon px along the item's length; standing: world px per icon px of its height
    const lenPx = this.DIAG.has(shape) ? Math.hypot(w, h) * 0.92 : Math.max(w, h);
    const sil = mkCanvas(32, 32), g = sil.getContext('2d');
    g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(3,5,14)'; g.fillRect(0, 0, 32, 32);
    m = { cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2, bot: y1 + 1, w, up, k: up ? L * ZU / h : L / lenPx, sil };
    this.meta.set(c, m);
    return m;
  },
  // one item at world (wx, wy) (ground-level coordinates), raised zo px (upstairs), light s; a: alpha (ghosts)
  draw(ctx, it, wx, wy, zo, s, a) {
    const m = this.metaOf(it), c = Icons.canvas(it), X = (wx - wy) * HTW, Y = (wx + wy) * HTH - zo;
    const dk = s === undefined ? 0 : 1 - s;
    if (a !== undefined) ctx.globalAlpha = a;
    if (m.up) {
      // standing: a soft shadow at the foot, the icon upright
      const k = m.k, w = 32 * k;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(X, Y, m.w * k * 0.55, m.w * k * 0.25, 0, 0, 6.283); ctx.fill();
      const x = X - m.cx * k, y = Y - m.bot * k;
      ctx.drawImage(c, x, y, w, w);
      if (dk > 0.03) { const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * Math.min(0.92, dk); ctx.drawImage(m.sil, x, y, w, w); ctx.globalAlpha = a0; }
    } else {
      // lying: the icon laid in the ground plane, turned by it.rot (icon x along the item's world direction)
      const r = it.rot || 0, cr = Math.cos(r), sr = Math.sin(r), k = m.k;
      const A = k * HTW * (cr - sr), B = k * HTH * (cr + sr), C = -k * HTW * (sr + cr), D = k * HTH * (cr - sr);
      ctx.save();
      // its shadow a little below (the item's thickness)
      ctx.transform(A, B, C, D, X, Y + 1.4);
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * 0.35; ctx.drawImage(m.sil, -m.cx, -m.cy);
      ctx.restore(); ctx.save();
      ctx.transform(A, B, C, D, X, Y);
      ctx.globalAlpha = a0; ctx.drawImage(c, -m.cx, -m.cy);
      if (dk > 0.03) { ctx.globalAlpha = a0 * Math.min(0.92, dk); ctx.drawImage(m.sil, -m.cx, -m.cy); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },

  // ------------------------------------------------------------------ placing
  start(it) {
    UI.closeContext();
    G.build = null;
    G.placing = { it, rot: it.rot || 0 };
    UI.hint('Place ' + Items.name(it) + ': click to put it down · R or mouse wheel to turn · right-click or Esc to cancel', 6);
  },
  cancel() { G.placing = null; },
  // the world point under the mouse (level aware) and whether the item can go there
  target() {
    const [wx, wy] = Render.mouseWorld(), p = G.player;
    const up = p.x >= LV.W0, tx = Math.floor(wx), ty = Math.floor(wy), gx = up ? tx - LV.W0 : tx;
    // on the floor, or on a table, a counter, a desk... (a tile solid only because of that furniture)
    const fz = World.inb(tx, ty) ? this.surfAt(tx, ty) : 0;
    let ok = World.inb(tx, ty) && (fz > 0 || !World.tileSolid(tx, ty)) && !World.isWater(tx, ty) && World.floor(tx, ty) !== FL.VOID;
    if (ok && up && World.room(tx, ty) < 0) ok = false;
    if (ok && U.dist(p.x, p.y, wx, wy) > 14) ok = false;
    return { wx, wy, tx, ty, gx, ok, fz };
  },
  input() {
    const P = G.placing;
    if (!P) return;
    if (Input.hit('r')) P.rot += Math.PI / 4;
    if (Input.wheel) P.rot += Math.sign(Input.wheel) * Math.PI / 12;
    if (!Input.overUI && Input.takeClick()) this.place();
  },
  place() {
    const P = G.placing, it = P.it, t = this.target();
    if (!t.ok) { Player.say("I can't put it there.", '#ccc'); return; }
    G.placing = null;
    const rot = P.rot, fx = t.wx - t.tx, fy = t.wy - t.ty;
    Interact.goDo(t.wx, t.wy, () => Actions.queue(Actions.mk('Placing ' + Items.name(it), 0.6, () => {
      if (!Player.removeItem(it)) return;
      World.dropItem(t.tx + fx, t.ty + fy, it);
      it.fx = U.clamp(fx, 0.04, 0.96); it.fy = U.clamp(fy, 0.04, 0.96); it.rot = rot;
      if (t.fz > 0) it.fz = t.fz; else delete it.fz;
      Sfx.play('pickup'); UI.refresh();
    }, { anim: 'loot', lvl: 0, begin: () => Actions.face(t.tx, t.ty) })), 1.4);
  },
  // the item under the mouse, see-through, green where it fits and red where it does not
  drawGhost(ctx) {
    const P = G.placing;
    if (!P) return;
    const t = this.target(), up = t.tx >= LV.W0, it = P.it, r0 = it.rot;
    it.rot = P.rot;
    this.draw(ctx, it, (up ? t.wx - LV.W0 : t.wx), t.wy, (up ? WALL_H * ZU : 0) + t.fz * ZU, 1, 0.75);
    it.rot = r0;
    const [X, Y] = Render.P(t.tx, t.ty, 0);
    poly(ctx, [[X, Y], [X + HTW, Y + HTH], [X, Y + TH], [X - HTW, Y + HTH]], t.ok ? 'rgba(80,255,80,0.12)' : 'rgba(255,60,60,0.22)', t.ok ? 'rgba(120,255,120,0.6)' : 'rgba(255,90,90,0.7)', 1);
  },
  // the floor item nearest a world point on that tile (for picking one up by clicking it)
  at(tx, ty, wx, wy) {
    const a = World.floorItems(tx, ty);
    if (!a || !a.length) return null;
    let best = null, bd = 0.5;
    for (const it of a) { const d = Math.hypot(tx + it.fx - wx, ty + it.fy - wy); if (d < bd) { bd = d; best = it; } }
    return best;
  },
};
