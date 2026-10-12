import { SkillName } from './skills';

/** Tools unlocked through meta-progression; 0 / false means not unlocked. */
export interface Toolbelt {
  /** Pickaxe tier, 1 (bronze) .. 6 (rune). */
  pickaxe: number;
  /** Axe tier, 1 (bronze) .. 6 (rune). */
  axe: number;
  /** Fishing gear tier: 1 net, 2 +fly rod, 3 +lobster pot, 4 +harpoon. */
  fishing: number;
  hammer: boolean;
  tinderbox: boolean;
  /** Fletching. */
  knife: boolean;
  /** Crafting gems into amulets. */
  chisel?: boolean;
}

export const NO_TOOLS: Toolbelt = { pickaxe: 0, axe: 0, fishing: 0, hammer: false, tinderbox: false, knife: false };

/** Metal tiers for pickaxes and axes; `level` is the skill level needed to use it. */
export const TOOL_TIERS = [
  { name: 'Bronze', level: 1 },
  { name: 'Iron', level: 1 },
  { name: 'Steel', level: 5 },
  { name: 'Mithril', level: 15 },
  { name: 'Adamant', level: 25 },
  { name: 'Rune', level: 35 },
] as const;

export const FISHING_GEAR = ['Small fishing net', 'Fly fishing rod', 'Lobster pot', 'Harpoon'] as const;

/**
 * Best tier (1-based) the player can actually use, given what's unlocked and their level.
 * Returns 0 if they have no usable tool.
 */
export function usableTier(unlocked: number, level: number): number {
  for (let t = unlocked; t >= 1; t--) if (level >= TOOL_TIERS[t - 1].level) return t;
  return 0;
}

export type UnlockKey = 'pickaxe' | 'axe' | 'fishing' | 'hammer' | 'tinderbox' | 'knife' | 'chisel';

const METAL_COSTS = [25, 60, 120, 250, 450, 800];
const FISHING_COSTS = [25, 80, 200, 400];

export interface UnlockOffer {
  key: UnlockKey;
  /** What you get, e.g. "Iron pickaxe". */
  label: string;
  /** What it does, e.g. "Mine faster". */
  detail: string;
  cost: number;
}

/** The next purchasable step for each tool line, or nothing if it's maxed. */
export function nextUnlocks(tools: Toolbelt): UnlockOffer[] {
  const offers: UnlockOffer[] = [];
  const metal = (key: 'pickaxe' | 'axe', noun: string, skill: SkillName) => {
    const tier = tools[key];
    if (tier >= TOOL_TIERS.length) return;
    const next = TOOL_TIERS[tier];
    const req = next.level > 1 ? ` (${skill} ${next.level} to use)` : '';
    offers.push({
      key, label: `${next.name} ${noun}`, cost: METAL_COSTS[tier],
      detail: tier === 0 ? `Unlocks ${skill}` : `Faster ${skill}${req}`,
    });
  };
  metal('pickaxe', 'pickaxe', 'mining');
  metal('axe', 'axe', 'woodcutting');
  if (tools.fishing < FISHING_GEAR.length) {
    offers.push({
      key: 'fishing', label: FISHING_GEAR[tools.fishing], cost: FISHING_COSTS[tools.fishing],
      detail: ['Net shrimps', 'Lure trout', 'Cage lobsters', 'Harpoon swordfish'][tools.fishing],
    });
  }
  if (!tools.tinderbox) offers.push({ key: 'tinderbox', label: 'Tinderbox', cost: 20, detail: 'Light logs to cook on' });
  if (!tools.hammer) offers.push({ key: 'hammer', label: 'Hammer', cost: 30, detail: 'Smith gear at anvils' });
  if (!tools.knife) offers.push({ key: 'knife', label: 'Knife', cost: 30, detail: 'Fletch bows and arrows from logs' });
  if (!tools.chisel) offers.push({ key: 'chisel', label: 'Chisel', cost: 40, detail: 'Craft gems you find while mining into amulets' });
  return offers;
}

export function applyUnlock(tools: Toolbelt, key: UnlockKey): void {
  if (key === 'hammer' || key === 'tinderbox' || key === 'knife' || key === 'chisel') tools[key] = true;
  else tools[key]++;
}
