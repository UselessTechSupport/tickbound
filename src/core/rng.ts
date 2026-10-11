import { RNG } from 'rot-js';

/** Seeds rot.js's global RNG so dungeon generation is reproducible per run seed. */
export function seedRng(seed: number): void {
  RNG.setSeed(seed);
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export { RNG };
