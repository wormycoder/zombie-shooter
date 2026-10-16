'use strict';
// ---------------------------------------------------------------------------
// Version tracker: the build string shown on the title screen and the release history behind its "?" button.
//
// Version scheme xxx.xxx.xxx.xxx — four fields of three digits each:
//   major  000 for the development builds
//   minor  feature updates
//   patch  fixes, polish and internal work on top of a minor
//   build  number of commits on the development branch up to and including that build
// Every commit was pushed; a version covers the commits since the previous one.
// To release: put a new entry at the top of VERSION_LOG (VERSION follows it) and its screenshots in versions/
// named <shot>.jpg (about 720 px wide).
// ---------------------------------------------------------------------------
const VERSION_LOG = [
  {
    v: '000.011.000.104', date: '2026-10-16', title: 'Bigger worlds (experimental) and better culling',
    notes: [
      'A new Experimental tab in Settings with a World size option for new games: Normal (400 x 400), Large (2.5x), Huge (4x) or Massive (5x). Games already started keep their size.',
      'In a bigger world Hollow Creek and Millbrook keep their place in the north-west, and the new land around them is blocked out: Route 9 and Main Street run on to the edge of the map, two county roads cross the woods, a divided interstate runs down the far east of the Huge and Massive maps, and dirt logging tracks lead into the forest. No buildings out there yet.',
      'Forest, meadows, grass verges along the roads and a thin scatter of zombies fill the new land; the map window now zooms out far enough to see all of it.',
      'Better culling: characters, objects, walls, trees, bodies, blood and items that are off screen are no longer posed, painted or sent to the graphics card (in a busy town about 40% fewer 3D characters posed and 10-25% fewer draw calls), curbs are part of the cached ground instead of being redrawn every frame, and the ground cache checks itself less often.',
      'Smaller saves and a shorter autosave freeze: trees are stored compactly and the map data is no longer copied into one huge piece of text (about 40% less freeze on a normal map), and the list of things that tick (fires, crops, traps) is rebuilt a slice at a time.',
    ],
    commits: ['5eb1063'], shots: ['v011000_1', 'v011000_2', 'v011000_3', 'v011000_4'],
  },
  {
    v: '000.010.000.102', date: '2026-10-16', title: 'Optimization update and new trees',
    notes: [
      'A new Optimization tab in Settings: quality presets, a live frame-rate readout, a "Pick for me" button that chooses a preset from how the game actually runs on your machine, every performance setting in one place, and a performance report you can copy and send.',
      'Bodies lying still (corpses, sleepers) are drawn once and reused instead of being rebuilt as full 3D models every frame — the biggest cost on streets full of the dead.',
      'Distant characters and crowds switch to simpler models (smooth, coarse, the old box models, then flat figures), with you and anything close always at full detail.',
      'Faster drawing overall: no more ground-cache thrashing when zoomed out, cheaper shadows and darkened sprites, cached sprite lookups, a lighter autosave without the long freeze, and fast-forward that no longer snowballs.',
      'New settings: dynamic resolution, character and car detail, LOD distance, max detailed characters, shadows, ambient particles, corpse, decal and sprite cache limits; Auto is the new default.',
      'Trees remade: oak, maple, elm, birch, apple, cherry, pine, spruce, cedar and dead trees in four ages, with lit layered foliage, blossom, autumn colours, bare winter branches and snow, wind sway, bushes, stumps and fallen logs, orchards on farms — and a see-through window that keeps you visible in dense woods.',
    ],
    commits: ['3c1bd95', '5690639'], shots: ['v010000_1', 'v010000_2', 'v010000_3', 'v010000_4'],
  },
  {
    v: '000.009.004.065', date: '2026-10-11', title: 'Three-digit version fields',
    notes: [
      'Versions are now written as four three-digit fields (major.minor.patch.build), so minor and patch numbers can grow past 9.',
      'Every earlier version keeps its number, padded to the new format.',
    ],
    commits: [], shots: ['v094_1'],
  },
  {
    v: '000.009.003.064', date: '2026-10-11', title: 'New characters and cars',
    notes: [
      'Survivors and zombies are rebuilt as rounded, realistically proportioned people: faces, hands, hair with volume, shirts with sleeves and collars, jackets, trousers and shoes; zombies with grey-green skin, blood soaked into torn clothes.',
      'Animation blends between poses instead of snapping. Walk, run, sprint, sneak and shamble cycles follow the distance actually moved, so feet no longer slide; the body leans into sprints, breathes and shifts its weight when idle.',
      'Swings for every weapon type with wind-up, strike and follow-through, timed to the hit; pistol and rifle aiming with recoil; a two-handed shove that can knock zombies down.',
      'Stomping: Space near a zombie on the ground raises a knee and drives the heel into its head. A melee attack at a downed zombie chops at the ground and can hit it.',
      'Zombies lunge and bite, reel back from hits in the direction they were struck, fall, get up, crawl, and lie naturally as corpses.',
      'All 13 vehicle types remade as late-80s / early-90s American cars: longer hoods, chrome window surrounds and bumpers, wheel covers, arch lips, grilles and lamp clusters, mud flaps on trucks, and a V8 engine bay under an open hood.',
    ],
    commits: ['de2ea1f', '528d38c'], shots: ['v093_1', 'v093_2', 'v093_3', 'v093_4', 'v093_5'],
  },
  {
    v: '000.009.002.038', date: '2026-10-09', title: 'Version tracker',
    notes: [
      'This window: the version label and the "?" history button on the title screen.',
      'Every build since the first commit, grouped into versions with notes and screenshots taken during development.',
      'Builds whose screenshots were lost were rendered again from the old code.',
    ],
    commits: ['788d9c1'], shots: ['v092_1', 'v092_2'],
  },
  {
    v: '000.009.001.037', date: '2026-10-09', title: '8x8 chunks, faster simulation, debug mode',
    notes: [
      'Simulation chunks are now 8x8 tiles, with the same distances in chunks: the world runs at half speed from 6 chunks away and pauses from 12; distant zombies think less often from 3 chunks out.',
      'Zombie neighbour lookups and pathfinding allocate nothing per step. A* returns the same paths about 22% faster, and memory churn during play dropped by about 40%.',
      'Debug mode in the spirit of Project Zomboid\'s, from ?debug, F2 or ` in game, or the switch on the title screen and pause menu.',
      'Cheats: god mode, invisible, no-clip, endless endurance, no needs, infinite ammo, instant actions, free building, full bright, frozen zombies, move and time speed.',
      'Spawners: item search with starter kits, zombie hordes placed with the mouse, vehicles of any type, colour and condition.',
      'World tools: time and weather, power and water, the helicopter, noise, fires, cleanup, and teleport by Ctrl+click on the world or the map. Player tools: wounds, stats, skills and traits.',
      'Overlays: chunk tiers, tile info, rooms, collision, zombie AI paths and sight, noise rings, light and vision. Frame-time graphs.',
    ],
    commits: ['e283603'], shots: ['v091_1', 'v091_2', 'v091_3', 'v091_4'],
  },
  {
    v: '000.009.000.036', date: '2026-10-09', title: 'Groundwork for the overhaul',
    notes: [
      'Hook points for debug mode, the version tracker and richer right-click menus.',
      'Scouting for the big overhaul: the bed, layering, camera, interface, models and animation.',
    ],
    commits: ['1569704'], shots: ['v090_1', 'v090_2'],
  },
  {
    v: '000.008.002.035', date: '2026-10-07', title: 'Lived-in yards',
    notes: [
      'Each household (tidy, family, elderly, gardener, handyman, messy, rural) furnishes its own yard.',
      'Front yards: porches, flower beds, hedges, garden lights, gnomes, flamingos, bird feeders, flags and for-sale signs.',
      'Back yards: fences and gates, sheds with tools, decks, barbecues, fire pits, vegetable rows, clotheslines, doghouses, woodpiles, swing sets, trampolines and pools.',
      'Cabins get outhouses and farms get chicken coops. Flowers, laundry, weeds and snow follow the seasons, and doors and paths are never cut off.',
    ],
    commits: ['d8632fa'], shots: ['v082_1', 'v082_2', 'v082_3', 'v082_4'],
  },
  {
    v: '000.008.001.034', date: '2026-10-06', title: 'Zomboid-style inventory and hotbar',
    notes: [
      'Hotbar slots come from worn gear: back for long weapons, belt left and right, and a holster. Attached gear shows on the character.',
      'Inventory windows have container buttons, sortable columns, stacks, multi-select, drag and drop, Loot all / Transfer all and a weight bar.',
      'New belts and holsters. Old saves are converted.',
    ],
    commits: ['ee776bd'], shots: ['v081_1', 'v081_2'],
  },
  {
    v: '000.008.000.033', date: '2026-10-06', title: '3D characters',
    notes: [
      'Survivors and zombies are 3D models drawn with WebGL in exact isometric projection.',
      'Arms follow the hand targets through two-bone IK. Walk and run cycles, limps, crouching, crawling, falls and bodies on the ground.',
      'Clothes, hair, hats, bags, blood and 3D weapons. 3D previews in character creation.',
      'Falls back to 2D figures without WebGL.',
    ],
    commits: ['aba7034'], shots: ['v080_1', 'v080_2', 'v080_3', 'v080_4'],
  },
  {
    v: '000.007.000.032', date: '2026-10-06', title: 'Vehicles overhaul',
    notes: [
      'Tyre-grip handling: sliding, wheelspin, handbrake turns, gears, and surface grip on gravel, grass, rain, snow and ice.',
      'Per-part damage with real effects, flat tyres, a draining battery and stalling. A mechanics window installs and repairs parts.',
      'Dashboard HUD, tyre marks, exhaust, new car sounds, and the driven car drawn at its exact heading.',
    ],
    commits: ['dc5ed4f'], shots: ['v070_1', 'v070_2', 'v070_3'],
  },
  {
    v: '000.006.001.031', date: '2026-10-06', title: 'Lazy updates and the Settings screen',
    notes: [
      'Far zombies and far chunks update less often and catch up when you return.',
      'Lighting and interface refresh rates, an FPS counter with a detailed overlay, and a Settings screen with Display, Performance, Audio and Controls tabs.',
      'Faster start: the world generates while you create your character.',
    ],
    commits: ['5fe9b17'], shots: ['v061_1', 'v061_2'],
  },
  {
    v: '000.006.000.030', date: '2026-10-06', title: 'Graphics and performance settings',
    notes: [
      'Low, Medium, High and Ultra presets: render resolution, frame cap, detail, particles and weather density.',
      'The ground is cached in 8x8-tile chunks, and sprites are cropped to their pixels with about 80% less memory.',
    ],
    commits: ['37025d5'], shots: ['v060_1', 'v060_2'],
  },
  {
    v: '000.005.000.029', date: '2026-10-06', title: 'Radial menu and alarm options',
    notes: [
      'Project Zomboid-style radial menu on V: car controls inside and beside a car, plus quick actions on foot.',
      'Sandbox options for how often houses and cars have alarms (rare by default).',
      'A slot for the shared WebGL renderer.',
    ],
    commits: ['b047734', 'd402f17', '5aaa868'], shots: ['v050_1', 'v050_2', 'v050_3'],
  },
  {
    v: '000.004.002.026', date: '2026-10-06', title: 'Car art integration',
    notes: ['Broken or burnt headlamps no longer cast beams. Varied wreck models. Car sprites are freed on new game and load.'],
    commits: ['9571221'], shots: ['v042_1', 'v042_2'],
  },
  {
    v: '000.004.001.025', date: '2026-10-05', title: 'The detail pass: houses, cars and streets',
    notes: [
      'House facades: siding, brick, stucco, log and metal walls; trimmed windows with shutters and window boxes; panelled doors, garage doors, shop fronts and awnings. Pre-rendered roofs with shingles, chimneys and snow.',
      'Model-based car art for every vehicle type, with damage, glass, open doors, lights and light bars.',
      'Street detail: road markings, cracks and drains, stop signs, traffic signals, utility poles, street furniture, gas station canopies, bus stops, and outbreak traffic jams and crashes.',
    ],
    commits: ['5ae2edb', 'ea9de35', '26e8d27'], shots: ['v041_1', 'v041_2', 'v041_3', 'v041_4'],
  },
  {
    v: '000.004.000.022', date: '2026-10-05', title: 'Extension hooks',
    notes: ['Registries for street, yard and car detail modules, light emitters, decals and floor overlays. New vehicle types. Objects declare their own fire behaviour.'],
    commits: ['88c72db', 'c69c83b', '3a351e8'], shots: ['v040_1'],
  },
  {
    v: '000.003.003.019', date: '2026-10-05', title: 'Night lights, rotting corpses and sirens',
    notes: [
      'Lit rooms glow through their windows at night and spill light outside.',
      'Corpses rot and draw flies; the stench wears on you. Carry bodies away or burn them.',
      'Police cars and fire trucks have working sirens that pull every zombie in earshot.',
      'Sandbox lore options: infection transmission, zombie toughness, door-opening zombies.',
    ],
    commits: ['a63667e', 'b595bbc', '878b882'], shots: ['v033_1', 'v033_2'],
  },
  {
    v: '000.003.002.016', date: '2026-10-05', title: 'Fractures, moveable furniture and limping',
    notes: [
      'Bones break from falls and crashes. Splints help them knit over weeks.',
      'Pick up, carry and place furniture with a rotating ghost preview.',
      'Injured legs make you limp, and some zombies drag a leg.',
    ],
    commits: ['b8133d5', '56623b6', 'ff72bcf'], shots: ['v032_1', 'v032_2'],
  },
  {
    v: '000.003.001.013', date: '2026-10-05', title: 'Soundscape and survival tips',
    notes: ['Seasonal ambience: songbirds, cicadas, crickets, crows, owls and winter wind. How to Play covers the newer systems.'],
    commits: ['dfb711d', 'f400e49'], shots: ['v031_1', 'v031_2', 'v031_3'],
  },
  {
    v: '000.003.000.011', date: '2026-10-05', title: 'Trapping',
    notes: ['Trap boxes and snares catch rabbits, squirrels, birds and mice. They work best in the woods at dawn and dusk. New Trapping skill.'],
    commits: ['132dde9'], shots: ['v030_1'],
  },
  {
    v: '000.002.003.010', date: '2026-10-05', title: 'The county',
    notes: [
      'The map grows to 400x400 tiles: the village of Millbrook, Pine Rest trailer park, McCoy Farm, a second gas station, cabins and a military roadblock.',
      'A clinic. Zombies dress for the season. Compact saves and regular autosave.',
      'Nicer flames with pre-rendered flicker and glow.',
    ],
    commits: ['238e929', 'f59b7fd'], shots: ['v023_1', 'v023_2', 'v023_3', 'v023_4'],
  },
  {
    v: '000.002.002.008', date: '2026-10-05', title: 'Seasons',
    notes: ['A real calendar: pick the start month. Autumn foliage, bare winter trees, snow on the ground and roofs, cold houses, frost and seasonal food.'],
    commits: ['8cbee0c'], shots: ['v022_1', 'v022_2', 'v022_3'],
  },
  {
    v: '000.002.001.007', date: '2026-10-05', title: 'Fire',
    notes: [
      'Fire spreads through buildings and forests, eats wooden walls, climbs floors and brings roofs down.',
      'Started by Molotovs, stoves, campfires and gasoline. Fight it with water and extinguishers.',
    ],
    commits: ['d7cba30'], shots: ['v021_1', 'v021_2'],
  },
  {
    v: '000.002.000.006', date: '2026-10-05', title: 'Two-storey houses',
    notes: ['Upstairs floors with stairs, sheet ropes from windows, jumping down, and fighting and shooting from upstairs. Zombies follow you up the stairs.'],
    commits: ['1368c6c'], shots: ['v020_1', 'v020_2', 'v020_3'],
  },
  {
    v: '000.001.001.005', date: '2026-10-05', title: 'First polish',
    notes: [
      'Demolition with a sledgehammer, exercise, bloodied clothes, and an outbreak-torn town at the start.',
      'Grass edges on hard ground and smarter zombie pathing.',
      'World settings with presets, drowsy blinks and drunk sway.',
    ],
    commits: ['21882c6', '954e08a', 'e5722bc'], shots: ['v011_1', 'v011_2', 'v011_3'],
  },
  {
    v: '000.001.000.002', date: '2026-10-05', title: 'Hollow Creek: first playable',
    notes: [
      'A procedural town drawn isometrically, with cutaway walls, a vision cone and dynamic lighting.',
      'Zombies that see, hear, thump on doors and climb through windows.',
      'Moodles, body-part health and infection, inventory and containers, melee and firearms, crafting, building, farming, fishing and foraging.',
      'Vehicles, weather, power and water shutoff, the helicopter event, procedural audio and music, character creation and saves.',
    ],
    commits: ['d53e6df', '2780def'], shots: ['v010_1', 'v010_2', 'v010_3', 'v010_4'],
  },
];
const VERSION = VERSION_LOG[0].v;

