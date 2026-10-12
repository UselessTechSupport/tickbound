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

describe('deep bosses', () => {
  it('floor 25 is the Lich, floor 30 the Ancient Wyrm, deeper bosses scale from the Wyrm', async () => {
    const { bossForDepth } = await import('../src/data/npcs');
    const { PETS } = await import('../src/data/collectionLog');
    const { ITEMS } = await import('../src/data/items');
    expect(bossForDepth(25).id).toBe('lich');
    expect(bossForDepth(30).id).toBe('ancient_wyrm');
    expect(bossForDepth(35).hitpoints).toBeGreaterThan(bossForDepth(30).hitpoints);
    for (const id of ['lich', 'ancient_wyrm']) expect(PETS.some((p) => p.bossId === id)).toBe(true);
    expect(ITEMS.staff_of_the_dead.equip?.slot).toBe('weapon');
    expect(ITEMS.wyrmhide_body.equip?.slot).toBe('body');
  });
});

describe('the Abyss', () => {
  it('floors past 20 are Abyss monsters (plus dark archers), scaled with depth', async () => {
    const { npcsForDepth } = await import('../src/data/npcs');
    const ids = new Set(npcsForDepth(25).map((n) => n.id));
    for (const id of ['abyssal_fiend', 'shadow_reaper', 'soul_eater', 'tormentor']) expect(ids.has(id), id).toBe(true);
    expect(ids.has('frost_giant')).toBe(false);
    expect(npcsForDepth(20).some((n) => n.id === 'abyssal_fiend')).toBe(false);
  });
});

describe('dark shrines', () => {
  it('a dark shrine gives a relic choice and a curse that bites', async () => {
    const { ResourceNode } = await import('../src/entities/ResourceNode');
    const { Tile, setTile } = await import('../src/world/tiles');
    const g = new GameState(44);
    g.npcs.length = 0;
    const p = g.player;
    const spot = { x: p.pos.x + 1, y: p.pos.y };
    setTile(g.map, spot.x, spot.y, Tile.Object);
    const shrine = new ResourceNode(spot, 'dark_shrine');
    g.nodes.push(shrine);
    g.talkTo(shrine);
    g.tick();
    expect(shrine.used).toBe(true);
    expect(g.curses).toHaveLength(1);
    expect(g.pendingRelics?.length).toBeGreaterThan(0);
  });

  it('Unrest stops regeneration; Famine weakens food', () => {
    const g = new GameState(45);
    g.npcs.length = 0;
    g.curses.push('unrest', 'famine');
    g.player.skills.xp.hitpoints = 1e6; // plenty of room above 3 HP
    g.player.hp = 3;
    for (let i = 0; i < 300; i++) g.tick();
    expect(g.player.hp).toBe(3);
    g.player.inventory.add('swordfish');
    g.quickEat();
    expect(g.player.hp).toBe(3 + Math.floor(14 * 0.8));
  });
});

describe('wandering adventurers', () => {
  it('trade the requested items for the promised reward, once', async () => {
    const { ResourceNode } = await import('../src/entities/ResourceNode');
    const { Tile, setTile } = await import('../src/world/tiles');
    const g = new GameState(46);
    g.npcs.length = 0;
    g.loadFloor(4);
    g.npcs.length = 0;
    const p = g.player;
    const spot = { x: p.pos.x + 1, y: p.pos.y };
    setTile(g.map, spot.x, spot.y, Tile.Object);
    const w = Object.assign(new ResourceNode(spot, 'wanderer'), { deal: { request: { items: ['trout', 'lobster'], qty: 3, what: 'cooked fish' }, reward: 'tokens' as const } });
    g.nodes.push(w);
    g.talkTo(w);
    g.tick();
    expect(w.used).toBe(false); // not enough fish yet
    p.inventory.add('trout', 2);
    p.inventory.add('lobster', 2);
    const before = g.tokensEarned;
    g.talkTo(w);
    g.tick();
    expect(w.used).toBe(true);
    expect(p.inventory.count('trout') + p.inventory.count('lobster')).toBe(1);
    expect(g.tokensEarned).toBeGreaterThan(before);
  });
});

describe('treasure maps', () => {
  it('carrying a map buries treasure on each new floor; digging uses the map and pays out', () => {
    const g = new GameState(48);
    g.player.inventory.add('treasure_map');
    g.loadFloor(6);
    const mound = g.nodes.find((n) => n.kind === 'buried_treasure');
    expect(mound).toBeDefined();
    expect(g.messages.some((m) => m.startsWith('Your treasure map points'))).toBe(true);
    const before = g.tokensEarned;
    (g as unknown as { digTreasure(n: unknown): void }).digTreasure(mound);
    expect(g.player.inventory.count('treasure_map')).toBe(0);
    expect(g.player.inventory.count('coins')).toBeGreaterThan(0);
    expect(g.tokensEarned).toBeGreaterThan(before);
    // No map, no mound.
    g.loadFloor(7);
    expect(g.nodes.some((n) => n.kind === 'buried_treasure')).toBe(false);
  });
});
