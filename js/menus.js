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
  show() {
    G.mode = 'menu';
    G.corpse = false;
    Sfx.engine(null); Sfx.heli(null);
    $('#hud').classList.add('hidden');
    UI.closeAll();
    this.buildBackground();
    G.player = { x: this.cam.x, y: this.cam.y, dead: true, inCar: null, st: { panic: 0 }, look: { skin: '#ccc' }, angle: 0, halo: [], deadT: 0 };
    G.weather = { rain: 0, target: 0, fog: 0.15, temp: 20, next: 1e12, storm: false };
    Render.cam.tz = 1.1;
    const meta = Save.meta();
    $('#menu').className = '';
    $('#menu').innerHTML = `<div class="modal title"><div class="tbox">
      <div class="logo">HOLLOW CREEK</div>
      <div class="tag">There is no cure. There is no rescue.<br>There is only how long you last.</div>
      ${meta ? `<div class="btn big" data-m="continue">Continue <span class="sml">— ${U.esc(meta.name)}, Day ${meta.day} ${meta.time}</span></div>` : ''}
      <div class="btn big" data-m="new">New Game</div>
      <div class="btn big" data-m="options">Options</div>
      <div class="btn big" data-m="controls">How to Play</div>
      <div class="foot">An isometric zombie survival sandbox · all art and audio generated procedurally</div>
    </div></div>`;
    $('#menu').onclick = (e) => {
      Sfx.init();
      const b = e.target.closest('[data-m]'); if (!b) return;
      Sfx.play('pickup');
      const k = b.dataset.m;
      if (k === 'new') { if (!meta || confirm('Starting a new game will erase your current save. Continue?')) this.create(); }
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
    Render.cam.x = this.cam.x; Render.cam.y = this.cam.y;
    G.player.x = this.cam.x; G.player.y = this.cam.y;
    G.light.amb = 0.38; G.light.flash = 0; G.time = 20.6 * 60;
    Zombie.updateAll(dt);
    for (const z of G.zombies) z.va = 1;
    Render.frame(dt);
    Render.ctx.setTransform(Render.dpr, 0, 0, Render.dpr, 0, 0);
    Render.ctx.fillStyle = 'rgba(0,0,0,0.35)'; Render.ctx.fillRect(0, 0, Render.W, Render.H);
  },
  // ------------------------------------------------------------------ character creation
  cfg: null,
  create() {
    G.mode = 'create';
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
        if (k === 'back') { this.show(); return; }
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
    this.cfg = null;
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
  options(inGame) {
    const m = $('#menu');
    const v = Sfx.vol;
    m.innerHTML = `<div class="modal ${inGame ? 'pausing' : ''}"><div class="mbox"><h2>Options</h2>
      <div class="opt"><span>Master volume</span><input type="range" min="0" max="1" step="0.05" value="${v.master}" data-v="master"></div>
      <div class="opt"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-v="sfx"></div>
      <div class="opt"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${v.music}" data-v="music"></div>
      <div class="btn big" data-m="back">Back</div></div></div>`;
    m.oninput = (e) => { const k = e.target.dataset.v; if (k) { Sfx.init(); Sfx.setVol(k, +e.target.value); try { localStorage.setItem('hc_vol', JSON.stringify(Sfx.vol)); } catch (er) { /* */ } } };
    m.onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; if (inGame) { m.innerHTML = ''; UI.togglePause(); } else this.show(); };
  },
  controls(inGame) {
    const m = $('#menu');
    const rows = [
      ['W A S D', 'Move'], ['Shift', 'Run'], ['Alt / X', 'Sprint'], ['C', 'Toggle sneaking'], ['Mouse', 'Look / face direction'],
      ['Right mouse (hold)', 'Aim'], ['Left mouse', 'Attack / shoot'], ['Space', 'Shove (stomp a downed zombie)'], ['R', 'Reload'],
      ['Right click (tap)', 'Context menu on doors, windows, furniture, ground'], ['E', 'Open doors & windows, climb, enter/exit cars, loot'],
      ['F', 'Toggle flashlight / headlights'], ['Q', 'Shout (attracts zombies) / horn'], ['Z', 'Sit down and rest'],
      ['I or Tab', 'Inventory & loot'], ['H', 'Health'], ['B', 'Crafting & building'], ['K', 'Character & skills'], ['M', 'Map'],
      ['1 - 5', 'Hotbar'], ['Mouse wheel', 'Zoom'], ['P / , / .', 'Pause / slower / faster time'], ['Esc', 'Menu / cancel'],
      ['Shift + click item', 'Quick transfer'], ['Double-click item', 'Use / equip / take'], ['Drag item', 'Move between containers'],
    ];
    m.innerHTML = `<div class="modal ${inGame ? 'pausing' : ''}"><div class="mbox wide"><h2>How to play</h2>
      <div class="ctrls">${rows.map(r => `<div><kbd>${r[0]}</kbd><span>${r[1]}</span></div>`).join('')}</div>
      <div class="sml" style="margin:10px 0">Survive as long as you can. Watch your moodles (right side). Eat, drink and sleep. Zombies hunt by sight and sound — noise travels, light gives you away at night. Bites are fatal. Barricade, scavenge, and keep moving. The power and water will not last.</div>
      <div class="btn big" data-m="back">Back</div></div></div>`;
    m.onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; if (inGame) { m.innerHTML = ''; UI.togglePause(); } else this.show(); };
  },
};
