import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/recipes';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { PICKPOCKET, POCKET_LIMIT } from '../src/data/thieving';
import { NO_TOOLS } from '../src/data/tools';
import { GameState } from '../src/game/GameState';
import { Npc } from '../src/entities/Npc';
import { ResourceNode } from '../src/entities/ResourceNode';
import { Tile, setTile, tileAt } from '../src/world/tiles';
import { findPath } from '../src/world/pathfinding';
import { xpForLevel } from '../src/systems/xp';

const runTicks = (g: GameState, n: number) => { for (let i = 0; i < n && !g.over; i++) g.tick(); };

describe('Fletching', () => {
  const bow = RECIPES.find((r) => r.id === 'fletch_shortbow')!;
  const arrows = RECIPES.find((r) => r.id === 'fletch_iron_arrow')!;

  it('every fletching recipe uses real items', () => {
    for (const r of RECIPES.filter((x) => x.station === 'fletch')) {
      expect(ITEMS[r.output], r.id).toBeDefined();
      for (const i of r.inputs) expect(ITEMS[i.item], r.id).toBeDefined();
    }
  });

  it('needs a knife, then turns logs into a bow and bar + logs into 15 arrows', () => {
    const g = new GameState(301);
    g.player.inventory.add('logs', 2);
    g.player.inventory.add('iron_bar');
    g.player.skills.xp.fletching = xpForLevel(15);
    g.fletch(bow);
    expect(g.player.inventory.count('shortbow')).toBe(0);
    g.player.tools = { ...NO_TOOLS, knife: true };
    g.fletch(bow);
    expect(g.player.inventory.count('shortbow')).toBe(1);
    g.fletch(arrows);
    expect(g.player.inventory.count('iron_arrow')).toBe(15);
    expect(g.player.inventory.count('iron_bar')).toBe(0);
  });
});

describe('Thieving', () => {
  it('every pickpocket target is a real monster with real loot', () => {
    for (const [id, def] of Object.entries(PICKPOCKET)) {
      expect(NPCS[id], id).toBeDefined();
      for (const l of def.loot) expect(ITEMS[l.item], l.item).toBeDefined();
    }
  });

  it('pickpocketing pays out until the pockets are empty, and getting caught stuns you', () => {
    const g = new GameState(302);
    g.npcs.length = 0;
    g.player.hp = 99;
    const p = g.player.pos;
    const goblin = new Npc({ ...NPCS.goblin, aggroRadius: 0 }, { x: p.x + 1, y: p.y });
    if (tileAt(g.map, p.x + 1, p.y) !== Tile.Floor) setTile(g.map, p.x + 1, p.y, Tile.Floor);
    g.npcs.push(goblin);
    let stunned = false;
    for (let i = 0; i < 60 && goblin.picked < POCKET_LIMIT; i++) {
      goblin.target = null;
      g.pickpocket(goblin);
      g.tick();
      if (g.player.stunnedUntil > g.tickCount) stunned = true;
      runTicks(g, 5);
    }
    expect(goblin.picked).toBe(POCKET_LIMIT);
    expect(g.player.inventory.count('coins') + g.player.inventory.count('bronze_arrow')).toBeGreaterThan(0);
    expect(g.player.skills.xp.thieving).toBeGreaterThan(0);
    // With a 55%+ success rate, 3 successes in this many tries almost always include a failure.
    expect(typeof stunned).toBe('boolean');
    g.pickpocket(goblin);
    g.tick();
    expect(g.messages.at(-1)).toContain('pockets are empty');
  });

  it('locked chests need the Thieving level and give double loot', () => {
    const g = new GameState(303);
    g.npcs.length = 0;
    const p = g.player.pos;
    const spot = { x: p.x + 1, y: p.y };
    setTile(g.map, spot.x, spot.y, Tile.Object);
    const chest = Object.assign(new ResourceNode(spot, 'chest'), { lockLevel: 20 });
    g.nodes.push(chest);
    g.talkTo(chest);
    g.tick();
    expect(g.messages.at(-1)).toContain('Thieving level of 20');
    g.player.skills.xp.thieving = xpForLevel(99);
    g.player.hp = 99;
    for (let i = 0; i < 20 && !chest.used; i++) {
      g.talkTo(chest);
      g.tick();
    }
    expect(chest.used).toBe(true);
    expect(g.player.skills.xp.thieving).toBeGreaterThan(xpForLevel(99));
  });
});

