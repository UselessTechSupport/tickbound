/** OSRS game tick length in milliseconds. */
export const TICK_MS = 600;

export type TickHandler = (tick: number) => void;

/**
 * Fixed-step scheduler: game logic advances in discrete 600ms ticks while
 * rendering runs every frame and interpolates using `alpha`.
 */
export class TickScheduler {
  private accumulator = 0;
  private handlers: TickHandler[] = [];
  tick = 0;

  onTick(handler: TickHandler): void {
    this.handlers.push(handler);
  }

  /** Advance by `deltaMs` of real time; runs any ticks that became due. */
  update(deltaMs: number): void {
    this.accumulator += deltaMs;
    // Clamp so a backgrounded tab doesn't replay hundreds of ticks at once.
    if (this.accumulator > TICK_MS * 5) this.accumulator = TICK_MS * 5;
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.tick++;
      for (const h of this.handlers) h(this.tick);
    }
  }

  /** Progress (0..1) through the current tick, for render interpolation. */
  get alpha(): number {
    return this.accumulator / TICK_MS;
  }
}
