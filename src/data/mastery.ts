import type { SkillName } from './skills';

/**
 * Skill mastery: permanent, slow-burning progress per skill. Every level you gain in a skill
 * during a run (not levels you start with) adds that many mastery points. Each mastery level
 * gives a small bonus to that skill, so training anything pays off over hundreds of runs.
 */

/** Mastery points needed for mastery levels 1-10. */
export const MASTERY_THRESHOLDS = [50, 150, 300, 500, 800, 1200, 1700, 2300, 3000, 4000];
export const MAX_MASTERY = MASTERY_THRESHOLDS.length;

export function masteryLevel(points: number): number {
  let level = 0;
  while (level < MAX_MASTERY && points >= MASTERY_THRESHOLDS[level]) level++;
  return level;
}

/** Points needed for the next level, or null at max. */
export function nextMasteryAt(points: number): number | null {
  const level = masteryLevel(points);
  return level < MAX_MASTERY ? MASTERY_THRESHOLDS[level] : null;
}

/** What each mastery level gives, per skill. Kept small: 10 levels is a long road. */
export const MASTERY_BONUS: Record<SkillName, { per: string; value: number }> = {
  attack: { per: '+1% melee accuracy', value: 0.01 },
  strength: { per: '+1% melee max hit', value: 0.01 },
  defence: { per: '+1% defence rolls', value: 0.01 },
  hitpoints: { per: '+1 max HP every 2 levels', value: 0.5 },
  ranged: { per: '+1% ranged accuracy and max hit', value: 0.01 },
  magic: { per: '+1% magic accuracy and max hit', value: 0.01 },
  prayer: { per: 'prayer drains 2% slower', value: 0.02 },
  mining: { per: '+2% mining success', value: 0.02 },
  woodcutting: { per: '+2% woodcutting success', value: 0.02 },
  fishing: { per: '+2% fishing success', value: 0.02 },
  cooking: { per: '3% less burning', value: 0.03 },
  smithing: { per: '1% chance to save a bar', value: 0.01 },
  herblore: { per: '1% chance to mix an extra potion', value: 0.01 },
  fletching: { per: '+1 arrow per fletch every 2 levels', value: 0.5 },
  thieving: { per: '+1% pickpocket and lock success', value: 0.01 },
  agility: { per: '+1% shortcut success and 0.5% chance to dodge attacks', value: 0.01 },
  slayer: { per: '+2% Slayer task tokens', value: 0.02 },
};

export type MasteryLevels = Partial<Record<SkillName, number>>;

/** Total bonus value at a mastery level (e.g. 0.05 for +5%). */
export function masteryValue(skill: SkillName, level: number): number {
  return MASTERY_BONUS[skill].value * level;
}
