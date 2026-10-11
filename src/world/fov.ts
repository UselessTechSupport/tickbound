import { FOV } from 'rot-js';
import { FloorMap, isTransparent } from './tiles';

/** Computes the set of tile indices (y * width + x) visible from (x, y). */
export function computeVisible(map: FloorMap, x: number, y: number, radius: number): Set<number> {
  const visible = new Set<number>();
  const fov = new FOV.PreciseShadowcasting((tx, ty) => isTransparent(map, tx, ty));
  fov.compute(x, y, radius, (tx, ty) => {
    if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) visible.add(ty * map.width + tx);
  });
  return visible;
}
