'use strict';
// ---------------------------------------------------------------------------
// Vehicle dashboard HUD: speedometer, tachometer + gear, fuel and engine gauges,
// warning lights. Shown while driving, redrawn at the UI refresh rate.
// ---------------------------------------------------------------------------
const Dash = {
  cv: null, g: null, W: 430, H: 132, shown: false,
  // game speed (tiles/s) to dial mph
  MPH: 2.46,
  el() {
    if (this.cv) return this.cv;
    const c = this.cv = document.createElement('canvas');
    const d = Math.min(2, window.devicePixelRatio || 1);
    c.width = this.W * d; c.height = this.H * d;
    c.style.cssText = 'position:fixed;left:50%;bottom:10px;transform:translateX(-50%);width:' + this.W + 'px;height:' + this.H + 'px;z-index:12;pointer-events:none;display:none';
    c.id = 'dash';
    this.g = c.getContext('2d'); this.g.scale(d, d);
    (document.getElementById('hud') || document.body).appendChild(c);
    return c;
  },
  update() {
    const p = G.player, c = p && !p.dead ? p.inCar : null;
    const cv = this.el();
    if (!c) { if (this.shown) { cv.style.display = 'none'; this.shown = false; this.hud(false); } return; }
    if (!this.shown) { cv.style.display = 'block'; this.shown = true; this.hud(true); }
    this.draw(c);
  },
  // messages move up out of the dashboard's way while driving
  hud(on) { const h = document.getElementById('hud'); if (h) h.classList.toggle('driving', on); },
  draw(c) {
    const g = this.g, W = this.W, H = this.H;
    const T = CAR_TYPES[c.type] || CAR_TYPES.sedan, tm = Vehicles.tmp ? Vehicles.tmp(c) : {};
    const P = c.parts || {};
    g.clearRect(0, 0, W, H);
    // housing
    g.fillStyle = 'rgba(14,13,12,0.86)'; g.strokeStyle = 'rgba(190,170,120,0.35)'; g.lineWidth = 1.5;
    this.rr(g, 2, 8, W - 4, H - 10, 14); g.fill(); g.stroke();
    const on = !!c.engine, v = Math.abs(c.v || 0) * this.MPH;
    const top = Math.max(40, Math.ceil(T.maxV * this.MPH / 20) * 20 + 20);
    // speedometer
    this.dial(g, 74, 70, 50, v / top, top, 20, 'MPH', Math.round(v) + '', on);
    // tachometer + gear
    const rpm = on ? U.clamp(tm.rpm !== undefined ? tm.rpm : 0.15 + Math.min(1, Math.abs(c.v) / T.maxV) * 0.75, 0, 1) : 0;
    const gear = !on ? 'P' : c.rev ? 'R' : Math.abs(c.v) < 0.2 && !(tm.th) ? 'N' : 'D' + (tm.gear !== undefined ? tm.gear + 1 : '');
    this.dial(g, 196, 70, 42, rpm, 7, 1, 'x1000 RPM', gear, on, 0.86);
    // fuel and engine gauges
    const gas = U.clamp(c.gas || 0, 0, 1);
    this.bar(g, 262, 30, 'FUEL', gas, gas < 0.12 ? '#e05040' : '#d8c890', 'E', 'F');
    const eng = P.engine !== undefined ? Math.max(0, P.engine) / 100 : U.clamp((c.hp || 0) / 100, 0, 1);
    this.bar(g, 262, 62, 'ENGINE', eng, eng < 0.3 ? '#e05040' : eng < 0.6 ? '#e0b040' : '#8cd080', '', '');
    const bat = P.battery !== undefined ? Math.max(0, P.battery) / 100 : 1;
    this.bar(g, 262, 94, 'BATTERY', bat, bat < 0.2 ? '#e05040' : '#80b8e0', '', '');
    // warning lights
    const lights = [
      ['LIGHTS', c.lightsOn, '#5aa0ff'],
      ['ENGINE', on && eng < 0.3, '#ffb020'],
      ['BATT', bat < 0.15 || (!on && bat < 0.4), '#ff4030'],
      ['DOOR', !!c.doorOpen || c.trunkOpen || c.hoodOpen, '#ffb020'],
      ['BRAKE', !!tm.hb, '#ff4030'],
      ['SIREN', !!c.siren, '#ff5060'],
      [c.hotwired ? 'WIRED' : 'KEY', true, c.hotwired ? '#ffb020' : '#8cd080'],
    ];
    let lx = 352, ly = 26;
    g.font = 'bold 8px Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < lights.length; i++) {
      const [n, lit, col] = lights[i];
      const x = lx + (i % 2) * 36, y = ly + Math.floor(i / 2) * 22;
      g.fillStyle = lit ? col : 'rgba(255,255,255,0.06)';
      if (lit) { g.shadowColor = col; g.shadowBlur = 8; }
      this.rr(g, x - 16, y - 7, 32, 14, 3); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = lit ? '#111' : 'rgba(220,210,190,0.35)';
      g.fillText(n, x, y + 0.5);
    }
    // vehicle name and condition
    g.font = '9px Verdana, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#b8ac90';
    const eq = c.eq !== undefined ? ' · engine Q' + Math.round(c.eq) : '';
    g.fillText(Vehicles.typeName(c) + ' · ' + Math.round(c.hp || 0) + '%' + eq, 18, 18);
  },
  dial(g, x, y, r, k, max, step, label, big, on, red) {
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.lineWidth = 1;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(200,185,140,0.4)'; g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.stroke();
    if (red) { g.strokeStyle = 'rgba(220,60,40,0.8)'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, r - 2, a0 + (a1 - a0) * red, a1); g.stroke(); }
    // ticks + numbers
    const n = Math.round(max / step);
    g.font = '8px Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, ca = Math.cos(a), sa = Math.sin(a);
      g.strokeStyle = on ? '#e8dcb8' : '#8a826e'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + ca * (r - 7), y + sa * (r - 7)); g.lineTo(x + ca * (r - 1), y + sa * (r - 1)); g.stroke();
      if (n <= 10 || i % 2 === 0) { g.fillStyle = on ? '#d8ccb0' : '#7a725e'; g.fillText(String(Math.round(i * step)), x + ca * (r - 15), y + sa * (r - 15)); }
    }
    // needle
    const a = a0 + (a1 - a0) * U.clamp(k, 0, 1.04);
    g.strokeStyle = '#ff6a3a'; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6); g.lineTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6)); g.stroke();
    g.lineCap = 'butt';
    g.fillStyle = '#2a2622'; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = on ? '#f4ead0' : '#8a826e'; g.font = 'bold 13px Verdana, sans-serif'; g.fillText(big, x, y + r * 0.45);
    g.font = '7px Verdana, sans-serif'; g.fillStyle = '#a89c80'; g.fillText(label, x, y + r * 0.45 + 12);
  },
  bar(g, x, y, label, k, col, lo, hi) {
    g.font = '8px Verdana, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#a89c80';
    g.fillText(label, x, y - 9);
    g.fillStyle = 'rgba(255,255,255,0.08)'; this.rr(g, x, y - 4, 66, 8, 3); g.fill();
    g.fillStyle = col; this.rr(g, x, y - 4, Math.max(2, 66 * U.clamp(k, 0, 1)), 8, 3); g.fill();
    if (lo) { g.fillStyle = '#8a826e'; g.fillText(lo, x - 9, y); g.fillText(hi, x + 69, y); }
  },
  rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  },
};
