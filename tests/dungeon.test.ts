import { describe, expect, it } from 'vitest';
import { generateFloor } from '../src/world/dungeonGen';
import { findPath } from '../src/world/pathfinding';
import { Tile, tileAt } from '../src/world/tiles';

describe('dungeon generation', () => {
  it('is deterministic per seed', () => {
    expect(generateFloor(42, 1).tiles).toEqual(generateFloor(42, 1).tiles);
  });

  it('always has reachable stairs (1000 seeds)', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const map = generateFloor(seed, 1);
      expect(tileAt(map, map.stairs.x, map.stairs.y)).toBe(Tile.StairsDown);
      expect(map.stairs).not.toEqual(map.spawn);
      const path = findPath(map, map.spawn, map.stairs);
      expect(path.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual(map.stairs);
    }
  });
});
