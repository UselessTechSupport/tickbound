import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { Npc } from '../src/entities/Npc';
import { Inventory } from '../src/entities/Inventory';
import { GameState } from '../src/game/GameState';
import { Tile, tileAt } from '../src/world/tiles';

/** Puts a single NPC directly east/west of the player on a floor tile. */
function duel(seed: number, npcId: string): { g: GameState; npc: Npc } {
  const g = new GameState(seed);
  const { x, y } = g.player.pos;
  const spot = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]
    .find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
  const npc = new Npc(NPCS[npcId], spot);
  g.npcs = [npc];
  return { g, npc };
}

describe('GameState', () => {
  it('starts a run with gear, food and monsters', () => {
    const g = new GameState(7);
    expect(g.player.equipment.weapon).toBe('bronze_dagger');
    expect(g.player.inventory.slots.filter(Boolean)).toHaveLength(4);
    expect(g.npcs.length).toBeGreaterThan(0);
    expect(g.isVisible(g.player.pos.x, g.player.pos.y)).toBe(true);
  });

  it('kills a goblin, gains XP and drops bones', () => {
    const { g, npc } = duel(3, 'goblin');
    g.player.hp = 9999; // isolate the kill from the fight's outcome
    g.attack(npc);
    for (let i = 0; i < 500 && g.npcs.length; i++) g.tick();
    expect(g.npcs).toHaveLength(0);
    expect(g.player.skills.xp.attack).toBeGreaterThan(0);
    expect(g.groundItems.some((i) => i.id === 'bones')).toBe(true);
  });

  it('picks up and buries bones for prayer XP', () => {
    const { g, npc } = duel(4, 'rat');
    g.player.hp = 9999;
    g.attack(npc);
    for (let i = 0; i < 500 && g.npcs.length; i++) g.tick();
    const bones = g.groundItems.find((i) => i.id === 'bones')!;
    g.take(bones);
    for (let i = 0; i < 10; i++) g.tick();
    const slot = g.player.inventory.slots.findIndex((s) => s?.id === 'bones');
    expect(slot).toBeGreaterThanOrEqual(0);
    g.useItem(slot);
    expect(g.player.skills.xp.prayer).toBe(4.5);
  });

  it('ends the run when the player dies', () => {
    const { g } = duel(5, 'greater_demon');
    for (let i = 0; i < 500 && !g.over; i++) g.tick();
    expect(g.over).toBe(true);
    expect(g.player.hp).toBe(0);
  });

  it('eats food to heal, respecting max HP', () => {
    const g = new GameState(9);
    g.player.hp = 5;
    g.useItem(0);
    expect(g.player.hp).toBe(8);
    g.useItem(1); // eat delay blocks a second eat this tick
    expect(g.player.hp).toBe(8);
  });

  it('enforces wield requirements', () => {
    const g = new GameState(10);
    g.player.inventory.add('rune_scimitar');
    const slot = g.player.inventory.slots.findIndex((s) => s?.id === 'rune_scimitar');
    g.useItem(slot);
    expect(g.player.equipment.weapon).toBe('bronze_dagger');
    g.player.skills.addXp('attack', 40_000);
    g.useItem(slot);
    expect(g.player.equipment.weapon).toBe('rune_scimitar');
    expect(g.player.inventory.slots[slot]?.id).toBe('bronze_dagger');
  });

  it('descends when walking onto the stairs', () => {
    const g = new GameState(11);
    g.npcs = [];
    g.walkTo(g.map.stairs);
    expect(g.player.path).toHaveLength(0); // can't walk to unexplored tiles
    g.explored.fill(1);
    g.walkTo(g.map.stairs);
    for (let i = 0; i < 300 && g.depth === 1; i++) g.tick();
    expect(g.depth).toBe(2);
  });
});

describe('Inventory', () => {
  it('stacks stackables and respects 28 slots', () => {
    const inv = new Inventory();
    inv.add('coins', 10);
    inv.add('coins', 5);
    expect(inv.slots[0]).toEqual({ id: 'coins', qty: 15 });
    expect(inv.add('bones', 27)).toBe(true);
    expect(inv.add('bones')).toBe(false);
    expect(inv.add('coins', 1)).toBe(true);
  });
});
