'use strict';
// ---------------------------------------------------------------------------
// Procedural 3D-skeleton humanoid renderer (projected to isometric pixels)
// ---------------------------------------------------------------------------
const WEAPON_MODELS = {
  bat: { len: 0.85, w0: 2.4, w1: 4.6, col: '#b8874e', grip: '#3a2a1a' },
  club: { len: 0.95, w0: 1.6, w1: 1.6, col: '#b0b8c0', head: 'club' },
  pipe: { len: 0.75, w0: 2.6, w1: 2.6, col: '#70787f' },
  axe: { len: 0.9, w0: 2.6, w1: 2.6, col: '#8a6a4a', head: 'axe' },
  handaxe: { len: 0.45, w0: 2.4, w1: 2.4, col: '#8a6a4a', head: 'axe' },
  knife: { len: 0.28, w0: 2.2, w1: 1.2, col: '#d8dee4', grip: '#202020', gripLen: 0.1 },
  machete: { len: 0.62, w0: 3, w1: 2.6, col: '#c8d0d8', grip: '#202020', gripLen: 0.14 },
  katana: { len: 0.95, w0: 2.4, w1: 2, col: '#e0e8f0', grip: '#202020', gripLen: 0.22 },
  pan: { len: 0.32, w0: 2.2, w1: 2.2, col: '#303438', head: 'pan' },
  hammer: { len: 0.36, w0: 2.4, w1: 2.4, col: '#7a5a3a', head: 'hammer' },
  sledge: { len: 0.95, w0: 2.8, w1: 2.8, col: '#6a4a2a', head: 'sledge' },
  shovel: { len: 1.05, w0: 2.4, w1: 2.4, col: '#7a5a3a', head: 'shovel' },
  spear: { len: 1.4, w0: 2.2, w1: 2.0, col: '#b08850', head: 'spear' },
  plank: { len: 1.0, w0: 5, w1: 5, col: '#c8a06a' },
  pistol: { len: 0.2, w0: 3, w1: 3, col: '#25282a', gun: true },
  shotgun: { len: 0.95, w0: 3.4, w1: 2.6, col: '#2a2d30', gun: true, stock: '#7a5030' },
  rifle: { len: 1.0, w0: 3.2, w1: 2.4, col: '#2a2d30', gun: true, stock: '#6a4a2a' },
  flashlight: { len: 0.2, w0: 3, w1: 3.6, col: '#2a2a30' },
  generic: { len: 0.3, w0: 3, w1: 3, col: '#888' },
};

