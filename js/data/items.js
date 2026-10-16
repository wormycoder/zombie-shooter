'use strict';
// ---------------------------------------------------------------------------
// Item definitions
// ---------------------------------------------------------------------------
const ITEMS = {};
function idef(id, o) { o.id = id; o.tags = o.tags || []; ITEMS[id] = o; return o; }

// ----- FOOD ---------------------------------------------------------------
// hunger: amount of hunger removed (0..1). thirst: thirst removed (negative = makes thirsty)
// fresh/rot: days until stale / rotten (undefined = never spoils)
const F = (id, n, w, ic, o) => idef(id, Object.assign({ n, cat: 'Food', w, ic }, o));
F('CannedBeans', 'Canned Beans', 0.6, ['can', '#b4432f', '#e8d9a8'], { hunger: 0.2, open: true });
F('CannedSoup', 'Canned Soup', 0.6, ['can', '#c23a2b', '#f0f0f0'], { hunger: 0.16, thirst: 0.08, open: true });
F('CannedCorn', 'Canned Corn', 0.6, ['can', '#e2b62b', '#2f7a3a'], { hunger: 0.14, open: true });
F('CannedPeas', 'Canned Peas', 0.6, ['can', '#5b9a3a', '#f0f0f0'], { hunger: 0.12, open: true });
F('CannedTuna', 'Canned Tuna', 0.3, ['tin', '#3a6fb0', '#ddd'], { hunger: 0.15, open: true });
F('CannedChili', 'Canned Chili', 0.6, ['can', '#7a2a1a', '#e5a23a'], { hunger: 0.22, thirst: -0.04, open: true });
F('CannedPeaches', 'Canned Peaches', 0.6, ['can', '#f0a050', '#fff3d0'], { hunger: 0.12, thirst: 0.06, unhappy: -8, open: true });
F('CannedCarrots', 'Canned Carrots', 0.6, ['can', '#e07020', '#2f7a3a'], { hunger: 0.12, open: true });
F('DogFood', 'Dog Food', 0.6, ['can', '#8a6a3a', '#c33'], { hunger: 0.22, unhappy: 25, bored: 10, open: true });
F('Crisps', 'Potato Chips', 0.2, ['chips', '#d8402a', '#f2d06b'], { hunger: 0.08, thirst: -0.06, unhappy: -5 });
F('Chocolate', 'Chocolate Bar', 0.1, ['bar', '#5a3218', '#c9a36a'], { hunger: 0.07, unhappy: -10, bored: -5 });
F('CandyBar', 'Candy Bar', 0.1, ['bar', '#c0302a', '#f5e050'], { hunger: 0.06, unhappy: -8, bored: -5 });
F('Crackers', 'Crackers', 0.3, ['box', '#d8a040', '#c33'], { hunger: 0.1, thirst: -0.05 });
F('Cereal', 'Cereal', 0.5, ['box', '#3a7fd0', '#f5d040'], { hunger: 0.14 });
F('PeanutButter', 'Peanut Butter', 0.8, ['jar', '#b07a3a', '#c33'], { hunger: 0.3, thirst: -0.06 });
F('GranolaBar', 'Granola Bar', 0.1, ['bar', '#c8a060', '#3a8a3a'], { hunger: 0.06 });
F('Honey', 'Honey', 0.5, ['jar', '#e8a020', '#fff'], { hunger: 0.12, unhappy: -5 });
F('Pickles', 'Jar of Pickles', 0.8, ['jar', '#6a9a3a', '#ddd'], { hunger: 0.1 });
F('Bread', 'Bread', 0.4, ['bread', '#d39a52', '#f0d8a0'], { hunger: 0.18, fresh: 3, rot: 6 });
F('Cheese', 'Cheese', 0.3, ['cheese', '#f2c94c', '#e0a930'], { hunger: 0.12, fresh: 6, rot: 12 });
F('Apple', 'Apple', 0.2, ['fruit', '#c8241a', '#4a8a2a'], { hunger: 0.06, thirst: 0.04, fresh: 5, rot: 10 });
F('Banana', 'Banana', 0.2, ['banana', '#f2d23a', '#7a5a1a'], { hunger: 0.07, fresh: 3, rot: 6 });
F('Orange', 'Orange', 0.2, ['fruit', '#f08a1a', '#4a8a2a'], { hunger: 0.06, thirst: 0.06, fresh: 5, rot: 10 });
F('Lettuce', 'Lettuce', 0.3, ['leaf', '#7ac04a', '#4a9a2a'], { hunger: 0.05, fresh: 3, rot: 5 });
F('Cabbage', 'Cabbage', 0.5, ['leaf', '#9ad06a', '#5aa03a'], { hunger: 0.1, fresh: 6, rot: 12 });
F('Carrots', 'Carrots', 0.2, ['carrot', '#f07a1a', '#3a9a2a'], { hunger: 0.07, fresh: 6, rot: 12 });
F('Potato', 'Potato', 0.3, ['fruit', '#b8915a', '#8a6a3a'], { hunger: 0.06, fresh: 10, rot: 20, cook: 30, cookBonus: 0.08 });
F('Tomato', 'Tomato', 0.2, ['fruit', '#e0301a', '#3a8a2a'], { hunger: 0.05, thirst: 0.05, fresh: 4, rot: 8 });
F('Egg', 'Egg', 0.1, ['egg', '#f4ead8', '#d9c9a8'], { hunger: 0.06, fresh: 8, rot: 16, raw: true, cook: 6 });
F('Steak', 'Steak', 0.4, ['meat', '#b0303a', '#f0c0c0'], { hunger: 0.18, fresh: 2, rot: 4, raw: true, cook: 20, cookBonus: 0.12 });
F('Chicken', 'Chicken', 0.5, ['meat', '#f0b0a0', '#fff0e8'], { hunger: 0.16, fresh: 2, rot: 4, raw: true, cook: 25, cookBonus: 0.1 });
F('GroundBeef', 'Ground Beef', 0.4, ['meat', '#c04050', '#e8a0a8'], { hunger: 0.14, fresh: 2, rot: 4, raw: true, cook: 15, cookBonus: 0.1 });
F('Fish', 'Fish Fillet', 0.4, ['fish', '#9ab0c0', '#e0e8f0'], { hunger: 0.12, fresh: 2, rot: 4, raw: true, cook: 15, cookBonus: 0.1 });
F('Sausage', 'Sausages', 0.3, ['meat', '#c06048', '#e0a080'], { hunger: 0.12, fresh: 4, rot: 8, raw: true, cook: 12, cookBonus: 0.06 });
F('FrozenPizza', 'Frozen Pizza', 0.6, ['pizza', '#e0b060', '#c03020'], { hunger: 0.12, fresh: 2, rot: 4, raw: true, cook: 20, cookBonus: 0.3, unhappy: -5 });
F('IceCream', 'Ice Cream', 0.5, ['icecream', '#f8e8e8', '#c06080'], { hunger: 0.12, unhappy: -20, bored: -10, fresh: 0.15, rot: 0.6 });
F('Burger', 'Burger', 0.3, ['burger', '#c8873a', '#6a3a1a'], { hunger: 0.28, unhappy: -10, fresh: 1, rot: 3 });
F('Fries', 'French Fries', 0.2, ['fries', '#f2c83a', '#d0302a'], { hunger: 0.14, thirst: -0.05, unhappy: -5, fresh: 1, rot: 3 });
F('Berries', 'Wild Berries', 0.1, ['berries', '#5a2a8a', '#3a7a2a'], { hunger: 0.05, thirst: 0.02, fresh: 2, rot: 4 });
F('Mushrooms', 'Mushrooms', 0.1, ['mushroom', '#d8c0a0', '#a07a50'], { hunger: 0.05, fresh: 3, rot: 6 });
F('StrangeMushrooms', 'Strange Mushrooms', 0.1, ['mushroom', '#c03030', '#f0f0f0'], { hunger: 0.05, fresh: 3, rot: 6, poison: 0.55 });
F('DeadRabbit', 'Dead Rabbit', 1.2, ['meat', '#8a7a68', '#e8d8c8'], { hunger: 0.3, fresh: 2, rot: 4, raw: true, cook: 40, cookBonus: 0.12 });
F('DeadSquirrel', 'Dead Squirrel', 0.6, ['meat', '#8a5a3a', '#e0c0a0'], { hunger: 0.18, fresh: 2, rot: 4, raw: true, cook: 30, cookBonus: 0.1 });
F('DeadBird', 'Dead Bird', 0.3, ['meat', '#6a6a7a', '#f0e0d0'], { hunger: 0.1, fresh: 2, rot: 4, raw: true, cook: 20, cookBonus: 0.06 });
F('DeadMouse', 'Dead Mouse', 0.05, ['meat', '#7a7068', '#d8c8c0'], { hunger: 0.04, fresh: 1, rot: 2, raw: true, cook: 10, unhappy: 10 });
F('Worms', 'Worms', 0.05, ['worm', '#c08080', '#806050'], { hunger: 0.02, unhappy: 25, bait: true });
F('Insects', 'Grasshoppers', 0.05, ['worm', '#6a8a3a', '#405020'], { hunger: 0.03, unhappy: 20, bait: true });
F('Stew', 'Bowl of Stew', 0.6, ['stew', '#8a4a2a', '#e0e0e0'], { hunger: 0.42, thirst: 0.1, unhappy: -15, fresh: 2, rot: 4 });
F('Salad', 'Salad', 0.4, ['stew', '#6ab03a', '#e0e0e0'], { hunger: 0.18, unhappy: -5, fresh: 1.5, rot: 3 });
F('Sandwich', 'Sandwich', 0.3, ['bread', '#e0b070', '#7ab04a'], { hunger: 0.24, unhappy: -5, fresh: 2, rot: 4 });
// drinks (consumed whole)
const D = (id, n, w, ic, o) => idef(id, Object.assign({ n, cat: 'Food', w, ic, drink: true }, o));
D('Pop', 'Soda Pop', 0.35, ['soda', '#c02020', '#fff'], { thirst: 0.28, hunger: 0.02, unhappy: -5 });
D('PopOrange', 'Orange Soda', 0.35, ['soda', '#f08020', '#fff'], { thirst: 0.28, hunger: 0.02, unhappy: -5 });
D('JuiceBox', 'Juice Box', 0.2, ['carton', '#f0a020', '#3a8a3a'], { thirst: 0.2, hunger: 0.03 });
D('Milk', 'Carton of Milk', 0.8, ['carton', '#f8f8f8', '#3a6fd0'], { thirst: 0.35, hunger: 0.06, fresh: 3, rot: 6 });
D('Beer', 'Beer', 0.4, ['soda', '#c8a030', '#fff'], { thirst: 0.14, alc: 0.22, unhappy: -10, empty: 'EmptyBottle' });
D('Wine', 'Wine', 1.0, ['winebottle', '#6a1028', '#ddd'], { thirst: 0.2, alc: 0.6, unhappy: -20, empty: 'EmptyBottle' });
D('Whiskey', 'Whiskey', 1.0, ['winebottle', '#a06020', '#eee'], { thirst: 0.05, alc: 0.9, unhappy: -25, stress: -0.2, empty: 'EmptyBottle' });
D('Coffee', 'Instant Coffee', 0.2, ['jar', '#4a2a1a', '#e0d0b0'], { thirst: 0.05, fatigue: -0.15 });

