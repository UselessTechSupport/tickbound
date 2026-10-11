import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { chestLoot, generateStock, metalForDepth } from '../src/data/loot';
import { priceOf, sellPriceOf } from '../src/data/prices';
import { ResourceNode } from '../src/entities/ResourceNode';
import { GameEvent, GameState } from '../src/game/GameState';
import { Tile, setTile, tileAt } from '../src/world/tiles';

/** Places a fixture next to the player in a quiet game. */
function withFixture(seed: number, kind: 'merchant' | 'chest', depth = 4) {
  const events: GameEvent[] = [];
  const g = new GameState(seed, (e) => events.push(e));
  g.loadFloor(depth);
  g.npcs = [];
  g.nodes = [];
  const { x, y } = g.player.pos;
  const spot = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
  setTile(g.map, spot.x, spot.y, Tile.Object);
  const node = new ResourceNode(spot, kind);
  if (kind === 'merchant') node.stock = generateStock(depth);
  g.nodes.push(node);
  return { g, node, events };
}

describe('prices and stock', () => {
  it('every stocked or looted item exists and has a price', () => {
    for (let depth = 1; depth <= 20; depth++) {
      for (const s of generateStock(depth)) {
        expect(ITEMS[s.id], s.id).toBeDefined();
        expect(s.price, s.id).toBeGreaterThan(0);
      }
      for (const l of chestLoot(depth)) expect(ITEMS[l.id], l.id).toBeDefined();
    }
  });

  it('scales metal with depth and sells at 40%', () => {
    expect(metalForDepth(1)).toBe('bronze');
    expect(metalForDepth(16)).toBe('rune');
    expect(sellPriceOf('rune_scimitar')).toBe(Math.floor(priceOf('rune_scimitar') * 0.4));
  });
});

describe('wandering merchant', () => {
  it('opens a shop, buys with coins and sells loot', () => {
    const { g, node, events } = withFixture(101, 'merchant');
    g.talkTo(node);
    g.tick();
    expect(events.some((e) => e.type === 'campMenu' && e.kind === 'merchant')).toBe(true);
    expect(g.activeMerchant).toBe(node);

    const food = node.stock!.findIndex((s) => s.id === 'lobster');
    expect(g.buy(food)).toBe(false); // no coins yet
    g.player.inventory.add('coins', 1000);
    expect(g.buy(food)).toBe(true);
    expect(g.player.inventory.count('lobster')).toBe(1);
    expect(g.player.inventory.count('coins')).toBe(1000 - node.stock![food].price);

    g.player.inventory.add('rune_scimitar');
    const before = g.player.inventory.count('coins');
    g.sell(g.player.inventory.slots.findIndex((s) => s?.id === 'rune_scimitar'));
    expect(g.player.inventory.count('rune_scimitar')).toBe(0);
    expect(g.player.inventory.count('coins')).toBe(before + sellPriceOf('rune_scimitar'));
  });
});

describe('chests', () => {
  it('open once for loot, or reveal a Mimic', () => {
    let looted = 0;
    let mimics = 0;
    for (let seed = 200; seed < 260; seed++) {
      const { g, node } = withFixture(seed, 'chest', 6);
      g.talkTo(node);
      g.tick();
      if (g.npcs.some((n) => n.def.id === 'mimic')) {
        mimics++;
        expect(g.nodes).not.toContain(node);
        expect(tileAt(g.map, node.pos.x, node.pos.y)).toBe(Tile.Floor);
      } else {
        looted++;
        expect(node.used).toBe(true);
        expect(g.player.inventory.count('coins')).toBeGreaterThan(0);
        g.talkTo(node);
        g.tick();
        expect(g.messages.at(-1)).toMatch(/empty/);
      }
    }
    expect(looted).toBeGreaterThan(40);
    expect(mimics).toBeGreaterThan(0);
  });
});
