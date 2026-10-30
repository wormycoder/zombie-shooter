// Renders the game's audio (dev/audiogen/gen.html in a headless Chromium) and writes it as .mp3 into audio/:
//   audio/sfx/<name>_<n>.mp3     sound effects, n = 1.. their variations (mono, 96 kbps)
//   audio/loops/<name>.mp3       ambience loops (stereo, 128 kbps)
//   audio/music/<name>.mp3       music (stereo, 128 kbps)
// and the list the game loads them by, js/data/audiolist.js. Needs node, Playwright's Chromium and ffmpeg.
//   node dev/audiogen/build.js                 everything
//   node dev/audiogen/build.js sfx|loops|music  one kind
//   node dev/audiogen/build.js sfx glass        one sound (all its variations)
// Files you replace by hand are kept unless you rebuild that kind or name: to swap in a recording, save it over the file
// of the same name (any length; variations _1, _2 ... are picked at random).
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..', '..'), OUT = path.join(ROOT, 'audio'), TMP = path.join(require('os').tmpdir(), 'hc-audiogen');
const [kindArg, nameArg] = process.argv.slice(2);
fs.mkdirSync(TMP, { recursive: true });
for (const d of ['sfx', 'loops', 'music']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

function wav(file, { nc, sr, data }) {
  const pcm = Buffer.from(data, 'base64'), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(nc, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * nc * 2, 28); h.writeUInt16LE(nc * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}
function mp3(src, dst, kbps) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-codec:a', 'libmp3lame', '-b:a', kbps + 'k', dst]); }

(async () => {
  const b = await pw.chromium.launch(), p = await b.newPage();
  p.on('pageerror', e => console.error('page error:', e.message));
  await p.goto('file://' + path.join(__dirname, 'gen.html'));
  const L = await p.evaluate(() => Gen.list());
  const t0 = Date.now(); let n = 0;
  const one = async (kind, name, v) => {
    const pcm = await p.evaluate(([k, nm, vv]) => k === 'sfx' ? Gen.sfx(nm, vv) : k === 'loops' ? Gen.loop(nm) : Gen.music(nm), [kind, name, v]);
    const base = kind === 'sfx' ? name + '_' + (v + 1) : name, w = path.join(TMP, base + '.wav');
    wav(w, pcm); mp3(w, path.join(OUT, kind, base + '.mp3'), kind === 'sfx' ? 96 : 128); fs.unlinkSync(w); n++;
  };
  for (const kind of ['sfx', 'loops', 'music']) {
    if (kindArg && kindArg !== kind) continue;
    for (const name of Object.keys(L[kind])) {
      if (nameArg && nameArg !== name) continue;
      if (kind === 'sfx') for (let v = 0; v < L.sfx[name]; v++) await one(kind, name, v);
      else await one(kind, name, 0);
      process.stdout.write('.');
    }
  }
  await b.close();
  // the list the game loads (counts the files actually there, so recordings added by hand are found too)
  const have = (d, re) => fs.readdirSync(path.join(OUT, d)).filter(f => f.endsWith('.mp3')).map(f => f.replace(/\.mp3$/, '')).filter(f => re.test(f));
  const sfx = {};
  for (const f of have('sfx', /_\d+$/)) { const m = f.match(/^(.*)_(\d+)$/); sfx[m[1]] = Math.max(sfx[m[1]] || 0, +m[2]); }
  const loops = {}; for (const f of have('loops', /./)) loops[f] = L.loops[f] || 0;
  const music = {}; for (const f of have('music', /./)) music[f] = L.music[f] || {};
  const js = "'use strict';\n// The game's audio files (written by dev/audiogen/build.js): sound effects audio/sfx/<name>_<n>.mp3 with how many\n// variations each has, ambience loops audio/loops/<name>.mp3 with their loop length in seconds (0: loop the whole file),\n// music audio/music/<name>.mp3. Replace any file with a recording of the same name and the game plays that instead.\n"
    + 'const AUDIO_LIST = ' + JSON.stringify({ sfx, loops, music }) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'js', 'data', 'audiolist.js'), js);
  console.log('\n' + n + ' files in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
})();
