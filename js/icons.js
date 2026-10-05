'use strict';
// ---------------------------------------------------------------------------
// Procedural item icons (32x32)
// ---------------------------------------------------------------------------
const Icons = {
  cache: new Map(),
  urls: new Map(),
  canvas(it) {
    const d = ITEMS[it.id];
    const col = it.col || (d.ic && d.ic[1]) || '#888';
    const key = it.id + '|' + col;
    let c = this.cache.get(key);
    if (c) return c;
    c = mkCanvas(32, 32);
    const g = c.getContext('2d');
    try { this.paint(g, d.ic ? d.ic[0] : 'box', col, (d.ic && d.ic[2]) || Col.mix(col, '#000', 0.4), d); } catch (e) { console.warn(e); }
    this.cache.set(key, c);
    return c;
  },
  url(it) {
    const d = ITEMS[it.id];
    const key = it.id + '|' + (it.col || '');
    let u = this.urls.get(key);
    if (!u) { u = this.canvas(it).toDataURL(); this.urls.set(key, u); }
    void d;
    return u;
  },
  paint(g, shape, c1, c2) {
    const O = 'rgba(0,0,0,0.75)';
    g.lineJoin = 'round'; g.lineCap = 'round';
    const R_ = (x, y, w, h, f, s) => { g.fillStyle = f; g.fillRect(x, y, w, h); if (s !== false) { g.strokeStyle = s || O; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); } };
    const C = (x, y, r, f, s) => { g.fillStyle = f; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); if (s !== false) { g.strokeStyle = s || O; g.lineWidth = 1; g.stroke(); } };
    const E = (x, y, rx, ry, f, s) => { g.fillStyle = f; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); if (s !== false) { g.strokeStyle = s || O; g.lineWidth = 1; g.stroke(); } };
    const L = (x0, y0, x1, y1, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    const LO = (x0, y0, x1, y1, col, w) => { L(x0, y0, x1, y1, O, w + 2); L(x0, y0, x1, y1, col, w); };
    const PL = (pts, f, s) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fillStyle = f; g.fill(); if (s !== false) { g.strokeStyle = s || O; g.lineWidth = 1; g.stroke(); } };
    switch (shape) {
      case 'can': R_(9, 6, 14, 20, '#b8bcc0'); R_(9, 10, 14, 12, c1); R_(9, 13, 14, 5, c2, false); E(16, 6, 7, 2, '#d0d4d8'); break;
      case 'tin': E(16, 18, 11, 6, '#b8bcc0'); E(16, 16, 11, 6, c1); E(16, 15, 8, 3, c2, false); break;
      case 'chips': PL([[8, 6], [24, 6], [25, 27], [7, 27]], c1); R_(11, 12, 10, 8, c2, false); L(8, 7, 24, 7, '#fff', 1); break;
      case 'bar': PL([[5, 18], [22, 9], [27, 14], [10, 23]], c1); PL([[5, 18], [12, 14], [17, 19], [10, 23]], c2); break;
      case 'box': R_(8, 5, 16, 22, c1); R_(10, 10, 12, 8, c2, false); break;
      case 'jar': R_(9, 10, 14, 17, c1); R_(10, 5, 12, 5, c2); R_(11, 15, 10, 7, '#f0e8d0', false); break;
      case 'bread': E(16, 18, 12, 8, c1); E(16, 16, 10, 5, c2, false); L(10, 14, 12, 18, Col.mix(c1, '#000', 0.3), 1); L(15, 13, 17, 18, Col.mix(c1, '#000', 0.3), 1); L(20, 14, 22, 18, Col.mix(c1, '#000', 0.3), 1); break;
      case 'cheese': PL([[5, 22], [27, 22], [27, 14], [5, 18]], c1); PL([[5, 18], [27, 14], [20, 10]], c2); C(12, 20, 1.5, Col.mix(c1, '#000', 0.2), false); C(20, 19, 1.5, Col.mix(c1, '#000', 0.2), false); break;
      case 'fruit': C(16, 18, 9, c1); L(16, 9, 17, 5, '#5a3a1a', 2); E(20, 7, 4, 2, c2); C(13, 15, 2, 'rgba(255,255,255,0.4)', false); break;
      case 'banana': g.strokeStyle = O; g.lineWidth = 8; g.beginPath(); g.arc(16, 4, 18, 0.6, 2.5); g.stroke(); g.strokeStyle = c1; g.lineWidth = 6; g.beginPath(); g.arc(16, 4, 18, 0.6, 2.5); g.stroke(); break;
      case 'leaf': C(16, 17, 10, c1); C(13, 15, 6, c2, false); C(19, 19, 5, c2, false); break;
      case 'carrot': PL([[8, 26], [22, 10], [26, 14]], c1); L(23, 10, 27, 4, c2, 3); L(24, 11, 29, 9, c2, 3); break;
      case 'egg': E(16, 17, 8, 10, c1); C(13, 13, 2, '#fff', false); break;
      case 'meat': E(16, 17, 12, 8, c1); E(13, 16, 5, 3, c2, false); C(22, 18, 2.5, '#f0f0e8'); break;
      case 'fish': E(15, 16, 10, 6, c1); PL([[24, 16], [30, 10], [30, 22]], c1); C(10, 14, 1.5, '#000', false); break;
      case 'pizza': PL([[16, 4], [28, 26], [4, 26]], c1); C(14, 16, 2.5, c2, false); C(18, 21, 2.5, c2, false); C(11, 22, 2, c2, false); break;
      case 'icecream': R_(8, 10, 16, 16, c1); R_(8, 10, 16, 4, c2, false); break;
      case 'burger': E(16, 12, 11, 6, c1); R_(5, 15, 22, 3, '#4a8a2a', false); R_(5, 17, 22, 4, c2); E(16, 22, 11, 3, c1); break;
      case 'fries': R_(9, 14, 14, 14, c2); for (let k = 0; k < 5; k++) R_(10 + k * 2.6, 5 + (k % 2) * 3, 2, 11, c1, false); break;
      case 'berries': for (const [x, y] of [[12, 14], [18, 13], [15, 19], [21, 19], [10, 20]]) C(x, y, 4, c1); L(15, 8, 18, 4, c2, 2); break;
      case 'mushroom': R_(13, 16, 6, 11, '#e8e0d0'); PL([[5, 17], [16, 6], [27, 17]], c1); C(12, 13, 1.5, '#fff', false); C(19, 12, 1.5, '#fff', false); break;
      case 'worm': g.strokeStyle = O; g.lineWidth = 6; g.beginPath(); g.moveTo(5, 20); g.bezierCurveTo(12, 6, 18, 28, 27, 12); g.stroke(); g.strokeStyle = c1; g.lineWidth = 4; g.stroke(); break;
      case 'stew': E(16, 18, 12, 7, '#e8e8e8'); E(16, 16, 10, 4, c1, false); break;
      case 'soda': R_(10, 6, 12, 21, c1); R_(10, 12, 12, 6, c2, false); E(16, 6, 6, 2, '#c0c4c8'); break;
      case 'carton': PL([[9, 10], [23, 10], [23, 28], [9, 28]], c1); PL([[9, 10], [16, 4], [23, 10]], c2); R_(11, 15, 10, 6, c2, false); break;
      case 'winebottle': R_(11, 13, 10, 15, c1); R_(14, 3, 4, 10, c1); R_(12, 17, 8, 6, c2, false); break;
      case 'bottle': R_(10, 10, 12, 18, 'rgba(160,210,240,0.8)'); R_(13, 5, 6, 5, c2); R_(10, 15, 12, 6, c2, false); break;
      case 'pot': R_(6, 12, 20, 13, c1); L(3, 12, 29, 12, O, 3); L(4, 12, 28, 12, c2, 2); L(1, 15, 6, 15, '#202020', 3); L(26, 15, 31, 15, '#202020', 3); break;
      case 'bucket': PL([[7, 9], [25, 9], [22, 27], [10, 27]], c1); g.strokeStyle = O; g.lineWidth = 1.5; g.beginPath(); g.arc(16, 9, 9, Math.PI, 0); g.stroke(); break;
      case 'wateringcan': R_(8, 12, 14, 14, c1); LO(22, 16, 29, 9, c1, 3); g.strokeStyle = c2; g.lineWidth = 2; g.beginPath(); g.arc(14, 12, 5, Math.PI, 0); g.stroke(); break;
      case 'gascan': PL([[7, 9], [21, 9], [25, 13], [25, 28], [7, 28]], c1); R_(20, 4, 4, 6, c2); L(10, 13, 20, 13, '#000', 2); break;
      case 'bandage': R_(6, 11, 20, 10, c1); R_(6, 14, 20, 4, c2, false); break;
      case 'disinfect': R_(10, 9, 12, 19, c1); R_(13, 4, 6, 5, '#e0e0e0'); R_(15, 13, 2, 8, c2, false); R_(12, 16, 8, 2, c2, false); break;
      case 'wipes': R_(6, 10, 20, 14, c1); R_(9, 13, 14, 4, c2, false); break;
      case 'pills': R_(10, 8, 12, 19, c1); R_(9, 5, 14, 5, c2); R_(12, 14, 8, 6, c2, false); break;
      case 'needle': LO(6, 26, 25, 7, c1, 2); C(25, 7, 2, c2); break;
      case 'tweezers': LO(8, 27, 22, 5, c1, 2); LO(12, 27, 24, 7, c1, 2); break;
      case 'bat': LO(7, 27, 26, 6, c1, 5); LO(5, 29, 9, 25, c2, 3); break;
      case 'spikedbat': LO(7, 27, 26, 6, c1, 5); for (let k = 0; k < 4; k++) L(18 + k * 2, 12 - k * 2, 22 + k * 2, 14 - k * 2, c2, 1.5); break;
      case 'crowbar': LO(8, 27, 24, 6, c1, 3); LO(24, 6, 27, 9, c1, 3); break;
      case 'golfclub': LO(8, 6, 22, 25, c1, 2); LO(20, 25, 27, 26, c2, 4); break;
      case 'sledge': LO(9, 28, 22, 10, c1, 3); PL([[17, 4], [29, 13], [25, 18], [13, 9]], c2); break;
      case 'pan': C(12, 12, 9, c1); C(12, 12, 6, Col.mix(c1, '#fff', 0.1), false); LO(19, 18, 29, 28, c2, 3); break;
      case 'hammer': LO(9, 28, 19, 10, c1, 3); PL([[13, 5], [25, 11], [23, 15], [11, 9]], c2); break;
      case 'pipe': LO(7, 27, 25, 7, c1, 4); break;
      case 'wrench': LO(8, 27, 22, 10, c2, 4); PL([[18, 4], [27, 9], [24, 14], [19, 12], [16, 8]], c1); break;
      case 'rollingpin': LO(5, 25, 27, 7, c1, 6); LO(2, 28, 5, 25, c2, 3); LO(27, 7, 30, 4, c2, 3); break;
      case 'knife': PL([[14, 18], [27, 4], [17, 20]], c1); LO(6, 27, 15, 19, c2, 4); break;
      case 'screwdriver': LO(6, 27, 14, 19, c1, 5); LO(14, 19, 26, 7, c2, 2); break;
      case 'machete': PL([[12, 18], [26, 2], [29, 6], [16, 21]], c1); LO(5, 27, 13, 19, c2, 4); break;
      case 'katana': LO(10, 22, 29, 3, c1, 3); LO(3, 29, 10, 22, c2, 4); L(7, 21, 11, 25, '#c0a040', 3); break;
      case 'axe': LO(8, 28, 20, 6, c1, 3); PL([[17, 4], [27, 6], [26, 16], [18, 12]], c2); break;
      case 'handaxe': LO(9, 27, 19, 11, c1, 3); PL([[16, 7], [25, 9], [24, 18], [17, 14]], c2); break;
      case 'shovel': LO(6, 4, 18, 18, c1, 3); PL([[16, 16], [24, 14], [28, 26], [20, 28], [14, 22]], c2); break;
      case 'spear': LO(4, 28, 25, 7, c1, 2); PL([[23, 9], [30, 2], [26, 11]], c2); break;
      case 'plank': PL([[4, 22], [24, 4], [28, 9], [8, 27]], c1); L(6, 24, 26, 6, c2, 1); break;
      case 'trowel': LO(6, 27, 14, 19, c1, 4); PL([[13, 17], [24, 5], [28, 9], [17, 21]], c2); break;
      case 'pistol': PL([[5, 9], [27, 9], [27, 15], [14, 15], [13, 25], [7, 25], [8, 15], [5, 15]], c1); L(10, 12, 26, 12, c2, 1); break;
      case 'revolver': PL([[3, 10], [26, 10], [26, 14], [16, 14], [14, 25], [8, 25], [10, 14], [3, 14]], c1); C(15, 15, 3.5, c2); break;
      case 'shotgun': LO(2, 18, 28, 10, c1, 4); LO(2, 20, 10, 18, c2, 6); LO(15, 15, 22, 13, c2, 4); break;
      case 'rifle': LO(2, 19, 29, 9, c1, 3); LO(2, 21, 11, 18, c2, 6); L(14, 13, 20, 11, '#444', 3); break;
      case 'ammo': for (let k = 0; k < 3; k++) { R_(7 + k * 7, 12, 5, 14, c1); R_(7 + k * 7, 8, 5, 5, c2); } break;
      case 'shell': for (let k = 0; k < 3; k++) { R_(7 + k * 7, 9, 6, 13, c1); R_(7 + k * 7, 21, 6, 5, c2); } break;
      case 'ammobox': R_(5, 9, 22, 16, c1); R_(8, 13, 16, 6, c2, false); break;
      case 'saw': PL([[4, 12], [24, 8], [24, 18], [4, 20]], c1); R_(23, 6, 6, 14, c2); for (let k = 0; k < 7; k++) L(5 + k * 3, 20, 6 + k * 3, 22, O, 1); break;
      case 'canopener': LO(6, 26, 17, 15, c2, 4); C(21, 11, 5, c1); break;
      case 'lighter': R_(10, 9, 12, 19, c1); R_(10, 5, 12, 5, c2); C(16, 3, 2, '#f0a020', false); break;
      case 'matches': R_(6, 10, 20, 14, c1); R_(6, 14, 20, 6, c2, false); break;
      case 'flashlight': LO(5, 25, 20, 10, c1, 6); PL([[18, 8], [26, 4], [28, 14], [22, 12]], '#606870'); E(27, 9, 2, 5, c2, false); break;
      case 'battery': R_(11, 7, 10, 20, c1); R_(11, 7, 10, 7, c2, false); R_(14, 4, 4, 3, '#a0a0a0'); break;
      case 'rod': LO(4, 28, 28, 3, c1, 2); C(9, 24, 3, c2); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(28, 3); g.lineTo(28, 20); g.stroke(); break;
      case 'tape': C(16, 16, 10, c1); C(16, 16, 5, '#e0d8c8'); break;
      case 'glue': R_(11, 10, 10, 17, c1); PL([[12, 10], [16, 3], [20, 10]], c2); break;
      case 'scissors': LO(6, 26, 24, 6, c1, 2); LO(6, 6, 24, 26, c1, 2); C(7, 26, 3, c2); C(7, 6, 3, c2); break;
      case 'generator': R_(4, 9, 24, 16, c1); R_(7, 12, 10, 9, c2); R_(19, 6, 6, 4, '#555'); break;
      case 'key': C(9, 16, 6, c1); C(9, 16, 2.5, '#00000000', false); LO(14, 16, 28, 16, c1, 3); L(24, 16, 24, 21, c1, 3); L(28, 16, 28, 20, c1, 3); break;
      case 'radio': R_(5, 10, 22, 15, c1); C(11, 17, 4, '#555'); R_(18, 13, 7, 4, c2); L(22, 10, 27, 3, '#888', 1.5); break;
      case 'cig': R_(7, 6, 18, 21, c1); R_(7, 6, 18, 7, c2, false); for (let k = 0; k < 3; k++) R_(10 + k * 4, 3, 3, 5, '#e8d8b0', false); break;
      case 'molotov': R_(11, 12, 10, 16, c1); R_(14, 4, 4, 8, c1); L(15, 4, 12, 1, '#e8e4d8', 3); C(12, 2, 2, c2, false); break;
      case 'alarmclock': C(16, 17, 10, c1); C(16, 17, 7, c2); L(16, 17, 16, 12, '#000', 1.5); L(16, 17, 20, 17, '#000', 1.5); C(9, 7, 3, c1); C(23, 7, 3, c1); break;
      case 'map': PL([[4, 8], [12, 5], [20, 8], [28, 5], [28, 24], [20, 27], [12, 24], [4, 27]], c1); L(12, 5, 12, 24, Col.mix(c1, '#000', 0.3), 1); L(20, 8, 20, 27, Col.mix(c1, '#000', 0.3), 1); L(7, 16, 25, 13, c2, 2); break;
      case 'log': LO(5, 22, 23, 10, c1, 9); E(25, 9, 4, 5, c2); break;
      case 'nails': for (let k = 0; k < 4; k++) { LO(8 + k * 5, 7, 8 + k * 5, 25, c1, 1.5); L(6 + k * 5, 7, 10 + k * 5, 7, c2, 2); } break;
      case 'rag': PL([[5, 10], [27, 8], [25, 25], [7, 24]], c1); L(8, 15, 24, 14, c2, 1); L(8, 20, 23, 19, c2, 1); break;
      case 'sheet': PL([[4, 8], [28, 8], [28, 26], [4, 26]], c1); L(4, 13, 28, 13, c2, 2); L(4, 20, 28, 20, c2, 1); break;
      case 'branch': LO(4, 26, 27, 8, c1, 3); LO(15, 17, 18, 6, c1, 2); C(19, 5, 3, c2); C(28, 7, 3, c2); break;
      case 'stone': PL([[6, 20], [10, 11], [20, 8], [27, 15], [24, 24], [12, 26]], c1); break;
      case 'garbagebag': PL([[8, 12], [24, 12], [27, 27], [5, 27]], c1); PL([[12, 12], [16, 5], [20, 12]], c2); break;
      case 'seeds': R_(8, 5, 16, 22, '#f0e8d0'); C(16, 14, 5, c1); R_(10, 22, 12, 3, c2, false); break;
      case 'tshirt': PL([[10, 6], [22, 6], [29, 12], [25, 15], [23, 13], [23, 27], [9, 27], [9, 13], [7, 15], [3, 12]], c1); break;
      case 'shirt': PL([[10, 5], [22, 5], [28, 10], [28, 27], [24, 27], [23, 13], [23, 27], [9, 27], [9, 13], [8, 27], [4, 27], [4, 10]], c1); L(16, 6, 16, 26, Col.mix(c1, '#000', 0.25), 1); break;
      case 'jacket': PL([[10, 4], [22, 4], [29, 10], [29, 28], [24, 28], [23, 14], [23, 28], [9, 28], [9, 14], [8, 28], [3, 28], [3, 10]], c1); L(16, 5, 16, 27, '#222', 1.5); break;
      case 'vest': PL([[9, 5], [14, 5], [16, 9], [18, 5], [23, 5], [25, 10], [25, 27], [7, 27], [7, 10]], c1); break;
      case 'pants': PL([[8, 4], [24, 4], [26, 28], [19, 28], [16, 12], [13, 28], [6, 28]], c1); L(8, 7, 24, 7, '#3a2a1a', 2); break;
      case 'shorts': PL([[8, 7], [24, 7], [26, 22], [18, 22], [16, 15], [14, 22], [6, 22]], c1); break;
      case 'shoes': PL([[4, 14], [12, 14], [14, 18], [27, 20], [28, 25], [4, 25]], c1); R_(4, 23, 24, 3, '#e0e0e0', false); break;
      case 'hat': PL([[6, 22], [8, 12], [16, 7], [24, 12], [26, 22]], c1); R_(6, 20, 20, 4, Col.mix(c1, '#000', 0.2), false); break;
      case 'cap': g.fillStyle = c1; g.beginPath(); g.arc(14, 18, 10, Math.PI, 0); g.fill(); g.strokeStyle = O; g.stroke(); PL([[22, 18], [30, 19], [30, 21], [22, 21]], c1); break;
      case 'helmet': g.fillStyle = c1; g.beginPath(); g.arc(16, 19, 12, Math.PI, 0); g.fill(); g.strokeStyle = O; g.stroke(); R_(3, 18, 26, 4, Col.mix(c1, '#000', 0.2)); break;
      case 'gloves': PL([[8, 26], [8, 12], [10, 6], [12, 12], [13, 5], [15, 12], [17, 6], [18, 13], [21, 9], [22, 16], [20, 26]], c1); break;
      case 'scarf': LO(5, 10, 27, 10, c1, 6); LO(20, 10, 22, 27, c1, 5); break;
      case 'glasses': g.strokeStyle = c1; g.lineWidth = 2; g.strokeRect(4, 12, 10, 8); g.strokeRect(18, 12, 10, 8); L(14, 15, 18, 15, c1, 2); break;
      case 'watch': R_(12, 3, 8, 26, '#303030'); R_(9, 10, 14, 12, c1); R_(11, 12, 10, 8, c2, false); break;
      case 'plasticbag': PL([[7, 11], [25, 11], [26, 28], [6, 28]], 'rgba(240,240,240,0.9)'); g.strokeStyle = O; g.lineWidth = 1.5; g.beginPath(); g.arc(12, 11, 3, Math.PI, 0); g.arc(20, 11, 3, Math.PI, 0); g.stroke(); break;
      case 'backpack': R_(7, 7, 18, 21, c1); R_(9, 17, 14, 8, c2); g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.arc(16, 7, 4, Math.PI, 0); g.stroke(); break;
      case 'duffel': E(16, 18, 13, 8, c1); L(6, 18, 26, 18, c2, 1.5); g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.arc(16, 11, 6, Math.PI, 0); g.stroke(); break;
      case 'fannypack': E(16, 18, 10, 6, c1); L(2, 16, 30, 16, c2, 2); break;
      case 'toolbox': R_(4, 12, 24, 14, c1); R_(4, 12, 24, 4, c2); g.strokeStyle = O; g.lineWidth = 2; g.strokeRect(11, 7, 10, 5); break;
      case 'firstaidkit': R_(5, 9, 22, 17, c1); R_(14, 12, 4, 11, c2, false); R_(10, 15, 12, 4, c2, false); break;
      case 'magazine': PL([[7, 4], [25, 4], [25, 28], [7, 28]], c1); R_(9, 7, 14, 6, c2, false); R_(9, 16, 8, 8, Col.mix(c1, '#fff', 0.3), false); break;
      case 'newspaper': PL([[5, 6], [27, 6], [27, 26], [5, 26]], c1); for (let k = 0; k < 5; k++) L(8, 10 + k * 3.5, 24, 10 + k * 3.5, c2, 1); break;
      case 'book': R_(7, 4, 18, 24, c1); R_(7, 4, 3, 24, Col.mix(c1, '#000', 0.3), false); R_(12, 9, 10, 3, c2, false); break;
      default: R_(8, 8, 16, 16, c1); break;
    }
  },
};
