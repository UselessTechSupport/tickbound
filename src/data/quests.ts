import type { Counter } from './achievements';
import type { MetaSave } from '../save/meta';

/**
 * Quests from the camp NPCs, posted on the quest board. Progress counts your lifetime
 * totals, so anything you've already done counts. Claim rewards at the board.
 */

export type QuestGoal =
  | { kind: 'depth'; floor: number }
  | { kind: 'boss'; npc: string }
  | { kind: 'counter'; counter: Counter; count: number }
  | { kind: 'kills'; count: number }
  | { kind: 'built'; count: number }
  /** End a run carrying this many of these items (best run counts). */
  | { kind: 'carry'; items: string[]; count: number; what: string };

export interface QuestReward {
  tokens?: number;
  timber?: number;
  metal?: number;
  /** Quest relic that joins the relic pool. */
  relic?: string;
}

export interface QuestDef {
  id: string;
  name: string;
  giver: string;
  desc: string;
  goal: QuestGoal;
  reward: QuestReward;
  /** Only posted once this is true (e.g. the giver has arrived at camp). */
  posted?: (m: MetaSave) => boolean;
}

const LOGS = ['logs', 'oak_logs', 'willow_logs', 'maple_logs', 'yew_logs', 'magic_logs'];
const ORES = ['copper_ore', 'tin_ore', 'iron_ore', 'coal', 'mithril_ore', 'adamantite_ore', 'runite_ore'];

