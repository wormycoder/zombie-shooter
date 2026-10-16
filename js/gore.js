'use strict';
// ---------------------------------------------------------------------------
// Gore: blood that sprays by weapon and lands as splatter, pools spreading under the dead and drying over days,
// drips, streaks and crawl smears; wounds, crushed heads and severed limbs on zombies, severed parts on the ground.
// Settings.v.gore: 0 off, 1 low, 2 normal, 3 extreme. Settings.v.dismember: limbs and heads come off (needs gore on).
// Floor marks are decals { k: 'g', t, x, y, a, s, v, b } (Wd.decals): t the kind, a the angle on the floor, s the
// size in tiles, v the variant, b the game minute it was spilt (drying). They are painted top-down once per kind,
// variant and drying stage and drawn through the floor's iso projection, turned to their angle.
// ---------------------------------------------------------------------------
// severed parts (bits of z.gore.m): the head; the forearm below the elbow or the whole arm; the shin below the knee or
// the whole leg
const GM = { HEAD: 1, FARM_L: 2, FARM_R: 4, ARM_L: 8, ARM_R: 16, SHIN_L: 32, SHIN_R: 64, LEG_L: 128, LEG_R: 256 };
// blood as it dries: fresh, tacky, dry, old (stage ends at these game minutes); fill, highlight, dark edge
const GORE_STAGE = [45, 600, 5760];
const GORE_COL = [['#7c0907', '#b01812', '#520504'], ['#640806', '#8a100c', '#440404'], ['#470c08', '#5c140e', '#330705'], ['#38140f', '#462019', '#2a0e0a']];

