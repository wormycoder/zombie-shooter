'use strict';
// ---------------------------------------------------------------------------
// GL3D: a small WebGL renderer for simple low-poly 3D models (characters, props).
// Each frame, models are queued into cells of an offscreen atlas canvas and drawn with one
// instanced call per mesh type, using the game's exact isometric projection; the 2D renderer then
// blits a model's cell when the painter's algorithm reaches it.
//   GL3D.ok()                     WebGL usable?
//   GL3D.begin(scale)             start a frame (scale = screen px per world px)
//   GL3D.prim(m, cx,cy,cz, X.., Y.., Z.., r,g,b, t0, t1, mat)
//                                 queue mesh m (GL3D.BOX/RBOX/CYL/SPH or one added with def) centred at c with
//                                 orthogonal half-axes X, Y, Z; the cross-section scales from t0 (z=-1 end) to t1 (z=+1 end);
//                                 mat: [material, variant, grime, blood] painted on it (see the fragment shader), or none
//   GL3D.def(name, build)         add a mesh type before first use (build returns { v, i }); GL3D[name] is its index
//   GL3D.lathe(rings, seg, axis)  a smooth closed mesh through superelliptic rings (see below)
//   GL3D.mark(a) / GL3D.seal(cell, a, light, flash)
//                                 remember the queue position, then stamp cell, light and flash on what followed
//   GL3D.cell(w, h, ax, ay)       reserve a cell of w x h world px with the anchor (feet) at ax, ay
//   GL3D.flush()                  render everything queued
//   GL3D.blit(ctx, cell, x, y, alpha)  draw a cell with its anchor at world px x, y
// Lighting follows the sprite convention: tops 1.0, +y faces 0.84, +x faces 0.68; smooth meshes shade
// smoothly. A colour channel above 1 marks an unlit (glowing) part: it is drawn as col - 1.
// ---------------------------------------------------------------------------
const GL3D = {
  cv: null, gl: null, prog: null, failed: false,
  BOX: 0, RBOX: 1, CYL: 2, SPH: 3, NM: 4, defs: [],
  inst: [], n: [0, 0, 0, 0], cap: [0, 0, 0, 0], meshes: [],
  // software WebGL (no GPU): slow, but the characters are always 3D, so it is used too (Char3D draws less with it)
  soft: false, allowSoft: true, renderer: '',
  cells: [], cx: 0, cy: 0, rowH: 0, scale: 1, AW: 0, AH: 0,
  FL: 35,   // floats per instance: centre 3, X 3, Y 3, Z 3, colour 3, light 1, flash 1, cell origin 2, seed 1, taper 2, material 4, holes 8, cell scale 1
  sd: 0,    // seed stamped on the parts queued next (decorrelates their textures)
  ho: [0, 0, 0], h0: null, h1: null,   // (ho: the part's centre in the holes' frame) holes cut in the parts queued next: [x, y, z, r] in the part's own metres (or null)
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
        attribute vec3 iC; attribute vec3 iX; attribute vec3 iY; attribute vec3 iZ; attribute vec3 iCol; attribute vec4 iL; attribute vec2 iT; attribute float iS; attribute vec4 iM; attribute vec4 iH0; attribute vec4 iH1; attribute float iQ;
        uniform vec2 uAtlas; uniform float uScale;
        varying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec4 vD; varying vec4 vM; varying vec2 vZ; varying vec4 vH0; varying vec4 vH1;
        void main() {
          // taper: the cross-section scales linearly along local z; the normal follows the slanted surface
          float s = mix(iT.x, iT.y, aP.z * 0.5 + 0.5), sd = (iT.y - iT.x) * 0.5;
          vec3 lp = vec3(aP.xy * s, aP.z);
          vec3 ln = vec3(aN.xy, s * aN.z - sd * dot(aP.xy, aN.xy));
          vec3 w = iC + iX * lp.x + iY * lp.y + iZ * lp.z;
          // half-axes are orthogonal, so the inverse transpose only divides by their squared lengths
          vec3 n = normalize(iX * (ln.x / dot(iX, iX)) + iY * (ln.y / dot(iY, iY)) + iZ * (ln.z / dot(iZ, iZ)));
          float lx = length(iX), ly = length(iY), lz = length(iZ);
          // colour and flash; the surface point in the part's own metres (textures stay put on the part as it moves)
          // with a per-part seed; the unit position and the part's mean radius; normal and light; material
          vA = vec4(iCol, iL.y);
          // (the seed also takes the part's size, so the upper arm and forearm get different patterns)
          vB = vec4(lp * vec3(lx, ly, lz), iS + lx * 31.0 + ly * 17.0 + lz * 11.0);
          vC = vec4(lp, (lx + ly) * 0.5 * s);
          vD = vec4(n, iL.x);
          vM = iM; vZ = vec2(w.z, iQ); vH0 = iH0; vH1 = iH1;
          // (iQ: the cell's own resolution, below 1 for characters further off)
          vec2 sc = vec2((w.x - w.y) * 32.0, (w.x + w.y) * 16.0 - w.z * 32.0) * uScale * iQ + iL.zw;
          gl_Position = vec4(sc.x / uAtlas.x * 2.0 - 1.0, 1.0 - sc.y / uAtlas.y * 2.0, -(w.x + w.y + w.z) / 16.0, 1.0);
        }`;
      // Materials (iM.x; iM.y a variant, iM.z grime 0..1, iM.w blood 0..1), painted procedurally on the surface:
      // 1 cotton, 2 denim, 3 knit, 4 leather, 5 quilted (puffer), 6 plaid (y: 0 flannel, 1 buffalo check), 7 stripes
      // (y: 0 light, 1 dark), 8 camouflage, 9 skin (y: decay of the dead), 10 face (y: decay, or minus stubble),
      // 11 hair, 12 twill / canvas, 13 plastic, 14 a blood splat (ragged edge), 15 rubber / sneaker, 16 fleece,
      // 17 the inside of a hole torn in the body (y: ribs across it). Parts can also carry two holes (iH0/iH1).
      // Features too small to see at the current zoom fade to their average instead of shimmering.
      const fs = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        uniform float uPx;
        varying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec4 vD; varying vec4 vM; varying vec2 vZ; varying vec4 vH0; varying vec4 vH1;
        float hsh(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
        float vn(vec3 x) {
          vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hsh(i), hsh(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 0.0)), hsh(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                     mix(mix(hsh(i + vec3(0.0, 0.0, 1.0)), hsh(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 1.0)), hsh(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
        }
        float fbm(vec3 p) { return vn(p) * 0.57 + vn(p * 2.03 + 11.3) * 0.29 + vn(p * 4.1 + 23.7) * 0.14; }
        // how much of a feature f metres across shows at this zoom: none under ~1.3 px, all over ~3 px
        float vis(float f) { return smoothstep(1.3, 3.0, f * uPx * vZ.y); }
        void main() {
          vec3 c = vA.rgb, n = normalize(vD.xyz);
          float t = floor(vM.x + 0.5), spec = 0.0, cloth = 0.0;
          vec3 P = vB.xyz + vB.w * 1.37, Q = vC.xyz;
          float R = vC.w, ar = atan(Q.y, Q.x), U = ar * R;
          // holes torn in the part: nothing inside a ragged edge (the cavity drawn behind shows through), blood round it
          float rim = 0.0;
          for (int h = 0; h < 2; h++) {
            vec4 H = h == 0 ? vH0 : vH1;
            if (H.w > 0.0) {
              vec3 d = vB.xyz - H.xyz;
              float e = H.w * (0.82 + 0.36 * vn(normalize(d + 1e-4) * 3.0 + H.xyz * 40.0)), l = length(d);
              if (l < e) discard;
              rim = max(rim, 1.0 - smoothstep(e, e + H.w * 0.6, l));
            }
          }
          if (t > 16.5) {
            // the inside of a hole (a cup below the surface, local z outward): only the half under the skin, lit as a
            // hollow - torn flesh, darker the deeper, pale ribs across at high detail
            if (Q.z > 0.02) discard;
            n = -n;
            float dp = clamp(-Q.z, 0.0, 1.0);
            c = mix(vec3(0.5, 0.09, 0.07), vec3(0.16, 0.02, 0.02), dp) * (0.8 + 0.4 * vn(P * 60.0));
            if (vM.y > 0.5) c = mix(c, vec3(0.78, 0.72, 0.6), (1.0 - smoothstep(0.06, 0.12, abs(fract(Q.y * 2.2 + 0.25) - 0.5))) * smoothstep(0.2, 0.5, dp) * 0.9);
          }
          if (c.r <= 1.0 && t > 0.5 && t < 16.5) {
            float mot = fbm(P * 13.0), vm = vis(0.03), vf = vis(0.012);
            if (t < 8.5 || t > 11.5) {
              cloth = 1.0;
              // weave mottling and soft folds across the part
              c *= 1.0 + (mot - 0.5) * 0.16 * vm + (vn(P * 85.0) - 0.5) * 0.08 * vf;
              c *= 1.0 + sin(P.z * 34.0 + vn(P * 5.0) * 7.0) * 0.045 * vm;
            }
            if (t < 1.5) {
            } else if (t < 2.5) {
              // denim: streaky indigo, worn lighter in patches, a darker seam down the outside
              float st = vn(vec3(P.x * 60.0, P.y * 60.0, P.z * 5.0));
              c *= 0.9 + st * 0.2 * vf;
              c = mix(c, c * 1.32 + 0.035, smoothstep(0.5, 0.85, mot) * 0.45 * vm);
              float sm = abs(abs(ar) - 1.5708) * R;
              c = mix(c, c * 0.62, (1.0 - smoothstep(0.004, 0.009, sm)) * vis(0.01));
            } else if (t < 3.5) {
              // knit: ribs running down the part
              c *= 1.0 + sin(U * 250.0) * 0.08 * vis(0.013) + (vn(P * 120.0) - 0.5) * 0.06 * vf;
            } else if (t < 4.5) {
              // leather: a network of creases, and a sheen
              float cr = abs(vn(P * 26.0) - 0.5);
              c *= 0.88 + mot * 0.2 * vm;
              c *= 1.0 - (1.0 - smoothstep(0.0, 0.035, cr)) * 0.1 * vis(0.01);
              spec = 0.22;
            } else if (t < 5.5) {
              // quilted: puffed bands with stitched seams between them
              float q = fract(P.z / 0.085 + 0.5);
              c *= mix(0.9, 0.74 + 0.3 * sin(q * 3.1416), vis(0.04));
              spec = 0.1;
            } else if (t < 6.5) {
              // plaid: wide dark bands both ways, darker where they cross, thin light lines between
              float u = fract(U / 0.095), v = fract(P.z / 0.095);
              float bu = smoothstep(0.52, 0.56, u) * (1.0 - smoothstep(0.9, 0.94, u)), bv = smoothstep(0.52, 0.56, v) * (1.0 - smoothstep(0.9, 0.94, v));
              float lu = 1.0 - smoothstep(0.015, 0.03, abs(u - 0.25)), lv = 1.0 - smoothstep(0.015, 0.03, abs(v - 0.25));
              vec3 dk = vM.y > 0.5 ? vec3(0.07, 0.06, 0.06) : c * 0.42;
              vec3 pc = mix(c, dk, max(bu, bv) * 0.75);
              pc = mix(pc, dk * 0.8, bu * bv * 0.6);
              pc = mix(pc, mix(c, vec3(0.92, 0.88, 0.78), 0.55), max(lu, lv) * vis(0.006));
              c = mix(c * mix(0.7, 0.62, vM.y), pc, vis(0.04));
            } else if (t < 7.5) {
              // stripes round the body
              vec3 sc2 = vM.y > 0.5 ? vec3(0.1, 0.12, 0.2) : vec3(0.92, 0.9, 0.86);
              float v = smoothstep(0.45, 0.5, fract(P.z / 0.06)) * (1.0 - smoothstep(0.95, 1.0, fract(P.z / 0.06)));
              c = mix(mix(c, sc2, 0.45), mix(c, sc2, v), vis(0.025));
            } else if (t < 8.5) {
              // woodland camouflage: blotches of green, brown, khaki and black
              float a = fbm(P * 5.0 + 7.0), b = fbm(P * 5.5 + 19.0), k = fbm(P * 9.0 + 31.0);
              vec3 cc = c;
              cc = mix(cc, vec3(0.5, 0.47, 0.33), smoothstep(0.36, 0.33, a));
              cc = mix(cc, c * vec3(0.52, 0.6, 0.46), smoothstep(0.56, 0.6, a));
              cc = mix(cc, vec3(0.3, 0.23, 0.15), smoothstep(0.6, 0.64, b));
              cc = mix(cc, vec3(0.11, 0.11, 0.09), smoothstep(0.7, 0.73, k));
              c = mix(c * 0.86, cc, vis(0.05));
            } else if (t < 10.5) {
              // skin: faint mottling; the dead bruised, veined and rotting in patches
              float z = max(vM.y, 0.0);
              c *= 1.0 + (mot - 0.5) * 0.1 * vm;
              float r = fbm(P * 8.0 + 40.0);
              c = mix(c, c * vec3(0.74, 0.66, 0.8), smoothstep(0.55, 0.72, r) * 0.75 * z * vm);
              c = mix(c, vec3(0.22, 0.19, 0.13), smoothstep(0.66, 0.8, fbm(P * 15.0 + 5.0)) * 0.55 * z * vm);
              // veins in a few places (where a broad noise runs high), thin and bluish
              float vv = abs(vn(P * 26.0) - 0.5), vz = smoothstep(0.58, 0.68, fbm(P * 3.0 + 60.0));
              c = mix(c, c * vec3(0.62, 0.64, 0.76), (1.0 - smoothstep(0.0, 0.025, vv)) * 0.45 * z * vz * vis(0.008));
              if (t > 9.5) {
                // the face (head mesh units: eyes at x .48, y +-.16, z .41; the mouth at z .03; chin at -.25)
                float e = min(length((Q - vec3(0.44, 0.165, 0.41)) * vec3(0.7, 1.0, 1.25)), length((Q - vec3(0.44, -0.165, 0.41)) * vec3(0.7, 1.0, 1.25)));
                float so = 1.0 - smoothstep(0.05, 0.17, e);
                c = mix(c, c * mix(vec3(0.84, 0.8, 0.8), vec3(0.42, 0.33, 0.4), z), so * (0.5 + z * 0.5) * vis(0.02));
                float front = smoothstep(0.1, 0.35, Q.x);
                float cheek = 1.0 - smoothstep(0.04, 0.16, min(length(Q - vec3(0.42, 0.26, 0.2)), length(Q - vec3(0.42, -0.26, 0.2))));
                c = mix(c, c * vec3(1.08, 0.9, 0.86), cheek * front * 0.5 * (1.0 - z) * vis(0.03));
                float stb = max(-vM.y, 0.0), jaw = (1.0 - smoothstep(0.05, 0.16, Q.z)) * smoothstep(-0.3, -0.2, Q.z) * smoothstep(-0.1, 0.25, Q.x);
                c = mix(c, c * vec3(0.66, 0.64, 0.66), jaw * stb * (0.75 + vn(P * 400.0) * 0.25 * vf) * vis(0.02));
                // the dead: blood round the mouth and run down the chin in streaks
                float mo = length(Q.yz * vec2(1.0, 0.8)) + (vn(P * 40.0) - 0.5) * 0.12;
                float dr = smoothstep(0.5, 0.68, vn(vec3(Q.y * 14.0, Q.z * 1.5, vB.w))) * (1.0 - smoothstep(0.16, 0.24, abs(Q.y))) * smoothstep(-0.34, -0.2, Q.z) * step(Q.z, 0.03);
                float bm = max(1.0 - smoothstep(0.12, 0.2, mo), dr * 0.85) * front * vM.w;
                c = mix(c, vec3(0.32, 0.04, 0.03), bm * 0.85 * vis(0.015));
              }
            } else if (t < 11.5) {
              // hair: strands down from the crown, darker underneath, a soft sheen
              float st = vn(vec3(ar * 26.0, Q.z * 1.6, vB.w));
              c *= mix(1.0, 0.78 + st * 0.4, vis(0.006)) * (0.86 + 0.14 * smoothstep(-0.2, 0.8, Q.z));
              c *= 1.0 + (mot - 0.5) * 0.12 * vm;
              spec = 0.12;
            } else if (t < 12.5) {
              // twill / canvas: a fine diagonal grain and a seam down the outside
              c *= 1.0 + sin((P.x + P.y + P.z) * 500.0) * 0.05 * vis(0.006);
              float sm = abs(abs(ar) - 1.5708) * R;
              c = mix(c, c * 0.72, (1.0 - smoothstep(0.003, 0.008, sm)) * vis(0.01));
            } else if (t < 13.5) {
              // plastic: smooth, a strong highlight, scuffs
              c *= 1.0 + (step(0.82, vn(P * 70.0)) * 0.12 - 0.02) * vf;
              spec = 0.42;
            } else if (t < 14.5) {
              // a splat of blood: a ragged edge (the patch is flat along x)
              float r = length(Q.yz), ed = 0.58 + 0.42 * fbm(vec3(Q.yz * 2.4, vB.w * 3.1));
              if (r > ed) discard;
              c *= 0.82 + 0.3 * vn(P * 70.0) * vf + 0.12 * smoothstep(0.0, ed, r);
              spec = 0.12;
            } else if (t < 15.5) {
              // rubber / sneakers: a little texture, a scuffed toe
              c *= 1.0 - smoothstep(0.6, 0.95, Q.x) * 0.1;
            } else {
              // fleece: soft, fuzzy, bigger folds
              c *= 1.0 + (vn(P * 150.0) - 0.5) * 0.08 * vf + sin(P.z * 22.0 + mot * 5.0) * 0.04 * vm;
            }
            // round a hole: torn, wet with blood
            if (rim > 0.0) c = mix(c, mix(vec3(0.42, 0.05, 0.04), vec3(0.2, 0.03, 0.02), rim), rim * 0.9);
            // grime, worst toward the ground, then blood soaked in (more on the front)
            float g = fbm(P * 6.0 + 50.0) + (0.35 - vZ.x) * 0.7;
            float gm = smoothstep(0.78 - vM.z * 0.5, 1.02 - vM.z * 0.4, g) * vM.z;
            c = mix(c, c * vec3(0.56, 0.5, 0.42) + vec3(0.035, 0.028, 0.018), gm * 0.85 * vm + gm * 0.25 * (1.0 - vm));
            if (vM.w > 0.0 && t != 14.0 && t != 10.0) {
              // (coverage: about 5% at 0.2, 12% at 0.4, a third at 1 - less on the legs)
              float bl = fbm(P * 7.0 + 80.0) + max(Q.x, 0.0) * 0.06 + (vn(P * 30.0) - 0.5) * 0.08, th = 0.735 - vM.w * 0.18 + clamp(1.15 - vZ.x, 0.0, 1.0) * 0.09;
              float bmk = smoothstep(th, th + 0.03, bl);
              vec3 bc = mix(vec3(0.34, 0.045, 0.035), vec3(0.17, 0.03, 0.022), vn(P * 18.0)) * (0.8 + cloth * 0.1);
              c = mix(c, bc, bmk * mix(0.45, 0.9, vm));
            }
          }
          // light: tops brightest, then +y, then +x; a soft wrap keeps undersides from going black
          float b = 0.64 + 0.13 * n.x + 0.24 * n.y + 0.34 * n.z;
          b = clamp(b, 0.36, 1.06);
          b = b * 0.92 + 0.08 * b * b;
          vec3 o = mix(c * b, vec3(1.0, 0.25, 0.2), vA.w) * vD.w;
          // dim light shifts slightly blue, like the 2D shade() helper
          if (vD.w < 0.6) o.b *= 1.08;
          // rim: faces turned toward the camera get a faint lift so silhouettes read at night
          o += vec3(0.05, 0.06, 0.08) * clamp(n.x + n.y, 0.0, 1.0) * (1.0 - vD.w);
          if (spec > 0.0) o += spec * pow(max(dot(n, vec3(0.45, 0.58, 0.68)), 0.0), 14.0) * vD.w;
          if (c.r > 1.0) o = c - 1.0;
          gl_FragColor = vec4(o, 1.0);
        }`;
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this.prog = p;
      this.loc = {}; for (const a of ['aP', 'aN', 'iC', 'iX', 'iY', 'iZ', 'iCol', 'iL', 'iT', 'iS', 'iM', 'iH0', 'iH1', 'iQ']) this.loc[a] = gl.getAttribLocation(p, a);
      this.uAtlas = gl.getUniformLocation(p, 'uAtlas'); this.uScale = gl.getUniformLocation(p, 'uScale'); this.uPx = gl.getUniformLocation(p, 'uPx');
      const buf = (data, T) => { const b = gl.createBuffer(); gl.bindBuffer(T, b); gl.bufferData(T, data, gl.STATIC_DRAW); return b; };
      for (const m of this.buildMeshes().concat(this.defs.map(d => d.build()))) this.meshes.push({ vb: buf(new Float32Array(m.v), gl.ARRAY_BUFFER), ib: buf(new Uint16Array(m.i), gl.ELEMENT_ARRAY_BUFFER), ni: m.i.length, ibuf: gl.createBuffer() });
      for (let k = 0; k < this.NM; k++) { this.n[k] = 0; this.grow(k, 512); }
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.failed = true; });
      return true;
    } catch (e) {
      console.warn('GL3D unavailable, using 2D characters', e);
      this.failed = true; this.gl = null;
      return false;
    }
  },
  // unit meshes in [-1, 1]^3, interleaved position + normal
  buildMeshes() {
    const out = [];
    // box: flat faces
    {
      const v = [], I = [];
      for (const n of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const u = [0, 0, 0], w = [0, 0, 0];
        if (n[0]) { u[1] = 1; w[2] = 1; } else if (n[1]) { u[0] = 1; w[2] = 1; } else { u[0] = 1; w[1] = 1; }
        const b = v.length / 6;
        for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) v.push(n[0] + u[0] * a + w[0] * c, n[1] + u[1] * a + w[1] * c, n[2] + u[2] * a + w[2] * c, ...n);
        I.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      out.push({ v, i: I });
    }
    // rounded box: each cube face is a grid whose outer bands bend round the edges (radius r)
    {
      const r = 0.5, cs = [-1, -1 + r * 0.5, -1 + r, 1 - r, 1 - r * 0.5, 1], N = cs.length, v = [], I = [];
      const cl = (q) => Math.max(-(1 - r), Math.min(1 - r, q));
      for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) {
        const b = v.length / 6, a1 = (ax + 1) % 3, a2 = (ax + 2) % 3;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const q = [0, 0, 0]; q[ax] = sg; q[a1] = cs[i]; q[a2] = cs[j];
          const c = [cl(q[0]), cl(q[1]), cl(q[2])], d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]], l = Math.hypot(d[0], d[1], d[2]);
          v.push(c[0] + d[0] / l * r, c[1] + d[1] / l * r, c[2] + d[2] / l * r, d[0] / l, d[1] / l, d[2] / l);
        }
        for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const k = b + j * N + i; I.push(k, k + 1, k + N + 1, k, k + N + 1, k + N); }
      }
      out.push({ v, i: I });
    }
    // cylinder along z: smooth sides, flat caps
    {
      const S = 10, v = [], I = [];
      for (let k = 0; k <= S; k++) { const a = k / S * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); v.push(c, s, -1, c, s, 0, c, s, 1, c, s, 0); }
      for (let k = 0; k < S; k++) { const b = k * 2; I.push(b, b + 2, b + 3, b, b + 3, b + 1); }
      for (const z of [-1, 1]) {
        const b = v.length / 6;
        v.push(0, 0, z, 0, 0, z);
        for (let k = 0; k < S; k++) { const a = k / S * Math.PI * 2; v.push(Math.cos(a), Math.sin(a), z, 0, 0, z); }
        for (let k = 0; k < S; k++) I.push(b, b + 1 + k, b + 1 + (k + 1) % S);
      }
      out.push({ v, i: I });
    }
    // sphere
    {
      const S = 12, Rn = 8, v = [], I = [];
      for (let j = 0; j <= Rn; j++) {
        const t = j / Rn * Math.PI, z = -Math.cos(t), rr = Math.sin(t);
        for (let k = 0; k <= S; k++) { const a = k / S * Math.PI * 2, x = Math.cos(a) * rr, y = Math.sin(a) * rr; v.push(x, y, z, x, y, z); }
      }
      for (let j = 0; j < Rn; j++) for (let k = 0; k < S; k++) { const a = j * (S + 1) + k, b = a + S + 1; I.push(a, a + 1, b + 1, a, b + 1, b); }
      out.push({ v, i: I });
    }
    return out;
  },
  def(name, build) {
    if (this.gl) throw new Error('GL3D.def after init');
    this.defs.push({ name, build });
    return (this[name] = this.NM++);
  },
  // A closed smooth mesh through rings along an axis ('z': rings in x-y, or 'x': rings in y-z).
  // Each ring is [t, c1, r1, c2, r2, n, nb]: position along the axis, centre and half extent on the two
  // cross axes, superellipse exponent (nb for the back half, c1 < 0 side). A ring with r1 = 0 is a pole;
  // open ends get flat caps. Coordinates are used as given (keep them inside [-1, 1]).
  lathe(rings, seg, axis) {
    const S = seg || 16, R = rings.length, P = [], v = [], I = [];
    const se = (c, n) => Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    for (let j = 0; j < R; j++) {
      const [t, c1, r1, c2, r2, n, nb] = rings[j];
      for (let k = 0; k < S; k++) {
        const a = k / S * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), e = ca < 0 && nb ? nb : n || 2;
        const u = c1 + r1 * se(ca, e), w = c2 + r2 * se(sa, e);
        P.push(axis === 'x' ? [t, u, w] : [u, w, t]);
      }
    }
    const pt = (j, k) => P[j * S + ((k + S) % S)];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const ai = axis === 'x' ? 0 : 2;
    for (let j = 0; j < R; j++) {
      const pole = rings[j][2] === 0;
      for (let k = 0; k < S; k++) {
        const p = pt(j, k);
        let nx, ny, nz;
        if (pole) { nx = 0; ny = 0; nz = 0; const d = j === 0 ? -1 : 1; if (ai === 0) nx = d; else nz = d; }
        else {
          // tangents round the ring and along the axis (one-sided at the ends)
          const tu = sub(pt(j, k + 1), pt(j, k - 1)), tv = sub(pt(Math.min(R - 1, j + 1), k), pt(Math.max(0, j - 1), k));
          nx = tu[1] * tv[2] - tu[2] * tv[1]; ny = tu[2] * tv[0] - tu[0] * tv[2]; nz = tu[0] * tv[1] - tu[1] * tv[0];
          // point outward, away from the ring's centre line
          const rc = rings[j], cx = axis === 'x' ? 0 : rc[1], cy = axis === 'x' ? rc[1] : rc[3], cz = axis === 'x' ? rc[3] : 0;
          const ox = ai === 0 ? 0 : p[0] - cx, oy = p[1] - cy, oz = ai === 2 ? 0 : p[2] - cz;
          if (nx * ox + ny * oy + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        }
        const l = Math.hypot(nx, ny, nz) || 1;
        v.push(p[0], p[1], p[2], nx / l, ny / l, nz / l);
      }
    }
    for (let j = 0; j < R - 1; j++) for (let k = 0; k < S; k++) {
      const a = j * S + k, b = j * S + (k + 1) % S;
      I.push(a, b, b + S, a, b + S, a + S);
    }
    // flat caps on open ends
    for (const j of [0, R - 1]) {
      if (rings[j][2] === 0) continue;
      const d = j === 0 ? -1 : 1, c = v.length / 6, rc = rings[j];
      const cen = axis === 'x' ? [rc[0], rc[1], rc[3]] : [rc[1], rc[3], rc[0]];
      v.push(cen[0], cen[1], cen[2], ai === 0 ? d : 0, 0, ai === 2 ? d : 0);
      for (let k = 0; k < S; k++) { const p = pt(j, k); v.push(p[0], p[1], p[2], ai === 0 ? d : 0, 0, ai === 2 ? d : 0); }
      for (let k = 0; k < S; k++) I.push(c, c + 1 + k, c + 1 + (k + 1) % S);
    }
    return { v, i: I };
  },
  grow(m, n) { this.cap[m] = n; const a = new Float32Array(n * this.FL); if (this.inst[m]) a.set(this.inst[m].subarray(0, this.n[m] * this.FL)); this.inst[m] = a; },
  // ---- frame
  begin(scale) {
    this.scale = scale; this.cells.length = 0;
    for (let k = 0; k < this.NM; k++) this.n[k] = 0;
    this.cx = 0; this.cy = 0; this.rowH = 0;
    if (!this.maxW) this.maxW = Math.min(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE), 4096);
    // rows about as wide as the cells need keep the atlas near square (less to copy each frame)
    this.rowW = Math.min(this.maxW, scale > 1.6 ? 2048 : 1024);
  },
  // reserve an atlas cell (world px sizes); null when the atlas is full
  // (q: this cell's resolution as a share of the frame's, for characters further off)
  cell(w, h, ax, ay, q) {
    q = q || 1;
    const s = this.scale * q, pw = Math.ceil(w * s) + 2, ph = Math.ceil(h * s) + 2;
    if (this.cx + pw > this.rowW) { this.cx = 0; this.cy += this.rowH; this.rowH = 0; }
    if (this.cy + ph > this.maxW) return null;
    const c = { px: this.cx + 1, py: this.cy + 1, pw: pw - 2, ph: ph - 2, w, h, ax, ay, q };
    this.cx += pw; this.rowH = Math.max(this.rowH, ph);
    this.cells.push(c);
    return c;
  },
  prim(m, cx, cy, cz, xx, xy, xz, yx, yy, yz, zx, zy, zz, r, g, b, t0, t1, mat) {
    if (this.n[m] >= this.cap[m]) this.grow(m, this.cap[m] * 2);
    const a = this.inst[m], o = this.n[m]++ * this.FL;
    a[o] = cx; a[o + 1] = cy; a[o + 2] = cz;
    a[o + 3] = xx; a[o + 4] = xy; a[o + 5] = xz;
    a[o + 6] = yx; a[o + 7] = yy; a[o + 8] = yz;
    a[o + 9] = zx; a[o + 10] = zy; a[o + 11] = zz;
    a[o + 12] = r; a[o + 13] = g; a[o + 14] = b;
    a[o + 19] = this.sd; a[o + 20] = t0; a[o + 21] = t1;
    if (mat) { a[o + 22] = mat[0]; a[o + 23] = mat[1]; a[o + 24] = mat[2]; a[o + 25] = mat[3]; } else a[o + 22] = a[o + 23] = a[o + 24] = a[o + 25] = 0;
    const h0 = this.h0, h1 = this.h1;
    if (h0) { a[o + 26] = h0[0] - this.ho[0]; a[o + 27] = h0[1] - this.ho[1]; a[o + 28] = h0[2] - this.ho[2]; a[o + 29] = h0[3]; } else a[o + 29] = 0;
    if (h1) { a[o + 30] = h1[0] - this.ho[0]; a[o + 31] = h1[1] - this.ho[1]; a[o + 32] = h1[2] - this.ho[2]; a[o + 33] = h1[3]; } else a[o + 33] = 0;
  },
  mark(out) { for (let k = 0; k < this.NM; k++) out[k] = this.n[k]; return out; },
  // drop everything queued since mark (no cell could be found)
  undo(mk) { for (let k = 0; k < this.NM; k++) this.n[k] = mk[k]; },
  seal(c, mk, light, flash) {
    const ox = c.px + c.ax * this.scale * c.q, oy = c.py + c.ay * this.scale * c.q, F = this.FL;
    for (let k = 0; k < this.NM; k++) {
      const a = this.inst[k];
      for (let i = mk[k], e = this.n[k]; i < e; i++) { const o = i * F; a[o + 15] = light; a[o + 16] = flash || 0; a[o + 17] = ox; a[o + 18] = oy; a[o + 34] = c.q; }
    }
  },
  flush() {
    const gl = this.gl;
    if (!this.cells.length) return;
    let W = 256, H = 256;
    for (const c of this.cells) { if (c.px + c.pw + 1 > W) W = c.px + c.pw + 1; if (c.py + c.ph + 1 > H) H = c.py + c.ph + 1; }
    W = Math.min(this.maxW, W); H = Math.min(this.maxW, H);
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
    // faces wind either way once the projection flips y; draw both
    gl.disable(gl.CULL_FACE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform2f(this.uAtlas, AW, AH); gl.uniform1f(this.uScale, this.scale); gl.uniform1f(this.uPx, this.scale * 34);
    const L = this.loc, st = this.FL * 4;
    const at = (name, size, off) => { const l = L[name]; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, st, off * 4); this.divisor(l, 1); };
    for (let k = 0; k < this.NM; k++) {
      const n = this.n[k], M = this.meshes[k];
      if (!n) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, M.vb);
      gl.enableVertexAttribArray(L.aP); gl.vertexAttribPointer(L.aP, 3, gl.FLOAT, false, 24, 0); this.divisor(L.aP, 0);
      gl.enableVertexAttribArray(L.aN); gl.vertexAttribPointer(L.aN, 3, gl.FLOAT, false, 24, 12); this.divisor(L.aN, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, M.ibuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.inst[k].subarray(0, n * this.FL), gl.DYNAMIC_DRAW);
      at('iC', 3, 0); at('iX', 3, 3); at('iY', 3, 6); at('iZ', 3, 9); at('iCol', 3, 12); at('iL', 4, 15); at('iS', 1, 19); at('iT', 2, 20); at('iM', 4, 22); at('iH0', 4, 26); at('iH1', 4, 30); at('iQ', 1, 34);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, M.ib);
      this.drawInst(gl.TRIANGLES, M.ni, gl.UNSIGNED_SHORT, 0, n);
    }
    // one copy of the used part into a 2D canvas: drawing many pieces straight from the WebGL
    // canvas can read the whole GL buffer back for every piece when the page canvas is not on the GPU
    if (!this.c2) { this.c2 = document.createElement('canvas'); this.g2 = this.c2.getContext('2d'); }
    if (this.c2.width < AW || this.c2.height < AH) { this.c2.width = Math.max(this.c2.width, AW); this.c2.height = Math.max(this.c2.height, AH); }
    this.g2.clearRect(0, 0, W, H);
    this.g2.drawImage(this.cv, 0, 0, W, H, 0, 0, W, H);
  },
  // draw a cell with its anchor at world px (x, y) on the 2D context (already transformed to world px)
  blit(ctx, c, x, y, alpha) {
    const s = this.scale * c.q;
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(this.c2, c.px, c.py, c.pw, c.ph, x - c.ax, y - c.ay, c.pw / s, c.ph / s);
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
  },
};
