'use strict';
// ---------------------------------------------------------------------------
// Skills, occupations & traits
// ---------------------------------------------------------------------------
const SKILL_NAMES = {
  Fitness: 'Fitness', Strength: 'Strength',
  Sprinting: 'Sprinting', Lightfooted: 'Lightfooted', Nimble: 'Nimble', Sneaking: 'Sneaking',
  Axe: 'Axe', LongBlunt: 'Long Blunt', ShortBlunt: 'Short Blunt', LongBlade: 'Long Blade', ShortBlade: 'Short Blade', Spear: 'Spear', Maintenance: 'Maintenance',
  Aiming: 'Aiming', Reloading: 'Reloading',
  Carpentry: 'Carpentry', Cooking: 'Cooking', Farming: 'Farming', FirstAid: 'First Aid', Electrical: 'Electrical', Mechanics: 'Mechanics',
  Fishing: 'Fishing', Foraging: 'Foraging', Trapping: 'Trapping',
};
const SKILL_GROUPS = [
  ['Passive', ['Fitness', 'Strength']],
  ['Agility', ['Sprinting', 'Lightfooted', 'Nimble', 'Sneaking']],
  ['Combat', ['Axe', 'LongBlunt', 'ShortBlunt', 'LongBlade', 'ShortBlade', 'Spear', 'Maintenance']],
  ['Firearm', ['Aiming', 'Reloading']],
  ['Crafting', ['Carpentry', 'Cooking', 'Farming', 'FirstAid', 'Electrical', 'Mechanics']],
  ['Survivalist', ['Fishing', 'Foraging', 'Trapping']],
];
// xp needed to go from level i to i+1
const XP_TABLE = [75, 150, 300, 750, 1500, 3000, 4500, 6000, 7500, 9000];
const XP_TABLE_PASSIVE = [1500, 3000, 6000, 9000, 18000, 30000, 60000, 90000, 120000, 150000];

const OCCUPATIONS = [
  { id: 'unemployed', n: 'Unemployed', pts: 8, sk: {}, desc: 'No particular skills, but plenty of points to spend on traits.' },
  { id: 'police', n: 'Police Officer', pts: -4, sk: { Aiming: 3, Reloading: 2, Nimble: 1 }, gear: ['PoliceShirt', 'PolicePants', 'Boots', 'PoliceCap'], desc: 'Trained with firearms.' },
  { id: 'fireofficer', n: 'Fire Officer', pts: 0, sk: { Axe: 1, Fitness: 1, Sprinting: 1, Strength: 1 }, desc: 'Fit, strong and handy with an axe.' },
  { id: 'ranger', n: 'Park Ranger', pts: -4, sk: { Axe: 1, Carpentry: 1, Foraging: 2 }, desc: 'Knows the woods.' },
  { id: 'construction', n: 'Construction Worker', pts: -2, sk: { ShortBlunt: 3, Carpentry: 1 }, gear: ['HardHat', 'Boots'], desc: 'Swings a hammer like nobody else.' },
  { id: 'security', n: 'Security Guard', pts: -2, sk: { Sprinting: 2, Lightfooted: 1 }, traits: ['nightowl'], desc: 'Used to night shifts.' },
  { id: 'carpenter', n: 'Carpenter', pts: 2, sk: { Carpentry: 3, ShortBlunt: 1 }, desc: 'Builds strong barricades.' },
  { id: 'burglar', n: 'Burglar', pts: -6, sk: { Nimble: 2, Sneaking: 2, Lightfooted: 2 }, traits: ['burglar'], desc: 'Can hotwire cars. Quiet and quick.' },
  { id: 'chef', n: 'Chef', pts: -4, sk: { Cooking: 3, Maintenance: 1, ShortBlade: 1 }, desc: 'Excellent cook.' },
  { id: 'repairman', n: 'Repairman', pts: -4, sk: { Carpentry: 1, Maintenance: 2, ShortBlunt: 1 }, desc: 'Keeps weapons in good shape.' },
  { id: 'farmer', n: 'Farmer', pts: 2, sk: { Farming: 3 }, desc: 'Green thumbs.' },
  { id: 'fisherman', n: 'Fisherman', pts: -2, sk: { Fishing: 3, Foraging: 1 }, desc: 'Lives off the water.' },
  { id: 'doctor', n: 'Doctor', pts: 2, sk: { FirstAid: 3, ShortBlade: 1 }, desc: 'Skilled in first aid.' },
  { id: 'nurse', n: 'Nurse', pts: 2, sk: { FirstAid: 2, Lightfooted: 1 }, desc: 'Medical training.' },
  { id: 'veteran', n: 'Veteran', pts: -8, sk: { Aiming: 2, Reloading: 2 }, traits: ['desensitized'], desc: 'Has seen it all. Never panics.' },
  { id: 'lumberjack', n: 'Lumberjack', pts: 0, sk: { Axe: 2, Strength: 1 }, traits: ['axeman'], desc: 'Chops faster with axes.' },
  { id: 'fitness', n: 'Fitness Instructor', pts: -6, sk: { Fitness: 3, Sprinting: 2 }, desc: 'Peak cardiovascular health.' },
  { id: 'burger', n: 'Burger Flipper', pts: 2, sk: { Cooking: 2, Maintenance: 1 }, desc: 'Knows a kitchen.' },
  { id: 'electrician', n: 'Electrician', pts: -4, sk: { Electrical: 3 }, desc: 'Can hook up generators and hotwire.' },
  { id: 'mechanic', n: 'Mechanic', pts: -4, sk: { Mechanics: 3, ShortBlunt: 1 }, desc: 'Understands vehicles.' },
];

