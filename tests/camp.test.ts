import { describe, expect, it } from 'vitest';
import { STRUCTURES, materialsFrom, nextStructureLevel, petLevel } from '../src/data/construction';
import { ITEMS } from '../src/data/items';
import { GameState } from '../src/game/GameState';
import { campSetupFor, settleRun } from '../src/meta/camp';
import { freshMeta } from '../src/save/meta';
import { tileAt, Tile } from '../src/world/tiles';
import { xpForLevel } from '../src/systems/xp';

describe('camp building', () => {
  it('structures sit on free camp tiles that do not overlap', () => {
    const g = new GameState(1, () => {}, { camp: true, built: STRUCTURES.map((s) => s.id), armourerUnlocked: true, slayerUnlocked: true, enchanterUnlocked: true });
    const spots = new Set(g.nodes.map((n) => `${n.pos.x},${n.pos.y}`));
    expect(spots.size).toBe(g.nodes.length);
    for (const s of STRUCTURES) expect(tileAt(g.map, s.pos.x, s.pos.y)).toBe(Tile.Object);
    expect(g.nodes.some((n) => n.kind === 'builder')).toBe(true);
    // The ladder is still reachable from spawn.
    expect(tileAt(g.map, g.map.stairs.x, g.map.stairs.y)).toBe(Tile.StairsDown);
  });

  it('carried logs, ores and bars become materials', () => {
    expect(materialsFrom([{ id: 'yew_logs', qty: 2 }, { id: 'rune_bar', qty: 1 }, { id: 'coins', qty: 500 }])).toEqual({ timber: 10, metal: 10 });
  });

  it('levels run in order and max out', () => {
    expect(nextStructureLevel({}, 'workbench')?.tokens).toBe(100);
    expect(nextStructureLevel({ relic_altar: 1 }, 'relic_altar')).toBeNull();
  });

  it('settling a run: materials, bank chest keeps the most valuable items, relics and pet floors', () => {
    const m = freshMeta();
    m.structures.bank_chest = 1;
    m.activePet = 'pet_tztok_jad';
    const g = new GameState(10);
    g.player.inventory.add('logs', 3);
    g.player.inventory.add('rune_scimitar');
    g.player.inventory.add('dragon_dagger');
    g.relics.push('lucky_charm');
    g.loadFloor(4);
    const mats = settleRun(m, g);
    expect(mats.timber).toBe(3);
    expect(m.bank.map((b) => b.id).sort()).toEqual(['dragon_dagger', 'rune_scimitar']);
    expect(m.relicsFound).toContain('lucky_charm');
    expect(m.petFloors.pet_tztok_jad).toBe(3);
  });

  it('a new run gets the bank items, garden potions, starting relic and bonuses', () => {
    const m = freshMeta();
    m.structures = { bank_chest: 1, herb_garden: 2, trophy_room: 3, workbench: 1, relic_altar: 1, pet_kennel: 1 };
    m.bank = [{ id: 'dragon_dagger', qty: 1 }];
    m.startRelic = 'gourmet';
    m.killCounts = { goblin_warlord: 1, tztok_jad: 2 };
    m.activePet = 'pet_goblin_warlord';
    m.petFloors = { pet_goblin_warlord: 25 };
    const setup = campSetupFor(m);
    expect(m.bank).toEqual([]); // handed over
    expect(setup.trophy).toBeCloseTo(0.06);
    expect(setup.pet).toEqual({ kind: 'melee', amount: petLevel(25) / 100 });

    const plain = new GameState(20);
    const g = new GameState(20, () => {}, { campSetup: setup });
    expect(g.player.inventory.count('dragon_dagger')).toBe(1);
    const potions = g.player.inventory.slots.filter((s) => s && ITEMS[s.id].boost || s?.id === 'prayer_potion').length;
    expect(potions).toBeGreaterThanOrEqual(2);
    expect(g.relics).toContain('gourmet');
    // Trophies and the melee pet raise max hit.
    for (const s of [plain, g]) {
      s.player.skills.xp.strength = xpForLevel(99);
      s.player.equipment.weapon = 'dragon_scimitar';
    }
    expect(g.combatPreview().maxHit).toBeGreaterThan(plain.combatPreview().maxHit);
    // Workbench: more crafting XP.
    plain.giveXp('smithing', 1000);
    g.giveXp('smithing', 1000);
    expect(g.player.skills.xp.smithing).toBeGreaterThan(plain.player.skills.xp.smithing);
  });
});
