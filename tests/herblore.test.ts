import { describe, expect, it } from 'vitest';
import { ELITE_AFFIXES, eliteDef } from '../src/data/elites';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { RECIPES } from '../src/data/recipes';
import { RESOURCES } from '../src/data/resources';
import { Npc } from '../src/entities/Npc';
import { ResourceNode } from '../src/entities/ResourceNode';
import { GameState } from '../src/game/GameState';
import { xpForLevel } from '../src/systems/xp';
import { Tile, setTile, tileAt } from '../src/world/tiles';

const adjacentFloor = (g: GameState) => {
  const { x, y } = g.player.pos;
  return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
};
const slotOf = (g: GameState, id: string) => g.player.inventory.slots.findIndex((s) => s?.id === id);

describe('herblore', () => {
  it('every mix recipe uses real items', () => {
    for (const r of RECIPES.filter((r) => r.station === 'mix')) {
      expect(ITEMS[r.output], r.id).toBeDefined();
      for (const i of r.inputs) expect(ITEMS[i.item], `${r.id} ${i.item}`).toBeDefined();
    }
  });

  it('mixes a potion from herb + secondary + vial, with level checks', () => {
    const g = new GameState(701);
    const attack = RECIPES.find((r) => r.id === 'mix_attack_potion')!;
    g.mix(attack);
    expect(g.messages.at(-1)).toMatch(/guam leaf, eye of newt and a vial/);
    g.player.inventory.add('guam_leaf');
    g.player.inventory.add('eye_of_newt');
    g.player.inventory.add('vial_of_water');
    g.mix(attack);
    expect(g.player.inventory.count('attack_potion')).toBe(1);
    expect(g.player.inventory.count('guam_leaf')).toBe(0);
    expect(g.player.skills.xp.herblore).toBeGreaterThan(0);
    g.mix(RECIPES.find((r) => r.id === 'mix_magic_potion')!);
    expect(g.messages.at(-1)).toMatch(/Herblore level of 35/);
  });

  it('potions boost combat stats, then fade 1 per minute', () => {
    const g = new GameState(702);
    g.npcs = [];
    g.player.skills.xp.attack = xpForLevel(20);
    g.player.inventory.add('super_attack');
    const before = g.combatPreview().attackRoll;
    g.useItem(slotOf(g, 'super_attack'));
    expect(g.player.boosts.attack).toBe(5 + 3); // 5 + 15% of 20
    expect(g.player.boostedLevel('attack')).toBe(28);
    expect(g.combatPreview().attackRoll).toBeGreaterThan(before);
    for (let i = 0; i < 100; i++) g.tick();
    expect(g.player.boosts.attack).toBe(7);
  });

  it('herb patches are picked by hand (no tool)', () => {
    const g = new GameState(703);
    g.npcs = [];
    g.nodes = [];
    const spot = adjacentFloor(g);
    setTile(g.map, spot.x, spot.y, Tile.Object);
    const patch = new ResourceNode(spot, 'resource', RESOURCES.patch_guam_leaf);
    patch.remaining = 2;
    g.nodes.push(patch);
    g.gather(patch);
    for (let i = 0; i < 200 && !patch.depleted; i++) g.tick();
    expect(g.player.inventory.count('guam_leaf')).toBe(2);
  });
});

describe('elite monsters', () => {
  it('are stronger, named by affix, and roll drops twice', () => {
    const g = new GameState(704);
    g.player.hp = 9999;
    const affix = ELITE_AFFIXES.find((a) => a.id === 'brutal')!;
    const base = { ...NPCS.goblin, drops: [{ item: 'bronze_sword', chance: 1 }] };
    const npc = new Npc(eliteDef(base, affix), adjacentFloor(g));
    npc.elite = affix;
    expect(npc.name).toBe('Brutal Goblin');
    expect(npc.maxHp).toBeGreaterThan(NPCS.goblin.hitpoints);
    g.npcs = [npc];
    g.attack(npc);
    for (let i = 0; i < 500 && g.npcs.length; i++) g.tick();
    expect(g.groundItems.filter((i) => i.id === 'bronze_sword')).toHaveLength(2);
    expect(g.groundItems.some((i) => ITEMS[i.id].herblore)).toBe(true); // elites always drop a herb
    expect(g.eliteKills).toBe(1);
  });

  it('spawn from floor 3, never earlier', () => {
    let elites = 0;
    for (let seed = 0; seed < 40; seed++) {
      const g = new GameState(800 + seed);
      expect(g.npcs.some((n) => n.elite)).toBe(false);
      g.loadFloor(6);
      elites += g.npcs.filter((n) => n.elite).length;
    }
    expect(elites).toBeGreaterThan(0);
  });

  it('vampiric elites heal when they hit', () => {
    const g = new GameState(705);
    const affix = ELITE_AFFIXES.find((a) => a.id === 'vampiric')!;
    const npc = new Npc(eliteDef({ ...NPCS.greater_demon, aggroRadius: 9 }, affix), adjacentFloor(g));
    npc.elite = affix;
    npc.hp = 10;
    g.npcs = [npc];
    g.player.hp = 9999;
    for (let i = 0; i < 40; i++) {
      g.player.intent = null;
      g.tick();
    }
    expect(npc.hp).toBeGreaterThan(10);
  });
});
