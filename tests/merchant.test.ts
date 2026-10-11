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

describe('drop tables shown on examine', () => {
  it('chest table chances sum to 1 and loot follows the table', async () => {
    const { CHEST_TABLE, chestCoins } = await import('../src/data/loot');
    expect(CHEST_TABLE.reduce((s, e) => s + e.chance, 0)).toBeCloseTo(1);
    const [lo, hi] = chestCoins(6);
    for (let i = 0; i < 200; i++) {
      const loot = chestLoot(6);
      expect(loot[0].id).toBe('coins');
      expect(loot[0].qty).toBeGreaterThanOrEqual(lo);
      expect(loot[0].qty).toBeLessThanOrEqual(hi);
      expect(loot.length === 2 || loot.length === 3).toBe(true);
    }
  });

  it('drop chances include perks and relics', () => {
    const plain = new GameState(601);
    const lucky = new GameState(602, () => {}, { perks: { lucky: 2, deep_pockets: 1 } });
    lucky.relics = ['ring_of_wealth'];
    const rare = { item: 'rune_scimitar', chance: 0.04 };
    const common = { item: 'bones', chance: 1 };
    const coins = { item: 'coins', chance: 0.5, min: 10, max: 20 };
    expect(plain.dropChance(rare)).toBeCloseTo(0.04);
    expect(lucky.dropChance(rare)).toBeCloseTo(0.04 * 1.5 * 1.25);
    expect(lucky.dropChance(common)).toBe(1);
    expect(plain.dropQuantity(coins)).toEqual([10, 20]);
    expect(lucky.dropQuantity(coins)).toEqual([30, 60]); // Deep Pockets 1.5x, Ring of Wealth 2x
  });
});
