import { describe, expect, it } from 'vitest';
import { combatLevel, effectiveLevel, hitChance, maxHit, roll, rollDamage } from '../src/systems/combat';

describe('combat formulas', () => {
  it('computes OSRS combat levels', () => {
    expect(combatLevel(1, 1, 1, 10)).toBe(3);
    expect(combatLevel(99, 99, 99, 99, 99)).toBe(126);
  });

  it('computes max hits', () => {
    expect(maxHit(effectiveLevel(1), 3)).toBe(1);
    // 99 str, aggressive, rune scimitar (+44)
    expect(maxHit(effectiveLevel(99, 3), 44)).toBe(19);
  });

  it('keeps hit chance within (0, 1) and favours the stronger side', () => {
    const weak = roll(effectiveLevel(1), 0);
    const strong = roll(effectiveLevel(80), 50);
    const low = hitChance(weak, strong);
    const high = hitChance(strong, weak);
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(0.1);
    expect(high).toBeGreaterThan(0.9);
    expect(high).toBeLessThan(1);
    expect(hitChance(1000, 1000)).toBeCloseTo(0.5, 2);
  });

  it('rolls damage in [0, max]', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1000; i++) {
      const d = rollDamage(0.7, 12, rand);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(12);
    }
  });
});
