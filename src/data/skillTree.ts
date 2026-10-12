/**
 * Permanent perks bought with Dungeoneering tokens at the camp's Mentor.
 *
 * Design rules, so the tree stays coherent as it grows:
 * - Perks give starting levels, percentage bonuses, chances and new mechanics. They never
 *   give gear (that's the Armourer) or duplicate a camp structure.
 * - Each branch is one theme. Tiers open as you put ranks into the branch (TIER_GATES), and
 *   costs climb steeply, so a full tree is a long-term goal (hundreds of runs).
 * - Every branch ends in a one-rank capstone that changes how you play.
 */

export type Branch =
  | 'melee' | 'ranged' | 'magic' | 'defence' | 'survival' | 'devotion'
  | 'gathering' | 'crafting' | 'rogue' | 'fortune' | 'mastery';

export const BRANCHES: Array<{ id: Branch; name: string; color: number; theme: string }> = [
  { id: 'melee', name: 'Melee', color: 0xd05030, theme: 'Swords, strength and finishing blows.' },
  { id: 'ranged', name: 'Ranged', color: 0x50b050, theme: 'Bows, arrows and keeping your distance.' },
  { id: 'magic', name: 'Magic', color: 0x8070e0, theme: 'Spells, runes and raw arcane power.' },
  { id: 'mastery', name: 'Mastery', color: 0xe06090, theme: 'Combat with every style, and special attacks.' },
  { id: 'defence', name: 'Defence', color: 0x8a9ab0, theme: 'Hitpoints, armour and shrugging off hits.' },
  { id: 'survival', name: 'Survival', color: 0x50a040, theme: 'Food, healing and cheating death.' },
  { id: 'devotion', name: 'Prayer', color: 0x60a0e0, theme: 'Prayer points, potions and altars.' },
  { id: 'gathering', name: 'Gathering', color: 0xc0a040, theme: 'Mining, woodcutting, fishing and herbs.' },
  { id: 'crafting', name: 'Crafting', color: 0xd08040, theme: 'Cooking, smithing, fletching, herblore and jewellery.' },
  { id: 'rogue', name: 'Rogue', color: 0x9060a0, theme: 'Thieving, agility and Slayer.' },
  { id: 'fortune', name: 'Fortune', color: 0xe0c020, theme: 'Tokens, coins, drops and relics.' },
];

/** Ranks needed in a branch before each tier opens. */
export const TIER_GATES = [0, 2, 4, 7, 10, 13, 16];

export interface PerkDef {
  id: string;
  branch: Branch;
  /** Row in its branch (0 = first). */
  tier: number;
  /** Column within the tier: 0 left, 1 middle, 2 right. */
  lane: number;
  name: string;
  /** What each rank gives. */
  desc: string;
  /** Token cost of each rank; length = max rank. */
  costs: number[];
}

/** Base cost of a tier's first rank; later ranks cost 1.8x the previous one. */
const TIER_BASE = [15, 40, 100, 250, 600, 1500];
const CAPSTONE_COST = 25000;

const nice = (n: number) => (n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 50) * 50);
const costs = (tier: number, ranks: number) => Array.from({ length: ranks }, (_, i) => nice(TIER_BASE[tier] * 1.8 ** i));

const perk = (branch: Branch, tier: number, lane: number, id: string, name: string, ranks: number, desc: string): PerkDef => ({
  id, branch, tier, lane, name, desc, costs: tier === 6 ? [CAPSTONE_COST] : costs(tier, ranks),
});

