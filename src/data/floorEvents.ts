import type { NpcDef } from './npcs';

/**
 * Floor events: now and then a floor is out of the ordinary. Most trade a risk for a reward,
 * so they're interesting rather than free power. Rolled when you arrive on a non-boss floor.
 */

export type FloorEventId = 'gilded' | 'infested' | 'cursed' | 'darkness' | 'blessed' | 'treasure_goblin';

export interface FloorEventDef {
  id: FloorEventId;
  name: string;
  /** Shown when you arrive and in the corner of the screen. */
  desc: string;
  weight: number;
  minDepth: number;
}

export const FLOOR_EVENTS: FloorEventDef[] = [
  { id: 'gilded', name: 'Gilded Halls', desc: 'Coin drops are doubled, but monsters have 15% more HP.', weight: 3, minDepth: 3 },
  { id: 'infested', name: 'Infested', desc: 'Half again as many monsters, and every kill pays +1 token.', weight: 3, minDepth: 3 },
  { id: 'cursed', name: 'Cursed', desc: 'Monsters hit 20% harder, and every kill pays +2 tokens.', weight: 2, minDepth: 5 },
  { id: 'darkness', name: 'Darkness', desc: 'You can barely see, but you learn fast: +50% XP on this floor.', weight: 2, minDepth: 4 },
  { id: 'blessed', name: 'Blessed Ground', desc: 'Prayer drains at half speed and you slowly heal.', weight: 2, minDepth: 3 },
  { id: 'treasure_goblin', name: 'Treasure Goblin', desc: 'A goblin laden with gold is on this floor. Catch it before it escapes!', weight: 2, minDepth: 3 },
];

export const FLOOR_EVENT_BY_ID = Object.fromEntries(FLOOR_EVENTS.map((e) => [e.id, e])) as Record<FloorEventId, FloorEventDef>;

/** Chance a non-boss floor (from floor 3) has an event. */
export const FLOOR_EVENT_CHANCE = 0.25;
/** Darkness: how far you can see. */
export const DARKNESS_FOV = 3;
/** Ticks the treasure goblin runs for once it spots you, before it escapes. */
export const GOBLIN_ESCAPE_TICKS = 100;

export function rollFloorEvent(depth: number, rand: () => number): FloorEventId | null {
  if (depth < 3 || rand() >= FLOOR_EVENT_CHANCE) return null;
  const pool = FLOOR_EVENTS.filter((e) => depth >= e.minDepth);
  const total = pool.reduce((n, e) => n + e.weight, 0);
  let r = rand() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r < 0) return e.id;
  }
  return pool[pool.length - 1].id;
}

/** The treasure goblin: harmless, quick to flee, and full of coins. Scales with depth. */
export function treasureGoblin(depth: number): NpcDef {
  return {
    id: 'treasure_goblin', name: 'Treasure goblin', color: 0xffd040,
    attack: 1, strength: 1, defence: 2 + depth, hitpoints: 8 + depth * 3,
    attackBonus: 0, strengthBonus: 0, defenceBonus: 0, attackSpeed: 4, aggroRadius: 6,
    minDepth: 0, maxDepth: 0, weight: 0,
    examine: 'It jingles when it runs.',
    drops: [
      { item: 'coins', chance: 1, min: 40 * depth, max: 90 * depth },
      { item: 'prayer_potion', chance: 0.5 },
      { item: depth >= 10 ? 'rune_bar' : depth >= 6 ? 'adamant_bar' : 'mithril_bar', chance: 0.4 },
    ],
  };
}
