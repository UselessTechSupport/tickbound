import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { Npc } from '../src/entities/Npc';
import { GameState } from '../src/game/GameState';
import { xpForLevel } from '../src/systems/xp';
import { Tile, tileAt } from '../src/world/tiles';

const adjacentFloor = (g: GameState) => {
  const { x, y } = g.player.pos;
  return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
};

describe('quick-prayers', () => {
  it('turns on the set you have levels for, then all off', () => {
    const g = new GameState(501);
    g.player.skills.xp.prayer = xpForLevel(10);
    g.player.prayerPoints = 10;
    const set = ['protect_melee', 'thick_skin', 'eagle_eye'];
    g.toggleQuickPrayers(set);
    expect([...g.player.activePrayers].sort()).toEqual(['protect_melee', 'thick_skin']); // eagle eye needs 26
    g.toggleQuickPrayers(set);
    expect(g.player.activePrayers.size).toBe(0);
  });

  it('explains when none are usable yet', () => {
    const g = new GameState(502);
    g.toggleQuickPrayers(['protect_magic']);
    expect(g.player.activePrayers.size).toBe(0);
    expect(g.messages.at(-1)).toMatch(/Prayer level/);
  });
});

describe('run summary stats', () => {
  it('tracks damage dealt and taken, XP and the killer', () => {
    const g = new GameState(503);
    g.player.hp = 3;
    const demon = new Npc(NPCS.greater_demon, adjacentFloor(g));
    g.npcs = [demon];
    g.attack(demon);
    for (let i = 0; i < 400 && !g.over; i++) g.tick();
    expect(g.over).toBe(true);
    expect(g.runStats.killedBy).toBe('Greater demon');
    expect(g.runStats.damageTaken).toBeGreaterThanOrEqual(3);
  });

  it('counts XP per skill and looted items', () => {
    const g = new GameState(504);
    g.player.hp = 999;
    const rat = new Npc({ ...NPCS.rat, drops: [{ item: 'coins', chance: 1, min: 10, max: 10 }] }, adjacentFloor(g));
    g.npcs = [rat];
    g.attack(rat);
    for (let i = 0; i < 300 && g.npcs.length; i++) g.tick();
    expect(g.runStats.damageDealt).toBe(2);
    expect(g.runStats.xp.attack).toBeGreaterThan(0);
    const coins = g.groundItems.find((i) => i.id === 'coins')!;
    g.take(coins);
    for (let i = 0; i < 10; i++) g.tick();
    expect(g.runStats.coinsLooted).toBe(10);
  });
});

describe('loot QoL', () => {
  it('Take all picks up the whole pile', async () => {
    const { GroundItem } = await import('../src/entities/GroundItem');
    const g = new GameState(510);
    g.npcs = [];
    const spot = adjacentFloor(g);
    const pile = [new GroundItem('bones', 1, spot), new GroundItem('coins', 40, spot), new GroundItem('trout', 1, spot)];
    g.groundItems.push(...pile);
    g.take(pile[2], true);
    for (let i = 0; i < 5; i++) g.tick();
    expect(g.itemsAt(spot.x, spot.y)).toHaveLength(0);
    expect(g.player.inventory.count('coins')).toBe(40);
    expect(g.player.inventory.count('trout')).toBe(1);
  });

  it('auto-picks up enabled categories you walk over', async () => {
    const { GroundItem } = await import('../src/entities/GroundItem');
    const g = new GameState(511);
    g.npcs = [];
    g.autoPickup = { coins: true, arrows: false, runes: true };
    const spot = adjacentFloor(g);
    g.groundItems.push(new GroundItem('coins', 25, spot), new GroundItem('iron_arrow', 10, spot), new GroundItem('air_rune', 30, spot));
    g.walkTo(spot);
    for (let i = 0; i < 3; i++) g.tick();
    expect(g.player.inventory.count('coins')).toBe(25);
    expect(g.player.inventory.count('air_rune')).toBe(30);
    expect(g.itemsAt(spot.x, spot.y).map((i) => i.id)).toEqual(['iron_arrow']);
  });

  it('swaps inventory slots', () => {
    const g = new GameState(512);
    g.player.inventory.add('coins', 5);
    const coinSlot = g.player.inventory.slots.findIndex((s) => s?.id === 'coins');
    g.swapSlots(0, coinSlot);
    expect(g.player.inventory.slots[0]?.id).toBe('coins');
    expect(g.player.inventory.slots[coinSlot]?.id).toBe('shrimps');
  });
});