// ----- FLUID CONTAINERS --------------------------------------------------
idef('WaterBottle', { n: 'Water Bottle', cat: 'Food', w: 0.15, ic: ['bottle', '#9ccaf0', '#3a6fd0'], fluid: 1.0, startFull: true });
idef('EmptyBottle', { n: 'Glass Bottle', cat: 'Material', w: 0.3, ic: ['winebottle', '#4a8a5a', '#cde'], fluid: 1.0 });
idef('Pot', { n: 'Cooking Pot', cat: 'Tool', w: 1.0, ic: ['pot', '#8a8f96', '#5a5f66'], fluid: 2.0, tags: ['pot'] });
idef('Bucket', { n: 'Bucket', cat: 'Tool', w: 0.8, ic: ['bucket', '#5a7fa8', '#3a5f88'], fluid: 3.0 });
idef('WateringCan', { n: 'Watering Can', cat: 'Tool', w: 0.8, ic: ['wateringcan', '#3a8a4a', '#2a6a3a'], fluid: 2.0, tags: ['watercan'] });
idef('GasCan', { n: 'Gas Can', cat: 'Fuel', w: 1.0, ic: ['gascan', '#c02a1a', '#f0d040'], gas: 1.0 });

// ----- MEDICAL -----------------------------------------------------------
const M = (id, n, w, ic, o) => idef(id, Object.assign({ n, cat: 'Medical', w, ic }, o));
M('Bandage', 'Bandage', 0.1, ['bandage', '#f0f0e8', '#c0c0b0'], { bandage: 1 });
M('SterileBandage', 'Sterilized Bandage', 0.1, ['bandage', '#ffffff', '#90c0f0'], { bandage: 2 });
M('Disinfectant', 'Bottle of Disinfectant', 0.4, ['disinfect', '#e8e8f0', '#c03030'], { uses: 10, disinfect: true });
M('AlcoholWipes', 'Alcohol Wipes', 0.05, ['wipes', '#f0f0f8', '#3070c0'], { disinfect: true });
M('Painkillers', 'Painkillers', 0.1, ['pills', '#f0f0f0', '#c03030'], { uses: 10, pill: 'pain' });
M('Antibiotics', 'Antibiotics', 0.1, ['pills', '#f0f0f0', '#30a050'], { uses: 5, pill: 'antibiotic' });
M('BetaBlockers', 'Beta Blockers', 0.1, ['pills', '#f0f0f0', '#3060c0'], { uses: 10, pill: 'beta' });
M('Antidepressants', 'Antidepressants', 0.1, ['pills', '#f0f0f0', '#c0a020'], { uses: 10, pill: 'antidep' });
M('SleepingPills', 'Sleeping Tablets', 0.1, ['pills', '#f0f0f0', '#8040a0'], { uses: 10, pill: 'sleep' });
M('Vitamins', 'Vitamins', 0.1, ['pills', '#f0f0f0', '#f08020'], { uses: 10, pill: 'vitamin' });
M('SutureNeedle', 'Suture Needle', 0.05, ['needle', '#c0c8d0', '#606870'], { suture: true });
M('Tweezers', 'Tweezers', 0.05, ['tweezers', '#c0c8d0', '#606870'], { tags: ['tweezers'] });

