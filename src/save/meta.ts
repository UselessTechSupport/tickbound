import { NO_TOOLS, Toolbelt } from '../data/tools';

/** Progress that survives between runs. */
export interface MetaSave {
  version: 1;
  tokens: number;
  tools: Toolbelt;
  runs: number;
  bestDepth: number;
}

const KEY = 'roguescape.meta';

export function freshMeta(): MetaSave {
  return { version: 1, tokens: 0, tools: { ...NO_TOOLS }, runs: 0, bestDepth: 0 };
}

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshMeta();
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    return { ...freshMeta(), ...parsed, tools: { ...NO_TOOLS, ...parsed.tools } };
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
