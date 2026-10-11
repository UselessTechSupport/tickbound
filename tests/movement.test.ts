import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState';
import { isWalkable } from '../src/world/tiles';

/** A quiet run with the whole first floor revealed. */
function quiet(seed: number): GameState {
  const g = new GameState(seed);
  g.npcs = [];
  g.explored.fill(1);
  return g;
}

describe('movement', () => {
  it('runs 2 tiles per tick and walks 1', () => {
    const run = quiet(71);
    run.walkTo(run.map.stairs);
    const total = run.player.path.length;
    run.tick();
    expect(run.player.path.length).toBe(total - 2);

    const walk = quiet(71);
    walk.setRunning(false);
    walk.walkTo(walk.map.stairs);
    walk.tick();
    expect(walk.player.path.length).toBe(total - 1);
  });

  it('records the tile passed through so rendering follows the path', () => {
    const g = quiet(72);
    g.walkTo(g.map.stairs);
    for (let i = 0; i < 5 && g.player.path.length > 1; i++) {
      g.tick();
      const { prev, via, pos } = g.player;
      expect(via).toBeDefined();
      const step = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      expect(step(prev, via!)).toBe(1);
      expect(step(via!, pos)).toBe(1);
      expect(isWalkable(g.map, via!.x, via!.y)).toBe(true);
    }
  });

  it('halves travel time to the stairs', () => {
    const ticksTo = (running: boolean) => {
      const g = quiet(73);
      g.setRunning(running);
      g.walkTo(g.map.stairs);
      let t = 0;
      while (g.depth === 1 && t < 500) {
        g.tick();
        t++;
      }
      return t;
    };
    expect(ticksTo(true)).toBeLessThanOrEqual(Math.ceil(ticksTo(false) / 2) + 1);
  });
});
