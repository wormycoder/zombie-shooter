'use strict';
// ---------------------------------------------------------------------------
// Boot & global hotkeys
// ---------------------------------------------------------------------------
Input.handleGameKeys = function () {
  const p = G.player;
  if (!p || p.dead || UI.typing) return;
  if (Input.hit('Escape')) {
    if (UI.ctxOpen) UI.closeContext();
    else if (G.build) { G.build = null; UI.hint('Building cancelled', 2); }
    else if (p.asleep) Player.wakeUp('I got up.');
    else if (document.querySelector('#menu .modal')) $('#menu').innerHTML = '';
    else if (UI.anyOpen()) UI.closeAll();
    else UI.togglePause();
    return;
  }
  if (document.querySelector('#menu .modal')) return;
  if (Input.wheel) Render.cam.tz = U.clamp(Render.cam.tz * (Input.wheel > 0 ? 0.88 : 1.14), 0.55, 2.6);
  if (Input.hit('=') || Input.hit('+')) Render.cam.tz = Math.min(2.6, Render.cam.tz * 1.14);
  if (Input.hit('-')) Render.cam.tz = Math.max(0.55, Render.cam.tz * 0.88);
  if (Input.hit('i') || Input.hit('Tab')) UI.toggle('inv');
  if (Input.hit('h')) UI.toggle('health');
  if (Input.hit('b')) UI.toggle('craft');
  if (Input.hit('k') || Input.hit('l')) UI.toggle('skills');
  if (Input.hit('m')) UI.toggle('map');
  if (Input.hit('p')) G.paused = !G.paused;
  if (Input.hit('.')) { const sp = [1, 3, 8, 20]; const i = sp.indexOf(G.speed); if (!p.asleep) G.speed = sp[Math.min(sp.length - 1, i + 1)]; G.paused = false; }
  if (Input.hit(',')) { const sp = [1, 3, 8, 20]; const i = sp.indexOf(G.speed); if (!p.asleep) G.speed = sp[Math.max(0, i - 1)]; }
  if (p.asleep) {
    if (Input.hit('e') || Input.hit('w') || Input.hit('a') || Input.hit('s') || Input.hit('d')) Player.wakeUp('I got up.');
    return;
  }
  if (p.inCar) return;
  for (let i = 0; i < 5; i++) if (Input.hit(String(i + 1))) UI.useHotbar(i);
  if (Input.hit('e')) Interact.interactFront();
  if (Input.hit('f')) {
    let fl = [Player.primary(), Player.secondary()].find(it => it && ITEMS[it.id].light);
    if (!fl) { fl = Player.find(it => ITEMS[it.id].light && it.pow > 0); if (fl) Player.equip(fl, 'secondary'); }
    if (fl) { if (fl.pow <= 0) Player.say('The batteries are dead.', '#ccc'); else { fl.on = !fl.on; Sfx.play('switch'); UI.refresh(); } }
    else Player.say("I don't have a flashlight.", '#ccc');
  }
  if (Input.hit('q')) {
    Player.say(R.pick(['Hey!', 'Over here!', 'HEY!']), '#fff');
    Noise.emit(p.x, p.y, 20, 'shout');
    Sfx.play('shout');
  }
  if (Input.hit('z')) { p.sitting = !p.sitting; if (p.sitting) Actions.cancel(); }
};

window.addEventListener('load', () => {
  Render.init($('#game'));
  Input.init($('#game'));
  UI.init();
  try { const v = JSON.parse(localStorage.getItem('hc_vol') || 'null'); if (v) Object.assign(Sfx.vol, v); } catch (e) { /* ignore */ }
  const unlock = () => Sfx.init();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  const q = new URLSearchParams(location.search);
  if (q.has('autostart')) {
    // quick-start for testing
    Game.newGame({ name: 'Test Survivor', occ: q.get('occ') || 'police', traits: ['keenhearing'], look: { female: false, skin: SKIN_TONES[1], hair: HAIR_COLS[2], hairStyle: 'short', shirtCol: '#2a4a8a', pantsCol: '#3a5a8a' } });
    UI.startGame();
    if (q.has('night')) G.time = 23 * 60;
    if (q.has('rain')) { G.weather.target = 1; G.weather.rain = 1; G.weather.storm = true; }
  } else {
    Menu.show();
  }
  requestAnimationFrame((t) => { Game.last = t; Game.loop(t); });
});
window.addEventListener('beforeunload', () => { if (G.mode === 'play' && G.player && !G.player.dead) { try { const json = JSON.stringify(Save.serialize()); localStorage.setItem(Save.KEY, 'J' + json); } catch (e) { /* quota */ } } });