// ----- WEAPONS -----------------------------------------------------------
// wpn: sk skill, dmg [min,max], range (tiles), arc (half angle rad), swing (s), hits (max targets),
// knock knockdown chance, crit chance, end endurance cost, cond max condition, lower 1/x chance to lose condition, two two-handed
const Wp = (id, n, w, ic, wpn, o) => idef(id, Object.assign({ n, cat: 'Weapon', w, ic, wpn }, o));
Wp('BaseballBat', 'Baseball Bat', 1.8, ['bat', '#c8955a', '#7a5a3a'], { sk: 'LongBlunt', dmg: [0.8, 1.35], range: 1.3, arc: 0.75, swing: 1.0, hits: 2, knock: 0.45, crit: 0.1, end: 0.022, cond: 15, lower: 14, two: true, model: 'bat' });
Wp('SpikedBat', 'Spiked Baseball Bat', 2.0, ['spikedbat', '#c8955a', '#999'], { sk: 'LongBlunt', dmg: [1.0, 1.6], range: 1.3, arc: 0.75, swing: 1.05, hits: 2, knock: 0.45, crit: 0.15, end: 0.024, cond: 12, lower: 12, two: true, model: 'bat' });
Wp('Crowbar', 'Crowbar', 2.2, ['crowbar', '#3a3a40', '#c02020'], { sk: 'LongBlunt', dmg: [0.9, 1.4], range: 1.2, arc: 0.6, swing: 1.05, hits: 1, knock: 0.3, crit: 0.12, end: 0.022, cond: 30, lower: 40, model: 'pipe' }, { tags: ['crowbar'] });
Wp('GolfClub', 'Golf Club', 1.4, ['golfclub', '#b0b8c0', '#303030'], { sk: 'LongBlunt', dmg: [0.6, 1.1], range: 1.35, arc: 0.7, swing: 0.95, hits: 1, knock: 0.3, crit: 0.1, end: 0.018, cond: 8, lower: 8, two: true, model: 'club' });
Wp('Sledgehammer', 'Sledgehammer', 5.5, ['sledge', '#5a4030', '#606870'], { sk: 'LongBlunt', dmg: [2.0, 3.5], range: 1.3, arc: 0.8, swing: 1.8, hits: 3, knock: 0.9, crit: 0.2, end: 0.06, cond: 25, lower: 30, two: true, model: 'sledge' }, { tags: ['sledge', 'hammer'] });
Wp('FryingPan', 'Frying Pan', 1.8, ['pan', '#303438', '#6a5040'], { sk: 'ShortBlunt', dmg: [0.6, 1.1], range: 1.0, arc: 0.6, swing: 0.9, hits: 1, knock: 0.35, crit: 0.08, end: 0.018, cond: 20, lower: 25, model: 'pan' }, { tags: ['pan'] });
Wp('Hammer', 'Hammer', 1.0, ['hammer', '#7a5a3a', '#707880'], { sk: 'ShortBlunt', dmg: [0.5, 1.0], range: 1.0, arc: 0.55, swing: 0.8, hits: 1, knock: 0.2, crit: 0.1, end: 0.014, cond: 20, lower: 25, model: 'hammer' }, { tags: ['hammer'], cat: 'Tool' });
Wp('LeadPipe', 'Lead Pipe', 2.0, ['pipe', '#70787f', '#50585f'], { sk: 'ShortBlunt', dmg: [0.7, 1.2], range: 1.05, arc: 0.6, swing: 0.95, hits: 1, knock: 0.3, crit: 0.1, end: 0.018, cond: 20, lower: 30, model: 'pipe' });
Wp('PipeWrench', 'Pipe Wrench', 2.0, ['wrench', '#c03020', '#70787f'], { sk: 'ShortBlunt', dmg: [0.7, 1.2], range: 1.05, arc: 0.6, swing: 0.95, hits: 1, knock: 0.3, crit: 0.1, end: 0.018, cond: 20, lower: 30, model: 'hammer' }, { tags: ['wrench'] });
Wp('RollingPin', 'Rolling Pin', 0.8, ['rollingpin', '#d8b080', '#b08850'], { sk: 'ShortBlunt', dmg: [0.4, 0.75], range: 1.0, arc: 0.55, swing: 0.8, hits: 1, knock: 0.15, crit: 0.05, end: 0.012, cond: 8, lower: 10, model: 'pipe' });
Wp('Nightstick', 'Nightstick', 1.0, ['pipe', '#202020', '#404040'], { sk: 'ShortBlunt', dmg: [0.6, 1.0], range: 1.05, arc: 0.6, swing: 0.8, hits: 1, knock: 0.3, crit: 0.08, end: 0.014, cond: 20, lower: 30, model: 'pipe' });
Wp('KitchenKnife', 'Kitchen Knife', 0.3, ['knife', '#d0d8e0', '#303030'], { sk: 'ShortBlade', dmg: [0.4, 0.9], range: 0.85, arc: 0.45, swing: 0.6, hits: 1, knock: 0.05, crit: 0.25, end: 0.01, cond: 10, lower: 8, model: 'knife' }, { tags: ['knife', 'cut'] });
Wp('HuntingKnife', 'Hunting Knife', 0.4, ['knife', '#c0c8d0', '#5a3a20'], { sk: 'ShortBlade', dmg: [0.6, 1.1], range: 0.9, arc: 0.45, swing: 0.6, hits: 1, knock: 0.05, crit: 0.3, end: 0.01, cond: 15, lower: 15, model: 'knife' }, { tags: ['knife', 'cut'] });
Wp('Screwdriver', 'Screwdriver', 0.3, ['screwdriver', '#e0c020', '#a0a8b0'], { sk: 'ShortBlade', dmg: [0.3, 0.7], range: 0.85, arc: 0.45, swing: 0.6, hits: 1, knock: 0.05, crit: 0.2, end: 0.01, cond: 10, lower: 10, model: 'knife' }, { tags: ['screwdriver'], cat: 'Tool' });
Wp('Machete', 'Machete', 1.6, ['machete', '#c8d0d8', '#303030'], { sk: 'LongBlade', dmg: [1.3, 2.1], range: 1.25, arc: 0.7, swing: 1.0, hits: 2, knock: 0.15, crit: 0.25, end: 0.024, cond: 12, lower: 15, model: 'machete' }, { tags: ['cut'] });
Wp('Katana', 'Katana', 1.8, ['katana', '#e0e8f0', '#202020'], { sk: 'LongBlade', dmg: [1.8, 2.8], range: 1.45, arc: 0.75, swing: 1.0, hits: 2, knock: 0.15, crit: 0.35, end: 0.026, cond: 20, lower: 25, two: true, model: 'katana' }, { tags: ['cut'] });
Wp('Axe', 'Axe', 3.0, ['axe', '#8a6a4a', '#9aa2aa'], { sk: 'Axe', dmg: [1.5, 2.3], range: 1.25, arc: 0.7, swing: 1.25, hits: 2, knock: 0.35, crit: 0.25, end: 0.035, cond: 15, lower: 20, two: true, model: 'axe' }, { tags: ['chop'] });
Wp('HandAxe', 'Hand Axe', 1.5, ['handaxe', '#8a6a4a', '#9aa2aa'], { sk: 'Axe', dmg: [0.9, 1.6], range: 1.05, arc: 0.6, swing: 0.95, hits: 1, knock: 0.2, crit: 0.2, end: 0.02, cond: 12, lower: 15, model: 'handaxe' }, { tags: ['chop'] });
Wp('WoodAxe', 'Wood Axe', 4.0, ['axe', '#6a4a2a', '#c0c8d0'], { sk: 'Axe', dmg: [2.0, 3.0], range: 1.35, arc: 0.75, swing: 1.45, hits: 3, knock: 0.5, crit: 0.3, end: 0.045, cond: 18, lower: 25, two: true, model: 'axe' }, { tags: ['chop'] });
Wp('Shovel', 'Shovel', 2.5, ['shovel', '#7a5a3a', '#70787f'], { sk: 'Spear', dmg: [0.7, 1.3], range: 1.45, arc: 0.6, swing: 1.15, hits: 2, knock: 0.4, crit: 0.1, end: 0.03, cond: 12, lower: 12, two: true, model: 'shovel' }, { tags: ['dig'], cat: 'Tool' });
Wp('Spear', 'Crafted Spear', 1.2, ['spear', '#b08850', '#d0d0d0'], { sk: 'Spear', dmg: [0.9, 1.5], range: 1.6, arc: 0.35, swing: 0.95, hits: 1, knock: 0.05, crit: 0.35, end: 0.02, cond: 6, lower: 6, two: true, model: 'spear' });
Wp('Plank', 'Plank', 2.5, ['plank', '#c8a06a', '#a07a4a'], { sk: 'LongBlunt', dmg: [0.45, 0.85], range: 1.3, arc: 0.7, swing: 1.1, hits: 1, knock: 0.3, crit: 0.05, end: 0.025, cond: 4, lower: 4, two: true, model: 'plank' }, { cat: 'Material' });
Wp('Trowel', 'Garden Trowel', 0.4, ['trowel', '#3a8a3a', '#a0a8b0'], { sk: 'ShortBlade', dmg: [0.2, 0.5], range: 0.8, arc: 0.45, swing: 0.6, hits: 1, knock: 0.02, crit: 0.1, end: 0.01, cond: 10, lower: 10, model: 'knife' }, { tags: ['dig'], cat: 'Tool' });

