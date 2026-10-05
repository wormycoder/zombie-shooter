'use strict';
// ---------------------------------------------------------------------------
// Loot tables. Keys are "<roomType>.<containerType>", with "*.<containerType>" fallbacks.
// Entries: [itemIdOrGroup, weight]. Groups start with '@'. "Id*N" spawns N copies.
// ---------------------------------------------------------------------------
const LOOT_GROUPS = {
  canned: ['CannedBeans', 'CannedSoup', 'CannedCorn', 'CannedPeas', 'CannedTuna', 'CannedChili', 'CannedPeaches', 'CannedCarrots'],
  snack: ['Crisps', 'Chocolate', 'CandyBar', 'Crackers', 'GranolaBar', 'Cereal', 'PeanutButter', 'Honey', 'Pickles'],
  fridge: ['Milk', 'Cheese', 'Egg', 'Egg', 'Lettuce', 'Carrots', 'Tomato', 'Steak', 'Chicken', 'GroundBeef', 'Sausage', 'Apple', 'Orange', 'Banana', 'Pop', 'Beer', 'JuiceBox', 'FrozenPizza', 'IceCream', 'Cabbage', 'Bread', 'WaterBottle'],
  drink: ['Pop', 'PopOrange', 'JuiceBox', 'WaterBottle', 'WaterBottle', 'Beer'],
  meds: ['Bandage', 'Bandage', 'Painkillers', 'Disinfectant', 'AlcoholWipes', 'Vitamins', 'SleepingPills', 'Antidepressants', 'BetaBlockers', 'SutureNeedle', 'Tweezers', 'SterileBandage'],
  tools: ['Hammer', 'Saw', 'Screwdriver', 'PipeWrench', 'DuctTape', 'Glue', 'NailsBox', 'Flashlight', 'Battery', 'Scissors'],
  clothes: ['TShirt', 'TShirt', 'Shirt', 'TankTop', 'Hoodie', 'Sweater', 'DenimJacket', 'Jeans', 'Jeans', 'Trousers', 'Shorts', 'Sneakers', 'DressShoes', 'Boots', 'Beanie', 'BaseballCap', 'Scarf', 'Gloves', 'WinterCoat', 'CargoPants'],
  books: ['Novel', 'Magazine', 'Magazine', 'ComicBook', 'Newspaper', '@skillbook1', '@skillbook1', '@skillbook2'],
  bags: ['SchoolBag', 'SchoolBag', 'DuffelBag', 'HikingBag', 'FannyPack', 'PlasticBag'],
  skillbook1: [], skillbook2: [], skillbook3: [],
  junk: ['EmptyBottle', 'Newspaper', 'GarbageBag', 'RippedSheets', 'Twigs', 'PlasticBag', 'Pop', 'Crisps'],
  seeds: ['CarrotSeeds', 'PotatoSeeds', 'TomatoSeeds', 'CabbageSeeds'],
};
for (const [sk] of SKILL_BOOKS) for (let i = 1; i <= 3; i++) LOOT_GROUPS['skillbook' + i].push('Book' + sk + i);

