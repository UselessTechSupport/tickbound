import { describe, expect, it } from 'vitest';
import { journal, journalSpent, overallCompletion } from '../src/meta/journal';
import { freshMeta } from '../src/save/meta';

describe('progress journal', () => {
  it('a fresh save is at 0%, and progress raises it', () => {
    const m = freshMeta();
    expect(overallCompletion(journal(m))).toBe(0);
    m.perks.basic_training = 5;
    m.armoury.melee = 3;
    m.masteryPoints.attack = 4000;
    m.questsDone.push('fresh_start');
    const pct = overallCompletion(journal(m));
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(0.2);
    expect(journalSpent(m)).toBeGreaterThan(0);
    for (const line of journal(m)) expect(line.total).toBeGreaterThan(0);
  });
});
