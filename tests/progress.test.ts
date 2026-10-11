import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, TIERS } from '../src/data/achievements';
import { ALL_LOG_SLOTS, LOG_CATEGORIES, PETS } from '../src/data/collectionLog';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { Npc } from '../src/entities/Npc';
import { GameEvent, GameState } from '../src/game/GameState';
import { Notice, ProgressTracker } from '../src/meta/tracker';
import { freshMeta } from '../src/save/meta';
import { Tile, tileAt } from '../src/world/tiles';

/** A run wired to a tracker, like the real scene does. */
function tracked(seed: number, setup = {}) {
  const meta = freshMeta();
  const tracker = new ProgressTracker(meta);
  const notices: Notice[] = [];
  let g: GameState | undefined;
  g = new GameState(seed, (e: GameEvent) => {
    if (g) notices.push(...tracker.handle(e, g));
  }, setup);
  return { g: g!, meta, tracker, notices };
}

function adjacentFloor(g: GameState) {
  const { x, y } = g.player.pos;
  return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
}

describe('achievement and log data', () => {
  it('has unique ids, valid tiers and real log slots', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(TIERS.some((t) => t.id === a.tier)).toBe(true);
      expect(!!a.counter || !!a.check || a.id === 'untouchable').toBe(true);
    }
    const pets = new Set(PETS.map((p) => p.id));
    for (const id of ALL_LOG_SLOTS) expect(ITEMS[id] || pets.has(id), id).toBeTruthy();
    expect(LOG_CATEGORIES.find((c) => c.id === 'goblin_warlord')!.slots).toContain('pet_goblin_warlord');
  });
});

describe('progress tracker', () => {
  it('counts kills, grants First Blood once with tokens, and logs drops', () => {
    const { g, meta, notices } = tracked(301);
    g.player.hp = 999;
    const npc = new Npc({ ...NPCS.goblin, drops: [{ item: 'bronze_sword', chance: 1 }, { item: 'bones', chance: 1 }] }, adjacentFloor(g));
    g.npcs = [npc];
    g.attack(npc);
    for (let i = 0; i < 300 && g.npcs.length; i++) g.tick();
    expect(meta.killCounts.goblin).toBe(1);
    expect(meta.achievements).toContain('first_blood');
    expect(meta.tokens).toBe(10);
    expect(meta.collection.bronze_sword).toBe(1);
    expect(meta.collection.bones).toBeUndefined(); // common supplies aren't logged
    expect(notices.filter((n) => n.kind === 'achievement' && n.id === 'first_blood')).toHaveLength(1);
    expect(notices.some((n) => n.kind === 'collection' && n.id === 'bronze_sword')).toBe(true);
  });

  it('tracks lifetime counters with progress', () => {
    const { g, tracker, meta } = tracked(302);
    for (let i = 0; i < 25; i++) {
      g.player.inventory.add('bones');
      g.useItem(g.player.inventory.slots.findIndex((s) => s?.id === 'bones'));
    }
    expect(meta.lifetime.bones).toBe(25);
    expect(meta.achievements).toContain('pious');
    expect(tracker.progress(ACHIEVEMENTS.find((a) => a.id === 'gatherer')!)).toEqual([0, 10]);
  });

  it('awards pets once and makes the first one your follower', () => {
    const meta = freshMeta();
    const tracker = new ProgressTracker(meta);
    const g = new GameState(303);
    const first = tracker.handle({ type: 'pet', bossId: 'tztok_jad' }, g);
    expect(first.some((n) => n.kind === 'pet')).toBe(true);
    expect(meta.pets).toEqual(['pet_tztok_jad']);
    expect(meta.activePet).toBe('pet_tztok_jad');
    expect(meta.achievements).toContain('pet_owner');
    expect(tracker.handle({ type: 'pet', bossId: 'tztok_jad' }, g).some((n) => n.kind === 'pet')).toBe(false);
  });

  it('Untouchable: a flawless boss kill', () => {
    const meta = freshMeta();
    const tracker = new ProgressTracker(meta);
    const g = new GameState(304);
    tracker.handle({ type: 'kill', npcId: 'goblin_warlord', boss: true, style: 'melee', weakness: false, flawless: true }, g);
    expect(meta.achievements).toContain('untouchable');
    expect(meta.achievements).toContain('warlord');
  });

  it('in-run challenges read the current run', () => {
    const { g, meta, tracker } = tracked(305);
    g.loadFloor(5);
    tracker.handle({ type: 'floor', depth: 5 }, g);
    expect(meta.achievements).toContain('ghost'); // floor 5, no kills
    expect(meta.achievements).toContain('into_depths');
  });
});