const LOOT = {
  // --- residential
  'kitchen.counter': { n: [1, 4], empty: 0.2, items: [['@canned', 30], ['@snack', 18], ['KitchenKnife', 6], ['CanOpener', 7], ['FryingPan', 3], ['Pot', 4], ['RollingPin', 2], ['Lighter', 3], ['Matches', 4], ['WaterBottle', 6], ['GarbageBag', 5], ['Flashlight', 2], ['Battery', 3], ['Coffee', 3], ['Bucket', 1], ['PlasticBag', 3], ['Whiskey', 1], ['Wine', 2], ['Scissors', 1], ['DuctTape', 1]] },
  'kitchen.fridge': { n: [2, 6], empty: 0.1, items: [['@fridge', 1]] },
  'kitchen.oven': { n: [0, 1], empty: 0.6, items: [['Pot', 3], ['FryingPan', 2], ['FrozenPizza', 1]] },
  'bathroom.medcab': { n: [1, 4], empty: 0.2, items: [['@meds', 1]] },
  'bathroom.counter': { n: [1, 3], empty: 0.3, items: [['@meds', 3], ['RippedSheets', 2], ['Scissors', 1], ['Tweezers', 1]] },
  'bedroom.wardrobe': { n: [2, 5], empty: 0.1, items: [['@clothes', 20], ['@bags', 3], ['Sheet', 3], ['LeatherJacket', 1], ['MotoHelmet', 0.3], ['BaseballBat', 1], ['LeatherGloves', 1]] },
  'bedroom.dresser': { n: [1, 4], empty: 0.15, items: [['@clothes', 12], ['DigitalWatch', 2], ['@books', 3], ['Pistol', 0.6], ['Revolver', 0.5], ['Box9mm', 0.5], ['Box38', 0.5], ['Cigarettes', 2], ['Lighter', 1], ['Sheet', 3], ['Glasses', 1], ['Painkillers', 1]] },
  'bedroom.nightstand': { n: [0, 2], empty: 0.35, items: [['@books', 6], ['DigitalWatch', 2], ['Flashlight', 2], ['Battery', 2], ['Painkillers', 1], ['SleepingPills', 1], ['Pistol', 0.4], ['Glasses', 1], ['NoiseMaker', 1.5]] },
  'living.bookshelf': { n: [1, 5], empty: 0.15, items: [['@books', 1]] },
  'living.dresser': { n: [1, 3], empty: 0.3, items: [['@books', 3], ['Battery', 2], ['Flashlight', 1], ['Radio', 1], ['Cigarettes', 1], ['Map', 1]] },
  'garage.toolcab': { n: [2, 5], empty: 0.1, items: [['@tools', 30], ['Axe', 1.2], ['WoodAxe', 0.6], ['Shovel', 2], ['Trowel', 2], ['GasCan', 3], ['Crowbar', 1.2], ['Plank', 3], ['GolfClub', 1], ['BaseballBat', 1.5], ['Sledgehammer', 0.4], ['FishingRod', 1], ['Toolbox', 1], ['@seeds', 2], ['WateringCan', 1], ['Bucket', 1], ['Generator', 0.25], ['LeadPipe', 1], ['HandAxe', 1]] },
  'garage.crate': { n: [1, 4], empty: 0.2, items: [['@tools', 10], ['@junk', 6], ['Plank', 4], ['Log', 1], ['GasCan', 2], ['FishingRod', 1], ['Sheet', 1]] },
  // --- generic fallbacks
  '*.counter': { n: [0, 3], empty: 0.35, items: [['@snack', 8], ['@canned', 6], ['@junk', 8], ['WaterBottle', 3], ['Lighter', 2], ['Battery', 1]] },
  '*.fridge': { n: [1, 4], empty: 0.15, items: [['@fridge', 1]] },
  '*.wardrobe': { n: [1, 4], empty: 0.2, items: [['@clothes', 1]] },
  '*.dresser': { n: [0, 3], empty: 0.3, items: [['@clothes', 5], ['@books', 3], ['Battery', 1]] },
  '*.nightstand': { n: [0, 2], empty: 0.4, items: [['@books', 1]] },
  '*.bookshelf': { n: [1, 4], empty: 0.2, items: [['@books', 1]] },
  '*.medcab': { n: [0, 3], empty: 0.3, items: [['@meds', 1]] },
  '*.desk': { n: [0, 3], empty: 0.3, items: [['Newspaper', 3], ['Magazine', 2], ['@snack', 2], ['Scissors', 1], ['Lighter', 1], ['Flashlight', 1], ['Battery', 1], ['Pop', 1], ['Map', 0.6]] },
  '*.crate': { n: [1, 4], empty: 0.25, items: [['@junk', 6], ['@tools', 3], ['@canned', 3], ['Plank', 2], ['Sheet', 1]] },
  '*.toolcab': { n: [1, 4], empty: 0.2, items: [['@tools', 1]] },
  '*.trash': { n: [0, 3], empty: 0.3, items: [['@junk', 8], ['Newspaper', 2], ['Bread', 1], ['Banana', 1]] },
  '*.mailbox': { n: [0, 1], empty: 0.6, items: [['Newspaper', 3], ['Magazine', 2], ['ComicBook', 1]] },
  '*.oven': { n: [0, 1], empty: 0.8, items: [['Pot', 1]] },
  '*.locker': { n: [0, 3], empty: 0.3, items: [['@clothes', 4], ['WaterBottle', 1], ['@snack', 2], ['Bandage', 1], ['DuffelBag', 1]] },
  '*.shelf': { n: [1, 4], empty: 0.25, items: [['@junk', 3], ['@canned', 2], ['@books', 1]] },
  '*.register': { n: [0, 2], empty: 0.4, items: [['@snack', 3], ['Lighter', 1], ['Cigarettes', 2], ['Newspaper', 1]] },
  '*.cooler': { n: [2, 5], empty: 0.1, items: [['@drink', 1]] },
  '*.glovebox': { n: [0, 2], empty: 0.4, items: [['Flashlight', 2], ['Battery', 1], ['Map', 2], ['Cigarettes', 1], ['Lighter', 1], ['Bandage', 1], ['Pistol', 0.2], ['@snack', 1]] },
  '*.trunk': { n: [0, 3], empty: 0.35, items: [['GasCan', 2], ['@tools', 3], ['@bags', 1], ['WaterBottle', 1], ['Sheet', 1], ['@junk', 2], ['BaseballBat', 0.5]] },
  '*.campfire': { n: [0, 0], empty: 1, items: [] },
  '*.barrel': { n: [0, 0], empty: 1, items: [] },
  // --- stores
  'grocery.shelf': { n: [4, 9], empty: 0.05, items: [['@canned', 40], ['@snack', 30], ['@drink', 15], ['Bread', 6], ['Coffee', 3], ['DogFood', 3], ['GarbageBag', 3], ['Matches', 2], ['Battery', 2]] },
  'grocery.fridge': { n: [4, 9], empty: 0.05, items: [['@fridge', 1]] },
  'grocery.cooler': { n: [4, 8], empty: 0.05, items: [['@drink', 4], ['Milk', 2], ['Beer', 2]] },
  'grocery.crate': { n: [2, 6], empty: 0.1, items: [['@canned', 6], ['@snack', 4], ['Apple', 2], ['Orange', 2], ['Potato', 2], ['Cabbage', 1]] },
  'hardware.shelf': { n: [2, 6], empty: 0.1, items: [['Hammer', 6], ['Saw', 5], ['Screwdriver', 5], ['NailsBox', 8], ['DuctTape', 4], ['Glue', 3], ['Crowbar', 2], ['Axe', 2], ['HandAxe', 2], ['Shovel', 3], ['Trowel', 3], ['@seeds', 6], ['WateringCan', 2], ['Bucket', 2], ['GasCan', 3], ['Flashlight', 3], ['Battery', 5], ['Sledgehammer', 1], ['PipeWrench', 2], ['GarbageBag', 2], ['Toolbox', 1.5], ['WoodAxe', 1], ['LeatherGloves', 2], ['Generator', 0.5], ['BookCarpentry1', 1], ['BookFarming1', 1]] },
  'hardware.crate': { n: [2, 5], empty: 0.15, items: [['Plank', 6], ['NailsBox', 5], ['Log', 2], ['GasCan', 1], ['Generator', 0.6]] },
  'gunstore.shelf': { n: [1, 4], empty: 0.15, items: [['Pistol', 4], ['Revolver', 3], ['Shotgun', 3], ['HuntingRifle', 2], ['Box9mm', 6], ['Box38', 5], ['BoxShells', 6], ['Box308', 4], ['HuntingKnife', 3], ['MilitaryBag', 1], ['MilitaryJacket', 1], ['CargoPants', 1], ['Boots', 1]] },
  'gunstore.crate': { n: [1, 3], empty: 0.3, items: [['Box9mm', 3], ['BoxShells', 3], ['Box308', 2], ['Box556', 1], ['AssaultRifle', 0.6], ['BulletVest', 0.5]] },
  'pharmacy.shelf': { n: [3, 7], empty: 0.05, items: [['@meds', 25], ['@snack', 4], ['@drink', 3], ['FirstAidKit', 2], ['Magazine', 2], ['Glasses', 1]] },
  'pharmacy.crate': { n: [2, 5], empty: 0.1, items: [['@meds', 1], ['Antibiotics', 0.5]] },
  'restaurant.fridge': { n: [4, 8], empty: 0.05, items: [['Burger', 5], ['Fries', 4], ['GroundBeef', 4], ['Chicken', 2], ['Lettuce', 2], ['Tomato', 2], ['Cheese', 2], ['Pop', 3], ['Bread', 2]] },
  'restaurant.counter': { n: [1, 4], empty: 0.15, items: [['Burger', 3], ['Fries', 3], ['Pop', 3], ['KitchenKnife', 2], ['FryingPan', 2], ['Pot', 1], ['CanOpener', 1], ['@canned', 2]] },
  'police.locker': { n: [1, 4], empty: 0.1, items: [['Pistol', 4], ['Shotgun', 2], ['Box9mm', 5], ['BoxShells', 3], ['Nightstick', 3], ['PoliceShirt', 2], ['PolicePants', 2], ['PoliceCap', 2], ['BulletVest', 1.5], ['Flashlight', 2], ['Bandage', 1], ['DuffelBag', 1], ['AssaultRifle', 0.4], ['Box556', 0.6]] },
  'police.desk': { n: [0, 3], empty: 0.3, items: [['Newspaper', 2], ['Box9mm', 1], ['Flashlight', 1], ['Battery', 1], ['Pop', 1], ['@snack', 1], ['Map', 1], ['CarKey', 0.5]] },
  'gasstation.shelf': { n: [2, 6], empty: 0.1, items: [['@snack', 20], ['@drink', 12], ['Cigarettes', 5], ['Lighter', 4], ['Battery', 3], ['Flashlight', 2], ['Map', 2], ['Magazine', 2], ['GasCan', 3], ['DuctTape', 1]] },
  'gasstation.cooler': { n: [3, 7], empty: 0.05, items: [['@drink', 4], ['Beer', 2], ['Milk', 1]] },
  'clothing.shelf': { n: [2, 6], empty: 0.1, items: [['@clothes', 20], ['@bags', 3], ['LeatherJacket', 1], ['WinterCoat', 2], ['LeatherGloves', 1]] },
  'clothing.wardrobe': { n: [3, 7], empty: 0.05, items: [['@clothes', 1]] },
  'bookstore.bookshelf': { n: [3, 8], empty: 0.05, items: [['@books', 6], ['@skillbook1', 6], ['@skillbook2', 3], ['@skillbook3', 1], ['Map', 1]] },
  'bookstore.shelf': { n: [2, 6], empty: 0.1, items: [['@books', 6], ['@skillbook1', 4], ['@skillbook2', 2], ['@skillbook3', 0.7]] },
  'bar.counter': { n: [1, 5], empty: 0.1, items: [['Beer', 6], ['Whiskey', 3], ['Wine', 2], ['Crisps', 2], ['Cigarettes', 2], ['Lighter', 1], ['EmptyBottle', 2]] },
  'bar.fridge': { n: [3, 7], empty: 0.05, items: [['Beer', 6], ['Pop', 2], ['Cheese', 1], ['Sausage', 1]] },
  'bar.shelf': { n: [2, 5], empty: 0.1, items: [['Whiskey', 3], ['Wine', 3], ['Beer', 3], ['EmptyBottle', 2]] },
  'warehouse.crate': { n: [2, 6], empty: 0.15, items: [['@canned', 6], ['@tools', 4], ['Plank', 4], ['NailsBox', 3], ['@drink', 3], ['GasCan', 1], ['Sheet', 2], ['@clothes', 2], ['Generator', 0.3]] },
  'warehouse.shelf': { n: [2, 5], empty: 0.15, items: [['@tools', 4], ['@canned', 4], ['@snack', 3], ['GarbageBag', 2], ['Battery', 2]] },
  'office.desk': { n: [0, 3], empty: 0.25, items: [['Newspaper', 3], ['Magazine', 2], ['@snack', 3], ['Pop', 2], ['Scissors', 1], ['Flashlight', 1], ['Painkillers', 1], ['Map', 0.5]] },
  'office.shelf': { n: [1, 3], empty: 0.3, items: [['@books', 3], ['Newspaper', 2]] },
  'barn.crate': { n: [1, 4], empty: 0.2, items: [['@seeds', 6], ['Shovel', 2], ['Trowel', 2], ['WateringCan', 2], ['Bucket', 2], ['Axe', 1], ['WoodAxe', 0.8], ['Log', 2], ['Plank', 3], ['GasCan', 2], ['Potato', 2], ['Carrots', 2], ['Sledgehammer', 0.5], ['HuntingRifle', 0.4], ['Box308', 0.5], ['BookFarming1', 1], ['BookFarming2', 0.5]] },
  'barn.toolcab': { n: [1, 4], empty: 0.15, items: [['@tools', 4], ['@seeds', 3], ['Shovel', 1], ['GasCan', 1]] },
  'cabin.crate': { n: [1, 4], empty: 0.15, items: [['FishingRod', 3], ['Axe', 2], ['HuntingRifle', 1], ['Box308', 1.5], ['HuntingKnife', 2], ['@canned', 4], ['Log', 2], ['Matches', 2], ['Lighter', 1], ['HikingBag', 1.5], ['BookFishing1', 1], ['BookForaging1', 1], ['WaterBottle', 2], ['Worms', 1]] },
  'school.locker': { n: [0, 3], empty: 0.25, items: [['SchoolBag', 4], ['@books', 4], ['@snack', 3], ['@clothes', 2], ['BaseballBat', 1], ['JuiceBox', 2]] },
  'school.desk': { n: [0, 2], empty: 0.4, items: [['@books', 4], ['Scissors', 1], ['Newspaper', 1], ['@snack', 1]] },
  'church.shelf': { n: [0, 2], empty: 0.5, items: [['Novel', 2], ['Newspaper', 1], ['Matches', 1], ['WaterBottle', 1]] },
  'firestation.locker': { n: [1, 3], empty: 0.15, items: [['FireJacket', 3], ['FirePants', 3], ['FireHelmet', 2], ['Axe', 3], ['Boots', 2], ['Flashlight', 2], ['Bandage', 2], ['Crowbar', 1]] },
  'motel.dresser': { n: [0, 3], empty: 0.3, items: [['@clothes', 4], ['@books', 2], ['Cigarettes', 1], ['Pistol', 0.3], ['DuffelBag', 1], ['Whiskey', 1]] },
  'military.crate': { n: [2, 5], empty: 0.05, items: [['AssaultRifle', 2], ['Box556', 5], ['Pistol', 2], ['Box9mm', 3], ['MilitaryBag', 2], ['MilitaryJacket', 2], ['BulletVest', 2], ['CargoPants', 2], ['Boots', 2], ['@canned', 3], ['SterileBandage', 2], ['Antibiotics', 1]] },
};