export const PERKS: PerkDef[] = [
  // ---- Melee ----
  perk('melee', 0, 1, 'basic_training', 'Basic Training', 5, '+3 starting Attack and Strength levels per rank.'),
  { ...perk('melee', 1, 0, 'veterans_kit', "Veteran's Kit", 1, ''), costs: [60], desc: 'Unlocks the Armourer at camp, who sells better starting weapons and armour.' },
  perk('melee', 1, 2, 'precision', 'Precision', 5, '+3% melee accuracy per rank.'),
  perk('melee', 2, 1, 'brute_force', 'Brute Force', 5, '+3% melee max hit per rank.'),
  perk('melee', 3, 0, 'bloodlust', 'Bloodlust', 3, 'Melee kills heal 1 HP per rank.'),
  perk('melee', 3, 2, 'executioner', 'Executioner', 3, '+10% melee max hit per rank against monsters below a quarter of their HP.'),
  perk('melee', 4, 1, 'rage', 'Rage', 3, 'While below half HP: +5% melee accuracy and max hit per rank.'),
  perk('melee', 5, 1, 'crushing_blow', 'Crushing Blow', 3, '5% chance per rank for a melee hit to deal 50% more damage.'),
  perk('melee', 6, 1, 'warlords_might', "Warlord's Might", 1, 'Capstone: every melee attack has a 10% chance to strike twice.'),

  // ---- Ranged ----
  perk('ranged', 0, 1, 'rangers_kit', 'Ranger Training', 5, '+3 starting Ranged levels per rank.'),
  perk('ranged', 1, 0, 'eagle_eye', 'Eagle Eye', 5, '+3% ranged accuracy per rank.'),
  perk('ranged', 1, 2, 'quiver', 'Quiver', 3, 'Fired arrows are recovered 15% more often per rank (base 40%).'),
  perk('ranged', 2, 1, 'heavy_draw', 'Heavy Draw', 5, '+3% ranged max hit per rank.'),
  perk('ranged', 3, 0, 'long_range', 'Long Range', 2, '+1 bow range per rank.'),
  perk('ranged', 3, 2, 'sharpshooter', 'Sharpshooter', 3, '4% chance per rank for a hitting arrow to deal its maximum damage.'),
  perk('ranged', 4, 1, 'kiting', 'Kiting', 3, 'While wielding a bow, monsters are 5% less accurate against you per rank.'),
  perk('ranged', 5, 1, 'volley', 'Volley', 3, '4% chance per rank to loose a second arrow for free.'),
  perk('ranged', 6, 1, 'deadeye', 'Deadeye', 1, "Capstone: ranged attacks ignore a quarter of the target's Defence."),

  // ---- Magic ----
  perk('magic', 0, 1, 'apprentice_kit', 'Arcane Studies', 5, '+3 starting Magic levels per rank.'),
  perk('magic', 1, 0, 'arcane_focus', 'Arcane Focus', 5, '+3% magic accuracy per rank.'),
  perk('magic', 1, 2, 'arcane_thrift', 'Arcane Thrift', 3, '10% chance per rank that a spell costs no runes.'),
  perk('magic', 2, 1, 'spell_power', 'Spell Power', 5, '+3% magic max hit per rank.'),
  perk('magic', 3, 0, 'attunement', 'Attunement', 3, '+10% magic max hit per rank against monsters weak to magic.'),
  perk('magic', 3, 2, 'soul_siphon', 'Soul Siphon', 3, 'Magic kills restore 1 prayer point per rank.'),
  perk('magic', 4, 1, 'overcharge', 'Overcharge', 3, 'While above three-quarters HP: +5% magic accuracy and max hit per rank.'),
  perk('magic', 5, 1, 'battle_mage', 'Battle Mage', 3, 'Spells that miss still deal 1 damage per rank.'),
  perk('magic', 6, 1, 'chain_lightning', 'Chain Lightning', 1, 'Capstone: magic hits arc to another monster within 3 tiles for half the damage.'),

  // ---- Mastery (all styles) ----
  perk('mastery', 0, 1, 'killer_instinct', 'Killer Instinct', 5, '+2% accuracy and max hit with every style per rank.'),
  perk('mastery', 1, 0, 'adrenaline', 'Adrenaline', 3, 'Special attack energy refills 15% faster per rank.'),
  perk('mastery', 1, 2, 'monster_lore', 'Monster Lore', 3, "+3% accuracy and max hit per rank against monsters you've killed 100 times."),
  perk('mastery', 2, 1, 'weapon_mastery', 'Weapon Mastery', 2, 'Special attacks cost 5% less energy per rank.'),
  perk('mastery', 3, 1, 'giant_slayer', 'Giant Slayer', 3, '+5% accuracy and max hit per rank against bosses and elites.'),
  perk('mastery', 4, 1, 'battle_hardened', 'Battle Hardened', 3, '+10% combat XP (Attack, Strength, Defence, Ranged, Magic, Hitpoints) per rank.'),
  perk('mastery', 5, 1, 'momentum', 'Momentum', 3, 'Each kill gives +1% max hit until you leave the floor, up to 3% per rank.'),
  perk('mastery', 6, 1, 'grandmaster', 'Grandmaster', 1, 'Capstone: +10% accuracy and max hit with every style.'),

  // ---- Defence ----
  perk('defence', 0, 0, 'iron_will', 'Iron Will', 5, '+2 starting Hitpoints levels per rank.'),
  perk('defence', 0, 2, 'guard_drills', 'Guard Drills', 5, '+3 starting Defence levels per rank.'),
  perk('defence', 1, 1, 'toughness', 'Toughness', 5, 'Your defence rolls are 3% stronger per rank.'),
  perk('defence', 2, 1, 'constitution', 'Constitution', 5, '+1 maximum HP per rank.'),
  perk('defence', 3, 0, 'parry', 'Parry', 3, '4% chance per rank to block a melee hit completely.'),
  perk('defence', 3, 2, 'missile_ward', 'Missile Ward', 3, 'Ranged and magic hits on you deal 5% less damage per rank.'),
  perk('defence', 4, 1, 'last_stand', 'Last Stand', 3, 'While below a quarter HP, take 10% less damage per rank.'),
  perk('defence', 5, 1, 'bulwark', 'Bulwark', 3, 'The first hit you take on each floor deals 25% less damage per rank.'),
  perk('defence', 6, 1, 'juggernaut', 'Juggernaut', 1, 'Capstone: all damage you take is reduced by 10%.'),

  // ---- Survival ----
  perk('survival', 0, 1, 'packed_lunch', 'Packed Lunch', 5, 'Start each run with +2 trout per rank.'),
  perk('survival', 1, 0, 'hearty_meals', 'Hearty Meals', 3, 'Food heals +1 HP per rank.'),
  perk('survival', 1, 2, 'quick_eater', 'Quick Eater', 2, 'Eating delays your next attack 1 tick less per rank.'),
  perk('survival', 2, 1, 'second_wind', 'Second Wind', 2, 'Natural HP regen every 70 / 45 ticks instead of 100.'),
  perk('survival', 3, 0, 'forager', 'Forager', 3, 'Monsters drop herbs 25% more often per rank.'),
  perk('survival', 3, 2, 'fresh_air', 'Fresh Air', 3, 'Going down the stairs heals 10% of your HP per rank.'),
  perk('survival', 4, 1, 'field_medic', 'Field Medic', 3, 'Potions also heal 2 HP per rank.'),
  perk('survival', 5, 1, 'undying', 'Undying', 1, 'Once per run, survive a killing blow with 1 HP.'),
  perk('survival', 6, 1, 'phoenix', 'Phoenix', 1, 'Capstone: Undying can save you a second time each run.'),

  // ---- Prayer ----
  perk('devotion', 0, 1, 'blessed', 'Blessed', 5, '+4 starting Prayer levels per rank.'),
  perk('devotion', 1, 0, 'focus', 'Focus', 3, 'Prayer drains 10% slower per rank.'),
  perk('devotion', 1, 2, 'holy_supplies', 'Holy Supplies', 4, 'Start each run with +1 prayer potion per rank.'),
  perk('devotion', 2, 1, 'pilgrim', 'Pilgrim', 2, 'Going down the stairs restores 25% more prayer per rank.'),
  perk('devotion', 3, 0, 'bone_lore', 'Bone Lore', 3, 'Burying bones gives 25% more Prayer XP per rank.'),
  perk('devotion', 3, 2, 'potent_brews', 'Potent Brews', 3, 'Prayer potions restore 10% more per rank.'),
  perk('devotion', 4, 1, 'divine_favor', 'Divine Favour', 3, '5% chance per rank that a kill restores 3 prayer points.'),
  perk('devotion', 5, 1, 'sanctuary', 'Sanctuary', 2, 'The first time you pray at each altar, it also restores 50% of your HP per rank.'),
  perk('devotion', 6, 1, 'saint', 'Saint', 1, 'Capstone: the first time you run out of prayer on each floor, half your prayer points come back.'),

  // ---- Gathering ----
  perk('gathering', 0, 1, 'efficient_gatherer', 'Efficient Gatherer', 5, '+5% chance per gathering roll per rank.'),
  perk('gathering', 1, 0, 'rich_veins', 'Rich Veins', 3, '10% chance per rank to gather a bonus resource.'),
  perk('gathering', 1, 2, 'bountiful', 'Bountiful', 3, 'Rocks, trees, fishing spots and herb patches last 1 gather longer per rank.'),
  perk('gathering', 2, 1, 'gatherers_lore', "Gatherer's Lore", 3, '+10% Mining, Woodcutting and Fishing XP per rank.'),
  perk('gathering', 2, 0, 'field_cook', 'Field Cook', 3, 'Fishing has a 10% chance per rank to land a fish already cooked.'),
  perk('gathering', 2, 2, 'lumberjack', 'Lumberjack', 3, 'Logs you carry home give 25% more timber per rank.'),
  perk('gathering', 4, 0, 'surveyor', 'Surveyor', 3, 'Ores and bars you carry home give 25% more metal per rank.'),
  perk('gathering', 5, 1, 'earthbound', 'Earthbound', 3, 'Every successful gather heals 1 HP per rank.'),
  perk('gathering', 3, 1, 'herb_lore', 'Herb Lore', 3, '20% chance per rank to pick two herbs at once.'),
  perk('gathering', 4, 1, 'prospector', 'Prospector', 3, '3% chance per rank that gathering also turns up 5-25 coins.'),
  perk('gathering', 6, 1, 'master_gatherer', 'Master Gatherer', 1, 'Capstone: gathering never fails.'),

  // ---- Crafting ----
  perk('crafting', 0, 0, 'steady_hands', 'Steady Hands', 3, 'Burn chance reduced by 25% per rank.'),
  perk('crafting', 0, 2, 'fine_fletching', 'Fine Fletching', 3, 'Fletching makes +2 arrows per rank.'),
  perk('crafting', 1, 0, 'master_smith', 'Master Smith', 3, '15% chance per rank to save a bar when smithing.'),
  perk('crafting', 1, 2, 'efficient_smelting', 'Efficient Smelting', 3, '10% chance per rank to smelt two bars from one load of ore.'),
  perk('crafting', 2, 0, 'chefs_touch', "Chef's Touch", 3, '10% chance per rank to cook without using up the raw fish.'),
  perk('crafting', 2, 2, 'herbalist', 'Herbalist', 3, '10% chance per rank to mix two potions from one set of ingredients.'),
  perk('crafting', 3, 0, 'preservation', 'Preservation', 3, 'Potions have a 10% chance per rank not to be used up when you drink them.'),
  perk('crafting', 3, 2, 'bulk_smelting', 'Bulk Smelting', 3, 'Smelting gives back 1 coal per rank.'),
  perk('crafting', 4, 0, 'jeweller', 'Jeweller', 3, '+2% chance per rank to find a gem while mining.'),
  perk('crafting', 4, 2, 'gem_cutter', 'Gem Cutter', 3, '+20% Crafting XP per rank.'),
  perk('crafting', 4, 1, 'masterwork', 'Masterwork', 3, '5% chance per rank that something you smith comes out one metal tier better.'),
  perk('crafting', 5, 1, 'herbal_infusion', 'Herbal Infusion', 3, 'Potion boosts fade 50% slower per rank.'),
  perk('crafting', 6, 1, 'grandmaster_crafter', 'Grandmaster Crafter', 1, 'Capstone: you never burn food, and every craft has a 10% chance to keep its materials.'),

  // ---- Rogue ----
  perk('rogue', 0, 1, 'nimble_fingers', 'Nimble Fingers', 5, '+3% pickpocket and lock-picking success per rank.'),
  perk('rogue', 1, 0, 'rummage', 'Rummage', 2, "Monsters' pockets hold 1 more pick per rank."),
  perk('rogue', 1, 2, 'acrobat', 'Acrobat', 3, '+5% Agility shortcut success per rank.'),
  perk('rogue', 2, 1, 'trap_sense', 'Trap Sense', 3, 'Traps, slips and getting caught hurt 25% less per rank.'),
  perk('rogue', 2, 0, 'cutpurse', 'Cutpurse', 3, '+20% Thieving XP per rank.'),
  perk('rogue', 2, 2, 'parkour', 'Parkour', 3, '+25% Agility XP per rank.'),
  perk('rogue', 4, 0, 'slayer_lore', 'Slayer Lore', 3, '+20% Slayer XP per rank.'),
  perk('rogue', 4, 2, 'escape_artist', 'Escape Artist', 2, 'Getting caught stuns you 1 tick shorter per rank.'),
  perk('rogue', 3, 0, 'slayer_studies', 'Slayer Studies', 3, 'Slayer tasks pay 15% more tokens per rank.'),
  perk('rogue', 3, 2, 'light_footed', 'Light Footed', 2, 'Monsters notice you from 1 tile closer per rank (not bosses).'),
  perk('rogue', 4, 1, 'master_thief', 'Master Thief', 3, '10% chance per rank to steal double loot.'),
  perk('rogue', 5, 0, 'occultist', 'Occultist', 1, 'Dark shrines offer one more relic to choose from.'),
  perk('rogue', 5, 1, 'ambusher', 'Ambusher', 3, "+10% accuracy and max hit per rank against monsters that haven't noticed you."),
  perk('rogue', 6, 1, 'shadowstep', 'Shadowstep', 1, 'Capstone: pickpockets and Agility shortcuts never fail.'),

  // ---- Fortune ----
  perk('fortune', 0, 1, 'treasure_hunter', 'Treasure Hunter', 5, '+10% tokens earned per rank.'),
  perk('fortune', 1, 0, 'deep_pockets', 'Deep Pockets', 2, '+50% coins from drops per rank.'),
  perk('fortune', 1, 2, 'haggler', 'Haggler', 3, 'Merchants charge 10% less and pay 10% more per rank.'),
  perk('fortune', 2, 0, 'cartographer', 'Cartographer', 2, 'Treasure maps drop 50% more often per rank.'),
  perk('fortune', 2, 2, 'contractor', 'Contractor', 3, 'Daily contracts pay 20% more per rank.'),
  perk('fortune', 4, 0, 'goblin_bane', 'Goblin Bane', 2, 'Treasure goblins take 25% longer to escape per rank.'),
  perk('fortune', 4, 2, 'dealmaker', 'Dealmaker', 2, 'Wandering adventurers pay 25% more per rank.'),
  perk('fortune', 2, 1, 'lucky', 'Lucky', 3, 'Rare drops (under 10%) are 25% more likely per rank.'),
  perk('fortune', 3, 0, 'bounty', 'Bounty', 3, '+25 tokens per boss kill per rank.'),
  perk('fortune', 3, 2, 'elite_hunter', 'Elite Hunter', 3, '+10 tokens per elite kill per rank.'),
  perk('fortune', 4, 1, 'relic_hunter', 'Relic Hunter', 1, 'Choose from 4 relics instead of 3.'),
  perk('fortune', 5, 1, 'collector', 'Collector', 3, '+0.2% tokens per rank for every collection log slot you have filled.'),
  perk('fortune', 6, 1, 'midas', 'Midas', 1, 'Capstone: coins you carry are worth double tokens.'),
];

