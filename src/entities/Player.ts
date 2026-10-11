import { EquipSlot, item } from '../data/items';
import { SkillName } from '../data/skills';
import { Skills } from '../systems/skills';
import { combatLevel } from '../systems/combat';
import { Point } from '../world/tiles';
import { Actor } from './Actor';
import { Inventory } from './Inventory';
import type { Npc } from './Npc';
import type { GroundItem } from './GroundItem';
import type { ResourceNode } from './ResourceNode';
import { NO_TOOLS, Toolbelt } from '../data/tools';
import type { Recipe } from '../data/recipes';
import { AttackType, PRAYER_BY_ID, PrayerGroup } from '../data/prayers';

export type AttackStyle = 'accurate' | 'aggressive' | 'defensive';

export const STYLE_SKILL: Record<AttackStyle, SkillName> = {
  accurate: 'attack',
  aggressive: 'strength',
  defensive: 'defence',
};

export type Intent =
  | { kind: 'walk' }
  | { kind: 'attack'; npc: Npc }
  | { kind: 'take'; item: GroundItem }
  | { kind: 'descend' }
  | { kind: 'gather'; node: ResourceNode; started: boolean }
  | { kind: 'altar'; node: ResourceNode }
  | { kind: 'process'; node: ResourceNode; recipe: Recipe; repeat: boolean; started: boolean };

export class Player extends Actor {
  skills = new Skills();
  inventory = new Inventory();
  equipment: Partial<Record<EquipSlot, string>> = {};
  style: AttackStyle = 'accurate';
  path: Point[] = [];
  intent: Intent | null = null;
  eatCooldown = 0;
  /** Ticks until the next skilling roll / crafted item. */
  actionTimer = 0;
  tools: Toolbelt = { ...NO_TOOLS };
  prayerPoints = 1;
  activePrayers = new Set<string>();
  /** OSRS drain counter; a point drains each time it passes the drain resistance. */
  prayerDrain = 0;

  constructor(start: Point) {
    super(start, 10);
  }

  get name(): string {
    return 'You';
  }

  get maxHp(): number {
    return this.skills.level('hitpoints');
  }

  get maxPrayer(): number {
    return this.skills.level('prayer');
  }

  /** Boost from the active stat prayer in `group` (e.g. 0.1 for Rock Skin). */
  prayerBoost(group: PrayerGroup): number {
    for (const id of this.activePrayers) {
      const def = PRAYER_BY_ID[id];
      if (def.group === group) return def.boost ?? 0;
    }
    return 0;
  }

  isProtectedFrom(style: AttackType): boolean {
    for (const id of this.activePrayers) if (PRAYER_BY_ID[id].protects === style) return true;
    return false;
  }

  get combatLevel(): number {
    const s = this.skills;
    return combatLevel(s.level('attack'), s.level('strength'), s.level('defence'), s.level('hitpoints'), s.level('prayer'));
  }

  bonuses(): { attack: number; strength: number; defence: number; speed: number } {
    const b = { attack: 0, strength: 0, defence: 0, speed: 4 };
    for (const id of Object.values(this.equipment)) {
      const e = id ? item(id).equip : undefined;
      if (!e) continue;
      b.attack += e.attackBonus;
      b.strength += e.strengthBonus;
      b.defence += e.defenceBonus;
      if (e.attackSpeed) b.speed = e.attackSpeed;
    }
    return b;
  }

  /** Walk one tile along the queued path (OSRS walking speed: 1 tile per tick). */
  step(): void {
    const next = this.path.shift();
    if (next) this.pos = next;
  }
}