// ----- FIREARMS ----------------------------------------------------------
const Gn = (id, n, w, ic, gun, o) => idef(id, Object.assign({ n, cat: 'Weapon', w, ic, gun }, o));
Gn('Pistol', '9mm Pistol', 1.0, ['pistol', '#2a2d30', '#555'], { ammo: 'Bullets9mm', cap: 15, dmg: [0.8, 1.4], range: 14, spread: 0.12, noise: 38, rof: 0.35, reload: 0.5, model: 'pistol', knock: 0.15, crit: 0.2, cond: 20, lower: 60 });
Gn('Revolver', '.38 Revolver', 1.0, ['revolver', '#3a3d40', '#6a4a2a'], { ammo: 'Bullets38', cap: 6, dmg: [1.0, 1.7], range: 14, spread: 0.11, noise: 40, rof: 0.45, reload: 0.6, model: 'pistol', knock: 0.2, crit: 0.25, cond: 20, lower: 80 });
Gn('Shotgun', 'Pump Shotgun', 4.0, ['shotgun', '#2a2d30', '#7a5030'], { ammo: 'ShotgunShells', cap: 6, dmg: [0.7, 1.3], pellets: 5, range: 8, spread: 0.32, noise: 55, rof: 0.9, reload: 0.7, model: 'shotgun', knock: 0.6, crit: 0.1, two: true, cond: 20, lower: 60 });
Gn('HuntingRifle', 'Hunting Rifle', 4.0, ['rifle', '#3a3d40', '#6a4a2a'], { ammo: 'Bullets308', cap: 5, dmg: [2.0, 3.5], range: 26, spread: 0.04, noise: 60, rof: 1.1, reload: 0.8, model: 'rifle', knock: 0.5, crit: 0.4, two: true, cond: 20, lower: 80 });
Gn('AssaultRifle', 'Assault Rifle', 3.8, ['rifle', '#202224', '#202224'], { ammo: 'Bullets556', cap: 30, dmg: [1.1, 1.8], range: 20, spread: 0.08, noise: 52, rof: 0.15, reload: 0.4, model: 'rifle', knock: 0.25, crit: 0.25, two: true, auto: true, cond: 25, lower: 120 });
// ammo
const Am = (id, n, w, ic, o) => idef(id, Object.assign({ n, cat: 'Ammo', w, ic }, o));
Am('Bullets9mm', '9mm Rounds', 0.02, ['ammo', '#c8a040', '#806020']);
Am('Bullets38', '.38 Special Rounds', 0.02, ['ammo', '#d0b050', '#806020']);
Am('ShotgunShells', 'Shotgun Shells', 0.04, ['shell', '#c02020', '#c8a040']);
Am('Bullets308', '.308 Rounds', 0.03, ['ammo', '#c8a040', '#605030']);
Am('Bullets556', '5.56 Rounds', 0.025, ['ammo', '#b09040', '#405030']);
Am('Box9mm', 'Box of 9mm Rounds', 1.0, ['ammobox', '#3a5a8a', '#c8a040'], { boxOf: 'Bullets9mm', boxN: 50 });
Am('Box38', 'Box of .38 Rounds', 1.0, ['ammobox', '#8a3a3a', '#c8a040'], { boxOf: 'Bullets38', boxN: 50 });
Am('BoxShells', 'Box of Shotgun Shells', 1.0, ['ammobox', '#a02020', '#f0f0f0'], { boxOf: 'ShotgunShells', boxN: 24 });
Am('Box308', 'Box of .308 Rounds', 1.0, ['ammobox', '#4a6a3a', '#c8a040'], { boxOf: 'Bullets308', boxN: 40 });
Am('Box556', 'Box of 5.56 Rounds', 1.0, ['ammobox', '#5a5a3a', '#c8a040'], { boxOf: 'Bullets556', boxN: 60 });

