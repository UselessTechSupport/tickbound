import { describe, expect, it } from 'vitest';
import { QUESTS, QUEST_BY_ID, questClaimable, questProgress } from '../src/data/quests';
import { RELIC_BY_ID } from '../src/data/relics';
import { GameState } from '../src/game/GameState';
import { claimQuest, claimableQuests, settleRun } from '../src/meta/camp';
import { freshMeta } from '../src/save/meta';

describe('quests', () => {
  it('every quest relic reward is a real quest-only relic', () => {
    for (const q of QUESTS) if (q.reward.relic) expect(RELIC_BY_ID[q.reward.relic]?.quest, q.id).toBe(true);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
  });

  it('progress counts lifetime totals; claiming pays out once', () => {
    const m = freshMeta();
    const q = QUEST_BY_ID.fresh_start;
    expect(questClaimable(q, m)).toBe(false);
    m.bestDepth = 4;
    expect(questProgress(q, m)).toEqual([3, 3]);
    expect(claimableQuests(m)).toBeGreaterThan(0);
    expect(claimQuest(m, 'fresh_start')).toBe(true);
    expect(m.tokens).toBe(40);
    expect(claimQuest(m, 'fresh_start')).toBe(false);
    expect(m.tokens).toBe(40);
  });

  it('bring-back quests remember your best haul at the end of a run', () => {
    const m = freshMeta();
    const g = new GameState(5);
    g.player.inventory.add('logs', 6);
    g.player.inventory.add('oak_logs', 5);
    settleRun(m, g);
    expect(m.questCarry.supply_run).toBe(11);
    expect(claimQuest(m, 'supply_run')).toBe(true);
    expect(m.materials.timber).toBeGreaterThanOrEqual(30);
  });

  it('quest relics are only offered once unlocked', () => {
    const offered = (questRelics: string[]) => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 60; seed++) {
        const g = new GameState(seed, () => {}, { questRelics });
        g.offerRelics();
        for (const r of g.pendingRelics ?? []) seen.add(r);
      }
      return seen;
    };
    expect(offered([]).has('fire_cape')).toBe(false);
    expect(offered(['fire_cape']).has('fire_cape')).toBe(true);
  });

  it('claiming Light Fingers unlocks Thieves\' Gloves', () => {
    const m = freshMeta();
    m.lifetime.pickpockets = 30;
    expect(claimQuest(m, 'light_fingers')).toBe(true);
    expect(m.questRelics).toContain('thieves_gloves');
  });

  it('gated quests are posted only once their giver is around', () => {
    const m = freshMeta();
    m.lifetime.tasks = 5;
    expect(questClaimable(QUEST_BY_ID.monster_hunter, m)).toBe(false);
    m.slayerUnlocked = true;
    expect(questClaimable(QUEST_BY_ID.monster_hunter, m)).toBe(true);
  });
});
