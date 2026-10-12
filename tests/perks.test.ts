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
    g.player.inventory.add('bronze_arrowtips', 15);
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

describe('skill perks', () => {
  it('Masterwork upgrades one metal tier, never past rune', async () => {
    const { masterworkOf } = await import('../src/game/skilling');
    expect(masterworkOf('steel_scimitar')).toBe('mithril_scimitar');
    expect(masterworkOf('rune_platebody')).toBeNull();
  });

  it('Bulk Smelting gives coal back', async () => {
    const g = run({ bulk_smelting: 2 });
    g.player.tools = { ...NO_TOOLS };
    g.player.skills.xp.smithing = xpForLevel(50);
    g.player.inventory.add('runite_ore');
    g.player.inventory.add('coal', 4);
    const { processStep } = await import('../src/game/skilling');
    processStep(g, RECIPES.find((r) => r.id === 'smelt_rune')!);
    expect(g.player.inventory.count('rune_bar')).toBeGreaterThanOrEqual(1);
    expect(g.player.inventory.count('coal')).toBe(2);
  });

  it('Lumberjack and Surveyor add camp materials', async () => {
    const { settleRun } = await import('../src/meta/camp');
    const { freshMeta } = await import('../src/save/meta');
    const m = freshMeta();
    m.perks = { lumberjack: 2, surveyor: 1 };
    const g = run({});
    g.player.inventory.add('logs', 10);
    g.player.inventory.add('iron_bar', 4);
    expect(settleRun(m, g)).toEqual({ timber: 15, metal: 15 });
  });

  it('Thieving, Agility and Slayer XP perks', () => {
    const a = run({});
    const b = run({ cutpurse: 3, parkour: 2, slayer_lore: 1 });
    for (const g of [a, b]) for (const s of ['thieving', 'agility', 'slayer'] as const) g.giveXp(s, 1000);
    expect(b.player.skills.xp.thieving / a.player.skills.xp.thieving).toBeCloseTo(1.6);
    expect(b.player.skills.xp.agility / a.player.skills.xp.agility).toBeCloseTo(1.5);
    expect(b.player.skills.xp.slayer / a.player.skills.xp.slayer).toBeCloseTo(1.2);
  });
});

describe('token economy', () => {
  it('coins convert at 20:1 up to 2,000, then taper', async () => {
    const { coinTokens } = await import('../src/game/GameState');
    expect(coinTokens(500)).toBe(25);
    expect(coinTokens(2000)).toBe(100);
    expect(coinTokens(2100)).toBeGreaterThan(100);
    expect(coinTokens(10000)).toBeLessThan(250);
    expect(coinTokens(165000)).toBeLessThan(1000);
    // Never decreasing.
    for (let c = 0; c < 50000; c += 777) expect(coinTokens(c + 777)).toBeGreaterThanOrEqual(coinTokens(c));
  });
});

describe('quick-eat', () => {
  it('eats the smallest food that fills your missing HP, else the biggest', () => {
    const g = run({});
    const p = g.player;
    p.inventory.slots.fill(null);
    p.inventory.add('shrimps');
    p.inventory.add('swordfish');
    p.skills.xp.hitpoints = xpForLevel(40);
    p.hp = p.maxHp - 2;
    g.quickEat();
    expect(p.inventory.count('shrimps')).toBe(0);
    p.eatCooldown = 0;
    p.hp = 5;
    g.quickEat();
    expect(p.inventory.count('swordfish')).toBe(0);
  });
});
