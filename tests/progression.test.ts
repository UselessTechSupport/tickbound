import { describe, expect, it } from 'vitest';
import { ARMOURY, ARMOURY_LINES, NO_ARMOURY, armouryKit } from '../src/data/armoury';
import { ITEMS } from '../src/data/items';
import { GameState } from '../src/game/GameState';
import { botStep, newBotMemory } from '../src/sim/bot';

describe('Armourer starting gear', () => {
  it('every tier gives real items', () => {
    for (const line of ARMOURY_LINES) for (const t of ARMOURY[line].tiers) for (const i of t.items) expect(ITEMS[i.id], i.id).toBeDefined();
  });

  it('wears what you can wield and carries the rest', () => {
    const armoury = { ...NO_ARMOURY, melee: 6, body: 2, shield: 1, ranged: 1 };
    const g = new GameState(901, () => {}, { armoury, startStyle: 'melee' });
    const p = g.player;
    // Rune scimitar needs Attack 40: carried. Iron platebody & bronze kiteshield: worn.
    expect(p.equipment.weapon).toBe('bronze_dagger');
    expect(p.inventory.count('rune_scimitar')).toBe(1);
    expect(p.equipment.body).toBe('iron_platebody');
    expect(p.equipment.shield).toBe('bronze_kiteshield');
    // Ranged gear goes in the pack when you start as melee.
    expect(p.inventory.count('shortbow')).toBe(1);
    expect(p.inventory.count('bronze_arrow')).toBe(200);
    expect(armouryKit(armoury).length).toBeGreaterThan(0);
  });

  it('starting as ranged wields the bow and quivers the arrows', () => {
    const g = new GameState(902, () => {}, { armoury: { ...NO_ARMOURY, ranged: 1 }, startStyle: 'ranged' });
    expect(g.player.equipment.weapon).toBe('shortbow');
    expect(g.player.equipment.ammo).toBe('bronze_arrow');
    expect(g.player.ammo).toBe(200);
  });

  it('tells you when carried gear becomes wieldable', async () => {
    const { xpForLevel } = await import('../src/systems/xp');
    const g = new GameState(903, () => {}, { armoury: { ...NO_ARMOURY, melee: 3 } }); // steel scimitar: Attack 5
    expect(g.player.inventory.count('steel_scimitar')).toBe(1);
    g.player.skills.xp.attack = xpForLevel(5) - 1;
    (g as unknown as { giveXp(s: string, n: number): void }).giveXp('attack', 1);
    expect(g.messages).toContain('You can now wield your Steel scimitar!');
  });
});

describe('skip ahead', () => {
  it('starts deeper with catch-up levels and supplies, and halves skipped-floor tokens', () => {
    const fresh = new GameState(904);
    const skip = new GameState(905, () => {}, { startDepth: 6, startStyle: 'melee' });
    expect(skip.depth).toBe(6);
    expect(skip.assisted).toBe(true);
    expect(skip.player.skills.level('attack')).toBeGreaterThan(10);
    expect(skip.player.maxHp).toBeGreaterThan(fresh.player.maxHp);
    expect(skip.player.inventory.count('lobster')).toBeGreaterThan(0);
    // Floors 1-5 would pay 75 tokens; skipping pays half (37), plus coin value carried.
    expect(skip.tokensEarned).toBeLessThan(15 * 5);
    expect(skip.tokensEarned).toBeGreaterThanOrEqual(37);
  });
});

describe('autoplay handover', () => {
  it('the bot can drive a run, and earnings before handover count half', () => {
    const g = new GameState(906);
    g.player.hp = 9999;
    const memo = newBotMemory();
    for (let i = 0; i < 20000 && g.depth < 3 && !g.over; i++) {
      botStep(g, memo, false);
      g.tick();
    }
    expect(g.depth).toBe(3);
    const before = g.tokensEarned;
    g.endAutoplay();
    expect(g.assisted).toBe(true);
    expect(g.tokensEarned).toBe(Math.floor(before / 2));
  });
});

describe("Veteran's Kit unlocks the Armourer", () => {
  it('the Armourer is only at camp once unlocked, and can arrive mid-visit', () => {
    const locked = new GameState(950, () => {}, { camp: true });
    expect(locked.nodes.some((n) => n.kind === 'armourer')).toBe(false);
    locked.addCampNpc('armourer');
    expect(locked.nodes.filter((n) => n.kind === 'armourer')).toHaveLength(1);
    locked.addCampNpc('armourer'); // no duplicates
    expect(locked.nodes.filter((n) => n.kind === 'armourer')).toHaveLength(1);
    const unlocked = new GameState(951, () => {}, { camp: true, armourerUnlocked: true });
    expect(unlocked.nodes.some((n) => n.kind === 'armourer')).toBe(true);
  });

  it('old saves: rank 2 is refunded, Armourer buyers keep access', async () => {
    const { loadMeta } = await import('../src/save/meta');
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v),
    };
    store['tickbound.meta'] = JSON.stringify({ tokens: 10, perks: { basic_training: 1, veterans_kit: 2 } });
    let m = loadMeta();
    expect(m.perks.veterans_kit).toBe(1);
    expect(m.tokens).toBe(160);
    store['tickbound.meta'] = JSON.stringify({ tokens: 0, perks: {}, armoury: { melee: 2 } });
    m = loadMeta();
    expect(m.perks.veterans_kit).toBe(1);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
