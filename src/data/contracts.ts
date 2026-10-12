import type { Counter } from './achievements';
import { SLAYER_CATEGORIES } from './slayer';
import type { MetaSave } from '../save/meta';

/**
 * Daily contracts: three short goals that change every day (the same for everyone, seeded by
 * the date). Progress counts from when the day's contracts were posted. Rewards scale with your
 * best floor so they stay worth doing, but stay around a third of a good run each.
 */

export type ContractGoal =
  | { kind: 'kills'; category: string; name: string; count: number }
  | { kind: 'counter'; counter: Counter; count: number; what: string }
  | { kind: 'depth'; floor: number };

export interface Contract {
  id: string;
  goal: ContractGoal;
  tokens: number;
}

export interface ContractState {
  /** Day the contracts were posted, e.g. "2026-10-11". */
  day: string;
  contracts: Contract[];
  /** Lifetime totals when posted; progress is measured from here. */
  baseKills: Record<string, number>;
  baseCounters: Partial<Record<Counter, number>>;
  /** Best floor reached since the contracts were posted. */
  bestDepthToday: number;
  claimed: string[];
  bonusClaimed: boolean;
}

export const CONTRACTS_PER_DAY = 3;

export function today(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Small seeded RNG so a day's contracts are the same for everyone. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Reward per contract: grows with how deep you've been. */
export function contractReward(bestDepth: number): number {
  return 40 + 12 * Math.max(1, bestDepth);
}

/** Bonus for finishing all three in a day. */
export function contractBonus(bestDepth: number): number {
  return contractReward(bestDepth);
}

/** The day's three contracts, scaled to how far you've got. */
export function rollContracts(day: string, bestDepth: number): Contract[] {
  const rand = seeded(`tickbound-${day}`);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const reach = Math.max(3, bestDepth);
  const tokens = contractReward(bestDepth);
  const makers: Array<() => ContractGoal> = [
    () => {
      const cat = pick(SLAYER_CATEGORIES.filter((c) => c.minBestDepth <= reach));
      return { kind: 'kills', category: cat.id, name: cat.name.toLowerCase(), count: 10 + Math.floor(rand() * 11) };
    },
    () => ({ kind: 'depth', floor: Math.max(3, Math.min(reach, Math.round(reach * (0.6 + rand() * 0.3)))) }),
    () => pick([
      { kind: 'counter', counter: 'gathers', count: 20 + 5 * Math.floor(rand() * 5), what: 'resources gathered' },
      { kind: 'counter', counter: 'cooks', count: 10 + 5 * Math.floor(rand() * 3), what: 'fish cooked' },
      { kind: 'counter', counter: 'chests', count: 3, what: 'chests opened' },
      { kind: 'counter', counter: 'potions', count: 3, what: 'potions mixed' },
      { kind: 'counter', counter: 'eliteKills', count: 2, what: 'elite monsters killed' },
      { kind: 'counter', counter: 'pickpockets', count: 10, what: 'pockets picked' },
      { kind: 'counter', counter: 'shortcuts', count: 5, what: 'Agility shortcuts used' },
      { kind: 'counter', counter: 'fletches', count: 5, what: 'fletches' },
      { kind: 'counter', counter: 'floorEvents', count: 2, what: 'floor events found' },
    ] as ContractGoal[]),
  ];
  return makers.map((make, i) => ({ id: `${day}-${i}`, goal: make(), tokens }));
}

export function describeContract(c: Contract): string {
  const g = c.goal;
  if (g.kind === 'kills') return `Kill ${g.count} ${g.name}`;
  if (g.kind === 'depth') return `Reach floor ${g.floor}`;
  return `${g.count} ${g.what}`;
}

/** Post today's contracts if the day has changed. Returns true if new ones were posted. */
export function ensureContracts(m: MetaSave, day = today()): boolean {
  if (m.contracts?.day === day) return false;
  m.contracts = {
    day,
    contracts: rollContracts(day, m.bestDepth),
    baseKills: { ...m.killCounts },
    baseCounters: { ...m.lifetime },
    bestDepthToday: 0,
    claimed: [],
    bonusClaimed: false,
  };
  return true;
}

/** [progress, target]. */
export function contractProgress(c: Contract, m: MetaSave): [number, number] {
  const s = m.contracts!;
  const g = c.goal;
  if (g.kind === 'depth') return [Math.min(s.bestDepthToday, g.floor), g.floor];
  if (g.kind === 'counter') return [Math.min((m.lifetime[g.counter] ?? 0) - (s.baseCounters[g.counter] ?? 0), g.count), g.count];
  const ids = SLAYER_CATEGORIES.find((cat) => cat.id === g.category)?.npcIds ?? [];
  const done = ids.reduce((n, id) => n + (m.killCounts[id] ?? 0) - (s.baseKills[id] ?? 0), 0);
  return [Math.min(done, g.count), g.count];
}
