import type { GameState } from '../game/GameState';
import type { MetaSave } from '../save/meta';

export type Tier = 'easy' | 'medium' | 'hard' | 'elite';

export const TIERS: Array<{ id: Tier; name: string; reward: number; color: number }> = [
  { id: 'easy', name: 'Easy', reward: 10, color: 0x60c060 },
  { id: 'medium', name: 'Medium', reward: 25, color: 0x60a0e0 },
  { id: 'hard', name: 'Hard', reward: 60, color: 0xc070e0 },
  { id: 'elite', name: 'Elite', reward: 150, color: 0xffa020 },
];

/** Lifetime counters kept in the save (see ProgressTracker). */
export type Counter =
  | 'kills' | 'gathers' | 'cooks' | 'smiths' | 'bones' | 'chests' | 'purchases' | 'blocks'
  | 'weaknessKills' | 'mimicKills' | 'relics' | 'rangedKills' | 'magicKills';

export interface AchievementContext {
  meta: MetaSave;
  /** The current run (or camp). */
  game: GameState;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  tier: Tier;
  /** Lifetime-counter goals show a progress bar. */
  counter?: [Counter, number];
  /** Other goals: true once achieved (checked after every tracked event). */
  check?: (c: AchievementContext) => boolean;
}

const count = (counter: Counter, target: number) => ({ counter: [counter, target] as [Counter, number] });
const killed = (npcId: string) => (c: AchievementContext) => (c.meta.killCounts[npcId] ?? 0) > 0;
const reached = (depth: number) => (c: AchievementContext) => c.meta.bestDepth >= depth || (!c.game.isCamp && c.game.depth >= depth);
const uniques = (c: AchievementContext) => Object.keys(c.meta.collection).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  // Easy
  { id: 'first_blood', name: 'First Blood', desc: 'Kill a monster.', tier: 'easy', ...count('kills', 1) },
  { id: 'into_depths', name: 'Into the Depths', desc: 'Reach floor 3.', tier: 'easy', check: reached(3) },
  { id: 'gatherer', name: 'Gatherer', desc: 'Gather 10 resources.', tier: 'easy', ...count('gathers', 10) },
  { id: 'chef', name: "Chef's Assistant", desc: 'Cook 10 fish.', tier: 'easy', ...count('cooks', 10) },
  { id: 'blacksmith', name: 'Apprentice Smith', desc: 'Smith an item at an anvil.', tier: 'easy', ...count('smiths', 1) },
  { id: 'pious', name: 'Pious', desc: 'Bury 25 bones.', tier: 'easy', ...count('bones', 25) },
  { id: 'treasure_seeker', name: 'Treasure Seeker', desc: 'Open 5 chests.', tier: 'easy', ...count('chests', 5) },
  { id: 'customer', name: 'Valued Customer', desc: 'Buy something from a wandering merchant.', tier: 'easy', ...count('purchases', 1) },
  { id: 'relic_hunter', name: 'Relic Hunter', desc: 'Choose a relic.', tier: 'easy', ...count('relics', 1) },
  { id: 'archer', name: 'Fletched', desc: 'Kill a monster with ranged.', tier: 'easy', ...count('rangedKills', 1) },
  { id: 'wizard', name: 'Abracadabra', desc: 'Kill a monster with magic.', tier: 'easy', ...count('magicKills', 1) },

  // Medium
  { id: 'warlord', name: 'Goblin Diplomacy', desc: 'Defeat the Goblin Warlord.', tier: 'medium', check: killed('goblin_warlord') },
  { id: 'deep_diver', name: 'Deep Diver', desc: 'Reach floor 8.', tier: 'medium', check: reached(8) },
  { id: 'centurion', name: 'Centurion', desc: 'Kill 100 monsters.', tier: 'medium', ...count('kills', 100) },
  { id: 'exploiter', name: 'Weakness Exploited', desc: 'Kill 25 monsters with the style they are weak to.', tier: 'medium', ...count('weaknessKills', 25) },
  { id: 'mimic_buster', name: 'Not a Chest', desc: 'Kill a Mimic.', tier: 'medium', ...count('mimicKills', 1) },
  { id: 'flicker', name: 'Prayer Flicker', desc: 'Block 25 hits with protection prayers.', tier: 'medium', ...count('blocks', 25) },
  { id: 'combat_40', name: 'Seasoned', desc: 'Reach combat level 40 in a run.', tier: 'medium', check: (c) => !c.game.isCamp && c.game.player.combatLevel >= 40 },
  { id: 'hoarder', name: 'Hoarder', desc: 'Carry 1,000 coins at once.', tier: 'medium', check: (c) => c.game.player.inventory.count('coins') >= 1000 },
  { id: 'collector', name: 'Collector', desc: 'Log 20 unique items in your collection log.', tier: 'medium', check: (c) => uniques(c) >= 20 },

  // Hard
  { id: 'fight_caves', name: 'The Fight Caves', desc: 'Defeat TzTok-Jad.', tier: 'hard', check: killed('tztok_jad') },
  { id: 'abyssal', name: 'Abyssal', desc: 'Reach floor 15.', tier: 'hard', check: reached(15) },
  { id: 'untouchable', name: 'Untouchable', desc: 'Defeat a boss without taking any damage from it.', tier: 'hard' },
  { id: 'ghost', name: 'Ghost', desc: 'Reach floor 5 without killing anything.', tier: 'hard', check: (c) => !c.game.isCamp && c.game.depth >= 5 && c.game.kills === 0 },
  { id: 'iron_stomach', name: 'Iron Stomach', desc: 'Reach floor 10 without eating.', tier: 'hard', check: (c) => !c.game.isCamp && c.game.depth >= 10 && c.game.runStats.foodEaten === 0 },
  { id: 'master_of_arms', name: 'Master of Arms', desc: 'Kill monsters with melee, ranged and magic in one run.', tier: 'hard', check: (c) => c.game.runStats.killStyles.size === 3 },
  { id: 'thousand', name: 'Slayer of a Thousand', desc: 'Kill 1,000 monsters.', tier: 'hard', ...count('kills', 1000) },
  { id: 'combat_80', name: 'Veteran', desc: 'Reach combat level 80 in a run.', tier: 'hard', check: (c) => !c.game.isCamp && c.game.player.combatLevel >= 80 },

  // Elite
  { id: 'chaos', name: 'Chaos Theory', desc: 'Defeat the Chaos Elemental.', tier: 'elite', check: killed('chaos_elemental') },
  { id: 'gorilla', name: 'Gorilla Warfare', desc: 'Defeat the Demonic gorilla.', tier: 'elite', check: killed('demonic_gorilla') },
  { id: 'abyss_walker', name: 'Abyss Walker', desc: 'Reach floor 25.', tier: 'elite', check: reached(25) },
  { id: 'pet_owner', name: 'Funny Feeling', desc: 'Obtain a boss pet.', tier: 'elite', check: (c) => c.meta.pets.length > 0 },
  { id: 'speedrunner', name: 'Speedrunner', desc: 'Reach floor 10 within 1,500 ticks.', tier: 'elite', check: (c) => !c.game.isCamp && c.game.depth >= 10 && c.game.tickCount <= 1500 },
  { id: 'completionist', name: 'Completionist', desc: 'Log 60 unique items in your collection log.', tier: 'elite', check: (c) => uniques(c) >= 60 },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export function tierOf(a: AchievementDef) {
  return TIERS.find((t) => t.id === a.tier)!;
}
