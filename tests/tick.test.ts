import { describe, expect, it } from 'vitest';
import { TICK_MS, TickScheduler } from '../src/core/tick';

describe('TickScheduler', () => {
  it('fires handlers once per 600ms in registration order', () => {
    const s = new TickScheduler();
    const log: string[] = [];
    s.onTick((t) => log.push(`a${t}`));
    s.onTick((t) => log.push(`b${t}`));
    s.update(TICK_MS - 1);
    expect(log).toEqual([]);
    s.update(1);
    expect(log).toEqual(['a1', 'b1']);
    s.update(TICK_MS * 2 + 300);
    expect(log).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'b3']);
    expect(s.alpha).toBeCloseTo(0.5);
  });

  it('clamps catch-up after long pauses', () => {
    const s = new TickScheduler();
    s.update(60_000);
    expect(s.tick).toBe(5);
  });
});
