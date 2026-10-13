/* Guildstone catalogue data. Every number here mirrors the design chart; the live game reads the same values
   from the server, so this file is documentation first and a tuning sheet second. */

const PROFESSIONS = {
  lumberjack: { name: 'Lumberjack', zone: 'Lumber Camp', color: '#6bc74a', icon: 'img/lumberjack.png' },
  miner: { name: 'Miner', zone: 'Quarry', color: '#3aa0ff', icon: 'img/miner.png' },
  butcher: { name: 'Butcher', zone: 'Hunting Grounds', color: '#f25a5a', icon: 'img/butcher.png' },
  assassin: { name: 'Assassin', zone: 'Skeleton Yard', color: '#a259ff', icon: 'img/assassin.png' }
};
const PROF_IDS = Object.keys(PROFESSIONS);

/* Tier gates and drop rates (1 in N gather cycles; a cycle is 3 s). T0 drops every cycle. */
const TIERS = [
  { id: 'T0', label: 'Base', gate: 'Nothing — start of game', rate: null },
  { id: 'T1', label: 'Tier 1', gate: 'Own that profession\u2019s L1 suit', rate: 40 },
  { id: 'T2', label: 'Tier 2', gate: 'Own that profession\u2019s L2 suit', rate: 120 },
  { id: 'T3', label: 'Tier 3', gate: 'Own that profession\u2019s L3 suit', rate: 300 },
  { id: 'T4', label: 'Tier 4', gate: 'Own that profession\u2019s L4 suit', rate: 800 }
];

/* [raw, refined] per tier per profession. Workshop refines 5 raw into 1 refined. */
const LADDER = {
  lumberjack: [
    ['wood', 'Wood', 'plank', 'Plank'],
    ['hardwood', 'Hardwood', 'timber_beam', 'Timber Beam'],
    ['ironwood', 'Ironwood', 'ironwood_plank', 'Ironwood Plank'],
    ['heartwood', 'Heartwood', 'heartwood_core', 'Heartwood Core'],
    ['eldertree_root', 'Eldertree Root', 'elder_totem', 'Elder Totem']
  ],
  miner: [
    ['rock', 'Rock', 'brick', 'Brick'],
    ['iron_ore', 'Iron Ore', 'iron_ingot', 'Iron Ingot'],
    ['silver_ore', 'Silver Ore', 'silver_ingot', 'Silver Ingot'],
    ['mithril_ore', 'Mithril Ore', 'mithril_ingot', 'Mithril Ingot'],
    ['starstone', 'Starstone', 'star_core', 'Star Core']
  ],
  butcher: [
    ['meat', 'Meat', 'jerky', 'Jerky'],
    ['hide', 'Hide', 'leather', 'Leather'],
    ['horn', 'Horn', 'horn_plate', 'Horn Plate'],
    ['prime_pelt', 'Prime Pelt', 'royal_leather', 'Royal Leather'],
    ['behemoth_hide', 'Behemoth Hide', 'behemoth_plate', 'Behemoth Plate']
  ],
  assassin: [
    ['bone', 'Bone', 'bonedust', 'Bonedust'],
    ['fang', 'Fang', 'fang_powder', 'Fang Powder'],
    ['skull', 'Skull', 'skull_charm', 'Skull Charm'],
    ['wraith_bone', 'Wraith Bone', 'wraith_ash', 'Wraith Ash'],
    ['lich_marrow', 'Lich Marrow', 'lich_sigil', 'Lich Sigil']
  ]
};

/* Combination drops: invisible until the gate is met, then roll in the listed zones. */
const COMBOS = [
  { id: 'deepwood_amber', name: 'Deepwood Amber', gateText: 'Lumberjack L2 + Miner L2', gate: { lumberjack: 2, miner: 2 }, zones: ['lumberjack', 'miner'], rate: 150, tier: 'C2' },
  { id: 'shadow_sinew', name: 'Shadow Sinew', gateText: 'Butcher L2 + Assassin L2', gate: { butcher: 2, assassin: 2 }, zones: ['butcher', 'assassin'], rate: 150, tier: 'C2' },
  { id: 'ghostwood', name: 'Ghostwood', gateText: 'Lumberjack L3 + Assassin L3', gate: { lumberjack: 3, assassin: 3 }, zones: ['lumberjack', 'assassin'], rate: 400, tier: 'C3' },
  { id: 'bloodstone', name: 'Bloodstone', gateText: 'Miner L3 + Butcher L3', gate: { miner: 3, butcher: 3 }, zones: ['miner', 'butcher'], rate: 400, tier: 'C3' },
  { id: 'antrom_essence', name: 'Antrom Essence', gateText: 'All four professions at L3', gate: { lumberjack: 3, miner: 3, butcher: 3, assassin: 3 }, zones: PROF_IDS, rate: 500, tier: 'C4' },
  { id: 'guildstone_shard', name: 'Guildstone Shard', gateText: 'All four professions at L4', gate: { lumberjack: 4, miner: 4, butcher: 4, assassin: 4 }, zones: PROF_IDS, rate: 5000, tier: 'C5' }
];
const COMBO_L2 = { lumberjack: 'deepwood_amber', miner: 'deepwood_amber', butcher: 'shadow_sinew', assassin: 'shadow_sinew' };
const COMBO_L3 = { lumberjack: 'ghostwood', assassin: 'ghostwood', miner: 'bloodstone', butcher: 'bloodstone' };

