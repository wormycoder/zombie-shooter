'use strict';
// ---------------------------------------------------------------------------
// Keyboard & mouse state
// ---------------------------------------------------------------------------
const Input = {
  keys: new Set(),
  pressed: new Set(),
  mx: 0, my: 0, lmb: false, rmb: false, rmbT: 0, rmbMoved: 0, lmbClick: false,
  wheel: 0,
  overUI: false,
  init(cv) {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (['Tab', 'Alt', ' ', 'ArrowUp', 'ArrowDown', 'F1'].includes(e.key) || (e.key === 'Alt')) e.preventDefault();
      if (G.mode === 'play' && ['w', 'a', 's', 'd'].includes(k) && !e.ctrlKey) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
      if (e.key === 'Alt') e.preventDefault();
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.lmb = false; this.rmb = false; });
    cv.addEventListener('mousemove', (e) => {
      if (this.rmb) this.rmbMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
      this.mx = e.clientX; this.my = e.clientY;
    });
    window.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; });
    cv.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.lmb = true; this.lmbClick = true; UI.closeContext(); }
      if (e.button === 2) { this.rmb = true; this.rmbT = performance.now(); this.rmbMoved = 0; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.lmb = false;
      if (e.button === 2 && this.rmb) {
        this.rmb = false;
        const dt = performance.now() - this.rmbT;
        if (e.target === cv && dt < 220 && G.mode === 'play') Interact.contextMenu(e.clientX, e.clientY);
      }
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },
  down(k) { return this.keys.has(k); },
  // consumes the key press so it triggers once even with several sim steps per frame
  hit(k) { if (this.pressed.has(k)) { this.pressed.delete(k); return true; } return false; },
  takeClick() { if (this.lmbClick) { this.lmbClick = false; return true; } return false; },
  aiming() { return this.rmb && performance.now() - this.rmbT > 200; },
  endFrame() { this.pressed.clear(); this.lmbClick = false; this.wheel = 0; },
};
