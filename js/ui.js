'use strict';
// ---------------------------------------------------------------------------
// UI: HUD, windows, context menus
// ---------------------------------------------------------------------------
const $ = (s, r) => (r || document).querySelector(s);
const UI = {
  panels: {}, dirty: true, slowT: 0, typing: false, ctxOpen: false, logLines: [],
  // ---- UI scale. The whole interface (#ui) is CSS-zoomed by --uis: Settings > Display > UI scale, or Auto, which
  // fits it to the window - smaller on a laptop screen so no window or menu is cut off, a little larger on a very big
  // screen. Mouse and window coordinates are screen px; things placed by them inside #ui use screen px / UI.scale.
  scale: 1,
  // (about the window's height over 860 px: 80% on a laptop, 100% at 1600 x 900, 125% at 1920 x 1080, 160% at most)
  autoScale() {
    const k = Math.min(innerWidth / 1500, innerHeight / 860);
    return Math.round(U.clamp(k, 0.8, 1.6) * 20) / 20;
  },
  applyScale() {
    const s = Settings.v.uiScale || this.autoScale();
    if (s === this.scale && this._uis) return;
    this.scale = s; this._uis = true;
    document.documentElement.style.setProperty('--uis', s);
    this.fitPanels();
  },
  // the window in the interface's own (zoomed) px
  vw() { return innerWidth / this.scale; },
  vh() { return innerHeight / this.scale; },
  // keep open windows on screen after the window or the scale changes
  fitPanels() {
    for (const k in this.panels) this.fitPanel(this.panels[k].el);
    const d = document.getElementById('dbgwin');
    if (d && d.style.left) this.fitPanel(d);
  },
  fitPanel(el) {
    const W = this.vw(), H = this.vh();
    el.style.left = U.clamp(el.offsetLeft, 0, Math.max(0, W - Math.min(el.offsetWidth, W))) + 'px';
    el.style.top = U.clamp(el.offsetTop, 0, Math.max(0, H - Math.min(el.offsetHeight, H))) + 'px';
  },
  init() {
    this.applyScale();
    window.addEventListener('resize', () => { if (Settings.v.uiScale) this.fitPanels(); else this.applyScale(); });
    Settings.onChange(() => this.applyScale());
    this.root = $('#ui');
    this.hud = $('#hud');
    this.ctx = $('#ctxmenu');
    this.tip = $('#tooltip');
    document.addEventListener('focusin', (e) => { this.typing = e.target.tagName === 'INPUT'; });
    document.addEventListener('focusout', () => { this.typing = false; });
    document.addEventListener('mousedown', (e) => { if (this.ctxOpen && !this.ctx.contains(e.target)) this.closeContext(); });
    // sidebar
    $('#sidebar').innerHTML = [['inv', 'Inventory (I)', 'I'], ['health', 'Health (H)', 'H'], ['craft', 'Crafting (B)', 'B'], ['skills', 'Character (K)', 'K'], ['map', 'Map (M)', 'M'], ['pause', 'Menu (Esc)', '≡']].map(([k, t, l]) => `<div class="sbtn" data-k="${k}" title="${t}"><canvas width="28" height="28" data-icon="${k}"></canvas><span>${l}</span></div>`).join('');
    for (const c of document.querySelectorAll('#sidebar canvas')) this.sideIcon(c.getContext('2d'), c.dataset.icon);
    $('#sidebar').addEventListener('click', (e) => {
      const b = e.target.closest('.sbtn'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'pause') this.togglePause(); else this.toggle(k);
      Sfx.play('pickup');
    });
    $('#clock').addEventListener('click', (e) => {
      const b = e.target.closest('[data-speed]'); if (!b) return;
      const s = +b.dataset.speed;
      if (s === 0) G.paused = !G.paused; else { G.paused = false; if (!G.player.asleep) G.speed = s; }
    });
    this.bindHotbar();
    $('#equip').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const s = e.target.closest('[data-slot]');
      if (!s) return;
      const it = s.dataset.slot === 'p' ? Player.primary() : Player.secondary();
      if (it) this.itemMenu(e.clientX, e.clientY, it, Cont.inv());
    });
    $('#equip').addEventListener('mousemove', (e) => {
      const s = e.target.closest('[data-slot]'), it = s && (s.dataset.slot === 'p' ? Player.primary() : Player.secondary());
      if (it) this.showTip(e.clientX, e.clientY, this.itemTip(it, ['Right-click for options.'])); else this.hideTip();
    });
    $('#equip').addEventListener('mouseleave', () => this.hideTip());
    $('#moodles').addEventListener('mousemove', (e) => {
      const m = e.target.closest('.moodle');
      if (!m) { this.hideTip(); return; }
      this.showTip(e.clientX, e.clientY, `<b>${m.dataset.name}</b><br>${m.dataset.desc}`);
    });
    $('#moodles').addEventListener('mouseleave', () => this.hideTip());
    window.addEventListener('mousemove', (e) => { Input.overUI = e.target !== Render.cv; });
  },
  bindHotbar() {
    const hb = $('#hotbar');
    hb.addEventListener('click', (e) => { const s = e.target.closest('[data-hs]'); if (s) Hotbar.use(s.dataset.hs); });
    hb.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const s = e.target.closest('[data-hs]');
      if (!s) return;
      const slot = s.dataset.hs, it = Hotbar.item(slot);
      if (!it) return;
      this.showContext(e.clientX, e.clientY, [
        { label: it.equipped ? 'Put away' : 'Equip', fn: () => Hotbar.use(slot) },
        { label: 'Detach from ' + HOTBAR_SLOTS[slot].n.toLowerCase(), fn: () => Hotbar.detach(slot) },
        { label: Items.name(it), info: true },
      ]);
    });
    hb.addEventListener('mousemove', (e) => {
      const s = e.target.closest('[data-hs]');
      if (!s) { this.hideTip(); return; }
      const slot = s.dataset.hs, it = Hotbar.item(slot), S = HOTBAR_SLOTS[slot], k = Hotbar.slots().indexOf(slot) + 1;
      this.showTip(e.clientX, e.clientY, it ? this.itemTip(it, [S.n + (it.equipped ? ' · in your hands' : ''), `Press ${k} or click to ${it.equipped ? 'put it back' : 'draw it'}. Right-click to detach.`]) : `<b>${S.n}</b><br><span class="sml">Empty. Drag ${S.what} here from the inventory.</span>`);
    });
    hb.addEventListener('mouseleave', () => this.hideTip());
    hb.addEventListener('dragover', (e) => { if (this.drag && e.target.closest('[data-hs]')) e.preventDefault(); });
    hb.addEventListener('drop', (e) => {
      e.preventDefault();
      const s = e.target.closest('[data-hs]'), dr = this.drag;
      this.drag = null;
      if (!s || !dr) return;
      const it = this.dragItems(dr)[0];
      if (it) this.attachItem(it, s.dataset.hs);
    });
  },
  sideIcon(g, k) {
    g.strokeStyle = '#d8d0c0'; g.fillStyle = '#d8d0c0'; g.lineWidth = 2; g.lineJoin = 'round';
    g.beginPath();
    if (k === 'inv') { g.strokeRect(6, 9, 16, 15); g.arc(14, 9, 4, Math.PI, 0); g.stroke(); g.fillRect(10, 15, 8, 3); }
    else if (k === 'health') { g.fillRect(11, 5, 6, 18); g.fillRect(5, 11, 18, 6); }
    else if (k === 'craft') { g.moveTo(6, 22); g.lineTo(18, 10); g.stroke(); g.fillRect(15, 5, 9, 6); }
    else if (k === 'skills') { g.arc(14, 9, 4.5, 0, 7); g.fill(); g.beginPath(); g.arc(14, 25, 9, Math.PI, 0); g.fill(); }
    else if (k === 'map') { g.moveTo(4, 7); g.lineTo(10, 5); g.lineTo(18, 8); g.lineTo(24, 6); g.lineTo(24, 22); g.lineTo(18, 24); g.lineTo(10, 21); g.lineTo(4, 23); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(10, 5); g.lineTo(10, 21); g.moveTo(18, 8); g.lineTo(18, 24); g.stroke(); }
    else if (k === 'pause') { g.fillRect(5, 7, 18, 3); g.fillRect(5, 13, 18, 3); g.fillRect(5, 19, 18, 3); }
  },
  startGame() {
    // (leaving the menus: back to the game's own resolution)
    if (Menu.q !== 1) Render.resize();
    this.hud.classList.remove('hidden');
    $('#menu').innerHTML = '';
    $('#menu').className = '';
    this.logLines = [];
    this.closeAll();
    this.refresh();
    this.tutorial();
  },
  tutorial() {
    if (this.tutDone) return;
    const tips = [
      'WASD to move · Shift to run · Alt or X to sprint · C to sneak',
      'Right-click objects, doors, windows and furniture for options',
      'Hold right mouse to aim · Left click to attack · Space to shove / stomp',
      'I opens your inventory and nearby containers · E interacts with doors, windows and cars',
      'H opens the health panel — bandage bleeding wounds quickly!',
      'Zombies follow noise. Sneak, close doors and barricade windows to stay alive.',
    ];
    let i = 0;
    const next = () => { if (G.mode !== 'play' || i >= tips.length) return; this.hint(tips[i++], 7); setTimeout(next, 7500); };
    setTimeout(next, 4000);
  },
  modalOpen() { return !!document.querySelector('#menu .modal') || this.ctxOpen; },
  modalPause() { return !!document.querySelector('#menu .modal.pausing'); },

  // ------------------------------------------------------------------ HUD update
  update(dt) {
    if (G.mode !== 'play' && G.mode !== 'dead') return;
    const p = G.player;
    if (!p) return;
    // clock
    const watch = Player.hasWatch();
    const temp = Math.round(G.weather.temp);
    const wIcon = G.weather.rain > 0.6 ? 'Storm' : G.weather.rain > 0.1 ? 'Rain' : G.weather.fog > 0.3 ? 'Fog' : G.light.night ? 'Clear night' : 'Clear';
    const sp = G.speed;
    const btn = (s, l, t) => `<span class="spd ${(!G.paused && sp === s) || (s === 0 && G.paused) ? 'on' : ''}" data-speed="${s}" title="${t}">${l}</span>`;
    const clockHtml = `<div class="lcd ${watch ? '' : 'none'}"><div class="date">${watch ? Game.dateStr() : 'Day ' + (Game.day() + 1)}</div><div class="time">${watch ? Game.timeStr() : Game.fuzzyTime()}</div><div class="wx">${wIcon} · ${temp}°C${G.events.powerOff ? ' · <span class="bad">No power</span>' : ''}</div></div><div class="speeds">${btn(0, '❚❚', 'Pause (P)')}${btn(1, '▶', 'Normal speed')}${btn(3, '▶▶', 'Fast forward x3')}${btn(8, '▶▶▶', 'Fast forward x8')}${btn(20, '▶▶▶▶', 'Fast forward x20')}</div>`;
    if (clockHtml !== this._clock) { $('#clock').innerHTML = clockHtml; this._clock = clockHtml; }
    this.slowT -= dt;
    if (this.slowT <= 0) {
      this.slowT = 0.25;
      this.renderMoodles();
      this.renderEquip();
      this.renderLog();
      if (this.panels.loot && this.panels.loot.open) this.checkLootChange();
      // the character window: health every second, the other tabs every two
      const CP = this.panels.char;
      if (CP && CP.open) { this.chT = (this.chT || 0) + 1; if (this.chT > (CP.tab === 'health' ? 4 : 8)) { this.chT = 0; this.renderPanel('char'); } }
      if (this.panels.map && this.panels.map.open) { this.mapT = (this.mapT || 0) + 1; if (this.mapT > 4) { this.mapT = 0; MapView.draw(); } }
    }
    if (this.dirty) { this.dirty = false; for (const k in this.panels) if (this.panels[k].open) this.renderPanel(k); this.renderEquip(); }
    const h = $('#hint');
    if (this.hintT > 0) { this.hintT -= dt; h.style.opacity = Math.min(1, this.hintT); } else h.style.opacity = 0;
    if (this.flashPower > 0) this.flashPower -= dt;
  },
  refresh() { this.dirty = true; },
  hint(txt, t) { $('#hint').textContent = txt; this.hintT = t || 5; },
  toast(txt) { const t = $('#toast'); t.textContent = txt; t.style.opacity = 1; clearTimeout(this._tt); this._tt = setTimeout(() => t.style.opacity = 0, 2200); },
  log(txt) { this.logLines.push({ txt, t: 14 }); if (this.logLines.length > 6) this.logLines.shift(); this.renderLog(true); },
  renderLog(force) {
    const now = 0.25;
    for (const l of this.logLines) l.t -= now;
    this.logLines = this.logLines.filter(l => l.t > 0);
    const html = this.logLines.map(l => `<div style="opacity:${Math.min(1, l.t / 3).toFixed(2)}">${U.esc(l.txt)}</div>`).join('');
    if (force || html !== this._log) { $('#log').innerHTML = html; this._log = html; }
  },
  renderMoodles() {
    const ms = Player.moodles();
    const html = ms.map(m => `<div class="moodle ${m.good ? 'good' : ''} lv${m.lv}" data-name="${m.name}" data-desc="${m.desc}"><img src="${MoodleIcons.url(m.id)}"></div>`).join('');
    if (html !== this._mood) { $('#moodles').innerHTML = html; this._mood = html; }
  },
  renderEquip() {
    const p = G.player;
    const slot = (it, k, label) => {
      if (!it) return `<div class="eslot" data-slot="${k}"><span class="lbl">${label}</span></div>`;
      const d = ITEMS[it.id];
      let bar = '';
      if (d.wpn || d.gun) bar = `<div class="cbar"><i style="width:${Math.max(0, it.cond / (d.wpn || d.gun).cond * 100)}%"></i></div>`;
      if (d.power !== undefined) bar = `<div class="cbar pw"><i style="width:${it.pow * 100}%"></i></div>`;
      const ammo = d.gun ? `<span class="ammo">${this.ammoText(it)}</span>` : (d.light ? `<span class="ammo">${it.on ? 'ON' : 'off'}</span>` : '');
      return `<div class="eslot" data-slot="${k}"><img src="${Icons.url(it)}">${bar}${ammo}<span class="lbl">${label}</span></div>`;
    };
    const pr = Player.primary(), se = Player.secondary();
    let html = pr && pr === se ? slot(pr, 'p', 'Both').replace('class="eslot"', 'class="eslot both"') : slot(pr, 'p', 'Primary') + slot(se, 's', 'Second');
    void p;
    if (html !== this._eq) { $('#equip').innerHTML = html; this._eq = html; }
    this.renderHotbar();
  },
  // PZ-style hotbar: one slot per attachment point on the worn gear, bottom centre
  renderHotbar() {
    const p = G.player, el = $('#hotbar');
    if (!el || !p) return;
    Hotbar.prune();
    if (p.inCar || p.dead) { if (this._hb !== '') { el.innerHTML = ''; this._hb = ''; el.classList.add('hidden'); } return; }
    let html = '';
    Hotbar.slots().forEach((s, i) => {
      const it = Hotbar.item(s);
      html += `<div class="hs ${it ? 'full' : ''} ${it && it.equipped ? 'inhand' : ''}" data-hs="${s}"><span class="hk">${i + 1}</span>${it ? `<img src="${Icons.url(it)}">` : ''}<span class="hl">${HOTBAR_SLOTS[s].short}</span></div>`;
    });
    if (html !== this._hb) { el.innerHTML = html; this._hb = html; el.classList.remove('hidden'); }
  },
  useHotbar(i) {
    const s = Hotbar.slots()[i];
    if (s) Hotbar.use(s);
  },
  // attach an item dragged or picked from anywhere in reach (loot comes into the main inventory first)
  attachItem(it, slot) {
    const src = this.containerOfItem(it);
    if (!Hotbar.fits(it, slot)) { Player.say("That won't fit there.", '#ccc'); return; }
    if (src && src.kind !== 'inv' && src.kind !== 'bag') {
      Actions.queue(Actions.transfer(it, src, Cont.inv()));
      Actions.queue({ name: '', dur: 0, done: () => { if (G.player.inv.includes(it)) Hotbar.attach(it, slot); }, anim: 'work' });
    } else Hotbar.attach(it, slot);
  },

  // ------------------------------------------------------------------ panels
  panelDefs: {
    inv: { title: 'Inventory', w: 420, h: 420, x: 70, y: 90 },
    loot: { title: 'Loot', w: 420, h: 420, x: 500, y: 90 },
    char: { title: 'Character', w: 480, h: 560, x: 120, y: 50 },
    craft: { title: 'Crafting', w: 560, h: 440, x: 160, y: 80 },
    map: { title: 'Map', w: 600, h: 600, x: 200, y: 40 },
  },
  ensurePanel(k) {
    if (this.panels[k]) return this.panels[k];
    const d = this.panelDefs[k];
    const el = document.createElement('div');
    el.className = 'panel hidden';
    el.style.left = Math.max(0, Math.min(this.vw() - d.w - 10, d.x)) + 'px'; el.style.top = Math.max(0, Math.min(this.vh() - d.h - 10, d.y)) + 'px';
    el.style.width = d.w + 'px'; el.style.height = d.h + 'px';
    // window chrome: close at the left, the title in the middle, collapse to the title bar at the right
    el.innerHTML = `<div class="ph"><span class="px" title="Close">✕</span><span class="pt">${d.title}</span><span class="pc" title="Collapse">▾</span></div><div class="pb"></div>`;
    $('#windows').appendChild(el);
    const P = { k, el, body: el.querySelector('.pb'), open: false, tab: null };
    this.panels[k] = P;
    el.querySelector('.px').onclick = () => this.close(k);
    el.querySelector('.pc').onclick = () => { const c = el.classList.toggle('collapsed'); el.querySelector('.pc').textContent = c ? '▸' : '▾'; };
    // drag
    const ph = el.querySelector('.ph');
    ph.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('px') || e.target.classList.contains('pc')) return;
      const s = this.scale, ox = e.clientX / s - el.offsetLeft, oy = e.clientY / s - el.offsetTop;
      const mv = (ev) => { el.style.left = U.clamp(ev.clientX / s - ox, 0, this.vw() - 60) + 'px'; el.style.top = U.clamp(ev.clientY / s - oy, 0, this.vh() - 30) + 'px'; };
      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      this.front(el);
    });
    el.addEventListener('mousedown', () => this.front(el));
    this.bindPanel(P);
    return P;
  },
  front(el) { this._z = (this._z || 10) + 1; el.style.zIndex = this._z; },
  open(k) {
    if (k === 'health' || k === 'skills') { this.openChar(k === 'health' ? 'health' : 'info'); return; }
    const P = this.ensurePanel(k); P.open = true; P.el.classList.remove('hidden'); this.front(P.el); this.renderPanel(k); this.fitPanel(P.el); },
  close(k) { const P = this.panels[k]; if (!P) return; P.open = false; P.el.classList.add('hidden'); this.hideTip(); if (k === 'map') MapView.dragging = false; },
  toggle(k) {
    // Health (H) and Character (K) are tabs of one window
    if (k === 'health' || k === 'skills') { this.openChar(k === 'health' ? 'health' : 'info', true); return; }
    if (k === 'inv') {
      const o = this.panels.inv && this.panels.inv.open;
      if (o) { this.close('inv'); this.close('loot'); } else { this.open('inv'); this.open('loot'); }
      return;
    }
    if (this.panels[k] && this.panels[k].open) this.close(k); else this.open(k);
  },
  closeAll() { for (const k in this.panels) this.close(k); this.closeContext(); },
  anyOpen() { for (const k in this.panels) if (this.panels[k].open) return true; return false; },
  openLoot(tabKey) {
    this.open('inv'); this.open('loot');
    if (tabKey) this.panels.loot.tab = tabKey;
    this.renderPanel('loot');
  },
  renderPanel(k) {
    const P = this.panels[k];
    if (!P || !P.open) return;
    if (k === 'inv') this.renderContainers(P, Player.containers().map((c, i) => i === 0 ? Cont.inv() : Cont.bag(c.bag)), true);
    else if (k === 'loot') this.renderContainers(P, Interact.nearby(), false);
    else if (k === 'char') this.renderChar(P);
    else if (k === 'craft') this.renderCraft(P);
    else if (k === 'map') MapView.render(P);
  },
  checkLootChange() {
    const key = Interact.nearby().map(c => c.key + ':' + c.items.length).join('|');
    if (key !== this._lootKey) { this._lootKey = key; this.renderPanel('loot'); }
  },
  // ---------------- container lists (PZ style: list with sortable columns, container buttons down the right edge)
  renderContainers(P, conts, mine) {
    P.conts = conts;
    if (!P.tab || !conts.find(c => c.key === P.tab)) {
      const ne = !mine ? conts.find(c => c.items.length && c.kind !== 'floor') || conts.find(c => c.items.length) : null;
      P.tab = (ne || conts[0] || {}).key;
    }
    if (!P.exp) P.exp = new Set();
    if (!P.sel) P.sel = new Set();
    const cur = conts.find(c => c.key === P.tab);
    const tabs = conts.map(c => {
      const ic = c.kind === 'inv' ? 'inv' : c.kind === 'bag' ? null : c.kind;
      const img = c.kind === 'bag' ? `<img src="${Icons.url(c.bag)}">` : `<canvas width="26" height="26" data-cic="${ic}${c.kind === 'obj' ? ':' + c.obj.t : ''}"></canvas>`;
      return `<div class="tab ${c.key === P.tab ? 'on' : ''}" data-tab="${c.key}" title="${U.esc(c.name)}">${img}${c.items.length ? '' : '<i class="empty"></i>'}</div>`;
    }).join('');
    let head = '', cols = '', list = '';
    P.rows = [];
    if (cur) {
      // the main inventory is measured against what you can carry without being weighed down
      const w = Cont.weight(cur), cap = cur.kind === 'inv' ? Player.capacity() : Cont.cap(cur), lim = cap < 9999;
      const loot = this.panels.loot;
      const xfer = mine && loot && loot.open && loot.conts && loot.conts.find(c => c.key === loot.tab);
      const acts = !mine ? (cur.items.length ? '<span class="btn xs" data-act="lootall" title="Take everything">Loot all</span>' : '')
        : (xfer && cur.items.length ? `<span class="btn xs" data-act="xferall" title="Move everything you are not wearing, holding, carrying on the hotbar or keeping as a favorite into ${U.esc(xfer.name)}">Transfer all</span>` : '');
      head = `<div class="ihead"><span class="cn">${U.esc(cur.name)}</span>${acts}<span class="cw ${w > cap ? 'bad' : ''}">${U.fmt1(w)}${lim ? ' / ' + U.fmt1(cap) : ''}</span></div>`;
      if (lim) { const k = Math.min(1, w / cap); head += `<div class="capbar"><i class="${w > cap ? 'over' : k > 0.85 ? 'hi' : ''}" style="width:${(k * 100).toFixed(1)}%"></i></div>`; }
      const sk = P.sort || 'cat', dir = P.sdir || 1, ar = (k) => sk === k ? (dir > 0 ? ' ▴' : ' ▾') : '';
      cols = `<div class="icols"><span class="c-type" data-sort="name">Type${ar('name')}</span><span class="c-cat" data-sort="cat">Category${ar('cat')}</span><span class="c-wt" data-sort="wt">Weight${ar('wt')}</span></div>`;
      const groups = new Map();
      for (const it of cur.items) {
        const k = Items.stackKey(it);
        let g = groups.get(k);
        if (!g) { g = { items: [], key: k }; groups.set(k, g); }
        g.items.push(it);
      }
      P.groups = groups;
      const pinned = (it) => (it.equipped || it.worn) ? 0 : 1;
      const sorted = [...groups.values()].sort((A0, B0) => {
        const A = A0.items[0], B = B0.items[0];
        if (mine && pinned(A) !== pinned(B)) return pinned(A) - pinned(B);
        let r = 0;
        if (sk === 'cat') r = ITEMS[A.id].cat < ITEMS[B.id].cat ? -1 : ITEMS[A.id].cat > ITEMS[B.id].cat ? 1 : 0;
        else if (sk === 'wt') r = Items.weight(A) * A0.items.length - Items.weight(B) * B0.items.length;
        if (!r) r = Items.name(A) < Items.name(B) ? -1 : Items.name(A) > Items.name(B) ? 1 : 0;
        return r * dir;
      });
      // drop stale selections
      const live = new Set(cur.items.map(it => it.uid));
      for (const u of [...P.sel]) if (!live.has(u)) P.sel.delete(u);
      let n = 0;
      for (const g of sorted) {
        const open = g.items.length > 1 && P.exp.has(g.key);
        list += this.rowHtml(g, null, open, n++ & 1, P);
        P.rows.push({ g: g.key, u: null });
        if (open) for (const it of g.items) { list += this.rowHtml(g, it, false, n++ & 1, P); P.rows.push({ g: g.key, u: it.uid }); }
      }
      if (!list) list = '<div class="emptyl">Empty</div>';
    }
    const ol = P.body.querySelector('.ilist'), scroll = ol ? ol.scrollTop : 0;
    P.body.innerHTML = `<div class="inv"><div class="iwrap">${head}${cols}<div class="ilist" data-cont="${cur ? cur.key : ''}">${list}</div></div><div class="tabs">${tabs}</div></div>`;
    P.body.querySelector('.ilist').scrollTop = scroll;
    for (const c of P.body.querySelectorAll('canvas[data-cic]')) ContIcons.draw(c.getContext('2d'), c.dataset.cic);
    P.el.querySelector('.pt').textContent = mine ? 'Inventory' : (cur ? cur.name : 'Loot');
  },
  // a stack row (it = null) or one item of an expanded stack
  rowHtml(g, one, open, odd, P) {
    const it = one || g.items[0], d = ITEMS[it.id];
    const n = one ? 1 : g.items.length, items = one ? [one] : g.items;
    const sel = items.every(x => P.sel.has(x.uid));
    // gutter marks: in hand, worn, on the hotbar, favorite
    let gut = '';
    const eq = items.find(x => x.equipped), wo = items.find(x => x.worn), at = G.player && items.map(x => Hotbar.slotOf(x)).find(Boolean), fv = items.some(x => x.fav);
    if (eq) gut += `<i class="gi eq" title="${eq.equipped === 'both' ? 'In both hands' : eq.equipped === 'primary' ? 'In primary hand' : 'In secondary hand'}">${eq.equipped === 'both' ? '2H' : eq.equipped === 'primary' ? 'P' : 'S'}</i>`;
    if (wo) gut += '<i class="gi wo" title="Worn">W</i>';
    if (at) gut += `<i class="gi at" title="On the hotbar: ${HOTBAR_SLOTS[at].n}">${Hotbar.slots().indexOf(at) + 1}</i>`;
    if (fv) gut += '<i class="gi fv" title="Favorite">★</i>';
    const fs = Items.freshState(it);
    const cls = (fs === 2 ? 'rotten' : fs === 1 ? 'stale' : '') + (sel ? ' sel' : '') + (odd ? ' odd' : '') + (one ? ' child' : '');
    let bar = '';
    if (n === 1 || one) {
      if (d.wpn || d.gun) bar = `<div class="cbar"><i style="width:${Math.max(0, it.cond / (d.wpn || d.gun).cond * 100)}%"></i></div>`;
      else if (d.fluid) bar = `<div class="cbar fl"><i style="width:${it.fl / d.fluid * 100}%"></i></div>`;
      else if (d.gas !== undefined) bar = `<div class="cbar gs"><i style="width:${it.fl / d.gas * 100}%"></i></div>`;
      else if (d.power !== undefined) bar = `<div class="cbar pw"><i style="width:${it.pow * 100}%"></i></div>`;
      else if (d.uses) bar = `<div class="cbar us"><i style="width:${it.uses / d.uses * 100}%"></i></div>`;
      else if (it.readP) bar = `<div class="cbar fl"><i style="width:${it.readP * 100}%"></i></div>`;
    }
    const exp = !one && n > 1 ? `<span class="exp" data-exp="1">${open ? '▾' : '▸'}</span>` : '<span class="exp"></span>';
    const w = n * Items.weight(it);
    return `<div class="row ${cls}" draggable="true" data-g="${U.esc(g.key)}"${one ? ` data-u="${one.uid}"` : ''}><span class="gut">${gut}</span>${exp}<img src="${Icons.url(it)}"><span class="nm">${U.esc(Items.name(it))}${n > 1 ? ' <b>(' + n + ')</b>' : ''}</span>${bar}<span class="ct">${d.cat}</span><span class="wt">${U.fmt2(w)}</span></div>`;
  },
  paintSel(P) {
    for (const row of P.body.querySelectorAll('.row')) {
      const items = this.rowItems(P, row);
      row.classList.toggle('sel', items.length > 0 && items.every(x => P.sel.has(x.uid)));
    }
  },
  // the items a row stands for
  rowItems(P, row) {
    const g = P.groups && P.groups.get(row.dataset.g);
    if (!g) return [];
    if (row.dataset.u !== undefined) { const it = g.items.find(x => x.uid === +row.dataset.u); return it ? [it] : []; }
    return g.items.slice();
  },
  // items a drag carries, still in their source container
  dragItems(dr) {
    const src = this.panels[dr.from], from = src && src.conts && src.conts.find(c => c.key === dr.tab);
    if (!from) return [];
    return dr.uids.map(u => from.items.find(x => x.uid === u)).filter(Boolean);
  },
  dragFrom(dr) { const src = this.panels[dr.from]; return src && src.conts ? src.conts.find(c => c.key === dr.tab) : null; },
  selected(P) {
    const cur = P.conts && P.conts.find(c => c.key === P.tab);
    return cur ? cur.items.filter(it => P.sel.has(it.uid)) : [];
  },
  bindPanel(P) {
    const body = P.body;
    body.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { P.tab = tab.dataset.tab; P.sel && P.sel.clear(); this.renderPanel(P.k); return; }
      const act = e.target.closest('[data-act]');
      if (act) { this.panelAction(P, act.dataset.act, act); return; }
      const so = e.target.closest('[data-sort]');
      if (so) { const k = so.dataset.sort; if (P.sort === k || (!P.sort && k === 'cat')) P.sdir = -(P.sdir || 1); else { P.sort = k; P.sdir = 1; } this.renderPanel(P.k); return; }
      const row = e.target.closest('.row');
      if (!row || !P.groups) return;
      if (e.target.closest('[data-exp]')) { const k = row.dataset.g; if (P.exp.has(k)) P.exp.delete(k); else P.exp.add(k); this.renderPanel(P.k); return; }
      // selection: click selects, ctrl toggles, shift selects a range
      const idx = P.rows.findIndex(r => r.g === row.dataset.g && String(r.u === null ? '' : r.u) === (row.dataset.u || ''));
      const items = this.rowItems(P, row);
      if (e.shiftKey && P.anchor !== undefined && P.anchor >= 0) {
        if (!e.ctrlKey && !e.metaKey) P.sel.clear();
        const [i0, i1] = [Math.min(P.anchor, idx), Math.max(P.anchor, idx)];
        for (let i = i0; i <= i1; i++) {
          const r = P.rows[i], g = P.groups.get(r.g);
          if (!g) continue;
          for (const x of r.u === null ? g.items : g.items.filter(y => y.uid === r.u)) P.sel.add(x.uid);
        }
      } else if (e.ctrlKey || e.metaKey) {
        const all = items.every(x => P.sel.has(x.uid));
        for (const x of items) { if (all) P.sel.delete(x.uid); else P.sel.add(x.uid); }
        P.anchor = idx;
      } else {
        P.sel.clear();
        for (const x of items) P.sel.add(x.uid);
        P.anchor = idx;
      }
      // restyle in place: rebuilding the list here would swallow the second click of a double-click
      this.paintSel(P);
    });
    body.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.row');
      if (!row || !P.groups || e.target.closest('[data-exp]')) return;
      const items = this.rowItems(P, row);
      const cur = P.conts.find(c => c.key === P.tab);
      if (items.length) this.defaultAction(items[0], cur, { items, key: row.dataset.g }, P.k);
    });
    body.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const row = e.target.closest('.row');
      if (!row || !P.groups) return;
      const cur = P.conts.find(c => c.key === P.tab);
      let items = this.rowItems(P, row);
      if (!items.length) return;
      // right-click inside a multi-selection acts on all of it
      const sel = this.selected(P);
      if (sel.length > 1 && items.every(x => P.sel.has(x.uid)) && sel.some(x => Items.stackKey(x) !== row.dataset.g)) { this.selMenu(e.clientX, e.clientY, P, sel, cur); return; }
      if (!items.every(x => P.sel.has(x.uid))) { P.sel.clear(); for (const x of items) P.sel.add(x.uid); this.paintSel(P); }
      this.itemMenu(e.clientX, e.clientY, items[0], cur, { items, key: row.dataset.g });
    });
    body.addEventListener('mousemove', (e) => {
      const row = e.target.closest('.row');
      if (row && P.groups) {
        const it = this.rowItems(P, row)[0];
        if (it) {
          const at = Hotbar.slotOf(it), extra = [];
          if (at) extra.push('On the hotbar: ' + HOTBAR_SLOTS[at].n);
          if (it.fav) extra.push('Favorite');
          this.showTip(e.clientX, e.clientY, this.itemTip(it, extra));
          return;
        }
      }
      this.hideTip();
    });
    body.addEventListener('mouseleave', () => this.hideTip());
    body.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.row');
      if (!row || !P.groups) return;
      let items = this.rowItems(P, row);
      // dragging a selected row carries the whole selection
      if (items.every(x => P.sel.has(x.uid))) items = this.selected(P);
      this.drag = { from: P.k, tab: P.tab, uids: items.map(x => x.uid) };
      e.dataTransfer.setData('text/plain', 'item');
      e.dataTransfer.effectAllowed = 'move';
    });
    body.addEventListener('dragend', () => { setTimeout(() => { this.drag = null; }, 0); });
    P.el.addEventListener('dragover', (e) => { if (this.drag) e.preventDefault(); });
    P.el.addEventListener('drop', (e) => {
      e.preventDefault();
      const dr = this.drag; this.drag = null;
      if (!dr || !P.conts) return;
      const from = this.dragFrom(dr), items = this.dragItems(dr);
      if (!from || !items.length) return;
      const tabEl = e.target.closest('[data-tab]');
      const to = P.conts.find(c => c.key === (tabEl ? tabEl.dataset.tab : P.tab));
      if (!to || to.key === from.key) return;
      this.moveItems(items, from, to);
    });
    // items dragged out of the windows onto the world land on the floor at your feet
    if (!this.worldDrop) {
      this.worldDrop = true;
      Render.cv.addEventListener('dragover', (e) => { if (this.drag) e.preventDefault(); });
      Render.cv.addEventListener('drop', (e) => {
        e.preventDefault();
        const dr = this.drag; this.drag = null;
        if (!dr) return;
        const from = this.dragFrom(dr), items = this.dragItems(dr), p = G.player;
        if (!from || !items.length || from.kind === 'floor') return;
        this.moveItems(items, from, Cont.floor(Math.floor(p.x), Math.floor(p.y)));
      });
    }
  },
  // queue transfers, skipping what is worn or held unless it is a single item the player chose
  moveItems(items, from, to) {
    const mine = from.kind === 'inv' || from.kind === 'bag';
    const list = mine && items.length > 1 ? items.filter(it => !it.worn && !it.equipped) : items;
    for (const it of list) Actions.queue(Actions.transfer(it, from, to));
  },
  // context menu for a multi-item selection
  selMenu(x, y, P, items, cont) {
    const p = G.player, mine = cont.kind === 'inv' || cont.kind === 'bag', n = items.length;
    const opts = [];
    const loose = items.filter(it => !it.worn && !it.equipped);
    if (!mine) {
      opts.push({ label: 'Grab ' + n + ' items', fn: () => this.moveItems(items, cont, Cont.inv()) });
      for (const b of Player.bags()) opts.push({ label: 'Put ' + n + ' items in ' + Items.name(b), fn: () => this.moveItems(items, cont, Cont.bag(b)) });
    } else {
      const loot = this.panels.loot, to = loot && loot.open && loot.conts && loot.conts.find(c => c.key === loot.tab);
      if (to && to.key !== cont.key) opts.push({ label: 'Transfer ' + loose.length + ' items to ' + to.name, fn: () => this.moveItems(loose, cont, to), disabled: !loose.length });
      for (const b of Player.bags()) if (!items.includes(b) && cont.bag !== b) opts.push({ label: 'Put ' + loose.length + ' items in ' + Items.name(b), fn: () => this.moveItems(loose, cont, Cont.bag(b)), disabled: !loose.length });
      if (cont.kind === 'bag') opts.push({ label: 'Move to main inventory', fn: () => this.moveItems(items, cont, Cont.inv()) });
      opts.push({ label: 'Drop ' + loose.length + ' items', fn: () => this.moveItems(loose, cont, Cont.floor(Math.floor(p.x), Math.floor(p.y))), disabled: !loose.length });
      const allFav = items.every(it => it.fav);
      opts.push({ label: allFav ? 'Unfavorite' : 'Favorite', fn: () => { for (const it of items) { if (allFav) delete it.fav; else it.fav = true; } this.refresh(); } });
    }
    opts.push({ label: n + ' items selected', info: true });
    this.showContext(x, y, opts);
  },
  panelAction(P, act) {
    const cur = P.conts && P.conts.find(c => c.key === P.tab);
    if (!cur) return;
    if (act === 'lootall') for (const it of cur.items.slice()) Actions.queue(Actions.transfer(it, cur, Cont.inv()));
    if (act === 'xferall') {
      const loot = this.panels.loot, to = loot && loot.open && loot.conts && loot.conts.find(c => c.key === loot.tab);
      if (!to || to.key === cur.key) return;
      const keep = (it) => it.worn || it.equipped || it.fav || Hotbar.slotOf(it) || ITEMS[it.id].key || it.keyId !== undefined;
      for (const it of cur.items.slice()) if (!keep(it)) Actions.queue(Actions.transfer(it, cur, to));
    }
  },
  containerOfItem(it) {
    for (const c of Player.containers()) if (c.items.includes(it)) return c.main ? Cont.inv() : Cont.bag(c.bag);
    if (this.panels.loot && this.panels.loot.conts) for (const c of this.panels.loot.conts) if (Cont.has(c, it)) return c;
    for (const c of Interact.nearby()) if (Cont.has(c, it)) return c;
    return null;
  },
  defaultAction(it, cont, g, pk) {
    const d = ITEMS[it.id];
    const mine = cont && (cont.kind === 'inv' || cont.kind === 'bag');
    if (!mine) { for (const x of (g ? g.items : [it])) Actions.queue(Actions.transfer(x, cont, Cont.inv())); return; }
    if (d.cat === 'Food' && !d.fluid) { Actions.queue(Actions.eat(it)); return; }
    if (d.fluid && it.fl > 0) { Actions.queue(Actions.drink(it)); return; }
    if (d.pill) { Actions.queue(Actions.pills(it)); return; }
    if (d.cat === 'Clothing' || (d.bag && (d.bag.back || d.bag.belt))) { Actions.queue(it.worn ? Actions.unwear(it) : Actions.wear(it)); return; }
    if (d.cat === 'Literature' && !d.mapItem) { Actions.queue(Actions.read(it)); return; }
    if (d.mapItem) { MapView.reveal(); this.open('map'); return; }
    if (d.moveable) { Build.startMove(it); return; }
    if (d.corpse) { Interact.dropCorpse(it); return; }
    if (d.boxOf) { Actions.queue(Actions.openBox(it)); return; }
    if (d.bag && d.bag.hand && !d.wpn) { if (it.equipped) Player.unequip(it); else Player.equip(it, 'secondary'); this.refresh(); return; }
    if (d.wpn || d.gun || d.tags.length || d.light || d.throwable || d.generator) { if (it.equipped) Player.unequip(it); else Player.equip(it, d.light ? 'secondary' : 'primary'); this.refresh(); return; }
    void pk;
  },
  // ---------------- item context menu
  itemMenu(x, y, it, cont, g) {
    const d = ITEMS[it.id];
    const p = G.player;
    const mine = cont && (cont.kind === 'inv' || cont.kind === 'bag');
    const opts = [];
    const add = (label, fn, o) => opts.push(Object.assign({ label, fn }, o || {}));
    const n = g ? g.items.length : 1;
    const via = (fn) => () => { if (!mine) Actions.withItem(it, fn); else Actions.queue(fn()); };
    if (!mine) {
      add(n > 1 ? 'Grab one' : 'Grab', () => Actions.queue(Actions.transfer(it, cont, Cont.inv())));
      if (n > 1) add('Grab all (' + n + ')', () => { for (const x2 of g.items) Actions.queue(Actions.transfer(x2, cont, Cont.inv())); });
      for (const b of Player.bags()) add('Put in ' + Items.name(b), () => { for (const x2 of (g ? g.items : [it])) Actions.queue(Actions.transfer(x2, cont, Cont.bag(b))); });
    }
    if (d.cat === 'Food' && !d.fluid) {
      add(d.drink ? 'Drink' : 'Eat', via(() => Actions.eat(it)));
      if (!d.drink) { add('Eat half', via(() => Actions.eat(it, 0.5))); add('Eat quarter', via(() => Actions.eat(it, 0.25))); }
    }
    if (d.fluid) {
      if (it.fl > 0.001) { add('Drink', via(() => Actions.drink(it))); if (mine) add('Pour out', () => Actions.queue(Actions.pour(it))); }
    }
    if (d.pill) add('Take ' + d.n, via(() => Actions.pills(it)));
    if (d.bandage !== undefined || d.disinfect || d.suture) add('Treat wounds…', () => this.openChar('health'));
    if (d.smoke) add('Smoke', via(() => Actions.smoke(it)));
    if (d.cat === 'Literature' && !d.mapItem) add('Read', via(() => Actions.read(it)));
    if (d.mapItem) add('Read map', () => { MapView.reveal(); this.open('map'); });
    if (d.boxOf) add('Open box', via(() => Actions.openBox(it)));
    if (d.moveable && mine) add('Place ' + Items.name(it).toLowerCase(), () => Build.startMove(it));
    if (d.corpse && mine) add('Drop corpse here', () => Interact.dropCorpse(it));
    if (d.cat === 'Clothing' || d.bag) {
      if (it.worn) add('Take off', () => Actions.queue(Actions.unwear(it)));
      else if (d.slot || (d.bag && (d.bag.back || d.bag.belt))) add(d.bag ? 'Wear on ' + (d.bag.belt ? 'belt' : 'back') : 'Wear', via(() => Actions.wear(it)));
      if (d.cat === 'Clothing' && !it.worn && !['shoes', 'eyes', 'wrist', 'hat'].includes(d.slot)) add('Rip into rags', via(() => Actions.rip(it)));
    }
    if (it.id === 'Sheet') add('Rip into rags', via(() => Actions.rip(it)));
    const equippable = d.wpn || d.gun || d.tags.length || d.light || d.throwable || d.generator || (d.bag && d.bag.hand) || d.radio || d.cat === 'Tool';
    if (equippable && !d.cat.match(/Clothing/) && !it.worn) {
      if (it.equipped) add('Unequip', () => { Player.unequip(it); this.refresh(); });
      else {
        const two = (d.wpn && d.wpn.two) || (d.gun && d.gun.two) || d.generator;
        add(two ? 'Equip (both hands)' : 'Equip primary', via(() => Actions.equip(it, 'primary')));
        if (!two) add('Equip secondary', via(() => Actions.equip(it, 'secondary')));
      }
    }
    if (d.gun && mine) {
      const g = d.gun, inHand = (fn) => () => { Player.equip(it, 'primary'); fn(); };
      add(it.jam ? 'Clear the jam' : 'Reload', inHand(() => Actions.reload()));
      if (g.mag) {
        if (it.magIn !== false) add('Eject magazine (' + (it.ammo || 0) + '/' + g.cap + ')', inHand(() => Actions.queue(Actions.ejectMag(it))));
        const seen = new Set();
        for (const m of Player.findAll(x => x.id === g.mag).sort((a, b) => b.rounds - a.rounds)) { if (seen.has(m.rounds)) continue; seen.add(m.rounds); add('Insert magazine (' + (m.rounds || 0) + '/' + g.cap + ')', inHand(() => Actions.queue(Actions.magSwap(it, m)))); }
      } else if (it.ammo) add('Unload', () => Actions.queue(Actions.unload(it)));
      if (it.ammo > 0 && !it.jam && it.magIn !== false) add('Suicide', inHand(() => Actions.suicide(it)));
      if (g.auto) add(it.fire === 'semi' ? 'Switch to full auto' : 'Switch to semi-auto', () => { it.fire = it.fire === 'semi' ? 'auto' : 'semi'; Sfx.play('switch'); Player.say(it.fire === 'semi' ? 'Semi-auto.' : 'Full auto.', '#ccc'); this.refresh(); });
    }
    if (d.magOf && mine) {
      const have = Player.count(d.magOf);
      add('Load rounds (' + have + ' in inventory)', () => Actions.queue(Actions.magLoad(it)), { disabled: !have || (it.rounds || 0) >= d.magCap });
      if (it.rounds) add('Unload rounds', () => Actions.queue(Actions.magUnload(it)));
    }
    if ((d.wpn || d.gun) && it.cond < (d.wpn || d.gun).cond && mine) {
      for (const tool of Player.findAll(x => ITEMS[x.id].repair)) add('Repair with ' + ITEMS[tool.id].n, () => Actions.queue(Actions.repair(it, tool)));
    }
    if (d.light || d.radio) {
      add(it.on ? 'Turn off' : 'Turn on', () => { if (it.pow <= 0) { Player.say('The batteries are dead.', '#ccc'); return; } it.on = !it.on; if (d.light && it.on && !it.equipped) Player.equip(it, 'secondary'); Sfx.play('switch'); this.refresh(); });
      add('Replace battery', via(() => Actions.battery(it)), { disabled: !Player.findId('Battery') });
    }
    if (d.throwable === 'noise' && mine) add('Set alarm and place here', () => { Player.removeItem(it); Combat.sources.push({ x: p.x, y: p.y, t: 45, pulse: 6 }); World.dropItem(p.x, p.y, it); this.refresh(); Player.say('Alarm set.', '#ccc'); });
    if (d.throwable) add('Equip to throw', via(() => Actions.equip(it, 'primary')));
    if (!it.worn && Hotbar.slots().some(s => Hotbar.fits(it, s))) {
      const at = mine ? Hotbar.slotOf(it) : null;
      if (at) add('Detach from ' + HOTBAR_SLOTS[at].n.toLowerCase(), () => Hotbar.detach(at));
      const sub = Hotbar.slots().filter(s => s !== at && Hotbar.fits(it, s)).map(s => { const o = Hotbar.item(s); return { label: HOTBAR_SLOTS[s].n + (o ? ' (swap out ' + Items.name(o) + ')' : ''), fn: () => this.attachItem(it, s) }; });
      if (sub.length) add(at ? 'Move on hotbar' : 'Attach to hotbar', null, { sub });
    }
    if (mine) {
      const fav = (g ? g.items : [it]).every(x => x.fav);
      add(fav ? 'Unfavorite' : 'Favorite', () => { for (const x2 of (g ? g.items : [it])) { if (fav) delete x2.fav; else x2.fav = true; } this.refresh(); });
      for (const b of Player.bags()) if (b !== it && !b.items.includes(it)) add('Put in ' + Items.name(b), () => { for (const x2 of (g ? g.items : [it])) Actions.queue(Actions.transfer(x2, cont, Cont.bag(b))); });
      if (cont.kind === 'bag') add('Move to main inventory', () => { for (const x2 of (g ? g.items : [it])) Actions.queue(Actions.transfer(x2, cont, Cont.inv())); });
      if (!it.worn) add('Place', () => FloorItems.start(it));
      add(n > 1 ? 'Drop one' : 'Drop', () => { Actions.queue(Actions.transfer(it, cont, Cont.floor(Math.floor(p.x), Math.floor(p.y)))); });
      if (n > 1) add('Drop all (' + n + ')', () => { for (const x2 of g.items) Actions.queue(Actions.transfer(x2, cont, Cont.floor(Math.floor(p.x), Math.floor(p.y)))); });
    }
    if (it.keyName) add(it.keyName, null, { info: true });
    this.showContext(x, y, opts);
  },
  // a gun's rounds for the hand slots: in it / what it holds (JAM, no magazine), loose rounds, spare magazines
  ammoText(it) {
    const g = ITEMS[it.id].gun;
    if (it.jam) return 'JAM';
    const mags = g.mag ? Player.findAll(x => x.id === g.mag) : [];
    const inGun = g.mag && it.magIn === false ? '–' : it.ammo;
    return inGun + '/' + g.cap + ' · ' + Player.count(g.ammo) + (mags.length ? ' +' + mags.length + '▮' : '') + (it.fire === 'semi' ? ' S' : '');
  },
  // ---------------- context menu widget
  showContext(x, y, opts, target) {
    this.ctxOpen = true;
    G.hover = target && (target.edge || target.obj || target.tile) ? { edge: target.edge, tile: target.edge ? null : target.tile } : null;
    const html = opts.map((o, i) => o.info ? `<div class="ci info">${U.esc(o.label)}</div>` : `<div class="ci ${o.disabled ? 'dis' : ''} ${o.sub ? 'hassub' : ''}" data-i="${i}">${U.esc(o.label)}${o.sub ? '<span class="arr">▸</span><div class="sub">' + o.sub.map((s, j) => `<div class="ci" data-i="${i}" data-j="${j}">${U.esc(s.label)}</div>`).join('') + '</div>' : ''}</div>`).join('');
    this.ctx.innerHTML = html;
    this.ctx.classList.remove('hidden');
    const r = this.ctx.getBoundingClientRect(), s = this.scale;
    this.ctx.style.left = Math.max(0, Math.min(x, innerWidth - r.width - 8)) / s + 'px';
    this.ctx.style.top = Math.max(0, Math.min(y, innerHeight - r.height - 8)) / s + 'px';
    this.ctx.onclick = (e) => {
      const c = e.target.closest('.ci');
      if (!c || c.classList.contains('dis') || c.classList.contains('info')) return;
      const o = opts[+c.dataset.i];
      if (!o) return;
      if (c.dataset.j !== undefined) { o.sub[+c.dataset.j].fn(); this.closeContext(); return; }
      if (o.sub) return;
      this.closeContext();
      if (o.fn) { Sfx.play('pickup'); o.fn(); }
    };
  },
  closeContext() { if (!this.ctx) return; this.ctxOpen = false; this.ctx.classList.add('hidden'); G.hover = null; },
  // an item's tooltip: its name and kind, rows of label and value (a coloured bar for anything that runs down),
  // then any notes
  itemTip(it, extra) {
    const col = (f) => f >= 0.6 ? '#6aa84a' : f >= 0.3 ? '#c8a838' : '#c03a2a';
    let h = `<div class="itip"><div class="ith">${U.esc(Items.name(it))}</div><div class="itc">${U.esc(ITEMS[it.id].cat || '')}</div>`;
    for (const r of Items.tipRows(it)) {
      if (r.t) { h += `<div class="itt">${U.esc(r.t)}</div>`; continue; }
      h += `<div class="itr"><span>${U.esc(r.k)}</span>` + (r.bar !== undefined ? `<i class="itb"><i style="width:${Math.round(r.bar * 100)}%;background:${col(r.bar)}"></i></i>` : '') + `<b>${U.esc(r.v)}</b></div>`;
    }
    for (const t of extra || []) h += `<div class="itt">${U.esc(t)}</div>`;
    return h + '</div>';
  },
  showTip(x, y, html) {
    const t = this.tip;
    t.innerHTML = html; t.classList.remove('hidden');
    const r = t.getBoundingClientRect(), s = this.scale;
    t.style.left = Math.max(0, Math.min(x + 16, innerWidth - r.width - 6)) / s + 'px';
    t.style.top = Math.max(0, Math.min(y + 12, innerHeight - r.height - 6)) / s + 'px';
  },
  hideTip() { this.tip.classList.add('hidden'); },

  // ------------------------------------------------------------------ health panel
  renderHealth(P) {
    const p = G.player;
    const sel = P.sel;
    const rows = [];
    for (const pt of PARTS) {
      const b = p.body[pt];
      const ws = Object.keys(b.w).filter(k => b.w[k] > 0);
      if (!ws.length && !b.bandage && !b.infect) continue;
      const tags = ws.map(k => WOUND[k].n);
      if (Player.partBleed(b) > 0) tags.push('<span class="bad">Bleeding</span>');
      if (b.bandage) tags.push(b.bandage.dirt >= 0.99 ? '<span class="warn">Dirty bandage</span>' : 'Bandaged');
      if (b.infect > 0.05) tags.push('<span class="bad">Infected</span>');
      if (b.glass) tags.push('<span class="warn">Glass shard</span>');
      if (b.w.deep && !b.stitched) tags.push('<span class="warn">Needs stitches</span>');
      if (b.stitched) tags.push('Stitched');
      if (b.w.fracture) tags.push(b.splint ? 'Splinted' : '<span class="warn">Needs a splint</span>');
      if (b.disinf > 0) tags.push('Disinfected');
      rows.push(`<div class="hrow ${sel === pt ? 'on' : ''}" data-part="${pt}"><b>${PART_NAMES[pt]}</b>: ${tags.join(', ')}</div>`);
    }
    let actions = '';
    if (sel) {
      const b = p.body[sel];
      const btns = [];
      const bands = Player.findAll(it => ITEMS[it.id].bandage !== undefined);
      const seen = new Set();
      for (const it of bands) { if (seen.has(it.id)) continue; seen.add(it.id); btns.push(`<span class="btn" data-ha="band:${it.uid}">Apply ${ITEMS[it.id].n}</span>`); }
      if (b.bandage) btns.push(`<span class="btn" data-ha="unband">Remove bandage</span>`);
      const dis = Player.find(it => ITEMS[it.id].disinfect);
      if (dis) btns.push(`<span class="btn" data-ha="dis:${dis.uid}">Disinfect (${ITEMS[dis.id].n})</span>`);
      const sut = Player.find(it => ITEMS[it.id].suture);
      if (sut && b.w.deep && !b.stitched) btns.push(`<span class="btn" data-ha="stitch:${sut.uid}">Stitch wound</span>`);
      if (b.glass) btns.push(`<span class="btn" data-ha="glass">Remove glass shard</span>`);
      const spl = Player.find(it => ITEMS[it.id].splint);
      if (spl && b.w.fracture && !b.splint) btns.push(`<span class="btn" data-ha="splint:${spl.uid}">Apply splint</span>`);
      actions = `<div class="hact"><div class="sub2">${PART_NAMES[sel]}</div>${btns.join('') || '<i>No treatment items. Rip clothing into rags for makeshift bandages.</i>'}</div>`;
    }
    const st = p.st;
    const status = `<div class="hstat"><div class="hb"><span>Health</span><div class="bar"><i style="width:${Math.max(0, p.health)}%;background:${p.health > 60 ? '#5a5' : p.health > 30 ? '#ca4' : '#c44'}"></i></div></div>
      <div class="sml">Body temperature ${st.temp.toFixed(1)}°C · Pain ${Math.round(st.pain)} · Endurance ${Math.round(st.endurance * 100)}%</div></div>`;
    P.body.innerHTML = `<div class="health"><canvas class="bodyc" width="150" height="330"></canvas><div class="hright">${status}<div class="hlist">${rows.join('') || '<div class="sml">No injuries.</div>'}</div>${actions}<div class="sml hhelp">Click a body part to treat it.</div></div></div>`;
    this.drawBody(P.body.querySelector('.bodyc'), sel);
    if (!P.bound2) {
      P.bound2 = true;
      P.body.addEventListener('click', (e) => {
        const r = e.target.closest('[data-part]');
        if (r) { P.sel = r.dataset.part; this.renderHealth(P); return; }
        const c = e.target.closest('.bodyc');
        if (c) { const rect = c.getBoundingClientRect(); const pt = this.bodyHit((e.clientX - rect.left) / this.scale, (e.clientY - rect.top) / this.scale); if (pt) { P.sel = pt; this.renderHealth(P); } return; }
        const a = e.target.closest('[data-ha]');
        if (a && P.sel) {
          const [k, uid] = a.dataset.ha.split(':');
          const it = uid ? Player.find(x => x.uid === +uid) : null;
          if (k === 'band') Actions.withItem(it, () => Actions.bandage(P.sel, it));
          if (k === 'unband') Actions.queue(Actions.removeBandage(P.sel));
          if (k === 'dis') Actions.withItem(it, () => Actions.disinfect(P.sel, it));
          if (k === 'stitch') Actions.withItem(it, () => Actions.stitch(P.sel, it));
          if (k === 'glass') Actions.queue(Actions.removeGlass(P.sel));
          if (k === 'splint') Actions.withItem(it, () => Actions.splint(P.sel, it));
          setTimeout(() => this.renderHealth(P), 50);
        }
      });
    }
  },
  BODY_RECTS: {
    Head: [60, 6, 30, 32], Neck: [67, 38, 16, 10], TorsoUpper: [48, 48, 54, 48], TorsoLower: [50, 96, 50, 34], Groin: [54, 130, 42, 20],
    UpperArmL: [30, 50, 17, 44], UpperArmR: [103, 50, 17, 44], ForeArmL: [24, 94, 16, 44], ForeArmR: [110, 94, 16, 44], HandL: [20, 138, 16, 20], HandR: [114, 138, 16, 20],
    UpperLegL: [52, 150, 22, 64], UpperLegR: [76, 150, 22, 64], LowerLegL: [52, 214, 21, 74], LowerLegR: [77, 214, 21, 74], FootL: [46, 288, 26, 14], FootR: [78, 288, 26, 14],
  },
  bodyHit(x, y) { for (const pt of PARTS) { const [a, b, w, h] = this.BODY_RECTS[pt]; if (x >= a && x <= a + w && y >= b && y <= b + h) return pt; } return null; },
  // the body: a grey mannequin (smooth limbs, a shaped torso), each part tinted by its worst wound, bandages wrapped
  // round, fractures cracked, bleeding dripping; the selected part outlined in white. Drawn at twice the size.
  drawBody(cv, sel) {
    const K = 2;
    if (cv.width !== 150 * K) { cv.width = 150 * K; cv.height = 330 * K; cv.style.width = '150px'; cv.style.height = '330px'; }
    const g = cv.getContext('2d'), p = G.player;
    g.setTransform(K, 0, 0, K, 0, 0);
    g.clearRect(0, 0, 150, 330);
    const shape = (pt) => {
      const [x, y, w, h] = this.BODY_RECTS[pt];
      g.beginPath();
      if (pt === 'Head') g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7);
      else if (pt === 'TorsoUpper') { g.moveTo(x + 6, y); g.lineTo(x + w - 6, y); g.quadraticCurveTo(x + w, y + 1, x + w, y + 9); g.lineTo(x + w - 4, y + h); g.lineTo(x + 4, y + h); g.lineTo(x, y + 9); g.quadraticCurveTo(x, y + 1, x + 6, y); }
      else if (pt === 'TorsoLower') { g.moveTo(x + 2, y); g.lineTo(x + w - 2, y); g.quadraticCurveTo(x + w - 5, y + h * 0.5, x + w, y + h); g.lineTo(x, y + h); g.quadraticCurveTo(x + 5, y + h * 0.5, x + 2, y); }
      else if (pt === 'Groin') { g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - 3, y + h); g.lineTo(x + w / 2 + 2, y + h); g.lineTo(x + w / 2, y + h * 0.55); g.lineTo(x + w / 2 - 2, y + h); g.lineTo(x + 3, y + h); g.closePath(); }
      else roundRect(g, x, y, w, h, Math.min(w, h) / 2);
    };
    const tint = (b) => b.infect > 0.05 ? [120, 150, 70] : b.w.bite || b.w.deep ? [170, 30, 30] : b.w.fracture ? [150, 70, 160] : b.w.cut || b.w.burn ? [205, 90, 40] : b.w.scratch ? [215, 175, 60] : null;
    for (const pt of PARTS) {
      const [x, y, w, h] = this.BODY_RECTS[pt], b = p.body[pt];
      shape(pt);
      const gr = g.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, '#9c9c9c'); gr.addColorStop(0.45, '#c4c4c4'); gr.addColorStop(1, '#828282');
      g.fillStyle = gr; g.fill();
      const t = tint(b);
      if (t) { g.fillStyle = `rgba(${t[0]},${t[1]},${t[2]},0.78)`; g.fill(); }
      g.save(); shape(pt); g.clip();
      if (b.bandage) { g.fillStyle = b.bandage.dirt >= 0.99 ? 'rgba(150,120,80,0.9)' : 'rgba(250,250,245,0.92)'; for (let k = 0; k < 3; k++) g.fillRect(x - 2, y + h * (0.28 + k * 0.17), w + 4, 3.5); }
      if (b.w.fracture) { g.strokeStyle = '#1a0a18'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y + h * 0.45); g.lineTo(x + w * 0.4, y + h * 0.56); g.lineTo(x + w * 0.62, y + h * 0.42); g.lineTo(x + w, y + h * 0.53); g.stroke(); }
      if (b.splint) { g.fillStyle = 'rgba(150,110,60,0.95)'; g.fillRect(x + 1, y + h * 0.15, 3, h * 0.7); g.fillRect(x + w - 4, y + h * 0.15, 3, h * 0.7); }
      g.restore();
      if (Player.partBleed(b) > 0) { g.fillStyle = '#e01818'; g.beginPath(); g.arc(x + w / 2, y + h * 0.6, 3.2, 0, 7); g.fill(); g.beginPath(); g.moveTo(x + w / 2 - 2, y + h * 0.6); g.lineTo(x + w / 2, y + h * 0.6 + 7); g.lineTo(x + w / 2 + 2, y + h * 0.6); g.fill(); }
      shape(pt);
      g.strokeStyle = sel === pt ? '#ffffff' : 'rgba(0,0,0,0.55)'; g.lineWidth = sel === pt ? 2.2 : 1; g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  },

  // ------------------------------------------------------------------ the character window: Info, Skills, Health, Protection
  CHAR_TABS: [['info', 'Info'], ['skills', 'Skills'], ['health', 'Health'], ['prot', 'Protection']],
  // open on a tab (again on the same tab: close, when toggling from a key or button)
  openChar(tab, toggle) {
    const P = this.ensurePanel('char');
    if (toggle && P.open && P.tab === tab) { this.close('char'); return; }
    P.tab = tab; P.open = true; P.el.classList.remove('hidden'); P.el.classList.remove('collapsed');
    this.front(P.el); this.renderPanel('char'); this.fitPanel(P.el);
  },
  // a tab's own body (each keeps its element, selection and click handlers)
  charSub(tab) { const P = this.ensurePanel('char'); this.charInit(P); return P.subs[tab]; },
  charInit(P) {
    if (P.subs) return;
    P.body.innerHTML = `<div class="ctabs2">${this.CHAR_TABS.map(([k, n]) => `<span class="ctab2" data-ct="${k}">${n}</span>`).join('')}</div>`
      + this.CHAR_TABS.map(([k]) => `<div class="csub" data-cs="${k}"></div>`).join('');
    P.subs = {};
    for (const [k] of this.CHAR_TABS) P.subs[k] = { k, body: P.body.querySelector(`[data-cs="${k}"]`), sel: null };
    P.body.querySelector('.ctabs2').addEventListener('click', (e) => { const t = e.target.closest('[data-ct]'); if (t) { P.tab = t.dataset.ct; this.renderPanel('char'); Sfx.play('pickup'); } });
  },
  renderChar(P) {
    this.charInit(P);
    const tab = P.tab || 'info';
    for (const el of P.body.querySelectorAll('.ctab2')) el.classList.toggle('on', el.dataset.ct === tab);
    for (const k in P.subs) P.subs[k].body.style.display = k === tab ? '' : 'none';
    const S = P.subs[tab];
    if (tab === 'info') this.renderInfo(S); else if (tab === 'skills') this.renderSkills(S); else if (tab === 'health') this.renderHealth(S); else this.renderProt(S);
    for (const b of document.querySelectorAll('#sidebar .sbtn')) b.classList.toggle('on', (b.dataset.k === 'health' && tab === 'health') || (b.dataset.k === 'skills' && tab !== 'health'));
  },
  renderInfo(P) {
    const p = G.player, st = p.st;
    const occ = OCCUPATIONS.find(o => o.id === p.occ);
    const days = Math.floor(p.minutesAlive / 1440), hrs = Math.floor((p.minutesAlive % 1440) / 60);
    const traits = p.traits.map(t => { const d = traitDef(t); return d ? `<span class="trait ${d.cost < 0 ? 'pos' : d.cost > 0 ? 'neg' : ''}" title="${U.esc(d.desc)}">${d.n}</span>` : ''; }).join('');
    const wt = Player.weight(), cap = Player.capacity();
    const row = (n, v, cls) => `<div class="irow"><span>${n}</span><span class="${cls || ''}">${v}</span></div>`;
    P.body.innerHTML = `<div class="cinfo"><canvas class="cprev" width="110" height="150"></canvas><div class="cright"><div class="cname">${U.esc(p.name)}</div><div>${occ ? occ.n : ''}</div>
      <div class="sml">Survived ${days} day${days === 1 ? '' : 's'}, ${hrs} hour${hrs === 1 ? '' : 's'}</div><div class="traits">${traits || '<span class="sml">No traits</span>'}</div></div></div>
      <div class="istats">${row('Zombies killed', p.kills)}${row('Carrying', U.fmt1(wt) + ' / ' + U.fmt1(cap) + ' kg', wt > cap ? 'bad' : '')}${row('Health', Math.round(Math.max(0, p.health)) + '%', p.health < 40 ? 'bad' : '')}
      ${row('Endurance', Math.round(st.endurance * 100) + '%', st.endurance < 0.25 ? 'warn' : '')}${row('Body temperature', st.temp.toFixed(1) + '°C', st.temp < 35.5 || st.temp > 38.5 ? 'warn' : '')}
      ${row('Hunger', Math.round(st.hunger * 100) + '%', st.hunger > 0.5 ? 'warn' : '')}${row('Thirst', Math.round(st.thirst * 100) + '%', st.thirst > 0.5 ? 'warn' : '')}${row('Fatigue', Math.round(st.fatigue * 100) + '%', st.fatigue > 0.6 ? 'warn' : '')}</div>
      <div class="exr"><span class="sml">Exercise:</span><span class="btn xs" data-ex="squats">Squats</span><span class="btn xs" data-ex="pushups">Push-ups</span><span class="btn xs" data-ex="situps">Sit-ups</span></div>`;
    if (!P.bound2) {
      P.bound2 = true;
      P.body.addEventListener('click', (e) => { const b = e.target.closest('[data-ex]'); if (b) { Actions.queue(Actions.exercise(b.dataset.ex)); } });
    }
    const cv = P.body.querySelector('.cprev');
    const g = cv.getContext('2d');
    g.save(); g.translate(55, 136); g.scale(1.75, 1.75);
    Char3D.preview(g, 0, 0, 0.75, Player.look(), { t: 0, amp: 0 });
    g.restore();
  },
  // what is worn over each part of the body and what it stops, as an attack reckons it (bite, scratch)
  renderProt(P) {
    const p = G.player;
    const REG = [['head', 'Head'], ['neck', 'Neck'], ['torso', 'Torso'], ['uarms', 'Upper arms'], ['farms', 'Forearms'], ['hands', 'Hands'], ['groin', 'Groin'], ['ulegs', 'Thighs'], ['llegs', 'Shins'], ['feet', 'Feet']];
    let rows = '';
    for (const [r, n] of REG) {
      let bi = 0, sc = 0;
      const on = [];
      for (const it of p.inv) {
        if (!it.worn) continue;
        const d = ITEMS[it.id];
        if (!d.cover || !d.cover.includes(r)) continue;
        const k = it.cond === undefined ? 1 : 0.5 + it.cond * 0.5;
        bi = 1 - (1 - bi) * (1 - (d.bi || 0) / 100 * k); sc = 1 - (1 - sc) * (1 - (d.sc || 0) / 100 * k);
        on.push(Items.name(it));
      }
      const bar = (v) => `<div class="pbar"><i style="width:${Math.round(v * 100)}%"></i></div><span class="pv">${Math.round(v * 100)}%</span>`;
      rows += `<div class="prow"><span class="pn">${n}</span><span class="pc2">${bar(bi)}</span><span class="pc2">${bar(sc)}</span><span class="pw">${on.length ? U.esc(on.join(', ')) : '<i>bare</i>'}</span></div>`;
    }
    P.body.innerHTML = `<div class="prot"><div class="prow ph2"><span class="pn">Body</span><span class="pc2">Bite</span><span class="pc2">Scratch</span><span class="pw">Worn</span></div>${rows}
      <div class="sml" style="margin-top:8px">How likely your clothing stops a zombie's bite or scratch there. Worn-out clothing protects less; layers add up.</div></div>`;
  },
  // ------------------------------------------------------------------ skills panel
  renderSkills(P) {
    const p = G.player;
    let html = `<div class="skills">`;
    for (const [grp, list] of SKILL_GROUPS) {
      html += `<div class="sgrp">${grp}</div>`;
      for (const sk of list) {
        const s = p.skills[sk];
        const tbl = (sk === 'Fitness' || sk === 'Strength') ? XP_TABLE_PASSIVE : XP_TABLE;
        const prog = s.lv >= 10 ? 1 : s.xp / tbl[s.lv];
        const bm = p.bookMult[sk];
        let boxes = '';
        for (let i = 0; i < 10; i++) boxes += `<i class="${i < s.lv ? 'f' : i === s.lv ? 'p' : ''}">${i === s.lv ? `<b style="width:${prog * 100}%"></b>` : ''}</i>`;
        html += `<div class="srow"><span class="sn">${SKILL_NAMES[sk]}${bm && s.lv <= bm.max ? ' <span class="bm">x' + bm.mult + '</span>' : ''}</span><span class="sb">${boxes}</span></div>`;
      }
    }
    html += '</div>';
    P.body.innerHTML = html;
  },
  // ------------------------------------------------------------------ crafting
  renderCraft(P) {
    const cats = ['Medical', 'Cooking', 'Carpentry', 'Weapons', 'Survival', 'Build'];
    P.cat = P.cat || 'Medical';
    const list = RECIPES.filter(r => r.cat === P.cat);
    if (!P.rec || !list.includes(P.rec)) P.rec = list[0];
    // the tabs show how many of their recipes can be made now; the list marks those, the details give the time, the
    // skill needed, the experience it brings and what the result is
    const ready = (c) => RECIPES.filter(r => r.cat === c && Crafting.has(r)).length;
    const tabs = cats.map(c => { const n = ready(c); return `<span class="ctab ${c === P.cat ? 'on' : ''}" data-cc="${c}">${c}${n ? ' <b class="cn">' + n + '</b>' : ''}</span>`; }).join('');
    const icon = (r) => Icons.url({ id: r.out ? r.out[0][0] : (r.obj === 'campfire' ? 'TreeBranch' : r.obj === 'barrel' ? 'Bucket' : 'Plank') });
    const rows = list.map(r => `<div class="crow ${r === P.rec ? 'on' : ''} ${Crafting.has(r) ? 'ok' : ''}" data-cr="${r.id}"><img src="${icon(r)}"><span class="cnm">${U.esc(r.n)}</span>${Crafting.has(r) ? '<i class="cok"></i>' : ''}</div>`).join('');
    let det = '';
    if (P.rec) {
      const r = P.rec;
      const chk = Crafting.check(r);
      const o0 = r.out && ITEMS[r.out[0][0]], sk = r.skill ? Object.entries(r.skill) : [], xp = r.xp ? Object.entries(r.xp) : [];
      const info = [`<span>Time <b>${r.time || 1} s</b></span>`]
        .concat(sk.map(([k, v]) => { const lv = G.player.skills[k] ? G.player.skills[k].lv : 0; return `<span class="${lv >= v ? '' : 'bad'}">Needs <b>${SKILL_NAMES[k] || k} ${v}</b></span>`; }))
        .concat(xp.length ? [`<span>XP <b>${xp.map(([k, v]) => (SKILL_NAMES[k] || k) + ' +' + v).join(', ')}</b></span>`] : []).join('');
      det = `<div class="cdet"><div class="chead"><img src="${icon(r)}"><div><div class="ctitle">${U.esc(r.n)}</div><div class="sml">${r.build ? 'Construction — place it in the world.' : 'Produces: ' + r.out.map(([id, n]) => n + '× ' + ITEMS[id].n).join(', ')}</div></div></div>${o0 && o0.desc ? `<div class="cdesc sml">${U.esc(o0.desc)}</div>` : ''}<div class="cinfo sml">${info}</div><div class="req">${chk.map(c => `<div class="${c.have >= c.need ? 'ok' : 'no'}">${c.have >= c.need ? '✔' : '✖'} ${U.esc(c.label)}${c.need > 1 ? ' (' + c.have + '/' + c.need + ')' : ''}</div>`).join('')}</div>
      <div class="cbtns"><span class="btn ${Crafting.has(r) ? '' : 'dis'}" data-craft="1">${r.build ? 'Build' : 'Craft'}</span>${!r.build ? `<span class="btn ${Crafting.has(r) ? '' : 'dis'}" data-craft="5">Craft ×5</span>` : ''}</div></div>`;
    }
    P.body.innerHTML = `<div class="craft"><div class="ctabs">${tabs}</div><div class="cmain"><div class="clist">${rows}</div>${det}</div></div>`;
    if (!P.bound2) {
      P.bound2 = true;
      P.body.addEventListener('click', (e) => {
        const t = e.target.closest('[data-cc]'); if (t) { P.cat = t.dataset.cc; P.rec = null; this.renderCraft(P); return; }
        const r = e.target.closest('[data-cr]'); if (r) { P.rec = RECIPES.find(x => x.id === r.dataset.cr); this.renderCraft(P); return; }
        const b = e.target.closest('[data-craft]');
        if (b && !b.classList.contains('dis') && P.rec) { Crafting.craft(P.rec, +b.dataset.craft); if (P.rec.build) this.close('craft'); }
      });
    }
  },

  // ------------------------------------------------------------------ pause & death
  togglePause() {
    const m = $('#menu');
    if (m.querySelector('.pausing')) { m.innerHTML = ''; return; }
    m.innerHTML = `<div class="modal pausing"><div class="mbox"><h2>Paused</h2>
      <div class="btn big" data-m="resume">Resume</div>
      <div class="btn big" data-m="save">Save game</div>
      <div class="btn big" data-m="options">Settings</div>
      <div class="btn big" data-m="controls">Controls</div>
      <div class="btn big" data-m="quit">Save &amp; quit to menu</div></div></div>`;
    m.onclick = (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      const k = b.dataset.m;
      if (k === 'resume') m.innerHTML = '';
      if (k === 'save') Save.save(false);
      if (k === 'options') Menu.options(true);
      if (k === 'controls') Menu.controls(true);
      if (k === 'quit') { Save.save(true).then(() => { m.innerHTML = ''; Menu.show(); }); }
    };
  },
  showDeath() {
    const p = G.player;
    G.mode = 'dead';
    const days = Math.floor(p.minutesAlive / 1440), hrs = Math.floor((p.minutesAlive % 1440) / 60);
    this.closeAll();
    $('#menu').innerHTML = `<div class="modal death"><div class="mbox dbox"><h1>You died.</h1>
      <div class="dsub">${U.esc(p.name)} survived ${days} day${days === 1 ? '' : 's'} and ${hrs} hour${hrs === 1 ? '' : 's'}.</div>
      <div class="dsub">Cause of death: ${U.esc(p.deathCause)}</div>
      <div class="dsub">Zombies killed: ${p.kills}</div>
      ${p.reanimate ? '<div class="dsub bad">...and the dead do not stay down in Hollow Creek.</div>' : ''}
      <div class="btn big" data-m="new">New character</div><div class="btn big" data-m="menu">Main menu</div></div></div>`;
    $('#menu').onclick = (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      if (b.dataset.m === 'new') Menu.create();
      if (b.dataset.m === 'menu') Menu.show();
    };
  },
};