const Versions = {
  // title screen: called by Menu.show before it writes the screen, so mount right after
  mountHome() { Promise.resolve().then(() => this.mount()); },
  mount() {
    const box = document.querySelector('#menu .modal.title');
    if (!box || box.querySelector('.ver-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'ver-bar';
    bar.innerHTML = `<span class="ver-label">VERSION : ${VERSION}</span><span class="ver-help" id="vhelp" title="Version history">?</span>`;
    bar.addEventListener('click', (e) => { e.stopPropagation(); if (e.target.closest('.ver-help')) this.open(); });
    box.appendChild(bar);
  },
  // version history window
  open() {
    if (document.getElementById('verwin')) return;
    const el = document.createElement('div');
    el.id = 'verwin';
    const shot = (s, k, e) => `<img class="ver-shot" src="versions/${s}.jpg" loading="lazy" data-v="${k}" data-i="${e}" alt="">`;
    el.innerHTML = `<div class="ver-box"><div class="ver-head"><div><div class="ver-title">Version history</div>
      <div class="ver-sub">Current build <b>${VERSION}</b> · ${VERSION_LOG.length} versions · scheme xxx.xxx.xxx.xxx: major · minor (features) · patch (fixes, polish) · build (commit count)</div></div>
      <span class="ver-x" title="Close (Esc)">×</span></div><div class="ver-list">`
      + VERSION_LOG.map((r, k) => `<div class="ver-item ${k ? '' : 'cur'}"><div class="ver-line"><span class="ver-v">${r.v}</span><span class="ver-name">${U.esc(r.title)}</span><span class="ver-date">${this.date(r.date)}</span></div>
        <ul>${r.notes.map(n => `<li>${U.esc(n)}</li>`).join('')}</ul>
        ${r.shots.length ? `<div class="ver-shots">${r.shots.map((s, i) => shot(s, k, i)).join('')}</div>` : ''}
        <div class="ver-commits">${r.commits.length ? r.commits.map(c => `<code>${c}</code>`).join('') : '<span>this build</span>'}</div></div>`).join('')
      + '</div></div>';
    document.body.appendChild(el);
    const close = () => { el.remove(); window.removeEventListener('keydown', key, true); };
    const key = (e) => {
      const lb = el.querySelector('.ver-lb');
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (lb) lb.remove(); else close(); }
      else if (lb && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); this.step(el, e.key === 'ArrowRight' ? 1 : -1); }
    };
    window.addEventListener('keydown', key, true);
    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('.ver-lb')) { if (t.closest('.ver-nav')) this.step(el, +t.closest('.ver-nav').dataset.d); else el.querySelector('.ver-lb').remove(); return; }
      if (t.closest('.ver-x') || t === el) { close(); return; }
      if (t.classList.contains('ver-shot')) this.lightbox(el, +t.dataset.v, +t.dataset.i);
    });
    el.addEventListener('wheel', (e) => e.stopPropagation());
  },
  date(s) { const [y, m, d] = s.split('-').map(Number); return MONTH_NAMES[m - 1].slice(0, 3) + ' ' + d + ', ' + y; },
  // enlarged screenshot; arrows step through every screenshot of every version
  lightbox(el, k, i) {
    let lb = el.querySelector('.ver-lb');
    if (!lb) { lb = document.createElement('div'); lb.className = 'ver-lb'; el.appendChild(lb); }
    const r = VERSION_LOG[k];
    this.cur = [k, i];
    lb.innerHTML = `<span class="ver-nav prev" data-d="-1">‹</span><figure><img src="versions/${r.shots[i]}.jpg" alt=""><figcaption><b>${r.v}</b> ${U.esc(r.title)} · ${i + 1} / ${r.shots.length}</figcaption></figure><span class="ver-nav next" data-d="1">›</span>`;
  },
  step(el, d) {
    let [k, i] = this.cur || [0, 0];
    i += d;
    // reading order: down the list, so past the last shot of a version comes the next (older) one
    while (k >= 0 && k < VERSION_LOG.length && (i < 0 || i >= VERSION_LOG[k].shots.length)) {
      if (i < 0) { k--; if (k >= 0) i = VERSION_LOG[k].shots.length - 1; }
      else { k++; i = 0; }
    }
    if (k < 0 || k >= VERSION_LOG.length) return;
    this.lightbox(el, k, i);
  },
};
