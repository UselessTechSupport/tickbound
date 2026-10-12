import type { GameState } from '../game/GameState';
import { RECIPES } from './recipes';
import { SKILLS } from './skills';
import { masteryLevel } from './mastery';
import { BRANCHES, PERKS } from './skillTree';
import { STRUCTURES } from './construction';
import { QUESTS } from './quests';
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
  | 'weaknessKills' | 'mimicKills' | 'relics' | 'rangedKills' | 'magicKills' | 'tasks' | 'fires'
  | 'potions' | 'herbs' | 'eliteKills' | 'fletches' | 'pickpockets' | 'locks' | 'shortcuts' | 'goblins' | 'floorEvents' | 'trades' | 'treasures';

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
const killedTimes = (npcId: string, n: number) => (c: AchievementContext) => (c.meta.killCounts[npcId] ?? 0) >= n;
const made = (pred: (id: string) => boolean) => (c: AchievementContext) => Object.keys(c.meta.made).some(pred);
const inRun = (f: (g: GameState) => boolean) => (c: AchievementContext) => !c.game.isCamp && f(c.game);
/** Run challenges can't be done with skip-ahead or autoplay. */
const unassisted = (f: (g: GameState) => boolean) => inRun((g) => !g.assisted && f(g));
const masteries = (c: AchievementContext) => SKILLS.map((s) => masteryLevel(c.meta.masteryPoints[s] ?? 0));
const capstones = (c: AchievementContext) => PERKS.filter((p) => p.tier === 6 && (c.meta.perks[p.id] ?? 0) > 0).length;
const branchMaxed = (c: AchievementContext) => BRANCHES.some((b) => PERKS.filter((p) => p.branch === b.id)
  .every((p) => (c.meta.perks[p.id] ?? 0) >= p.costs.length));
