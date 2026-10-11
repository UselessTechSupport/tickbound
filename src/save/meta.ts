import { NO_TOOLS, Toolbelt } from '../data/tools';
import { PerkRanks } from '../data/skillTree';
import type { Counter } from '../data/achievements';
import type { SlayerTask } from '../data/slayer';

/** Progress that survives between runs. */
export interface MetaSave {
  version: 1;
  tokens: number;
  tools: Toolbelt;
  perks: PerkRanks;
  runs: number;
  bestDepth: number;
  /** Collection log: item or pet id -> times obtained. */
  collection: Record<string, number>;
  /** Lifetime kill count per monster id. */
  killCounts: Record<string, number>;
  /** Completed achievement ids. */
  achievements: string[];
  lifetime: Partial<Record<Counter, number>>;
  pets: string[];
  /** Pet that follows you around, if any. */
  activePet: string | null;
  /** Items you've gathered or crafted -> count (skilling achievements). */
  made: Record<string, number>;
  /** Current Slayer task; carries across runs until finished or skipped. */
  slayerTask: SlayerTask | null;
}

const KEY = 'tickbound.meta';
/** Save key from before the rename; read once so earlier progress carries over. */
const LEGACY_KEY = 'roguescape.meta';

export function freshMeta(): MetaSave {
  return {
    version: 1, tokens: 0, tools: { ...NO_TOOLS }, perks: {}, runs: 0, bestDepth: 0,
    collection: {}, killCounts: {}, achievements: [], lifetime: {}, pets: [], activePet: null, made: {}, slayerTask: null,
  };
}

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return freshMeta();
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    // Older saves lack the newer fields; fill them with defaults.
    return {
      ...freshMeta(), ...parsed, tools: { ...NO_TOOLS, ...parsed.tools }, perks: { ...parsed.perks },
      collection: { ...parsed.collection }, killCounts: { ...parsed.killCounts }, lifetime: { ...parsed.lifetime },
      made: { ...parsed.made }, slayerTask: parsed.slayerTask ?? null,
      achievements: [...(parsed.achievements ?? [])], pets: [...(parsed.pets ?? [])],
    };
  } catch {
    return freshMeta();
  }
}

export function saveMeta(meta: MetaSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    // Storage unavailable (private mode etc.): progress just won't persist.
  }
}
