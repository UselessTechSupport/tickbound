/**
 * Special attacks: rare weapons with a special move that spends special attack energy.
 * Energy is 0-100 and refills 10 every SPEC_REGEN_TICKS (30 seconds), as in OSRS.
 */

export interface SpecDef {
  /** Weapon item id. */
  weapon: string;
  name: string;
  cost: number;
  desc: string;
  /** First floor it can drop on. */
  minDepth: number;
  /** Fires immediately, ignoring the weapon's attack delay (granite maul). */
  instant?: boolean;
}

export const SPECIALS: SpecDef[] = [
  { weapon: 'dragon_dagger', name: 'Puncture', cost: 25, minDepth: 4, desc: 'Two quick stabs with +15% accuracy and damage.' },
  { weapon: 'granite_maul', name: 'Quick Smash', cost: 50, minDepth: 6, instant: true, desc: 'An instant extra hit that ignores the attack delay.' },
  { weapon: 'magic_shortbow', name: 'Snapshot', cost: 55, minDepth: 6, desc: 'Fire two arrows at once with +10% accuracy.' },
  { weapon: 'ancient_staff', name: 'Soul Blast', cost: 50, minDepth: 6, desc: 'A spell that almost never misses, with +30% damage.' },
  { weapon: 'dragon_warhammer', name: 'Smash', cost: 50, minDepth: 9, desc: '+50% damage, and lowers the target\'s Defence by 30%.' },
  { weapon: 'dragon_claws', name: 'Slice and Dice', cost: 50, minDepth: 12, desc: 'Four rapid slashes: full, half, quarter, quarter damage.' },
];

export const SPEC_BY_WEAPON: Record<string, SpecDef> = Object.fromEntries(SPECIALS.map((s) => [s.weapon, s]));

export const SPEC_REGEN_TICKS = 50;
export const SPEC_REGEN = 10;

/** Chance a kill drops a special-attack weapon. */
export const SPEC_DROP_CHANCE = { boss: 1 / 10, elite: 1 / 60, normal: 1 / 300 };

export function specWeaponsFor(depth: number): SpecDef[] {
  return SPECIALS.filter((s) => depth >= s.minDepth);
}