/* Build the flat material index. */
const MATERIALS = {};
for (const p of PROF_IDS) {
  LADDER[p].forEach(([rawId, rawName, refId, refName], t) => {
    const tier = TIERS[t];
    const ext = t === 0 ? 'png' : 'jpg';
    MATERIALS[rawId] = { id: rawId, name: rawName, kind: 'raw', tier: tier.id, profession: p, zones: [p], gate: tier.gate, rate: tier.rate, img: `img/${t === 0 ? rawId : 'res_' + rawId}.${ext}`, sellable: t === 0 };
    MATERIALS[refId] = { id: refId, name: refName, kind: 'refined', tier: tier.id, profession: p, from: rawId, gate: `Workshop: 5 ${rawName}`, img: `img/${t === 0 ? refId : 'res_' + refId}.${ext}`, sellable: t === 0 };
  });
}
for (const c of COMBOS) {
  MATERIALS[c.id] = { id: c.id, name: c.name, kind: 'combo', tier: c.tier, zones: c.zones, gate: c.gateText, rate: c.rate, img: `img/res_${c.id}.jpg`, sellable: false };
}
MATERIALS.coin = { id: 'coin', name: 'Coins', kind: 'currency', tier: 'T0', gate: 'Sell base materials at the Depot', img: 'img/coin.png', sellable: false };

/* Existing suit wearables (Polygon collections). Thumbnails come from the catalyst. */
const SUIT_COLLECTION = 'urn:decentraland:matic:collections-v2:0xf676c2e2768f415a10fa1703a5100141084f63b5';
const ASSASSIN_COLLECTION = 'urn:decentraland:matic:collections-v2:0x0bf152a83a6fc55066c2b664b164ca2916ad38f5';
const SUIT_IDS = { butcher: [0, 3, 6, 9], lumberjack: [1, 4, 7, 10], miner: [2, 5, 8, 11] };
const ASSASSIN_PIECES = [
  [0, 'Ether Assassin Boots'],
  [1, 'Ether Assassin Gloves'],
  [3, 'Ether Assassin Pants'],
  [2, 'Ether Assassin Armor']
];
const thumb = (urn) => `https://peer.decentraland.org/lambdas/collections/contents/${urn}/thumbnail`;
const SUIT_MULT = [1, 2, 3, 5, 8];
const SUIT_BAG = [200, 500, 1000, 2000, 4000];

function ref(p, t) { return LADDER[p][t][2]; }

/* Recipes. `cost` is a list of [materialId, amount]. */
function suitRecipe(p, level) {
  const others = PROF_IDS.filter((o) => o !== p);
  switch (level) {
    case 1:
      return { cost: [[ref(p, 0), 300], ...others.map((o) => [ref(o, 0), 100]), ['coin', 500]], requires: [`${PROFESSIONS[p].name} Lv 10`], drives: 'Visit all four zones once' };
    case 2:
      return { cost: [[ref(p, 1), 80], [ref(p, 0), 600]], requires: [`Own ${PROFESSIONS[p].name} L1`, `${PROFESSIONS[p].name} Lv 20`], drives: 'Commit to a zone' };
    case 3: {
      const partner = PROF_IDS.find((o) => o !== p && COMBO_L2[o] === COMBO_L2[p]);
      return { cost: [[ref(p, 2), 60], [COMBO_L2[p], 100], [ref(p, 1), 40]], requires: [`Own ${PROFESSIONS[p].name} L2`, `${PROFESSIONS[p].name} Lv 30`, `${PROFESSIONS[partner].name} L2 (for ${MATERIALS[COMBO_L2[p]].name})`], drives: 'Level a second profession' };
    }
    case 4:
      return { cost: [[ref(p, 3), 50], ['antrom_essence', 60], [COMBO_L3[p], 60]], requires: [`Own ${PROFESSIONS[p].name} L3`, `${PROFESSIONS[p].name} Lv 40`, 'All four professions at L3 (for Essence)'], drives: 'Level everything' };
  }
}

const RELICS = {
  lumberjack: { id: 'woodwarden_cloak', name: 'Woodwarden Cloak', slot: 'Back' },
  miner: { id: 'stonelord_crown', name: 'Stonelord Crown', slot: 'Head' },
  butcher: { id: 'beastmaster_mantle', name: 'Beastmaster Mantle', slot: 'Shoulders' },
  assassin: { id: 'reaper_veil', name: 'Reaper Veil', slot: 'Mask' }
};

