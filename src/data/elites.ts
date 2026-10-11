import type { NpcDef } from './npcs';

/** Elite monsters: tougher variants with an affix, double loot and bonus tokens. */
export interface EliteAffix {
  id: string;
  name: string;
  desc: string;
  /** Returns the monster's stats with the affix applied (on top of the base elite boost). */
  apply: (d: NpcDef) => NpcDef;
}

/** Chance a regular monster from floor ELITE_MIN_DEPTH spawns as an elite. */
export const ELITE_CHANCE = 0.08;
export const ELITE_MIN_DEPTH = 3;
/** Extra Dungeoneering tokens per elite kill. */
export const ELITE_TOKENS = 3;

const scale = (v: number, f: number) => Math.round(v * f);

export const ELITE_AFFIXES: EliteAffix[] = [
  { id: 'brutal', name: 'Brutal', desc: 'Hits much harder.', apply: (d) => ({ ...d, strength: scale(d.strength, 1.3), strengthBonus: d.strengthBonus + 15 }) },
  { id: 'armoured', name: 'Armoured', desc: 'Very hard to hit.', apply: (d) => ({ ...d, defence: scale(d.defence, 1.3), defenceBonus: d.defenceBonus + 30 }) },
  { id: 'swift', name: 'Swift', desc: 'Attacks faster and notices you sooner.', apply: (d) => ({ ...d, attackSpeed: Math.max(2, d.attackSpeed - 1), aggroRadius: d.aggroRadius + 2 }) },
  { id: 'vampiric', name: 'Vampiric', desc: 'Heals for half the damage it deals.', apply: (d) => ({ ...d }) },
  { id: 'savage', name: 'Savage', desc: 'Rarely misses.', apply: (d) => ({ ...d, attack: scale(d.attack, 1.3), attackBonus: d.attackBonus + 20 }) },
];

/** Every elite is beefier; the affix adds its twist on top. */
export function eliteDef(d: NpcDef, affix: EliteAffix): NpcDef {
  return affix.apply({ ...d, hitpoints: scale(d.hitpoints, 1.6), examine: `${d.examine} (Elite: ${affix.desc})` });
}
