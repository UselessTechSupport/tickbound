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
  | { kind: 'take'; item: GroundItem; all?: boolean }
  | { kind: 'descend' }
  | { kind: 'gather'; node: ResourceNode; started: boolean }
  | { kind: 'altar'; node: ResourceNode }
  | { kind: 'talk'; node: ResourceNode }
  | { kind: 'pickpocket'; npc: Npc }
  | { kind: 'shortcut'; node: ResourceNode }
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
  /** Arrows in the ammo slot. */
  ammo = 0;
  /** Spell cast by a wielded staff; null = strongest one available. */
  autocast: string | null = null;
  /** Temporary stat boosts from potions (levels above your real level). */
  boosts: Partial<Record<SkillName, number>> = {};
  prayerPoints = 1;
  activePrayers = new Set<string>();
  /** OSRS drain counter; a point drains each time it passes the drain resistance. */
  prayerDrain = 0;
  /** Caught pickpocketing: can't act until this tick. */
  stunnedUntil = 0;

  constructor(start: Point) {
    super(start, 10);
  }

  get name(): string {
    return 'You';
  }

  get maxHp(): number {
    return this.skills.level('hitpoints');
  }

  /** Real level plus any potion boost; used in combat. */
  boostedLevel(skill: SkillName): number {
    return this.skills.level(skill) + (this.boosts[skill] ?? 0);
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
    return combatLevel(s.level('attack'), s.level('strength'), s.level('defence'), s.level('hitpoints'), s.level('prayer'),
      s.level('ranged'), s.level('magic'));
  }

  /** Which combat style the wielded weapon uses. */
  get weaponType(): 'melee' | 'ranged' | 'magic' {
    const w = this.equipment.weapon;
    return (w && item(w).equip?.combatStyle) || 'melee';
  }

  /** Attack reach in tiles: melee 1 (cardinal), bows 7 (+2 on Longrange), staffs 8. */
  get attackRange(): number {
    const w = this.equipment.weapon;
    const e = w ? item(w).equip : undefined;
    if (!e?.combatStyle) return 1;
    return (e.attackRange ?? 7) + (e.combatStyle === 'ranged' && this.style === 'defensive' ? 2 : 0);
  }

  bonuses(): { attack: number; strength: number; defence: number; speed: number; ranged: number; rangedStrength: number; magic: number } {
    const b = { attack: 0, strength: 0, defence: 0, speed: 4, ranged: 0, rangedStrength: 0, magic: 0 };
    for (const id of Object.values(this.equipment)) {
      const e = id ? item(id).equip : undefined;
      if (!e) continue;
      b.attack += e.attackBonus;
      b.strength += e.strengthBonus;
      b.defence += e.defenceBonus;
      b.ranged += e.rangedBonus ?? 0;
      b.rangedStrength += e.rangedStrength ?? 0;
      b.magic += e.magicBonus ?? 0;
      if (e.attackSpeed) b.speed = e.attackSpeed;
    }
    return b;
  }

  /** Running covers 2 tiles per tick instead of 1, as in OSRS. */
  running = true;

  /** Move one tile along the queued path. */
  step(): void {
    const next = this.path.shift();
    if (next) this.pos = next;
  }
}
