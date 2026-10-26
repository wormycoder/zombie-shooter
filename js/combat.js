'use strict';
// ---------------------------------------------------------------------------
// Combat: melee, shove/stomp, firearms, throwables
// ---------------------------------------------------------------------------
// spent cases per round: kind, and a delay for guns that are worked by hand (with the sound of it)
const EJECT = {
  Bullets9mm: { k: 'brass' },
  Bullets45: { k: 'brass' },
  Bullets556: { k: 'rifle' },
  Bullets308: { k: 'rifle', t: 0.45, s: 'bolt' },
  Bullets223: { k: 'rifle', t: 0.45, s: 'bolt' },
  ShotgunShells: { k: 'shell', t: 0.3, s: 'pump' },
};
const Combat = {
  projs: [],
  sources: [],
  meleeDef() {
    const it = Player.primary();
    const d = it ? ITEMS[it.id] : null;
    if (d && d.wpn && it.cond > 0) return { w: d.wpn, it };
    if (d && d.wpn && it.cond <= 0) Player.say('My weapon is broken!', '#f99');
    return { w: FISTS, it: null };
  },
  startMelee() {
    const p = G.player;
    const { w, it } = this.meleeDef();
    const [wx, wy] = Render.mouseWorld();
    p.angle = Math.atan2(wy - p.y, wx - p.x);
    // a zombie on the ground in front: bare hands stomp it, a weapon strikes down at it
    const dn = this.downedTarget(w === FISTS ? 1.0 : Math.max(1.1, w.range + 0.1));
    if (dn && w === FISTS) { this.startStomp(dn); return; }
    const sk = w.sk ? Player.skill(w.sk) : 0;
    let dur = w.swing * (1 - sk * 0.025);
    if (Player.hasTrait('axeman') && w.sk === 'Axe') dur *= 0.85;
    if (p.st.endurance < 0.25) dur *= 1.25;
    if (p.st.endurance < 0.1) dur *= 1.25;
    if (Player.heavyRatio() > 1.25) dur *= 1.15;
    if (p.st.pain > 50) dur *= 1.1;
    // swung from the ready stance (right mouse held) the wind-up starts there
    p.swing = { t: 0, dur, kind: 'melee', w, it, done: false, hit: 0.48, ready: !!p.aiming };
    // nothing standing closer in the way: aim the blow at the body on the ground
    if (dn && !this.standingInFront(Math.min(U.dist(p.x, p.y, dn.x, dn.y), w.range))) { p.swing.floor = dn.z; p.swing.tx = dn.x; p.swing.ty = dn.y; p.swing.hit = 0.52; p.swing.dur *= 1.1; p.angle = Math.atan2(dn.y - p.y, dn.x - p.x); }
    p.st.endurance = Math.max(0, p.st.endurance - w.end * (1.4 - Player.skill('Fitness') * 0.06));
    Sfx.play(w === FISTS ? 'swingLight' : (w.swing > 1.2 ? 'swingHeavy' : 'swing'));
  },
  // the nearest zombie lying (or crawling, or still getting up) within reach in front of the player:
  // { z, x, y } with the point to strike (see aimPoint)
  downedTarget(reach) {
    const p = G.player;
    let best = null, bd = 1e9;
    for (const z of Zombie.near(p.x, p.y, reach + 1.3)) {
      if (z.dead || !(z.st === 'down' || z.crawl || (z.st === 'getup' && z.lie > 0.45))) continue;
      const q = this.aimPoint(z, p.x, p.y, reach);
      if (q[2] > reach) continue;
      const ad = Math.abs(U.angDiff(p.angle, Math.atan2(q[1] - p.y, q[0] - p.x)));
      if (ad > (q[2] < 0.75 ? 1.6 : 1.1)) continue;
      if (!World.lineClear(p.x, p.y, q[0], q[1], 'move')) continue;
      const sc = q[2] + ad * 0.4;
      if (sc < bd) { bd = sc; best = { z, x: q[0], y: q[1] }; }
    }
    return best;
  },
  // where to strike a body on the ground from (x, y): its head when that is within reach, else the nearest part of
  // it (hips to head): [x, y, distance to the nearest part, the nearest part is the head]
  aimPoint(z, x, y, reach) {
    const [hx, hy, bx, by] = Zombie.bodyLine(z), ex = bx - hx, ey = by - hy;
    const k = U.clamp(((x - hx) * ex + (y - hy) * ey) / (ex * ex + ey * ey || 1), 0, 1), d = U.dist(x, y, hx + ex * k, hy + ey * k);
    const dh = U.dist(x, y, hx, hy);
    return dh <= reach ? [hx, hy, d, true] : [hx + ex * k, hy + ey * k, d, k < 0.3];
  },
  standingInFront(reach) {
    const p = G.player;
    for (const z of Zombie.near(p.x, p.y, reach + 0.3)) {
      if (z.dead || z.st === 'down' || z.crawl || z.lie > 0.45) continue;
      if (U.dist(p.x, p.y, z.x, z.y) > reach + z.r) continue;
      if (Math.abs(U.angDiff(p.angle, Math.atan2(z.y - p.y, z.x - p.x))) < 0.8) return true;
    }
    return false;
  },
  // dn: from downedTarget
  startStomp(dn) {
    const p = G.player;
    p.angle = Math.atan2(dn.y - p.y, dn.x - p.x);
    // the heel lands at 0.5 of the motion
    p.swing = { t: 0, dur: 0.72, kind: 'stomp', target: dn.z, tx: dn.x, ty: dn.y, done: false, hit: 0.5 };
    p.st.endurance = Math.max(0, p.st.endurance - 0.015);
  },
  startShove() {
    const p = G.player;
    if (p.swing) return;
    // stomp a downed zombie in front
    const dn = this.downedTarget(1.0);
    if (dn) { this.startStomp(dn); return; }
    p.swing = { t: 0, dur: 0.5, kind: 'shove', done: false, hit: 0.4 };
    p.st.endurance = Math.max(0, p.st.endurance - 0.012);
    Sfx.play('swingLight');
  },
  resolveSwing(s) {
    const p = G.player;
    const str = Player.skill('Strength');
    if (s.kind === 'shove') {
      let any = false;
      for (const z of Zombie.near(p.x, p.y, 1.3)) {
        if (z.dead || z.st === 'down' || z.lie > 0.3) continue;
        const a = Math.atan2(z.y - p.y, z.x - p.x);
        // one that has hold of you is shoved off whichever side it is on: front on, more often than not; from behind,
        // with strength
        if (z.st === 'grab') {
          any = true;
          const front = Math.abs(U.angDiff(p.angle, a)) < 1.4, ch = (front ? 0.6 : 0.35) + str * 0.04;
          if (R.chance(ch)) { Zombie.release(z, 1.2); if (R.chance(front ? 0.45 : 0.25)) { Zombie.knockDown(z, a, 2.0, R.f(1.4, 2.6)); Sfx.play('zfall', z.x, z.y); } else Zombie.stagger(z, a, 0.65, 2.6); }
          continue;
        }
        if (Math.abs(U.angDiff(p.angle, a)) > 1.0 || U.dist(p.x, p.y, z.x, z.y) > 1.15 + z.r) continue;
        if (!World.lineClear(p.x, p.y, z.x, z.y, 'move')) continue;
        any = true;
        // shoved from behind or mid-lunge they go over easily; head on it takes strength
        const behind = Math.abs(U.angDiff(z.a, a)) < 1.2;
        const ch = behind ? 0.85 : 0.3 + str * 0.035 + (z.st === 'attack' ? 0.15 : 0) + (z.stag > 0 ? 0.2 : 0);
        if (z.st !== 'climb' && R.chance(ch)) { Zombie.knockDown(z, a, 2.0, R.f(1.6, 3.0)); Sfx.play('zfall', z.x, z.y); }
        else Zombie.stagger(z, a, 0.65, 2.4);
      }
      if (any) { Sfx.play('shove'); Player.xp('Strength', 0.5); }
      return;
    }
    if (s.kind === 'stomp') {
      const z = s.target, hp = z && this.aimPoint(z, p.x, p.y, 0.75);
      if (z && !z.dead && (z.st === 'down' || z.crawl || z.lie > 0.3) && hp[2] < 0.9) {
        // the heel comes down on the head (or whatever is under it): strong legs crush skulls
        const dmg = R.f(0.45, 0.85) * (0.75 + str * 0.06) * (hp[3] ? 1.3 : 0.7) * (R.chance(0.12 + str * 0.01) ? 2.5 : 1);
        Zombie.hit(z, dmg, Math.atan2(hp[1] - p.y, hp[0] - p.x), { stag: 0, at: hp, kind: 'stomp', head: !!hp[3] });
        Sfx.play('stomp', z.x, z.y);
        Player.xp('Strength', 0.5);
        if (z.st === 'down') z.downT = Math.max(z.downT, 1.2);
        if (z.st === 'getup' && !z.dead) Zombie.knockDown(z, z.a + Math.PI, 0, R.f(1.2, 2), z.lieDir);
      } else Sfx.play('thud', p.x, p.y);
      return;
    }
    // melee
    const w = s.w, it = s.it;
    const sk = w.sk ? Player.skill(w.sk) : 0;
    const cands = [];
    if (s.floor) {
      const z = s.floor, hp = this.aimPoint(z, p.x, p.y, w.range);
      if (!z.dead && (z.st === 'down' || z.crawl || z.lie > 0.3) && hp[2] < w.range + 0.35 && World.lineClear(p.x, p.y, hp[0], hp[1], 'move')) cands.push({ z, d: 0, down: true, at: hp });
    } else for (const z of Zombie.near(p.x, p.y, w.range + 0.6)) {
      if (z.dead) continue;
      const d = U.dist(p.x, p.y, z.x, z.y);
      if (d > w.range + z.r) continue;
      const a = Math.atan2(z.y - p.y, z.x - p.x);
      const arc = w.arc + (d < 0.6 ? 0.5 : 0);
      if (Math.abs(U.angDiff(p.angle, a)) > arc) continue;
      if (!World.lineClear(p.x, p.y, z.x, z.y, 'move')) continue;
      cands.push({ z, d, down: z.st === 'down' || z.crawl });
    }
    cands.sort((a, b) => (a.down - b.down) || (a.d - b.d));
    const targets = cands.slice(0, w.hits);
    if (targets.length) {
      let wearPerHit = it ? 1 / (w.lower + Player.skill('Maintenance') * 3) : 0;
      for (const { z, at } of targets) {
        let dmg = R.f(w.dmg[0], w.dmg[1]) * (0.55 + sk * 0.07) * (0.75 + str * 0.05);
        if (p.st.endurance < 0.25) dmg *= 0.75;
        if (p.st.panic > 65) dmg *= 0.85;
        if (Player.brokenArm()) dmg *= 0.55;
        const crit = R.chance(w.crit + sk * 0.02 + (Player.hasTrait('lucky') ? 0.03 : 0));
        if (crit) dmg *= 2.5;
        const knock = !s.floor && R.chance(w.knock + str * 0.02 + (crit ? 0.2 : 0));
        const a = Math.atan2(z.y - p.y, z.x - p.x);
        // a blow driven down into a body on the ground carries the weight of the swing
        if (s.floor) dmg *= 1.2;
        const gk = Gore.kindOfWeapon(w, null);
        Zombie.hit(z, dmg, a, { knock, push: s.floor ? 0.2 : 1.0 + str * 0.06, at, kind: gk, head: at ? !!at[3] : R.chance(0.2) });
        Gore.splash(p, it, gk, U.dist(p.x, p.y, z.x, z.y));
        if (crit && !z.dead) Fx.text(z.x, z.y, 'Critical!', '#ffcc66', 0.8);
        Sfx.play(w.sk === 'ShortBlade' || w.sk === 'LongBlade' || w.sk === 'Axe' || w.sk === 'Spear' ? 'hitBlade' : 'hitBlunt', z.x, z.y);
        if (w.sk) Player.xp(w.sk, R.f(1.5, 3));
        Player.xp('Strength', 0.3);
        if (it && R.chance(wearPerHit)) {
          it.cond--;
          Player.xp('Maintenance', 1);
          if (it.cond <= 0) { Player.say('My ' + ITEMS[it.id].n + ' broke!', '#f99'); Sfx.play('break'); }
        }
      }
      Noise.emit(p.x, p.y, 5, 'melee');
    } else {
      // hit doors/windows/barricades in front
      const tx = p.x + Math.cos(p.angle) * w.range, ty = p.y + Math.sin(p.angle) * w.range;
      const e = World.firstEdgeHit(p.x, p.y, tx, ty);
      if (e) {
        const f = World.feat(e.x, e.y, e.d);
        const dmg = R.f(w.dmg[0], w.dmg[1]) * 12 * (0.75 + str * 0.05) * (w.sk === 'Axe' ? 2 : 1);
        if (f || World.wall(e.x, e.y, e.d) >= WT.PICKET) Interact.damageEdge(e.x, e.y, e.d, dmg, 'player');
        if (it && R.chance(0.2)) it.cond = Math.max(0, it.cond - 1);
      }
    }
  },
  spread(g, aiming) {
    const p = G.player;
    // aim error: about g.spread aimed at Aiming 3; hip fire and a shaky hand widen it, skill tightens it
    let s = g.spread * (aiming ? 1 : g.two ? 2.2 : 1.6) * (1.2 - Player.skill('Aiming') * 0.07);
    s *= 1 + p.st.panic / 120;
    s *= 1 + p.st.drunk * 1.5;
    if (p.moveMode !== 'idle' && p.anim.amp > 0.3) s *= 1.3;
    s += (p.recoil || 0);
    return s;
  },
  fire(it) {
    const p = G.player;
    const g = ITEMS[it.id].gun;
    if (it.cond <= 0) { Player.say('The gun is broken.', '#f99'); p.fireCd = 0.5; return; }
    // a click: no magazine in it, a jam, or the slide locked back on an empty magazine
    if (g.mag && it.magIn === false) { Sfx.play('dryfire'); Player.say('No magazine! (R to reload)', '#f99'); p.fireCd = 0.4; return; }
    if (it.jam) { Sfx.play('dryfire'); Player.say('Jammed! (R to clear it)', '#f99'); p.fireCd = 0.4; return; }
    if (!it.ammo) { Sfx.play('dryfire'); Player.say('Out of ammo! (R to reload)', '#f99'); p.fireCd = 0.4; return; }
    if (it.unracked) { Sfx.play('dryfire'); Player.say('It needs racking. (R)', '#f99'); p.fireCd = 0.4; return; }
    it.ammo--;
    p.fireCd = g.rof;
    // a pump or bolt is worked between shots; a self-loader's slide locks back on the last round
    if (g.cycle) p.cycle = { t: -0.12, dur: Math.max(0.35, g.rof * 0.75), kind: g.cycle };
    if (g.mag && !it.ammo) it.unracked = true;
    p.swing = { t: 0, dur: Math.min(0.22, g.rof * 0.95), kind: 'fire', done: true };
    const [wx, wy] = Render.mouseWorld();
    const base = Math.atan2(wy - p.y, wx - p.x);
    p.angle = base;
    const sp = this.spread(g, p.aiming);
    const n = g.pellets || 1;
    // one aim error for the shot; shot pellets then spread in a fixed cone around it
    const aimA = base + (R.next() + R.next() + R.next() - 1.5) * sp * 0.9;
    const mx = p.x + Math.cos(base) * 0.55, my = p.y + Math.sin(base) * 0.55;
    let anyHit = false;
    for (let k = 0; k < n; k++) {
      const a = n > 1 ? aimA + (k / (n - 1) - 0.5 + R.f(-0.35, 0.35) / (n - 1)) * g.cone * 2 : aimA;
      const ex = mx + Math.cos(a) * g.range, ey = my + Math.sin(a) * g.range;
      const eh = World.firstEdgeHit(mx, my, ex, ey);
      let tEdge = eh ? eh.t * g.range : g.range;
      // zombies along ray
      let best = null, bestT = tEdge;
      const dx = Math.cos(a), dy = Math.sin(a);
      // from upstairs, zombies below open air can be shot too
      const up = mx >= LV.W0;
      const cands = Zombie.near(mx, my, g.range);
      if (up) for (const z of Zombie.near(mx - LV.W0, my, g.range)) if (Wd.floor[Math.floor(z.y) * Wd.w + Math.floor(z.x) + LV.W0] === FL.VOID) cands.push(z);
      for (const z of cands) {
        if (z.dead) continue;
        const zx = up && z.x < LV.W0 ? z.x + LV.W0 : z.x;
        const ox = zx - mx, oy = z.y - my;
        const t = ox * dx + oy * dy;
        if (t < 0 || t > bestT) continue;
        const px_ = ox - dx * t, py_ = oy - dy * t;
        const rr = (z.lie > 0.5 ? 0.45 : z.r + 0.06);
        if (px_ * px_ + py_ * py_ > rr * rr) continue;
        best = z; bestT = t;
      }
      let hx = mx + dx * bestT, hy = my + dy * bestT;
      if (best && best.x < LV.W0 && up) hx = best.x;
      Fx.tracer(mx, my, 1.25, hx, hy, best ? 1.1 : 1.0);
      if (best) {
        anyHit = true;
        let dmg = R.f(g.dmg[0], g.dmg[1]) * (0.8 + Player.skill('Aiming') * 0.04);
        if (bestT > g.range * 0.6) dmg *= 0.7;
        const crit = R.chance(g.crit + Player.skill('Aiming') * 0.015);
        if (crit) dmg *= 3;
        Zombie.hit(best, dmg, a, { knock: R.chance(g.knock), push: 1.5, kind: Gore.kindOfWeapon(null, g), head: crit, at: [hx, hy] });
        if (crit && !best.dead) Fx.text(best.x, best.y, 'Headshot!', '#ffcc66', 0.8);
        Sfx.play('hitFlesh', best.x, best.y);
      } else if (eh) {
        const f = World.feat(eh.x, eh.y, eh.d);
        if (f && f.k === 'window' && !f.smashed) Interact.smashWindow([eh.x, eh.y, eh.d], true);
        else if (f) Interact.damageEdge(eh.x, eh.y, eh.d, 8, 'bullet');
        Fx.shards(hx, hy, 1.0, 3, '#c8c0a0');
      }
    }
    Player.xp('Aiming', anyHit ? 2.5 : 0.5);
    p.recoil = Math.min(0.3, (p.recoil || 0) + (g.kick || 0.06) * (1.1 - Player.skill('Aiming') * 0.05));
    Noise.emit(p.x, p.y, g.noise, 'gun');
    Sfx.play(g.snd || (g.pellets ? 'shotgun' : g.model === 'rifle' ? 'rifle' : 'pistol'));
    Fx.flash(mx, my, 7, 1.0, 0.07);
    p.st.panic = Math.max(0, p.st.panic - 2);
    // the spent case: out at once from a self-loader, when the pump or bolt is worked on the others; a revolver keeps it
    const ej = !g.brk && EJECT[g.ammo];
    if (ej) { if (ej.t) this.ejQ.push({ t: ej.t, k: ej.k, s: ej.s }); else this.eject(ej.k); }
    if (R.chance(1 / g.lower)) { it.cond--; if (it.cond <= 0) Player.say('The gun jammed for good!', '#f99'); }
    // a worn gun jams now and then (cleared by working the action: R)
    else if (it.ammo && R.chance(0.003 + Math.max(0, 1 - it.cond / g.cond) * 0.035)) { it.jam = true; Player.say('It jammed!', '#f99'); }
  },
  throwItem(it) {
    const p = G.player;
    const d = ITEMS[it.id];
    let [wx, wy] = Render.mouseWorld();
    const dist = U.dist(p.x, p.y, wx, wy);
    if (dist > 12) { wx = p.x + (wx - p.x) / dist * 12; wy = p.y + (wy - p.y) / dist * 12; }
    Player.removeItem(it);
    p.angle = Math.atan2(wy - p.y, wx - p.x);
    p.swing = { t: 0, dur: 0.6, kind: 'melee', w: FISTS, it: null, done: true, throw: true };
    const T = Math.max(0.35, U.dist(p.x, p.y, wx, wy) / 9);
    this.projs.push({ x: p.x, y: p.y, z: 1.4, x0: p.x, y0: p.y, x1: wx, y1: wy, t: 0, T, item: it, kind: d.throwable });
    Sfx.play('swing');
  },
  ejQ: [],
  // throw a spent case from the gun's ejection port (where the 3D model last drew it; about chest high in front otherwise)
  eject(k) {
    const p = G.player;
    if (!p || p.inCar) return;
    const S = typeof Char3D !== 'undefined' && Char3D.st ? Char3D.st.get(p) : null, e = S && S.ej;
    const up = p.x >= LV.W0, z0 = up ? 0 : World.stairZ(p);
    let x, y, z, rx, ry;
    if (e && performance.now() - e[5] < 500) { x = p.x + e[0]; y = p.y + e[1]; z = z0 + e[2]; rx = e[3]; ry = e[4]; }
    else { const a = p.angle; x = p.x + Math.cos(a) * 0.3; y = p.y + Math.sin(a) * 0.3; z = z0 + 1.2; rx = -Math.sin(a); ry = Math.cos(a); }
    const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    const sv = k === 'shell' ? R.f(1.1, 1.7) : R.f(1.6, 2.4), bv = R.f(0.1, 0.6);
    Fx.casing(x, y, z, z0, rx * sv - fx * bv, ry * sv - fy * bv, k === 'brass' ? R.f(1.8, 2.8) : R.f(1.0, 1.8), k);
  },
  update(dt) {
    const p = G.player;
    for (let i = this.ejQ.length - 1; i >= 0; i--) {
      const q = this.ejQ[i];
      q.t -= dt;
      if (q.t > 0) continue;
      this.ejQ.splice(i, 1);
      if (p && !p.dead) { if (q.s) Sfx.play(q.s, p.x, p.y); this.eject(q.k); }
    }
    if (p) p.recoil = Math.max(0, (p.recoil || 0) - dt * (0.12 + (p.recoil || 0) * 4));
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.T);
      let nx = U.lerp(pr.x0, pr.x1, k), ny = U.lerp(pr.y0, pr.y1, k);
      // stop at walls (open air upstairs lets it fly out of a window)
      const tx = Math.floor(nx), ty = Math.floor(ny);
      const blocked = World.firstEdgeHit(pr.x, pr.y, nx, ny) || (World.tileSolid(tx, ty) && Wd.floor[ty * Wd.w + tx] !== FL.VOID);
      if (blocked) { pr.x1 = pr.x; pr.y1 = pr.y; nx = pr.x; ny = pr.y; pr.t = pr.T; }
      pr.x = nx; pr.y = ny; pr.z = 1.4 * (1 - k) + Math.sin(k * Math.PI) * 1.6;
      if (pr.t >= pr.T) {
        this.projs.splice(i, 1);
        this.land(pr);
      }
    }
    for (let i = this.sources.length - 1; i >= 0; i--) {
      const s = this.sources[i];
      s.t -= dt; s.pulse -= dt;
      if (s.pulse <= 0) { s.pulse = 2.5; Noise.emit(s.x, s.y, 26, 'alarm'); Sfx.play('beep', s.x, s.y); }
      if (s.t <= 0) { this.sources.splice(i, 1); }
    }
  },
  land(pr) {
    // out of an upstairs window: it falls to the ground below
    if (pr.x >= LV.W0 && Wd.floor[Math.floor(pr.y) * Wd.w + Math.floor(pr.x)] === FL.VOID) pr.x -= LV.W0;
    if (pr.kind === 'fire') {
      Sfx.play('glass', pr.x, pr.y);
      Sfx.play('fire', pr.x, pr.y);
      // burning fuel splashes over a few tiles
      const cx = Math.floor(pr.x), cy = Math.floor(pr.y);
      Fire.ignite(cx, cy, 1, 14);
      for (const [dx, dy] of DIR8) if (R.chance(0.7) && World.lineClear(pr.x, pr.y, cx + dx + 0.5, cy + dy + 0.5, 'sight')) Fire.ignite(cx + dx, cy + dy, 0.7, R.f(5, 10));
      Noise.emit(pr.x, pr.y, 14, 'glass');
    } else if (pr.kind === 'noise') {
      Sfx.play('thud', pr.x, pr.y);
      this.sources.push({ x: pr.x, y: pr.y, t: 45, pulse: 1 });
      World.dropItem(pr.x, pr.y, pr.item);
    }
  },
  draw(ctx) {
    for (const pr of this.projs) {
      const [X, Y] = Render.P(pr.x, pr.y, pr.z);
      ctx.drawImage(Icons.canvas(pr.item), X - 7, Y - 7, 14, 14);
      if (pr.kind === 'fire') { ctx.fillStyle = 'rgba(255,160,40,0.9)'; ctx.beginPath(); ctx.arc(X, Y - 6, 2.5, 0, 7); ctx.fill(); }
    }
  },
};
