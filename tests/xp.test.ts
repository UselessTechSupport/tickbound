import { describe, expect, it } from 'vitest';
import { levelForXp, xpForLevel } from '../src/systems/xp';

describe('OSRS XP table', () => {
  it('matches known values', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(83);
    expect(xpForLevel(10)).toBe(1154);
    expect(xpForLevel(50)).toBe(101333);
    expect(xpForLevel(92)).toBe(6517253);
    expect(xpForLevel(99)).toBe(13034431);
  });

  it('converts XP back to levels', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(82)).toBe(1);
    expect(levelForXp(83)).toBe(2);
    expect(levelForXp(13034430)).toBe(98);
    expect(levelForXp(200_000_000)).toBe(99);
  });
});
