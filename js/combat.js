'use strict';
// ---------------------------------------------------------------------------
// Combat: melee, shove/stomp, firearms, throwables
// ---------------------------------------------------------------------------
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
    const sk = w.sk ? Player.skill(w.sk) : 0;
    let dur = w.swing * (1 - sk * 0.025);
    if (Player.hasTrait('axeman') && w.sk === 'Axe') dur *= 0.85;
    if (p.st.endurance < 0.25) dur *= 1.25;
    if (p.st.endurance < 0.1) dur *= 1.25;
    if (Player.heavyRatio() > 1.25) dur *= 1.15;
    if (p.st.pain > 50) dur *= 1.1;
    const [wx, wy] = Render.mouseWorld();
    p.angle = Math.atan2(wy - p.y, wx - p.x);
    p.swing = { t: 0, dur, kind: 'melee', w, it, done: false };
    p.st.endurance = Math.max(0, p.st.endurance - w.end * (1.4 - Player.skill('Fitness') * 0.06));
    Sfx.play(w === FISTS ? 'swingLight' : (w.swing > 1.2 ? 'swingHeavy' : 'swing'));
  },
  startShove() {
    const p = G.player;
    if (p.swing) return;
    // stomp a downed zombie in front
    const down = Zombie.near(p.x, p.y, 1.3).filter(z => !z.dead && (z.st === 'down' || z.crawl) && Math.abs(U.angDiff(p.angle, Math.atan2(z.y - p.y, z.x - p.x))) < 1.1);
    if (down.length) {
      p.swing = { t: 0, dur: 0.6, kind: 'stomp', target: down[0], done: false };
      p.st.endurance = Math.max(0, p.st.endurance - 0.015);
      return;
    }
    p.swing = { t: 0, dur: 0.45, kind: 'shove', done: false };
    p.st.endurance = Math.max(0, p.st.endurance - 0.012);
    Sfx.play('swingLight');
  },
  resolveSwing(s) {
    const p = G.player;
    const str = Player.skill('Strength');
    if (s.kind === 'shove') {
      let any = false;
      for (const z of Zombie.near(p.x, p.y, 1.25)) {
        if (z.dead || z.st === 'down' || z.lie > 0.3) continue;
        const a = Math.atan2(z.y - p.y, z.x - p.x);
        if (Math.abs(U.angDiff(p.angle, a)) > 1.0) continue;
        if (!World.lineClear(p.x, p.y, z.x, z.y, 'move')) continue;
        any = true;
        if (R.chance(0.22 + str * 0.035)) { z.st = 'down'; z.downT = R.f(1.5, 2.8); z.lieDir = 1; z.svx = Math.cos(a) * 1.8; z.svy = Math.sin(a) * 1.8; Sfx.play('zfall', z.x, z.y); }
        else { z.stag = 0.6; z.svx = Math.cos(a) * 2.2; z.svy = Math.sin(a) * 2.2; if (z.st === 'attack') { z.st = 'chase'; z.cd = 0.7; } }
      }
      if (any) { Sfx.play('shove'); Player.xp('Strength', 0.5); }
      return;
    }
    if (s.kind === 'stomp') {
      const z = s.target;
      if (z && !z.dead && U.dist(p.x, p.y, z.x, z.y) < 1.5) {
        const dmg = R.f(0.35, 0.75) * (0.75 + str * 0.05);
        Zombie.hit(z, dmg, Math.atan2(z.y - p.y, z.x - p.x), { stag: 0 });
        Sfx.play('stomp');
        Player.xp('Strength', 0.5);
        if (z.st === 'down') z.downT = Math.max(z.downT, 1.0);
      }
      return;
    }
    // melee
    const w = s.w, it = s.it;
    const sk = w.sk ? Player.skill(w.sk) : 0;
    const cands = [];
    for (const z of Zombie.near(p.x, p.y, w.range + 0.6)) {
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
      for (const { z } of targets) {
        let dmg = R.f(w.dmg[0], w.dmg[1]) * (0.55 + sk * 0.07) * (0.75 + str * 0.05);
        if (p.st.endurance < 0.25) dmg *= 0.75;
        if (p.st.panic > 65) dmg *= 0.85;
        const crit = R.chance(w.crit + sk * 0.02 + (Player.hasTrait('lucky') ? 0.03 : 0));
        if (crit) dmg *= 2.5;
        const knock = R.chance(w.knock + str * 0.02 + (crit ? 0.2 : 0));
        const a = Math.atan2(z.y - p.y, z.x - p.x);
        Zombie.hit(z, dmg, a, { knock, push: 1.0 + str * 0.06 });
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
    let s = g.spread * (aiming ? 1 : 1.9) * (1.5 - Player.skill('Aiming') * 0.09);
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
    if (!it.ammo) { Sfx.play('dryfire'); Player.say('Out of ammo! (R to reload)', '#f99'); p.fireCd = 0.4; return; }
    it.ammo--;
    p.fireCd = g.rof;
    p.swing = { t: 0, dur: 0.22, kind: 'fire', done: true };
    const [wx, wy] = Render.mouseWorld();
    const base = Math.atan2(wy - p.y, wx - p.x);
    p.angle = base;
    const sp = this.spread(g, p.aiming);
    const n = g.pellets || 1;
    const mx = p.x + Math.cos(base) * 0.55, my = p.y + Math.sin(base) * 0.55;
    let anyHit = false;
    for (let k = 0; k < n; k++) {
      const a = base + (R.next() + R.next() + R.next() - 1.5) * sp * 0.9;
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
        Zombie.hit(best, dmg, a, { knock: R.chance(g.knock), push: 1.5 });
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
    p.recoil = (p.recoil || 0) + (g.pellets ? 0.12 : 0.06);
    Noise.emit(p.x, p.y, g.noise, 'gun');
    Sfx.play(g.model === 'shotgun' ? 'shotgun' : g.model === 'rifle' ? 'rifle' : 'pistol');
    Fx.flash(mx, my, 7, 1.0, 0.07);
    p.st.panic = Math.max(0, p.st.panic - 2);
    Fx.parts.push({ x: p.x, y: p.y, z: 1.2, vx: Math.cos(base + 1.6) * 1.5, vy: Math.sin(base + 1.6) * 1.5, vz: 1.5, life: 0.8, max: 0.8, col: '#d8b040', size: 2, g: true });
    if (R.chance(1 / g.lower)) { it.cond--; if (it.cond <= 0) Player.say('The gun jammed for good!', '#f99'); }
  },
  throwItem(it) {
    const p = G.player;
    const d = ITEMS[it.id];
    let [wx, wy] = Render.mouseWorld();
    const dist = U.dist(p.x, p.y, wx, wy);
    if (dist > 12) { wx = p.x + (wx - p.x) / dist * 12; wy = p.y + (wy - p.y) / dist * 12; }
    Player.removeItem(it);
    p.angle = Math.atan2(wy - p.y, wx - p.x);
    p.swing = { t: 0, dur: 0.5, kind: 'melee', w: FISTS, it: null, done: true };
    const T = Math.max(0.35, U.dist(p.x, p.y, wx, wy) / 9);
    this.projs.push({ x: p.x, y: p.y, z: 1.4, x0: p.x, y0: p.y, x1: wx, y1: wy, t: 0, T, item: it, kind: d.throwable });
    Sfx.play('swing');
  },
  update(dt) {
    const p = G.player;
    if (p) p.recoil = Math.max(0, (p.recoil || 0) - dt * 0.35);
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
    // fire damage
    for (const f of Fx.fires) {
      for (const z of Zombie.near(f.x, f.y, 1.4)) if (!z.dead) { z.burnT = (z.burnT || 0) + dt; if (z.burnT > 0.7) { z.burnT = 0; Zombie.hit(z, R.f(0.2, 0.5), undefined, { stag: 0.1, push: 0.1 }); } }
      if (p && !p.dead && U.dist(p.x, p.y, f.x, f.y) < 1.1) { p.burnT = (p.burnT || 0) + dt; if (p.burnT > 1) { p.burnT = 0; Player.addWound(R.pick(['FootL', 'FootR', 'LowerLegL', 'LowerLegR']), 'burn'); } }
    }
  },
  land(pr) {
    // out of an upstairs window: it falls to the ground below
    if (pr.x >= LV.W0 && Wd.floor[Math.floor(pr.y) * Wd.w + Math.floor(pr.x)] === FL.VOID) pr.x -= LV.W0;
    if (pr.kind === 'fire') {
      Sfx.play('glass', pr.x, pr.y);
      Sfx.play('fire', pr.x, pr.y);
      for (let k = 0; k < 5; k++) Fx.fires.push({ x: pr.x + R.f(-0.8, 0.8), y: pr.y + R.f(-0.8, 0.8), t: R.f(10, 18) });
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