export const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export type PerkRanks = Record<string, number>;

/** Run-wide numbers derived from purchased perks. Defaults = no perks. */
export interface RunMods {
  /** Every perk's rank, for effects read directly by the rules (see GameState.rank). */
  perkRanks: PerkRanks;
  startLevels: { attack: number; strength: number; defence: number; hitpoints: number; prayer: number; ranged: number; magic: number };
  startItems: Array<{ id: string; qty: number }>;
  /** Multiplier on player attack rolls and max hit with every style. */
  combatMult: number;
  foodHealBonus: number;
  hpRegenTicks: number;
  undying: boolean;
  gatherBonus: number;
  doubleResourceChance: number;
  burnMult: number;
  saveBarChance: number;
  /** Multiplier on prayer drain resistance (higher = slower drain). */
  drainResistMult: number;
  descentPrayerRestore: number;
  tokenMult: number;
  coinMult: number;
  rareDropMult: number;
  bossTokens: number;
  arrowRecovery: number;
  runeSaveChance: number;
}

export function computeMods(ranks: PerkRanks): RunMods {
  const r = (id: string) => ranks[id] ?? 0;
  const startItems: RunMods['startItems'] = [];
  if (r('packed_lunch')) startItems.push({ id: 'trout', qty: 2 * r('packed_lunch') });
  if (r('holy_supplies')) startItems.push({ id: 'prayer_potion', qty: r('holy_supplies') });
  return {
    perkRanks: { ...ranks },
    startLevels: {
      attack: 1 + 3 * r('basic_training'),
      strength: 1 + 3 * r('basic_training'),
      defence: 1 + 3 * r('guard_drills'),
      hitpoints: 10 + 2 * r('iron_will'),
      prayer: 1 + 4 * r('blessed'),
      ranged: 1 + 3 * r('rangers_kit'),
      magic: 1 + 3 * r('apprentice_kit'),
    },
    startItems,
    combatMult: (1 + 0.02 * r('killer_instinct')) * (1 + 0.1 * r('grandmaster')),
    foodHealBonus: r('hearty_meals'),
    hpRegenTicks: [100, 70, 45][r('second_wind')],
    undying: r('undying') > 0,
    gatherBonus: 0.05 * r('efficient_gatherer'),
    doubleResourceChance: 0.1 * r('rich_veins'),
    burnMult: r('grandmaster_crafter') ? 0 : 1 - 0.25 * r('steady_hands'),
    saveBarChance: 0.15 * r('master_smith'),
    drainResistMult: 1 / (1 - 0.1 * r('focus')),
    descentPrayerRestore: 0.25 * (1 + r('pilgrim')),
    tokenMult: 1 + 0.1 * r('treasure_hunter'),
    coinMult: 1 + 0.5 * r('deep_pockets'),
    rareDropMult: 1 + 0.25 * r('lucky'),
    bossTokens: 25 * (1 + r('bounty')),
    arrowRecovery: 0.4 + 0.15 * r('quiver'),
    runeSaveChance: 0.1 * r('arcane_thrift'),
  };
}