const Gore = {
  parts: [], spr: new Map(), budget: 0,
  lv() { const v = Settings.v.gore; return v === undefined ? 2 : v; },
  amt() { return [0, 0.45, 1, 1.75][this.lv()] * (Settings.v.particles === undefined ? 1 : Settings.v.particles); },
  // dismemberment chances are scaled by the level: low halves them, extreme raises them
  cut() { const v = Settings.v.dismember, l = this.lv(); return (v === undefined || v) && l ? [0, 0.5, 1, 1.7][l] : 0; },
  st(z) { return z.gore || (z.gore = { m: 0, cr: 0, w: [], n: 0 }); },
  // a change to how a body looks: new look object (cached body sprites see the change), version for Char3D.extras
  touch(z) { const g = this.st(z); g.n++; z.look = Object.assign({}, z.look, { gore: g }); },

  // ---------------------------------------------------------------- particles
  // k: 0 blood drop, 1 mist puff, 2 flesh bit
  spawn(k, x, y, z, vx, vy, vz, s, life) {
    if (this.parts.length > 1600) return null;
    const p = { k, x, y, z, vx, vy, vz, s, life, max: life, c: k === 2 ? R.pick(['#5a0a08', '#8a2a24', '#c07a70']) : R.chance(0.5) ? '#860a08' : '#6a0606' };
    this.parts.push(p);
    return p;
  },
  // n drops from x, y, height z, travelling along a (spread sa either side), speed v0..v1, rising vz0..vz1
  burst(x, y, z, n, a, sa, v0, v1, vz0, vz1) {
    for (let i = 0; i < n; i++) {
      const b = a + R.f(-sa, sa), v = R.f(v0, v1);
      this.spawn(0, x + R.f(-0.08, 0.08), y + R.f(-0.08, 0.08), z + R.f(-0.1, 0.1), Math.cos(b) * v, Math.sin(b) * v, R.f(vz0, vz1), R.f(1.2, 2.6), 1.6);
    }
  },
  mist(x, y, z, a, n) { for (let i = 0; i < n; i++) { const p = this.spawn(1, x, y, z, Math.cos(a) * R.f(0.3, 1.1), Math.sin(a) * R.f(0.3, 1.1), R.f(-0.1, 0.4), R.f(4, 7), R.f(0.35, 0.6)); if (p) p.g = 0; } },
  gibs(x, y, z, n, a) { for (let i = 0; i < n; i++) { const b = a + R.f(-1.2, 1.2), v = R.f(0.8, 2.6); this.spawn(2, x, y, z, Math.cos(b) * v, Math.sin(b) * v, R.f(1, 3), R.f(1.6, 3), 2); } },
  update(dt) {
    this.budget = Math.min(40, this.budget + dt * 30);
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.k === 1) { p.s += dt * 8; p.vx *= 0.92; p.vy *= 0.92; continue; }
      p.vz -= 9.5 * dt;
      if (p.z <= 0) {
        // landed: a drop of it stays where it fell (a few per second at most: a big fight would flood the decals)
        if (Wd && this.budget >= 1 && R.chance(p.k === 2 ? 0.8 : 0.3)) { this.budget--; this.dec(p.k === 2 ? 'gib' : 'drops', p.x, p.y, Math.atan2(p.vy, p.vx), p.k === 2 ? R.f(0.18, 0.3) : R.f(0.18, 0.34)); }
        P[i] = P[P.length - 1]; P.pop();
      }
    }
    this.trails(dt);
  },
  draw(ctx) {
    const P = this.parts;
    if (!P.length) return;
    ctx.lineCap = 'round';
    for (const p of P) {
      const s = Render.P(p.x, p.y, p.z), a = Math.min(1, p.life / p.max * 3);
      if (p.k === 1) { ctx.globalAlpha = 0.35 * p.life / p.max; ctx.drawImage(Fx.disc('112,12,10'), s[0] - p.s, s[1] - p.s * 0.8, p.s * 2, p.s * 1.6); continue; }
      ctx.globalAlpha = a;
      if (p.k === 2) { ctx.fillStyle = p.c; ctx.fillRect(s[0] - p.s / 2, s[1] - p.s / 2, p.s, p.s * 0.8); continue; }
      // a drop in flight draws as a short streak along its motion
      const e = Render.P(p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.z - p.vz * 0.03);
      ctx.strokeStyle = p.c; ctx.lineWidth = p.s;
      ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(s[0], s[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  },

  // ---------------------------------------------------------------- floor decals
  dec(t, x, y, a, s, o) {
    if (!Wd || !this.lv()) return null;
    const d = { k: 'g', t, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, a: Math.round(a * 100) / 100, s: Math.round(s * 100) / 100, v: R.int(0, 5), b: Math.round(G.time) };
    if (o) Object.assign(d, o);
    Wd.decals.push(d);
    Fx.capDecals();
    return d;
  },
  stage(d) { const age = G.time - d.b; return age < GORE_STAGE[0] ? 0 : age < GORE_STAGE[1] ? 1 : age < GORE_STAGE[2] ? 2 : 3; },
  drawDecal(ctx, d, X, Y) {
    const age = G.time - d.b, st = this.stage(d), spr = this.sprite(d, st);
    let s = d.s;
    if (d.gd) s *= 0.3 + 0.7 * U.smooth(U.clamp(age / d.gd, 0, 1));
    const k = s / 32;
    ctx.globalAlpha = st === 3 ? 0.7 * (d.al || 1) : (d.al || 1);
    // the floor's iso basis: one tile along x is (HTW, HTH) on screen, along y (-HTW, HTH)
    ctx.save();
    ctx.transform(HTW * k, HTH * k, -HTW * k, HTH * k, X, Y);
    ctx.rotate(d.a);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.restore();
  },
  // top-down sprite of a decal kind (32 px = 1 tile at size 1)
  sprite(d, st) {
    const lim = d.t === 'limb';
    const key = d.t + d.v + st + (lim ? d.p + d.c : '');
    let c = this.spr.get(key);
    if (c) return c;
    if (this.spr.size > 400) this.spr.clear();
    c = mkCanvas(64, 64);
    const g = c.getContext('2d'), C = GORE_COL[st], rng = new RNG(d.v * 977 + d.t.length * 131 + (lim ? d.p.length * 17 : 0) + 5);
    g.translate(32, 32);
    const blob = (x, y, r, col, n) => {
      g.fillStyle = col; g.beginPath();
      const m = n || 9;
      for (let i = 0; i <= m; i++) { const b = i / m * Math.PI * 2, rr = r * (0.78 + rng.next() * 0.38); const px = x + Math.cos(b) * rr, py = y + Math.sin(b) * rr; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.closePath(); g.fill();
    };
    const drop = (x, y, r, along, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r * (1 + along), r, 0, 0, 7); g.fill(); };
    const t = d.t;
    if (t === 'splat') {
      blob(0, 0, 9, C[2], 12); blob(0.5, -0.5, 8, C[0], 12);
      for (let i = 0; i < 9; i++) { const b = rng.next() * 7, r = 10 + rng.next() * 15; drop(Math.cos(b) * r, Math.sin(b) * r, 0.8 + rng.next() * 2, 0, C[0]); }
      if (st === 0) blob(-2, -2, 3, C[1], 7);
    } else if (t === 'streak') {
      // thrown along +x: a body of blood at the start, drops running out and getting smaller
      blob(-12, 0, 6, C[2], 10); blob(-11.5, -0.4, 5, C[0], 10);
      for (let i = 0; i < 9; i++) { const x = -6 + i * 3.6 + rng.next() * 2, r = Math.max(0.8, 3.2 - i * 0.3) * (0.7 + rng.next() * 0.5); drop(x, (rng.next() - 0.5) * 5, r, 0.8, C[0]); }
      for (let i = 0; i < 6; i++) drop(-4 + rng.next() * 28, (rng.next() - 0.5) * 10, 0.6 + rng.next(), 0, C[2]);
    } else if (t === 'drops') {
      for (let i = 0; i < 5; i++) drop((rng.next() - 0.5) * 14, (rng.next() - 0.5) * 14, 0.9 + rng.next() * 2.2, rng.next() * 0.4, C[i & 1 ? 0 : 2]);
    } else if (t === 'pool') {
      blob(0, 0, 25, C[2], 16); blob(-0.5, -0.5, 22, C[0], 16);
      for (let i = 0; i < 4; i++) blob((rng.next() - 0.5) * 30, (rng.next() - 0.5) * 30, 5 + rng.next() * 5, C[0], 9);
      if (st < 2) { g.globalAlpha = 0.45; blob(-6, -7, 7, C[1], 9); g.globalAlpha = 1; }
    } else if (t === 'smear') {
      g.fillStyle = C[0];
      for (let i = 0; i < 6; i++) { g.globalAlpha = 0.35 + rng.next() * 0.3; g.fillRect(-15, -5 + i * 2 + rng.next(), 28 + rng.next() * 4, 1.4); }
      g.globalAlpha = 1; blob(-14, 0, 4, C[2], 8);
    } else if (t === 'gib') {
      blob(0, 0, 6, C[2], 9);
      const fl = ['#9a3a32', '#c0807a', '#5a0a08', '#e0d8c0'];
      for (let i = 0; i < 4; i++) { g.fillStyle = fl[i]; g.fillRect((rng.next() - 0.5) * 10, (rng.next() - 0.5) * 10, 2 + rng.next() * 3, 1.5 + rng.next() * 2); }
    } else if (lim) this.limbArt(g, d, C, rng);
    this.spr.set(key, c);
    return c;
  },
  // a severed part lying on the ground, seen from above (along +x from the bloody end); d.c: skin|sleeve or trouser|shoe|hair
  limbArt(g, d, C, rng) {
    const [skin, cloth, shoe, hair] = d.c.split('|');
    const cap = (x0, x1, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0); g.stroke(); };
    const stump = (x, r) => { g.fillStyle = C[2]; g.beginPath(); g.arc(x, 0, r + 2.5, 0, 7); g.fill(); g.fillStyle = '#7a0e0a'; g.beginPath(); g.arc(x, 0, r, 0, 7); g.fill(); g.fillStyle = '#e4dcc4'; g.beginPath(); g.arc(x + 0.5, 0, r * 0.35, 0, 7); g.fill(); };
    const p = d.p;
    g.fillStyle = C[2]; g.beginPath(); g.ellipse(-6, 1, 12, 7, 0, 0, 7); g.fill();
    if (p === 'head') {
      g.fillStyle = skin; g.beginPath(); g.arc(1, 0, 6.5, 0, 7); g.fill();
      if (hair && hair !== 'none') { g.fillStyle = hair; g.beginPath(); g.arc(2.5, 0, 6.5, -1.9, 1.9); g.fill(); }
      g.fillStyle = 'rgba(30,10,8,0.7)'; g.fillRect(-2.5, -2.5, 1.5, 1.5); g.fillRect(-2.5, 1, 1.5, 1.5);
      stump(-6, 2.6);
    } else if (p === 'arm' || p === 'farm') {
      const up = p === 'arm';
      if (up) cap(-9, 0, 5.2, cloth);
      cap(up ? 0 : -8, up ? 8 : 1, 4.2, up ? skin : cloth === skin ? skin : cloth);
      g.fillStyle = skin; g.beginPath(); g.ellipse(up ? 10.5 : 3.5, 0, 3, 2.4, 0, 0, 7); g.fill();
      stump(up ? -10 : -9, 2.2);
    } else {
      const up = p === 'leg';
      cap(up ? -13 : -6, 7, up ? 6.4 : 5, cloth);
      g.fillStyle = shoe; g.beginPath(); g.ellipse(10, 0, 4.2, 2.8, 0, 0, 7); g.fill();
      stump(up ? -14 : -7, up ? 3 : 2.4);
    }
    if (rng.next() < 0.7) { g.fillStyle = C[0]; g.beginPath(); g.ellipse(-3, (rng.next() - 0.5) * 4, 3, 1.4, 0, 0, 7); g.fill(); }
  },

  // ---------------------------------------------------------------- hits
  // kind of blow: blunt, blade, chop, stab, gun, shotgun, stomp, car, bite
  kindOfWeapon(w, gun) {
    if (gun) return gun.pellets ? 'shotgun' : 'gun';
    if (!w) return 'blunt';
    return w.sk === 'Axe' ? 'chop' : w.sk === 'LongBlade' ? 'blade' : w.sk === 'ShortBlade' ? 'stab' : w.sk === 'Spear' && w.model === 'spear' ? 'stab' : 'blunt';
  },
  // z hit for dmg by a blow travelling along a (o.at: where, o.kind, o.head: on the head)
  hit(z, dmg, a, o) {
    const n0 = this.amt();
    if (!n0) return;
    const kind = o.kind || 'blunt', at = o.at || [z.x, z.y], down = z.lie > 0.5 || z.crawl;
    const A = a === undefined ? R.f(0, Math.PI * 2) : a, hx = at[0], hy = at[1];
    const hz = down ? 0.18 : o.head ? 1.55 : R.f(0.95, 1.4);
    const n = Math.max(1, Math.round((3 + dmg * 6) * n0)), sz = U.clamp(0.4 + dmg * 0.18, 0.4, 1.1);
    const ca = Math.cos(A), sa = Math.sin(A);
    if (kind === 'blunt' || kind === 'car') {
      this.burst(hx, hy, hz, n, A, kind === 'car' ? 0.7 : 1.3, 0.5, kind === 'car' ? 4 : 2.4, 0.4, 2.2);
      this.dec('splat', hx + ca * 0.3, hy + sa * 0.3, A, sz);
    } else if (kind === 'blade' || kind === 'chop') {
      // a spurt out of the cut, thrown on with the blade
      this.burst(hx, hy, hz, n + 2, A + R.f(-0.4, 0.4), 0.45, 1.4, 3.8, 0.2, 1.8);
      this.dec('streak', hx + ca * 0.55, hy + sa * 0.55, A + R.f(-0.3, 0.3), sz * 1.2);
    } else if (kind === 'stab') {
      this.burst(hx, hy, hz, Math.ceil(n * 0.5), A, 0.5, 0.6, 1.8, 0.2, 1.2);
      this.dec('drops', hx + ca * 0.2, hy + sa * 0.2, A, sz * 0.8);
    } else if (kind === 'gun' || kind === 'shotgun') {
      // the exit spray goes on behind, with a puff of mist where it went through
      const big = kind === 'shotgun' ? 1.6 : 1;
      this.burst(hx, hy, hz, Math.round(n * big), A, 0.25 * big, 2.5, 6, -0.3, 1.2);
      this.mist(hx, hy, hz, A, Math.max(1, Math.round(2 * big * n0)));
      const L = R.f(0.8, 1.6);
      if (!World.firstEdgeHit(hx, hy, hx + ca * L, hy + sa * L)) this.dec('streak', hx + ca * L, hy + sa * L, A, sz * 1.3 * big);
      else this.dec('splat', hx + ca * 0.4, hy + sa * 0.4, A, sz);
    } else if (kind === 'stomp') {
      this.burst(hx, hy, 0.12, n, A, Math.PI, 0.4, 1.8, 0.3, 1.4);
      this.dec('splat', hx, hy, R.f(0, 6.28), sz * 1.2);
    } else if (kind === 'bite') this.burst(hx, hy, hz, Math.ceil(n * 0.6), A, 0.8, 0.5, 1.5, 0.2, 1.4);
    // a wound where it went in: on the side facing the blow
    if (!z.dead && z.look && z.look.zombie && R.chance(0.6)) {
      const g = this.st(z), rel = U.angDiff(z.a, A + Math.PI);
      g.w.push([o.head ? 'head' : R.chance(0.6) ? 'chest' : 'belly', Math.round(R.f(0.25, 0.85) * 100) / 100, Math.round(rel * 100) / 100, Math.round(R.f(0.025, 0.05) * (kind === 'stab' ? 0.7 : 1) * 1000) / 1000, kind === 'blade' || kind === 'chop' ? 1 : 0]);
      if (g.w.length > 6) g.w.shift();
      this.touch(z);
    }
    // limbs can come off before it dies (heavy blades; a shotgun up close)
    const c = this.cut();
    if (c && !z.dead) {
      const close = U.dist(G.player.x, G.player.y, z.x, z.y) < 2.6;
      const ch = kind === 'chop' || kind === 'blade' ? U.clamp((dmg - 1.1) * 0.22, 0, 0.3) : kind === 'shotgun' && close ? 0.12 : kind === 'car' ? U.clamp(dmg * 0.08, 0, 0.25) : 0;
      if (ch && R.chance(ch * c)) this.sever(z, this.pickLimb(z, down), A);
    }
  },
  // which part comes off: arms mostly; legs when it is on the ground (or one in four times)
  pickLimb(z, down) {
    const g = this.st(z), m = g.m, legs = down || R.chance(0.25);
    const opts = legs ? [[GM.SHIN_L, GM.LEG_L], [GM.SHIN_R, GM.LEG_R]] : [[GM.FARM_L, GM.ARM_L], [GM.FARM_R, GM.ARM_R]];
    const side = R.pick(opts), whole = R.chance(0.35);
    let bit = whole ? side[1] : side[0];
    if (m & side[1]) return 0;
    if (m & bit) bit = side[1];
    return bit;
  },
  kill(z, a, o) {
    const n0 = this.amt();
    if (!n0) return;
    const kind = o.kind || 'blunt', A = a === undefined ? R.f(0, Math.PI * 2) : a, dmg = o.dmg || 1;
    this.burst(z.x, z.y, z.lie > 0.5 ? 0.2 : 1.1, Math.round(6 * n0), A, 1.2, 0.5, 2.5, 0.3, 2);
    // a pool spreads under where the body comes to rest
    const ca = Math.cos(z.a), sa = Math.sin(z.a), off = z.crawl ? 0.3 : (z.lieDir || 1) > 0 ? -0.35 : 0.3;
    this.dec('pool', z.x + ca * off, z.y + sa * off, R.f(0, 6.28), R.f(0.85, 1.25) * (0.75 + 0.25 * this.lv()), { gd: Math.round(R.f(30, 90)) });
    const c = this.cut();
    if (!c) return;
    const g = this.st(z), head = o.head || kind === 'stomp';
    // heads: crushed by a stomp or a heavy blunt blow, burst by a gunshot to the head, taken off by a heavy blade
    if (!(g.m & GM.HEAD) && !g.cr) {
      if ((kind === 'stomp' && head) || (kind === 'blunt' && (head || z.lie > 0.5) && dmg > 1.6 && R.chance(0.55 * c))) return this.crush(z, A);
      if ((kind === 'gun' && head && R.chance(0.3 * c)) || (kind === 'shotgun' && U.dist(G.player.x, G.player.y, z.x, z.y) < 2.6 && R.chance(0.35 * c))) return this.crush(z, A);
      if ((kind === 'chop' || kind === 'blade') && dmg > 1.4 && R.chance((head ? 0.45 : 0.18) * c)) return this.sever(z, GM.HEAD, A);
    }
    if ((kind === 'chop' || kind === 'blade' || kind === 'car' || kind === 'shotgun') && R.chance(0.22 * c)) { const b = this.pickLimb(z, z.lie > 0.5); if (b) this.sever(z, b, A); }
  },
  // where the head is now (lying or standing)
  headAt(z) {
    if (z.lie > 0.5 || z.dead) { const L = Zombie.bodyLine(z); return [L[0], L[1], 0.15]; }
    return [z.x + Math.cos(z.a) * 0.05, z.y + Math.sin(z.a) * 0.05, 1.6];
  },
  crush(z, A) {
    const g = this.st(z), [x, y, h] = this.headAt(z), n0 = this.amt();
    g.cr = 1;
    this.gibs(x, y, h, Math.round(6 * n0), A);
    this.burst(x, y, h, Math.round(10 * n0), A, Math.PI, 0.4, 2, 0.2, 1.6);
    this.dec('splat', x, y, R.f(0, 6.28), 1.1); this.dec('gib', x + Math.cos(A) * 0.3, y + Math.sin(A) * 0.3, A, 0.45);
    if (!z.dead) { z.hp = 0; Zombie.kill(z, A, { noKill: false, kind: 'gore' }); }
    this.touch(z);
  },
  sever(z, bit, A) {
    if (!bit) return;
    const g = this.st(z);
    if (g.m & bit) return;
    g.m |= bit;
    // a whole limb includes its lower part
    if (bit === GM.ARM_L) g.m |= GM.FARM_L; if (bit === GM.ARM_R) g.m |= GM.FARM_R; if (bit === GM.LEG_L) g.m |= GM.SHIN_L; if (bit === GM.LEG_R) g.m |= GM.SHIN_R;
    const L = z.look || {}, head = bit === GM.HEAD, arm = bit & (GM.FARM_L | GM.FARM_R | GM.ARM_L | GM.ARM_R), whole = bit & (GM.ARM_L | GM.ARM_R | GM.LEG_L | GM.LEG_R);
    const left = bit & (GM.FARM_L | GM.ARM_L | GM.SHIN_L | GM.LEG_L) ? 1 : -1;
    const down = z.lie > 0.5 || z.crawl;
    // where it was, as it stands or lies
    let sx = z.x, sy = z.y, sh = down ? 0.2 : head ? 1.55 : arm ? 1.1 : 0.5;
    if (head) { const p = this.headAt(z); sx = p[0]; sy = p[1]; sh = p[2]; }
    else { const s = z.a + left * Math.PI / 2; sx += Math.cos(s) * 0.2; sy += Math.sin(s) * 0.2; }
    const n0 = this.amt();
    this.gibs(sx, sy, sh, Math.round(4 * n0), A);
    this.burst(sx, sy, sh, Math.round(12 * n0), A, 0.9, 0.8, 3, 0.3, 2.2);
    // the part lands a little way off along the blow, in a small pool of its own
    const d = R.f(0.5, 1.3), lx = sx + Math.cos(A) * d, ly = sy + Math.sin(A) * d;
    const ok = !World.tileSolid(Math.floor(lx), Math.floor(ly));
    const px = ok ? lx : sx, py = ok ? ly : sy;
    const skin = L.skin || '#8a9a80', sleeve = L.jacket || (L.sleeves === 'long' ? L.shirt : null), pants = L.shorts ? skin : (L.pants || skin);
    const p = head ? 'head' : arm ? (whole ? 'arm' : 'farm') : whole ? 'leg' : 'shin';
    const cloth = p === 'arm' ? (L.jacket || (L.sleeves && L.sleeves !== 'none' ? L.shirt : skin) || skin) : p === 'farm' ? (sleeve || skin) : pants;
    this.dec('pool', px, py, R.f(0, 6.28), 0.55, { gd: 40 });
    this.dec('limb', px, py, R.f(0, 6.28), 1, { p, c: [skin, cloth, L.shoes || '#2a2a2a', L.hat ? L.hat.col : (L.hair || 'none')].join('|') });
    this.touch(z);
    if (head && !z.dead) { z.hp = 0; Zombie.kill(z, A, { kind: 'gore' }); return; }
    // without a leg it goes down and crawls on
    if (!z.dead && (bit & (GM.SHIN_L | GM.SHIN_R | GM.LEG_L | GM.LEG_R))) { z.crawl = true; Zombie.knockDown(z, A, 0.6, R.f(1, 1.8), -1); }
  },

  // ---------------------------------------------------------------- trails
  // what bleeds as it moves (missing limbs, a crawl through its own blood) leaves drips and smears behind it
  trails(dt) {
    if (!this.lv() || !G.player) return;
    const p = G.player;
    for (const z of G.zombies) {
      const g = z.gore;
      if (!g || z.dead || !g.m && !(z.crawl && g.w.length)) continue;
      if (Math.abs(z.x - p.x) > 40 || Math.abs(z.y - p.y) > 40) continue;
      if (z.gx === undefined) { z.gx = z.x; z.gy = z.y; continue; }
      const dx = z.x - z.gx, dy = z.y - z.gy, d = dx * dx + dy * dy;
      if (d < (z.crawl ? 0.5 : 0.9)) continue;
      const a = Math.atan2(dy, dx);
      if (this.budget >= 1) { this.budget--; this.dec(z.crawl ? 'smear' : 'drops', z.x - dx * 0.5, z.y - dy * 0.5, a, z.crawl ? 0.7 : 0.3); }
      z.gx = z.x; z.gy = z.y;
    }
  },

  // ---------------------------------------------------------------- the player's side
  // blood on the weapon and, close up, on the player's clothes
  splash(p, it, kind, d) {
    if (!this.lv()) return;
    if (it && R.chance(kind === 'blunt' ? 0.35 : 0.5)) it.bloody = true;
    if (d < 1.3 && R.chance(0.1 * this.amt())) {
      const worn = p.inv.filter(i => i.worn && ITEMS[i.id].cat === 'Clothing' && !i.bloody);
      if (worn.length) { R.pick(worn).bloody = true; UI.refresh && UI.refresh(); }
    }
  },
};
// gore floor marks drawn through the decal pass (render.js DECAL_ART)
DECAL_ART.g = (ctx, d, X, Y) => Gore.drawDecal(ctx, d, X, Y);