// ---------------------------------------------------------------------------
// Moodle & container icons
// ---------------------------------------------------------------------------
const MoodleIcons = {
  cache: {},
  url(id) {
    if (this.cache[id]) return this.cache[id];
    const c = mkCanvas(36, 36), g = c.getContext('2d');
    g.strokeStyle = '#1a1a1a'; g.fillStyle = '#1a1a1a'; g.lineWidth = 2.5; g.lineCap = 'round'; g.lineJoin = 'round';
    const drop = (x, y, s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y - 8 * s); g.bezierCurveTo(x + 7 * s, y + 1 * s, x + 6 * s, y + 8 * s, x, y + 8 * s); g.bezierCurveTo(x - 6 * s, y + 8 * s, x - 7 * s, y + 1 * s, x, y - 8 * s); g.fill(); };
    switch (id) {
      case 'hungry': case 'fed': g.beginPath(); g.arc(18, 19, 9, 0, 7); g.stroke(); g.beginPath(); g.moveTo(6, 7); g.lineTo(6, 30); g.moveTo(30, 7); g.lineTo(30, 30); g.stroke(); if (id === 'fed') { g.beginPath(); g.arc(18, 17, 4, 0.2, Math.PI - 0.2); g.stroke(); } break;
      case 'thirsty': drop(18, 18, 1.4, '#1a3a6a'); break;
      case 'tired': g.font = 'bold 17px Verdana'; g.fillText('Z', 7, 25); g.font = 'bold 12px Verdana'; g.fillText('z', 21, 15); g.font = 'bold 9px Verdana'; g.fillText('z', 28, 8); break;
      case 'endurance': g.beginPath(); g.arc(21, 8, 3.5, 0, 7); g.fill(); g.beginPath(); g.moveTo(19, 12); g.lineTo(15, 21); g.lineTo(21, 26); g.lineTo(19, 32); g.moveTo(15, 21); g.lineTo(9, 29); g.moveTo(18, 15); g.lineTo(26, 18); g.moveTo(18, 15); g.lineTo(10, 15); g.stroke(); break;
      case 'panic': g.font = 'bold 26px Verdana'; g.fillText('!', 13, 28); g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.moveTo(18 + Math.cos(a) * 12, 18 + Math.sin(a) * 12); g.lineTo(18 + Math.cos(a) * 15, 18 + Math.sin(a) * 15); } g.stroke(); break;
      case 'stress': g.beginPath(); g.moveTo(21, 4); g.lineTo(11, 19); g.lineTo(19, 19); g.lineTo(14, 32); g.lineTo(26, 15); g.lineTo(18, 15); g.closePath(); g.fill(); break;
      case 'bored': for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(9 + k * 9, 20, 2.8, 0, 7); g.fill(); } break;
      case 'unhappy': g.beginPath(); g.arc(18, 18, 12, 0, 7); g.stroke(); g.beginPath(); g.arc(18, 28, 6, Math.PI + 0.4, -0.4); g.stroke(); g.fillRect(12, 13, 3, 3); g.fillRect(21, 13, 3, 3); break;
      case 'pain': g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, r = k & 1 ? 6 : 14; g.lineTo(18 + Math.cos(a) * r, 18 + Math.sin(a) * r); } g.closePath(); g.fill(); break;
      case 'bleeding': drop(18, 18, 1.4, '#8a0a0a'); break;
      case 'injured': g.fillRect(14, 6, 8, 24); g.fillRect(6, 14, 24, 8); break;
      case 'sick': g.beginPath(); g.arc(18, 18, 12, 0, 7); g.stroke(); g.beginPath(); g.moveTo(11, 26); g.quadraticCurveTo(14, 22, 18, 26); g.quadraticCurveTo(22, 30, 25, 26); g.stroke(); g.beginPath(); g.moveTo(11, 12); g.lineTo(15, 15); g.moveTo(25, 12); g.lineTo(21, 15); g.stroke(); break;
      case 'heavy': g.beginPath(); g.moveTo(9, 30); g.lineTo(12, 13); g.lineTo(24, 13); g.lineTo(27, 30); g.closePath(); g.fill(); g.beginPath(); g.arc(18, 10, 4, 0, 7); g.stroke(); break;
      case 'wet': drop(11, 14, 0.7, '#1a3a6a'); drop(24, 12, 0.7, '#1a3a6a'); drop(17, 25, 0.8, '#1a3a6a'); break;
      case 'hot': case 'cold': g.beginPath(); g.arc(18, 25, 6, 0, 7); g.fill(); g.fillRect(15, 5, 6, 18); g.fillStyle = id === 'hot' ? '#c02020' : '#2050c0'; g.beginPath(); g.arc(18, 25, 4, 0, 7); g.fill(); g.fillRect(17, id === 'hot' ? 9 : 17, 2, 10); break;
      case 'drunk': g.beginPath(); g.moveTo(10, 8); g.lineTo(26, 8); g.lineTo(19, 19); g.lineTo(19, 28); g.moveTo(13, 29); g.lineTo(25, 29); g.moveTo(19, 19); g.lineTo(10, 8); g.stroke(); break;
      default: g.beginPath(); g.arc(18, 18, 8, 0, 7); g.fill();
    }
    return (this.cache[id] = c.toDataURL());
  },
};
const ContIcons = {
  draw(g, key) {
    const [k, t] = key.split(':');
    g.clearRect(0, 0, 26, 26);
    g.strokeStyle = '#d8d0c0'; g.fillStyle = '#d8d0c0'; g.lineWidth = 2; g.lineJoin = 'round';
    if (k === 'inv') { g.strokeRect(5, 9, 16, 13); g.beginPath(); g.arc(13, 9, 4, Math.PI, 0); g.stroke(); }
    else if (k === 'floor') { g.beginPath(); g.moveTo(13, 6); g.lineTo(24, 13); g.lineTo(13, 20); g.lineTo(2, 13); g.closePath(); g.stroke(); }
    else if (k === 'corpse') { g.beginPath(); g.arc(6, 13, 3.5, 0, 7); g.fill(); g.fillRect(9, 11, 13, 5); }
    else if (k === 'car') { g.fillRect(3, 12, 20, 7); g.fillRect(7, 7, 11, 6); g.fillStyle = '#222'; g.beginPath(); g.arc(8, 20, 2.5, 0, 7); g.arc(18, 20, 2.5, 0, 7); g.fill(); }
    else if (t === 'fridge' || t === 'cooler') { g.strokeRect(7, 2, 12, 22); g.beginPath(); g.moveTo(7, 10); g.lineTo(19, 10); g.stroke(); }
    else if (t === 'wardrobe' || t === 'locker' || t === 'bookshelf') { g.strokeRect(5, 2, 16, 22); g.beginPath(); g.moveTo(13, 2); g.lineTo(13, 24); g.stroke(); }
    else if (t === 'stove' || t === 'bbq' || t === 'campfire') { g.strokeRect(4, 6, 18, 16); g.beginPath(); g.arc(9, 11, 2, 0, 7); g.arc(17, 11, 2, 0, 7); g.stroke(); }
    else if (t === 'trash') { g.beginPath(); g.moveTo(6, 7); g.lineTo(20, 7); g.lineTo(18, 23); g.lineTo(8, 23); g.closePath(); g.stroke(); }
    else if (t === 'crate' || t === 'woodcrate') { g.strokeRect(4, 6, 18, 16); g.beginPath(); g.moveTo(4, 6); g.lineTo(22, 22); g.stroke(); }
    else { g.strokeRect(4, 7, 18, 14); g.beginPath(); g.moveTo(4, 14); g.lineTo(22, 14); g.stroke(); g.fillRect(11, 9, 4, 2); g.fillRect(11, 16, 4, 2); }
  },
};

