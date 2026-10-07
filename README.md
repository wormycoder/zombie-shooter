# Hollow Creek

An isometric zombie survival sandbox in the spirit of Project Zomboid, written in plain JavaScript + Canvas.
All graphics and audio are generated procedurally at runtime — there are no asset files.

**Play:** open `index.html` in a modern browser (or serve the folder with any static server).

## Features
- Procedurally generated county (400×400 tiles): the town of Hollow Creek and the village of Millbrook joined by highway and back roads, houses with real floor plans (some with an upstairs), stores, clinic, police and fire stations, school, churches, motel, gas stations, warehouses, a trailer park, two farms, remote cabins, a lake, forests and military roadblocks
- Two-storey houses with stairs: zombies follow you up, you can smash the stairs, tie a sheet rope to a window or jump out, and shoot or throw from upstairs windows
- Isometric renderer with wall cut-aways, roofs, vision cone & line-of-sight fog, day/night cycle, street lights, flashlights, headlights, rain, fog and storms
- Animated 3D survivors and zombies (simple box-built models drawn with WebGL): walk and run cycles, melee swings, aiming, shoving, crawling, falling and lying bodies, clothes, hair, hats, bags and held weapons; flat 2D figures when WebGL or a GPU is not available
- Spreading fire: molotovs, gasoline, stoves and campfires start fires that spread through grass, forests and wooden houses, burn down roofs and collapse upper floors; zombies catch fire; fight it with water or extinguishers
- Seasons: pick a start month — autumn foliage, bare winter trees, snow cover and snowfall, shorter winter days, cold unheated houses, frost that kills crops
- Zombies that see and hear, shamble, lunge, thump doors, smash and climb through windows, climb fences, get knocked down, crawl, and play dead
- Moodles (hunger, thirst, fatigue, panic, stress, boredom, pain, bleeding, sickness, wetness, temperature...), body-part injuries incl. fractures & splints, infection and reanimation
- Project Zomboid-style inventory: player and loot windows with container buttons down the side, sortable Type / Category / Weight columns, collapsible stacks, multi-select (Ctrl / Shift + click), markers for held, worn, hotbar and favorite items, Loot all / Transfer all, drag & drop between containers, onto the hotbar or onto the world to drop; weight, bags, timed actions; loot tables per room/store type
- Hotbar built from what you wear: a long weapon slung on your back, two belt slots for small weapons, tools and a flashlight, a holster for a pistol; number keys draw and put away, and the gear shows on your 3D character
- Melee & firearms, shoving & stomping, weapon durability, skills & XP, skill books, occupations & traits
- Barricading, carpentry & building, moving furniture (pick up beds, shelves, fridges... and place them with rotation), crafting, cooking, farming, foraging, fishing, trapping (trap boxes & snares), generators, rain barrels
- Detailed towns: house facades (clapboard, vinyl, brick, stucco, log, metal siding, trim, shutters, window boxes, porch lanterns, house numbers), shingled and metal roofs with chimneys, antennas and snow, store fronts with awnings and neon signs; streets with power lines, traffic lights, stop and street-name signs, hydrants, bus stops, payphones, newspaper boxes, gas station canopies, parking lots, abandoned traffic jams and roadblocks
- Lived-in yards shaped by who lived there (tidy, family, elderly, gardener, handyman, messy, rural): porches with rocking chairs, flower beds, hedges, garden lights, mowing stripes, patios and decks with umbrella tables, barbecues, fire pits, vegetable rows you can harvest, sheds to loot, back-yard fences with gates, swing sets, trampolines, kiddie pools, clotheslines, doghouses, woodpiles, compost bins, rain barrels, lawn ornaments, junk piles; cabins with outhouses and farms with chicken coops; everything changes with the seasons
- Drivable cars (sedans, hatchbacks, wagons, sports cars, SUVs, pickups, vans, taxis, police cars, ambulances, fire trucks, school buses, military trucks) with detailed models, damage states, working head/tail/brake lights and light bars; keys, hotwiring, fuel, trunks, alarms, crash damage; sirens that lure every zombie for miles
- Driving model with tire grip and traction: skids, wet roads, snow, grass and gravel, gears, engine quality that varies car to car, part damage (engine, tires, brakes, suspension, battery...) with mechanics repairs, and a dashboard HUD (speedometer, tachometer, gear, fuel, engine and battery gauges, warning lights)
- Radial menu (V): vehicle controls inside or next to a car, quick actions on foot
- Power & water shut-off, helicopter event, distant meta events, TV & radio broadcasts
- Sandbox settings: zombie population, shamblers / fast shamblers / sprinters, day length, loot rarity, utility shutoff, start time, start month, fire spread, infection transmission, zombie toughness, door-opening zombies, house and car alarm frequency
- Settings screen with Display / Performance / Audio / Controls tabs and Low / Medium / High / Ultra presets: render resolution, frame-rate cap, world detail, particles, rain & snow, 3D characters, frame-rate counter (FPS or detailed timings), lighting updates per second (5-60), UI refresh rate (10-60), lazy zombie updates and adaptive zombie physics for big crowds, lazy chunk updates (16x16-tile chunks 6+ away run at half speed, 12+ away pause); cached ground chunks and trimmed sprites keep frames light
- Save/load (permadeath)

## Controls
WASD move · Shift run · Alt/X sprint · C sneak · hold Right mouse aim · Left click attack · Space shove/stomp · R reload · 1-4 hotbar ·
Right-click (tap) context menu · E interact · F flashlight · Q shout · V radial menu · I inventory · H health · B crafting · K skills · M map · Esc menu
