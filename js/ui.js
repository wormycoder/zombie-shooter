'use strict';
// ---------------------------------------------------------------------------
// UI: HUD, windows, context menus
// ---------------------------------------------------------------------------
const $ = (s, r) => (r || document).querySelector(s);
const UI = {
  panels: {}, dirty: true, slowT: 0, typing: false, ctxOpen: false, logLines: [],
  init() {
    this.root = $('#ui');
    this.hud = $('#hud');
    this.ctx = $('#ctxmenu');
    this.tip = $('#tooltip');
    document.addEventListener('focusin', (e) => { this.typing = e.target.tagName === 'INPUT'; });
    document.addEventListener('focusout', () => { this.typing = false; });
    document.addEventListener('mousedown', (e) => { if (this.ctxOpen && !this.ctx.contains(e.target)) this.closeContext(); });
    // sidebar
    $('#sidebar').innerHTML = [['inv', 'Inventory (I)', 'I'], ['health', 'Health (H)', 'H'], ['craft', 'Crafting (B)', 'B'], ['skills', 'Character & Skills (K)', 'K'], ['map', 'Map (M)', 'M'], ['pause', 'Menu (Esc)', '≡']].map(([k, t, l]) => `<div class="sbtn" data-k="${k}" title="${t}"><canvas width="28" height="28" data-icon="${k}"></canvas><span>${l}</span></div>`).join('');
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
    $('#equip').addEventListener('click', (e) => {
      const s = e.target.closest('[data-hot]');
      if (s) this.useHotbar(+s.dataset.hot);
    });
    $('#equip').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const s = e.target.closest('[data-slot]');
      if (!s) return;
      const it = s.dataset.slot === 'p' ? Player.primary() : Player.secondary();
      if (it) this.itemMenu(e.clientX, e.clientY, it, Cont.inv());
    });
    $('#moodles').addEventListener('mousemove', (e) => {
      const m = e.target.closest('.moodle');
      if (!m) { this.hideTip(); return; }
      this.showTip(e.clientX, e.clientY, `<b>${m.dataset.name}</b><br>${m.dataset.desc}`);
    });
    $('#moodles').addEventListener('mouseleave', () => this.hideTip());
    window.addEventListener('mousemove', (e) => { Input.overUI = e.target !== Render.cv; });
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
    const btn = (s, l) => `<span class="spd ${(!G.paused && sp === s) || (s === 0 && G.paused) ? 'on' : ''}" data-speed="${s}">${l}</span>`;
    const clockHtml = `<div class="date">${watch ? Game.dateStr() : 'Day ' + (Game.day() + 1)}</div><div class="time">${watch ? Game.timeStr() : Game.fuzzyTime()}</div><div class="wx">${wIcon} · ${temp}°C${G.events.powerOff ? ' · <span class="bad">No power</span>' : ''}</div><div class="speeds">${btn(0, '❚❚')}${btn(1, '▶')}${btn(3, '▶▶')}${btn(8, '▶▶▶')}${btn(20, '▶▶▶▶')}</div>`;
    if (clockHtml !== this._clock) { $('#clock').innerHTML = clockHtml; this._clock = clockHtml; }
    this.slowT -= dt;
    if (this.slowT <= 0) {
      this.slowT = 0.25;
      this.renderMoodles();
      this.renderEquip();
      this.renderLog();
      if (this.panels.loot && this.panels.loot.open) this.checkLootChange();
      if (this.panels.health && this.panels.health.open) this.healthT = (this.healthT || 0) + 1;
      if (this.healthT > 4) { this.healthT = 0; this.renderPanel('health'); }
      if (this.panels.skills && this.panels.skills.open) { this.skT = (this.skT || 0) + 1; if (this.skT > 8) { this.skT = 0; this.renderPanel('skills'); } }
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
      const ammo = d.gun ? `<span class="ammo">${it.ammo}/${d.gun.cap}${' · ' + Player.count(d.gun.ammo)}</span>` : (d.light ? `<span class="ammo">${it.on ? 'ON' : 'off'}</span>` : '');
      return `<div class="eslot" data-slot="${k}" title="${U.esc(Items.name(it))}"><img src="${Icons.url(it)}">${bar}${ammo}<span class="lbl">${label}</span></div>`;
    };
    const pr = Player.primary(), se = Player.secondary();
    let html = slot(pr, 'p', 'Primary') + (pr && pr === se ? '' : slot(se, 's', 'Secondary'));
    html += '<div class="hotbar">';
    for (let i = 0; i < 5; i++) {
      const it = p.hotbar[i] ? Player.find(x => x.uid === p.hotbar[i]) : null;
      html += `<div class="hslot" data-hot="${i}">${it ? `<img src="${Icons.url(it)}" title="${U.esc(Items.name(it))}">` : ''}<span>${i + 1}</span></div>`;
    }
    html += '</div>';
    const wt = Player.weight(), cap = Player.capacity();
    html += `<div class="estat"><span class="${wt > cap ? 'bad' : ''}">${U.fmt1(wt)} / ${U.fmt1(cap)} kg</span> · Kills: ${p.kills} · Day ${Game.day() + 1}</div>`;
    if (html !== this._eq) { $('#equip').innerHTML = html; this._eq = html; }
  },
  useHotbar(i) {
    const p = G.player;
    const it = p.hotbar[i] ? Player.find(x => x.uid === p.hotbar[i]) : null;
    if (!it) return;
    const d = ITEMS[it.id];
    if (d.cat === 'Food' && !d.fluid) Actions.queue(Actions.eat(it));
    else if (d.fluid) Actions.queue(Actions.drink(it));
    else if (d.pill) Actions.queue(Actions.pills(it));
    else if (it.equipped) Player.unequip(it);
    else Player.equip(it, d.light || (d.bag && d.bag.hand && !d.wpn) ? 'secondary' : 'primary');
    this.refresh();
  },

  // ------------------------------------------------------------------ panels
  panelDefs: {
    inv: { title: 'Inventory', w: 420, h: 420, x: 70, y: 90 },
    loot: { title: 'Loot', w: 420, h: 420, x: 500, y: 90 },
    health: { title: 'Health', w: 460, h: 420, x: 120, y: 80 },
    skills: { title: 'Character', w: 440, h: 520, x: 140, y: 60 },
    craft: { title: 'Crafting', w: 560, h: 440, x: 160, y: 80 },
    map: { title: 'Map', w: 600, h: 600, x: 200, y: 40 },
  },
  ensurePanel(k) {
    if (this.panels[k]) return this.panels[k];
    const d = this.panelDefs[k];
    const el = document.createElement('div');
    el.className = 'panel hidden';
    el.style.left = Math.min(window.innerWidth - d.w - 10, d.x) + 'px'; el.style.top = d.y + 'px';
    el.style.width = d.w + 'px'; el.style.height = d.h + 'px';
    el.innerHTML = `<div class="ph"><span class="pt">${d.title}</span><span class="px">✕</span></div><div class="pb"></div>`;
    $('#windows').appendChild(el);
    const P = { k, el, body: el.querySelector('.pb'), open: false, tab: null };
    this.panels[k] = P;
    el.querySelector('.px').onclick = () => this.close(k);
    // drag
    const ph = el.querySelector('.ph');
    ph.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('px')) return;
      const ox = e.clientX - el.offsetLeft, oy = e.clientY - el.offsetTop;
      const mv = (ev) => { el.style.left = U.clamp(ev.clientX - ox, 0, window.innerWidth - 60) + 'px'; el.style.top = U.clamp(ev.clientY - oy, 0, window.innerHeight - 30) + 'px'; };
      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      this.front(el);
    });
    el.addEventListener('mousedown', () => this.front(el));
    this.bindPanel(P);
    return P;
  },
  front(el) { this._z = (this._z || 10) + 1; el.style.zIndex = this._z; },
  open(k) { const P = this.ensurePanel(k); P.open = true; P.el.classList.remove('hidden'); this.front(P.el); this.renderPanel(k); },
  close(k) { const P = this.panels[k]; if (!P) return; P.open = false; P.el.classList.add('hidden'); this.hideTip(); if (k === 'map') MapView.dragging = false; },
  toggle(k) {
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
    else if (k === 'health') this.renderHealth(P);
    else if (k === 'skills') this.renderSkills(P);
    else if (k === 'craft') this.renderCraft(P);
    else if (k === 'map') MapView.render(P);
  },
  checkLootChange() {
    const key = Interact.nearby().map(c => c.key + ':' + c.items.length).join('|');
    if (key !== this._lootKey) { this._lootKey = key; this.renderPanel('loot'); }
  },
  // ---------------- container lists
  renderContainers(P, conts, mine) {
    P.conts = conts;
    if (!P.tab || !conts.find(c => c.key === P.tab)) {
      const ne = !mine ? conts.find(c => c.items.length && c.kind !== 'floor') || conts.find(c => c.items.length) : null;
      P.tab = (ne || conts[0] || {}).key;
    }
    const cur = conts.find(c => c.key === P.tab);
    const tabs = conts.map(c => {
      const ic = c.kind === 'inv' ? 'inv' : c.kind === 'bag' ? null : c.kind;
      const img = c.kind === 'bag' ? `<img src="${Icons.url(c.bag)}">` : `<canvas width="26" height="26" data-cic="${ic}${c.kind === 'obj' ? ':' + c.obj.t : ''}"></canvas>`;
      return `<div class="tab ${c.key === P.tab ? 'on' : ''}" data-tab="${c.key}" title="${U.esc(c.name)}">${img}${c.items.length ? '' : '<i class="empty"></i>'}</div>`;
    }).join('');
    let head = '', list = '';
    if (cur) {
      const w = Cont.weight(cur), cap = Cont.cap(cur);
      head = `<div class="ihead"><span class="cn">${U.esc(cur.name)}</span><span class="cw ${w > cap ? 'bad' : ''}">${U.fmt1(w)}${cap < 9999 ? ' / ' + U.fmt1(cap) : ''}</span>${!mine && cur.items.length ? '<span class="btn sm" data-act="lootall">Loot all</span>' : ''}${mine && cur.kind === 'inv' ? '' : ''}</div>`;
      const groups = new Map();
      for (const it of cur.items) {
        const k = Items.stackKey(it);
        let g = groups.get(k);
        if (!g) { g = { items: [], key: k }; groups.set(k, g); }
        g.items.push(it);
      }
      P.groups = groups;
      const sorted = [...groups.values()].sort((a, b) => {
        const A = a.items[0], B = b.items[0];
        const wa = (A.equipped || A.worn) ? 0 : 1, wb = (B.equipped || B.worn) ? 0 : 1;
        if (wa !== wb) return wa - wb;
        const ca = ITEMS[A.id].cat, cb = ITEMS[B.id].cat;
        if (ca !== cb) return ca < cb ? -1 : 1;
        return Items.name(A) < Items.name(B) ? -1 : 1;
      });
      list = sorted.map(g => this.rowHtml(g, cur)).join('') || '<div class="emptyl">Empty</div>';
    }
    const scroll = P.body.querySelector('.ilist') ? P.body.querySelector('.ilist').scrollTop : 0;
    P.body.innerHTML = `<div class="inv"><div class="tabs">${tabs}</div><div class="iwrap">${head}<div class="ilist" data-cont="${cur ? cur.key : ''}">${list}</div></div></div>`;
    P.body.querySelector('.ilist').scrollTop = scroll;
    for (const c of P.body.querySelectorAll('canvas[data-cic]')) ContIcons.draw(c.getContext('2d'), c.dataset.cic);
    P.el.querySelector('.pt').textContent = mine ? 'Inventory' : (cur ? cur.name : 'Loot');
  },
  rowHtml(g, cont) {
    const it = g.items[0], d = ITEMS[it.id];
    const n = g.items.length;
    let badge = '';
    if (it.equipped) badge = '<span class="bdg eq">' + (it.equipped === 'both' ? 'Both hands' : it.equipped === 'primary' ? 'Primary' : 'Secondary') + '</span>';
    if (it.worn) badge = '<span class="bdg wo">Worn</span>';
    const fs = Items.freshState(it);
    const cls = fs === 2 ? 'rotten' : fs === 1 ? 'stale' : '';
    let bar = '';
    if (d.wpn || d.gun) bar = `<div class="cbar"><i style="width:${Math.max(0, it.cond / (d.wpn || d.gun).cond * 100)}%"></i></div>`;
    else if (d.fluid) bar = `<div class="cbar fl"><i style="width:${it.fl / d.fluid * 100}%"></i></div>`;
    else if (d.gas !== undefined) bar = `<div class="cbar gs"><i style="width:${it.fl / d.gas * 100}%"></i></div>`;
    else if (d.power !== undefined) bar = `<div class="cbar pw"><i style="width:${it.pow * 100}%"></i></div>`;
    else if (d.uses && n === 1) bar = `<div class="cbar us"><i style="width:${it.uses / d.uses * 100}%"></i></div>`;
    else if (it.readP) bar = `<div class="cbar fl"><i style="width:${it.readP * 100}%"></i></div>`;
    const w = n * Items.weight(it);
    return `<div class="row ${cls}" draggable="true" data-g="${U.esc(g.key)}"><img src="${Icons.url(it)}"><span class="nm">${U.esc(Items.name(it))}${n > 1 ? ' <b>×' + n + '</b>' : ''}${badge}</span>${bar}<span class="ct">${d.cat}</span><span class="wt">${U.fmt2(w)}</span></div>`;
  },
  bindPanel(P) {
    const body = P.body;
    body.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { P.tab = tab.dataset.tab; this.renderPanel(P.k); return; }
      const act = e.target.closest('[data-act]');
      if (act) { this.panelAction(P, act.dataset.act, act); return; }
      const row = e.target.closest('.row');
      if (row && e.shiftKey && P.groups) {
        const g = P.groups.get(row.dataset.g);
        const cur = P.conts.find(c => c.key === P.tab);
        this.quickMove(g, cur, P.k);
      }
    });
    body.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.row');
      if (!row || !P.groups) return;
      const g = P.groups.get(row.dataset.g);
      const cur = P.conts.find(c => c.key === P.tab);
      if (g) this.defaultAction(g.items[0], cur, g, P.k);
    });
    body.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const row = e.target.closest('.row');
      if (!row || !P.groups) return;
      const g = P.groups.get(row.dataset.g);
      const cur = P.conts.find(c => c.key === P.tab);
      if (g) this.itemMenu(e.clientX, e.clientY, g.items[0], cur, g);
    });
    body.addEventListener('mousemove', (e) => {
      const row = e.target.closest('.row');
      if (row && P.groups) {
        const g = P.groups.get(row.dataset.g);
        if (g) { const it = g.items[0]; this.showTip(e.clientX, e.clientY, `<b>${U.esc(Items.name(it))}</b><br>${Items.description(it).map(U.esc).join('<br>')}`); return; }
      }
      const part = e.target.closest('[data-part]');
      if (part) return;
      this.hideTip();
    });
    body.addEventListener('mouseleave', () => this.hideTip());
    body.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.row');
      if (!row) return;
      this.drag = { from: P.k, g: row.dataset.g, tab: P.tab };
      e.dataTransfer.setData('text/plain', 'item');
      e.dataTransfer.effectAllowed = 'move';
    });
    P.el.addEventListener('dragover', (e) => { if (this.drag) e.preventDefault(); });
    P.el.addEventListener('drop', (e) => {
      e.preventDefault();
      const dr = this.drag; this.drag = null;
      if (!dr) return;
      const src = this.panels[dr.from];
      const g = src.groups && src.groups.get(dr.g);
      const from = src.conts && src.conts.find(c => c.key === dr.tab);
      if (!g || !from || !P.conts) return;
      const tabEl = e.target.closest('[data-tab]');
      const to = P.conts.find(c => c.key === (tabEl ? tabEl.dataset.tab : P.tab));
      if (!to || to.key === from.key) return;
      for (const it of g.items) Actions.queue(Actions.transfer(it, from, to));
    });
  },
  quickMove(g, cur, pk) {
    if (!g || !cur) return;
    let to;
    if (pk === 'loot') to = Cont.inv();
    else {
      const loot = this.panels.loot;
      to = loot && loot.open && loot.conts ? loot.conts.find(c => c.key === loot.tab) : Cont.floor(Math.floor(G.player.x), Math.floor(G.player.y));
    }
    if (!to || to.key === cur.key) return;
    for (const it of g.items) Actions.queue(Actions.transfer(it, cur, to));
  },
  panelAction(P, act) {
    if (act === 'lootall') {
      const cur = P.conts.find(c => c.key === P.tab);
      if (!cur) return;
      for (const it of cur.items.slice()) Actions.queue(Actions.transfer(it, cur, Cont.inv()));
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
    if (d.bandage !== undefined || d.disinfect || d.suture) add('Treat wounds…', () => this.open('health'));
    if (d.smoke) add('Smoke', via(() => Actions.smoke(it)));
    if (d.cat === 'Literature' && !d.mapItem) add('Read', via(() => Actions.read(it)));
    if (d.mapItem) add('Read map', () => { MapView.reveal(); this.open('map'); });
    if (d.boxOf) add('Open box', via(() => Actions.openBox(it)));
    if (d.moveable && mine) add('Place ' + Items.name(it).toLowerCase(), () => Build.startMove(it));
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
    if (d.gun && mine) { add('Reload', () => { Player.equip(it, 'primary'); Actions.reload(); }); if (it.ammo) add('Unload', () => Actions.queue(Actions.unload(it))); }
    if ((d.wpn || d.gun) && it.cond < (d.wpn || d.gun).cond && mine) {
      for (const tool of Player.findAll(x => ITEMS[x.id].repair)) add('Repair with ' + ITEMS[tool.id].n, () => Actions.queue(Actions.repair(it, tool)));
    }
    if (d.light || d.radio) {
      add(it.on ? 'Turn off' : 'Turn on', () => { if (it.pow <= 0) { Player.say('The batteries are dead.', '#ccc'); return; } it.on = !it.on; if (d.light && it.on && !it.equipped) Player.equip(it, 'secondary'); Sfx.play('switch'); this.refresh(); });
      add('Replace battery', via(() => Actions.battery(it)), { disabled: !Player.findId('Battery') });
    }
    if (d.throwable === 'noise' && mine) add('Set alarm and place here', () => { Player.removeItem(it); Combat.sources.push({ x: p.x, y: p.y, t: 45, pulse: 6 }); World.dropItem(p.x, p.y, it); this.refresh(); Player.say('Alarm set.', '#ccc'); });
    if (d.throwable) add('Equip to throw', via(() => Actions.equip(it, 'primary')));
    if (mine) {
      const sub = [];
      for (let i = 0; i < 5; i++) sub.push({ label: 'Slot ' + (i + 1), fn: () => { p.hotbar[i] = it.uid; this.refresh(); } });
      add('Add to hotbar', null, { sub });
      for (const b of Player.bags()) if (b !== it && !b.items.includes(it)) add('Put in ' + Items.name(b), () => { for (const x2 of (g ? g.items : [it])) Actions.queue(Actions.transfer(x2, cont, Cont.bag(b))); });
      if (cont.kind === 'bag') add('Move to main inventory', () => { for (const x2 of (g ? g.items : [it])) Actions.queue(Actions.transfer(x2, cont, Cont.inv())); });
      add(n > 1 ? 'Drop one' : 'Drop', () => { Actions.queue(Actions.transfer(it, cont, Cont.floor(Math.floor(p.x), Math.floor(p.y)))); });
      if (n > 1) add('Drop all (' + n + ')', () => { for (const x2 of g.items) Actions.queue(Actions.transfer(x2, cont, Cont.floor(Math.floor(p.x), Math.floor(p.y)))); });
    }
    if (it.keyName) add(it.keyName, null, { info: true });
    this.showContext(x, y, opts);
  },
  // ---------------- context menu widget
  showContext(x, y, opts, target) {
    this.ctxOpen = true;
    G.hover = target && (target.edge || target.obj || target.tile) ? { edge: target.edge, tile: target.edge ? null : target.tile } : null;
    const html = opts.map((o, i) => o.info ? `<div class="ci info">${U.esc(o.label)}</div>` : `<div class="ci ${o.disabled ? 'dis' : ''} ${o.sub ? 'hassub' : ''}" data-i="${i}">${U.esc(o.label)}${o.sub ? '<span class="arr">▸</span><div class="sub">' + o.sub.map((s, j) => `<div class="ci" data-i="${i}" data-j="${j}">${U.esc(s.label)}</div>`).join('') + '</div>' : ''}</div>`).join('');
    this.ctx.innerHTML = html;
    this.ctx.classList.remove('hidden');
    const r = this.ctx.getBoundingClientRect();
    this.ctx.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    this.ctx.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
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
  showTip(x, y, html) {
    const t = this.tip;
    t.innerHTML = html; t.classList.remove('hidden');
    const r = t.getBoundingClientRect();
    t.style.left = Math.min(x + 16, window.innerWidth - r.width - 6) + 'px';
    t.style.top = Math.min(y + 12, window.innerHeight - r.height - 6) + 'px';
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
        if (c) { const rect = c.getBoundingClientRect(); const pt = this.bodyHit(e.clientX - rect.left, e.clientY - rect.top); if (pt) { P.sel = pt; this.renderHealth(P); } return; }
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
  drawBody(cv, sel) {
    const g = cv.getContext('2d');
    const p = G.player;
    g.clearRect(0, 0, cv.width, cv.height);
    for (const pt of PARTS) {
      const [x, y, w, h] = this.BODY_RECTS[pt];
      const b = p.body[pt];
      let col = '#4a6a4a';
      if (b.w.scratch) col = '#b0a040';
      if (b.w.cut || b.w.burn) col = '#c07030';
      if (b.w.fracture) col = '#c05a20';
      if (b.w.bite || b.w.deep) col = '#b03030';
      if (b.infect > 0.05) col = '#8a3a8a';
      g.fillStyle = col;
      const r = pt === 'Head' ? 14 : 5;
      roundRect(g, x, y, w, h, r); g.fill();
      if (b.bandage) { g.fillStyle = b.bandage.dirt >= 0.99 ? 'rgba(150,120,80,0.75)' : 'rgba(240,240,230,0.7)'; for (let k = 0; k < 3; k++) g.fillRect(x + 2, y + h * (0.25 + k * 0.2), w - 4, 3); }
      if (b.w.fracture) { g.strokeStyle = '#2a1a10'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 3, y + h * 0.45); g.lineTo(x + w * 0.45, y + h * 0.55); g.lineTo(x + w * 0.6, y + h * 0.42); g.lineTo(x + w - 3, y + h * 0.52); g.stroke(); if (b.splint) { g.fillStyle = '#c8a878'; g.fillRect(x - 2, y + 4, 3, h - 8); g.fillRect(x + w - 1, y + 4, 3, h - 8); } }
      if (Player.partBleed(b) > 0) { g.fillStyle = '#e02020'; g.beginPath(); g.arc(x + w / 2, y + h / 2, 3, 0, 7); g.fill(); }
      g.strokeStyle = sel === pt ? '#ffe080' : 'rgba(0,0,0,0.5)'; g.lineWidth = sel === pt ? 2 : 1;
      roundRect(g, x, y, w, h, r); g.stroke();
    }
  },

  // ------------------------------------------------------------------ skills panel
  renderSkills(P) {
    const p = G.player;
    const occ = OCCUPATIONS.find(o => o.id === p.occ);
    const days = Math.floor(p.minutesAlive / 1440), hrs = Math.floor((p.minutesAlive % 1440) / 60);
    const traits = p.traits.map(t => { const d = traitDef(t); return d ? `<span class="trait ${d.cost < 0 ? 'pos' : d.cost > 0 ? 'neg' : ''}" title="${U.esc(d.desc)}">${d.n}</span>` : ''; }).join('');
    let html = `<div class="cinfo"><canvas class="cprev" width="70" height="90"></canvas><div><div class="cname">${U.esc(p.name)}</div><div>${occ ? occ.n : ''}</div><div class="sml">Survived ${days} days, ${hrs} hours · Zombies killed: ${p.kills}</div><div class="traits">${traits}</div>
      <div class="exr"><span class="sml">Exercise:</span><span class="btn xs" data-ex="squats">Squats</span><span class="btn xs" data-ex="pushups">Push-ups</span><span class="btn xs" data-ex="situps">Sit-ups</span></div></div></div><div class="skills">`;
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
    if (!P.bound2) {
      P.bound2 = true;
      P.body.addEventListener('click', (e) => { const b = e.target.closest('[data-ex]'); if (b) { Actions.queue(Actions.exercise(b.dataset.ex)); } });
    }
    const cv = P.body.querySelector('.cprev');
    const g = cv.getContext('2d');
    g.save(); g.translate(35, 78); g.scale(1.1, 1.1);
    Humanoid.draw(g, 0, 0, 0.75, Player.look(), { t: 0, amp: 0 }, 1);
    g.restore();
  },
  // ------------------------------------------------------------------ crafting
  renderCraft(P) {
    const cats = ['Medical', 'Cooking', 'Carpentry', 'Weapons', 'Survival', 'Build'];
    P.cat = P.cat || 'Medical';
    const list = RECIPES.filter(r => r.cat === P.cat);
    if (!P.rec || !list.includes(P.rec)) P.rec = list[0];
    const tabs = cats.map(c => `<span class="ctab ${c === P.cat ? 'on' : ''}" data-cc="${c}">${c}</span>`).join('');
    const rows = list.map(r => `<div class="crow ${r === P.rec ? 'on' : ''} ${Crafting.has(r) ? 'ok' : ''}" data-cr="${r.id}"><img src="${Icons.url({ id: r.out ? r.out[0][0] : (r.obj === 'campfire' ? 'TreeBranch' : r.obj === 'barrel' ? 'Bucket' : 'Plank') })}">${U.esc(r.n)}</div>`).join('');
    let det = '';
    if (P.rec) {
      const r = P.rec;
      const chk = Crafting.check(r);
      det = `<div class="cdet"><div class="ctitle">${U.esc(r.n)}</div><div class="sml">${r.build ? 'Construction — place it in the world.' : 'Produces: ' + r.out.map(([id, n]) => n + '× ' + ITEMS[id].n).join(', ')}</div><div class="req">${chk.map(c => `<div class="${c.have >= c.need ? 'ok' : 'no'}">${c.have >= c.need ? '✔' : '✖'} ${U.esc(c.label)}${c.need > 1 ? ' (' + c.have + '/' + c.need + ')' : ''}</div>`).join('')}</div>
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
      <div class="btn big" data-m="options">Options</div>
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
  reveal() { this.revealed = true; Player.say('Now I know the area.', '#8f8'); this.base = null; },
  render(P) {
    if (!P.body.querySelector('canvas')) {
      P.body.innerHTML = `<div class="mapw"><canvas class="mapc"></canvas><div class="mapl sml">Drag to pan · wheel to zoom · explored areas only${this.revealed ? '' : ' (find a map to reveal more)'}</div></div>`;
      const cv = P.body.querySelector('canvas');
      cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = U.clamp(this.zoom * (e.deltaY > 0 ? 0.85 : 1.18), 1.2, 10); this.draw(); }, { passive: false });
      cv.addEventListener('mousedown', (e) => {
        this.dragging = true; const sx = e.clientX, sy = e.clientY, ox = this.cx, oy = this.cy;
        const mv = (ev) => { if (!this.dragging) return; this.cx = ox - (ev.clientX - sx) / this.zoom; this.cy = oy - (ev.clientY - sy) / this.zoom; this.draw(); };
        const up = () => { this.dragging = false; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      });
      this.cx = vxOf(G.player.x); this.cy = G.player.y; this.zoom = 4;
    }
    this.draw();
  },
  buildBase() {
    const w = Wd, GW = w.gw || w.w;
    const c = mkCanvas(GW, w.h), g = c.getContext('2d');
    const img = g.createImageData(GW, w.h);
    const cols = {};
    const hex = (h) => Col.rgb(h);
    cols[FL.GRASS] = hex('#5a7a42'); cols[FL.GRASS2] = hex('#6a8848'); cols[FL.FOREST] = hex('#3e5430'); cols[FL.DIRT] = hex('#8a7458'); cols[FL.ASPHALT] = hex('#505052'); cols[FL.SIDEWALK] = hex('#9a9890');
    cols[FL.CONCRETE] = hex('#8a8884'); cols[FL.SAND] = hex('#c8b48a'); cols[FL.WATER] = hex('#3a6a8a'); cols[FL.DEEPWATER] = hex('#2a4c6c'); cols[FL.FURROW] = hex('#6a5038'); cols[FL.GRAVEL] = hex('#8a8478');
    for (let y = 0; y < w.h; y++) for (let x = 0; x < GW; x++) {
      const i = y * w.w + x, q = (y * GW + x) * 4;
      let c3;
      if (w.room[i] >= 0) c3 = [176, 164, 146];
      else c3 = cols[w.floor[i]] || [90, 120, 66];
      const o = w.obj[i];
      if (o && o.t === 'tree') c3 = [46, 70, 38];
      const known = this.revealed || w.seen[i];
      let f = known ? 1 : 0.18;
      if ((w.wallN[i] && w.wallN[i] <= 3) || (w.wallW[i] && w.wallW[i] <= 3)) { c3 = [60, 60, 60]; f = known ? 1 : 0.33; }
      img.data[q] = c3[0] * f; img.data[q + 1] = c3[1] * f; img.data[q + 2] = c3[2] * f; img.data[q + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.base = c; this.baseT = performance.now();
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
    g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    g.save();
    g.translate(W / 2, H / 2); g.scale(this.zoom, this.zoom); g.translate(-this.cx, -this.cy);
    g.drawImage(this.base, 0, 0);
    // labels
    g.restore();
    g.font = 'bold 11px Verdana'; g.textAlign = 'center';
    for (const l of Wd.labels) {
      const known = this.revealed || Wd.seen[Math.floor(l.y) * Wd.w + Math.floor(l.x)];
      if (!known) continue;
      const sx = (l.x - this.cx) * this.zoom + W / 2, sy = (l.y - this.cy) * this.zoom + H / 2;
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillText(l.text, sx + 1, sy + 1);
      g.fillStyle = '#f0e8c8'; g.fillText(l.text, sx, sy);
    }
    // player
    const p = G.player;
    const px = (vxOf(p.x) - this.cx) * this.zoom + W / 2, py = (p.y - this.cy) * this.zoom + H / 2;
    g.save(); g.translate(px, py); g.rotate(p.angle);
    g.fillStyle = '#ff4040'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, 6); g.lineTo(-3, 0); g.lineTo(-6, -6); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = '#ccc'; g.textAlign = 'left'; g.font = '10px Verdana'; g.fillText('N ↑', 8, 16);
  },
};
