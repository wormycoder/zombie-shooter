'use strict';
// ---------------------------------------------------------------------------
// Main menu, character creation, options
// ---------------------------------------------------------------------------
const Menu = {
  bg: null, t: 0,
  init() {},
  buildBackground() {
    if (this.bgWorld) { World.use(this.bgWorld); return; }
    const seed = (Math.random() * 1e9) | 0;
    this.bgWorld = MapGen.generate(seed);
    World.use(this.bgWorld);
    G.zombies = []; G.cars = []; G.events = { powerOff: false, waterOff: false }; G.alarms = [];
    Vehicles.spawnAll();
    this.cam = { x: 95, y: 100 };
    this.plan();
  },
  // The dead behind the menus follow routes worked out once: out along a few clear stretches and back the same way,
  // round and round; a few just stand. Nothing is simulated - each position follows from the clock.
  plan() {
    const ok = (x, y) => !World.tileSolid(x | 0, y | 0) && !World.isWater(x | 0, y | 0) && World.room(x | 0, y | 0) < 0;
    const W = this.walkers = [];
    for (let tries = 0; W.length < 70 && tries < 6000; tries++) {
      const x = 62 + Math.random() * 116, y = 88 + Math.random() * 70;
      if (!ok(x, y)) continue;
      const pts = [[x, y]];
      let a = Math.random() * 6.283;
      for (let k = 0; k < 6; k++) {
        const [px, py] = pts[pts.length - 1];
        let found = false;
        for (let t = 0; t < 8 && !found; t++) {
          const b = a + (Math.random() - 0.5) * 2.2, l = 2 + Math.random() * 5, qx = px + Math.cos(b) * l, qy = py + Math.sin(b) * l;
          if (ok(qx, qy) && World.lineClear(px, py, qx, qy, 'move')) { pts.push([qx, qy]); a = b; found = true; }
        }
        if (!found) break;
      }
      const z = Zombie.create(x, y);
      z.st = 'wander'; z.idleT = 1e9; z.va = 1; z.amp = 0;
      if (pts.length > 1 && Math.random() < 0.85) {
        // out and back: p0 .. pn .. p1, closing on p0
        const P = pts.concat(pts.slice(1, -1).reverse()), cum = [0];
        for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length]; cum.push(cum[i] + Math.hypot(B[0] - A[0], B[1] - A[1])); }
        z.route = { P, cum, len: cum[P.length], sp: 0.28 + Math.random() * 0.2, off: Math.random() * cum[P.length] };
      }
      W.push(z);
    }
    G.zombies = W;
  },
  // everyone to where the clock puts them on their route, facing the way they walk
  walk(dt) {
    for (const z of this.walkers || []) {
      const r = z.route;
      if (!r) continue;
      const d = (this.t * r.sp + r.off) % r.len, c = r.cum;
      let i = 0; while (i < r.P.length - 1 && c[i + 1] <= d) i++;
      const A = r.P[i], B = r.P[(i + 1) % r.P.length], f = (d - c[i]) / ((c[i + 1] - c[i]) || 1);
      const x = A[0] + (B[0] - A[0]) * f, y = A[1] + (B[1] - A[1]) * f;
      z.ph += Math.hypot(x - z.x, y - z.y) * 3.6; z.x = x; z.y = y; z.amp = 0.75;
      z.a = U.normAng(z.a + U.clamp(U.angDiff(z.a, Math.atan2(B[1] - A[1], B[0] - A[0])), -dt * 4, dt * 4));
    }
  },
  // Quality behind the menus: full resolution while it holds 30 frames a second; below that (or with little to
  // spare) a tenth fewer pixels each second, down to half, and back up after 3 s with room to spare.
  q: 1, qT: 0, qN: 0, qMs: 0, qUp: 0,
  tune(ms, dt) {
    if (!Perf.auto) return;
    this.qT += dt; this.qN++; this.qMs += ms;
    if (this.qT < 1) return;
    const fps = this.qN / this.qT, avg = this.qMs / this.qN;
    this.qT = this.qN = this.qMs = 0;
    let q = this.q;
    if (fps < 28 || avg > 26) { q = Math.max(0.5, q - 0.1); this.qUp = 0; }
    else if (avg < 12 && ++this.qUp >= 3) { q = Math.min(1, q + 0.1); this.qUp = 0; }
    q = Math.round(q * 10) / 10;
    if (q !== this.q) { this.q = q; Render.resize(); }
  },
  prepareBg() {
    G.corpse = false;
    Sfx.engine(null); Sfx.heli(null);
    $('#hud').classList.add('hidden');
    UI.closeAll();
    this.buildBackground();
    G.player = { x: this.cam.x, y: this.cam.y, dead: true, inCar: null, st: { panic: 0 }, look: { skin: '#ccc' }, angle: 0, halo: [], deadT: 0 };
    G.weather = { rain: 0, target: 0, fog: 0.15, temp: 20, next: 1e12, storm: false };
    G.events.heli = null; G.alarms = [];
    Render.cam.tz = 1.1;
  },
  show() {
    G.mode = 'menu';
    Versions.mountHome();
    // first visit: put the menu up at once and build the background town right after
    if (this.bgWorld) this.prepareBg(); else requestAnimationFrame(() => requestAnimationFrame(() => { if (G.mode === 'menu' && !this.bgWorld) this.prepareBg(); }));
    const meta = Save.meta();
    $('#menu').className = '';
    // title screen: the name at the top left, the menu as plain words down the left side
    $('#menu').innerHTML = `<div class="modal title"><div class="tlogo">
      <div class="logo">HOLLOW CREEK</div>
      <div class="tag">There is no cure. There is no rescue.<br>There is only how long you last.</div>${GL3D.ok() ? '' : '<div class="tag" style="color:#f99">This browser has no WebGL, which the game needs to draw its characters. Try a current Chrome, Edge or Firefox.</div>'}</div>
      <div class="tmenu">
      ${meta ? `<div class="tm" data-m="continue">Continue<span class="tsub">${U.esc(meta.name)} · Day ${meta.day}, ${meta.time}</span></div>` : ''}
      <div class="tm" data-m="new">New Game</div>
      <div class="tm" data-m="options">Settings</div>
      <div class="tm" data-m="controls">How to Play</div>
      <div class="foot">An isometric zombie survival sandbox · all art and audio generated procedurally</div></div>
    </div>`;
    $('#menu').onclick = (e) => {
      Sfx.init();
      const b = e.target.closest('[data-m]'); if (!b) return;
      Sfx.play('pickup');
      const k = b.dataset.m;
      if (k === 'new') { if (!meta || confirm('Starting a new game will erase your current save. Continue?')) this.sandbox(); }
      if (k === 'continue') this.load();
      if (k === 'options') this.options(false);
      if (k === 'controls') this.controls(false);
    };
  },
  load() {
    $('#menu').innerHTML = '<div class="modal loading"><div class="ltext">Loading...</div></div>';
    setTimeout(async () => {
      try {
        const ok = await Save.load();
        if (!ok) { this.show(); return; }
        this.bgWorld = null;
        UI.startGame();
        UI.toast('Welcome back.');
      } catch (e) { console.error(e); alert('Failed to load save: ' + e.message); this.show(); }
    }, 30);
  },
  drawBackground(dt) {
    if (!this.bgWorld || Wd !== this.bgWorld) { Render.ctx.setTransform(1, 0, 0, 1, 0, 0); Render.ctx.fillStyle = '#000'; Render.ctx.fillRect(0, 0, Render.cv.width, Render.cv.height); return; }
    this.t += dt;
    const k = (Math.sin(this.t * 0.012) + 1) / 2;
    this.cam.x = U.lerp(70, 170, k); this.cam.y = U.lerp(95, 150, (Math.cos(this.t * 0.009) + 1) / 2);
    Render.cam.x = this.cam.x; Render.cam.y = this.cam.y; Render.cam.z = 0;
    G.player.x = this.cam.x; G.player.y = this.cam.y;
    G.light.amb = 0.38; G.light.flash = 0; G.time = 20.6 * 60;
    this.walk(dt);
    const t0 = performance.now();
    Render.frame(dt);
    this.tune(performance.now() - t0, dt);
    this.shade();
  },
  shade() {
    Render.ctx.setTransform(Render.dpr, 0, 0, Render.dpr, 0, 0);
    Render.ctx.fillStyle = 'rgba(0,0,0,0.35)'; Render.ctx.fillRect(0, 0, Render.W, Render.H);
  },
  // ------------------------------------------------------------------ sandbox settings
  sbSel: null, spawnSel: 'Random',
  sandbox() {
    this.sbSel = this.sbSel || Object.assign({}, SANDBOX_PRESETS.Apocalypse);
    const sel = this.sbSel;
    const rows = Object.keys(SANDBOX_OPTS).map(k => {
      const o = SANDBOX_OPTS[k], cur = sel[k] === undefined ? o.def : sel[k];
      return `<div class="opt"><span>${o.n}</span><select data-sb="${k}">${o.opts.map((op, i) => `<option value="${i}" ${i === cur ? 'selected' : ''}>${op[0]}</option>`).join('')}</select></div>`;
    }).join('');
    const presets = Object.keys(SANDBOX_PRESETS).map(n => `<span class="btn sm" data-preset="${n}">${n}</span>`).join('');
    // where to start
    const places = ['Random'].concat(Game.SPAWN_ORDER);
    if (!places.includes(this.spawnSel)) this.spawnSel = 'Random';
    const opt = (v, n, on) => `<option value="${v}" ${on ? 'selected' : ''}>${n}</option>`;
    const mapRows = `<div class="opt"><span>Starting location</span><select data-spawn="1">${places.map(n => opt(n, n, n === this.spawnSel)).join('')}</select></div>`;
    $('#menu').innerHTML = `<div class="modal"><div class="mbox"><h2>World settings</h2>
      ${mapRows}
      <div class="sml" style="margin-bottom:6px">Presets</div><div style="margin-bottom:10px">${presets}</div>
      ${rows}
      <div class="sml" style="margin:8px 0 4px;max-width:360px">Sprinters run as fast as you do. Shorter days make hunger, thirst and fatigue tick faster in real time.</div>
      <div class="cfoot" style="padding:8px 0 0;border:0"><span class="btn" data-m="back">Back</span><span class="btn big" data-m="next">Next</span></div></div></div>`;
    const m = $('#menu');
    m.onchange = (e) => {
      const k = e.target.dataset.sb; if (k) sel[k] = +e.target.value;
      if (e.target.dataset.spawn) this.spawnSel = e.target.value;
    };
    m.oninput = null;
    m.onclick = (e) => {
      const pr = e.target.closest('[data-preset]');
      if (pr) { this.sbSel = Object.assign({}, SANDBOX_PRESETS[pr.dataset.preset]); this.sandbox(); return; }
      const b = e.target.closest('[data-m]'); if (!b) return;
      if (b.dataset.m === 'back') this.show();
      if (b.dataset.m === 'next') this.create();
    };
  },
  // ------------------------------------------------------------------ character creation
  cfg: null,
  // build the game world in the background while the player designs a character
  pregen(sb) {
    const size = Game.WORLD_SIZE, key = JSON.stringify(sb) + size;
    if (this.pre && this.pre.key === key) return;
    this.pre = null;
    setTimeout(() => {
      if (G.mode !== 'create') return;
      const keep = Wd, sb0 = G.sb;
      G.sb = sb;
      const seed = (Math.random() * 1e9) | 0;
      const w = MapGen.generate(seed, size);
      G.sb = sb0;
      World.use(keep);
      this.pre = { key, seed, w };
    }, 400);
  },
  create() {
    if (!this.bgWorld || Wd !== this.bgWorld) this.prepareBg();
    G.mode = 'create';
    this.pregen(sandboxValues(this.sbSel || {}));
    const r = R;
    const female = r.chance(0.5);
    this.cfg = this.cfg || {
      name: r.pick(FIRST_NAMES) + ' ' + r.pick(LAST_NAMES),
      occ: 'unemployed', traits: [],
      look: { female, skin: r.pick(SKIN_TONES), hair: r.pick(HAIR_COLS), hairStyle: female ? r.pick(['long', 'ponytail', 'short']) : r.pick(['short', 'buzz', 'messy']), shirtCol: r.pick(TSHIRT_COLS), pantsCol: '#3a5a8a' },
    };
    this.renderCreate();
  },
  points() {
    const occ = OCCUPATIONS.find(o => o.id === this.cfg.occ);
    let p = occ.pts;
    for (const t of this.cfg.traits) p += traitDef(t).cost;
    return p;
  },
  renderCreate() {
    const c = this.cfg;
    const pts = this.points();
    const sw = (list, key, cur) => list.map(col => `<span class="sw ${col === cur ? 'on' : ''}" data-look="${key}" data-v="${col}" style="background:${col}"></span>`).join('');
    const occRows = OCCUPATIONS.map(o => `<div class="orow ${o.id === c.occ ? 'on' : ''}" data-occ="${o.id}"><span>${o.n}</span><span class="pts ${o.pts >= 0 ? 'pos' : 'neg'}">${o.pts > 0 ? '+' : ''}${o.pts}</span></div>`).join('');
    const occ = OCCUPATIONS.find(o => o.id === c.occ);
    const occSk = Object.keys(occ.sk).map(s => '+' + occ.sk[s] + ' ' + SKILL_NAMES[s]).join(', ');
    const blocked = (t) => c.traits.some(x => { const d = traitDef(x); return (d.ex && d.ex.includes(t.id)) || (t.ex && t.ex.includes(x)); });
    const trRow = (t) => `<div class="trow ${blocked(t) ? 'dis' : ''} ${t.cost < 0 ? 'pos' : 'neg'}" data-tr="${t.id}" title="${U.esc(t.desc)}"><span>${t.n}</span><span class="pts">${t.cost > 0 ? '+' : ''}${t.cost}</span></div>`;
    const avail = TRAITS.filter(t => !c.traits.includes(t.id));
    const chosen = c.traits.map(id => traitDef(id));
    $('#menu').innerHTML = `<div class="modal create"><div class="cbox">
      <div class="chead"><span>Create your survivor</span></div>
      <div class="ccols">
        <div class="ccol">
          <div class="lbl2">Name</div><div class="nrow"><input id="cname" value="${U.esc(c.name)}" maxlength="24"><span class="btn sm" data-c="rname">Random</span></div>
          <div class="lbl2">Body</div><div class="nrow"><span class="btn sm ${!c.look.female ? 'on' : ''}" data-c="male">Male</span><span class="btn sm ${c.look.female ? 'on' : ''}" data-c="female">Female</span></div>
          <div class="lbl2">Skin</div><div class="sws">${sw(SKIN_TONES, 'skin', c.look.skin)}</div>
          <div class="lbl2">Hair</div><div class="sws">${sw(HAIR_COLS, 'hair', c.look.hair)}</div>
          <div class="nrow">${HAIR_STYLES.map(h => `<span class="btn xs ${h === c.look.hairStyle ? 'on' : ''}" data-look="hairStyle" data-v="${h}">${h}</span>`).join('')}</div>
          ${c.look.female ? '' : `<div class="nrow">${BEARDS.map(h => `<span class="btn xs ${h === (c.look.beard || 'none') ? 'on' : ''}" data-look="beard" data-v="${h}">${h === 'none' ? 'no beard' : h}</span>`).join('')}</div>`}
          <div class="lbl2">Shirt</div><div class="sws">${sw(TSHIRT_COLS, 'shirtCol', c.look.shirtCol)}</div>
          <canvas id="cprev" width="180" height="200"></canvas>
        </div>
        <div class="ccol">
          <div class="lbl2">Occupation</div><div class="olist">${occRows}</div>
          <div class="odesc"><b>${occ.n}</b><br>${U.esc(occ.desc)}${occSk ? '<br><span class="sml">' + occSk + '</span>' : ''}</div>
        </div>
        <div class="ccol wide">
          <div class="tcols">
            <div><div class="lbl2">Available traits</div><div class="tlist">${avail.filter(t => t.cost < 0).map(trRow).join('')}<div class="tsep"></div>${avail.filter(t => t.cost > 0).map(trRow).join('')}</div></div>
            <div><div class="lbl2">Chosen traits</div><div class="tlist chosen">${chosen.map(t => `<div class="trow ${t.cost < 0 ? 'pos' : 'neg'}" data-un="${t.id}" title="${U.esc(t.desc)}"><span>${t.n}</span><span class="pts">${t.cost > 0 ? '+' : ''}${t.cost}</span></div>`).join('') || '<div class="sml" style="padding:8px">Click traits to add them. Negative traits give points.</div>'}</div></div>
          </div>
        </div>
      </div>
      <div class="cfoot"><span class="btn" data-c="back">Back</span><span class="ptsbig ${pts < 0 ? 'bad' : ''}">Points: ${pts}</span><span class="btn big ${pts < 0 ? 'dis' : ''}" data-c="play">Play</span></div>
    </div></div>`;
    const inp = $('#cname');
    inp.oninput = () => { c.name = inp.value; };
    $('#menu').onclick = (e) => {
      const t = e.target;
      const a = t.closest('[data-c]');
      if (a) {
        const k = a.dataset.c;
        if (k === 'rname') c.name = R.pick(FIRST_NAMES) + ' ' + R.pick(LAST_NAMES);
        if (k === 'male') { c.look.female = false; if (['long', 'ponytail', 'bun', 'bob'].includes(c.look.hairStyle)) c.look.hairStyle = 'short'; }
        if (k === 'female') { c.look.female = true; }
        if (k === 'back') { this.sandbox(); return; }
        if (k === 'play') { if (this.points() >= 0) this.start(); return; }
        this.renderCreate(); return;
      }
      const lk = t.closest('[data-look]');
      if (lk) { c.look[lk.dataset.look] = lk.dataset.v; this.renderCreate(); return; }
      const o = t.closest('[data-occ]');
      if (o) { c.occ = o.dataset.occ; this.renderCreate(); return; }
      const tr = t.closest('[data-tr]');
      if (tr && !tr.classList.contains('dis')) { c.traits.push(tr.dataset.tr); this.renderCreate(); return; }
      const un = t.closest('[data-un]');
      if (un) { c.traits = c.traits.filter(x => x !== un.dataset.un); this.renderCreate(); return; }
    };
    this.previewLoop();
  },
  previewLoop() {
    const cv = $('#cprev');
    if (!cv) return;
    const g = cv.getContext('2d');
    const c = this.cfg;
    const look = { skin: c.look.skin, hair: c.look.hair, hairStyle: c.look.hairStyle, beard: c.look.female || c.look.beard === 'none' ? null : c.look.beard, shirt: c.look.shirtCol, sleeves: 'short', pants: c.look.pantsCol, shoes: '#e0e0e0', female: c.look.female };
    const occ = OCCUPATIONS.find(o => o.id === c.occ);
    if (occ && occ.gear) for (const id of occ.gear) { const d = ITEMS[id]; if (d.slot === 'shirt') look.shirt = d.cols[0]; if (d.slot === 'pants') look.pants = d.cols[0]; if (d.slot === 'hat') look.hat = { type: d.hatType, col: d.cols[0] }; if (d.slot === 'shoes') look.shoes = d.cols[0]; }
    const draw = (t) => {
      if (!document.body.contains(cv)) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = 'rgba(255,255,255,0.04)'; g.beginPath(); g.ellipse(90, 170, 60, 22, 0, 0, 7); g.fill();
      g.setTransform(2, 0, 0, 2, 90, 168);
      Char3D.preview(g, 0, 0, t / 1400, look, { t: t / 1000, amp: 0 });
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  },
  start() {
    const cfg = JSON.parse(JSON.stringify(this.cfg));
    if (!cfg.name.trim()) cfg.name = 'Survivor';
    cfg.sb = sandboxValues(this.sbSel || {});
    cfg.spawn = this.spawnSel || 'Random';
    this.cfg = null;
    if (this.pre && this.pre.key === JSON.stringify(cfg.sb) + Game.WORLD_SIZE) { cfg.world = this.pre.w; cfg.seed = this.pre.seed; }
    this.pre = null;
    $('#menu').innerHTML = '<div class="modal loading"><div class="ltext">Generating Hollow Creek...</div></div>';
    setTimeout(() => {
      Save.wipe();
      this.bgWorld = null;
      Game.newGame(cfg);
      UI.startGame();
      this.intro();
    }, 40);
  },
  intro() {
    const m = $('#menu');
    m.innerHTML = `<div class="intro"><div class="itext"><div class="l1">HOLLOW CREEK, KENTUCKY</div><div class="l2">${Game.dateStr()} — ${Game.timeStr()}</div><div class="l3">Three days ago the first cases appeared.<br>Yesterday the army sealed the county.<br>Today, no one is coming.</div></div></div>`;
    const el = m.querySelector('.intro');
    G.paused = true;
    const end = () => { if (!el.parentNode) return; el.classList.add('fade'); G.paused = false; setTimeout(() => { if (el.parentNode) el.remove(); }, 1500); };
    el.onclick = end;
    setTimeout(end, 6500);
  },
  // ------------------------------------------------------------------ options & controls
  // Settings screen: Optimization / Display / Audio / Controls / Experimental tabs
  setTab: 'opt',
  options(inGame) {
    const m = $('#menu');
    const v = Sfx.vol, S = Settings.v, pn = Settings.presetName(), tab = this.setTab;
    clearInterval(this.liveT);
    let lastGrp = null;
    const rows = (t) => Object.keys(SETTINGS_OPTS).filter(k => SETTINGS_OPTS[k].tab === t).map(k => {
      const g = SETTINGS_OPTS[k].grp, head = g && g !== lastGrp ? `<div class="sml" style="margin:10px 0 3px;color:var(--dim);letter-spacing:1px;text-transform:uppercase;font-size:10px">${g}</div>` : '';
      lastGrp = g;
      return head + row(k);
    }).join('');
    const row = (k) => {
      const o = SETTINGS_OPTS[k], na = k === 'chars3d' && !GL3D.ok();
      const tip = (o.tip || '') + (na ? ' WebGL is missing in this browser, so the characters cannot be drawn.' : '');
      return `<div class="opt" data-tip="${tip}"><span>${o.n}${na ? ' <span style="color:var(--dim);font-size:11px">(unavailable: no GPU)</span>' : ''}</span><select data-set="${k}">${o.opts.map((op, i) => `<option value="${i}" ${op[1] === S[k] ? 'selected' : ''}>${op[0]}</option>`).join('')}</select></div>`;
    };
    const presets = `<div class="sml" style="margin:2px 0 6px">Quality preset${pn ? '' : ' (custom)'}</div><div style="margin-bottom:10px">` + Object.keys(SETTINGS_PRESETS).map(n => `<span class="btn sm${n === pn ? ' on' : ''}" data-gpre="${n}">${n}</span>`).join('') + '</div>';
    const tabs = [['opt', 'Optimization'], ['display', 'Display'], ['audio', 'Audio'], ['controls', 'Controls'], ['exp', 'Experimental']]
      .map(([k, n]) => `<span class="btn sm${k === tab || (k === 'opt' && tab === 'report') ? ' on' : ''}" data-tab="${k}">${n}</span>`).join('');
    let body = '';
    if (tab === 'report') body = `<div class="sml" style="margin:2px 0 6px">Performance report: copy it and send it along with a description of what was slow.</div>
      <textarea id="perfRep" readonly spellcheck="false" style="width:100%;height:300px;box-sizing:border-box;background:rgba(0,0,0,0.35);color:var(--text);border:1px solid rgba(255,255,255,0.12);font:11px/1.45 Consolas,monospace;padding:6px;resize:vertical">${U.esc(Perf.report())}</textarea>
      <div style="margin-top:6px"><span class="btn sm" data-prep="copy">Copy to clipboard</span><span class="btn sm" data-prep="again">Refresh</span><span class="sml" id="perfRepMsg" style="margin-left:8px;color:#9be08a"></span></div>`;
    else if (tab === 'opt') body = presets
      + `<div class="opt" style="align-items:center"><span id="optLive" style="font:12px Consolas,monospace;color:var(--text)">${this.liveText()}</span><span><span class="btn sm" data-opick="1" data-tip="Measures how the game has been running on this machine (play a little first, ideally somewhere busy) and picks the preset that keeps it smooth.">Pick for me</span><span class="btn sm" data-tab="report" data-tip="A plain-text summary of frame times, graphics card, screen and settings to copy and send.">Performance report</span><span class="btn sm" data-bench="1" data-tip="Runs each quality preset from a light to an ultra heavy load (about a minute) and recommends a preset for this computer.${inGame ? ' From the title screen only.' : ''}">Benchmark</span></span></div><div class="sml" id="optMsg" style="color:#9be08a;min-height:14px"></div>`
      + `<div style="max-height:360px;overflow-y:auto;padding-right:6px">${rows('opt')}</div><div class="sml" id="setTip" style="min-height:42px;margin-top:8px;color:var(--dim)"></div>`;
    else if (tab === 'display') body = presets + rows('display') + `<div class="sml" id="setTip" style="min-height:42px;margin-top:8px;color:var(--dim)"></div>`;
    else if (tab === 'exp') body = `<div class="sml" style="margin:2px 0 4px;color:#d8b070">Beta: these options are still being worked on. They may change, run slower or not carry over to later versions.</div>` + rows('exp') + `<div class="sml" id="setTip" style="min-height:42px;margin-top:8px;color:var(--dim)"></div>`;
    else if (tab === 'audio') body = `<div class="opt"><span>Master volume</span><input type="range" min="0" max="1" step="0.05" value="${v.master}" data-v="master"></div>
      <div class="opt"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-v="sfx"></div>
      <div class="opt"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${v.music}" data-v="music"></div>`;
    else body = `<div class="ctrls">${this.controlRows().map(r => `<div><kbd>${r[0]}</kbd><span>${r[1]}</span></div>`).join('')}</div>`;
    m.innerHTML = `<div class="modal ${inGame ? 'pausing' : ''}"><div class="mbox wide"><h2>Settings</h2>
      <div style="margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px">${tabs}</div>
      <div style="min-height:330px">${body}</div>
      <div class="btn big" data-m="back">Back</div></div></div>`;
    if (tab === 'opt') this.liveT = setInterval(() => { const el = $('#optLive'); if (!el) { clearInterval(this.liveT); return; } el.textContent = this.liveText(); }, 500);
    m.oninput = (e) => { const k = e.target.dataset.v; if (k) { Sfx.init(); Sfx.setVol(k, +e.target.value); try { localStorage.setItem('hc_vol', JSON.stringify(Sfx.vol)); } catch (er) { /* */ } } };
    m.onchange = (e) => {
      const k = e.target.dataset.set;
      if (!k) return;
      Settings.set(k, SETTINGS_OPTS[k].opts[+e.target.value][1]);
      this.options(inGame);
    };
    m.onmouseover = (e) => { const r = e.target.closest('.opt[data-tip], [data-tab][data-tip]'); const tip = $('#setTip'); if (tip) tip.textContent = r ? r.dataset.tip : ''; };
    m.onclick = (e) => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { this.setTab = tb.dataset.tab; this.options(inGame); return; }
      const pr = e.target.closest('[data-prep]');
      if (pr) {
        const ta = $('#perfRep'), msg = $('#perfRepMsg');
        if (pr.dataset.prep === 'again') { ta.value = Perf.report(); return; }
        const done = () => { if (msg) msg.textContent = 'Copied'; };
        try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); document.execCommand('copy'); done(); }); } catch (er) { ta.select(); document.execCommand('copy'); done(); }
        return;
      }
      if (e.target.closest('[data-bench]')) { if (inGame) { const el = $('#optMsg'); if (el) el.textContent = 'The benchmark runs from the title screen: save and quit first.'; } else { clearInterval(this.liveT); Bench.start(); } return; }
      if (e.target.closest('[data-opick]')) { const msg = this.pickPreset(); this.options(inGame); const el = $('#optMsg'); if (el) el.textContent = msg; return; }
      const gp = e.target.closest('[data-gpre]');
      if (gp) { Settings.usePreset(gp.dataset.gpre); this.options(inGame); return; }
      const b = e.target.closest('[data-m]'); if (!b) return;
      if (inGame) { m.innerHTML = ''; UI.togglePause(); } else this.show();
    };
  },
  // live frame statistics on the Optimization tab
  liveText() {
    const st = Perf.stats();
    if (!st || Perf.n < 30) return 'Play for a few seconds to see live numbers here.';
    return `${Math.round(1000 / st.avg)} FPS · frame ${st.avg.toFixed(1)} ms (worst 1% ${st.p99.toFixed(0)}) · render ${st.r.toFixed(1)} · simulation ${st.s.toFixed(1)} · UI ${st.u.toFixed(1)} ms` + (Settings.v.dynRes ? ` · resolution ${Math.round(Perf.scale * 100)}%` : '');
  },
  // preset from the measured median frame rate
  pickPreset() {
    const st = Perf.stats();
    if (!st || Perf.n < 120) return 'Play for a few seconds first (somewhere busy if you can), then press Pick for me again.';
    const fps = 1000 / st.p50, cur = Settings.presetName();
    let name = fps < 28 ? 'Low' : fps < 45 ? 'Medium' : 'Auto';
    // already smooth on a heavier preset: keep it
    if (fps >= 57 && (cur === 'High' || cur === 'Ultra')) name = cur;
    // smooth on a light preset: step up one
    if (fps >= 57 && cur === 'Low') name = 'Medium';
    Settings.usePreset(name);
    return `Measured ${Math.round(fps)} FPS (median of the last ${Perf.n} frames) — ${name} preset applied.`;
  },
  controlRows() {
    return [
      ['W A S D', 'Move'], ['Shift', 'Run'], ['Alt / X', 'Sprint'], ['C', 'Toggle sneaking'], ['Mouse', 'Look / face direction'],
      ['Right mouse (hold)', 'Aim'], ['Left mouse', 'Attack / shoot'], ['Space', 'Shove (stomp a downed zombie)'], ['R', 'Reload'],
      ['Right click (tap)', 'Context menu on doors, windows, furniture, ground'], ['E', 'Open doors & windows, climb, enter/exit cars, loot'],
      ['F', 'Toggle flashlight / headlights'], ['Q', 'Shout (attracts zombies) / horn'], ['Z', 'Sit down and rest'], ['V', 'Radial menu: vehicle controls / quick actions'],
      ['I or Tab', 'Inventory & loot'], ['H', 'Health'], ['B', 'Crafting & building'], ['K', 'Character & skills'], ['M', 'Map'],
      ['1 - 4', 'Hotbar: draw or put away the item in that slot'], ['Mouse wheel', 'Zoom'], ['P / , / .', 'Pause / slower / faster time'], ['Esc', 'Menu / cancel'],
      ['Ctrl + click item', 'Add to / remove from the selection'], ['Shift + click item', 'Select a range of items'], ['Double-click item', 'Use / equip / take'], ['Drag items', 'Move between containers, onto a hotbar slot, or onto the world to drop them'],
    ];
  },
  controls(inGame) {
    const m = $('#menu');
    const rows = this.controlRows();
    m.innerHTML = `<div class="modal ${inGame ? 'pausing' : ''}"><div class="mbox wide"><h2>How to play</h2>
      <div class="ctrls">${rows.map(r => `<div><kbd>${r[0]}</kbd><span>${r[1]}</span></div>`).join('')}</div>
      <div class="sml" style="margin:10px 0">Survive as long as you can. Watch your status icons (right side). Eat, drink and sleep. Zombies hunt by sight and sound — noise travels, light gives you away at night. Bites are fatal. Barricade, scavenge, and keep moving. The power and water will not last.</div>
      <div class="sml" style="margin:0 0 10px">Survival tips: upstairs rooms are safer — smash the stairs with a sledgehammer and come and go by a sheet rope tied to a window (or jump, and hurt your legs). Fire spreads: keep water or an extinguisher handy, and never leave food burning on the stove. Winter is cold in a house without power — find a coat, light a fire. Baited traps in the woods catch small game while you're away.</div>
      <div class="btn big" data-m="back">Back</div></div></div>`;
    m.onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; if (inGame) { m.innerHTML = ''; UI.togglePause(); } else this.show(); };
  },
};
