/** Effective level for players: visible level + style bonus + 8 (OSRS, no prayers/potions). */
export function effectiveLevel(level: number, styleBonus = 0): number {
  return level + styleBonus + 8;
}

/** Attack or defence roll: effective level * (equipment bonus + 64). */
export function roll(effective: number, bonus: number): number {
  return effective * (bonus + 64);
}

/** OSRS hit chance from an attack roll vs a defence roll. */
export function hitChance(attackRoll: number, defenceRoll: number): number {
  return attackRoll > defenceRoll
    ? 1 - (defenceRoll + 2) / (2 * (attackRoll + 1))
    : attackRoll / (2 * (defenceRoll + 1));
}

export function maxHit(effectiveStrength: number, strengthBonus: number): number {
  return Math.floor(0.5 + (effectiveStrength * (strengthBonus + 64)) / 640);
}

/** Damage for one swing: 0 on a miss, otherwise uniform 0..max. */
export function rollDamage(chance: number, max: number, rand: () => number): number {
  if (rand() >= chance) return 0;
  return Math.floor(rand() * (max + 1));
}

export function combatLevel(attack: number, strength: number, defence: number, hitpoints: number, prayer = 1): number {
  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  return Math.floor(base + melee);
}
