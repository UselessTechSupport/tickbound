import { RNG } from 'rot-js';
import { ResourceDef, ResourceKind, resourcesFor } from '../data/resources';
import { ResourceNode } from '../entities/ResourceNode';
import { isBossFloor } from '../data/npcs';
import { SHRINE_CHANCE } from '../data/relics';
import { generateStock } from '../data/loot';
import { FloorMap, Point, Tile, isWalkable, reachableCount, setTile, tileAt } from './tiles';

/** Chance per floor of a furnace + anvil (floor 2 always has one). */
const FORGE_CHANCE = 0.5;
/** Chance per floor of a permanent campfire. */
const CAMPFIRE_CHANCE = 0.35;
/** Chance per floor of an altar (boss floors always have one). */
const ALTAR_CHANCE = 0.35;
/** Chance per floor (2+, not boss floors) of a wandering merchant. */
const MERCHANT_CHANCE = 0.3;
/** Each of up to two chests per floor appears with this chance. */
const CHEST_CHANCE = 0.45;

const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Places resources and stations on room edges. Every placement is checked so it
 * never cuts off part of the floor; ones that would are skipped.
 */
export function placeResources(map: FloorMap): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  let walkable = reachableCount(map, map.spawn);
  const candidates = RNG.shuffle(edgeTiles(map));

  const tryPlace = (make: (p: Point) => ResourceNode, near?: Point): ResourceNode | null => {
    const pool = near ? candidates.filter((c) => Math.abs(c.x - near.x) + Math.abs(c.y - near.y) <= 3) : candidates;
    for (const p of pool) {
      if (tileAt(map, p.x, p.y) !== Tile.Floor) continue;
      setTile(map, p.x, p.y, Tile.Object);
      // Must stay connected and keep a free side to interact from.
      const hasAccess = CARDINAL.some(([dx, dy]) => isWalkable(map, p.x + dx, p.y + dy));
      if (hasAccess && reachableCount(map, map.spawn) === walkable - 1) {
        walkable--;
        candidates.splice(candidates.indexOf(p), 1);
        const node = make(p);
        nodes.push(node);
        return node;
      }
      setTile(map, p.x, p.y, Tile.Floor);
    }
    return null;
  };

  const placeKind = (kind: ResourceKind, count: number) => {
    const pool = resourcesFor(kind, map.depth);
    if (!pool.length) return;
    const weights = Object.fromEntries(pool.map((r) => [r.id, r.weight]));
    for (let i = 0; i < count; i++) {
      const id = RNG.getWeightedValue(weights);
      const def = pool.find((r) => r.id === id)!;
      if (!tryPlace((p) => resourceNode(p, def))) return;
    }
  };

  placeKind('rock', RNG.getUniformInt(4, 7));
  placeKind('tree', RNG.getUniformInt(2, 4));
  placeKind('fishing', RNG.getUniformInt(1, 3));
  placeKind('herb', RNG.getUniformInt(1, 2));

  if (map.depth === 2 || RNG.getUniform() < FORGE_CHANCE) {
    const furnace = tryPlace((p) => new ResourceNode(p, 'furnace'));
    if (furnace) tryPlace((p) => new ResourceNode(p, 'anvil'), furnace.pos);
  }
  if (RNG.getUniform() < CAMPFIRE_CHANCE) tryPlace((p) => new ResourceNode(p, 'fire'));
  if (isBossFloor(map.depth) || RNG.getUniform() < ALTAR_CHANCE) tryPlace((p) => new ResourceNode(p, 'altar'));
  if (!isBossFloor(map.depth) && RNG.getUniform() < SHRINE_CHANCE) tryPlace((p) => new ResourceNode(p, 'shrine'));
  if (map.depth >= 2 && !isBossFloor(map.depth) && RNG.getUniform() < MERCHANT_CHANCE) {
    tryPlace((p) => Object.assign(new ResourceNode(p, 'merchant'), { stock: generateStock(map.depth) }));
  }
  for (let i = 0; i < 2; i++) if (RNG.getUniform() < CHEST_CHANCE) tryPlace((p) => new ResourceNode(p, 'chest'));
  return nodes;
}

function resourceNode(pos: Point, def: ResourceDef): ResourceNode {
  const node = new ResourceNode(pos, 'resource', def);
  node.remaining = RNG.getUniformInt(def.uses[0], def.uses[1]);
  return node;
}

/** Room floor tiles touching a wall, away from spawn and stairs. */
function edgeTiles(map: FloorMap): Point[] {
  const out: Point[] = [];
  for (const r of map.rooms) {
    for (let y = r.top; y <= r.bottom; y++) {
      for (let x = r.left; x <= r.right; x++) {
        if (tileAt(map, x, y) !== Tile.Floor) continue;
        if (Math.max(Math.abs(x - map.spawn.x), Math.abs(y - map.spawn.y)) < 2) continue;
        if (Math.abs(x - map.stairs.x) + Math.abs(y - map.stairs.y) < 2) continue;
        if (!CARDINAL.some(([dx, dy]) => tileAt(map, x + dx, y + dy) === Tile.Wall)) continue;
        out.push({ x, y });
      }
    }
  }
  return out;
}