export const DEFAULT_MODS = computeMods({});

/** The Armourer is unlocked by this perk. */
export const ARMOURER_PERK = 'veterans_kit';

/** Ranks spent in a branch. */
export function branchRanks(ranks: PerkRanks, branch: Branch): number {
  return PERKS.filter((p) => p.branch === branch).reduce((n, p) => n + (ranks[p.id] ?? 0), 0);
}

/** Cost of the next rank, or null if maxed. */
export function nextRankCost(ranks: PerkRanks, id: string): number | null {
  const rank = ranks[id] ?? 0;
  const perk = PERK_BY_ID[id];
  return rank < perk.costs.length ? perk.costs[rank] : null;
}

/** Why a perk's tier is still closed, or null if it's open. */
export function tierBlocker(ranks: PerkRanks, perk: PerkDef): string | null {
  const need = TIER_GATES[perk.tier];
  const have = branchRanks(ranks, perk.branch);
  return have < need ? `Opens after ${need} ranks in ${BRANCHES.find((b) => b.id === perk.branch)!.name} (you have ${have}).` : null;
}

/** Why a perk can't be bought right now, or null if it can. */
export function perkBlocker(ranks: PerkRanks, tokens: number, id: string): string | null {
  const perk = PERK_BY_ID[id];
  const cost = nextRankCost(ranks, id);
  if (cost === null) return 'Fully upgraded.';
  const gate = tierBlocker(ranks, perk);
  if (gate) return gate;
  if (tokens < cost) return `Needs ${cost.toLocaleString()} tokens.`;
  return null;
}

/** Tokens needed to buy every rank of every perk. */
export const FULL_TREE_COST = PERKS.reduce((n, p) => n + p.costs.reduce((a, b) => a + b, 0), 0);
