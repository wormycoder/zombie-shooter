'use strict';
// ---------------------------------------------------------------------------
// GL3D: a small WebGL renderer for simple 3D models made of boxes (characters, props).
// Each frame, models are queued into cells of an offscreen atlas canvas and drawn in one
// instanced pass with the game's exact isometric projection; the 2D renderer then blits a
// model's cell when the painter's algorithm reaches it.
//   GL3D.ok()                     WebGL usable?
//   GL3D.begin(scale)             start a frame (scale = screen px per world px)
//   GL3D.cell(w, h, ax, ay)       reserve a cell of w x h world px with the anchor (feet) at ax, ay
//   GL3D.box(cell, c, X, Y, Z, col, light, flash)
//                                 box centred at world-relative c[3] with half-axes X, Y, Z (vec3, orthogonal)
//   GL3D.flush()                  render everything queued
//   GL3D.blit(ctx, cell, x, y, alpha)  draw a cell with its anchor at world px x, y
// Lighting follows the sprite convention: tops 1.0, +y faces 0.84, +x faces 0.68.
// ---------------------------------------------------------------------------
const GL3D = {
  cv: null, gl: null, prog: null, failed: false, inst: null, n: 0, cap: 0,
  // software WebGL (no GPU) is far too slow to redraw models every frame; ?soft3d forces it on for testing
  soft: false, allowSoft: /[?&]soft3d/.test(location.search), renderer: '',
  cells: [], cx: 0, cy: 0, rowH: 0, scale: 1, AW: 0, AH: 0,
  FL: 20,   // floats per instance: centre 3, X 3, Y 3, Z 3, colour 3, light 1, flash 1, cell origin 2, pad 1
  ok() {
    if (this.failed) return false;
    if (this.gl) return !this.gl.isContextLost();
    return this.init();
  },
  init() {
    try {
      const cv = this.cv = document.createElement('canvas');
      cv.width = 1024; cv.height = 1024;
      const opt = { antialias: this.aa !== false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false, depth: true };
      let gl = cv.getContext('webgl2', opt), v2 = true;
      if (!gl) { gl = cv.getContext('webgl', opt) || cv.getContext('experimental-webgl', opt); v2 = false; }
      if (!gl) { this.failed = true; return false; }
      let ext = null;
      if (!v2) { ext = gl.getExtension('ANGLE_instanced_arrays'); if (!ext) { this.failed = true; return false; } }
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      this.renderer = String((dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
      this.soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(this.renderer);
      if (this.soft && !this.allowSoft) { this.failed = true; return false; }
      this.gl = gl; this.v2 = v2;
      this.divisor = v2 ? (i, d) => gl.vertexAttribDivisor(i, d) : (i, d) => ext.vertexAttribDivisorANGLE(i, d);
      this.drawInst = v2 ? (m, n, t, o, k) => gl.drawElementsInstanced(m, n, t, o, k) : (m, n, t, o, k) => ext.drawElementsInstancedANGLE(m, n, t, o, k);
      const vs = `
        attribute vec3 aP; attribute vec3 aN;
        attribute vec3 iC; attribute vec3 iX; attribute vec3 iY; attribute vec3 iZ; attribute vec3 iCol; attribute vec4 iL;
        uniform vec2 uAtlas; uniform float uScale;
        varying vec3 vCol;
        void main() {
          vec3 w = iC + iX * aP.x + iY * aP.y + iZ * aP.z;
          vec3 n = normalize(iX * aN.x + iY * aN.y + iZ * aN.z);
          // tops brightest, then +y, then +x; kept light so models read like the flat 2D figures
          float b = 0.66 + 0.14 * n.x + 0.26 * n.y + 0.34 * n.z;
          b = clamp(b, 0.35, 1.0);
          vec3 c = mix(iCol * b, vec3(1.0, 0.25, 0.2), iL.y) * iL.x;
          // dim light shifts slightly blue, like the 2D shade() helper
          if (iL.x < 0.6) c.b *= 1.08;
          // rim: faces turned toward the camera get a faint lift so silhouettes read at night
          c += vec3(0.05, 0.06, 0.08) * clamp(n.x + n.y, 0.0, 1.0) * (1.0 - iL.x);
          vCol = c;
          vec2 s = vec2((w.x - w.y) * 32.0, (w.x + w.y) * 16.0 - w.z * 32.0) * uScale + iL.zw;
          gl_Position = vec4(s.x / uAtlas.x * 2.0 - 1.0, 1.0 - s.y / uAtlas.y * 2.0, -(w.x + w.y + w.z) / 16.0, 1.0);
        }`;
      const fs = `precision mediump float; varying vec3 vCol; void main() { gl_FragColor = vec4(vCol, 1.0); }`;
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this.prog = p;
      this.loc = {}; for (const a of ['aP', 'aN', 'iC', 'iX', 'iY', 'iZ', 'iCol', 'iL']) this.loc[a] = gl.getAttribLocation(p, a);
      this.uAtlas = gl.getUniformLocation(p, 'uAtlas'); this.uScale = gl.getUniformLocation(p, 'uScale');
      // unit cube with per-face normals (24 vertices, 36 indices)
      const P = [], N = [], I = [];
      const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      for (const n of faces) {
        // two axes perpendicular to n span the face
        const u = [0, 0, 0], v = [0, 0, 0];
        if (n[0]) { u[1] = 1; v[2] = 1; } else if (n[1]) { u[0] = 1; v[2] = 1; } else { u[0] = 1; v[1] = 1; }
        const base = P.length / 3;
        for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { P.push(n[0] + u[0] * su + v[0] * sv, n[1] + u[1] * su + v[1] * sv, n[2] + u[2] * su + v[2] * sv); N.push(...n); }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const buf = (data, T) => { const b = gl.createBuffer(); gl.bindBuffer(T, b); gl.bufferData(T, data, gl.STATIC_DRAW); return b; };
      this.bP = buf(new Float32Array(P), gl.ARRAY_BUFFER); this.bN = buf(new Float32Array(N), gl.ARRAY_BUFFER);
      this.bI = buf(new Uint16Array(I), gl.ELEMENT_ARRAY_BUFFER);
      this.bInst = gl.createBuffer();
      this.grow(1024);
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.failed = true; });
      return true;
    } catch (e) {
      console.warn('GL3D unavailable, using 2D characters', e);
      this.failed = true; this.gl = null;
      return false;
    }
  },
  grow(n) { this.cap = n; const a = new Float32Array(n * this.FL); if (this.inst) a.set(this.inst.subarray(0, this.n * this.FL)); this.inst = a; },
  // ---- frame
  begin(scale) {
    this.scale = scale; this.n = 0; this.cells.length = 0;
    this.cx = 0; this.cy = 0; this.rowH = 0;
    if (!this.maxW) this.maxW = Math.min(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE), 4096);
    // rows about as wide as the cells need keep the atlas near square (less to copy each frame)
    this.rowW = Math.min(this.maxW, scale > 1.6 ? 2048 : 1024);
  },
  // reserve an atlas cell (world px sizes); null when the atlas is full
  cell(w, h, ax, ay) {
    const s = this.scale, pw = Math.ceil(w * s) + 2, ph = Math.ceil(h * s) + 2;
    if (this.cx + pw > this.rowW) { this.cx = 0; this.cy += this.rowH; this.rowH = 0; }
    if (this.cy + ph > this.maxW) return null;
    const c = { px: this.cx + 1, py: this.cy + 1, pw: pw - 2, ph: ph - 2, w, h, ax, ay, n0: this.n, n1: this.n };
    this.cx += pw; this.rowH = Math.max(this.rowH, ph);
    this.cells.push(c);
    return c;
  },
  box(c, C, X, Y, Z, col, light, flash) {
    if (this.n >= this.cap) this.grow(this.cap * 2);
    const a = this.inst, o = this.n * this.FL;
    a[o] = C[0]; a[o + 1] = C[1]; a[o + 2] = C[2];
    a[o + 3] = X[0]; a[o + 4] = X[1]; a[o + 5] = X[2];
    a[o + 6] = Y[0]; a[o + 7] = Y[1]; a[o + 8] = Y[2];
    a[o + 9] = Z[0]; a[o + 10] = Z[1]; a[o + 11] = Z[2];
    a[o + 12] = col[0]; a[o + 13] = col[1]; a[o + 14] = col[2];
    a[o + 15] = light; a[o + 16] = flash || 0;
    a[o + 17] = c.px + c.ax * this.scale; a[o + 18] = c.py + c.ay * this.scale; a[o + 19] = 0;
    this.n++; c.n1 = this.n;
  },
  flush() {
    const gl = this.gl;
    if (!this.cells.length) return;
    const W = Math.min(this.maxW, Math.max(256, ...this.cells.map(c => c.px + c.pw + 1)));
    const H = Math.min(this.maxW, Math.max(256, ...this.cells.map(c => c.py + c.ph + 1)));
    // the atlas grows at once but only shrinks after it has been mostly empty for a while
    // (resizing reallocates the drawing buffer)
    let AW = Math.ceil(W / 256) * 256, AH = Math.ceil(H / 256) * 256;
    if (AW <= this.cv.width && AH <= this.cv.height) {
      this.small = AW * 2 <= this.cv.width || AH * 2 <= this.cv.height ? (this.small || 0) + 1 : 0;
      if (this.small < 180) { AW = this.cv.width; AH = this.cv.height; } else this.small = 0;
    }
    if (this.cv.width !== AW || this.cv.height !== AH) { this.cv.width = AW; this.cv.height = AH; }
    this.AW = AW; this.AH = AH;
    gl.viewport(0, 0, AW, AH);
    gl.clearColor(0, 0, 0, 0); gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform2f(this.uAtlas, AW, AH); gl.uniform1f(this.uScale, this.scale);
    const L = this.loc;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bP); gl.enableVertexAttribArray(L.aP); gl.vertexAttribPointer(L.aP, 3, gl.FLOAT, false, 0, 0); this.divisor(L.aP, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bN); gl.enableVertexAttribArray(L.aN); gl.vertexAttribPointer(L.aN, 3, gl.FLOAT, false, 0, 0); this.divisor(L.aN, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bInst);
    gl.bufferData(gl.ARRAY_BUFFER, this.inst.subarray(0, this.n * this.FL), gl.DYNAMIC_DRAW);
    const st = this.FL * 4;
    const at = (name, size, off) => { const l = L[name]; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, st, off * 4); this.divisor(l, 1); };
    at('iC', 3, 0); at('iX', 3, 3); at('iY', 3, 6); at('iZ', 3, 9); at('iCol', 3, 12); at('iL', 4, 15);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bI);
    // faces wind counter-clockwise seen from outside only after projection flips y; draw both to be safe
    gl.disable(gl.CULL_FACE);
    this.drawInst(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, this.n);
    // one copy of the used part into a 2D canvas: drawing many pieces straight from the WebGL
    // canvas can read the whole GL buffer back for every piece when the page canvas is not on the GPU
    if (!this.c2) { this.c2 = document.createElement('canvas'); this.g2 = this.c2.getContext('2d'); }
    if (this.c2.width < AW || this.c2.height < AH) { this.c2.width = Math.max(this.c2.width, AW); this.c2.height = Math.max(this.c2.height, AH); }
    this.g2.clearRect(0, 0, W, H);
    this.g2.drawImage(this.cv, 0, 0, W, H, 0, 0, W, H);
  },
  // draw a cell with its anchor at world px (x, y) on the 2D context (already transformed to world px)
  blit(ctx, c, x, y, alpha) {
    const s = this.scale;
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(this.c2, c.px, c.py, c.pw, c.ph, x - c.ax, y - c.ay, c.pw / s, c.ph / s);
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
  },
};
