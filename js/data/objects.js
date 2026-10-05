'use strict';
// ---------------------------------------------------------------------------
// World object (furniture etc.) definitions
//  solid: blocks movement; h: height in z units (for picking/rendering)
//  cont: container {type, cap}; water: water source; sit/sleep; light: light source (needs power)
// ---------------------------------------------------------------------------
const OBJ = {
  counter: { n: 'Counter', solid: true, h: 0.95, cont: { type: 'counter', cap: 30 } },
  sink: { n: 'Sink', solid: true, h: 0.95, cont: { type: 'counter', cap: 20 }, water: 'tap' },
  stove: { n: 'Stove', solid: true, h: 0.95, cont: { type: 'oven', cap: 15 }, stove: 'electric' },
  fridge: { n: 'Fridge', solid: true, h: 1.9, cont: { type: 'fridge', cap: 30 }, cold: true },
  table: { n: 'Table', solid: true, h: 0.8 },
  chair: { n: 'Chair', solid: false, h: 1.0, sit: true },
  bed: { n: 'Bed', solid: true, h: 0.6, sleep: 1.0, multi: true },
  wardrobe: { n: 'Wardrobe', solid: true, h: 2.0, cont: { type: 'wardrobe', cap: 40 } },
  dresser: { n: 'Dresser', solid: true, h: 1.0, cont: { type: 'dresser', cap: 25 } },
  nightstand: { n: 'Nightstand', solid: true, h: 0.6, cont: { type: 'nightstand', cap: 8 } },
  bookshelf: { n: 'Bookshelf', solid: true, h: 1.9, cont: { type: 'bookshelf', cap: 20 } },
  sofa: { n: 'Sofa', solid: true, h: 0.8, sit: true, sleep: 0.7, multi: true },
  armchair: { n: 'Armchair', solid: true, h: 0.85, sit: true },
  tv: { n: 'Television', solid: true, h: 1.1, tv: true },
  toilet: { n: 'Toilet', solid: true, h: 0.8, water: 'toilet' },
  bathtub: { n: 'Bathtub', solid: true, h: 0.6, water: 'tap', multi: true },
  medcab: { n: 'Bathroom Cabinet', solid: true, h: 0.95, cont: { type: 'medcab', cap: 12 } },
  lamp: { n: 'Lamp', solid: false, h: 1.6, light: 4.5 },
  desk: { n: 'Desk', solid: true, h: 0.8, cont: { type: 'desk', cap: 20 } },
  shelf: { n: 'Shelves', solid: true, h: 1.75, cont: { type: 'shelf', cap: 50 } },
  crate: { n: 'Crate', solid: true, h: 0.9, cont: { type: 'crate', cap: 50 } },
  toolcab: { n: 'Workbench', solid: true, h: 1.6, cont: { type: 'toolcab', cap: 40 } },
  locker: { n: 'Locker', solid: true, h: 2.0, cont: { type: 'locker', cap: 20 } },
  register: { n: 'Checkout Counter', solid: true, h: 1.0, cont: { type: 'register', cap: 10 } },
  cooler: { n: 'Drinks Cooler', solid: true, h: 2.0, cont: { type: 'cooler', cap: 30 }, cold: true },
  trash: { n: 'Garbage Bin', solid: true, h: 0.9, cont: { type: 'trash', cap: 20 } },
  mailbox: { n: 'Mailbox', solid: false, h: 1.2, cont: { type: 'mailbox', cap: 5 } },
  tree: { n: 'Tree', solid: 'circle', rad: 0.22, h: 4.0 },
  bush: { n: 'Bush', solid: false, h: 0.8 },
  lamppost: { n: 'Street Light', solid: 'circle', rad: 0.08, h: 4.2, light: 7, street: true },
  pump: { n: 'Gas Pump', solid: true, h: 1.6, pump: true },
  bench: { n: 'Bench', solid: true, h: 0.6, sit: true },
  pew: { n: 'Pew', solid: true, h: 0.9, sit: true },
  campfire: { n: 'Campfire', solid: false, h: 0.4, cont: { type: 'campfire', cap: 10 }, stove: 'fire' },
  bbq: { n: 'Barbecue', solid: true, h: 1.0, cont: { type: 'oven', cap: 10 }, stove: 'fire' },
  barrel: { n: 'Rain Collector Barrel', solid: true, h: 1.1, water: 'barrel' },
  woodcrate: { n: 'Wooden Crate', solid: true, h: 1.0, cont: { type: 'crate', cap: 50 } },
  generator: { n: 'Generator', solid: true, h: 0.9 },
  crop: { n: 'Farm Plot', solid: false, h: 0.6 },
  hay: { n: 'Hay Bale', solid: true, h: 0.9 },
  washer: { n: 'Washing Machine', solid: true, h: 1.0, cont: { type: 'crate', cap: 10 } },
  counterbar: { n: 'Bar Counter', solid: true, h: 1.1, cont: { type: 'counter', cap: 20 } },
  logwall: { n: 'Log Pile', solid: true, h: 0.8 },
  car_wreck: { n: 'Burnt Car', solid: true, h: 1.2 },
  sign: { n: 'Sign', solid: false, h: 2.6 },
  grave: { n: 'Grave', solid: false, h: 0.6 },
  hydrant: { n: 'Fire Hydrant', solid: 'circle', rad: 0.15, h: 0.6 },
};

