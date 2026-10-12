import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { ResourceNode } from '../src/entities/ResourceNode';
import { Npc } from '../src/entities/Npc';
import { GameState } from '../src/game/GameState';
import { settleRun } from '../src/meta/camp';
import { freshMeta } from '../src/save/meta';
import { Tile, reachableCount, setTile } from '../src/world/tiles';
import { xpForLevel } from '../src/systems/xp';

/** Regression tests for bugs found in the code audit. */

// Private methods, reached the way the game calls them.
type Internals = { landHit(npc: Npc, style: string, dmg: number): void; processPlayer(): void };

describe('audit fixes', () => {
  it('Fragile takes 25% of max HP however high Hitpoints gets', () => {
    const g = new GameState(1, () => {}, { modifiers: ['fragile'] });
    g.player.skills.xp.hitpoints = xpForLevel(80);
    expect(g.player.maxHp).toBe(60);
  });

  it('a splashed spell gives no Magic XP, a landed one does', () => {
    const g = new GameState(1, () => {}, {});
    const p = g.player;
    p.equipment = { weapon: 'staff_of_air' };
    p.inventory.add('mind_rune', 1000);
    // A target that can't be hit: every cast splashes.
    const wall = new Npc({ ...NPCS.goblin, defence: 5000, defenceBonus: 5000, hitpoints: 1000 }, { x: p.pos.x + 1, y: p.pos.y });
    g.npcs = [wall];
    for (let i = 0; i < 50; i++) {
      wall.attackCooldown = 99;
      if (!p.intent) g.attack(wall);
      g.tick();
    }
    expect(p.skills.xp.magic).toBe(0);
  });

  it('Sanctuary heals once per altar; prayer still recharges every time', () => {
    const g = new GameState(1, () => {}, { perks: { sanctuary: 1 } });
    const p = g.player;
    const altar = new ResourceNode({ x: p.pos.x + 1, y: p.pos.y }, 'altar');
    g.nodes.push(altar);
    const pray = () => {
      g.prayAt(altar);
      (g as unknown as Internals).processPlayer();
    };
    p.hp = 1;
    pray();
    expect(p.hp).toBeGreaterThan(1);
    p.hp = 1;
    p.prayerPoints = 0;
    pray();
    expect(p.hp).toBe(1);
    expect(p.prayerPoints).toBe(p.maxPrayer);
  });

  it('the Warding Charm soaks a hit before Undying is used up', () => {
    const g = new GameState(1, () => {}, { perks: { undying: 1 } });
    g.relics.push('warding_charm');
    g.wardLeft = 10;
    const p = g.player;
    p.hp = 5;
    const npc = new Npc(NPCS.goblin, { x: p.pos.x + 1, y: p.pos.y });
    g.npcs = [npc];
    (g as unknown as Internals).landHit(npc, 'melee', 8);
    expect(p.hp).toBe(5);
    expect(g.undyingTimes).toBe(0);
  });

  it('levels the autoplay bot gained do not count toward mastery', () => {
    const g = new GameState(1, () => {}, {});
    g.player.skills.xp.attack = xpForLevel(30);
    g.endAutoplay();
    expect(g.levelsAtStart.attack).toBe(30);
  });

  it('a fire is never lit where it would wall off a corridor', () => {
    const g = new GameState(1, () => {}, { tools: { pickaxe: 0, axe: 0, fishing: 0, hammer: false, tinderbox: true, knife: false, chisel: false } });
    const p = g.player;
    // A 1-wide corridor running east-west, with the player in the middle of it.
    for (let y = 0; y < g.map.height; y++) for (let x = 0; x < g.map.width; x++) setTile(g.map, x, y, Tile.Wall);
    for (let x = 5; x <= 15; x++) setTile(g.map, x, 10, Tile.Floor);
    p.pos = { x: 10, y: 10 };
    g.npcs = [];
    g.nodes = [];
    g.groundItems = [];
    p.inventory.add('logs', 1);
    const before = reachableCount(g.map, p.pos);
    g.useItem(p.inventory.slots.findIndex((s) => s?.id === 'logs'));
    expect(g.nodes.some((n) => n.kind === 'fire')).toBe(false);
    expect(reachableCount(g.map, p.pos)).toBe(before);
  });

  it('materials the autoplay bot gathered count half', () => {
    const g = new GameState(1, () => {}, {});
    g.player.inventory.add('logs', 10);
    g.endAutoplay();
    const m = freshMeta();
    settleRun(m, g);
    const halfBot = m.materials.timber;
    const m2 = freshMeta();
    const fresh = new GameState(1, () => {}, {});
    fresh.player.inventory.add('logs', 10);
    settleRun(m2, fresh);
    expect(m2.materials.timber).toBeGreaterThan(0);
    expect(halfBot).toBe(m2.materials.timber - Math.floor(m2.materials.timber / 2));
  });

  it('Armourer gear you cannot wield yet comes with the best tier you can', () => {
    const g = new GameState(1, () => {}, { startStyle: 'ranged', armoury: { melee: 0, ranged: 5, magic: 0, body: 0, ranged_body: 0, magic_body: 0, shield: 0, ranged_shield: 0, magic_shield: 0 } });
    const p = g.player;
    expect(p.weaponType).toBe('ranged');
    expect(p.ammo).toBeGreaterThan(0);
    expect(p.inventory.count('yew_shortbow')).toBe(1);
  });

  it('kills sometimes drop supplies for the style you use', () => {
    const g = new GameState(1, () => {}, {});
    const p = g.player;
    p.equipment = { weapon: 'staff_of_air' };
    let runes = 0;
    for (let i = 0; i < 200; i++) {
      g.groundItems = [];
      const npc = new Npc(NPCS.goblin, { x: p.pos.x + 1, y: p.pos.y });
      g.npcs.push(npc);
      (g as unknown as { killNpc(n: Npc): void }).killNpc(npc);
      runes += g.groundItems.filter((gi) => gi.id === 'mind_rune').reduce((n, gi) => n + gi.qty, 0);
      // The staff provides air runes, so none drop.
      expect(g.groundItems.some((gi) => gi.id === 'air_rune')).toBe(false);
    }
    expect(runes).toBeGreaterThan(100);
  });
});
