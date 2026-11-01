'use strict';
// ---------------------------------------------------------------------------
// Weapon and prop models the 3D characters hold (Char3D.weapon), and a rounded-rectangle helper
// ---------------------------------------------------------------------------
const WEAPON_MODELS = {
  bat: { len: 0.85, w0: 2.4, w1: 4.6, col: '#b8874e', grip: '#3a2a1a' },
  club: { len: 0.95, w0: 1.6, w1: 1.6, col: '#b0b8c0', head: 'club' },
  pipe: { len: 0.75, w0: 2.6, w1: 2.6, col: '#70787f' },
  axe: { len: 0.9, w0: 2.6, w1: 2.6, col: '#8a6a4a', head: 'axe' },
  handaxe: { len: 0.45, w0: 2.4, w1: 2.4, col: '#8a6a4a', head: 'axe' },
  knife: { len: 0.28, w0: 2.2, w1: 1.2, col: '#d8dee4', grip: '#202020', gripLen: 0.1 },
  katana: { len: 1.0, w0: 2.2, w1: 1.7, col: '#d8dde2', grip: '#1a1a2a', gripLen: 0.27 },
  machete: { len: 0.62, w0: 3, w1: 2.6, col: '#c8d0d8', grip: '#202020', gripLen: 0.14 },
  pan: { len: 0.32, w0: 2.2, w1: 2.2, col: '#303438', head: 'pan' },
  hammer: { len: 0.36, w0: 2.4, w1: 2.4, col: '#7a5a3a', head: 'hammer' },
  sledge: { len: 0.95, w0: 2.8, w1: 2.8, col: '#6a4a2a', head: 'sledge' },
  shovel: { len: 1.05, w0: 2.4, w1: 2.4, col: '#7a5a3a', head: 'shovel' },
  spear: { len: 1.4, w0: 2.2, w1: 2.0, col: '#b08850', head: 'spear' },
  plank: { len: 1.0, w0: 5, w1: 5, col: '#c8a06a' },
  pistol: { len: 0.2, w0: 3, w1: 3, col: '#25282a', gun: true },
  shotgun: { len: 0.95, w0: 3.4, w1: 2.6, col: '#2a2d30', gun: true, stock: '#7a5030' },
  rifle: { len: 1.0, w0: 3.2, w1: 2.4, col: '#2a2d30', gun: true, stock: '#6a4a2a' },
  dbarrel: { len: 0.95, w0: 3.4, w1: 2.6, col: '#2a2d30', gun: true, stock: '#8a5a34' },
  sawn: { len: 0.52, w0: 3.4, w1: 2.6, col: '#2a2d30', gun: true, stock: '#8a5a34' },
  flashlight: { len: 0.2, w0: 3, w1: 3.6, col: '#2a2a30' },
  generic: { len: 0.3, w0: 3, w1: 3, col: '#888' },
};

function seg(ctx, a, b, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}
function taper(ctx, a, b, col, w0, w1) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / l, ny = dx / l;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2); ctx.lineTo(b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
  ctx.lineTo(b[0] - nx * w1 / 2, b[1] - ny * w1 / 2); ctx.lineTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(b[0], b[1], w1 / 2, 0, 7); ctx.fill();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