// ----- TOOLS -------------------------------------------------------------
const T = (id, n, w, ic, o) => idef(id, Object.assign({ n, cat: 'Tool', w, ic }, o));
T('Saw', 'Saw', 0.8, ['saw', '#c0c8d0', '#c03020'], { tags: ['saw'] });
T('CanOpener', 'Can Opener', 0.2, ['canopener', '#a0a8b0', '#c03020'], { tags: ['canopener'] });
T('Lighter', 'Lighter', 0.1, ['lighter', '#d03030', '#e0e0e0'], { tags: ['lighter'], uses: 30 });
T('FireExtinguisher', 'Fire Extinguisher', 3.5, ['gascan', '#d02020', '#303030'], { tags: ['extinguisher'], uses: 12, desc: 'Puts out fires in a small area. Right-click a fire to use it.' });
T('Matches', 'Box of Matches', 0.1, ['matches', '#c08030', '#c02020'], { tags: ['lighter'], uses: 15 });
T('Flashlight', 'Flashlight', 0.6, ['flashlight', '#2a2a30', '#f0e080'], { power: 1.0, light: 1, tags: ['light'] });
T('Battery', 'Battery', 0.1, ['battery', '#202020', '#d0a020'], { power: 1.0 });
T('FishingRod', 'Fishing Rod', 1.0, ['rod', '#5a3a20', '#c0c0c0'], { tags: ['fishing'] });
T('DuctTape', 'Duct Tape', 0.2, ['tape', '#a0a4a8', '#707478'], { uses: 8, repair: 0.25 });
T('Glue', 'Glue', 0.1, ['glue', '#f0f0f0', '#e0a020'], { uses: 5, repair: 0.3 });
T('Scissors', 'Scissors', 0.1, ['scissors', '#c0c8d0', '#3060c0'], { tags: ['scissors'] });
T('SewingKit', 'Needle and Thread', 0.1, ['needle', '#c0c8d0', '#c03030'], { tags: ['needle'] });
T('Generator', 'Generator', 22, ['generator', '#c8a020', '#303030'], { generator: true });
T('CarKey', 'Car Key', 0.05, ['key', '#c0c0c8', '#303030'], { key: true });
// ----- VEHICLE TOOLS & PARTS ----------------------------------------------
// part items carry their condition in it.pc (0-100); size: 'regular' or 'heavy' (heavy parts are bulky to carry)
T('LugWrench', 'Lug Wrench', 1.2, ['lugwrench', '#5a5e64', '#2a2a2e'], { tags: ['lugwrench'], desc: 'Takes the wheel nuts off. Needed with a jack to change tires.' });
T('CarJack', 'Jack', 3.5, ['jack', '#c8381e', '#3a3a3e'], { tags: ['jack'], desc: 'Lifts a vehicle to work on its wheels and underside.' });
T('Wrench', 'Wrench', 0.6, ['wrench', '#9aa2aa', '#5a5e64'], { tags: ['wrench'], desc: 'Bolts and nuts: batteries, doors, mufflers, brakes.' });
const CP = (id, n, w, ic, o) => idef(id, Object.assign({ n, cat: 'Car Part', w, ic, carPart: true, size: w >= 6 ? 'heavy' : 'regular' }, o));
CP('Tire', 'Tire', 5, ['tire', '#1e1e20', '#a8acb0']);
CP('TireHD', 'Heavy-Duty Tire', 9, ['tire', '#18181a', '#6a6e72']);
CP('CarBattery', 'Car Battery', 7, ['carbattery', '#2a2c30', '#c83a2a'], { desc: 'Stores charge for the starter, horn and lights. The alternator recharges it while the engine runs.' });
CP('CarDoor', 'Car Door', 12, ['cardoor', '#6a7280', '#30465a']);
CP('Windshield', 'Windshield', 8, ['windshield', '#6a90a8', '#2a2c30']);
CP('CarWindow', 'Car Window', 2.5, ['carwindow', '#7aa0b8', '#2a2c30']);
CP('Headlight', 'Headlight', 0.6, ['headlight', '#e4e6d8', '#8a9096']);
CP('Taillight', 'Taillight', 0.5, ['headlight', '#c02018', '#8a9096']);
CP('BrakePads', 'Brake Pads', 1.2, ['brakepads', '#7a7e84', '#3a3a3e']);
CP('BrakePadsHD', 'Heavy-Duty Brakes', 2.5, ['brakepads', '#5a5e64', '#c8381e']);
CP('Suspension', 'Suspension', 6, ['suspension', '#3a5a9a', '#9aa2aa']);
CP('SuspensionHD', 'Heavy-Duty Suspension', 10, ['suspension', '#3a3a3e', '#c8a020']);
CP('Muffler', 'Muffler', 4, ['muffler', '#8a8e94', '#4a4a4e']);
CP('MufflerHD', 'Heavy-Duty Muffler', 7, ['muffler', '#6a6e74', '#3a3a3e']);
CP('CarHood', 'Hood', 9, ['hood', '#6a7280', '#3a3a3e']);
CP('TrunkLid', 'Trunk Lid', 8, ['trunklid', '#6a7280', '#3a3a3e']);
CP('GasTank', 'Gas Tank', 8, ['gastank', '#5a5e64', '#2a2a2e']);
CP('EngineParts', 'Spare Engine Parts', 0.5, ['engineparts', '#8a8e94', '#c8a020'], { desc: 'Gaskets, belts and bolts. Used up when repairing an engine.' });
T('HouseKey', 'Key', 0.05, ['key', '#d0b040', '#806020'], { key: true });
T('Radio', 'Portable Radio', 0.8, ['radio', '#303438', '#c0c0c0'], { power: 1.0, radio: true, cat: 'Electronics' });
T('Cigarettes', 'Cigarettes', 0.1, ['cig', '#f0f0f0', '#c03030'], { uses: 20, smoke: true, cat: 'Misc' });
T('Molotov', 'Molotov Cocktail', 0.8, ['molotov', '#4a8a5a', '#f08020'], { throwable: 'fire', cat: 'Weapon' });
T('NoiseMaker', 'Alarm Clock', 0.4, ['alarmclock', '#c02020', '#f0f0f0'], { throwable: 'noise', cat: 'Misc' });
T('Map', 'Area Map', 0.05, ['map', '#e8dcb0', '#6a8a4a'], { mapItem: true, cat: 'Literature' });

// ----- MATERIALS ---------------------------------------------------------
const Mt = (id, n, w, ic, o) => idef(id, Object.assign({ n, cat: 'Material', w, ic }, o));
Mt('Log', 'Log', 5.0, ['log', '#7a5030', '#c8a070']);
Mt('Nails', 'Nails', 0.01, ['nails', '#a0a8b0', '#606870']);
Mt('NailsBox', 'Box of Nails', 1.0, ['box', '#c02020', '#a0a8b0'], { boxOf: 'Nails', boxN: 100 });
Mt('RippedSheets', 'Ripped Sheets', 0.1, ['rag', '#e8e4d8', '#c0b8a8'], { bandage: 0 });
Mt('Sheet', 'Sheet', 1.0, ['sheet', '#e8e8f0', '#a0b0d0'], {});
idef('Corpse', { n: 'Corpse', cat: 'Furniture', w: 40, ic: ['tshirt', '#6a7060', '#4a3020'], corpse: true, desc: 'Heavy and rank. Drop it somewhere far from where you sleep.' });
idef('Moveable', { n: 'Furniture', cat: 'Furniture', w: 10, ic: ['box', '#8a6a48', '#5a4028'], moveable: true, desc: 'Right-click the ground (or use it) to place it. R rotates while placing.' });
Mt('Splint', 'Splint', 0.4, ['plank', '#c8a878', '#e8e0d0'], { splint: true, desc: 'Straightens and supports a broken bone so it heals properly.' });
Mt('SheetRope', 'Sheet Rope', 1.6, ['rag', '#f2f0ea', '#b8b0a0'], { desc: 'Knotted sheets. Nail it to an upstairs window to climb down and back up.' });
Mt('TreeBranch', 'Tree Branch', 1.5, ['branch', '#6a4a2a', '#4a7a2a'], { fuel: 1 });
Mt('Twigs', 'Twigs', 0.3, ['branch', '#8a6a4a', '#8a6a4a'], { fuel: 0.4 });
Mt('Stone', 'Stone', 0.5, ['stone', '#8a8a88', '#6a6a68'], {});
Mt('GarbageBag', 'Garbage Bag', 0.1, ['garbagebag', '#202020', '#404040'], { bag: { cap: 8, red: 0.0, hand: true } });
const Sd = (id, n, crop, ic) => idef(id, { n, cat: 'Misc', w: 0.05, ic: ['seeds', ic, '#e0d0a0'], seeds: crop, uses: 8 });
Sd('CarrotSeeds', 'Carrot Seeds', 'carrot', '#f07a1a');
Sd('PotatoSeeds', 'Potato Seeds', 'potato', '#b8915a');
Sd('TomatoSeeds', 'Tomato Seeds', 'tomato', '#e0301a');
Sd('CabbageSeeds', 'Cabbage Seeds', 'cabbage', '#9ad06a');

