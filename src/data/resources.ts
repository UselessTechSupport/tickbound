import { SkillName } from './skills';

export type ResourceKind = 'rock' | 'tree' | 'fishing' | 'herb';

export interface ResourceDef {
  id: string;
  kind: ResourceKind;
  name: string;
  /** Menu verb, e.g. "Mine", "Chop down", "Net". */
  verb: string;
  skill: SkillName;
  level: number;
  xp: number;
  product: string;
  /** Ticks between gathering rolls. */
  rollTicks: number;
  /** Fishing gear tier needed (fishing spots only). */
  fishingTier?: number;
  /** How many products before it's depleted. */
  uses: [number, number];
  minDepth: number;
  maxDepth: number;
  weight: number;
  color: number;
  examine: string;
}

const rock = (id: string, name: string, level: number, xp: number, product: string, minDepth: number, maxDepth: number, weight: number, color: number): ResourceDef => ({
  id, kind: 'rock', name, verb: 'Mine', skill: 'mining', level, xp, product, rollTicks: 4,
  uses: [1, 3], minDepth, maxDepth, weight, color, examine: `A rock containing ${name.replace(' rocks', '').toLowerCase()}.`,
});

const tree = (id: string, name: string, level: number, xp: number, product: string, uses: [number, number], minDepth: number, maxDepth: number, weight: number, color: number): ResourceDef => ({
  id, kind: 'tree', name, verb: 'Chop down', skill: 'woodcutting', level, xp, product, rollTicks: 4,
  uses, minDepth, maxDepth, weight, color, examine: `A ${name.toLowerCase()} growing in the dark. Odd.`,
});

const spot = (id: string, verb: string, fishingTier: number, level: number, xp: number, product: string, minDepth: number, maxDepth: number): ResourceDef => ({
  id, kind: 'fishing', name: 'Fishing spot', verb, skill: 'fishing', level, xp, product, rollTicks: 5, fishingTier,
  uses: [4, 8], minDepth, maxDepth, weight: 1, color: 0x2a5a8a, examine: `I can ${verb.toLowerCase()} fish here.`,
});

/** Herbs by depth: [item, Herblore level to pick, first depth, pick XP]. Also used for herb drops. */
export const HERBS: Array<[string, number, number, number]> = [
  ['guam_leaf', 1, 1, 5], ['tarromin', 5, 2, 7], ['harralander', 10, 4, 9], ['ranarr_weed', 15, 6, 12],
  ['irit_leaf', 20, 8, 14], ['kwuarm', 25, 10, 16], ['cadantine', 30, 12, 18], ['dwarf_weed', 30, 14, 20],
  ['lantadyme', 35, 16, 22], ['snapdragon', 45, 18, 26], ['torstol', 60, 21, 30],
];

/** Herb patches: no tool needed, you just pick them. */
const HERB_PATCHES: ResourceDef[] = HERBS.map(([product, level, minDepth, xp]) => ({
  id: `patch_${product}`, kind: 'herb' as const, name: 'Herb patch', verb: 'Pick', skill: 'herblore' as const,
  level, xp, product, rollTicks: 3, uses: [1, 3] as [number, number], minDepth, maxDepth: minDepth + 8,
  weight: 1, color: 0x50a040, examine: `A patch of herbs. Looks like ${product.replace(/_/g, ' ')}.`,
}));

/** A random herb that grows at this depth (herb drops and patches). */
export function herbForDepth(depth: number, rand: () => number): string {
  const pool = HERBS.filter(([, , min]) => depth >= min && depth <= min + 8);
  const list = pool.length ? pool : HERBS.slice(-2);
  return list[Math.floor(rand() * list.length)][0];
}

/** Level requirements are compressed vs OSRS so higher tiers are reachable within a run. */
const list: ResourceDef[] = [
  rock('copper', 'Copper rocks', 1, 17.5, 'copper_ore', 1, 7, 3, 0xb87333),
  rock('tin', 'Tin rocks', 1, 17.5, 'tin_ore', 1, 7, 3, 0xb0b0a8),
  rock('iron', 'Iron rocks', 10, 35, 'iron_ore', 3, 99, 3, 0x6e4b3a),
  rock('coal', 'Coal rocks', 20, 50, 'coal', 5, 99, 3, 0x222222),
  rock('mithril', 'Mithril rocks', 30, 80, 'mithril_ore', 8, 99, 2, 0x3a4a7c),
  rock('adamantite', 'Adamantite rocks', 40, 95, 'adamantite_ore', 12, 99, 1, 0x3a6a3a),
  rock('runite', 'Runite rocks', 50, 125, 'runite_ore', 16, 99, 1, 0x3fa9b8),

  tree('tree', 'Tree', 1, 25, 'logs', [1, 2], 1, 6, 3, 0x3f7a2a),
  tree('oak', 'Oak tree', 10, 37.5, 'oak_logs', [2, 4], 3, 10, 3, 0x4f8a2a),
  tree('willow', 'Willow tree', 20, 67.5, 'willow_logs', [3, 6], 6, 99, 2, 0x6a9a3a),
  tree('maple', 'Maple tree', 30, 100, 'maple_logs', [3, 6], 10, 99, 2, 0xb05a20),
  tree('yew', 'Yew tree', 40, 175, 'yew_logs', [3, 6], 14, 99, 1, 0x2a5a2a),

  ...HERB_PATCHES,

  spot('net', 'Net', 1, 1, 10, 'raw_shrimps', 1, 8),
  spot('lure', 'Lure', 2, 12, 50, 'raw_trout', 4, 14),
  spot('cage', 'Cage', 3, 25, 90, 'raw_lobster', 9, 99),
  spot('harpoon', 'Harpoon', 4, 35, 100, 'raw_swordfish', 13, 99),
];

export const RESOURCES: Record<string, ResourceDef> = Object.fromEntries(list.map((r) => [r.id, r]));

export function resourcesFor(kind: ResourceKind, depth: number): ResourceDef[] {
  return list.filter((r) => r.kind === kind && depth >= r.minDepth && depth <= r.maxDepth);
}
