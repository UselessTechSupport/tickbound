/** Slayer task categories: groups of monsters, the depths they live at, and the pay. */
export interface SlayerCategory {
  id: string;
  name: string;
  npcIds: string[];
  /** Assigned once your best depth reaches this. */
  minBestDepth: number;
  /** Kills per task: [min, max]. */
  count: [number, number];
  /** Dungeoneering tokens per kill when the task is completed. */
  tokensPerKill: number;
}

export const SLAYER_CATEGORIES: SlayerCategory[] = [
  { id: 'rats', name: 'Rats', npcIds: ['rat', 'giant_rat'], minBestDepth: 0, count: [6, 10], tokensPerKill: 2 },
  { id: 'goblins', name: 'Goblins', npcIds: ['goblin', 'goblin_warlord'], minBestDepth: 0, count: [6, 10], tokensPerKill: 2 },
  { id: 'zombies', name: 'Zombies', npcIds: ['zombie'], minBestDepth: 3, count: [6, 12], tokensPerKill: 3 },
  { id: 'skeletons', name: 'Skeletons', npcIds: ['skeleton', 'skeleton_archer'], minBestDepth: 4, count: [8, 14], tokensPerKill: 3 },
  { id: 'wizards', name: 'Dark casters', npcIds: ['dark_wizard', 'infernal_mage'], minBestDepth: 3, count: [5, 10], tokensPerKill: 4 },
  { id: 'spiders', name: 'Giant spiders', npcIds: ['giant_spider'], minBestDepth: 5, count: [6, 12], tokensPerKill: 4 },
  { id: 'giants', name: 'Giants', npcIds: ['hill_giant', 'moss_giant', 'frost_giant'], minBestDepth: 5, count: [6, 12], tokensPerKill: 5 },
  { id: 'crypt', name: 'Crypt dwellers', npcIds: ['ghoul', 'wight', 'mummy'], minBestDepth: 6, count: [8, 14], tokensPerKill: 5 },
  { id: 'fire', name: 'Fire creatures', npcIds: ['hellhound', 'fire_elemental', 'salamander'], minBestDepth: 11, count: [8, 14], tokensPerKill: 7 },
  { id: 'demons', name: 'Demons', npcIds: ['lesser_demon', 'greater_demon'], minBestDepth: 11, count: [6, 12], tokensPerKill: 8 },
  { id: 'abyss', name: 'Abyssal horrors', npcIds: ['abyssal_fiend', 'shadow_reaper', 'soul_eater', 'tormentor'], minBestDepth: 21, count: [8, 14], tokensPerKill: 12 },
  { id: 'ice', name: 'Ice creatures', npcIds: ['ice_beast', 'frost_giant', 'freezing_wraith'], minBestDepth: 16, count: [8, 14], tokensPerKill: 10 },
];

export const SLAYER_BY_ID: Record<string, SlayerCategory> = Object.fromEntries(SLAYER_CATEGORIES.map((c) => [c.id, c]));

/** A task in progress; lives in the save so it carries across runs, like OSRS. */
export interface SlayerTask {
  category: string;
  total: number;
  remaining: number;
}

/** Slayer unlocks the first time you defeat this boss. */
export const SLAYER_UNLOCK_BOSS = 'goblin_warlord';

/** Tokens to skip a task at the Slayer master. */
export const SKIP_TASK_COST = 15;

/** Slayer-helm style bonus to accuracy and max hit on task, per Slayer level. */
export const SLAYER_BONUS_PER_LEVEL = 0.005;

/** A fresh task suited to how deep you've been; avoids repeating `previous` when possible. */
/** Permanent Slayer master unlocks, bought with tokens. */
export const SLAYER_UNLOCKS: Array<{ id: string; name: string; desc: string; cost: number }> = [
  { id: 'extended', name: 'Extended Tasks', desc: 'Tasks are 50% longer, and pay 50% more.', cost: 200 },
  { id: 'respite', name: "Slayer's Respite", desc: 'Finishing a task restores your HP and prayer.', cost: 150 },
  { id: 'bigger_badder', name: 'Bigger and Badder', desc: 'Monsters on your task have a 15% chance to be elite.', cost: 300 },
  { id: 'slayers_eye', name: "Slayer's Eye", desc: 'Monsters killed on task can drop treasure maps (1/80).', cost: 400 },
];

export function assignTask(bestDepth: number, rand: () => number, previous?: string, extended = false): SlayerTask {
  const pool = SLAYER_CATEGORIES.filter((c) => bestDepth >= c.minBestDepth);
  const fresh = pool.filter((c) => c.id !== previous);
  const choices = fresh.length ? fresh : pool;
  // Favour the more recent unlocks so tasks keep up with your progress.
  const weighted = choices.flatMap((c) => Array(1 + Math.floor(c.minBestDepth / 3)).fill(c));
  const cat = weighted[Math.floor(rand() * weighted.length)];
  const base = cat.count[0] + Math.floor(rand() * (cat.count[1] - cat.count[0] + 1));
  const total = extended ? Math.round(base * 1.5) : base;
  return { category: cat.id, total, remaining: total };
}