// ----- CLOTHING ----------------------------------------------------------
// slot, cover (body regions), sc scratch protection %, bi bite protection %, ins insulation 0..1, colors
const Cl = (id, n, w, ic, o) => idef(id, Object.assign({ n, cat: 'Clothing', w, ic }, o));
const TSHIRT_COLS = ['#d8d8d8', '#2a4a8a', '#8a2a2a', '#3a6a3a', '#202020', '#c8a040', '#7a4a8a', '#e07030', '#5a8ab0', '#f0f0f0'];
Cl('TShirt', 'T-Shirt', 0.2, ['tshirt', '#ccc'], { slot: 'shirt', cover: ['torso', 'uarms'], sc: 8, bi: 0, ins: 0.1, cols: TSHIRT_COLS });
Cl('Shirt', 'Long Sleeve Shirt', 0.3, ['shirt', '#ccc'], { slot: 'shirt', cover: ['torso', 'uarms', 'farms'], sc: 10, bi: 2, ins: 0.15, cols: ['#e8e8f0', '#a0c0e0', '#c0a080', '#5a6a8a', '#8a3a3a', '#e0d0a0'] });
Cl('TankTop', 'Tank Top', 0.1, ['tshirt', '#ccc'], { slot: 'shirt', cover: ['torso'], sc: 5, bi: 0, ins: 0.05, cols: ['#f0f0f0', '#202020', '#8a2a2a', '#2a4a8a'] });
Cl('PoliceShirt', 'Police Shirt', 0.3, ['shirt', '#3a4a6a'], { slot: 'shirt', cover: ['torso', 'uarms'], sc: 12, bi: 3, ins: 0.15, cols: ['#3a4a6a'] });
Cl('Sweater', 'Sweater', 0.5, ['shirt', '#ccc'], { slot: 'jacket', cover: ['torso', 'uarms', 'farms'], sc: 15, bi: 5, ins: 0.35, cols: ['#8a3a3a', '#3a5a3a', '#5a5a7a', '#c0a070', '#404040'] });
Cl('Hoodie', 'Hoodie', 0.6, ['jacket', '#ccc'], { slot: 'jacket', cover: ['torso', 'uarms', 'farms'], sc: 18, bi: 6, ins: 0.35, cols: ['#505860', '#2a2a2a', '#8a2a2a', '#2a4a7a', '#3a6a4a', '#c0c0c0'] });
Cl('DenimJacket', 'Denim Jacket', 0.8, ['jacket', '#4a6a9a'], { slot: 'jacket', cover: ['torso', 'uarms', 'farms'], sc: 30, bi: 12, ins: 0.3, cols: ['#4a6a9a', '#3a4a6a'] });
Cl('LeatherJacket', 'Leather Jacket', 1.2, ['jacket', '#2a2220'], { slot: 'jacket', cover: ['torso', 'uarms', 'farms'], sc: 55, bi: 30, ins: 0.4, cols: ['#2a2220', '#4a3020'] });
Cl('WinterCoat', 'Winter Coat', 1.5, ['jacket', '#3a4a5a'], { slot: 'jacket', cover: ['torso', 'uarms', 'farms', 'groin'], sc: 40, bi: 18, ins: 0.85, cols: ['#3a4a5a', '#8a2a2a', '#2a2a2a', '#4a5a3a'] });
Cl('FireJacket', 'Firefighter Jacket', 2.0, ['jacket', '#a08030'], { slot: 'jacket', cover: ['torso', 'uarms', 'farms'], sc: 70, bi: 45, ins: 0.6, cols: ['#a08030'] });
Cl('MilitaryJacket', 'Military Jacket', 1.2, ['jacket', '#4a5a3a'], { slot: 'jacket', cover: ['torso', 'uarms', 'farms'], sc: 45, bi: 22, ins: 0.45, cols: ['#4a5a3a', '#5a5a40'] });
Cl('BulletVest', 'Bulletproof Vest', 2.5, ['vest', '#2a2a30'], { slot: 'vest', cover: ['torso'], sc: 80, bi: 70, ins: 0.15, bullet: true, cols: ['#2a2a30', '#3a4a3a'] });
Cl('Jeans', 'Jeans', 0.6, ['pants', '#3a5a8a'], { slot: 'pants', cover: ['groin', 'ulegs', 'llegs'], sc: 20, bi: 8, ins: 0.2, cols: ['#3a5a8a', '#2a3a5a', '#506a90', '#202530'] });
Cl('Trousers', 'Trousers', 0.5, ['pants', '#3a3a3a'], { slot: 'pants', cover: ['groin', 'ulegs', 'llegs'], sc: 12, bi: 4, ins: 0.2, cols: ['#3a3a3a', '#5a4a3a', '#2a2a40', '#7a6a50'] });
Cl('Scrubs', 'Scrubs Top', 0.2, ['tshirt', '#4a9a9a'], { slot: 'shirt', cover: ['torso', 'uarms'], sc: 6, bi: 0, ins: 0.08, cols: ['#4a9a9a', '#5a7ab0', '#7aa0c0'] });
Cl('ScrubPants', 'Scrubs Trousers', 0.3, ['pants', '#4a9a9a'], { slot: 'pants', cover: ['groin', 'ulegs', 'llegs'], sc: 8, bi: 2, ins: 0.1, cols: ['#4a9a9a', '#5a7ab0', '#7aa0c0'] });
Cl('LabCoat', 'Lab Coat', 0.6, ['jacket', '#f0f0f0'], { slot: 'jacket', cover: ['torso', 'uarms', 'farms', 'groin'], sc: 15, bi: 4, ins: 0.15, cols: ['#f0f0f0'] });
Cl('Shorts', 'Shorts', 0.3, ['shorts', '#7a6a50'], { slot: 'pants', cover: ['groin', 'ulegs'], sc: 8, bi: 2, ins: 0.05, cols: ['#7a6a50', '#3a5a8a', '#202020', '#8a2a2a'] });
Cl('CargoPants', 'Cargo Pants', 0.7, ['pants', '#5a5a40'], { slot: 'pants', cover: ['groin', 'ulegs', 'llegs'], sc: 25, bi: 10, ins: 0.25, cols: ['#5a5a40', '#4a5a3a', '#3a3a3a'] });
Cl('FirePants', 'Firefighter Pants', 1.5, ['pants', '#a08030'], { slot: 'pants', cover: ['groin', 'ulegs', 'llegs'], sc: 60, bi: 40, ins: 0.4, cols: ['#a08030'] });
Cl('PolicePants', 'Police Trousers', 0.5, ['pants', '#2a3040'], { slot: 'pants', cover: ['groin', 'ulegs', 'llegs'], sc: 15, bi: 5, ins: 0.2, cols: ['#2a3040'] });
Cl('Sneakers', 'Sneakers', 0.5, ['shoes', '#e0e0e0'], { slot: 'shoes', cover: ['feet'], sc: 10, bi: 5, ins: 0.1, cols: ['#e0e0e0', '#2a2a2a', '#3a5a9a', '#c03030'] });
Cl('Boots', 'Work Boots', 1.0, ['shoes', '#5a3a20'], { slot: 'shoes', cover: ['feet', 'llegs'], sc: 30, bi: 20, ins: 0.25, cols: ['#5a3a20', '#2a2a2a'] });
Cl('DressShoes', 'Dress Shoes', 0.6, ['shoes', '#1a1a1a'], { slot: 'shoes', cover: ['feet'], sc: 10, bi: 5, ins: 0.1, cols: ['#1a1a1a', '#4a2a1a'] });
Cl('Beanie', 'Beanie', 0.1, ['hat', '#3a3a3a'], { slot: 'hat', cover: ['head'], sc: 5, bi: 0, ins: 0.2, cols: ['#3a3a3a', '#8a2a2a', '#2a4a7a', '#c0a040'], hatType: 'beanie' });
Cl('BaseballCap', 'Baseball Cap', 0.1, ['cap', '#2a4a8a'], { slot: 'hat', cover: ['head'], sc: 3, bi: 0, ins: 0.05, cols: ['#2a4a8a', '#c02020', '#202020', '#3a6a3a', '#e0e0e0'], hatType: 'cap' });
Cl('HardHat', 'Hard Hat', 0.5, ['helmet', '#f0c020'], { slot: 'hat', cover: ['head'], sc: 60, bi: 30, ins: 0.05, cols: ['#f0c020', '#f08020'], hatType: 'helmet' });
Cl('MotoHelmet', 'Motorcycle Helmet', 1.2, ['helmet', '#202020'], { slot: 'hat', cover: ['head'], sc: 100, bi: 100, ins: 0.2, cols: ['#202020', '#c02020', '#f0f0f0'], hatType: 'fullhelmet' });
Cl('FireHelmet', 'Firefighter Helmet', 1.0, ['helmet', '#c8a020'], { slot: 'hat', cover: ['head'], sc: 80, bi: 50, ins: 0.1, cols: ['#c8a020'], hatType: 'helmet' });
Cl('PoliceCap', 'Police Cap', 0.1, ['cap', '#2a3040'], { slot: 'hat', cover: ['head'], sc: 3, bi: 0, ins: 0.05, cols: ['#2a3040'], hatType: 'cap' });
Cl('Gloves', 'Winter Gloves', 0.1, ['gloves', '#3a3a3a'], { slot: 'gloves', cover: ['hands'], sc: 20, bi: 5, ins: 0.3, cols: ['#3a3a3a', '#5a3a3a'] });
Cl('LeatherGloves', 'Leather Gloves', 0.2, ['gloves', '#4a3020'], { slot: 'gloves', cover: ['hands'], sc: 45, bi: 20, ins: 0.2, cols: ['#4a3020', '#202020'] });
Cl('Scarf', 'Scarf', 0.1, ['scarf', '#8a2a2a'], { slot: 'neck', cover: ['neck'], sc: 25, bi: 10, ins: 0.2, cols: ['#8a2a2a', '#2a4a7a', '#c0a040', '#3a6a3a'] });
Cl('Glasses', 'Glasses', 0.05, ['glasses', '#303030'], { slot: 'eyes', cover: [], sc: 0, bi: 0, ins: 0, cols: ['#303030'] });
Cl('Belt', 'Belt', 0.2, ['belt', '#5a3a20', '#c8b060'], { slot: 'waist', cover: [], sc: 0, bi: 0, ins: 0, attach: ['beltL', 'beltR'], cols: ['#5a3a20', '#2a2420', '#7a5a3a'], desc: 'Two hotbar slots on the hips for small weapons, tools and a flashlight.' });
Cl('Holster', 'Belt Holster', 0.3, ['holster', '#2a2220', '#8a7a5a'], { slot: 'holster', cover: [], sc: 0, bi: 0, ins: 0, attach: ['holster'], cols: ['#2a2220', '#4a3020'], desc: 'A hotbar slot for a pistol or revolver.' });
Cl('DigitalWatch', 'Digital Watch', 0.05, ['watch', '#202020', '#80c080'], { slot: 'wrist', cover: [], sc: 0, bi: 0, ins: 0, watch: true, cols: ['#202020'] });

