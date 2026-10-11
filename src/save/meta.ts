import { NO_TOOLS, Toolbelt } from '../data/tools';
import { PerkRanks } from '../data/skillTree';
import type { Counter } from '../data/achievements';
import type { SlayerTask } from '../data/slayer';
import { ArmouryRanks, NO_ARMOURY, StartStyle } from '../data/armoury';
import type { Enchantments } from '../data/enchants';
import type { Materials, StructureLevels } from '../data/construction';

const BOSS_FLOORS: Record<string, number> = { goblin_warlord: 5, tztok_jad: 10, chaos_elemental: 15, demonic_gorilla: 20 };

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
  /** Slayer opens up after your first Goblin Warlord kill. */
  slayerUnlocked: boolean;
  /** Armourer starting-gear tiers bought per line (0 = none). */
  armoury: ArmouryRanks;
  /** Which bought weapon gets equipped at the start of a run. */
  startStyle: StartStyle;
  /** Deepest boss floor beaten; you can skip to the floor after any boss floor up to this. */
  deepestBoss: number;
  /** The Enchanter arrives after your first TzTok-Jad kill. */
  enchanterUnlocked: boolean;
  enchants: Enchantments;
  /** Camp building: structure levels, materials, and the bank chest's kept items. */
  structures: StructureLevels;
  materials: Materials;
  bank: Array<{ id: string; qty: number }>;
  /** Every relic you've ever picked, and the one the relic altar starts runs with. */
  relicsFound: string[];
  startRelic: string | null;
  /** Floors each pet has come along for (pet levels). */
  petFloors: Record<string, number>;
}

const KEY = 'tickbound.meta';
/** Save key from before the rename; read once so earlier progress carries over. */
const LEGACY_KEY = 'roguescape.meta';

export function freshMeta(): MetaSave {
  return {
    version: 1, tokens: 0, tools: { ...NO_TOOLS }, perks: {}, runs: 0, bestDepth: 0,
    collection: {}, killCounts: {}, achievements: [], lifetime: {}, pets: [], activePet: null, made: {}, slayerTask: null,
    slayerUnlocked: false, armoury: { ...NO_ARMOURY }, startStyle: 'melee', deepestBoss: 0,
    enchanterUnlocked: false, enchants: {},
    structures: {}, materials: { timber: 0, metal: 0 }, bank: [], relicsFound: [], startRelic: null, petFloors: {},
  };
}

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return freshMeta();
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    // Veteran's Kit used to have 2 ranks (iron gear); it's now 1 rank that unlocks the Armourer.
    const perks = { ...parsed.perks };
    let tokens = parsed.tokens ?? 0;
    if ((perks.veterans_kit ?? 0) > 1) {
      tokens += 150;
      perks.veterans_kit = 1;
    }
    // Anyone who already bought Armourer gear keeps the Armourer.
    if (Object.values(parsed.armoury ?? {}).some((r) => r > 0)) perks.veterans_kit = 1;
    // Older saves lack the newer fields; fill them with defaults.
    return {
      ...freshMeta(), ...parsed, tokens, tools: { ...NO_TOOLS, ...parsed.tools }, perks,
      collection: { ...parsed.collection }, killCounts: { ...parsed.killCounts }, lifetime: { ...parsed.lifetime },
      made: { ...parsed.made }, slayerTask: parsed.slayerTask ?? null,
      // Saves that already used Slayer (before it was gated) keep it.
      slayerUnlocked: parsed.slayerUnlocked ?? (!!parsed.slayerTask || (parsed.lifetime?.tasks ?? 0) > 0),
      armoury: { ...NO_ARMOURY, ...parsed.armoury },
      enchants: { ...parsed.enchants },
      structures: { ...parsed.structures },
      materials: { timber: 0, metal: 0, ...parsed.materials },
      petFloors: { ...parsed.petFloors },
      enchanterUnlocked: parsed.enchanterUnlocked ?? (parsed.killCounts?.tztok_jad ?? 0) > 0,
      // Older saves: credit boss floors already beaten, from the kill counts.
      deepestBoss: parsed.deepestBoss ?? Math.max(0, ...Object.entries(BOSS_FLOORS)
        .filter(([id]) => (parsed.killCounts?.[id] ?? 0) > 0).map(([, floor]) => floor)),
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