export const QUESTS: QuestDef[] = [
  { id: 'fresh_start', name: 'A Fresh Start', giver: 'Mentor', desc: 'Reach floor 3 of the dungeon.', goal: { kind: 'depth', floor: 3 }, reward: { tokens: 40 } },
  {
    id: 'supply_run', name: 'Supply Run', giver: 'Toolsmith', desc: 'End a run carrying 10 logs.',
    goal: { kind: 'carry', items: LOGS, count: 10, what: 'logs' }, reward: { tokens: 40, timber: 30 },
  },
  {
    id: 'ore_shipment', name: 'Ore Shipment', giver: 'Toolsmith', desc: 'End a run carrying 10 ores.',
    goal: { kind: 'carry', items: ORES, count: 10, what: 'ores' }, reward: { tokens: 40, metal: 30 },
  },
  { id: 'cull', name: 'The Cull', giver: 'Mentor', desc: 'Kill 100 monsters.', goal: { kind: 'kills', count: 100 }, reward: { tokens: 120 } },
  {
    id: 'goblin_diplomacy', name: 'Goblin Diplomacy', giver: 'Mentor', desc: 'Defeat the Goblin Warlord (floor 5).',
    goal: { kind: 'boss', npc: 'goblin_warlord' }, reward: { tokens: 100, metal: 20 },
  },
  {
    id: 'home_improvements', name: 'Home Improvements', giver: 'Builder', desc: 'Build 3 camp structures.',
    goal: { kind: 'built', count: 3 }, reward: { timber: 60, metal: 60 },
  },
  {
    id: 'light_fingers', name: 'Light Fingers', giver: 'Mentor', desc: 'Pick 25 pockets.',
    goal: { kind: 'counter', counter: 'pickpockets', count: 25 }, reward: { tokens: 80, relic: 'thieves_gloves' },
  },
  {
    id: 'parkour', name: 'Over the Wall', giver: 'Builder', desc: 'Use 15 Agility shortcuts.',
    goal: { kind: 'counter', counter: 'shortcuts', count: 15 }, reward: { tokens: 80, relic: 'boots_of_lightness' },
  },
  {
    id: 'arrow_supply', name: 'Arrow Supply', giver: 'Toolsmith', desc: 'Fletch 10 times.',
    goal: { kind: 'counter', counter: 'fletches', count: 10 }, reward: { tokens: 60, relic: 'fletchers_kit' },
  },
  {
    id: 'monster_hunter', name: 'Monster Hunter', giver: 'Slayer master', desc: 'Complete 3 Slayer tasks.',
    goal: { kind: 'counter', counter: 'tasks', count: 3 }, reward: { tokens: 150 }, posted: (m) => m.slayerUnlocked,
  },
  {
    id: 'fire_within', name: 'The Fire Within', giver: 'Enchanter', desc: 'Defeat TzTok-Jad (floor 10).',
    goal: { kind: 'boss', npc: 'tztok_jad' }, reward: { tokens: 200, relic: 'fire_cape' }, posted: (m) => m.enchanterUnlocked || (m.killCounts.goblin_warlord ?? 0) > 0,
  },
  { id: 'into_the_abyss', name: 'Into the Abyss', giver: 'Mentor', desc: 'Reach floor 20.', goal: { kind: 'depth', floor: 20 }, reward: { tokens: 500 } },
  // Later quests: they point at the deeper and rarer content.
  {
    id: 'goblin_chase', name: 'Goblin Chase', giver: 'Toolsmith', desc: 'Catch 3 treasure goblins.',
    goal: { kind: 'counter', counter: 'goblins', count: 3 }, reward: { tokens: 250, metal: 40 },
  },
  {
    id: 'strange_floors', name: 'Strange Floors', giver: 'Mentor', desc: 'Arrive on 10 floors with an event.',
    goal: { kind: 'counter', counter: 'floorEvents', count: 10 }, reward: { tokens: 200, timber: 60 },
  },
  {
    id: 'trade_routes', name: 'Trade Routes', giver: 'Builder', desc: 'Trade with 5 wandering adventurers.',
    goal: { kind: 'counter', counter: 'trades', count: 5 }, reward: { timber: 120, metal: 120 },
  },
  {
    id: 'shiny_things', name: 'Shiny Things', giver: 'Toolsmith', desc: 'End a run carrying 3 gems.',
    goal: { kind: 'carry', items: ['sapphire', 'emerald', 'ruby', 'diamond', 'dragonstone'], count: 3, what: 'gems' }, reward: { tokens: 200, metal: 60 },
  },
  { id: 'abyss_gazer', name: 'Abyss Gazer', giver: 'Slayer master', desc: 'Reach floor 21, the Abyss.', goal: { kind: 'depth', floor: 21 }, reward: { tokens: 600 }, posted: (m) => m.slayerUnlocked },
  {
    id: 'lich_bane', name: 'Lich Bane', giver: 'Enchanter', desc: 'Defeat the Lich (floor 25).',
    goal: { kind: 'boss', npc: 'lich' }, reward: { tokens: 1200 }, posted: (m) => m.enchanterUnlocked,
  },
  { id: 'wyrm_bane', name: 'The Oldest Thing', giver: 'Mentor', desc: 'Defeat the Ancient Wyrm (floor 30).', goal: { kind: 'boss', npc: 'ancient_wyrm' }, reward: { tokens: 2500 }, posted: (m) => (m.killCounts.lich ?? 0) > 0 },
  { id: 'bottomless', name: 'Bottomless', giver: 'Mentor', desc: 'Reach floor 40.', goal: { kind: 'depth', floor: 40 }, reward: { tokens: 4000 }, posted: (m) => m.bestDepth >= 30 },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** [progress, target]. */
export function questProgress(q: QuestDef, m: MetaSave): [number, number] {
  const g = q.goal;
  switch (g.kind) {
    case 'depth': return [Math.min(m.bestDepth, g.floor), g.floor];
    case 'boss': return [Math.min(m.killCounts[g.npc] ?? 0, 1), 1];
    case 'counter': return [Math.min(m.lifetime[g.counter] ?? 0, g.count), g.count];
    case 'kills': return [Math.min(m.lifetime.kills ?? 0, g.count), g.count];
    case 'built': return [Math.min(Object.values(m.structures).filter((l) => (l ?? 0) > 0).length, g.count), g.count];
    case 'carry': return [Math.min(m.questCarry[q.id] ?? 0, g.count), g.count];
  }
}

export const isQuestPosted = (q: QuestDef, m: MetaSave) => !q.posted || q.posted(m);

export function questClaimable(q: QuestDef, m: MetaSave): boolean {
  const [have, need] = questProgress(q, m);
  return isQuestPosted(q, m) && !m.questsDone.includes(q.id) && have >= need;
}

export function describeReward(r: QuestReward, relicName?: string): string {
  return [
    r.tokens ? `${r.tokens} tokens` : '', r.timber ? `${r.timber} timber` : '', r.metal ? `${r.metal} metal` : '',
    r.relic ? `unlocks the ${relicName ?? r.relic} relic` : '',
  ].filter(Boolean).join(', ');
}
