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
    Zombie.spawnAll(-500, -500);
    for (const z of G.zombies) { z.va = 1; if (Math.random() < 0.3) { z.st = 'wander'; } }
    Zombie.rebuildGrid();
    Vehicles.spawnAll();
    this.path = [[70, 70], [170, 160]];
    this.cam = { x: 95, y: 100 };
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
    // first visit: put the menu up at once and build the background town right after
    if (this.bgWorld) this.prepareBg(); else requestAnimationFrame(() => requestAnimationFrame(() => { if (G.mode === 'menu' && !this.bgWorld) this.prepareBg(); }));
    const meta = Save.meta();
    $('#menu').className = '';
    $('#menu').innerHTML = `<div class="modal title"><div class="tbox">
      <div class="logo">HOLLOW CREEK</div>
      <div class="tag">There is no cure. There is no rescue.<br>There is only how long you last.</div>
      ${meta ? `<div class="btn big" data-m="continue">Continue <span class="sml">— ${U.esc(meta.name)}, Day ${meta.day} ${meta.time}</span></div>` : ''}
      <div class="btn big" data-m="new">New Game</div>
      <div class="btn big" data-m="options">Settings</div>
      <div class="btn big" data-m="controls">How to Play</div>
      <div class="foot">An isometric zombie survival sandbox · all art and audio generated procedurally</div>
    </div></div>`;
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
    Zombie.updateAll(dt);
    for (const z of G.zombies) z.va = 1;
    Render.frame(dt);
    Render.ctx.setTransform(Render.dpr, 0, 0, Render.dpr, 0, 0);
    Render.ctx.fillStyle = 'rgba(0,0,0,0.35)'; Render.ctx.fillRect(0, 0, Render.W, Render.H);
  },
  // ------------------------------------------------------------------ sandbox settings
  sbSel: null,
  sandbox() {
    this.sbSel = this.sbSel || Object.assign({}, SANDBOX_PRESETS.Apocalypse);
    const sel = this.sbSel;
    const rows = Object.keys(SANDBOX_OPTS).map(k => {
      const o = SANDBOX_OPTS[k], cur = sel[k] === undefined ? o.def : sel[k];
      return `<div class="opt"><span>${o.n}</span><select data-sb="${k}">${o.opts.map((op, i) => `<option value="${i}" ${i === cur ? 'selected' : ''}>${op[0]}</option>`).join('')}</select></div>`;
    }).join('');
    const presets = Object.keys(SANDBOX_PRESETS).map(n => `<span class="btn sm" data-preset="${n}">${n}</span>`).join('');
    $('#menu').innerHTML = `<div class="modal"><div class="mbox"><h2>World settings</h2>
      <div class="sml" style="margin-bottom:6px">Presets</div><div style="margin-bottom:10px">${presets}</div>
      ${rows}
      <div class="sml" style="margin:8px 0 4px;max-width:360px">Sprinters run as fast as you do. Shorter days make hunger, thirst and fatigue tick faster in real time.</div>
      <div class="cfoot" style="padding:8px 0 0;border:0"><span class="btn" data-m="back">Back</span><span class="btn big" data-m="next">Next</span></div></div></div>`;
    const m = $('#menu');
    m.onchange = (e) => { const k = e.target.dataset.sb; if (k) sel[k] = +e.target.value; };
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
    const key = JSON.stringify(sb);
    if (this.pre && this.pre.key === key) return;
    this.pre = null;
    setTimeout(() => {
      if (G.mode !== 'create') return;
      const keep = Wd, sb0 = G.sb;
      G.sb = sb;
      const seed = (Math.random() * 1e9) | 0;
      const w = MapGen.generate(seed);
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
        if (k === 'male') { c.look.female = false; if (['long', 'ponytail'].includes(c.look.hairStyle)) c.look.hairStyle = 'short'; }
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
    const look = { skin: c.look.skin, hair: c.look.hair, hairStyle: c.look.hairStyle, shirt: c.look.shirtCol, sleeves: 'short', pants: c.look.pantsCol, shoes: '#e0e0e0', female: c.look.female };
    const occ = OCCUPATIONS.find(o => o.id === c.occ);
    if (occ && occ.gear) for (const id of occ.gear) { const d = ITEMS[id]; if (d.slot === 'shirt') look.shirt = d.cols[0]; if (d.slot === 'pants') look.pants = d.cols[0]; if (d.slot === 'hat') look.hat = { type: d.hatType, col: d.cols[0] }; if (d.slot === 'shoes') look.shoes = d.cols[0]; }
    const draw = (t) => {
      if (!document.body.contains(cv)) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = 'rgba(255,255,255,0.04)'; g.beginPath(); g.ellipse(90, 170, 60, 22, 0, 0, 7); g.fill();
      g.setTransform(2, 0, 0, 2, 90, 168);
      Humanoid.draw(g, 0, 0, t / 1400, look, { t: t / 1000, amp: 0 }, 1);
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  },
  start() {
    const cfg = JSON.parse(JSON.stringify(this.cfg));
    if (!cfg.name.trim()) cfg.name = 'Survivor';
    cfg.sb = sandboxValues(this.sbSel || {});
    this.cfg = null;
    if (this.pre && this.pre.key === JSON.stringify(cfg.sb)) { cfg.world = this.pre.w; cfg.seed = this.pre.seed; }
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
  // Settings screen: Display / Performance / Audio / Controls tabs
  setTab: 'display',
  options(inGame) {
    const m = $('#menu');
    const v = Sfx.vol, S = Settings.v, pn = Settings.presetName(), tab = this.setTab;
    const rows = (t) => Object.keys(SETTINGS_OPTS).filter(k => SETTINGS_OPTS[k].tab === t).map(k => {
      const o = SETTINGS_OPTS[k];
      return `<div class="opt" data-tip="${o.tip || ''}"><span>${o.n}</span><select data-set="${k}">${o.opts.map((op, i) => `<option value="${i}" ${op[1] === S[k] ? 'selected' : ''}>${op[0]}</option>`).join('')}</select></div>`;
    }).join('');
    const presets = `<div class="sml" style="margin:2px 0 6px">Quality preset${pn ? '' : ' (custom)'}</div><div style="margin-bottom:10px">` + Object.keys(SETTINGS_PRESETS).map(n => `<span class="btn sm" data-gpre="${n}" style="${n === pn ? 'border-color:#c8b070;color:#f0e0b0;background:rgba(200,176,112,0.18)' : ''}">${n}</span>`).join('') + '</div>';
    const tabs = [['display', 'Display'], ['perf', 'Performance'], ['audio', 'Audio'], ['controls', 'Controls']]
      .map(([k, n]) => `<span class="btn sm" data-tab="${k}" style="${k === tab ? 'border-color:#c8b070;color:#f0e0b0;background:rgba(200,176,112,0.18)' : ''}">${n}</span>`).join('');
    let body = '';
    if (tab === 'display' || tab === 'perf') body = presets + rows(tab) + `<div class="sml" id="setTip" style="min-height:42px;margin-top:8px;color:#a89c80"></div>`;
    else if (tab === 'audio') body = `<div class="opt"><span>Master volume</span><input type="range" min="0" max="1" step="0.05" value="${v.master}" data-v="master"></div>
      <div class="opt"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-v="sfx"></div>
      <div class="opt"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${v.music}" data-v="music"></div>`;
    else body = `<div class="ctrls">${this.controlRows().map(r => `<div><kbd>${r[0]}</kbd><span>${r[1]}</span></div>`).join('')}</div>`;
    m.innerHTML = `<div class="modal ${inGame ? 'pausing' : ''}"><div class="mbox wide"><h2>Settings</h2>
      <div style="margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px">${tabs}</div>
      <div style="min-height:330px">${body}</div>
      <div class="btn big" data-m="back">Back</div></div></div>`;
    m.oninput = (e) => { const k = e.target.dataset.v; if (k) { Sfx.init(); Sfx.setVol(k, +e.target.value); try { localStorage.setItem('hc_vol', JSON.stringify(Sfx.vol)); } catch (er) { /* */ } } };
    m.onchange = (e) => {
      const k = e.target.dataset.set;
      if (!k) return;
      Settings.set(k, SETTINGS_OPTS[k].opts[+e.target.value][1]);
      this.options(inGame);
    };
    m.onmouseover = (e) => { const r = e.target.closest('.opt[data-tip]'); const tip = $('#setTip'); if (tip) tip.textContent = r ? r.dataset.tip : ''; };
    m.onclick = (e) => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { this.setTab = tb.dataset.tab; this.options(inGame); return; }
      const gp = e.target.closest('[data-gpre]');
      if (gp) { Settings.usePreset(gp.dataset.gpre); this.options(inGame); return; }
      const b = e.target.closest('[data-m]'); if (!b) return;
      if (inGame) { m.innerHTML = ''; UI.togglePause(); } else this.show();
    };
  },
  controlRows() {
    return [
      ['W A S D', 'Move'], ['Shift', 'Run'], ['Alt / X', 'Sprint'], ['C', 'Toggle sneaking'], ['Mouse', 'Look / face direction'],
      ['Right mouse (hold)', 'Aim'], ['Left mouse', 'Attack / shoot'], ['Space', 'Shove (stomp a downed zombie)'], ['R', 'Reload'],
      ['Right click (tap)', 'Context menu on doors, windows, furniture, ground'], ['E', 'Open doors & windows, climb, enter/exit cars, loot'],
      ['F', 'Toggle flashlight / headlights'], ['Q', 'Shout (attracts zombies) / horn'], ['Z', 'Sit down and rest'], ['V', 'Radial menu: vehicle controls / quick actions'],
      ['I or Tab', 'Inventory & loot'], ['H', 'Health'], ['B', 'Crafting & building'], ['K', 'Character & skills'], ['M', 'Map'],
      ['1 - 5', 'Hotbar'], ['Mouse wheel', 'Zoom'], ['P / , / .', 'Pause / slower / faster time'], ['Esc', 'Menu / cancel'],
      ['Shift + click item', 'Quick transfer'], ['Double-click item', 'Use / equip / take'], ['Drag item', 'Move between containers'],
    ];
  },
  controls(inGame) {
    const m = $('#menu');
    const rows = this.controlRows();
    m.innerHTML = `<div class="modal ${inGame ? 'pausing' : ''}"><div class="mbox wide"><h2>How to play</h2>
      <div class="ctrls">${rows.map(r => `<div><kbd>${r[0]}</kbd><span>${r[1]}</span></div>`).join('')}</div>
      <div class="sml" style="margin:10px 0">Survive as long as you can. Watch your moodles (right side). Eat, drink and sleep. Zombies hunt by sight and sound — noise travels, light gives you away at night. Bites are fatal. Barricade, scavenge, and keep moving. The power and water will not last.</div>
      <div class="sml" style="margin:0 0 10px">Survival tips: upstairs rooms are safer — smash the stairs with a sledgehammer and come and go by a sheet rope tied to a window (or jump, and hurt your legs). Fire spreads: keep water or an extinguisher handy, and never leave food burning on the stove. Winter is cold in a house without power — find a coat, light a fire. Baited traps in the woods catch small game while you're away.</div>
      <div class="btn big" data-m="back">Back</div></div></div>`;
    m.onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; if (inGame) { m.innerHTML = ''; UI.togglePause(); } else this.show(); };
  },
};
