import { RNG } from 'rot-js';
import { ResourceDef, ResourceKind, resourcesFor } from '../data/resources';
import { ResourceNode } from '../entities/ResourceNode';
import { isBossFloor } from '../data/npcs';
import { SHRINE_CHANCE } from '../data/relics';
import { DARK_SHRINE_CHANCE, DARK_SHRINE_MIN_DEPTH } from '../data/curses';
import { WANDERER_CHANCE, WANDERER_MIN_DEPTH, rollDeal } from '../data/wanderers';
import { generateStock } from '../data/loot';
import { LOCKED_CHEST_CHANCE, LOCKED_CHEST_MIN_DEPTH, lockLevelFor } from '../data/thieving';
import { HIDDEN_ROOM_KIND, OPEN_SHORTCUT_KINDS, SHORTCUT_MIN_SAVING, shortcutLevelFor } from '../data/agility';
import { HIDDEN_ROOM_CHANCE, HIDDEN_ROOM_MIN_DEPTH, HIDDEN_ROOM_VARIANTS, hiddenRoomLevel } from '../data/hiddenRooms';
import { findPath } from './pathfinding';
import { FloorMap, Point, Tile, inHiddenRoom, isWalkable, reachableCount, setTile, tileAt } from './tiles';

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

/** The player's levels, so each floor has a shortcut and a lock they can actually attempt. */
export interface FloorLevels {
  agility: number;
  thieving: number;
}

/**
 * Places resources and stations on room edges. Every placement is checked so it
 * never cuts off part of the floor; ones that would are skipped.
 */
export function placeResources(map: FloorMap, levels?: FloorLevels): ResourceNode[] {
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
  if (!isBossFloor(map.depth) && map.depth >= WANDERER_MIN_DEPTH && RNG.getUniform() < WANDERER_CHANCE) {
    tryPlace((p) => Object.assign(new ResourceNode(p, 'wanderer'), { deal: rollDeal(() => RNG.getUniform()) }));
  }
  if (!isBossFloor(map.depth) && map.depth >= DARK_SHRINE_MIN_DEPTH && RNG.getUniform() < DARK_SHRINE_CHANCE) {
    tryPlace((p) => new ResourceNode(p, 'dark_shrine'));
  }
  if (map.depth >= 2 && !isBossFloor(map.depth) && RNG.getUniform() < MERCHANT_CHANCE) {
    tryPlace((p) => Object.assign(new ResourceNode(p, 'merchant'), { stock: generateStock(map.depth) }));
  }
  let easyLock = true;
  for (let i = 0; i < 2; i++) {
    if (RNG.getUniform() >= CHEST_CHANCE) continue;
    const locked = map.depth >= LOCKED_CHEST_MIN_DEPTH && RNG.getUniform() < LOCKED_CHEST_CHANCE;
    // The first lock on a floor never outpaces your Thieving, so a low level can still catch up.
    let lockLevel = lockLevelFor(map.depth);
    if (locked && easyLock && levels) lockLevel = Math.min(lockLevel, Math.max(1, levels.thieving));
    if (locked) easyLock = false;
    tryPlace((p) => Object.assign(new ResourceNode(p, 'chest'), locked ? { lockLevel } : {}));
  }
  // Last, so nothing gets placed on a shortcut's landing spots afterwards.
  if (map.depth >= HIDDEN_ROOM_MIN_DEPTH && !isBossFloor(map.depth) && RNG.getUniform() < HIDDEN_ROOM_CHANCE) {
    nodes.push(...placeHiddenRoom(map, levels?.agility));
  }
  nodes.push(...placeShortcuts(map, RNG.getUniformInt(1, 2), levels?.agility));
  return nodes;
}

/**
 * Agility shortcuts: a single wall tile between two floor tiles where walking around
 * takes much longer. The wall stays a wall; the shortcut is how you cross it.
 */
