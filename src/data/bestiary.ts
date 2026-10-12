import { NPCS, NpcDef } from './npcs';

/**
 * The bestiary: every monster you can meet, with kill-count milestones that pay tokens.
 * A slow, steady reward for fighting everything rather than farming one floor.
 */
export const BESTIARY_MILESTONES: Array<{ kills: number; tokens: number }> = [
  { kills: 10, tokens: 5 }, { kills: 100, tokens: 25 }, { kills: 1000, tokens: 100 },
];

/** Monsters in the bestiary: everything that spawns, plus bosses, in depth order. */
export const BESTIARY: NpcDef[] = Object.values(NPCS)
  .filter((n) => n.weight > 0 || n.boss)
  .sort((a, b) => (a.boss?.floor ?? a.minDepth) - (b.boss?.floor ?? b.minDepth));

/** Milestone keys look like "goblin:100". */
export const milestoneKey = (npcId: string, kills: number) => `${npcId}:${kills}`;
