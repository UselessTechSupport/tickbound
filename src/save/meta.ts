import { NO_TOOLS, Toolbelt } from '../data/tools';
import { PerkRanks } from '../data/skillTree';

/** Progress that survives between runs. */
export interface MetaSave {
  version: 1;
  tokens: number;
  tools: Toolbelt;
  perks: PerkRanks;
  runs: number;
  bestDepth: number;
}

const KEY = 'tickbound.meta';
/** Save key from before the rename; read once so earlier progress carries over. */
const LEGACY_KEY = 'roguescape.meta';

export function freshMeta(): MetaSave {
  return { version: 1, tokens: 0, tools: { ...NO_TOOLS }, perks: {}, runs: 0, bestDepth: 0 };
}

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return freshMeta();
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    return { ...freshMeta(), ...parsed, tools: { ...NO_TOOLS, ...parsed.tools }, perks: { ...parsed.perks } };
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
