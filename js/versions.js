'use strict';
// ---------------------------------------------------------------------------
// Versions: the version shown on the title screen and the patch notes behind its "What's new" link.
//
// Internal version strings are xxx.xxx.xxx.xxx (major, minor, patch, build); players see "v0.24.1" and the build.
// Each release's screenshots are versions/<shot>.jpg; a debug session also shows its commits.
// To release: put a new entry at the top of VERSION_LOG (VERSION follows it); see dev/DEVELOPMENT.md.
// ---------------------------------------------------------------------------
const VERSION_LOG = [
  {
    v: '000.036.004.196', date: '2026-10-31', title: 'Out of sight, out of the frame',
    notes: [
      'New setting, Settings > Optimization > Drawing > Out-of-view objects: Hidden leaves out the furniture, props and fences on tiles you cannot see right now (behind you, in other rooms, round corners) until they come into view again; trees and the buildings\' walls and roofs still show. The Potato preset uses it: on the benchmark about a quarter fewer drawing calls a frame.',
      'The benchmark\'s camera now sees as a survivor would - the world in its view lit, the rest darkened (and left out with Out-of-view objects: Hidden) - so its numbers match play more closely.',
    ],
    commits: [], shots: [],
  },
  {
    v: '000.036.003.195', date: '2026-10-31', title: 'An uncapped benchmark',
    notes: [
      'The benchmark is uncapped: it makes its frames back to back instead of one per refresh of the screen, so its frame rates are what the computer can do - not held to the screen, the frame rate limit or the browser\'s energy saver.',
      'The warm-up lap now runs every load (light to ultra heavy) before anything is measured, so the first preset no longer pays alone for the first night, rain and big crowds either.',
      'A preset is recommended when it keeps 50 frames a second, with the slowest 1% above 30, under the heavy crowd.',
    ],
    commits: [], shots: [],
  },
  {
    v: '000.036.002.194', date: '2026-10-31', title: 'A fairer benchmark, a gentler Potato',
    notes: [
      'The benchmark starts with a warm-up lap (not counted): the first preset measured no longer pays alone for painting the whole town the first time, which made it look several frames a second slower than it is.',
      'The Potato preset keeps Low\'s character detail and sprite cache, and only takes away what surely costs a weak laptop: a softer 40% picture, lights, the HUD and zombie animation at 10 a second, very few particles and no weather on screen. (Pulling the detailed characters in closer made a crowd slower on a real graphics card, not faster.)',
    ],
    commits: [], shots: [],
  },
  {
    v: '000.036.001.193', date: '2026-10-31', title: 'A Potato preset',
    notes: [
      'A new Potato quality preset (Settings > Optimization) for very weak laptops: a softer 40% picture, plain models for all but the nearest few characters, lights and the HUD updated 10 times a second, fewer bodies and stains kept, very few particles. Pick for me chooses it when the game runs under 20 frames a second, and the benchmark tries it too.',
      'Walls and furniture in shadow are drawn in one go instead of two - on the benchmark nearly half the drawing calls a frame gone, which shows most on slow processors with a crowd about.',
      'No more hitch the first time a new kind of item comes into view on the floor.',
    ],
    commits: [], shots: ['v036001_1'],
  },
  {
    v: '000.036.000.190', date: '2026-10-30', title: 'Active ragdolls, and one big map',
    notes: [
      'Active ragdolls (Settings > Experimental): physics takes a body over when something acts on it - a blow, a shot, a shove, a car, a fall, a daze, a wrecked limb, being dragged - and hands it back to the animation once it has recovered. Hit, it is thrown with real momentum, the head snaps back from a headshot, and it stumbles a step or two to catch itself; muscles and joint limits keep it in one piece, so a shove bends the body instead of tearing it out of shape.',
      'With ragdolls on the dead go down by how they died instead of in a set pose: a body shot stumbles on before it falls, a shotgun or rifle round throws it back, a headshot drops it stiff as a plank, a blow from the side spins it, stabbed from behind its knees fold; the burning thrash; some twitch once down.',
      'With ragdolls on bodies land on one another and pile up, land with a thud, settle and lie still until something disturbs them - and are saved as they lie. Shot legs make the dead limp and then crawl, dragging them; a shot arm hangs; a blow to the head leaves one dazed and lurching. Zombies stumble over bodies in their way.',
      'The Expanded map is finished, and it is now the map: every new game is made on the whole 896 x 896 county - Hollow Creek and Millbrook with Fairfield, Riverton, Kingsbury, Fort Hale, the prison, the airfield and the interstate round them - and the small 400 x 400 option is gone (games already started keep their map). Any of the six starting places can be picked on the New Game screen.',
      'The empty country between the towns now has the Starlite Drive-In (rows of speaker posts, the cars of the last show, the snack bar and projection booth), Riverton Cemetery, the Wildwood Lumber Co. sawmill on Route 9, a rest area on Interstate 71 and Pruitt Salvage - a yard of rusting, stripped cars.',
    ],
    commits: [], shots: ['v036000_1', 'v036000_2', 'v036000_3'],
  },
  {
    v: '000.035.000.178', date: '2026-10-30', title: 'Lived-in homes',
    notes: [
      'Homes, offices, diners, motels and the like have the odd thing left out on their furniture: a can or a packet of crisps on the kitchen table, a newspaper on a desk, a novel or painkillers on a nightstand, a soda on the counter. Pick them up like anything else on the floor.',
    ],
    commits: [], shots: [],
  },
  {
    v: '000.034.000.177', date: '2026-10-30', title: 'Marking the map',
    notes: [
      'Right-click the map to mark a place: a safehouse, medical supplies, loot, danger, fuel or a note, each in its own ink. Right-click a marker to take it away. Markers are kept with your save.',
      'The katana is drawn with its proper long two-handed grip again (a second, shorter model had quietly replaced it).',
    ],
    commits: [], shots: ['v034000_1'],
  },
  {
    v: '000.033.001.175', date: '2026-10-30', title: 'Death throes',
    notes: [
      'The dead no longer fling their arms straight out like a scarecrow as they fall: the arms go out and down from the shoulders, one thrown forward and the other back.',
      'Sitting down and getting up make a sound (a wooden chair creaks, a sofa rustles).',
    ],
    commits: [], shots: [],
  },
  {
    v: '000.033.000.174', date: '2026-10-30', title: 'A paper map, seats and crouching under windows',
    notes: [
      'The map is drawn like a paper road map: cream paper, white roads edged in grey, buildings in tan, green fields and woods, blue water, place names printed in ink; what you have not seen yet is faded.',
      'Sit / Rest on a chair, sofa, armchair, bench or pew now sits you on it, at its height and facing the way it faces; walk to stand up.',
      'Crouching (sneaking) keeps you below the window sills: the dead outside see you through a window only from close by.',
      'The crafting window shows what a recipe makes (with its picture and description), the time it takes, the skill it needs and the experience it gives, and marks what you can make now - with a count on each tab.',
    ],
    commits: [], shots: ['v033000_1', 'v033000_2'],
  },
  {
    v: '000.032.000.173', date: '2026-10-30', title: 'Ties, hi-vis and things on tables',
    notes: [
      'New clothes on the 3D characters: neckties (down the shirt front; under a jacket only the knot shows), scarves now shown wrapped round the neck, and hi-vis vests in yellow or orange with reflective bands. Some of the dead wear them: office workers in ties, road crews and builders in hi-vis and hard hats. Ties turn up in office desks and wardrobes, hi-vis vests in hardware stores and factory lockers.',
      'Place (inventory) now puts things on tables, counters, desks, nightstands, dressers, workbenches, crates and stoves, drawn on top at the right height; moved furniture leaves them on the floor.',
      'World textures: Half now also keeps the roofs at half resolution - a quarter of the memory for the town\'s roofs.',
    ],
    commits: [], shots: ['v032000_1', 'v032000_2'],
  },
  {
    v: '000.031.000.172', date: '2026-10-30', title: 'Kingsbury Mall',
    notes: [
      'A shopping mall in Kingsbury (Expanded map): a wide tiled concourse with benches, glass doors at both ends, and shops down both sides - clothes, sports, books, electronics, toys, a pharmacy and a food court - with a car park along the front. New loot for the sports, electronics and toy shops.',
      'Kingsbury now gets its factory too (Beacon Tool & Die); last version it ran out of room.',
    ],
    commits: [], shots: ['v031000_1'],
  },
  {
    v: '000.030.000.171', date: '2026-10-30', title: 'More music, better sounds and a factory',
    notes: [
      'Ten new pieces of music, with new instruments: a fingerpicked and strummed acoustic guitar, a solo cello and a celesta. A second title theme, two more day pieces, a second dusk piece, two more night pieces (one only celesta, one only drones and cello), a second rain piece, two winter pieces that play on cold days, and a second chase loop with heavy drums. Pieces no longer repeat back to back, and each chase picks a loop afresh.',
      'Better zombie voices: a softer, more human throat with an uneven, breathy rasp and a wet gurgle, instead of a buzzy synthesizer tone. More variations of groans and snarls.',
      'Better impacts and liquids: hits, wood, doors, zombies pounding on doors and breaking planks now ring with the body they hit; drinking is gulps instead of "bloops"; splashes and filling bottles bubble properly; flesh hits are wetter; coughs sound like coughs. Wooden floors now creak instead of squeak, and soles scuff on hard floors.',
      'A hoodie\'s hood goes up when you are out in the rain (if nothing else is on your head) and comes down indoors.',
      'A factory in Riverton (Expanded map): a shop floor full of machines (drill presses, lathes, stamping presses), workbenches and stock, offices, a locker room with work clothes and hard hats, a break room, and a loading yard.',
    ],
    commits: [], shots: ['v030000_1', 'v030000_2'],
  },
  {
    v: '000.029.001.170', date: '2026-10-30', title: 'Better doors',
    notes: ['Doors no longer sound like a cartoon: opening is the handle, the latch letting go and the door swinging, with now and then a short, raspy hinge creak; closing is the swing, the door meeting the frame with a solid wooden thud, and the latch catching. Windows, car hoods and falling trees use the new creak too.'],
    commits: [], shots: [],
  },
  {
    v: '000.029.000.169', date: '2026-10-30', title: 'Fully 3D, detail rings and a new soundtrack',
    notes: [
      'The characters are always 3D now: the old flat 2D figures are gone. In big crowds some zombies used to flicker between 2D and 3D when the 3D drawing space ran out; each ring of detail now draws at its own resolution, and nothing falls back to 2D.',
      'Detail comes in rings around you: full detail always within about 9 tiles however big the crowd, then simpler models drawn at lower resolution further out.',
      'A sound overhaul: every sound effect, ambience loop and piece of music is now a real .mp3 file in the audio folder, ready to be replaced with recordings one by one. New sounds: punchier gunshots with echoes, growling dead with real vocal formants, footsteps by surface, impacts, doors, glass, vehicles and more, most with several variations.',
      'New music: nine pieces for piano, strings, bass and pads, chosen by the time of day and the weather; the title theme on the menus, a tension loop that rises during a chase, and a sting when you die. Birdsong by day and crickets at night outdoors.',
    ],
    commits: [], shots: ['v029000_1', 'v029000_2'],
  },
  {
    v: '000.028.000.166', date: '2026-10-30', title: 'Holes, blood and a faster engine',
    notes: [
      'Chunks torn out of the dead are real holes now: cut through the body and everything worn over it, with torn flesh inside, ribs showing at High gore detail.',
      'Blood sprays onto walls, splashes with runs dripping down; walking through fresh blood leaves bloody footprints, yours and the dead\'s.',
      'A faster engine with big crowds: the dead share their path searches, fire and parked cars no longer cost anything when nothing is happening (a crowded game\'s simulation runs about 40% lighter).',
      'New clothes and looks: dresses, skirts and a trench coat, long coats that hang below the waist, hoodies with their hood; bun, bob and afro hair; beards (full, goatee, moustache), also in character creation.',
      'A body you carry shows over your shoulder, and the dying keep twitching a while after they land (burns, broken bones, blades, small calibre shots).',
      'The Expanded map: Kingsbury General Hospital, the Riverton Hotel and Kingsbury Motors; out in the country, abandoned camps, burnt-out wrecks, hay fields and old orchards.',
    ],
    commits: [], shots: ['v028000_1', 'v028000_2', 'v028000_3', 'v028000_4'],
  },
  {
    v: '000.027.002.161', date: '2026-10-27', title: 'Small fixes',
    notes: ['E lets go of a body you are dragging, and a hint says so the first time.', 'Boarded-up houses often hold the supplies of whoever holed up there: canned food, water, bandages, nails and planks.', 'The README lists the newest features.'],
    commits: [], shots: [],
  },
  {
    v: '000.027.000.159', date: '2026-10-27', title: 'Deaths, fighting free, bodies',
    notes: [
      'How the dead go down now depends on what killed them: cars by speed (knocked down, thrown, spun, launched, sent tumbling and sliding down the road), blunt and sharp blows from either side, the front or behind, an uppercut or from above, with one hand or two; large and small calibre gunshots by side; burning, stomping, punching and falls that break bones or splat. Your own falls and burns end the same way.',
      'Breaking a zombie\'s hold plays a fight-off move toward where it held you - bare-handed, with a one-handed or a two-handed weapon, two ways each.',
      'Tall fences have a second way to beat you, and one of the dead right behind can drag you back down off a tall or a low fence.',
      'Bodies can be dragged (four ways) and heaved over a fence or out of a window.',
      'Some houses are found boarded up, their windows and doors planked over.',
      'A loaded gun\'s menu has a Suicide option, confirmed first, with its own animation for pistols, rifles and shotguns.',
    ],
    commits: [], shots: [],
  },
  {
    v: '000.026.000.153', date: '2026-10-27', title: 'Gore chunks and the katana',
    notes: [
      'Blades, heavy blows, shotguns and cars can tear chunks out of the dead: a torn, dark hollow in the body that keeps bleeding for a while, drops running onto the floor.',
      'A new Gore detail setting (Settings > Display: Off, Very low, Low, Medium, High) sets how many chunks a body can take, how finely they are modelled - torn flesh round the rim from Medium, a glimpse of rib at High - and how long they bleed.',
      'The katana: a very rare two-handed blade, the best melee weapon in the county. Keep looking in wardrobes.',
    ],
    commits: [], shots: [],
  },
  {
    v: '000.025.003.151', date: '2026-10-27', title: 'A lighter title screen, live',
    notes: [
      'The town behind the menus is live again at full quality, but costs far less: its zombies walk routes planned once when the menu opens, with no thinking or collisions, and only what is on screen is drawn.',
      'The menus are locked to 30 frames a second. If a computer cannot keep 30, the background drops its resolution a step at a time (down to half) and climbs back when there is room.',
    ],
    commits: [], shots: [],
  },
  {
    v: '000.025.002.150', date: '2026-10-27', title: 'Settings tidy-up',
    notes: [
      'The frame rate counter (FPS or detailed) moved to Settings > Experimental, next to the Expanded map and the debug mode.',
    ],
    commits: [], shots: [],
  },
  {
    v: '000.025.001.149', date: '2026-10-27', title: 'Fairer grabs',
    notes: [
      'The dead take hold of you far less often: about a third of the time from the front and under half from behind, even less while you swing, back away or run. Backing off as one lunges now gets you clear.',
      'Once held you have longer before the first bite, bites come less often and get through less, and pulling away breaks the hold about twice as fast.',
    ],
    commits: ['f9c81e3'], shots: [],
  },
  {
    v: '000.025.000.147', date: '2026-10-27', title: 'Benchmark and a lighter title screen',
    notes: [
      'The town behind the title screen is now a recorded loop: the game films about ten seconds of it once, then plays that back, so the menus cost the computer almost nothing.',
      'Benchmark (Settings > Optimization, from the title screen): every quality preset, Low to Ultra, from a light load of 25 zombies on a clear day to an ultra heavy one of 900 in a night storm. It shows the frame rate, the slowest frames and the work per frame, and recommends a preset you can apply at once.',
      'Debug mode is back as an option: Settings > Experimental > Debug mode.',
      'Screenshots are back in the patch notes.',
    ],
    commits: ['3723ff8'], shots: ['v025000_1', 'v025000_2', 'v025000_3'],
  },
  {
    v: '000.024.001.145', date: '2026-10-27', title: 'Release polish',
    notes: [
      'The title screen shows the version in a cleaner form, with a What\'s new link to these patch notes.',
      'The debug tools are gone from the title screen and the pause menu; they are for development only.',
      'Clearer labels for the beta options: the Expanded map and the Experimental settings tab.',
      'A new README: getting started, features, controls and settings.',
    ],
    commits: ['dd1db65'], shots: ['v024001_1', 'v024001_2'],
  },
  {
    v: '000.024.000.143', date: '2026-10-27', title: 'Characters with textures',
    notes: [
      'The survivors and the dead are no longer plain plastic colours. Their clothes are painted with real cloth: faded denim with a seam down the leg, knitted sweaters, creased leather, quilted winter coats, fleece hoodies, twill work trousers.',
      'Some shirts are flannel plaid or striped, some sweaters striped, some cargo pants camouflage, and the military jacket is woodland camo. Patterned clothes have their own names (Flannel Shirt, Striped T-Shirt, Camo Cargo Pants).',
      'The dead look dead: grey skin with bruises, rot and veins, dark sunken eyes, blood run down from the mouth, grime worst toward the ground, and blood soaked into their clothes in patches instead of round dots. Stains and wounds have ragged edges. Your own face grows stubble over the first days.',
      'Better proportions: a slightly bigger head, hands and feet, a shorter, thicker neck and thicker arms. Hair no longer pokes through caps.',
    ],
    commits: ['1cbcc45'], shots: ['v024000_1', 'v024000_2', 'v024000_3'],
  },
  {
    v: '000.023.000.141', date: '2026-10-26', title: 'Sound and music',
    notes: [
      'New sounds, made in the game when the audio starts, with a few takes of each so they do not repeat exactly. Gunshots have a crack, a blast, a low thump and a rolling tail echoing off the houses, with a voice for each kind of gun. The dead moan and snarl in ragged, gurgling voices, male and female.',
      'Footsteps sound different on pavement, grass, gravel, wooden floors, carpet and snow. Blows land with a thud, a slice or a crunch, bodies hit the floor, doors creak and bang shut, and glass shatters with the shards ringing down.',
      'New music on a piano with soft strings under it: a title theme on the menus, and pieces for the day, dusk, night and rain that follow the hour and the weather, now and then, never while you are being chased.',
    ],
    commits: ['3d8f682'], shots: ['v023000_1', 'v023000_2', 'v023000_3'],
  },
  {
    v: '000.022.000.139', date: '2026-10-26', title: 'Fences and guns',
    notes: [
      'Running or sprinting into a low fence, you hop it without stopping. Sprint into it and you may trip and go down flat on your face.',
      'Tall fences have their own climb, and they can beat you: unfit, worn out, carrying a lot or hurt in the arms, you may slip back off on your side.',
      'Shouting (Q) has its animation: hands cupped round the mouth.',
      'Magazines: the 9mm, the M1911, the assault rifle and the varmint rifle take magazines you fill round by round. R swaps in your fullest spare (the old one goes in your pocket with what was left in it), or fills the one in the gun from loose rounds. Eject or insert magazines from the gun\'s menu, load or empty them from theirs.',
      'The pump and the bolt are worked after every shot, and an empty self-loader is racked after it is reloaded. A worn gun can jam: it clicks until you clear it with R. The assault rifle switches between full auto and semi-auto from its menu. The hand slots show the rounds in the gun, the loose rounds and spare magazines.',
      'Five more guns: the M1911 (.45), the .357 Magnum, a double-barrel shotgun (two quick shots), a sawed-off shotgun (saw down a double-barrel) and a varmint rifle (.223, bolt action), with their ammunition, in gun stores, police lockers, homes, cabins and barns.',
    ],
    commits: ['bcb4d43'], shots: ['v022000_1', 'v022000_2', 'v022000_3'],
  },
  {
    v: '000.021.000.137', date: '2026-10-26', title: 'Foliage and items on the floor',
    notes: [
      'Tall grass, weeds and wildflowers grow where nobody kept the grass: along the country roads, in the empty lots of town, round the fields, along fences and in meadow patches. Cattails stand at the water\'s edge and wild shrubs, some with berries, grow among it. Mowed yards stay mowed.',
      'Under it, the ground has clover, dandelions, tufts and dry patches, leaf litter in the woods and weeds coming up through cracks in the pavement.',
      'It all turns with the seasons: fresh green in spring, seed heads in summer, gold in autumn, dry straw and snow in winter. Wheels press it flat, you can clear it by hand, and building, digging or putting something down clears it too. New games only: a saved game keeps its map.',
      'Items on the floor lie at their real size and at their own angle (a rifle a metre long, a can a hand high), cans and bottles standing, with a shadow, and darkened at night. Place, in an item\'s menu, puts it down exactly where you point: R or the mouse wheel turns it. Right-click an item on the floor to pick up just that one or turn it.',
    ],
    commits: ['ec8583a'], shots: ['v021000_1', 'v021000_2', 'v021000_3', 'v021000_4'],
  },
  {
    v: '000.020.001.135', date: '2026-10-25', title: 'Seeing through the trees',
    notes: [
      'Driving through the woods you can see the road. The see-through window in the tree crowns used to be a small circle round you, so in a car it showed little more than the car, and the road ahead stayed under the canopy. Now it runs ahead along the way the car is going, from a little way ahead when stopped to about eight tiles at speed, and trees open almost at once as you come up to them.',
      'Driving, the view leads the car by up to five tiles as it speeds up, so more of the road ahead is on screen.',
      'On foot the window round you is wider, and every zombie you can see gets a small window of its own in any crown over it: the dead in the woods are no longer hidden a few tiles away.',
    ],
    commits: ['61e1f4e'], shots: ['v020001_1', 'v020001_2', 'v020001_3', 'v020001_4'],
  },
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
      'Item tooltips: the item\'s kind, then rows of stats, with a coloured bar for anything that runs down (condition, ammo, contents, fuel, battery, uses left, freshness, clothing protection). The hand slots on the left bar show the same tooltip.',
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
    v: '000.018.000.122', date: '2026-10-25', title: 'A new interface',
    notes: [
      'The interface is restyled: black glass panels with thin light frames, white text and grey highlights in place of the brown and gold, text a step bigger, and the windows with a new title bar (close at the left, the title in the middle, a collapse button at the right that folds the window to its title bar).',
      'What you hold sits at the top of the left bar, above the window buttons. The clock is your wristwatch\'s display (date, time, temperature); without a watch you only have a rough idea of the time of day. The game speed buttons sit under it.',
      'Health and character are one Character window with four tabs: Info (your survivor, carrying weight, hunger, thirst, fatigue, exercise), Skills, Health and a new Protection tab that shows, for every part of the body, how likely your clothes stop a bite or a scratch and what you have on there. H opens it on Health, K on Info.',
      'The Health tab has a proper body figure: wounds tint the part they are on, bandages wrap round it, fractures crack it and bleeding drips.',
      'The title screen, the pause menu and the death screen are plain words down the side or in the middle. Objects under the mouse are outlined in white.',
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
      'A debug mode for development: cheats, spawners, time and weather controls and world overlays.',
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
    v: '000.008.001.034', date: '2026-10-06', title: 'New inventory and hotbar',
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
      'A radial menu on V: car controls inside and beside a car, plus quick actions on foot.',
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
      'Status effects, body-part health and infection, inventory and containers, melee and firearms, crafting, building, farming, fishing and foraging.',
      'Vehicles, weather, power and water shutoff, the helicopter event, procedural audio and music, character creation and saves.',
    ],
    commits: ['d53e6df', '2780def'], shots: ['v010_1', 'v010_2', 'v010_3', 'v010_4'],
  },
];
const VERSION = VERSION_LOG[0].v;

