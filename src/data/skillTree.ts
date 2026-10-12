/** Permanent perks bought with Dungeoneering tokens at the camp's Mentor. */

export type Branch = 'warrior' | 'arsenal' | 'survivalist' | 'artisan' | 'devotion' | 'fortune';

export const BRANCHES: Array<{ id: Branch; name: string; color: number }> = [
  { id: 'warrior', name: 'Warrior', color: 0xd05030 },
  { id: 'arsenal', name: 'Arsenal', color: 0xb070e0 },
  { id: 'survivalist', name: 'Survivalist', color: 0x50a040 },
  { id: 'artisan', name: 'Artisan', color: 0xc0a040 },
  { id: 'devotion', name: 'Devotion', color: 0x60a0e0 },
  { id: 'fortune', name: 'Fortune', color: 0xe0c020 },
];

export interface PerkDef {
  id: string;
  branch: Branch;
  /** Row in its branch (0 = root). */
  tier: number;
  name: string;
  /** Description of what each rank gives. */
  desc: string;
  /** Token cost of each rank; length = max rank. */
  costs: number[];
  /** Perk that needs at least one rank first. */
  requires?: string;
}

export const PERKS: PerkDef[] = [
  { id: 'basic_training', branch: 'warrior', tier: 0, name: 'Basic Training', costs: [15, 30, 50], desc: '+3 starting Attack, Strength and Defence levels per rank.' },
  { id: 'iron_will', branch: 'warrior', tier: 1, name: 'Iron Will', costs: [20, 40, 70], requires: 'basic_training', desc: '+2 starting Hitpoints levels per rank.' },
  { id: 'veterans_kit', branch: 'warrior', tier: 2, name: "Veteran's Kit", costs: [60], requires: 'basic_training', desc: 'Unlocks the Armourer at camp, who sells better starting weapons and armour.' },
  { id: 'killer_instinct', branch: 'warrior', tier: 3, name: 'Killer Instinct', costs: [80, 160, 300], requires: 'iron_will', desc: '+5% accuracy and max hit per rank.' },

  { id: 'rangers_kit', branch: 'arsenal', tier: 0, name: 'Ranger Training', costs: [15, 30, 50], desc: '+3 starting Ranged levels per rank. (Bows and arrows come from the Armourer.)' },
  { id: 'quiver', branch: 'arsenal', tier: 1, name: 'Quiver', costs: [30, 70, 120], requires: 'rangers_kit', desc: 'Fired arrows are recovered 15% more often per rank (base 40%).' },
  { id: 'apprentice_kit', branch: 'arsenal', tier: 2, name: 'Arcane Studies', costs: [15, 30, 50], desc: '+3 starting Magic levels per rank. (Staffs and runes come from the Armourer.)' },
  { id: 'arcane_thrift', branch: 'arsenal', tier: 3, name: 'Arcane Thrift', costs: [40, 90, 160], requires: 'apprentice_kit', desc: '10% chance per rank that a spell costs no runes.' },

  { id: 'packed_lunch', branch: 'survivalist', tier: 0, name: 'Packed Lunch', costs: [10, 25, 45], desc: 'Start each run with +2 trout per rank.' },
  { id: 'hearty_meals', branch: 'survivalist', tier: 1, name: 'Hearty Meals', costs: [30, 60, 100], requires: 'packed_lunch', desc: 'Food heals +1 HP per rank.' },
  { id: 'second_wind', branch: 'survivalist', tier: 2, name: 'Second Wind', costs: [50, 120], requires: 'packed_lunch', desc: 'Natural HP regen every 70 / 45 ticks instead of 100.' },
  { id: 'undying', branch: 'survivalist', tier: 3, name: 'Undying', costs: [400], requires: 'hearty_meals', desc: 'Once per run, survive a killing blow with 1 HP.' },

  { id: 'efficient_gatherer', branch: 'artisan', tier: 0, name: 'Efficient Gatherer', costs: [20, 40, 80], desc: '+5% chance per gathering roll per rank.' },
  { id: 'rich_veins', branch: 'artisan', tier: 1, name: 'Rich Veins', costs: [40, 80, 150], requires: 'efficient_gatherer', desc: '10% chance per rank to gather a bonus resource.' },
  { id: 'steady_hands', branch: 'artisan', tier: 2, name: 'Steady Hands', costs: [25, 50, 90], requires: 'efficient_gatherer', desc: 'Burn chance reduced by 25% per rank.' },
  { id: 'master_smith', branch: 'artisan', tier: 3, name: 'Master Smith', costs: [100, 220], requires: 'rich_veins', desc: '15% chance per rank to save a bar when smithing.' },

  { id: 'blessed', branch: 'devotion', tier: 0, name: 'Blessed', costs: [15, 30, 60], desc: '+4 starting Prayer levels per rank.' },
  { id: 'focus', branch: 'devotion', tier: 1, name: 'Focus', costs: [40, 80, 150], requires: 'blessed', desc: 'Prayer drains 10% slower per rank.' },
  { id: 'pilgrim', branch: 'devotion', tier: 2, name: 'Pilgrim', costs: [40, 90], requires: 'blessed', desc: 'Descending restores +25% more prayer per rank.' },
  { id: 'holy_supplies', branch: 'devotion', tier: 3, name: 'Holy Supplies', costs: [70, 160], requires: 'pilgrim', desc: 'Start each run with +1 prayer potion per rank.' },

  { id: 'treasure_hunter', branch: 'fortune', tier: 0, name: 'Treasure Hunter', costs: [20, 45, 90], desc: '+10% tokens earned per rank.' },
  { id: 'deep_pockets', branch: 'fortune', tier: 1, name: 'Deep Pockets', costs: [30, 70], requires: 'treasure_hunter', desc: '+50% coins from drops per rank.' },
  { id: 'lucky', branch: 'fortune', tier: 2, name: 'Lucky', costs: [50, 100, 200], requires: 'treasure_hunter', desc: 'Rare drops (under 10%) are 25% more likely per rank.' },
  { id: 'bounty', branch: 'fortune', tier: 3, name: 'Bounty', costs: [120, 250], requires: 'lucky', desc: '+25 tokens per boss kill per rank.' },
];

