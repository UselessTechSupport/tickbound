import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { RESOURCES } from '../src/data/resources';
import { NO_TOOLS, Toolbelt, applyUnlock, nextUnlocks } from '../src/data/tools';
import { ResourceNode } from '../src/entities/ResourceNode';
import { GameState } from '../src/game/GameState';
import { burnChance } from '../src/game/skilling';
import { generateFloor } from '../src/world/dungeonGen';
import { placeResources } from '../src/world/resources';
import { Tile, reachableCount, setTile, tileAt } from '../src/world/tiles';

const ALL_TOOLS: Toolbelt = { pickaxe: 6, axe: 6, fishing: 4, hammer: true, tinderbox: true };

/** A quiet game with one node placed next to the player. */
function withNode(kind: ResourceNode['kind'], defId?: string, tools = ALL_TOOLS) {
  const g = new GameState(21, () => {}, { tools });
  g.npcs = [];
  g.nodes = [];
  const { x, y } = g.player.pos;
  const spot = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]
    .find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
  const node = new ResourceNode(spot, kind, defId ? RESOURCES[defId] : undefined);
  node.remaining = 3;
  setTile(g.map, spot.x, spot.y, Tile.Object);
  g.nodes.push(node);
  return { g, node };
}

const run = (g: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) g.tick();
};

describe('resource placement', () => {
  it('never disconnects a floor and always leaves access (300 seeds)', () => {
    for (let seed = 0; seed < 300; seed++) {
      const depth = 1 + (seed % 15);
      const map = generateFloor(seed, depth);
      const before = reachableCount(map, map.spawn);
      const nodes = placeResources(map);
      expect(nodes.length, `seed ${seed}`).toBeGreaterThan(3);
      expect(reachableCount(map, map.spawn)).toBe(before - nodes.length);
      expect(tileAt(map, map.stairs.x, map.stairs.y)).toBe(Tile.StairsDown);
    }
  });
});

describe('gathering', () => {
  it('needs an unlocked tool', () => {
    const { g, node } = withNode('resource', 'copper', NO_TOOLS);
    g.gather(node);
    run(g, 20);
    expect(g.player.inventory.count('copper_ore')).toBe(0);
    expect(g.messages.at(-1)).toMatch(/need a pickaxe/);
  });

  it('mines ore until the rock is depleted', () => {
    const { g, node } = withNode('resource', 'copper');
    g.gather(node);
    run(g, 400);
    expect(g.player.inventory.count('copper_ore')).toBe(3);
    expect(node.depleted).toBe(true);
    expect(g.player.skills.xp.mining).toBeGreaterThan(0);
  });

  it('enforces level requirements', () => {
    const { g, node } = withNode('resource', 'runite');
    g.gather(node);
    run(g, 5);
    expect(g.messages.at(-1)).toMatch(/Mining level of 50/);
  });

  it('needs the right fishing gear for the spot', () => {
    const { g, node } = withNode('resource', 'cage', { ...ALL_TOOLS, fishing: 2 });
    g.player.skills.addXp('fishing', 1e6);
    g.gather(node);
    run(g, 5);
    expect(g.messages.at(-1)).toMatch(/lobster pot/);
  });
});

describe('processing', () => {
  it('cooks all raw fish at a fire', () => {
    const { g, node } = withNode('fire');
    g.player.inventory.add('raw_shrimps', 3);
    g.process(node, RECIPES.find((r) => r.id === 'cook_shrimps')!);
    run(g, 30);
    expect(g.player.inventory.count('raw_shrimps')).toBe(0);
    // 4 starting shrimps + 3 cooked (some may burn)
    expect(g.player.inventory.count('shrimps') + g.player.inventory.count('burnt_fish')).toBe(7);
  });

  it('smelts bronze and smiths a scimitar', () => {
    const { g, node: furnace } = withNode('furnace');
    g.player.inventory.add('copper_ore', 2);
    g.player.inventory.add('tin_ore', 2);
    g.process(furnace, RECIPES.find((r) => r.id === 'smelt_bronze')!);
    run(g, 20);
    expect(g.player.inventory.count('bronze_bar')).toBe(2);
    furnace.kind = 'anvil';
    g.process(furnace, RECIPES.find((r) => r.id === 'smith_bronze_scimitar')!, false);
    run(g, 5);
    expect(g.player.inventory.count('bronze_scimitar')).toBe(1);
    expect(g.player.inventory.count('bronze_bar')).toBe(0);
  });

  it('needs a hammer to smith', () => {
    const { g, node } = withNode('anvil', undefined, { ...ALL_TOOLS, hammer: false });
    g.player.inventory.add('bronze_bar', 2);
    g.process(node, RECIPES.find((r) => r.id === 'smith_bronze_scimitar')!, false);
    run(g, 5);
    expect(g.player.inventory.count('bronze_bar')).toBe(2);
    expect(g.messages.at(-1)).toMatch(/hammer/);
  });

  it('stops burning food at the stop-burn level', () => {
    const shrimps = RECIPES.find((r) => r.id === 'cook_shrimps')!;
    expect(burnChance(1, shrimps)).toBeCloseTo(0.45);
    expect(burnChance(20, shrimps)).toBe(0);
  });
});

describe('fires', () => {
  it('lights logs with a tinderbox, then burns out', () => {
    const g = new GameState(22, () => {}, { tools: ALL_TOOLS });
    g.npcs = [];
    g.player.inventory.add('logs');
    const slot = g.player.inventory.slots.findIndex((s) => s?.id === 'logs');
    const fires = () => g.nodes.filter((n) => n.kind === 'fire' && n.expiresAt !== undefined);
    g.useItem(slot);
    expect(fires()).toHaveLength(1);
    const pos = fires()[0].pos;
    expect(tileAt(g.map, pos.x, pos.y)).toBe(Tile.Object);
    run(g, 101);
    expect(fires()).toHaveLength(0);
    expect(tileAt(g.map, pos.x, pos.y)).toBe(Tile.Floor);
  });

  it('needs a tinderbox', () => {
    const g = new GameState(22);
    g.player.inventory.add('logs');
    g.useItem(g.player.inventory.slots.findIndex((s) => s?.id === 'logs'));
    expect(g.player.inventory.count('logs')).toBe(1);
  });
});

describe('data integrity', () => {
  it('every recipe and resource refers to real items', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.output], r.id).toBeDefined();
      for (const i of r.inputs) expect(ITEMS[i.item], r.id).toBeDefined();
    }
    for (const r of Object.values(RESOURCES)) expect(ITEMS[r.product], r.id).toBeDefined();
  });
});

describe('meta unlocks', () => {
  it('offers next tiers and applies them', () => {
    const tools = { ...NO_TOOLS };
    expect(nextUnlocks(tools).map((o) => o.label)).toContain('Bronze pickaxe');
    applyUnlock(tools, 'pickaxe');
    applyUnlock(tools, 'hammer');
    expect(tools.pickaxe).toBe(1);
    expect(nextUnlocks(tools).map((o) => o.label)).toContain('Iron pickaxe');
    expect(nextUnlocks(tools).some((o) => o.key === 'hammer')).toBe(false);
  });

  it('awards tokens for depth, kills and coins', () => {
    const g = new GameState(23);
    g.kills = 5;
    g.player.inventory.add('coins', 45);
    expect(g.tokensEarned).toBe(5 + 2);
  });
});
