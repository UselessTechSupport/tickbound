import { ARMOURY, ArmouryLine, ArmouryRanks } from './armoury';

/**
 * The Enchanter (unlocked by your first TzTok-Jad kill) puts one enchantment on each
 * Armourer gear line, upgradable through ranks I-III. Effects apply while that piece is worn.
 */

export type EnchantKind = 'weapon' | 'armour';

export interface EnchantDef {
  id: string;
  name: string;
  kind: EnchantKind;
  /** Effect strength at ranks I, II, III. */
  values: [number, number, number];
  /** Description with the value filled in. */
  describe: (v: number) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const ENCHANTS: EnchantDef[] = [
  { id: 'keen', name: 'Keen', kind: 'weapon', values: [0.05, 0.1, 0.15], describe: (v) => `+${pct(v)} accuracy` },
  { id: 'brutal', name: 'Brutal', kind: 'weapon', values: [0.05, 0.1, 0.15], describe: (v) => `+${pct(v)} max hit` },
  { id: 'leeching', name: 'Leeching', kind: 'weapon', values: [0.08, 0.15, 0.22], describe: (v) => `heal ${pct(v)} of damage dealt` },
  { id: 'flaming', name: 'Flaming', kind: 'weapon', values: [1, 2, 3], describe: (v) => `+${v} fire damage on every hit` },
  { id: 'slayers', name: "Slayer's", kind: 'weapon', values: [0.1, 0.2, 0.3], describe: (v) => `+${pct(v)} accuracy and max hit vs your Slayer task` },
  { id: 'fortified', name: 'Fortified', kind: 'armour', values: [0.05, 0.1, 0.15], describe: (v) => `+${pct(v)} defence` },
  { id: 'thorns', name: 'Thorns', kind: 'armour', values: [0.1, 0.2, 0.3], describe: (v) => `attackers take ${pct(v)} of the damage they deal` },
  { id: 'renewal', name: 'Renewal', kind: 'armour', values: [30, 20, 12], describe: (v) => `regenerate 1 extra HP every ${v} ticks` },
  { id: 'blessed', name: 'Blessed', kind: 'armour', values: [0.1, 0.2, 0.3], describe: (v) => `prayer drains ${pct(v)} slower` },
];

export const ENCHANT_BY_ID: Record<string, EnchantDef> = Object.fromEntries(ENCHANTS.map((e) => [e.id, e]));

/** Token cost to reach rank 1, 2, 3; switching enchantments adds a fee and restarts at rank 1. */
export const ENCHANT_COSTS = [40, 100, 220];
export const ENCHANT_SWITCH_FEE = 30;
export const ROMAN = ['', 'I', 'II', 'III'];

export interface Enchantment {
  id: string;
  rank: number;
}

export type Enchantments = Partial<Record<ArmouryLine, Enchantment>>;

export function lineKind(line: ArmouryLine): EnchantKind {
  return line === 'body' || line === 'ranged_body' || line === 'magic_body' || line === 'shield' ? 'armour' : 'weapon';
}

export function enchantValue(e: Enchantment): number {
  return ENCHANT_BY_ID[e.id].values[e.rank - 1];
}

export function describeEnchant(e: Enchantment): string {
  return `${ENCHANT_BY_ID[e.id].name} ${ROMAN[e.rank]}: ${ENCHANT_BY_ID[e.id].describe(enchantValue(e))}`;
}

/** Cost to put `id` on a line: an upgrade if it's already there, else rank 1 (plus a fee if replacing). */
export function enchantCost(current: Enchantment | undefined, id: string): number | null {
  if (current?.id === id) return current.rank >= 3 ? null : ENCHANT_COSTS[current.rank];
  return ENCHANT_COSTS[0] + (current ? ENCHANT_SWITCH_FEE : 0);
}

/** The wearable item each enchanted line applies to (the line's current Armourer tier). */
export function enchantedItems(armoury: ArmouryRanks, enchants: Enchantments): Map<string, Enchantment> {
  const out = new Map<string, Enchantment>();
  for (const [line, e] of Object.entries(enchants) as Array<[ArmouryLine, Enchantment]>) {
    const rank = armoury[line];
    if (!e || !rank) continue;
    out.set(ARMOURY[line].tiers[rank - 1].items[0].id, e);
  }
  return out;
}