const WEARABLES = [];
WEARABLES.push({
  id: 'guildstone_ring', name: 'Antrom Guildstone Ring', group: 'ring', rarity: 'Legendary', collection: 'Citrine Ring collection',
  img: 'img/item_guildstone_ring.jpg', effect: 'Smart wearable: gather anywhere in Decentraland, open your backpack, guild and professions from any scene.',
  cost: [], requires: ['Free claim at the Antrom camp'], drives: 'The launcher. Everything below is earned while wearing it.'
});
for (const p of PROF_IDS) {
  for (let level = 1; level <= 4; level++) {
    const r = suitRecipe(p, level);
    const urn = p === 'assassin' ? `${ASSASSIN_COLLECTION}:${ASSASSIN_PIECES[level - 1][0]}` : `${SUIT_COLLECTION}:${SUIT_IDS[p][level - 1]}`;
    const name = p === 'assassin' ? ASSASSIN_PIECES[level - 1][1] : `${PROFESSIONS[p].name} L${level}`;
    const unlocks = level < 4 ? `Unlocks ${LADDER[p][level][1]} drops in the ${PROFESSIONS[p].zone}` : `Unlocks ${LADDER[p][4][1]} drops in the ${PROFESSIONS[p].zone}`;
    WEARABLES.push({
      id: `${p}_l${level}`, name, group: p, level, rarity: ['Uncommon', 'Rare', 'Epic', 'Legendary'][level - 1],
      collection: p === 'assassin' ? 'Ether Assassin set' : 'Antrom Profession Suits', img: thumb(urn), urn,
      effect: `×${SUIT_MULT[level]} ${LADDER[p][0][1]} per cycle • +${SUIT_BAG[level]} backpack • ${unlocks}`,
      ...r
    });
  }
}
for (const p of PROF_IDS) {
  const relic = RELICS[p];
  WEARABLES.push({
    id: relic.id, name: relic.name, group: 'relic', profession: p, rarity: 'Mythic', collection: 'Antrom Relics (new)', slot: relic.slot,
    img: `img/item_${relic.id}.jpg`, effect: `Cosmetic ${relic.slot.toLowerCase()} piece. Stacks on top of any suit. Proof you finished the ${PROFESSIONS[p].name} road.`,
    cost: [[ref(p, 4), 40], ['antrom_essence', 80], [COMBO_L3[p], 40]],
    requires: [`Own ${PROFESSIONS[p].name} L4`, `${PROFESSIONS[p].name} Lv 50`], drives: 'Keep gathering after L4'
  });
}
WEARABLES.push({
  id: 'guildstone_crown', name: 'Guildstone Crown', group: 'crown', rarity: 'Unique', collection: 'Antrom Relics (new)', slot: 'Head',
  img: 'img/item_guildstone_crown.jpg', effect: 'The end of the road. Tiny supply; the leaderboard shows who holds one.',
  cost: [['guildstone_shard', 50], ['antrom_essence', 150]], relics: true,
  requires: ['Own all four Relics', 'All four professions at L4'], drives: 'The last thing anyone crafts'
});

/* Which wearables consume each material (for the material detail panel). */
const USED_IN = {};
for (const w of WEARABLES) for (const [m] of w.cost) (USED_IN[m] = USED_IN[m] || []).push(w.id);
for (const p of PROF_IDS) LADDER[p].forEach(([rawId, , refId]) => { (USED_IN[rawId] = USED_IN[rawId] || []).push(`refine:${refId}`); });

/* Pacing (one player, one profession at a time, hours of ring time per day). */
const CYCLES_PER_HOUR = 1200;
const STEP_CYCLES = { L1: 6000, L2: 400 * 40, L3: 300 * 120, L4: 250 * 300, Relic: 200 * 800 };
const SHARD_CYCLES = 50 * 5000;
function milestones(hoursPerDay) {
  const d = (c) => c / CYCLES_PER_HOUR / hoursPerDay;
  const l1 = 4 * STEP_CYCLES.L1, l2 = l1 + 4 * STEP_CYCLES.L2, l3 = l2 + 4 * STEP_CYCLES.L3;
  const allL4 = l3 + 4 * STEP_CYCLES.L4;
  return [
    ['First L1 suit', d(STEP_CYCLES.L1)],
    ['First L2 suit', d(STEP_CYCLES.L1 + STEP_CYCLES.L2)],
    ['All four L2', d(l2)],
    ['All four L3', d(l3)],
    ['First L4 suit', d(l3 + STEP_CYCLES.L4)],
    ['All four L4', d(allL4)],
    ['All four Relics', d(allL4 + 4 * STEP_CYCLES.Relic)],
    ['Guildstone Crown', d(allL4 + Math.max(4 * STEP_CYCLES.Relic, SHARD_CYCLES))]
  ];
}
