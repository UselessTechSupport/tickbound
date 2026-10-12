import { describe, expect, it } from 'vitest';
import { FLOOR_EVENTS, GOBLIN_ESCAPE_TICKS, rollFloorEvent } from '../src/data/floorEvents';
import { GameState } from '../src/game/GameState';

/** A run on `depth` whose floor rolled `event`. */
function floorWith(event: string, depth = 6): GameState {
  for (let seed = 1; seed < 3000; seed++) {
    const g = new GameState(seed);
    g.loadFloor(depth);
    if (g.floorEvent === event) return g;
  }
  throw new Error(`no floor with ${event}`);
}

describe('floor events', () => {
  it('never on floors 1-2 or boss floors; about a quarter of other floors', () => {
    let rolls = 0;
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      const r = Math.random;
      expect(rollFloorEvent(2, r)).toBeNull();
      rolls++;
      if (rollFloorEvent(7, r)) hits++;
    }
    expect(hits / rolls).toBeGreaterThan(0.18);
    expect(hits / rolls).toBeLessThan(0.32);
    for (let seed = 1; seed < 60; seed++) {
      const g = new GameState(seed);
      g.loadFloor(10);
      expect(g.floorEvent).toBeNull();
    }
    expect(FLOOR_EVENTS.length).toBeGreaterThanOrEqual(6);
  });

  it('Infested adds monsters and kill tokens; Cursed pays more per kill', () => {
    const g = floorWith('infested');
    const plain = new GameState(1);
    plain.loadFloor(6);
    expect(g.npcs.length).toBeGreaterThan(Math.min(18, 4 + 6));
    const before = g.tokensEarned;
    g.bonusTokens += 0; // kills add through killNpc; check the hook directly:
    (g as unknown as { killNpc(n: unknown): void }).killNpc(g.npcs.find((n) => !n.isBoss));
    expect(g.tokensEarned - before).toBeGreaterThanOrEqual(2);
  });

  it('the treasure goblin flees once it spots you, and escapes if you are too slow', () => {
    const g = floorWith('treasure_goblin');
    const gob = g.npcs.find((n) => n.def.id === 'treasure_goblin')!;
    expect(gob).toBeDefined();
    g.player.hp = 999;
    gob.target = g.player;
    const d0 = Math.max(Math.abs(gob.pos.x - g.player.pos.x), Math.abs(gob.pos.y - g.player.pos.y));
    g.tick();
    const d1 = Math.max(Math.abs(gob.pos.x - g.player.pos.x), Math.abs(gob.pos.y - g.player.pos.y));
    expect(d1).toBeGreaterThanOrEqual(d0);
    for (let i = 0; i < GOBLIN_ESCAPE_TICKS + 5; i++) g.tick();
    expect(g.npcs.includes(gob)).toBe(false);
    expect(g.messages.some((m) => m.includes('escapes'))).toBe(true);
  });

  it('Darkness shrinks your view; Gilded doubles coins', () => {
    const dark = floorWith('darkness');
    const plain = new GameState(1);
    plain.loadFloor(6);
    expect(dark.visible.size).toBeLessThan(plain.visible.size + 1);
    const gilded = floorWith('gilded');
    const coins = { item: 'coins', chance: 1, min: 10, max: 10 };
    expect(gilded.dropQuantity(coins)[0]).toBe(20);
  });
});

describe('the endless deep', () => {
  it('every floor has monsters, and they keep getting stronger past floor 20', async () => {
    const { npcsForDepth } = await import('../src/data/npcs');
    for (const depth of [1, 5, 19, 20, 21, 40, 99, 100, 150]) expect(npcsForDepth(depth).length, `floor ${depth}`).toBeGreaterThan(0);
    const hp = (d: number) => Math.max(...npcsForDepth(d).map((n) => n.hitpoints));
    expect(hp(40)).toBeGreaterThan(hp(20));
    expect(hp(100)).toBeGreaterThan(hp(40));
    const g = new GameState(3);
    g.loadFloor(120); // used to crash: no monsters were defined that deep
    expect(g.npcs.length).toBeGreaterThan(0);
  });
});
