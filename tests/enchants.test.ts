import { describe, expect, it } from 'vitest';
import { NO_ARMOURY } from '../src/data/armoury';
import { ENCHANTS, ENCHANT_COSTS, ENCHANT_SWITCH_FEE, enchantCost, enchantedItems } from '../src/data/enchants';
import { GameState } from '../src/game/GameState';

describe('enchantments', () => {
  it('costs: new, upgrade, max and switch', () => {
    expect(enchantCost(undefined, 'keen')).toBe(ENCHANT_COSTS[0]);
    expect(enchantCost({ id: 'keen', rank: 1 }, 'keen')).toBe(ENCHANT_COSTS[1]);
    expect(enchantCost({ id: 'keen', rank: 3 }, 'keen')).toBeNull();
    expect(enchantCost({ id: 'keen', rank: 2 }, 'brutal')).toBe(ENCHANT_COSTS[0] + ENCHANT_SWITCH_FEE);
  });

  it('every enchantment gets stronger with rank', () => {
    for (const e of ENCHANTS) {
      const [a, b, c] = e.values;
      // Renewal is an interval: smaller is stronger.
      if (e.id === 'renewal') expect(a > b && b > c).toBe(true);
      else expect(a < b && b < c).toBe(true);
    }
  });

  it('applies to the current Armourer tier of each line, and only once bought', () => {
    const m = enchantedItems({ ...NO_ARMOURY, melee: 3, body: 0 }, { melee: { id: 'brutal', rank: 2 }, body: { id: 'thorns', rank: 1 } });
    expect(m.get('steel_scimitar')).toEqual({ id: 'brutal', rank: 2 });
    expect(m.size).toBe(1);
  });

  it('only works while the enchanted piece is worn', () => {
    const g = new GameState(960, () => {}, { armoury: { ...NO_ARMOURY, melee: 1 }, enchants: { melee: { id: 'brutal', rank: 3 } } });
    expect(g.player.equipment.weapon).toBe('bronze_scimitar');
    expect(g.enchantPower('brutal')).toBeCloseTo(0.15);
    g.player.equipment.weapon = 'bronze_dagger';
    expect(g.enchantPower('brutal')).toBe(0);
  });

  it('Fortified on body and shield stacks', () => {
    const g = new GameState(961, () => {}, {
      armoury: { ...NO_ARMOURY, body: 1, shield: 1 },
      enchants: { body: { id: 'fortified', rank: 1 }, shield: { id: 'fortified', rank: 2 } },
    });
    expect(g.enchantPower('fortified')).toBeCloseTo(0.15);
  });

  it('Renewal regenerates extra HP', () => {
    const plain = new GameState(962, () => {}, { armoury: { ...NO_ARMOURY, body: 1 } });
    const renew = new GameState(962, () => {}, { armoury: { ...NO_ARMOURY, body: 1 }, enchants: { body: { id: 'renewal', rank: 3 } } });
    for (const g of [plain, renew]) {
      g.npcs.length = 0;
      g.player.hp = 1;
      for (let i = 0; i < 120; i++) g.tick();
    }
    expect(renew.player.hp).toBeGreaterThan(plain.player.hp);
  });
});

describe('Enchanter unlock', () => {
  it('appears at camp only once unlocked; older saves with a Jad kill are credited', async () => {
    expect(new GameState(963, () => {}, { camp: true }).nodes.some((n) => n.kind === 'enchanter')).toBe(false);
    expect(new GameState(964, () => {}, { camp: true, enchanterUnlocked: true }).nodes.some((n) => n.kind === 'enchanter')).toBe(true);
    const { loadMeta } = await import('../src/save/meta');
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v),
    };
    store['tickbound.meta'] = JSON.stringify({ tokens: 0, perks: {}, killCounts: { tztok_jad: 1 } });
    expect(loadMeta().enchanterUnlocked).toBe(true);
    store['tickbound.meta'] = JSON.stringify({ tokens: 0, perks: {} });
    expect(loadMeta().enchanterUnlocked).toBe(false);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
