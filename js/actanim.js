'use strict';
// ---------------------------------------------------------------------------
// Action animations for the 3D characters: eating, drinking, smoking, reading, first aid, reloading, chopping,
// digging, fishing, sawing, looting, dressing ... plus idle fidgets, flinches, climbing, zombies pounding on doors
// and feeding. Char3D.upper / base dispatch P.arms to ACTS here.
// Wrist targets: hand() is relative to the shoulder in the chest frame (f forward, lat across the body, + right,
// absolute; z up), reachB() is a point in the body frame (x forward, y right, z height above the ground).
// Action timing: S.t runs on; P.k is how far through the action (0..1), P.at the seconds into it.
// ---------------------------------------------------------------------------
Object.assign(WEAPON_MODELS, {
  bottle: { len: 0.16, w0: 3.2, w1: 1.6, col: '#3a6a3a', prop: true },
  can: { len: 0.07, w0: 4, w1: 4, col: '#c03030', prop: true },
  carton: { len: 0.08, w0: 4.5, w1: 4.5, col: '#f0a020', prop: true },
  food: { len: 0.07, w0: 4, w1: 3, col: '#c8a060', prop: true },
  pills: { len: 0.05, w0: 3, w1: 3, col: '#f0f0f0', prop: true },
  cig: { len: 0.07, w0: 1, w1: 1, col: '#f0f0f0', prop: true },
  book: { len: 0.22, w0: 5, w1: 5, col: '#7a3a2a', prop: true },
  bandage: { len: 0.05, w0: 3.5, w1: 3.5, col: '#f0f0f0', prop: true },
  gascan: { len: 0.2, w0: 7, w1: 7, col: '#c02a20', prop: true },
  wcan: { len: 0.3, w0: 6, w1: 2, col: '#3a8a4a', prop: true },
  rod: { len: 1.6, w0: 1.4, w1: 0.6, col: '#303030', prop: true },
  saw: { len: 0.55, w0: 4, w1: 2.5, col: '#b0b8c0', grip: '#7a3a1a', gripLen: 0.08, prop: true },
});