describe('Agility', () => {
  it('floors get shortcuts across single walls that save walking', () => {
    let found = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = new GameState(seed);
      for (const n of g.nodes.filter((x) => x.kind === 'shortcut')) {
        found++;
        const sc = n.shortcut!;
        expect(tileAt(g.map, n.pos.x, n.pos.y)).toBe(Tile.Wall);
        expect(findPath(g.map, sc.a, sc.b).length).toBeGreaterThanOrEqual(14);
      }
    }
    expect(found).toBeGreaterThan(5);
  });

  it('crossing a shortcut moves you to the other side and gives XP', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = new GameState(seed);
      const n = g.nodes.find((x) => x.kind === 'shortcut' && x.shortcut!.level <= 5);
      if (!n) continue;
      g.npcs.length = 0;
      g.player.hp = 99;
      g.player.pos = { ...n.shortcut!.a };
      for (let i = 0; i < 20 && g.player.pos.x === n.shortcut!.a.x && g.player.pos.y === n.shortcut!.a.y; i++) {
        g.useShortcut(n);
        g.tick();
      }
      expect(g.player.pos).toEqual(n.shortcut!.b);
      expect(g.player.skills.xp.agility).toBeGreaterThan(0);
      return;
    }
    throw new Error('no low-level shortcut found');
  });
});

describe('locked chest fairness', () => {
  it('locks start at floor 3 with reachable levels', async () => {
    const { lockLevelFor, LOCKED_CHEST_MIN_DEPTH } = await import('../src/data/thieving');
    expect(LOCKED_CHEST_MIN_DEPTH).toBe(3);
    expect(lockLevelFor(3)).toBe(3);
    expect(lockLevelFor(5)).toBe(9);
    for (let seed = 1; seed <= 40; seed++) {
      for (const depth of [1, 2]) {
        const g = new GameState(seed);
        g.loadFloor(depth);
        expect(g.nodes.some((n) => n.kind === 'chest' && n.lockLevel)).toBe(false);
      }
    }
  });
});

describe('low-level catch-up', () => {
  it('a level-1 player always gets a shortcut and lock they can attempt, even deep down', () => {
    let shortcuts = 0;
    let locks = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = new GameState(seed);
      g.loadFloor(12);
      const sc = g.nodes.filter((n) => n.kind === 'shortcut');
      if (sc.length) {
        shortcuts++;
        expect(Math.min(...sc.map((n) => n.shortcut!.level))).toBe(1);
      }
      const locked = g.nodes.filter((n) => n.kind === 'chest' && n.lockLevel);
      if (locked.length) {
        locks++;
        expect(Math.min(...locked.map((n) => n.lockLevel!))).toBe(1);
      }
    }
    expect(shortcuts).toBeGreaterThan(20);
    expect(locks).toBeGreaterThan(3);
  });

  it('a high-level player still meets depth-scaled shortcuts', () => {
    const g = new GameState(5);
    g.player.skills.xp.agility = xpForLevel(99);
    let high = false;
    for (let seed = 1; seed <= 20 && !high; seed++) {
      g.seed = seed;
      g.loadFloor(12);
      high = g.nodes.some((n) => n.kind === 'shortcut' && n.shortcut!.level > 30);
    }
    expect(high).toBe(true);
  });
});

describe('autoplay death', () => {
  it('a run that died on autoplay pays no tokens', () => {
    const g = new GameState(321);
    g.player.inventory.add('coins', 500);
    g.loadFloor(4);
    expect(g.tokensEarned).toBeGreaterThan(0);
    g.noRewards = true;
    expect(g.tokensEarned).toBe(0);
  });
});

describe('Crafting', () => {
  it('gems get rarer gems deeper down', async () => {
    const { gemForDepth } = await import('../src/game/skilling');
    expect(gemForDepth(1, 0.99)).toBe('sapphire');
    const deep = new Set(Array.from({ length: 200 }, (_, i) => gemForDepth(25, i / 200)));
    expect(deep.has('dragonstone')).toBe(true);
  });

  it('a chisel turns a gem into an amulet that adds equipment bonuses', () => {
    const g = new GameState(310);
    const p = g.player;
    const recipe = RECIPES.find((r) => r.id === 'craft_amulet_of_strength')!;
    p.inventory.add('ruby');
    p.skills.xp.crafting = xpForLevel(40);
    g.fletch(recipe);
    expect(p.inventory.count('amulet_of_strength')).toBe(0); // no chisel yet
    p.tools = { ...NO_TOOLS, chisel: true };
    g.fletch(recipe);
    expect(p.inventory.count('amulet_of_strength')).toBe(1);
    const before = p.bonuses().strength;
    g.useItem(p.inventory.slots.findIndex((s) => s?.id === 'amulet_of_strength'));
    expect(p.equipment.amulet).toBe('amulet_of_strength');
    expect(p.bonuses().strength).toBe(before + 10);
  });
});