// ----- BAGS --------------------------------------------------------------
const Bg = (id, n, w, ic, bag, o) => idef(id, Object.assign({ n, cat: 'Container', w, ic, bag }, o));
Bg('PlasticBag', 'Plastic Bag', 0.1, ['plasticbag', '#f0f0f0', '#c0c0c0'], { cap: 4, red: 0, hand: true });
Bg('SchoolBag', 'School Bag', 0.6, ['backpack', '#3a5a9a', '#2a3a6a'], { cap: 12, red: 0.6, back: true, col: '#3a5a9a' }, { cols: ['#3a5a9a', '#8a2a2a', '#2a6a3a', '#7a3a8a', '#202020'] });
Bg('DuffelBag', 'Duffel Bag', 0.8, ['duffel', '#2a2a2a', '#4a4a4a'], { cap: 18, red: 0.65, back: true, hand: true, col: '#2a2a2a' }, { cols: ['#2a2a2a', '#3a4a6a', '#5a4a3a'] });
Bg('HikingBag', 'Hiking Bag', 1.0, ['backpack', '#c05020', '#7a3a1a'], { cap: 20, red: 0.75, back: true, col: '#c05020' }, { cols: ['#c05020', '#3a6a8a', '#4a6a3a'] });
Bg('MilitaryBag', 'Military Backpack', 1.2, ['backpack', '#4a5a3a', '#3a4a2a'], { cap: 26, red: 0.85, back: true, col: '#4a5a3a' }, { cols: ['#4a5a3a'] });
Bg('FannyPack', 'Fanny Pack', 0.2, ['fannypack', '#c03080', '#202020'], { cap: 2, red: 0.8, belt: true, col: '#c03080' }, { cols: ['#c03080', '#202020', '#3060c0'] });
Bg('Toolbox', 'Toolbox', 1.0, ['toolbox', '#c02020', '#303030'], { cap: 8, red: 0.3, hand: true });
Bg('FirstAidKit', 'First Aid Kit', 0.3, ['firstaidkit', '#f0f0f0', '#c02020'], { cap: 3, red: 0.5, hand: true });
// lunchbox etc. skipped

// ----- LITERATURE --------------------------------------------------------
const Lt = (id, n, w, ic, o) => idef(id, Object.assign({ n, cat: 'Literature', w, ic }, o));
Lt('Magazine', 'Magazine', 0.1, ['magazine', '#c03060', '#f0e0a0'], { read: 10, bored: -20, unhappy: -10 });
Lt('ComicBook', 'Comic Book', 0.1, ['magazine', '#3070d0', '#f0d020'], { read: 15, bored: -30, unhappy: -15 });
Lt('Newspaper', 'Newspaper', 0.1, ['newspaper', '#e8e4d8', '#505050'], { read: 8, bored: -15, unhappy: -5 });
Lt('Novel', 'Novel', 0.5, ['book', '#7a3a2a', '#e0c080'], { read: 90, bored: -50, unhappy: -40 });
Lt('Encyclopedia', 'Encyclopedia', 1.0, ['book', '#2a3a6a', '#e0c080'], { read: 120, bored: -40, unhappy: -20 });
const SKILL_BOOKS = [['Carpentry', '#a07a4a'], ['Cooking', '#c04040'], ['FirstAid', '#e0e0e0'], ['Farming', '#4a9a3a'], ['Electrical', '#d0b020'], ['Mechanics', '#5a6a8a'], ['Fishing', '#3a7ab0'], ['Foraging', '#6a8a3a'], ['Maintenance', '#808890'], ['Aiming', '#5a5a5a']];
const SK_BOOK_TIER = [['for Beginners', 0, 2, 3], ['for Intermediates', 3, 5, 5], ['for Experts', 6, 9, 8]];
for (const [sk, col] of SKILL_BOOKS) {
  SK_BOOK_TIER.forEach((t, i) => {
    const nm = (sk === 'FirstAid' ? 'First Aid' : sk) + ' ' + t[0];
    Lt('Book' + sk + (i + 1), nm, 0.8, ['book', col, '#f0f0f0'], { read: 60 + i * 30, skillBook: { sk, min: t[1], max: t[2], mult: t[3] } });
  });
}

