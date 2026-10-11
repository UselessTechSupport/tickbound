import { describe, expect, it } from 'vitest';
import { playRun } from '../src/sim/bot';

describe('balance bot', () => {
  it('plays fresh runs to completion and usually clears floor 1', () => {
    const results = [0, 1, 2, 3, 4].map((i) => playRun(500 + i, {}));
    for (const r of results) expect(r.killedBy).not.toBe('timeout');
    const avgDepth = results.reduce((a, r) => a + r.depth, 0) / results.length;
    // Guard rail against balance regressions: fresh saves should get past floor 2 on average.
    expect(avgDepth).toBeGreaterThanOrEqual(2.5);
  }, 120_000);
});