const structuresMaxed = (c: AchievementContext) => STRUCTURES.every((s) => (c.meta.structures[s.id] ?? 0) >= s.levels.length);
const NON_COMBAT = ['mining', 'woodcutting', 'fishing', 'cooking', 'smithing', 'herblore'] as const;
const MIX_OUTPUTS = RECIPES.filter((r) => r.station === 'mix').map((r) => r.output);

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
  { id: 'slayer_novice', name: 'Slayer Novice', desc: 'Complete a Slayer task.', tier: 'easy', ...count('tasks', 1) },
  { id: 'firestarter', name: 'Firestarter', desc: 'Light 10 fires.', tier: 'easy', ...count('fires', 10) },
  { id: 'green_thumb', name: 'Green Thumb', desc: 'Pick 10 herbs.', tier: 'easy', ...count('herbs', 10) },
  { id: 'gold_rush', name: 'Gold Rush', desc: 'Catch a treasure goblin.', tier: 'easy', ...count('goblins', 1) },
  { id: 'novice_builder', name: 'Home Sweet Home', desc: 'Build a camp structure.', tier: 'easy', check: (c) => Object.values(c.meta.structures).some((l) => (l ?? 0) > 0) },
  { id: 'first_brew', name: 'First Brew', desc: 'Mix a potion.', tier: 'easy', ...count('potions', 1) },
  { id: 'fletcher', name: 'Fletcher', desc: 'Fletch a bow or some arrows.', tier: 'easy', ...count('fletches', 1) },
  { id: 'sticky_fingers', name: 'Sticky Fingers', desc: 'Pick a pocket.', tier: 'easy', ...count('pickpockets', 1) },
  { id: 'shortcut_taker', name: 'Shortcut Taker', desc: 'Use an Agility shortcut.', tier: 'easy', ...count('shortcuts', 1) },
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
  { id: 'crypt_crawler', name: 'Crypt Crawler', desc: 'Reach the Crypt (floor 6).', tier: 'medium', check: reached(6) },
  { id: 'slayer_adept', name: 'Slayer Adept', desc: 'Complete 10 Slayer tasks.', tier: 'medium', ...count('tasks', 10) },
  { id: 'master_chef', name: 'Master Chef', desc: 'Cook 100 fish.', tier: 'medium', ...count('cooks', 100) },
  { id: 'prospector', name: 'Prospector', desc: 'Gather 100 resources.', tier: 'medium', ...count('gathers', 100) },
  { id: 'relic_collector', name: 'Relic Collector', desc: 'Hold 3 relics in one run.', tier: 'medium', check: inRun((g) => g.relics.length >= 3) },
  { id: 'warlords_bane', name: "Warlord's Bane", desc: 'Kill the Goblin Warlord 5 times.', tier: 'medium', check: killedTimes('goblin_warlord', 5) },
  { id: 'mithril_smith', name: 'Mithril Smith', desc: 'Smith a mithril item.', tier: 'medium', check: made((id) => /^mithril_(scimitar|kiteshield|platebody)$/.test(id)) },
  { id: 'herbalist', name: 'Herbalist', desc: 'Mix 25 potions.', tier: 'medium', ...count('potions', 25) },
  { id: 'trader', name: 'Wanderer', desc: 'Trade with 10 wandering adventurers.', tier: 'medium', ...count('trades', 10) },
  { id: 'glutton', name: 'Glutton for Punishment', desc: 'Reach floor 10 with 3 or more run modifiers on.', tier: 'hard', check: unassisted((g) => g.depth >= 10 && g.modifiers.length >= 3) },
  { id: 'masochist', name: 'Masochist', desc: 'Reach floor 20 with all six run modifiers on.', tier: 'elite', check: unassisted((g) => g.depth >= 20 && g.modifiers.length >= 6) },
  { id: 'cursed_collector', name: 'Cursed Collector', desc: 'Carry 3 dark shrine curses in one run.', tier: 'medium', check: inRun((g) => g.curses.length >= 3) },
  { id: 'deep_sea_chef', name: 'Deep Sea Chef', desc: 'Cook a manta ray.', tier: 'hard', check: made((id) => id === 'manta_ray') },
  { id: 'dragonsmith', name: 'Dragonsmith', desc: 'Smith a dragon platebody.', tier: 'elite', check: made((id) => id === 'dragon_platebody') },
  { id: 'master_fletcher', name: 'Master Fletcher', desc: 'Fletch a magic shortbow.', tier: 'hard', check: made((id) => id === 'magic_shortbow') },
  { id: 'wizard_supreme', name: 'Wizard Supreme', desc: 'Reach Magic 95 in a run (Fire Surge).', tier: 'elite', check: inRun((g) => g.player.skills.level('magic') >= 95) },
  { id: 'true_piety', name: 'True Piety', desc: 'Reach Prayer 45 in a run (Piety).', tier: 'hard', check: inRun((g) => g.player.skills.level('prayer') >= 45) },
  { id: 'jeweller', name: 'Dragon Jeweller', desc: 'Craft a dragonstone amulet.', tier: 'hard', check: made((id) => id === 'dragonstone_amulet') },
  { id: 'x_marks', name: 'X Marks the Spot', desc: 'Dig up buried treasure.', tier: 'easy', ...count('treasures', 1) },
  { id: 'eventful', name: 'Eventful', desc: 'Arrive on 25 floors with an event.', tier: 'medium', ...count('floorEvents', 25) },
  { id: 'adept', name: 'Adept', desc: 'Reach mastery 5 in any skill.', tier: 'medium', check: (c) => masteries(c).some((l) => l >= 5) },
  { id: 'questing', name: 'Adventurer', desc: 'Complete 6 quests.', tier: 'medium', check: (c) => c.meta.questsDone.length >= 6 },
  { id: 'master_thief', name: 'Master Thief', desc: 'Pick 50 pockets.', tier: 'medium', ...count('pickpockets', 50) },
  { id: 'safecracker', name: 'Safecracker', desc: 'Pick the locks of 10 chests.', tier: 'medium', ...count('locks', 10) },
  { id: 'parkour', name: 'Parkour', desc: 'Use 25 Agility shortcuts.', tier: 'medium', ...count('shortcuts', 25) },
  { id: 'bowyer', name: 'Bowyer', desc: 'Fletch 50 times.', tier: 'medium', ...count('fletches', 50) },
  { id: 'elite_hunter', name: 'Elite Hunter', desc: 'Kill 10 elite monsters.', tier: 'medium', ...count('eliteKills', 10) },
  { id: 'juiced', name: 'Juiced', desc: 'Have 3 stats boosted by potions at once.', tier: 'medium', check: inRun((g) => Object.values(g.player.boosts).filter((b) => (b ?? 0) > 0).length >= 3) },
  { id: 'collector', name: 'Collector', desc: 'Log 20 unique items in your collection log.', tier: 'medium', check: (c) => uniques(c) >= 20 },

  // Hard
  { id: 'fight_caves', name: 'The Fight Caves', desc: 'Defeat TzTok-Jad.', tier: 'hard', check: killed('tztok_jad') },
  { id: 'abyssal', name: 'Abyssal', desc: 'Reach floor 15.', tier: 'hard', check: reached(15) },
  { id: 'untouchable', name: 'Untouchable', desc: 'Defeat a boss without taking any damage from it.', tier: 'hard' },
  { id: 'ghost', name: 'Ghost', desc: 'Reach floor 5 without killing anything.', tier: 'hard', check: unassisted((g) => g.depth >= 5 && g.kills === 0) },
  { id: 'iron_stomach', name: 'Iron Stomach', desc: 'Reach floor 10 without eating.', tier: 'hard', check: unassisted((g) => g.depth >= 10 && g.runStats.foodEaten === 0) },
  { id: 'master_of_arms', name: 'Master of Arms', desc: 'Kill monsters with melee, ranged and magic in one run.', tier: 'hard', check: (c) => c.game.runStats.killStyles.size === 3 },
  { id: 'into_the_fire', name: 'Into the Fire', desc: 'Reach the Volcanic depths (floor 11).', tier: 'hard', check: reached(11) },
  { id: 'rune_smith', name: 'Rune Smith', desc: 'Smith a rune item.', tier: 'hard', check: made((id) => /^rune_(scimitar|kiteshield|platebody)$/.test(id)) },
  { id: 'runite_miner', name: 'Runite Miner', desc: 'Mine runite ore.', tier: 'hard', check: made((id) => id === 'runite_ore') },
  { id: 'harpoon_master', name: 'Harpoon Master', desc: 'Catch a raw swordfish.', tier: 'hard', check: made((id) => id === 'raw_swordfish') },
  { id: 'specialist', name: 'Specialist', desc: 'Reach level 50 in a gathering or crafting skill in one run.', tier: 'hard', check: inRun((g) => NON_COMBAT.some((s) => g.player.skills.level(s) >= 50)) },
  { id: 'relic_hoarder', name: 'Relic Hoarder', desc: 'Hold 5 relics in one run.', tier: 'hard', check: inRun((g) => g.relics.length >= 5) },
  { id: 'fire_cape', name: 'Fire Cape', desc: 'Kill TzTok-Jad 5 times.', tier: 'hard', check: killedTimes('tztok_jad', 5) },
  { id: 'super_brewer', name: 'Super Brewer', desc: 'Mix a super defence.', tier: 'hard', check: made((id) => id === 'super_defence') },
  { id: 'champion_slayer', name: 'Champion Slayer', desc: 'Kill 100 elite monsters.', tier: 'hard', ...count('eliteKills', 100) },
  { id: 'thousand', name: 'Slayer of a Thousand', desc: 'Kill 1,000 monsters.', tier: 'hard', ...count('kills', 1000) },
  { id: 'combat_80', name: 'Veteran', desc: 'Reach combat level 80 in a run.', tier: 'hard', check: (c) => !c.game.isCamp && c.game.player.combatLevel >= 80 },

  // Elite
  // Long-term goals: mastery, the skill tree, camp and quests.
  { id: 'well_rounded', name: 'Well Rounded', desc: 'Reach mastery 1 in every skill.', tier: 'hard', check: (c) => masteries(c).every((l) => l >= 1) },
  { id: 'true_master', name: 'True Master', desc: 'Reach mastery 10 in any skill.', tier: 'hard', check: (c) => masteries(c).some((l) => l >= 10) },
  { id: 'grandmaster_of_all', name: 'Master of Many', desc: 'Reach mastery 10 in five skills.', tier: 'elite', check: (c) => masteries(c).filter((l) => l >= 10).length >= 5 },
  { id: 'capstone', name: 'Capstone', desc: 'Buy a capstone perk.', tier: 'hard', check: (c) => capstones(c) >= 1 },
  { id: 'branch_master', name: 'Branch Master', desc: 'Buy every perk in a skill tree branch.', tier: 'elite', check: branchMaxed },
  { id: 'apex', name: 'Apex', desc: 'Buy every capstone perk.', tier: 'elite', check: (c) => capstones(c) >= BRANCHES.length },
  { id: 'architect', name: 'Architect', desc: 'Build every camp structure to its highest level.', tier: 'hard', check: structuresMaxed },
  { id: 'quest_cape', name: 'Quest Cape', desc: 'Complete every quest.', tier: 'elite', check: (c) => c.meta.questsDone.length >= QUESTS.length },
  { id: 'goblin_hunter', name: 'Goblin Hunter', desc: 'Catch 10 treasure goblins.', tier: 'hard', ...count('goblins', 10) },
  { id: 'lich_slayer', name: 'Phylactery Shattered', desc: 'Defeat the Lich (floor 25).', tier: 'elite', check: killed('lich') },
  { id: 'wyrm_slayer', name: 'Wyrmslayer', desc: 'Defeat the Ancient Wyrm (floor 30).', tier: 'elite', check: killed('ancient_wyrm') },
  { id: 'hollow_slayer', name: 'Uncrowned', desc: 'Defeat the Hollow King (floor 35).', tier: 'elite', check: killed('hollow_king') },
  { id: 'void_slayer', name: 'Into the Void', desc: 'Defeat the Void Titan (floor 40).', tier: 'elite', check: killed('void_titan') },
  { id: 'chaos', name: 'Chaos Theory', desc: 'Defeat the Chaos Elemental.', tier: 'elite', check: killed('chaos_elemental') },
  { id: 'gorilla', name: 'Gorilla Warfare', desc: 'Defeat the Demonic gorilla.', tier: 'elite', check: killed('demonic_gorilla') },
  { id: 'abyss_walker', name: 'Abyss Walker', desc: 'Reach floor 25.', tier: 'elite', check: reached(25) },
  { id: 'pet_owner', name: 'Funny Feeling', desc: 'Obtain a boss pet.', tier: 'elite', check: (c) => c.meta.pets.length > 0 },
  { id: 'speedrunner', name: 'Speedrunner', desc: 'Reach floor 10 within 1,500 ticks.', tier: 'elite', check: unassisted((g) => g.depth >= 10 && g.tickCount <= 1500) },
  { id: 'frostbitten', name: 'Frostbitten', desc: 'Reach the Frozen caverns (floor 16).', tier: 'elite', check: reached(16) },
  { id: 'slayer_master', name: 'Slayer Master', desc: 'Complete 50 Slayer tasks.', tier: 'elite', ...count('tasks', 50) },
  { id: 'dragon_slayer', name: 'Dragon Slayer', desc: 'Obtain a dragon scimitar.', tier: 'elite', check: (c) => (c.meta.collection.dragon_scimitar ?? 0) > 0 },
  { id: 'zookeeper', name: 'Zookeeper', desc: 'Own every boss pet.', tier: 'elite', check: (c) => c.meta.pets.length >= 4 },
  { id: 'master_herbalist', name: 'Master Herbalist', desc: 'Mix every kind of potion.', tier: 'elite', check: (c) => MIX_OUTPUTS.every((id) => (c.meta.made[id] ?? 0) > 0) },
  { id: 'completionist', name: 'Completionist', desc: 'Log 60 unique items in your collection log.', tier: 'elite', check: (c) => uniques(c) >= 60 },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export function tierOf(a: AchievementDef) {
  return TIERS.find((t) => t.id === a.tier)!;
}
