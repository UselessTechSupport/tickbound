/**
 * Run modifiers: optional handicaps chosen at the ladder, each adding a token bonus.
 * Unlocked by beating the Goblin Warlord; they let veterans trade safety for faster progress.
 */

export type ModifierId = 'hardened' | 'frenzied' | 'fragile' | 'famished' | 'relicless' | 'ironman';

export interface ModifierDef {
  id: ModifierId;
  name: string;
  desc: string;
  /** Extra tokens, as a fraction (0.3 = +30%). */
  bonus: number;
}

export const MODIFIERS: ModifierDef[] = [
  { id: 'hardened', name: 'Hardened', desc: 'Monsters have 25% more HP and hit 25% harder.', bonus: 0.3 },
  { id: 'frenzied', name: 'Frenzied', desc: 'Monsters notice you from 3 tiles further and attack faster.', bonus: 0.2 },
  { id: 'fragile', name: 'Fragile', desc: '25% less max HP.', bonus: 0.25 },
  { id: 'famished', name: 'Famished', desc: 'Start with no food; food heals 25% less.', bonus: 0.15 },
  { id: 'relicless', name: 'Relicless', desc: 'No relics this run.', bonus: 0.2 },
  { id: 'ironman', name: 'Ironman', desc: 'No merchants or wandering adventurers.', bonus: 0.1 },
];

export const MODIFIER_BY_ID = Object.fromEntries(MODIFIERS.map((m) => [m.id, m])) as Record<ModifierId, ModifierDef>;

/** Beat this boss once to unlock modifiers. */
export const MODIFIERS_UNLOCK_BOSS = 'goblin_warlord';

export function modifierBonus(ids: string[]): number {
  return ids.reduce((n, id) => n + (MODIFIER_BY_ID[id as ModifierId]?.bonus ?? 0), 0);
}
