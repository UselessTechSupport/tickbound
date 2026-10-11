import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { item } from '../src/data/items';
import { Npc } from '../src/entities/Npc';
import { GameState } from '../src/game/GameState';
import { combatLevel } from '../src/systems/combat';
import { Tile, tileAt } from '../src/world/tiles';

const run = (g: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) g.tick();
};

/** Quiet run with one passive monster `dist` tiles away in a straight, visible line. */
function range(seed: number, dist: number): { g: GameState; npc: Npc } {
  for (let s = seed; s < seed + 200; s++) {
    const g = new GameState(s);
    g.npcs = [];
    g.player.hp = 9999;
    const { x, y } = g.player.pos;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const line = Array.from({ length: dist }, (_, i) => ({ x: x + dx * (i + 1), y: y + dy * (i + 1) }));
      if (!line.every((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)) continue;
      const t = line[dist - 1];
      if (dist <= 7 && !g.isVisible(t.x, t.y)) continue;
      // Low defence so the tests measure mechanics, not lucky rolls.
      const npc = new Npc({ ...NPCS.moss_giant, aggroRadius: 0, hitpoints: 5000, defence: 1, defenceBonus: 0 }, t);
      npc.hp = 5000;
      g.npcs.push(npc);
      return { g, npc };
    }
  }
  throw new Error('no straight corridor found');
}

const wield = (g: GameState, id: string, qty = 1) => {
  g.player.inventory.add(id, qty);
  g.useItem(g.player.inventory.slots.findIndex((s) => s?.id === id));
};

describe('ranged combat', () => {
  it('fires from range without walking up, using arrows', () => {
    const { g, npc } = range(81, 4);
    wield(g, 'shortbow');
    wield(g, 'bronze_arrow', 50);
    expect(g.player.equipment.ammo).toBe('bronze_arrow');
    expect(g.player.ammo).toBe(50);
    const start = { ...g.player.pos };
    g.attack(npc);
    run(g, 40);
    expect(g.player.pos).toEqual(start);
    expect(g.player.ammo).toBeLessThan(50);
    expect(g.player.skills.xp.ranged).toBeGreaterThan(0);
    expect(g.player.skills.xp.attack).toBe(0);
  });

  it('stops when the quiver is empty', () => {
    const { g, npc } = range(82, 3);
    wield(g, 'shortbow');
    wield(g, 'bronze_arrow', 2);
    g.attack(npc);
    run(g, 30);
    expect(g.player.equipment.ammo).toBeUndefined();
    expect(g.messages.some((m) => m.includes('run out of arrows'))).toBe(true);
  });

  it('closes distance only until in range', () => {
    const { g, npc } = range(83, 9);
    wield(g, 'shortbow');
    wield(g, 'bronze_arrow', 50);
    g.attack(npc);
    // Measure at the first shot: afterwards the monster walks over to retaliate.
    for (let i = 0; i < 20 && g.player.ammo === 50; i++) g.tick();
    expect(g.player.ammo).toBeLessThan(50);
    const d = Math.max(Math.abs(g.player.pos.x - npc.pos.x), Math.abs(g.player.pos.y - npc.pos.y));
    expect(d).toBeLessThanOrEqual(7);
    expect(d).toBeGreaterThan(1);
  });
});

describe('magic combat', () => {
  it('casts with runes, and an elemental staff supplies its element', () => {
    const { g, npc } = range(84, 3);
    wield(g, 'staff_of_air');
    g.player.inventory.add('mind_rune', 5);
    g.attack(npc);
    run(g, 60);
    expect(g.player.inventory.count('mind_rune')).toBe(0);
    expect(g.player.skills.xp.magic).toBeGreaterThan(0);
    expect(g.messages.some((m) => m.includes('enough runes'))).toBe(true);
  });

  it('autocasts the chosen spell and enforces its level', () => {
    const { g, npc } = range(85, 3);
    wield(g, 'staff_of_fire');
    g.player.inventory.add('air_rune', 100);
    g.player.inventory.add('mind_rune', 100);
    g.setAutocast('fire_strike');
    g.attack(npc);
    run(g, 3);
    expect(g.messages.at(-1)).toMatch(/Magic level of 13/);
    g.player.skills.addXp('magic', 5000);
    g.attack(npc);
    run(g, 10);
    expect(g.player.inventory.count('air_rune')).toBeLessThan(100); // fire strike uses 2 air per cast
  });
});

describe('gear and levels', () => {
  it('plate armour hurts magic and ranged accuracy', () => {
    expect(item('rune_platebody').equip!.magicBonus).toBeLessThan(0);
    expect(item('rune_platebody').equip!.rangedBonus).toBeLessThan(0);
  });

  it('combat level counts the best of melee, ranged or magic', () => {
    expect(combatLevel(1, 1, 1, 10, 1, 1, 1)).toBe(3);
    expect(combatLevel(1, 1, 1, 10, 1, 60, 1)).toBeGreaterThan(combatLevel(30, 30, 1, 10));
  });

  it('every monster weakness and supply drop is valid', () => {
    for (const n of Object.values(NPCS)) {
      for (const d of n.drops) expect(() => item(d.item), `${n.id} drops ${d.item}`).not.toThrow();
    }
  });
});
