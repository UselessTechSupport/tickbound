export const enum Tile {
  Wall = 0,
  Floor = 1,
  StairsDown = 2,
  /** Floor occupied by a blocking object (rock, tree, fire, anvil...). */
  Object = 3,
}

export interface Point {
  x: number;
  y: number;
}

/** Interior bounds of a generated room (inclusive). */
export interface Room {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface FloorMap {
  width: number;
  height: number;
  tiles: Uint8Array;
  spawn: Point;
  stairs: Point;
  depth: number;
  rooms: Room[];
}

export function tileAt(map: FloorMap, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return Tile.Wall;
  return map.tiles[y * map.width + x] as Tile;
}

export function setTile(map: FloorMap, x: number, y: number, t: Tile): void {
  map.tiles[y * map.width + x] = t;
}

export function isWalkable(map: FloorMap, x: number, y: number): boolean {
  const t = tileAt(map, x, y);
  return t === Tile.Floor || t === Tile.StairsDown;
}

/** Objects block movement but not sight. */
export function isTransparent(map: FloorMap, x: number, y: number): boolean {
  return tileAt(map, x, y) !== Tile.Wall;
}

/** Number of walkable tiles reachable from `from` (4-directional flood fill). */
export function reachableCount(map: FloorMap, from: Point): number {
  const seen = new Uint8Array(map.width * map.height);
  const stack = [from];
  seen[from.y * map.width + from.x] = 1;
  let count = 0;
  while (stack.length) {
    const p = stack.pop()!;
    count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      const k = y * map.width + x;
      if (!isWalkable(map, x, y) || seen[k]) continue;
      seen[k] = 1;
      stack.push({ x, y });
    }
  }
  return count;
}