const Versions = {
  // title screen: called by Menu.show before it writes the screen, so mount right after
  mountHome() { Promise.resolve().then(() => this.mount()); },
  // "000.024.001.145" -> "v0.24.1"; the build number on its own
  label(v) { return 'v' + v.split('.').slice(0, 3).map(Number).join('.'); },
  build(v) { return Number(v.split('.')[3]); },
  dev() { return typeof Debug !== 'undefined' && Debug.dev; },
  mount() {
    const box = document.querySelector('#menu .modal.title');
    if (!box || box.querySelector('.ver-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'ver-bar';
    bar.innerHTML = `<span class="ver-help" id="vhelp">What's new</span><span class="ver-label">${this.label(VERSION)} · build ${this.build(VERSION)}</span>`;
    bar.addEventListener('click', (e) => { e.stopPropagation(); if (e.target.closest('.ver-help')) this.open(); });
    box.appendChild(bar);
  },
  // patch notes window (development builds add the screenshots and commits)
  open() {
    if (document.getElementById('verwin')) return;
    const el = document.createElement('div');
    el.id = 'verwin';
    const dev = this.dev();
    const shot = (s, k, e) => `<img class="ver-shot" src="versions/${s}.jpg" loading="lazy" data-v="${k}" data-i="${e}" alt="">`;
    el.innerHTML = `<div class="ver-box"><div class="ver-head"><div><div class="ver-title">What's new</div>
      <div class="ver-sub">Hollow Creek ${this.label(VERSION)} · build ${this.build(VERSION)}</div></div>
      <span class="ver-x" title="Close (Esc)">×</span></div><div class="ver-list">`
      + VERSION_LOG.map((r, k) => `<div class="ver-item ${k ? '' : 'cur'}"><div class="ver-line"><span class="ver-v">${this.label(r.v)}</span><span class="ver-name">${U.esc(r.title)}</span><span class="ver-date">${this.date(r.date)}</span></div>
        <ul>${r.notes.map(n => `<li>${U.esc(n)}</li>`).join('')}</ul>
        ${r.shots.length ? `<div class="ver-shots">${r.shots.map((s, i) => shot(s, k, i)).join('')}</div>` : ''}
        ${dev ? `<div class="ver-commits"><span>${r.v}</span>${r.commits.map(c => `<code>${c}</code>`).join('')}</div>` : ''}</div>`).join('')
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
    lb.innerHTML = `<span class="ver-nav prev" data-d="-1">‹</span><figure><img src="versions/${r.shots[i]}.jpg" alt=""><figcaption><b>${this.label(r.v)}</b> ${U.esc(r.title)} · ${i + 1} / ${r.shots.length}</figcaption></figure><span class="ver-nav next" data-d="1">›</span>`;
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