const Humanoid = {
  // pose: see Player/Zombie code. look: colours etc.
  draw(ctx, px, py, ang, look, pose, shade, alpha) {
    const sh = (c) => Col.shade(c, shade);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lie = pose.lie || 0;
    const lt = lie * (Math.PI / 2) * (pose.lieDir || 1);
    const lc = Math.cos(lt), ls = Math.sin(lt);
    const lieOff = pose.lieOff || 0;
    // local -> projected
    const pr = (f, s, z) => {
      if (lie) { const f2 = f * lc - z * ls, z2 = f * ls + z * lc; f = f2 + lieOff; z = z2 * (1 - lie * 0.85) + lie * 0.06 + (z2 < 0 ? 0 : 0); }
      const dx = f * ca - s * sa, dy = f * sa + s * ca;
      return [px + (dx - dy) * HTW, py + (dx + dy) * HTH - z * ZU, dx + dy];
    };
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,' + (0.28 * shade + 0.05).toFixed(2) + ')';
    if (lie > 0.5) { const c = pr(0.8, 0, 0); ctx.beginPath(); ctx.ellipse(c[0], c[1], 22, 9, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(px, py, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); }

    const cr = pose.crouch || 0;
    const hip = 0.86 - cr * 0.3;
    const lean = (pose.lean || 0) + cr * 0.12;
    const ph = pose.walk || 0, amp = pose.amp || 0;
    const t = pose.t || 0;
    const els = [];
    // ---- legs
    const pantsC = look.pants, skin = look.skin, shoes = look.shoes || '#2a2a2a';
    const legs = [];
    for (const side of [-1, 1]) {
      const p = side < 0 ? ph : ph + Math.PI;
      const ff = Math.sin(p) * 0.27 * amp + cr * 0.12;
      const fz = Math.max(0, Math.cos(p)) * 0.11 * amp;
      const H = [0, side * 0.1, hip], Ft = [ff, side * 0.11, fz + 0.04];
      const dx = Ft[0] - H[0], dz = Ft[2] - H[2];
      const d = Math.sqrt(dx * dx + dz * dz);
      const bend = Math.sqrt(Math.max(0, 0.46 * 0.46 - (d / 2) * (d / 2)));
      const K = [(H[0] + Ft[0]) / 2 + bend * 0.95, side * 0.105, (H[2] + Ft[2]) / 2];
      legs.push({ H, K, Ft, side });
    }
    for (const L of legs) {
      const h = pr(...L.H), k = pr(...L.K), f = pr(...L.Ft), toe = pr(L.Ft[0] + 0.13, L.Ft[1], L.Ft[2]);
      els.push({
        d: (h[2] + f[2]) / 2 + L.side * 0.001, fn: () => {
          seg(ctx, h, k, sh(pantsC), 6.4);
          seg(ctx, k, f, look.shorts ? sh(skin) : sh(pantsC), 5.6);
          seg(ctx, f, toe, sh(shoes), 4.6);
        }
      });
    }
    // ---- torso
    const chest = [lean * 0.28, 0, hip + 0.53];
    const pelvis = [lean * 0.04, 0, hip + 0.02];
    const shL = [chest[0], -0.19, chest[2] - 0.03], shR = [chest[0], 0.19, chest[2] - 0.03];
    const headF = (pose.headF || 0) + lean * 0.1;
    const headC = [chest[0] + headF, (pose.headS || 0), chest[2] + 0.2 - (pose.headDrop || 0)];
    const torsoC = look.jacket || look.shirt;
    const pC = pr(...pelvis), cC = pr(...chest), sLp = pr(...shL), sRp = pr(...shR);
    els.push({
      d: (pC[2] + cC[2]) / 2, fn: () => {
        seg(ctx, pC, cC, sh(torsoC), 11.5);
        seg(ctx, sLp, sRp, sh(torsoC), 7);
        if (look.vest) seg(ctx, pr(chest[0] + 0.02, 0, chest[2] - 0.08), pr(pelvis[0] + 0.02, 0, pelvis[2] + 0.1), sh(look.vest), 10);
        if (look.blood) {
          ctx.fillStyle = sh('#5a0a0a');
          const b1 = pr(chest[0] + 0.05, 0.05, chest[2] - 0.15), b2 = pr(chest[0] + 0.04, -0.06, chest[2] - 0.32);
          ctx.beginPath(); ctx.arc(b1[0], b1[1], 2.6 * look.blood + 1, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(b2[0], b2[1], 2 * look.blood + 0.5, 0, 7); ctx.fill();
        }
        // belt line
        seg(ctx, pr(pelvis[0], -0.12, pelvis[2] + 0.04), pr(pelvis[0], 0.12, pelvis[2] + 0.04), sh(pantsC), 4);
      }
    });
    // backpack
    if (look.bag) {
      const bp = pr(chest[0] - 0.17, 0, chest[2] - 0.2);
      els.push({ d: bp[2] - 0.05, fn: () => { ctx.fillStyle = sh(look.bag); ctx.strokeStyle = sh('#1a1a1a'); ctx.lineWidth = 1; roundRect(ctx, bp[0] - 5.5, bp[1] - 8, 11, 14, 3); ctx.fill(); ctx.stroke(); } });
    }
    // ---- arms
    const arms = this.armPose(pose, shL, shR, chest, ph, amp, t);
    const sleeveLong = look.jacket || look.sleeves === 'long';
    const upperC = look.sleeves === 'none' && !look.jacket ? skin : torsoC;
    for (const A of arms) {
      const s0 = pr(...A.S), e = pr(...A.E), h = pr(...A.Hd);
      els.push({
        d: (s0[2] + h[2]) / 2 + (A.side > 0 ? 0.002 : 0), fn: () => {
          seg(ctx, s0, e, sh(upperC), 5.2);
          seg(ctx, e, h, sh(sleeveLong ? torsoC : skin), 4.6);
          ctx.fillStyle = sh(look.gloves || skin); ctx.beginPath(); ctx.arc(h[0], h[1], 2.4, 0, 7); ctx.fill();
        }
      });
    }
    // ---- weapon in right hand
    if (pose.weapon) {
      const W = WEAPON_MODELS[pose.weapon] || WEAPON_MODELS.generic;
      const hR = arms.find(a => a.side > 0).Hd;
      const wd = arms.wdir || [0.3, 0.05, -0.85];
      const tip = [hR[0] + wd[0] * W.len, hR[1] + wd[1] * W.len, hR[2] + wd[2] * W.len];
      const back = W.gun && W.stock ? [hR[0] - wd[0] * 0.28, hR[1] - wd[1] * 0.28, hR[2] - wd[2] * 0.28] : (W.gripLen ? [hR[0] - wd[0] * W.gripLen, hR[1] - wd[1] * W.gripLen, hR[2] - wd[2] * W.gripLen] : [hR[0] - wd[0] * 0.08, hR[1] - wd[1] * 0.08, hR[2] - wd[2] * 0.08]);
      const a = pr(...back), hh = pr(...hR), b = pr(...tip);
      els.push({
        d: Math.max(hh[2], b[2]) + 0.01, fn: () => {
          if (W.stock) seg(ctx, a, hh, sh(W.stock), 3.6);
          else if (W.grip) seg(ctx, a, hh, sh(W.grip), 2.6);
          else seg(ctx, a, hh, sh(W.col), W.w0);
          taper(ctx, hh, b, sh(W.col), W.w0, W.w1);
          if (W.head) this.weaponHead(ctx, W.head, hR, wd, tip, pr, sh);
          if (pose.flash) { ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.beginPath(); ctx.arc(b[0], b[1], 5 + Math.random() * 3, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,220,1)'; ctx.beginPath(); ctx.arc(b[0], b[1], 2.5, 0, 7); ctx.fill(); }
        }
      });
    }
    if (pose.offhand) {
      const hL = arms.find(a => a.side < 0).Hd;
      const od = [0.95, -0.05, -0.1];
      const a = pr(...hL), b = pr(hL[0] + od[0] * 0.2, hL[1] + od[1] * 0.2, hL[2] + od[2] * 0.2);
      els.push({ d: a[2] + 0.01, fn: () => { taper(ctx, a, b, sh(pose.offhand === 'flashlight' ? '#2a2a30' : '#888'), 3, 3.8); if (pose.light) { ctx.fillStyle = 'rgba(255,250,210,0.9)'; ctx.beginPath(); ctx.arc(b[0], b[1], 1.8, 0, 7); ctx.fill(); } } });
    }
    // ---- head
    const hc = pr(...headC);
    const fwdDepth = ca + sa; // >0 facing camera
    els.push({ d: hc[2] + 0.003, fn: () => this.head(ctx, hc, look, pose, pr, headC, sh, fwdDepth, lie) });
    els.sort((a, b) => a.d - b.d);
    for (const e of els) e.fn();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
  },
  armPose(pose, shL, shR, chest, ph, amp, t) {
    const arms = [];
    const mk = (side, S, Hd, bendOut) => {
      const mid = [(S[0] + Hd[0]) / 2, (S[1] + Hd[1]) / 2, (S[2] + Hd[2]) / 2];
      const dx = Hd[0] - S[0], dy = Hd[1] - S[1], dz = Hd[2] - S[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const bend = Math.sqrt(Math.max(0, 0.3 * 0.3 - (d / 2) * (d / 2)));
      const E = [mid[0] - bend * 0.5, mid[1] + side * bend * (bendOut || 0.6), mid[2] - bend * 0.4];
      arms.push({ side, S, E, Hd });
    };
    const mode = pose.arms || 'idle';
    if (mode === 'zombie') {
      for (const side of [-1, 1]) {
        const S = side < 0 ? shL : shR;
        const sway = Math.sin(t * 2.2 + side) * 0.05;
        mk(side, S, [S[0] + 0.5 + (pose.reach || 0) * 0.15, S[1] * 0.75, S[2] - 0.06 + sway + (pose.reach || 0) * 0.05]);
      }
    } else if (mode === 'aim') {
      const big = pose.weapon === 'shotgun' || pose.weapon === 'rifle';
      const rh = big ? [shR[0] + 0.2, 0.08, shR[2] - 0.05] : [shR[0] + 0.48, 0.02, shR[2] - 0.02];
      mk(1, shR, rh);
      mk(-1, shL, big ? [rh[0] + 0.32, 0.0, rh[2] + 0.02] : [rh[0] - 0.02, -0.01, rh[2] - 0.03]);
      arms.wdir = [1, -0.04, 0.0];
    } else if (mode === 'swing') {
      const st = pose.swingT || 0;
      // yaw (phi) and pitch (psi) of the weapon over swing
      let phi, psi, rk;
      if (st < 0.38) { const k = U.smooth(st / 0.38); phi = U.lerp(0.5, 2.0, k); psi = U.lerp(-0.6, 0.9, k); rk = k; }
      else if (st < 0.62) { const k = U.smooth((st - 0.38) / 0.24); phi = U.lerp(2.0, -0.7, k); psi = U.lerp(0.9, -0.25, k); rk = 1 - k * 0.3; }
      else { const k = U.smooth((st - 0.62) / 0.38); phi = U.lerp(-0.7, 0.5, k); psi = U.lerp(-0.25, -0.6, k); rk = 0.7 * (1 - k); }
      if (pose.stab) { phi = U.lerp(0.2, 0, st); psi = -0.1; }
      const r = 0.36;
      const hR = [chest[0] + Math.cos(phi * 0.55) * r * (pose.stab ? 1 + Math.sin(st * Math.PI) * 0.5 : 1), Math.sin(phi * 0.55) * r * 0.9, chest[2] - 0.18 + rk * 0.25];
      mk(1, shR, hR);
      const wd = [Math.cos(phi) * Math.cos(psi), Math.sin(phi) * Math.cos(psi), Math.sin(psi)];
      arms.wdir = wd;
      if (pose.two) mk(-1, shL, [hR[0] - wd[0] * 0.14, hR[1] - wd[1] * 0.14 - 0.03, hR[2] - wd[2] * 0.14]);
      else mk(-1, shL, [shL[0] + 0.05, shL[1] - 0.06, shL[2] - 0.5]);
    } else if (mode === 'shove') {
      const k = Math.sin(Math.min(1, pose.swingT || 0) * Math.PI);
      mk(-1, shL, [shL[0] + 0.2 + k * 0.35, shL[1] * 0.6, shL[2] - 0.05]);
      mk(1, shR, [shR[0] + 0.2 + k * 0.35, shR[1] * 0.6, shR[2] - 0.05]);
      arms.wdir = [0.3, 0.1, -0.85];
    } else if (mode === 'eat') {
      mk(1, shR, [chest[0] + 0.2, 0.04, chest[2] + 0.12 + Math.sin(t * 6) * 0.02]);
      mk(-1, shL, [shL[0] + 0.15, shL[1] * 0.6, shL[2] - 0.35]);
    } else if (mode === 'work') {
      const o = Math.sin(t * 8) * 0.06;
      mk(1, shR, [shR[0] + 0.38, shR[1] * 0.5, shR[2] - 0.38 + o]);
      mk(-1, shL, [shL[0] + 0.38, shL[1] * 0.5, shL[2] - 0.38 - o]);
      arms.wdir = [0.6, 0, -0.7];
    } else if (mode === 'hammer') {
      const o = Math.abs(Math.sin(t * 7));
      mk(1, shR, [shR[0] + 0.3, shR[1] * 0.4, shR[2] - 0.1 + o * 0.25]);
      mk(-1, shL, [shL[0] + 0.38, shL[1] * 0.4, shL[2] - 0.2]);
      arms.wdir = [0.7, 0, 0.7 - o * 1.2];
    } else if (mode === 'drive') {
      mk(1, shR, [shR[0] + 0.4, 0.08, shR[2] - 0.25]);
      mk(-1, shL, [shL[0] + 0.4, -0.08, shL[2] - 0.25]);
    } else if (mode === 'climb') {
      mk(1, shR, [shR[0] + 0.25, shR[1], shR[2] + 0.35]);
      mk(-1, shL, [shL[0] + 0.25, shL[1], shL[2] + 0.35]);
    } else {
      // idle / walking with arm swing
      for (const side of [-1, 1]) {
        const S = side < 0 ? shL : shR;
        const p = side < 0 ? ph + Math.PI : ph;
        const sw = Math.sin(p) * 0.22 * amp;
        mk(side, S, [S[0] + sw + (pose.weapon && side > 0 ? 0.12 : 0), S[1] + side * 0.04, S[2] - 0.52 + Math.abs(sw) * 0.15 + (pose.weapon && side > 0 ? 0.08 : 0)], 0.3);
      }
      if (pose.weapon) {
        const W = WEAPON_MODELS[pose.weapon];
        if (W && W.gun) arms.wdir = [0.6, 0.05, -0.75];
        else arms.wdir = [0.35 + Math.sin(ph) * 0.15 * amp, 0.1, -0.85];
      }
    }
    if (mode === 'zombie' || mode === 'idle' || mode === 'eat' || mode === 'climb' || mode === 'drive') {
      if (!arms.wdir) arms.wdir = [0.35, 0.1, -0.85];
    }
    return arms;
  },
  weaponHead(ctx, kind, hR, wd, tip, pr, sh) {
    const side = [-wd[1], wd[0], 0];
    const sl = Math.sqrt(side[0] * side[0] + side[1] * side[1]) || 1;
    side[0] /= sl; side[1] /= sl;
    const up = [wd[1] * side[2] - wd[2] * side[1], wd[2] * side[0] - wd[0] * side[2], wd[0] * side[1] - wd[1] * side[0]];
    const at = (k, a, b) => pr(hR[0] + wd[0] * k + up[0] * a + side[0] * b, hR[1] + wd[1] * k + up[1] * a + side[1] * b, hR[2] + wd[2] * k + up[2] * a + side[2] * b);
    const L = U.dist(hR[0], hR[1], tip[0], tip[1]) + Math.abs(tip[2] - hR[2]) * 0.5;
    const len = Math.sqrt((tip[0] - hR[0]) ** 2 + (tip[1] - hR[1]) ** 2 + (tip[2] - hR[2]) ** 2);
    void L;
    ctx.lineJoin = 'round';
    if (kind === 'axe') poly(ctx, [at(len - 0.05, 0.02, 0), at(len - 0.2, 0.02, 0), at(len - 0.22, 0.2, 0), at(len + 0.02, 0.2, 0)], sh('#9aa2aa'), sh('#5a6268'), 1);
    else if (kind === 'hammer') seg(ctx, at(len, -0.07, 0), at(len, 0.09, 0), sh('#707880'), 4);
    else if (kind === 'sledge') seg(ctx, at(len, -0.12, 0), at(len, 0.12, 0), sh('#606870'), 7);
    else if (kind === 'pan') { const c = at(len + 0.1, 0, 0); ctx.fillStyle = sh('#303438'); ctx.beginPath(); ctx.ellipse(c[0], c[1], 7, 4, 0, 0, 7); ctx.fill(); }
    else if (kind === 'shovel') poly(ctx, [at(len - 0.05, 0, -0.08), at(len - 0.05, 0, 0.08), at(len + 0.22, 0, 0.07), at(len + 0.28, 0, 0), at(len + 0.22, 0, -0.07)], sh('#80888f'));
    else if (kind === 'spear') poly(ctx, [at(len, 0, -0.03), at(len + 0.16, 0, 0), at(len, 0, 0.03)], sh('#c8ccd0'));
    else if (kind === 'club') seg(ctx, at(len, 0, 0), at(len - 0.02, -0.06, 0.04), sh('#a0a8b0'), 4);
  },
  head(ctx, hc, look, pose, pr, headC, sh, fwdDepth, lie) {
    const r = 4.9;
    const hairC = look.hair;
    const hs = look.hairStyle || 'short';
    // neck
    // long hair behind head
    if ((hs === 'long' || hs === 'ponytail') && hairC && !look.hat) {
      const back = pr(headC[0] - 0.08, headC[1], headC[2] - 0.12);
      if (fwdDepth > 0) seg(ctx, hc, back, sh(hairC), hs === 'long' ? 9 : 5);
    }
    ctx.fillStyle = sh(look.skin);
    ctx.beginPath(); ctx.arc(hc[0], hc[1], r, 0, Math.PI * 2); ctx.fill();
    if (look.zombie) { ctx.fillStyle = 'rgba(40,60,30,0.18)'; ctx.beginPath(); ctx.arc(hc[0], hc[1], r, 0, Math.PI * 2); ctx.fill(); }
    // face features toward the camera
    if (fwdDepth > -0.25 && lie < 0.6) {
      const e1 = pr(headC[0] + 0.12, headC[1] - 0.045, headC[2] + 0.02), e2 = pr(headC[0] + 0.12, headC[1] + 0.045, headC[2] + 0.02);
      ctx.fillStyle = look.zombie ? sh('#3a0a0a') : sh('#1a1410');
      ctx.fillRect(e1[0] - 0.7, e1[1] - 0.7, 1.5, 1.5); ctx.fillRect(e2[0] - 0.7, e2[1] - 0.7, 1.5, 1.5);
      if (look.zombie) { const m = pr(headC[0] + 0.13, headC[1], headC[2] - 0.06); ctx.fillStyle = sh('#2a0505'); ctx.fillRect(m[0] - 1.2, m[1] - 0.5, 2.4, 1.5); }
      if (look.glasses) { ctx.strokeStyle = sh('#202020'); ctx.lineWidth = 0.8; ctx.strokeRect(e1[0] - 1.4, e1[1] - 1.2, 2.8, 2.4); ctx.strokeRect(e2[0] - 1.4, e2[1] - 1.2, 2.8, 2.4); }
    }
    // hair
    if (hairC && hs !== 'bald' && !(look.hat && look.hat.type === 'fullhelmet')) {
      const hb = pr(headC[0] - 0.05, headC[1], headC[2] + 0.035);
      ctx.fillStyle = sh(hairC);
      if (hs === 'buzz') ctx.globalAlpha *= 0.75;
      ctx.beginPath();
      if (fwdDepth < -0.2) ctx.arc(hb[0], hb[1], r * 0.98, 0, Math.PI * 2);
      else ctx.arc(hb[0], hb[1] - 0.6, r * 0.96, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      if (hs === 'buzz') ctx.globalAlpha /= 0.75;
      if (hs === 'messy') { ctx.fillRect(hb[0] - 3, hb[1] - r - 1, 2, 2); ctx.fillRect(hb[0] + 1, hb[1] - r - 1.5, 2, 2); }
      if (hs === 'ponytail' && fwdDepth <= 0) { const pt = pr(headC[0] - 0.14, headC[1], headC[2] - 0.05); ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.6, 0, 7); ctx.fill(); }
    }
    if (look.hat) {
      const hcol = sh(look.hat.col);
      const top = pr(headC[0] - 0.01, headC[1], headC[2] + 0.06);
      ctx.fillStyle = hcol;
      if (look.hat.type === 'fullhelmet') {
        ctx.beginPath(); ctx.arc(hc[0], hc[1] - 0.5, r + 1.4, 0, Math.PI * 2); ctx.fill();
        if (fwdDepth > -0.2) { const v = pr(headC[0] + 0.12, headC[1], headC[2] + 0.01); ctx.fillStyle = sh('#20262c'); ctx.beginPath(); ctx.ellipse(v[0], v[1], 3.6, 2, 0, 0, 7); ctx.fill(); }
      } else if (look.hat.type === 'helmet') {
        ctx.beginPath(); ctx.arc(top[0], top[1], r + 1.2, Math.PI, Math.PI * 2); ctx.fill();
        seg(ctx, [top[0] - r - 2, top[1]], [top[0] + r + 2, top[1]], hcol, 2);
      } else if (look.hat.type === 'beanie') {
        ctx.beginPath(); ctx.arc(top[0], top[1] - 0.5, r + 0.4, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(top[0], top[1], r + 0.2, Math.PI, Math.PI * 2); ctx.fill();
        const brim = pr(headC[0] + 0.15, headC[1], headC[2] + 0.06);
        seg(ctx, top, brim, hcol, 3);
      }
    }
  },
};
function seg(ctx, a, b, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}
function taper(ctx, a, b, col, w0, w1) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / l, ny = dx / l;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2); ctx.lineTo(b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
  ctx.lineTo(b[0] - nx * w1 / 2, b[1] - ny * w1 / 2); ctx.lineTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(b[0], b[1], w1 / 2, 0, 7); ctx.fill();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