Object.assign(Char3D, {
  AF: c3F(),
  // ---- authoring helpers
  hand(T, D, side, f, lat, z, el) { this.arm(T, side, f, side * lat - D.shW, z, el === undefined ? 0.7 : el); },
  // a wrist target in the body frame (call after the pelvis and spine are set)
  reachB(T, D, side, x, y, z, el) {
    const F = this.chestOf(T, D, this.AF), o = c3inv(c3d, F, x, y, z), i = side < 0 ? C3.LW : C3.RW;
    T[i] = o[0] + 0.012; T[i + 1] = o[1] - side * D.shW; T[i + 2] = o[2] - D.shZ; T[i + 3] = el === undefined ? 0.7 : el;
  },
  // the held item's direction given in the body frame
  wdirB(T, D, x, y, z) {
    const F = this.chestOf(T, D, this.AF), o = c3inv(c3d, F, F[0] + x, F[1] + y, F[2] + z);
    this.wdir(T, o[0], o[1], o[2]);
  },
  // fraction through a cycle of period p seconds (offset o cycles)
  cyc(t, p, o) { const c = t / p + (o || 0); return c - Math.floor(c); },
  // 0 before a, easing up to 1 over r, held, back to 0 by b
  pulse(c, a, b, r) { return U.smooth(U.clamp((c - a) / r, 0, 1)) * (1 - U.smooth(U.clamp((c - b + r) / r, 0, 1))); },
  // eased 0..1 from a to b
  ease(c, a, b) { return U.smooth(U.clamp((c - a) / (b - a), 0, 1)); },
  // keyframe rows [t, v...] (built once per name), sampled at c into a scratch row
  kf(name, rows, c) {
    const K = this.keys('a_' + name, () => ({ ch: rows[0].slice(1).map((_, i) => i), t: rows.map(r => r[0]), v: rows.flatMap(r => r.slice(1)) }));
    const o = this.kvRow || (this.kvRow = new Float32Array(40));
    c3track(K, c, o);
    return o;
  },
  // feet back under a pelvis that was moved (standing still only: walking keeps its own feet)
  plant(T, S, D, w) { if (S.amp < 0.3) this.stance(T, D, 0.02, -0.03, w || 0.11); },
  // a lean / squat of the whole body: pelvis down and back, hips and spine bending forward
  bend(T, S, D, down, back, hip, spine) {
    T[C3.PZ] -= down; T[C3.PX] -= back; T[C3.PP] += hip; T[C3.SP] += spine;
    this.plant(T, S, D, 0.13);
  },
  // the free left hand hanging relaxed
  rest(T, D, side) { this.hang(T, side, D, 0.02, 0.04, 0.15); },
  // wrist targets near the mouth (chest frame), and at rest in front of the chest
  MOUTH: [0.1, 0.045, 0.06],

  // ===================================================================== the actions
  ACTS: {
    // ---- hands busy in front at the waist (opening, fixing, fiddling)
    work(T, S, D) {
      const t = S.t + S.id, a = Math.sin(t * 5.1), b = Math.sin(t * 3.3 + 1.1), c = Math.sin(t * 7.7);
      this.hand(T, D, -1, 0.3 + 0.025 * b, -0.07 + 0.03 * a, -0.33 + 0.03 * c, 0.6);
      this.hand(T, D, 1, 0.32 + 0.03 * a, 0.06 + 0.025 * b, -0.31 + 0.04 * Math.sin(t * 6.3 + 2), 0.6);
      T[C3.HP] += 0.42 + 0.04 * b; T[C3.SP] += 0.1; T[C3.HW] += 0.06 * Math.sin(t * 0.7);
      this.wdir(T, 0.6, -0.25, -0.75);
    },
    // ---- crafting: the hands closer together, turning something over, the odd firm twist
    craft(T, S, D) {
      const t = S.t + S.id, c = this.cyc(t, 2.6), tw = this.pulse(c, 0.55, 0.85, 0.1);
      const a = Math.sin(t * 2.3);
      this.hand(T, D, -1, 0.28 + 0.02 * a, -0.05, -0.28 + 0.03 * Math.sin(t * 4.1), 0.65);
      this.hand(T, D, 1, 0.29 - 0.02 * a, 0.04 + 0.03 * tw, -0.27 + 0.05 * tw, 0.65);
      T[C3.HP] += 0.45; T[C3.SP] += 0.08 + 0.04 * tw; T[C3.SW] += 0.08 * tw;
      this.wdir(T, 0.4, -0.6, -0.4);
    },
    // ---- searching a container: one hand reaches in and pulls back, then the other; low (floor, crate), waist, or high
    loot(T, S, D, P) {
      const lv = P.lvl === undefined ? 1 : P.lvl, t = S.t + S.id * 0.37, H = D.H;
      if (lv === 0) this.bend(T, S, D, 0.3, 0.1, 0.55, 0.35);
      else if (lv === 1) { T[C3.SP] += 0.15; T[C3.PP] += 0.05; }
      const zIn = lv === 0 ? 0.26 : lv === 2 ? 1.68 : 0.86, zOut = lv === 0 ? 0.42 : lv === 2 ? 1.36 : 0.98;
      for (const side of [-1, 1]) {
        const u = this.cyc(t, 1.4, side > 0 ? 0 : 0.5), k = this.pulse(u, 0.0, 0.62, 0.22), j = Math.sin(t * 9 + side) * 0.02 * this.pulse(u, 0.2, 0.45, 0.06);
        this.reachB(T, D, side, U.lerp(0.3, lv === 2 ? 0.42 : 0.56, k) + j, side * U.lerp(0.2, 0.1, k), U.lerp(zOut, zIn, k) * H + j, lv === 2 ? 0.5 : 0.8);
      }
      T[C3.HP] += lv === 2 ? -0.3 : lv === 0 ? 0.35 : 0.35;
      T[C3.HW] += 0.12 * Math.sin(t * 1.1);
      this.wdir(T, 0.5, -0.2, -0.8);
    },
    // ---- eating: food raised in both hands, a bite, chewing with it lowered; a can is spooned from with the left
    eat(T, S, D, P) {
      const t = S.t + S.id * 0.5, c = this.cyc(t, 3.4), M = this.MOUTH;
      if (P.weapon === 'can') {
        const k = this.pulse(c, 0.05, 0.45, 0.15);
        this.hand(T, D, 1, 0.24, 0.03, -0.22, 0.8); this.wdir(T, 0.25, -0.45, 0.85);
        this.hand(T, D, -1, U.lerp(0.26, M[0] + 0.02, k), U.lerp(0.0, -M[1], k), U.lerp(-0.12, M[2], k), 0.9);
        T[C3.HP] += 0.3 - k * 0.22;
        T[C3.LH] = 1;
      } else {
        const k = this.pulse(c, 0.02, 0.5, 0.16);
        for (const side of [-1, 1]) this.hand(T, D, side, U.lerp(0.24, M[0] + 0.02, k), side * U.lerp(0.07, M[1], k), U.lerp(-0.25, M[2], k), 0.85);
        this.wdir(T, 0.1, -1, 0.15);
        T[C3.HP] += 0.3 - k * 0.2;
      }
      // the bite as it arrives, then chewing
      const bite = this.pulse(c, 0.14, 0.3, 0.06), chew = c > 0.3 && c < 0.95 ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
      T[C3.JAW] = Math.max(bite * 0.9, chew * 0.35);
      T[C3.HP] += bite * 0.08;
    },
    // ---- shouting: hands cupped round the mouth, chest out, head up, the jaw open on the call (a weapon in the
    // right hand stays down at the side and only the left hand goes up)
    shout(T, S, D, P) {
      const k = P.k === undefined ? this.cyc(S.t, 1.1) : P.k, M = this.MOUTH;
      const up = this.ease(k, 0, 0.18) * (1 - this.ease(k, 0.82, 1)), call = this.pulse(k, 0.2, 0.72, 0.08);
      const armed = P.weapon && !(WEAPON_MODELS[P.weapon] || {}).prop;
      for (const side of armed ? [-1] : [-1, 1]) this.hand(T, D, side, U.lerp(0.2, M[0] + 0.05, up), side * U.lerp(0.12, M[1] + 0.035, up), U.lerp(-0.3, M[2] + 0.01, up), 0.6);
      if (armed) { this.hand(T, D, 1, 0.14, 0.06, -0.44, 0.35); this.wdir(T, 0.6, -0.1, -0.8); }
      T[C3.HP] -= 0.22 * up; T[C3.SP] -= 0.08 * up; T[C3.JAW] = call * 0.85;
    },
    // ---- fighting a zombie off (breaking its hold): turned toward where it holds you (P.foSide -1 left, 1 right,
    // 0 in front, 2 behind), with bare hands, a one-handed weapon or a two-handed one (P.foKind 0 / 1 / 2), two ways
    // each (P.foV): 1 a shove - palms, the weapon hand's forearm, the haft across the chest; 2 an elbow, a short
    // swing, a jab with the butt
    fightoff(T, S, D, P) {
      const k = P.k || 0, sd = P.foSide || 0, kind = P.foKind || 0, v = P.foV || 1, L = U.lerp;
      const wind = this.ease(k, 0, 0.28) * (1 - this.ease(k, 0.28, 0.42)), hit = this.ease(k, 0.28, 0.42) * (1 - this.ease(k, 0.72, 1));
      const tw = sd === 2 ? 1.1 : sd * 0.75;
      T[C3.SW] += tw * (wind * 0.6 + hit); T[C3.PW] += tw * 0.35 * (wind + hit);
      T[C3.SP] += 0.15 * hit - 0.1 * wind; T[C3.HP] -= 0.1 * hit; T[C3.JAW] = 0.3 * hit;
      if (kind === 0) {
        if (v === 1) { this.hand(T, D, -1, L(0.15, 0.44, hit), -0.12, L(-0.12, 0.06, hit), 0.4); this.hand(T, D, 1, L(0.15, 0.44, hit), 0.12, L(-0.12, 0.06, hit), 0.4); }
        else { this.hand(T, D, 1, L(0.12, 0.04, hit), L(0.16, 0.3, hit), L(-0.05, 0.16, hit), 1); this.hand(T, D, -1, 0.26, -0.06, 0.1, 0.8); }
      } else if (kind === 1) {
        if (v === 1) { this.hand(T, D, 1, L(0.12, 0.38, hit), 0.1, L(-0.2, 0.14, hit), 0.6); this.wdir(T, 0.1, 0.3, 1); this.hand(T, D, -1, L(0.1, 0.36, hit), -0.1, 0, 0.5); }
        else { this.hand(T, D, 1, L(-0.05, 0.4, hit), L(0.26, -0.05, hit), L(0.35, 0, hit), 0.4); this.wdir(T, L(-0.3, 1, hit), L(0.5, -0.3, hit), L(0.8, -0.1, hit)); this.hand(T, D, -1, 0.24, -0.08, 0.05, 0.8); }
      } else {
        T[C3.GR] = 1;
        if (v === 1) { this.hand(T, D, 1, L(0.15, 0.42, hit), 0.22, 0.05, 0.5); this.wdir(T, 0, -1, 0.1); T[C3.GO] = -0.44; }
        else { this.hand(T, D, 1, L(0.02, 0.36, hit), 0.06, L(-0.12, 0.1, hit), 0.5); this.wdir(T, 1, -0.1, L(-0.4, 0.1, hit)); T[C3.GO] = -0.32; }
      }
    },
    // ---- suicide (P.sub: the gun): a pistol to the temple; a rifle or shotgun kneeling, the butt down, the muzzle
    // under the chin and the hand down at the trigger. Raised slowly, held shaking, then the shot jerks the head.
    suicide(T, S, D, P) {
      const k = P.k || 0, up = this.ease(k, 0.05, 0.5), shake = (k > 0.5 && k < 0.96 ? 1 : 0) * Math.sin(S.t * 31) * 0.008, shot = this.ease(k, 0.96, 1), M = this.MOUTH;
      if (P.sub === 'pistol') {
        this.hand(T, D, 1, U.lerp(0.18, M[0] - 0.05, up), U.lerp(0.12, 0.12, up) + shake, U.lerp(-0.3, M[2] + 0.08, up) + shake, 0.9);
        this.wdir(T, U.lerp(0.9, -0.1, up), U.lerp(0.1, -1, up), U.lerp(-0.3, 0.1, up));
        this.hand(T, D, -1, 0.12, -0.12, -0.35, 0.3);
        T[C3.HR] += 0.15 * up + 0.5 * shot; T[C3.HP] += 0.1 * up;
      } else {
        // long guns: the muzzle at the chin, the right hand down the stock to the trigger, the left steadying the barrel
        const low = P.sub === 'shotgun' ? 0.08 : 0;
        this.hand(T, D, 1, U.lerp(0.2, 0.3, up), 0.06 + shake, U.lerp(-0.3, M[2] - 0.62 - low, up), 0.4);
        this.wdir(T, U.lerp(0.9, 0.15, up), 0, U.lerp(0.1, 1, up));
        T[C3.GR] = 1; T[C3.GO] = U.lerp(0.3, 0.5, up);
        T[C3.HP] -= 0.2 * up + 0.5 * shot; T[C3.SP] += 0.15 * up;
      }
    },
    // ---- dragging a body (P.sub 1-4): by a wrist, by both ankles, by the collar leaning into it, by the clothes with
    // the other arm out for balance; leaning forward into the pull
    dragc(T, S, D, P) {
      const st = P.sub || 1, w = Math.sin(S.t * 5) * 0.015;
      if (st === 1) { this.hand(T, D, 1, -0.25, 0.18, -0.45 + w, 0.2); this.hand(T, D, -1, 0.05, -0.15, -0.42, 0.2); T[C3.SP] += 0.25; }
      else if (st === 2) { this.hand(T, D, -1, -0.3, -0.15, -0.5 + w, 0.2); this.hand(T, D, 1, -0.3, 0.15, -0.5 - w, 0.2); T[C3.SP] += 0.35; }
      else if (st === 3) { this.hand(T, D, -1, -0.2, -0.12, -0.3 + w, 0.3); this.hand(T, D, 1, -0.2, 0.12, -0.3 - w, 0.3); T[C3.SP] += 0.3; T[C3.HP] += 0.1; }
      else { this.hand(T, D, -1, -0.22, -0.15, -0.25 + w, 0.3); this.hand(T, D, 1, 0.15, 0.32, -0.2, 0.4); T[C3.SP] += 0.2; }
      T[C3.GR] = 0; T[C3.LH] = 1;
    },
    // ---- heaving a body over a fence or out of a window: down to grab it, up to the chest, shoved over
    heave(T, S, D, P) {
      const k = P.k || 0, lift = this.ease(k, 0.2, 0.55), push = this.ease(k, 0.65, 0.85) * (1 - this.ease(k, 0.9, 1));
      for (const side of [-1, 1]) this.hand(T, D, side, U.lerp(0.3, 0.2, lift) + push * 0.25, side * 0.15, U.lerp(-0.55, 0.05, lift) + push * 0.2, 0.5);
      T[C3.SP] += 0.5 * (1 - lift) - 0.1 * push; T[C3.HP] -= 0.15 * push; T[C3.LH] = 1;
    },
    // ---- drinking from a bottle, can or carton: up to the mouth, tipped back with the head, gulps, down
    drink(T, S, D, P) {
      const t = S.t + S.id * 0.3, c = this.cyc(t, 4.4), M = this.MOUTH;
      const up = this.pulse(c, 0.02, 0.72, 0.16), tip = this.pulse(c, 0.14, 0.66, 0.12), gulp = tip * Math.max(0, Math.sin(t * 9));
      this.hand(T, D, 1, U.lerp(0.22, M[0] + 0.08, up), U.lerp(0.12, M[1] + 0.02, up), U.lerp(-0.3, M[2] + 0.04 + tip * 0.05, up), 0.75 + up * 0.25);
      // the bottle upright at rest, neck toward the mouth as it tips
      const bx = U.lerp(0.15, -0.8, up) - tip * 0.1, bz = U.lerp(1, 0.15, up) - tip * 0.35;
      this.wdir(T, bx, -0.25 * up, bz);
      T[C3.HP] += 0.15 - tip * 0.45 - gulp * 0.04; T[C3.SP] -= tip * 0.06;
      this.rest(T, D, -1);
      if (P.k !== undefined && P.k > 0.92) { const e = this.ease(P.k, 0.92, 1); T[C3.HP] += e * 0.1; }
    },
    // ---- pills: shaken out of the bottle into the left palm, popped in, head back to swallow
    pills(T, S, D, P) {
      const k = P.k === undefined ? this.cyc(S.t, 2.4) : P.k, M = this.MOUTH;
      const shake = this.pulse(k, 0, 0.36, 0.08) * Math.sin(S.t * 22) * 0.015;
      const pop = this.pulse(k, 0.32, 0.72, 0.12), back = this.pulse(k, 0.5, 0.9, 0.12);
      this.hand(T, D, 1, 0.26 + shake, 0.02, -0.18 - (1 - pop) * 0.02 + shake, 0.85);
      this.wdir(T, 0.3, -0.75, 0.2 - this.pulse(k, 0, 0.36, 0.08) * 0.6);
      this.hand(T, D, -1, U.lerp(0.28, M[0] + 0.02, pop), U.lerp(-0.02, -M[1], pop), U.lerp(-0.26, M[2], pop), 0.85);
      T[C3.HP] += 0.35 - pop * 0.25 - back * 0.4; T[C3.JAW] = this.pulse(k, 0.42, 0.56, 0.05) * 0.7;
    },
    // ---- smoking: a drag, the hand lowered out to the side, the other arm folded under
    smoke(T, S, D, P) {
      const t = P.at !== undefined ? P.at : S.t + S.id, c = this.cyc(t, 5.2), M = this.MOUTH;
      const up = this.pulse(c, 0.0, 0.36, 0.11), drag = this.pulse(c, 0.1, 0.3, 0.04);
      this.hand(T, D, 1, U.lerp(0.26, M[0] + 0.01, up), U.lerp(0.2, M[1] + 0.02, up), U.lerp(-0.22, M[2] - 0.01, up), U.lerp(0.25, 0.9, up));
      this.wdir(T, U.lerp(0.85, -0.3, up), U.lerp(0.35, -0.85, up), U.lerp(0.35, 0.1, up));
      this.hand(T, D, -1, 0.17, 0.1, -0.33, 0.25);
      T[C3.HP] += 0.05 - drag * 0.1 + this.pulse(c, 0.38, 0.62, 0.08) * -0.12; T[C3.JAW] = this.pulse(c, 0.4, 0.58, 0.05) * 0.25;
      T[C3.HW] += 0.2 * Math.sin(t * 0.37);
    },
    // ---- reading: the book open in both hands, eyes running down the page, a page turned now and then
    read(T, S, D) {
      const t = S.t + S.id, c = this.cyc(t, 7), turn = this.pulse(c, 0.82, 0.98, 0.06);
      this.hand(T, D, 1, 0.27, 0.1, -0.2, 0.55);
      this.hand(T, D, -1, 0.27 + turn * 0.03, U.lerp(-0.12, 0.06, this.ease(c, 0.84, 0.94)) , -0.21 + turn * 0.05, 0.55);
      this.wdir(T, 0.05, -1, 0.04);
      S.wroll = -0.75;
      const line = (c * 9) % 1;
      T[C3.HP] += 0.42 + 0.12 * c - turn * 0.1; T[C3.HW] += (line - 0.5) * 0.12 * (1 - turn);
    },
    // ---- bandaging P.part: both hands wind round it (legs and feet kneeling); a hurt arm is held out
    bandage(T, S, D, P) {
      const part = P.part || 'TorsoUpper', t = S.t + S.id, th = t * 4.4, H = D.H;
      const side = /L$/.test(part) ? -1 : /R$/.test(part) ? 1 : 0;
      let x = 0.2, y = 0, z = 1.2 * H, r = 0.07, look = 0.35;
      if (part === 'Head') { x = 0.03; z = 1.64 * H; r = 0.095; look = -0.05; }
      else if (part === 'Neck') { x = 0.07; z = 1.5 * H; r = 0.08; look = -0.25; }
      else if (part === 'TorsoUpper') { x = 0.2; z = 1.25 * H; r = 0.1; }
      else if (part === 'TorsoLower') { x = 0.2; z = 1.06 * H; r = 0.1; }
      else if (part === 'Groin') { x = 0.2; z = 0.92 * H; r = 0.08; }
      else if (/^(UpperArm|ForeArm|Hand)/.test(part)) {
        // the hurt arm held out in front, the other hand winding round it
        const fore = /^Fore/.test(part), hand = /^Hand/.test(part);
        if (/^Upper/.test(part)) { this.hand(T, D, side, 0.12, side * 0.24, -0.38, 0.4); x = 0.06; y = side * 0.24; z = 1.3 * H; r = 0.06; }
        else { this.hand(T, D, side, 0.34, side * 0.06, -0.24, 0.9); x = hand ? 0.4 : 0.3; y = side * 0.08; z = (hand ? 1.2 : 1.17) * H; r = 0.05; }
        void fore;
        this.reachB(T, D, -side, x + Math.cos(th) * 0.02, y + Math.cos(th) * r, z + Math.sin(th) * r, 0.8);
        T[C3.HP] += look; T[C3.HW] += side * 0.35;
        this.wdir(T, 0.3, -side * 0.8, 0.2);
        return;
      } else {
        // legs and feet: kneeling over the forward leg (see Player.pose)
        const s = side || -1, foot = /^Foot/.test(part), shin = /^Lower/.test(part);
        x = foot ? 0.4 : shin ? 0.36 : 0.22; y = s * 0.13; z = foot ? 0.1 : shin ? 0.3 : 0.5; r = 0.07; look = 0.5;
        T[C3.SP] += 0.25;
      }
      for (const sd of [-1, 1]) {
        const a = th + (sd > 0 ? 0 : Math.PI);
        this.reachB(T, D, sd, x + Math.cos(a) * 0.04, y + sd * 0.03 + Math.cos(a) * r, z + Math.sin(a) * r * 0.8, 0.8);
      }
      T[C3.HP] += look;
      this.wdir(T, 0.3, -0.8, 0.2);
    },
    // ---- reloading: a pistol's magazine out and in and the slide racked; a long gun fed a round at a time
    reload(T, S, D, P) {
      const k = P.k === undefined ? this.cyc(S.t, 2.4) : P.k;
      if (P.weapon === 'pistol') {
        const up = this.ease(k, 0, 0.15) * (1 - this.ease(k, 0.88, 1));
        this.hand(T, D, 1, 0.24 + up * 0.04, 0.05, -0.36 + up * 0.14, 0.4);
        this.wdir(T, 0.7, -0.25, -0.65 + up * 1.0);
        const toBelt = this.pulse(k, 0.14, 0.5, 0.12), insert = this.pulse(k, 0.44, 0.7, 0.08), rack = this.pulse(k, 0.7, 0.88, 0.05);
        if (insert > 0 || rack > 0) { T[C3.GR] = Math.max(insert, rack); T[C3.GO] = insert > rack ? -0.02 + 0.03 * this.ease(k, 0.5, 0.62) : U.lerp(0.14, 0.04, this.ease(k, 0.74, 0.84)); }
        this.hand(T, D, -1, U.lerp(0.22, 0.0, toBelt), U.lerp(-0.02, -0.2, toBelt), U.lerp(-0.3, -0.5, toBelt), 0.5);
        T[C3.HP] += 0.3 + toBelt * 0.15;
      } else {
        // a round from the left pocket pushed into the loading port under the gun
        this.hand(T, D, 1, 0.16, 0.1, -0.34, 0.4);
        this.wdir(T, 0.8, -0.45, 0.32);
        const pocket = this.pulse(k, 0.0, 0.5, 0.15), port = this.pulse(k, 0.45, 0.92, 0.1), push = this.pulse(k, 0.62, 0.8, 0.05);
        if (port > 0) { T[C3.GR] = port; T[C3.GO] = 0.2 + push * 0.05; }
        this.hand(T, D, -1, U.lerp(0.18, 0.04, pocket), U.lerp(-0.05, -0.2, pocket), U.lerp(-0.3, -0.46, pocket), 0.5);
        T[C3.HP] += 0.4;
      }
    },
    // ---- a magazine change: the gun up at the chest, the left hand pulls the magazine, goes to the belt, pushes the
    // new one home and (sub 'rack') works the slide or charging handle; 'out' only takes the magazine out
    magswap(T, S, D, P) {
      const k = P.k === undefined ? this.cyc(S.t, 1.4) : P.k, long = P.weapon && P.weapon !== 'pistol', sub = P.sub || 'in';
      const up = this.ease(k, 0, 0.12) * (1 - this.ease(k, 0.9, 1));
      if (long) { this.hand(T, D, 1, 0.16, 0.1, -0.34 + up * 0.06, 0.4); this.wdir(T, 0.8, -0.45, 0.32); }
      else { this.hand(T, D, 1, 0.24 + up * 0.04, 0.05, -0.36 + up * 0.14, 0.4); this.wdir(T, 0.7, -0.25, -0.65 + up * 1.0); }
      const pull = this.pulse(k, 0.04, 0.2, 0.05), belt = sub === 'rack' && !P.weapon ? 0 : this.pulse(k, 0.16, sub === 'out' ? 0.75 : 0.56, 0.12);
      const rk = sub === 'rack' ? this.pulse(k, 0.68, 0.94, 0.06) : 0;
      let f = long ? 0.2 : 0.22, lat = 0.0 - 0.04 * pull, z = (long ? -0.36 : -0.3) - 0.09 * pull;
      f = U.lerp(f, 0.02, belt); lat = U.lerp(lat, -0.2, belt); z = U.lerp(z, -0.5, belt);
      if (rk > 0) { const back = this.ease(k, 0.76, 0.86); f = U.lerp(f, (long ? 0.12 : 0.22) - back * 0.07, rk); z = U.lerp(z, long ? -0.24 : -0.17, rk); lat = U.lerp(lat, 0.05, rk); }
      this.hand(T, D, -1, f, lat, z, 0.5);
      T[C3.HP] += 0.3 + belt * 0.12;
    },
    // ---- thumbing rounds into a magazine held in the left hand, one push after another
    magload(T, S, D, P) {
      const t = S.t + S.id * 0.3, c = this.cyc(t, 0.45), push = this.pulse(c, 0.1, 0.6, 0.12);
      this.hand(T, D, -1, 0.26, 0.02, -0.3, 0.6);
      this.hand(T, D, 1, 0.27 - push * 0.02, push * 0.03, -0.27 - push * 0.03, 0.6);
      T[C3.HP] += 0.42; T[C3.SP] += 0.06;
      this.wdir(T, 0.5, -0.3, -0.8);
    },
    // ---- pouring from a can (fuel, water) forward and down, the left hand under it
    pour(T, S, D, P) {
      const t = S.t + S.id, sl = Math.sin(t * 2.2) * 0.04, wcan = P.weapon === 'wcan';
      T[C3.SP] += 0.22; T[C3.HP] += 0.35;
      if (wcan) {
        this.hand(T, D, 1, 0.33, 0.12, -0.24, 0.6);
        this.wdirB(T, D, 0.8, 0.0, -0.35 - sl);
        this.rest(T, D, -1);
      } else {
        this.hand(T, D, 1, 0.34, 0.06, -0.2, 0.6);
        this.wdirB(T, D, 0.75, -0.05, -0.6 - sl);
        this.hand(T, D, -1, 0.4, -0.08, -0.36, 0.7);
      }
    },
    // ---- chopping a tree: two-handed, the axe from over the right shoulder into the trunk ahead (the hit at c 0.5,
    // in time with the chop sounds: every 1.2 s from the action's start)
    chop(T, S, D, P) {
      const at = P.at === undefined ? S.t : P.at, c = this.cyc(at, 1.2, 0.5);
      // R wrist f lat z | axe dir x y z | spine twist, bend | pelvis yaw | head pitch
      const o = this.kf('chop', [
        [0, 0.12, 0.24, -0.02, 0.1, 0.45, 0.88, 0.32, 0.02, 0.1, 0.1],
        [0.3, 0.02, 0.28, 0.06, -0.35, 0.35, 0.87, 0.5, -0.06, 0.18, 0.05],
        [0.38, 0.03, 0.27, 0.05, -0.3, 0.38, 0.87, 0.48, -0.05, 0.17, 0.05],
        [0.45, 0.22, 0.22, -0.1, 0.6, 0.55, 0.55, 0.15, 0.1, 0.05, 0.15],
        [0.5, 0.3, 0.08, -0.3, 0.88, -0.44, -0.15, -0.28, 0.3, -0.1, 0.28],
        [0.62, 0.29, 0.09, -0.3, 0.88, -0.43, -0.1, -0.25, 0.28, -0.09, 0.27],
        [0.8, 0.26, 0.14, -0.26, 0.75, -0.1, 0.4, -0.05, 0.2, -0.04, 0.22],
        [1, 0.12, 0.24, -0.02, 0.1, 0.45, 0.88, 0.32, 0.02, 0.1, 0.1],
      ], c);
      T[C3.SW] += o[6]; T[C3.SP] += o[7]; T[C3.PW] += o[8]; T[C3.HP] += o[9];
      this.hand(T, D, 1, o[0], o[1], o[2], 0.5);
      this.wdir(T, o[3], o[4], o[5]);
      T[C3.GR] = 1; T[C3.GO] = P.weapon === 'handaxe' ? 0.08 : 0.3;
      this.plant(T, S, D, 0.15);
    },
    // ---- digging with a shovel: blade in, a foot on it, levered back, lifted and tossed to the right
    dig(T, S, D, P) {
      const at = P.at === undefined ? S.t : P.at, c = this.cyc(at, 2.1), H = D.H;
      // R wrist x y z (body) | blade dir x y z (body) | spine bend, twist | right foot lift
      const o = this.kf('dig', [
        [0, 0.32, 0.12, 0.98, 0.38, -0.05, -0.92, 0.3, 0, 0],
        [0.16, 0.3, 0.12, 0.9, 0.38, -0.05, -0.92, 0.35, 0, 1],
        [0.3, 0.3, 0.12, 0.84, 0.4, -0.05, -0.92, 0.38, 0, 0.6],
        [0.45, 0.12, 0.12, 0.82, 0.66, -0.05, -0.75, 0.42, 0, 0],
        [0.62, 0.26, 0.12, 1.0, 0.88, 0.0, -0.45, 0.25, 0.1, 0],
        [0.76, 0.3, 0.26, 1.06, 0.45, 0.8, -0.3, 0.2, 0.45, 0],
        [1, 0.32, 0.12, 0.98, 0.38, -0.05, -0.92, 0.3, 0, 0],
      ], c);
      T[C3.SP] += o[6]; T[C3.SW] += o[7]; T[C3.HP] += 0.35; T[C3.PZ] -= 0.04 * o[8];
      this.plant(T, S, D, 0.15);
      if (o[8] > 0.01 && S.amp < 0.3) { const Pf = this.pelvisOf(T, this.T1); this.foot(T, Pf, 1, 0.42 * o[8], 0.06, D.ankH + 0.22 * o[8], -0.15 * o[8], 0.1); }
      this.reachB(T, D, 1, o[0], o[1], o[2] * H, 0.5);
      this.wdirB(T, D, o[3], o[4], o[5]);
      T[C3.GR] = 1; T[C3.GO] = 0.42;
    },
    // ---- fishing: a cast at the start, then the rod held up, a twitch now and then, reeling in
    fish(T, S, D, P) {
      const at = P.at === undefined ? S.t % 12 : P.at, t = S.t + S.id;
      const back = this.pulse(at, 0, 0.9, 0.35), cast = this.ease(at, 0.7, 1.0);
      const c = this.cyc(t, 9), twitch = this.pulse(c, 0.3, 0.38, 0.03), reel = this.pulse(c, 0.55, 0.85, 0.06);
      const bx = U.lerp(0.75, -0.3, back), bz = U.lerp(0.62, 0.95, back) + twitch * 0.35;
      this.hand(T, D, 1, U.lerp(0.22, 0.12, back), 0.1, U.lerp(-0.3, -0.05, back) + twitch * 0.04, 0.5);
      this.wdir(T, at < 1 && cast < 1 ? U.lerp(bx, 0.75, cast) : 0.75, 0, at < 1 && cast < 1 ? U.lerp(bz, 0.62, cast) : 0.62 + twitch * 0.35);
      // the left hand on the reel, winding when reeling in
      const rx = Math.cos(t * 9) * 0.03 * reel, rz = Math.sin(t * 9) * 0.03 * reel;
      this.hand(T, D, -1, 0.3 + rx, 0.06, -0.3 + rz, 0.6);
      T[C3.HP] += 0.1; T[C3.HW] += 0.15 * Math.sin(t * 0.3);
      S.line = 1;
    },
    // ---- sawing: the saw stroking back and forth, the left hand holding the work down, the body rocking with it
    saw(T, S, D) {
      const t = S.t + S.id, s = Math.sin(t * 7.5);
      this.bend(T, S, D, 0.08, 0.04, 0.2, 0.18 + 0.04 * s);
      T[C3.PX] += 0.02 * s; T[C3.HP] += 0.4;
      this.reachB(T, D, 1, 0.42 + 0.12 * s, 0.1, 0.78 * D.H, 0.4);
      this.wdirB(T, D, 0.88, -0.05, -0.45);
      this.reachB(T, D, -1, 0.5, -0.18, 0.72 * D.H, 0.7);
    },
    // ---- hammering: the left hand holding the nail, the hammer raised and brought down on it
    hammer(T, S, D, P) {
      const t = S.t + S.id, c = this.cyc(t, 0.62), lv = P.lvl === undefined ? 1 : P.lvl;
      if (lv === 0) this.bend(T, S, D, 0.18, 0.08, 0.35, 0.35);
      const up = this.ease(c, 0.0, 0.58) * (1 - this.ease(c, 0.6, 0.7));
      this.hand(T, D, -1, 0.42, -0.04, lv === 0 ? -0.3 : -0.12, 0.7);
      this.hand(T, D, 1, U.lerp(0.3, 0.2, up), U.lerp(0.06, 0.13, up), U.lerp(lv === 0 ? -0.3 : -0.14, 0.04, up), 0.6);
      this.wdir(T, U.lerp(0.85, 0.1, up), U.lerp(-0.45, 0.05, up), U.lerp(0.05, 1, up));
      T[C3.HP] += 0.3; T[C3.SP] += 0.06 + 0.05 * (1 - up);
    },
    // ---- smashing with a sledgehammer: lifted overhead, brought down with the whole body
    smash(T, S, D, P) {
      const at = P.at === undefined ? S.t : P.at, c = this.cyc(at, 1.6);
      // R wrist f lat z | dir x y z | spine bend | pelvis drop | head pitch
      const o = this.kf('smash', [
        [0, 0.24, 0.1, -0.36, 0.86, -0.2, 0.28, 0.12, 0, 0.2],
        [0.3, 0.12, 0.12, -0.05, 0.3, 0.1, 0.95, 0.0, 0, 0.05],
        [0.44, 0.0, 0.1, 0.22, -0.45, 0.12, 0.88, -0.2, 0, -0.12],
        [0.56, 0.4, 0.02, -0.22, 0.96, -0.1, -0.2, 0.45, 0.08, 0.35],
        [0.7, 0.36, 0.04, -0.3, 0.92, -0.1, -0.05, 0.36, 0.05, 0.3],
        [1, 0.24, 0.1, -0.36, 0.86, -0.2, 0.28, 0.12, 0, 0.2],
      ], c);
      T[C3.SP] += o[6]; T[C3.HP] += o[8];
      this.bend(T, S, D, o[7], 0, o[7] * 1.2, 0);
      this.hand(T, D, 1, o[0], o[1], o[2], 0.5);
      this.wdir(T, o[3], o[4], o[5]);
      T[C3.GR] = 1; T[C3.GO] = 0.22;
    },
    // ---- foraging (kneeling): the hands sweeping through the undergrowth, the head looking about
    forage(T, S, D) {
      const t = S.t + S.id;
      T[C3.SP] += 0.3; T[C3.PP] += 0.08; T[C3.HP] += 0.1; T[C3.HW] += 0.35 * Math.sin(t * 0.55);
      for (const side of [-1, 1]) {
        const a = t * 2.6 + (side > 0 ? 0 : Math.PI);
        this.reachB(T, D, side, 0.5 + 0.06 * Math.sin(a), side * 0.12 + 0.12 * Math.cos(a), 0.14 + 0.06 * Math.max(0, Math.sin(a)), 0.8);
      }
      this.wdir(T, 0.5, 0, -0.85);
    },
    // ---- gardening (kneeling): scooping soil, patting it down, the odd pull up (harvest)
    garden(T, S, D, P) {
      const t = S.t + S.id, c = this.cyc(t, 2.4), pull = P.sub === 'pull' ? this.pulse(c, 0.55, 0.95, 0.12) : 0;
      T[C3.SP] += 0.32; T[C3.PP] += 0.08; T[C3.HP] += 0.2;
      for (const side of [-1, 1]) {
        const s = Math.sin(t * 6 + (side > 0 ? 0 : 2)), pat = Math.max(0, s);
        this.reachB(T, D, side, 0.46 + 0.03 * s, side * 0.09, 0.1 + 0.07 * pat + (side > 0 ? pull * 0.35 : 0), 0.8);
      }
      this.wdir(T, 0.5, 0, -0.85);
    },
    // ---- picking something heavy up: squat, grip, lift to the chest
    pickup(T, S, D, P) {
      const k = P.k === undefined ? this.cyc(S.t, 2.5) : P.k, H = D.H;
      const down = this.ease(k, 0, 0.32) * (1 - this.ease(k, 0.55, 0.9)), lift = this.ease(k, 0.55, 0.9);
      this.bend(T, S, D, 0.38 * down, 0.1 * down, 0.55 * down, 0.4 * down);
      for (const side of [-1, 1]) this.reachB(T, D, side, U.lerp(0.32, 0.46, down) - lift * 0.1, side * 0.2, U.lerp(0.8 * H, 0.24, down) + lift * 0.28 * H, 0.75);
      T[C3.HP] += 0.3 * down + 0.15;
    },
    // ---- dressing: a top pulled on over the head, legs stepped into, shoes laced, a hat set on
    dress(T, S, D, P) {
      const k = P.k === undefined ? this.cyc(S.t, 1.6) : P.k, part = P.part || 'top', H = D.H, t = S.t;
      if (part === 'low' || part === 'feet') {
        const down = this.ease(k, 0, 0.25) * (1 - this.ease(k, 0.75, 1));
        this.bend(T, S, D, 0.12 * down, 0.05 * down, 0.4 * down, 0.45 * down);
        if (part === 'low' && S.amp < 0.3) {
          // a foot lifted into each leg in turn
          const l1 = this.pulse(k, 0.2, 0.45, 0.08), l2 = this.pulse(k, 0.45, 0.7, 0.08), Pf = this.pelvisOf(T, this.T1);
          if (l1 > 0) this.foot(T, Pf, -1, 0.06, -0.11, D.ankH + 0.22 * l1, 0.1, 0.15);
          if (l2 > 0) this.foot(T, Pf, 1, 0.06, 0.11, D.ankH + 0.22 * l2, 0.1, 0.2);
        }
        const up = part === 'low' ? this.ease(k, 0.68, 0.92) : 0, w = Math.sin(t * 12) * 0.03 * down;
        for (const side of [-1, 1]) this.reachB(T, D, side, 0.22 + w * side, side * 0.17, (part === 'feet' ? 0.2 : 0.45 + up * 0.5) * H + w, 0.7);
        T[C3.HP] += 0.4 * down;
      } else if (part === 'head') {
        const up = this.pulse(k, 0.05, 0.85, 0.2), adj = Math.sin(t * 7) * 0.02 * up;
        for (const side of [-1, 1]) this.reachB(T, D, side, U.lerp(0.04, 0.03 + adj, up), side * U.lerp(0.22, 0.11, up), U.lerp(0.85, 1.7 + adj * side, up) * H, U.lerp(0.2, 0.9, up));
        T[C3.HP] -= 0.05 * up;
      } else if (part === 'hands') {
        const w = Math.sin(t * 9) * 0.03;
        this.hand(T, D, -1, 0.3 + w, 0.0, -0.2, 0.7); this.hand(T, D, 1, 0.26 - w, 0.06, -0.22, 0.7);
        T[C3.HP] += 0.4;
      } else {
        // over the head and pulled down, tugged straight
        const over = this.pulse(k, 0.02, 0.5, 0.16), pullK = this.ease(k, 0.36, 0.72), tug = this.pulse(k, 0.7, 0.95, 0.06) * Math.sin(t * 15) * 0.03;
        for (const side of [-1, 1]) {
          const z = k < 0.36 ? U.lerp(0.9, 1.86, over) : U.lerp(1.86, 1.0, pullK);
          this.reachB(T, D, side, 0.1 + 0.08 * (1 - over) + tug, side * (0.14 + 0.06 * pullK), z * H + tug, 0.6);
        }
        T[C3.HP] += 0.25 * this.pulse(k, 0.1, 0.45, 0.1); T[C3.SP] += 0.1 * over;
      }
    },
  },

  // ===================================================================== whole-body moves
  // ---- climbing over a fence or through a window (prog 0..1; the entity crosses the line at about 0.36 and stops
  // at 0.71): hands on the top, a foot up, over head-first with the hips high, dropping down the far side
  // pelvis x, z, pitch | spine | head | hands x, z (body, z x height) | right foot x, z | left foot x, z
  CLIMB_KF: {
    // a running hop over a low fence: hands on the top, knees tucked, over and down still moving
    vault: [
      [0, 0, 0, 0.2, 0.15, 0.0, 0.35, 0.55, 0.1, 0.075, -0.1, 0.075],
      [0.22, 0.04, 0.06, 0.5, 0.35, -0.1, 0.3, 0.55, 0.22, 0.3, 0.02, 0.22],
      [0.48, 0.18, 0.34, 0.3, 0.25, 0.1, 0.08, 0.55, 0.36, 0.55, 0.22, 0.5],
      [0.74, 0.3, 0.1, 0.12, 0.12, 0.1, -0.06, 0.55, 0.32, 0.22, 0.1, 0.16],
      [1, 0, 0, 0.18, 0.12, 0.0, 0.05, 0.3, 0.1, 0.075, -0.1, 0.075],
    ],
    // a tall fence: reach up, pull up with a foot on it, a leg over the top, let down the far side, drop
    tall: [
      [0, 0, 0, 0.1, 0.1, -0.2, 0.3, 1.18, 0.05, 0.075, -0.05, 0.075],
      [0.18, -0.05, 0.22, 0.1, 0.22, -0.25, 0.22, 1.05, 0.25, 0.45, -0.05, 0.075],
      [0.38, 0.0, 0.72, 0.4, 0.45, -0.1, 0.15, 1.05, 0.3, 0.9, 0.2, 0.7],
      [0.54, 0.08, 0.95, 0.6, 0.45, 0.0, 0.0, 1.05, 0.2, 1.02, -0.2, 0.92],
      [0.74, 0.1, 0.45, 0.2, 0.2, 0.2, -0.15, 1.0, 0.15, 0.5, -0.1, 0.3],
      [0.9, 0.05, -0.05, 0.3, 0.25, 0.2, 0.2, 0.6, 0.12, 0.075, -0.08, 0.075],
      [1, 0, 0, 0, 0, 0, 0.05, 0.3, 0.05, 0.075, -0.05, 0.075],
    ],
    // pulling up, straining at the top, slipping back down and staggering back
    fail: [
      [0, 0, 0, 0.1, 0.1, -0.2, 0.3, 1.18, 0.05, 0.075, -0.05, 0.075],
      [0.22, -0.05, 0.22, 0.1, 0.22, -0.25, 0.22, 1.05, 0.25, 0.45, -0.05, 0.075],
      [0.42, 0.0, 0.45, 0.3, 0.4, -0.15, 0.18, 1.05, 0.28, 0.62, 0.1, 0.4],
      [0.56, -0.05, 0.3, 0.2, 0.3, -0.25, 0.2, 1.02, 0.2, 0.3, -0.05, 0.075],
      [0.72, -0.15, -0.04, -0.15, 0.1, 0.15, 0.35, 0.7, 0.1, 0.075, -0.15, 0.075],
      [1, 0, 0, 0, 0, 0, 0.1, 0.3, 0.05, 0.075, -0.05, 0.075],
    ],
    // nearly over, a foot on the top, hanging there shaking, then slipping and landing hard in a crouch
    fail2: [
      [0, 0, 0, 0.1, 0.1, -0.2, 0.3, 1.18, 0.05, 0.075, -0.05, 0.075],
      [0.2, -0.05, 0.22, 0.1, 0.22, -0.25, 0.22, 1.05, 0.25, 0.45, -0.05, 0.075],
      [0.4, 0.0, 0.72, 0.4, 0.45, -0.1, 0.15, 1.05, 0.3, 0.9, 0.2, 0.5],
      [0.55, 0.0, 0.66, 0.35, 0.42, -0.1, 0.15, 1.06, 0.28, 0.85, 0.1, 0.3],
      [0.68, -0.05, 0.5, 0.2, 0.3, -0.3, 0.2, 1.08, 0.2, 0.4, -0.05, 0.2],
      [0.8, -0.12, -0.25, 0.35, 0.35, 0.2, 0.3, 0.7, 0.1, 0.075, -0.12, 0.075],
      [1, 0, 0, 0, 0, 0, 0.1, 0.3, 0.05, 0.075, -0.05, 0.075],
    ],
    // dragged down off a tall fence: pulling up, yanked back by the legs, falling backward
    drag: [
      [0, 0, 0, 0.1, 0.1, -0.2, 0.3, 1.18, 0.05, 0.075, -0.05, 0.075],
      [0.2, -0.05, 0.22, 0.1, 0.22, -0.25, 0.22, 1.05, 0.25, 0.45, -0.05, 0.075],
      [0.38, 0.0, 0.5, 0.3, 0.4, -0.15, 0.18, 1.05, 0.28, 0.7, 0.1, 0.45],
      [0.5, -0.12, 0.45, -0.35, -0.2, -0.4, 0.2, 1.1, 0.25, 0.5, -0.15, 0.2],
      [0.68, -0.3, 0.15, -0.6, -0.3, -0.4, 0.4, 0.6, 0.3, 0.075, -0.1, 0.3],
      [1, -0.35, -0.45, -0.8, -0.25, -0.3, 0.5, 0.2, 0.3, 0.075, 0.2, 0.075],
    ],
    // dragged back off a low fence half way over
    dragLow: [
      [0, 0, 0, 0, 0.15, 0.1, 0.42, 0.98, 0.05, 0.075, -0.05, 0.075],
      [0.2, -0.05, 0.12, 0.2, 0.45, 0.1, 0.36, 0.98, 0.32, 0.5, -0.08, 0.075],
      [0.38, 0.0, 0.4, 0.4, 0.55, -0.1, 0.15, 0.96, 0.36, 0.55, -0.3, 0.5],
      [0.52, -0.15, 0.25, -0.3, -0.1, -0.4, 0.2, 0.98, 0.25, 0.2, -0.2, 0.3],
      [0.75, -0.3, -0.1, -0.6, -0.25, -0.4, 0.45, 0.5, 0.25, 0.075, -0.1, 0.2],
      [1, -0.35, -0.45, -0.8, -0.25, -0.3, 0.5, 0.2, 0.3, 0.075, 0.2, 0.075],
    ],
  },
  // hands come off the top at this point of the climb
  CLIMB_LET: { vault: 0.66, tall: 0.8, fail: 0.62, fail2: 0.7, drag: 0.5, dragLow: 0.45 },
  climb(T, S, D, P) {
    const p = U.clamp(P.prog === undefined ? (S.mt / 1.2) % 1 : P.prog, 0, 1), H = D.H;
    if (P.rope) return this.climbRope(T, S, D, P, p);
    const kind = this.CLIMB_KF[P.climbKind] ? P.climbKind : null;
    const o = kind ? this.kf('climb_' + kind, this.CLIMB_KF[kind], p) : this.kf('climb', [
      [0, 0, 0, 0, 0.15, 0.1, 0.42, 0.98, 0.05, 0.075, -0.05, 0.075],
      [0.16, -0.05, 0.12, 0.2, 0.45, 0.1, 0.36, 0.98, 0.32, 0.5, -0.08, 0.075],
      [0.34, 0.0, 0.48, 0.45, 0.6, -0.1, 0.12, 0.96, 0.38, 0.62, -0.38, 0.62],
      [0.5, 0.08, 0.32, 0.35, 0.4, 0.0, -0.12, 0.94, 0.25, 0.25, -0.25, 0.6],
      [0.66, 0.05, -0.2, 0.3, 0.35, 0.25, 0.3, 0.6, 0.15, 0.075, -0.06, 0.12],
      [0.82, 0.0, -0.12, 0.18, 0.2, 0.2, 0.3, 0.75, 0.1, 0.075, -0.08, 0.075],
      [1, 0, 0, 0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.075, -0.05, 0.075],
    ], p);
    T[C3.PX] += o[0]; T[C3.PZ] += o[1]; T[C3.PP] += o[2]; T[C3.SP] += o[3]; T[C3.HP] += o[4];
    const Pf = this.pelvisOf(T, this.T1);
    this.foot(T, Pf, 1, o[7], 0.1, Math.max(D.ankH, o[8]), o[8] > 0.2 ? -0.3 : 0, 0.15);
    this.foot(T, Pf, -1, o[9], -0.1, Math.max(D.ankH, o[10]), o[10] > 0.2 ? -0.6 : 0, 0.15);
    // hands on the top until the body is over, then out for balance on landing, then down
    const let0 = kind ? this.CLIMB_LET[kind] : 0.86, hands = 1 - this.ease(p, let0, Math.min(1, let0 + 0.14));
    for (const side of [-1, 1]) {
      if (hands > 0.01) this.reachB(T, D, side, o[5], side * (0.2 + 0.04 * Math.sin(p * 6)), o[6] * H, 0.85);
      else this.hang(T, side, D, 0.02, 0.05, 0.15);
    }
    T[C3.GR] = 0; T[C3.LH] = 0;
  },
  // ---- a sheet rope: hand over hand, the feet walking up the wall (prog cycles)
  climbRope(T, S, D, P, p) {
    const H = D.H;
    for (const side of [-1, 1]) {
      const u = (p + (side > 0 ? 0 : 0.5)) % 1, up = u < 0.5 ? this.ease(u, 0, 0.5) : 1 - this.ease(u, 0.5, 1);
      this.reachB(T, D, side, 0.22, side * 0.05, U.lerp(1.3, 1.95, up) * H, 0.6);
    }
    T[C3.SP] -= 0.1; T[C3.HP] -= 0.35; T[C3.PP] -= 0.1; T[C3.PZ] -= 0.12;
    const Pf = this.pelvisOf(T, this.T1), k = Math.sin(p * Math.PI * 2);
    this.foot(T, Pf, 1, 0.3, 0.1, D.ankH + 0.25 + 0.12 * k, -0.4, 0.2);
    this.foot(T, Pf, -1, 0.3, -0.1, D.ankH + 0.25 - 0.12 * k, -0.4, 0.2);
  },
  // ---- a zombie pounding on a door or window: fists raised high and hammered down, alternating, the body lunging
  thump(T, S, D, P) {
    const t = S.t + S.id * 0.7, per = 0.64;
    let hit = 0, hs = 0;
    for (const side of [-1, 1]) {
      const c = this.cyc(t, per * 2, side > 0 ? 0 : 0.5);
      const raise = this.ease(c, 0.05, 0.5), strike = this.ease(c, 0.52, 0.64), h = this.pulse(c, 0.56, 0.78, 0.06);
      const k = raise * (1 - strike);
      if (h > hit) { hit = h; hs = side; }
      this.hand(T, D, side, U.lerp(0.46, 0.28, k) + strike * 0.04, side * 0.12, U.lerp(-0.18, 0.16, k) + strike * 0.08 * (1 - this.ease(c, 0.64, 1)), 1);
    }
    T[C3.SP] += 0.14 + 0.12 * hit; T[C3.PX] += 0.05 * hit; T[C3.HP] += -0.05 + 0.2 * hit; T[C3.SW] += 0.14 * hs * hit; T[C3.SR] += 0.06 * hs * hit;
    T[C3.JAW] = 0.45 + 0.35 * Math.max(0, Math.sin(t * 2.1));
    T[C3.LH] = 1;
  },
  // ---- a zombie kneeling over a body, tearing at it and bending to bite
  feed(T, S, D, P) {
    const t = S.t + S.id * 1.3, zv = this.zvar(S), c = this.cyc(t, 3.1), bite = this.pulse(c, 0.45, 0.75, 0.1), tear = this.pulse(c, 0.1, 0.45, 0.1);
    T[C3.PX] = -0.12; T[C3.PZ] = 0.44 + 0.015 * Math.sin(t * 2); T[C3.PP] = 0.4; T[C3.SP] = 0.7 + 0.25 * bite - 0.15 * tear; T[C3.SR] = 0.08 * Math.sin(t * 0.9);
    T[C3.HP] = 0.3 + 0.35 * bite - 0.25 * tear; T[C3.HR] = zv.headR * 0.5 + 0.2 * tear * Math.sin(t * 7); T[C3.HW] = 0.15 * Math.sin(t * 0.7);
    const Pf = this.pelvisOf(T, this.T1);
    this.foot(T, Pf, -1, -0.42, -0.14, 0.1, -1.15, 0.1); this.foot(T, Pf, 1, -0.42, 0.14, 0.1, -1.15, 0.15);
    // one hand pins the body, the other pulls something away (switching sides now and then)
    const sw = Math.floor(t / 6.2) % 2 ? 1 : -1;
    for (const side of [-1, 1]) {
      const pulls = side === sw, k = pulls ? tear : 0, j = Math.sin(t * 11 + side) * 0.015;
      this.reachB(T, D, side, 0.52 - k * 0.18 + j, side * (0.16 + k * 0.06), 0.1 + k * 0.35, 0.9);
    }
    T[C3.JAW] = 0.3 + 0.6 * bite + 0.3 * Math.max(0, Math.sin(t * 13)) * (1 - bite);
    T[C3.LH] = 1;
    this.wdir(T, 0.35, 0.05, -0.93);
  },
  // ---- the player standing idle for a while: looks about, stretches, checks the time, scratches, rolls the neck
  fidget(T, S, D, P) {
    const st = S.still || 0;
    if (st < 7) return;
    const u = st - 7, slot = Math.floor(u / 8), f = (u % 8) / 3.2;
    if (f >= 1) return;
    const kind = Math.floor(this.rnd(S.id, slot + 3) * (P.weapon ? 2 : 6)), k = this.pulse(f, 0, 1, 0.25), H = D.H;
    if (kind === 0) { T[C3.HW] += Math.sin(f * Math.PI * 2) * 0.85 * k; T[C3.SW] += Math.sin(f * Math.PI * 2) * 0.2 * k; T[C3.HP] -= 0.05 * k; }
    else if (kind === 1) { T[C3.HR] += Math.sin(f * Math.PI * 2) * 0.35 * k; T[C3.HP] += (0.25 - 0.4 * Math.abs(Math.sin(f * Math.PI))) * k; }
    else if (kind === 2) {
      // a stretch: arms overhead, leaning back
      for (const side of [-1, 1]) this.reachB(T, D, side, U.lerp(0.02, 0.06, k), side * U.lerp(0.22, 0.14, k), U.lerp(0.85, 1.98, k) * H, 0.3);
      T[C3.SP] -= 0.18 * k; T[C3.HP] -= 0.3 * k; T[C3.JAW] = 0.6 * this.pulse(f, 0.3, 0.75, 0.15);
    } else if (kind === 3) {
      // the time on the left wrist
      this.hand(T, D, -1, U.lerp(0.0, 0.24, k), U.lerp(-0.22, -0.05, k), U.lerp(-0.55, -0.16, k), 0.9);
      T[C3.HP] += 0.45 * k;
    } else if (kind === 4) {
      // a scratch at the back of the head
      const s = Math.sin(f * 40) * 0.015 * k;
      this.reachB(T, D, 1, U.lerp(0.0, -0.02 + s, k), U.lerp(0.22, 0.1, k), U.lerp(0.85, 1.68 + s, k) * H, 1);
      T[C3.HP] += 0.15 * k; T[C3.HR] -= 0.12 * k;
    } else {
      // rubbing the hands together
      const r = Math.sin(f * 30) * 0.03 * k;
      for (const side of [-1, 1]) this.hand(T, D, side, U.lerp(0.0, 0.26 + r * side, k), side * U.lerp(0.22, 0.03, k), U.lerp(-0.55, -0.22, k), 0.8);
      T[C3.HP] += 0.2 * k;
    }
  },
  // ---- hurt (a flinch back from the hit, arms up) and grabbed (struggling, pushing away)
  flinch(T, S, D, P) {
    const h = U.clamp(P.hurt || 0, 0, 1), g = U.clamp((P.grab || 0) * 2, 0, 1), t = S.t;
    if (h > 0.01) {
      const k = Math.sin(h * Math.PI) * (h > 0.5 ? 1 : h * 2);
      T[C3.SP] -= 0.2 * k; T[C3.HP] -= 0.25 * k; T[C3.SR] += 0.1 * k; T[C3.PX] -= 0.04 * k; T[C3.JAW] = Math.max(T[C3.JAW], 0.6 * k);
      for (const side of [-1, 1]) { const i = side < 0 ? C3.LW : C3.RW; T[i] += 0.06 * k; T[i + 1] += side * 0.08 * k; T[i + 2] += 0.15 * k; }
    }
    if (g > 0.01) {
      const w = Math.sin(t * 15);
      for (const side of [-1, 1]) {
        const i = side < 0 ? C3.LW : C3.RW, k = g * (0.8 + 0.2 * side * w);
        T[i] = U.lerp(T[i], 0.4, k); T[i + 1] = U.lerp(T[i + 1], -side * 0.06, k); T[i + 2] = U.lerp(T[i + 2], -0.12, k); T[i + 3] = U.lerp(T[i + 3], 0.9, k);
      }
      T[C3.SW] += 0.25 * w * g; T[C3.HW] -= 0.4 * g; T[C3.SP] -= 0.1 * g; T[C3.JAW] = Math.max(T[C3.JAW], 0.5 * g);
    }
  },
});

