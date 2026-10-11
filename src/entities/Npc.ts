import { NpcDef } from '../data/npcs';
import { AttackType } from '../data/prayers';
import type { EliteAffix } from '../data/elites';
import { combatLevel } from '../systems/combat';
import { Point } from '../world/tiles';
import { Actor } from './Actor';

export class Npc extends Actor {
  def: NpcDef;
  spawn: Point;
  target: Actor | null = null;
  /** Set for elite monsters (their def already includes the boosts). */
  elite?: EliteAffix;
  /** Index into def.boss.styles for the style it's currently using. */
  styleIndex = 0;
  attacksSinceSwitch = 0;
  /** Successful pickpockets so far (each monster's pockets run out). */
  picked = 0;

  constructor(def: NpcDef, start: Point) {
    super(start, def.hitpoints);
    this.def = def;
    this.spawn = { ...start };
  }

  get name(): string {
    return this.elite ? `${this.elite.name} ${this.def.name}` : this.def.name;
  }

  get maxHp(): number {
    return this.def.hitpoints;
  }

  get attackStyle(): AttackType {
    return this.def.boss ? this.def.boss.styles[this.styleIndex] : this.def.attackStyle ?? 'melee';
  }

  /** Reach in tiles for the current style; melee is always 1. */
  get attackRange(): number {
    return this.attackStyle === 'melee' ? 1 : this.def.attackRange ?? 6;
  }

  get isBoss(): boolean {
    return !!this.def.boss;
  }

  get level(): number {
    const d = this.def;
    return combatLevel(d.attack, d.strength, d.defence, d.hitpoints);
  }
}