const Loot = {
  expand(entry) {
    if (entry[0] === '@') {
      const g = LOOT_GROUPS[entry.slice(1)];
      return this.expand(g[Math.floor(R.next() * g.length)]);
    }
    return entry;
  },
  roll(roomType, contType, luck) {
    const tbl = LOOT[roomType + '.' + contType] || LOOT['*.' + contType];
    const out = [];
    if (!tbl) return out;
    const lm = (G && G.sb) ? G.sb.loot : 1;
    let n = Math.round(R.int(tbl.n[0], tbl.n[1]) * lm);
    let empty = (tbl.empty || 0) / lm;
    if (luck > 0) { empty *= 0.7; if (R.chance(0.3)) n++; }
    if (luck < 0) { empty *= 1.3; if (R.chance(0.3)) n--; }
    if (R.chance(empty)) n = 0;
    for (let i = 0; i < n; i++) {
      let id = this.expand(R.weighted(tbl.items));
      let cnt = 1;
      const m = id.match(/^(\w+)\*(\d+)$/);
      if (m) { id = m[1]; cnt = +m[2]; }
      for (let k = 0; k < cnt; k++) {
        const it = Items.make(id, { loot: true });
        if (!it) continue;
        const d = ITEMS[id];
        if (d.fresh !== undefined) it.age = R.f(0, d.fresh * 24 * 0.6);
        if (d.wpn) it.cond = R.int(Math.ceil(d.wpn.cond * 0.4), d.wpn.cond);
        if (d.gun) { it.ammo = R.chance(0.3) ? R.int(0, d.gun.cap) : 0; }
        if (d.uses && d.cat !== 'Material') it.uses = R.int(Math.ceil(d.uses * 0.3), d.uses);
        if (d.fluid && id === 'WaterBottle') it.fl = R.chance(0.75) ? d.fluid : R.f(0, d.fluid);
        out.push(it);
      }
    }
    return out;
  },
  // pockets of a zombie
  zombiePockets() {
    const out = [];
    const tbl = [['Lighter', 3], ['Cigarettes', 3], ['Bandage', 2], ['Painkillers', 1], ['DigitalWatch', 3], ['Chocolate', 2], ['WaterBottle', 1], ['Bullets9mm*4', 1], ['Pop', 1], ['RippedSheets', 2], ['Newspaper', 1], ['HouseKey', 1], ['KitchenKnife', 0.5], ['Battery', 1], ['Map', 0.5]];
    const n = R.chance(0.55) ? R.int(1, 2) : 0;
    for (let i = 0; i < n; i++) {
      let id = R.weighted(tbl), cnt = 1;
      const m = id.match(/^(\w+)\*(\d+)$/);
      if (m) { id = m[1]; cnt = +m[2]; }
      for (let k = 0; k < cnt; k++) {
        const it = Items.make(id, { loot: true });
        if (it) out.push(it);
      }
    }
    return out;
  },
};
