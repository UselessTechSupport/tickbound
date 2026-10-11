export const SKILLS = [
  'attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer',
  'mining', 'woodcutting', 'fishing', 'cooking', 'smithing',
] as const;

export type SkillName = (typeof SKILLS)[number];

export const SKILL_LABELS: Record<SkillName, string> = {
  attack: 'Attack', strength: 'Strength', defence: 'Defence', hitpoints: 'Hitpoints', ranged: 'Ranged', magic: 'Magic', prayer: 'Prayer',
  mining: 'Mining', woodcutting: 'Woodcutting', fishing: 'Fishing', cooking: 'Cooking', smithing: 'Smithing',
};