// ---------------------------------------------------------------------------
// The held props, drawn by Char3D.weapon (piece: from k0 to k1 along the item, half width w sideways, h up, offset a)
// ---------------------------------------------------------------------------
Char3D.prop = function (key, W, piece, hand, wd, col, Rf) {
  const M = this.M, BOX = M.BOX, CY = M.CYL, RB = M.RB, SP = M.SPH;
  const c = this.rgb(col || W.col), dk = this.sc(c, 0.7), white = this.rgb('#ecebe4'), steel = this.rgb('#a0a8b0');
  if (key === 'bottle') {
    piece(CY, -0.08, 0.06, 0.03, 0.03, c); piece(RB, 0.04, 0.1, 0.03, 0.03, c, 0, 0.45); piece(CY, 0.08, 0.15, 0.012, 0.012, c);
    piece(CY, 0.15, 0.165, 0.014, 0.014, this.rgb('#c8c0a0'));
  } else if (key === 'can') { piece(CY, -0.06, 0.06, 0.033, 0.033, c); piece(CY, 0.06, 0.066, 0.029, 0.029, steel); }
  else if (key === 'carton') { piece(BOX, -0.06, 0.07, 0.032, 0.032, c); piece(BOX, 0.07, 0.09, 0.03, 0.01, white); }
  else if (key === 'food') { piece(BOX, -0.05, 0.05, 0.04, 0.022, c); piece(BOX, -0.045, 0.045, 0.036, 0.008, this.sc(c, 1.25), 0.024); }
  else if (key === 'pills') { piece(CY, -0.03, 0.03, 0.018, 0.018, white); piece(CY, 0.03, 0.045, 0.02, 0.02, c); }
  else if (key === 'cig') { piece(CY, 0.01, 0.075, 0.0055, 0.0055, white); piece(CY, 0.075, 0.083, 0.006, 0.006, [1.9, 0.75, 0.25]); }
  else if (key === 'book') { piece(BOX, -0.02, 0.24, 0.085, 0.012, c); piece(BOX, -0.01, 0.23, 0.08, 0.008, this.rgb('#efe9d8'), 0.008); piece(BOX, 0.1, 0.12, 0.08, 0.009, this.rgb('#c8c0b0'), 0.01); }
  else if (key === 'bandage') piece(CY, -0.03, 0.03, 0.024, 0.024, white);
  else if (key === 'gascan') { piece(BOX, -0.1, 0.12, 0.065, 0.12, c, -0.13); piece(CY, 0.1, 0.22, 0.012, 0.012, this.rgb('#303030'), -0.04); piece(BOX, -0.06, 0.06, 0.012, 0.012, dk, 0.0); }
  else if (key === 'wcan') { piece(CY, -0.12, 0.06, 0.08, 0.08, c, -0.1); piece(CY, 0.06, 0.32, 0.011, 0.011, c, -0.09); piece(SP, 0.32, 0.36, 0.022, 0.022, dk, -0.09); }
  else if (key === 'rod') {
    piece(CY, -0.28, W.len, 0.012, 0.012, c, 0, 0.35); piece(CY, 0.0, 0.05, 0.026, 0.026, steel, -0.03);
    if (this.lineOn && wd[0] * Rf[3] + wd[1] * Rf[4] > 0.3) {
      // the line from the tip down to the water ahead
      const tip = c3e; tip[0] = hand[0] + wd[0] * W.len; tip[1] = hand[1] + wd[1] * W.len; tip[2] = hand[2] + wd[2] * W.len;
      const hl = Math.hypot(wd[0], wd[1]) || 1, end = c3g; end[0] = tip[0] + wd[0] / hl * 1.4; end[1] = tip[1] + wd[1] / hl * 1.4; end[2] = 0.02;
      c3seg(CY, tip, end, 0.003, 0.003, this.rgb('#c8c8c0'), 1, 1, 0, 0, 1);
    }
  } else if (key === 'saw') { piece(BOX, -0.06, 0.04, 0.014, 0.045, this.rgb(W.grip)); piece(BOX, 0.04, W.len, 0.003, 0.055, c, -0.02, 0.55); }
  void RB;
};

