/** Agility: obstacle shortcuts through the walls of a floor. */

export interface ShortcutKind {
  name: string;
  verb: string;
  examine: string;
}

export const SHORTCUT_KINDS: ShortcutKind[] = [
  { name: 'Crumbling wall', verb: 'Climb-over', examine: 'This wall looks like it could be climbed.' },
  { name: 'Narrow crack', verb: 'Squeeze-through', examine: 'I might just fit through there.' },
  { name: 'Loose rocks', verb: 'Scramble-over', examine: 'A pile of rubble, blocking a gap in the wall.' },
];

/** A shortcut is only worth placing if walking around takes at least this many steps. */
export const SHORTCUT_MIN_SAVING = 14;

export function shortcutLevelFor(depth: number, roll: number): number {
  return Math.max(1, Math.min(90, Math.round(depth * 3.5 + (roll - 0.5) * 8)));
}

export function shortcutXp(level: number): number {
  return 8 + level * 1.5;
}

/** Chance to cross: 60% at the required level, +4% per level above, up to 98%. */
export function shortcutChance(level: number, req: number): number {
  return Math.min(0.98, 0.6 + 0.04 * Math.max(0, level - req));
}
