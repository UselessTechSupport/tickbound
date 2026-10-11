import { Map as RotMap } from 'rot-js';
import { seedRng } from '../core/rng';
import { FloorMap, Tile } from './tiles';

export const FLOOR_WIDTH = 64;
export const FLOOR_HEIGHT = 40;

/**
 * Generates one dungeon floor: rooms + corridors via rot.js Digger.
 * Spawn is placed in the first room, stairs down in the room farthest from it.
 */
export function generateFloor(seed: number, depth: number): FloorMap {
  seedRng(seed);
  const tiles = new Uint8Array(FLOOR_WIDTH * FLOOR_HEIGHT); // all Wall
  const digger = new RotMap.Digger(FLOOR_WIDTH, FLOOR_HEIGHT, {
    roomWidth: [4, 10],
    roomHeight: [3, 7],
    corridorLength: [2, 8],
    dugPercentage: 0.3,
  });
  digger.create((x, y, wall) => {
    if (!wall) tiles[y * FLOOR_WIDTH + x] = Tile.Floor;
  });

  const rooms = digger.getRooms();
  const first = rooms[0];
  const spawn = { x: first.getCenter()[0], y: first.getCenter()[1] };

  let stairs = spawn;
  let best = -1;
  for (const room of rooms.slice(1)) {
    const [cx, cy] = room.getCenter();
    const d = Math.abs(cx - spawn.x) + Math.abs(cy - spawn.y);
    if (d > best) {
      best = d;
      stairs = { x: cx, y: cy };
    }
  }
  tiles[stairs.y * FLOOR_WIDTH + stairs.x] = Tile.StairsDown;

  const roomBounds = rooms.map((r) => ({ left: r.getLeft(), right: r.getRight(), top: r.getTop(), bottom: r.getBottom() }));
  return { width: FLOOR_WIDTH, height: FLOOR_HEIGHT, tiles, spawn, stairs, depth, rooms: roomBounds };
}
