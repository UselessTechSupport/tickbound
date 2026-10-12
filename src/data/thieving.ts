/**
 * Thieving: pick the pockets of humanoid monsters, and pick the locks of locked chests.
 * Failing a pickpocket stuns you, hurts, and angers the target; failing a lock springs a trap.
 */

export interface PickpocketLoot {
  item: string;
  min: number;
  max: number;
  weight: number;
}

export interface PickpocketDef {
  level: number;
  xp: number;
  loot: PickpocketLoot[];
  /** Damage when caught. */
  damage: [number, number];
}

export const PICKPOCKET: Record<string, PickpocketDef> = {
  goblin: {
    level: 1, xp: 8, damage: [1, 2],
    loot: [{ item: 'coins', min: 3, max: 12, weight: 5 }, { item: 'bronze_arrow', min: 3, max: 8, weight: 1 }],
  },
  dark_wizard: {
    level: 10, xp: 25, damage: [1, 3],
    loot: [{ item: 'coins', min: 10, max: 30, weight: 4 }, { item: 'mind_rune', min: 5, max: 15, weight: 3 }, { item: 'chaos_rune', min: 2, max: 5, weight: 1 }],
  },
  mummy: {
    level: 25, xp: 45, damage: [2, 4],
    loot: [{ item: 'coins', min: 40, max: 90, weight: 4 }, { item: 'prayer_potion', min: 1, max: 1, weight: 1 }],
  },
  infernal_mage: {
    level: 35, xp: 65, damage: [2, 5],
    loot: [{ item: 'coins', min: 50, max: 120, weight: 4 }, { item: 'chaos_rune', min: 5, max: 15, weight: 2 }, { item: 'death_rune', min: 2, max: 6, weight: 1 }],
  },
  dark_archer: {
    level: 50, xp: 100, damage: [3, 6],
    loot: [{ item: 'coins', min: 80, max: 200, weight: 4 }, { item: 'mithril_arrow', min: 10, max: 25, weight: 2 }, { item: 'adamant_arrow', min: 5, max: 15, weight: 1 }],
  },
};

/** Each monster only has so much in its pockets. */
export const POCKET_LIMIT = 3;
/** Ticks you're stunned after being caught. */
export const STUN_TICKS = 4;
/** Share of chests (from floor 3) that are locked. */
export const LOCKED_CHEST_CHANCE = 0.35;
export const LOCKED_CHEST_MIN_DEPTH = 3;

/** Success chance: at least `base` at the required level, +3.5% per level above, up to 95%. */
export function thievingChance(level: number, req: number, base = 0.55): number {
  return Math.min(0.95, base + 0.035 * Math.max(0, level - req));
}

/** Thieving 3 on floor 3, 9 on floor 5: reachable by pickpocketing goblins and dark wizards. */
export function lockLevelFor(depth: number): number {
  return Math.min(90, Math.max(1, (depth - 2) * 3));
}

export function lockXpFor(depth: number): number {
  return 15 + 4 * depth;
}
