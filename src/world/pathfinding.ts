import { FloorMap, Point, isWalkable } from './tiles';

const DIRS: ReadonlyArray<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * 8-directional A* from `from` to `to`, excluding the start tile; [] if unreachable.
 * Diagonal steps may not cut wall corners, as in OSRS.
 */
export function findPath(map: FloorMap, from: Point, to: Point): Point[] {
  if (!isWalkable(map, to.x, to.y)) return [];
  if (from.x === to.x && from.y === to.y) return [];

  const w = map.width;
  const key = (x: number, y: number) => y * w + x;
  const h = (x: number, y: number) => Math.max(Math.abs(x - to.x), Math.abs(y - to.y));

  const g = new Map<number, number>([[key(from.x, from.y), 0]]);
  const cameFrom = new Map<number, number>();
  const open: Array<{ k: number; f: number }> = [{ k: key(from.x, from.y), f: h(from.x, from.y) }];
  const closed = new Set<number>();
  const goal = key(to.x, to.y);

  while (open.length) {
    // Linear min-scan; floors are small enough that a heap isn't worth it.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { k } = open.splice(bi, 1)[0];
    if (k === goal) break;
    if (closed.has(k)) continue;
    closed.add(k);

    const cx = k % w;
    const cy = (k - cx) / w;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(map, nx, ny)) continue;
      if (dx && dy && (!isWalkable(map, nx, cy) || !isWalkable(map, cx, ny))) continue;
      const nk = key(nx, ny);
      const ng = g.get(k)! + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        cameFrom.set(nk, k);
        open.push({ k: nk, f: ng + h(nx, ny) });
      }
    }
  }

  if (!cameFrom.has(goal)) return [];
  const path: Point[] = [];
  for (let k = goal; k !== key(from.x, from.y); k = cameFrom.get(k)!) {
    path.push({ x: k % w, y: Math.floor(k / w) });
  }
  return path.reverse();
}
