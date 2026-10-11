import { RNG } from 'rot-js';
import { bossForDepth, isBossFloor, npcsForDepth } from '../data/npcs';
import { Npc } from '../entities/Npc';
import { FloorMap, Tile, isWalkable, tileAt } from './tiles';

/** Number of monsters on a floor; grows with depth. */
export function monsterCount(depth: number): number {
  return Math.min(18, 4 + depth);
}

/** Places depth-appropriate monsters on floor tiles away from the spawn point. */
export function spawnMonsters(map: FloorMap): Npc[] {
  const pool = npcsForDepth(map.depth);
  const weights = Object.fromEntries(pool.map((n) => [n.id, n.weight]));
  const candidates: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (tileAt(map, x, y) !== Tile.Floor) continue;
      if (Math.max(Math.abs(x - map.spawn.x), Math.abs(y - map.spawn.y)) < 7) continue;
      candidates.push({ x, y });
    }
  }
  const shuffled = RNG.shuffle(candidates);
  const npcs: Npc[] = [];
  if (isBossFloor(map.depth)) npcs.push(spawnBoss(map));
  for (let i = 0; i < monsterCount(map.depth) && i < shuffled.length; i++) {
    if (npcs.some((n) => n.pos.x === shuffled[i].x && n.pos.y === shuffled[i].y)) continue;
    const id = RNG.getWeightedValue(weights)!;
    npcs.push(new Npc(pool.find((n) => n.id === id)!, shuffled[i]));
  }
  return npcs;
}

/** The boss stands guard right next to the stairs down. */
function spawnBoss(map: FloorMap): Npc {
  const { x, y } = map.stairs;
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((p) => isWalkable(map, p.x, p.y));
  return new Npc(bossForDepth(map.depth), around[0] ?? map.stairs);
}
