import { describe, expect, it } from 'vitest';
import { MASTERY_THRESHOLDS, masteryLevel, nextMasteryAt } from '../src/data/mastery';
import { GameState } from '../src/game/GameState';
import { addMastery, masteryLevels } from '../src/meta/camp';
import { freshMeta } from '../src/save/meta';
import { xpForLevel } from '../src/systems/xp';

describe('skill mastery', () => {
  it('levels follow the thresholds', () => {
    expect(masteryLevel(0)).toBe(0);
    expect(masteryLevel(49)).toBe(0);
    expect(masteryLevel(50)).toBe(1);
    expect(masteryLevel(4000)).toBe(10);
    expect(nextMasteryAt(60)).toBe(150);
    expect(nextMasteryAt(99999)).toBeNull();
    for (let i = 1; i < MASTERY_THRESHOLDS.length; i++) expect(MASTERY_THRESHOLDS[i]).toBeGreaterThan(MASTERY_THRESHOLDS[i - 1]);
  });

  it('only levels gained during the run count (not starting or catch-up levels)', () => {
    const m = freshMeta();
    const g = new GameState(5, () => {}, { startDepth: 6, perks: { basic_training: 5 } });
    const startAttack = g.player.skills.level('attack');
    g.player.skills.xp.attack = xpForLevel(startAttack + 4);
    g.player.skills.xp.mining = xpForLevel(30);
    addMastery(m, g);
    expect(m.masteryPoints.attack).toBe(4);
    expect(m.masteryPoints.mining).toBe(29);
    expect(m.masteryPoints.strength).toBeUndefined();
  });

  it('reports level-ups and feeds bonuses into a run', () => {
    const m = freshMeta();
    m.masteryPoints.mining = 45;
    const g = new GameState(6);
    g.player.skills.xp.mining = xpForLevel(11);
    expect(addMastery(m, g)).toEqual([{ skill: 'mining', level: 1 }]);
    m.masteryPoints.strength = 4000;
    const strong = new GameState(7, () => {}, { mastery: masteryLevels(m) });
    const plain = new GameState(7);
    for (const s of [strong, plain]) {
      s.player.skills.xp.strength = xpForLevel(90);
      s.player.equipment.weapon = 'rune_scimitar';
    }
    expect(strong.combatPreview().maxHit).toBeGreaterThan(plain.combatPreview().maxHit);
    expect(strong.masteryOf('mining')).toBeCloseTo(0.02);
  });
});
