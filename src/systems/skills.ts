import { SKILLS, SkillName } from '../data/skills';
import { levelForXp, xpForLevel } from './xp';

export class Skills {
  xp: Record<SkillName, number>;

  constructor() {
    this.xp = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<SkillName, number>;
    this.xp.hitpoints = xpForLevel(10);
  }

  level(skill: SkillName): number {
    return levelForXp(this.xp[skill]);
  }

  /** Adds XP and returns the number of levels gained. */
  addXp(skill: SkillName, amount: number): number {
    const before = this.level(skill);
    this.xp[skill] = Math.min(200_000_000, this.xp[skill] + amount);
    return this.level(skill) - before;
  }
}
