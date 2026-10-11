import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { SPECIALS } from '../src/data/specials';
import { GameState } from '../src/game/GameState';
import { Npc } from '../src/entities/Npc';
import { Tile, setTile } from '../src/world/tiles';
import { xpForLevel } from '../src/systems/xp';

/** A run with one passive dummy next to the player and maxed combat stats. */
function arena(weapon: string, seed = 501) {
  const g = new GameState(seed);
  g.npcs.length = 0;
  const p = g.player;
  for (const s of ['attack', 'strength', 'ranged', 'magic'] as const) p.skills.xp[s] = xpForLevel(70);
  p.equipment.weapon = weapon;
  const spot = { x: p.pos.x + 1, y: p.pos.y };
  setTile(g.map, spot.x, spot.y, Tile.Floor);
  const dummy = new Npc({ ...NPCS.hill_giant, hitpoints: 5000, aggroRadius: 0, attack: 0, strength: 0, drops: [] }, spot);
  dummy.hp = 5000;
  g.npcs.push(dummy);
  return { g, p, dummy };
}

describe('special attacks', () => {
  it('every special weapon is a real, wieldable item', () => {
    for (const s of SPECIALS) expect(ITEMS[s.weapon]?.equip?.slot, s.weapon).toBe('weapon');
  });

  it('arming spends energy on the next attack, which then disarms', () => {
    const { g, p, dummy } = arena('dragon_dagger');
    g.toggleSpec();
    expect(p.specArmed).toBe(true);
    g.attack(dummy);
    g.tick();
    expect(p.specEnergy).toBe(75);
    expect(p.specArmed).toBe(false);
    expect(g.messages).toContain('You use Puncture!');
  });

  it('cannot arm without enough energy, and energy refills over time', () => {
    const { g, p } = arena('dragon_claws');
    p.specEnergy = 40;
    g.toggleSpec();
    expect(p.specArmed).toBe(false);
    for (let i = 0; i < 50; i++) g.tick();
    expect(p.specEnergy).toBe(50);
  });

  it('dragon claws deal more on average than a normal hit', () => {
    let spec = 0;
    let normal = 0;
    for (let i = 0; i < 40; i++) {
      const a = arena('dragon_claws', 600 + i);
      a.g.toggleSpec();
      a.g.attack(a.dummy);
      a.g.tick();
      spec += 5000 - a.dummy.hp;
      const b = arena('dragon_claws', 600 + i);
      b.g.attack(b.dummy);
      b.g.tick();
      normal += 5000 - b.dummy.hp;
    }
    expect(spec).toBeGreaterThan(normal * 1.5);
  });

  it('the dragon warhammer lowers defence; the granite maul ignores attack delay', () => {
    const w = arena('dragon_warhammer');
    for (let i = 0; i < 20 && !w.dummy.defenceDrain; i++) {
      w.p.specEnergy = 100;
      w.g.toggleSpec();
      w.g.attack(w.dummy);
      w.g.tick();
      for (let t = 0; t < 6; t++) w.g.tick();
    }
    expect(w.dummy.defenceDrain).toBeCloseTo(0.3);

    const m = arena('granite_maul');
    m.g.attack(m.dummy);
    m.g.tick(); // normal swing: the maul is now on its 7-tick delay
    expect(m.p.attackCooldown).toBeGreaterThan(0);
    m.g.toggleSpec();
    m.g.tick();
    expect(m.p.specEnergy).toBe(50);
  });

  it('the magic shortbow uses two arrows for its special', () => {
    const { g, p, dummy } = arena('magic_shortbow');
    p.equipment.ammo = 'rune_arrow';
    p.ammo = 10;
    g.toggleSpec();
    g.attack(dummy);
    g.tick();
    expect(p.ammo).toBeLessThanOrEqual(8);
  });

  it('restored runs keep special energy', async () => {
    const { deserializeRun, serializeRun } = await import('../src/save/runSave');
    const { g, p } = arena('dragon_dagger');
    p.specEnergy = 35;
    expect(deserializeRun(serializeRun(g), () => {})!.player.specEnergy).toBe(35);
  });
});
