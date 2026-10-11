export type AttackType = 'melee' | 'ranged' | 'magic';

/** Prayers in the same group replace each other. */
export type PrayerGroup = 'defence' | 'strength' | 'attack' | 'protect' | 'ranged' | 'magic';

export interface PrayerDef {
  id: string;
  name: string;
  /** Short label for the prayer book grid. */
  short: string;
  level: number;
  /** Drain effect per tick (OSRS units: 60 = one point per tick with no prayer bonus). */
  drain: number;
  group: PrayerGroup;
  /** Stat prayers: fractional boost to the effective level. */
  boost?: number;
  /** Protection prayers: the attack style blocked. */
  protects?: AttackType;
}

/** Drain resistance with no prayer-bonus gear (OSRS: 2 * bonus + 60). */
export const DRAIN_RESISTANCE = 60;

/** Levels are compressed vs OSRS so protection is reachable before the floor-5 boss. */
export const PRAYERS: PrayerDef[] = [
  { id: 'thick_skin', name: 'Thick Skin', short: 'Thick\nSkin', level: 1, drain: 1, group: 'defence', boost: 0.05 },
  { id: 'burst_of_strength', name: 'Burst of Strength', short: 'Burst of\nStrength', level: 2, drain: 1, group: 'strength', boost: 0.05 },
  { id: 'clarity_of_thought', name: 'Clarity of Thought', short: 'Clarity of\nThought', level: 3, drain: 1, group: 'attack', boost: 0.05 },
  { id: 'protect_magic', name: 'Protect from Magic', short: 'Protect\nMagic', level: 8, drain: 12, group: 'protect', protects: 'magic' },
  { id: 'protect_missiles', name: 'Protect from Missiles', short: 'Protect\nMissiles', level: 4, drain: 12, group: 'protect', protects: 'ranged' },
  { id: 'protect_melee', name: 'Protect from Melee', short: 'Protect\nMelee', level: 6, drain: 12, group: 'protect', protects: 'melee' },
  { id: 'sharp_eye', name: 'Sharp Eye', short: 'Sharp\nEye', level: 5, drain: 1, group: 'ranged', boost: 0.05 },
  { id: 'mystic_will', name: 'Mystic Will', short: 'Mystic\nWill', level: 7, drain: 1, group: 'magic', boost: 0.05 },
  { id: 'hawk_eye', name: 'Hawk Eye', short: 'Hawk\nEye', level: 16, drain: 6, group: 'ranged', boost: 0.1 },
  { id: 'rock_skin', name: 'Rock Skin', short: 'Rock\nSkin', level: 10, drain: 6, group: 'defence', boost: 0.1 },
  { id: 'superhuman_strength', name: 'Superhuman Strength', short: 'Superhuman\nStrength', level: 12, drain: 6, group: 'strength', boost: 0.1 },
  { id: 'improved_reflexes', name: 'Improved Reflexes', short: 'Improved\nReflexes', level: 14, drain: 6, group: 'attack', boost: 0.1 },
  { id: 'mystic_lore', name: 'Mystic Lore', short: 'Mystic\nLore', level: 18, drain: 6, group: 'magic', boost: 0.1 },
  { id: 'steel_skin', name: 'Steel Skin', short: 'Steel\nSkin', level: 20, drain: 12, group: 'defence', boost: 0.15 },
  { id: 'ultimate_strength', name: 'Ultimate Strength', short: 'Ultimate\nStrength', level: 22, drain: 12, group: 'strength', boost: 0.15 },
  { id: 'incredible_reflexes', name: 'Incredible Reflexes', short: 'Incredible\nReflexes', level: 24, drain: 12, group: 'attack', boost: 0.15 },
  { id: 'eagle_eye', name: 'Eagle Eye', short: 'Eagle\nEye', level: 26, drain: 12, group: 'ranged', boost: 0.15 },
  { id: 'mystic_might', name: 'Mystic Might', short: 'Mystic\nMight', level: 28, drain: 12, group: 'magic', boost: 0.15 },
];

export const PRAYER_BY_ID: Record<string, PrayerDef> = Object.fromEntries(PRAYERS.map((p) => [p.id, p]));

/** Hotkeys 1/2/3 toggle these, in OSRS prayer-book order. */
export const PROTECTION_HOTKEYS = ['protect_magic', 'protect_missiles', 'protect_melee'] as const;

/** Prayer points a prayer potion restores (OSRS: 7 + level / 4). */
export function potionRestore(prayerLevel: number): number {
  return 7 + Math.floor(prayerLevel / 4);
}
