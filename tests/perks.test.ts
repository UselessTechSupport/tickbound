import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { RECIPES } from '../src/data/recipes';
import { NO_TOOLS } from '../src/data/tools';
import { Npc } from '../src/entities/Npc';
import { GameState } from '../src/game/GameState';
import { xpForLevel } from '../src/systems/xp';

const run = (perks: Record<string, number>, seed = 800, extra = {}) => new GameState(seed, () => {}, { perks, ...extra });

describe('perk effects', () => {
  it('starting levels, max HP and bow range', () => {
    const g = run({ basic_training: 5, guard_drills: 2, rangers_kit: 3, apprentice_kit: 1, constitution: 4, long_range: 2 });
    const p = g.player;
    expect(p.skills.level('attack')).toBe(16);
    expect(p.skills.level('strength')).toBe(16);
    expect(p.skills.level('defence')).toBe(7);
    expect(p.skills.level('ranged')).toBe(10);
    expect(p.skills.level('magic')).toBe(4);
    expect(p.maxHp).toBe(14);
    expect(p.hp).toBe(14);
    p.equipment.weapon = 'shortbow';
    expect(p.attackRange).toBe(9);
  });

  it('style perks raise accuracy and max hit for that style only', () => {
    const plain = run({});
    const melee = run({ precision: 5, brute_force: 5 });
    for (const g of [plain, melee]) {
      g.player.skills.xp.strength = xpForLevel(80);
      g.player.equipment.weapon = 'rune_scimitar';
    }
    expect(melee.combatPreview().attackRoll).toBeGreaterThan(plain.combatPreview().attackRoll);
    expect(melee.combatPreview().maxHit).toBeGreaterThan(plain.combatPreview().maxHit);
    // A bow ignores melee perks.
    for (const g of [plain, melee]) {
      g.player.equipment.weapon = 'shortbow';
      g.player.equipment.ammo = 'bronze_arrow';
      g.player.ammo = 10;
    }
    expect(melee.combatPreview().attackRoll).toBe(plain.combatPreview().attackRoll);
  });

  it('Monster Lore and Giant Slayer apply to the right targets', () => {
    const g = run({ monster_lore: 3, giant_slayer: 3 }, 801, { veteranOf: ['goblin'] });
    const base = run({});
    for (const s of [g, base]) {
      s.player.skills.xp.strength = xpForLevel(90);
      s.player.equipment.weapon = 'rune_scimitar';
    }
    const goblin = new Npc(NPCS.goblin, { x: 0, y: 0 });
    const rat = new Npc(NPCS.rat, { x: 0, y: 0 });
    const warlord = new Npc(NPCS.goblin_warlord, { x: 0, y: 0 });
    goblin.target = rat.target = warlord.target = g.player; // not ambushes
    expect(g.combatPreview(goblin).maxHit).toBeGreaterThan(base.combatPreview(goblin).maxHit);
    expect(g.combatPreview(rat).maxHit).toBe(base.combatPreview(rat).maxHit);
    expect(g.combatPreview(warlord).maxHit).toBeGreaterThan(base.combatPreview(warlord).maxHit);
  });

  it('Juggernaut and Phoenix: less damage, and two cheat-deaths', () => {
    const g = run({ undying: 1, phoenix: 1 });
    g.hurtPlayer(999, 'test');
    expect(g.over).toBe(false);
    g.player.hp = 5;
    g.hurtPlayer(999, 'test');
    expect(g.over).toBe(false);
    g.hurtPlayer(999, 'test');
    expect(g.over).toBe(true);
  });

  it('Fortune: Midas doubles coin tokens, Elite Hunter pays per elite, Haggler changes prices', () => {
    const a = run({});
    const b = run({ midas: 1, elite_hunter: 2, haggler: 3 });
    for (const g of [a, b]) {
      g.player.inventory.add('coins', 2000);
      g.eliteKills = 1;
    }
    expect(b.tokensEarned - a.tokensEarned).toBe(100 + 20);
    expect(b.buyPrice(100)).toBe(70);
    expect(b.sellPrice('rune_scimitar')).toBeGreaterThan(a.sellPrice('rune_scimitar'));
  });

  it('Relic Hunter offers 4 relics', () => {
    const g = run({ relic_hunter: 1 });
    g.offerRelics();
    expect(g.pendingRelics).toHaveLength(4);
  });

  it('Fine Fletching adds arrows', () => {
    const g = run({ fine_fletching: 3 });
    g.player.tools = { ...NO_TOOLS, knife: true };
    g.player.inventory.add('bronze_bar');
    g.player.inventory.add('logs');
    g.fletch(RECIPES.find((r) => r.id === 'fletch_bronze_arrow')!);
    expect(g.player.inventory.count('bronze_arrow')).toBe(21);
  });

  it('Saint brings prayer back once per floor', () => {
    const g = run({ saint: 1, blessed: 5 });
    const p = g.player;
    p.prayerPoints = 1;
    p.activePrayers.add('protect_melee');
    p.prayerDrain = 1e9;
    g.tick();
    expect(p.prayerPoints).toBeGreaterThan(5);
    expect(g.messages.some((m) => m.startsWith('Saint'))).toBe(true);
  });
});