// ---------------------------------------------------------------------------
// Item instance helpers
// ---------------------------------------------------------------------------
let _uid = 1;
const Items = {
  def(id) { return ITEMS[id]; },
  make(id, opts) {
    const d = ITEMS[id];
    if (!d) { console.warn('Unknown item', id); return null; }
    const it = { id, uid: _uid++ };
    if (d.wpn) it.cond = d.wpn.cond;
    if (d.gun) { it.cond = d.gun.cond; it.ammo = 0; }
    if (d.uses) it.uses = d.uses;
    if (d.power !== undefined) it.pow = d.power * (opts && opts.loot ? R.f(0.3, 1) : 1);
    if (d.fluid) { it.fl = d.startFull ? d.fluid : 0; it.taint = false; }
    if (d.gas) it.fl = (opts && opts.loot) ? (R.chance(0.4) ? 0 : R.f(0.3, 1)) * d.gas : d.gas;
    if (d.fresh !== undefined) it.age = 0;
    if (d.cols) it.col = d.cols[Math.floor(R.next() * d.cols.length)];
    if (d.bag) it.items = [];
    if (d.cat === 'Clothing') it.cond = 1;
    if (d.carPart && id !== 'EngineParts') it.pc = opts && opts.loot ? (R.chance(0.5) ? R.int(35, 100) : 100) : 100;
    if (opts) Object.assign(it, opts.set || {});
    return it;
  },
  setUidBase(n) { _uid = Math.max(_uid, n + 1); },
  name(it) {
    const d = ITEMS[it.id];
    let n = d.n;
    if (it.label) n = it.label;
    if (d.fluid !== undefined) {
      if (it.fl <= 0.001) {
        if (it.id === 'WaterBottle') n = 'Empty Water Bottle';
        else if (it.id === 'EmptyBottle') n = 'Empty Bottle';
        else n = d.n + ' (Empty)';
      } else {
        const what = it.taint ? 'Tainted Water' : 'Water';
        if (it.id === 'WaterBottle') n = it.taint ? 'Water Bottle (Tainted)' : 'Water Bottle';
        else if (it.id === 'EmptyBottle') n = 'Bottle of ' + what;
        else n = d.n + ' of ' + what;
      }
    }
    if (d.gas !== undefined && it.fl <= 0.001) n = 'Empty Gas Can';
    if (d.carPart && it.pc !== undefined && it.id !== 'EngineParts') n += ' (' + Math.round(it.pc) + '%)';
    if (d.cook || d.raw) {
      if (it.burnt) n = 'Burnt ' + n;
      else if (it.cooked) n = 'Cooked ' + n;
    }
    const fs = this.freshState(it);
    if (fs === 2) n = 'Rotten ' + n;
    else if (fs === 1) n = 'Stale ' + n;
    if (it.frozen) n = 'Frozen ' + n;
    if ((d.wpn || d.gun) && it.cond <= 0) n = 'Broken ' + n;
    if (d.cat === 'Clothing' && it.bloody) n = 'Bloody ' + n;
    return n;
  },
  freshState(it) { // 0 fresh, 1 stale, 2 rotten, -1 n/a
    const d = ITEMS[it.id];
    if (d.fresh === undefined || it.age === undefined) return -1;
    const days = it.age / 24;
    if (days >= d.rot) return 2;
    if (days >= d.fresh) return 1;
    return 0;
  },
  weight(it) {
    const d = ITEMS[it.id];
    let w = it.mw || d.w;
    if (d.fluid) w += it.fl * 0.9;
    if (d.gas) w += it.fl * 5.5;
    if (d.bag && it.items) {
      let c = 0;
      for (const s of it.items) c += this.weight(s);
      w += c * (1 - d.bag.red);
    }
    if (d.uses && (d.cat === 'Medical' || d.id === 'Whiskey')) w *= 0.5 + 0.5 * (it.uses / d.uses);
    return w;
  },
  contentWeight(arr) { let w = 0; for (const it of arr) w += this.weight(it); return w; },
  has(it, tag) { return ITEMS[it.id].tags.includes(tag); },
  isWeapon(it) { const d = ITEMS[it.id]; return !!(d.wpn || d.gun); },
  catOf(it) { return ITEMS[it.id].cat; },
  // items are considered stackable in UI if same id & no distinguishing state
  stackKey(it) {
    const d = ITEMS[it.id];
    if (d.bag || d.wpn || d.gun || d.fluid || d.gas || d.uses || d.power !== undefined || d.cat === 'Clothing' || d.moveable || d.corpse) return 'u' + it.uid;
    if (it.equipped || it.worn) return 'u' + it.uid;
    let k = it.id;
    if (d.fresh !== undefined) k += '|' + this.freshState(it) + (it.cooked ? 'c' : '') + (it.burnt ? 'b' : '') + (it.frozen ? 'f' : '');
    if (it.keyId !== undefined) k += '|k' + it.keyId;
    return k;
  },
  description(it) {
    const d = ITEMS[it.id];
    const lines = [];
    lines.push('Weight: ' + U.fmt2(this.weight(it)));
    if (d.carPart && d.size) lines.push('Size: ' + (d.size === 'heavy' ? 'Heavy' : 'Regular') + (it.pc !== undefined && it.id !== 'EngineParts' ? ' · Condition ' + Math.round(it.pc) + '%' : ''));
    if (d.desc && (d.carPart || d.attach || d.tags.includes('lugwrench') || d.tags.includes('jack'))) lines.push(d.desc);
    if (d.wpn) {
      lines.push('Condition: ' + Math.max(0, it.cond) + '/' + d.wpn.cond);
      lines.push('Damage: ' + d.wpn.dmg[0] + ' - ' + d.wpn.dmg[1]);
      lines.push('Skill: ' + SKILL_NAMES[d.wpn.sk] + (d.wpn.two ? ' (Two-handed)' : ''));
    }
    if (d.gun) {
      lines.push('Ammo: ' + (it.ammo || 0) + '/' + d.gun.cap + ' (' + ITEMS[d.gun.ammo].n + ')');
      lines.push('Condition: ' + Math.max(0, it.cond) + '/' + d.gun.cond);
    }
    if (d.cat === 'Food' && !d.fluid) {
      if (d.hunger) lines.push('Hunger: -' + Math.round(this.foodVal(it, 'hunger') * 100));
      if (d.thirst) lines.push('Thirst: ' + (d.thirst > 0 ? '-' : '+') + Math.round(Math.abs(d.thirst) * 100));
      if (d.unhappy) lines.push('Unhappiness: ' + (d.unhappy > 0 ? '+' : '') + d.unhappy);
      if (d.open) lines.push('Requires a can opener');
      if (d.raw && !it.cooked) lines.push('Should be cooked');
      const fs = this.freshState(it);
      if (fs === 0) lines.push('Fresh');
    }
    if (d.fluid !== undefined) lines.push('Contains: ' + Math.round(it.fl / d.fluid * 100) + '%' + (it.taint ? ' (tainted)' : ''));
    if (d.gas !== undefined) lines.push('Gasoline: ' + Math.round(it.fl / d.gas * 100) + '%');
    if (d.uses) lines.push('Uses left: ' + it.uses);
    if (d.power !== undefined) lines.push('Battery: ' + Math.round(it.pow * 100) + '%');
    if (d.cat === 'Clothing') {
      if (d.sc) lines.push('Scratch defense: ' + d.sc + '%');
      if (d.bi) lines.push('Bite defense: ' + d.bi + '%');
      if (d.ins) lines.push('Insulation: ' + Math.round(d.ins * 100) + '%');
    }
    if (d.bag) lines.push('Capacity: ' + d.bag.cap + '  Weight reduction: ' + Math.round(d.bag.red * 100) + '%');
    if (d.skillBook) lines.push('Skill book: ' + SKILL_NAMES[d.skillBook.sk] + ' (levels ' + (d.skillBook.min + 1) + '-' + (d.skillBook.max + 1) + ')');
    if (d.boxOf) lines.push('Contains ' + d.boxN + ' ' + ITEMS[d.boxOf].n);
    if (it.keyId !== undefined) lines.push(it.keyName || 'A key');
    return lines;
  },
  foodVal(it, k) {
    const d = ITEMS[it.id];
    let v = d[k] || 0;
    if (k === 'hunger') {
      if (it.cooked && d.cookBonus) v += d.cookBonus;
      if (it.burnt) v *= 0.5;
      if (it.portion !== undefined) v *= it.portion;
    }
    return v;
  },
};
