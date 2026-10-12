import { describe, expect, it } from 'vitest';
import { contractProgress, ensureContracts, rollContracts } from '../src/data/contracts';
import { GameState } from '../src/game/GameState';
import { claimContract, noteContractDepth } from '../src/meta/camp';
import { freshMeta } from '../src/save/meta';
import { SLAYER_BY_ID } from '../src/data/slayer';

describe('daily contracts', () => {
  it('the same day always rolls the same three; another day differs', () => {
    expect(rollContracts('2026-10-11', 8)).toEqual(rollContracts('2026-10-11', 8));
    expect(rollContracts('2026-10-11', 8)).toHaveLength(3);
    const days = new Set(Array.from({ length: 10 }, (_, i) => JSON.stringify(rollContracts(`2026-10-${10 + i}`, 8).map((c) => c.goal))));
    expect(days.size).toBeGreaterThan(5);
  });

  it('progress counts from when posted; claiming pays once, with a bonus for all three', () => {
    const m = freshMeta();
    m.bestDepth = 8;
    m.lifetime.gathers = 500;
    m.killCounts.zombie = 100;
    ensureContracts(m, '2026-10-11');
    expect(ensureContracts(m, '2026-10-11')).toBe(false);
    for (const c of m.contracts!.contracts) expect(contractProgress(c, m)[0]).toBe(0);
    // Finish everything.
    for (const c of m.contracts!.contracts) {
      const g = c.goal;
      if (g.kind === 'counter') m.lifetime[g.counter] = (m.lifetime[g.counter] ?? 0) + g.count;
      if (g.kind === 'depth') {
        const run = new GameState(1);
        run.loadFloor(g.floor);
        noteContractDepth(m, run);
      }
    }
    const killContract = m.contracts!.contracts.find((c) => c.goal.kind === 'kills')!;
    const goal = killContract.goal as { category: string; count: number };
    const id = SLAYER_BY_ID[goal.category].npcIds[0];
    m.killCounts[id] = (m.killCounts[id] ?? 0) + goal.count;
    const tokensBefore = m.tokens;
    const paid = m.contracts!.contracts.map((c) => claimContract(m, c.id));
    expect(paid.every((p) => p > 0)).toBe(true);
    expect(m.tokens - tokensBefore).toBe(paid.reduce((a, b) => a + b, 0));
    expect(paid[2]).toBeGreaterThan(paid[0]); // the last claim includes the bonus
    expect(claimContract(m, m.contracts!.contracts[0].id)).toBe(0);
  });

  it('skip-ahead runs do not count toward depth contracts', () => {
    const m = freshMeta();
    ensureContracts(m, '2026-10-12');
    noteContractDepth(m, new GameState(2, () => {}, { startDepth: 11 }));
    expect(m.contracts!.bestDepthToday).toBe(0);
  });
});