// Crop types for farming
const CROPS = {
  carrot: { n: 'Carrots', item: 'Carrots', days: 4, yield: [3, 6], col: '#f07a1a', leaf: '#4aa02a' },
  potato: { n: 'Potatoes', item: 'Potato', days: 5, yield: [3, 7], col: '#b8915a', leaf: '#3a8a2a' },
  tomato: { n: 'Tomatoes', item: 'Tomato', days: 4, yield: [4, 8], col: '#e0301a', leaf: '#2a7a2a' },
  cabbage: { n: 'Cabbages', item: 'Cabbage', days: 5, yield: [2, 4], col: '#9ad06a', leaf: '#6ab04a' },
};

// Floor types
const FL = {
  GRASS: 0, GRASS2: 1, DIRT: 2, ASPHALT: 3, SIDEWALK: 4, WOOD: 5, TILE: 6, CARPET: 7, WATER: 8, SAND: 9,
  CONCRETE: 10, GRAVEL: 11, FOREST: 12, FURROW: 13, LINO: 14, DEEPWATER: 15, PARKING: 16,
};
const FLOOR_NAMES = ['Grass', 'Grass', 'Dirt', 'Asphalt', 'Sidewalk', 'Wooden Floor', 'Tiles', 'Carpet', 'Water', 'Sand', 'Concrete', 'Gravel', 'Forest Floor', 'Furrow', 'Linoleum', 'Deep Water', 'Parking Lot'];
// Wall types
const WT = { NONE: 0, EXT: 1, INT: 2, BRICK: 3, PICKET: 4, WOODFENCE: 5, CHAIN: 6, BUILT: 7, LOG: 8 };
const WALL_INFO = {
  1: { n: 'Wall', h: WALL_H, see: false, climb: false, hp: 0 },
  2: { n: 'Wall', h: WALL_H, see: false, climb: false, hp: 0 },
  3: { n: 'Brick Wall', h: WALL_H, see: false, climb: false, hp: 0 },
  4: { n: 'Picket Fence', h: 0.9, see: true, climb: 1.0, hp: 120, fence: true },
  5: { n: 'Wooden Fence', h: 1.8, see: false, climb: 2.4, hp: 200, fence: true },
  6: { n: 'Chain-link Fence', h: 1.8, see: true, climb: 2.4, hp: 250, fence: true },
  7: { n: 'Wooden Wall', h: WALL_H, see: false, climb: false, hp: 450, built: true },
  8: { n: 'Log Wall', h: 1.3, see: true, climb: 1.6, hp: 600, built: true, fence: true },
};
