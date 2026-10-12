import { describe, expect, it } from 'vitest';
import { MODIFIERS, modifierBonus } from '../src/data/modifiers';
import { GameState } from '../src/game/GameState';

const run = (modifiers: string[], seed = 900) => new GameState(seed, () => {}, { modifiers });

describe('run modifiers', () => {
  it('each modifier pays a token bonus, and they add up', () => {
    for (const m of MODIFIERS) expect(m.bonus).toBeGreaterThan(0);
    expect(modifierBonus(['hardened', 'fragile'])).toBeCloseTo(0.55);
    const plain = run([]);
    const hard = run(['hardened', 'fragile']);
    for (const g of [plain, hard]) g.loadFloor(6);
    expect(hard.tokensEarned).toBeGreaterThan(plain.tokensEarned);
  });

  it('Hardened, Fragile and Famished change the run', () => {
    const plain = run([]);
    const g = run(['hardened', 'fragile', 'famished']);
    expect(g.player.maxHp).toBeLessThan(plain.player.maxHp);
    expect(g.player.inventory.count('shrimps')).toBe(0);
    const hp = (s: GameState) => s.npcs.filter((n) => !n.isBoss).reduce((t, n) => t + n.maxHp, 0) / s.npcs.length;
    expect(hp(g)).toBeGreaterThan(hp(plain));
  });

  it('Relicless offers no relics; Ironman removes merchants and wanderers', () => {
    const g = run(['relicless']);
    g.offerRelics();
    expect(g.pendingRelics).toBeNull();
    for (let seed = 1; seed < 80; seed++) {
      const iron = run(['ironman'], seed);
      for (const d of [3, 4, 6, 7]) {
        iron.loadFloor(d);
        expect(iron.nodes.some((n) => n.kind === 'merchant' || n.kind === 'wanderer')).toBe(false);
      }
    }
  });
});
