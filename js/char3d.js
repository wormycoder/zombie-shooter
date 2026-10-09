'use strict';
// ---------------------------------------------------------------------------
// 3D characters: simple box-built survivors and zombies with a small skeleton, animated from the
// same pose objects the 2D Humanoid painter uses, rendered by GL3D into an atlas each frame and
// blitted in painter's order. Falls back to the 2D painter without WebGL or when switched off.
// Local frame: f forward, s right, z up (character units, 1 = one tile).
// ---------------------------------------------------------------------------
const Char3D = {
  map: new Map(), cols: new Map(),
  on() { return Settings.v.chars3d && !this.off && GL3D.ok(); },
  rgb(hex) {
    let c = this.cols.get(hex);
    if (c) return c;
    let h = String(hex || '#888').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h.slice(0, 6), 16) || 0x888888;
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    // gentle gamma lift: flat colours read darker as 3D faces
    c = c.map(v => Math.min(1, Math.pow(v, 0.92) * 1.04));
    this.cols.set(hex, c);
    return c;
  },
  mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },
  // ---- per frame: collect, pose and queue every character that may be drawn
  prepare(minX, minY, maxX, maxY) {
    this.map.clear();
    if (!this.on()) return;
    const z0 = Render.cam.zoom * Render.dpr;
    GL3D.begin(Math.min(3, Math.max(0.5, z0)));
    const p = G.player;
    try {
      if (p && !p.inCar && (!p.dead || G.corpse) && p.look) {
        const d = Player.drawInfo();
        if (d) this.queue(p, d.ang, Player.look(), Player.pose(), d.s, p.hurtFlash > 0 ? Math.min(0.6, p.hurtFlash) : 0);
      }
      for (const z of G.zombies) {
        const vx = vxOf(z.x);
        if (vx < minX - 3 || vx > maxX + 3 || z.y < minY - 3 || z.y > maxY + 3) continue;
        const d = Zombie.drawInfo(z);
        if (!d) continue;
        this.queue(z, z.a, z.look, d.pose, d.s, z.stag > 0 ? 0.25 : 0);
      }
      GL3D.flush();
    } catch (e) {
      console.warn('3D characters disabled after an error', e);
      this.off = true; this.map.clear();
    }
  },
  queue(e, ang, look, pose, shade, flash) {
    const boxes = this.build(ang, look, pose, e.id === undefined ? 1 : e.id);
    const cell = this.place(boxes, Math.max(0.05, Math.min(1, shade)), flash);
    if (!cell) return;
    // ground shadow: a small disc under the feet, or a long one under a body lying on the ground
    const lie = pose.lie || 0;
    if (lie > 0.5) {
      const f = (pose.lieOff || 0) - (pose.lieDir || 1) * 0.85 * lie, ca = Math.cos(ang), sa = Math.sin(ang);
      const ux = (ca - sa) * HTW, uy = (ca + sa) * HTH;
      cell.shadow = [(ca - sa) * f * HTW, (ca + sa) * f * HTH, 0.95 * Math.hypot(ux, uy), 8, Math.atan2(uy, ux)];
    }
    this.map.set(e, cell);
  },
  // reserve an atlas cell that fits the model's projected bounds and queue its boxes
  place(boxes, light, flash) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const b of boxes) {
      const C = b[0], X = b[1], Y = b[2], Z = b[3];
      const cx = (C[0] - C[1]) * HTW, cy = (C[0] + C[1]) * HTH - C[2] * ZU;
      const ex = (Math.abs(X[0] - X[1]) + Math.abs(Y[0] - Y[1]) + Math.abs(Z[0] - Z[1])) * HTW;
      const ey = Math.abs((X[0] + X[1]) * HTH - X[2] * ZU) + Math.abs((Y[0] + Y[1]) * HTH - Y[2] * ZU) + Math.abs((Z[0] + Z[1]) * HTH - Z[2] * ZU);
      if (cx - ex < x0) x0 = cx - ex;
      if (cx + ex > x1) x1 = cx + ex;
      if (cy - ey < y0) y0 = cy - ey;
      if (cy + ey > y1) y1 = cy + ey;
    }
    if (!boxes.length) return null;
    const cell = GL3D.cell(x1 - x0 + 4, y1 - y0 + 4, 2 - x0, 2 - y0);
    if (!cell) return null;
    for (const b of boxes) GL3D.box(cell, b[0], b[1], b[2], b[3], b[4], light, flash);
    return cell;
  },
  // blit a prepared character; false when it was not prepared (caller falls back to 2D)
  draw(ctx, e, X, Y, shade, alpha) {
    const cell = this.map.get(e);
    if (!cell) return false;
    const fade = alpha !== undefined && alpha < 1;
    if (fade) ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.28 * shade + 0.05).toFixed(2) + ')';
    ctx.beginPath();
    const sd = cell.shadow;
    if (sd) ctx.ellipse(X + sd[0], Y + sd[1], sd[2], sd[3], sd[4], 0, Math.PI * 2); else ctx.ellipse(X, Y, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    GL3D.blit(ctx, cell, X, Y);
    if (fade) ctx.globalAlpha = 1;
    return true;
  },
  // one character drawn straight onto a 2D canvas at x, y (menu and character previews); false without 3D
  preview(g, x, y, ang, look, pose) {
    if (!this.on()) return false;
    try {
      const m = g.getTransform ? g.getTransform() : null;
      GL3D.begin(Math.min(4, Math.max(1, m ? Math.hypot(m.a, m.b) : 1)));
      const cell = this.place(this.build(ang, look, pose, 1), 1, 0);
      if (!cell) return false;
      GL3D.flush();
      g.fillStyle = 'rgba(0,0,0,0.33)'; g.beginPath(); g.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); g.fill();
      GL3D.blit(g, cell, x, y);
      return true;
    } catch (e) {
      console.warn('3D preview failed', e);
      this.off = true;
      return false;
    }
  },
  // ---- rig: rotations as 3 column vectors; R*v = c0*v.x + c1*v.y + c2*v.z
  I: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  mv(R, v) { return [R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2], R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2], R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2]]; },
  mm(A, B) { return [this.mv(A, B[0]), this.mv(A, B[1]), this.mv(A, B[2])]; },
  // pitch: +a swings a hanging limb forward; roll: +a swings it to the right; yaw about up
  pitch(a) { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; },
  roll(a) { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, s], [0, -s, c]]; },
  yaw(a) { const c = Math.cos(a), s = Math.sin(a); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; },
  add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
  // the model as boxes [centre, half-axis X, Y, Z, colour] relative to the feet, in world units
  build(ang, look, pose, id) {
    const T = this, rng = (k) => { const x = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    const fem = !!look.female, zomb = !!look.zombie;
    const bw = 0.9 + rng(1) * 0.25 + (look.jacket ? 0.06 : 0);   // build
    const H = fem ? 0.95 : 1;
    const t = pose.t || 0, ph = pose.walk || 0, amp = Math.min(1.3, pose.amp || 0), cr = pose.crouch || 0;
    const limp = pose.limp || 0, limpS = pose.limpSide || 1;
    const lean = (pose.lean || 0) + cr * 0.22;
    // ---- legs
    const bob = amp * 0.025 * Math.abs(Math.cos(ph));
    const hip = (0.86 - cr * 0.3) * H - bob - limp * 0.04 * amp * Math.max(0, Math.sin(ph + (limpS > 0 ? Math.PI : 0)));
    const boxes = [];
    let skin = this.rgb(look.skin);
    if (zomb) skin = this.mix(skin, [0.157, 0.235, 0.118], 0.18);   // the 2D painter's grey-green wash
    const shoes = this.rgb(look.shoes || '#2a2a2a');
    let pants = this.rgb(look.pants), shirt = this.rgb(look.jacket || look.shirt);
    const blood = Math.min(1, look.blood || 0);
    if (blood > 0) { shirt = this.mix(shirt, [0.32, 0.03, 0.03], blood * 0.1); pants = this.mix(pants, [0.3, 0.03, 0.03], blood * 0.06); }
    const sleeveCol = look.jacket || look.sleeves === 'long' ? shirt : skin, upperCol = look.sleeves === 'none' && !look.jacket ? skin : shirt;
    // box helper in rig space: centre c, rotation R, half sizes hx (f), hy (s), hz (z)
    const B = (R, c, hx, hy, hz, col) => boxes.push([c, T.mv(R, [hx, 0, 0]), T.mv(R, [0, hy, 0]), T.mv(R, [0, 0, hz]), col]);
    const seg = (R0, top, len, w, d, col) => { const c = T.add(top, T.mv(R0, [0, 0, -len / 2])); B(R0, c, d, w, len / 2, col); return T.add(top, T.mv(R0, [0, 0, -len])); };
    const thighL = 0.42 * H, shinL = 0.42 * H;
    const crawl = (pose.lie || 0) > 0.5 && (pose.lieDir || 1) < 0;
    for (const side of [-1, 1]) {
      const p = side < 0 ? ph : ph + Math.PI, la = limp && side === limpS ? 1 - limp * 0.6 : 1;
      let sw = Math.sin(p) * 0.55 * amp * la + cr * 0.95;
      let knee = Math.max(0, Math.sin(p + Math.PI / 2)) * 0.9 * amp * la + cr * 1.7;
      // face down and dragging: legs trail, knees push off in turn
      if (crawl) { sw = -0.05; knee = 0.15 + Math.max(0, Math.sin(p)) * 0.6 * Math.min(1, amp + 0.15); }
      const R1 = T.pitch(sw), top = [0, side * 0.1 * bw, hip];
      const kneeP = seg(R1, top, thighL, 0.075 * bw, 0.085 * bw, pants);
      const R2 = T.mm(R1, T.pitch(-knee));
      const ank = seg(R2, kneeP, shinL, 0.06 * bw, 0.07, look.shorts ? skin : pants);
      const R3 = T.mm(R2, T.pitch(knee - sw));   // foot stays level-ish
      B(R3, T.add(ank, T.mv(R3, [0.06, 0, -0.035])), 0.13, 0.055, 0.04, shoes);
    }
    // ---- body
    const Rb = T.pitch(lean);
    const pel = [0, 0, hip];
    B(Rb, T.add(pel, T.mv(Rb, [0, 0, 0.05])), 0.1 * bw, (fem ? 0.16 : 0.15) * bw, 0.08, pants);
    const chestTop = T.add(pel, T.mv(Rb, [0, 0, 0.56 * H]));
    const torsoC = T.add(pel, T.mv(Rb, [0, 0, 0.31 * H]));
    B(Rb, torsoC, 0.105 * bw * (look.jacket ? 1.12 : 1), (fem ? 0.155 : 0.175) * bw, 0.25 * H, shirt);
    if (look.vest) B(Rb, T.add(torsoC, T.mv(Rb, [0.012, 0, 0.02])), 0.115 * bw, 0.168 * bw, 0.2 * H, this.rgb(look.vest));
    if (look.bag) B(Rb, T.add(torsoC, T.mv(Rb, [-0.17 * bw, 0, 0.04])), 0.07, 0.13, 0.17, this.rgb(look.bag));
    if (blood > 0) {
      // stains on the chest, where the 2D painter puts them
      const fr = 0.105 * bw * (look.jacket ? 1.12 : 1) + (look.vest ? 0.016 : 0) + 0.004, bc = [0.36, 0.04, 0.04];
      B(Rb, T.add(torsoC, T.mv(Rb, [fr, 0.05, 0.07])), 0.004, 0.025 + 0.035 * blood, 0.025 + 0.03 * blood, bc);
      B(Rb, T.add(torsoC, T.mv(Rb, [fr, -0.06, -0.1])), 0.004, 0.015 + 0.03 * blood, 0.02 + 0.025 * blood, bc);
    }
    // ---- head
    const headF = (pose.headF || 0) + lean * 0.12, headS = pose.headS || 0;
    const Rh = T.mm(Rb, T.mm(T.pitch(-headF * 1.5), T.roll(headS * 3)));
    const neck = T.add(chestTop, T.mv(Rb, [0, 0, 0.04]));
    B(Rb, neck, 0.045, 0.045, 0.045, skin);
    const hc = T.add(neck, T.mv(Rh, [0.01, 0, 0.14 - (pose.headDrop || 0)]));
    B(Rh, hc, 0.1, 0.09, 0.11, skin);
    // face: eyes (dark, red-ringed for the dead)
    const eye = zomb ? [0.25, 0.04, 0.04] : [0.08, 0.06, 0.05];
    for (const sd of [-0.04, 0.04]) B(Rh, T.add(hc, T.mv(Rh, [0.1, sd, 0.02])), 0.006, 0.016, 0.012, eye);
    if (zomb) B(Rh, T.add(hc, T.mv(Rh, [0.1, 0, -0.05])), 0.006, 0.03, 0.01, [0.2, 0.02, 0.02]);
    const hs = look.hairStyle || 'short', hair = this.rgb(look.hair || '#3a2a1a');
    const hat = look.hat;
    if (hat) {
      const hcol = this.rgb(hat.col || '#444');
      if (hat.type === 'fullhelmet') B(Rh, T.add(hc, T.mv(Rh, [0, 0, 0.01])), 0.12, 0.11, 0.13, hcol);
      else if (hat.type === 'helmet') { B(Rh, T.add(hc, T.mv(Rh, [-0.005, 0, 0.07])), 0.115, 0.105, 0.06, hcol); }
      else if (hat.type === 'beanie') B(Rh, T.add(hc, T.mv(Rh, [-0.01, 0, 0.08])), 0.105, 0.095, 0.05, hcol);
      else { B(Rh, T.add(hc, T.mv(Rh, [-0.005, 0, 0.09])), 0.105, 0.095, 0.035, hcol); B(Rh, T.add(hc, T.mv(Rh, [0.13, 0, 0.065])), 0.05, 0.08, 0.008, hcol); }
    } else if (hs !== 'bald') {
      const th = hs === 'buzz' ? 0.012 : 0.03;
      B(Rh, T.add(hc, T.mv(Rh, [-0.012, 0, 0.11 - th + 0.02])), 0.105, 0.095, th, hair);
      B(Rh, T.add(hc, T.mv(Rh, [-0.085, 0, 0.02])), 0.025, 0.093, 0.09, hair);
      if (hs === 'long') B(Rh, T.add(hc, T.mv(Rh, [-0.09, 0, -0.1])), 0.03, 0.09, 0.12, hair);
      if (hs === 'ponytail') B(Rh, T.add(hc, T.mv(Rh, [-0.14, 0, -0.03])), 0.035, 0.03, 0.08, hair);
      if (hs === 'messy') B(Rh, T.add(hc, T.mv(Rh, [0.02, 0.03, 0.14])), 0.05, 0.05, 0.025, hair);
    }
    if (look.glasses) B(Rh, T.add(hc, T.mv(Rh, [0.105, 0, 0.025])), 0.008, 0.075, 0.018, [0.08, 0.08, 0.08]);
    // ---- arms: the shared 2D arm poses give hand targets and the weapon direction; two-bone IK places the elbows
    const shY = (fem ? 0.19 : 0.21) * bw, shZ = 0.5 * H;
    const shL = T.add(pel, T.mv(Rb, [0, -shY, shZ])), shR = T.add(pel, T.mv(Rb, [0, shY, shZ]));
    const mode = pose.arms || 'idle';
    const arms = crawl && mode === 'zombie' ? this.crawlArms(shL, shR, ph, amp) : Humanoid.armPose(pose, shL, shR, T.add(pel, T.mv(Rb, [0, 0, 0.53 * H])), ph, amp, t);
    const fwd = T.mv(Rb, [1, 0, 0]), upB = T.mv(Rb, [0, 0, 1]);
    // box spanning two points; its depth axis follows the body's forward direction
    const bar = (A, Bp, w, d, col, hint) => {
      let ux = Bp[0] - A[0], uy = Bp[1] - A[1], uz = Bp[2] - A[2];
      const len = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1e-6;
      ux /= len; uy /= len; uz /= len;
      let h = hint || fwd, hd = h[0] * ux + h[1] * uy + h[2] * uz;
      if (Math.abs(hd) > 0.94) { h = upB; hd = h[0] * ux + h[1] * uy + h[2] * uz; }
      let xx = h[0] - ux * hd, xy = h[1] - uy * hd, xz = h[2] - uz * hd;
      const xl = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1;
      xx /= xl; xy /= xl; xz /= xl;
      const yx = uy * xz - uz * xy, yy = uz * xx - ux * xz, yz = ux * xy - uy * xx;
      boxes.push([[(A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2, (A[2] + Bp[2]) / 2], [xx * d, xy * d, xz * d], [yx * w, yy * w, yz * w], [ux * len / 2, uy * len / 2, uz * len / 2], col]);
    };
    const ua = 0.29 * H, fa = 0.3 * H, handC = look.gloves ? this.rgb(look.gloves) : skin;
    let hR = null, hL = null;
    for (const A of arms) {
      const side = A.side, S = side < 0 ? shL : shR;
      let Hd = A.Hd;
      // a flashlight in the off hand is held out in front while walking about
      if (side < 0 && pose.offhand === 'flashlight' && (mode === 'idle' || mode === 'work')) Hd = [S[0] + 0.4, S[1] * 0.75, S[2] - 0.26];
      else if (!crawl && (mode === 'idle' || mode === 'zombie')) {
        // hanging and reaching arms stay nearly straight (the 2D targets assume shorter arms)
        const v = [Hd[0] - S[0], Hd[1] - S[1], Hd[2] - S[2]], k = (ua + fa) * 0.96 / (Math.hypot(v[0], v[1], v[2]) || 1);
        Hd = [S[0] + v[0] * k, S[1] + v[1] * k, S[2] + v[2] * k];
      }
      const pole = crawl ? [-0.5, side * 0.8, 0] : mode === 'idle' ? [-1, side * 0.15, 0] : [-0.55, side * 0.45, -0.4];
      const [E, Hp] = this.ik(S, Hd, ua, fa, pole);
      const u = T.norm([Hp[0] - E[0], Hp[1] - E[1], Hp[2] - E[2]]);
      const wr = [Hp[0] - u[0] * 0.07, Hp[1] - u[1] * 0.07, Hp[2] - u[2] * 0.07];
      bar(S, E, 0.05 * bw, 0.055 * bw, upperCol);
      bar(E, wr, 0.043, 0.047, sleeveCol);
      bar(wr, [Hp[0] + u[0] * 0.01, Hp[1] + u[1] * 0.01, Hp[2] + u[2] * 0.01], 0.034, 0.04, handC);
      if (side > 0) hR = Hp; else hL = Hp;
    }
    // ---- weapon in the right hand, flashlight in the left
    if (pose.weapon && hR) this.weapon(boxes, pose.weapon, hR, T.norm(arms.wdir || [0.35, 0.1, -0.85]), Rb, pose.flash);
    // ---- gear on the hotbar: a long weapon slung across the back, tools on the belt, a pistol in the holster
    if (look.att) for (const [slot, model] of look.att) {
      const W = WEAPON_MODELS[model] || WEAPON_MODELS.generic;
      let hand, wd;
      if (slot === 'back') {
        // grip up behind the right shoulder, head down by the left hip
        wd = T.norm(T.mv(Rb, [0, -0.5, -0.86]));
        const c = T.add(torsoC, T.mv(Rb, [-(0.105 * bw * (look.jacket ? 1.12 : 1) + (look.bag ? 0.16 : 0) + 0.035), 0, 0.02]));
        hand = T.add(c, wd.map(v => -v * W.len * 0.5));
      } else {
        const side = slot === 'beltL' ? -1 : 1, f = slot === 'holster' ? 0.07 : slot === 'beltR' ? -0.05 : 0;
        hand = T.add(pel, T.mv(Rb, [f, side * 0.165 * bw, 0.1]));
        wd = T.norm(T.mv(Rb, [0.18, side * 0.08, -1]));
      }
      this.weapon(boxes, model, hand, wd, Rb, false);
    }
    if (pose.offhand && hL) {
      const od = T.mv(Rb, [0.95, -0.05, -0.1]), e = T.add(hL, od.map(v => v * 0.2));
      bar(hL, e, 0.04, 0.045, this.rgb(pose.offhand === 'flashlight' ? '#2a2a30' : '#888'));
      if (pose.light) bar(e, T.add(e, od.map(v => v * 0.02)), 0.035, 0.04, [1, 0.98, 0.82]);
    }
    // ---- lying (dead, asleep, crawling): tip the whole figure over about the ground
    const lie = pose.lie || 0, ld = pose.lieDir || 1;
    let Rl = this.I, off = [0, 0, 0];
    if (lie > 0) { Rl = T.pitch(ld * lie * Math.PI / 2); off = [(pose.lieOff || 0), 0, (0.12 + (look.bag && ld > 0 ? 0.12 : 0)) * lie]; }
    // ---- to world-relative coordinates
    const Ry = [[Math.cos(ang), Math.sin(ang), 0], [-Math.sin(ang), Math.cos(ang), 0], [0, 0, 1]];
    const RW = lie > 0 ? T.mm(Ry, Rl) : Ry, offW = T.mv(Ry, off);
    for (const b of boxes) { b[0] = T.add(T.mv(RW, b[0]), offW); b[1] = T.mv(RW, b[1]); b[2] = T.mv(RW, b[2]); b[3] = T.mv(RW, b[3]); }
    return boxes;
  },
  // a weapon model held at hand, pointing along wd (unit vector)
  weapon(boxes, key, hand, wd, Rb, flash) {
    const T = this, W = WEAPON_MODELS[key] || WEAPON_MODELS.generic;
    let sd = [-wd[1], wd[0], 0];
    if (Math.abs(sd[0]) + Math.abs(sd[1]) < 1e-3) sd = T.mv(Rb, [0, 1, 0]);
    sd = T.norm(sd);
    const up = [wd[1] * sd[2] - wd[2] * sd[1], wd[2] * sd[0] - wd[0] * sd[2], wd[0] * sd[1] - wd[1] * sd[0]];
    const at = (k, a, c) => [hand[0] + wd[0] * k + up[0] * a + sd[0] * c, hand[1] + wd[1] * k + up[1] * a + sd[1] * c, hand[2] + wd[2] * k + up[2] * a + sd[2] * c];
    const blade = key === 'knife' || key === 'machete' || key === 'katana';
    // a piece of the weapon from k0 to k1 along it: half width w (sideways) and h (up)
    const piece = (k0, k1, w, h, col, a) => { const c = at((k0 + k1) / 2, a || 0, 0), l = (k1 - k0) / 2; boxes.push([c, [wd[0] * l, wd[1] * l, wd[2] * l], [sd[0] * w, sd[1] * w, sd[2] * w], [up[0] * h, up[1] * h, up[2] * h], col]); };
    const k0 = W.w0 * 0.013, k1 = W.w1 * 0.013, col = this.rgb(W.col);
    const ws = (k) => W.gun ? k * 0.7 : blade ? 0.008 : k, wu = (k) => W.gun ? k * 1.25 : k;
    if (W.stock) piece(-0.28, 0.02, 0.03, 0.045, this.rgb(W.stock));
    else if (W.grip) piece(-(W.gripLen || 0.08), 0.02, 0.022, 0.022, this.rgb(W.grip));
    const g0 = W.stock || W.grip ? 0.02 : -0.08;
    if (k1 > k0 * 1.3) { const m = (g0 + W.len) / 2; piece(g0, m, ws(k0), wu(k0), col); piece(m, W.len, ws(k1), wu(k1), col); }
    else piece(g0, W.len, ws((k0 + k1) / 2), wu((k0 + k1) / 2), col);
    const L = W.len, steel = this.rgb('#9aa2aa');
    if (W.head === 'axe') piece(L - 0.21, L - 0.03, 0.012, 0.09, steel, 0.11);
    else if (W.head === 'hammer') piece(L - 0.035, L + 0.035, 0.035, 0.08, this.rgb('#707880'), 0.01);
    else if (W.head === 'sledge') piece(L - 0.06, L + 0.06, 0.06, 0.12, this.rgb('#606870'));
    else if (W.head === 'pan') piece(L, L + 0.2, 0.1, 0.016, this.rgb('#303438'));
    else if (W.head === 'shovel') piece(L - 0.05, L + 0.27, 0.08, 0.012, this.rgb('#80888f'));
    else if (W.head === 'spear') piece(L, L + 0.16, 0.025, 0.01, this.rgb('#c8ccd0'));
    else if (W.head === 'club') piece(L - 0.08, L, 0.03, 0.03, this.rgb('#a0a8b0'), -0.02);
    if (flash && W.gun) piece(L + 0.02, L + 0.14, 0.05, 0.05, [1, 0.85, 0.4]);
  },
  norm(v) { const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; },
  // two-bone IK: elbow and hand for a limb from S toward target Hd (segment lengths a, b; elbow bends toward pole)
  ik(S, Hd, a, b, pole) {
    const dx = Hd[0] - S[0], dy = Hd[1] - S[1], dz = Hd[2] - S[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const ux = dx / d, uy = dy / d, uz = dz / d;
    const dm = Math.max(Math.abs(a - b) + 0.01, Math.min(d, (a + b) * 0.999));
    const x = (a * a - b * b + dm * dm) / (2 * dm), r = Math.sqrt(Math.max(0, a * a - x * x));
    const pd = pole[0] * ux + pole[1] * uy + pole[2] * uz;
    let px = pole[0] - ux * pd, py = pole[1] - uy * pd, pz = pole[2] - uz * pd;
    const pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
    px /= pl; py /= pl; pz /= pl;
    return [[S[0] + ux * x + px * r, S[1] + uy * x + py * r, S[2] + uz * x + pz * r], [S[0] + ux * dm, S[1] + uy * dm, S[2] + uz * dm]];
  },
  // crawling face down: arms stretched ahead along the ground (up the body axis before it is tipped over), clawing in turn
  crawlArms(shL, shR, ph, amp) {
    const k = Math.min(1, amp + 0.2), out = [];
    for (const side of [-1, 1]) {
      const S = side < 0 ? shL : shR, c = Math.sin(ph + (side < 0 ? 0 : Math.PI));
      out.push({ side, Hd: [S[0] + 0.14 - Math.max(0, c) * 0.1 * k, S[1] + side * 0.05, S[2] + 0.46 + c * 0.08 * k] });
    }
    return out;
  },
};
