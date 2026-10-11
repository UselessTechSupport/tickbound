/** Standard spellbook combat spells (OSRS levels and max hits). */
export interface SpellDef {
  id: string;
  name: string;
  level: number;
  maxHit: number;
  /** XP for casting, before damage XP. */
  baseXp: number;
  runes: Record<string, number>;
}

export const SPELLS: SpellDef[] = [
  { id: 'wind_strike', name: 'Wind Strike', level: 1, maxHit: 2, baseXp: 5.5, runes: { air_rune: 1, mind_rune: 1 } },
  { id: 'water_strike', name: 'Water Strike', level: 5, maxHit: 4, baseXp: 7.5, runes: { water_rune: 1, air_rune: 1, mind_rune: 1 } },
  { id: 'earth_strike', name: 'Earth Strike', level: 9, maxHit: 6, baseXp: 9.5, runes: { earth_rune: 2, air_rune: 1, mind_rune: 1 } },
  { id: 'fire_strike', name: 'Fire Strike', level: 13, maxHit: 8, baseXp: 11.5, runes: { fire_rune: 3, air_rune: 2, mind_rune: 1 } },
  { id: 'wind_bolt', name: 'Wind Bolt', level: 17, maxHit: 9, baseXp: 13.5, runes: { air_rune: 2, chaos_rune: 1 } },
  { id: 'water_bolt', name: 'Water Bolt', level: 23, maxHit: 10, baseXp: 16.5, runes: { water_rune: 2, air_rune: 2, chaos_rune: 1 } },
  { id: 'earth_bolt', name: 'Earth Bolt', level: 29, maxHit: 11, baseXp: 19.5, runes: { earth_rune: 3, air_rune: 2, chaos_rune: 1 } },
  { id: 'fire_bolt', name: 'Fire Bolt', level: 35, maxHit: 12, baseXp: 22.5, runes: { fire_rune: 4, air_rune: 3, chaos_rune: 1 } },
  { id: 'wind_blast', name: 'Wind Blast', level: 41, maxHit: 13, baseXp: 25.5, runes: { air_rune: 3, death_rune: 1 } },
  { id: 'water_blast', name: 'Water Blast', level: 47, maxHit: 14, baseXp: 28.5, runes: { water_rune: 3, air_rune: 3, death_rune: 1 } },
  { id: 'earth_blast', name: 'Earth Blast', level: 53, maxHit: 15, baseXp: 31.5, runes: { earth_rune: 4, air_rune: 3, death_rune: 1 } },
  { id: 'fire_blast', name: 'Fire Blast', level: 59, maxHit: 16, baseXp: 34.5, runes: { fire_rune: 5, air_rune: 4, death_rune: 1 } },
];

export const SPELL_BY_ID: Record<string, SpellDef> = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
