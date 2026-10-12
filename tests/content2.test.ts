import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { NPCS } from '../src/data/npcs';
import { SLAYER_CATEGORIES, assignTask } from '../src/data/slayer';
import { THEMES, themeForDepth } from '../src/data/themes';
import { Npc } from '../src/entities/Npc';
import { GameEvent, GameState } from '../src/game/GameState';
import { ProgressTracker } from '../src/meta/tracker';
import { freshMeta } from '../src/save/meta';
import { Tile, tileAt } from '../src/world/tiles';

const adjacentFloor = (g: GameState) => {
  const { x, y } = g.player.pos;
  return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
};

describe('themed floors', () => {
  it('changes every 5 floors, then the Abyss from floor 21', () => {
    expect(themeForDepth(1).id).toBe('dungeon');
    expect(themeForDepth(5).id).toBe('dungeon');
    expect(themeForDepth(6).id).toBe('crypt');
    expect(themeForDepth(11).id).toBe('volcanic');
    expect(themeForDepth(16).id).toBe('frozen');
    expect(themeForDepth(21).id).toBe('abyss');
    expect(themeForDepth(80).id).toBe('abyss');
    for (const t of THEMES) expect(t.floorKeys.length && t.wallKeys.length).toBeTruthy();
  });

  it('themed monsters spawn in their band and announce the new theme', () => {
    const g = new GameState(401);
    g.loadFloor(7);
    expect(g.npcs.some((n) => ['ghoul', 'wight', 'mummy'].includes(n.def.id))).toBe(true);
    g.loadFloor(6);
    expect(g.messages.some((m) => m.includes('the Crypt'))).toBe(true);
  });
});

describe('slayer', () => {
  it('only assigns tasks you can reach, and every task monster exists', () => {
    for (const c of SLAYER_CATEGORIES) for (const id of c.npcIds) expect(NPCS[id], id).toBeDefined();
    for (let i = 0; i < 50; i++) {
      const t = assignTask(1, Math.random);
      expect(['rats', 'goblins']).toContain(t.category);
      expect(t.remaining).toBe(t.total);
    }
    expect(assignTask(20, () => 0.99, 'ice').category).not.toBe('ice');
  });

  it('task kills give Slayer XP, count down, and pay tokens when done', () => {
    const events: GameEvent[] = [];
    const task = { category: 'goblins', total: 2, remaining: 2 };
    const g = new GameState(402, (e) => events.push(e), { slayerTask: task });
    g.player.hp = 999;
    for (let k = 0; k < 2; k++) {
      const gob = new Npc(NPCS.goblin, adjacentFloor(g));
      g.npcs = [gob];
      g.attack(gob);
      for (let i = 0; i < 300 && g.npcs.length; i++) g.tick();
    }
    expect(task.remaining).toBe(0);
    expect(g.player.skills.xp.slayer).toBeGreaterThan(0);
    expect(events.find((e) => e.type === 'slayerDone')).toEqual({ type: 'slayerDone', tokens: 4 });
  });

  it('on-task targets get the slayer bonus', () => {
    const g = new GameState(403, () => {}, { slayerTask: { category: 'goblins', total: 5, remaining: 5 } });
    g.player.skills.addXp('slayer', 1_000_000);
    g.player.skills.addXp('strength', 1_000_000);
    const gob = new Npc(NPCS.goblin, adjacentFloor(g));
    const rat = new Npc(NPCS.rat, adjacentFloor(g));
    expect(g.combatPreview(gob).maxHit).toBeGreaterThan(g.combatPreview(rat).maxHit);
  });
});

describe('new achievements', () => {
  it('all 100 have unique ids', () => {
    expect(ACHIEVEMENTS.length).toBe(100);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(100);
  });

  it('skilling and depth achievements unlock from tracked events', () => {
    const meta = freshMeta();
    const tracker = new ProgressTracker(meta);
    const g = new GameState(404);
    tracker.handle({ type: 'made', item: 'rune_platebody' }, g);
    tracker.handle({ type: 'made', item: 'runite_ore' }, g);
    expect(meta.achievements).toEqual(expect.arrayContaining(['rune_smith', 'runite_miner']));
    expect(meta.achievements).not.toContain('mithril_smith');
    g.loadFloor(11);
    tracker.handle({ type: 'floor', depth: 11 }, g);
    expect(meta.achievements).toEqual(expect.arrayContaining(['into_the_fire', 'crypt_crawler', 'deep_diver']));
  });
});

describe('slayer unlock', () => {
  it('the Slayer master only appears at camp once Slayer is unlocked', () => {
    const locked = new GameState(410, () => {}, { camp: true });
    expect(locked.nodes.some((n) => n.kind === 'slayer_master')).toBe(false);
    const unlocked = new GameState(411, () => {}, { camp: true, slayerUnlocked: true });
    expect(unlocked.nodes.some((n) => n.kind === 'slayer_master')).toBe(true);
  });

  it('older saves that already used Slayer keep it', async () => {
    const { loadMeta } = await import('../src/save/meta');
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v),
    };
    store['tickbound.meta'] = JSON.stringify({ tokens: 5, slayerTask: { category: 'rats', total: 6, remaining: 2 } });
    expect(loadMeta().slayerUnlocked).toBe(true);
    store['tickbound.meta'] = JSON.stringify({ tokens: 5 });
    expect(loadMeta().slayerUnlocked).toBe(false);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});

describe('slayer unlocks', () => {
  it('Extended Tasks makes tasks longer', async () => {
    const { assignTask } = await import('../src/data/slayer');
    let r = 0.5;
    const rand = () => r;
    const normal = assignTask(10, rand);
    r = 0.5;
    const longer = assignTask(10, rand, undefined, true);
    expect(longer.total).toBe(Math.round(normal.total * 1.5));
  });
});