function placeShortcuts(map: FloorMap, count: number, agility?: number): ResourceNode[] {
  const out: ResourceNode[] = [];
  const spots: Array<{ wall: Point; a: Point; b: Point }> = [];
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (tileAt(map, x, y) !== Tile.Wall) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const a = { x: x - dx, y: y - dy };
        const b = { x: x + dx, y: y + dy };
        // A straight 1-thick wall: floor on both sides, wall either end.
        if (tileAt(map, a.x, a.y) !== Tile.Floor || tileAt(map, b.x, b.y) !== Tile.Floor) continue;
        if (inHiddenRoom(map, a.x, a.y) || inHiddenRoom(map, b.x, b.y)) continue;
        if (tileAt(map, x + dy, y + dx) !== Tile.Wall || tileAt(map, x - dy, y - dx) !== Tile.Wall) continue;
        spots.push({ wall: { x, y }, a, b });
      }
    }
  }
  const taken = (p: Point) => out.some((n) => Math.abs(n.pos.x - p.x) + Math.abs(n.pos.y - p.y) < 6);
  let tries = 0;
  for (const s of RNG.shuffle(spots)) {
    if (out.length >= count || tries++ > 40) break;
    if (taken(s.wall)) continue;
    const around = findPath(map, s.a, s.b).length;
    if (around < SHORTCUT_MIN_SAVING) continue;
    // The first shortcut on a floor never outpaces your Agility, so a low level can still catch up.
    let level = shortcutLevelFor(map.depth, RNG.getUniform());
    if (!out.length && agility !== undefined) level = Math.min(level, Math.max(1, agility));
    out.push(Object.assign(new ResourceNode(s.wall, 'shortcut'), {
      shortcut: { a: s.a, b: s.b, level, kind: RNG.getUniformInt(0, OPEN_SHORTCUT_KINDS - 1) },
    }));
  }
  return out;
}

/**
 * A hidden room: a small room carved into solid rock, reached only through a cracked wall
 * next to an existing corridor or room. Returns the crack and anything placed inside.
 */
function placeHiddenRoom(map: FloorMap, agility?: number): ResourceNode[] {
  for (let tries = 0; tries < 300; tries++) {
    const w = RNG.getUniformInt(3, 5);
    const h = RNG.getUniformInt(3, 4);
    const x = RNG.getUniformInt(2, map.width - w - 3);
    const y = RNG.getUniformInt(2, map.height - h - 3);
    // The room and a 1-tile shell around it must be solid rock.
    let solid = true;
    for (let yy = y - 1; yy <= y + h && solid; yy++) {
      for (let xx = x - 1; xx <= x + w && solid; xx++) if (tileAt(map, xx, yy) !== Tile.Wall) solid = false;
    }
    if (!solid) continue;
    // The crack: a shell tile with open floor right outside it.
    const doors: Array<{ wall: Point; out: Point; inside: Point }> = [];
    for (let xx = x; xx < x + w; xx++) {
      doors.push({ wall: { x: xx, y: y - 1 }, out: { x: xx, y: y - 2 }, inside: { x: xx, y } });
      doors.push({ wall: { x: xx, y: y + h }, out: { x: xx, y: y + h + 1 }, inside: { x: xx, y: y + h - 1 } });
    }
    for (let yy = y; yy < y + h; yy++) {
      doors.push({ wall: { x: x - 1, y: yy }, out: { x: x - 2, y: yy }, inside: { x, y: yy } });
      doors.push({ wall: { x: x + w, y: yy }, out: { x: x + w + 1, y: yy }, inside: { x: x + w - 1, y: yy } });
    }
    const open = doors.filter((d) => tileAt(map, d.out.x, d.out.y) === Tile.Floor
      && !(d.out.x === map.spawn.x && d.out.y === map.spawn.y));
    if (!open.length) continue;
    const door = RNG.getItem(open)!;
    const weights = Object.fromEntries(HIDDEN_ROOM_VARIANTS.map((v) => [v.id, v.weight]));
    const variant = RNG.getWeightedValue(weights) as (typeof HIDDEN_ROOM_VARIANTS)[number]['id'];
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setTile(map, xx, yy, Tile.Floor);
    map.hidden = { x, y, w, h, variant };
    const out: ResourceNode[] = [Object.assign(new ResourceNode(door.wall, 'shortcut'), {
      shortcut: { a: door.out, b: door.inside, level: crackLevel(map.depth, agility), kind: HIDDEN_ROOM_KIND },
    })];
    // The prize sits in the corner farthest from the crack (a corner never splits the room).
    const corners = [{ x, y }, { x: x + w - 1, y }, { x, y: y + h - 1 }, { x: x + w - 1, y: y + h - 1 }];
    const far = corners.sort((p, q) => (Math.abs(q.x - door.inside.x) + Math.abs(q.y - door.inside.y))
      - (Math.abs(p.x - door.inside.x) + Math.abs(p.y - door.inside.y)))[0];
    if (variant === 'cache' || variant === 'shrine') {
      setTile(map, far.x, far.y, Tile.Object);
      out.push(Object.assign(new ResourceNode(far, variant === 'cache' ? 'chest' : 'shrine'), variant === 'cache' ? { cache: true } : {}));
    }
    return out;
  }
  return [];
}

/** The room is the prize, so the crack is never above your Agility. */
function crackLevel(depth: number, agility?: number): number {
  const level = hiddenRoomLevel(shortcutLevelFor(depth, RNG.getUniform()));
  return agility === undefined ? level : Math.min(level, Math.max(1, agility));
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
