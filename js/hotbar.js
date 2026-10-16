'use strict';
// ---------------------------------------------------------------------------
// Hotbar: attachment slots that come from worn gear, as in Project Zomboid. A long weapon can
// always be slung on the back; a belt adds two hip slots, a holster a pistol slot. Attached
// items stay in the main inventory; the number keys draw them and put them back.
// p.att maps slot id -> item uid.
// ---------------------------------------------------------------------------
const HOTBAR_SLOTS = {
  back: { n: 'Back', short: 'Back', what: 'long weapons and guns' },
  beltL: { n: 'Belt Left', short: 'Belt L', what: 'small weapons and tools' },
  beltR: { n: 'Belt Right', short: 'Belt R', what: 'small weapons and tools' },
  holster: { n: 'Holster', short: 'Holster', what: 'pistols and revolvers' },
};
const HOTBAR_ORDER = ['back', 'beltL', 'beltR', 'holster'];
const Hotbar = {
  // slots available with the current gear, in display order
  slots() {
    const p = G.player, have = new Set(['back']);
    for (const it of p.inv) if (it.worn) { const a = ITEMS[it.id].attach; if (a) for (const s of a) have.add(s); }
    return HOTBAR_ORDER.filter(s => have.has(s));
  },
  long(d) { return !!((d.wpn && (d.wpn.two || d.w >= 2)) || (d.gun && d.gun.two) || d.tags.includes('fishing')); },
  // can this item hang in that slot?
  fits(it, slot) {
    const d = ITEMS[it.id];
    if (!d || d.cat === 'Clothing' || d.bag || d.cat === 'Food') return false;
    if (slot === 'back') return this.long(d);
    if (slot === 'holster') return !!(d.gun && !d.gun.two);
    // belt: one-handed weapons, small tools and lights
    if (this.long(d) || d.w > 1.6) return false;
    return !!(d.wpn || (d.gun && !d.gun.two) || d.light || d.cat === 'Tool' || d.tags.some(t => ['knife', 'hammer', 'screwdriver', 'wrench', 'saw', 'crowbar'].includes(t)));
  },
  item(slot) {
    const p = G.player, u = p.att && p.att[slot];
    if (u === undefined || u === null) return null;
    return p.inv.find(x => x.uid === u) || null;
  },
  slotOf(it) {
    const a = G.player.att;
    if (a) for (const s in a) if (a[s] === it.uid) return s;
    return null;
  },
  // first free slot the item fits, else the first one it fits
  bestSlot(it) {
    const ok = this.slots().filter(s => this.fits(it, s));
    return ok.find(s => !this.item(s)) || ok[0] || null;
  },
  attach(it, slot) {
    const p = G.player;
    if (!slot || !this.fits(it, slot) || !this.slots().includes(slot)) { Player.say("That won't fit there.", '#ccc'); return false; }
    if (it.worn) return false;
    Player.ensureMain(it);
    if (!p.inv.includes(it)) return false;
    for (const s in p.att) if (p.att[s] === it.uid) delete p.att[s];
    p.att[slot] = it.uid;
    Sfx.play('equip');
    UI.refresh();
    return true;
  },
  detach(slot) { delete G.player.att[slot]; UI.refresh(); },
  // number key / click: draw the slot's item, or put it back if it is already in hand
  use(slot) {
    const p = G.player;
    if (!slot || p.dead || p.inCar) return;
    const it = this.item(slot);
    if (!it) return;
    if (it.equipped) { Player.unequip(it); Player.say('Put away ' + Items.name(it), '#ccc'); }
    else {
      const d = ITEMS[it.id];
      // what was in hand goes back to its own slot (it stays attached there)
      Player.equip(it, d.light ? 'secondary' : 'primary');
    }
    UI.refresh();
  },
  // drop attachments whose slot or item is gone (belt taken off, item dropped)
  prune() {
    const p = G.player;
    if (!p.att) { this.migrate(p); return; }
    const have = this.slots();
    for (const s in p.att) if (!have.includes(s) || !this.item(s)) delete p.att[s];
  },
  // old saves: five free hotbar slots and no belt
  migrate(p) {
    p.att = {};
    const prevG = G.player;
    G.player = p;
    try {
      if (!p.inv.some(it => it.worn === 'waist')) { const b = Items.make('Belt'); p.inv.push(b); b.worn = 'waist'; }
      for (const u of p.hotbar || []) {
        const it = u !== null && u !== undefined ? p.inv.find(x => x.uid === u) : null;
        if (!it) continue;
        const s = this.slots().filter(s2 => this.fits(it, s2)).find(s2 => !p.att[s2]);
        if (s) p.att[s] = it.uid;
      }
    } finally { G.player = prevG; }
    delete p.hotbar;
  },
  // what the 3D model wears: [slot, weapon model] for attached items not in hand
  visual() {
    const p = G.player, out = [];
    if (!p || !p.att) return out;
    for (const s in p.att) {
      const it = this.item(s);
      if (!it || it.equipped) continue;
      const d = ITEMS[it.id];
      out.push([s, d.wpn ? d.wpn.model : d.gun ? d.gun.model : d.light ? 'flashlight' : 'generic']);
    }
    return out;
  },
};