// cost: negative for positive traits (spends points), positive for negative traits (gives points)
const TRAITS = [
  // positive
  { id: 'strong', n: 'Strong', cost: -10, sk: { Strength: 4 }, ex: ['stout', 'weak', 'feeble'], desc: '+4 Strength. Extra knockback and carry weight.' },
  { id: 'stout', n: 'Stout', cost: -6, sk: { Strength: 2 }, ex: ['strong', 'weak', 'feeble'], desc: '+2 Strength.' },
  { id: 'athletic', n: 'Athletic', cost: -10, sk: { Fitness: 4 }, ex: ['fit', 'unfit', 'outofshape', 'overweight', 'obese'], desc: '+4 Fitness. Runs faster and longer.' },
  { id: 'fit', n: 'Fit', cost: -6, sk: { Fitness: 2 }, ex: ['athletic', 'unfit', 'outofshape', 'obese'], desc: '+2 Fitness.' },
  { id: 'fastlearner', n: 'Fast Learner', cost: -6, ex: ['slowlearner'], desc: 'Increased XP gain.' },
  { id: 'brave', n: 'Brave', cost: -4, ex: ['cowardly'], desc: 'Less prone to panic.' },
  { id: 'lucky', n: 'Lucky', cost: -4, ex: ['unlucky'], desc: 'Finds more loot. Things go right more often.' },
  { id: 'keenhearing', n: 'Keen Hearing', cost: -6, ex: ['hardofhearing'], desc: 'Larger perception radius.' },
  { id: 'eagleeyed', n: 'Eagle Eyed', cost: -6, ex: ['shortsighted'], desc: 'Wider field of view.' },
  { id: 'catseyes', n: "Cat's Eyes", cost: -2, desc: 'Better vision at night.' },
  { id: 'lighteater', n: 'Light Eater', cost: -4, ex: ['heartyappetite'], desc: 'Needs to eat less.' },
  { id: 'lowthirst', n: 'Low Thirst', cost: -6, ex: ['highthirst'], desc: 'Needs to drink less.' },
  { id: 'fasthealer', n: 'Fast Healer', cost: -6, ex: ['slowhealer'], desc: 'Wounds heal faster.' },
  { id: 'thickskinned', n: 'Thick Skinned', cost: -8, ex: ['thinskinned'], desc: 'Less likely to be scratched or bitten.' },
  { id: 'graceful', n: 'Graceful', cost: -4, ex: ['clumsy'], desc: 'Makes less noise when moving.' },
  { id: 'inconspicuous', n: 'Inconspicuous', cost: -4, ex: ['conspicuous'], desc: 'Less likely to be spotted by zombies.' },
  { id: 'organized', n: 'Organized', cost: -6, ex: ['disorganized'], desc: '+30% container capacity.' },
  { id: 'wakeful', n: 'Wakeful', cost: -2, ex: ['sleepyhead'], desc: 'Needs less sleep.' },
  { id: 'dextrous', n: 'Dextrous', cost: -2, ex: ['allthumbs'], desc: 'Transfers items faster.' },
  { id: 'outdoorsman', n: 'Outdoorsman', cost: -2, sk: { Foraging: 1 }, desc: 'Unaffected by harsh weather. Better forager.' },
  { id: 'irongut', n: 'Iron Gut', cost: -3, ex: ['weakstomach'], desc: 'Less chance of food sickness.' },
  { id: 'adrenaline', n: 'Adrenaline Junkie', cost: -8, desc: 'Moves faster when panicking.' },
  { id: 'handy', n: 'Handy', cost: -8, sk: { Carpentry: 1, Maintenance: 1 }, desc: 'Faster and stronger constructions.' },
  { id: 'gymnast', n: 'Gymnast', cost: -5, sk: { Lightfooted: 1, Nimble: 1 }, desc: '+1 Lightfooted, +1 Nimble.' },
  { id: 'firstaider', n: 'First Aider', cost: -4, sk: { FirstAid: 1 }, desc: '+1 First Aid.' },
  { id: 'gardener', n: 'Gardener', cost: -4, sk: { Farming: 1 }, desc: '+1 Farming.' },
  { id: 'angler', n: 'Angler', cost: -4, sk: { Fishing: 1 }, desc: '+1 Fishing.' },
  { id: 'brawler', n: 'Brawler', cost: -6, sk: { Axe: 1, LongBlunt: 1 }, desc: '+1 Axe, +1 Long Blunt.' },
  { id: 'hunter', n: 'Hunter', cost: -8, sk: { Aiming: 1, ShortBlade: 1, Sneaking: 1 }, desc: '+1 Aiming, +1 Short Blade, +1 Sneaking.' },
  // negative
  { id: 'weak', n: 'Weak', cost: 10, sk: { Strength: -5 }, ex: ['strong', 'stout', 'feeble'], desc: '-5 Strength.' },
  { id: 'feeble', n: 'Feeble', cost: 6, sk: { Strength: -2 }, ex: ['strong', 'stout', 'weak'], desc: '-2 Strength.' },
  { id: 'unfit', n: 'Unfit', cost: 10, sk: { Fitness: -5 }, ex: ['athletic', 'fit', 'outofshape'], desc: '-5 Fitness.' },
  { id: 'outofshape', n: 'Out of Shape', cost: 6, sk: { Fitness: -2 }, ex: ['athletic', 'fit', 'unfit'], desc: '-2 Fitness.' },
  { id: 'overweight', n: 'Overweight', cost: 6, sk: { Fitness: -1 }, ex: ['athletic', 'obese'], desc: 'Tires faster, slower.' },
  { id: 'obese', n: 'Obese', cost: 10, sk: { Fitness: -2 }, ex: ['athletic', 'fit', 'overweight'], desc: 'Tires much faster, slower.' },
  { id: 'slowlearner', n: 'Slow Learner', cost: 6, ex: ['fastlearner'], desc: 'Reduced XP gain.' },
  { id: 'cowardly', n: 'Cowardly', cost: 2, ex: ['brave'], desc: 'Panics easily.' },
  { id: 'unlucky', n: 'Unlucky', cost: 4, ex: ['lucky'], desc: 'Finds less loot. Things go wrong.' },
  { id: 'hardofhearing', n: 'Hard of Hearing', cost: 4, ex: ['keenhearing'], desc: 'Smaller perception radius.' },
  { id: 'shortsighted', n: 'Short Sighted', cost: 2, ex: ['eagleeyed'], desc: 'Reduced view distance (glasses help).' },
  { id: 'clumsy', n: 'Clumsy', cost: 2, ex: ['graceful'], desc: 'Makes more noise when moving.' },
  { id: 'conspicuous', n: 'Conspicuous', cost: 4, ex: ['inconspicuous'], desc: 'More likely to be spotted by zombies.' },
  { id: 'disorganized', n: 'Disorganized', cost: 4, ex: ['organized'], desc: '-30% container capacity.' },
  { id: 'heartyappetite', n: 'Hearty Appetite', cost: 4, ex: ['lighteater'], desc: 'Needs to eat more.' },
  { id: 'highthirst', n: 'High Thirst', cost: 6, ex: ['lowthirst'], desc: 'Needs to drink more.' },
  { id: 'slowhealer', n: 'Slow Healer', cost: 6, ex: ['fasthealer'], desc: 'Wounds heal slowly.' },
  { id: 'proneillness', n: 'Prone to Illness', cost: 4, desc: 'More likely to catch a cold, faster zombification.' },
  { id: 'thinskinned', n: 'Thin-skinned', cost: 8, ex: ['thickskinned'], desc: 'More likely to be scratched or bitten.' },
  { id: 'sleepyhead', n: 'Sleepyhead', cost: 4, ex: ['wakeful'], desc: 'Needs more sleep.' },
  { id: 'restless', n: 'Restless Sleeper', cost: 6, desc: 'Sleep is less effective.' },
  { id: 'pacifist', n: 'Pacifist', cost: 4, desc: 'Less XP from combat.' },
  { id: 'weakstomach', n: 'Weak Stomach', cost: 3, ex: ['irongut'], desc: 'Higher chance of food sickness.' },
  { id: 'hemophobic', n: 'Hemophobic', cost: 5, desc: 'Panics at the sight of blood; slow to bandage.' },
  { id: 'illiterate', n: 'Illiterate', cost: 8, desc: 'Cannot read books.' },
  { id: 'agoraphobic', n: 'Agoraphobic', cost: 4, ex: ['claustrophobic'], desc: 'Panics outdoors.' },
  { id: 'claustrophobic', n: 'Claustrophobic', cost: 4, ex: ['agoraphobic'], desc: 'Panics indoors.' },
  { id: 'asthmatic', n: 'Asthmatic', cost: 5, desc: 'Endurance drains faster.' },
  { id: 'smoker', n: 'Smoker', cost: 2, desc: 'Gets stressed without cigarettes.' },
  { id: 'allthumbs', n: 'All Thumbs', cost: 2, ex: ['dextrous'], desc: 'Transfers items slowly.' },
];
// hidden occupation traits
const HIDDEN_TRAITS = {
  nightowl: { n: 'Night Owl', desc: 'Needs little sleep and recovers quickly.' },
  burglar: { n: 'Burglar', desc: 'Can hotwire vehicles.' },
  desensitized: { n: 'Desensitized', desc: 'Never panics.' },
  axeman: { n: 'Axe Man', desc: 'Swings axes faster. Chops trees faster.' },
};
function traitDef(id) { return TRAITS.find(t => t.id === id) || HIDDEN_TRAITS[id]; }

const SKIN_TONES = ['#f2d0b0', '#e8bf98', '#d8a878', '#b88058', '#8a5a3a', '#5e3a24'];
const HAIR_COLS = ['#1a1410', '#3a2a1a', '#6a4a2a', '#a07040', '#d8b060', '#8a3a1a', '#c8c8c8', '#504840'];
const HAIR_STYLES = ['short', 'buzz', 'long', 'ponytail', 'bald', 'messy'];
const FIRST_NAMES = ['Tom', 'Jake', 'Rick', 'Dale', 'Bill', 'Sam', 'Kate', 'Marie', 'Lisa', 'Anne', 'Joe', 'Wes', 'Mona', 'Nora', 'Pete', 'Ray', 'Dee', 'Cole', 'Lena', 'Ruth', 'Hank', 'Jill', 'Owen', 'Fay'];
const LAST_NAMES = ['Miller', 'Turner', 'Baker', 'Shaw', 'Hale', 'Price', 'Boyd', 'Grant', 'Walsh', 'Pike', 'Reed', 'Stone', 'Cobb', 'Hayes', 'Lowe', 'Banks', 'Frost', 'Wade', 'Kerr', 'Dunn'];
