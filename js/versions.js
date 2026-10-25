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
    v: '000.020.000.133', date: '2026-10-25', title: 'Vehicles at full size, wheels that turn',
    notes: [
      'Vehicles are a believable size. Their bodies were real cars at half scale, so beside people and houses they looked like toys, the roof of a sedan at your waist; every vehicle is now about one and a half times bigger, a sedan\'s roof at your chest. What a vehicle hits, where it parks and how wide it turns grew with it.',
      'Wheels turn as the car rolls: the hub caps, spokes and lug nuts go round and the grooves on the tyres move; at speed the rims blur. A wheel locked under hard braking stops turning.',
      'Parking fits the bigger cars: car park stalls are a car deep, police cars at the kerb are spaced out, and a car that would stand in a wall or another car is moved clear (or left out). Cars in an old save are moved clear the same way when it loads.',
    ],
    commits: ['5d5356a', '23d3871'], shots: ['v020000_1', 'v020000_2', 'v020000_3', 'v020000_4'],
  },
  {
    v: '000.019.001.130', date: '2026-10-25', title: 'Clean-up and polish',
    notes: [
      'Fixed buildings you could not walk into: schools, barracks, the armory and the prison blocks had no outside doors (the armory could not be entered at all), no trailer bedroom had a door, and some narrow bathrooms and upstairs rooms behind the stairs had none. Every room of every building can now be reached through a door (checked room by room on five maps).',
      'Item tooltips as in Zomboid: the item\'s kind, then rows of stats, with a coloured bar for anything that runs down (condition, ammo, contents, fuel, battery, uses left, freshness, clothing protection). The hand slots on the left bar show the same tooltip.',
      'Fort Hale has lawns and trees, a tree-lined road in from the gate, an obstacle course across the parade ground, sandbagged posts in the corners and a supply dump by the motor pool. The prison\'s exercise yard is a running track round a lawn with picnic tables.',
      'Clean-up: the settings menu\'s tabs and presets follow the grey look, prisons and army buildings no longer have shop awnings, Hollow Creek\'s second office is Creekside Realty (there were two Valley Insurances), the Expanded map is no longer described as still being built, and unused code is gone.',
    ],
    commits: ['39fb32f', 'b4c8487', '00dca0a', '9b3bb13'], shots: ['v019001_1', 'v019001_2', 'v019001_3', 'v019001_4'],
  },
  {
    v: '000.019.000.125', date: '2026-10-25', title: 'Flats, apartments and new places in town',
    notes: [
      'About half the shops on the main streets are two storeys now, on both maps: stairs in the stock room lead up to a flat the size of the shop, with a living room, a kitchen, a bedroom and a bathroom, and windows over the street. The rest of the Stable map is as it was.',
      'Apartment blocks in Riverton and Kingsbury (Expanded): two storeys of brick round a stair hall, four flats in each, mailboxes by the front door, a car park beside and a shared yard behind with trees, picnic tables and a clothesline.',
      'New places in the Expanded towns: a post office in each (P.O. boxes, the service counter, sacks of mail behind), a library in Riverton and in Kingsbury (shelves of books, plenty of them skill books, and reading tables), and an auto repair shop in each town: roll-up doors, workbenches, car parts and tyres, and a car in for repair with its hood up and a part or a wheel off, the key often still in it.',
      'Car parks are painted: stalls with wheel stops, lights at the ends of the aisle, and the cars parked in the stalls.',
      'Warehouses have their loading bays stocked (crates, a workbench and shelves).',
      'Fixed: a rare crash while drawing, seen when moving quickly across a busy town (a wall picture could be thrown out of the memory cache before it was drawn).',
    ],
    commits: ['1f3ac34', 'ceba02c'], shots: ['v019000_1', 'v019000_2', 'v019000_3', 'v019000_4'],
  },
  {
    v: '000.018.000.122', date: '2026-10-25', title: 'A Zomboid-style interface',
    notes: [
      'The interface is restyled after Project Zomboid: black glass panels with thin light frames, white text and grey highlights in place of the brown and gold, text a step bigger, and the windows with Zomboid\'s title bar (close at the left, the title in the middle, a collapse button at the right that folds the window to its title bar).',
      'What you hold sits at the top of the left bar, above the window buttons, as in Zomboid. The clock is your wristwatch\'s display (date, time, temperature); without a watch you only have a rough idea of the time of day. The game speed buttons sit under it.',
      'Health and character are one Character window with four tabs: Info (your survivor, carrying weight, hunger, thirst, fatigue, exercise), Skills, Health and a new Protection tab that shows, for every part of the body, how likely your clothes stop a bite or a scratch and what you have on there. H opens it on Health, K on Info.',
      'The Health tab has a proper body figure: wounds tint the part they are on, bandages wrap round it, fractures crack it and bleeding drips.',
      'The title screen, the pause menu and the death screen are plain words down the side or in the middle, as in Zomboid. Objects under the mouse are outlined in white.',
      'Auto UI scale is a little larger on big screens (125% at 1920 x 1080), still fitting laptops.',
    ],
    commits: ['7b5f7d1'], shots: ['v018000_1', 'v018000_2', 'v018000_3', 'v018000_4'],
  },
  {
    v: '000.017.000.120', date: '2026-10-25', title: 'The dead grab you; the UI fits your screen',
    notes: [
      'Zombies are dangerous now. A zombie that reaches you lunges the last stretch and keeps coming through its swing faster than you can walk (running still gets you clear), and if it lands it has hold of you: hands on your shoulders, leaning in, biting or clawing every second and a half or so. Held, you can barely move, and two of them pin you; three holding on for two seconds drag you down. Shove (Space) throws one off, even one behind you, or pull away to break free (strength and fitness help).',
      'Fixed: your own footsteps distracted the zombies attacking you (every step turned them to investigate the noise), so walking through a crowd broke off every attack. Walking straight through six zombies used to leave you untouched; now it leaves you wounded, and sometimes dead.',
      'The interface scales with the screen (Settings > Display > UI scale: Auto, or 75% to 150%). Auto shrinks it on laptop screens so nothing is cut off and grows it a little on very big ones. Long dialogs (World settings, Settings, How to play) scroll and windows never run off the screen.',
      'Memory budget (Settings > Experimental, 1 GB by default; 512 MB to 8 GB): past it, pictures not drawn lately are dropped and painted again when needed. The detailed frame counter and the performance report show the estimate.',
      'Fixed a memory leak: pictures of walls and furniture put out of their caches were kept alive by the renderer and painted again as duplicates. Touring a town now takes about 100 MB less.',
      'Menus, the pause screen and a paused game draw at 30 frames a second at most, so the computer idles there.',
    ],
    commits: ['686382e', '2e905cc'], shots: ['v017000_1', 'v017000_2', 'v017000_3', 'v017000_4'],
  },
  {
    v: '000.016.000.117', date: '2026-10-23', title: 'Faster cars, better guns and aim, lighter crowds',
    notes: [
      'Cars are much faster: a sedan reaches about 72 mph, a police car 88, a sports car over 100, pickups, vans and SUVs around 60-70, the fire truck, army truck and school bus 50-60. A worn engine loses less top speed than before, and a gear-shift bug is fixed that kept cars hunting between two gears, stuck at 25-50 mph.',
      'Guns are more accurate: aimed shots go where you point, hip fire is looser (more so with long guns), the shotgun throws its pellets in a pattern round your aim, and recoil builds per gun and settles quickly. The assault rifle fires about 11 rounds a second; the firing animation was holding it to 4.',
      'Aiming shows where the shot goes: holding right mouse with a gun draws the cone of fire on the ground out to the gun\'s range (cut short by the first wall), rings the zombie the shot would hit in green, yellow or red with the chance to hit it, and sizes the reticle to the spread. Zombies you cannot see are never marked.',
      'Spent casings fly from the gun\'s ejection port, tumble, bounce with a clink and lie on the floor for a couple of minutes: brass from pistols and the assault rifle, a red shell each time the shotgun is pumped, a case when the rifle bolt is worked, none from the revolver.',
      'Two maps, picked on the New Game screen: Stable (the finished county) and Expanded (the county with the land round it, a work in progress). Also a starting location: Random, Hollow Creek, Millbrook or the countryside, and on Expanded Fairfield, Riverton or Kingsbury.',
      'New settings (Optimization): Zombie animation rate (10 to 30 a second, or unlimited), Lazy zombie animation (zombies standing, wandering or feeding animate at half rate nearby and a quarter further off), Texture size limit (Full, 1x, Half) and World textures (half-resolution ground). The Low and Medium presets use them; zoomed far out the ground is always kept at half size.',
      'Buildings under a closed roof are no longer drawn underneath it (far less work in town), furniture in rooms you have never seen is not drawn, roofs turn see-through when they would hide your head or chest (gables and parapets included), and you know your own house from the start.',
      'Fixed: the zombies on the title screen stood frozen; in the dark, zombies close by vanished beyond three tiles (they are made out a few tiles off now, further under a moon); furniture with its clicked end boxed in (a bed\'s head between the wall, a wardrobe and its other half) said "I can\'t get there" - the survivor now goes to the end that can be reached.',
    ],
    commits: ['0eefaea', 'fc59857', 'a0eeead'], shots: ['v016000_1', 'v016000_2', 'v016000_3', 'v016000_4', 'v016000_5'],
  },
  {
    v: '000.015.000.113', date: '2026-10-16', title: 'The towns built and spread out',
    notes: [
      'Towns are less packed: the blocks thin out from the middle of town to its edge, with wider lots and side yards, single rows of houses with long back yards, and lots left empty (a lawn, an overgrown lot, a stand of trees, a neighbourhood vegetable garden with a shed, a gravel lot with a wreck). The shops in the middle stay close together.',
      'The bigger worlds (Settings > Experimental): Fairfield, Riverton and Kingsbury are built on a roomier street grid: shops round the main crossing with car parks behind, the police station, clinic and fire station on the main street, schools, churches, parks and gas stations, and in Kingsbury the county courthouse, a motel and a freight yard; houses on spread-out lots, stop signs, street signs, poles, hydrants and townsfolk among the dead.',
      'Fort Hale is built: six barracks of bunks and lockers, the HQ, a locked armory of weapon crates, the mess hall, a motor pool of army trucks, a parade ground and a helipad, behind a guarded gate; the dead wear uniforms.',
      'Rock Creek Correctional is built: two cell blocks behind locked doors, the mess hall and administration, an exercise yard and four guard towers inside a double fence; the dead here are prisoners in orange and their guards.',
      'Hawk Field has two hangars full of tools and parts, a terminal and a control tower.',
      'The world map ranks its labels: zoomed out only the towns are named, then places and roads, and close in the buildings; labels that would overlap are left out.',
    ],
    commits: ['6cd3839'], shots: ['v015000_1', 'v015000_2', 'v015000_3', 'v015000_4', 'v015000_5'],
  },
  {
    v: '000.014.000.111', date: '2026-10-16', title: 'Gore and a lot more animation',
    notes: [
      'Gore overhaul, with two new options (Settings > Display): Gore (Off, Low, Normal, Extreme) and Dismemberment (Off, On).',
      'Each kind of blow bleeds its own way: blunt hits splatter, blades spurt and leave streaks, stabs drip, gunshots spray out the far side, stomps burst on the ground. The blood flies as drops that land and stain.',
      'Pools spread under the bodies and dry over the hours into dark stains; splashes and trails darken and fade over the days.',
      'Wounds show on the bodies where they were hit. Stomps, heavy blows and close shotgun blasts can crush a head; axes and blades can take off a head, an arm, a forearm, a leg or a shin, left lying on the ground. A zombie that loses a leg crawls after you; one missing a limb leaves a blood trail. Weapons get bloody, and so do the clothes of whoever swings them.',
      'Animation overhaul: eating brings the food to the mouth and chews; drinking tips a bottle, can or carton back; pills are shaken into the palm and swallowed; cigarettes are smoked with the smoke breathed out; books are held open and read; bandaging winds round the part that is hurt (kneeling for the legs); reloading takes a pistol\'s magazine out and racks the slide, or feeds a shotgun or rifle a round at a time.',
      'More work animations: chopping trees with a full axe swing (wood chips fly in time with the chops), digging with a shovel (a foot on the blade, the dirt tossed aside), fishing with a cast and a line, sawing, hammering nails, sledgehammer swings, pouring fuel or watering, foraging and gardening on one knee, searching high shelves and low crates, lifting bodies and furniture, dressing (a top over the head, stepping into trousers, a hat set on).',
      'Fixed: the generic work animation no longer stands with clasped hands, hammering is no longer done at the hip, climbing over fences and through windows is a proper vault, sheet ropes are climbed hand over hand, and zombies pounding on doors raise their fists high and hammer down.',
      'Standing still for a while, your survivor looks around, stretches, checks their watch, scratches their head, rolls their neck or rubs their hands. They flinch when hurt and struggle when grabbed.',
      'The dead now feed: here and there a body lies in the street with zombies kneeling over it, tearing and biting, noticing far less while they eat. Idle zombies find bodies nearby, and if you die, the ones around you fall on your body.',
    ],
    commits: ['c57e06f', 'ce426e0'], shots: ['v014000_1', 'v014000_2', 'v014000_3', 'v014000_4'],
  },
  {
    v: '000.013.000.108', date: '2026-10-16', title: 'The countryside built',
    notes: [
      'The outskirts of the bigger worlds (Settings > Experimental) are built: homesteads line the county roads, Route 9 and Main Street beyond the old county - a house on its own lot, now and then a trailer, each with a gravel drive, a mailbox and often a car or pickup.',
      'Hartley Farm and Bluegrass Farms have a farmhouse and a big barn full of hay and tools on a gravel farmyard; Shady Pines Trailer Park has six trailers along a gravel lane off Route 9.',
      'The interstate truck stop has a gas station with pumps and the Big Rig Diner; the quarry has an office; the Wildwood campground has a ranger station, fire rings, benches and an outhouse.',
      'Where Main Street meets County Rd 22 there is now a gas station and Bethel Baptist Church with its graveyard.',
      'Every home gets a lived-in yard like the ones in the county, and the buildings are furnished, lootable and have a few zombies inside. The towns, Fort Hale, the prison and the airfield are still slabs for now.',
    ],
    commits: ['0d3c5fa'], shots: ['v013000_1', 'v013000_2', 'v013000_3', 'v013000_4'],
  },
  {
    v: '000.012.000.106', date: '2026-10-16', title: 'The bigger county laid out',
    notes: [
      'The new land of the Large, Huge and Massive worlds (Settings > Experimental) is now laid out for building: every place has its spot, its roads and its name, ready to be filled in.',
      'Three towns as street grids with sidewalks and a concrete slab on every lot where a building will stand, shop blocks and a park: Fairfield where Route 9 meets County Rd 14, Riverton on the river, and Kingsbury, the county seat by the interstate (Huge and Massive).',
      'The Salt River runs in from the east and down to the south edge, bridged by every road it meets; Wildwood Reservoir has a campground on its shore.',
      'Gray Rock Quarry, Shady Pines Trailer Park, Hartley Farm and Bluegrass Farms (furrowed fields round a farmyard), homestead lots along the county roads, and on the bigger maps a truck stop at the interstate, Fort Hale army base, Rock Creek Correctional prison and Hawk Field airfield, all fenced and reached by their own roads.',
      'The normal map is unchanged.',
    ],
    commits: ['8d396ac'], shots: ['v012000_1', 'v012000_2', 'v012000_3'],
  },
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
    ($('#ui') || document.body).appendChild(el);
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
