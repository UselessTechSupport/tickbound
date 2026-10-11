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
