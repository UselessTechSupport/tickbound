import type { StartStyle } from './armoury';
import type { SkillName } from './skills';

/**
 * Catch-up for skipping straight to a later floor: roughly what a player has by then
 * (levels from the balance sim, plus supplies), so a skip isn't an instant death.
 */
export interface CatchUp {
  levels: Partial<Record<SkillName, number>>;
  items: Array<{ id: string; qty: number }>;
}

export function catchUpFor(depth: number, style: StartStyle): CatchUp {
  const d = Math.max(1, depth) - 1;
  const combat = Math.min(70, 4 + 3 * d);
  const levels: Partial<Record<SkillName, number>> = {
    defence: combat,
    hitpoints: Math.min(80, 10 + 3 * d),
    prayer: Math.min(45, 1 + Math.round(1.5 * d)),
  };
  if (style === 'melee') Object.assign(levels, { attack: combat, strength: combat });
  if (style === 'ranged') levels.ranged = combat;
  if (style === 'magic') levels.magic = combat;
  const food = depth >= 11 ? 'swordfish' : depth >= 6 ? 'lobster' : 'trout';
  return {
    levels,
    items: [
      { id: food, qty: Math.min(10, 3 + Math.floor(d / 2)) },
      { id: 'prayer_potion', qty: Math.min(4, 1 + Math.floor(d / 5)) },
      { id: 'coins', qty: 40 * d },
    ],
  };
}
