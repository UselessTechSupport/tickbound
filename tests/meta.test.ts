import { describe, expect, it } from 'vitest';
import { BRANCHES, DEFAULT_MODS, FULL_TREE_COST, PERKS, TIER_GATES, branchRanks, computeMods, perkBlocker } from '../src/data/skillTree';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { Npc } from '../src/entities/Npc';
import { GameEvent, GameState } from '../src/game/GameState';
import { Tile, tileAt } from '../src/world/tiles';

describe('skill tree data', () => {
  it('every perk has a unique id, a valid tier and lane, and no two share a slot', () => {
    expect(new Set(PERKS.map((p) => p.id)).size).toBe(PERKS.length);
    const slots = new Set<string>();
    for (const p of PERKS) {
      expect(p.tier).toBeGreaterThanOrEqual(0);
      expect(p.tier).toBeLessThan(TIER_GATES.length);
      expect([0, 1, 2]).toContain(p.lane);
      const key = `${p.branch}/${p.tier}/${p.lane}`;
      expect(slots.has(key), key).toBe(false);
      slots.add(key);
    }
  });

  it('every capstone is reachable: enough ranks below it in its branch', () => {
    for (const b of BRANCHES) {
      const below = PERKS.filter((p) => p.branch === b.id && p.tier < 6).reduce((n, p) => n + p.costs.length, 0);
      expect(below, b.id).toBeGreaterThanOrEqual(TIER_GATES[6]);
    }
  });

  it('the full tree is a long-term goal', () => {
    expect(PERKS.length).toBeGreaterThanOrEqual(90);
    expect(FULL_TREE_COST).toBeGreaterThan(300_000);
  });

  it('gates purchases on tier, tokens and max rank', () => {
    expect(perkBlocker({}, 100000, 'brute_force')).toMatch(/Opens after 4 ranks in Melee/);
    expect(perkBlocker({ basic_training: 4 }, 100000, 'brute_force')).toBeNull();
    expect(perkBlocker({}, 5, 'basic_training')).toMatch(/Needs 15/);
    expect(perkBlocker({}, 15, 'basic_training')).toBeNull();
    expect(perkBlocker({ basic_training: 5 }, 1000, 'basic_training')).toBe('Fully upgraded.');
    expect(branchRanks({ basic_training: 2, precision: 1, iron_will: 3 }, 'melee')).toBe(3);
  });

  it('starting items and gear are real items', () => {
    const m = computeMods(Object.fromEntries(PERKS.map((p) => [p.id, p.costs.length])));
    for (const it of m.startItems) expect(ITEMS[it.id]).toBeDefined();
  });
});

describe('perks applied to a run', () => {
  it('no perks = default kit', () => {
    const g = new GameState(1);
    expect(g.mods).toEqual(DEFAULT_MODS);
    expect(g.player.skills.level('attack')).toBe(1);
    expect(g.player.equipment.weapon).toBe('bronze_dagger');
  });

  it('applies starting levels, gear and supplies', () => {
    const g = new GameState(2, () => {}, {
      perks: { basic_training: 2, iron_will: 1, veterans_kit: 1, packed_lunch: 1, blessed: 1, pilgrim: 1, holy_supplies: 1 },
    });
    const p = g.player;
    expect(p.skills.level('attack')).toBe(7);
    expect(p.skills.level('hitpoints')).toBe(12);
    expect(p.hp).toBe(12);
    expect(p.skills.level('prayer')).toBe(5);
    expect(p.prayerPoints).toBe(5);
    expect(p.equipment.weapon).toBe('bronze_dagger'); // Veteran's Kit no longer gives gear
    expect(p.inventory.count('trout')).toBe(2);
    expect(p.inventory.count('prayer_potion')).toBe(1);
  });

  it('Hearty Meals boosts healing', () => {
    const g = new GameState(3, () => {}, { perks: { packed_lunch: 1, hearty_meals: 2 } });
    g.player.hp = 1;
    g.useItem(0); // shrimps heal 3 + 2
    expect(g.player.hp).toBe(6);
  });

  it('Undying saves you once', () => {
    const g = new GameState(4, () => {}, { perks: { undying: 1 } });
    const { x, y } = g.player.pos;
    const spot = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
    g.npcs = [new Npc(NPCS.greater_demon, spot)];
    for (let i = 0; i < 400 && !g.over; i++) g.tick();
    expect(g.undyingUsed).toBe(true);
    expect(g.messages.some((m) => m.includes('cheat death'))).toBe(true);
    expect(g.over).toBe(true); // it only works once
  });

  it('Treasure Hunter and Bounty raise tokens', () => {
    const g = new GameState(5, () => {}, { perks: { treasure_hunter: 3, lucky: 1, bounty: 1 } });
    g.kills = 10;
    g.bossKills = 1;
    expect(g.tokensEarned).toBe(Math.floor((10 + 50) * 1.3));
  });
});

describe('camp', () => {
  it('has the Mentor, Toolsmith and a ladder that starts a run', () => {
    const events: GameEvent[] = [];
    const g = new GameState(6, (e) => events.push(e), { camp: true });
    expect(g.isCamp).toBe(true);
    expect(g.npcs).toHaveLength(0);
    const kinds = g.nodes.map((n) => n.kind);
    expect(kinds).toContain('mentor');
    expect(kinds).toContain('toolsmith');

    g.talkTo(g.nodes.find((n) => n.kind === 'mentor')!);
    for (let i = 0; i < 30; i++) g.tick();
    expect(events.some((e) => e.type === 'campMenu' && e.kind === 'mentor')).toBe(true);

    g.walkTo(g.map.stairs);
    for (let i = 0; i < 30; i++) g.tick();
    expect(events.some((e) => e.type === 'enterDungeon')).toBe(true);
  });
});

describe('forfeit', () => {
  it('ends the run and banks tokens like a death, but not in camp', () => {
    const events: GameEvent[] = [];
    const camp = new GameState(7, (e) => events.push(e), { camp: true });
    camp.forfeit();
    expect(camp.over).toBe(false);

    const g = new GameState(8, (e) => events.push(e));
    g.kills = 12;
    const tokens = g.tokensEarned;
    g.forfeit();
    expect(g.over).toBe(true);
    expect(g.forfeited).toBe(true);
    expect(g.tokensEarned).toBe(tokens);
    expect(events.some((e) => e.type === 'death')).toBe(true);
    g.tick(); // nothing happens after the run ends
    expect(g.tickCount).toBe(0);
  });
});