export const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export type PerkRanks = Record<string, number>;

/** Run-wide numbers derived from purchased perks. Defaults = no perks. */
export interface RunMods {
  startLevels: { attack: number; strength: number; defence: number; hitpoints: number; prayer: number; ranged: number; magic: number };
  startItems: Array<{ id: string; qty: number }>;
  /** Multiplier on player attack rolls and max hit. */
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
    startLevels: {
      attack: 1 + 3 * r('basic_training'),
      strength: 1 + 3 * r('basic_training'),
      defence: 1 + 3 * r('basic_training'),
      hitpoints: 10 + 2 * r('iron_will'),
      prayer: 1 + 4 * r('blessed'),
      ranged: 1 + 3 * r('rangers_kit'),
      magic: 1 + 3 * r('apprentice_kit'),
    },
    startItems,
    combatMult: 1 + 0.05 * r('killer_instinct'),
    foodHealBonus: r('hearty_meals'),
    hpRegenTicks: [100, 70, 45][r('second_wind')],
    undying: r('undying') > 0,
    gatherBonus: 0.05 * r('efficient_gatherer'),
    doubleResourceChance: 0.1 * r('rich_veins'),
    burnMult: 1 - 0.25 * r('steady_hands'),
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

/** Cost of the next rank, or null if maxed. */
export function nextRankCost(ranks: PerkRanks, id: string): number | null {
  const rank = ranks[id] ?? 0;
  const perk = PERK_BY_ID[id];
  return rank < perk.costs.length ? perk.costs[rank] : null;
}

/** Why a perk can't be bought right now, or null if it can. */
export function perkBlocker(ranks: PerkRanks, tokens: number, id: string): string | null {
  const perk = PERK_BY_ID[id];
  const cost = nextRankCost(ranks, id);
  if (cost === null) return 'Fully upgraded.';
  if (perk.requires && !(ranks[perk.requires] > 0)) return `Requires ${PERK_BY_ID[perk.requires].name}.`;
  if (tokens < cost) return `Needs ${cost} tokens.`;
  return null;
}
