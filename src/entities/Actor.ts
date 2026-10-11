import { Point } from '../world/tiles';

export abstract class Actor {
  pos: Point;
  /** Position at the start of the current tick, for render interpolation. */
  prev: Point;
  hp: number;
  attackCooldown = 0;
  /** Tick this actor was last hit; drives HP bar visibility. */
  lastHitTick = -1000;

  constructor(start: Point, hp: number) {
    this.pos = { ...start };
    this.prev = { ...start };
    this.hp = hp;
  }

  abstract get maxHp(): number;
  abstract get name(): string;

  get dead(): boolean {
    return this.hp <= 0;
  }
}