// ---------------------------------------------------------------------------
// Map view
// ---------------------------------------------------------------------------
const MapView = {
  zoom: 2.5, cx: 120, cy: 120, revealed: false,
  // the markers the player can put on the map: symbol, name, ink colour
  MARKS: [['⌂', 'Safehouse', '#2a6a2a'], ['✚', 'Medical', '#b02020'], ['★', 'Loot', '#a07010'], ['⚠', 'Danger', '#c03018'], ['⛽', 'Fuel', '#2a4a8a'], ['●', 'Note', '#3a2e22']],
  reveal() { this.revealed = true; Player.say('Now I know the area.', '#8f8'); this.base = null; },
  render(P) {
    if (!P.body.querySelector('canvas')) {
      P.body.innerHTML = `<div class="mapw"><canvas class="mapc"></canvas><div class="mapl sml">Drag to pan · wheel to zoom · right-click to mark · explored areas only${this.revealed ? '' : ' (find a map to reveal more)'}</div></div>`;
      const cv = P.body.querySelector('canvas');
      cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = U.clamp(this.zoom * (e.deltaY > 0 ? 0.85 : 1.18), Math.min(1.2, 560 / (Wd.gw || Wd.w)), 10); this.draw(); }, { passive: false });
      // right-click: put a marker there (a safehouse, loot, danger...) or take one away
      cv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const r = cv.getBoundingClientRect(), k = this.zoom, sx = (e.clientX - r.left) * cv.width / r.width, sy = (e.clientY - r.top) * cv.height / r.height;
        const wx = (sx - cv.width / 2) / k + this.cx, wy = (sy - cv.height / 2) / k + this.cy, p = G.player, M = p.marks || (p.marks = []);
        const near = M.findIndex(m => Math.hypot(m.x - wx, m.y - wy) < 10 / k + 1.5);
        const opts = this.MARKS.map(([sym, name, col]) => ({ label: sym + '  ' + name, fn: () => { M.push({ x: wx, y: wy, s: sym, n: name, c: col }); this.draw(); } }));
        if (near >= 0) opts.unshift({ label: 'Remove marker', fn: () => { M.splice(near, 1); this.draw(); } });
        UI.showContext(e.clientX, e.clientY, opts);
      });
      cv.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        this.dragging = true; const sx = e.clientX, sy = e.clientY, ox = this.cx, oy = this.cy;
        const mv = (ev) => { if (!this.dragging) return; const k = this.zoom * UI.scale; this.cx = ox - (ev.clientX - sx) / k; this.cy = oy - (ev.clientY - sy) / k; this.draw(); };
        const up = () => { this.dragging = false; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      });
      this.cx = vxOf(G.player.x); this.cy = G.player.y; this.zoom = 4;
    }
    this.draw();
  },
  // the map is drawn like a paper road map: cream paper, white roads edged in grey, buildings in tan with a darker
  // outline, pale green fields, darker woods with tree dots, blue water; what you have not seen is faded paper
  buildBase() {
    const w = Wd, GW = w.gw || w.w;
    const c = mkCanvas(GW, w.h), g = c.getContext('2d');
    const img = g.createImageData(GW, w.h);
    const cols = {};
    const hex = (h) => Col.rgb(h);
    cols[FL.GRASS] = hex('#d2dcb2'); cols[FL.GRASS2] = hex('#ccd8aa'); cols[FL.FOREST] = hex('#a8c48e'); cols[FL.DIRT] = hex('#e2d4b0'); cols[FL.ASPHALT] = hex('#fbf8f0'); cols[FL.SIDEWALK] = hex('#e6e0d2');
    cols[FL.CONCRETE] = hex('#e0dbd0'); cols[FL.SAND] = hex('#ecdcb4'); cols[FL.WATER] = hex('#a8cce0'); cols[FL.DEEPWATER] = hex('#8fbad6'); cols[FL.FURROW] = hex('#dcc89a'); cols[FL.GRAVEL] = hex('#e2dccc'); cols[FL.PARKING] = hex('#e8e4da');
    const ROAD = FL.ASPHALT, paper = [216, 208, 188], edge = [150, 146, 138], bldg = [222, 196, 156], bEdge = [136, 104, 70], wood = [120, 158, 100];
    const isRoad = (i) => w.floor[i] === ROAD && w.room[i] < 0;
    for (let y = 0; y < w.h; y++) for (let x = 0; x < GW; x++) {
      const i = y * w.w + x, q = (y * GW + x) * 4;
      let c3;
      if (w.room[i] >= 0) {
        // a building: tan, outlined where it meets the outside
        const out = (x > 0 && w.room[i - 1] < 0) || (x < GW - 1 && w.room[i + 1] < 0) || (y > 0 && w.room[i - w.w] < 0) || (y < w.h - 1 && w.room[i + w.w] < 0);
        c3 = out ? bEdge : bldg;
      } else {
        c3 = cols[w.floor[i]] || [204, 214, 170];
        // a road's edge drawn as a grey line where it meets anything else
        if (isRoad(i) && ((x > 0 && !isRoad(i - 1)) || (x < GW - 1 && !isRoad(i + 1)) || (y > 0 && !isRoad(i - w.w)) || (y < w.h - 1 && !isRoad(i + w.w)))) c3 = edge;
      }
      const o = w.obj[i];
      if (o && o.t === 'tree') c3 = wood;
      // the paper's grain
      const n = ((x * 73856093 ^ y * 19349663) >>> 0) % 7 - 3;
      const known = this.revealed || w.seen[i];
      let r = c3[0] + n, gg = c3[1] + n, bb = c3[2] + n;
      if (!known) { const k = 0.82; r = r * (1 - k) + paper[0] * k; gg = gg * (1 - k) + paper[1] * k; bb = bb * (1 - k) + paper[2] * k; if (((x + y) & 7) === 0) { r -= 14; gg -= 14; bb -= 14; } }
      img.data[q] = r; img.data[q + 1] = gg; img.data[q + 2] = bb; img.data[q + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.base = c; this.baseT = performance.now();
  },
  // the map labels sorted into ranks (0 towns, 1 places and roads, 2 buildings), worked out again when they change
  labelTiers() {
    const L = Wd.labels;
    if (this.tiers && this.tiersN === L.length && this.tiersW === Wd) return this.tiers;
    const towns = new Set(['Hollow Creek', 'Millbrook', 'Fairfield', 'Riverton', 'Kingsbury']);
    const bnames = new Set(); for (const b of Wd.buildings) if (b.name) bnames.add(b.name);
    const T = [[], [], []];
    for (const l of L) T[towns.has(l.text) ? 0 : bnames.has(l.text) || /^(Barracks|Cell Block|Hangar)/.test(l.text) ? 2 : 1].push(l);
    this.tiers = T; this.tiersN = L.length; this.tiersW = Wd;
    return T;
  },
  draw() {
    const P = UI.panels.map;
    if (!P || !P.open) return;
    const cv = P.body.querySelector('canvas');
    if (!cv) return;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    if (!this.base || performance.now() - this.baseT > 3000) this.buildBase();
    const g = cv.getContext('2d');
    g.fillStyle = '#d8d0bc'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    g.save();
    g.translate(W / 2, H / 2); g.scale(this.zoom, this.zoom); g.translate(-this.cx, -this.cy);
    g.drawImage(this.base, 0, 0);
    // labels
    g.restore();
    // labels by rank: towns always, places and roads from a middling zoom, single buildings close in; one that
    // would overlap a label already drawn is left out
    const T = this.labelTiers(), z = this.zoom, drawn = [];
    g.textAlign = 'center';
    for (const tier of [0, 1, 2]) {
      if (tier === 1 && z < 1.6 || tier === 2 && z < 3.2) break;
      g.font = tier === 0 ? 'bold 13px Verdana' : tier === 1 ? 'bold 11px Verdana' : '10px Verdana';
      for (const l of T[tier]) {
        const known = this.revealed || Wd.seen[Math.floor(l.y) * Wd.w + Math.floor(l.x)];
        if (!known) continue;
        const sx = (l.x - this.cx) * z + W / 2, sy = (l.y - this.cy) * z + H / 2;
        if (sx < -80 || sx > W + 80 || sy < -20 || sy > H + 20) continue;
        const hw = g.measureText(l.text).width / 2 + 3, hh = tier === 0 ? 9 : 7;
        if (drawn.some(q => Math.abs(q[0] - sx) < q[2] + hw && Math.abs(q[1] - sy) < q[3] + hh)) continue;
        drawn.push([sx, sy, hw, hh]);
        // printed in ink with a paper halo, towns in capitals
        const tx = tier === 0 ? l.text.toUpperCase() : l.text;
        g.lineWidth = 3; g.strokeStyle = 'rgba(246,240,224,0.92)'; g.strokeText(tx, sx, sy);
        g.fillStyle = tier === 0 ? '#2a2018' : tier === 1 ? '#4a3a2a' : '#5a4a3a'; g.fillText(tx, sx, sy);
      }
    }
    // the player's own markers, inked on top
    const p = G.player;
    if (p.marks) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const m of p.marks) {
        const sx = (m.x - this.cx) * this.zoom + W / 2, sy = (m.y - this.cy) * this.zoom + H / 2;
        if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
        g.font = 'bold 15px Verdana'; g.lineWidth = 3; g.strokeStyle = 'rgba(246,240,224,0.95)'; g.strokeText(m.s, sx, sy); g.fillStyle = m.c; g.fillText(m.s, sx, sy);
        if (this.zoom >= 2) { g.font = '9px Verdana'; g.strokeText(m.n, sx, sy + 13); g.fillStyle = m.c; g.fillText(m.n, sx, sy + 13); }
      }
      g.textBaseline = 'alphabetic';
    }
    // player
    const px = (vxOf(p.x) - this.cx) * this.zoom + W / 2, py = (p.y - this.cy) * this.zoom + H / 2;
    g.save(); g.translate(px, py); g.rotate(p.angle);
    g.fillStyle = '#d02020'; g.strokeStyle = '#fff8e8'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, 6); g.lineTo(-3, 0); g.lineTo(-6, -6); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = '#3a2e22'; g.textAlign = 'left'; g.font = 'bold 11px Verdana'; g.fillText('N ↑', 8, 16);
  },
};
