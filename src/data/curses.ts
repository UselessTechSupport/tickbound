/**
 * Dark shrines (floor 4+): a relic of your choice, paid for with a curse that lasts the run.
 * Curses are real drawbacks but none of them ends a run on its own.
 */

export interface CurseDef {
  id: string;
  name: string;
  desc: string;
}

export const CURSES: CurseDef[] = [
  { id: 'frailty', name: 'Frailty', desc: '-10% max HP.' },
  { id: 'exposure', name: 'Exposure', desc: 'Monsters are 10% more accurate against you.' },
  { id: 'famine', name: 'Famine', desc: 'Food heals 20% less.' },
  { id: 'unrest', name: 'Unrest', desc: 'No natural HP regeneration.' },
];

export const CURSE_BY_ID: Record<string, CurseDef> = Object.fromEntries(CURSES.map((c) => [c.id, c]));

/** Chance of a dark shrine on a non-boss floor from DARK_SHRINE_MIN_DEPTH. */
export const DARK_SHRINE_CHANCE = 0.12;
export const DARK_SHRINE_MIN_DEPTH = 4;