// ---------------------------------------------------------------------------
// Particles the player's actions throw off, in time with the animations above: smoke breathed out after a drag,
// wood chips from the axe, dirt off the shovel, debris from the sledgehammer, sawdust, a stream from a can
// ---------------------------------------------------------------------------
const ActFx = {
  update(dt) {
    const p = G.player, a = p && p.action;
    if (!a || p.dead || p.inCar || !(dt > 0)) { this.prev = -1; return; }
    const an = a.anim, at = a.t || 0, ca = Math.cos(p.angle), sa = Math.sin(p.angle), rx = -sa, ry = ca;
    const prev = this.prev === undefined || this.prevA !== a ? -1 : this.prev;
    this.prev = at; this.prevA = a;
    // crossing time T in a cycle of length per (offset so the moment falls at T)
    const hit = (per, T) => prev >= 0 && Math.floor((prev - T) / per) !== Math.floor((at - T) / per);
    const pq = Settings.v.particles;
    if (an === 'smoke') {
      const c = ((at / 5.2) % 1);
      if (c > 0.38 && c < 0.62 && Math.random() < dt * 9 * pq) Fx.parts.push({ x: p.x + ca * 0.16, y: p.y + sa * 0.16, z: 1.62, vx: ca * 0.35 + R.f(-0.05, 0.05), vy: sa * 0.35 + R.f(-0.05, 0.05), vz: 0.12, life: 1.5, max: 1.5, col: '#c8c8c8', size: R.f(1.5, 3), smoke: true });
    } else if (an === 'chop') {
      if (hit(1.2, 0)) Fx.shards(p.x + ca * 0.95, p.y + sa * 0.95, 0.85, 5, '#c8a070');
    } else if (an === 'dig') {
      if (hit(2.1, 0.76 * 2.1)) Fx.shards(p.x + ca * 0.45 + rx * 0.45, p.y + sa * 0.45 + ry * 0.45, 0.7, 5, '#5a4632');
      if (hit(2.1, 0.12 * 2.1)) Fx.shards(p.x + ca * 0.7, p.y + sa * 0.7, 0.05, 3, '#6a5440');
    } else if (an === 'smash') {
      if (hit(1.6, 0.56 * 1.6)) Fx.shards(p.x + ca * 0.95, p.y + sa * 0.95, 0.35, 6, '#8a8278');
    } else if (an === 'saw') {
      if (Math.random() < dt * 7 * pq) Fx.shards(p.x + ca * 0.55, p.y + sa * 0.55, 0.65, 1, '#e0c890');
    } else if (an === 'pour' && Math.random() < dt * 24 * pq) {
      const wc = a.prop === 'wcan', k = wc ? 0.75 : 0.62, z = wc ? 0.72 : 0.78;
      Fx.parts.push({ x: p.x + ca * k + R.f(-0.02, 0.02), y: p.y + sa * k + R.f(-0.02, 0.02), z, vx: ca * 0.5, vy: sa * 0.5, vz: -0.2, life: 0.6, max: 0.6, col: wc ? '#9cc4f0' : '#d8c070', size: R.f(1, 1.8), g: true });
    }
  },
};
