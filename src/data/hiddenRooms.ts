/**
 * Hidden rooms: now and then a crack in the wall leads to a small sealed room instead of
 * across to another corridor. Squeezing through takes an Agility check like a shortcut,
 * and every room holds something worth the trip.
 */

export type HiddenRoomVariant = 'cache' | 'shrine' | 'stash';

/** Chance a non-boss floor (from floor 2) has a hidden room. */
export const HIDDEN_ROOM_CHANCE = 0.2;
export const HIDDEN_ROOM_MIN_DEPTH = 2;

export const HIDDEN_ROOM_VARIANTS: Array<{ id: HiddenRoomVariant; weight: number; found: string }> = [
  { id: 'cache', weight: 3, found: "a forgotten cache! The chest here hasn't been touched in years." },
  { id: 'shrine', weight: 1, found: 'a forgotten shrine, still humming with power.' },
  { id: 'stash', weight: 2, found: "an adventurer's stash of supplies." },
];

/** Hidden rooms are a little easier to reach than shortcuts: they're the point of the crack. */
export function hiddenRoomLevel(shortcutLevel: number): number {
  return Math.max(1, shortcutLevel - 5);
}

/** Food left in a stash: whatever adventurers at this depth would carry. */
export function stashFood(depth: number): string {
  return depth >= 20 ? 'shark' : depth >= 10 ? 'swordfish' : depth >= 5 ? 'lobster' : 'trout';
}
